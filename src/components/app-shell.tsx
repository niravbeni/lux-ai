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
  const isConversing = useAppStore((s) => s.isConversing);
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

  // On the viewer-hub screen, both backgrounds stay mounted so we can
  // cross-fade between them without destroying/recreating the camera
  // stream.  The camera feed shows on the product view; the colour-morph
  // background fades in when the user enters conversation mode.
  const isViewerHub = screen === 'viewer-hub';
  const showCameraBg = isViewerHub;                       // always mounted on viewer-hub
  const cameraBgVisible = isViewerHub && !isConversing;   // faded in/out via opacity
  const showMorphBg =
    (isViewerHub && isConversing) ||
    screen === 'details-mode' ||
    screen === 'transition';
  const hasBg = showCameraBg || showMorphBg;

  return (
    <>
      {/* ── Blurred camera background (product page) ───────────────────
          Stays mounted for the entire viewer-hub lifetime so the camera
          stream is never destroyed.  The `visible` prop cross-fades it
          out when entering conversation mode.                           */}
      {showCameraBg && <CameraBackground visible={cameraBgVisible} />}

      {/* ── Colour-morphing background (conversation + other screens) ──*/}
      {isViewerHub ? (
        /* On viewer-hub: always mounted, opacity-driven cross-fade */
        <div
          className="fixed inset-0 colour-morph-bg"
          style={{
            zIndex: 0,
            pointerEvents: 'none',
            opacity: isConversing ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
            willChange: 'opacity',
          }}
        >
          <div className="colour-morph-blob-gold" />
        </div>
      ) : showMorphBg ? (
        /* On other screens: conditional mount (no camera to preserve) */
        <div
          className="fixed inset-0 colour-morph-bg"
          style={{ zIndex: 0, pointerEvents: 'none' }}
        >
          <div className="colour-morph-blob-gold" />
        </div>
      ) : null}

      {/* ── Content container ───────────────────────────────────────────
          fixed inset-0 = covers the full physical viewport so the app
          fills the entire browser window (including behind iOS bars).
          Individual screens use safe-area-inset-* to keep text/buttons
          visible and not clipped by the iOS system chrome.              */}
      <div
        className={`fixed inset-0 overflow-hidden ${hasBg ? '' : 'bg-background'}`}
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
