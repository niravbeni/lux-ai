'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import { speak } from '@/lib/tts';
import { productData, colourways } from '@/data/product-data';
import { triggerHaptic } from '@/lib/haptics';

export default function SaveModal() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const activeColourway = useAppStore((s) => s.activeColourway);
  const fitResult = useAppStore((s) => s.fitResult);
  const colourResult = useAppStore((s) => s.colourResult);
  const recommendedSize = useAppStore((s) => s.recommendedSize);

  const [phase, setPhase] = useState<'sending' | 'sent'>('sending');

  const activeColourName = useMemo(() => {
    const cw = colourways.find((c) => c.id === activeColourway);
    return cw?.name || 'Shiny Black';
  }, [activeColourway]);

  const sessionCode = useMemo(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'RB-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('sent');
      triggerHaptic('success');
      const msg = pickRandom(dialogueScripts.save.confirmation);
      setAssistantMessage(msg);
      speak(msg).catch(() => {});
    }, 2200);
    return () => clearTimeout(timer);
  }, [setAssistantMessage]);

  return (
    <motion.div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-radial-[circle_at_center] from-gold/5 via-transparent to-transparent" />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-8 px-8 max-w-sm w-full"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence mode="wait">
          {phase === 'sending' ? (
            <motion.div
              key="sending"
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Animated send icon */}
              <motion.div
                className="relative flex h-16 w-16 items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* Pulsing ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border border-foreground/10"
                  animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border border-foreground/10"
                  animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                />
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-foreground/15 bg-white/5">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-foreground/60"
                  >
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                </div>
              </motion.div>

              <div className="text-center space-y-2">
                <h2 className="text-foreground/80 text-lg font-light">
                  Sharing with store associate...
                </h2>
                <p className="text-foreground/40 text-sm">
                  Sending your preferences now
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="sent"
              className="flex flex-col items-center gap-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Success checkmark */}
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, type: 'spring' }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>

              <div className="text-center space-y-2">
                <h2 className="text-foreground/90 text-lg font-light">
                  Shared with store associate
                </h2>
                <p className="text-foreground/40 text-sm">
                  They&apos;ll have your selection ready
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session summary card */}
        <motion.div
          className="glass-card rounded-2xl p-5 w-full space-y-3"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {/* Product + code header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <p className="text-foreground/70 text-sm">{productData.name}</p>
            <p className="text-foreground/30 text-xs font-mono">{sessionCode}</p>
          </div>

          {/* Details being shared */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-foreground/40 text-xs">Colourway</p>
              <p className="text-foreground/70 text-sm">{activeColourName}</p>
            </div>
            {recommendedSize && (
              <div className="flex items-center justify-between">
                <p className="text-foreground/40 text-xs">Recommended size</p>
                <p className="text-foreground/70 text-sm capitalize">{recommendedSize}</p>
              </div>
            )}
            {fitResult && (
              <div className="flex items-center justify-between">
                <p className="text-foreground/40 text-xs">Lens width</p>
                <p className="text-foreground/70 text-sm">{fitResult.lensWidth}</p>
              </div>
            )}
            {colourResult && (
              <div className="flex items-center justify-between">
                <p className="text-foreground/40 text-xs">Colour match</p>
                <p className="text-foreground/70 text-sm">{colourResult.topMatch.name}</p>
              </div>
            )}
          </div>

          {/* Sending status indicator */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              {phase === 'sending' ? (
                <>
                  <motion.div
                    className="h-1.5 w-1.5 rounded-full bg-foreground/40"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <p className="text-foreground/40 text-xs">Sending to nearby associate...</p>
                </>
              ) : (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <p className="text-emerald-400/70 text-xs">Delivered</p>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Actions — only appear after sent */}
        <AnimatePresence>
          {phase === 'sent' && (
            <motion.div
              className="flex flex-col items-center gap-3 w-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <button
                onClick={() => setScreen('viewer-hub')}
                className="w-full glass-card rounded-full py-3 text-gold text-sm font-medium tracking-wide hover:border-gold/30 transition-colors active:scale-[0.98]"
              >
                Continue exploring
              </button>

              <button
                onClick={() => {
                  useAppStore.getState().setScreen('landing');
                  useAppStore.getState().setAssistantMessage('');
                  useAppStore.getState().setColourResult(null);
                  useAppStore.getState().setFitResult(null);
                  useAppStore.getState().setActiveColourway('shiny-black');
                }}
                className="text-foreground/30 text-sm py-2 hover:text-foreground/50 transition-colors"
              >
                Start over
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
