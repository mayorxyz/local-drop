import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QRFrame, frameToString, createFrames } from '../lib/signaling';

interface QRShowProps {
  data: string;
  label?: string;
}

export function QRShow({ data, label }: QRShowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<QRFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const f = createFrames(data);
    setFrames(f);
    setCurrentFrame(0);
  }, [data]);

  useEffect(() => {
    if (frames.length <= 1) {
      // Single frame - render directly
      if (canvasRef.current && frames.length === 1) {
        QRCode.toCanvas(canvasRef.current, frameToString(frames[0]), {
          width: 280,
          margin: 2,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
      }
      return;
    }

    // Multi-frame: cycle at 2fps
    let idx = 0;
    const renderFrame = () => {
      if (canvasRef.current && frames[idx]) {
        QRCode.toCanvas(canvasRef.current, frameToString(frames[idx]), {
          width: 280,
          margin: 2,
          color: { dark: '#1e293b', light: '#ffffff' },
        });
        setCurrentFrame(idx);
      }
      idx = (idx + 1) % frames.length;
    };

    renderFrame();
    intervalRef.current = setInterval(renderFrame, 500); // 2 fps

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [frames]);

  if (!data) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <p className="text-sm text-slate-400">{label}</p>}
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <canvas ref={canvasRef} />
      </div>
      {frames.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Frame {currentFrame + 1} / {frames.length}</span>
          <div className="flex gap-0.5">
            {frames.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === currentFrame ? 'bg-indigo-500' : 'bg-slate-600'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
