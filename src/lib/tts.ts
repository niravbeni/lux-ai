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
// Whether speechSynthesis has been warmed up with a user gesture
let synthWarmedUp = false;

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

/**
 * Call this from a direct user gesture (e.g., mic button down) to unlock
 * speechSynthesis on iOS Safari.  iOS requires the very first speak() to
 * originate from a user-initiated event; after that it works from any context.
 */
export function warmUpSpeech(): void {
  if (synthWarmedUp) return;
  synthWarmedUp = true;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Silent utterance to unlock the speech engine on iOS
  const silent = new SpeechSynthesisUtterance('');
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
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

    // Try to get voices — on iOS they may load asynchronously
    let voices = synth.getVoices();
    if (voices.length === 0 && synth.onvoiceschanged !== undefined) {
      // Voices not ready yet — speak with default voice
      voices = [];
    }
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
    utterance.onerror = (e) => {
      // On iOS, 'interrupted' errors are normal when a new utterance replaces
      // the old one — don't treat them as failures.
      console.warn('[TTS fallback] speechSynthesis error:', e);
      done();
    };

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

    // Safety: if the utterance hasn't started within 2 seconds, it was
    // likely silently dropped (iOS quirk).  Resolve so callers aren't stuck.
    setTimeout(() => {
      if (id === speakId && !synth.speaking && pendingResolve === resolve) {
        console.warn('[TTS fallback] speechSynthesis utterance did not start — resolving.');
        done();
      }
    }, 2000);
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
        .catch(() => {
          if (currentAudio === audio) currentAudio = null;
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          pendingResolve = null;
          // Autoplay blocked — fall back to browser speech
          speakWithBrowser(text, id).then(resolve);
        });
    });
  } catch {
    if (id === speakId) {
      await speakWithBrowser(text, id);
    }
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
