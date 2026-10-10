import { ConnectionState } from '../lib/peer';

interface StatusBarProps {
  state: ConnectionState;
  className?: string;
}

export function StatusBar({ state, className = '' }: StatusBarProps) {
  const getStatusInfo = () => {
    switch (state) {
      case 'connected':
        return {
          color: 'bg-green-400',
          bgColor: 'bg-green-900/50',
          textColor: 'text-green-300',
          label: 'Connected',
        };
      case 'connecting':
        return {
          color: 'bg-yellow-400 animate-pulse',
          bgColor: 'bg-yellow-900/50',
          textColor: 'text-yellow-300',
          label: 'Connecting...',
        };
      case 'failed':
        return {
          color: 'bg-red-400',
          bgColor: 'bg-red-900/50',
          textColor: 'text-red-300',
          label: 'Failed',
        };
      case 'disconnected':
        return {
          color: 'bg-slate-400',
          bgColor: 'bg-slate-800',
          textColor: 'text-slate-400',
          label: 'Disconnected',
        };
      default:
        return {
          color: 'bg-slate-500',
          bgColor: 'bg-slate-800',
          textColor: 'text-slate-400',
          label: 'Ready',
        };
    }
  };

  const { color, bgColor, textColor, label } = getStatusInfo();

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor} ${className}`}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}
