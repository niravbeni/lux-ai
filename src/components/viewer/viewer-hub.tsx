'use client';

import { Suspense, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { getProduct, getColourway } from '@/data/product-catalog';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import FrameModel from './frame-model';
import ChatDrawer from './chat-drawer';
import SuggestionPills from './suggestion-pills';
import VoiceInput from '@/components/voice/voice-input';
import OrbCanvas from '@/components/orb/orb-canvas';
import { speak, stopSpeaking } from '@/lib/tts';

function ModelFallback() {
  return null;
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
  const setActiveProductId = useAppStore((s) => s.setActiveProductId);
  const setRecommendedProductId = useAppStore((s) => s.setRecommendedProductId);
  const setStreamingText = useAppStore((s) => s.setStreamingText);

  const frameHistory = useAppStore((s) => s.frameHistory);
  const frameHistoryIndex = useAppStore((s) => s.frameHistoryIndex);
  const navigateCarousel = useAppStore((s) => s.navigateCarousel);
  const frameColourways = useAppStore((s) => s.frameColourways);
  const frameAiColourways = useAppStore((s) => s.frameAiColourways);
  const [slideDirection, setSlideDirection] = useState(0);
  const [hasEnteredConversation, setHasEnteredConversation] = useState(false);
  const canGoPrev = frameHistoryIndex > 0;
  const canGoNext = frameHistoryIndex < frameHistory.length - 1;
  const product = getProduct(activeProductId);

  useEffect(() => {
    if (isConversing && !hasEnteredConversation) {
      setHasEnteredConversation(true);
    }
  }, [isConversing, hasEnteredConversation]);

  useEffect(() => {
    const timeout = setTimeout(() => setSlideDirection(1), 400);
    return () => clearTimeout(timeout);
  }, [activeProductId]);

  // Chat history is preserved across sub-screen navigation (colour-mode, fit-mode, etc.)
  // It only resets when a new product session starts via the scanner.

  useEffect(() => {
    if (!assistantMessage) {
      const greeting = pickRandom(dialogueScripts.hub.greetings);
      setAssistantMessage(greeting);
      const store = useAppStore.getState();
      if (store.chatHistory.length === 0) {
        store.addChatMessage('assistant', greeting, {
          frameId: activeProductId,
          colourwayId: activeColourway,
        });
      }
      speak(greeting).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveColourway = useAppStore((s) => s.setActiveColourway);
  const setAiRecommendedColourway = useAppStore((s) => s.setAiRecommendedColourway);
  const colourResult = useAppStore((s) => s.colourResult);

  const handleExitConversation = useCallback(() => {
    stopSpeaking();
    setIsConversing(false);
    setStreamingText('');
    setRecommendedProductId(null);
    const aiCw = useAppStore.getState().aiRecommendedColourway;
    if (aiCw) setActiveColourway(aiCw);
  }, [setIsConversing, setStreamingText, setRecommendedProductId, setActiveColourway]);

  const handleViewRecommended = useCallback(() => {
    if (!recommendedProductId) return;
    const recProduct = getProduct(recommendedProductId);
    setSlideDirection(1);
    setActiveProductId(recommendedProductId);
    setRecommendedProductId(null);
    setIsConversing(false);
    setStreamingText('');
    const aiCw = useAppStore.getState().aiRecommendedColourway;
    const targetCw = aiCw && getColourway(aiCw) ? aiCw : recProduct.colourways[0]?.id ?? '';
    setActiveColourway(targetCw);
    const msg = `Here's the ${recProduct.name}. Take a look — ask me anything about it.`;
    setAssistantMessage(msg);
    speak(msg).catch(() => {});
  }, [recommendedProductId, setActiveProductId, setRecommendedProductId, setIsConversing, setStreamingText, setAssistantMessage, setActiveColourway]);

  const goToFrame = useCallback(
    (direction: 'prev' | 'next') => {
      const targetIndex = direction === 'prev' ? frameHistoryIndex - 1 : frameHistoryIndex + 1;
      if (targetIndex < 0 || targetIndex >= frameHistory.length) return;
      const targetId = frameHistory[targetIndex];
      const targetProduct = getProduct(targetId);
      setSlideDirection(direction === 'next' ? 1 : -1);
      navigateCarousel(direction);
      const savedCw = frameColourways[targetId];
      setActiveColourway(savedCw ?? targetProduct.colourways[0]?.id ?? '');
      setAiRecommendedColourway(null);
      setAssistantMessage(`Here's the ${targetProduct.name}.`);
    },
    [frameHistory, frameHistoryIndex, frameColourways, navigateCarousel, setActiveColourway, setAiRecommendedColourway, setAssistantMessage],
  );

  const SWIPE_THRESHOLD = 60;
  const handlePanEnd = useCallback(
    (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      if (isConversing) return;
      const { offset, velocity } = info;
      const isHorizontalSwipe = Math.abs(offset.x) > Math.abs(offset.y) * 1.5;
      if (!isHorizontalSwipe) return;
      if (offset.x < -SWIPE_THRESHOLD || (velocity.x < -300 && offset.x < -20)) {
        if (canGoNext) goToFrame('next');
      } else if (offset.x > SWIPE_THRESHOLD || (velocity.x > 300 && offset.x > 20)) {
        if (canGoPrev) goToFrame('prev');
      }
    },
    [isConversing, canGoNext, canGoPrev, goToFrame],
  );

  // Build colourway pills
  const activeColourwayData = product.colourways.find((c) => c.id === activeColourway);
  const colourwayName = activeColourwayData?.name ?? product.colourways[0]?.name ?? 'Default';
  const defaultCw = product.colourways[0];
  const availablePills = [defaultCw];
  const addedIds = new Set([defaultCw?.id]);

  if (colourResult) {
    if (!addedIds.has(colourResult.topMatch.id)) { availablePills.push(colourResult.topMatch); addedIds.add(colourResult.topMatch.id); }
    if (!addedIds.has(colourResult.alternative.id)) { availablePills.push(colourResult.alternative); addedIds.add(colourResult.alternative.id); }
  }

  const thisFrameAiCws = frameAiColourways[activeProductId] ?? [];
  for (const cwId of thisFrameAiCws) {
    if (!addedIds.has(cwId)) {
      const aiCw = product.colourways.find((c) => c.id === cwId) ?? getColourway(cwId);
      if (aiCw) { availablePills.push(aiCw); addedIds.add(aiCw.id); }
    }
  }

  const showColourPills = availablePills.length > 1;

  const handleColourwaySwitch = (cwId: string) => {
    setActiveColourway(cwId);
  };

  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* ─── PRODUCT MODE ─── */}
      {!isConversing && (
        <>
          {/* Top bar — title + X on same line */}
          <div
            className="absolute left-0 right-0 z-50 flex flex-col items-center"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)' }}
          >
            <div className="flex items-center w-full px-4">
              {/* Spacer to balance the X button on the right */}
              <div className="w-10" />

              {/* Product name — centered */}
              <div className="flex-1 flex justify-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={activeProductId}
                    className="text-base tracking-wide font-light text-foreground/60"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {product.name}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* X close button */}
              <button
                onClick={() => setScreen('scanner')}
                className="flex h-10 w-10 items-center justify-center text-foreground/50 hover:text-foreground/80 transition-colors active:scale-90"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            {frameHistory.length > 1 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {frameHistory.map((fId, i) => (
                  <button
                    key={fId}
                    onClick={() => {
                      if (i === frameHistoryIndex) return;
                      setSlideDirection(i > frameHistoryIndex ? 1 : -1);
                      const targetProduct = getProduct(frameHistory[i]);
                      useAppStore.getState().setFrameHistoryIndex(i);
                      const savedCw = frameColourways[fId];
                      setActiveColourway(savedCw ?? targetProduct.colourways[0]?.id ?? '');
                      setAiRecommendedColourway(null);
                      setAssistantMessage(`Here's the ${targetProduct.name}.`);
                    }}
                    className="relative p-1 transition-all"
                    title={getProduct(fId).name}
                  >
                    <motion.div
                      className="rounded-full"
                      animate={{
                        width: i === frameHistoryIndex ? 18 : 5,
                        height: 5,
                        backgroundColor:
                          i === frameHistoryIndex ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.2)',
                      }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3D Frame Canvas — fills the area above the bottom sections */}
          <div className="absolute inset-0" style={{ bottom: 275 }} onPointerUp={() => {}}>
            <motion.div className="absolute inset-0" onPanEnd={handlePanEnd}>
              <AnimatePresence mode="wait" custom={slideDirection}>
                <motion.div
                  key={activeProductId}
                  className="absolute inset-0"
                  custom={slideDirection}
                  variants={{
                    enter: (dir: number) => ({ x: dir > 0 ? '40%' : dir < 0 ? '-40%' : 0, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (dir: number) => ({ x: dir > 0 ? '-40%' : dir < 0 ? '40%' : 0, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                  <Canvas
                    camera={{ position: [0, 0.15, 3.8], fov: 30 }}
                    gl={{ alpha: true, antialias: true }}
                    dpr={[1, 2]}
                    className="!absolute inset-0"
                    style={{ background: 'transparent' }}
                    onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
                  >
                    <Suspense fallback={<ModelFallback />}>
                      <ambientLight intensity={1.0} />
                      <directionalLight position={[5, 8, 5]} intensity={1.8} color="#ffffff" />
                      <directionalLight position={[-4, 4, 3]} intensity={0.8} color="#e8ddd0" />
                      <directionalLight position={[0, -3, 5]} intensity={0.5} color="#d0dde8" />
                      <directionalLight position={[0, 5, -3]} intensity={0.4} color="#c9a96e" />
                      <Environment preset="studio" background={false} />
                      <FrameModel modelPath={product.modelPath} />
                      <ContactShadows position={[0, -1.2, 0]} opacity={0.15} scale={8} blur={3} far={4} color="#000000" />
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

              {/* Carousel arrows */}
              {frameHistory.length > 1 && (
                <>
                  <AnimatePresence>
                    {canGoPrev && (
                      <motion.button
                        key="arrow-prev"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.25 }}
                        onClick={() => goToFrame('prev')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex h-14 w-14 items-center justify-center transition-colors active:scale-90 text-foreground/35 hover:text-foreground/60"
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {canGoNext && (
                      <motion.button
                        key="arrow-next"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.25 }}
                        onClick={() => goToFrame('next')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex h-14 w-14 items-center justify-center transition-colors active:scale-90 text-foreground/35 hover:text-foreground/60"
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          </div>

          {/* Available colours + Suggestion pills — positioned above the drawer */}
          <div
            className="absolute left-0 right-0 z-30 flex justify-center px-4"
            style={{ bottom: 210 }}
          >
            <div className="flex flex-col items-start gap-3 w-full max-w-sm">
              {/* Available colours label + pills */}
              <div className="flex flex-col items-start gap-1.5">
                <p className="text-[9px] tracking-[0.9px] uppercase text-foreground/60">
                  Available colours
                </p>
                {showColourPills ? (
                  <div className="flex flex-wrap justify-start gap-1.5 max-w-full">
                    {availablePills.map((cw) => {
                      const isActive = cw.id === activeColourway;
                      return (
                        <button
                          key={cw.id}
                          onClick={() => handleColourwaySwitch(cw.id)}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs tracking-wide whitespace-nowrap backdrop-blur-md transition-all duration-300 ${
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
                    })}
                  </div>
                ) : (
                  <div className="rounded-full px-3.5 py-1.5 text-xs tracking-wide backdrop-blur-md bg-white/5 text-foreground/35 border border-white/5">
                    {colourwayName}
                  </div>
                )}
              </div>

              {/* Suggestion pills — between colourways and drawer */}
              <SuggestionPills />
            </div>
          </div>

          {/* Chat Drawer — bottom */}
          <ChatDrawer />
        </>
      )}

      {/* ─── CONVERSATION MODE (unchanged) ─── */}
      {isConversing && (
        <div className="relative flex-1 w-full min-h-0">
          <div className="absolute inset-0">
            {hasEnteredConversation && (
              <OrbCanvas scale={1} interactive={isConversing} offsetY={0.3} className="w-full h-full" />
            )}

            <button
              onClick={handleExitConversation}
              className="absolute right-4 z-30 flex h-12 w-12 items-center justify-center text-foreground/40 hover:text-foreground/70 transition-colors active:scale-90"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>

            <div
              className="absolute inset-x-0 z-20 flex flex-col items-center pointer-events-none"
              style={{ top: '15%', bottom: 'max(8.5rem, calc(env(safe-area-inset-bottom, 0px) + 8rem))' }}
            >
              <div className="flex-1" />
              <div className="px-8 pb-2 w-full max-w-sm space-y-3">
                <AnimatePresence>
                  {(transcript || isListening) && !streamingText && (
                    <motion.div
                      key="user-transcript"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.25 }}
                    >
                      {transcript ? (
                        <p className="text-foreground/70 text-sm leading-relaxed text-center italic">{transcript}</p>
                      ) : isListening ? (
                        <p className="text-foreground/30 text-xs text-center">Listening...</p>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {streamingText && (
                    <motion.div
                      key="streaming"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-foreground/80 text-sm leading-relaxed text-center">{streamingText}</p>
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
                      className="glass-card rounded-full px-5 py-2.5 text-foreground/70 text-xs tracking-wide border border-white/20 hover:border-white/35 transition-all active:scale-95"
                    >
                      View {getProduct(recommendedProductId).name}
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          <div
            className="absolute left-0 right-0 z-30 flex flex-col items-center"
            style={{ bottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}
          >
            <VoiceInput />
          </div>
        </div>
      )}
    </motion.div>
  );
}
