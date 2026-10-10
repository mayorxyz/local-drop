import { useState, useCallback, useRef } from 'react';
import { PeerConnection, ConnectionState } from '../lib/peer';
import { createAnswerPayload, decodePayload, parseFrame, reassembleFrames, QRFrame } from '../lib/signaling';
import { QRShow } from '../components/QRShow';
import { QRScan } from '../components/QRScan';
import { PasteCode } from '../components/PasteCode';

interface ReceiveProps {
  onConnected: (channel: RTCDataChannel) => void;
  onBack: () => void;
}

export function Receive({ onConnected, onBack }: ReceiveProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [state, setState] = useState<ConnectionState>('new');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const peerRef = useRef<PeerConnection | null>(null);
  const collectedFrames = useRef<Map<number, QRFrame>>(new Map());
  const offerSdpRef = useRef<string>('');

  const handleScanOfferFrame = useCallback((frame: QRFrame) => {
    collectedFrames.current.set(frame.index, frame);

    if (collectedFrames.current.size >= frame.total) {
      const encoded = reassembleFrames(Array.from(collectedFrames.current.values()));
      if (encoded) {
        try {
          const payload = decodePayload(encoded);
          if (payload.t === 'offer') {
            offerSdpRef.current = payload.sdp;
            startAnswer(payload.sdp);
          }
        } catch (err: any) {
          setError(`Failed to decode offer: ${err.message}`);
        }
      }
    }
  }, []);

  const startAnswer = async (offerSdp: string) => {
    setError('');
    const peer = new PeerConnection({
      onStateChange: setState,
      onDataChannel: (channel) => {
        // Wait for channel to open
        const checkOpen = setInterval(() => {
          if (channel.readyState === 'open') {
            clearInterval(checkOpen);
            onConnected(channel);
          }
        }, 100);
        setTimeout(() => clearInterval(checkOpen), 15000);
      },
      onError: (err) => setError(err.message),
      onConnectionStateChange: () => {},
    });
    peerRef.current = peer;

    try {
      const answerSdp = await peer.createAnswer(offerSdp);
      const encoded = createAnswerPayload(answerSdp);
      setQrData(encoded);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePasteCode = useCallback((code: string) => {
    try {
      const payload = decodePayload(code);
      if (payload.t === 'offer') {
        offerSdpRef.current = payload.sdp;
        startAnswer(payload.sdp);
      }
    } catch (err: any) {
      setError(`Invalid code: ${err.message}`);
    }
  }, []);

  const handleReconnect = () => {
    if (peerRef.current) {
      peerRef.current.close();
    }
    collectedFrames.current.clear();
    setQrData('');
    setStep(1);
    setError('');
    setState('new');
  };

  return (
    <div className="flex flex-col items-center min-h-[100dvh] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-md mb-6">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-200 transition-colors">
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-slate-200">Receive Files</h2>
        <div className="w-10" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${step === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
          <span>1</span>
          <span>Scan offer</span>
        </div>
        <div className="w-4 h-px bg-slate-600" />
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${step === 2 ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
          <span>2</span>
          <span>Show answer</span>
        </div>
      </div>

      {/* Connection state */}
      <div className="mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          state === 'connected' ? 'bg-green-900/50 text-green-300' :
          state === 'connecting' ? 'bg-yellow-900/50 text-yellow-300' :
          state === 'failed' ? 'bg-red-900/50 text-red-300' :
          'bg-slate-800 text-slate-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            state === 'connected' ? 'bg-green-400' :
            state === 'connecting' ? 'bg-yellow-400 animate-pulse' :
            state === 'failed' ? 'bg-red-400' :
            'bg-slate-500'
          }`} />
          {state === 'connected' ? 'Connected' :
           state === 'connecting' ? 'Connecting...' :
           state === 'failed' ? 'Failed' :
           state === 'disconnected' ? 'Disconnected' :
           'Waiting for offer'}
        </span>
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

      {/* Step 1: Scan offer QR */}
      {step === 1 && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <QRScan
            onFrame={handleScanOfferFrame}
            onProgress={(received, total) => {}}
            onError={(err) => setError(err)}
          />
          <div className="w-full border-t border-slate-700 pt-4">
            <PasteCode
              onSubmit={handlePasteCode}
              label="Or paste the offer code from the sending device"
            />
          </div>
        </div>
      )}

      {/* Step 2: Show answer QR */}
      {step === 2 && qrData && (
        <div className="flex flex-col items-center gap-4">
          <QRShow data={qrData} label="Show this QR to the sending device" />
          <PasteCode codeToCopy={qrData} label="Or copy this code" onSubmit={() => {}} />
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
