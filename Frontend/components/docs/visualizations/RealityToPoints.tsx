'use client';

import { useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import * as THREE from 'three';
import { useDocsAnimation } from '@/components/docs/DocsAnimationContext';

// Component to load and render the point cloud
function PointCloud({ url }: { url: string }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        // KITTI .bin files have 4 float32 per point: [x, y, z, reflectance]
        const data = new Float32Array(buffer);
        const numPoints = data.length / 4;
        const positions = new Float32Array(numPoints * 3);
        const colors = new Float32Array(numPoints * 3);

        for (let i = 0; i < numPoints; i++) {
          const x = data[i * 4 + 0];
          const y = data[i * 4 + 1];
          const z = data[i * 4 + 2];
          const intensity = data[i * 4 + 3];

          // Correctly map KITTI (Z-up) to Three.js (Y-up) so the map lies flat
          positions[i * 3 + 0] = -y; // Three.js X = -KITTI Y (left)
          positions[i * 3 + 1] = z;  // Three.js Y = KITTI Z (up)
          positions[i * 3 + 2] = -x; // Three.js Z = -KITTI X (forward)

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
    <points geometry={geometry}>
      <pointsMaterial size={0.05} vertexColors={true} transparent opacity={0.8} />
    </points>
  );
}

export default function RealityToPoints() {
  const { isPaused } = useDocsAnimation();

  return (
    <div className="flex-1 rounded-4xl overflow-hidden relative">
      <div className="absolute inset-0 border">
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

          {/* Point Cloud View */}
          <PointCloud url="/explorer-assets/n008-2018-08-01-15-16-36-0400__LIDAR_TOP__1533151603547590.pcd.bin" />

        </Canvas>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 bg-radial from-transparent from-25% to-primary/10 to-100% backdrop-blur-xs border rounded-4xl p-4 flex justify-between items-center">
        <div>
          <div className="font-normal text-primary">
            3D Point Cloud Representation
          </div>
          <div className="text-muted-foreground text-sm mt-1">
            LiDAR receives thousands of laser returns measured as [x, y, z, intensity] coordinates. This unstructured data is what our perception pipeline must interpret.
          </div>
        </div>
      </div>
    </div>
  );
}
