'use client';

import { useAppStore } from '@/store/app-store';

let speakId = 0;
let pendingResolve: (() => void) | null = null;
let resumeTimer: ReturnType<typeof setInterval> | null = null;

// Single shared Audio element — reused across all ElevenLabs playback.
// iOS Safari tracks audio-unlock per-element: only an Audio element that
// was .play()'d during a user gesture is allowed to play later async.
// By reusing ONE element we keep it permanently "blessed".
let sharedAudio: HTMLAudioElement | null = null;
let lastObjectUrl: string | null = null;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio && typeof window !== 'undefined') {
    sharedAudio = new Audio();
  }
  return sharedAudio!;
}

function setPlaying(active: boolean) {
  const { setIsSpeaking, setOrbState } = useAppStore.getState();
  setIsSpeaking(active);
  setOrbState(active ? 'speaking' : 'idle');
}

function clearResumeTimer() {
  if (resumeTimer !== null) {
    clearInterval(resumeTimer);
    resumeTimer = null;
  }
}

function revokeLastUrl() {
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = null;
  }
}

// ── Browser speechSynthesis fallback ──────────────────────────────────
function speakWithBrowser(text: string, id: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setPlaying(false);
      resolve();
      return;
    }

    const synth = window.speechSynthesis;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick the best-sounding English voice available, in priority order.
    const voices = synth.getVoices();
    const voicePrefs = [
      'Samantha',                   // iOS / macOS — US English, natural
      'Google UK English Female',   // Chrome desktop
      'Microsoft Zira',             // Windows
      'Moira',                      // macOS — Irish English, soft
      'Fiona',                      // macOS — Scottish, pleasant
      'Daniel',                     // iOS / macOS — UK English
      'Tessa',                      // macOS — South African
    ];
    let preferred: SpeechSynthesisVoice | undefined;
    for (const name of voicePrefs) {
      preferred = voices.find((v) => v.lang.startsWith('en') && v.name.includes(name));
      if (preferred) break;
    }
    if (!preferred) {
      preferred = voices.find((v) => v.lang.startsWith('en') && !v.name.includes('Karen'));
    }
    if (preferred) utterance.voice = preferred;

    const done = () => {
      clearResumeTimer();
      if (id === speakId) setPlaying(false);
      pendingResolve = null;
      resolve();
    };

    utterance.onstart = () => {
      if (id === speakId) setPlaying(true);
    };
    utterance.onend = done;
    utterance.onerror = done;

    pendingResolve = resolve;
    synth.speak(utterance);

    clearResumeTimer();
    resumeTimer = setInterval(() => {
      if (!synth.speaking) {
        clearResumeTimer();
      } else {
        synth.resume();
      }
    }, 3000);
  });
}

// ── Main speak function ───────────────────────────────────────────────
export async function speak(text: string): Promise<void> {
  const id = ++speakId;

  // Stop any currently playing audio
  const audio = sharedAudio;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  revokeLastUrl();

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (synth?.speaking || synth?.pending) {
    synth.cancel();
    await new Promise((r) => setTimeout(r, 80));
  }
  clearResumeTimer();

  if (pendingResolve) {
    pendingResolve();
    pendingResolve = null;
  }

  if (!text?.trim()) {
    setPlaying(false);
    return;
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (id !== speakId) return;

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.warn(`[TTS] ElevenLabs returned ${response.status}: ${errBody} — using browser voice`);
      await speakWithBrowser(text, id);
      return;
    }

    const audioBlob = await response.blob();
    if (id !== speakId) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    lastObjectUrl = audioUrl;

    // Reuse the shared (pre-unlocked) Audio element
    const player = getSharedAudio();
    player.src = audioUrl;
    player.volume = 1.0;

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        if (id === speakId) setPlaying(false);
        revokeLastUrl();
        pendingResolve = null;
        resolve();
      };

      player.onended = cleanup;
      player.onerror = cleanup;
      pendingResolve = resolve;

      player.play()
        .then(() => {
          if (id === speakId) setPlaying(true);
        })
        .catch((err) => {
          console.warn('[TTS] audio.play() blocked — falling back to browser voice', err?.message);
          revokeLastUrl();
          pendingResolve = null;
          speakWithBrowser(text, id).then(resolve);
        });
    });
  } catch {
    if (id === speakId) {
      await speakWithBrowser(text, id);
    }
  }
}

// Call from a user-gesture handler to "unlock" both HTMLAudioElement and
// speechSynthesis on iOS Safari.  iOS requires play()/speak() during a
// user-initiated event before allowing async calls later.
export function unlockAudioPlayback(): void {
  if (typeof window === 'undefined') return;
  const player = getSharedAudio();
  // Play a tiny silent WAV on the shared element — this "blesses" it
  // so subsequent async .play() calls are allowed by iOS.
  player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
  player.volume = 0.01;
  player.play().catch(() => {});
}

export function warmUpTTS(): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0.01;
  u.rate = 10;
  synth.speak(u);
}

export function stopSpeaking(): void {
  speakId++;
  const audio = sharedAudio;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  revokeLastUrl();
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (synth?.speaking || synth?.pending) {
    synth.cancel();
  }
  clearResumeTimer();
  if (pendingResolve) {
    pendingResolve();
    pendingResolve = null;
  }
  setPlaying(false);
}
