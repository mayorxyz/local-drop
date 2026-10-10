import { useState, useCallback, useEffect } from 'react';
import { Home } from './pages/Home';
import { Send } from './pages/Send';
import { Receive } from './pages/Receive';
import { Connected } from './pages/Connected';
import { getThemePreference, setThemePreference, requestPersistentStorage } from './lib/storage';
import { Nav, Toast } from './components/ui';

type Page = 'home' | 'send' | 'receive' | 'connected';
type Theme = 'dark' | 'light' | 'system';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [channel, setChannel] = useState<RTCDataChannel | null>(null);
  const [role, setRole] = useState<'sender' | 'receiver'>('sender');
  const [peerDeviceName, setPeerDeviceName] = useState<string>('');
  const [theme, setTheme] = useState<Theme>(getThemePreference());
  const [isDark, setIsDark] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Request persistent storage on first run
  useEffect(() => {
    requestPersistentStorage();
  }, []);

  // Handle theme with prefers-color-scheme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = () => {
      if (theme === 'system') {
        setIsDark(mediaQuery.matches);
      } else {
        setIsDark(theme === 'dark');
      }
    };

    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleThemeToggle = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(newTheme);
    setThemePreference(newTheme);
  };

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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSendConnected = useCallback((ch: RTCDataChannel, peerName?: string) => {
    setChannel(ch);
    setRole('sender');
    setPeerDeviceName(peerName || '');
    setPage('connected');
    showToast(`Connected to ${peerName || 'peer'}. Ready to send files.`);
  }, [showToast]);

  const handleReceiveConnected = useCallback((ch: RTCDataChannel, peerName?: string) => {
    setChannel(ch);
    setRole('receiver');
    setPeerDeviceName(peerName || '');
    setPage('connected');
    showToast(`Connected to ${peerName || 'peer'}. Ready to receive files.`);
  }, [showToast]);

  const handleDisconnect = useCallback(() => {
    if (channel) {
      channel.close();
    }
    setChannel(null);
    setPeerDeviceName('');
    setPage('home');
    showToast('Disconnected');
  }, [channel, showToast]);

  return (
    <>
      <Nav
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onInstall={handleInstall}
        showInstall={showInstall}
      />

      {/* Pages */}
      {page === 'home' && (
        <Home
          onSend={() => setPage('send')}
          onReceive={() => setPage('receive')}
        />
      )}
      {page === 'send' && (
        <Send
          onConnected={handleSendConnected}
          onBack={() => setPage('home')}
        />
      )}
      {page === 'receive' && (
        <Receive
          onConnected={handleReceiveConnected}
          onBack={() => setPage('home')}
        />
      )}
      {page === 'connected' && channel && (
        <Connected
          channel={channel}
          role={role}
          peerDeviceName={peerDeviceName}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <Toast message={toast} />
        </div>
      )}

      {/* Offline indicator */}
      {!navigator.onLine && (
        <div style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 24px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-muted)',
          zIndex: 999,
        }}>
          Offline mode — app works with cached data
        </div>
      )}
    </>
  );
}
