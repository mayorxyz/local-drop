import { useState, useCallback, useEffect } from 'react';
import { Home } from './pages/Home';
import { Send } from './pages/Send';
import { Receive } from './pages/Receive';
import { Connected } from './pages/Connected';
import { getThemePreference, setThemePreference, requestPersistentStorage } from './lib/storage';

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

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }, [isDark]);

  const handleThemeToggle = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    setTheme(newTheme);
    setThemePreference(newTheme);
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
    showToast(`Connected to ${peerName || 'peer'}! Ready to send files.`);
  }, [showToast]);

  const handleReceiveConnected = useCallback((ch: RTCDataChannel, peerName?: string) => {
    setChannel(ch);
    setRole('receiver');
    setPeerDeviceName(peerName || '');
    setPage('connected');
    showToast(`Connected to ${peerName || 'peer'}! Ready to receive files.`);
  }, [showToast]);

  const handleDisconnect = useCallback(() => {
    if (channel) {
      channel.close();
    }
    setChannel(null);
    setPage('home');
    showToast('Disconnected');
  }, [channel, showToast]);

  const getThemeIcon = () => {
    if (theme === 'dark') return '🌙';
    if (theme === 'light') return '☀️';
    return '🌓';
  };

  return (
    <div className={`min-h-[100dvh] ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
      {/* Theme toggle - top right corner */}
      <button
        onClick={handleThemeToggle}
        className="fixed top-4 right-4 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-sm transition-colors backdrop-blur-sm"
        title={`Theme: ${theme} (click to change)`}
      >
        {getThemeIcon()}
      </button>

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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-lg text-sm text-slate-200 animate-fade-in z-50">
          {toast}
        </div>
      )}

      {/* Offline indicator */}
      {!navigator.onLine && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-600/90 text-white text-xs text-center py-1 z-50">
          ⚠ You are offline — app works with cached data
        </div>
      )}
    </div>
  );
}
