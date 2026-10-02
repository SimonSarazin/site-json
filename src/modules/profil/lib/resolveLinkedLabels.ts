import { getEntryId } from "@/modules/search/lib/searchMapSelection";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * « Mes lieux » (Agenda/Projets) mélange des items venant de PLUSIEURS lieux membres — sans repère,
 * rien n'indique par quel lieu un événement/projet donné est remonté. Pour chaque item, croise ses
 * `links.<champ>` (ex. `organizer` pour un événement, `contributors` pour un projet) avec les ids des
 * lieux membres connus (`orgsById`, déjà en mémoire — onglet 1) pour produire un libellé à afficher
 * sur sa carte (`list.linkedLabels`, cf. `ListConfSchema`).
 *
 * Ne fait AUCUN appel réseau : les deux données croisées (résultats de recherche + `mesLieux`) sont
 * déjà chargées côté appelant.
 */
export function resolveLinkedLabels(
  items: readonly SearchEntity[],
  linkFields: readonly string[],
  orgsById: ReadonlyMap<string, string>,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const item of items) {
    const id = getEntryId(item);
    if (!id) continue;
    const links = (item.serverData as { links?: Record<string, unknown> } | undefined)?.links;
    const noms: string[] = [];
    for (const champ of linkFields) {
      const lien = links?.[champ];
      if (!lien || typeof lien !== "object") continue;
      for (const orgId of Object.keys(lien)) {
        const nom = orgsById.get(orgId);
        if (nom && !noms.includes(nom)) noms.push(nom);
      }
    }
    if (noms.length > 0) labels[id] = noms.join(", ");
  }
  return labels;
}
