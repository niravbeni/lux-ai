'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { getProduct, getColourway } from '@/data/product-catalog';
import { triggerHaptic } from '@/lib/haptics';
import FrameThumbnail from '@/components/viewer/frame-thumbnail';

export default function RequestFrame() {
  const requestingFrameIds = useAppStore((s) => s.requestingFrameIds);
  const setScreen = useAppStore((s) => s.setScreen);
  const setActiveProductId = useAppStore((s) => s.setActiveProductId);
  const setActiveColourway = useAppStore((s) => s.setActiveColourway);
  const [phase, setPhase] = useState<'sending' | 'sent'>('sending');

  const frames = requestingFrameIds.map((entry) => {
    try {
      const product = getProduct(entry.frameId);
      const colourway = entry.colourwayId
        ? (product.colourways.find((c) => c.id === entry.colourwayId) ?? getColourway(entry.colourwayId) ?? product.colourways[0])
        : product.colourways[0];
      return { ...entry, product, colourway };
    } catch {
      return null;
    }
  }).filter(Boolean) as { frameId: string; colourwayId?: string; product: ReturnType<typeof getProduct>; colourway: ReturnType<typeof getColourway> }[];

  const isSingle = frames.length === 1;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('sent');
      triggerHaptic('success');
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleViewFrame = (frameId: string, colourwayId?: string) => {
    const product = getProduct(frameId);
    setActiveProductId(frameId);
    setActiveColourway(colourwayId ?? product.colourways[0]?.id ?? '');
    setScreen('viewer-hub');
  };

  const handleGoBack = () => {
    setScreen(isSingle ? 'viewer-hub' : 'frames-overview');
  };

  if (frames.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-foreground/50 text-sm">No frames selected</p>
      </div>
    );
  }

  return (
    <motion.div
      className="relative flex h-full w-full flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto flex flex-col items-center px-8"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)',
          scrollbarWidth: 'none',
        }}
      >
        {/* Animated status icon */}
        <AnimatePresence mode="wait">
          {phase === 'sending' ? (
            <motion.div
              key="sending"
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
                animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </motion.div>

              <div className="text-center space-y-1.5">
                <h2 className="text-foreground/80 text-lg font-light">
                  Requesting {isSingle ? 'frame' : `${frames.length} frames`}...
                </h2>
                <p className="text-foreground/40 text-sm">
                  Asking a store associate to bring {isSingle ? `the ${frames[0].product.name}` : 'these frames'} to you
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="sent"
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>

              <div className="text-center space-y-1.5">
                <h2 className="text-foreground/80 text-lg font-light">
                  Request sent
                </h2>
                <p className="text-foreground/40 text-sm">
                  A store associate will bring {isSingle ? `the ${frames[0].product.name}` : `${frames.length} frames`} to you shortly
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Frame cards */}
        <div className="mt-8 w-full max-w-sm space-y-3">
          {frames.map((f, i) => (
            <motion.div
              key={f.frameId}
              className="w-full rounded-2xl bg-white/5 border border-white/10 p-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl border border-white/10 flex-shrink-0 overflow-hidden relative"
                  style={{ backgroundColor: '#111618' }}
                >
                  <FrameThumbnail
                    productId={f.frameId}
                    colourwayId={f.colourwayId}
                    className="!absolute inset-0 w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground/70 text-sm font-medium truncate">{f.product.name}</p>
                  {f.colourway && (
                    <p className="text-foreground/40 text-xs mt-0.5 truncate">{f.colourway.name}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <motion.div
                    className={`w-2 h-2 rounded-full ${phase === 'sending' ? 'bg-foreground/40' : 'bg-emerald-400'}`}
                    animate={phase === 'sending' ? { opacity: [1, 0.3, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Overall status */}
        <motion.p
          className="mt-4 text-foreground/30 text-xs tracking-wide text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {phase === 'sending' ? 'Notifying store associate...' : 'Request delivered'}
        </motion.p>
      </div>

      {/* Bottom action buttons */}
      <AnimatePresence>
        {phase === 'sent' && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-2.5 px-8 bg-gradient-to-t from-background via-background/90 to-transparent pt-8"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {isSingle && (
              <button
                onClick={() => handleViewFrame(frames[0].frameId, frames[0].colourwayId)}
                className="w-full max-w-sm rounded-full py-3 text-sm tracking-wide text-foreground/70 border border-white/15 hover:border-white/30 transition-colors active:scale-95"
              >
                View this frame
              </button>
            )}
            <button
              onClick={handleGoBack}
              className="text-sm py-2 text-foreground/40 hover:text-foreground/60 transition-colors"
            >
              {isSingle ? 'Go back' : 'Back to saved frames'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
