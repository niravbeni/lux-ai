'use client';

import { useAppStore } from '@/store/app-store';

let currentAudio: HTMLAudioElement | null = null;
let speakId = 0; // Track the latest speak call to avoid stale callbacks

function cleanup(audioUrl?: string) {
  const { setIsSpeaking, setOrbState } = useAppStore.getState();
  setIsSpeaking(false);
  setOrbState('idle');
  if (audioUrl) URL.revokeObjectURL(audioUrl);
}

export async function speak(text: string): Promise<void> {
  const { setIsSpeaking, setOrbState } = useAppStore.getState();
  const id = ++speakId;

  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    setIsSpeaking(true);
    setOrbState('speaking');

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    // Stale — a newer speak() call happened while we were fetching
    if (id !== speakId) return;

    if (!response.ok) {
      cleanup();
      return;
    }

    const audioBlob = await response.blob();
    if (id !== speakId) return;

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      cleanup(audioUrl);
    };

    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      cleanup(audioUrl);
    };

    await audio.play().catch(() => {
      // Autoplay blocked or interrupted — fail silently
      if (currentAudio === audio) currentAudio = null;
      cleanup(audioUrl);
    });
  } catch {
    cleanup();
  }
}

export function stopSpeaking(): void {
  speakId++; // Invalidate any in-flight speak() calls
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio = null;
  }
  cleanup();
}
