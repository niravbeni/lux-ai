'use client';

import { useRef, useEffect, useState } from 'react';

interface CameraFeedProps {
  facing?: 'user' | 'environment';
  onStream?: (stream: MediaStream) => void;
  onError?: (error: string) => void;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export default function CameraFeed({
  facing = 'user',
  onStream,
  onError,
  className = '',
  videoRef: externalVideoRef,
}: CameraFeedProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoElement = externalVideoRef || internalVideoRef;
  const [active, setActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Store callbacks in refs so they don't trigger useEffect re-runs
  const onStreamRef = useRef(onStream);
  const onErrorRef = useRef(onError);
  onStreamRef.current = onStream;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoElement.current) {
          videoElement.current.srcObject = stream;
          await videoElement.current.play().catch(() => {});
          if (!cancelled) {
            setActive(true);
            onStreamRef.current?.(stream);
          }
        }
      } catch {
        if (!cancelled) {
          onErrorRef.current?.('Camera access denied. Please allow camera access in your browser settings.');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facing, videoElement]);

  return (
    <video
      ref={videoElement}
      autoPlay
      playsInline
      muted
      className={`${className} ${active ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
      style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
    />
  );
}
