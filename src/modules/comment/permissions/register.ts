/**
 * Enregistrement des droits du module comment.
 * Ce fichier doit être importé (effet de bord) pour que le calculateur soit disponible.
 */
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import type { CommentPermissions } from "./types";
import { DEFAULT_COMMENT_PERMISSIONS } from "./defaults";
import { calculateCommentPermissions, canModerateAll } from "./calculators/comment";

/**
 * Participer ne dépend que de la CONNEXION. Exiger un `userContext` sur l'entité coupait le
 * composer à un connecté partout où l'entité n'en porte pas : aperçu d'actualité de la recherche
 * (`api.organization({id})`), fil sans porteur, porteur citoyen — régression vs `main` relevée par
 * la revue du 29/09. L'entité n'intervient plus : la modération se lit sur `me`.
 */
function calculatePermissions(ctx: PermissionContext): CommentPermissions {
  const { me, data } = ctx;
  if (!me?.isConnected) return DEFAULT_COMMENT_PERMISSIONS;
  return calculateCommentPermissions({
    canModerateAll: canModerateAll(me),
    enabled: (data?.enabled as boolean | undefined) ?? true,
  });
}

registerPermissions<CommentPermissions>({
  namespace: "comment",
  calculate: calculatePermissions,
});
