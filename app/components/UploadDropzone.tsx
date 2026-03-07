'use client';

import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { FileArchive, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/app/lib/utils';

interface Props {
  accept: string;
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export default function UploadDropzone({ accept, label, value, onChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return accept.split(',').map(s => s.trim()).includes(ext);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) onChange(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onChange(file);
    e.target.value = '';
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const isZip = accept.includes('.zip');
  const Icon = isZip ? FileArchive : FileSpreadsheet;

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border-2 border-dashed p-5 text-center transition-colors duration-150',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          dragging
            ? 'border-plum bg-plum/5'
            : value
            ? 'border-plum/40 bg-plum/5'
            : 'border-[var(--border)] bg-white hover:border-plum/40 hover:bg-plum/5'
        )}
      >
        {value ? (
          <div className="flex flex-col items-center gap-1.5">
            <Icon className="h-8 w-8 text-plum" />
            <span className="text-sm font-medium text-ink">{value.name}</span>
            <span className="text-xs text-mauve">{formatSize(value.size)}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon className={cn('h-8 w-8', dragging ? 'text-plum' : 'text-mauve')} />
            <span className="text-sm text-mauve">{label}</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-1.5 flex items-center gap-1 text-xs text-mauve hover:text-red-500 transition-colors"
        >
          <X className="h-3 w-3" /> Remove
        </button>
      )}
    </div>
  );
}
