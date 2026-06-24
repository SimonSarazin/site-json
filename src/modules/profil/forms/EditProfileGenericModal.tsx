/**
 * Édition de profil — ROUTER mince. Les entités MIGRÉES (EDIT_DESCRIPTORS) passent par la modale unique
 * `EntityFormModal` + `editProfileConfig` ; les autres tombent sur l'ancien `EditProfileModal` (fallback
 * défensif, migration incrémentale). Plus de code de formulaire ici : tout est dans la config + EntityFormModal.
 */
import type { ReactNode } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { EditProfileModal } from "../components/profile-edit/EditProfileModal";
import { EDIT_DESCRIPTORS } from "./editProfile.descriptor";
import { EntityFormModal } from "./EntityFormModal";
import { editProfileConfig } from "./configs/editProfile";

interface Props {
  entity: EntityTypes;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileGenericModal({ entity, open, onOpenChange }: Props): ReactNode {
  const entityType = typeof entity.getEntityType === "function" ? entity.getEntityType() : "citoyens";
  if (!entityType || !EDIT_DESCRIPTORS[entityType]) {
    return <EditProfileModal entity={entity} open={open} onOpenChange={onOpenChange} />;
  }
  return <EntityFormModal config={editProfileConfig} open={open} onOpenChange={onOpenChange} mode="edit" entity={entity} />;
}

export default EditProfileGenericModal;
