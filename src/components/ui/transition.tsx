'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { getProduct } from '@/data/product-catalog';

export default function TransitionScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const clearChatHistory = useAppStore((s) => s.clearChatHistory);
  const activeProductId = useAppStore((s) => s.activeProductId);

  useEffect(() => {
    setOrbState('idle');
    clearChatHistory();

    const product = getProduct(activeProductId);

    useGLTF.preload(product.modelPath);

    const minDelay = new Promise((r) => setTimeout(r, 1200));
    const modelReady = fetch(product.modelPath, { cache: 'force-cache' })
      .catch(() => {});

    Promise.all([minDelay, modelReady]).then(() => {
      setAssistantMessage('');
      setScreen('viewer-hub');
    });
  }, [setScreen, setOrbState, setAssistantMessage, clearChatHistory, activeProductId]);

  return (
    <motion.div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Recognition text */}
      <motion.div
        className="relative z-10 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <p className="text-gold text-sm tracking-[0.2em] uppercase mb-2">
          Recognised
        </p>
        <p className="text-foreground/70 text-lg font-light">
          Frame identified
        </p>
      </motion.div>

      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-radial-[circle_at_center] from-gold/8 via-transparent to-transparent" />
    </motion.div>
  );
}
