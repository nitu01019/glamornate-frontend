'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  uploadImage,
  deleteImage,
  StorageValidationError,
  ALLOWED_MIME_TYPES,
} from '@/lib/firebase-client/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AvatarUploadProps {
  /** Current photo URL (may be undefined when no photo is set) */
  readonly currentPhoto?: string;
  /** Callback fired after a new photo is uploaded or deleted */
  readonly onPhotoChange: (url: string) => void;
  /** User ID used to build the storage path */
  readonly userId: string;
  /** Optional override for the storage path prefix (default: "users/{userId}/profile") */
  readonly storagePath?: string;
  /** Diameter in pixels (default 96 / w-24) */
  readonly size?: number;
  /** Additional Tailwind classes on the root wrapper */
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCEPT = ALLOWED_MIME_TYPES.join(',');

/**
 * Crop an image to a square using the browser canvas API.
 * Takes the largest centered square region from the source image.
 */
function cropToSquare(file: File, maxSize: number = 512): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `_reject` present to document the Promise executor contract; canvas crop is best-effort and always resolves (falls back to raw `file` on failure), so `reject` is never invoked
  return new Promise((resolve, _reject) => {
    if (typeof window === 'undefined') {
      resolve(file);
      return;
    }

    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const outputSize = Math.min(side, maxSize);

      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSize, outputSize);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.88,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AvatarUpload({
  currentPhoto,
  onPhotoChange,
  userId,
  storagePath,
  size = 96,
  className,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const path = storagePath ?? `users/${userId}/profile`;

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      setError(null);
      setUploading(true);
      setProgress(0);

      // Local preview
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      try {
        // Crop to square then upload
        const croppedBlob = await cropToSquare(file);
        const croppedFile = new File([croppedBlob], file.name, {
          type: 'image/jpeg',
        });

        const downloadUrl = await uploadImage(croppedFile, path, setProgress);

        // Clean up old image if present
        if (currentPhoto) {
          try {
            await deleteImage(currentPhoto);
          } catch {
            // Old image deletion is best-effort
          }
        }

        onPhotoChange(downloadUrl);
      } catch (err) {
        const message =
          err instanceof StorageValidationError ? err.message : 'Upload failed. Please try again.';
        setError(message);
      } finally {
        URL.revokeObjectURL(localPreview);
        setPreviewUrl(null);
        setUploading(false);
      }
    },
    [currentPhoto, onPhotoChange, path],
  );

  const displayUrl = previewUrl ?? currentPhoto;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {/* Hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleChange}
      />

      {/* Avatar circle */}
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        style={{ width: size, height: size }}
        className={cn(
          'relative rounded-full overflow-hidden border-2',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
          uploading
            ? 'border-amber-300 cursor-wait'
            : 'border-gray-200 hover:border-amber-400 cursor-pointer',
        )}
        aria-label="Change profile photo"
      >
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Profile photo"
            fill
            className="object-cover"
            sizes={`${size}px`}
            // Allow blob: previews via unoptimized
            unoptimized={!!previewUrl}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Camera className="w-1/3 h-1/3 text-gray-400" />
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <span className="text-[10px] text-white font-medium mt-1">{progress}%</span>
          </div>
        )}

        {/* Camera icon overlay (idle state) */}
        {!uploading && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-end justify-center pb-1.5">
            <div className="bg-black/60 rounded-full p-1 opacity-70">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        )}
      </button>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 max-w-[200px] text-center">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Label */}
      {!uploading && !error && <span className="text-xs text-gray-400">Tap to change photo</span>}
    </div>
  );
}
