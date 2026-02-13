'use client';

import { useAppStore } from '@/store/app-store';

let currentAudio: HTMLAudioElement | null = null;
let speakId = 0;
// Resolve function for the current speak() promise — allows stopSpeaking()
// to unblock any code awaiting speak() (e.g., sendToChat auto-exit logic).
let pendingResolve: (() => void) | null = null;

function setPlaying(active: boolean) {
  const { setIsSpeaking, setOrbState } = useAppStore.getState();
  setIsSpeaking(active);
  setOrbState(active ? 'speaking' : 'idle');
}

// ── Browser speechSynthesis fallback ──────────────────────────────────
function speakWithBrowser(text: string, id: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setPlaying(false);
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Google UK English Female') ||
          v.name.includes('Microsoft Zira')),
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      if (id === speakId) setPlaying(true);
    };
    utterance.onend = () => {
      if (id === speakId) setPlaying(false);
      pendingResolve = null;
      resolve();
    };
    utterance.onerror = () => {
      if (id === speakId) setPlaying(false);
      pendingResolve = null;
      resolve();
    };

    pendingResolve = resolve;
    window.speechSynthesis.speak(utterance);
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
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
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
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  // Resolve any pending speak() promise so callers (e.g., sendToChat) don't hang
  if (pendingResolve) {
    pendingResolve();
    pendingResolve = null;
  }
  setPlaying(false);
}
