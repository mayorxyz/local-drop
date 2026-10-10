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
        try {
          QRCode.toCanvas(canvasRef.current, frameToString(frames[0]), {
            width: 300,
            margin: 4,
            errorCorrectionLevel: 'L',
            color: { dark: '#000000', light: '#FFFFFF' },
          });
        } catch (err) {
          console.error('[QRShow] Error rendering QR:', err);
        }
      }
      return;
    }

    // Multi-frame cycling (only as fallback when > 500 chars)
    let idx = 0;
    const renderFrame = () => {
      if (canvasRef.current && frames[idx]) {
        try {
          QRCode.toCanvas(canvasRef.current, frameToString(frames[idx]), {
            width: 300,
            margin: 4,
            errorCorrectionLevel: 'L',
            color: { dark: '#000000', light: '#FFFFFF' },
          });
          setCurrentFrame(idx);
        } catch (err) {
          console.error('[QRShow] Error rendering frame', idx, ':', err);
        }
      }
      idx = (idx + 1) % frames.length;
    };

    renderFrame();
    intervalRef.current = setInterval(renderFrame, 333); // 3 fps

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [frames]);

  if (!payload) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ 
        background: '#FFFFFF', 
        padding: '16px', 
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <canvas ref={canvasRef} />
      </div>
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
