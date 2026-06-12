import { useEffect, useMemo } from "react";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { useLocalization } from "@/hooks/useLocalization";
import type { SearchType } from "@/modules/search/schema";
import type {
  Equipment,
  FilterValues,
  ObservatoryES974SectionProps,
} from "./schema";
import { EMPTY_FILTERS, EquipmentSchema } from "./schema";
import { useState } from "react";
import { KpiCards } from "./components/KpiCards";
import { Filters } from "./components/Filters";
import {
  AccessibilityChart,
  ApsChart,
  CommuneChart,
  NatureChart,
  TypeChart,
} from "./components/Charts";
import { EquipmentTable } from "./components/EquipmentTable";
import {
  getCommune,
  getEpci,
  getNature,
  getPropType,
  getType,
  isPmrAccessible,
  normalizeAps,
} from "./utils";

/*───────────────────────────────────────────────────────────────*/
/* Params API par défaut (alignés sur /equipements-sportifs)     */
/*───────────────────────────────────────────────────────────────*/
const DEFAULT_FIELDS = [
  // Champs requis par _linkEntities (Cocolight) pour lier les entités
  "collection",
  "_id",
  "id",
  "slug",
  // Champs métier équipements sportifs
  "equip_numero",
  "equip_nom",
  "inst_nom",
  "equip_type_name",
  "equip_type_famille",
  "categorie",
  "type",
  "nature",
  "equip_nature",
  "equip_sol",
  "equip_surf",
  "equip_larg",
  "equip_long",
  "equip_eclair",
  "equip_acc_libre",
  "equip_douche",
  "aps_name",
  "inst_acc_handi_bool",
  "inst_acc_handi_type",
  "inst_trans_bool",
  "inst_trans_type",
  "equip_pmr_acc",
  "equip_pmr_chem",
  "equip_pmr_douche",
  "equip_pmr_sanit",
  "equip_pmr_vest",
  "equip_pmr_trib",
  "equip_pshs_aire",
  "equip_pshs_chem",
  "equip_pshs_sanit",
  "equip_pshs_vest",
  "equip_pshs_trib",
  "equip_pshs_sign",
  "inst_part_bool",
  "inst_part_type",
  "equip_prop_nom",
  "equip_prop_type",
  "equip_gest_type",
  "equip_loc_type",
  "equip_utilisateur",
  "inst_date_creation",
  "inst_enqu_date",
  "equip_maj_date",
  "equip_x",
  "equip_y",
  "address",
  "geo",
];

const DEFAULT_FILTERS: Record<string, unknown> = {
  $or: {
    "source.key": "sportSanteBienetre",
    "source.keys": "sportSanteBienetre",
  },
  type: "recoveryCenter",
};

/*───────────────────────────────────────────────────────────────*/
/* Extraction d'un Equipment à partir d'un item retourné par     */
/* useSearchQuery (proxy avec `serverData`).                      */
/*───────────────────────────────────────────────────────────────*/
function extractRawEquipment(item: unknown): Record<string, unknown> {
  if (!item || typeof item !== "object") return {};
  const entity = item as Record<string, unknown>;

  // Pour les instances d'entité Cocolight, `data` est le proxy qui expose
  // tous les champs (draft + serverData). On le lit en priorité.
  const dataProxy =
    typeof entity.data === "object" &&
    entity.data !== null &&
    !Array.isArray(entity.data)
      ? (entity.data as Record<string, unknown>)
      : null;

  // serverData contient les données brutes du serveur (réactif)
  const server =
    typeof entity.serverData === "object" && entity.serverData !== null
      ? (entity.serverData as Record<string, unknown>)
      : {};

  // Priorité : proxy data (tous les champs) > serverData > propriétés top-level
  return { ...entity, ...server, ...(dataProxy ?? {}) };
}

function parseEquipments(items: readonly unknown[]): Equipment[] {
  const out: Equipment[] = [];
  for (const item of items) {
    const raw = extractRawEquipment(item);
    const result = EquipmentSchema.safeParse(raw);
    if (result.success) {
      out.push(result.data);
    } else if (import.meta.env.DEV) {
      console.warn(
        "[ObservatoryES974] entrée ignorée (parse Zod)",
        result.error,
      );
    }
  }
  return out;
}

/*───────────────────────────────────────────────────────────────*/
/* Application des filtres côté client                           */
/*───────────────────────────────────────────────────────────────*/
function applyFilters(data: Equipment[], f: FilterValues): Equipment[] {
  return data.filter((d) => {
    if (f.commune && getCommune(d) !== f.commune) return false;
    if (f.type && getType(d) !== f.type) return false;
    if (f.epci && getEpci(d) !== f.epci) return false;
    if (f.nature && getNature(d) !== f.nature) return false;
    if (f.prop && getPropType(d) !== f.prop) return false;
    if (f.pmr) {
      const pmr = isPmrAccessible(d);
      if (f.pmr === "Accessible" && !pmr) return false;
      if (f.pmr === "Non accessible" && pmr) return false;
    }
    if (f.aps) {
      const list = normalizeAps(d.aps_name);
      if (!list.includes(f.aps)) return false;
    }
    return true;
  });
}

/*───────────────────────────────────────────────────────────────*/
/* Composant principal                                           */
/*───────────────────────────────────────────────────────────────*/
interface ObservatoryES974SectionComponentProps {
  id?: string;
  props: ObservatoryES974SectionProps;
}

export default function ObservatoryES974Section({
  id,
  props,
}: ObservatoryES974SectionComponentProps) {
  const { t } = useLocalization();
  const baseParamsProp = props.baseParams ?? {};

  const baseParams = useMemo(
    () => ({
      notSourceKey: baseParamsProp.notSourceKey ?? true,
      defaultTypes:
        (baseParamsProp.defaultTypes as SearchType[] | undefined) ?? [
          "poi" as SearchType,
        ],
      defaultFields: baseParamsProp.defaultFields ?? DEFAULT_FIELDS,
      defaultFilters: baseParamsProp.defaultFilters ?? DEFAULT_FILTERS,
      defaultSortBy: baseParamsProp.defaultSortBy,
      indexStepList: baseParamsProp.indexStepList ?? 500,
    }),
    [baseParamsProp],
  );

  const searchType = useMemo<Record<string, string[]>>(
    () => ({ type: baseParams.defaultTypes as unknown as string[] }),
    [baseParams.defaultTypes],
  );

  const {
    transformedResults,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearchQuery({
    queryKeyPrefix: "observatoire-es974",
    searchText: "",
    searchTags: {},
    searchType,
    mapUsed: false,
    baseParams,
  });

  // Chargement total : tant qu'il reste une page, on l'enchaîne.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const equipments = useMemo(
    () => parseEquipments(transformedResults ?? []),
    [transformedResults],
  );

  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const filtered = useMemo(
    () => applyFilters(equipments, filters),
    [equipments, filters],
  );

  const stillLoading = isLoading || hasNextPage || isFetchingNextPage;
  const headline = props.headline ? t(props.headline) : null;
  const description = props.description ? t(props.description) : null;

  return (
    <section
      id={id}
      className="w-full bg-background py-8"
      data-section="observatory-es974"
    >
      <div className="mx-auto w-full max-w-8xl px-4 sm:px-6 lg:px-8 space-y-6">
        {(headline || description) && (
          <header className="space-y-1">
            {headline && (
              <h2 className="text-2xl font-bold text-foreground">{headline}</h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </header>
        )}

        {Boolean(error) && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Une erreur est survenue lors du chargement des équipements.
          </div>
        )}

        <KpiCards data={filtered} />
        <Filters data={equipments} onChange={setFilters} />

        <div className="grid grid-cols-1">
          <TypeChart data={filtered} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <NatureChart data={filtered} />
          <AccessibilityChart data={filtered} />
        </div>

        <div className="grid grid-cols-1">
          <ApsChart data={filtered} />
        </div>

        <div className="grid grid-cols-1">
          <CommuneChart data={filtered} />
        </div>

        <EquipmentTable data={filtered} />

        {stillLoading && (
          <p className="text-center text-xs text-muted-foreground">
            Chargement des données en cours…
          </p>
        )}
      </div>
    </section>
  );
}
