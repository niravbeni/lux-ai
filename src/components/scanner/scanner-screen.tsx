'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { productData } from '@/data/product-data';
import { triggerHaptic } from '@/lib/haptics';

// Preload the GLB model while user is scanning
useGLTF.preload(productData.modelPath);

// ImageNet class names that indicate eyewear
const GLASSES_KEYWORDS = [
  'sunglass',
  'sunglasses',
  'dark glasses',
  'shades',
  'spectacle',
  'glasses',
  'eyeglass',
  'lens',
  'loupe',
  'monocle',
  'binocular',
  'goggles',
];

function isGlassesClass(className: string): boolean {
  const lower = className.toLowerCase();
  return GLASSES_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function ScannerScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const setScannedProductId = useAppStore((s) => s.setScannedProductId);
  const demoMode = useAppStore((s) => s.demoMode);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [frameDetected, setFrameDetected] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const hasScanned = useRef(false);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef = useRef<any>(null);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (hasScanned.current) return;
      hasScanned.current = true;

      triggerHaptic('success');
      setOrbState('recognition');
      setScannedProductId(decodedText || 'rayban-meta');

      setTimeout(() => {
        setScreen('transition');
      }, 600);
    },
    [setOrbState, setScannedProductId, setScreen],
  );

  const handleSkipScan = () => {
    handleScanSuccess('rayban-meta');
  };

  // ── Load MobileNet model (dynamic import to keep bundle small) ────
  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        const mobilenet = await import('@tensorflow-models/mobilenet');
        await import('@tensorflow/tfjs');
        const model = await mobilenet.load({ version: 2, alpha: 0.5 });
        if (!cancelled) {
          modelRef.current = model;
          setModelLoading(false);
        }
      } catch (err) {
        console.warn('MobileNet failed to load — glasses detection unavailable', err);
        if (!cancelled) setModelLoading(false);
      }
    }

    loadModel();
    return () => { cancelled = true; };
  }, []);

  // ── QR scanner + glasses detection ────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const scannerId = 'qr-scanner-region';

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (mounted) handleScanSuccess(decodedText);
          },
          () => {},
        );

        if (mounted) setScanning(true);
      } catch (err) {
        if (mounted) {
          console.error('Scanner error:', err);
          setError(
            'Camera access is required to scan frames. Please allow camera access and try again.',
          );
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === 2 || state === 3) {
            scanner.stop().catch(() => {});
          }
        } catch {
          // already stopped
        }
      }
    };
  }, [handleScanSuccess]);

  // ── MobileNet classification loop (runs once model + video ready) ─
  useEffect(() => {
    if (modelLoading || !scanning) return;

    let mounted = true;
    let consecutiveHits = 0;

    const videoEl = document.querySelector(
      '#qr-scanner-region video',
    ) as HTMLVideoElement | null;

    if (!videoEl || !modelRef.current) return;

    // Classify a frame from the video every ~1.2s
    detectionIntervalRef.current = setInterval(async () => {
      if (hasScanned.current || !mounted || !modelRef.current) return;
      if (videoEl.readyState < 2) return; // not enough data yet

      try {
        const predictions = await modelRef.current.classify(videoEl, 5);

        const glassesMatch = predictions.find(
          (p: { className: string; probability: number }) =>
            isGlassesClass(p.className) && p.probability > 0.08,
        );

        if (glassesMatch) {
          consecutiveHits++;
          if (consecutiveHits >= 2 && mounted) setFrameDetected(true);
          if (consecutiveHits >= 3 && mounted) {
            handleScanSuccess('rayban-meta');
          }
        } else {
          consecutiveHits = Math.max(0, consecutiveHits - 1);
          if (consecutiveHits < 2 && mounted) setFrameDetected(false);
        }
      } catch {
        // classification error — skip this frame
      }
    }, 1200);

    return () => {
      mounted = false;
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [modelLoading, scanning, handleScanSuccess]);

  return (
    <motion.div
      className="relative h-full w-full overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Camera feed */}
      <div
        id="qr-scanner-region"
        className="absolute inset-0 w-full h-full qr-scanner-fullscreen"
      />

      {/* Scan frame overlay */}
      {scanning && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          style={{ paddingBottom: '20vh' }}
        >
          <div className="relative w-[200px] h-[200px]">
            <svg
              className="absolute inset-0 w-full h-full transition-all duration-500"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: frameDetected
                  ? 'drop-shadow(0 0 8px rgba(201,169,110,0.6))'
                  : 'none',
              }}
            >
              <path
                d="M2 40 L2 2 L40 2"
                stroke="#C9A96E"
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
              <path
                d="M160 2 L198 2 L198 40"
                stroke="#C9A96E"
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
              <path
                d="M198 160 L198 198 L160 198"
                stroke="#C9A96E"
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
              <path
                d="M40 198 L2 198 L2 160"
                stroke="#C9A96E"
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
            </svg>

            {/* Scan line */}
            <motion.div
              className="absolute left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent"
              initial={{ top: '10%' }}
              animate={{ top: '90%' }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            />

            {/* Detection pulse */}
            {frameDetected && (
              <motion.div
                className="absolute inset-0 rounded-lg border-2 border-gold/30"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.98, 1.02, 0.98] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>

          {/* Detection label */}
          {frameDetected && (
            <motion.p
              className="absolute text-gold/80 text-xs tracking-widest uppercase"
              style={{ bottom: 'calc(20vh + 220px)' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              Frame detected
            </motion.p>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-8">
          <div className="glass-card rounded-2xl p-6 text-center max-w-sm">
            <p className="text-foreground/70 text-sm mb-4">{error}</p>
            <button onClick={handleSkipScan} className="text-gold text-sm font-medium">
              Continue without scanning
            </button>
          </div>
        </div>
      )}

      {/* Bottom UI */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-5 px-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-center space-y-2">
          <p className="text-foreground/60 text-xs tracking-[0.2em] uppercase">
            Scan to discover
          </p>
          <p className="text-foreground/80 text-base leading-relaxed max-w-[280px]">
            Looking for a glasses frame or QR code
          </p>
        </div>

        <button
          onClick={handleSkipScan}
          className="group relative overflow-hidden rounded-full px-8 py-3.5 transition-all duration-300 active:scale-95"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 rounded-full border border-gold/40 group-hover:border-gold/60 transition-colors duration-300" />
          <span className="relative text-gold text-sm font-medium tracking-wide">
            {demoMode ? 'Skip scan' : "I can\u0027t scan"}
          </span>
        </button>

        <button
          onClick={() => setScreen('landing')}
          className="text-foreground/30 text-[10px] tracking-[0.15em] uppercase hover:text-foreground/50 transition-colors"
        >
          Go back
        </button>
      </motion.div>
    </motion.div>
  );
}
