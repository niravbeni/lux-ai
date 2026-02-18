'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Full-screen blurred camera feed used as an ambient background.
 * On mobile (Android / iOS) uses the back camera so the background
 * reflects the scene in front of the user. On desktop falls back to
 * the front camera. Transparent fallback if camera access is denied.
 *
 * A dark overlay is placed on top so white text always remains legible.
 */
export default function CameraBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);

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

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="fixed inset-0 w-full h-full"
        style={{
          objectFit: 'cover',
          transform: `${isFrontCamera ? 'scaleX(-1) ' : ''}scale(1.15)`,
          filter: 'blur(40px) saturate(1.2)',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.6s ease-in-out',
          willChange: 'opacity',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Dark overlay so white text stays legible over any camera feed */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', zIndex: 0 }}
      />
    </>
  );
}
