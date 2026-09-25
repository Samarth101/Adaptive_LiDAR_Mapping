'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import * as THREE from 'three';
import { useDocsAnimation } from '@/components/docs/DocsAnimationContext';

type RepMode = '3D' | '2D' | '2.5D';

function PointCloudAnimated({ url, mode, isPaused }: { url: string, mode: RepMode, isPaused: boolean }) {
  const [pointsData, setPointsData] = useState<{
    positions3D: Float32Array,
    positionsFlat: Float32Array,
    colors3D: Float32Array,
    colors25D: Float32Array,
    numPoints: number
  } | null>(null);

  const pointsRef = useRef<THREE.Points>(null);
  const currentMorph = useRef(0);

  useEffect(() => {
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(buffer => {
        const data = new Float32Array(buffer);
        const numPoints = Math.min(data.length / 4, 30000); // downsample a bit for performance
        const positions3D = new Float32Array(numPoints * 3);
        const positionsFlat = new Float32Array(numPoints * 3);
        const colors3D = new Float32Array(numPoints * 3);
        const colors25D = new Float32Array(numPoints * 3);

        for (let i = 0; i < numPoints; i++) {
          const x = data[i * 4 + 0];
          const y = data[i * 4 + 1];
          const z = data[i * 4 + 2];
          const intensity = data[i * 4 + 3];

          const px = -y;
          const py = z;
          const pz = -x;

          positions3D[i * 3 + 0] = px;
          positions3D[i * 3 + 1] = py;
          positions3D[i * 3 + 2] = pz;

          // Flat positions for 2D and 2.5D
          positionsFlat[i * 3 + 0] = px; // Drop straight down, don't cluster
          positionsFlat[i * 3 + 1] = -2; // Ground level
          positionsFlat[i * 3 + 2] = pz; // Drop straight down, don't cluster

          // 3D/2D Colors: Cyan intensity coloring
          const colorVal = Math.min(1.0, intensity / 100);
          colors3D[i * 3 + 0] = 0.2 + colorVal * 0.2; // R
          colors3D[i * 3 + 1] = 0.6 + colorVal * 0.4; // G
          colors3D[i * 3 + 2] = 0.8 + colorVal * 0.2; // B

          // 2.5D Colors: Heightmap coloring based on ORIGINAL height
          const heightNorm = Math.max(0, Math.min(1, (py + 2) / 5));
          colors25D[i * 3 + 0] = heightNorm;
          colors25D[i * 3 + 1] = 1 - Math.abs(heightNorm - 0.5) * 2;
          colors25D[i * 3 + 2] = 1 - heightNorm;
        }
        setPointsData({ positions3D, positionsFlat, colors3D, colors25D, numPoints });
      });
  }, [url]);

  useEffect(() => {
    if (!pointsRef.current || !pointsData) return;
    const geo = pointsRef.current.geometry;

    // Swap colors to show Heightmap in 2.5D
    if (mode === '2.5D') {
      geo.setAttribute('color', new THREE.BufferAttribute(pointsData.colors25D, 3));
    } else {
      geo.setAttribute('color', new THREE.BufferAttribute(pointsData.colors3D, 3));
    }
    geo.attributes.color.needsUpdate = true;
  }, [mode, pointsData]);

  useFrame(() => {
    if (!pointsRef.current || !pointsData) return;

    // Morph positions dynamically between 3D and Flat (for both 2D and 2.5D)
    // 3D mode = 0 (use positions3D)
    // 2D and 2.5D mode = 1 (use positionsFlat)
    const targetMorph = mode === '3D' ? 0 : 1;
    currentMorph.current = THREE.MathUtils.lerp(currentMorph.current, targetMorph, 0.15);

    if (Math.abs(currentMorph.current - targetMorph) > 0.001) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const { positions3D, positionsFlat, numPoints } = pointsData;
      const morph = currentMorph.current;

      for (let i = 0; i < numPoints * 3; i++) {
        positions[i] = positions3D[i] + (positionsFlat[i] - positions3D[i]) * morph;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Make points chunky in 2D and 2.5D to look like a grid/map
    const targetSize = mode === '3D' ? 0.08 : 0.2;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.size = THREE.MathUtils.lerp(mat.size, targetSize, 0.1);
  });

  if (!pointsData) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(pointsData.positions3D), 3]} />
        <bufferAttribute attach="attributes-color" args={[pointsData.colors3D, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors transparent opacity={0.8} />
    </points>
  );
}

export default function RepresentationCompare() {
  const [mode, setMode] = useState<RepMode>('3D');
  const { isPaused } = useDocsAnimation();

  return (
    <div className="flex-1 rounded-4xl overflow-hidden relative flex flex-col">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex p-1 bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-xs rounded-full border">
        <button
          onClick={() => setMode('3D')}
          className={`px-6 py-2 rounded-full transition-all text-sm text-nowrap ${mode === '3D' ? 'bg-radial from-primary/80 from-10% to-primary to-100% text-primary-foreground' : 'text-foreground/80'
            }`}
        >
          3D Point Cloud
        </button>
        <button
          onClick={() => setMode('2D')}
          className={`px-6 py-2 rounded-full transition-all text-sm text-nowrap ${mode === '2D' ? 'bg-radial from-primary/80 from-10% to-primary to-100% text-primary-foreground' : 'text-foreground/80'
            }`}
        >
          2D Flattened Grid
        </button>
        <button
          onClick={() => setMode('2.5D')}
          className={`px-6 py-2 rounded-full transition-all text-sm text-nowrap ${mode === '2.5D' ? 'bg-radial from-primary/80 from-10% to-primary to-100% text-primary-foreground' : 'text-foreground/80'
            }`}
        >
          2.5D Adaptive Map
        </button>
      </div>

      <div className="absolute inset-0 border rounded-4xl overflow-hidden">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 12, 35], fov: 45 }}>
          <color attach="background" args={['#1a1a1a']} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <MapControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={!isPaused}
            autoRotateSpeed={0.5}
            target={[0, 0, 0]}
          />

          <gridHelper args={[200, 100, '#4d4d4d', '#2b2b2b']} position={[0, -2, 0]} />

          <PointCloudAnimated url="/explorer-assets/n008-2018-08-01-15-16-36-0400__LIDAR_TOP__1533151603547590.pcd.bin" mode={mode} isPaused={isPaused} />
        </Canvas>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-xs border border-border p-4 rounded-4xl flex justify-between items-center pointer-events-none">
        <div>
          <div className="font-normal text-primary">
            {mode === '3D' && 'Rich but Computationally Expensive'}
            {mode === '2D' && 'Computationally Simple but Loses Crucial Data'}
            {mode === '2.5D' && 'The Best of Both Worlds'}
          </div>
          <div className="text-muted-foreground text-sm mt-1 max-w-3xl">
            {mode === '3D' && 'A full 3D point cloud retains exact height and structure for every single point. But processing 100,000+ points continuously in 3D requires heavy 3D voxel convolutions (like Cylinder3D), draining memory and power.'}
            {mode === '2D' && 'If we project everything down to a flat 2D occupancy grid, we gain immense computational speed. However, we completely lose height data. Is that a wall, or just a speed bump? Is it an overhanging tree branch, or a pedestrian? 2D cannot tell.'}
            {mode === '2.5D' && 'Our 2.5D approach stores spatial data in a 2D grid format (fast processing), but each cell explicitly stores the terrain elevation and object height. We retain the safety-critical height information of 3D, with the computational efficiency of 2D.'}
          </div>
        </div>
      </div>
    </div>
  );
}
