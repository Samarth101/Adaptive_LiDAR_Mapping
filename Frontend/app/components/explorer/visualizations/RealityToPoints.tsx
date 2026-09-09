'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

// 1. Component to load a GLTF model
function Model({ path, position, rotation, scale }: { path: string, position: [number, number, number], rotation: [number, number, number], scale: number }) {
  const { scene } = useGLTF(path);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clonedScene} position={position} rotation={rotation} scale={scale} />;
}

// 2. Component to load and render the point cloud
function PointCloud({ url, visible }: { url: string, visible: boolean }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        // nuScenes .bin files have 5 float32 per point: [x, y, z, intensity, ring_index]
        const data = new Float32Array(buffer);
        const numPoints = data.length / 5;
        const positions = new Float32Array(numPoints * 3);
        const colors = new Float32Array(numPoints * 3);

        for (let i = 0; i < numPoints; i++) {
          const x = data[i * 5 + 0];
          const y = data[i * 5 + 1];
          const z = data[i * 5 + 2];
          const intensity = data[i * 5 + 3];

          positions[i * 3 + 0] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = z;

          // Simple intensity coloring (cyan-ish)
          const colorVal = Math.min(1.0, intensity / 100);
          colors[i * 3 + 0] = 0.2 + colorVal * 0.2; // R
          colors[i * 3 + 1] = 0.6 + colorVal * 0.4; // G
          colors[i * 3 + 2] = 0.8 + colorVal * 0.2; // B
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        setGeometry(geo);
      })
      .catch((err) => console.error("Error loading point cloud:", err));
  }, [url]);

  if (!geometry) return null;

  return (
    <points geometry={geometry} visible={visible}>
      <pointsMaterial size={0.05} vertexColors={true} transparent opacity={0.8} />
    </points>
  );
}

export default function RealityToPoints() {
  const [showPoints, setShowPoints] = useState(false);

  return (
    <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative shadow-2xl flex flex-col">
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={() => setShowPoints(!showPoints)}
          className={`px-6 py-2 rounded-full font-bold transition-all duration-300 ${
            showPoints 
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]' 
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
          }`}
        >
          {showPoints ? 'Return to Reality' : 'Reveal what LiDAR sees →'}
        </button>
      </div>

      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 10, 25], fov: 45 }}>
          <color attach="background" args={['#020617']} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={!showPoints}
            autoRotateSpeed={0.5}
            target={[0, 0, 0]}
          />

          <group visible={!showPoints}>
            {/* Ground Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
              <planeGeometry args={[100, 100]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            
            <gridHelper args={[100, 20, '#334155', '#0f172a']} position={[0, -0.99, 0]} />

            {/* Ego Vehicle (basic_car) in center */}
            <Model 
              path="/explorer_assests/basic_car.glb" 
              position={[0, -1, 0]} 
              rotation={[0, Math.PI / 2, 0]} 
              scale={1} 
            />

            {/* Surrounding environment objects */}
            <Model path="/explorer_assests/tree.glb" position={[8, -1, -5]} rotation={[0, 0, 0]} scale={2} />
            <Model path="/explorer_assests/tree.glb" position={[-10, -1, 4]} rotation={[0, 1, 0]} scale={1.8} />
            
            <Model path="/explorer_assests/person.glb" position={[4, -1, 6]} rotation={[0, -Math.PI / 4, 0]} scale={1} />
            
            <Model path="/explorer_assests/motorcycle.glb" position={[-6, -1, -8]} rotation={[0, Math.PI / 3, 0]} scale={1} />
            <Model path="/explorer_assests/auto.glb" position={[12, -1, 10]} rotation={[0, -Math.PI / 6, 0]} scale={1} />
            <Model path="/explorer_assests/bicycle.glb" position={[-3, -1, 12]} rotation={[0, Math.PI / 2, 0]} scale={1} />
          </group>

          {/* Point Cloud View */}
          <PointCloud 
            url="/explorer_assests/n008-2018-08-01-15-16-36-0400__LIDAR_TOP__1533151603547590.pcd.bin" 
            visible={showPoints} 
          />

        </Canvas>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-lg flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-cyan-400">
            {showPoints ? '3D Point Cloud Representation' : 'The Real World'}
          </h3>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            {showPoints 
              ? 'LiDAR does not "see" cars or trees. It receives thousands of laser returns measured as [x, y, z, intensity] coordinates. This unstructured data is what our perception pipeline must interpret.'
              : 'Autonomous vehicles operate in complex, unstructured real-world environments filled with dynamic obstacles, pedestrians, and irregular terrain.'}
          </p>
        </div>
      </div>
    </div>
  );
}
