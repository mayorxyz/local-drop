import { useState } from 'react';
import { getDeviceName, setDeviceName } from '../lib/storage';

interface DeviceBadgeProps {
  editable?: boolean;
  className?: string;
}

export function DeviceBadge({ editable = true, className = '' }: DeviceBadgeProps) {
  const [name, setName] = useState(getDeviceName());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      setDeviceName(trimmed);
      setName(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(name);
    }
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          maxLength={20}
          className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg">
        <span className="text-lg">📱</span>
        <span className="text-sm font-medium text-slate-200">{name}</span>
        {editable && (
          <button
            onClick={() => {
              setIsEditing(true);
              setEditValue(name);
            }}
            className="ml-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Edit device name"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
