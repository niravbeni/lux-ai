'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechOptions {
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  lang?: string;
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

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

// ── Platform detection ─────────────────────────────────────────────────
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// ── iOS: MediaRecorder + Whisper API ────────────────────────────────────
// Records audio while the user holds the button, then sends to Whisper for
// transcription. No intermediate status messages — the UI shows "Listening..."
// from the isListening state, and the final text appears seamlessly.
function useWhisperFallback(
  onResult?: (transcript: string) => void,
  _onInterim?: (transcript: string) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantStopRef = useRef(false);
  const acquiringRef = useRef(false);

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const finishRecording = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    if (mediaRecorderRef.current) { finishRecording(); return; }
    if (acquiringRef.current) return;

    wantStopRef.current = false;
    chunksRef.current = [];
    setIsListening(true);
    acquiringRef.current = true;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        acquiringRef.current = false;

        if (wantStopRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          setIsListening(false);
          wantStopRef.current = false;
          return;
        }

        streamRef.current = stream;

        let mimeType = 'audio/mp4';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }
        }

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, { mimeType });
        } catch {
          try {
            recorder = new MediaRecorder(stream);
            mimeType = recorder.mimeType || 'audio/mp4';
          } catch {
            stream.getTracks().forEach((t) => t.stop());
            setIsListening(false);
            return;
          }
        }

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }

          const chunks = [...chunksRef.current];
          chunksRef.current = [];

          if (chunks.length === 0) {
            setIsListening(false);
            return;
          }

          const audioBlob = new Blob(chunks, { type: mimeType });

          // No status messages — just transcribe silently
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
              onResultRef.current?.(text);
            }
          } catch (err) {
            console.error('Whisper transcription error:', err);
          }

          setIsListening(false);
        };

        recorder.start(500);

        // Auto-stop after 20s to prevent runaway recordings
        autoStopRef.current = setTimeout(() => finishRecording(), 20_000);
      })
      .catch((err) => {
        acquiringRef.current = false;
        console.error('getUserMedia error:', err);
        setIsListening(false);
      });
  }, [isSupported, finishRecording]);

  const stopListening = useCallback(() => {
    if (acquiringRef.current) {
      wantStopRef.current = true;
      return;
    }
    finishRecording();
  }, [finishRecording]);

  const resetTranscript = useCallback(() => { setTranscript(''); }, []);

  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript: '',
    startListening,
    stopListening,
    resetTranscript,
  };
}

// ── Desktop: Web Speech API ─────────────────────────────────────────────
// Real-time transcription — words appear as you speak.
function useWebSpeech({
  onResult,
  onInterim,
  lang = 'en-US',
}: UseSpeechOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  const accumulatedRef = useRef('');

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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  const startListening = useCallback(() => {
    if (!isSupported) return;
    if (recognitionRef.current) return;

    accumulatedRef.current = '';
    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);

    let latestInterim = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalSoFar = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalSoFar += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      accumulatedRef.current = finalSoFar;
      latestInterim = interim;

      const liveText = (finalSoFar + ' ' + interim).trim();
      if (liveText) {
        setInterimTranscript(liveText);
        onInterimRef.current?.(liveText);
      }
    };

    recognition.onerror = () => {
      // Silently handle errors — let the user keep holding
    };

    recognition.onend = () => {
      setIsListening(false);

      let finalText = accumulatedRef.current.trim();
      if (!finalText && latestInterim) {
        finalText = latestInterim.trim();
      }

      if (finalText) {
        setTranscript(finalText);
        setInterimTranscript('');
        onResultRef.current?.(finalText);
      } else {
        setInterimTranscript('');
      }
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    accumulatedRef.current = '';
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* */ }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  };
}

// ── Public hook ─────────────────────────────────────────────────────────
// Simple: iOS → Whisper, everything else → Web Speech API.
// No hybrid engines, no timers, no fallback logic.
export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const isIOS = isIOSSafari();

  // Both hooks always called (Rules of Hooks)
  const whisper = useWhisperFallback(options.onResult, options.onInterim);
  const webSpeech = useWebSpeech(options);

  if (isIOS) return whisper.isSupported ? whisper : webSpeech;
  return webSpeech.isSupported ? webSpeech : whisper;
}
