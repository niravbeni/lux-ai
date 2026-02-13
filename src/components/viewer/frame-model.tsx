'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface FrameModelProps {
  modelPath: string;
}

export default function FrameModel({ modelPath }: FrameModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);

  // Clone scene, auto-scale, and make lenses translucent
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);

    // Calculate bounding box and auto-scale
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Target: model should be about 1.15 units wide (mobile-friendly)
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 1.15;
    const scaleFactor = targetSize / maxDim;

    cloned.scale.setScalar(scaleFactor);

    // Re-center after scaling
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    cloned.position.sub(scaledCenter);

    // Make eyeglass lenses translucent
    // GLB meshes: inside_lens002, frame006, frame004 all use "glass.001" material
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((mat) => {
          const matName = (mat.name || '').toLowerCase();

          // Target the "glass" material (eyeglass lenses), not "camera lens"
          if (matName.includes('glass')) {
            const stdMat = mat as THREE.MeshStandardMaterial;
            stdMat.transparent = true;
            stdMat.opacity = 0.3;
            stdMat.roughness = 0.05;
            stdMat.metalness = 0.2;
            stdMat.color = new THREE.Color(0x1a1a2e);
            stdMat.depthWrite = false;
            stdMat.side = THREE.DoubleSide;
            stdMat.needsUpdate = true;
          }
        });
      }
    });

    return cloned;
  }, [scene]);

  // Intro spin + idle sway
  const introProgress = useRef(0);
  const INTRO_DURATION = 2.0; // seconds for the entrance spin

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Track intro progress (0 → 1)
    introProgress.current = Math.min(introProgress.current + delta / INTRO_DURATION, 1);
    const p = introProgress.current;

    // Smooth ease-out curve
    const ease = 1 - Math.pow(1 - p, 3);

    // Intro spin: starts from a wide Y rotation and eases into the resting angle
    const introY = (1 - ease) * Math.PI * 1.2; // ~216° spin on entry

    // Gentle float
    groupRef.current.position.y = Math.sin(t * 0.5) * 0.02;

    // Resting pose + intro spin
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
