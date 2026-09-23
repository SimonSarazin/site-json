/**
 * Mutations de SUPPRESSION d'entité (`DELETE_ELEMENT` côté lib).
 *
 * Pour l'instant : l'événement seul (`event.delete()`). La lib expose la même méthode sur
 * organisation / projet / POI — les brancher ici le jour où l'écran existe.
 */
import type { Event } from "@communecter/cocolight-api-client";
import { createEntityMutation } from "./core";
import { PROFIL_QUERY_KEYS } from "../../constants/queryKeys";
import { EVENT_LISTS_INVALIDATION } from "../../constants/listInvalidation";

/**
 * Supprime définitivement un événement.
 *
 * La lib garde l'appel côté client (auteur, admin de l'organisateur via la hiérarchie, super-admin,
 * ou admin de costum — ce dernier posé par `usePermissions` via `setCostumAdminAuthorized`) et le
 * backend reste la source de vérité. L'instance devient une coquille vide après succès : l'appelant
 * doit quitter la page de l'entité, jamais la réutiliser.
 */
export const useDeleteEvent = createEntityMutation({
  entityTypes: ["event"],
  // Le garde `entityTypes` ci-dessus a déjà écarté les autres types : `delete()` d'un `User` prend,
  // lui, un payload — d'où le cast plutôt qu'un appel sur l'union.
  action: async (entity) => {
    await (entity as Event).delete();
  },
  i18n: {
    successKey: "toast.element.deleteEventSuccess",
    errorKey: "toast.element.deleteEventError",
  },
  invalidate: (entity, me) => [
    PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(entity.slug),
    ...(me ? [PROFIL_QUERY_KEYS.USER_EVENTS_PREFIX(me.slug)] : []),
    ...EVENT_LISTS_INVALIDATION,
  ],
});
