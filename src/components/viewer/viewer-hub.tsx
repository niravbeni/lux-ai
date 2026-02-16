'use client';

import { Suspense, useEffect, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { getProduct, getColourway, productCatalog } from '@/data/product-catalog';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import SuggestionPills from './suggestion-pills';
import FrameModel from './frame-model';
import VoiceInput from '@/components/voice/voice-input';
import OrbCanvas from '@/components/orb/orb-canvas';
import { speak, stopSpeaking } from '@/lib/tts';

function ModelFallback() {
  return null;
}

/** Truncate text at the last sentence boundary (. ! ?) within `maxLen` chars.
 *  If no sentence boundary is found, truncate at the last space and add "…". */
function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  // Find the last sentence-ending punctuation
  const lastSentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('.'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf('?'),
  );
  if (lastSentence > maxLen * 0.4) {
    return text.slice(0, lastSentence + 1).trim();
  }
  // No good sentence boundary — break at last space
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) return slice.slice(0, lastSpace).trim() + '…';
  return slice.trim() + '…';
}

export default function ViewerHub() {
  const assistantMessage = useAppStore((s) => s.assistantMessage);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const setScreen = useAppStore((s) => s.setScreen);
  const activeColourway = useAppStore((s) => s.activeColourway);
  const activeProductId = useAppStore((s) => s.activeProductId);
  const isConversing = useAppStore((s) => s.isConversing);
  const setIsConversing = useAppStore((s) => s.setIsConversing);
  const streamingText = useAppStore((s) => s.streamingText);
  const transcript = useAppStore((s) => s.transcript);
  const isListening = useAppStore((s) => s.isListening);
  const recommendedProductId = useAppStore((s) => s.recommendedProductId);
  const previousProductId = useAppStore((s) => s.previousProductId);
  const setActiveProductId = useAppStore((s) => s.setActiveProductId);
  const setRecommendedProductId = useAppStore((s) => s.setRecommendedProductId);
  const clearChatHistory = useAppStore((s) => s.clearChatHistory);
  const setStreamingText = useAppStore((s) => s.setStreamingText);

  const product = getProduct(activeProductId);

  useEffect(() => {
    clearChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!assistantMessage) {
      const greeting = pickRandom(dialogueScripts.hub.greetings);
      setAssistantMessage(greeting);
      speak(greeting).catch(() => {});
    }
  }, [assistantMessage, setAssistantMessage]);

  const setActiveColourway = useAppStore((s) => s.setActiveColourway);
  const setAiRecommendedColourway = useAppStore((s) => s.setAiRecommendedColourway);

  const handleExitConversation = useCallback(() => {
    stopSpeaking();
    setIsConversing(false);
    setStreamingText('');
    setRecommendedProductId(null);
    // If the AI recommended a colourway during conversation, auto-switch to it
    const aiCw = useAppStore.getState().aiRecommendedColourway;
    if (aiCw) setActiveColourway(aiCw);
  }, [setIsConversing, setStreamingText, setRecommendedProductId, setActiveColourway]);

  const handleGoBack = useCallback(() => {
    if (!previousProductId) return;
    const prevProduct = getProduct(previousProductId);
    setActiveProductId(previousProductId);
    setRecommendedProductId(null);
    setAiRecommendedColourway(null);
    setActiveColourway(prevProduct.colourways[0]?.id ?? '');
    const msg = `Welcome back to the ${prevProduct.name}.`;
    setAssistantMessage(msg);
    speak(msg).catch(() => {});
  }, [previousProductId, setActiveProductId, setRecommendedProductId, setAiRecommendedColourway, setActiveColourway, setAssistantMessage]);

  const handleViewRecommended = useCallback(() => {
    if (!recommendedProductId) return;
    const recProduct = getProduct(recommendedProductId);
    setActiveProductId(recommendedProductId);
    setRecommendedProductId(null);
    setIsConversing(false);
    setStreamingText('');
    // If AI also recommended a colourway, use it (universal pool — works on any frame)
    const aiCw = useAppStore.getState().aiRecommendedColourway;
    const targetCw = aiCw && getColourway(aiCw) ? aiCw : recProduct.colourways[0]?.id ?? '';
    setActiveColourway(targetCw);
    // Show a fresh greeting for the new frame
    const msg = `Here's the ${recProduct.name}. Take a look — ask me anything about it.`;
    setAssistantMessage(msg);
    speak(msg).catch(() => {});
  }, [recommendedProductId, setActiveProductId, setRecommendedProductId, setIsConversing, setStreamingText, setAssistantMessage, setActiveColourway]);
  const colourResult = useAppStore((s) => s.colourResult);
  const aiRecommendedColourway = useAppStore((s) => s.aiRecommendedColourway);

  const activeColourwayData = product.colourways.find((c) => c.id === activeColourway);
  const colourwayName = activeColourwayData?.name ?? product.colourways[0]?.name ?? 'Default';

  // Build the list of colourway pills to show in the header:
  // Always show the default (first) colourway, plus any recommended colourways from
  // colour match AND/OR AI assistant recommendations.
  const defaultCw = product.colourways[0];
  const availablePills = [defaultCw];
  const addedIds = new Set([defaultCw?.id]);

  // Add colour-match results
  if (colourResult) {
    if (!addedIds.has(colourResult.topMatch.id)) { availablePills.push(colourResult.topMatch); addedIds.add(colourResult.topMatch.id); }
    if (!addedIds.has(colourResult.alternative.id)) { availablePills.push(colourResult.alternative); addedIds.add(colourResult.alternative.id); }
  }

  // Add AI-recommended colourway — look up from universal pool (works across frames)
  if (aiRecommendedColourway && !addedIds.has(aiRecommendedColourway)) {
    const aiCw = product.colourways.find((c) => c.id === aiRecommendedColourway) ?? getColourway(aiRecommendedColourway);
    if (aiCw) { availablePills.push(aiCw); addedIds.add(aiCw.id); }
  }

  const showColourPills = availablePills.length > 1;

  const handleColourwaySwitch = (cwId: string) => {
    setActiveColourway(cwId);
  };

  // ── Carousel swipe handling ───────────────────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const SWIPE_THRESHOLD = 50;

  const currentIndex = productCatalog.findIndex((p) => p.id === activeProductId);

  const navigateToProduct = useCallback(
    (index: number) => {
      const target = productCatalog[index];
      if (!target || target.id === activeProductId) return;
      setActiveProductId(target.id);
      setActiveColourway(target.colourways[0]?.id ?? '');
      setRecommendedProductId(null);
      setAiRecommendedColourway(null);
      const msg = `Here's the ${target.name}. Swipe to browse more, or ask me anything.`;
      setAssistantMessage(msg);
      speak(msg).catch(() => {});
    },
    [activeProductId, setActiveProductId, setActiveColourway, setRecommendedProductId, setAiRecommendedColourway, setAssistantMessage],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStart.current.y;
      touchStart.current = null;

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaY) > Math.abs(deltaX)) return;

      if (deltaX < 0 && currentIndex < productCatalog.length - 1) {
        setSwipeDir('left');
        navigateToProduct(currentIndex + 1);
      } else if (deltaX > 0 && currentIndex > 0) {
        setSwipeDir('right');
        navigateToProduct(currentIndex - 1);
      }
    },
    [currentIndex, navigateToProduct],
  );

  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* ─── VIEW AREA ─── */}
      <div className="relative z-10 flex-1 w-full min-h-0">

        {/* 3D Frame Canvas — swipeable carousel */}
        <div
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{
            opacity: isConversing ? 0 : 1,
            pointerEvents: isConversing ? 'none' : 'auto',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeProductId}
              className="absolute inset-0"
              initial={{ opacity: 0, x: swipeDir === 'left' ? 60 : swipeDir === 'right' ? -60 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: swipeDir === 'left' ? -60 : swipeDir === 'right' ? 60 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Canvas
                camera={{ position: [0, 0.15, 4.5], fov: 30 }}
                gl={{ alpha: true, antialias: true }}
                dpr={[1, 2]}
                className="!absolute inset-0"
                style={{ background: 'transparent' }}
                onCreated={({ gl }) => {
                  gl.setClearColor(0x000000, 0);
                }}
              >
                <Suspense fallback={<ModelFallback />}>
                  <ambientLight intensity={1.0} />
                  <directionalLight position={[5, 8, 5]} intensity={1.8} color="#ffffff" />
                  <directionalLight position={[-4, 4, 3]} intensity={0.8} color="#e8ddd0" />
                  <directionalLight position={[0, -3, 5]} intensity={0.5} color="#d0dde8" />
                  <directionalLight position={[0, 5, -3]} intensity={0.4} color="#c9a96e" />
                  <Environment preset="studio" background={false} />
                  <FrameModel modelPath={product.modelPath} />
                  <ContactShadows
                    position={[0, -1.2, 0]}
                    opacity={0.15}
                    scale={8}
                    blur={3}
                    far={4}
                    color="#000000"
                  />
                  <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    target={[0, 0.15, 0]}
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
            </motion.div>
          </AnimatePresence>

          {/* ─── Carousel header: name + dots + colourway pills ─── */}
          <div
            className="absolute left-0 right-0 flex flex-col items-center gap-2 z-20 pointer-events-none"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={product.name}
                className="text-foreground/60 text-sm tracking-wide font-light"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                {product.name}
              </motion.p>
            </AnimatePresence>

            {/* Dot indicators */}
            <div className="flex items-center gap-2">
              {productCatalog.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { setSwipeDir(i > currentIndex ? 'left' : 'right'); navigateToProduct(i); }}
                  className="pointer-events-auto p-1"
                >
                  <div
                    className={`rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? 'w-5 h-1.5 bg-gold/70'
                        : 'w-1.5 h-1.5 bg-foreground/20'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Colourway pills */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {showColourPills ? (
                availablePills.map((cw) => {
                  const isActive = cw.id === activeColourway;
                  return (
                    <button
                      key={cw.id}
                      onClick={() => handleColourwaySwitch(cw.id)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] tracking-wide backdrop-blur-md transition-all duration-300 ${
                        isActive
                          ? 'bg-white/10 text-foreground/60 border border-white/15'
                          : 'bg-white/5 text-foreground/30 border border-white/5 hover:bg-white/8 hover:text-foreground/40'
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full border flex-shrink-0"
                        style={{
                          backgroundColor: cw.color,
                          borderColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                        }}
                      />
                      {cw.name}
                    </button>
                  );
                })
              ) : (
                <div className="rounded-full px-3.5 py-1 text-[11px] tracking-wide bg-white/5 backdrop-blur-md text-foreground/35 border border-white/5">
                  {colourwayName}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Orb overlay — separate Canvas, CSS layered on top */}
        <div
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{
            opacity: isConversing ? 1 : 0,
            pointerEvents: isConversing ? 'auto' : 'none',
          }}
        >
          <OrbCanvas
            scale={1}
            interactive={isConversing}
            offsetY={0.3}
            className="w-full h-full"
          />

          {/* Close button */}
          <button
            onClick={handleExitConversation}
            className="absolute right-6 z-30 h-8 w-8 rounded-full bg-white/5 backdrop-blur-md border border-white/5 text-foreground/40 hover:text-foreground/70 transition-colors"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
          >
            <svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              width="10"
              height="10"
              viewBox="0 0 12 12"
              overflow="visible"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            >
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>

          {/* User transcript + AI streaming text */}
          <div
            className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center pointer-events-none"
            style={{ top: '15%' }}
          >
            <div className="flex-1" />
            <div className="px-8 pb-4 w-full max-w-sm space-y-3">
              {/* User's spoken words — shown while listening or just after */}
              <AnimatePresence>
                {isConversing && (transcript || isListening) && !streamingText && (
                  <motion.div
                    key="user-transcript"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                  >
                    {transcript ? (
                      <p className="text-foreground/70 text-sm leading-relaxed text-center italic">
                        {transcript}
                      </p>
                    ) : isListening ? (
                      <p className="text-foreground/30 text-xs text-center">Listening...</p>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI response */}
              <AnimatePresence mode="wait">
                {streamingText && (
                  <motion.div
                    key="streaming"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-foreground/80 text-sm leading-relaxed text-center">
                      {streamingText}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {recommendedProductId && recommendedProductId !== activeProductId && (
                <motion.div
                  className="flex justify-center mt-4 pointer-events-auto"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <button
                    onClick={handleViewRecommended}
                    className="glass-card rounded-full px-5 py-2.5 text-gold/90 text-xs tracking-wide border border-gold/20 hover:border-gold/40 transition-all active:scale-95"
                  >
                    View {getProduct(recommendedProductId).name}
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM CONTROLS ─── */}
      <motion.div
        className="relative z-20 flex flex-col gap-6 pb-8 pt-6 px-6 safe-bottom"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {!isConversing && assistantMessage && (
          <motion.div
            className="px-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <p className="text-foreground/70 text-sm leading-relaxed text-center">
              {truncateAtSentence(assistantMessage, 160)}
            </p>
          </motion.div>
        )}

        <VoiceInput />

        {!isConversing && <SuggestionPills />}

        {!isConversing && (
          <div className="flex items-center justify-between pt-1">
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
        )}
      </motion.div>
    </motion.div>
  );
}
