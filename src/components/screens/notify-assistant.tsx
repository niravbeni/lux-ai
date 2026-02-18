'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { getProduct, getColourway } from '@/data/product-catalog';
import { triggerHaptic } from '@/lib/haptics';
import FrameThumbnail from '@/components/viewer/frame-thumbnail';

export default function NotifyAssistant() {
  const setScreen = useAppStore((s) => s.setScreen);
  const activeProductId = useAppStore((s) => s.activeProductId);
  const activeColourway = useAppStore((s) => s.activeColourway);
  const savedFrames = useAppStore((s) => s.savedFrames);
  const frameColourways = useAppStore((s) => s.frameColourways);
  const [phase, setPhase] = useState<'calling' | 'notified'>('calling');

  const currentProduct = getProduct(activeProductId);
  const currentCw =
    currentProduct.colourways.find((c) => c.id === activeColourway) ??
    getColourway(activeColourway) ??
    currentProduct.colourways[0];

  const bookmarkedFrames = savedFrames
    .map((fId) => {
      try {
        const product = getProduct(fId);
        const cwId = frameColourways[fId];
        const colourway = cwId
          ? (product.colourways.find((c) => c.id === cwId) ?? getColourway(cwId) ?? product.colourways[0])
          : product.colourways[0];
        return { frameId: fId, product, colourway, colourwayId: cwId };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { frameId: string; product: ReturnType<typeof getProduct>; colourway: ReturnType<typeof getColourway>; colourwayId?: string }[];

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('notified');
      triggerHaptic('success');
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

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
        {/* Status icon */}
        <AnimatePresence mode="wait">
          {phase === 'calling' ? (
            <motion.div
              key="calling"
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
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </motion.div>

              <div className="text-center space-y-1.5">
                <h2 className="text-foreground/80 text-lg font-light">
                  Calling store assistant...
                </h2>
                <p className="text-foreground/40 text-sm max-w-[260px]">
                  Sharing your session details so they can help you in person
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="notified"
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
                  Assistant notified
                </h2>
                <p className="text-foreground/40 text-sm max-w-[260px]">
                  A store assistant is on their way to help you
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* What was shared */}
        <motion.div
          className="mt-8 w-full max-w-sm"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-foreground/30 text-[10px] tracking-[0.8px] uppercase mb-3">
            Shared with assistant
          </p>

          {/* Currently viewing */}
          <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
            <p className="text-foreground/30 text-[9px] tracking-[0.8px] uppercase mb-2.5">
              Currently viewing
            </p>
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl border border-white/10 flex-shrink-0 overflow-hidden relative"
                style={{ backgroundColor: '#111618' }}
              >
                <FrameThumbnail
                  productId={activeProductId}
                  colourwayId={activeColourway}
                  className="!absolute inset-0 w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground/70 text-sm font-medium truncate">{currentProduct.name}</p>
                {currentCw && (
                  <p className="text-foreground/40 text-xs mt-0.5 truncate">{currentCw.name}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bookmarked frames */}
          {bookmarkedFrames.length > 0 && (
            <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-foreground/30 text-[9px] tracking-[0.8px] uppercase mb-2.5">
                Saved frames ({bookmarkedFrames.length})
              </p>
              <div className="space-y-3">
                {bookmarkedFrames.map((f) => (
                  <div key={f.frameId} className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-lg border border-white/10 flex-shrink-0 overflow-hidden relative"
                      style={{ backgroundColor: '#111618' }}
                    >
                      <FrameThumbnail
                        productId={f.frameId}
                        colourwayId={f.colourwayId}
                        className="!absolute inset-0 w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground/60 text-xs font-medium truncate">{f.product.name}</p>
                      {f.colourway && (
                        <p className="text-foreground/30 text-[10px] mt-0.5 truncate">{f.colourway.name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Status line */}
        <motion.p
          className="mt-4 text-foreground/30 text-xs tracking-wide text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {phase === 'calling' ? 'Notifying store assistant...' : 'An assistant will be with you shortly'}
        </motion.p>
      </div>

      {/* Bottom action */}
      <AnimatePresence>
        {phase === 'notified' && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-2.5 px-8 bg-gradient-to-t from-background via-background/90 to-transparent pt-8"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => setScreen('viewer-hub')}
              className="w-full max-w-sm rounded-full py-3 text-sm tracking-wide text-foreground/70 border border-white/15 hover:border-white/30 transition-colors active:scale-95"
            >
              Continue browsing
            </button>
            <button
              onClick={() => setScreen('viewer-hub')}
              className="text-sm py-2 text-foreground/40 hover:text-foreground/60 transition-colors"
            >
              Go back
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
