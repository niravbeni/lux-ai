'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/app-store';
import { getProduct } from '@/data/product-catalog';
import { speak } from '@/lib/tts';
import { triggerHaptic } from '@/lib/haptics';
import CameraFeed from '@/components/camera/camera-feed';

type ScanPhase = 'waiting' | 'detected' | 'scanning' | 'result';

// ── Skin-pixel classifier (RGB heuristic) ──────────────────────────────────
// Balanced: strict enough to reject grey walls / warm wood, loose enough to
// work across fair-to-deep skin tones under typical webcam lighting.
function isSkinPixel(r: number, g: number, b: number): boolean {
  // Basic gate — even very deep skin has R > 40
  if (r < 40 || g < 20 || b < 10) return false;

  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const diff = maxC - minC;

  // Needs some colour (rejects pure grey / white)
  if (diff < 10) return false;

  // Red must be >= green and > blue (allows R≈G which happens in fair skin)
  if (r < g || r <= b) return false;

  // R-B spread — skin always has more red than blue
  if (r - b < 10) return false;

  // Reject overly saturated pixels (neon colours, bright clothing)
  const sat = diff / Math.max(maxC, 1);
  if (sat > 0.75) return false;

  return true;
}

// Sample the oval region for skin pixels; returns avg R, G, B, skin ratio,
// and a "face-like" flag that checks the skin is concentrated in the centre
// (not just scattered warm pixels from a background).
function sampleOvalSkin(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  canvas.width = vw;
  canvas.height = vh;
  ctx.drawImage(video, 0, 0);

  // Oval center + radii in pixel coords (matching the SVG guide proportions)
  const ocx = vw / 2;
  const ocy = vh * 0.42;
  const orx = vw * 0.22;
  const ory = vh * 0.28;

  const step = 4;
  const x0 = Math.max(0, Math.floor(ocx - orx));
  const x1 = Math.min(vw, Math.ceil(ocx + orx));
  const y0 = Math.max(0, Math.floor(ocy - ory));
  const y1 = Math.min(vh, Math.ceil(ocy + ory));

  let skinR = 0, skinG = 0, skinB = 0, skinCount = 0, totalSampled = 0;

  // Track skin in the inner 50% of the oval (centre zone) vs outer ring
  // A real face fills the centre; scattered noise doesn't.
  let centreZoneSkin = 0, centreZoneTotal = 0;

  try {
    const imageData = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const data = imageData.data;
    const regionW = x1 - x0;

    for (let py = y0; py < y1; py += step) {
      for (let px = x0; px < x1; px += step) {
        const dx = (px - ocx) / orx;
        const dy = (py - ocy) / ory;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 1) continue;

        totalSampled++;
        const localX = px - x0;
        const localY = py - y0;
        const idx = (localY * regionW + localX) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const isCentre = dist2 < 0.36; // inner ~60% radius
        if (isCentre) centreZoneTotal++;

        if (isSkinPixel(r, g, b)) {
          skinR += r;
          skinG += g;
          skinB += b;
          skinCount++;
          if (isCentre) centreZoneSkin++;
        }
      }
    }
  } catch {
    return null;
  }

  if (totalSampled === 0) return null;

  const ratio = skinCount / totalSampled;
  const centreRatio = centreZoneTotal > 0 ? centreZoneSkin / centreZoneTotal : 0;
  // "faceLike" = skin is concentrated in the centre of the oval (>30% of centre is skin)
  const faceLike = centreRatio > 0.30;

  if (skinCount === 0) return { avgR: 0, avgG: 0, avgB: 0, ratio, faceLike };

  return {
    avgR: skinR / skinCount,
    avgG: skinG / skinCount,
    avgB: skinB / skinCount,
    ratio,
    faceLike,
  };
}

// ── Skin analysis: depth + undertone ────────────────────────────────────────

type SkinDepth = 'fair' | 'light' | 'medium' | 'tan' | 'deep';
type Undertone = 'warm' | 'cool' | 'neutral';

function classifySkin(r: number, g: number, b: number): { depth: SkinDepth; undertone: Undertone } {
  // Perceived brightness (BT.601)
  const luma = r * 0.299 + g * 0.587 + b * 0.114;

  // Depth from brightness
  let depth: SkinDepth;
  if (luma > 185) depth = 'fair';
  else if (luma > 155) depth = 'light';
  else if (luma > 125) depth = 'medium';
  else if (luma > 95) depth = 'tan';
  else depth = 'deep';

  // Undertone from colour ratios
  // Warm skin has more red/yellow (high R, moderate G, low B)
  // Cool skin has more pink/blue (R & B closer together)
  const warmthIndex = (r - b) / (r + b + 1);     // 0–1, higher = warmer
  const yellowIndex = (g - b) / (g + b + 1);      // green-blue gap, higher = golden

  let undertone: Undertone;
  if (warmthIndex > 0.15 && yellowIndex > 0.08) undertone = 'warm';
  else if (warmthIndex < 0.08) undertone = 'cool';
  else undertone = 'neutral';

  return { depth, undertone };
}

// ── Convert hex "#RRGGBB" → { r, g, b } ────────────────────────────────────
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ── Score a frame colourway against detected skin ───────────────────────────
// Higher score = better match.  Uses:
//  • Contrast — frames should have enough contrast against skin (not wash out)
//  • Harmony  — warm skin + warm frame OR cool skin + cool frame = harmonious
//  • Complement — warm skin + cool frame = bold complement (lower weight)
function scoreColourway(
  cw: { color: string },
  skinR: number, skinG: number, skinB: number,
  skinDepth: SkinDepth, skinUndertone: Undertone,
): number {
  const f = hexToRgb(cw.color);

  // ── Contrast score (0–1): how different the frame is from the skin ──
  const dR = (skinR - f.r) / 255;
  const dG = (skinG - f.g) / 255;
  const dB = (skinB - f.b) / 255;
  const contrast = Math.sqrt(dR * dR + dG * dG + dB * dB) / 1.73; // normalise to 0–1
  // Sweet spot: moderate contrast (0.25–0.65) avoids both washing out and clashing
  const contrastScore = contrast < 0.15 ? 0.2 : contrast > 0.8 ? 0.5 : 1 - Math.abs(contrast - 0.45) * 1.5;

  // ── Frame warmth ──
  const fWarmth = (f.r - f.b) / (f.r + f.b + 1);
  const frameIsWarm = fWarmth > 0.12;
  const frameIsCool = fWarmth < 0.05;

  // ── Harmony score ──
  let harmonyScore = 0.5; // neutral default
  if (skinUndertone === 'warm' && frameIsWarm) harmonyScore = 1.0;     // warm + warm = harmonious
  if (skinUndertone === 'cool' && frameIsCool) harmonyScore = 1.0;     // cool + cool = harmonious
  if (skinUndertone === 'warm' && frameIsCool) harmonyScore = 0.7;     // warm + cool = bold complement
  if (skinUndertone === 'cool' && frameIsWarm) harmonyScore = 0.65;    // cool + warm = complement (slightly less natural)
  if (skinUndertone === 'neutral') harmonyScore = 0.85;                // neutral suits most frames

  // ── Depth bonus — dark frames on fair skin pop; light frames on deep skin pop ──
  const frameLuma = f.r * 0.299 + f.g * 0.587 + f.b * 0.114;
  let depthBonus = 0;
  if ((skinDepth === 'fair' || skinDepth === 'light') && frameLuma < 80) depthBonus = 0.15;
  if ((skinDepth === 'deep' || skinDepth === 'tan') && frameLuma > 140) depthBonus = 0.15;
  // Metallic / gold frames on deep skin = stunning
  if (skinDepth === 'deep' && frameIsWarm && frameLuma > 100) depthBonus = 0.2;

  return contrastScore * 0.4 + harmonyScore * 0.45 + depthBonus + 0.15;
}

// ── Build recommendation from scored colourways ─────────────────────────────
function getColourRecommendation(
  skinR: number, skinG: number, skinB: number,
  colourways: { id: string; name: string; color: string }[],
) {
  const { depth, undertone } = classifySkin(skinR, skinG, skinB);

  // Score every available colourway
  const scored = colourways
    .map((cw) => ({ cw, score: scoreColourway(cw, skinR, skinG, skinB, depth, undertone) }))
    .sort((a, b) => b.score - a.score);

  const topMatch = scored[0].cw;
  const alternative = scored.length > 1 ? scored[1].cw : scored[0].cw;

  // ── Build context-aware explanation ──
  const depthLabel: Record<SkinDepth, string> = {
    fair: 'fair complexion',
    light: 'light skin tone',
    medium: 'medium skin tone',
    tan: 'warm tan complexion',
    deep: 'rich deep complexion',
  };
  const undertoneLabel = undertone === 'warm' ? 'warm undertone' : undertone === 'cool' ? 'cool undertone' : 'neutral undertone';

  // Why the top pick works
  const topF = hexToRgb(topMatch.color);
  const topWarm = (topF.r - topF.b) / (topF.r + topF.b + 1) > 0.12;
  const harmonyReason = undertone === 'warm' && topWarm
    ? 'creates a harmonious, cohesive warmth'
    : undertone === 'cool' && !topWarm
    ? 'echoes your cooler tones for a refined, pulled-together look'
    : undertone === 'warm' && !topWarm
    ? 'provides a striking complementary contrast against your warmer tones'
    : undertone === 'cool' && topWarm
    ? 'adds a warm complementary lift that brightens your complexion'
    : 'works well with your balanced neutral colouring';

  const text = `Based on your ${depthLabel[depth]} with a ${undertoneLabel}, I'd recommend the ${topMatch.name} — it ${harmonyReason}. The ${alternative.name} is a strong alternative. Head back to see how each looks on the frame.`;

  return { topMatch, alternative, text, depth, undertone };
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ColourMode() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAssistantMessage = useAppStore((s) => s.setAssistantMessage);
  const setColourResult = useAppStore((s) => s.setColourResult);
  const setActiveColourway = useAppStore((s) => s.setActiveColourway);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const colourResult = useAppStore((s) => s.colourResult);
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
  const [skinHex, setSkinHex] = useState<string | null>(null);
  const [skinLabel, setSkinLabel] = useState<string | null>(null);

  // Skin sample saved when face first detected — used for final result
  const skinSampleRef = useRef<{ avgR: number; avgG: number; avgB: number } | null>(null);

  // ── Phase 1: continuously poll camera for a face (skin pixels in oval) ──
  useEffect(() => {
    if (!cameraReady || phase !== 'waiting') return;

    let intervalId: ReturnType<typeof setInterval>;
    let consecutiveHits = 0;
    const SKIN_THRESHOLD = 0.25;   // 25% of oval pixels must be skin
    const REQUIRED_HITS = 6;       // consecutive checks (~900ms at ~150ms)
    const POLL_INTERVAL_MS = 150;  // poll at ~7fps for stable readings

    const poll = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const sample = sampleOvalSkin(videoRef.current, canvasRef.current);

      if (sample && sample.ratio >= SKIN_THRESHOLD && sample.faceLike) {
        consecutiveHits++;
        if (consecutiveHits >= REQUIRED_HITS) {
          clearInterval(intervalId);
          skinSampleRef.current = { avgR: sample.avgR, avgG: sample.avgG, avgB: sample.avgB };
          setFaceDetected(true);
          setPhase('detected');
        }
      } else {
        consecutiveHits = 0;
      }
    };

    // Give camera 1s to warm up before polling
    const startTimer = setTimeout(() => {
      intervalId = setInterval(poll, POLL_INTERVAL_MS);
    }, 1000);

    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [cameraReady, phase]);

  // ── Phase 2: face detected → brief pause then start scan ───────────────
  useEffect(() => {
    if (phase !== 'detected') return;

    setStatusText('Face detected — analysing...');
    triggerHaptic('light');

    const timer = setTimeout(() => {
      setPhase('scanning');
      setOrbState('processing');
    }, 800);

    return () => clearTimeout(timer);
  }, [phase, setOrbState]);

  // ── Phase 3: animated scan bar + final analysis ────────────────────────
  useEffect(() => {
    if (phase !== 'scanning') return;

    const duration = 2500;
    const startTime = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);

      if (p < 0.35) setStatusText('Reading skin tone...');
      else if (p < 0.7) setStatusText('Estimating undertone...');
      else if (p < 1) setStatusText('Matching colourways...');

      if (p < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      // ── Final sample (take another reading for accuracy) ──
      let avgR = skinSampleRef.current?.avgR ?? 160;
      let avgG = skinSampleRef.current?.avgG ?? 130;
      let avgB = skinSampleRef.current?.avgB ?? 110;

      if (videoRef.current && canvasRef.current) {
        const fresh = sampleOvalSkin(videoRef.current, canvasRef.current);
        if (fresh && fresh.ratio > 0.10) {
          // average the earlier and later samples
          avgR = (avgR + fresh.avgR) / 2;
          avgG = (avgG + fresh.avgG) / 2;
          avgB = (avgB + fresh.avgB) / 2;
        }
      }

      const rec = getColourRecommendation(avgR, avgG, avgB, product.colourways);

      // Save detected skin colour as hex + label for the UI
      const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
      setSkinHex(`#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`);
      const depthNames: Record<string, string> = { fair: 'Fair', light: 'Light', medium: 'Medium', tan: 'Tan', deep: 'Deep' };
      const undertoneNames: Record<string, string> = { warm: 'Warm', cool: 'Cool', neutral: 'Neutral' };
      setSkinLabel(`${depthNames[rec.depth]} · ${undertoneNames[rec.undertone]}`);

      setColourResult({
        topMatch: product.colourways.find((c) => c.id === rec.topMatch.id) ?? product.colourways[0],
        alternative: product.colourways.find((c) => c.id === rec.alternative.id) ?? product.colourways[1] ?? product.colourways[0],
        reasoning: rec.text,
      });
      setActiveColourway(rec.topMatch.id);
      setAssistantMessage(rec.text);
      setOrbState('idle');
      setPhase('result');
      triggerHaptic('success');
      speak(rec.text).catch(() => {});
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, product, setColourResult, setActiveColourway, setAssistantMessage, setOrbState]);

  const handleSwapColourway = (colourwayId: string) => {
    triggerHaptic('light');
    setActiveColourway(colourwayId);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="relative flex h-full w-full flex-col overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Hidden canvas for pixel analysis */}
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

        {/* Face oval guide + progress ring */}
        {cameraReady && phase !== 'result' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="relative w-[220px] h-[300px]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Inner oval outline */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 300">
                <ellipse
                  cx="110" cy="150" rx="85" ry="120"
                  fill="none"
                  stroke={faceDetected ? 'var(--lux-blue)' : 'rgba(245, 240, 235, 0.3)'}
                  strokeWidth="1.5"
                  strokeDasharray={faceDetected ? 'none' : '8 4'}
                  className="transition-all duration-500"
                />
              </svg>

              {/* Progress ring (only during scanning phase) */}
              {phase === 'scanning' && (
                <svg
                  className="absolute -inset-4 w-[calc(100%+32px)] h-[calc(100%+32px)]"
                  viewBox="0 0 252 332"
                >
                  {/* Background track */}
                  <path
                    d="M 126 31 A 100 135 0 1 1 125.999 31"
                    fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="2"
                  />
                  {/* Animated progress — starts at top, closes clockwise */}
                  <path
                    d="M 126 31 A 100 135 0 1 1 125.999 31"
                    fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="100"
                    strokeDashoffset={100 - (progress * 100)}
                  />
                </svg>
              )}

              {/* Scan line sweeps down the oval */}
              {phase === 'scanning' && (
                <motion.div
                  className="absolute left-[10%] right-[10%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-lux-blue/60 to-transparent"
                  initial={{ top: '15%' }}
                  animate={{ top: '85%' }}
                  transition={{ duration: 2.5, ease: 'linear' }}
                />
              )}

              {/* Status text */}
              <div className="absolute -bottom-14 left-0 right-0 text-center">
                <p className={`text-sm tracking-wide ${faceDetected ? 'text-gold/70' : 'text-foreground/50'}`}>
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
          {phase === 'result' && colourResult && (
            <motion.div
              className="px-6 space-y-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Detected skin tone badge */}
              {skinHex && skinLabel && (
                <div className="flex items-center justify-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: skinHex }}
                  />
                  <span className="text-foreground/40 text-xs tracking-wider uppercase">
                    {skinLabel}
                  </span>
                </div>
              )}

              <p className="text-foreground/70 text-sm leading-relaxed text-center px-2">
                {colourResult.reasoning}
              </p>

              {/* Colourway swatches */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleSwapColourway(colourResult.topMatch.id)}
                  className="flex items-center gap-2 glass-card rounded-full px-4 py-2 border-gold/30"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: colourResult.topMatch.color }}
                  />
                  <span className="text-foreground/80 text-xs">{colourResult.topMatch.name}</span>
                  <span className="text-gold/60 text-xs">Top match</span>
                </button>

                <button
                  onClick={() => handleSwapColourway(colourResult.alternative.id)}
                  className="flex items-center gap-2 glass-card rounded-full px-4 py-2"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: colourResult.alternative.color }}
                  />
                  <span className="text-foreground/60 text-xs">{colourResult.alternative.name}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center mt-4">
          <button
            onClick={() => setScreen('viewer-hub')}
            className={`text-base py-3 transition-colors ${
              phase === 'result'
                ? 'text-gold/70 hover:text-gold font-medium tracking-wide'
                : 'text-foreground/40 hover:text-foreground/60'
            }`}
          >
            {phase === 'result' ? 'View on frame' : 'Cancel'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
