import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Edit } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../../hooks/useProfileEntity";
import { useProfilPermissions } from "../../../hooks/useProfilPermissions";
import { EditProfileModal } from "../../profile-edit/EditProfileModal";
import { ProfileImageUpload } from "../../profile-edit/ProfileImageUpload";
import { EntityActionButtons } from "../../EntityActionButtons";
import { AddEntityDropdown } from "../../action-buttons/AddEntityDropdown";
import type { ProfileHeaderSection } from "../../../schema";

interface ProfileHeaderSimpleProps {
  section: ProfileHeaderSection;
}

/**
 * Variant Simple - Layout horizontal simple avec image à gauche
 */
export function ProfileHeaderSimple({ section }: ProfileHeaderSimpleProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");
  const navigate = useNavigate();
  const { imageUrl, logoUrl, name: entityName, shortDescription } = useFormatProfileEntity(entity);
  const { canEditProfile } = useProfilPermissions(entity);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const avatarImage = logoUrl || imageUrl;

  return (
    <div className="border-b border-border pb-6 mb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        {section.showBackButton !== false && (
          <Button onClick={() => navigate(-1)} variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("ProfileHeader.back")}
          </Button>
        )}

        <div className="flex gap-2">
          {section.showShareButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.share?.({
                  title: entityName,
                  url: window.location.href,
                });
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {t("ProfileHeader.share")}
            </Button>
          )}

          {canEditProfile && entity && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6 items-start">
        {/* Avatar with upload */}
        <div className="relative group">
          {avatarImage ? (
            <OptimizedImage
              src={avatarImage}
              alt={entityName}
              width={96}
              className="w-24 h-24 rounded-lg object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground">
                {entityName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Upload overlay */}
          {canEditProfile && section.allowUpload !== false && entity && (
            <div className="absolute inset-0 rounded-lg overflow-hidden">
              <ProfileImageUpload
                entity={entity}
                type="profile"
                currentUrl={avatarImage}
                overlayOnly={true}
                className="w-full h-full"
              />
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">{entityName}</h1>
          {shortDescription && (
            <p className="mt-2 text-muted-foreground">{shortDescription}</p>
          )}

          {/* Action Buttons */}
          {section.showActions !== false && entity && (
            <div className="flex gap-3 flex-wrap mt-4">
              <EntityActionButtons entity={entity} />

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

      {canEditProfile && entity && (
        <EditProfileModal
          entity={entity}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
        />
      )}
    </div>
  );
}
