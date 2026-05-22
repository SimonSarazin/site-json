import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Edit } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../../hooks/useProfilPermissions";
import { DynamicEditModal } from "../../profile-edit/EditModalRegistry";
import { ProfileImageUpload } from "../../profile-edit/ProfileImageUpload";
import { EntityActionButtons } from "../../EntityActionButtons";
import { AddEntityDropdown } from "../../action-buttons/AddEntityDropdown";
import type { ProfileHeaderSection } from "../../../schema";

interface ProfileHeaderBannerOverlayProps {
  section: ProfileHeaderSection;
}

/**
 * Variant Banner-Overlay - Banner avec avatar qui chevauche
 * Similaire à complete avec les boutons d'action
 */
export function ProfileHeaderBannerOverlay({ section }: ProfileHeaderBannerOverlayProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");
  const navigate = useNavigate();
  const {
    imageUrl,
    logoUrl,
    logoThumbUrl,
    bannerUrl,
    name: entityName,
    address,
  } = useFormatProfileEntity(entity);
  const { canEditProfile } = useProfilPermissions(entity);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const effectiveLogoUrl = imageError ? logoThumbUrl : logoUrl;
  const coverImage = bannerUrl || imageUrl;

  return (
    <>
      {/* Banner */}
      {section.showBanner !== false && (
        <div className="relative h-64 rounded-md border-border border group overflow-hidden bg-muted">
          {coverImage ? (
            <OptimizedImage
              src={coverImage}
              alt={`${entityName} banner`}
              width={1200}
              priority
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/80 rounded-md" />
          )}

          {/* Upload overlay */}
          {canEditProfile && section.allowUpload !== false && entity && (
            <div className="absolute inset-0 z-10">
              <ProfileImageUpload
                entity={entity}
                type="banner"
                currentUrl={coverImage}
                className="w-full h-full"
                overlayOnly={true}
              />
            </div>
          )}

          {/* Top buttons */}
          <div className="absolute top-4 left-4 right-4 flex justify-between z-20">
            {section.showBackButton !== false && (
              <Button
                onClick={() => navigate(-1)}
                variant="secondary"
                size="sm"
                className="backdrop-blur-sm bg-background/90 hover:bg-background"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("ProfileHeader.back")}
              </Button>
            )}

            {section.showShareButton && (
              <Button
                variant="secondary"
                size="sm"
                className="backdrop-blur-sm bg-background/90 hover:bg-background"
                onClick={() => {
                  navigator.share?.({
                    title: entityName,
                    url: window.location.href,
                  });
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Avatar + Name */}
      <div className="relative px-6 pb-4">
        <div className="flex items-end gap-4 -mt-12">
          {/* Avatar */}
          {section.showAvatar !== false && (
            <div className="relative group z-20">
              <div className="w-24 h-24 rounded-full border-4 border-background bg-card shadow-lg overflow-hidden">
                {effectiveLogoUrl ? (
                  <OptimizedImage
                    src={effectiveLogoUrl}
                    alt={entityName}
                    width={96}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {entityName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Upload avatar */}
              {canEditProfile && section.allowUpload !== false && entity && (
                <div className="absolute inset-0 rounded-full">
                  <ProfileImageUpload
                    entity={entity}
                    type="profile"
                    currentUrl={effectiveLogoUrl}
                    overlayOnly={true}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>
          )}

          {/* Name + Location + Actions */}
          <div className="flex-1 flex justify-between items-end pb-1 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{entityName}</h1>
              {section.showLocation !== false && address && (
                <p className="text-sm text-muted-foreground">
                  {address.addressLocality}
                  {address.postalCode && `, ${address.postalCode}`}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {section.showActions !== false && entity && (
              <div className="flex gap-3 flex-wrap">
                {canEditProfile && (
                  <Button
                    variant="outline"
                    onClick={() => setEditModalOpen(true)}
                  >
                    <Edit className="w-4 h-4" />
                    {t("ProfileTemplateDefault.editProfile")}
                  </Button>
                )}

                {/* Boutons d'action (Follow, Friend, Membership, etc.) */}
                <EntityActionButtons entity={entity} />

                {/* Dropdown pour créer des entités */}
                {section.showAddDropdown !== false && (
                  <AddEntityDropdown
                    entity={entity}
                    config={section.addConfig}
                    label={section.addDropdownLabel ? t(section.addDropdownLabel) : undefined}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="mt-4 border-t border-border"></div>
      </div>

      {canEditProfile && entity && (
        <DynamicEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          entity={entity}
        />
      )}
    </>
  );
}
