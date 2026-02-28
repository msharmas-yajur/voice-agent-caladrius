import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  active: boolean;
  audioData?: Uint8Array;
}

export const Visualizer: React.FC<VisualizerProps> = ({ active, audioData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Gradient Line
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(0.5, '#a855f7');
      gradient.addColorStop(1, '#ec4899');
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const bufferLength = audioData ? audioData.length : 64;
      const sliceWidth = width * 1.0 / bufferLength;
      let x = 0;

      if (active && audioData) {
        for (let i = 0; i < bufferLength; i++) {
          const v = audioData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }
      } else {
        // Flat line idle state
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [active, audioData]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={100} 
      className="w-full h-24 bg-slate-900/50 rounded-lg border border-slate-700 shadow-inner"
    />
  );
};