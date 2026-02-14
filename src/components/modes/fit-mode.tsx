'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { getProduct, type Product } from '@/data/product-catalog';
import { speak } from '@/lib/tts';
import { triggerHaptic } from '@/lib/haptics';
import CameraFeed from '@/components/camera/camera-feed';

type ScanPhase = 'waiting' | 'detected' | 'scanning' | 'result';

// ── Skin-pixel classifier (RGB heuristic) ──────────────────────────────────
function isSkinPixel(r: number, g: number, b: number): boolean {
  if (r < 40 || g < 20 || b < 10) return false;

  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const diff = maxC - minC;

  if (diff < 10) return false;
  if (r < g || r <= b) return false;
  if (r - b < 10) return false;

  const sat = diff / Math.max(maxC, 1);
  if (sat > 0.75) return false;

  return true;
}

// ── Face metrics via contour edge detection ─────────────────────────────────
// Scans horizontal rows at 5 heights (forehead, temple, cheekbone, jaw, chin)
// For each row, finds the leftmost and rightmost skin pixel to get actual face
// width in pixels at that height.  Also measures the vertical extent.

interface FaceMetrics {
  // Widths in pixels at each landmark
  foreheadWidth: number;   // ~20% from top of oval
  templeWidth: number;     // ~35% from top
  cheekboneWidth: number;  // ~48% from top (widest point)
  jawWidth: number;        // ~70% from top
  chinWidth: number;       // ~85% from top
  // Vertical extent
  faceHeight: number;      // top-most to bottom-most skin pixel
  // Overall skin ratio for face detection
  skinRatio: number;
}

function measureFace(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): FaceMetrics | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  canvas.width = vw;
  canvas.height = vh;
  ctx.drawImage(video, 0, 0);

  // Oval region (matches the SVG guide)
  const ocx = vw / 2;
  const ocy = vh * 0.42;
  const orx = vw * 0.22;
  const ory = vh * 0.28;

  const x0 = Math.max(0, Math.floor(ocx - orx));
  const x1 = Math.min(vw, Math.ceil(ocx + orx));
  const y0 = Math.max(0, Math.floor(ocy - ory));
  const y1 = Math.min(vh, Math.ceil(ocy + ory));

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  } catch {
    return null;
  }

  const data = imageData.data;
  const regionW = x1 - x0;
  const regionH = y1 - y0;

  // Helper: measure the face width (leftmost–rightmost skin pixel) for a
  // horizontal band centered at `bandY` (relative to oval top), ±bandH rows.
  function measureWidthAtBand(bandCenterFraction: number, bandH = 6): number {
    const bandY = Math.floor(regionH * bandCenterFraction);
    let leftMost = regionW;
    let rightMost = 0;
    let skinFound = false;

    for (let dy = -bandH; dy <= bandH; dy++) {
      const py = bandY + dy;
      if (py < 0 || py >= regionH) continue;

      // Check this row is inside the ellipse
      const absY = y0 + py;
      const eyDist = (absY - ocy) / ory;
      if (eyDist * eyDist > 1) continue;

      for (let px = 0; px < regionW; px++) {
        // Check inside ellipse
        const absX = x0 + px;
        const exDist = (absX - ocx) / orx;
        if (exDist * exDist + eyDist * eyDist > 1) continue;

        const idx = (py * regionW + px) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];

        if (isSkinPixel(r, g, b)) {
          skinFound = true;
          if (px < leftMost) leftMost = px;
          if (px > rightMost) rightMost = px;
        }
      }
    }

    return skinFound ? (rightMost - leftMost) : 0;
  }

  // Helper: find top-most and bottom-most rows with skin pixels
  function measureHeight(): number {
    let topSkin = regionH;
    let bottomSkin = 0;
    const step = 2;

    for (let py = 0; py < regionH; py += step) {
      const absY = y0 + py;
      const eyDist = (absY - ocy) / ory;
      if (eyDist * eyDist > 1) continue;

      for (let px = 0; px < regionW; px += step) {
        const absX = x0 + px;
        const exDist = (absX - ocx) / orx;
        if (exDist * exDist + eyDist * eyDist > 1) continue;

        const idx = (py * regionW + px) * 4;
        if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) {
          if (py < topSkin) topSkin = py;
          if (py > bottomSkin) bottomSkin = py;
          break; // found skin in this row, move to next
        }
      }
    }

    return bottomSkin > topSkin ? (bottomSkin - topSkin) : 0;
  }

  // Count total skin ratio (for face detection threshold)
  let skinCount = 0, totalSampled = 0;
  const step = 4;
  for (let py = 0; py < regionH; py += step) {
    const absY = y0 + py;
    const eyDist = (absY - ocy) / ory;
    if (eyDist * eyDist > 1) continue;
    for (let px = 0; px < regionW; px += step) {
      const absX = x0 + px;
      const exDist = (absX - ocx) / orx;
      if (exDist * exDist + eyDist * eyDist > 1) continue;
      totalSampled++;
      const idx = (py * regionW + px) * 4;
      if (isSkinPixel(data[idx], data[idx + 1], data[idx + 2])) skinCount++;
    }
  }

  const skinRatio = totalSampled > 0 ? skinCount / totalSampled : 0;

  // Measure widths at 5 key landmarks (fractions from oval top)
  const foreheadWidth = measureWidthAtBand(0.20);   // forehead
  const templeWidth = measureWidthAtBand(0.35);      // temples
  const cheekboneWidth = measureWidthAtBand(0.48);   // cheekbones (usually widest)
  const jawWidth = measureWidthAtBand(0.70);          // jaw
  const chinWidth = measureWidthAtBand(0.85);         // chin

  const faceHeight = measureHeight();

  return {
    foreheadWidth,
    templeWidth,
    cheekboneWidth,
    jawWidth,
    chinWidth,
    faceHeight,
    skinRatio,
  };
}

// ── Face shape classifier from actual width ratios ──────────────────────────
type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'oblong';

function classifyFaceShape(m: FaceMetrics): FaceShape {
  const widest = Math.max(m.foreheadWidth, m.cheekboneWidth, m.jawWidth, 1);
  const heightToWidth = m.faceHeight / Math.max(widest, 1);

  // Ratios relative to widest point
  const foreheadRatio = m.foreheadWidth / widest;
  const cheekRatio = m.cheekboneWidth / widest;
  const jawRatio = m.jawWidth / widest;
  const chinRatio = m.chinWidth / widest;

  // Jaw-to-cheek taper
  const jawTaper = cheekRatio - jawRatio;

  // ── Classification rules ──
  // Heart: wide forehead + cheekbones, narrow jaw/chin
  if (jawTaper > 0.20 && foreheadRatio > 0.80 && chinRatio < 0.50) return 'heart';

  // Square: forehead ≈ cheekbone ≈ jaw (all wide), face not too long
  if (jawTaper < 0.10 && foreheadRatio > 0.85 && jawRatio > 0.85 && heightToWidth < 1.45) return 'square';

  // Round: cheekbones widest, minimal taper, height ≈ width
  if (cheekRatio >= 0.95 && jawTaper < 0.15 && heightToWidth < 1.3) return 'round';

  // Oblong: face much taller than wide
  if (heightToWidth > 1.55) return 'oblong';

  // Oval: moderate taper, face taller than wide — the "default" balanced shape
  return 'oval';
}

// ── Size recommendation based on face width ─────────────────────────────────
// Maps detected cheekbone pixel width to a frame size from the product catalog.
// Wider face → larger size (if available).
function recommendSize(
  cheekboneWidthPx: number,
  ovalRadiusPx: number,
  product: Product,
): { sizeKey: string; size: { lensWidth: string; bridge: string; templeLength: string } } {
  const sizeKeys = Object.keys(product.sizes);
  if (sizeKeys.length <= 1) {
    const key = sizeKeys[0] ?? 'standard';
    return { sizeKey: key, size: product.sizes[key] };
  }

  // Face width as fraction of the oval guide
  const faceFillRatio = cheekboneWidthPx / (ovalRadiusPx * 2);

  // Pick size: <0.42 = smallest, 0.42-0.55 = middle, >0.55 = largest
  let idx: number;
  if (faceFillRatio < 0.42) idx = 0;
  else if (faceFillRatio > 0.55) idx = sizeKeys.length - 1;
  else idx = Math.min(1, sizeKeys.length - 1);

  const key = sizeKeys[idx];
  return { sizeKey: key, size: product.sizes[key] };
}

// ── Fit recommendation ──────────────────────────────────────────────────────
function getFitRecommendation(
  shape: FaceShape,
  m: FaceMetrics,
  product: Product,
) {
  // Use detected cheekbone width to pick the right frame size
  // ovalRadiusPx ≈ vw * 0.22 (but we don't have vw here). Since cheekboneWidth
  // is already in the oval-region coord space, and the oval region width is
  // ~2*orx ≈ 0.44*vw, we'll approximate the oval diameter in the region as
  // the regionW that was used.  A simpler proxy: use widest measurement.
  const ovalDiameterEstimate = Math.max(m.cheekboneWidth * 1.4, 100);
  const rec = recommendSize(m.cheekboneWidth, ovalDiameterEstimate / 2, product);

  // Build shape-specific commentary
  const shapeInfo: Record<FaceShape, {
    fitNote: string;
    verdict: 'great fit' | 'good fit' | 'consider alternatives';
    why: string;
  }> = {
    oval: {
      fitNote: 'Balanced proportions',
      verdict: 'great fit',
      why: `Your oval face has well-balanced proportions — slightly wider at the cheekbones and tapering gently to the chin. The ${product.name} (${rec.sizeKey}) with its ${rec.size.lensWidth} lens width sits naturally on your features without overpowering them. This is one of the most versatile face shapes for eyewear.`,
    },
    round: {
      fitNote: 'Adds angular definition',
      verdict: 'good fit',
      why: `Your face is approximately as wide as it is long, with soft contours at the cheekbones and jaw. The ${product.name} (${rec.sizeKey}) adds angular structure that complements your softer features. The ${rec.size.lensWidth} lens width provides good coverage without making your face appear wider.`,
    },
    square: {
      fitNote: 'Softens strong jaw',
      verdict: 'good fit',
      why: `You have a strong jaw line with your forehead, cheekbones, and jaw measuring similarly wide. The ${product.name} (${rec.sizeKey}) at ${rec.size.lensWidth} works well — its curves soften the angular definition of your face. The ${rec.size.bridge} bridge should sit comfortably given your proportions.`,
    },
    heart: {
      fitNote: 'Balances wider forehead',
      verdict: 'great fit',
      why: `Your face is widest at the forehead and cheekbones, tapering to a narrower jaw and chin. The ${product.name} (${rec.sizeKey}) at ${rec.size.lensWidth} lens width draws the eye to the centre of your face, balancing your proportions beautifully. A natural fit for your features.`,
    },
    oblong: {
      fitNote: 'Adds horizontal balance',
      verdict: 'good fit',
      why: `Your face is longer than it is wide, with a consistent width from forehead to jaw. The ${product.name} (${rec.sizeKey}) at ${rec.size.lensWidth} adds horizontal emphasis that visually shortens and balances your proportions. The ${rec.size.bridge} bridge width is a good match.`,
    },
  };

  const info = shapeInfo[shape];
  return {
    sizeKey: rec.sizeKey,
    lensWidth: rec.size.lensWidth,
    bridge: rec.size.bridge,
    templeLength: rec.size.templeLength,
    shape,
    ...info,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
export default function FitMode() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const setFitResult = useAppStore((s) => s.setFitResult);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const fitResult = useAppStore((s) => s.fitResult);
  const activeProductId = useAppStore((s) => s.activeProductId);

  const product = getProduct(activeProductId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<ScanPhase>('waiting');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Position your face in the oval');
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceShape, setFaceShape] = useState<string | null>(null);
  const [fitVerdict, setFitVerdict] = useState<string | null>(null);
  const [recSize, setRecSize] = useState<string | null>(null);

  // Saved metrics from detection phase
  const metricsRef = useRef<FaceMetrics | null>(null);

  // ── Phase 1: poll for face ─────────────────────────────────────────────
  useEffect(() => {
    if (!cameraReady || phase !== 'waiting') return;

    let intervalId: ReturnType<typeof setInterval>;
    let consecutiveHits = 0;
    const SKIN_THRESHOLD = 0.22;   // 22% of oval must be skin
    const MIN_CHEEK_PX = 25;       // cheekbone width must be reasonable
    const MIN_FACE_HEIGHT = 20;    // face must have vertical extent
    const REQUIRED_HITS = 6;       // ~900ms of stable detection
    const POLL_INTERVAL_MS = 150;

    const poll = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const m = measureFace(videoRef.current, canvasRef.current);

      // Validate: enough skin, face is wide enough, face has height,
      // and at least 2 of the 5 width bands detected something
      const widthsDetected = [m?.foreheadWidth, m?.templeWidth, m?.cheekboneWidth, m?.jawWidth, m?.chinWidth]
        .filter((w) => w && w > 8).length;

      if (
        m &&
        m.skinRatio >= SKIN_THRESHOLD &&
        m.cheekboneWidth >= MIN_CHEEK_PX &&
        m.faceHeight >= MIN_FACE_HEIGHT &&
        widthsDetected >= 2
      ) {
        consecutiveHits++;
        if (consecutiveHits >= REQUIRED_HITS) {
          clearInterval(intervalId);
          metricsRef.current = m;
          setFaceDetected(true);
          setPhase('detected');
        }
      } else {
        consecutiveHits = 0;
      }
    };

    // Give camera 1s to warm up
    const startTimer = setTimeout(() => {
      intervalId = setInterval(poll, POLL_INTERVAL_MS);
    }, 1000);

    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [cameraReady, phase]);

  // ── Phase 2: brief pause after detection ───────────────────────────────
  useEffect(() => {
    if (phase !== 'detected') return;
    setStatusText('Face detected — measuring...');
    triggerHaptic('light');
    const timer = setTimeout(() => { setPhase('scanning'); setOrbState('processing'); }, 800);
    return () => clearTimeout(timer);
  }, [phase, setOrbState]);

  // ── Phase 3: animated scan + final analysis ────────────────────────────
  useEffect(() => {
    if (phase !== 'scanning') return;

    const duration = 2800;
    const startTime = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);

      if (p < 0.25) setStatusText('Measuring face widths...');
      else if (p < 0.5) setStatusText('Mapping proportions...');
      else if (p < 0.75) setStatusText('Classifying face shape...');
      else if (p < 1) setStatusText('Matching frame size...');

      if (p < 1) { raf = requestAnimationFrame(tick); return; }

      // Take a final measurement for accuracy
      let metrics = metricsRef.current!;
      if (videoRef.current && canvasRef.current) {
        const fresh = measureFace(videoRef.current, canvasRef.current);
        if (fresh && fresh.skinRatio > 0.10 && fresh.cheekboneWidth > 20) {
          // Average both readings for stability
          metrics = {
            foreheadWidth: (metrics.foreheadWidth + fresh.foreheadWidth) / 2,
            templeWidth: (metrics.templeWidth + fresh.templeWidth) / 2,
            cheekboneWidth: (metrics.cheekboneWidth + fresh.cheekboneWidth) / 2,
            jawWidth: (metrics.jawWidth + fresh.jawWidth) / 2,
            chinWidth: (metrics.chinWidth + fresh.chinWidth) / 2,
            faceHeight: (metrics.faceHeight + fresh.faceHeight) / 2,
            skinRatio: (metrics.skinRatio + fresh.skinRatio) / 2,
          };
        }
      }

      const shape = classifyFaceShape(metrics);
      const rec = getFitRecommendation(shape, metrics, product);

      setFaceShape(shape);
      setFitVerdict(rec.verdict);
      setRecSize(rec.sizeKey);
      setFitResult({ lensWidth: rec.lensWidth, fitNote: rec.fitNote });
      setAssistantMessage(rec.why);
      setOrbState('idle');
      setPhase('result');
      triggerHaptic('success');
      speak(rec.why).catch(() => {});
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, product, setFitResult, setAssistantMessage, setOrbState]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera feed */}
      <div className="relative flex-1 w-full min-h-0">
        {!cameraError && (
          <CameraFeed
            facing="user"
            videoRef={videoRef}
            onStream={() => setCameraReady(true)}
            onError={(err) => setCameraError(err)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center px-8">
              <p className="text-foreground/50 text-sm mb-4">{cameraError}</p>
              <button onClick={() => setScreen('viewer-hub')} className="text-gold text-sm font-medium">
                Go back
              </button>
            </div>
          </div>
        )}

        {cameraReady && <div className="absolute inset-0 bg-black/20" />}

        {/* Face oval guide + progress */}
        {cameraReady && phase !== 'result' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="relative w-[220px] h-[300px]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Oval outline */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 300">
                <ellipse
                  cx="110" cy="150" rx="85" ry="120"
                  fill="none"
                  stroke={faceDetected ? '#C9A96E' : 'rgba(245, 240, 235, 0.3)'}
                  strokeWidth="1.5"
                  strokeDasharray={faceDetected ? 'none' : '8 4'}
                  className="transition-all duration-500"
                />
              </svg>

              {/* Progress ring */}
              {phase === 'scanning' && (
                <svg className="absolute -inset-4 w-[calc(100%+32px)] h-[calc(100%+32px)]" viewBox="0 0 252 332">
                  {/* Background track — portrait oval, no rotation */}
                  <ellipse
                    cx="126" cy="166" rx="100" ry="135"
                    fill="none" stroke="rgba(245, 240, 235, 0.08)" strokeWidth="2"
                  />
                  {/* Animated progress — rx/ry swapped so after -90° rotation
                      it renders as portrait with stroke starting at top */}
                  <ellipse
                    cx="126" cy="166" rx="135" ry="100"
                    fill="none" stroke="#C9A96E" strokeWidth="2.5" strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray="100"
                    strokeDashoffset={100 * (1 - progress)}
                    style={{ transition: 'stroke-dashoffset 80ms linear' }}
                    transform="rotate(-90 126 166)"
                  />
                </svg>
              )}

              {/* Measurement guides during scanning */}
              {phase === 'scanning' && progress > 0.2 && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  transition={{ duration: 0.5 }}
                >
                  {/* Forehead width */}
                  <div className="absolute top-[20%] left-[8%] right-[8%] flex items-center justify-between">
                    <div className="w-4 h-[1px] bg-gold/40" />
                    <div className="w-4 h-[1px] bg-gold/40" />
                  </div>
                  {/* Cheekbone width */}
                  <div className="absolute top-[42%] left-0 right-0 flex items-center justify-between px-1">
                    <div className="w-6 h-[1px] bg-gold/50" />
                    <p className="text-gold/40 text-[8px] tracking-wider">CHEEKBONE</p>
                    <div className="w-6 h-[1px] bg-gold/50" />
                  </div>
                  {/* Jaw width */}
                  <div className="absolute top-[65%] left-[12%] right-[12%] flex items-center justify-between">
                    <div className="w-5 h-[1px] bg-gold/35" />
                    <p className="text-gold/30 text-[8px] tracking-wider">JAW</p>
                    <div className="w-5 h-[1px] bg-gold/35" />
                  </div>
                  {/* Vertical height line */}
                  <div className="absolute top-[12%] bottom-[12%] left-1/2 w-[1px] bg-gradient-to-b from-transparent via-gold/25 to-transparent -translate-x-1/2" />
                </motion.div>
              )}

              {/* Scan line */}
              {phase === 'scanning' && (
                <motion.div
                  className="absolute left-[10%] right-[10%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-gold/60 to-transparent"
                  initial={{ top: '10%' }}
                  animate={{ top: '90%' }}
                  transition={{ duration: 2.8, ease: 'linear' }}
                />
              )}

              {/* Status text */}
              <div className="absolute -bottom-14 left-0 right-0 text-center">
                <p className={`text-xs tracking-wide ${faceDetected ? 'text-gold/70' : 'text-foreground/50'}`}>
                  {statusText}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20 pt-20 pb-6 safe-bottom bg-gradient-to-t from-black/70 via-black/40 via-30% to-transparent"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <AnimatePresence>
          {phase === 'result' && fitResult && (
            <motion.div
              className="px-6 space-y-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Verdict badge */}
              {fitVerdict && (
                <div className="flex justify-center">
                  <span className={`inline-block rounded-full px-4 py-1.5 text-xs font-medium tracking-wide ${
                    fitVerdict === 'great fit'
                      ? 'bg-gold/15 text-gold border border-gold/30'
                      : fitVerdict === 'good fit'
                      ? 'bg-white/10 text-foreground/70 border border-white/15'
                      : 'bg-white/5 text-foreground/50 border border-white/10'
                  }`}>
                    {fitVerdict === 'great fit' ? '✦ Great Fit' : fitVerdict === 'good fit' ? 'Good Fit' : 'Consider Alternatives'}
                  </span>
                </div>
              )}

              {/* Face shape + recommendation */}
              <div className="text-center space-y-2">
                {faceShape && (
                  <p className="text-foreground/40 text-[11px] tracking-wider uppercase">
                    Face shape: {faceShape}{recSize ? ` · Recommended size: ${recSize}` : ''}
                  </p>
                )}
                <p className="text-foreground/70 text-sm leading-relaxed text-center px-2">
                  {useAppStore.getState().assistantMessage}
                </p>
              </div>

              {/* Measurement cards */}
              <div className="flex items-center gap-3">
                <div className="glass-card rounded-xl px-4 py-3 flex-1 text-center">
                  <p className="text-foreground/40 text-[10px] tracking-wider uppercase mb-1">Lens Width</p>
                  <p className="text-gold text-lg font-light">{fitResult.lensWidth}</p>
                </div>
                <div className="glass-card rounded-xl px-4 py-3 flex-1 text-center">
                  <p className="text-foreground/40 text-[10px] tracking-wider uppercase mb-1">Fit</p>
                  <p className="text-foreground/70 text-sm font-light">{fitResult.fitNote}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center mt-4">
          <button
            onClick={() => setScreen('viewer-hub')}
            className="text-foreground/40 text-sm hover:text-foreground/60 transition-colors"
          >
            {phase === 'result' ? 'Back to viewer' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
