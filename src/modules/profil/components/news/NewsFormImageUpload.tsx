import { useState, useRef, useCallback } from "react";
import { ImagePlus, X, Upload } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

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
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = useCallback((files: File[]) => {
    const validFiles = files.filter((file) => file.type.startsWith("image/"));

    if (images.length + validFiles.length > maxImages) {
      alert(`Vous ne pouvez ajouter que ${maxImages} images maximum`);
      return;
    }

    const newImages = [...images, ...validFiles];
    onImagesChange(newImages);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, [images, maxImages, onImagesChange]);

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
              {t("AddNewsModal.form.images.button")}
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

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((preview, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-border"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
