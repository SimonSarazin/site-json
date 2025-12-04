import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Edit, Mail, ChevronRight, ImageIcon } from "lucide-react";
import { useFormatProfileEntity } from "../../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../../hooks/useProfileEntity";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { EditProfileModal } from "../../profile-edit/EditProfileModal";
import { ProfileImageUpload } from "../../profile-edit/ProfileImageUpload";
import { EntityActionButtons } from "../../EntityActionButtons";
import { AddEntityDropdown } from "../../action-buttons/AddEntityDropdown";
import { isUser } from "@/lib/getTypedEntity";
import type { ProfileHeaderSection } from "../../../schema";
import "@/modules/profil/i18n";
import { ButtonGroup } from "@/components/ui/button-group";

interface ProfileHeaderCompleteProps {
  section: ProfileHeaderSection;
}

export function ProfileHeaderComplete({ section }: ProfileHeaderCompleteProps) {
  const { entity } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const {
    imageUrl,
    logoUrl,
    logoThumbUrl,
    bannerUrl,
    name: entityName,
    address,
  } = useFormatProfileEntity(entity);
  const { canEditProfile } = useUserPermissions(entity);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!entity) return null;

  const effectiveLogoUrl = imageError ? logoThumbUrl : logoUrl;

  return (
    <>
      {/* Banner */}
      {section.showBanner !== false && (
        <div
          className="relative h-96 bg-cover bg-center rounded-md border-border border group"
          style={{ backgroundImage: bannerUrl ? `url('${bannerUrl}')` : `url('${imageUrl}')` }}
        >
          {/* Bouton d'upload de bannière */}
          {canEditProfile && section.allowUpload !== false && entity && (
            <div className="absolute inset-0 z-10">
              <ProfileImageUpload
                entity={entity}
                type="banner"
                currentUrl={bannerUrl || imageUrl}
                className="w-full h-full"
                overlayOnly={true}
              />
            </div>
          )}

          {section.showAllPhotosButton !== false && (
            <div className="absolute bottom-6 right-6 z-20">
              <Button>
                <ImageIcon className="w-4 h-4" />
                {t("ProfileTemplateDefault.showAllPhotos")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Avatar + Name + Actions */}
      <div className="relative px-8 pb-6">
        <div className="flex items-end gap-6 -mt-20">
          {/* Avatar */}
          {section.showAvatar !== false && (
            <div className="relative group z-20">
              <div className="w-40 h-40 rounded-full border-4 border-background bg-card shadow-xl overflow-hidden">
                {effectiveLogoUrl ? (
                  <img
                    src={effectiveLogoUrl}
                    alt={entityName}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/80">
                    <div className="text-center p-2">
                      <div className="text-4xl mb-1">✒️</div>
                      <div className="text-xs font-bold text-foreground leading-tight">
                        {entityName.split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bouton d'upload d'avatar */}
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

          <div className="flex-1 flex justify-between items-end pb-2 flex-wrap gap-4">
            {/* Nom + Localisation */}
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">{entityName}</h1>
              {section.showLocation !== false && address && (
                <p className="text-muted-foreground">
                  {address.addressLocality}
                  {address.postalCode && `, ${address.postalCode}`}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {section.showActions !== false && (
              <div className="flex gap-3 flex-wrap">
                <ButtonGroup>
                
                {/* Boutons d'action (Follow, Friend, Membership, etc.) */}
                <EntityActionButtons entity={entity} />

                {canEditProfile && (
                  <Button
                    variant="outline"
                    onClick={() => setEditModalOpen(true)}
                  >
                    <Edit />
                    <span className="hidden sm:inline">{t("ProfileTemplateDefault.editProfile")}</span>
                  </Button>
                )}


                {/* Dropdown pour créer des entités */}
                {section.showAddDropdown !== false && (
                  <AddEntityDropdown
                    entity={entity}
                    config={section.addConfig}
                    label={section.addDropdownLabel ? t(section.addDropdownLabel) : undefined}
                  />
                )}
                </ButtonGroup>

                {!isUser(entity) && (
                  <>
                    {section.showEmailButton !== false && entity.serverData?.email && typeof entity.serverData.email === "string" && (
                      <Button
                        variant="outline"
                        onClick={() => window.location.href = `mailto:${entity.serverData.email}`}
                      >
                        <Mail />
                        <span className="hidden sm:inline">{t("ProfileTemplateDefault.sendEmail")}</span>
                      </Button>
                    )}
                    {section.showReservationButton && (
                      <Button className="bg-primary hover:bg-primary/90">
                        <span className="hidden sm:inline">{t("ProfileTemplateDefault.reservationSpace")}</span>
                        <ChevronRight />
                      </Button>
                    )}
                  </>
                )}
                
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="mt-6 border-t border-border"></div>
      </div>

      {/* Edit Modal */}
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
