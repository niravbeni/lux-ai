'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { productData } from '@/data/product-data';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import { speak } from '@/lib/tts';

export default function DetailsMode() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const recommendedSize = useAppStore((s) => s.recommendedSize);

  useEffect(() => {
    const intro = pickRandom(dialogueScripts.details.intro);
    setAssistantMessage(intro);
    speak(intro).catch(() => {});
  }, [setAssistantMessage]);

  const handleClose = () => {
    setScreen('viewer-hub');
  };

  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Scrollable content */}
      <div
        className="relative z-10 flex-1 overflow-y-auto px-8 pb-32"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)', scrollbarWidth: 'none' }}
      >
        <div className="flex flex-col items-center text-center space-y-8 max-w-sm mx-auto">

          {/* Product name badge */}
          <motion.div
            className="rounded-full px-4 py-1.5 text-xs tracking-wide bg-white/5 backdrop-blur-md text-foreground/40 border border-white/5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {productData.name}
          </motion.div>

          {/* Tagline */}
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <p className="text-foreground/80 text-base leading-relaxed">{productData.tagline}</p>
            <p className="text-foreground/50 text-sm leading-relaxed">{productData.whyItMatters}</p>
          </motion.div>

          {/* Good for */}
          <motion.div
            className="space-y-3 w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <h3 className="text-foreground/40 text-xs tracking-[0.2em] uppercase">Good For</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {productData.goodFor.map((item, i) => (
                <motion.span
                  key={i}
                  className="glass-card rounded-full px-3 py-1.5 text-foreground/60 text-xs"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.05, duration: 0.3 }}
                >
                  {item}
                </motion.span>
              ))}
            </div>
          </motion.div>

          {/* Features */}
          <motion.div
            className="space-y-3 w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <h3 className="text-foreground/40 text-xs tracking-[0.2em] uppercase">Key Features</h3>
            <ul className="space-y-2.5 inline-block text-left">
              {productData.features.map((feature, i) => (
                <motion.li
                  key={i}
                  className="text-foreground/70 text-sm leading-relaxed flex items-start gap-2.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 + i * 0.06, duration: 0.3 }}
                >
                  <span className="text-foreground/40 mt-1.5 flex-shrink-0">
                    <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor"><circle cx="3" cy="3" r="3" /></svg>
                  </span>
                  {feature}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Sizes */}
          <motion.div
            className="space-y-3 w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <h3 className="text-foreground/40 text-xs tracking-[0.2em] uppercase">Available Sizes</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(productData.sizes).map(([key, size]) => {
                const isRecommended = recommendedSize === key;
                return (
                  <div
                    key={key}
                    className={`rounded-xl p-3 text-left transition-all duration-300 ${
                      isRecommended
                        ? 'border border-white/20 bg-white/8'
                        : 'glass-card'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className={`text-xs tracking-wider uppercase ${isRecommended ? 'text-foreground/70' : 'text-foreground/50'}`}>
                        {key}
                      </p>
                      {isRecommended && (
                        <span className="text-[9px] tracking-wider uppercase text-foreground/60 bg-white/10 border border-white/15 rounded-full px-2.5 py-1 leading-none whitespace-nowrap">
                          Best fit
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${isRecommended ? 'text-foreground/80' : 'text-foreground/70'}`}>Lens: {size.lensWidth}</p>
                    <p className={`text-xs ${isRecommended ? 'text-foreground/60' : 'text-foreground/50'}`}>Bridge: {size.bridge}</p>
                    <p className={`text-xs ${isRecommended ? 'text-foreground/60' : 'text-foreground/50'}`}>Temple: {size.templeLength}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Care */}
          <motion.div
            className="space-y-3 w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
          >
            <h3 className="text-foreground/40 text-xs tracking-[0.2em] uppercase">Care</h3>
            <p className="text-foreground/50 text-sm leading-relaxed">{productData.careNote}</p>
          </motion.div>
        </div>
      </div>

      {/* Bottom action — floats over content */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-8 pt-12 safe-bottom bg-gradient-to-t from-[#0e0e10] via-[#0e0e10]/80 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <button
          onClick={handleClose}
          className="text-foreground/40 text-sm py-2 tracking-wide hover:text-foreground/60 transition-colors"
        >
          Back to viewer
        </button>
      </motion.div>
    </motion.div>
  );
}
