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
  scans: number;
  lastScan: 'none' | 'partial' | 'ok';
  frames: string;
  error?: string;
}

export function QRScan({ onFrame, onProgress, onError }: QRScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const mountedRef = useRef(false);
  const startingRef = useRef(false);
  const collectedFrames = useRef<Map<number, QRFrame>>(new Map());
  const lastScanRef = useRef<string>('');
  const scanCountRef = useRef(0);
  const [status, setStatus] = useState<ScannerStatus>({
    camera: 'initializing',
    resolution: '...',
    scans: 0,
    lastScan: 'none',
    frames: '0/0',
  });
  const [permissionDenied, setPermissionDenied] = useState(false);

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
  }, []);

  const processScan = useCallback((data: string) => {
    if (data === lastScanRef.current) return;
    lastScanRef.current = data;
    scanCountRef.current++;

    const frame = parseFrame(data);
    if (frame) {
      collectedFrames.current.set(frame.index, frame);
      onFrame(frame);
      onProgress?.(collectedFrames.current.size, frame.total);
      
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
  }, [onFrame, onProgress]);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!mountedRef.current) {
      console.log('[QRScan] Component unmounted, stopping scan loop');
      return;
    }
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Try BarcodeDetector first if available
      if ('BarcodeDetector' in window) {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        BarcodeDetectorClass.getSupportedFormats().then((formats: string[]) => {
          if (formats.includes('qr_code')) {
            const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
            detector.detectFromCanvas(canvas).then((barcodes: any[]) => {
              if (barcodes.length > 0) {
                processScan(barcodes[0].rawValue);
              }
              if (mountedRef.current) {
                setTimeout(() => {
                  animFrameRef.current = requestAnimationFrame(scanLoop);
                }, 100); // ~10 fps
              }
            }).catch(() => {
              // Fallback to jsQR
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth',
              });
              if (code) {
                processScan(code.data);
              }
              if (mountedRef.current) {
                setTimeout(() => {
                  animFrameRef.current = requestAnimationFrame(scanLoop);
                }, 100);
              }
            });
          } else {
            // BarcodeDetector doesn't support QR, use jsQR
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code) {
              processScan(code.data);
            }
            if (mountedRef.current) {
              setTimeout(() => {
                animFrameRef.current = requestAnimationFrame(scanLoop);
              }, 100);
            }
          }
        }).catch(() => {
          // Fallback to jsQR
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code) {
            processScan(code.data);
          }
          if (mountedRef.current) {
            setTimeout(() => {
              animFrameRef.current = requestAnimationFrame(scanLoop);
            }, 100);
          }
        });
      } else {
        // Use jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code) {
          processScan(code.data);
        }
        if (mountedRef.current) {
          setTimeout(() => {
            animFrameRef.current = requestAnimationFrame(scanLoop);
          }, 100); // ~10 fps
        }
      }
    } catch (err) {
      console.error('[QRScan] Error in scan loop:', err);
      if (mountedRef.current) {
        setTimeout(() => {
          animFrameRef.current = requestAnimationFrame(scanLoop);
        }, 100);
      }
    }
  }, [processScan]);

  const startScanner = useCallback(async () => {
    if (startingRef.current || streamRef.current) {
      console.log('[QRScan] Already starting or started, skipping');
      return;
    }
    
    startingRef.current = true;
    
    try {
      console.log('[QRScan] Starting scanner');
      setPermissionDenied(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
      if (!mountedRef.current) {
        console.log('[QRScan] Component unmounted during getUserMedia, stopping stream');
        stream.getTracks().forEach(t => t.stop());
        startingRef.current = false;
        return;
      }
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        
        await videoRef.current.play();
        
        // Wait for metadata to load
        await new Promise<void>((resolve) => {
          if (videoRef.current && videoRef.current.videoWidth > 0) {
            resolve();
          } else if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
          } else {
            resolve();
          }
        });
        
        if (videoRef.current && videoRef.current.videoWidth > 0) {
          setStatus(prev => ({
            ...prev,
            camera: 'ok',
            resolution: `${videoRef.current!.videoWidth}x${videoRef.current!.videoHeight}`,
          }));
          startingRef.current = false;
          console.log('[QRScan] Scanner started successfully');
          scanLoop();
        } else {
          console.log('[QRScan] Video metadata not available');
          stream.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          startingRef.current = false;
          setStatus(prev => ({
            ...prev,
            camera: 'error',
            error: 'Video metadata not available',
          }));
        }
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
  }, [onError, scanLoop]);

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
