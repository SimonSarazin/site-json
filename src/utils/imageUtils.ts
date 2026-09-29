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
      URL.revokeObjectURL(img.src);

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

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/** Sous ce poids, une image part telle quelle : la ré-encoder n'en rognerait que la qualité. */
export const LIGHT_IMAGE_BYTES = 1024 * 1024;

/** Réglage des images d'actualité (`NewsFormImageUpload`) : 1 920 px couvrent la plus large bande d'un
 *  site (1 280 px) sur écran haute densité, et 0,85 reste sans perte visible. */
export const UPLOAD_COMPRESSION = { maxWidthOrHeight: 1920, quality: 0.85 };

/**
 * Allège une image avant envoi — une photo de téléphone de 8 Mo n'a rien à faire telle quelle en ligne.
 * Ne touche ni une image déjà légère, ni un format que le canvas abîmerait (GIF animé, SVG). Garde
 * l'original si la version compressée n'est pas plus légère, ou si la compression échoue : mieux vaut une
 * image lourde qu'une image perdue.
 */
export async function lightenImage(file: File, compress = compressImage): Promise<File> {
  if (!canCompressImage(file) || file.size <= LIGHT_IMAGE_BYTES) return file;
  try {
    const light = await compress(file, UPLOAD_COMPRESSION);
    return light.size < file.size ? light : file;
  } catch {
    return file;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
