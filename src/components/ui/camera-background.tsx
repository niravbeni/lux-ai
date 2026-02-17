'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { useCameraBrightness } from '@/lib/use-camera-brightness';

/**
 * Full-screen blurred camera feed used as an ambient background.
 * On mobile (Android / iOS) uses the back camera so the background
 * reflects the scene in front of the user. On desktop falls back to
 * the front camera. Transparent fallback if camera access is denied.
 *
 * The component stays mounted for the entire viewer-hub lifetime so
 * the camera stream is never destroyed.
 *
 * Also samples brightness and stores `isCameraLight` in Zustand so
 * that overlaid text can switch to dark colours on bright scenes.
 */
export default function CameraBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const setIsCameraLight = useAppStore((s) => s.setIsCameraLight);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const facingMode = isMobile ? 'environment' : 'user';

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (!isMobile) setIsFrontCamera(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          if (!cancelled) setReady(true);
        }
      } catch {
        // Camera denied or unavailable — silently fall back
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const getVideo = useCallback(() => videoRef.current, []);
  const isLight = useCameraBrightness(getVideo, ready);

  useEffect(() => {
    setIsCameraLight(isLight);
  }, [isLight, setIsCameraLight]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="fixed inset-0 w-full h-full"
      style={{
        objectFit: 'cover',
        transform: `${isFrontCamera ? 'scaleX(-1) ' : ''}scale(1.15)`,
        filter: 'blur(40px) brightness(0.5) saturate(1.2)',
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.6s ease-in-out',
        willChange: 'opacity',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
