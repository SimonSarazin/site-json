import { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Point } from "react-easy-crop";
import { Camera, Loader2, Upload, ZoomIn, ZoomOut } from "lucide-react";
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

interface EditProfileImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentImage?: string;
}

export function EditProfileImageModal({
  open,
  onOpenChange,
  currentImage,
}: EditProfileImageModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateProfileImage } = useProfileMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: String(t("EditImage.error")),
        description: String(t("EditImage.invalidFileType")),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [previewUrl]);

  const handleSubmit = async () => {
    if (!selectedFile) return;

    try {
      await updateProfileImage.mutateAsync({ profil_avatar: selectedFile });

      toast({
        title: String(t("EditImage.success")),
        description: String(t("EditImage.profileImageUpdated")),
      });

      handleRemove();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile image:", error);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {String(t("EditImage.editProfileImage"))}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cropper Area */}
          <div className="space-y-2">
            <Label>{String(t("EditImage.selectImage"))}</Label>
            <div className="relative w-full h-64 rounded-lg overflow-hidden bg-muted border border-border">
              {previewUrl ? (
                <Cropper
                  image={previewUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                />
              ) : currentImage ? (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <img
                    src={currentImage}
                    alt="Current"
                    className="w-32 h-32 rounded-full object-cover border-2 border-border"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Upload className="w-10 h-10 mb-2" />
                  <span className="text-sm">
                    {String(t("EditImage.dragOrClick"))}
                  </span>
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
              {String(t("EditImage.imageRequirements"))}
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
            disabled={!selectedFile || updateProfileImage.isPending}
          >
            {updateProfileImage.isPending ? (
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
