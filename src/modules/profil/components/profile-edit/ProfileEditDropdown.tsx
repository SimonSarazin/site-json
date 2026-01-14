import { useState, useRef } from "react";
import { Edit, ImageIcon, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/useT";
import { useUploadProfileImage, useUploadProfileBanner } from "../../hooks/useProfileMutations";
import { ImageCropDialog } from "@/modules/news";
import type { EntityTypes } from "@communecter/cocolight-api-client";

interface ProfileEditDropdownProps {
  entity: EntityTypes;
  onEditProfile: () => void;
  showBannerOption?: boolean;
  showAvatarOption?: boolean;
  triggerClassName?: string;
}

/**
 * Dropdown pour les actions d'édition de profil
 * - Modifier le profil (ouvre modal)
 * - Changer la bannière (upload)
 * - Changer l'avatar (upload)
 */
export function ProfileEditDropdown({
  entity,
  onEditProfile,
  showBannerOption = true,
  showAvatarOption = true,
  triggerClassName,
}: ProfileEditDropdownProps) {
  const t = useT("modules/profil");
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"profile" | "banner">("profile");

  const uploadImageMutation = useUploadProfileImage(entity);
  const uploadBannerMutation = useUploadProfileBanner(entity);

  const isPending = uploadImageMutation.isPending || uploadBannerMutation.isPending;

  const handleBannerClick = () => {
    setUploadType("banner");
    bannerInputRef.current?.click();
  };

  const handleAvatarClick = () => {
    setUploadType("profile");
    avatarInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (
    croppedFile: File,
    cropArea?: { x: number; y: number; width: number; height: number }
  ) => {
    try {
      if (uploadType === "banner" && cropArea) {
        await uploadBannerMutation.mutateAsync({
          file: croppedFile,
          cropX: 0,
          cropY: 0,
          cropW: cropArea.width,
          cropH: cropArea.height,
        });
      } else {
        await uploadImageMutation.mutateAsync(croppedFile);
      }

      setCropDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);

      // Reset inputs
      if (bannerInputRef.current) bannerInputRef.current.value = "";
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className={triggerClassName}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Edit className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEditProfile}>
            <Edit className="w-4 h-4 mr-2" />
            {t("ProfileTemplateDefault.editProfile")}
          </DropdownMenuItem>
          {showBannerOption && (
            <DropdownMenuItem onClick={handleBannerClick}>
              <ImageIcon className="w-4 h-4 mr-2" />
              {t("ProfileEdit.changeBanner")}
            </DropdownMenuItem>
          )}
          {showAvatarOption && (
            <DropdownMenuItem onClick={handleAvatarClick}>
              <Camera className="w-4 h-4 mr-2" />
              {t("ProfileEdit.changeAvatar")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inputs file cachés */}
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Dialog de crop */}
      {previewUrl && selectedFile && (
        <ImageCropDialog
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          imageUrl={previewUrl}
          aspect={uploadType === "profile" ? 1 : 16 / 9}
          onCrop={(croppedBlob, cropArea) => {
            const file = new File([croppedBlob], selectedFile.name, {
              type: croppedBlob.type,
            });
            handleCropComplete(file, cropArea);
          }}
        />
      )}
    </>
  );
}
