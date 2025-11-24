import { useState } from "react";
import { Edit, Mail, ChevronRight, ImageIcon } from "lucide-react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { useT } from "@/hooks/useT";
import { EntityActionButtons } from "../EntityActionButtons";
import { ProfileImageUpload } from "../profile-edit/ProfileImageUpload";
import { EditProfileModal } from "../profile-edit/EditProfileModal";
import type { ProfileHeaderCompleteSection } from "../../schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

interface ProfileHeaderCompleteProps {
  section: ProfileHeaderCompleteSection;
}

/**
 * Section header complète extraite de ProfileTemplateDefault (lignes 103-211)
 * Contient: Banner + Avatar + Nom + Localisation + Action Buttons
 */
export default function ProfileHeaderComplete({ section }: ProfileHeaderCompleteProps) {
  const { entity } = useProfileEntity();
  const {
    logoUrl,
    logoThumbUrl,
    bannerUrl,
    name: entityName,
    address
  } = useFormatProfileEntity(entity);
  const { canEditProfile } = useUserPermissions(entity);
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const {
    showBanner = true,
    showAvatar = true,
    showLocation = true,
    showActions = true,
  } = section;

  if (!entity) return null;

  const effectiveLogoUrl = imageError ? logoThumbUrl : logoUrl;
  const imageUrl = logoUrl;
  const entityType = entity.getEntityType?.();
  const isUser = entityType === "citoyens";

  return (
    <>
      {/* Banner */}
      {showBanner && (
        <div
          className="relative h-96 bg-cover bg-center rounded-md border-border border group"
          style={{ backgroundImage: bannerUrl ? `url('${bannerUrl}')` : `url('${imageUrl}')` }}
        >
          {/* Bouton d'upload de bannière */}
          {canEditProfile && entity && (
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

          <div className="absolute bottom-6 right-6 z-20">
            <button className="bg-card text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-md border border-border">
              <ImageIcon className="w-4 h-4" />
              {t("ProfileTemplateDefault.showAllPhotos")}
            </button>
          </div>
        </div>
      )}

      {/* Avatar + Name + Actions */}
      <div className="relative px-8 pb-6">
        <div className="flex items-end gap-6 -mt-20">
          {/* Avatar */}
          {showAvatar && (
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
                  <div className="w-full h-full flex items-center justify-center from-yellow-100 to-yellow-50">
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
              {canEditProfile && entity && (
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
              {showLocation && address && (
                <p className="text-muted-foreground">
                  {address.addressLocality}
                  {address.postalCode && `, ${address.postalCode}`}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {showActions && (
              <div className="flex gap-3 flex-wrap">
                {canEditProfile && (
                  <button
                    onClick={() => setEditModalOpen(true)}
                    className="px-5 py-2.5 border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
                  >
                    <Edit className="w-4 h-4" />
                    {t("ProfileTemplateDefault.editProfile")}
                  </button>
                )}

                {/* Boutons d'action (Follow, Friend, Membership, etc.) */}
                <EntityActionButtons entity={entity} />

                {!isUser && (
                  <>
                    {entity.serverData?.email && typeof entity.serverData.email === "string" && (
                      <button
                        onClick={() => window.location.href = `mailto:${entity.serverData.email}`}
                        className="px-5 py-2.5 border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
                      >
                        <Mail className="w-4 h-4" />
                        {t("ProfileTemplateDefault.sendEmail")}
                      </button>
                    )}
                    <button
                      className="px-5 py-2.5 bg-[#0092a2] text-white rounded-lg text-sm font-medium hover:bg-teal-600 flex items-center gap-2 shadow-sm"
                    >
                      {t("ProfileTemplateDefault.reservationSpace")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
      {canEditProfile && (
        <EditProfileModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          entity={entity}
        />
      )}
    </>
  );
}
