import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useT } from "@/hooks/useT";
import { useUploadProfileImage, useUploadProfileBanner } from "../../hooks/useProfileMutations";
import { ImageCropDialog } from "@/modules/news";
import type { AspectOption } from "@/modules/news/components/forms/ImageCropDialog";
import { padFileToSquare } from "../../lib/padToSquare";
import { fitWithin, lightenImage, UPLOAD_COMPRESSION } from "@/utils/imageUtils";
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
 * - Crop avec ImageCropDialog — avatar comme bannière : au format choisi (photo d'origine par
 *   défaut) ou envoyée entière, pour garder la taille de la photo ; la photo de profil est
 *   complétée en carré transparent si besoin (entière partout, cf. `padFileToSquare`)
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

  // Format libre parmi des ratios usuels, la photo d'origine en premier (sélection par défaut).
  const formatsImage: AspectOption[] = [
    { label: t("ProfileEdit.imageFormat.original"), value: "original" },
    { label: t("ProfileEdit.imageFormat.wide"), value: 16 / 9 },
    { label: t("ProfileEdit.imageFormat.panorama"), value: 3 },
    { label: t("ProfileEdit.imageFormat.classic"), value: 4 / 3 },
    { label: t("ProfileEdit.imageFormat.square"), value: 1 },
  ];

  // Photo envoyée telle quelle : le fichier d'origine — pour la bannière, avec une zone de recadrage qui
  // couvre toute la photo, la copie que le backend en tire (`profilBannerUrl`) garde donc la même taille.
  // Dimensions lues par le recadreur (`onMediaLoaded`) : pas de second décodage de la photo.
  const handleUseOriginal = (taille: { width: number; height: number }) => {
    if (!selectedFile) return;
    void handleCropComplete(selectedFile, { x: 0, y: 0, ...taille });
  };

  const handleCropComplete = async (croppedFile: File, cropArea?: { x: number; y: number; width: number; height: number }) => {
    try {
      // Upload avec les bonnes données selon le type
      if (type === "banner" && cropArea) {
        // Bannière allégée avant l'envoi (`lightenImage` : au-delà de 1 Mo, plus grand côté ramené à
        // 1920 px) : envoyée à sa taille d'origine, une photo d'appareil (15 Mo, 6875×4544) dépasse la
        // taille de requête de PHP et le backend ne reçoit aucun fichier. La zone de recadrage suit les
        // dimensions du fichier ENVOYÉ ; `lightenImage` rend la photo telle quelle (même référence)
        // quand elle est légère, quand la réduction ne gagne rien ou quand elle échoue.
        const fichier = await lightenImage(croppedFile);
        const taille =
          fichier === croppedFile
            ? cropArea
            : fitWithin(cropArea.width, cropArea.height, UPLOAD_COMPRESSION.maxWidthOrHeight);
        await uploadBannerMutation.mutateAsync({
          file: fichier,
          cropX: 0, // Image déjà croppée localement, pas de décalage
          cropY: 0, // Image déjà croppée localement, pas de décalage
          cropW: taille.width,
          cropH: taille.height,
        });
      } else {
        // Allégée PUIS carrée à l'envoi, même au format « Original » : cf. `padFileToSquare`. L'allègement
        // vient d'abord pour que les deux cas où la mise au carré rend le fichier tel quel — photo déjà
        // carrée, mise au carré en échec (décodage, canvas refusé) — ne partent pas à pleine taille, comme
        // la bannière : un JPEG 4000×4000 de 12 Mo dépasserait la taille de requête de PHP.
        const legere = await lightenImage(croppedFile);
        const fichier = await padFileToSquare(legere).catch((error) => {
          console.warn("Photo de profil non mise au carré, envoyée telle quelle :", error);
          return legere;
        });
        await uploadImageMutation.mutateAsync(fichier);
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
      // Le dialogue est déjà fermé (« Utiliser l'image entière » le ferme au clic) : sans remise à zéro,
      // rechoisir la MÊME photo pour réessayer ne déclencherait aucun `change`.
      if (fileInputRef.current) fileInputRef.current.value = "";
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
              <OptimizedImage
                src={currentUrl}
                alt={isProfile ? t("ProfileEdit.profileImage") : t("ProfileEdit.bannerImage")}
                width={isProfile ? 128 : 800}
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
          aspectOptions={formatsImage}
          onUseOriginal={handleUseOriginal}
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
