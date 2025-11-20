import { useState, useRef } from "react";
import { ImagePlus, X, Loader2, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { toast } from "sonner";
import { validateFile, IMAGE_VALIDATION_CONFIG, formatFileSize } from "../../utils/fileValidation";
import { compressImage, canCompressImage, getCompressionRatio } from "../../utils/imageCompression";
import { Progress } from "@/components/ui/progress";
import { ImageCropDialog } from "./ImageCropDialog";

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

  const t = useT("modules/profil");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [processingFiles, setProcessingFiles] = useState<{ [key: string]: number }>({});
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageData, setCropImageData] = useState<{ preview: string; fileName: string; index: number } | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    // Filtrer et valider les fichiers
    const validFiles: File[] = [];
    let hasErrors = false;

    files.forEach((file) => {
      // Vérifier le type
      if (!file.type.startsWith("image/")) {
        toast.error(t("upload.errors.invalidFileType", undefined, { fileName: file.name }));
        hasErrors = true;
        return;
      }

      // Valider la taille
      const validation = validateFile(file, IMAGE_VALIDATION_CONFIG);
      if (!validation.valid) {
        toast.error(
          t("upload.errors.fileTooLarge", undefined, {
            fileName: file.name,
            maxSize: IMAGE_VALIDATION_CONFIG.maxSizeInMB,
          })
        );
        hasErrors = true;
        return;
      }

      validFiles.push(file);
    });

    if (images.length + validFiles.length > maxImages) {
      toast.error(t("AddNewsModal.form.images.maxReached", undefined, { max: maxImages }));
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

          console.log(`Compressed ${file.name}: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (-${ratio}%)`);
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
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= maxImages}
          className="text-xs w-full sm:text-sm"
        >
          <ImagePlus className="w-4 h-4 mr-2" />
          {t("AddNewsModal.form.images.button")}
        </Button>
        {images.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {images.length}/{maxImages}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-24 sm:h-32 object-cover rounded-lg border border-border"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCropImage(index)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2"
                  title="Recadrer"
                >
                  <Crop className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
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
          image={cropImageData.preview}
          fileName={cropImageData.fileName}
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
