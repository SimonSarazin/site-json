import { useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import NavLink from "@/components/layout/NavLink";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import { getBaseUrl } from "@/lib/constant/common";
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
} from "../lib/resourceDirectory";
import {
  CAPACITY_FILTER_RANGES,
  defaultOpenFilterGroups,
  matchesCapacity,
  matchesZones,
  parentIdsFilter,
  resourceCapacity,
  selectedZones,
  thematicParentIds,
} from "../lib/resourceDirectoryFilters";

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
 * Communecter — `priceFilters`, défaut true). En option : **réseaux thématiques**
 * du lieu porteur (`thematicFilter`, CÔTÉ SERVEUR via `parentId`), **capacité**
 * (`capacityFilter`) et **zone** du lieu porteur (`regionFilter`), CÔTÉ CLIENT.
 * Pas de recherche texte.
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
    customHeader,
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
    limit,
    showFilters = true,
    priceFilters = true,
    capacityFilter = false,
    regionFilter,
    thematicFilter,
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
      indexStepList: Math.min(limit ?? RD_PAGE_SIZE, RD_PAGE_SIZE),
      notSourceKey: true,
      ...(costumSlug ? { costumSlug } : {}),
      ...(contextId ? { contextId } : {}),
      ...(contextType ? { contextType } : {}),
    }),
    [fixedFilters, costumSlug, contextId, contextType, limit],
  );

  // `order` : Type, Thématique, Capacité, Zone, puis les prix — les groupes « par réponses »
  // (`filtersByPath`) se rangent avec les autres sur cette même clé.
  const filtersProps = useMemo<FiltersSectionProps>(
    () => ({
      title: filtersTitle,
      hideSearch: true,
      defaultOpenGroups: defaultOpenFilterGroups({
        thematic: !!thematicFilter,
        capacity: capacityFilter,
        region: !!regionFilter,
        priceGroupIds: priceFilters ? PRICE_FILTER_GROUPS.map((g) => g.field) : [],
      }),
      filterGroups: [
        {
          // Groupe SANS `field` : sélection dans `selectedFilters.resourceType`
          // (par `option.name`) → filtre CÔTÉ CLIENT.
          id: "resourceType",
          label: { fr: "Type de ressource", en: "Resource type" },
          type: "filters",
          optionStyle: "check",
          keepOptionOrder: true,
          order: 0,
          options: resourceTypes.map((rt) => ({ id: rt.id, label: rt.label, name: rt.id })),
        },
        ...(capacityFilter
          ? [
              {
                // Sans `field` : `selectedFilters.capacity` = ids de tranche → filtre CÔTÉ CLIENT.
                id: "capacity",
                label: { fr: "Capacité d'accueil", en: "Capacity" },
                type: "filters" as const,
                optionStyle: "check" as const,
                keepOptionOrder: true,
                order: 2,
                options: CAPACITY_FILTER_RANGES.map((r) => ({ id: r.id, name: r.id, label: r.label })),
              },
            ]
          : []),
        ...(regionFilter
          ? [
              {
                // Zones chargées par `FiltersSection` ; la sélection (`searchByFields`, type `scopeList`)
                // n'est PAS envoyée au backend (la réponse n'a pas d'adresse) : filtre CÔTÉ CLIENT.
                id: "region",
                label: regionFilter.label,
                type: "scopeList" as const,
                config: { countryCode: regionFilter.countryCode, level: regionFilter.level, sortBy: "name" },
                optionStyle: "check" as const,
                order: 3,
              },
            ]
          : []),
        // 3 groupes prix (heure / demi-journée / journée), calqués sur Communecter.
        // Groupe AVEC `field` : sélection → `searchByFields` → `{ <field>: { $in: [tranches] } }`
        // → filtre CÔTÉ SERVEUR (le backend teste chaque champ indépendamment → ET).
        // `searchByFields` est keyé par `option.name` : il DOIT être unique entre les
        // 3 groupes (les tranches `50-100` / `100-200` reviennent) → `name` préfixé du
        // `field`, `variants` porte la vraie valeur `"min-max"` envoyée au backend.
        ...(priceFilters
          ? PRICE_FILTER_GROUPS.map((g, i) => ({
              id: g.field,
              label: g.label,
              type: "filters" as const,
              field: g.field,
              optionStyle: "check" as const,
              keepOptionOrder: true, // tranches croissantes, pas de tri par libellé
              order: 4 + i,
              options: g.ranges.map((r) => ({
                id: `${g.field}:${r.id}`,
                name: `${g.field}:${r.id}`,
                variants: [r.id],
                label: r.label,
              })),
            }))
          : []),
      ],
      // Réseaux thématiques : la sélection donne `filters._id.$in` = lieux membres, renvoyé au
      // backend en `parentId` par la liste (cf. `parentIdsFilter`).
      ...(thematicFilter
        ? {
            filtersByPath: {
              thematic: {
                label: thematicFilter.label,
                thematicPath: thematicFilter.thematicPath,
                finderPath: thematicFilter.finderPath,
                notSourceKey: true,
                optionStyle: "check" as const,
                order: 1,
              },
            },
          }
        : {}),
    }),
    [resourceTypes, filtersTitle, priceFilters, capacityFilter, regionFilter, thematicFilter],
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
        {(title || description || customHeader?.title || customHeader?.linkText) && (
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              {(title || customHeader?.title) && (
                <h2 className="text-2xl font-extrabold text-foreground">
                  {t(title ?? customHeader!.title!)}
                </h2>
              )}
              {description && <p className="text-sm text-muted-foreground">{t(description)}</p>}
            </div>
            {customHeader?.linkText && customHeader.linkHref && (
              <Button asChild variant="outline" size="sm" className="shrink-0 text-foreground">
                {/* Lien venu de la config : NavLink classe l'href (interne, mailto:, externe) —
                    un <Link> brut enverrait un `mailto:` dans le routeur (CLAUDE.md, liens de config). */}
                <NavLink to={customHeader.linkHref}>
                  <ArrowRight className="mr-1 h-4 w-4" />
                  <span>{t(customHeader.linkText)}</span>
                </NavLink>
              </Button>
            )}
          </header>
        )}

        <PageFiltersProvider>
          <div className={cn("grid grid-cols-1 gap-6", showFilters && "lg:grid-cols-4 lg:items-start")}>
            {showFilters && <aside className="lg:col-span-1"><FiltersSection id={id ? `${id}-filters` : undefined} props={filtersProps} /></aside>}
            <div className={showFilters ? "lg:col-span-3" : undefined}>
              <ResourceDirectoryList
                baseParams={baseParams}
                listConf={listConf}
                resourceTypes={resourceTypes}
                finderSuffix={finderSuffix}
                fieldSuffixes={fieldSuffixes}
                costumSlug={costumSlug}
                contextId={contextId}
                contextType={contextType}
                limit={limit}
                showFilters={showFilters}
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
  limit?: number;
  showFilters?: boolean;
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
  limit,
  showFilters,
}: ResourceDirectoryListProps) {
  const t = useT("modules/search");
  const pf = usePageFilters();

  // Filtre « porté par » (clic sur le nom du tiers-lieu d'une carte) → `filters.parentId`
  // CÔTÉ SERVEUR (`Navigator::getRessourceTL`). Pas une facette configurée : piloté
  // depuis les cartes via `ResourceDirectoryActionsProvider`.
  const [activeParent, setActiveParent] = useState<ActiveResourceParent | null>(null);

  // Facettes prix (`field`) → `searchByFields` → filtres SERVEUR. Réseaux thématiques : `_id` (lieux
  // membres) n'existe pas sur une réponse → renvoyé en `parentId`, croisé avec le lieu cliqué.
  const { filters } = useMemo(
    () => searchByFieldsToQuery(pf.searchByFields ?? {}),
    [pf.searchByFields],
  );
  const lieuxFiltres = useMemo(
    () => parentIdsFilter(thematicParentIds(pf.searchByFields), showFilters && activeParent ? activeParent.id : null),
    [pf.searchByFields, activeParent, showFilters],
  );
  // Aucun lieu possible (cf. `parentIdsFilter`) : pas de requête — un `$in` vide serait ignoré par le
  // backend, qui rendrait tout l'annuaire — et liste vide.
  const aucunLieu = lieuxFiltres !== null && lieuxFiltres.length === 0;
  const serverFilters = useMemo(() => {
    const { _id: _thematic, ...rest } = filters;
    void _thematic;
    return { ...rest, ...(lieuxFiltres && lieuxFiltres.length > 0 ? { parentId: { $in: lieuxFiltres } } : {}) };
  }, [filters, lieuxFiltres]);
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
    enabled: !aucunLieu,
  });

  const parseOpts = useMemo(
    () => ({
      resourceTypes,
      finderSuffix,
      fieldSuffixes: { finder: finderSuffix, ...fieldSuffixes },
      baseUrl: getBaseUrl(),
    }),
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

  // Lieux porteurs de TOUTES les ressources chargées (et pas des seules affichées) : le filtre de zone
  // en a besoin pour décider de ce qui s'affiche. `model.parent` = `resolveAnswerParent`, déjà résolu
  // par `parseResourceDirectoryItem`.
  const parentIds = useMemo(
    () => items.map((it) => it.model.parent?.id).filter((v): v is string => !!v),
    [items],
  );
  const { parents, isLoading: parentsLoading, isError: parentsError } = useResourceParentsQuery(parentIds, { costumSlug, contextId, contextType });

  // Facettes CLIENT : type (`selectedFilters.resourceType`), capacité (`selectedFilters.capacity`),
  // zone du lieu porteur (`searchByFields`, type `scopeList`).
  const selectedFilters = pf.selectedFilters;
  const zones = useMemo(() => selectedZones(pf.searchByFields), [pf.searchByFields]);
  const visible = useMemo(() => {
    if (aucunLieu) return [];
    const typeSel = selectedFilters?.resourceType ?? [];
    const capacitySel = selectedFilters?.capacity ?? [];
    const filtered = items.filter((it) => {
      if (typeSel.length > 0 && !(it.model.type && typeSel.includes(it.model.type.id))) return false;
      if (!matchesCapacity(resourceCapacity(it.model.stats[0]), capacitySel)) return false;
      const parentId = it.model.parent?.id;
      return matchesZones(parentId ? parents.get(parentId)?.zones : undefined, zones);
    });
    return limit === undefined ? filtered : filtered.slice(0, limit);
  }, [aucunLieu, items, selectedFilters, zones, parents, limit]);

  return (
    <ResourceDirectoryActionsProvider value={showFilters ? { activeParent, setActiveParent } : null}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {showFilters && activeParent && (
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

      {/* Zone cochée : elle se juge sur l'adresse des lieux porteurs — s'ils n'ont pas pu être lus, la
          liste vide serait un « Aucun résultat » faux. */}
      {error || (zones.length > 0 && parentsError) ? (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t("Aucun résultat trouvé.")}
        </div>
      ) : !aucunLieu && (isPending || (zones.length > 0 && parentsLoading)) ? (
        // Zone cochée : tant que les lieux porteurs ne sont pas lus, aucune ressource ne passe le filtre —
        // squelette plutôt qu'un « Aucun résultat » faux.
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

      {limit === undefined && (
        <>
          <div ref={lastItemRef} className="h-12" />
          {isFetchingNextPage && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("Chargement plus de résultats…")}
            </p>
          )}
        </>
      )}
    </div>
    </ResourceDirectoryActionsProvider>
  );
}
