'use client';

import { Suspense, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ErrorBoundary } from './ErrorBoundary';
import type { DemoData, Frame, LidarPoint } from '../types/dataset';
import { OBJ_TYPE_COLORS, getObjectClass } from '../lib/foveatedGrid';
import { LIDAR_RGB } from '../lib/classificationData';

// ─── Coordinate mapping ───────────────────────────────────────────────────────
// Dataset: X=forward, Y=lateral, Z=height
// Three.js: X=forward, Y=up, Z=into-screen
function d2t(p: readonly [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

// ─── Point cloud shaders ──────────────────────────────────────────────────────
const VERT = /* glsl */`
  attribute vec4 aColor;
  varying   vec4 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(3.8 - (-mv.z) * 0.016, 1.0, 4.2);
    gl_Position  = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  varying vec4 vColor;
  void main() {
    vec2  uv  = gl_PointCoord - 0.5;
    float rsq = dot(uv, uv);
    if (rsq > 0.25) discard;
    float soft = smoothstep(0.25, 0.04, rsq);
    gl_FragColor = vec4(vColor.rgb, vColor.a * soft);
  }
`;

// ─── Classification colors (linear RGB) ───────────────────────────────────────

// Near/mid thresholds (squared)
const NEAR_SQ = 15 * 15;
const MID_SQ = 45 * 45;

// ─── PointCloud ───────────────────────────────────────────────────────────────
function PointCloud({ points, carPosRef, frameIdxRef }: {
  points: LidarPoint[];
  carPosRef: React.RefObject<THREE.Vector3>;
  frameIdxRef: React.RefObject<number>;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const lastFi = useRef(-1);

  const { positions, baseColors, colorBuffer } = useMemo(() => {
    const n = points.length;
    const positions = new Float32Array(n * 3);
    const baseColors = new Float32Array(n * 4);
    const colorBuffer = new Float32Array(n * 4);

    for (let i = 0; i < n; i++) {
      const [tx, ty, tz] = d2t(points[i].position);
      positions[i * 3] = tx;
      positions[i * 3 + 1] = ty;
      positions[i * 3 + 2] = tz;

      const rgb = LIDAR_RGB[points[i].classification];
      const isKnown = !!rgb;
      const actualRgb = rgb ?? [0, 0, 0];

      baseColors[i * 4] = actualRgb[0];
      baseColors[i * 4 + 1] = actualRgb[1];
      baseColors[i * 4 + 2] = actualRgb[2];
      baseColors[i * 4 + 3] = isKnown ? 1.0 : 0.0;

      // Initial: everything dim
      colorBuffer[i * 4] = actualRgb[0] * 0.15;
      colorBuffer[i * 4 + 1] = actualRgb[1] * 0.15;
      colorBuffer[i * 4 + 2] = actualRgb[2] * 0.15;
      colorBuffer[i * 4 + 3] = isKnown ? 0.08 : 0.0;
    }
    return { positions, baseColors, colorBuffer };
  }, [points]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {}, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  }), []);

  useFrame(() => {
    const fi = frameIdxRef.current ?? 0;
    if (fi === lastFi.current) return;
    lastFi.current = fi;

    const geo = geoRef.current;
    const attr = geo?.getAttribute('aColor') as THREE.BufferAttribute | undefined;
    if (!attr) return;

    const { x: cx, y: cy, z: cz } = carPosRef.current!;
    const colors = attr.array as Float32Array;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const i3 = i * 3, i4 = i * 4;
      const dx = positions[i3] - cx;
      const dy = positions[i3 + 1] - cy;
      const dz = positions[i3 + 2] - cz;
      const dSq = dx * dx + dy * dy + dz * dz;

      let alpha: number, bright: number;

      if (dSq <= NEAR_SQ) {
        alpha = 1.0; bright = 1.0;
      } else if (dSq <= MID_SQ) {
        const t = (Math.sqrt(dSq) - 15) / 30;
        alpha = 0.85 - 0.65 * t;
        bright = 1.00 - 0.40 * t;
      } else {
        const d = Math.sqrt(dSq);
        const t = Math.min((d - 45) / 50, 1.0);
        alpha = Math.max(0.18 - 0.14 * t, 0.04);
        bright = Math.max(0.38 - 0.28 * t, 0.10);
      }

      colors[i4] = baseColors[i4] * bright;
      colors[i4 + 1] = baseColors[i4 + 1] * bright;
      colors[i4 + 2] = baseColors[i4 + 2] * bright;
      colors[i4 + 3] = baseColors[i4 + 3] > 0 ? alpha : 0.0;
    }
    attr.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={points.length} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aColor" args={[colorBuffer, 4]} count={points.length} array={colorBuffer} itemSize={4} />
      </bufferGeometry>
      <primitive object={mat} attach="material" />
    </points>
  );
}

// ─── GLB Car model ────────────────────────────────────────────────────────────
function CarGLB({ carPosRef, frameIdxRef, frames }: {
  carPosRef: React.RefObject<THREE.Vector3>;
  frameIdxRef: React.RefObject<number>;
  frames: Frame[];
}) {
  const { scene } = useGLTF('/car.glb');
  const groupRef = useRef<THREE.Group>(null);
  const lastFi = useRef(-1);

  // Center, scale and orient the GLB once
  const cloned = useMemo(() => {
    const clone = scene.clone(true);

    // Compute bounding box to auto-scale
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Target: 4.5m long car
    const longest = Math.max(size.x, size.y, size.z);
    const scale = 4.5 / longest;
    clone.scale.setScalar(scale);

    // Re-center after scale
    clone.position.sub(center.multiplyScalar(scale));

    // Sit on the ground (y=0)
    const box2 = new THREE.Box3().setFromObject(clone);
    clone.position.y -= box2.min.y;

    return clone;
  }, [scene]);

  useFrame(() => {
    const fi = frameIdxRef.current ?? 0;
    if (!groupRef.current || fi === lastFi.current) return;
    lastFi.current = fi;
    const { position, heading } = frames[fi].vehicle;
    const [tx, ty, tz] = d2t(position);
    groupRef.current.position.set(tx, ty, tz);
    groupRef.current.rotation.y = -heading + Math.PI / 2;
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

// ─── Simple box-car fallback (if GLB fails) ───────────────────────────────────
const M_W = new THREE.MeshStandardMaterial({ color: '#f0f0ee', roughness: 0.22, metalness: 0.18 });
const M_G = new THREE.MeshStandardMaterial({ color: '#1a2535', transparent: true, opacity: 0.75 });
const M_T = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 });
const M_H = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#7799ff', emissiveIntensity: 4 });
const M_R = new THREE.MeshStandardMaterial({ color: '#ff2200', emissive: '#ff2200', emissiveIntensity: 3 });

function BoxCar({ carPosRef, frameIdxRef, frames }: {
  carPosRef: React.RefObject<THREE.Vector3>;
  frameIdxRef: React.RefObject<number>;
  frames: Frame[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lastFi = useRef(-1);

  useFrame(() => {
    const fi = frameIdxRef.current ?? 0;
    if (!groupRef.current || fi === lastFi.current) return;
    lastFi.current = fi;
    const { position, heading } = frames[fi].vehicle;
    const [tx, ty, tz] = d2t(position);
    groupRef.current.position.set(tx, ty, tz);
    groupRef.current.rotation.y = -heading;
  });

  const wheel = (pos: [number, number, number]) => (
    <group key={pos.join()} position={pos}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.34, 0.34, 0.24, 18]} /><primitive object={M_T} attach="material" /></mesh>
    </group>
  );

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.72, 0]}><boxGeometry args={[4.5, 1.44, 1.96]} /><primitive object={M_W} attach="material" /></mesh>
      <mesh position={[-0.22, 1.68, 0]}><boxGeometry args={[2.1, 0.88, 1.82]} /><primitive object={M_W} attach="material" /></mesh>
      <mesh position={[0.84, 1.60, 0]} rotation={[0, 0, -0.52]}><boxGeometry args={[0.06, 0.90, 1.78]} /><primitive object={M_G} attach="material" /></mesh>
      <mesh position={[2.26, 0.70, 0.62]}><boxGeometry args={[0.07, 0.24, 0.40]} /><primitive object={M_H} attach="material" /></mesh>
      <mesh position={[2.26, 0.70, -0.62]}><boxGeometry args={[0.07, 0.24, 0.40]} /><primitive object={M_H} attach="material" /></mesh>
      <mesh position={[-2.26, 0.70, 0.60]}><boxGeometry args={[0.07, 0.20, 0.38]} /><primitive object={M_R} attach="material" /></mesh>
      <mesh position={[-2.26, 0.70, -0.60]}><boxGeometry args={[0.07, 0.20, 0.38]} /><primitive object={M_R} attach="material" /></mesh>
      {wheel([1.48, 0.34, 0.97])}
      {wheel([1.48, 0.34, -0.97])}
      {wheel([-1.48, 0.34, 0.97])}
      {wheel([-1.48, 0.34, -0.97])}
      <pointLight position={[3.0, 0.8, 0]} color="#aabbff" intensity={4} distance={12} decay={2} />
    </group>
  );
}

// ─── Path overlays ────────────────────────────────────────────────────────────
function Paths({ frames, frameIdxRef }: { frames: Frame[]; frameIdxRef: React.RefObject<number> }) {
  const pathRef = useRef<THREE.Line>(null);
  const lastFi = useRef(-1);

  const pathGeo = useMemo(() => new THREE.BufferGeometry(), []);
  const pathMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.8 }), []);

  useFrame(() => {
    const fi = frameIdxRef.current ?? 0;
    if (fi === lastFi.current) return;
    lastFi.current = fi;
    const pts = frames[fi].planned_path.map(p => {
      const [x, y, z] = d2t(p);
      return new THREE.Vector3(x, y + 0.1, z);
    });
    pathGeo.setFromPoints(pts);
  });

  return <primitive object={new THREE.Line(pathGeo, pathMat)} ref={pathRef} />;
}

// ─── Detected Objects 3D (wireframe boxes per detected_object) ───────────────
function DetectedObjects3D({ frames, frameIdxRef }: { frames: Frame[]; frameIdxRef: React.RefObject<number> }) {
  const [fi, setFi] = useState(0);

  useFrame(({ clock }) => {
    if (frameIdxRef.current !== null && frameIdxRef.current !== fi) {
      setFi(frameIdxRef.current);
    }
  });

  return (
    <group>
      {frames[fi]?.detected_objects.map((obj, i) => {
        const [tx, , tz] = d2t(obj.position as [number, number, number]);
        const color = OBJ_TYPE_COLORS[obj.type];

        if (!color) {
          return (
            <Html key={i} position={[tx, 0.75, tz]} center>
              <div className="text-[12px] bg-neutral-900/80 text-white px-2 py-1 rounded whitespace-nowrap border border-red-500/50">
                No Data
              </div>
            </Html>
          );
        }

        const height = obj.size[2] || 1.5;
        const opacity = 0.5 + obj.confidence * 0.5;
        const objClass = getObjectClass(obj.type);
        const badge = objClass === 'static' ? '[S]' : objClass === 'dynamic' ? '[D]' : '';

        return (
          <group key={i} position={[tx, height / 2, tz]} rotation={[0, -obj.heading, 0]}>
            <mesh>
              <boxGeometry args={[obj.size[0], height, obj.size[1]]} />
              <meshBasicMaterial color={color} transparent opacity={opacity * 0.2} depthWrite={false} />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(obj.size[0], height, obj.size[1])]} />
              <lineBasicMaterial color={color} transparent opacity={opacity} />
            </lineSegments>
            <Html position={[0, height / 2 + 0.5, 0]} center>
              <div
                className="text-[12px] bg-(--color-1)/70 px-1 py-0.5 rounded whitespace-nowrap border"
                style={{ color: color, borderColor: color }}
              >
                {badge} {obj.type}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ─── Camera rig (true position-follow) ───────────────────────────────────────
function CameraRig({ frames, frameIdxRef }: { frames: Frame[]; frameIdxRef: React.RefObject<number> }) {
  const ctrlRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const initialized = useRef(false);

  // Pre-allocated vectors to avoid GC pressure
  const _carPos = useRef(new THREE.Vector3());
  const _prevTgt = useRef(new THREE.Vector3());
  const _delta = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!ctrlRef.current) return;
    const fi = frameIdxRef.current ?? 0;
    const vp = frames[fi].vehicle.position;

    _carPos.current.set(vp[0], 0, -vp[1]); // d2t at y=0

    if (!initialized.current) {
      ctrlRef.current.target.copy(_carPos.current);
      camera.position.set(vp[0] - 18, 14, -vp[1] + 16);
      _prevTgt.current.copy(_carPos.current);
      initialized.current = true;
      ctrlRef.current.update();
      return;
    }

    // Save previous target
    _prevTgt.current.copy(ctrlRef.current.target);

    // Lerp target toward car
    ctrlRef.current.target.lerp(_carPos.current, 0.05);

    // Compute how much target actually moved
    _delta.current.subVectors(ctrlRef.current.target, _prevTgt.current);

    // Translate CAMERA by the same delta → maintains orbit offset
    camera.position.add(_delta.current);

    ctrlRef.current.update();
  });

  return (
    <OrbitControls
      ref={ctrlRef}
      enableDamping
      dampingFactor={0.06}
      minDistance={6}
      maxDistance={120}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ data, frameIdxRef }: {
  data: DemoData;
  frameIdxRef: React.RefObject<number>;
}) {
  const carPosRef = useRef(new THREE.Vector3(0.9, 0, 0));

  // Keep carPosRef current every frame
  useFrame(() => {
    const fi = frameIdxRef.current ?? 0;
    const vp = data.frames[fi].vehicle.position;
    carPosRef.current.set(vp[0], vp[2], -vp[1]);
  });

  return (
    <>
      <fog attach="fog" args={['#060b12', 80, 200]} />
      <ambientLight color="#1b2c45" intensity={5} />
      <hemisphereLight color="#3060a0" groundColor="#080c14" intensity={2.5} />
      <directionalLight color="#c0d5ee" intensity={2} position={[30, 50, 20]} castShadow />

      {/* Ground grid */}
      <gridHelper args={[300, 60, '#121e30', '#0e1924']} position={[50, 0, 0]} />

      {/* 50k LiDAR points */}
      <PointCloud
        points={data.static_environment.lidar_points}
        carPosRef={carPosRef}
        frameIdxRef={frameIdxRef}
      />

      {/* Car model – GLB with box fallback */}
      <ErrorBoundary fallback={
        <BoxCar carPosRef={carPosRef} frameIdxRef={frameIdxRef} frames={data.frames} />
      }>
        <Suspense fallback={
          <BoxCar carPosRef={carPosRef} frameIdxRef={frameIdxRef} frames={data.frames} />
        }>
          <CarGLB carPosRef={carPosRef} frameIdxRef={frameIdxRef} frames={data.frames} />
        </Suspense>
      </ErrorBoundary>

      {/* Planned path */}
      <Paths frames={data.frames} frameIdxRef={frameIdxRef} />

      {/* Detected objects — wireframe bounding boxes */}
      <DetectedObjects3D frames={data.frames} frameIdxRef={frameIdxRef} />

      {/* Camera (follows car in world space) */}
      <CameraRig frames={data.frames} frameIdxRef={frameIdxRef} />
    </>
  );
}

// ─── Exported panel (props: data + frameIdxRef) ────────────────────────────────
export default function LidarScene({ data, frameIdxRef }: {
  data: DemoData;
  frameIdxRef: React.RefObject<number>;
}) {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [-18, 14, 16], fov: 55, near: 0.1, far: 500 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      className="w-full h-full bg-(--color-1)"
    >
      <Scene data={data} frameIdxRef={frameIdxRef} />
    </Canvas>
  );
}

// Preload the GLB
useGLTF.preload('/car.glb');
