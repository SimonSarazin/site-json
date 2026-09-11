import { getSlug } from "@/lib/constant/common";

/**
 * Force le scope costum du carrier sur le costum DU SITE (`getSlug()`) avant tout appel lib qui
 * le consomme (`_requireCostumCtx` : slug + costumId + costumType) — `validateGroup`,
 * `addReference`/`removeReference`, `previewImport`, `importElements`, `exportElements`.
 *
 * Vit dans `src/lib` (et non plus dans `modules/admin/lib`) depuis que les mutations de `profil`
 * l'appellent aussi : le scope gouverne également le `costumSlug` posté sur les endpoints MAILANTS
 * (multiconnect, connect/disconnect, link/validate…), d'où l'e-mail brandé du costum. Un import
 * `modules/profil` → `modules/admin` aurait été une dépendance inversée entre modules pairs.
 *
 * Deux problèmes distincts, un seul point de passage :
 *
 * 1. Hôte SANS `source.key` (cas majoritaire : c'est elle la source) → la lib ne lui auto-dérive
 *    AUCUN scope, et tout appel levait « n'est pas rattachée à un costum » avant la moindre requête.
 *
 * 2. Hôte AVEC un `source.key` étranger → la lib lui auto-dérive le scope de sa PROVENANCE
 *    (`BaseEntity._hydrate` : « un élément appartient à UN costum = son source.key, qui fait donc
 *    AUTORITÉ »). Autorité JUSTE pour ÉDITER l'hôte (schéma du costum qui l'a créée), FAUSSE pour
 *    l'administration : ici le carrier n'est pas un élément, c'est le PORTEUR du site. Mesuré le
 *    2026-08-03 : l'org hôte `institutBleu` porte `source.key:"meir"` → `validateGroup` postait
 *    `costumSlug:"meir"` (dé)posant `preferences.toBeValidated.meir` au lieu de `.institutBleu` —
 *    validation sans effet, toast de succès quand même. 7 des 19 sites de `sites.json` divergent
 *    ainsi (institutBleu + la famille communeTransparente). Même dérive pour référencer (mauvais
 *    `reference.costum`), importer (éléments estampillés du mauvais `source.key`) et exporter
 *    (contenu d'un autre costum).
 *
 * D'où l'appel INCONDITIONNEL : l'ancien court-circuit `if (holder.hasCostumScope()) return;`
 * ne couvrait que (1) et laissait (2) passer en silence. `hasCostumScope()` ne dit QUE si un scope
 * existe, pas LEQUEL — la lib n'expose pas le slug courant, donc on repose le bon à chaque fois
 * (`setCostumScope` est synchrone : résolution registre/cache costum, pas de réseau).
 *
 * La lib (1.0.172, publiée) prescrit désormais EXACTEMENT ce patron : `hasCostumScope()` « dit seulement
 * s'IL Y A un scope, pas LEQUEL », et `setCostumScope` épingle un `_adminScope` qui SURVIT aux
 * refresh/hydratations (`_setData` re-dérive `_costumCtx` du `source.key` sans y toucher) — « à
 * faire inconditionnellement (idempotent), pas derrière un `if (hasCostumScope())` »
 * (BaseEntity.d.ts:1844-1873). L'appel depuis chaque EVENT HANDLER reste : il est idempotent et
 * gratuit, et il protège les carriers construits avant la pose du scope (jamais pendant le rendu :
 * mutation d'une valeur de hook interdite par react-compiler).
 */
export function ensureCostumScope(
  entity: unknown,
  ctx: { contextId?: string; contextType?: string },
): void {
  if (!entity || typeof entity !== "object") return;
  const slug = getSlug();
  if (!slug || slug === "default" || !ctx.contextId || !ctx.contextType) return;
  const holder = entity as {
    setCostumScope?: (slug: string, opts?: { costumId?: string; costumType?: string }) => void;
  };
  // Appelé désormais sur des carriers quelconques (User d'une liste de membres, entité de profil) :
  // on vérifie la méthode plutôt que de faire planter une mutation sur un objet nu.
  if (typeof holder.setCostumScope !== "function") return;
  holder.setCostumScope(slug, { costumId: ctx.contextId, costumType: ctx.contextType });
}
