import { useState, useRef, useCallback } from 'react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  onFolder?: (files: File[]) => void;
  className?: string;
}

export function DropZone({ onFiles, onFolder, className = '' }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    const files: File[] = [];
    const folderFiles: File[] = [];

    if (items && items.length > 0) {
      // Check for folder drops
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // Handle directory
          readDirectoryEntry(entry as any, '', folderFiles);
        } else {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
    } else {
      // Fallback for browsers without webkitGetAsEntry
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i]);
      }
    }

    // Process after a short delay to allow async directory reading
    setTimeout(() => {
      if (folderFiles.length > 0 && onFolder) {
        onFolder(folderFiles);
      }
      if (files.length > 0) {
        onFiles(files);
      }
    }, 100);
  }, [onFiles, onFolder]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFolder) {
      onFolder(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
        dragOver
          ? 'border-indigo-400 bg-indigo-500/10'
          : 'border-slate-600 hover:border-slate-500 bg-slate-800/30'
      } ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
        onChange={handleFolderInput}
      />

      <svg className="w-10 h-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <p className="text-sm text-slate-300 font-medium mb-2">
        Drop files or folders here
      </p>
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium transition-colors"
        >
          Browse Files
        </button>
        {onFolder && (
          <button
            onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium transition-colors"
          >
            📁 Browse Folder
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Multiple files • Folders zipped automatically
      </p>
    </div>
  );
}

/**
 * Recursively read a directory entry
 */
async function readDirectoryEntry(entry: any, path: string, files: File[]) {
  if (entry.isFile) {
    return new Promise<void>((resolve) => {
      entry.file((file: File) => {
        // Add path prefix for folder structure
        const fileWithPath = new File([file], path + file.name, { type: file.type });
        files.push(fileWithPath);
        resolve();
      }, () => resolve());
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    return new Promise<void>((resolve) => {
      const readEntries = () => {
        reader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) {
            resolve();
            return;
          }
          for (const e of entries) {
            await readDirectoryEntry(e, path + entry.name + '/', files);
          }
          readEntries();
        });
      };
      readEntries();
    });
  }
}
