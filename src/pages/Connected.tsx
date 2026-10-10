import { useState, useCallback, useRef, useEffect } from 'react';
import { TransferManager, TransferProgress, TransferMeta, saveFile } from '../lib/transfer';
import { FileList } from '../components/FileList';

interface ConnectedProps {
  channel: RTCDataChannel;
  role: 'sender' | 'receiver';
  onDisconnect: () => void;
}

interface ReceivedFile {
  id: string;
  name: string;
  blob: Blob;
  size: number;
}

export function Connected({ channel, role, onDisconnect }: ConnectedProps) {
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const managerRef = useRef<TransferManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

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
      onSendComplete: (id: string) => {
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'complete' as const } : t));
      },
      onReceiveMeta: (meta: TransferMeta) => {
        setPendingFiles(prev => [...prev, { id: meta.id, name: meta.name, size: meta.size }]);
      },
      onReceiveComplete: (id: string, blob: Blob, name: string) => {
        setReceivedFiles(prev => [...prev, { id, name, blob, size: blob.size }]);
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'complete' as const } : t));
        setPendingFiles(prev => prev.filter(f => f.id !== id));
      },
      onError: (id: string, error: Error) => {
        console.error(`Transfer error ${id}:`, error);
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' as const } : t));
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

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!managerRef.current) return;
    const fileArray = Array.from(files);

    // Warn for large files on mobile
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
    if (isMobile && totalSize > 1024 * 1024 * 1024) {
      if (!confirm(`Warning: You're sending ${fileArray.length} file(s) totaling ${(totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB on a mobile device. Continue?`)) {
        return;
      }
    }

    for (const file of fileArray) {
      await managerRef.current.enqueue(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

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

  const handleSave = useCallback(async (file: ReceivedFile) => {
    await saveFile(file.blob, file.name);
  }, []);

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
            {role === 'sender' ? 'Sender' : 'Receiver'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isOnline && (
            <span className="text-xs text-yellow-400">⚠ Offline</span>
          )}
        </div>
      </div>

      <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
        {/* Drop zone / File picker */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragOver
              ? 'border-indigo-400 bg-indigo-500/10'
              : 'border-slate-600 hover:border-slate-500 bg-slate-800/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <svg className="w-10 h-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-slate-300 font-medium">
            Drop files here or tap to browse
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Multiple files supported • Any size • Both sides can send
          </p>
        </div>

        {/* File list with transfers and pending files */}
        <FileList
          transfers={transfers}
          pendingFiles={pendingFiles}
          onCancel={handleCancel}
          onAccept={handleAccept}
          onReject={handleReject}
        />

        {/* Received files */}
        {receivedFiles.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">Received files</h3>
            {receivedFiles.map(file => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-200 truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-slate-400">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
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
      </div>
    </div>
  );
}
