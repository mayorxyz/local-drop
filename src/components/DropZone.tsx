/**
 * DropZone component: file/folder drag-and-drop and selection
 * Will be fully implemented in Stage 3
 */

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  className?: string;
}

export function DropZone({ onFiles, className = '' }: DropZoneProps) {
  // Placeholder - will be fully implemented in Stage 3
  return (
    <div className={`p-8 border-2 border-dashed border-slate-600 rounded-xl text-center ${className}`}>
      <p className="text-sm text-slate-400">Drop zone (Stage 3)</p>
    </div>
  );
}
