import { useState, useCallback, useEffect } from 'react';
import { Home } from './pages/Home';
import { Send } from './pages/Send';
import { Receive } from './pages/Receive';
import { Connected } from './pages/Connected';

type Page = 'home' | 'send' | 'receive' | 'connected';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [channel, setChannel] = useState<RTCDataChannel | null>(null);
  const [role, setRole] = useState<'sender' | 'receiver'>('sender');
  const [isDark, setIsDark] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Request persistent storage on first run
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((persisted) => {
        console.log('Persistent storage:', persisted);
      });
    }
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);
  }, [isDark]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSendConnected = useCallback((ch: RTCDataChannel) => {
    setChannel(ch);
    setRole('sender');
    setPage('connected');
    showToast('Connected! Ready to send files.');
  }, [showToast]);

  const handleReceiveConnected = useCallback((ch: RTCDataChannel) => {
    setChannel(ch);
    setRole('receiver');
    setPage('connected');
    showToast('Connected! Ready to receive files.');
  }, [showToast]);

  const handleDisconnect = useCallback(() => {
    if (channel) {
      channel.close();
    }
    setChannel(null);
    setPage('home');
    showToast('Disconnected');
  }, [channel, showToast]);

  return (
    <div className={`min-h-[100dvh] ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
      {/* Theme toggle - top right corner */}
      <button
        onClick={() => setIsDark(!isDark)}
        className="fixed top-4 right-4 z-40 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-sm transition-colors"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? '☀️' : '🌙'}
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
