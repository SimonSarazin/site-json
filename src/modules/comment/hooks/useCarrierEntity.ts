import { useQuery } from "@tanstack/react-query";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { carrierKey } from "../lib/discussions";
import type { CarrierRef, CarrierType } from "../types";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";

/**
 * Charge l'entité PORTEUSE d'un fil, **avec le contexte utilisateur**.
 *
 * Elle cadre la recherche des personnes à mentionner — c'est le `scopeEntity` de
 * `CommentThread` : on mentionne d'abord les gens de l'espace. Les droits du fil ne dépendent
 * plus d'elle (`permissions/register.ts`), et l'écriture d'un message racine passe par l'entité
 * commentée, que résout la lecture du fil (`useCommentsQuery`).
 *
 * ⚠️ **`api.project({id})` ne porte pas ce contexte** : il construit l'entité avec le client
 * pour parent, si bien que `userContext` reste **null** (`BaseEntity` ne l'hérite que d'un
 * parent `User`). Mesuré : un projet chargé ainsi a bien `isConnected: true`… et aucun
 * `userContext`. La résolution passe donc par **`me.<méthode>({id})`** quand on est connecté —
 * même motif que `useCommunProjectEntity` du module AAC.
 */
const METHOD_BY_CARRIER = {
  citoyens: "user",
  organizations: "organization",
  projects: "project",
  events: "event",
  poi: "poi",
  classifieds: "classified",
  // `cities` n'a de méthode racine ni sur `api` ni sur `me` : pour un fil porté par une ville
  // (une action dont le parent est une commune, cas rare), la recherche de mentions retombe
  // sur l'entité commentée elle-même.
} as const satisfies Partial<Record<CarrierType, string>>;

/** `me` porte les cinq méthodes d'entité de `BaseEntity` ; `user` n'existe que sur `api`. */
const ON_ME = new Set(["organization", "project", "event", "poi", "classified"]);

export function useCarrierEntity(carrier: CarrierRef | null) {
  const { api, me } = useCocolight();
  const method = carrier ? (METHOD_BY_CARRIER as Record<string, string | undefined>)[carrier.type] : undefined;

  const query = useQuery({
    queryKey: COMMENT_QUERY_KEYS.CARRIER_ENTITY(carrierKey(carrier), me?.id ?? null),
    enabled: Boolean(carrier && method),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<EntityTypes | null> => {
      if (!carrier || !method) return null;
      try {
        const source = me && ON_ME.has(method)
          ? (me as unknown as Record<string, (d: object) => Promise<EntityTypes>>)
          : (api as unknown as Record<string, (d: object) => Promise<EntityTypes>>);
        return await source[method]({ id: carrier.id });
      } catch (error) {
        // Un porteur illisible (supprimé, hors de portée) ne doit pas faire tomber le
        // panneau : le fil reste consultable, et les mentions se cherchent sans lui.
        console.warn("[useCarrierEntity] porteur non résolu", error);
        return null;
      }
    },
  });

  return { entity: query.data ?? null, isLoading: query.isLoading };
}
