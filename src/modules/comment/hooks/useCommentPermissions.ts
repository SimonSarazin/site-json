import type { EntityTypes } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type { CommentPermissions } from "../permissions";

// Import à effet de bord : enregistre le calculateur du namespace "comment".
import "../permissions/register";

/**
 * Droits de l'utilisateur courant sur le fil porté par `entity`.
 *
 * @param entity - L'entité porteuse du fil.
 * @param enabled - `false` ferme le fil aux contributions (option de section).
 */
export function useCommentPermissions(
  entity: EntityTypes | null,
  enabled = true,
): CommentPermissions {
  const { comment: permissions } = usePermissions<{ comment: CommentPermissions }>(
    ["comment"],
    entity,
    { enabled },
  );
  return permissions;
}
