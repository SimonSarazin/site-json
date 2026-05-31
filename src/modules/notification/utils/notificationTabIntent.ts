import type { NotificationItemData } from "@communecter/cocolight-api-client";
import type { EntityCollection } from "./parseNotification";

/**
 * Onglet de profil visé par une notification, selon son verbe :
 * - `journal`    → un nouveau post (`verb: "post"`)
 * - `community`  → demande d'adhésion (`verb: "ask"`, projets/orgs) ou ajout
 *                  comme membre (`verb: "add"` + `notify.objectType: "asMember"`)
 * - `root`       → tout le reste (page de profil par défaut)
 *
 * Pur/testable. La résolution de l'onglet réel (par capacité/id, avec fallback
 * racine si l'onglet n'existe pas sur le site) est faite côté navigation.
 */
export type TabIntent = "journal" | "community" | "root";

export function notificationTabIntent(
  data: NotificationItemData | undefined,
  targetType: EntityCollection,
): TabIntent {
  const verb = data?.verb;
  const objectType = data?.notify?.objectType;

  if (verb === "post") return "journal";

  const isMembershipScope = targetType === "projects" || targetType === "organizations";
  if (verb === "ask" && isMembershipScope) return "community";
  if (verb === "add" && objectType === "asMember") return "community";

  return "root";
}
