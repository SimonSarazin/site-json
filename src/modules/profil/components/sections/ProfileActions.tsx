import { useState } from "react";
import { Edit, Mail, ChevronRight } from "lucide-react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { EntityActionButtons } from "../EntityActionButtons";
import { EditProfileModal } from "../profile-edit/EditProfileModal";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import type { ProfileActionsSection } from "../../schema";
import type { LocalizedString } from "@/types/locale-schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

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
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { currentLocale } = useLocalization();
  const [editModalOpen, setEditModalOpen] = useState(false);

  const {
    showEditButton = true,
    showEntityActions = true,
    showEmailButton = true,
    showReservationButton = false,
    emailButtonLabel,
    reservationButtonLabel,
    layout = "horizontal",
  } = section;

  if (!entity) return null;

  const entityType = entity.getEntityType?.();
  const isUser = entityType === "citoyens";

  // Résoudre les labels localisés
  const resolvedEmailLabel = emailButtonLabel
    ? (typeof emailButtonLabel === "string" ? emailButtonLabel : (emailButtonLabel as LocalizedString)[currentLocale] || emailButtonLabel.fr || emailButtonLabel.en)
    : t("ProfileTemplateDefault.sendEmail");

  const resolvedReservationLabel = reservationButtonLabel
    ? (typeof reservationButtonLabel === "string" ? reservationButtonLabel : (reservationButtonLabel as LocalizedString)[currentLocale] || reservationButtonLabel.fr || reservationButtonLabel.en)
    : t("ProfileTemplateDefault.reservationSpace");

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
          <button
            onClick={() => setEditModalOpen(true)}
            className="px-5 py-2.5 border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
          >
            <Edit className="w-4 h-4" />
            {t("ProfileTemplateDefault.editProfile")}
          </button>
        )}

        {/* Boutons d'action d'entité (Follow, Friend, Membership, etc.) */}
        {showEntityActions && <EntityActionButtons entity={entity} />}

        {/* Boutons email et réservation (seulement pour non-users) */}
        {!isUser && (
          <>
            {/* Bouton Email */}
            {showEmailButton && entity.serverData?.email && typeof entity.serverData.email === "string" && (
              <button
                onClick={() => window.location.href = `mailto:${entity.serverData.email}`}
                className="px-5 py-2.5 border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
              >
                <Mail className="w-4 h-4" />
                {resolvedEmailLabel}
              </button>
            )}

            {/* Bouton Réservation */}
            {showReservationButton && (
              <button
                className="px-5 py-2.5 bg-[#0092a2] text-white rounded-lg text-sm font-medium hover:bg-teal-600 flex items-center gap-2 shadow-sm"
              >
                {resolvedReservationLabel}
                <ChevronRight className="w-4 h-4" />
              </button>
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
