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

export default function ScannerScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const setScannedProductId = useAppStore((s) => s.setScannedProductId);
  const demoMode = useAppStore((s) => s.demoMode);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const hasScanned = useRef(false);

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

  // ── QR scanner ────────────────────────────────────────────────────
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

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Camera feed — starts invisible, fades in once the camera
           stream is running to avoid the initialization flash. */}
      <div
        id="qr-scanner-region"
        className="absolute inset-0 w-full h-full qr-scanner-fullscreen"
        style={{
          opacity: scanning ? 1 : 0,
          transition: 'opacity 0.4s ease-in',
        }}
      />

      {/* Scan frame overlay */}
      {scanning && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
          style={{ paddingBottom: '20vh' }}
        >
          <div className="relative w-[200px] h-[200px]">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2 40 L2 2 L40 2" stroke="#C9A96E" strokeWidth="3" strokeLinecap="round" />
              <path d="M160 2 L198 2 L198 40" stroke="#C9A96E" strokeWidth="3" strokeLinecap="round" />
              <path d="M198 160 L198 198 L160 198" stroke="#C9A96E" strokeWidth="3" strokeLinecap="round" />
              <path d="M40 198 L2 198 L2 160" stroke="#C9A96E" strokeWidth="3" strokeLinecap="round" />
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
          </div>
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
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-5 px-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="text-center space-y-2">
          <p className="text-foreground/60 text-xs tracking-[0.2em] uppercase">
            Scan to discover
          </p>
          <p className="text-foreground/80 text-base leading-relaxed max-w-[280px]">
            Point your camera at a QR code on the frame
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
      </div>
    </div>
  );
}
