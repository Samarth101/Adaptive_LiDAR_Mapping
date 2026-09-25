'use client';

import dynamic from 'next/dynamic';

// WebGL component — must be client-side only
const LidarViewer = dynamic(() => import('@/components/lidar/LidarViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen w-screen">
      <div className='text-foreground'>Initialising dashboard…</div>
    </div>
  ),
});

export default function HomePage() {
  return <LidarViewer />;
}
