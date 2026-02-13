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
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
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
  // Track whether a stop was requested before getUserMedia resolved
  const wantStopRef = useRef(false);
  // Track if getUserMedia is in progress (prevent double starts)
  const acquiringRef = useRef(false);

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

    // If getUserMedia is in progress, don't start again
    if (acquiringRef.current) return;

    wantStopRef.current = false;
    setInterimTranscript('');
    chunksRef.current = [];

    // Set listening immediately for UI feedback
    setIsListening(true);
    setInterimTranscript('');
    onInterimRef.current?.('');
    acquiringRef.current = true;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        acquiringRef.current = false;

        // If stop was requested while we were waiting for getUserMedia, abort
        if (wantStopRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          setIsListening(false);
          setInterimTranscript('');
          wantStopRef.current = false;
          return;
        }

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

          // Show processing feedback (subtle)
          setInterimTranscript('Processing...');
          onInterimRef.current?.('Processing...');

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
        setInterimTranscript('Listening...');
        onInterimRef.current?.('Listening...');

        // Auto-stop after MAX_RECORD_MS
        autoStopRef.current = setTimeout(() => {
          finishRecording();
        }, MAX_RECORD_MS);
      })
      .catch((err) => {
        acquiringRef.current = false;
        console.error('getUserMedia error:', err);
        setIsListening(false);
        setInterimTranscript('');
      });
  }, [isSupported, finishRecording]);

  const stopListening = useCallback(() => {
    // If getUserMedia is still acquiring, flag for cancellation
    if (acquiringRef.current) {
      wantStopRef.current = true;
      // Don't set isListening false yet — the getUserMedia callback will handle it
      return;
    }

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
}: UseSpeechOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(
    null,
  );

  // Use refs for callbacks to prevent stale closures
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);

  // Accumulate all speech across the session
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
    // Use continuous mode so recognition keeps going while held
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  const startListening = useCallback(() => {
    if (!isSupported) return;

    // If already listening, do nothing
    if (recognitionRef.current) return;

    accumulatedRef.current = '';
    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    // Track the latest interim text so we can deliver it if recognition ends
    // without a final result (common on iOS Safari)
    let latestInterim = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalSoFar = '';
      let interim = '';

      // Iterate ALL results (not just from resultIndex) to build the full transcript
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

      // Show the full text so far (final + interim) as the live transcription
      const liveText = (finalSoFar + ' ' + interim).trim();
      if (liveText) {
        setInterimTranscript(liveText);
        onInterimRef.current?.(liveText);
      }
    };

    recognition.onerror = (event: Event) => {
      const errorEvent = event as Event & { error?: string };
      // Critical errors — give up
      if (errorEvent.error === 'not-allowed' || errorEvent.error === 'service-not-allowed') {
        setIsListening(false);
        recognitionRef.current = null;
        return;
      }
      // Benign errors (no-speech, audio-capture) — keep going, let user keep holding
    };

    recognition.onend = () => {
      setIsListening(false);

      // When recognition ends (user released button → stop() called),
      // deliver the accumulated transcript. If no final results were received
      // but we have interim text (common on short iOS sessions), use that.
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
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      // Don't null out the ref here — onend handler will do it after delivering results
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

// ── Public hook: auto-selects the right engine ─────────────────────────
export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const isIOS = isIOSSafari();

  // Both hooks called unconditionally (Rules of Hooks)
  const whisper = useWhisperFallback(options.onResult, options.onInterim);
  const webSpeech = useWebSpeech(options);

  // iOS Safari: webkitSpeechRecognition exists but is unreliable,
  // so we use the Whisper (MediaRecorder → server transcription) path.
  // All other platforms: use Web Speech API for real-time transcription.
  if (isIOS && whisper.isSupported) return whisper;
  if (webSpeech.isSupported) return webSpeech;
  return whisper;
}
