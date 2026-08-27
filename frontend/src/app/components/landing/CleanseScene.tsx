import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import {
  useGLTF, Environment, ContactShadows, OrbitControls, Float, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';

useGLTF.preload('https://threejs.org/examples/models/gltf/ferrari.glb');

const DIRT_MASK_SIZE = 1024;
const BRUSH_RADIUS_UV = 0.06;

type CleanseSceneProps = {
  onProgressChange?: (p: number) => void;
};

// Builds a CanvasTexture that starts fully "dirty" (white = dirt present).
// onPaintAt(uv) draws a soft black radial gradient (= cleaned).
function useDirtMask(onProgressChange?: (p: number) => void) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = DIRT_MASK_SIZE;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, DIRT_MASK_SIZE, DIRT_MASK_SIZE);
    return c;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  }, [canvas]);

  const progressRef = useRef(0);
  const lastReportRef = useRef(0);

  const paintAt = (u: number, v: number) => {
    const ctx = canvas.getContext('2d')!;
    const x = u * DIRT_MASK_SIZE;
    const y = v * DIRT_MASK_SIZE;
    const r = BRUSH_RADIUS_UV * DIRT_MASK_SIZE;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    texture.needsUpdate = true;

    // Coarse progress sampling (every ~250ms worth of strokes).
    const now = performance.now();
    if (now - lastReportRef.current > 250) {
      lastReportRef.current = now;
      const sample = ctx.getImageData(0, 0, DIRT_MASK_SIZE, DIRT_MASK_SIZE).data;
      let sum = 0;
      const step = 64; // sample every 16th pixel for speed
      for (let i = 0; i < sample.length; i += step) sum += sample[i];
      const max = (sample.length / step) * 255;
      const dirt = sum / max; // 1 = dirty, 0 = clean
      const cleaned = 1 - dirt;
      progressRef.current = cleaned;
      onProgressChange?.(cleaned);
    }
  };

  return { texture, paintAt, progressRef };
}

function CarModel({
  dirtTexture,
  onPaint,
}: {
  dirtTexture: THREE.Texture;
  onPaint: (u: number, v: number) => void;
}) {
  const gltf = useGLTF('https://threejs.org/examples/models/gltf/ferrari.glb');
  const carRef = useRef<THREE.Group>(null!);

  // Procedural dirt texture (noisy brown).
  const dirtMap = useMemo(() => {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3b2a1a';
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = Math.random();
      const v = 30 + n * 70;
      img.data[i] = 60 + v * 0.8;
      img.data[i + 1] = 40 + v * 0.55;
      img.data[i + 2] = 25 + v * 0.35;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
    return t;
  }, []);

  // Inject dirt overlay into every body material via onBeforeCompile.
  useEffect(() => {
    if (!gltf.scene) return;
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.isMeshStandardMaterial) return;

      // Skip glass-like (transparent) parts so windows stay clean.
      if (mat.transparent && mat.opacity < 0.9) return;

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uDirtMask = { value: dirtTexture };
        shader.uniforms.uDirtMap = { value: dirtMap };
        shader.uniforms.uDirtStrength = { value: 0.85 };

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform sampler2D uDirtMask;
             uniform sampler2D uDirtMap;
             uniform float uDirtStrength;`,
          )
          .replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
             float dirtMask = texture2D(uDirtMask, vMapUv).r;
             vec3 dirtColor = texture2D(uDirtMap, vMapUv * 4.0).rgb;
             float dirt = dirtMask * uDirtStrength;
             gl_FragColor.rgb = mix(gl_FragColor.rgb, dirtColor * 0.6, dirt * 0.9);
             gl_FragColor.rgb *= mix(1.0, 0.55, dirt);`,
          );

        mat.userData.shader = shader;
      };
      mat.needsUpdate = true;
    });
  }, [gltf.scene, dirtTexture, dirtMap]);

  // Gentle idle rotation.
  useFrame((state, dt) => {
    if (carRef.current) {
      carRef.current.rotation.y += dt * 0.15;
    }
  });

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!e.uv) return;
    e.stopPropagation();
    onPaint(e.uv.x, e.uv.y);
  };

  return (
    <group ref={carRef} position={[0, -0.4, 0]}>
      <primitive
        object={gltf.scene}
        scale={1.2}
        onPointerMove={handlePointerMove}
      />
    </group>
  );
}

function CursorRipple() {
  // Renders a faint cyan glow at the pointer in screen space — sells the "wash" feel.
  const meshRef = useRef<THREE.Mesh>(null!);
  const { viewport, pointer } = useThree();
  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.x = (pointer.x * viewport.width) / 2;
    meshRef.current.position.y = (pointer.y * viewport.height) / 2;
  });
  return (
    <mesh ref={meshRef} position={[0, 0, 2]}>
      <circleGeometry args={[0.18, 32]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function SceneFallback() {
  return (
    <Html center>
      <div className="text-white/80 text-sm">در حال بارگذاری صحنه سه‌بعدی…</div>
    </Html>
  );
}

export const CleanseScene: React.FC<CleanseSceneProps> = ({ onProgressChange }) => {
  const { texture: dirtTexture, paintAt } = useDirtMask(onProgressChange);

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: [4.2, 1.6, 5.5], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#0a0a14']} />
      <fog attach="fog" args={['#0a0a14', 8, 18]} />

      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 8, 3]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-4, 2, -3]} intensity={0.8} color="#ef4444" />
      <pointLight position={[4, 2, -3]} intensity={0.8} color="#22d3ee" />

      <Suspense fallback={<SceneFallback />}>
        <Float speed={1} rotationIntensity={0.05} floatIntensity={0.2}>
          <CarModel dirtTexture={dirtTexture} onPaint={paintAt} />
        </Float>
        <Environment preset="night" />
        <ContactShadows
          position={[0, -0.5, 0]}
          opacity={0.55}
          scale={10}
          blur={2.4}
          far={4}
        />
      </Suspense>

      <CursorRipple />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={false}
      />

      <EffectComposer>
        <Bloom intensity={0.55} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
        <ChromaticAberration offset={[0.0006, 0.0006]} radialModulation={false} modulationOffset={0} />
      </EffectComposer>
    </Canvas>
  );
};

export default CleanseScene;
