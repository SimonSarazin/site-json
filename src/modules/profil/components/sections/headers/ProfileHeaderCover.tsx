import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../../hooks/useProfileEntity";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { EditProfileModal } from "../../profile-edit/EditProfileModal";
import { ProfileEditDropdown } from "../../profile-edit/ProfileEditDropdown";
import { EntityActionButtons } from "../../EntityActionButtons";
import { AddEntityDropdown } from "../../action-buttons/AddEntityDropdown";
import type { ProfileHeaderSection } from "../../../schema";
import { ButtonGroup } from "@/components/ui/button-group";

interface ProfileHeaderCoverProps {
  section: ProfileHeaderSection;
}

/**
 * Variant Cover - Image pleine largeur avec titre centré et overlay sombre
 */
export function ProfileHeaderCover({ section }: ProfileHeaderCoverProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");
  const navigate = useNavigate();
  const { imageUrl, bannerUrl, name: entityName, shortDescription } = useFormatProfileEntity(entity);
  const { canEditProfile } = useUserPermissions(entity);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const coverImage = bannerUrl || imageUrl;

  return (
    <>
      <div className="relative w-full h-80 md:h-96 overflow-hidden rounded-lg group mb-1">
        {/* Background image */}
        {coverImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${coverImage}')` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60" />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Top buttons */}
        <div className="absolute top-4 left-4 right-4 flex justify-between z-20">
          {section.showBackButton !== false && (
            <Button
              onClick={() => navigate(-1)}
              variant="secondary"
              size="sm"
              className="backdrop-blur-sm bg-background/80 hover:bg-background/90"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("ProfileHeader.back")}
            </Button>
          )}

          <div className="flex gap-2">
            {section.showShareButton && (
              <Button
                variant="secondary"
                size="sm"
                className="backdrop-blur-sm bg-background/80 hover:bg-background/90"
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

            {canEditProfile && entity && (
              <ProfileEditDropdown
                entity={entity}
                onEditProfile={() => setEditModalOpen(true)}
                triggerClassName="backdrop-blur-sm bg-background/80 hover:bg-background/90"
              />
            )}
          </div>
        </div>

        {/* Centered content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10 pointer-events-none">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            {entityName}
          </h1>
          {shortDescription && (
            <p className="text-lg md:text-xl text-white/90 max-w-2xl drop-shadow">
              {shortDescription}
            </p>
          )}

          {/* Action Buttons */}
          {section.showActions !== false && entity && (
            <div className="flex gap-3 flex-wrap mt-6 justify-center pointer-events-auto">
              <ButtonGroup>
              <EntityActionButtons entity={entity} />

              {section.showAddDropdown !== false && (
                <AddEntityDropdown
                  variant="secondary"
                  className="backdrop-blur-sm bg-background/80 hover:bg-background/90"
                  entity={entity}
                  config={section.addConfig}
                  label={section.addDropdownLabel ? t(section.addDropdownLabel) : undefined}
                />
              )}
              </ButtonGroup>
            </div>
          )}
        </div>

      </div>

      {canEditProfile && entity && (
        <EditProfileModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          entity={entity}
        />
      )}
    </>
  );
}
