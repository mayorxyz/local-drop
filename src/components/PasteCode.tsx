import { useState } from 'react';

interface PasteCodeProps {
  onSubmit: (code: string) => void;
  codeToCopy?: string;
  label?: string;
}

export function PasteCode({ onSubmit, codeToCopy, label }: PasteCodeProps) {
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!codeToCopy) return;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = codeToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {label && <p className="text-sm text-slate-400 text-center">{label}</p>}
      
      {codeToCopy && (
        <button
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          {copied ? (
            <>
              <span>✓</span>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copy code</span>
            </>
          )}
        </button>
      )}

      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste code here..."
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 resize-none h-20 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors self-end h-10"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
