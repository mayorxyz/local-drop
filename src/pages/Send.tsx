import { useState, useCallback, useRef, useEffect } from 'react';
import { PeerConnection, ConnectionState } from '../lib/peer';
import { createOfferPayload, createAnswerPayload, decodePayload, parseFrame, reassembleFrames, QRFrame, logICEGathering, logSDPDetails } from '../lib/signaling';
import { getDeviceName } from '../lib/storage';
import { QRShow } from '../components/QRShow';
import { QRScan } from '../components/QRScan';
import { Card, BtnAcid, BtnGhost, Badge, Tabs, IconArrowLeft, IconCopy, IconRefresh } from '../components/ui';

interface SendProps {
  onConnected: (channel: RTCDataChannel, peerDeviceName?: string) => void;
  onBack: () => void;
}

export function Send({ onConnected, onBack }: SendProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [state, setState] = useState<ConnectionState>('new');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasteCode, setPasteCode] = useState('');
  const [qrRendered, setQrRendered] = useState(false);
  const peerRef = useRef<PeerConnection | null>(null);
  const collectedFrames = useRef<Map<number, QRFrame>>(new Map());

  // Create offer immediately on mount (Send = offerer)
  useEffect(() => {
    const createOffer = async () => {
      console.log('[Send] Creating offer (Send = offerer)');
      
      // Request camera permission in parallel with 1500ms timeout for real IPs
      const cameraPromise = (async () => {
        try {
          console.log('[Send] Requesting camera permission to expose real IPs');
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          console.log('[Send] Camera permission granted, real IPs should be exposed');
        } catch (err: any) {
          console.warn('[Send] Camera permission denied, will use mDNS:', err.message);
        }
      })();
      
      // Don't await camera - let it run in parallel with 1500ms timeout
      Promise.race([
        cameraPromise,
        new Promise(resolve => setTimeout(resolve, 1500))
      ]).catch(() => {});
      
      const peer = new PeerConnection({
        onStateChange: setState,
        onDataChannel: () => {}, // Offerer creates the channel
        onError: (err) => setError(err.message),
        onConnectionStateChange: () => {},
      });
      peerRef.current = peer;

      try {
        logICEGathering(peer.peerConnection, 'Send-Offer');
        
        const sdp = await peer.createOffer();
        
        console.log('[Send] Offer SDP created');
        logSDPDetails(sdp, 'Send-Offer-Raw');
        
        const encoded = createOfferPayload(sdp);
        
        console.log('[Send] Offer encoded, length:', encoded.length);
        
        setQrData(encoded);
        setQrRendered(true);
        console.log('[Send] QR rendered:', true);
      } catch (err: any) {
        console.error('[Send] Error creating offer:', err);
        setError(err.message);
        setQrRendered(false);
        console.log('[Send] QR rendered:', false);
      }
    };

    createOffer();
  }, []);

  const handleScanAnswerFrame = useCallback((frame: QRFrame) => {
    console.log('[Send] Received frame', frame.index + 1, 'of', frame.total);
    collectedFrames.current.set(frame.index, frame);

    if (collectedFrames.current.size >= frame.total) {
      console.log('[Send] All frames received, reassembling');
      const encoded = reassembleFrames(Array.from(collectedFrames.current.values()));
      if (encoded) {
        try {
          const payload = decodePayload(encoded);
          if (payload.t === 'answer' && peerRef.current) {
            console.log('[Send] Decoded answer, setting remote description');
            peerRef.current.setRemoteAnswer(payload.sdp).then(() => {
              const checkConnection = setInterval(() => {
                const ch = peerRef.current?.getDataChannel();
                if (ch && ch.readyState === 'open') {
                  clearInterval(checkConnection);
                  console.log('[Send] Connection established, exchanging device names');
                  
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
                    } catch (e) {}
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
    window.location.reload();
  };

  const statusBadge = () => {
    const statusMap = {
      'new': { label: 'Ready', status: 'idle' as const },
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

        <h2 className="mb-3">Send Files</h2>

        {/* Main Card */}
        <Card className="mb-3">
          {/* Step Tabs */}
          <div className="mb-3">
            <Tabs
              tabs={[
                { id: '1', label: '1. Show this QR' },
                { id: '2', label: '2. Scan reply' },
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

          {/* Step 1: Show Offer QR */}
          {step === 1 && (
            <div className="flex flex-col items-center gap-3">
              {qrData ? (
                <>
                  <p className="text-muted text-center" style={{ fontSize: '14px', marginBottom: '16px' }}>
                    Show this QR code to the receiving device
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
                  <BtnAcid onClick={() => setStep(2)} style={{ width: '100%', marginTop: '16px' }}>
                    Next: Scan reply →
                  </BtnAcid>
                </>
              ) : (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <p className="text-muted">Generating QR code...</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Scan Answer */}
          {step === 2 && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted text-center" style={{ fontSize: '14px', marginBottom: '16px' }}>
                Scan the QR code from the receiving device
              </p>
              <QRScan
                onFrame={handleScanAnswerFrame}
                onError={(err) => setError(err)}
              />
              <div style={{ width: '100%', marginTop: '24px' }}>
                <p className="text-muted text-center" style={{ fontSize: '13px', marginBottom: '12px' }}>
                  Or paste the answer code
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
