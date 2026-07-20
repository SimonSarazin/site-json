// ------------------------------------------------------------
// colorBy.ts — coloration data-driven par valeur de serverData
// ------------------------------------------------------------
// Brique partagée du « code couleur par territoire » (CDC parents62) :
//   - marqueurs de carte : `map.marker.colorBy` → resolveMarkerVisual ;
//   - chips de cartes    : `list.card.tagColors` → decorateTags.
// Les couleurs du mapping sont des chaînes CSS — `var(--…)` recommandé
// (suit light/dark via le thème), jamais d'hex en dur dans les configs.
// Fonctions PURES (testées sans rendu).

import getValueByPath from "@/helpers/getValueByPath";

import type { ColorByConf, TagColorsConf } from "../schema";

export type ColorByMatch = { value: string; cssColor: string };

/**
 * Résout la couleur d'un item : lit `conf.path` (déf. "tags") dans serverData
 * (valeur string ou tableau) et retourne la PREMIÈRE valeur présente dans
 * `conf.mapping` — l'ordre des tags de l'item fait foi, pas celui du mapping.
 */
export function resolveColorBy(
  serverData: Record<string, unknown> | undefined,
  conf: ColorByConf | undefined,
): ColorByMatch | null {
  if (!serverData || !conf?.mapping) return null;
  const raw = getValueByPath(serverData, conf.path ?? "tags");
  const values = Array.isArray(raw) ? raw : [raw];
  for (const v of values) {
    if (typeof v === "string" && conf.mapping[v]) {
      return { value: v, cssColor: conf.mapping[v] };
    }
  }
  return null;
}

export type DecoratedTag = { tag: string; label: string; cssColor?: string };

/** `territoire62:arrageois` → `Arrageois` (libellé par défaut, surchargeable via `labels`). */
export function stripTagNamespace(tag: string): string {
  const idx = tag.indexOf(":");
  const label = idx >= 0 ? tag.slice(idx + 1) : tag;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Prépare les tags d'une carte pour l'affichage :
 *  - tag présent dans `mapping` → chip colorée, libellé lisible
 *    (`labels[tag]`, sinon namespace retiré + capitalisation) ;
 *  - tag commençant par un préfixe de `hidePrefixes` → MASQUÉ (les tags
 *    techniques `public:`/`age:` filtrent mais ne s'affichent pas bruts) ;
 *  - sinon → chip standard inchangée.
 * Sans conf, retourne les tags tels quels (comportement historique).
 */
export function decorateTags(tags: string[], conf?: TagColorsConf): DecoratedTag[] {
  if (!conf?.mapping && !conf?.hidePrefixes) {
    return tags.map((tag) => ({ tag, label: tag }));
  }
  const out: DecoratedTag[] = [];
  for (const tag of tags) {
    const cssColor = conf.mapping?.[tag];
    if (cssColor) {
      out.push({ tag, label: conf.labels?.[tag] ?? stripTagNamespace(tag), cssColor });
      continue;
    }
    if (conf.hidePrefixes?.some((p) => tag.startsWith(p))) continue;
    out.push({ tag, label: tag });
  }
  return out;
}
