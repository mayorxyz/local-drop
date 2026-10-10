import { useState, useEffect } from 'react';

interface HomeProps {
  onSend: () => void;
  onReceive: () => void;
}

export function Home({ onSend, onReceive }: HomeProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

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

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-4 py-8">
      {/* Logo / Title */}
      <div className="flex flex-col items-center gap-4 mb-12">
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
