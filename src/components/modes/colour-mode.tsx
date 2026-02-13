'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { colourways } from '@/data/product-data';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import { speak } from '@/lib/tts';
import { triggerHaptic } from '@/lib/haptics';
import CameraFeed from '@/components/camera/camera-feed';
import FaceScanner from '@/components/camera/face-scanner';

type ScanPhase = 'camera' | 'scanning' | 'result';

function classifyTone(brightness: number): 'warm' | 'cool' | 'neutral' {
  if (brightness < 110) return 'cool';
  if (brightness > 160) return 'warm';
  return 'neutral';
}

export default function ColourMode() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const setColourResult = useAppStore((s) => s.setColourResult);
  const setActiveColourway = useAppStore((s) => s.setActiveColourway);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const demoMode = useAppStore((s) => s.demoMode);
  const colourResult = useAppStore((s) => s.colourResult);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<ScanPhase>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleStartScan = () => {
    triggerHaptic('light');
    setOrbState('processing');
    const scanMsg = pickRandom(dialogueScripts.colour.scanning);
    setAssistantMessage(scanMsg);
    setPhase('scanning');
  };

  const handleScanComplete = useCallback(
    (brightness: number) => {
      const tone = classifyTone(brightness);
      const scripts = dialogueScripts.colour.recommendations[tone];
      const script = pickRandom(scripts);

      const topMatch = colourways.find((c) => c.id === script.topMatch)!;
      const alternative = colourways.find((c) => c.id === script.alternative)!;

      const result = {
        topMatch,
        alternative,
        reasoning: script.text,
      };

      setColourResult(result);
      setActiveColourway(topMatch.id);
      setAssistantMessage(script.text);
      setOrbState('idle');
      setPhase('result');

      triggerHaptic('success');
      speak(script.text).catch(() => {});
    },
    [setColourResult, setActiveColourway, setAssistantMessage, setOrbState]
  );

  const handleBackToViewer = () => {
    setScreen('viewer-hub');
  };

  const handleSwapColourway = (colourwayId: string) => {
    triggerHaptic('light');
    setActiveColourway(colourwayId);
    const followUp = pickRandom(dialogueScripts.colour.followUps);
    setAssistantMessage(followUp);
  };

  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Camera feed */}
      <div className="relative flex-1 w-full min-h-0">
        {!cameraError && (
          <CameraFeed
            facing="user"
            videoRef={videoRef}
            onStream={() => setCameraReady(true)}
            onError={(err) => setCameraError(err)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Camera error fallback */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]">
            <div className="text-center px-8">
              <p className="text-foreground/50 text-sm mb-4">{cameraError}</p>
              <button
                onClick={() => {
                  // Run scan with default brightness
                  handleScanComplete(140);
                }}
                className="text-gold text-sm font-medium"
              >
                Continue without camera
              </button>
            </div>
          </div>
        )}

        {/* Dark overlay on camera */}
        {cameraReady && <div className="absolute inset-0 bg-black/20" />}

        {/* Face scanner overlay */}
        {phase === 'scanning' && (
          <FaceScanner
            videoRef={videoRef}
            onScanComplete={handleScanComplete}
            demoMode={demoMode}
            scanDuration={2200}
          />
        )}

        {/* Start scan prompt */}
        <AnimatePresence>
          {phase === 'camera' && cameraReady && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.button
                onClick={handleStartScan}
                className="glass-card rounded-full px-8 py-3 text-gold text-sm font-medium tracking-wide border-gold/30 active:scale-95 transition-transform"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                Analyse my colouring
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom panel — floats over camera */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20 pt-20 pb-6 safe-bottom bg-gradient-to-t from-black/70 via-black/40 via-30% to-transparent"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {/* Result panel */}
        <AnimatePresence>
          {phase === 'result' && colourResult && (
            <motion.div
              className="px-6 space-y-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Recommendation text */}
              <p className="text-foreground/70 text-sm leading-relaxed text-center px-2">
                {colourResult.reasoning}
              </p>

              {/* Colourway swatches */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleSwapColourway(colourResult.topMatch.id)}
                  className="flex items-center gap-2 glass-card rounded-full px-4 py-2 border-gold/30"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: colourResult.topMatch.color }}
                  />
                  <span className="text-foreground/80 text-xs">{colourResult.topMatch.name}</span>
                  <span className="text-gold/60 text-[10px]">Top match</span>
                </button>

                <button
                  onClick={() => handleSwapColourway(colourResult.alternative.id)}
                  className="flex items-center gap-2 glass-card rounded-full px-4 py-2"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: colourResult.alternative.color }}
                  />
                  <span className="text-foreground/60 text-xs">{colourResult.alternative.name}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back button */}
        <div className="flex justify-center mt-4">
          <button
            onClick={handleBackToViewer}
            className="text-foreground/40 text-sm hover:text-foreground/60 transition-colors"
          >
            {phase === 'result' ? 'Back to viewer' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
