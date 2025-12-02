import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Crop, ZoomIn, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useT } from "@/hooks/useT";

interface ImageCropDialogProps {
  imageUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCrop: (croppedImageBlob: Blob, cropArea: CropArea) => void;
  aspect?: number;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropDialog({
  imageUrl,
  open,
  onOpenChange,
  onCrop,
  aspect = 16 / 9,
}: ImageCropDialogProps) {
  const t = useT("modules/news");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  const onCropChange = (location: { x: number; y: number }) => {
    setCrop(location);
  };

  const onZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const onCropCompleteCallback = useCallback(
    (_croppedArea: CropArea, croppedAreaPx: CropArea) => {
      setCroppedAreaPixels(croppedAreaPx);
    },
    []
  );

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels, rotation);
      onCrop(croppedBlob, croppedAreaPixels);
      onOpenChange(false);
    } catch (error) {
      console.error("Error cropping image:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="w-5 h-5" />
            {t("forms.imageCrop.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zone de crop */}
          <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteCallback}
            />
          </div>

          {/* Contrôles */}
          <div className="space-y-4">
            {/* Zoom */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <ZoomIn className="w-4 h-4" />
                  <span>Zoom</span>
                </div>
                <span className="text-muted-foreground">{Math.round(zoom * 100)}%</span>
              </div>
              <Slider
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                min={1}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Rotation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4" />
                  <span>Rotation</span>
                </div>
                <span className="text-muted-foreground">{rotation}°</span>
              </div>
              <Slider
                value={[rotation]}
                onValueChange={(value) => setRotation(value[0])}
                min={0}
                max={360}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("forms.imageCrop.cancel")}
          </Button>
          <Button onClick={createCroppedImage}>
            {t("forms.imageCrop.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Crée une image recadrée à partir de la zone sélectionnée
 */
async function getCroppedImg(
  imageSrc: string,
  cropArea: CropArea,
  rotation: number
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // Calculer les dimensions du canvas pour la rotation
  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  // Translater et tourner le canvas
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // Dessiner l'image rotée
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // Régler le canvas à la taille finale
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;

  // Coller la zone recadrée
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - cropArea.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - cropArea.y)
  );

  // Convertir en blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      resolve(blob);
    }, "image/jpeg");
  });
}

/**
 * Charge une image et retourne un HTMLImageElement
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}