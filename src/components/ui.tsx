import { ReactNode, ButtonHTMLAttributes, HTMLAttributes, forwardRef } from 'react';

// ============ Icons (SVG, no emojis) ============

export const IconSend = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconReceive = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconUpload = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-large ${className}`} viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconWifi = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconQr = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h.01" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconCheck = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconX = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconPause = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <rect x="6" y="4" width="4" height="16" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="4" width="4" height="16" rx="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconPlay = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M5 3l14 9-14 9V3z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconRefresh = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconCopy = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <rect x="9" y="9" width="13" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconDownload = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconEdit = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSun = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconMoon = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconAuto = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 3v18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 3a9 9 0 010 18" fill="currentColor" opacity="0.3" />
  </svg>
);

export const IconFolder = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconMessage = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconArrowLeft = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconShield = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBolt = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSignal = ({ className = '' }: { className?: string }) => (
  <svg className={`icon ${className}`} viewBox="0 0 24 24">
    <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconDownloadNav = ({ className = '' }: { className?: string }) => (
  <svg className={`icon icon-small ${className}`} viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============ Card ============

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  clickable?: boolean;
}

export const Card = ({ clickable, className = '', children, ...props }: CardProps) => (
  <div
    className={`card ${clickable ? 'card-clickable' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);

// ============ Buttons ============

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  small?: boolean;
}

export const BtnAcid = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ small, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`btn-acid ${small ? 'btn-acid-small' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
BtnAcid.displayName = 'BtnAcid';

export const BtnGhost = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ small, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`btn-ghost ${small ? 'btn-ghost-small' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
BtnGhost.displayName = 'BtnGhost';

// ============ Badge ============

interface BadgeProps {
  children: ReactNode;
  status?: 'idle' | 'success' | 'warning' | 'error';
  className?: string;
}

export const Badge = ({ children, status = 'idle', className = '' }: BadgeProps) => {
  const dotClass = {
    idle: '',
    success: 'badge-dot-success',
    warning: 'badge-dot-warning',
    error: 'badge-dot-error',
  }[status];

  return (
    <div className={`badge ${className}`}>
      <span className={`badge-dot ${dotClass}`} />
      <span>{children}</span>
    </div>
  );
};

// ============ Progress Bar ============

interface ProgressBarProps {
  value: number; // 0-100
  speed?: number;
  eta?: number;
  status?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export const ProgressBar = ({ value, speed, eta, status }: ProgressBarProps) => {
  const clamped = Math.min(100, Math.max(0, value));
  const statusLabel = status === 'complete' ? 'Verified' :
                      status === 'cancelled' ? 'Cancelled' :
                      status === 'paused' ? 'Paused' :
                      status === 'failed' ? 'Failed' :
                      status === 'rejected' ? 'Rejected' : '';

  return (
    <div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      <div className="progress-meta">
        <span>{clamped.toFixed(1)}%</span>
        <div className="flex gap-2">
          {speed !== undefined && status !== 'paused' && status !== 'complete' && (
            <span>{formatBytes(speed)}/s</span>
          )}
          {eta !== undefined && status !== 'paused' && status !== 'complete' && eta > 0 && (
            <span>{formatEta(eta)}</span>
          )}
          {statusLabel && <span>{statusLabel}</span>}
        </div>
      </div>
    </div>
  );
};

// ============ Nav ============

interface NavProps {
  theme: 'dark' | 'light' | 'system';
  onThemeToggle: () => void;
  onInstall?: () => void;
  showInstall?: boolean;
}

export const Nav = ({ theme, onThemeToggle, onInstall, showInstall }: NavProps) => {
  const ThemeIcon = theme === 'dark' ? IconMoon : theme === 'light' ? IconSun : IconAuto;

  return (
    <nav className="nav">
      <div className="nav-logo">
        <div className="nav-logo-mark">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L2 8L8 14L14 8L8 2Z" fill="#111" />
          </svg>
        </div>
        <span>LocalDrop</span>
      </div>
      <div className="nav-actions">
        <button
          onClick={onThemeToggle}
          className="btn-ghost btn-ghost-small"
          aria-label="Toggle theme"
          style={{ padding: '10px' }}
        >
          <ThemeIcon />
        </button>
        {showInstall && onInstall && (
          <button onClick={onInstall} className="btn-acid btn-acid-small">
            <IconDownloadNav />
            Install
          </button>
        )}
      </div>
    </nav>
  );
};

// ============ Toast ============

interface ToastProps {
  message: string;
}

export const Toast = ({ message }: ToastProps) => (
  <div className="toast">{message}</div>
);

// ============ Tabs ============

interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export const Tabs = ({ tabs, active, onChange }: TabsProps) => (
  <div className="tabs">
    {tabs.map(tab => (
      <button
        key={tab.id}
        className={`tab ${active === tab.id ? 'tab-active' : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
