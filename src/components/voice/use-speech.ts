'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechOptions {
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  lang?: string;
  continuous?: boolean;
}

interface UseSpeechReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Augment window for webkit prefix
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

// ── Platform detection ─────────────────────────────────────────────────
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Also treat all iOS browsers as needing the fallback — even Chrome on iOS
  // uses WebKit under the hood and has the same SpeechRecognition issues.
  return isIOS;
}

// ── Whisper-based recording fallback for iOS ───────────────────────────
function useWhisperFallback(
  onResult?: (transcript: string) => void,
  onInterim?: (transcript: string) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const startListening = useCallback(() => {
    if (!isSupported) return;

    setInterimTranscript('');

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        chunksRef.current = [];

        // Use a widely supported mime type
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          // Stop the mic stream
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;

          if (chunksRef.current.length === 0) {
            setIsListening(false);
            return;
          }

          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];

          // Show interim feedback
          setInterimTranscript('Transcribing...');
          onInterim?.('Transcribing...');

          try {
            const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
            const file = new File([audioBlob], `recording.${ext}`, { type: mimeType });
            const formData = new FormData();
            formData.append('audio', file);

            const response = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) throw new Error('Transcription failed');

            const data = await response.json();
            const text = data.text?.trim();

            if (text) {
              setTranscript(text);
              setInterimTranscript('');
              onResult?.(text);
            } else {
              setInterimTranscript('');
            }
          } catch {
            setInterimTranscript('');
          }

          setIsListening(false);
        };

        recorder.start(250); // Collect data every 250ms
        setIsListening(true);
      })
      .catch(() => {
        // Mic permission denied
        setIsListening(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { isListening, isSupported, transcript, interimTranscript, startListening, stopListening, resetTranscript };
}

// ── Web Speech API (Chrome, Android, etc.) ─────────────────────────────
function useWebSpeech({
  onResult,
  onInterim,
  lang = 'en-US',
  continuous = false,
}: UseSpeechOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  function createRecognition() {
    if (typeof window === 'undefined') return null;
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  const startListening = useCallback(() => {
    if (!isSupported) return;

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
        onInterim?.(interim);
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        setInterimTranscript('');
        onResult?.(finalTranscript);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, lang, continuous]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  return { isListening, isSupported, transcript, interimTranscript, startListening, stopListening, resetTranscript };
}

// ── Public hook: auto-selects the right engine ─────────────────────────
export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const needsFallback = isIOSSafari();

  // We must call both hooks unconditionally (Rules of Hooks), but only
  // use the result from the appropriate one.
  const whisper = useWhisperFallback(options.onResult, options.onInterim);
  const webSpeech = useWebSpeech(options);

  if (needsFallback) return whisper;
  return webSpeech;
}
