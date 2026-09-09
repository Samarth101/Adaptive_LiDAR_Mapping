'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

type RepMode = '3D' | '2D' | '2.5D';

function PointCloudAnimated({ url, mode }: { url: string, mode: RepMode }) {
  const [pointsData, setPointsData] = useState<{ positions: Float32Array, colors: Float32Array } | null>(null);
  const pointsRef = useRef<THREE.Points>(null);

  useEffect(() => {
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(buffer => {
        const data = new Float32Array(buffer);
        const numPoints = Math.min(data.length / 5, 20000); // downsample for smooth animation
        const positions = new Float32Array(numPoints * 3);
        const colors = new Float32Array(numPoints * 3);

        for (let i = 0; i < numPoints; i++) {
          positions[i * 3 + 0] = data[i * 5 + 0];
          positions[i * 3 + 1] = data[i * 5 + 1];
          positions[i * 3 + 2] = data[i * 5 + 2];
          
          const z = data[i * 5 + 2];
          // simple height coloring
          const h = (z + 2) / 5;
          colors[i * 3 + 0] = h; // R
          colors[i * 3 + 1] = 0.5; // G
          colors[i * 3 + 2] = 1 - h; // B
        }
        setPointsData({ positions, colors });
      });
  }, [url]);

  useFrame(() => {
    if (pointsRef.current) {
      const targetZ = mode === '3D' ? 1 : (mode === '2D' ? 0.01 : 1);
      pointsRef.current.scale.z = THREE.MathUtils.lerp(pointsRef.current.scale.z, targetZ, 0.1);
    }
  });

  if (!pointsData) return null;

  return (
    <points ref={pointsRef} visible={mode === '3D' || mode === '2D'}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={pointsData.positions.length / 3} array={pointsData.positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={pointsData.colors.length / 3} array={pointsData.colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.15} vertexColors transparent opacity={0.7} />
    </points>
  );
}

// Simple 2.5D grid representation simulation
function Grid25D({ mode }: { mode: RepMode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      const targetY = mode === '2.5D' ? 1 : 0.001;
      groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetY, 0.1);
      groupRef.current.visible = groupRef.current.scale.y > 0.05 || mode === '2.5D';
    }
  });

  const gridCells = useMemo(() => {
    const cells = [];
    for (let x = -15; x < 15; x += 2) {
      for (let y = -15; y < 15; y += 2) {
        if (Math.random() > 0.6) {
          const height = Math.random() * 3 + 0.5;
          cells.push({ position: [x, height / 2, y] as [number, number, number], height });
        }
      }
    }
    return cells;
  }, []);

  return (
    <group ref={groupRef}>
      {gridCells.map((cell, i) => (
        <mesh key={i} position={[cell.position[0], cell.position[1], cell.position[2]]}>
          <boxGeometry args={[1.9, cell.height, 1.9]} />
          <meshStandardMaterial color="#06b6d4" transparent opacity={0.6} wireframe />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[32, 32, 16, 16]} />
        <meshStandardMaterial color="#1e293b" wireframe />
      </mesh>
    </group>
  );
}

export default function RepresentationCompare() {
  const [mode, setMode] = useState<RepMode>('3D');

  return (
    <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative shadow-2xl flex flex-col">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex bg-slate-950 p-1 rounded-full border border-slate-800">
        <button 
          onClick={() => setMode('3D')}
          className={`px-6 py-2 rounded-full font-bold transition-all text-sm ${
            mode === '3D' ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'text-slate-400 hover:text-white'
          }`}
        >
          3D Point Cloud
        </button>
        <button 
          onClick={() => setMode('2D')}
          className={`px-6 py-2 rounded-full font-bold transition-all text-sm ${
            mode === '2D' ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'text-slate-400 hover:text-white'
          }`}
        >
          2D Flattened Grid
        </button>
        <button 
          onClick={() => setMode('2.5D')}
          className={`px-6 py-2 rounded-full font-bold transition-all text-sm ${
            mode === '2.5D' ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'text-slate-400 hover:text-white'
          }`}
        >
          2.5D Adaptive Map
        </button>
      </div>

      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 15, 20], fov: 50 }}>
          <color attach="background" args={['#020617']} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={true}
            autoRotateSpeed={0.5}
            target={[0, 0, 0]}
          />
          
          <gridHelper args={[40, 40, '#334155', '#0f172a']} position={[0, -2, 0]} />

          {/* Render the point cloud for 3D/2D views (Z gets squashed for 2D via react-spring) */}
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <PointCloudAnimated url="/explorer_assests/n008-2018-08-01-15-16-36-0400__LIDAR_TOP__1533151603547590.pcd.bin" mode={mode} />
          </group>

          {/* Render the 2.5D grid representation */}
          <Grid25D mode={mode} />
        </Canvas>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-lg">
        <h3 className="text-xl font-bold text-cyan-400">
          {mode === '3D' && 'Rich but Computationally Expensive'}
          {mode === '2D' && 'Computationally Simple but Loses Crucial Data'}
          {mode === '2.5D' && 'The Best of Both Worlds'}
        </h3>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl">
          {mode === '3D' && 'A full 3D point cloud retains exact height and structure for every single point. But processing 100,000+ points continuously in 3D requires heavy 3D voxel convolutions (like Cylinder3D), draining memory and power.'}
          {mode === '2D' && 'If we project everything down to a flat 2D occupancy grid, we gain immense computational speed. However, we completely lose height data. Is that a wall, or just a speed bump? Is it an overhanging tree branch, or a pedestrian? 2D cannot tell.'}
          {mode === '2.5D' && 'Our 2.5D approach stores spatial data in a 2D grid format (fast processing), but each cell explicitly stores the terrain elevation and object height. We retain the safety-critical height information of 3D, with the computational efficiency of 2D.'}
        </p>
      </div>
    </div>
  );
}
