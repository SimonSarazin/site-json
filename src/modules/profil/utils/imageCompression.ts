/**
 * Utilitaires de compression d'images
 */

export interface CompressionOptions {
  maxWidthOrHeight?: number;
  quality?: number; // 0 à 1
  mimeType?: string;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidthOrHeight: 1920,
  quality: 0.8,
  mimeType: "image/jpeg",
};

/**
 * Compresse une image en utilisant Canvas
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Calculer les nouvelles dimensions
          let { width, height } = img;
          const maxSize = opts.maxWidthOrHeight || 1920;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          // Créer un canvas
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          // Dessiner l'image redimensionnée
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir en blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Could not compress image"));
                return;
              }

              // Créer un nouveau fichier à partir du blob
              const compressedFile = new File([blob], file.name, {
                type: opts.mimeType || file.type,
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            opts.mimeType,
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error("Could not load image"));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Could not read file"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresse plusieurs images en parallèle avec callback de progression
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<File[]> {
  const compressedFiles: File[] = [];
  let completed = 0;

  for (const file of files) {
    try {
      const compressed = await compressImage(file, options);
      compressedFiles.push(compressed);
    } catch (error) {
      console.error(`Failed to compress ${file.name}:`, error);
      // En cas d'erreur, garder le fichier original
      compressedFiles.push(file);
    }

    completed++;
    if (onProgress) {
      onProgress(completed, files.length);
    }
  }

  return compressedFiles;
}

/**
 * Calcule le taux de compression
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100);
}

/**
 * Vérifie si un fichier est une image qui peut être compressée
 */
export function canCompressImage(file: File): boolean {
  const compressibleTypes = ["image/jpeg", "image/png", "image/webp"];
  return compressibleTypes.includes(file.type);
}
