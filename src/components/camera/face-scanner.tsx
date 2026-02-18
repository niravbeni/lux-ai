'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface FaceScannerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onScanComplete: (brightness: number) => void;
  demoMode?: boolean;
  scanDuration?: number;
}

export default function FaceScanner({
  videoRef,
  onScanComplete,
  demoMode = false,
  scanDuration = 2000,
}: FaceScannerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  const analyzeFaceBrightness = useCallback((): number => {
    if (!videoRef.current || !canvasRef.current) return 128;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 128;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);

    // Sample the center region (face area)
    const centerX = canvas.width * 0.3;
    const centerY = canvas.height * 0.2;
    const sampleW = canvas.width * 0.4;
    const sampleH = canvas.height * 0.5;

    try {
      const imageData = ctx.getImageData(centerX, centerY, sampleW, sampleH);
      const data = imageData.data;

      let totalBrightness = 0;
      const pixelCount = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        // Perceived brightness formula
        totalBrightness += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }

      return totalBrightness / pixelCount;
    } catch {
      return 128;
    }
  }, [videoRef]);

  // Run the scan animation
  useEffect(() => {
    const startTime = Date.now();
    setScanning(true);

    // In demo mode or real mode, run a timed scan
    const runScan = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / scanDuration, 1);
      setProgress(p);

      // "Detect" face at 30% progress
      if (p > 0.3 && !faceDetected) {
        setFaceDetected(true);
      }

      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(runScan);
      } else {
        // Scan complete
        setScanning(false);
        const brightness = demoMode ? 140 : analyzeFaceBrightness();
        onScanComplete(brightness);
      }
    };

    animFrameRef.current = requestAnimationFrame(runScan);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress ring: rx=90, ry=121.5 (90*1.35), center at (126,166), starts at top (126, 44.5)

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <canvas ref={canvasRef} className="hidden" />

      {/* Face oval guide */}
      <motion.div
        className="relative w-[220px] h-[300px]"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Oval outline */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 300">
          <ellipse
            cx="110"
            cy="150"
            rx="85"
            ry="120"
            fill="none"
            stroke={faceDetected ? 'rgba(255, 255, 255, 0.35)' : 'rgba(245, 240, 235, 0.3)'}
            strokeWidth="1.5"
            strokeDasharray={faceDetected ? 'none' : '8 4'}
            className="transition-all duration-500"
          />
        </svg>

        {/* Progress ring */}
        <svg
          className="absolute -inset-4 w-[calc(100%+32px)] h-[calc(100%+32px)]"
          viewBox="0 0 252 332"
        >
          {/* Background track */}
          <path
            d="M 126 44.5 A 90 121.5 0 1 1 125.999 44.5"
            fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="2"
          />
          {/* Animated progress — starts at top, closes clockwise */}
          {progress > 0 && (
            <path
              d="M 126 44.5 A 90 121.5 0 1 1 125.999 44.5"
              fill="none" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="2" strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 * (1 - progress)}
              className="transition-all duration-100"
            />
          )}
        </svg>

        {/* Status text */}
        <motion.div
          className="absolute -bottom-12 left-0 right-0 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {scanning ? (
            <p className="text-foreground/50 text-xs tracking-wide">
              {faceDetected ? 'Analysing...' : 'Position your face in the oval'}
            </p>
          ) : (
            <p className="text-gold text-xs tracking-wide">Complete</p>
          )}
        </motion.div>

        {/* Subtle measurement lines (not clinical) */}
        {faceDetected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {/* Horizontal width line */}
            <div className="absolute top-[40%] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            {/* Vertical center line */}
            <div className="absolute top-[20%] bottom-[20%] left-1/2 w-[1px] bg-gradient-to-b from-transparent via-gold/30 to-transparent -translate-x-1/2" />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
