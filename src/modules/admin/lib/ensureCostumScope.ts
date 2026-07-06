import { getSlug } from "@/lib/constant/common";

/**
 * Garantit que l'entité porte un `_costumCtx` COMPLET avant un appel lib qui l'exige
 * (`_requireCostumCtx` : slug + costumId + costumType) — `previewImport`, `importElements`,
 * `exportElements`…
 *
 * Problème : l'entité HÔTE d'un costum (résolue par `entityBySlug`) n'a en général PAS de
 * `source.key` — c'est elle la source — donc la lib ne lui auto-dérive AUCUN `_costumCtx`
 * (BaseEntity `_setData` ne regarde que `source`). Résultat : tout appel import/export sur le
 * carrier levait « n'est pas rattachée à un costum » AVANT la moindre requête réseau.
 *
 * Fix : poser un ctx « nu » (même forme que `resolveCostumCtxFromSource` pour un costum connu
 * sans overlay : schema vide, fields:[]) construit depuis ce que le site SAIT déjà — `getSlug()`
 * (VITE_SLUG) + `contextId`/`contextType` (résolus par slug/getinfo au boot). Idempotent : ne
 * touche à rien si la lib a déjà dérivé un ctx (ex. hôte avec source.key). À appeler depuis un
 * EVENT HANDLER (jamais pendant le rendu). NB : accès à `_costumCtx` (interne lib non exporté)
 * via cast — à remplacer par un vrai setter lib (`entity.setCostumScope(slug)`) quand il existera.
 */
export function ensureCostumScope(
  entity: unknown,
  ctx: { contextId?: string; contextType?: string },
): void {
  if (!entity || typeof entity !== "object") return;
  const holder = entity as { _costumCtx?: Record<string, unknown> | null; getEntityType?: () => string };
  const slug = getSlug();
  if (!holder._costumCtx && slug && slug !== "default" && ctx.contextId && ctx.contextType) {
    holder._costumCtx = {
      slug,
      costumId: ctx.contextId,
      costumType: ctx.contextType,
      collection: holder.getEntityType?.() ?? ctx.contextType,
      schema: { type: "object", additionalProperties: true, properties: {} },
      fields: [],
      presets: {},
      hidden: [],
    };
  }
}
