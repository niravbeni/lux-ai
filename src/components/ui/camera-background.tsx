'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Full-screen blurred front-camera feed used as an ambient background.
 * Falls back to transparent (parent bg shows through) if camera access
 * is unavailable or denied.
 */
export default function CameraBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

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

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="fixed inset-0 w-full h-full transition-opacity duration-1000"
      style={{
        objectFit: 'cover',
        transform: 'scaleX(-1) scale(1.15)',
        filter: 'blur(40px) brightness(0.5) saturate(1.2)',
        opacity: ready ? 1 : 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
