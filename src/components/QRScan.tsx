import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { parseFrame, QRFrame } from '../lib/signaling';

interface QRScanProps {
  onFrame: (frame: QRFrame) => void;
  onProgress?: (received: number, total: number) => void;
  expectedTotal?: number;
  onError?: (error: string) => void;
}

export function QRScan({ onFrame, onProgress, onError }: QRScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const collectedFrames = useRef<Map<number, QRFrame>>(new Map());
  const lastScanRef = useRef<string>('');

  const stopScanner = useCallback(() => {
    console.log('[QRScan] Stopping scanner');
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    // Guard against double-start (StrictMode, rapid re-renders)
    if (startingRef.current || streamRef.current) {
      console.log('[QRScan] Already starting or started, skipping');
      return;
    }
    
    startingRef.current = true;
    
    try {
      console.log('[QRScan] Starting scanner');
      setPermissionDenied(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      
      // Check if component is still mounted
      if (!mountedRef.current) {
        console.log('[QRScan] Component unmounted during getUserMedia, stopping stream');
        stream.getTracks().forEach(t => t.stop());
        startingRef.current = false;
        return;
      }
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        startingRef.current = false;
        console.log('[QRScan] Scanner started successfully');
        scanLoop();
      } else {
        console.log('[QRScan] Video ref not available, stopping stream');
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        startingRef.current = false;
      }
    } catch (err: any) {
      console.error('[QRScan] Error starting scanner:', err);
      startingRef.current = false;
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        onError?.('Camera permission denied. Please use the "Paste code" option below.');
      } else {
        onError?.(`Camera error: ${err.message}`);
      }
    }
  }, [onError]);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if component is still mounted
    if (!mountedRef.current) {
      console.log('[QRScan] Component unmounted, stopping scan loop');
      return;
    }
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try BarcodeDetector first
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      detector.detectFromCanvas(canvas).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          processScan(barcodes[0].rawValue);
        }
        if (mountedRef.current) {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }
      }).catch(() => {
        // Fallback to jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          processScan(code.data);
        }
        if (mountedRef.current) {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }
      });
    } else {
      // Use jsQR
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        processScan(code.data);
      }
      if (mountedRef.current) {
        animFrameRef.current = requestAnimationFrame(scanLoop);
      }
    }
  }, []);

  const processScan = (data: string) => {
    if (data === lastScanRef.current) return;
    lastScanRef.current = data;

    const frame = parseFrame(data);
    if (frame) {
      collectedFrames.current.set(frame.index, frame);
      onFrame(frame);
      onProgress?.(collectedFrames.current.size, frame.total);
    }
  };

  useEffect(() => {
    console.log('[QRScan] Component mounted');
    mountedRef.current = true;
    startScanner();
    
    return () => {
      console.log('[QRScan] Component unmounting');
      mountedRef.current = false;
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="flex flex-col items-center gap-3">
      {permissionDenied ? (
        <div className="text-center p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <p className="text-red-300 text-sm mb-2">📷 Camera access denied</p>
          <p className="text-slate-400 text-xs">Use the "Paste code" option below to connect manually.</p>
        </div>
      ) : (
        <>
          <div className="relative w-full max-w-[320px] aspect-square bg-slate-900 rounded-lg overflow-hidden border-2 border-slate-700">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-indigo-400/50 rounded-lg animate-pulse" />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Point camera at the QR code on the other device
          </p>
        </>
      )}
    </div>
  );
}
