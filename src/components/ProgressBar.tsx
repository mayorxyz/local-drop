interface ProgressBarProps {
  progress: number; // 0-100
  speed?: number; // bytes per second
  eta?: number; // seconds
  status?: string;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + '/s';
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function ProgressBar({ progress, speed, eta, status, className = '' }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            status === 'cancelled' ? 'bg-red-500' :
            status === 'complete' ? 'bg-green-500' :
            'bg-indigo-500'
          }`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{clampedProgress.toFixed(1)}%</span>
        <div className="flex gap-3">
          {speed !== undefined && status === 'sending' && (
            <span>{formatSpeed(speed)}</span>
          )}
          {eta !== undefined && status === 'sending' && eta > 0 && (
            <span>ETA: {formatEta(eta)}</span>
          )}
          {status && (
            <span className={
              status === 'complete' ? 'text-green-400' :
              status === 'cancelled' ? 'text-red-400' :
              status === 'rejected' ? 'text-orange-400' :
              ''
            }>
              {status === 'sending' ? '↑ Sending' :
               status === 'receiving' ? '↓ Receiving' :
               status === 'complete' ? '✓ Done' :
               status === 'cancelled' ? '✗ Cancelled' :
               status === 'rejected' ? '✗ Rejected' :
               status === 'pending' ? 'Waiting...' :
               status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
