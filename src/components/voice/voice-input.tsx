'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { useSpeech } from './use-speech';
import { routeFromTranscript } from '@/lib/keyword-router';
import { triggerHaptic } from '@/lib/haptics';

export default function VoiceInput() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const setTranscript = useAppStore((s) => s.setTranscript);
  const setIsListening = useAppStore((s) => s.setIsListening);
  const [textInput, setTextInput] = useState('');

  const handleResult = useCallback(
    (text: string) => {
      setTranscript(text);
      setOrbState('processing');

      const route = routeFromTranscript(text);
      if (route) {
        triggerHaptic('medium');
        setTimeout(() => {
          setScreen(route.screen);
          setOrbState('idle');
        }, 600);
      } else {
        setTimeout(() => {
          setOrbState('idle');
        }, 1500);
      }
    },
    [setTranscript, setOrbState, setScreen]
  );

  const {
    isListening,
    isSupported,
    interimTranscript,
    startListening,
    stopListening,
  } = useSpeech({
    onResult: handleResult,
    onInterim: (text) => setTranscript(text),
  });

  useEffect(() => {
    setIsListening(isListening);
    setOrbState(isListening ? 'listening' : 'idle');
  }, [isListening, setIsListening, setOrbState]);

  const handleMicToggle = () => {
    triggerHaptic('light');
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      handleResult(textInput.trim());
      setTextInput('');
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 px-6">
      {/* Listening indicator */}
      <AnimatePresence>
        {(interimTranscript || isListening) && (
          <motion.div
            className="w-full text-center"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-foreground/40 text-sm italic">
              {interimTranscript || 'Listening...'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text input + separate mic button */}
      <div className="flex items-center gap-3 w-full max-w-sm">
        {/* Text input box */}
        <form onSubmit={handleTextSubmit} className="flex-1 min-w-0">
          <div className="flex items-center gap-2 glass-card rounded-full px-4 py-2.5">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask about colour, fit, or details..."
              className="flex-1 bg-transparent text-foreground/80 text-sm placeholder:text-foreground/30 outline-none min-w-0"
            />

            {/* Send button — only visible when text entered */}
            {textInput.trim() && (
              <button
                type="submit"
                className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gold/20 text-gold transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* Mic button — always visible, separate from text box */}
        {isSupported && (
          <motion.button
            type="button"
            onClick={handleMicToggle}
            className={`relative flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ${
              isListening
                ? 'bg-gold/20 border-2 border-gold'
                : 'glass-card border border-glass-border'
            }`}
            whileTap={{ scale: 0.9 }}
          >
            {/* Pulse ring when listening */}
            {isListening && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-gold/30"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isListening ? '#C9A96E' : '#F5F0EB'}
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
