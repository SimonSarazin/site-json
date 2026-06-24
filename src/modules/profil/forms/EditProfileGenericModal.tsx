/**
 * Édition de profil — ROUTER mince vers la modale unique `EntityFormModal` + `editProfileConfig`.
 * Les 5 types profil (citoyen/org/projet/event/poi) sont TOUS dans EDIT_DESCRIPTORS → toujours config-driven.
 * (L'ancien fallback `EditProfileModal` legacy est supprimé : injoignable depuis la migration complète.)
 */
import type { ReactNode } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
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
  // Garde défensive : tous les types profil sont migrés ; un type inconnu (impossible en pratique) → rien.
  if (!entityType || !EDIT_DESCRIPTORS[entityType]) return null;
  return <EntityFormModal config={editProfileConfig} open={open} onOpenChange={onOpenChange} mode="edit" entity={entity} />;
}

export default EditProfileGenericModal;
