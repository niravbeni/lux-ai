'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import { speak } from '@/lib/tts';
import { productData, colourways } from '@/data/product-data';

export default function SaveModal() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const activeColourway = useAppStore((s) => s.activeColourway);
  const fitResult = useAppStore((s) => s.fitResult);
  const colourResult = useAppStore((s) => s.colourResult);

  const activeColourName = useMemo(() => {
    const cw = colourways.find((c) => c.id === activeColourway);
    return cw?.name || 'Shiny Black';
  }, [activeColourway]);

  useEffect(() => {
    const msg = pickRandom(dialogueScripts.save.confirmation);
    setAssistantMessage(msg);
    speak(msg).catch(() => {});
  }, [setAssistantMessage]);

  // Generate a fake session QR code content
  const sessionCode = useMemo(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'RB-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }, []);

  return (
    <motion.div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0A0A0A]"
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
        {/* Checkmark */}
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, type: 'spring' }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C9A96E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-foreground/90 text-xl font-light">
            Saved to your store session
          </h2>
          <p className="text-foreground/50 text-sm">
            Show this to an associate when you&apos;re ready
          </p>
        </div>

        {/* Session summary card */}
        <motion.div
          className="glass-card rounded-2xl p-5 w-full space-y-4"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <p className="text-foreground/60 text-xs tracking-wide">{productData.name}</p>
            <p className="text-gold text-xs font-mono">{sessionCode}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-foreground/40 text-xs">Colourway</p>
              <p className="text-foreground/70 text-xs">{activeColourName}</p>
            </div>
            {fitResult && (
              <div className="flex items-center justify-between">
                <p className="text-foreground/40 text-xs">Recommended size</p>
                <p className="text-foreground/70 text-xs">{fitResult.lensWidth} lens width</p>
              </div>
            )}
            {colourResult && (
              <div className="flex items-center justify-between">
                <p className="text-foreground/40 text-xs">Colour match</p>
                <p className="text-foreground/70 text-xs">{colourResult.topMatch.name}</p>
              </div>
            )}
          </div>

          {/* QR-like visual (decorative) */}
          <div className="flex justify-center pt-2">
            <div className="grid grid-cols-7 gap-1 w-28 h-28">
              {Array.from({ length: 49 }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-sm ${
                    Math.random() > 0.4 ? 'bg-foreground/70' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            onClick={() => setScreen('viewer-hub')}
            className="w-full glass-card rounded-full py-3 text-gold text-sm font-medium tracking-wide hover:border-gold/30 transition-colors active:scale-[0.98]"
          >
            Continue exploring
          </button>

          <button
            onClick={() => {
              // Reset the whole experience
              useAppStore.getState().setScreen('landing');
              useAppStore.getState().setAssistantMessage('');
              useAppStore.getState().setColourResult(null);
              useAppStore.getState().setFitResult(null);
              useAppStore.getState().setActiveColourway('shiny-black');
            }}
            className="text-foreground/30 text-xs hover:text-foreground/50 transition-colors"
          >
            Start over
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
