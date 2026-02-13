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

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

// ── Platform detection ─────────────────────────────────────────────────
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS;
}

// Max recording duration in ms — auto-stops to prevent runaway recordings
const MAX_RECORD_MS = 20_000;

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
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs for callbacks so the onstop closure always has the latest
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  // Shared stop-and-transcribe logic
  const finishRecording = useCallback(() => {
    // Clear auto-stop timer
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // onstop handler will do the transcription
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    // If already recording, stop it
    if (mediaRecorderRef.current) {
      finishRecording();
      return;
    }

    setInterimTranscript('');
    chunksRef.current = [];

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;

        // Pick a supported mime type — iOS Safari supports audio/mp4
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
          // If mimeType fails, try without options
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
          // Release the mic
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }

          const chunks = [...chunksRef.current];
          chunksRef.current = [];

          if (chunks.length === 0) {
            setIsListening(false);
            setInterimTranscript('');
            return;
          }

          const audioBlob = new Blob(chunks, { type: mimeType });

          // Show transcribing feedback
          setInterimTranscript('Transcribing...');
          onInterimRef.current?.('Transcribing...');

          try {
            const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
            const file = new File([audioBlob], `recording.${ext}`, {
              type: mimeType,
            });
            const formData = new FormData();
            formData.append('audio', file);

            const response = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errBody = await response.text().catch(() => '');
              console.error('Transcription error:', response.status, errBody);
              throw new Error('Transcription failed');
            }

            const data = await response.json();
            const text = data.text?.trim();

            if (text) {
              setTranscript(text);
              setInterimTranscript('');
              onResultRef.current?.(text);
            } else {
              setInterimTranscript('');
            }
          } catch (err) {
            console.error('Whisper transcription error:', err);
            setInterimTranscript('');
          }

          setIsListening(false);
        };

        // Start recording — collect data every 500ms (iOS needs larger chunks)
        recorder.start(500);
        setIsListening(true);
        setInterimTranscript('Listening — tap mic to send');
        onInterimRef.current?.('Listening — tap mic to send');

        // Auto-stop after MAX_RECORD_MS
        autoStopRef.current = setTimeout(() => {
          finishRecording();
        }, MAX_RECORD_MS);
      })
      .catch((err) => {
        console.error('getUserMedia error:', err);
        setIsListening(false);
      });
  }, [isSupported, finishRecording]);

  const stopListening = useCallback(() => {
    finishRecording();
    // Don't set isListening false here — let onstop handle it after transcription
  }, [finishRecording]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
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
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  };
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
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(
    null,
  );

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

// ── Public hook: auto-selects the right engine ─────────────────────────
export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const needsFallback = isIOSSafari();

  // Both hooks called unconditionally (Rules of Hooks)
  const whisper = useWhisperFallback(options.onResult, options.onInterim);
  const webSpeech = useWebSpeech(options);

  if (needsFallback) return whisper;
  return webSpeech;
}
