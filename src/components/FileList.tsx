import { TransferProgress } from '../lib/transfer';
import { ProgressBar } from './ProgressBar';

interface FileListProps {
  transfers: TransferProgress[];
  onCancel?: (id: string) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  pendingFiles?: { id: string; name: string; size: number }[];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function FileList({ transfers, onCancel, onAccept, onReject, pendingFiles }: FileListProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Pending incoming files */}
      {pendingFiles && pendingFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-300">Incoming files</h3>
          {pendingFiles.map(file => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="flex flex-col">
                <span className="text-sm text-slate-200 truncate max-w-[200px]">{file.name}</span>
                <span className="text-xs text-slate-400">{formatSize(file.size)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onAccept?.(file.id)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => onReject?.(file.id)}
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
            <div key={t.id} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-200 truncate max-w-[200px]">{t.name}</span>
                  <span className="text-xs text-slate-400">
                    {formatSize(t.transferred)} / {formatSize(t.size)}
                  </span>
                </div>
                {(t.status === 'sending' || t.status === 'receiving') && onCancel && (
                  <button
                    onClick={() => onCancel(t.id)}
                    className="px-2 py-1 bg-red-600/80 hover:bg-red-500 rounded text-xs transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <ProgressBar
                progress={t.size > 0 ? (t.transferred / t.size) * 100 : 0}
                speed={t.speed}
                eta={t.eta}
                status={t.status}
              />
            </div>
          ))}
        </div>
      )}

      {transfers.length === 0 && (!pendingFiles || pendingFiles.length === 0) && (
        <p className="text-center text-sm text-slate-500 py-8">No active transfers</p>
      )}
    </div>
  );
}
