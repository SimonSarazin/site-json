/**
 * Utilitaires partagés pour la validation et compression d'images
 * Extraits de NewsFormImageUpload pour réutilisation cross-module
 */

export interface ImageValidationConfig {
  maxSizeInMB: number;
  maxSizeInBytes: number;
  allowedTypes: string[];
}

export const DEFAULT_IMAGE_VALIDATION_CONFIG: ImageValidationConfig = {
  maxSizeInMB: 10,
  maxSizeInBytes: 10 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

export function validateImageFile(
  file: File,
  config: ImageValidationConfig = DEFAULT_IMAGE_VALIDATION_CONFIG
): { valid: boolean; error?: string } {
  if (!config.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Type de fichier non supporté' };
  }
  if (file.size > config.maxSizeInBytes) {
    return { valid: false, error: `Fichier trop volumineux (max ${config.maxSizeInMB}MB)` };
  }
  return { valid: true };
}

export function canCompressImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

export async function compressImage(
  file: File,
  options: { maxWidthOrHeight: number; quality: number } = { maxWidthOrHeight: 1920, quality: 0.85 }
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const { maxWidthOrHeight, quality } = options;
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidthOrHeight) {
          height = (height * maxWidthOrHeight) / width;
          width = maxWidthOrHeight;
        }
      } else {
        if (height > maxWidthOrHeight) {
          width = (width * maxWidthOrHeight) / height;
          height = maxWidthOrHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(
              new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              })
            );
          } else {
            reject(new Error('Compression failed'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
