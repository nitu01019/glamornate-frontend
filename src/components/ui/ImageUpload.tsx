'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  uploadImage,
  deleteImage,
  StorageValidationError,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/firebase-client/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageUploadProps {
  /** Callback invoked with the full list of uploaded URLs after each change */
  readonly onUpload: (urls: string[]) => void;
  /** Maximum number of images allowed (default 1 for single mode) */
  readonly maxFiles?: number;
  /** Currently persisted image URLs to display */
  readonly currentImages?: readonly string[];
  /** Firebase Storage path prefix for uploads */
  readonly storagePath: string;
  /** Additional Tailwind classes for the root container */
  readonly className?: string;
}

interface PendingImage {
  readonly id: string;
  readonly previewUrl: string;
  readonly progress: number;
  readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCEPT = ALLOWED_MIME_TYPES.join(',');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageUpload({
  onUpload,
  maxFiles = 1,
  currentImages = [],
  storagePath,
  className,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCount = currentImages.length + pendingImages.length;
  const canAddMore = totalCount < maxFiles;
  const isSingleMode = maxFiles === 1;

  // -- Upload logic --

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      const remaining = maxFiles - currentImages.length;
      if (remaining <= 0) {
        setError(`Maximum of ${maxFiles} image${maxFiles > 1 ? 's' : ''} allowed.`);
        return;
      }

      const toUpload = fileArray.slice(0, remaining);

      // Create pending entries with previews
      const newPending: PendingImage[] = toUpload.map((file, i) => ({
        id: `pending-${Date.now()}-${i}`,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        error: null,
      }));

      setPendingImages((prev) => [...prev, ...newPending]);

      // Upload each file
      const results: string[] = [];
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const pendingId = newPending[i].id;

        try {
          const url = await uploadImage(file, storagePath, (progress) => {
            setPendingImages((prev) =>
              prev.map((p) => (p.id === pendingId ? { ...p, progress } : p)),
            );
          });
          results.push(url);

          // Remove from pending on success
          setPendingImages((prev) => prev.filter((p) => p.id !== pendingId));
        } catch (err) {
          const message =
            err instanceof StorageValidationError
              ? err.message
              : 'Upload failed. Please try again.';

          setPendingImages((prev) =>
            prev.map((p) => (p.id === pendingId ? { ...p, error: message, progress: 0 } : p)),
          );
        }
      }

      if (results.length > 0) {
        onUpload([...currentImages, ...results]);
      }
    },
    [currentImages, maxFiles, onUpload, storagePath],
  );

  // -- Event handlers --

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [handleFiles],
  );

  const handleRemoveExisting = useCallback(
    async (url: string) => {
      try {
        await deleteImage(url);
      } catch {
        // Deletion from storage may fail if the URL is external; that is OK.
      }
      const updated = currentImages.filter((u) => u !== url);
      onUpload(updated);
    },
    [currentImages, onUpload],
  );

  const handleRemovePending = useCallback((id: string) => {
    setPendingImages((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // -- Render --

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple={maxFiles > 1}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Drop zone -- shown when there is room for more images */}
      {canAddMore && (
        <button
          type="button"
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'w-full rounded-xl border-2 border-dashed transition-colors',
            'flex flex-col items-center justify-center gap-2 p-6',
            'text-gray-400 hover:text-gray-500 hover:border-gray-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
            dragOver
              ? 'border-amber-400 bg-amber-50 text-amber-600'
              : 'border-gray-200 bg-gray-50/50',
          )}
        >
          <Upload className="w-8 h-8" />
          <span className="text-sm font-medium">
            {dragOver ? 'Drop image here' : 'Click or drag to upload'}
          </span>
          <span className="text-xs text-gray-400">
            JPEG, PNG, WebP up to {formatBytes(MAX_FILE_SIZE_BYTES)}
          </span>
        </button>
      )}

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Image grid */}
      {(currentImages.length > 0 || pendingImages.length > 0) && (
        <div
          className={cn('grid gap-3', isSingleMode ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}
        >
          {/* Existing (uploaded) images */}
          {currentImages.map((url) => (
            <div
              key={url}
              className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100"
            >
              <Image
                src={url}
                alt="Uploaded image"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 33vw"
              />
              <button
                type="button"
                onClick={() => handleRemoveExisting(url)}
                className={cn(
                  'absolute top-1.5 right-1.5 p-1 rounded-full',
                  'bg-black/60 text-white opacity-0 group-hover:opacity-100',
                  'transition-opacity focus-visible:opacity-100',
                )}
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Pending (uploading) images */}
          {pendingImages.map((pending) => (
            <div
              key={pending.id}
              className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- `pending.previewUrl` is a transient `URL.createObjectURL` blob-URL (`blob:`); next/image does not support blob URLs and would throw "Invalid src". Keep native `<img>` for upload previews. */}
              <img
                src={pending.previewUrl}
                alt="Uploading preview"
                className="w-full h-full object-cover"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                {pending.error ? (
                  <>
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <span className="text-xs text-white text-center px-2 leading-tight">
                      {pending.error}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePending(pending.id)}
                      className="text-xs text-white underline mt-1"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <span className="text-xs font-medium text-white">{pending.progress}%</span>
                    {/* Progress bar */}
                    <div className="w-3/4 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-200"
                        style={{ width: `${pending.progress}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
