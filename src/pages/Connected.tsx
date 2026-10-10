import { useState, useCallback, useRef, useEffect } from 'react';
import { TransferManager, TransferProgress, TransferMeta, HistoryItem, ReceivedText, saveFile } from '../lib/transfer';
import { createZipFromFiles } from '../lib/zip';
import { getDeviceName } from '../lib/storage';
import { 
  Card, BtnAcid, BtnGhost, Badge, ProgressBar, Tabs,
  IconUpload, IconFolder, IconX, IconPause, IconPlay, IconRefresh,
  IconDownload, IconCopy, IconArrowLeft, IconCheck, IconMessage
} from '../components/ui';

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

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function Connected({ channel, role, peerDeviceName, onDisconnect }: ConnectedProps) {
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<ReceivedText[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [textMessage, setTextMessage] = useState('');
  const [activeTab, setActiveTab] = useState('transfers');
  const [dragOver, setDragOver] = useState(false);
  const managerRef = useRef<TransferManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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
        setHistory(prev => [item, ...prev].slice(0, 50));
      },
    });
    managerRef.current = manager;

    const checkState = setInterval(() => {
      if (channel.readyState !== 'open') {
        clearInterval(checkState);
        onDisconnect();
      }
    }, 1000);

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

  const handleFolder = useCallback(async (files: File[]) => {
    if (!managerRef.current) return;
    const zipBlob = await createZipFromFiles(files);
    const zipFile = new File([zipBlob], 'folder.zip', { type: 'application/zip' });
    await managerRef.current.enqueue(zipFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

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

  const connectionOpen = channel.readyState === 'open';

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '800px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onDisconnect}
            className="btn-ghost btn-ghost-small"
            style={{ padding: '10px' }}
          >
            <IconArrowLeft />
          </button>
          <div className="flex items-center gap-2">
            <Badge>{getDeviceName()}</Badge>
            <Badge status={connectionOpen ? 'success' : 'error'}>
              {peerDeviceName || (role === 'sender' ? 'Sender' : 'Receiver')}
            </Badge>
            {!isOnline && <Badge status="warning">Offline</Badge>}
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`dropzone ${dragOver ? 'dropzone-active' : ''} mb-3`}
          style={{ cursor: 'pointer' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({ webkitdirectory: '', directory: '' } as any)}
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleFolder(Array.from(e.target.files))}
          />
          <div className="dropzone-icon">
            <IconUpload />
          </div>
          <p className="dropzone-text">Drop files or folders here</p>
          <p className="dropzone-hint">or click to browse</p>
          <div className="flex gap-2 justify-center mt-3" onClick={(e) => e.stopPropagation()}>
            <BtnGhost small onClick={() => fileInputRef.current?.click()}>
              Browse Files
            </BtnGhost>
            <BtnGhost small onClick={() => folderInputRef.current?.click()}>
              <IconFolder />
              Browse Folder
            </BtnGhost>
          </div>
        </div>

        {/* Text Message Input */}
        <Card className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <IconMessage />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Send a message</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={textMessage}
              onChange={(e) => setTextMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Type a message or paste a link..."
              className="input"
              style={{ flex: 1 }}
            />
            <BtnAcid small onClick={handleSendText} disabled={!textMessage.trim()}>
              Send
            </BtnAcid>
          </div>
        </Card>

        {/* Tabs */}
        <div className="mb-3">
          <Tabs
            tabs={[
              { id: 'transfers', label: 'Transfers' },
              { id: 'received', label: `Received (${receivedFiles.length + receivedTexts.length})` },
              { id: 'history', label: 'History' },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Transfers Tab */}
        {activeTab === 'transfers' && (
          <div className="flex flex-col gap-2">
            {/* Pending incoming */}
            {pendingFiles.map(file => (
              <Card key={file.id} className="transfer-item">
                <div className="transfer-header">
                  <div>
                    <div className="transfer-name">{file.name}</div>
                    <div className="transfer-size">{formatSize(file.size)}</div>
                  </div>
                  <div className="transfer-actions">
                    <BtnAcid small onClick={() => handleAccept(file.id)}>
                      <IconCheck />
                      Accept
                    </BtnAcid>
                    <BtnGhost small onClick={() => handleReject(file.id)}>
                      <IconX />
                      Reject
                    </BtnGhost>
                  </div>
                </div>
              </Card>
            ))}

            {/* Active transfers */}
            {transfers.map(t => (
              <Card key={t.id} className="transfer-item">
                <div className="transfer-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="transfer-name">{t.name}</div>
                    <div className="transfer-size">
                      {formatSize(t.transferred)} / {formatSize(t.size)}
                      {t.sha256 && t.status === 'complete' && (
                        <span style={{ marginLeft: '8px', color: t.verified ? 'var(--success)' : '#EF4444' }}>
                          {t.verified ? 'Verified' : 'Mismatch'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="transfer-actions">
                    {(t.status === 'sending' || t.status === 'receiving') && (
                      <>
                        <BtnGhost small onClick={() => handlePause(t.id)} style={{ padding: '8px' }}>
                          <IconPause />
                        </BtnGhost>
                        <BtnGhost small onClick={() => handleCancel(t.id)} style={{ padding: '8px' }}>
                          <IconX />
                        </BtnGhost>
                      </>
                    )}
                    {t.status === 'paused' && (
                      <>
                        <BtnGhost small onClick={() => handleResume(t.id)} style={{ padding: '8px' }}>
                          <IconPlay />
                        </BtnGhost>
                        <BtnGhost small onClick={() => handleCancel(t.id)} style={{ padding: '8px' }}>
                          <IconX />
                        </BtnGhost>
                      </>
                    )}
                    {t.status === 'failed' && (
                      <BtnGhost small onClick={() => handleCancel(t.id)} style={{ padding: '8px' }}>
                        <IconRefresh />
                      </BtnGhost>
                    )}
                  </div>
                </div>
                <ProgressBar
                  value={t.size > 0 ? (t.transferred / t.size) * 100 : 0}
                  speed={t.speed}
                  eta={t.eta}
                  status={t.status}
                />
              </Card>
            ))}

            {pendingFiles.length === 0 && transfers.length === 0 && (
              <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                <p className="text-muted">No active transfers</p>
                <p className="text-dim" style={{ fontSize: '13px', marginTop: '8px' }}>
                  Drop files above to start sending
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Received Tab */}
        {activeTab === 'received' && (
          <div className="flex flex-col gap-2">
            {/* Received texts */}
            {receivedTexts.map(text => (
              <Card key={text.id} className="transfer-item">
                <div className="flex items-start justify-between gap-2">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isUrl(text.body) ? (
                      <a
                        href={text.body}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', wordBreak: 'break-all', fontSize: '14px' }}
                      >
                        {text.body}
                      </a>
                    ) : (
                      <p style={{ fontSize: '14px', wordBreak: 'break-word' }}>{text.body}</p>
                    )}
                    <div className="text-dim" style={{ fontSize: '12px', marginTop: '4px' }}>
                      {new Date(text.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <BtnGhost small onClick={() => handleCopyText(text.body)} style={{ padding: '8px' }}>
                    <IconCopy />
                  </BtnGhost>
                </div>
              </Card>
            ))}

            {/* Received files */}
            {receivedFiles.map(file => (
              <Card key={file.id} className="transfer-item">
                <div className="transfer-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="transfer-name">{file.name}</div>
                    <div className="transfer-size">
                      {formatSize(file.size)}
                      {file.sha256 && (
                        <span style={{ marginLeft: '8px', color: file.verified ? 'var(--success)' : '#EF4444' }}>
                          {file.verified ? 'Verified' : 'Mismatch'}
                        </span>
                      )}
                    </div>
                  </div>
                  <BtnAcid small onClick={() => handleSave(file)}>
                    <IconDownload />
                    Save
                  </BtnAcid>
                </div>
              </Card>
            ))}

            {receivedFiles.length === 0 && receivedTexts.length === 0 && (
              <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                <p className="text-muted">No received files or messages yet</p>
              </Card>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-2">
            {history.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
                <p className="text-muted">No transfer history yet</p>
                <p className="text-dim" style={{ fontSize: '13px', marginTop: '8px' }}>
                  History is kept in memory during this session
                </p>
              </Card>
            ) : (
              history.map((item, idx) => (
                <Card key={idx} className="transfer-item" style={{ padding: '12px 16px' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: item.direction === 'send' ? 'var(--text-muted)' : 'var(--text)' }}>
                          {item.direction === 'send' ? 'Sent' : 'Received'}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                        {item.verified && (
                          <span style={{ color: 'var(--success)', fontSize: '12px' }}>Verified</span>
                        )}
                      </div>
                      <div className="text-dim" style={{ fontSize: '12px', marginTop: '2px' }}>
                        {formatSize(item.size)} · {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <Badge status={
                      item.status === 'complete' ? 'success' :
                      item.status === 'cancelled' ? 'error' :
                      'warning'
                    }>
                      {item.status}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
