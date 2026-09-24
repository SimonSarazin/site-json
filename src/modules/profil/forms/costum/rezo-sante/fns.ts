/**
 * Module des costums EcosystemeSanteReunion (RéseauSanté) : les deux seules clés de code des trois
 * formulaires (`rezo-sante-acteur` / `-projet` / `-ressource`), tout le reste vivant en DONNÉES dans
 * `config.prod.rezo-sante-reunion.json` → `costumForms`.
 *
 * CE QU'ELLES FONT : elles SYNCHRONISENT `tags` sur `thematic`, dans les deux sens du pipeline.
 *
 *   lecture  (édition)  tags affichés = tags en base  −  thématiques de la fiche
 *   écriture (save)     tags envoyés  = tags affichés  ∪  thématiques cochées
 *
 * Conséquences, qui sont exactement la demande : les thématiques n'apparaissent pas en doublon dans
 * « Mots-clés » ; cocher une thématique pose son tag ; **décocher une thématique retire son tag** ;
 * et un mot-clé libre reste librement supprimable.
 *
 * POURQUOI PAS UNE ESTAMPILLE. `mutation.stamps` ne sait qu'AJOUTER : son `op:"append"` fait
 * `unionDedup(targetServerData, payload, valeur)` (`stamps.ts`), donc il repose tout tag retiré —
 * thématique décochée comprise — et rien n'est jamais supprimable. `op:"set"` n'est pas une issue
 * non plus : le préflight l'interdit sur un champ présent dans `fields`, et il écraserait les
 * mots-clés libres. La réconciliation appartient donc au CHAMP, pas à la mutation. Les 3 estampilles
 * ont été retirées en même temps que ces clés ont été posées : les garder ferait revenir les tags
 * supprimés depuis la valeur serveur.
 *
 * POURQUOI DU CODE ET PAS DE LA CONFIG : un transform de CHAMP ne reçoit pas de `params` (seuls les
 * `serializeGroups` en ont, cf. `fieldPipeline`), la réconciliation ne peut donc pas se déclarer en
 * JSON. Même raison que `../structure/fns.ts`.
 *
 * ON SOUSTRAIT LES THÉMATIQUES STOCKÉES, PAS LES 6 OPTIONS DU FORMULAIRE : une fiche importée taguée
 * « Nutrition » sans `thematic` renseigné garde ce mot-clé, visible et supprimable. Le masquer le
 * rendrait invisible tout en le laissant en base, et l'écriture le supprimerait à l'insu de tous.
 */
import { registerTransform } from "@/modules/formEngine/engine/transforms";
import "../sharedRegistrations"; // side-effect : clés génériques (address/social/geo/coerce/invalidate…)

/** Normalise une valeur en tableau de chaînes (équivalent de `coerce:stringArray`, que ces clés remplacent). */
function enTableau(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return v == null || v === "" ? [] : [String(v)];
}

/** LECTURE — retire des tags les valeurs déjà portées par `thematic`. Pure, testée. */
export function tagsHorsThematiques(tags: unknown, thematic: unknown): string[] {
  const portes = new Set(enTableau(thematic));
  return enTableau(tags).filter((t) => !portes.has(t));
}

/** ÉCRITURE — réunit les mots-clés saisis et les thématiques cochées, dédupliqué, ordre préservé. Pure, testée. */
export function tagsAvecThematiques(tags: unknown, thematic: unknown): string[] {
  const out: string[] = [];
  const vus = new Set<string>();
  for (const v of [...enTableau(tags), ...enTableau(thematic)]) {
    if (!vus.has(v)) { vus.add(v); out.push(v); }
  }
  return out;
}

/** Le 2ᵉ argument d'un `read` est le `serverData` de l'entité (`fieldPipeline.seedFromEntity`) ;
 *  en création il est vide, le transform est alors neutre. */
registerTransform("rezoSante:tagsHorsThematiques", (v, serverData) =>
  tagsHorsThematiques(v, (serverData as Record<string, unknown>)?.thematic),
);

/** Le 2ᵉ argument d'un `write` est l'ensemble des VALEURS DU FORMULAIRE (`fieldPipeline.valuesToPayload`) :
 *  on y lit les thématiques telles que l'utilisateur vient de les cocher. */
registerTransform("rezoSante:tagsAvecThematiques", (v, valeurs) =>
  tagsAvecThematiques(v, (valeurs as Record<string, unknown>)?.thematic),
);
