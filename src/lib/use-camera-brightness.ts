'use client';

import { useEffect, useRef, useState } from 'react';

const SAMPLE_SIZE = 16;
const LIGHT_THRESHOLD = 130;

/**
 * Periodically samples a video element's brightness and returns whether
 * the scene is "light" (bright enough that white text becomes hard to read).
 *
 * @param getVideo - Getter that returns the video element to sample (or null).
 * @param enabled  - Only sample when true (e.g. when camera is active).
 * @param intervalMs - How often to sample (default 800ms).
 */
export function useCameraBrightness(
  getVideo: () => HTMLVideoElement | null,
  enabled: boolean = true,
  intervalMs: number = 800,
): boolean {
  const [isLight, setIsLight] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLight(false);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = SAMPLE_SIZE;
      canvasRef.current.height = SAMPLE_SIZE;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const sample = () => {
      const video = getVideo();
      if (!video || video.readyState < 2) return;

      ctx.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

      let total = 0;
      const count = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      }

      const avg = total / count;
      setIsLight(avg > LIGHT_THRESHOLD);
    };

    const id = setInterval(sample, intervalMs);
    sample();

    return () => clearInterval(id);
  }, [getVideo, enabled, intervalMs]);

  return isLight;
}
