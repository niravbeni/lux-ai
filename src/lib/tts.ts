'use client';

import { useAppStore } from '@/store/app-store';

let currentAudio: HTMLAudioElement | null = null;
let speakId = 0;
// Resolve function for the current speak() promise — allows stopSpeaking()
// to unblock any code awaiting speak() (e.g., sendToChat auto-exit logic).
let pendingResolve: (() => void) | null = null;
// Interval that calls speechSynthesis.resume() — iOS Safari silently pauses
// long utterances and needs periodic nudging.
let resumeTimer: ReturnType<typeof setInterval> | null = null;
// Whether HTMLAudioElement.play() has been unlocked by a user gesture.
let audioUnlocked = false;

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

    const voices = synth.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Google UK English Female') ||
          v.name.includes('Microsoft Zira')),
    );
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

    // iOS Safari / Chrome workaround: the browser can silently pause
    // speechSynthesis after ~15 s.  Periodically call resume() to keep it alive.
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
// Returns a promise that resolves when audio FINISHES playing (not starts).
export async function speak(text: string): Promise<void> {
  const id = ++speakId;

  // Stop any currently playing audio and resolve any pending promise
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // Only cancel speechSynthesis if it's actually active — calling cancel()
  // when idle can break subsequent speaks on iOS Safari.
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (synth?.speaking || synth?.pending) {
    synth.cancel();
    // iOS needs a brief tick after cancel() before a new speak() will work
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
      console.warn(`[TTS] ElevenLabs returned ${response.status} — falling back to browser voice`);
      await speakWithBrowser(text, id);
      return;
    }

    const audioBlob = await response.blob();
    if (id !== speakId) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        if (currentAudio === audio) currentAudio = null;
        if (id === speakId) setPlaying(false);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        pendingResolve = null;
        resolve();
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;

      // Store the resolve so stopSpeaking() can unblock us
      pendingResolve = resolve;

      audio.play()
        .then(() => {
          if (id === speakId) setPlaying(true);
        })
        .catch((err) => {
          console.warn('[TTS] audio.play() blocked — falling back to browser voice', err?.message);
          if (currentAudio === audio) currentAudio = null;
          if (audioUrl) URL.revokeObjectURL(audioUrl);
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

// Call from a user-gesture handler (e.g. onPointerDown) to "unlock"
// speechSynthesis on iOS Safari — iOS requires a user-initiated speak()
// before allowing async speaks.  Without this, the fallback TTS is silent.
export function warmUpTTS(): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  // Speak a nearly-silent space character at max rate — completes instantly.
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0.01;
  u.rate = 10;
  synth.speak(u);
}

// Call from a user-gesture handler to unlock HTMLAudioElement.play() on iOS.
// iOS Safari blocks audio.play() unless it was first triggered during a
// user-initiated event.  Playing a tiny silent WAV "unlocks" the session
// so that later async speak() calls can use the ElevenLabs audio path.
export function unlockAudioPlayback(): void {
  if (audioUnlocked || typeof window === 'undefined') return;
  try {
    const a = new Audio();
    // Minimal valid WAV: 44-byte header, 0 data frames
    a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    a.volume = 0.01;
    a.play()
      .then(() => { audioUnlocked = true; })
      .catch(() => {});
  } catch {
    // Ignore — not critical, will fall back to browser speech
  }
}

export function stopSpeaking(): void {
  speakId++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (synth?.speaking || synth?.pending) {
    synth.cancel();
  }
  clearResumeTimer();
  // Resolve any pending speak() promise so callers (e.g., sendToChat) don't hang
  if (pendingResolve) {
    pendingResolve();
    pendingResolve = null;
  }
  setPlaying(false);
}
