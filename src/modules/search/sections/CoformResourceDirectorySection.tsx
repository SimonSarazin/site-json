import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import "@/modules/search/i18n";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import type {
  CoformResourceDirectorySectionProps,
  FiltersSectionProps,
  ListConf,
} from "../schema";
import { PageFiltersProvider, usePageFilters } from "../contexts/pageFilters";
import {
  ResourceDirectoryActionsProvider,
  ResourceParentsProvider,
  type ActiveResourceParent,
} from "../contexts/resourceDirectory";
import FiltersSection from "./FiltersSection";
import SearchListView from "../components/SearchListView";
import SearchListSkeleton from "../components/SearchListSkeleton";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { useResourceParentsQuery } from "../hooks/useResourceParentsQuery";
import { searchByFieldsToQuery } from "../lib/searchByFieldsToQuery";
import { canonicalSearchProStaticBaseParams } from "../lib/canonicalBaseParams";
import { getEntryId } from "../lib/searchMapSelection";
import {
  PRICE_FILTER_GROUPS,
  buildResourceDirectoryFilters,
  parseResourceDirectoryItem,
  resolveAnswerParent,
} from "../lib/resourceDirectory";

const RD_LIST_PREFIX = "resource-directory-list";
// L'éclatement « 1 salle = 1 réponse » de `getRessourceTL` fait qu'une page de N
// answers ≠ N cartes : on charge l'ensemble (un annuaire de ressources est borné).
const RD_PAGE_SIZE = 500;

/**
 * Section `coform-resource-directory` — annuaire à plat des ressources d'un
 * tiers-lieu (coworking / salle de réunion / hébergement). Variant SDK
 * `navigator-tl-ressource` (`/costum/navigator/getsressourcetl`) : tiers-lieu
 * porteur résolu + adresse/geo/image + garde région + `documents` + **éclatement
 * 1 salle = 1 réponse**, CÔTÉ SERVEUR. Facette **« type »** CÔTÉ CLIENT ;
 * **3 facettes prix** CÔTÉ SERVEUR (heure / demi-journée / journée, calquées sur
 * Communecter). Pas de recherche texte.
 */
export default function CoformResourceDirectorySection({
  id,
  props,
}: {
  id?: string;
  props: CoformResourceDirectorySectionProps;
}) {
  useLoadNamespace("modules/search");
  const t = useT("modules/search");

  const {
    title,
    description,
    resourceTypes,
    finderSuffix,
    fieldSuffixes,
    costumSlug,
    contextId,
    contextType,
    scope,
    columns,
    filtersTitle,
    bg,
  } = props;

  const addressLevel1 = scope?.addressLevel1;
  const fixedFilters = useMemo(
    () => ({
      ...buildResourceDirectoryFilters(resourceTypes, finderSuffix),
      ...(addressLevel1 ? { "address.level1": addressLevel1 } : {}),
    }),
    [resourceTypes, finderSuffix, addressLevel1],
  );

  const baseParams = useMemo(
    () => ({
      defaultTypes: ["answers"] as const,
      defaultFilters: fixedFilters,
      // `form` : indispensable à l'éclatement serveur des salles et au filtre
      // prix par formulaire (`Navigator::getRessourceTL`).
      defaultFields: ["name", "description", "answers", "collection", "form"],
      indexStepList: RD_PAGE_SIZE,
      notSourceKey: true,
      ...(costumSlug ? { costumSlug } : {}),
      ...(contextId ? { contextId } : {}),
      ...(contextType ? { contextType } : {}),
    }),
    [fixedFilters, costumSlug, contextId, contextType],
  );

  const filtersProps = useMemo<FiltersSectionProps>(
    () => ({
      title: filtersTitle,
      hideSearch: true,
      defaultOpenGroups: ["resourceType", "priceHourly"],
      filterGroups: [
        {
          // Groupe SANS `field` : sélection dans `selectedFilters.resourceType`
          // (par `option.name`) → filtre CÔTÉ CLIENT.
          id: "resourceType",
          label: { fr: "Type de ressource", en: "Resource type" },
          type: "filters",
          optionStyle: "check",
          keepOptionOrder: true,
          options: resourceTypes.map((rt) => ({ id: rt.id, label: rt.label, name: rt.id })),
        },
        // 3 groupes prix (heure / demi-journée / journée), calqués sur Communecter.
        // Groupe AVEC `field` : sélection → `searchByFields` → `{ <field>: { $in: [tranches] } }`
        // → filtre CÔTÉ SERVEUR (le backend teste chaque champ indépendamment → ET).
        // `searchByFields` est keyé par `option.name` : il DOIT être unique entre les
        // 3 groupes (les tranches `50-100` / `100-200` reviennent) → `name` préfixé du
        // `field`, `variants` porte la vraie valeur `"min-max"` envoyée au backend.
        ...PRICE_FILTER_GROUPS.map((g) => ({
          id: g.field,
          label: g.label,
          type: "filters" as const,
          field: g.field,
          optionStyle: "check" as const,
          keepOptionOrder: true, // tranches croissantes, pas de tri par libellé
          options: g.ranges.map((r) => ({
            id: `${g.field}:${r.id}`,
            name: `${g.field}:${r.id}`,
            variants: [r.id],
            label: r.label,
          })),
        })),
      ],
    }),
    [resourceTypes, filtersTitle],
  );

  const listConf = useMemo<ListConf>(
    () => ({
      columns: columns ?? { sm: 1, md: 2, lg: 3 },
      card: { type: "resource-directory", detailsMode: "dialog" },
      // Même gabarit que le modal « En savoir plus » d'un tiers-lieu (2xl).
      preview: { type: "resource-directory", width: "2xl" },
      previewParam: "resource",
      resourceDirectory: { resourceTypes, finderSuffix, fieldSuffixes },
    }),
    [columns, resourceTypes, finderSuffix, fieldSuffixes],
  );

  return (
    <section
      id={id}
      className={cn("py-8", bg && bg !== "transparent" && `bg-${bg}`)}
      data-co="coform-resource-directory"
    >
      <div className="container mx-auto px-6">
        {(title || description) && (
          <header className="mb-6 space-y-1">
            {title && <h2 className="text-2xl font-bold text-foreground">{t(title)}</h2>}
            {description && <p className="text-sm text-muted-foreground">{t(description)}</p>}
          </header>
        )}

        <PageFiltersProvider>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-start">
            <aside className="lg:col-span-1">
              <FiltersSection props={filtersProps} />
            </aside>
            <div className="lg:col-span-3">
              <ResourceDirectoryList
                baseParams={baseParams}
                listConf={listConf}
                resourceTypes={resourceTypes}
                finderSuffix={finderSuffix}
                fieldSuffixes={fieldSuffixes}
                costumSlug={costumSlug}
                contextId={contextId}
                contextType={contextType}
              />
            </div>
          </div>
        </PageFiltersProvider>
      </div>
    </section>
  );
}

interface ResourceDirectoryListProps {
  baseParams: Record<string, unknown>;
  listConf: ListConf;
  resourceTypes: CoformResourceDirectorySectionProps["resourceTypes"];
  finderSuffix: string;
  fieldSuffixes: CoformResourceDirectorySectionProps["fieldSuffixes"];
  costumSlug?: string;
  contextId?: string;
  contextType?: string;
}

function ResourceDirectoryList({
  baseParams,
  listConf,
  resourceTypes,
  finderSuffix,
  fieldSuffixes,
  costumSlug,
  contextId,
  contextType,
}: ResourceDirectoryListProps) {
  const t = useT("modules/search");
  const pf = usePageFilters();

  // Filtre « porté par » (clic sur le nom du tiers-lieu d'une carte) → `filters.parentId`
  // CÔTÉ SERVEUR (`Navigator::getRessourceTL`). Pas une facette configurée : piloté
  // depuis les cartes via `ResourceDirectoryActionsProvider`.
  const [activeParent, setActiveParent] = useState<ActiveResourceParent | null>(null);

  // Facette « prix » (`field`) → `searchByFields` → filtres SERVEUR.
  const { filters } = useMemo(
    () => searchByFieldsToQuery(pf.searchByFields ?? {}),
    [pf.searchByFields],
  );
  const serverFilters = useMemo(
    () => ({
      ...filters,
      ...(activeParent ? { parentId: { $in: [activeParent.id] } } : {}),
    }),
    [filters, activeParent],
  );
  const mergedBaseParams = useMemo(
    () => canonicalSearchProStaticBaseParams(baseParams, serverFilters, {}),
    [baseParams, serverFilters],
  );

  const {
    transformedResults,
    lastItemRef,
    isPending,
    isFetchingNextPage,
    error,
  } = useSearchQuery({
    queryKeyPrefix: RD_LIST_PREFIX,
    searchText: "",
    searchTags: {},
    searchType: { type: ["answers"] },
    mapUsed: false,
    baseParams: mergedBaseParams,
    variant: "navigator-tl-ressource",
  });

  const parseOpts = useMemo(
    () => ({ resourceTypes, finderSuffix, fieldSuffixes: { finder: finderSuffix, ...fieldSuffixes } }),
    [resourceTypes, finderSuffix, fieldSuffixes],
  );

  // `getRessourceTL` éclate 1 salle = 1 réponse : plusieurs cartes partagent le
  // `_id` de l'answer source. On re-clé sur `_id` + `roomIndex` pour que les
  // clés React et le deep-link `?resource=` restent uniques (item léger : la
  // carte / le détail ne lisent que `serverData`).
  const items = useMemo(
    () =>
      transformedResults.map((r) => {
        const serverData = (r?.serverData ?? {}) as Record<string, unknown>;
        const model = parseResourceDirectoryItem(serverData, parseOpts);
        const baseId = getEntryId(r) ?? "";
        const uid = model.roomIndex ? `${baseId}-room${model.roomIndex}` : baseId;
        return {
          id: uid,
          serverData,
          getEntityType: () => "answers" as const,
          model,
        };
      }),
    [transformedResults, parseOpts],
  );

  // Facette « type » (client) : `selectedFilters.resourceType` = ids de type.
  const selectedFilters = pf.selectedFilters;
  const visible = useMemo(() => {
    const typeSel = selectedFilters?.resourceType ?? [];
    return typeSel.length === 0
      ? items
      : items.filter((it) => it.model.type && typeSel.includes(it.model.type.id));
  }, [items, selectedFilters]);

  const parentIds = useMemo(
    () =>
      visible
        .map((it) => resolveAnswerParent(it.serverData, resourceTypes, finderSuffix)?.id)
        .filter((v): v is string => !!v),
    [visible, resourceTypes, finderSuffix],
  );
  const { parents } = useResourceParentsQuery(parentIds, { costumSlug, contextId, contextType });

  return (
    <ResourceDirectoryActionsProvider value={{ activeParent, setActiveParent }}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {activeParent && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t("resourceDirectory.activeParentFilter", undefined, { name: activeParent.name ?? "" })}
            <button
              type="button"
              onClick={() => setActiveParent(null)}
              aria-label={t("resourceDirectory.clearParentFilter")}
              className="rounded-full hover:bg-primary/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <p className="text-sm text-muted-foreground">
          {t("resourceDirectory.count", undefined, { count: visible.length })}
        </p>
      </div>

      {error ? (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t("Aucun résultat trouvé.")}
        </div>
      ) : isPending ? (
        <SearchListSkeleton />
      ) : visible.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t("Aucun résultat trouvé.")}
        </div>
      ) : (
        <ResourceParentsProvider value={parents}>
          <SearchListView results={visible as unknown as SearchEntity[]} list={listConf} />
        </ResourceParentsProvider>
      )}

      <div ref={lastItemRef} className="h-12" />
      {isFetchingNextPage && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("Chargement plus de résultats…")}
        </p>
      )}
    </div>
    </ResourceDirectoryActionsProvider>
  );
}
