import type { User } from "@communecter/cocolight-api-client";
import type { CommentPermissions } from "../types";
import { DEFAULT_COMMENT_PERMISSIONS } from "../defaults";

export interface CalculateCommentPermissionsArgs {
  /** Peut supprimer le message d'AUTRUI — cf. `canModerateAll`. */
  readonly canModerateAll: boolean;
  /** Le fil est-il ouvert aux contributions ? (option de section, défaut : oui) */
  readonly enabled?: boolean;
}

/**
 * Supprimer le message d'autrui : la règle EXACTE du serveur (`Comment::delete`), qui n'accepte
 * que l'auteur, le super-admin (`roles.superAdmin`, session `userIsAdmin`) et l'admin de source
 * (`roles.sourceAdmin`, session `userIsAdminPublic`). Ni l'admin de l'espace, ni le propriétaire
 * du profil : leur offrir « Supprimer » promettait une action que le serveur refuse.
 */
export function canModerateAll(me: User | null | undefined): boolean {
  if (!me) return false;
  if (typeof me.isSuperAdmin === "function" && me.isSuperAdmin()) return true;
  return Boolean((me.roles as Record<string, unknown> | undefined)?.sourceAdmin);
}

/**
 * Calcule les droits sur un fil.
 *
 * Règle de fond : **tout utilisateur identifié peut participer** à un fil qu'il peut voir —
 * c'est le comportement du backend, qui n'applique aucune liste blanche à l'écriture. La
 * modération, elle, ne dépend pas de l'entité porteuse : voir `canModerateAll`.
 */
export function calculateCommentPermissions(
  { canModerateAll: moderateur, enabled = true }: CalculateCommentPermissionsArgs,
): CommentPermissions {
  if (!enabled) return DEFAULT_COMMENT_PERMISSIONS;
  return {
    canComment: true,
    canReply: true,
    canReact: true,
    canReport: true,
    canModerate: moderateur,
  };
}
