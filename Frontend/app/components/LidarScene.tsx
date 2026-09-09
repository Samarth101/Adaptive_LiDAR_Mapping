'use client';

import { Suspense, useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ErrorBoundary } from './ErrorBoundary';
import type { DemoData, Frame, LidarPoint } from '../types/dataset';
import { OBJ_TYPE_COLORS, getObjectClass } from '../lib/foveatedGrid';
import { LIDAR_RGB } from '../lib/classificationData';
import type { FrameData } from '../lib/binaryProtocol';

// ─── Coordinate mapping ───────────────────────────────────────────────────────
function d2t(p: readonly [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

// ─── Point cloud shaders ──────────────────────────────────────────────────────
const VERT = /* glsl */`
  uniform float uIsCell;
  attribute vec4 aColor;
  attribute float aSize;
  varying vec4 vColor;
  varying float vIsCell;

  void main() {
    vColor = aColor;
    vIsCell = uIsCell;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float distance = max(-mv.z, 0.1);
    
    if (uIsCell > 0.5) {
      // In Adaptive Grid mode, physical cell size (aSize in meters: 0.05m near to 0.5m far)
      // scales into visual square tiles on screen so compression is immediately perceptible!
      float meterScale = max(aSize, 0.05) * 340.0;
      float pixelSize = meterScale / (distance + 0.8);
      gl_PointSize = clamp(pixelSize, 4.0, 75.0);
    } else {
      // Raw LiDAR point cloud: small uniform crisp points
      gl_PointSize = clamp(4.2 - distance * 0.018, 1.5, 5.0);
    }

    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  varying vec4 vColor;
  varying float vIsCell;

  void main() {
    if (vIsCell > 0.5) {
      // CRISP SQUARE CELL with distinct bright grid boundary!
      vec2 uv = abs(gl_PointCoord - 0.5);
      float edge = max(uv.x, uv.y);
      if (edge > 0.42) {
        // High-contrast cell border (makes foveated cells instantly visible)
        gl_FragColor = vec4(1.0, 1.0, 1.0, 0.9);
      } else {
        gl_FragColor = vec4(vColor.rgb, 0.95);
      }
    } else {
      // RAW POINT: Soft circular point
      vec2  uv  = gl_PointCoord - 0.5;
      float rsq = dot(uv, uv);
      if (rsq > 0.25) discard;
      float soft = smoothstep(0.25, 0.04, rsq);
      gl_FragColor = vec4(vColor.rgb, vColor.a * soft);
    }
  }
`;

const NEAR_SQ = 15 * 15;
const MID_SQ = 45 * 45;

// CLASS NAMES FOR BACKEND ID MAPPING
const BACKEND_CLASS_NAMES: Record<number, string> = {
  0: "unlabeled", 1: "car", 2: "bicycle", 3: "motorcycle", 4: "truck", 5: "other-vehicle",
  6: "person", 7: "bicyclist", 8: "motorcyclist", 9: "road", 10: "parking", 11: "sidewalk",
  12: "other-ground", 13: "building", 14: "fence", 15: "vegetation", 16: "trunk", 17: "terrain",
  18: "pole", 19: "traffic-sign"
};

// ─── PointCloud ───────────────────────────────────────────────────────────────
function PointCloud({ points, mode, liveFrame, carPosRef, frameIdxRef, visualMode }: {
  points: LidarPoint[];
  mode: 'simulated' | 'live';
  liveFrame: FrameData | null;
  carPosRef: React.RefObject<THREE.Vector3>;
  frameIdxRef: React.RefObject<number>;
  visualMode?: 'raw' | 'cells';
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const isCellMode = visualMode === 'cells';

  // Compute buffers
  const { positions, baseColors, colorBuffer, sizes, count } = useMemo(() => {
    if (mode === 'simulated') {
      // SIMULATED DATA (always raw)
      const n = points.length;
      const positions = new Float32Array(n * 3);
      const baseColors = new Float32Array(n * 4);
      const colorBuffer = new Float32Array(n * 4);
      const sizes = new Float32Array(n).fill(0.0);

      for (let i = 0; i < n; i++) {
        const [tx, ty, tz] = d2t(points[i].position);
        positions[i * 3] = tx;
        positions[i * 3 + 1] = ty;
        positions[i * 3 + 2] = tz;

        const rgb = LIDAR_RGB[points[i].classification];
        const isKnown = !!rgb;
        const actualRgb = rgb ?? [0.5, 0.5, 0.5];

        baseColors[i * 4] = actualRgb[0];
        baseColors[i * 4 + 1] = actualRgb[1];
        baseColors[i * 4 + 2] = actualRgb[2];
        baseColors[i * 4 + 3] = isKnown ? 1.0 : 0.0;

        colorBuffer[i * 4] = actualRgb[0];
        colorBuffer[i * 4 + 1] = actualRgb[1];
        colorBuffer[i * 4 + 2] = actualRgb[2];
        colorBuffer[i * 4 + 3] = isKnown ? 0.9 : 0.0;
      }
      return { positions, baseColors, colorBuffer, sizes, count: n };
    } else {
      // LIVE BACKEND DATA
      if (!liveFrame) {
        return {
          positions: new Float32Array(0), baseColors: new Float32Array(0),
          colorBuffer: new Float32Array(0), sizes: new Float32Array(0), count: 0
        };
      }
      
      const isCells = isCellMode && liveFrame.cell_x && liveFrame.cell_x.length > 0;
      if (!isCells && (!liveFrame.raw_x || liveFrame.raw_x.length === 0)) {
        return {
          positions: new Float32Array(0), baseColors: new Float32Array(0),
          colorBuffer: new Float32Array(0), sizes: new Float32Array(0), count: 0
        };
      }

      const n = isCells ? liveFrame.cell_x.length : liveFrame.raw_x!.length;
      const positions = new Float32Array(n * 3);
      const baseColors = new Float32Array(n * 4);
      const colorBuffer = new Float32Array(n * 4);
      const sizes = new Float32Array(n);

      const xs = isCells ? liveFrame.cell_x : liveFrame.raw_x!;
      const ys = isCells ? liveFrame.cell_y : (liveFrame.raw_y || new Float32Array(n));
      const sems = isCells ? liveFrame.cell_semantic_id : liveFrame.raw_semantic_id!;
      const zs = isCells ? liveFrame.cell_ground_elev : (liveFrame.raw_z || new Float32Array(n));
      const resolutions = isCells ? liveFrame.cell_resolution : null;
      const objHeights = isCells ? liveFrame.cell_object_height : null;

      for (let i = 0; i < n; i++) {
        const px = xs[i];
        const py = ys[i];
        
        // In cells mode, if an obstacle has height > 0.2m, elevate the cell so it's not flat on the road
        let pz = zs[i];
        if (isCells && objHeights && objHeights[i] > 0.25) {
          pz += objHeights[i] * 0.5;
        }

        const [tx, ty, tz] = d2t([px, py, pz]);
        positions[i * 3] = tx;
        positions[i * 3 + 1] = ty;
        positions[i * 3 + 2] = tz;

        sizes[i] = resolutions ? resolutions[i] : 0.0;

        const clsName = BACKEND_CLASS_NAMES[sems[i]] || 'unlabeled';
        const rgb = LIDAR_RGB[clsName];
        const isKnown = !!rgb;
        const actualRgb = rgb ?? [0.5, 0.5, 0.5];

        baseColors[i * 4] = actualRgb[0];
        baseColors[i * 4 + 1] = actualRgb[1];
        baseColors[i * 4 + 2] = actualRgb[2];
        baseColors[i * 4 + 3] = isKnown ? 1.0 : 0.0;

        // Fully visible right from the start
        colorBuffer[i * 4] = actualRgb[0];
        colorBuffer[i * 4 + 1] = actualRgb[1];
        colorBuffer[i * 4 + 2] = actualRgb[2];
        colorBuffer[i * 4 + 3] = isKnown ? 0.95 : 0.0;
      }
      return { positions, baseColors, colorBuffer, sizes, count: n };
    }
  }, [points, mode, liveFrame, isCellMode]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uIsCell: { value: 0.0 }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }), []);

  useEffect(() => {
    if (mat.uniforms.uIsCell) {
      mat.uniforms.uIsCell.value = isCellMode ? 1.0 : 0.0;
    }
  }, [mat, isCellMode]);

  useFrame(() => {
    const geo = geoRef.current;
    const attr = geo?.getAttribute('aColor') as THREE.BufferAttribute | undefined;
    const posAttr = geo?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr || !posAttr) return;
    if (attr.count !== count || posAttr.count !== count || count === 0) return;

    const { x: cx, y: cy, z: cz } = carPosRef.current!;
    const colors = attr.array as Float32Array;

    for (let i = 0; i < count; i++) {
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
        alpha = 0.90 - 0.50 * t;
        bright = 1.00 - 0.30 * t;
      } else {
        const d = Math.sqrt(dSq);
        const t = Math.min((d - 45) / 55, 1.0);
        alpha = Math.max(0.40 - 0.20 * t, 0.15);
        bright = Math.max(0.50 - 0.20 * t, 0.25);
      }

      colors[i4] = baseColors[i4] * bright;
      colors[i4 + 1] = baseColors[i4 + 1] * bright;
      colors[i4 + 2] = baseColors[i4 + 2] * bright;
      colors[i4 + 3] = baseColors[i4 + 3] > 0 ? alpha : 0.0;
    }
    attr.needsUpdate = true;
  });

  return (
    <points
      key={`pc-${mode}-${isCellMode ? 'cell' : 'raw'}-${liveFrame?.frame_id ?? frameIdxRef.current ?? 0}-${count}`}
      frustumCulled={false}
    >
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colorBuffer, 4]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <primitive object={mat} attach="material" />
    </points>
  );
}

// ─── GLTFCar ───────────────────────────────────────────────────
function GLTFCar({ carPosRef, headingRef }: {
  carPosRef: React.RefObject<THREE.Vector3>;
  headingRef: React.RefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/car.glb');

  useFrame(() => {
    if (!groupRef.current || !carPosRef.current) return;
    const { x, y, z } = carPosRef.current;
    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = -(headingRef.current ?? 0) + Math.PI / 2;
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
      <pointLight position={[3.0, 0.8, 0]} color="#aabbff" intensity={4} distance={12} decay={2} />
    </group>
  );
}

useGLTF.preload('/car.glb');

// ─── Detected Objects 3D ───────────────
function DetectedObjects3D({ frames, frameIdxRef, mode, liveFrame }: { 
    frames: Frame[]; 
    frameIdxRef: React.RefObject<number>;
    mode: 'simulated' | 'live';
    liveFrame: FrameData | null;
}) {
  const [fi, setFi] = useState(0);

  useFrame(() => {
    if (mode === 'simulated' && frameIdxRef.current !== null && frameIdxRef.current !== fi) {
      setFi(frameIdxRef.current);
    }
  });

  if (mode === 'simulated') {
      return (
        <group>
          {frames[fi]?.detected_objects.map((obj, i) => {
            const [tx, , tz] = d2t(obj.position as [number, number, number]);
            const color = OBJ_TYPE_COLORS[obj.type] || '#888';
            const height = obj.size[2] || 1.5;
            const opacity = 0.5 + obj.confidence * 0.5;
            const objClass = getObjectClass(obj.type);
            const badge = objClass === 'static' ? '[S]' : objClass === 'dynamic' ? '[D]' : '';
    
            return (
              <group key={i} position={[tx, height / 2, tz]} rotation={[0, -obj.heading, 0]}>
                <mesh>
                  <boxGeometry args={[obj.size[0], height, obj.size[1]]} />
                  <meshBasicMaterial color={color} transparent opacity={opacity * 0.15} depthWrite={false} />
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
  } else {
      if (!liveFrame || !liveFrame.obj_id) return <group />;
      
      const objects = [];
      const count = liveFrame.obj_id.length;
      for (let i = 0; i < count; i++) {
          const typeName = BACKEND_CLASS_NAMES[liveFrame.obj_type![i]] || 'car';
          const color = OBJ_TYPE_COLORS[typeName] || '#888';
          
          // Points are in local space
          const gx = liveFrame.obj_cx![i];
          const gy = liveFrame.obj_cy![i];
          const gz = liveFrame.obj_cz![i];
          
          const [tx, ty, tz] = d2t([gx, gy, gz]);
          const w = liveFrame.obj_w![i];
          const l = liveFrame.obj_l![i];
          const h = liveFrame.obj_h![i];
          const heading = liveFrame.obj_heading![i];
          const opacity = 0.5 + liveFrame.obj_conf![i] * 0.5;
          const objClass = getObjectClass(typeName);
          const badge = objClass === 'static' ? '[S]' : objClass === 'dynamic' ? '[D]' : '';

          objects.push(
              <group key={i} position={[tx, ty, tz]} rotation={[0, -heading, 0]}>
                <mesh>
                  <boxGeometry args={[l, h, w]} />
                  <meshBasicMaterial color={color} transparent opacity={opacity * 0.15} depthWrite={false} />
                </mesh>
                <lineSegments>
                  <edgesGeometry args={[new THREE.BoxGeometry(l, h, w)]} />
                  <lineBasicMaterial color={color} transparent opacity={opacity} />
                </lineSegments>
                <Html position={[0, h / 2 + 0.5, 0]} center>
                  <div
                    className="text-[12px] bg-(--color-1)/70 px-1 py-0.5 rounded whitespace-nowrap border"
                    style={{ color: color, borderColor: color }}
                  >
                    {badge} {typeName}
                  </div>
                </Html>
              </group>
          );
      }
      return <group>{objects}</group>;
  }
}

// ─── Camera rig ───────────────────────────────────────
function CameraRig({ carPosRef }: { carPosRef: React.RefObject<THREE.Vector3> }) {
  const ctrlRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const initialized = useRef(false);

  const _prevTgt = useRef(new THREE.Vector3());
  const _delta = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!ctrlRef.current || !carPosRef.current) return;
    
    if (!initialized.current) {
      ctrlRef.current.target.copy(carPosRef.current);
      camera.position.set(carPosRef.current.x - 18, 14, carPosRef.current.z + 16);
      _prevTgt.current.copy(carPosRef.current);
      initialized.current = true;
      ctrlRef.current.update();
      return;
    }

    _prevTgt.current.copy(ctrlRef.current.target);
    ctrlRef.current.target.lerp(carPosRef.current, 0.05);
    _delta.current.subVectors(ctrlRef.current.target, _prevTgt.current);
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
function Scene({ data, frameIdxRef, mode, liveFrame, visualMode }: {
  data: DemoData;
  frameIdxRef: React.RefObject<number>;
  mode: 'simulated' | 'live';
  liveFrame: FrameData | null;
  visualMode?: 'raw' | 'cells';
}) {
  const carPosRef = useRef(new THREE.Vector3(0.9, 0, 0));
  const headingRef = useRef(0);

  // Keep carPosRef current every frame
  useFrame(() => {
    if (mode === 'simulated') {
        const fi = frameIdxRef.current ?? 0;
        const vp = data.frames[fi].vehicle.position;
        carPosRef.current.set(vp[0], vp[2], -vp[1]);
        headingRef.current = data.frames[fi].vehicle.heading;
    } else if (liveFrame) {
        // LiDAR sensor is ~1.73m above ground. Ground points are at Z ≈ -1.73.
        // d2t maps Z to Y in Three.js. Car should sit on the ground plane.
        const sensorHeight = -1.73; // Z of ground in sensor frame
        const [tx, ty, tz] = d2t([0, 0, sensorHeight] as [number, number, number]);
        carPosRef.current.set(tx, ty, tz);
        headingRef.current = liveFrame.ego_heading;
    }
  });

  return (
    <>
      <fog attach="fog" args={['#060b12', 80, 200]} />
      <ambientLight color="#1b2c45" intensity={5} />
      <hemisphereLight color="#3060a0" groundColor="#080c14" intensity={2.5} />
      <directionalLight color="#c0d5ee" intensity={2} position={[30, 50, 20]} castShadow />

      {/* Ground grid */}
      <gridHelper args={[300, 60, '#121e30', '#0e1924']} position={[50, 0, 0]} />

      <PointCloud
        points={data.static_environment.lidar_points}
        carPosRef={carPosRef}
        frameIdxRef={frameIdxRef}
        mode={mode}
        liveFrame={liveFrame}
        visualMode={visualMode}
      />

      <GLTFCar carPosRef={carPosRef} headingRef={headingRef} />

      {/* Detected objects */}
      <DetectedObjects3D frames={data.frames} frameIdxRef={frameIdxRef} mode={mode} liveFrame={liveFrame} />

      {/* Camera */}
      <CameraRig carPosRef={carPosRef} />
    </>
  );
}

export default function LidarScene({ data, frameIdxRef, mode, liveFrame, visualMode }: {
  data: DemoData;
  frameIdxRef: React.RefObject<number>;
  mode: 'simulated' | 'live';
  liveFrame: FrameData | null;
  visualMode?: 'raw' | 'cells';
}) {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [-18, 14, 16], fov: 55, near: 0.1, far: 500 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      className="w-full h-full bg-(--color-1)"
    >
      <Suspense fallback={null}>
        <Scene data={data} frameIdxRef={frameIdxRef} mode={mode} liveFrame={liveFrame} visualMode={visualMode} />
      </Suspense>
    </Canvas>
  );
}
