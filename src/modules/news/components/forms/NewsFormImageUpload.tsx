import { useState, useRef, useCallback } from "react";
import { ImagePlus, X, Loader2, Crop, Upload } from "lucide-react";
import { useT } from "@/hooks/useT";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ImageCropDialog } from "./ImageCropDialog";

// Temporary validation config - should be shared with profil module
const IMAGE_VALIDATION_CONFIG = {
  maxSizeInMB: 10,
  maxSizeInBytes: 10 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

const validateFile = (file: File, config: typeof IMAGE_VALIDATION_CONFIG) => {
  if (!config.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }
  if (file.size > config.maxSizeInBytes) {
    return { valid: false, error: 'File too large' };
  }
  return { valid: true };
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const canCompressImage = (file: File): boolean => {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
};

const compressImage = async (file: File, options: { maxWidthOrHeight: number; quality: number }): Promise<File> => {
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
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
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
};

const getCompressionRatio = (originalSize: number, compressedSize: number): number => {
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
};

interface NewsFormImageUploadProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
}

export function NewsFormImageUpload({
  images,
  onImagesChange,
  maxImages = 10,
}: NewsFormImageUploadProps) {

  const t = useT("modules/news");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [processingFiles, setProcessingFiles] = useState<{ [key: string]: number }>({});
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageData, setCropImageData] = useState<{ preview: string; fileName: string; index: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback(async (files: File[]) => {
    // Filtrer et valider les fichiers
    const validFiles: File[] = [];
    let hasErrors = false;

    files.forEach((file) => {
      // Vérifier le type
      if (!file.type.startsWith("image/")) {
        toast.error(t("toast.error.generic") + ": " + file.name);
        hasErrors = true;
        return;
      }

      // Valider la taille
      const validation = validateFile(file, IMAGE_VALIDATION_CONFIG);
      if (!validation.valid) {
        toast.error(
          `Fichier trop volumineux: ${file.name} (max: ${IMAGE_VALIDATION_CONFIG.maxSizeInMB}MB)`
        );
        hasErrors = true;
        return;
      }

      validFiles.push(file);
    });

    if (images.length + validFiles.length > maxImages) {
      toast.error(`Maximum ${maxImages} images autorisées`);
      return;
    }

    if (validFiles.length === 0 && hasErrors) {
      return;
    }

    // Traiter chaque fichier avec compression et progression
    const processedFiles: File[] = [];

    for (const file of validFiles) {
      const fileKey = `${file.name}-${file.size}`;
      const originalSize = file.size;

      // Démarrer la progression
      setProcessingFiles((prev) => ({ ...prev, [fileKey]: 0 }));

      let processedFile = file;

      // Compresser si possible
      if (canCompressImage(file)) {
        try {
          setProcessingFiles((prev) => ({ ...prev, [fileKey]: 30 }));

          processedFile = await compressImage(file, {
            maxWidthOrHeight: 1920,
            quality: 0.85,
          });

          const compressedSize = processedFile.size;
          const ratio = getCompressionRatio(originalSize, compressedSize);

          setProcessingFiles((prev) => ({ ...prev, [fileKey]: 60 }));

          if (import.meta.env.DEV) {
            console.log(`Compressed ${file.name}: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (-${ratio}%)`);
          }
        } catch (error) {
          console.error(`Compression failed for ${file.name}:`, error);
          // En cas d'erreur, garder le fichier original
          processedFile = file;
        }
      }

      // Créer la preview
      setProcessingFiles((prev) => ({ ...prev, [fileKey]: 80 }));

      const reader = new FileReader();
      const previewPromise = new Promise<void>((resolve) => {
        reader.onloadend = () => {
          setPreviews((prev) => [...prev, reader.result as string]);
          resolve();
        };
        reader.readAsDataURL(processedFile);
      });

      await previewPromise;

      processedFiles.push(processedFile);

      // Compléter
      setProcessingFiles((prev) => ({ ...prev, [fileKey]: 100 }));

      // Nettoyer après un court délai
      setTimeout(() => {
        setProcessingFiles((prev) => {
          const newState = { ...prev };
          delete newState[fileKey];
          return newState;
        });
      }, 500);
    }

    const newImages = [...images, ...processedFiles];
    onImagesChange(newImages);
  }, [images, maxImages, onImagesChange, t]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
    if (event.target) event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    onImagesChange(newImages);
    setPreviews(newPreviews);
  };

  const handleCropImage = (index: number) => {
    setCropImageData({
      preview: previews[index],
      fileName: images[index].name,
      index,
    });
    setCropDialogOpen(true);
  };

  const handleCropComplete = async (croppedFile: File) => {
    if (!cropImageData) return;

    const { index } = cropImageData;

    // Remplacer l'image et la preview
    const newImages = [...images];
    newImages[index] = croppedFile;
    onImagesChange(newImages);

    // Créer une nouvelle preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const newPreviews = [...previews];
      newPreviews[index] = reader.result as string;
      setPreviews(newPreviews);
    };
    reader.readAsDataURL(croppedFile);

    setCropImageData(null);
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border bg-muted/30",
          images.length >= maxImages && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className={cn(
            "p-2 rounded-full transition-colors",
            isDragging ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {isDragging ? (
              <Upload className="w-5 h-5" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">
              {t("forms.imageUpload.label")}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              {images.length}/{maxImages} • PNG, JPG, GIF
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={images.length >= maxImages}
      />

      {/* Indicateurs de progression */}
      {Object.keys(processingFiles).length > 0 && (
        <div className="space-y-2">
          {Object.entries(processingFiles).map(([fileKey, progress]) => {
            const fileName = fileKey.split('-')[0];
            return (
              <div key={fileKey} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    <span className="truncate max-w-[200px]">{fileName}</span>
                  </div>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1" />
              </div>
            );
          })}
        </div>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((preview, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-border"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCropImage(index);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2"
                  title="Recadrer"
                >
                  <Crop className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(index);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2"
                  title="Supprimer"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de crop */}
      {cropImageData && (
        <ImageCropDialog
          imageUrl={cropImageData.preview}
          onCrop={(blob, _cropArea) => {
            // Convert blob to file
            const file = new File([blob], cropImageData.fileName, { type: blob.type });
            handleCropComplete(file);
          }}
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
        />
      )}
    </div>
  );
}