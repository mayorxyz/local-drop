import { useState, useCallback, useRef, useEffect } from 'react';
import { PeerConnection, ConnectionState } from '../lib/peer';
import { createAnswerPayload, decodePayload, rebuildSDP, parseFrame, reassembleFrames, QRFrame, logICEGathering, logSDPDetails } from '../lib/signaling';
import { getDeviceName } from '../lib/storage';
import { QRShow } from '../components/QRShow';
import { QRScan } from '../components/QRScan';
import { Card, BtnAcid, BtnGhost, Badge, Tabs, IconArrowLeft, IconCopy, IconRefresh } from '../components/ui';

interface ReceiveProps {
  onConnected: (channel: RTCDataChannel, peerDeviceName?: string) => void;
  onBack: () => void;
}

export function Receive({ onConnected, onBack }: ReceiveProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [state, setState] = useState<ConnectionState>('new');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasteCode, setPasteCode] = useState('');
  const [qrRendered, setQrRendered] = useState(false);
  const peerRef = useRef<PeerConnection | null>(null);
  const collectedFrames = useRef<Map<number, QRFrame>>(new Map());
  const offerSdpRef = useRef<string>('');

  const handleScanOfferFrame = useCallback((frame: QRFrame) => {
    console.log('[Receive] Received frame', frame.index + 1, 'of', frame.total);
    collectedFrames.current.set(frame.index, frame);

    if (collectedFrames.current.size >= frame.total) {
      console.log('[Receive] All frames received, reassembling');
      const encoded = reassembleFrames(Array.from(collectedFrames.current.values()));
      if (encoded) {
        try {
          const descriptor = decodePayload(encoded);
          if (descriptor.t === 'o') {
            console.log('[Receive] Decoded offer descriptor, rebuilding SDP');
            const sdp = rebuildSDP(descriptor);
            startAnswer(sdp);
          }
        } catch (err: any) {
          setError(`Failed to decode offer: ${err.message}`);
        }
      }
    }
  }, []);

  const startAnswer = async (offerSdp: string) => {
    setError('');
    offerSdpRef.current = offerSdp;
    
    console.log('[Receive] Creating answer (Receive = answerer)');
    
    // Request camera permission in parallel with 1500ms timeout for real IPs
    const cameraPromise = (async () => {
      try {
        console.log('[Receive] Requesting camera permission to expose real IPs');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        console.log('[Receive] Camera permission granted, real IPs should be exposed');
      } catch (err: any) {
        console.warn('[Receive] Camera permission denied, will use mDNS:', err.message);
      }
    })();
    
    // Don't await camera - let it run in parallel with 1500ms timeout
    Promise.race([
      cameraPromise,
      new Promise(resolve => setTimeout(resolve, 1500))
    ]).catch(() => {});
    
    const peer = new PeerConnection({
      onStateChange: setState,
      onDataChannel: (channel) => {
        console.log('[Receive] Data channel received');
        const checkOpen = setInterval(() => {
          if (channel.readyState === 'open') {
            clearInterval(checkOpen);
            console.log('[Receive] Data channel open, exchanging device names');
            
            const deviceName = getDeviceName();
            let peerDeviceName = '';
            
            const handleMessage = (event: MessageEvent) => {
              try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'hello' && msg.deviceName) {
                  peerDeviceName = msg.deviceName;
                  channel.send(JSON.stringify({ type: 'hello-response', deviceName }));
                  channel.removeEventListener('message', handleMessage);
                  onConnected(channel, peerDeviceName);
                }
              } catch (e) {}
            };
            
            channel.addEventListener('message', handleMessage);
            
            setTimeout(() => {
              channel.removeEventListener('message', handleMessage);
              onConnected(channel, peerDeviceName || 'Unknown');
            }, 3000);
          }
        }, 100);
        setTimeout(() => clearInterval(checkOpen), 15000);
      },
      onError: (err) => setError(err.message),
      onConnectionStateChange: () => {},
    });
    peerRef.current = peer;

    try {
      logICEGathering(peer.peerConnection, 'Receive-Answer');
      
      const answerSdp = await peer.createAnswer(offerSdp);
      
      console.log('[Receive] Answer SDP created');
      logSDPDetails(answerSdp, 'Receive-Answer-Raw');
      
      const encoded = createAnswerPayload(answerSdp);
      
      console.log('[Receive] Answer encoded, length:', encoded.length);
      
      setQrData(encoded);
      setQrRendered(true);
      setStep(2);
      console.log('[Receive] QR rendered:', true);
    } catch (err: any) {
      console.error('[Receive] Error creating answer:', err);
      setError(err.message);
      setQrRendered(false);
      console.log('[Receive] QR rendered:', false);
    }
  };

  const handlePasteCode = useCallback((code: string) => {
    try {
      const descriptor = decodePayload(code);
      if (descriptor.t === 'o') {
        const sdp = rebuildSDP(descriptor);
        startAnswer(sdp);
      }
    } catch (err: any) {
      setError(`Invalid code: ${err.message}`);
    }
  }, []);

  const handleCopy = async () => {
    if (!qrData) return;
    try {
      await navigator.clipboard.writeText(qrData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = qrData;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReconnect = () => {
    if (peerRef.current) {
      peerRef.current.close();
    }
    collectedFrames.current.clear();
    setQrData('');
    setStep(1);
    setError('');
    setState('new');
    setQrRendered(false);
  };

  const statusBadge = () => {
    const statusMap = {
      'new': { label: 'Waiting', status: 'idle' as const },
      'connecting': { label: 'Connecting', status: 'warning' as const },
      'connected': { label: 'Connected', status: 'success' as const },
      'disconnected': { label: 'Disconnected', status: 'error' as const },
      'failed': { label: 'Failed', status: 'error' as const },
      'closed': { label: 'Closed', status: 'idle' as const },
    };
    const { label, status } = statusMap[state];
    return <Badge status={status}>{label}</Badge>;
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="btn-ghost btn-ghost-small"
            style={{ padding: '10px' }}
          >
            <IconArrowLeft />
          </button>
          <div className="flex items-center gap-2">
            <Badge>{getDeviceName()}</Badge>
            {statusBadge()}
          </div>
        </div>

        <h2 className="mb-3">Receive Files</h2>

        {/* Main Card */}
        <Card className="mb-3">
          {/* Step Tabs */}
          <div className="mb-3">
            <Tabs
              tabs={[
                { id: '1', label: '1. Scan QR' },
                { id: '2', label: '2. Show this QR' },
              ]}
              active={String(step)}
              onChange={() => {}}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <p style={{ fontSize: '14px', color: '#EF4444', marginBottom: '8px' }}>{error}</p>
              {state === 'failed' && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Both devices must be on the same hotspot. Disable client isolation.
                </p>
              )}
            </div>
          )}

          {/* Step 1: Scan Offer */}
          {step === 1 && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted text-center" style={{ fontSize: '14px', marginBottom: '16px' }}>
                Scan the QR code from the sending device
              </p>
              <QRScan
                onFrame={handleScanOfferFrame}
                onError={(err) => setError(err)}
              />
              <div style={{ width: '100%', marginTop: '24px' }}>
                <p className="text-muted text-center" style={{ fontSize: '13px', marginBottom: '12px' }}>
                  Or paste the offer code
                </p>
                <textarea
                  value={pasteCode}
                  onChange={(e) => setPasteCode(e.target.value)}
                  placeholder="Paste code here..."
                  className="input"
                  style={{ fontSize: '12px', fontFamily: 'monospace', minHeight: '80px' }}
                />
                <div className="flex gap-2 mt-2">
                  <BtnAcid small onClick={() => handlePasteCode(pasteCode)} disabled={!pasteCode.trim()} style={{ flex: 1 }}>
                    Submit
                  </BtnAcid>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Show Answer QR */}
          {step === 2 && (
            <div className="flex flex-col items-center gap-3">
              {qrData ? (
                <>
                  <p className="text-muted text-center" style={{ fontSize: '14px', marginBottom: '16px' }}>
                    Show this QR code to the sending device
                  </p>
                  <div className="qr-container">
                    <QRShow payload={qrData} />
                  </div>
                  {/* Debug info */}
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px' }}>
                    Payload: {qrData.length} chars
                  </div>
                  <div style={{ width: '100%', marginTop: '24px' }}>
                    <p className="text-muted text-center" style={{ fontSize: '13px', marginBottom: '12px' }}>
                      Or copy and paste this code
                    </p>
                    <textarea
                      value={qrData}
                      readOnly
                      className="input"
                      style={{ fontSize: '12px', fontFamily: 'monospace', minHeight: '80px' }}
                    />
                    <div className="flex gap-2 mt-2">
                      <BtnGhost small onClick={handleCopy} style={{ flex: 1 }}>
                        <IconCopy />
                        {copied ? 'Copied' : 'Copy code'}
                      </BtnGhost>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <p className="text-muted">Error generating QR code</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '8px' }}>
                    Use the paste code option below
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Reconnect */}
        {state === 'failed' && (
          <BtnGhost onClick={handleReconnect} style={{ width: '100%' }}>
            <IconRefresh />
            Reconnect
          </BtnGhost>
        )}
      </div>
    </div>
  );
}
