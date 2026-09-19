'use client';

import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import type { Frame } from '@/types/dataset';

// WebGL component — must be client-side only
const LidarViewer = dynamic(() => import('@/components/lidar/LidarViewer'), {
  ssr: false,
  loading: () => (
    <div className="viewer-loading">
      <div className="loading-spinner" />
      <p>Initialising dashboard…</p>
    </div>
  ),
});

export default function HomePage() {
  const handleFrameChange = useCallback((frame: Frame) => {
    // Top-level frame tracking if needed, otherwise handled inside LidarViewer
  }, []);

  return (
    <main className="viewer-page">
      <LidarViewer onFrameChange={handleFrameChange} />
    </main>
  );
}
