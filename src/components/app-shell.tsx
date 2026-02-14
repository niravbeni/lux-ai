'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { getProduct, DEFAULT_PRODUCT_ID } from '@/data/product-catalog';
import LandingScreen from '@/components/landing/landing-screen';

// Preload the default 3D model the moment the app shell module loads
const defaultProduct = getProduct(DEFAULT_PRODUCT_ID);
useGLTF.preload(defaultProduct.modelPath);

// Also prime the browser HTTP cache with a native fetch
if (typeof window !== 'undefined') {
  fetch(defaultProduct.modelPath).catch(() => {});
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
  const activeProductId = useAppStore((s) => s.activeProductId);
  const searchParams = useSearchParams();

  useEffect(() => {
    const demo = searchParams.get('demo');
    if (demo === 'true') {
      setDemoMode(true);
    }
  }, [searchParams, setDemoMode]);

  // Preload the active product model whenever it changes
  useEffect(() => {
    const product = getProduct(activeProductId);
    useGLTF.preload(product.modelPath);
    if (typeof window !== 'undefined') {
      fetch(product.modelPath).catch(() => {});
    }
  }, [activeProductId]);

  // Show the colour-morphing background on screens that need it.
  // Placed here (outside AnimatePresence / motion.div) so `position: fixed`
  // works relative to the viewport — framer-motion's will-change:transform
  // on animated children would otherwise create a containing block that
  // clips the background to 100svh (doesn't extend behind iOS bars).
  const showMorphBg =
    screen === 'viewer-hub' || screen === 'details-mode' || screen === 'transition';

  return (
    <>
      {/* ── Colour-morphing background ──────────────────────────────────
          Rendered OUTSIDE the overflow-hidden content container so it is
          a direct child of <body>. position:fixed + inset:0 now extends
          to the full physical viewport on iOS (behind status bar and
          Safari toolbar) without being clipped by overflow:hidden.       */}
      {showMorphBg && (
        <div
          className="fixed inset-0 colour-morph-bg"
          style={{ zIndex: 0, pointerEvents: 'none' }}
        >
          <div className="colour-morph-blob-gold" />
          {/* Edge fades — blend animated blobs into the flat background
              colour so iOS bars transition seamlessly. */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{ zIndex: 2, height: '15%', background: 'linear-gradient(to bottom, var(--background) 30%, transparent 100%)' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{ zIndex: 2, height: '15%', background: 'linear-gradient(to top, var(--background) 30%, transparent 100%)' }}
          />
        </div>
      )}

      {/* ── Content container ───────────────────────────────────────────
          When the colour-morph bg is active the container is transparent
          so the morph shows through. Otherwise it uses bg-background.   */}
      <div
        className={`relative w-full h-full overflow-hidden ${showMorphBg ? '' : 'bg-background'}`}
        style={{ zIndex: 1 }}
      >
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
    </>
  );
}
