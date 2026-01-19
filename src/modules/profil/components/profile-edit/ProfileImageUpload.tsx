import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useUploadProfileImage, useUploadProfileBanner } from "../../hooks/useProfileMutations";
import { ImageCropDialog } from "@/modules/news";
import type { EntityTypes } from "@communecter/cocolight-api-client";

interface ProfileImageUploadProps {
  entity: EntityTypes;
  type: "profile" | "banner";
  currentUrl?: string | null;
  className?: string;
  overlayOnly?: boolean; // Si true, affiche seulement le bouton sans l'image
}

/**
 * Composant pour uploader et cropper une image de profil ou bannière
 *
 * Features:
 * - Preview de l'image actuelle
 * - Upload immédiat au choix du fichier
 * - Crop avec ImageCropDialog
 * - Compression automatique
 * - Loading state pendant l'upload
 *
 * @param entity - L'entité dont on modifie l'image
 * @param type - Type d'image ('profile' pour photo, 'banner' pour bannière)
 * @param currentUrl - URL de l'image actuelle
 * @param className - Classes CSS additionnelles
 */
export function ProfileImageUpload({
  entity,
  type,
  currentUrl,
  className = "",
  overlayOnly = false,
}: ProfileImageUploadProps) {
  const t = useT("modules/profil");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  // Use the appropriate mutation based on type
  const uploadImageMutation = useUploadProfileImage(entity);
  const uploadBannerMutation = useUploadProfileBanner(entity);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier que c'est une image
    if (!file.type.startsWith("image/")) {
      return;
    }

    setSelectedFile(file);

    // Créer une preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedFile: File, cropArea?: { x: number; y: number; width: number; height: number }) => {
    try {
      // Upload avec les bonnes données selon le type
      if (type === "banner" && cropArea) {
        await uploadBannerMutation.mutateAsync({
          file: croppedFile,
          cropX: 0, // Image déjà croppée localement, pas de décalage
          cropY: 0, // Image déjà croppée localement, pas de décalage
          cropW: cropArea.width,
          cropH: cropArea.height,
        });
      } else {
        await uploadImageMutation.mutateAsync(croppedFile);
      }

      // Nettoyer
      setCropDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);

      // Reset l'input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const isProfile = type === "profile";
  const containerClasses = isProfile
    ? "w-32 h-32 rounded-full"
    : "w-full h-40 rounded-lg";

  const isPending = type === "banner" ? uploadBannerMutation.isPending : uploadImageMutation.isPending;

  return (
    <>
      <div className={`relative group ${className}`}>
        {/* Preview de l'image actuelle ou placeholder (sauf si overlayOnly) */}
        {!overlayOnly && (
          <div className={`${containerClasses} overflow-hidden bg-muted flex items-center justify-center`}>
            {currentUrl ? (
              <img
                src={currentUrl}
                alt={isProfile ? t("ProfileEdit.profileImage") : t("ProfileEdit.bannerImage")}
                className="w-full h-full object-cover"
              />
            ) : (
              <Camera className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        )}

        {/* Overlay au hover avec bouton */}
        <div className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isProfile ? 'rounded-full' : ''}`}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleClickUpload}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("ProfileEdit.uploading")}
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" />
                {t("ProfileEdit.changeImage")}
              </>
            )}
          </Button>
        </div>

        {/* Input file caché */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Dialog de crop */}
      {previewUrl && selectedFile && (
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          imageUrl={previewUrl}
          aspect={type === "profile" ? 1 : 16 / 9}
          onCrop={(croppedBlob, cropArea) => {
            // Convert blob to file for handleCropComplete
            const file = new File([croppedBlob], selectedFile.name, { type: croppedBlob.type });
            handleCropComplete(file, cropArea);
          }}
        />
      )}
    </>
  );
}
