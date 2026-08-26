import { useQuery } from "@tanstack/react-query";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";

/** Une entrée de `costum.import.mapping` : en-tête CSV humaine → attribut technique (+ type de cast backend). */
export interface CostumImportMapEntry {
  col: string;
  attr: string;
  type?: string;
}

interface CostumImportMapping {
  /** Les entrées brutes du costum (vide si le costum n'a pas d'`import.mapping`). */
  entries: CostumImportMapEntry[];
  /** Attributs cibles proposés dans le wizard = attrs du mapping ∪ champs standard du type. */
  targetAttrs: string[];
  isLoading: boolean;
}

/** Champs standard toujours proposés comme cible (le backend les whiteliste nativement). */
const STANDARD_ATTRS: Record<string, string[]> = {
  common: ["name", "type", "shortDescription", "description", "tags", "streetAddress", "postalCode", "city", "addressCountry"],
  events: ["startDate", "endDate"],
};

interface CarrierLike {
  getCostumResolved: () => Promise<unknown>;
  slug?: string;
}

/**
 * Charge `costum.import.mapping` du carrier (via COSTUM_RESOLVED) pour piloter la traduction
 * en-têtes CSV → attributs à l'import — RUNTIME, zéro config par site (cf. doc IMPORT-COSTUM-MAPPING).
 * Le costum peut ne pas avoir de mapping (ex. equipementsSportifs974) → `entries` vide, on retombe
 * sur les seuls attributs standard + saisie libre.
 *
 * `getCostumResolved` et non `getCostumJson` : cette dernière renvoie l'overlay BRUT de l'élément, sans le
 * document MOTEUR fusionné — un mapping déclaré par un moteur partagé y est donc invisible. Aucun moteur du
 * parc n'en déclare aujourd'hui, mais le jour où l'un le fait, ses sites en héritent sans que rien ne le
 * signale. Cf. `docs/27-COSTUM-RESOLUTION.md` (backend).
 *
 * ATTENTION à la forme : `costumResolved` répond À PLAT (`{result, import, …}`) là où `getcostumjson`
 * enveloppait dans `data`.
 */
export function useCostumImportMapping(carrier: unknown, entityType: string): CostumImportMapping {
  const slug = (carrier as CarrierLike | null)?.slug ?? "";
  const q = useQuery({
    queryKey: ADMIN_QUERY_KEYS.IMPORT_MAPPING(slug),
    enabled: !!carrier && !!slug,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<CostumImportMapEntry[]> => {
      const res = (await (carrier as CarrierLike).getCostumResolved()) as { import?: { mapping?: unknown } } | null;
      const raw = res?.import?.mapping;
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((m): m is CostumImportMapEntry => !!m && typeof m === "object" && typeof (m as { attr?: unknown }).attr === "string")
        .map((m) => ({ col: String(m.col ?? m.attr), attr: String(m.attr), ...(m.type ? { type: String(m.type) } : {}) }));
    },
  });

  const entries = q.data ?? [];
  const standard = [...(STANDARD_ATTRS.common ?? []), ...(entityType === "events" ? STANDARD_ATTRS.events : [])];
  // Attrs cibles = attrs du mapping d'abord (ordre du costum), puis standards non déjà couverts.
  const targetAttrs = [...new Set([...entries.map((e) => e.attr), ...standard])];

  return { entries, targetAttrs, isLoading: q.isLoading };
}
