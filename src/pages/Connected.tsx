import { useState, useCallback, useRef, useEffect } from 'react';
import { TransferManager, TransferProgress, TransferMeta, HistoryItem, ReceivedText, saveFile } from '../lib/transfer';
import { createZipFromFiles } from '../lib/zip';
import { DropZone } from '../components/DropZone';
import { TransferItem } from '../components/TransferItem';

interface ConnectedProps {
  channel: RTCDataChannel;
  role: 'sender' | 'receiver';
  peerDeviceName?: string;
  onDisconnect: () => void;
}

interface ReceivedFile {
  id: string;
  name: string;
  blob: Blob;
  size: number;
  sha256?: string;
  verified?: boolean;
}

export function Connected({ channel, role, peerDeviceName, onDisconnect }: ConnectedProps) {
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<ReceivedText[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [textMessage, setTextMessage] = useState('');
  const managerRef = useRef<TransferManager | null>(null);

  // Initialize transfer manager
  useEffect(() => {
    const manager = new TransferManager(channel, {
      onProgress: (progress: TransferProgress) => {
        setTransfers(prev => {
          const idx = prev.findIndex(t => t.id === progress.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = progress;
            return next;
          }
          return [...prev, progress];
        });
      },
      onSendComplete: (id: string, sha256?: string) => {
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'complete' as const, sha256 } : t));
      },
      onReceiveMeta: (meta: TransferMeta) => {
        setPendingFiles(prev => [...prev, { id: meta.id, name: meta.name, size: meta.size }]);
      },
      onReceiveComplete: (id: string, blob: Blob, name: string, sha256?: string, verified?: boolean) => {
        setReceivedFiles(prev => [...prev, { id, name, blob, size: blob.size, sha256, verified }]);
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'complete' as const, sha256, verified } : t));
        setPendingFiles(prev => prev.filter(f => f.id !== id));
      },
      onReceiveText: (text: ReceivedText) => {
        setReceivedTexts(prev => [...prev, text]);
      },
      onError: (id: string, error: Error) => {
        console.error(`Transfer error ${id}:`, error);
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'failed' as const } : t));
      },
      onHistoryUpdate: (item: HistoryItem) => {
        setHistory(prev => [item, ...prev].slice(0, 50)); // Keep last 50 items
      },
    });
    managerRef.current = manager;

    // Monitor channel state
    const checkState = setInterval(() => {
      if (channel.readyState !== 'open') {
        clearInterval(checkState);
        onDisconnect();
      }
    }, 1000);

    // Online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(checkState);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      manager.releaseWakeLock();
    };
  }, [channel, onDisconnect]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!managerRef.current) return;

    // Warn for large files on mobile
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (isMobile && totalSize > 1024 * 1024 * 1024) {
      if (!confirm(`Warning: You're sending ${files.length} file(s) totaling ${(totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB on a mobile device. Continue?`)) {
        return;
      }
    }

    for (const file of files) {
      await managerRef.current.enqueue(file);
    }
  }, []);

  const handleFolder = useCallback(async (files: File[]) => {
    if (!managerRef.current) return;

    // Zip the folder
    const zipBlob = await createZipFromFiles(files);
    const zipFile = new File([zipBlob], 'folder.zip', { type: 'application/zip' });
    await managerRef.current.enqueue(zipFile);
  }, []);

  const handleSendText = useCallback(() => {
    if (!managerRef.current || !textMessage.trim()) return;
    managerRef.current.sendText(textMessage.trim());
    setTextMessage('');
  }, [textMessage]);

  const handleAccept = useCallback((id: string) => {
    managerRef.current?.accept(id);
  }, []);

  const handleReject = useCallback((id: string) => {
    managerRef.current?.reject(id);
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleCancel = useCallback((id: string) => {
    managerRef.current?.cancel(id);
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' as const } : t));
  }, []);

  const handlePause = useCallback((id: string) => {
    managerRef.current?.pause(id);
  }, []);

  const handleResume = useCallback((id: string) => {
    managerRef.current?.resume(id);
  }, []);

  const handleSave = useCallback(async (file: ReceivedFile) => {
    await saveFile(file.blob, file.name);
  }, []);

  const handleCopyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const isUrl = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-6">
        <button onClick={onDisconnect} className="p-2 text-slate-400 hover:text-slate-200 transition-colors text-sm">
          ← Disconnect
        </button>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${channel.readyState === 'open' ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm text-slate-300">
            {peerDeviceName ? `Connected to ${peerDeviceName}` : (role === 'sender' ? 'Sender' : 'Receiver')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isOnline && (
            <span className="text-xs text-yellow-400">⚠ Offline</span>
          )}
        </div>
      </div>

      <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
        {/* Drop zone */}
        <DropZone onFiles={handleFiles} onFolder={handleFolder} />

        {/* Text message input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={textMessage}
            onChange={(e) => setTextMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Send a message or link..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSendText}
            disabled={!textMessage.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>

        {/* Pending incoming files */}
        {pendingFiles.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">Incoming files</h3>
            {pendingFiles.map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-200 truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(file.id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(file.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active transfers */}
        {transfers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">Transfers</h3>
            {transfers.map(t => (
              <TransferItem
                key={t.id}
                transfer={t}
                onCancel={handleCancel}
                onPause={handlePause}
                onResume={handleResume}
              />
            ))}
          </div>
        )}

        {/* Received texts */}
        {receivedTexts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">Received messages</h3>
            {receivedTexts.map(text => (
              <div key={text.id} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {isUrl(text.body) ? (
                      <a
                        href={text.body}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 text-sm break-all"
                      >
                        {text.body}
                      </a>
                    ) : (
                      <p className="text-sm text-slate-200 break-words">{text.body}</p>
                    )}
                    <span className="text-xs text-slate-500 mt-1">
                      {new Date(text.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyText(text.body)}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                    title="Copy"
                  >
                    📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Received files */}
        {receivedFiles.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">Received files</h3>
            {receivedFiles.map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-200 truncate max-w-[200px]">{file.name}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                    {file.sha256 && (
                      <span className={file.verified ? 'text-green-400' : 'text-red-400'}>
                        {file.verified ? '✓ Verified' : '✗ Mismatch'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleSave(file)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium transition-colors"
                >
                  💾 Save
                </button>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">Session history</h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {history.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/30 rounded text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{item.direction === 'send' ? '↑' : '↓'}</span>
                    <span className="text-slate-300 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span>{(item.size / (1024 * 1024)).toFixed(1)} MB</span>
                    <span className={
                      item.status === 'complete' ? 'text-green-400' :
                      item.status === 'cancelled' ? 'text-red-400' :
                      'text-yellow-400'
                    }>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
