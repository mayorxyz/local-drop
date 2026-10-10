import { useState, useEffect } from 'react';
import { DeviceBadge } from '../components/DeviceBadge';

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
    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Check browser support for WebRTC
    const supported = typeof RTCPeerConnection !== 'undefined' && 
                      typeof RTCDataChannel !== 'undefined';
    setBrowserSupported(supported);

    // PWA install prompt
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
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-4 py-8">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20 mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-4">Browser Not Supported</h1>
          <p className="text-slate-400 mb-6">
            LocalDrop requires a browser with WebRTC support. Please use:
          </p>
          <ul className="text-sm text-slate-400 space-y-2 mb-8 text-left">
            <li>• Chrome 23+ or Edge 79+</li>
            <li>• Firefox 22+</li>
            <li>• Safari 11+</li>
            <li>• Opera 18+</li>
          </ul>
          <p className="text-xs text-slate-500">
            Your browser is missing RTCPeerConnection or RTCDataChannel support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-4 py-8">
      {/* Logo / Title */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-100">LocalDrop</h1>
        <p className="text-slate-400 text-center text-sm max-w-xs">
          Transfer files directly between devices over local Wi-Fi. No internet, no accounts, no servers.
        </p>
      </div>

      {/* Device name */}
      <div className="mb-8">
        <DeviceBadge />
      </div>

      {/* Main buttons */}
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={onSend}
          className="flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-indigo-600/20"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Send Files
        </button>

        <button
          onClick={onReceive}
          className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-emerald-600/20"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8V20m0 0l4-4m-4 4l-4-4M3 12h18" />
          </svg>
          Receive Files
        </button>
      </div>

      {/* Install PWA */}
      {showInstall && !isIOS && (
        <button
          onClick={handleInstall}
          className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          <span>📲</span>
          <span>Install App</span>
        </button>
      )}

      {/* iOS install hint */}
      {isIOS && (
        <div className="mt-6 p-3 bg-slate-800/50 border border-slate-700 rounded-lg max-w-sm">
          <p className="text-xs text-slate-400 text-center">
            📱 To install: tap the <span className="text-slate-200">Share</span> button in Safari, then "Add to Home Screen"
          </p>
        </div>
      )}

      {/* Features */}
      <div className="mt-12 grid grid-cols-3 gap-4 max-w-sm text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">🔒</span>
          <span className="text-xs text-slate-400">Private</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">⚡</span>
          <span className="text-xs text-slate-400">Fast</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">📡</span>
          <span className="text-xs text-slate-400">Offline</span>
        </div>
      </div>
    </div>
  );
}
