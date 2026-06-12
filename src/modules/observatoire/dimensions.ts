// ------------------------------------------------------------
// dimensions.ts — moteur de dimensions du module observatoire
// ------------------------------------------------------------
// Le cœur générique : une dimension ({paths, kind}) décrit COMMENT lire une
// grandeur sur un item ; le moteur la résout. Filtres, KPI, graphes et table
// consomment des dimensions — le métier (RES) n'est plus qu'un PRESET de
// déclarations, surchargeable par la config de section (précédent :
// DEFAULT_SERVICE_PRICING_PATHS / preview.fields).
// ------------------------------------------------------------
import getValueByPath from "@/helpers/getValueByPath";
import { PMR_FIELDS, PSHS_FIELDS } from "./schema";
import type { DimensionDef, DimensionsConfig, Equipment } from "./schema";

/*───────────────────────────────────────────────────────────────*/
/* Primitives de coercion (formats API hétérogènes)              */
/*───────────────────────────────────────────────────────────────*/

/** Coerce une valeur quelconque vers `true` si elle représente l'affirmatif. */
export function isTrue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "oui" || v === "yes";
  }
  return false;
}

/** Renvoie la première chaîne non vide parmi les candidats.
 *  Accepte aussi bien des `string` que des `string[]`. */
export function firstString(
  ...candidates: Array<unknown>
): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") return c;
    if (Array.isArray(c)) {
      const first = c.find(
        (v): v is string => typeof v === "string" && v.trim() !== "",
      );
      if (first !== undefined) return first;
    }
  }
  return undefined;
}

/** Extrait une valeur scalaire numérique si possible. */
export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/** Valeur multi : string CSV (virgule/point-virgule) ou tableau → tableau plat. */
export function toStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v !== "");
  }
  if (typeof value === "string") {
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/*───────────────────────────────────────────────────────────────*/
/* Moteur                                                        */
/*───────────────────────────────────────────────────────────────*/

function resolvePath(e: Equipment, path: string): unknown {
  return path.includes(".")
    ? getValueByPath(e as Record<string, unknown>, path)
    : (e as Record<string, unknown>)[path];
}

/** kind "value" — première chaîne non vide le long des chemins de priorité. */
export function dimensionValue(e: Equipment, def: DimensionDef): string | undefined {
  return firstString(...def.paths.map((p) => resolvePath(e, p)));
}

/** kind "list" — premier chemin produisant une liste non vide. */
export function dimensionList(e: Equipment, def: DimensionDef): string[] {
  for (const p of def.paths) {
    const list = toStringList(resolvePath(e, p));
    if (list.length > 0) return list;
  }
  return [];
}

/** kind "anyTrue" — au moins un des chemins porte une valeur affirmative. */
export function dimensionBool(e: Equipment, def: DimensionDef): boolean {
  return def.paths.some((p) => isTrue(resolvePath(e, p)));
}

/** kind "number" — première valeur numérique le long des chemins. */
export function dimensionNumber(e: Equipment, def: DimensionDef): number | undefined {
  for (const p of def.paths) {
    const n = toNumber(resolvePath(e, p));
    if (n !== undefined) return n;
  }
  return undefined;
}

/*───────────────────────────────────────────────────────────────*/
/* Preset RES (Recensement des Équipements Sportifs)             */
/*───────────────────────────────────────────────────────────────*/
// Défaut du module : les dimensions du référentiel national. `labelKey`
// pointe les libellés i18n historiques du namespace modules/observatoire.
export const RES_DIMENSIONS: DimensionsConfig = {
  commune: { paths: ["address.addressLocality"], labelKey: "filters.commune" },
  type: {
    paths: ["equip_type_name", "equip_type_famille", "type", "categorie"],
    labelKey: "filters.type",
  },
  epci: { paths: ["address.level5Name"], labelKey: "filters.epci" },
  nature: { paths: ["equip_nature", "nature"], labelKey: "filters.nature" },
  prop: { paths: ["equip_prop_type"], labelKey: "filters.owner" },
  aps: { paths: ["aps_name"], kind: "list", labelKey: "filters.sport" },
  pmr: { paths: [...PMR_FIELDS], kind: "anyTrue", labelKey: "filters.pmr" },
  pshs: { paths: [...PSHS_FIELDS], kind: "anyTrue", labelKey: "kpi.pshs" },
  handi: { paths: ["inst_acc_handi_bool"], kind: "anyTrue", labelKey: "charts.accessibilityHandi" },
  surface: { paths: ["equip_surf"], kind: "number", labelKey: "table.surface" },
  name: { paths: ["inst_nom", "equip_nom"], labelKey: "table.installation" },
  numero: { paths: ["equip_numero"] },
};

/** Fusion preset ← config : surcharge PAR DIMENSION (atomique). */
export function mergedDimensions(config?: DimensionsConfig): DimensionsConfig {
  return { ...RES_DIMENSIONS, ...(config ?? {}) };
}

/** Dimensions filtrables par défaut (preset RES), dans l'ordre d'affichage. */
export const RES_FILTER_IDS = [
  "commune",
  "type",
  "epci",
  "nature",
  "pmr",
  "prop",
  "aps",
] as const;

/** Valeurs des filtres booléens (dimensions anyTrue) — sérialisées en URL. */
export const BOOL_FILTER_VALUES = {
  TRUE: "true",
  FALSE: "false",
} as const;
