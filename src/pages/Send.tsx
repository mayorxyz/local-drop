import { useState, useCallback, useRef, useEffect } from 'react';
import { PeerConnection, ConnectionState } from '../lib/peer';
import { createOfferPayload, createAnswerPayload, decodePayload, encodePayload, parseFrame, reassembleFrames, QRFrame } from '../lib/signaling';
import { getDeviceName } from '../lib/storage';
import { QRShow } from '../components/QRShow';
import { QRScan } from '../components/QRScan';
import { PasteCode } from '../components/PasteCode';
import { DeviceBadge } from '../components/DeviceBadge';
import { StatusBar } from '../components/StatusBar';

interface SendProps {
  onConnected: (channel: RTCDataChannel, peerDeviceName?: string) => void;
  onBack: () => void;
}

export function Send({ onConnected, onBack }: SendProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [state, setState] = useState<ConnectionState>('new');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const peerRef = useRef<PeerConnection | null>(null);
  const collectedFrames = useRef<Map<number, QRFrame>>(new Map());
  const expectedTotal = useRef(1);

  const startAsSender = useCallback(async () => {
    setError('');
    const peer = new PeerConnection({
      onStateChange: setState,
      onDataChannel: () => {},
      onError: (err) => setError(err.message),
      onConnectionStateChange: () => {},
    });
    peerRef.current = peer;

    try {
      const sdp = await peer.createOffer();
      const encoded = createOfferPayload(sdp);
      setQrData(encoded);
      setStep(2); // Now waiting to scan answer
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const handleScanFrame = useCallback((frame: QRFrame) => {
    collectedFrames.current.set(frame.index, frame);
    expectedTotal.current = frame.total;

    if (collectedFrames.current.size >= frame.total) {
      const encoded = reassembleFrames(Array.from(collectedFrames.current.values()));
      if (encoded) {
        try {
          const payload = decodePayload(encoded);
          if (payload.t === 'answer' && peerRef.current) {
            peerRef.current.setRemoteAnswer(payload.sdp).then(() => {
              // Wait for connection
              const checkConnection = setInterval(() => {
                const ch = peerRef.current?.getDataChannel();
                if (ch && ch.readyState === 'open') {
                  clearInterval(checkConnection);
                  
                  // Set up device name exchange
                  const deviceName = getDeviceName();
                  let peerDeviceName = '';
                  
                  const handleMessage = (event: MessageEvent) => {
                    try {
                      const msg = JSON.parse(event.data);
                      if (msg.type === 'hello' && msg.deviceName) {
                        peerDeviceName = msg.deviceName;
                        // Send our device name
                        ch.send(JSON.stringify({ type: 'hello-response', deviceName }));
                        ch.removeEventListener('message', handleMessage);
                        onConnected(ch, peerDeviceName);
                      }
                    } catch (e) {
                      // Ignore non-JSON messages
                    }
                  };
                  
                  ch.addEventListener('message', handleMessage);
                  
                  // Send hello with our device name
                  ch.send(JSON.stringify({ type: 'hello', deviceName }));
                  
                  // Timeout for device name exchange
                  setTimeout(() => {
                    ch.removeEventListener('message', handleMessage);
                    // Even if no response, proceed with connection
                    onConnected(ch, peerDeviceName || 'Unknown');
                  }, 3000);
                }
              }, 100);
              
              // Timeout after 10s
              setTimeout(() => {
                clearInterval(checkConnection);
                if (!peerRef.current?.getDataChannel() || peerRef.current.getDataChannel()?.readyState !== 'open') {
                  setError('Connection timed out. Make sure both devices are on the same network.');
                }
              }, 10000);
            }).catch((err: Error) => setError(err.message));
          }
        } catch (err: any) {
          setError(`Failed to decode answer: ${err.message}`);
        }
      }
    }
  }, [onConnected]);

  const handlePasteCode = useCallback((code: string) => {
    try {
      const payload = decodePayload(code);
      if (payload.t === 'answer' && peerRef.current) {
        peerRef.current.setRemoteAnswer(payload.sdp).then(() => {
          const checkConnection = setInterval(() => {
            const ch = peerRef.current?.getDataChannel();
            if (ch && ch.readyState === 'open') {
              clearInterval(checkConnection);
              
              // Set up device name exchange
              const deviceName = getDeviceName();
              let peerDeviceName = '';
              
              const handleMessage = (event: MessageEvent) => {
                try {
                  const msg = JSON.parse(event.data);
                  if (msg.type === 'hello' && msg.deviceName) {
                    peerDeviceName = msg.deviceName;
                    ch.send(JSON.stringify({ type: 'hello-response', deviceName }));
                    ch.removeEventListener('message', handleMessage);
                    onConnected(ch, peerDeviceName);
                  }
                } catch (e) {
                  // Ignore non-JSON messages
                }
              };
              
              ch.addEventListener('message', handleMessage);
              ch.send(JSON.stringify({ type: 'hello', deviceName }));
              
              setTimeout(() => {
                ch.removeEventListener('message', handleMessage);
                onConnected(ch, peerDeviceName || 'Unknown');
              }, 3000);
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkConnection);
          }, 10000);
        }).catch((err: Error) => setError(err.message));
      }
    } catch (err: any) {
      setError(`Invalid code: ${err.message}`);
    }
  }, [onConnected]);

  const handleReconnect = () => {
    if (peerRef.current) {
      peerRef.current.close();
    }
    collectedFrames.current.clear();
    setQrData('');
    setStep(1);
    setError('');
    setState('new');
    startAsSender();
  };

  // Initialize on mount
  useEffect(() => {
    startAsSender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center min-h-[100dvh] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-md mb-4">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
          ← Back
        </button>
        <DeviceBadge editable={false} />
      </div>

      <h2 className="text-lg font-semibold text-slate-200 mb-4">Send Files</h2>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
          <span>1</span>
          <span>Show offer</span>
        </div>
        <div className="w-4 h-px bg-slate-600" />
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
          <span>2</span>
          <span>Scan answer</span>
        </div>
      </div>

      {/* Connection state */}
      <div className="mb-4">
        <StatusBar state={state} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg max-w-md w-full">
          <p className="text-sm text-red-300">{error}</p>
          {state === 'failed' && (
            <p className="text-xs text-red-400 mt-1">
              💡 Both devices must be on the same hotspot. Disable client isolation / AP isolation.
            </p>
          )}
        </div>
      )}

      {/* Step 1: Show QR offer */}
      {step === 1 && qrData && (
        <div className="flex flex-col items-center gap-4">
          <QRShow data={qrData} label="Show this QR to the receiving device" />
          <PasteCode codeToCopy={qrData} label="Or copy this code" onSubmit={() => {}} />
        </div>
      )}

      {/* Step 2: Scan answer QR */}
      {step === 2 && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <QRScan
            onFrame={handleScanFrame}
            onProgress={(received, total) => {
              // Could show progress indicator
            }}
            onError={(err) => setError(err)}
          />
          <div className="w-full border-t border-slate-700 pt-4">
            <PasteCode
              onSubmit={handlePasteCode}
              label="Or paste the answer code from the other device"
            />
          </div>
        </div>
      )}

      {/* Reconnect */}
      {state === 'failed' && (
        <button
          onClick={handleReconnect}
          className="mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          🔄 Reconnect
        </button>
      )}
    </div>
  );
}
