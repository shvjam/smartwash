import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { DRACOLoader, GLTFLoader } from 'three-stdlib';
import * as THREE from 'three';
import { useReducedMotion } from 'motion/react';

/**
 * A car driven through a wash bay by the page's own scroll.
 *
 * The six stages this plays are the six the product enforces — arrive, wash, dry, finish,
 * settle, hand back — so scrolling the section is literally watching an order move. That is
 * the argument the whole page makes, in the one form nobody skims past.
 *
 * Everything is driven from a single number, `progress`, running 0 → 1 as the section passes
 * the viewport. Nothing here keeps its own clock: the car's position, the foam, the water, the
 * brushes and the shine are all functions of that number, so the scene can never drift out of
 * step with the words beside it, and scrubbing backwards works for free.
 *
 * Budget: four models totalling 28 KB, one canvas, instanced foam. It mounts only on a screen
 * wide enough to show it — the caller decides that — and stops dead for reduced motion.
 */

const MODELS = {
  car: '/assets/3d/car.glb',
  bay: '/assets/3d/bay.glb',
  brush: '/assets/3d/brush.glb',
  nozzle: '/assets/3d/nozzle.glb',
};

const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/';

/** Where the car is along X at a given progress, and what is happening to it there. */
const DRIVE_IN_END = 0.18;
const WASH_START = 0.2;
const WASH_END = 0.46;
const RINSE_END = 0.62;
const DRY_END = 0.78;
const DRIVE_OUT_START = 0.86;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0 before `from`, 1 after `to`, eased in between. */
const ramp = (v: number, from: number, to: number) => {
  const t = clamp01((v - from) / Math.max(1e-6, to - from));
  return t * t * (3 - 2 * t);
};

function useModel(url: string) {
  return useLoader(GLTFLoader, url, loader => {
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO);
    (loader as GLTFLoader).setDRACOLoader(draco);
  });
}

/* ── Foam ──────────────────────────────────────────────────────────────── */

const FOAM_COUNT = 140;

/**
 * Soap on the paint, as one instanced mesh.
 *
 * Ninety separate spheres would be ninety draw calls for something nobody looks at directly;
 * instanced, it is one. They sit in a shell around the car's body and swell as the wash
 * starts, then shrink away under the rinse.
 */
const Foam = ({ progress }: { progress: React.MutableRefObject<number> }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const seeds = useMemo(() => Array.from({ length: FOAM_COUNT }, (_, i) => {
    const a = (i / FOAM_COUNT) * Math.PI * 2 * 3.7;
    return {
      x: -1.9 + (i / FOAM_COUNT) * 3.8,
      y: 0.35 + Math.abs(Math.sin(a * 1.7)) * 1.15,
      z: Math.cos(a) * 0.95,
      r: 0.07 + ((i * 37) % 11) / 90,
      phase: (i % 17) / 17,
    };
  }), []);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const p = progress.current;
    const on = ramp(p, WASH_START, WASH_START + 0.1) * (1 - ramp(p, WASH_END, RINSE_END));
    const t = clock.elapsedTime;

    for (let i = 0; i < FOAM_COUNT; i++) {
      const s = seeds[i];
      const wobble = Math.sin(t * 1.6 + s.phase * 7) * 0.05;
      dummy.position.set(s.x, s.y + wobble, s.z);
      const scale = s.r * on * (0.85 + Math.sin(t * 2.2 + s.phase * 9) * 0.15);
      dummy.scale.setScalar(Math.max(0.0001, scale));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.visible = on > 0.01;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FOAM_COUNT]} castShadow={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color="#ffffff" roughness={0.25} transparent opacity={0.92} />
    </instancedMesh>
  );
};

/* ── Water ─────────────────────────────────────────────────────────────── */

/** Jets from the gantry: thin cylinders that stretch down while the rinse runs. */
const Jets = ({ progress }: { progress: React.MutableRefObject<number> }) => {
  const group = useRef<THREE.Group>(null);
  const xs = useMemo(() => [-1.4, -0.7, 0, 0.7, 1.4], []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = progress.current;
    const on = ramp(p, WASH_END - 0.06, RINSE_END - 0.1) * (1 - ramp(p, RINSE_END, DRY_END));
    group.current.visible = on > 0.02;
    group.current.children.forEach((child, i) => {
      const jitter = 0.86 + Math.sin(clock.elapsedTime * 9 + i) * 0.14;
      child.scale.set(1, on * jitter, 1);
      child.position.y = 2.25 - (on * jitter * 1.6) / 2;
    });
  });

  return (
    <group ref={group}>
      {xs.map(x => (
        <mesh key={x} position={[x, 2.25, 0]}>
          <cylinderGeometry args={[0.015, 0.075, 1.6, 7, 1, true]} />
          <meshStandardMaterial color="#7cc4ff" transparent opacity={0.8} roughness={0.05} emissive="#2b7fd4" emissiveIntensity={0.25} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
};

/* ── The bay and its moving parts ──────────────────────────────────────── */

const Bay = ({ progress }: { progress: React.MutableRefObject<number> }) => {
  const bay = useModel(MODELS.bay);
  const brush = useModel(MODELS.brush);
  const nozzle = useModel(MODELS.nozzle);

  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);

  const brushScene = useMemo(() => brush.scene.clone(), [brush]);
  const brushScene2 = useMemo(() => brush.scene.clone(), [brush]);
  const nozzles = useMemo(() => [-1.4, -0.7, 0, 0.7, 1.4].map(() => nozzle.scene.clone()), [nozzle]);

  useFrame((_, delta) => {
    const p = progress.current;
    // The brushes spin while the car is under them, and idle slowly either side of that.
    const working = ramp(p, WASH_START - 0.04, WASH_START + 0.08) * (1 - ramp(p, RINSE_END, RINSE_END + 0.08));
    const speed = 0.4 + working * 9;
    if (left.current) left.current.rotation.z += delta * speed;
    if (right.current) right.current.rotation.z -= delta * speed;
  });

  return (
    <group>
      <primitive object={bay.scene} />
      <group ref={left} position={[0, 0, 1.15]}><primitive object={brushScene} /></group>
      <group ref={right} position={[0, 0, -1.15]}><primitive object={brushScene2} /></group>
      {nozzles.map((n, i) => (
        <primitive key={i} object={n} position={[[-1.4, -0.7, 0, 0.7, 1.4][i], 2.82, 0]} />
      ))}
    </group>
  );
};

/* ── The car ───────────────────────────────────────────────────────────── */

const Car = ({ progress, onReady }: { progress: React.MutableRefObject<number>; onReady?: () => void }) => {
  const gltf = useModel(MODELS.car);
  const group = useRef<THREE.Group>(null);
  const scene = useMemo(() => gltf.scene.clone(), [gltf]);

  // The paint is dulled while it is dirty and polished as it leaves, which is the one piece
  // of feedback that says the wash did something.
  const paints = useMemo(() => {
    const found: THREE.MeshStandardMaterial[] = [];
    scene.traverse(child => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mat && 'roughness' in mat && mat.color && mat.color.r > 0.25 && mat.color.g < 0.2) {
        found.push((mesh.material = mat.clone() as THREE.MeshStandardMaterial));
      }
    });
    return found;
  }, [scene]);

  React.useEffect(() => { onReady?.(); }, [onReady]);

  useFrame(() => {
    const p = progress.current;
    if (!group.current) return;

    // Drive in, stand still through the wash, drive out.
    const inAt = ramp(p, 0, DRIVE_IN_END);
    const outAt = ramp(p, DRIVE_OUT_START, 1);
    group.current.position.x = -7.5 + inAt * 7.5 + outAt * 8.5;

    // A little settle as it stops, and a lift of the nose as it pulls away.
    group.current.rotation.z = (1 - inAt) * -0.015 + outAt * 0.02;

    const polish = ramp(p, RINSE_END, DRY_END + 0.06);
    for (const mat of paints) {
      mat.roughness = 0.62 - polish * 0.5;
      mat.metalness = 0.05 + polish * 0.45;
    }
  });

  return <group ref={group}><primitive object={scene} /></group>;
};

/* ── Camera ────────────────────────────────────────────────────────────── */

/**
 * The camera moves with the work: wide while the car arrives, closer and lower through the
 * wash, and back out as it leaves. Fixed, it would be a security recording of a carwash.
 */
const Rig = ({ progress }: { progress: React.MutableRefObject<number> }) => {
  const target = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);

  useFrame(({ camera }, delta) => {
    const p = progress.current;
    const close = ramp(p, DRIVE_IN_END, WASH_START + 0.12) * (1 - ramp(p, DRY_END, DRIVE_OUT_START));

    const wantX = 7.6 - close * 2.2;
    const wantY = 3.4 - close * 1.5;
    const wantZ = 7.4 - close * 2.6;

    // Eased rather than snapped: the camera should feel carried by the scroll, not cut to it.
    const k = 1 - Math.pow(0.0001, delta);
    camera.position.x += (wantX - camera.position.x) * k;
    camera.position.y += (wantY - camera.position.y) * k;
    camera.position.z += (wantZ - camera.position.z) * k;
    camera.lookAt(target);
  });

  return null;
};

/* ── The scene ─────────────────────────────────────────────────────────── */

export const WashSequence = ({
  progress, className, onReady,
}: {
  /** 0 → 1 as the section crosses the viewport. Read every frame, never set here. */
  progress: React.MutableRefObject<number>;
  className?: string;
  onReady?: () => void;
}) => {
  const still = useReducedMotion();

  return (
    <div className={className} aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [7.6, 3.4, 7.4], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop={still ? 'demand' : 'always'}
      >
        <hemisphereLight args={[0xdfe9ff, 0xf6dede, 0.85]} />
        <directionalLight position={[5, 8, 4]} intensity={1.6} />
        <directionalLight position={[-6, 4, -3]} intensity={0.55} color="#bcd6ff" />

        <Suspense fallback={null}>
          <Bay progress={progress} />
          <Car progress={progress} onReady={onReady} />
          <Foam progress={progress} />
          <Jets progress={progress} />
        </Suspense>

        <ContactShadows position={[0, 0.01, 0]} opacity={0.3} scale={14} blur={2.8} far={4} />
        <Rig progress={progress} />
      </Canvas>
    </div>
  );
};

export default WashSequence;
