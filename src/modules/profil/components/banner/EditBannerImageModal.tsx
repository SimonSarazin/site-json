import { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { ImageIcon, Loader2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { useToast } from "@/hooks/use-toast";

interface EditBannerImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentImage?: string;
}

export function EditBannerImageModal({
  open,
  onOpenChange,
  currentImage,
}: EditBannerImageModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateBannerImage } = useProfileMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const ASPECT_RATIO = 16 / 9;

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: String(t("EditImage.error")),
        description: String(t("EditImage.invalidFileType")),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: String(t("EditImage.error")),
        description: String(t("EditImage.fileTooLarge")),
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, [t, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [previewUrl]);

  const handleSubmit = async () => {
    if (!selectedFile || !croppedAreaPixels) return;

    try {
      await updateBannerImage.mutateAsync({
        banner: selectedFile,
        cropX: Math.round(croppedAreaPixels.x),
        cropY: Math.round(croppedAreaPixels.y),
        cropW: Math.round(croppedAreaPixels.width),
        cropH: Math.round(croppedAreaPixels.height),
      });

      toast({
        title: String(t("EditImage.success")),
        description: String(t("EditImage.bannerImageUpdated")),
      });

      handleRemove();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating banner image:", error);
      toast({
        title: String(t("EditImage.error")),
        description: String(t("EditImage.updateFailed")),
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    handleRemove();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            {String(t("EditImage.editBannerImage"))}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cropper Area */}
          <div className="space-y-2">
            <Label>{String(t("EditImage.selectImage"))}</Label>
            <div className="relative w-full h-72 rounded-lg overflow-hidden bg-muted border border-border">
              {previewUrl ? (
                <Cropper
                  image={previewUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={ASPECT_RATIO}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              ) : currentImage ? (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <img
                    src={currentImage}
                    alt="Current banner"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Upload className="w-10 h-10 mb-2" />
                  <span className="text-sm">
                    {String(t("EditImage.dragOrClick"))}
                  </span>
                  <span className="text-xs mt-1">Ratio 16:9</span>
                </div>
              )}
            </div>
          </div>

          {/* Zoom Controls */}
          {previewUrl && (
            <div className="space-y-2">
              <Label>{String(t("EditImage.zoom") || "Zoom")}</Label>
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[zoom]}
                  onValueChange={([value]) => setZoom(value)}
                  min={1}
                  max={3}
                  step={0.1}
                  className="flex-1"
                />
                <ZoomIn className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Upload Button */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full gap-2"
            >
              <Upload className="w-4 h-4" />
              {previewUrl
                ? String(t("EditImage.changeImage"))
                : String(t("EditImage.selectImage"))
              }
            </Button>
            <p className="text-xs text-muted-foreground">
              {String(t("EditImage.bannerRequirements"))}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            {String(t("EditAbout.cancel"))}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedFile || !croppedAreaPixels || updateBannerImage.isPending}
          >
            {updateBannerImage.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {String(t("EditAbout.saving"))}
              </>
            ) : (
              String(t("EditAbout.save"))
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
