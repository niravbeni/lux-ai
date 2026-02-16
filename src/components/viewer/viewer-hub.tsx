'use client';

import { Suspense, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { getProduct, getColourway } from '@/data/product-catalog';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import SuggestionPills from './suggestion-pills';
import FrameModel from './frame-model';
import VoiceInput from '@/components/voice/voice-input';
import OrbCanvas from '@/components/orb/orb-canvas';
import { speak, stopSpeaking } from '@/lib/tts';

function ModelFallback() {
  return null;
}

/** Truncate text to ~3 visible lines, always ending at a sentence boundary. */
function truncateAtSentence(text: string, maxLen = 150): string {
  if (!text || text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
  );
  if (lastEnd > maxLen * 0.35) return truncated.slice(0, lastEnd + 1).trim();
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim() + '…';
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
  const clearChatHistory = useAppStore((s) => s.clearChatHistory);
  const setStreamingText = useAppStore((s) => s.setStreamingText);

  // Carousel state
  const frameHistory = useAppStore((s) => s.frameHistory);
  const frameHistoryIndex = useAppStore((s) => s.frameHistoryIndex);
  const navigateCarousel = useAppStore((s) => s.navigateCarousel);
  const frameColourways = useAppStore((s) => s.frameColourways);
  const frameAiColourways = useAppStore((s) => s.frameAiColourways);
  const [slideDirection, setSlideDirection] = useState(0);
  const canGoPrev = frameHistoryIndex > 0;
  const canGoNext = frameHistoryIndex < frameHistory.length - 1;
  const product = getProduct(activeProductId);

  // After each product switch, reset slide direction to "forward" so that
  // the next AI-triggered change always slides in from the right.
  // Carousel swipe handlers set direction *before* the product changes,
  // so the initial animation frame uses the correct direction.
  useEffect(() => {
    const timeout = setTimeout(() => setSlideDirection(1), 400);
    return () => clearTimeout(timeout);
  }, [activeProductId]);

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
    const aiCw = useAppStore.getState().aiRecommendedColourway;
    if (aiCw) setActiveColourway(aiCw);
  }, [setIsConversing, setStreamingText, setRecommendedProductId, setActiveColourway]);

  const handleViewRecommended = useCallback(() => {
    if (!recommendedProductId) return;
    const recProduct = getProduct(recommendedProductId);
    setSlideDirection(1); // New frame always slides in from the right
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

  // ── Shared carousel navigation ───────────────────────────────────────
  // Restores per-frame colourway and clears cross-frame AI recommendation
  const goToFrame = useCallback(
    (direction: 'prev' | 'next') => {
      const targetIndex = direction === 'prev' ? frameHistoryIndex - 1 : frameHistoryIndex + 1;
      if (targetIndex < 0 || targetIndex >= frameHistory.length) return;

      const targetId = frameHistory[targetIndex];
      const targetProduct = getProduct(targetId);
      setSlideDirection(direction === 'next' ? 1 : -1);

      // Restore saved colourway for the target frame, or fall back to its default
      const savedCw = frameColourways[targetId];
      setActiveColourway(savedCw ?? targetProduct.colourways[0]?.id ?? '');

      // Restore AI recommendation scoped to the target frame (or clear it)
      const savedAiCw = frameAiColourways[targetId] ?? null;
      setAiRecommendedColourway(savedAiCw);

      navigateCarousel(direction);
      setAssistantMessage(`Here's the ${targetProduct.name}.`);
    },
    [frameHistory, frameHistoryIndex, frameColourways, frameAiColourways, navigateCarousel, setActiveColourway, setAiRecommendedColourway, setAssistantMessage],
  );

  // ── Carousel swipe handler ──────────────────────────────────────────
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

  const colourResult = useAppStore((s) => s.colourResult);
  const aiRecommendedColourway = useAppStore((s) => s.aiRecommendedColourway);

  const activeColourwayData = product.colourways.find((c) => c.id === activeColourway);
  const colourwayName = activeColourwayData?.name ?? product.colourways[0]?.name ?? 'Default';

  // Build the list of colourway pills to show in the header:
  // Always show the default (first) colourway, plus any recommended colourways from
  // colour match AND/OR AI assistant recommendations SCOPED TO THIS FRAME.
  const defaultCw = product.colourways[0];
  const availablePills = [defaultCw];
  const addedIds = new Set([defaultCw?.id]);

  // Add colour-match results
  if (colourResult) {
    if (!addedIds.has(colourResult.topMatch.id)) { availablePills.push(colourResult.topMatch); addedIds.add(colourResult.topMatch.id); }
    if (!addedIds.has(colourResult.alternative.id)) { availablePills.push(colourResult.alternative); addedIds.add(colourResult.alternative.id); }
  }

  // Add AI-recommended colourway — only if it was recommended for THIS frame
  const thisFrameAiCw = frameAiColourways[activeProductId] ?? null;
  if (thisFrameAiCw && !addedIds.has(thisFrameAiCw)) {
    const aiCw = product.colourways.find((c) => c.id === thisFrameAiCw) ?? getColourway(thisFrameAiCw);
    if (aiCw) { availablePills.push(aiCw); addedIds.add(aiCw.id); }
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
      {/* ─── VIEW AREA ─── */}
      <div className="relative z-10 flex-1 w-full min-h-0">

        {/* 3D Frame Canvas — swipeable carousel */}
        <motion.div
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{
            opacity: isConversing ? 0 : 1,
            pointerEvents: isConversing ? 'none' : 'auto',
          }}
          onPanEnd={handlePanEnd}
        >
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={activeProductId}
              className="absolute inset-0"
              custom={slideDirection}
              variants={{
                enter: (dir: number) => ({
                  x: dir > 0 ? '40%' : dir < 0 ? '-40%' : 0,
                  opacity: 0,
                }),
                center: { x: 0, opacity: 1 },
                exit: (dir: number) => ({
                  x: dir > 0 ? '-40%' : dir < 0 ? '40%' : 0,
                  opacity: 0,
                }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
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

          {/* Carousel arrows — left / right edges */}
          {frameHistory.length > 1 && (
            <>
              {/* Left arrow (previous frame) */}
              <AnimatePresence>
                {canGoPrev && (
                  <motion.button
                    key="arrow-prev"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.25 }}
                    onClick={() => goToFrame('prev')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all active:scale-90"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Right arrow (next frame) */}
              <AnimatePresence>
                {canGoNext && (
                  <motion.button
                    key="arrow-next"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.25 }}
                    onClick={() => goToFrame('next')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-foreground/40 hover:text-foreground/70 hover:bg-white/10 transition-all active:scale-90"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Product name + carousel dots + colourway pills */}
          <div
            className="absolute left-0 right-0 flex flex-col items-center gap-2 z-20"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
          >
            {/* Product name with animated transition */}
            <AnimatePresence mode="wait">
              <motion.p
                key={activeProductId}
                className="text-foreground/60 text-sm tracking-wide font-light"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.25 }}
              >
                {product.name}
              </motion.p>
            </AnimatePresence>

            {/* Carousel dots — shown when there are multiple frames */}
            {frameHistory.length > 1 && (
              <div className="flex items-center gap-1.5">
                {frameHistory.map((fId, i) => (
                  <button
                    key={fId}
                    onClick={() => {
                      if (i === frameHistoryIndex) return;
                      setSlideDirection(i > frameHistoryIndex ? 1 : -1);
                      const targetProduct = getProduct(frameHistory[i]);
                      // Restore saved colourway for target frame
                      const savedCw = frameColourways[fId];
                      setActiveColourway(savedCw ?? targetProduct.colourways[0]?.id ?? '');
                      setAiRecommendedColourway(frameAiColourways[fId] ?? null);
                      useAppStore.getState().setFrameHistoryIndex(i);
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
                          i === frameHistoryIndex
                            ? 'rgba(201, 169, 110, 0.8)'
                            : 'rgba(255, 255, 255, 0.2)',
                      }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* "View recommended" pill — shown during conversation when AI suggests a new frame */}
            {isConversing && recommendedProductId && recommendedProductId !== activeProductId && !frameHistory.includes(recommendedProductId) && (
              <motion.button
                onClick={handleViewRecommended}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] tracking-wide bg-gold/15 backdrop-blur-md text-gold/90 border border-gold/20 hover:border-gold/40 transition-all active:scale-95"
              >
                View {getProduct(recommendedProductId).name}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </motion.button>
            )}

            {/* Colourway pills — switchable if colour match has been done */}
            {showColourPills ? (
              <div className="flex items-center gap-2">
                {availablePills.map((cw) => {
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
                })}
              </div>
            ) : (
              <div className="rounded-full px-3.5 py-1 text-[11px] tracking-wide bg-white/5 backdrop-blur-md text-foreground/35 border border-white/5">
                {colourwayName}
              </div>
            )}
          </div>
        </motion.div>

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
              {truncateAtSentence(assistantMessage)}
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
