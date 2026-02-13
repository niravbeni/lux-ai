'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { dialogueScripts, pickRandom } from '@/data/dialogue-scripts';
import { speak } from '@/lib/tts';
import { triggerHaptic } from '@/lib/haptics';
import CameraFeed from '@/components/camera/camera-feed';
import FaceScanner from '@/components/camera/face-scanner';

type ScanPhase = 'camera' | 'scanning' | 'result';

function classifyWidth(brightness: number): 'narrow' | 'balanced' | 'wide' {
  // Using brightness as a proxy for face width estimation
  // In a real app this would use face landmarks
  if (brightness < 120) return 'narrow';
  if (brightness > 150) return 'wide';
  return 'balanced';
}

export default function FitMode() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const setFitResult = useAppStore((s) => s.setFitResult);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const demoMode = useAppStore((s) => s.demoMode);
  const fitResult = useAppStore((s) => s.fitResult);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<ScanPhase>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleStartScan = () => {
    triggerHaptic('light');
    setOrbState('processing');
    const scanMsg = pickRandom(dialogueScripts.fit.scanning);
    setAssistantMessage(scanMsg);
    setPhase('scanning');
  };

  const handleScanComplete = useCallback(
    (brightness: number) => {
      const width = classifyWidth(brightness);
      const scripts = dialogueScripts.fit.results[width];
      const script = pickRandom(scripts);

      const result = {
        lensWidth: script.lensWidth,
        fitNote: script.fitNote,
      };

      setFitResult(result);
      setAssistantMessage(script.text);
      setOrbState('idle');
      setPhase('result');

      triggerHaptic('success');
      speak(script.text).catch(() => {});
    },
    [setFitResult, setAssistantMessage, setOrbState]
  );

  const handleBackToViewer = () => {
    setScreen('viewer-hub');
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
                onClick={() => handleScanComplete(135)}
                className="text-gold text-sm font-medium"
              >
                Continue without camera
              </button>
            </div>
          </div>
        )}

        {/* Dark overlay */}
        {cameraReady && <div className="absolute inset-0 bg-black/20" />}

        {/* Face scanner with fit-specific overlays */}
        {phase === 'scanning' && (
          <>
            <FaceScanner
              videoRef={videoRef}
              onScanComplete={handleScanComplete}
              demoMode={demoMode}
              scanDuration={2500}
            />
            {/* Width measurement guides */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              {/* Horizontal width guides */}
              <div className="absolute top-[38%] left-[15%] right-[15%] flex items-center justify-between">
                <div className="w-8 h-[1px] bg-gold/50" />
                <p className="text-gold/40 text-[10px] tracking-wider">WIDTH</p>
                <div className="w-8 h-[1px] bg-gold/50" />
              </div>
              {/* Bridge guide */}
              <div className="absolute top-[42%] left-[42%] right-[42%] flex items-center justify-center">
                <div className="w-full h-[1px] bg-gold/30" />
              </div>
              <p className="absolute top-[45%] text-gold/30 text-[9px] tracking-wider">BRIDGE</p>
            </motion.div>
          </>
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
                Measure my fit
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
          {phase === 'result' && fitResult && (
            <motion.div
              className="px-6 space-y-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Recommendation text */}
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-gold flex-shrink-0" />
                <p className="text-foreground/70 text-sm leading-relaxed">
                  {useAppStore.getState().assistantMessage}
                </p>
              </div>

              {/* Measurement cards */}
              <div className="flex items-center gap-3">
                <div className="glass-card rounded-xl px-4 py-3 flex-1">
                  <p className="text-foreground/40 text-[10px] tracking-wider uppercase mb-1">Lens width</p>
                  <p className="text-gold text-lg font-light">{fitResult.lensWidth}</p>
                </div>
                <div className="glass-card rounded-xl px-4 py-3 flex-1">
                  <p className="text-foreground/40 text-[10px] tracking-wider uppercase mb-1">Fit</p>
                  <p className="text-foreground/70 text-sm font-light">{fitResult.fitNote}</p>
                </div>
              </div>

              {/* Follow-up suggestion */}
              <button
                onClick={() => {
                  const followUp = pickRandom(dialogueScripts.fit.followUps);
                  setAssistantMessage(followUp);
                  speak(followUp).catch(() => {});
                }}
                className="text-gold/60 text-xs hover:text-gold transition-colors"
              >
                What else should I know?
              </button>
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
