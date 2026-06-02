import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";
import { useSite } from "@/hooks/useSite";
import {
  buildNewsDetailUrl,
  buildProfileTabUrl,
} from "@/modules/profil/hooks/useNewsDetailUrlGenerator";
import type { EntityTypes, Notification } from "@communecter/cocolight-api-client";
import {
  parseNotification,
  type EntityCollection,
} from "../utils/parseNotification";
import { notificationTabIntent } from "../utils/notificationTabIntent";

/** Ids d'onglet "communauté/membres" connus (le type de section est générique → on matche par id). */
const COMMUNITY_TAB_IDS = new Set([
  "members",
  "membership",
  "community",
  "communaute",
  "contributors",
  "contributeurs",
]);

/**
 * Résout l'élément d'une notification puis y navigue.
 *
 * Notre routing est par **slug** alors qu'une notif ne porte que `id`+`type` :
 * on récupère donc l'entité (et son slug) via les méthodes API typées
 * (`api.organization/project/event/poi/user`), qui déclenchent un `get()` quand
 * un `id` est fourni — c'est l'appel async fait au clic.
 *
 * - news → URL profonde tab-aware via `buildNewsDetailUrl` (fallback profil parent)
 * - entité → onglet selon le verbe (`post`→journal, `ask`/`add`→communauté),
 *   découvert dans la config avec **fallback racine** si l'onglet n'existe pas
 * - invitation → `/profil/:slug` (racine)
 */
export function useNotificationNavigation() {
  const navigate = useNavigate();
  const { api } = useCocolight();
  const { config } = useSite();

  const resolveEntity = useCallback(
    async (type: EntityCollection, id: string): Promise<EntityTypes | null> => {
      if (!api) return null;
      switch (type) {
        case "organizations":
          return api.organization({ id });
        case "projects":
          return api.project({ id });
        case "events":
          return api.event({ id });
        case "poi":
          return api.poi({ id });
        case "citoyens":
          return api.user({ id });
        default:
          return null;
      }
    },
    [api],
  );

  return useCallback(
    async (item: Notification): Promise<boolean> => {
      const target = parseNotification(item);
      if (!target) return false;

      try {
        if (target.kind === "news") {
          const parent = await resolveEntity(target.parentType, target.parentId);
          if (!parent?.slug) return false;
          navigate(buildNewsDetailUrl(config, parent, target.id) ?? `/profil/${parent.slug}`);
          return true;
        }

        const entity = await resolveEntity(target.type, target.id);
        if (!entity?.slug) return false;

        const root = `/profil/${entity.slug}`;
        // Invitation → racine ; entité → onglet selon le verbe (fallback racine).
        const intent =
          target.kind === "entity"
            ? notificationTabIntent(item.data, target.type)
            : "root";

        let url = root;
        if (intent === "journal") {
          url =
            buildProfileTabUrl(config, entity, (tab) =>
              (tab.sections ?? []).some((s) => s.type === "news"),
            ) ?? root;
        } else if (intent === "community") {
          url = buildProfileTabUrl(config, entity, (tab) => COMMUNITY_TAB_IDS.has(tab.id)) ?? root;
        }

        navigate(url);
        return true;
      } catch (error) {
        console.error("[notification] navigation failed", error);
        return false;
      }
    },
    [resolveEntity, navigate, config],
  );
}
