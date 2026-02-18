'use client';

import { Suspense, useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { getProduct, getColourway } from '@/data/product-catalog';
import type { Colourway } from '@/store/app-store';

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

function isDarkColour(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return r * 0.299 + g * 0.587 + b * 0.114 < 0.25;
}

function isLogoMaterial(orig: OriginalMat): boolean {
  if (orig.map) return false;
  const luma = orig.color.r * 0.299 + orig.color.g * 0.587 + orig.color.b * 0.114;
  return luma > 0.7;
}

function getMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function applyColourway(
  clonedScene: THREE.Object3D,
  originals: Map<THREE.Material, OriginalMat>,
  cw: Colourway,
  product: ReturnType<typeof getProduct>,
) {
  const defaultCw = product.colourways[0];
  const isDefault = cw.id === defaultCw?.id;
  const isBuiltIn = product.colourways.some((c) => c.id === cw.id);
  const defaultIsDark = defaultCw ? isDarkColour(defaultCw.color) : false;
  const tintOnly = !isDefault && isBuiltIn && isDarkColour(cw.color) && defaultIsDark;

  clonedScene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    getMaterials(child as THREE.Mesh).forEach((mat) => {
      const stdMat = mat as THREE.MeshStandardMaterial;
      const orig = originals.get(mat);
      if (!orig || stdMat.transparent) return;
      if (isLogoMaterial(orig)) return;

      if (isDefault) {
        stdMat.color.copy(orig.color);
        stdMat.metalness = orig.metalness;
        stdMat.roughness = orig.roughness;
        stdMat.envMapIntensity = orig.envMapIntensity;
        stdMat.map = orig.map;
        stdMat.metalnessMap = orig.metalnessMap;
        stdMat.roughnessMap = orig.roughnessMap;
        stdMat.normalMap = orig.normalMap;
      } else if (tintOnly) {
        stdMat.metalness = cw.metalness;
        stdMat.roughness = cw.roughness;
      } else {
        stdMat.map = null;
        stdMat.metalnessMap = null;
        stdMat.roughnessMap = null;
        stdMat.normalMap = orig.normalMap;
        stdMat.color.set(cw.color);
        stdMat.metalness = cw.metalness;
        stdMat.roughness = cw.roughness;
        stdMat.envMapIntensity = 0.15;
      }
      stdMat.needsUpdate = true;
    });
  });
}

// Captures the WebGL canvas as a data-URL after a few frames, then calls back.
function SnapshotCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    const id = requestAnimationFrame(function tick() {
      frameCount.current++;
      if (frameCount.current >= 3 && !captured.current) {
        captured.current = true;
        try {
          const url = gl.domElement.toDataURL('image/webp', 0.8);
          onCapture(url);
        } catch {
          // canvas tainted or context lost — leave live canvas
        }
        return;
      }
      requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [gl, onCapture]);

  return null;
}

interface ThumbnailModelProps {
  productId: string;
  colourwayId?: string;
  displayScale?: number;
}

function ThumbnailModel({ productId, colourwayId, displayScale = 1.0 }: ThumbnailModelProps) {
  const product = getProduct(productId);
  const { scene } = useGLTF(product.modelPath);

  const { clonedScene, originals } = useMemo(() => {
    const cloned = scene.clone(true);

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

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const baseScale = 1.15 / Math.max(size.x, size.y, size.z);
    const scale = product.displayScale ?? displayScale;
    cloned.scale.setScalar(baseScale * scale);
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(cloned).getCenter(center);
    cloned.position.sub(center);

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
  }, [scene, product.displayScale, displayScale]);

  useEffect(() => {
    if (!clonedScene) return;
    const cwId = colourwayId ?? product.colourways[0]?.id;
    if (!cwId) return;
    const cw = product.colourways.find((c) => c.id === cwId) ?? getColourway(cwId);
    if (!cw) return;
    applyColourway(clonedScene, originals, cw, product);
  }, [colourwayId, clonedScene, originals, product]);

  return (
    <group rotation={[0.25, -0.55, 0.04]}>
      <primitive object={clonedScene} />
    </group>
  );
}

interface FrameThumbnailProps {
  productId: string;
  colourwayId?: string;
  className?: string;
}

export default function FrameThumbnail({ productId, colourwayId, className }: FrameThumbnailProps) {
  const [staticSrc, setStaticSrc] = useState<string | null>(null);

  const handleCapture = useCallback((url: string) => {
    setStaticSrc(url);
  }, []);

  if (staticSrc) {
    return (
      <img
        src={staticSrc}
        alt=""
        draggable={false}
        className={className}
        style={{ background: 'transparent', objectFit: 'contain' }}
      />
    );
  }

  return (
    <div className={className} style={{ background: 'transparent' }}>
      <Canvas
        camera={{ position: [0, 0.1, 2.8], fov: 30 }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
        className="!absolute inset-0 w-full h-full"
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-3, 3, 2]} intensity={0.6} color="#e8ddd0" />
          <Environment preset="studio" background={false} />
          <ThumbnailModel productId={productId} colourwayId={colourwayId} />
          <SnapshotCapture onCapture={handleCapture} />
        </Suspense>
      </Canvas>
    </div>
  );
}
