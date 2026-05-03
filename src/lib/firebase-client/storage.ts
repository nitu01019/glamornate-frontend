import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  FirebaseStorage,
} from 'firebase/storage';
/** Generate a short random ID without external dependencies. */
function nanoid(length = 12): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, length);
}
import { getFirebaseApp } from './index';
import { errorLogger, ErrorCategory } from './error-logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_WIDTH = 1200;
const ALLOWED_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'] as const;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

// ---------------------------------------------------------------------------
// Storage singleton
// ---------------------------------------------------------------------------

let storageInstance: FirebaseStorage | null = null;

function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(getFirebaseApp());
  }
  return storageInstance;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateFile(file: File): void {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new StorageValidationError(
      `Invalid file type "${file.type}". Allowed types: JPEG, PNG, WebP.`,
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new StorageValidationError(
      `File is too large (${sizeMB} MB). Maximum allowed size is 5 MB.`,
    );
  }
}

function generateUniqueFilename(file: File): string {
  const ext = MIME_TO_EXT[file.type] ?? 'jpg';
  return `${nanoid(12)}.${ext}`;
}

// ---------------------------------------------------------------------------
// Image compression (client-side canvas resize)
// ---------------------------------------------------------------------------

function resizeImage(file: File, maxWidth: number = MAX_IMAGE_WIDTH): Promise<Blob> {
  return new Promise((resolve) => {
    // Skip resize for small images or non-browser environments
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Skip resize if image is already small enough
      if (img.width <= maxWidth) {
        resolve(file);
        return;
      }

      const ratio = maxWidth / img.width;
      const targetWidth = maxWidth;
      const targetHeight = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = file.type === 'image/png' ? undefined : 0.85;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        outputType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: return original file if image fails to load
      resolve(file);
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Core upload function
// ---------------------------------------------------------------------------

/**
 * Upload an image to Firebase Storage with automatic validation,
 * resizing, and unique filename generation.
 *
 * @param file       - The image file to upload
 * @param path       - Storage path prefix (e.g. "users/{uid}/profile")
 * @param onProgress - Optional callback receiving progress 0-100
 * @returns The public download URL of the uploaded image
 */
export async function uploadImage(
  file: File,
  path: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  validateFile(file);

  const resizedBlob = await resizeImage(file);
  const filename = generateUniqueFilename(file);
  const fullPath = `${path}/${filename}`;
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, fullPath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, resizedBlob, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(progress);
      },
      (error) => {
        errorLogger.log({
          category: ErrorCategory.STORAGE,
          caller: 'storage.ts',
          function: 'uploadImage',
          operation: `Upload to ${fullPath}`,
          error,
          context: { path: fullPath, fileType: file.type, fileSize: file.size },
        });
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (error) {
          errorLogger.log({
            category: ErrorCategory.STORAGE,
            caller: 'storage.ts',
            function: 'uploadImage',
            operation: `Get download URL for ${fullPath}`,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          reject(error);
        }
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Multi-upload
// ---------------------------------------------------------------------------

/**
 * Upload multiple images in parallel.
 *
 * @param files      - Array of image files
 * @param basePath   - Storage path prefix shared by all uploads
 * @param onProgress - Optional callback receiving aggregate progress 0-100
 * @returns Array of download URLs in the same order as the input files
 */
export async function uploadMultipleImages(
  files: File[],
  basePath: string,
  onProgress?: (progress: number) => void,
): Promise<string[]> {
  if (files.length === 0) return [];

  // Validate all files first, before starting any uploads
  for (const file of files) {
    validateFile(file);
  }

  const progressMap = new Map<number, number>();

  const reportAggregateProgress = () => {
    if (!onProgress) return;
    let total = 0;
    for (const p of progressMap.values()) {
      total += p;
    }
    onProgress(Math.round(total / files.length));
  };

  const uploadPromises = files.map((file, index) => {
    progressMap.set(index, 0);

    return uploadImage(file, basePath, (p) => {
      progressMap.set(index, p);
      reportAggregateProgress();
    });
  });

  return Promise.all(uploadPromises);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete an image from Firebase Storage by its download URL.
 *
 * @param url - The Firebase Storage download URL
 */
export async function deleteImage(url: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (error) {
    errorLogger.log({
      category: ErrorCategory.STORAGE,
      caller: 'storage.ts',
      function: 'deleteImage',
      operation: `Delete image at ${url}`,
      error: error instanceof Error ? error : new Error(String(error)),
      context: { url },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Get URL
// ---------------------------------------------------------------------------

/**
 * Get the download URL for a file at a given storage path.
 *
 * @param path - The full storage path (e.g. "users/{uid}/profile/abc.jpg")
 * @returns The public download URL
 */
export async function getImageUrl(path: string): Promise<string> {
  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    errorLogger.log({
      category: ErrorCategory.STORAGE,
      caller: 'storage.ts',
      function: 'getImageUrl',
      operation: `Get download URL for ${path}`,
      error: error instanceof Error ? error : new Error(String(error)),
      context: { path },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const storageService = {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  getImageUrl,
};

export { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES };
