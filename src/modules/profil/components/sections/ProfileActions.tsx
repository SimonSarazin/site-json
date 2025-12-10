import { useState } from "react";
import { Edit, Mail, ChevronRight } from "lucide-react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { EntityActionButtons } from "../EntityActionButtons";
import { EditProfileModal } from "../profile-edit/EditProfileModal";
import { AddEntityDropdown } from "../action-buttons/AddEntityDropdown";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import type { ProfileActionsSection } from "../../schema";

interface ProfileActionsProps {
  section: ProfileActionsSection;
}

/**
 * Section pour afficher les boutons d'action du profil
 * Extrait du ProfileTemplateDefault (lignes 173-207)
 */
export default function ProfileActions({ section }: ProfileActionsProps) {
  const { entity } = useProfileEntity();
  const { canEditProfile } = useUserPermissions(entity);
  const t = useT("modules/profil");
  const [editModalOpen, setEditModalOpen] = useState(false);

  const {
    showEditButton = true,
    showEntityActions = true,
    showEmailButton = true,
    showReservationButton = false,
    showAddDropdown = true,
    addConfig,
    addDropdownLabel,
    emailButtonLabel,
    reservationButtonLabel,
    layout = "horizontal",
  } = section;

  if (!entity) return null;

  const entityType = entity.getEntityType?.();
  const isUser = entityType === "citoyens";

  // Classes CSS selon le layout
  const layoutClasses = {
    horizontal: "flex gap-3 flex-wrap",
    vertical: "flex flex-col gap-3",
    grid: "grid grid-cols-2 gap-3",
  };

  return (
    <>
      <div className={layoutClasses[layout]}>
        {/* Bouton Edit Profile */}
        {showEditButton && canEditProfile && (
          <Button
            variant="outline"
            onClick={() => setEditModalOpen(true)}
          >
            <Edit className="w-4 h-4" />
            {t("ProfileTemplateDefault.editProfile")}
          </Button>
        )}

        {/* Boutons d'action d'entité (Follow, Friend, Membership, etc.) */}
        {showEntityActions && <EntityActionButtons entity={entity} />}

        {/* Dropdown pour créer des entités */}
        {showAddDropdown && (
          <AddEntityDropdown
            entity={entity}
            config={addConfig}
            label={addDropdownLabel ? t(addDropdownLabel) : undefined}
          />
        )}

        {/* Boutons email et réservation (seulement pour non-users) */}
        {!isUser && (
          <>
            {/* Bouton Email */}
            {showEmailButton && entity.serverData?.email && typeof entity.serverData.email === "string" && (
              <Button
                variant="outline"
                onClick={() => window.location.href = `mailto:${entity.serverData.email}`}
              >
                <Mail className="w-4 h-4" />
                {emailButtonLabel ? t(emailButtonLabel) : t("ProfileTemplateDefault.sendEmail")}
              </Button>
            )}

            {/* Bouton Réservation */}
            {showReservationButton && (
              <Button className="bg-primary hover:bg-primary/90">
                {reservationButtonLabel ? t(reservationButtonLabel) : t("ProfileTemplateDefault.reservationSpace")}
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Modal d'édition du profil */}
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
