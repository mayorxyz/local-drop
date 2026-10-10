import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QRFrame, frameToString, createFrames } from '../lib/signaling';

interface QRShowProps {
  payload: string;
}

export function QRShow({ payload }: QRShowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<QRFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const f = createFrames(payload);
    setFrames(f);
    setCurrentFrame(0);
  }, [payload]);

  useEffect(() => {
    if (frames.length <= 1) {
      if (canvasRef.current && frames.length === 1) {
        QRCode.toCanvas(canvasRef.current, frameToString(frames[0]), {
          width: 280,
          margin: 1,
          color: { dark: '#111111', light: '#FFFFFF' },
        });
      }
      return;
    }

    let idx = 0;
    const renderFrame = () => {
      if (canvasRef.current && frames[idx]) {
        QRCode.toCanvas(canvasRef.current, frameToString(frames[idx]), {
          width: 280,
          margin: 1,
          color: { dark: '#111111', light: '#FFFFFF' },
        });
        setCurrentFrame(idx);
      }
      idx = (idx + 1) % frames.length;
    };

    renderFrame();
    intervalRef.current = setInterval(renderFrame, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [frames]);

  if (!payload) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <canvas ref={canvasRef} />
      {frames.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>Frame {currentFrame + 1} / {frames.length}</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            {frames.map((_, i) => (
              <div
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: i === currentFrame ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
