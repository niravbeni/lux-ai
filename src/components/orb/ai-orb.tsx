'use client';

import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore, OrbState } from '@/store/app-store';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  #define TAU 6.28318530718

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_pulse;
  uniform float u_ripple;
  uniform float u_scale;
  uniform float u_offsetY;
  uniform vec2 u_touch;
  uniform float u_touchPress;

  varying vec2 vUv;

  float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u * u * (3.0 - 2.0 * u);
    float res = mix(
      mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
      mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
      u.y
    );
    return res * res;
  }

  float fbm(vec2 p, int octaves) {
    float s = 0.0;
    float m = 0.0;
    float a = 0.5;
    if (octaves >= 1) { s += a * noise(p); m += a; a *= 0.5; p *= 2.0; }
    if (octaves >= 2) { s += a * noise(p); m += a; a *= 0.5; p *= 2.0; }
    if (octaves >= 3) { s += a * noise(p); m += a; a *= 0.5; p *= 2.0; }
    if (octaves >= 4) { s += a * noise(p); m += a; a *= 0.5; p *= 2.0; }
    return s / m;
  }

  vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
  }

  float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    float min_res = min(u_resolution.x, u_resolution.y);
    vec2 fragCoord = vUv * u_resolution;
    vec2 uv = (fragCoord * 2.0 - u_resolution) / min_res * 1.5;

    uv /= u_scale;

    // Shift orb center vertically (positive = up on screen)
    uv.y -= u_offsetY;

    float t = u_time;
    t += u_pulse * sin(u_time * 4.0) * 0.3;

    // === IDLE: calm slow drift, not bubbly ===
    float breathe = sin(t * 0.4) * 0.015;
    float morphX = sin(t * 0.25 + uv.y * 1.2) * 0.008;
    float morphY = cos(t * 0.2 + uv.x * 1.2) * 0.008;
    uv += vec2(morphX, morphY);

    // === TOUCH/HOVER: the orb comes ALIVE ===
    float touchDist = length(uv - u_touch);
    vec2 toTouch = u_touch - uv;
    float tp = u_touchPress; // shorthand

    // When touched: the noise speeds up — orb "thinks" faster
    t += tp * 1.5;

    // Strong magnetic attraction — orb reaches toward your finger
    float attraction = tp * 0.18 * exp(-touchDist * touchDist * 2.0);
    uv += toTouch * attraction;

    // Organic turbulence near touch — noise-driven distortion, no visible rings
    float touchNoise1 = fbm(uv * 3.0 + u_touch * 2.0 + t * 1.5, 2);
    float touchNoise2 = fbm(uv * 2.5 - u_touch * 1.5 + t * 1.2 + 50.0, 2);
    float touchFalloff = tp * 0.12 * exp(-touchDist * touchDist * 2.0);
    uv += vec2(touchNoise1 - 0.5, touchNoise2 - 0.5) * touchFalloff;

    // Orbital swirl — surface rotates slightly around the touch point
    float swirlAngle = tp * 0.3 * exp(-touchDist * 1.5);
    float cs = cos(swirlAngle);
    float sn = sin(swirlAngle);
    vec2 rel = uv - u_touch;
    uv = u_touch + vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs);

    float l = dot(uv, uv);
    float dist = sqrt(l); // smooth distance from center

    // === BACKGROUND EMANATION (computed everywhere, blended smoothly) ===
    float bgAngle = atan(uv.y, uv.x) / TAU + t * 0.1;
    vec3 bgPal = pal(bgAngle, vec3(0.3), vec3(0.5, 0.5, 0.5), vec3(1.0), vec3(0.0, 0.8, 0.8));
    float bgNoise = fbm(uv * 0.8 + t * 0.15, 2);

    // Smooth exponential falloffs only — no smoothstep boundaries
    float emanation = exp(-l * 0.18) * 0.35;
    float atmosphere = exp(-l * 0.5) * 0.25;
    float nearGlow = exp(-l * 0.3) * 0.2;

    vec3 bgCol = bgPal * bgNoise * 1.5;
    vec3 emanationCol = bgCol * (emanation + atmosphere) + bgPal * nearGlow * 0.3;
    float emanationAlpha = emanation * 0.6 + atmosphere * 0.4 + nearGlow * 0.15;

    // Pulse and touch affect emanation everywhere
    emanationCol *= 1.0 + u_pulse * 0.3 * sin(t * 3.0);
    float emaTurbulence = fbm(uv * 1.5 + u_touch + t * 0.8, 2);
    emanationCol += bgPal * tp * 0.3 * emaTurbulence * exp(-l * 0.15);
    emanationAlpha += tp * 0.12 * exp(-l * 0.1);

    // === ORB SURFACE ===
    // Crisp orb edge — defined outline
    float sm = smoothstep(1.02 + breathe, 0.98 + breathe, l);
    float d = sm * l * l * l * 2.0;
    vec3 norm = normalize(vec3(uv.x, uv.y, 0.7 - d));

    // Surface normal morph — bulge toward finger, orb "leans in"
    float touchProximity = tp * exp(-touchDist * touchDist * 3.0);
    norm.xy += toTouch * touchProximity * 0.5;
    // Smooth noise-driven normal turbulence — organic
    float normNoise1 = fbm(norm.xy * 4.0 + u_touch + t * 2.0, 2);
    float normNoise2 = fbm(norm.xy * 4.0 - u_touch + t * 2.0 + 30.0, 2);
    norm.x += tp * 0.2 * (normNoise1 - 0.5) * exp(-touchDist * 1.5);
    norm.y += tp * 0.2 * (normNoise2 - 0.5) * exp(-touchDist * 1.5);
    norm = normalize(norm);

    // Noise distortion — accelerates when touched
    float noiseSpeed = 0.4 + tp * 0.8;
    float nx = fbm(uv * 2.0 + t * noiseSpeed + 25.69, 4);
    float ny = fbm(uv * 2.0 + t * noiseSpeed + 86.31, 4);
    float n = fbm(uv * 3.0 + 2.0 * vec2(nx, ny), 3);

    // State ripple — noise-based
    float stateNoise = fbm(uv * 2.5 + t * 1.5, 2);
    n += u_ripple * 0.15 * (stateNoise - 0.5);

    // Touch: organic noise boost near finger
    float touchNoiseBoost = tp * 0.2 * fbm(uv * 4.0 + u_touch * 3.0 + t * 2.5, 2) * exp(-touchDist * 1.2);
    n += touchNoiseBoost;

    vec3 col = vec3(n * 0.5 + 0.25);
    float a = atan(uv.y, uv.x) / TAU + t * 0.1;

    col *= pal(a, vec3(0.3), vec3(0.5, 0.5, 0.5), vec3(1.0), vec3(0.0, 0.8, 0.8));
    col *= 2.0;

    vec3 c = col * d;

    // Specular
    c += (c * 0.5 + vec3(1.0) - luma(c)) * vec3(max(0.0, pow(dot(norm, vec3(0.0, 0.0, -1.0)), 5.0) * 3.0));

    // Glint
    float g = 1.5 * smoothstep(0.6, 1.0, fbm(norm.xy * 3.0 / (1.0 + norm.z), 2)) * d;
    c += g;

    // Touch glow — warm bloom radiating from finger
    float touchGlow = tp * 0.4 * exp(-touchDist * touchDist * 3.0);
    c += vec3(1.0, 0.95, 0.85) * touchGlow * sm;

    // Colour-shifting glow — the palette swirls faster near the touch
    float touchPalShift = tp * 0.3 * exp(-touchDist * 1.5);
    vec3 touchCol = pal(a + touchPalShift + t * 0.5, vec3(0.4), vec3(0.6), vec3(1.0), vec3(0.1, 0.7, 0.9));
    c += touchCol * tp * 0.15 * exp(-touchDist * touchDist * 4.0) * sm;

    // Smooth proximity glow
    float proximityGlow = tp * 0.2 * exp(-touchDist * touchDist * 2.5);
    c += bgPal * proximityGlow * sm;

    // Edge glow — defines the orb outline
    col = c + col * pow((1.0 - smoothstep(1.0, 0.98, l) - pow(max(0.0, length(uv) - 1.0), 0.2)) * 2.0, 4.0);

    // Rim light — crisp orb boundary
    float rim = smoothstep(1.0, 0.7, sqrt(l));
    col += vec3(0.05, 0.08, 0.12) * (1.0 - rim) * sm * 2.0;
    col += abs(norm) * (1.0 - d) * sm * 0.25;

    // Pulse brightness
    col += u_pulse * 0.08 * vec3(0.9, 0.85, 0.7) * sm;

    float alpha = sm;

    // Blend orb edge into emanation — smooth halo using exponential, no circles
    float halo = exp(-pow(dist - 1.0, 2.0) * 3.0) * (1.0 - sm) * 0.4;
    col = mix(emanationCol, col, sm);
    col += bgPal * halo * bgNoise;
    alpha = max(alpha, halo + emanationAlpha);

    gl_FragColor = vec4(col, alpha);
  }
`;

function getOrbTargets(state: OrbState) {
  switch (state) {
    case 'idle':
      return { pulse: 0.15, ripple: 0.0, scale: 0.7 };
    case 'listening':
      return { pulse: 1.0, ripple: 0.0, scale: 0.76 };
    case 'processing':
      return { pulse: 0.5, ripple: 0.5, scale: 0.72 };
    case 'recognition':
      return { pulse: 0.0, ripple: 1.0, scale: 0.84 };
    case 'speaking':
      return { pulse: 0.7, ripple: 0.2, scale: 0.74 };
    default:
      return { pulse: 0.15, ripple: 0.0, scale: 0.7 };
  }
}

interface AiOrbProps {
  scale?: number;
  interactive?: boolean;
  offsetY?: number;
}

export default function AiOrb({ scale = 1, interactive = false, offsetY = 0 }: AiOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const orbState = useAppStore((s) => s.orbState);
  const { viewport, size } = useThree();

  const touchRef = useRef({ x: 0, y: 0, press: 0, targetPress: 0 });

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(800, 800) },
      u_pulse: { value: 0 },
      u_ripple: { value: 0 },
      u_scale: { value: 1.0 },
      u_offsetY: { value: 0 },
      u_touch: { value: new THREE.Vector2(0, 0) },
      u_touchPress: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    uniforms.u_time.value = state.clock.elapsedTime;
    uniforms.u_resolution.value.set(size.width * scale, size.height * scale);

    const targets = getOrbTargets(orbState);
    const lerp = 0.05;

    uniforms.u_pulse.value += (targets.pulse - uniforms.u_pulse.value) * lerp;
    uniforms.u_ripple.value += (targets.ripple - uniforms.u_ripple.value) * lerp;
    uniforms.u_scale.value += (targets.scale - uniforms.u_scale.value) * lerp;
    uniforms.u_offsetY.value = offsetY;

    // Smooth touch interpolation — fast ramp up, slow decay for organic feel
    const touch = touchRef.current;
    const touchLerp = touch.targetPress > touch.press ? 0.15 : 0.04;
    touch.press += (touch.targetPress - touch.press) * touchLerp;
    uniforms.u_touch.value.set(touch.x, touch.y);
    uniforms.u_touchPress.value = touch.press;
  });

  const pointerToShaderUV = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!e.uv) return { x: 0, y: 0 };
      const min_res = Math.min(size.width * scale, size.height * scale);
      const fx = e.uv.x * size.width * scale;
      const fy = e.uv.y * size.height * scale;
      const sx = ((fx * 2.0 - size.width * scale) / min_res * 1.5) / uniforms.u_scale.value;
      const sy = ((fy * 2.0 - size.height * scale) / min_res * 1.5) / uniforms.u_scale.value - offsetY;
      return { x: sx, y: sy };
    },
    [size, scale, offsetY, uniforms.u_scale]
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      const uv = pointerToShaderUV(e);
      touchRef.current.x = uv.x;
      touchRef.current.y = uv.y;
      touchRef.current.targetPress = 1.0;
    },
    [interactive, pointerToShaderUV]
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      const uv = pointerToShaderUV(e);
      touchRef.current.x = uv.x;
      touchRef.current.y = uv.y;
      // Hover is nearly full strength — the orb reacts just by sensing presence
      touchRef.current.targetPress = Math.max(touchRef.current.targetPress, 0.75);
    },
    [interactive, pointerToShaderUV]
  );

  const handlePointerUp = useCallback(() => {
    // Don't drop to zero immediately — let it linger
    touchRef.current.targetPress = 0.3;
    // Then fade out
    setTimeout(() => {
      touchRef.current.targetPress = 0;
    }, 400);
  }, []);

  const handlePointerLeave = useCallback(() => {
    // Slow fade when finger leaves — the orb "remembers" briefly
    touchRef.current.targetPress = 0.2;
    setTimeout(() => {
      touchRef.current.targetPress = 0;
    }, 600);
  }, []);

  return (
    <mesh
      ref={meshRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
