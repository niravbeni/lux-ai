'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { getProduct } from '@/data/product-catalog';
import FrameThumbnail from '@/components/viewer/frame-thumbnail';

export default function FramesOverview() {
  const savedFrames = useAppStore((s) => s.savedFrames);
  const setScreen = useAppStore((s) => s.setScreen);
  const setActiveProductId = useAppStore((s) => s.setActiveProductId);
  const setActiveColourway = useAppStore((s) => s.setActiveColourway);
  const removeSavedFrame = useAppStore((s) => s.removeSavedFrame);
  const setRequestingFrames = useAppStore((s) => s.setRequestingFrames);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (frameId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(frameId)) next.delete(frameId);
      else next.add(frameId);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === savedFrames.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(savedFrames));
    }
  };

  const handleViewFrame = (productId: string) => {
    const product = getProduct(productId);
    setActiveProductId(productId);
    setActiveColourway(product.colourways[0]?.id ?? '');
    setScreen('viewer-hub');
  };

  const handleRequestSelected = () => {
    if (selected.size === 0) return;
    const frames = Array.from(selected).map((frameId) => ({ frameId }));
    setRequestingFrames(frames);
    setScreen('request-frame');
  };

  const hasSelection = selected.size > 0;

  return (
    <motion.div
      className="relative flex h-full w-full flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setScreen('viewer-hub')}
            className="flex h-10 w-10 items-center justify-center text-foreground/50 hover:text-foreground/80 transition-colors active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-foreground/80 text-base font-light tracking-wide">
            Saved Frames
          </h1>
        </div>

        {savedFrames.length > 0 && (
          <button
            onClick={selectAll}
            className="text-[10px] tracking-wide uppercase text-foreground/50 hover:text-foreground/70 transition-colors py-1 px-2"
          >
            {selected.size === savedFrames.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-6 pt-6"
        style={{ paddingBottom: hasSelection ? 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' : 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)', scrollbarWidth: 'none' }}
      >
        {savedFrames.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center h-full gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/30">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-foreground/40 text-sm text-center max-w-[200px]">
              No frames saved yet. Bookmark frames from the chat to see them here.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {savedFrames.map((frameId, i) => {
              let product;
              try {
                product = getProduct(frameId);
              } catch {
                return null;
              }
              const colourway = product.colourways[0];
              const isSelected = selected.has(frameId);

              return (
                <motion.div
                  key={frameId}
                  className="flex flex-col gap-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                >
                  {/* Frame card — tap to select */}
                  <button
                    onClick={() => toggleSelect(frameId)}
                    className={`w-full aspect-square rounded-[20px] border overflow-hidden transition-all active:scale-95 relative ${
                      isSelected
                        ? 'border-white/40 ring-1 ring-white/20'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                    style={{ backgroundColor: '#111618' }}
                  >
                    <FrameThumbnail
                      productId={frameId}
                      className="!absolute inset-0 w-full h-full"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
                      <p className="text-white/90 text-xs font-medium leading-tight">
                        {product.name}
                      </p>
                      {colourway && (
                        <p className="text-white/50 text-[10px] mt-0.5">{colourway.name}</p>
                      )}
                    </div>

                    {/* Selection indicator */}
                    <div className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-white/90 border-white/90'
                        : 'bg-black/30 border-white/25 backdrop-blur-sm'
                    }`}>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111618" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Action row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewFrame(frameId)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-[10px] tracking-wide uppercase text-foreground/50 border border-white/10 hover:border-white/25 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      View
                    </button>
                    <button
                      onClick={() => {
                        removeSavedFrame(frameId);
                        setSelected((prev) => { const next = new Set(prev); next.delete(frameId); return next; });
                      }}
                      className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 text-foreground/40 hover:text-foreground/70 hover:border-white/25 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="6" y1="6" x2="18" y2="18" />
                        <line x1="18" y1="6" x2="6" y2="18" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom action bar — request selected frames */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-30 px-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
          >
            <button
              onClick={handleRequestSelected}
              className="w-full rounded-full py-3.5 text-sm tracking-wide font-medium bg-white/90 text-[#111618] active:scale-[0.97] transition-transform"
            >
              Request {selected.size} {selected.size === 1 ? 'frame' : 'frames'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
