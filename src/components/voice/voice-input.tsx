'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { useSpeech } from './use-speech';
import { routeFromTranscript } from '@/lib/keyword-router';
import { triggerHaptic } from '@/lib/haptics';
import { speak, stopSpeaking, warmUpTTS, unlockAudioPlayback } from '@/lib/tts';
import { getProduct, getColourway, registerColourway } from '@/data/product-catalog';

// Keyword-to-product mapping for fallback frame detection when the AI
// forgets to include an explicit [FRAME:...] tag in its response.
const FRAME_KEYWORDS: { pattern: RegExp; id: string }[] = [
  { pattern: /\baviator\b/i, id: 'rayban-aviator' },
  { pattern: /\boakley\b|\bvanguard\b/i, id: 'oakley-vanguard' },
  { pattern: /\bray[- ]?ban meta\b|\bmeta smart\b/i, id: 'rayban-meta' },
];

function inferFrameFromText(text: string): string | null {
  for (const { pattern, id } of FRAME_KEYWORDS) {
    if (pattern.test(text)) return id;
  }
  return null;
}

// Strip [FRAME:product-id] and [COLOUR:...] tags from text and extract ids.
// Supports both existing colourway IDs and custom colours:
//   [COLOUR:havana]                → existing id lookup
//   [COLOUR:Navy Blue|#1a237e]     → dynamically created colourway
function parseTags(text: string): {
  clean: string;
  frameId: string | null;
  colourId: string | null;
  customColour: { name: string; hex: string } | null;
} {
  const frameMatch = text.match(/\[FRAME:\s*([a-z0-9-]+)\s*\]/i);
  const colourMatch = text.match(/\[COLOUR:\s*([^\]]+?)\s*\]/i);

  let colourId: string | null = null;
  let customColour: { name: string; hex: string } | null = null;

  if (colourMatch) {
    const val = colourMatch[1];
    if (val.includes('|')) {
      const [name, hex] = val.split('|').map((s) => s.trim());
      if (name && hex && /^#[0-9a-f]{3,8}$/i.test(hex)) {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        colourId = id;
        customColour = { name, hex };
      }
    } else {
      colourId = val;
    }
  }

  const clean = text
    .replace(/\s*\[FRAME:[a-z0-9-]+\]/gi, '')
    .replace(/\s*\[COLOUR:[^\]]+\]/gi, '')
    .trim();

  // Use explicit tag first; fall back to keyword detection from clean text
  const frameId = frameMatch ? frameMatch[1] : inferFrameFromText(clean);

  return { clean, frameId, colourId, customColour };
}

export default function VoiceInput() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const setTranscript = useAppStore((s) => s.setTranscript);
  const setIsListening = useAppStore((s) => s.setIsListening);
  const isConversing = useAppStore((s) => s.isConversing);
  const setIsConversing = useAppStore((s) => s.setIsConversing);
  const setStreamingText = useAppStore((s) => s.setStreamingText);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const setRecommendedProductId = useAppStore((s) => s.setRecommendedProductId);
  const setAiRecommendedColourway = useAppStore((s) => s.setAiRecommendedColourway);
  const setActiveColourway = useAppStore((s) => s.setActiveColourway);
  const setActiveProductId = useAppStore((s) => s.setActiveProductId);
  const activeProductId = useAppStore((s) => s.activeProductId);
  const isSpeaking = useAppStore((s) => s.isSpeaking);

  const [textInput, setTextInput] = useState('');
  const isStreamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Core fetch + stream helper ───────────────────────────────────────
  type ChatResult = {
    clean: string;
    frameId: string | null;
    colourId: string | null;
    customColour: { name: string; hex: string } | null;
  };

  const fetchChatStream = useCallback(
    async (
      userText: string,
      controller: AbortController,
      /** Called with each incremental chunk of cleaned text */
      onChunk: (cleanSoFar: string) => void,
    ): Promise<ChatResult | null> => {
      addChatMessage('user', userText);
      const chatHistory = useAppStore.getState().chatHistory;

      // Signal a fresh session on the very first user message so the
      // server rolls a new random persona for this conversation.
      const isFirstMessage = chatHistory.filter((m) => m.role === 'user').length === 1;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          currentProductId: activeProductId,
          newSession: isFirstMessage,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) return null;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        onChunk(parseTags(fullText).clean);
      }

      const parsed = parseTags(fullText);
      // Only keep fallback-inferred frameId when it points to a DIFFERENT product;
      // if it matches the currently viewed one it's just the AI mentioning it, not
      // recommending a switch.  Explicit [FRAME:] tags are always trusted.
      const hasExplicitTag = /\[FRAME:\s*[a-z0-9-]+\s*\]/i.test(fullText);
      const currentPid = useAppStore.getState().activeProductId;
      const frameId =
        hasExplicitTag || (parsed.frameId && parsed.frameId !== currentPid)
          ? parsed.frameId
          : null;
      const { clean, colourId, customColour } = parsed;

      addChatMessage('assistant', clean, {
        frameId: frameId ?? undefined,
        colourwayId: colourId ?? undefined,
      });
      return { clean, frameId, colourId, customColour };
    },
    [activeProductId, addChatMessage],
  );

  // ── Voice-mode chat (full-screen orb) ──────────────────────────────
  const sendToChat = useCallback(
    async (userText: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      isStreamingRef.current = true;
      setOrbState('processing');
      setStreamingText('');
      setRecommendedProductId(null);
      setAiRecommendedColourway(null);

      try {
        const result = await fetchChatStream(userText, controller, (chunk) =>
          setStreamingText(chunk),
        );

        isStreamingRef.current = false;

        if (!result) {
          const fallback = "I didn't quite catch that — try asking about the frames, colour, or fit.";
          setStreamingText(fallback);
          setOrbState('idle');
          // Speak the error so the user always hears a response
          triggerHaptic('light');
          await speak(fallback).catch(() => {});
          return;
        }

        setAssistantMessage(result.clean);
        if (result.frameId) setRecommendedProductId(result.frameId);

        // Register dynamically created colourway if needed
        if (result.customColour && result.colourId) {
          registerColourway({
            id: result.colourId,
            name: result.customColour.name,
            color: result.customColour.hex,
            metalness: 0.3,
            roughness: 0.3,
          });
        }
        // Store colourway against the TARGET product (which may differ from the current one)
        if (result.colourId) {
          setAiRecommendedColourway(result.colourId, result.frameId ?? undefined);
        }

        setOrbState('idle');
        triggerHaptic('light');

        const ttsPromise = speak(result.clean).catch(() => {});
        const minReadDelay = new Promise((r) => setTimeout(r, 3000));
        await Promise.all([ttsPromise, minReadDelay]);

        // After TTS finishes: if the AI recommended a colourway (and/or frame),
        // automatically return to the product page so the user sees the result.
        const stillConversing = useAppStore.getState().isConversing;
        if (stillConversing && (result.colourId || result.frameId)) {
          const currentProductId = useAppStore.getState().activeProductId;
          if (result.frameId && result.frameId !== currentProductId) {
            setActiveProductId(result.frameId);
          }
          if (result.colourId && getColourway(result.colourId)) {
            setActiveColourway(result.colourId);
          }

          await new Promise((r) => setTimeout(r, 800));
          if (useAppStore.getState().isConversing) {
            setIsConversing(false);
            setStreamingText('');
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const errMsg = "Something went wrong — try again.";
        setStreamingText(errMsg);
        setOrbState('idle');
        isStreamingRef.current = false;
        // Speak the error so the user always hears a response
        await speak(errMsg).catch(() => {});
      }
    },
    [fetchChatStream, setOrbState, setStreamingText, setRecommendedProductId, setAiRecommendedColourway, setAssistantMessage, activeProductId, setActiveProductId, setActiveColourway, setIsConversing],
  );

  // ── Text-mode chat (inline, no orb) ────────────────────────────────
  const sendTextChat = useCallback(
    async (userText: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      isStreamingRef.current = true;
      setRecommendedProductId(null);
      setAiRecommendedColourway(null);

      // Show a brief "thinking" state inline
      setAssistantMessage('...');

      try {
        const result = await fetchChatStream(userText, controller, (chunk) =>
          setAssistantMessage(chunk),
        );

        isStreamingRef.current = false;

        if (!result) {
          setAssistantMessage("I didn't quite catch that — try asking about the frames, colour, or fit.");
          return;
        }

        setAssistantMessage(result.clean);
        if (result.frameId) setRecommendedProductId(result.frameId);

        // Register dynamically created colourway if needed
        if (result.customColour && result.colourId) {
          registerColourway({
            id: result.colourId,
            name: result.customColour.name,
            color: result.customColour.hex,
            metalness: 0.3,
            roughness: 0.3,
          });
        }

        // Switch frame first, then store/apply colourway against the correct product
        if (result.frameId && result.frameId !== activeProductId) {
          setActiveProductId(result.frameId);
        }
        if (result.colourId) {
          setAiRecommendedColourway(result.colourId, result.frameId ?? undefined);
        }
        if (result.colourId && getColourway(result.colourId)) {
          setActiveColourway(result.colourId);
        }

        // Read the reply aloud
        await speak(result.clean).catch(() => {});
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setAssistantMessage("Something went wrong — try again.");
        isStreamingRef.current = false;
      }
    },
    [fetchChatStream, setRecommendedProductId, setAiRecommendedColourway, setAssistantMessage, activeProductId, setActiveProductId, setActiveColourway],
  );

  // Handle voice/text result
  const handleResult = useCallback(
    (text: string) => {
      setTranscript(text);

      // If in conversation mode, send everything to GPT.
      // Do NOT use keyword router to navigate to colour-mode / fit-mode —
      // the user should stay in voice chat.  The AI can recommend colours
      // and frames via tags, with buttons shown in the orb overlay.
      if (isConversing) {
        sendToChat(text);
        return;
      }

      // Not in conversation mode — keyword router only
      setOrbState('processing');
      const route = routeFromTranscript(text);
      if (route) {
        triggerHaptic('medium');
        setTimeout(() => {
          setScreen(route.screen);
          setOrbState('idle');
        }, 600);
      } else {
        // No keyword match outside conversation mode — enter conversation mode and send to GPT
        setIsConversing(true);
        sendToChat(text);
      }
    },
    [setTranscript, setOrbState, setScreen, isConversing, setIsConversing, setStreamingText, sendToChat]
  );

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
  } = useSpeech({
    onResult: handleResult,
    onInterim: (text) => setTranscript(text),
  });

  useEffect(() => {
    setIsListening(isListening);
    if (isListening) {
      setOrbState('listening');
    }
  }, [isListening, setIsListening, setOrbState]);

  // ── Press-and-hold mic handlers ────────────────────────────────────
  const handleMicDown = () => {
    triggerHaptic('light');

    // Unlock audio playback for ElevenLabs (HTMLAudioElement) and warm
    // up browser TTS as fallback — both require a user gesture on iOS.
    unlockAudioPlayback();
    warmUpTTS();

    // If speaking, stop TTS first
    if (isSpeaking) {
      stopSpeaking();
    }

    // If not yet in conversation mode, just enter it — DON'T start
    // listening.  The original button is about to unmount (React re-render
    // swaps in the conversation-mode UI), so onPointerUp would never fire
    // and we'd be stuck listening.  The user will press-and-hold the new
    // large mic button to start talking.
    if (!isConversing) {
      setIsConversing(true);
      setRecommendedProductId(null);
      setStreamingText('');
      setTranscript('');
      return;
    }

    // Already in conversation mode — start recording
    setStreamingText('');
    setTranscript('');
    startListening();
  };

  const handleMicUp = () => {
    if (isListening) {
      triggerHaptic('light');
      stopListening();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    unlockAudioPlayback();

    // If we're in full-screen conversation mode, exit it first
    if (isConversing) {
      stopSpeaking();
      setIsConversing(false);
      setStreamingText('');
    }

    // Always send text to GPT — the AI will suggest features when relevant
    sendTextChat(text);
  };

  // ── Conversation mode: hold-to-talk mic button ──────────────────────
  // Transcript is displayed by viewer-hub's orb overlay — not here, to avoid duplication.
  if (isConversing) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* Hold-to-talk mic button */}
        {isSupported && (
          <motion.button
            type="button"
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerLeave={handleMicUp}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative flex-shrink-0 flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 select-none ${
              isListening
                ? 'bg-lux-blue/20 border-2 border-lux-blue/60'
                : 'glass-card border border-glass-border'
            }`}
            whileTap={{ scale: 0.85 }}
          >
            {/* Pulse ring — listening */}
            {isListening && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-lux-blue/40"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}

            {/* Speaking pulse — breathing glow when AI is talking back */}
            {isSpeaking && !isListening && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full bg-white/8"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.15, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border border-white/15"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
                />
              </>
            )}

            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F5F0EB"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relative z-10"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </motion.button>
        )}

        {/* Hold-to-talk label — "Listening" is already shown above the orb */}
        <p className="text-foreground/25 text-xs tracking-widest uppercase">
          {isSpeaking ? 'Speaking…' : 'Hold to talk'}
        </p>
      </div>
    );
  }

  // ── Product view: text input + small mic button ────────────────────

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3 w-full max-w-sm">
        {/* Text input box */}
        <form onSubmit={handleTextSubmit} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 rounded-full px-4 py-2.5 backdrop-blur-md border border-white/20 bg-white/5 transition-colors duration-300">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask about colour, fit, or details..."
              className="flex-1 bg-transparent text-sm outline-none min-w-0 placeholder:text-foreground/40 text-foreground/80"
            />

            {/* Send button — always rendered to keep size constant, fades in/out */}
            <button
              type="submit"
              className={`flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-foreground/70 transition-opacity duration-150 ${
                textInput.trim() ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </form>

        {/* Mic button — hold to talk, enters full-screen voice mode */}
        {isSupported && (
          <motion.button
            type="button"
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerLeave={handleMicUp}
            onContextMenu={(e) => e.preventDefault()}
            className="relative flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md border border-white/20 bg-white/8 transition-all duration-200 select-none"
            whileTap={{ scale: 0.9 }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relative z-10"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </motion.button>
        )}
      </div>
    </div>
  );
}
