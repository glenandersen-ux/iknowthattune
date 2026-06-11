import { useEffect, useRef } from 'react';

export interface WaveformVisualizerProps {
  /** Returns the latest time-domain samples from `AudioEngine.getWaveformData()`. */
  getData: () => Uint8Array;
  /** Whether playback is active; pauses the draw loop when false. */
  isActive: boolean;
}

/** Canvas-based waveform pulse driven by an `AnalyserNode`, with no external charting library. */
export function WaveformVisualizer({ getData, isActive }: WaveformVisualizerProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive) return;

    let frameId: number | undefined;

    const draw = (): void => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const data = getData();
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        const sliceWidth = canvas.width / Math.max(data.length, 1);
        data.forEach((value, i) => {
          const x = i * sliceWidth;
          const y = (value / 255) * canvas.height;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (typeof requestAnimationFrame !== 'undefined') {
        frameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (frameId !== undefined && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isActive, getData]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={60}
      className="w-full h-15"
      data-testid="waveform-canvas"
    />
  );
}
