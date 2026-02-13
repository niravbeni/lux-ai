'use client';

import { Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { productData } from '@/data/product-data';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import SuggestionPills from './suggestion-pills';
import FrameModel from './frame-model';
import VoiceInput from '@/components/voice/voice-input';
import { speak } from '@/lib/tts';

function ModelFallback() {
  // Invisible fallback — model should already be cached from preload
  return null;
}

export default function ViewerHub() {
  const assistantMessage = useAppStore((s) => s.assistantMessage);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const setScreen = useAppStore((s) => s.setScreen);
  const activeColourway = useAppStore((s) => s.activeColourway);
  const isSpeaking = useAppStore((s) => s.isSpeaking);

  // Set initial greeting and speak it
  useEffect(() => {
    if (!assistantMessage) {
      const greeting = pickRandom(dialogueScripts.hub.greetings);
      setAssistantMessage(greeting);
      speak(greeting).catch(() => {});
    }
  }, [assistantMessage, setAssistantMessage]);

  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Single unified colour-morphing background */}
      <div className="!absolute inset-0 colour-morph-bg z-0">
        <div className="colour-morph-blob-gold" />
      </div>

      {/* 3D Viewer Area */}
      <div className="relative z-10 flex-1 w-full min-h-0">
        <Canvas
          camera={{ position: [0, 0.2, 4.5], fov: 30 }}
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          dpr={[1, 2]}
          className="!absolute inset-0"
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Suspense fallback={<ModelFallback />}>
            {/* Lighting — brighter to show dark frames against dark bg */}
            <ambientLight intensity={1.0} />
            <directionalLight position={[5, 8, 5]} intensity={1.8} color="#ffffff" />
            <directionalLight position={[-4, 4, 3]} intensity={0.8} color="#e8ddd0" />
            <directionalLight position={[0, -3, 5]} intensity={0.5} color="#d0dde8" />
            <directionalLight position={[0, 5, -3]} intensity={0.4} color="#c9a96e" />

            {/* Environment for realistic reflections (no background — keep transparent) */}
            <Environment preset="studio" background={false} />

            {/* Frame model */}
            <FrameModel modelPath={productData.modelPath} />

            {/* Subtle shadow beneath */}
            <ContactShadows
              position={[0, -1.2, 0]}
              opacity={0.15}
              scale={8}
              blur={3}
              far={4}
              color="#000000"
            />

            {/* Orbit controls */}
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.8}
              minAzimuthAngle={-Math.PI / 3}
              maxAzimuthAngle={Math.PI / 3}
              rotateSpeed={0.5}
              dampingFactor={0.08}
              enableDamping
            />
          </Suspense>
        </Canvas>

        {/* Colourway name badge */}
        <motion.div
          className="absolute top-6 left-0 right-0 flex justify-center safe-top z-20"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="rounded-full px-4 py-1.5 text-xs tracking-wide bg-white/5 backdrop-blur-md text-foreground/40 border border-white/5">
            {productData.name} — {
              (() => {
                const cw = [
                  { id: 'shiny-black', name: 'Shiny Black' },
                  { id: 'matte-black', name: 'Matte Black' },
                  { id: 'havana', name: 'Havana' },
                  { id: 'transparent-blue', name: 'Transparent Blue' },
                  { id: 'warm-gunmetal', name: 'Warm Gunmetal' },
                ].find(c => c.id === activeColourway);
                return cw?.name || 'Shiny Black';
              })()
            }
          </div>
        </motion.div>
      </div>

      {/* Bottom controls — no background, floats over unified bg */}
      <motion.div
        className="relative z-20 flex flex-col gap-4 pb-6 pt-3 safe-bottom"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Assistant message — centered */}
        {assistantMessage && (
          <motion.div
            className="px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <p className="text-foreground/70 text-sm leading-relaxed text-center">
              {assistantMessage}
            </p>
          </motion.div>
        )}

        {/* Voice input */}
        <VoiceInput />

        {/* Suggestion pills */}
        <SuggestionPills />

        {/* Bottom actions */}
        <div className="flex items-center justify-between px-8 pt-2">
          <button
            onClick={() => setScreen('scanner')}
            className="text-foreground/30 text-xs tracking-wide hover:text-foreground/50 transition-colors"
          >
            Scan another
          </button>

          <button
            onClick={() => setScreen('save-modal')}
            className="text-gold/70 text-xs tracking-wide hover:text-gold transition-colors"
          >
            Notify store assistant
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
