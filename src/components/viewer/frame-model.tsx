'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/store/app-store';
import { getProduct, getColourway } from '@/data/product-catalog';

interface FrameModelProps {
  modelPath: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

interface OriginalMat {
  color: THREE.Color;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  map: THREE.Texture | null;
  metalnessMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  normalMap: THREE.Texture | null;
}

/**
 * Check whether a colourway hex is "dark" (sRGB luma < 0.25).
 * Dark colourways use the existing texture for darkness and only adjust
 * roughness / metalness (tint-only mode).  Lighter / coloured variants
 * replace the texture entirely.
 */
function isDarkColour(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return r * 0.299 + g * 0.587 + b * 0.114 < 0.25;
}

/**
 * Logo / branding materials are light/white AND have NO diffuse texture.
 * Real frame surfaces may also have a white base colour, but they always
 * carry a dark texture map that provides their visual darkness.
 */
function isLogoMaterial(orig: OriginalMat): boolean {
  if (orig.map) return false;
  const luma = orig.color.r * 0.299 + orig.color.g * 0.587 + orig.color.b * 0.114;
  return luma > 0.7;
}

/** Gather materials from a mesh (handles single and array). */
function getMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

export default function FrameModel({ modelPath }: FrameModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);
  const isConversing = useAppStore((s) => s.isConversing);
  const activeColourway = useAppStore((s) => s.activeColourway);
  const activeProductId = useAppStore((s) => s.activeProductId);
  const product = getProduct(activeProductId);

  // ── Clone scene once: deep-clone materials, scale, store pristine originals ─
  const { clonedScene, originals } = useMemo(() => {
    const cloned = scene.clone(true);

    // Deep-clone every material so mutations don't leak into the useGLTF cache
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else {
          mesh.material = mesh.material.clone();
        }
      }
    });

    // Auto-scale to ~1.15 units, then apply per-product displayScale
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const baseScale = 1.15 / Math.max(size.x, size.y, size.z);
    const productScale = product.displayScale ?? 1.0;
    cloned.scale.setScalar(baseScale * productScale);
    const scaledCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(cloned).getCenter(scaledCenter);
    cloned.position.sub(scaledCenter);

    // Snapshot pristine material state BEFORE any modifications
    const origs = new Map<THREE.Material, OriginalMat>();
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        getMaterials(child as THREE.Mesh).forEach((mat) => {
          if (origs.has(mat)) return;
          const s = mat as THREE.MeshStandardMaterial;
          origs.set(mat, {
            color: s.color.clone(),
            metalness: s.metalness ?? 0.3,
            roughness: s.roughness ?? 0.5,
            envMapIntensity: s.envMapIntensity ?? 1.0,
            map: s.map ?? null,
            metalnessMap: s.metalnessMap ?? null,
            roughnessMap: s.roughnessMap ?? null,
            normalMap: s.normalMap ?? null,
          });
        });
      }
    });

    // Make lens / glass materials translucent (after snapshotting originals)
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        getMaterials(child as THREE.Mesh).forEach((mat) => {
          const name = (mat.name || '').toLowerCase();
          if (name.includes('glass') || name.includes('lens')) {
            const s = mat as THREE.MeshStandardMaterial;
            s.transparent = true;
            s.opacity = 0.3;
            s.roughness = 0.05;
            s.metalness = 0.2;
            s.color.set(0x1a1a2e);
            s.depthWrite = false;
            s.side = THREE.DoubleSide;
            s.needsUpdate = true;
          }
        });
      }
    });

    return { clonedScene: cloned, originals: origs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, product.displayScale]);

  // ── Apply / restore colourway ─────────────────────────────────────────
  useEffect(() => {
    if (!clonedScene) return;

    const cw = product.colourways.find((c) => c.id === activeColourway) ?? getColourway(activeColourway);
    if (!cw) return;

    const isDefault = cw.id === product.colourways[0]?.id;

    // Dark colourways (matte-black, etc.) keep the baked-in texture for
    // realistic darkness and only tweak roughness / metalness.
    // Lighter / coloured colourways strip the texture and apply pure colour.
    const tintOnly = !isDefault && isDarkColour(cw.color);

    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;

      getMaterials(child as THREE.Mesh).forEach((mat) => {
        const stdMat = mat as THREE.MeshStandardMaterial;
        const orig = originals.get(mat);
        if (!orig) return;

        // Skip lenses (already made translucent in useMemo)
        if (stdMat.transparent) return;

        // Skip white/light logo & branding materials
        if (isLogoMaterial(orig)) return;

        if (isDefault) {
          // ── Restore pristine state ──────────────────────────────────
          stdMat.color.copy(orig.color);
          stdMat.metalness = orig.metalness;
          stdMat.roughness = orig.roughness;
          stdMat.envMapIntensity = orig.envMapIntensity;
          stdMat.map = orig.map;
          stdMat.metalnessMap = orig.metalnessMap;
          stdMat.roughnessMap = orig.roughnessMap;
          stdMat.normalMap = orig.normalMap;
        } else if (tintOnly) {
          // ── Dark variant: keep textures, adjust PBR only ────────────
          // The existing dark texture provides the correct darkness level;
          // we only change the surface finish.
          stdMat.metalness = cw.metalness;
          stdMat.roughness = cw.roughness;
        } else {
          // ── Full colour replacement: strip textures, apply colour ───
          stdMat.map = null;
          stdMat.metalnessMap = null;
          stdMat.roughnessMap = null;
          // Keep normalMap for surface grooves / detail
          stdMat.color.set(cw.color);
          stdMat.metalness = cw.metalness;
          stdMat.roughness = cw.roughness;
          // Without the dark texture, the bright studio lighting washes
          // out the colour.  Pull envMapIntensity way down to compensate.
          stdMat.envMapIntensity = 0.15;
        }
        stdMat.needsUpdate = true;
      });
    });
  }, [activeColourway, clonedScene, originals, product]);

  // Intro spin + idle sway
  const introProgress = useRef(0);
  const wasConversing = useRef(false);
  const INTRO_DURATION = 2.0;

  useEffect(() => {
    if (wasConversing.current && !isConversing) {
      introProgress.current = 0;
    }
    wasConversing.current = isConversing;
  }, [isConversing]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    introProgress.current = Math.min(introProgress.current + delta / INTRO_DURATION, 1);
    const p = introProgress.current;
    const ease = 1 - Math.pow(1 - p, 3);
    const introY = (1 - ease) * Math.PI * 1.2;

    groupRef.current.position.y = Math.sin(t * 0.5) * 0.02;
    groupRef.current.rotation.x = 0.25 + Math.sin(t * 0.3) * 0.02;
    groupRef.current.rotation.y = -0.55 + introY + Math.sin(t * 0.2) * 0.03;
    groupRef.current.rotation.z = 0.04 + Math.sin(t * 0.25) * 0.01;
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}
