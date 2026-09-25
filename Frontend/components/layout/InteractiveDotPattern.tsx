'use client';

import { useEffect, useRef } from 'react';

export default function InteractiveDotPattern() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let mouseX = -1000;
    let mouseY = -1000;

    const spacing = 26; // Distance between dots
    const baseRadius = 1.5; // Increased size
    const hoverRadius = 4; // Slightly larger for better effect
    const hoverDistance = 120; // How close the mouse needs to be to affect a dot

    let dotRadii = new Float32Array(0);
    let dotOpacities = new Float32Array(0);
    let cols = 0;
    let rows = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      cols = Math.ceil(width / spacing);
      rows = Math.ceil(height / spacing);
      dotRadii = new Float32Array(cols * rows).fill(baseRadius);
      dotOpacities = new Float32Array(cols * rows).fill(0.2); // Decreased base opacity
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    resize();

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      const isDark = document.documentElement.classList.contains('dark');
      // Use much darker dots in light mode for contrast
      const rgb = isDark ? '255, 255, 255' : '0, 0, 0';

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const index = j * cols + i;
          const cx = i * spacing + spacing / 2;
          const cy = j * spacing + spacing / 2;

          const dx = mouseX - cx;
          const dy = mouseY - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let targetR = baseRadius;
          let targetOpacity = isDark ? 0.2 : 0.4; // Softer base opacity

          if (dist < hoverDistance) {
            // Easing out sine for smoother interaction curve
            const factor = Math.sin((1 - dist / hoverDistance) * (Math.PI / 2));
            targetR = baseRadius + (hoverRadius - baseRadius) * factor;
            targetOpacity = (isDark ? 0.2 : 0.4) + (0.7 - (isDark ? 0.2 : 0.4)) * factor; 
          }

          // Linear interpolation for smooth animation over time
          dotRadii[index] += (targetR - dotRadii[index]) * 0.15;
          dotOpacities[index] += (targetOpacity - dotOpacities[index]) * 0.15;

          ctx.beginPath();
          ctx.arc(cx, cy, dotRadii[index], 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${dotOpacities[index]})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[0]"
    />
  );
}
