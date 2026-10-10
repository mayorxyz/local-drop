import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { parseFrame, QRFrame } from '../lib/signaling';

interface QRScanProps {
  onFrame: (frame: QRFrame) => void;
  onProgress?: (received: number, total: number) => void;
  expectedTotal?: number;
  onError?: (error: string) => void;
}

interface ScannerStatus {
  camera: 'initializing' | 'ok' | 'error';
  resolution: string;
  decoder: 'BarcodeDetector' | 'jsQR' | 'none';
  scans: number;
  lastScan: 'none' | 'partial' | 'ok';
  frames: string;
  error?: string;
}

type Decoder =
  | { kind: 'barcode-detector'; detector: any }
  | { kind: 'jsqr' }
  | { kind: 'none' };

const MAX_JSQr_WIDTH = 1024;
const FRAME_INTERVAL_MS = 100; // ~10 fps
const FALLBACK_AFTER_FAILURES = 20;

export function QRScan({ onFrame, onProgress, onError }: QRScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jsqrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const decoderRef = useRef<Decoder>({ kind: 'none' });
  const collectedFrames = useRef<Map<number, QRFrame>>(new Map());
  const lastScanRef = useRef<string>('');
  const scanCountRef = useRef(0);
  const consecutiveFailRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  const onProgressRef = useRef(onProgress);

  // Keep callbacks fresh without re-creating the loop
  useEffect(() => {
    onFrameRef.current = onFrame;
    onProgressRef.current = onProgress;
  }, [onFrame, onProgress]);

  const [status, setStatus] = useState<ScannerStatus>({
    camera: 'initializing',
    resolution: '...',
    decoder: 'none',
    scans: 0,
    lastScan: 'none',
    frames: '0/0',
  });
  const [permissionDenied, setPermissionDenied] = useState(false);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (mountedRef.current) {
      timerRef.current = setTimeout(runLoop, FRAME_INTERVAL_MS);
    }
  }, []);

  const processScan = useCallback((data: string) => {
    if (data === lastScanRef.current) return;
    lastScanRef.current = data;
    scanCountRef.current++;
    consecutiveFailRef.current = 0;

    const frame = parseFrame(data);
    if (frame) {
      collectedFrames.current.set(frame.index, frame);
      onFrameRef.current(frame);
      onProgressRef.current?.(collectedFrames.current.size, frame.total);

      setStatus(prev => ({
        ...prev,
        scans: scanCountRef.current,
        lastScan: 'ok',
        frames: `${collectedFrames.current.size}/${frame.total}`,
      }));
    } else {
      setStatus(prev => ({
        ...prev,
        scans: scanCountRef.current,
        lastScan: 'partial',
      }));
    }
  }, []);

  /**
   * Run a single scan iteration. Always schedules the next frame,
   * even if this iteration throws.
   */
  const runIteration = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const decoder = decoderRef.current;

    if (!mountedRef.current) return;
    if (!video || !canvas) {
      scheduleNext();
      return;
    }
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      scheduleNext();
      return;
    }
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      scheduleNext();
      return;
    }

    try {
      // Draw full frame to main canvas (used by BarcodeDetector)
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (decoder.kind === 'barcode-detector') {
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            scheduleNext();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const barcodes: any[] = await decoder.detector.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            processScan(barcodes[0].rawValue);
            scheduleNext();
            return;
          }

          // No detection - count failure
          consecutiveFailRef.current++;

          // After N consecutive failures, also try jsQR on this frame
          if (consecutiveFailRef.current >= FALLBACK_AFTER_FAILURES) {
            const found = tryJsqr(video, canvas);
            if (found) {
              processScan(found);
              scheduleNext();
              return;
            }
          }

          scheduleNext();
        } catch (err) {
          console.warn('[QRScan] BarcodeDetector detect error:', err);
          consecutiveFailRef.current++;

          // Try jsQR as immediate fallback
          const found = tryJsqr(video, canvas);
          if (found) {
            processScan(found);
          }
          scheduleNext();
        }
      } else if (decoder.kind === 'jsqr') {
        const found = tryJsqr(video, canvas);
        if (found) {
          processScan(found);
        } else {
          consecutiveFailRef.current++;
        }
        scheduleNext();
      } else {
        // No decoder available
        scheduleNext();
      }
    } catch (err) {
      console.error('[QRScan] Iteration error:', err);
      scheduleNext();
    }
  }, [processScan, scheduleNext]);

  // Assign to a stable name for scheduleNext
  const runLoop = runIteration;

  /**
   * Run jsQR on the video frame, downscaling to max 1024px wide.
   * Uses a separate canvas with willReadFrequently: true.
   */
  const tryJsqr = (video: HTMLVideoElement, _mainCanvas: HTMLCanvasElement): string | null => {
    // Lazily create jsQR canvas
    if (!jsqrCanvasRef.current) {
      jsqrCanvasRef.current = document.createElement('canvas');
    }
    const jsqrCanvas = jsqrCanvasRef.current;
    const ctx = jsqrCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Downscale to max 1024 wide
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > MAX_JSQr_WIDTH) {
      const scale = MAX_JSQr_WIDTH / w;
      w = MAX_JSQr_WIDTH;
      h = Math.round(h * scale);
    }
    jsqrCanvas.width = w;
    jsqrCanvas.height = h;

    try {
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      return code ? code.data : null;
    } catch (err) {
      console.warn('[QRScan] jsQR error:', err);
      return null;
    }
  };

  const stopScanner = useCallback(() => {
    console.log('[QRScan] Stopping scanner');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  /**
   * Decide the decoder ONCE on mount.
   * Use BarcodeDetector only if available AND supports qr_code.
   * Otherwise use jsQR.
   */
  const decideDecoder = useCallback(async (): Promise<Decoder> => {
    if ('BarcodeDetector' in window) {
      try {
        const BD = (window as any).BarcodeDetector;
        const formats: string[] = await BD.getSupportedFormats();
        if (formats && formats.includes('qr_code')) {
          const detector = new BD({ formats: ['qr_code'] });
          console.log('[QRScan] Decoder chosen: BarcodeDetector');
          return { kind: 'barcode-detector', detector };
        }
      } catch (err) {
        console.warn('[QRScan] BarcodeDetector init failed:', err);
      }
    }
    console.log('[QRScan] Decoder chosen: jsQR');
    return { kind: 'jsqr' };
  }, []);

  const startScanner = useCallback(async () => {
    if (startingRef.current || streamRef.current) {
      console.log('[QRScan] Already starting or started, skipping');
      return;
    }

    startingRef.current = true;

    try {
      console.log('[QRScan] Starting scanner');
      setPermissionDenied(false);

      // Decide decoder first (in parallel with camera)
      const decoder = await decideDecoder();
      decoderRef.current = decoder;
      setStatus(prev => ({
        ...prev,
        decoder: decoder.kind === 'barcode-detector' ? 'BarcodeDetector' : decoder.kind === 'jsqr' ? 'jsQR' : 'none',
      }));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        startingRef.current = false;
        return;
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        startingRef.current = false;
        return;
      }

      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('muted', 'true');
      videoRef.current.setAttribute('autoplay', 'true');

      await videoRef.current.play();

      // Wait for metadata
      await new Promise<void>((resolve) => {
        const v = videoRef.current;
        if (!v) {
          resolve();
          return;
        }
        if (v.videoWidth > 0) {
          resolve();
          return;
        }
        const onMeta = () => {
          v.removeEventListener('loadedmetadata', onMeta);
          resolve();
        };
        v.addEventListener('loadedmetadata', onMeta);
      });

      if (videoRef.current && videoRef.current.videoWidth > 0) {
        setStatus(prev => ({
          ...prev,
          camera: 'ok',
          resolution: `${videoRef.current!.videoWidth}x${videoRef.current!.videoHeight}`,
        }));
        startingRef.current = false;
        console.log('[QRScan] Scanner started successfully');
        // Start the loop
        runIteration();
      } else {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        startingRef.current = false;
        setStatus(prev => ({
          ...prev,
          camera: 'error',
          error: 'Video metadata not available',
        }));
      }
    } catch (err: any) {
      console.error('[QRScan] Error starting scanner:', err);
      startingRef.current = false;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setStatus(prev => ({
          ...prev,
          camera: 'error',
          error: 'Camera permission denied',
        }));
        onError?.('Camera permission denied. Please use the "Paste code" option below.');
      } else {
        setStatus(prev => ({
          ...prev,
          camera: 'error',
          error: err.message,
        }));
        onError?.(`Camera error: ${err.message}`);
      }
    }
  }, [decideDecoder, onError, runIteration]);

  useEffect(() => {
    console.log('[QRScan] Component mounted');
    mountedRef.current = true;
    startScanner();

    return () => {
      console.log('[QRScan] Component unmounting');
      mountedRef.current = false;
      stopScanner();
      // Clean up jsQR canvas
      jsqrCanvasRef.current = null;
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
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />
            {status.camera === 'ok' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-indigo-400/50 rounded-lg animate-pulse" />
              </div>
            )}
          </div>

          {/* Status line */}
          <div className="text-xs text-slate-400 text-center font-mono">
            Camera: {status.camera === 'ok' ? 'OK' : status.camera} {status.resolution} |
            decoder: {status.decoder} |
            scans: {status.scans} |
            last: {status.lastScan} |
            frames: {status.frames}
          </div>

          {status.error && (
            <div className="text-xs text-red-400 text-center">
              Error: {status.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
