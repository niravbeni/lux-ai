'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { productData } from '@/data/product-data';
import { triggerHaptic } from '@/lib/haptics';

// Start preloading the GLB model while user is scanning
useGLTF.preload(productData.modelPath);

// ── Lightweight glasses-frame detector ────────────────────────────────
// Uses Sobel edge detection on the centre region of the camera feed.
// Glasses frames have strong, structured edges against a background.
// Returns a 0-1 confidence score.

function detectFrameConfidence(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): number {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) return 0;

  const size = 160;
  canvas.width = size;
  canvas.height = size;

  // Crop the centre square of the video into our small canvas
  const cropSize = Math.min(vw, vh);
  const sx = (vw - cropSize) / 2;
  const sy = (vh - cropSize) / 2;
  ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);

  // Convert to grayscale (0-1 range)
  const gray = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    gray[i] =
      (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }

  // Sobel edge detection — count pixels with significant gradient
  let strongEdges = 0;
  let horizontalEdges = 0;
  const total = (size - 2) * (size - 2);

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      // Horizontal gradient (Gx)
      const gx =
        -gray[idx - size - 1] +
        gray[idx - size + 1] -
        2 * gray[idx - 1] +
        2 * gray[idx + 1] -
        gray[idx + size - 1] +
        gray[idx + size + 1];
      // Vertical gradient (Gy)
      const gy =
        -gray[idx - size - 1] -
        2 * gray[idx - size] -
        gray[idx - size + 1] +
        gray[idx + size - 1] +
        2 * gray[idx + size] +
        gray[idx + size + 1];

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude > 0.18) {
        strongEdges++;
        // Horizontal edges dominate in glasses frames (top bar, temple arms)
        if (Math.abs(gx) < Math.abs(gy) * 0.8) horizontalEdges++;
      }
    }
  }

  const edgeDensity = strongEdges / total;
  const horizontalRatio = strongEdges > 0 ? horizontalEdges / strongEdges : 0;

  // Also check contrast — standard deviation of grayscale values
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
    sumSq += gray[i] * gray[i];
  }
  const mean = sum / gray.length;
  const variance = sumSq / gray.length - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));

  // Scoring:
  // - Edge density in the sweet spot (0.06-0.5): structured object present
  // - Horizontal edges > 25%: likely a glasses frame shape
  // - Good contrast (stdDev > 0.08): object stands out from background
  let confidence = 0;

  if (edgeDensity > 0.06 && edgeDensity < 0.5 && stdDev > 0.08) {
    // Base confidence from edge density (peaks around 0.15-0.25)
    const edgeScore = edgeDensity < 0.25
      ? edgeDensity / 0.25
      : 1 - (edgeDensity - 0.25) / 0.5;
    // Horizontal edge bonus
    const horizBonus = horizontalRatio > 0.25 ? 0.3 : 0;
    // Contrast bonus
    const contrastScore = Math.min(1, stdDev / 0.15);

    confidence = Math.min(1, edgeScore * 0.5 + horizBonus + contrastScore * 0.3);
  }

  return confidence;
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
  const hasScanned = useRef(false);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      if (hasScanned.current) return;
      hasScanned.current = true;

      triggerHaptic('success');
      setOrbState('recognition');
      setScannedProductId(decodedText || 'rayban-meta');

      // Transition after a brief recognition moment
      setTimeout(() => {
        setScreen('transition');
      }, 600);
    },
    [setOrbState, setScannedProductId, setScreen],
  );

  const handleSkipScan = () => {
    handleScanSuccess('rayban-meta');
  };

  // ── QR scanner + frame detection ──────────────────────────────────
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
          () => {
            // QR not found in this frame — silent
          },
        );

        if (mounted) setScanning(true);

        // ── Start glasses frame detection alongside QR scanning ──
        // Find the video element that html5-qrcode created
        const videoEl = document.querySelector(
          `#${scannerId} video`,
        ) as HTMLVideoElement | null;

        if (videoEl && mounted) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          let consecutiveHits = 0;

          detectionIntervalRef.current = setInterval(() => {
            if (hasScanned.current || !ctx || !mounted) return;

            const confidence = detectFrameConfidence(videoEl, canvas, ctx);

            if (confidence > 0.55) {
              consecutiveHits++;
              // Show visual feedback after 2 consecutive detections
              if (consecutiveHits >= 2) setFrameDetected(true);
              // Trigger after 4 consecutive confident detections (~2 seconds)
              if (consecutiveHits >= 4) {
                handleScanSuccess('rayban-meta');
              }
            } else {
              consecutiveHits = Math.max(0, consecutiveHits - 1);
              if (consecutiveHits < 2) setFrameDetected(false);
            }
          }, 500);
        }
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
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === 2 || state === 3) {
            scanner.stop().catch(() => {});
          }
        } catch {
          // Scanner not initialized or already stopped
        }
      }
    };
  }, [handleScanSuccess]);

  return (
    <motion.div
      className="relative h-full w-full overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Camera feed — fills the entire screen */}
      <div
        id="qr-scanner-region"
        className="absolute inset-0 w-full h-full qr-scanner-fullscreen"
      />

      {/* Scan frame overlay — centred on screen */}
      {scanning && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          style={{ paddingBottom: '20vh' }}
        >
          {/* Corner brackets — glow gold when a frame is detected */}
          <div className="relative w-[200px] h-[200px]">
            <svg
              className="absolute inset-0 w-full h-full transition-all duration-500"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: frameDetected ? 'drop-shadow(0 0 8px rgba(201,169,110,0.6))' : 'none',
              }}
            >
              <path
                d="M2 40 L2 2 L40 2"
                stroke={frameDetected ? '#C9A96E' : '#C9A96E'}
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
              <path
                d="M160 2 L198 2 L198 40"
                stroke={frameDetected ? '#C9A96E' : '#C9A96E'}
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
              <path
                d="M198 160 L198 198 L160 198"
                stroke={frameDetected ? '#C9A96E' : '#C9A96E'}
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
              <path
                d="M40 198 L2 198 L2 160"
                stroke={frameDetected ? '#C9A96E' : '#C9A96E'}
                strokeWidth={frameDetected ? 4 : 3}
                strokeLinecap="round"
              />
            </svg>

            {/* Scan line animation */}
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

            {/* Detection feedback — subtle pulse when frame spotted */}
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

      {/* Bottom UI — overlaid on camera, no gradient */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-5 px-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Instruction text */}
        <div className="text-center space-y-2">
          <p className="text-foreground/60 text-xs tracking-[0.2em] uppercase">
            Scan to discover
          </p>
          <p className="text-foreground/80 text-base leading-relaxed max-w-[280px]">
            Looking for a glasses frame or QR code
          </p>
        </div>

        {/* Skip CTA */}
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

        {/* Back link */}
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
