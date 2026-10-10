import { HistoryItem } from '../lib/transfer';

interface HistoryProps {
  items: HistoryItem[];
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function History({ items, className = '' }: HistoryProps) {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-slate-300">Session history</h3>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/30 rounded text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span>{item.direction === 'send' ? '↑' : '↓'}</span>
              <span className="text-slate-300 truncate">{item.name}</span>
              {item.sha256 && item.verified && (
                <span className="text-green-400">✓</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span>{formatSize(item.size)}</span>
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
  );
}
