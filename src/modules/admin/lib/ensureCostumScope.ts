import { getSlug } from "@/lib/constant/common";

/**
 * Garantit que l'entité porte un scope costum COMPLET avant un appel lib qui l'exige
 * (`_requireCostumCtx` : slug + costumId + costumType) — `previewImport`, `importElements`,
 * `exportElements`, `addReference`…
 *
 * Problème : l'entité HÔTE d'un costum (résolue par `entityBySlug`) n'a en général PAS de
 * `source.key` — c'est elle la source — donc la lib ne lui auto-dérive AUCUN scope costum.
 * Résultat : tout appel import/export sur le carrier levait « n'est pas rattachée à un costum »
 * AVANT la moindre requête réseau.
 *
 * Fix : appeler l'API OFFICIELLE lib `entity.setCostumScope(slug, {costumId, costumType})`
 * (≥ 1.0.163) avec ce que le site SAIT déjà — `getSlug()` (VITE_SLUG) + `contextId`/`contextType`
 * (résolus par slug/getinfo au boot). Idempotent via `hasCostumScope()` : ne touche à rien si la
 * lib a déjà dérivé un scope (ex. hôte avec source.key). À appeler depuis un EVENT HANDLER
 * (jamais pendant le rendu — mutation d'une valeur de hook interdite par react-compiler).
 *
 * Fallback SDK < 1.0.163 (à RETIRER après bump) : mutation directe du champ interne `_costumCtx`
 * — la dette historique que `setCostumScope` remplace.
 */
export function ensureCostumScope(
  entity: unknown,
  ctx: { contextId?: string; contextType?: string },
): void {
  if (!entity || typeof entity !== "object") return;
  const slug = getSlug();
  if (!slug || slug === "default" || !ctx.contextId || !ctx.contextType) return;
  const holder = entity as {
    hasCostumScope?: () => boolean;
    setCostumScope?: (slug: string, opts?: { costumId?: string; costumType?: string }) => void;
    _costumCtx?: Record<string, unknown> | null;
    getEntityType?: () => string;
  };
  if (typeof holder.setCostumScope === "function") {
    if (holder.hasCostumScope?.()) return;
    holder.setCostumScope(slug, { costumId: ctx.contextId, costumType: ctx.contextType });
    return;
  }
  // ── Fallback SDK < 1.0.163 — mutation interne historique ──────────────────────────────────────
  if (!holder._costumCtx) {
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
