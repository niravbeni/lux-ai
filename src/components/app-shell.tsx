'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { productData } from '@/data/product-data';
import LandingScreen from '@/components/landing/landing-screen';

// Preload 3D model the moment the app shell module loads
useGLTF.preload(productData.modelPath);

// Also prime the browser HTTP cache with a native fetch —
// this starts the download at the network level immediately
if (typeof window !== 'undefined') {
  fetch(productData.modelPath).catch(() => {});
}

// Dynamic imports for code-splitting heavy components
const ScannerScreen = dynamic(() => import('@/components/scanner/scanner-screen'), {
  ssr: false,
});
const TransitionScreen = dynamic(() => import('@/components/ui/transition'), {
  ssr: false,
});
const ViewerHub = dynamic(() => import('@/components/viewer/viewer-hub'), {
  ssr: false,
});
const ColourMode = dynamic(() => import('@/components/modes/colour-mode'), {
  ssr: false,
});
const FitMode = dynamic(() => import('@/components/modes/fit-mode'), {
  ssr: false,
});
const DetailsMode = dynamic(() => import('@/components/modes/details-mode'), {
  ssr: false,
});
const SaveModal = dynamic(() => import('@/components/ui/save-modal'), {
  ssr: false,
});

export default function AppShell() {
  const screen = useAppStore((s) => s.screen);
  const setDemoMode = useAppStore((s) => s.setDemoMode);
  const searchParams = useSearchParams();

  useEffect(() => {
    const demo = searchParams.get('demo');
    if (demo === 'true') {
      setDemoMode(true);
    }
  }, [searchParams, setDemoMode]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        {screen === 'landing' && <LandingScreen key="landing" />}
        {screen === 'scanner' && <ScannerScreen key="scanner" />}
        {screen === 'transition' && <TransitionScreen key="transition" />}
        {screen === 'viewer-hub' && <ViewerHub key="viewer-hub" />}
        {screen === 'colour-mode' && <ColourMode key="colour-mode" />}
        {screen === 'fit-mode' && <FitMode key="fit-mode" />}
        {screen === 'details-mode' && <DetailsMode key="details-mode" />}
        {screen === 'save-modal' && <SaveModal key="save-modal" />}
      </AnimatePresence>
    </div>
  );
}
