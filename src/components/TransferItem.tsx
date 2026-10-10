import { TransferProgress } from '../lib/transfer';
import { ProgressBar } from './ProgressBar';

interface TransferItemProps {
  transfer: TransferProgress;
  onCancel?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onRetry?: (id: string) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function TransferItem({ transfer, onCancel, onPause, onResume, onRetry }: TransferItemProps) {
  const progress = transfer.size > 0 ? (transfer.transferred / transfer.size) * 100 : 0;
  const isActive = transfer.status === 'sending' || transfer.status === 'receiving';
  const isPaused = transfer.status === 'paused';
  const isFailed = transfer.status === 'failed' || transfer.status === 'cancelled';

  return (
    <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm text-slate-200 truncate">{transfer.name}</span>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{formatSize(transfer.transferred)} / {formatSize(transfer.size)}</span>
            {transfer.sha256 && transfer.status === 'complete' && (
              <span className={transfer.verified ? 'text-green-400' : 'text-red-400'}>
                {transfer.verified ? '✓ Verified' : '✗ Mismatch'}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 ml-2">
          {isActive && onPause && (
            <button
              onClick={() => onPause(transfer.id)}
              className="px-2 py-1 bg-yellow-600/80 hover:bg-yellow-500 rounded text-xs transition-colors"
              title="Pause"
            >
              ⏸
            </button>
          )}
          {isPaused && onResume && (
            <button
              onClick={() => onResume(transfer.id)}
              className="px-2 py-1 bg-green-600/80 hover:bg-green-500 rounded text-xs transition-colors"
              title="Resume"
            >
              ▶
            </button>
          )}
          {(isActive || isPaused) && onCancel && (
            <button
              onClick={() => onCancel(transfer.id)}
              className="px-2 py-1 bg-red-600/80 hover:bg-red-500 rounded text-xs transition-colors"
              title="Cancel"
            >
              ✕
            </button>
          )}
          {isFailed && onRetry && (
            <button
              onClick={() => onRetry(transfer.id)}
              className="px-2 py-1 bg-indigo-600/80 hover:bg-indigo-500 rounded text-xs transition-colors"
              title="Retry"
            >
              🔄
            </button>
          )}
        </div>
      </div>
      <ProgressBar
        progress={progress}
        speed={isActive ? transfer.speed : undefined}
        eta={isActive ? transfer.eta : undefined}
        status={transfer.status}
      />
    </div>
  );
}
