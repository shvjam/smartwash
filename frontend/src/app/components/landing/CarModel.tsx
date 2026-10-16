import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { GLTFLoader } from 'three-stdlib';
import { DRACOLoader } from 'three-stdlib';
import * as THREE from 'three';
import { useReducedMotion } from 'motion/react';

/**
 * The car built in Blender, turning slowly on the page.
 *
 * It is one 16 KB model: a low-poly saloon, Draco-compressed, exported +Y up. That budget is
 * the whole point — a visitor on a phone pays for this in download and in frame time, and a
 * landing page cannot ask for megabytes to show a car.
 *
 * It only mounts when it is scrolled to, and it stops turning for anyone whose system asks
 * for less motion. Where WebGL is unavailable or the model fails to arrive, the drawn scene
 * is still on the page above it; nothing here is load-bearing.
 */

const MODEL = '/assets/3d/car.glb';

function useCar() {
  // The decoder ships with three; pointing at the CDN copy keeps it out of our bundle and it
  // is only fetched when a page actually shows the model.
  return useLoader(GLTFLoader, MODEL, loader => {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/');
    (loader as GLTFLoader).setDRACOLoader(draco);
  });
}

const Car = ({ spin, onReady }: { spin: boolean; onReady?: () => void }) => {
  const gltf = useCar();
  const group = useRef<THREE.Group>(null);

  // Tells the page the bay now has a real car in it, so the drawn one can step aside.
  useEffect(() => { onReady?.(); }, [onReady]);

  useFrame((_, delta) => {
    if (spin && group.current) group.current.rotation.y += delta * 0.35;
  });

  return (
    <group ref={group} position={[0, -0.45, 0]} scale={1.05}>
      <primitive object={gltf.scene} />
    </group>
  );
};

export const CarModel = ({ className, onReady }: { className?: string; onReady?: () => void }) => {
  const still = useReducedMotion();

  return (
    <div className={className} aria-hidden>
      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [5.0, 1.75, 6.2], fov: 30 }}
        gl={{ antialias: true, alpha: true }}
        frameloop={still ? 'demand' : 'always'}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 3]} intensity={1.5} />
        <directionalLight position={[-5, 3, -2]} intensity={0.5} color="#bcd6ff" />
        {/* No HDR environment: the paint is flat brand colour, so an image-based light adds a
            download and a decoder for a difference nobody would see. */}
        <hemisphereLight args={[0xdfe9ff, 0xf2d8d8, 0.7]} />
        <Suspense fallback={null}>
          <Car spin={!still} onReady={onReady} />
        </Suspense>
        <ContactShadows position={[0, -0.92, 0]} opacity={0.35} scale={9} blur={2.6} far={3} />
      </Canvas>
    </div>
  );
};

export default CarModel;
