'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useGLTF } from '@react-three/drei';
import { useAppStore } from '@/store/app-store';
import { getProduct, DEFAULT_PRODUCT_ID } from '@/data/product-catalog';
import LandingScreen from '@/components/landing/landing-screen';
import CameraBackground from '@/components/ui/camera-background';

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

  // Show the blurred camera feed on the product page, colour-morphing
  // background on other immersive screens.
  const showCameraBg = screen === 'viewer-hub';
  const showMorphBg =
    !showCameraBg && (screen === 'details-mode' || screen === 'transition');

  return (
    <>
      {/* ── Blurred camera background (product page) ───────────────────
          Full-screen front-camera feed with heavy blur so the 3D frames
          appear to float in the user's actual space.  Falls back to the
          dark app background if camera access is unavailable.           */}
      {showCameraBg && <CameraBackground />}

      {/* ── Colour-morphing background (other screens) ─────────────────*/}
      {showMorphBg && (
        <div
          className="fixed inset-0 colour-morph-bg"
          style={{ zIndex: 0, pointerEvents: 'none' }}
        >
          <div className="colour-morph-blob-gold" />
        </div>
      )}

      {/* ── Content container ───────────────────────────────────────────
          fixed inset-0 = covers the full physical viewport so the app
          fills the entire browser window (including behind iOS bars).
          Individual screens use safe-area-inset-* to keep text/buttons
          visible and not clipped by the iOS system chrome.              */}
      <div
        className={`fixed inset-0 overflow-hidden ${showMorphBg || showCameraBg ? '' : 'bg-background'}`}
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
