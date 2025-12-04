import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Edit } from "lucide-react";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../../hooks/useProfileEntity";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { EditProfileModal } from "../../profile-edit/EditProfileModal";
import { ProfileImageUpload } from "../../profile-edit/ProfileImageUpload";
import { EntityActionButtons } from "../../EntityActionButtons";
import { AddEntityDropdown } from "../../action-buttons/AddEntityDropdown";
import type { ProfileHeaderSection } from "../../../schema";
import "@/modules/profil/i18n";

interface ProfileHeaderHeroProps {
  section: ProfileHeaderSection;
}

/**
 * Variant Hero - Image de fond avec titre en overlay
 */
export function ProfileHeaderHero({ section }: ProfileHeaderHeroProps) {
  const { entity } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const navigate = useNavigate();
  const { imageUrl, bannerUrl, name: entityName, shortDescription } = useFormatProfileEntity(entity);
  const { canEditProfile } = useUserPermissions(entity);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const coverImage = bannerUrl || imageUrl;

  return (
    <>
      <div className="relative w-full group">
        {coverImage ? (
          <div className="relative h-64 md:h-96 w-full overflow-hidden">
            <img
              src={coverImage}
              alt={entityName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Upload overlay for editing - appears on hover */}
            {canEditProfile && section.allowUpload !== false && entity && (
              <div className="absolute inset-0 z-15 pointer-events-none group-hover:pointer-events-auto">
                <ProfileImageUpload
                  entity={entity}
                  type="banner"
                  currentUrl={coverImage}
                  className="w-full h-full"
                  overlayOnly={true}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-br from-muted to-muted/80" />
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

          <div className="flex gap-2">
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

            {canEditProfile && entity && (
              <Button
                variant="secondary"
                size="sm"
                className="backdrop-blur-sm bg-background/90 hover:bg-background"
                onClick={() => setEditModalOpen(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`${coverImage ? "absolute bottom-0 left-0 right-0" : ""} p-6 md:p-8`}>
          <h1 className={`text-3xl md:text-4xl font-bold ${coverImage ? "text-white" : "text-foreground"}`}>
            {entityName}
          </h1>
          {shortDescription && (
            <p className={`mt-2 text-lg ${coverImage ? "text-white/90" : "text-muted-foreground"}`}>
              {shortDescription}
            </p>
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
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          entity={entity}
        />
      )}
    </>
  );
}
