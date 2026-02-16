'use client';

import { motion } from 'framer-motion';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { getProduct, DEFAULT_PRODUCT_ID } from '@/data/product-catalog';
import OrbCanvas from '@/components/orb/orb-canvas';
import { triggerHaptic } from '@/lib/haptics';

// Start preloading the GLB model immediately when the app loads
useGLTF.preload(getProduct(DEFAULT_PRODUCT_ID).modelPath);

export default function LandingScreen() {
  const setScreen = useAppStore((s) => s.setScreen);

  const handleScan = () => {
    triggerHaptic('light');
    setScreen('scanner');
  };

  return (
    <motion.div
      className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Orb — covers entire screen so emanation bleeds behind text */}
      <div className="absolute inset-0 z-10">
        <OrbCanvas
          scale={1.2}
          interactive
          offsetY={0.5}
          className="w-full h-full"
        />
      </div>

      {/* Spacer to push bottom content down */}
      <div className="flex-1" />

      {/* Bottom content — above the orb layer */}
      <motion.div
        className="relative z-20 flex flex-col items-center gap-6 pb-12 px-6 safe-bottom"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Tagline */}
        <div className="text-center space-y-2">
          <p className="text-foreground/60 text-xs tracking-[0.2em] uppercase">
            Future Store
          </p>
          <p className="text-foreground/80 text-base leading-relaxed max-w-[260px]">
            I can help you find the right fit and finish. Scan a frame to begin.
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleScan}
          className="group relative overflow-hidden rounded-full px-8 py-3.5 transition-all duration-300 active:scale-95"
        >
          {/* Button glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Button border */}
          <div className="absolute inset-0 rounded-full border border-gold/40 group-hover:border-gold/60 transition-colors duration-300" />

          {/* Button content */}
          <span className="relative flex items-center gap-3 text-gold text-sm font-medium tracking-wide">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            Scan a frame
          </span>
        </button>

        {/* Subtle brand mark */}
        <p className="text-foreground/15 text-[10px] tracking-[0.15em]">
          FUTURE STORE EXPERIENCE
        </p>
      </motion.div>
    </motion.div>
  );
}
