import { useState, useEffect } from 'react';
import { Card, BtnAcid, BtnGhost, Badge, IconSend, IconReceive, IconWifi, IconQr, IconSignal } from '../components/ui';

interface HomeProps {
  onSend: () => void;
  onReceive: () => void;
}

export function Home({ onSend, onReceive }: HomeProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [browserSupported, setBrowserSupported] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const supported = typeof RTCPeerConnection !== 'undefined' && 
                      typeof RTCDataChannel !== 'undefined';
    setBrowserSupported(supported);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstall(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!browserSupported) {
    return (
      <div className="page">
        <div className="container">
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '60vh' }}>
            <h1 className="mb-3">Browser Not Supported</h1>
            <p className="text-muted mb-4">
              LocalDrop requires a browser with WebRTC support.
            </p>
            <p className="text-dim" style={{ fontSize: '14px' }}>
              Please use Chrome, Firefox, Safari, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '60vh', paddingTop: '48px', paddingBottom: '48px' }}>
          {/* Badge */}
          <Badge status="success" className="mb-4">
            Offline-ready · No data used
          </Badge>

          {/* Heading */}
          <h1 className="mb-3">
            Send files between any devices,{' '}
            <span className="acid-highlight">no internet</span>
          </h1>

          {/* Subtext */}
          <p style={{ fontSize: '18px', maxWidth: '600px', marginBottom: '48px' }}>
            Direct peer-to-peer transfer over local Wi-Fi. No accounts, no servers, no tracking.
          </p>

          {/* Action Cards */}
          <div className="grid-2" style={{ width: '100%', maxWidth: '700px', marginBottom: '64px' }}>
            <Card clickable onClick={onSend} style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <IconSend className="icon-large" />
              </div>
              <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>Send Files</h3>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: '24px' }}>
                Share files from this device
              </p>
              <BtnAcid style={{ width: '100%' }}>
                <IconSend />
                Start Sending
              </BtnAcid>
            </Card>

            <Card clickable onClick={onReceive} style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <IconReceive className="icon-large" />
              </div>
              <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>Receive Files</h3>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: '24px' }}>
                Accept files from another device
              </p>
              <BtnGhost style={{ width: '100%' }}>
                <IconReceive />
                Start Receiving
              </BtnGhost>
            </Card>
          </div>

          {/* How It Works */}
          <div style={{ width: '100%', maxWidth: '900px' }}>
            <h2 className="text-center mb-4" style={{ fontSize: '32px' }}>
              How it works
            </h2>
            <div className="grid-3">
              <Card style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'var(--accent)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#111',
                  fontWeight: 800,
                  fontSize: '20px'
                }}>
                  1
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <IconWifi />
                </div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Hotspot on</h3>
                <p className="text-muted" style={{ fontSize: '13px' }}>
                  Connect both devices to the same Wi-Fi or hotspot
                </p>
              </Card>

              <Card style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'var(--accent)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#111',
                  fontWeight: 800,
                  fontSize: '20px'
                }}>
                  2
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <IconQr />
                </div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Scan QR</h3>
                <p className="text-muted" style={{ fontSize: '13px' }}>
                  Pair devices by scanning a QR code or pasting a code
                </p>
              </Card>

              <Card style={{ textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: 'var(--accent)', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#111',
                  fontWeight: 800,
                  fontSize: '20px'
                }}>
                  3
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <IconSignal />
                </div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Send</h3>
                <p className="text-muted" style={{ fontSize: '13px' }}>
                  Transfer files directly, verified with SHA-256
                </p>
              </Card>
            </div>
          </div>

          {/* iOS Install Hint */}
          {isIOS && (
            <Card className="mt-4" style={{ maxWidth: '500px', textAlign: 'center', padding: '20px' }}>
              <p style={{ fontSize: '14px' }}>
                <strong>Install on iOS:</strong> Tap the Share button in Safari, then "Add to Home Screen"
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
