'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import AiOrb from './ai-orb';

interface OrbCanvasProps {
  scale?: number;
  className?: string;
  interactive?: boolean;
  offsetY?: number;
}

export default function OrbCanvas({
  scale = 1,
  className = '',
  interactive = false,
  offsetY = 0,
}: OrbCanvasProps) {
  return (
    <div
      className={`${interactive ? '' : 'pointer-events-none'} ${className}`}
      style={{ touchAction: interactive ? 'none' : 'auto' }}
    >
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 1], near: 0.1, far: 10 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{
          touchAction: interactive ? 'none' : 'auto',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        <Suspense fallback={null}>
          <AiOrb scale={scale} interactive={interactive} offsetY={offsetY} />
        </Suspense>
      </Canvas>
    </div>
  );
}
