import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { Api } from "@communecter/cocolight-api-client";
import { useCocolightOptional } from "@/hooks/useCocolight";
import type { FinderValue, FinderElement, FinderElementType } from "../types";

/**
 * Types d'éléments pour lesquels on sait résoudre une image de profil via une
 * méthode entity du SDK (`api.<type>({id})` → `.get()` interne → `serverData`).
 * Les autres types (things, classified, news, ...) conservent l'icône de
 * fallback — pas de méthode entity dédiée et cas non rencontrés en pratique.
 */
const RESOLVABLE_TYPES = new Set<FinderElementType>([
  "organizations",
  "citoyens",
  "projects",
  "events",
  "poi",
]);

const IMAGE_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Éléments d'un finder dont l'image n'est PAS stockée dans la réponse et dont
 * le type est résoluble côté SDK. C'est le cœur du fix : on ne dépend plus du
 * `img` figé au moment de la sélection (souvent absent en data legacy, ou
 * périmé si l'élément a changé d'avatar depuis) — on re-résout au runtime.
 *
 * Pur (testable) : `value` → liste d'éléments à enrichir.
 */
export function finderElementsNeedingImage(value: FinderValue): FinderElement[] {
  if (!value) return [];
  return Object.values(value).filter(
    (el) => !!el?.id && !el.img && RESOLVABLE_TYPES.has(el.type),
  );
}

/**
 * Fusionne les images résolues dans une copie d'affichage des éléments, SANS
 * muter la valeur RHF (la persistance garde son `img` d'origine — on ne veut
 * pas réécrire une URL absolue résolue au runtime dans la réponse).
 *
 * Pur (testable) : `value` + map `{id → url}` → éléments prêts à rendre.
 */
export function mergeResolvedFinderImages(
  value: FinderValue,
  resolved: Record<string, string>,
): FinderElement[] {
  if (!value) return [];
  return Object.values(value).map((el) =>
    el.img || !resolved[el.id] ? el : { ...el, img: resolved[el.id] },
  );
}

/**
 * Résout l'image de profil d'un élément via une méthode entity du SDK.
 * `api.<type>({id})` appelle `.get()` en interne (cf. `Api.ts`) et peuple
 * `serverData` avec des URLs déjà normalisées en absolu par l'ApiClient.
 * Renvoie `undefined` si pas d'image ou si l'élément est inaccessible/supprimé
 * (l'erreur reste isolée à sa query → simple fallback icône).
 */
async function fetchFinderElementImage(
  api: Api,
  id: string,
  type: FinderElementType,
): Promise<string | undefined> {
  let entity: { serverData?: Record<string, unknown> };
  switch (type) {
    case "organizations":
      entity = await api.organization({ id });
      break;
    case "citoyens":
      entity = await api.user({ id });
      break;
    case "projects":
      entity = await api.project({ id });
      break;
    case "events":
      entity = await api.event({ id });
      break;
    case "poi":
      entity = await api.poi({ id });
      break;
    default:
      return undefined;
  }
  const sd = entity.serverData ?? {};
  // Priorité à l'image PLEINE (comme la fiche élément, qui n'utilise le thumb
  // qu'en secours) : le thumb est un crop carré souvent peu net/rogné.
  const url = sd.profilMediumImageUrl ?? sd.profilImageUrl ?? sd.profilThumbImageUrl;
  return typeof url === "string" && url.trim() !== "" ? url : undefined;
}

/**
 * Hook React Query : pour les éléments d'un finder dont l'image n'est pas
 * stockée dans la réponse, résout l'image de profil live via le SDK.
 *
 * Pourquoi : l'`img` n'est plus persistée ni lue depuis la réponse (elle se
 * périme — l'élément peut changer d'avatar) ; `formParser` la retire des deux
 * côtés du round-trip. La source de vérité est donc l'entité elle-même,
 * résolue ici à l'affichage — même modèle que la page "lieux".
 *
 * Caractéristiques :
 *  - Fetch les éléments d'une réponse chargée (leur `img` a été stripée au
 *    parse) ; **pas** ceux fraîchement sélectionnés (le modal leur pose une
 *    `img` transitoire d'aperçu, jamais persistée) → aucun re-fetch inutile.
 *  - Cache 5 min, dédupliqué par `[type, id]` (partagé entre champs/onglets).
 *  - `auth: none` côté endpoint → marche en lecture seule et en mode anonyme.
 *  - Dégrade proprement hors `CocolightProvider` (tests) : aucune query.
 *  - **Ne mute jamais** la valeur RHF (cf. {@link mergeResolvedFinderImages}).
 *
 * @returns Map `{ elementId → url absolue }` pour les seuls éléments résolus.
 */
export function useFinderElementImages(value: FinderValue): Record<string, string> {
  const api = useCocolightOptional()?.api ?? null;

  const missing = useMemo(() => finderElementsNeedingImage(value), [value]);

  const results = useQueries({
    queries: missing.map((el) => ({
      queryKey: ["finder-element-image", el.type, el.id],
      enabled: !!api,
      staleTime: IMAGE_STALE_TIME_MS,
      queryFn: () => fetchFinderElementImage(api!, el.id, el.type),
    })),
  });

  return useMemo(() => {
    const out: Record<string, string> = {};
    missing.forEach((el, i) => {
      const url = results[i]?.data;
      if (typeof url === "string" && url) out[el.id] = url;
    });
    return out;
    // `results` change d'identité à chaque render (tableau RQ) — dep volontaire,
    // le recompute est trivial (boucle sur quelques éléments).
  }, [missing, results]);
}
