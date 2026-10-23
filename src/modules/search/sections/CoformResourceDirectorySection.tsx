import { Suspense, useMemo, useState } from "react";
import { lazy } from "vite-preload";
import { ArrowRight, List, Map as MapIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import NavLink from "@/components/layout/NavLink";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import { ClientOnly } from "@/components/layout/ClientOnly";
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
import { useResourceDirectoryItems, type ResourceDirectorySource } from "../hooks/useResourceDirectoryItems";
import MapSkeleton from "../components/MapSkeleton";
import {
  matchesResourceSearch,
  resolveServicePoints,
  resourceDisplayName,
  groupServicesByPoint,
} from "../lib/resourceDirectorySearch";
import { getEntryCoords } from "../lib/searchMapSelection";
import SearchListView from "../components/SearchListView";
import SearchListSkeleton from "../components/SearchListSkeleton";
import { searchByFieldsToQuery } from "../lib/searchByFieldsToQuery";
import {
  CAPACITY_FILTER_RANGES,
  defaultOpenFilterGroups,
  matchesCapacity,
  matchesTypologies,
  matchesZones,
  parentIdsFilter,
  resourceCapacity,
  selectedZones,
  narrowResourceTypes,
  thematicParentIds,
} from "../lib/resourceDirectoryFilters";
import { PRICE_FILTER_GROUPS } from "../lib/resourceDirectory";
import { useSearchParams } from "react-router";
import { decodeCsvParam } from "../lib/urlCsv";

// Vue carte en lazy (vite-preload) : le chunk Leaflet/maplibre n'est chargé qu'au passage en carte.
const SearchMapWrapper = lazy(() => import("../components/SearchMapWrapper"));
const MAP_FILL = "absolute inset-0 z-10 rounded shadow overflow-hidden";


/**
 * Section `coform-resource-directory` — annuaire à plat des ressources d'un
 * tiers-lieu (coworking / salle de réunion / hébergement). Variant SDK
 * `navigator-tl-ressource` (`/costum/navigator/getsressourcetl`) : tiers-lieu
 * porteur résolu + adresse/geo/image + garde région + `documents` + **éclatement
 * 1 salle = 1 réponse**, CÔTÉ SERVEUR. Facette **« type »** CÔTÉ CLIENT ;
 * **3 facettes prix** CÔTÉ SERVEUR (heure / demi-journée / journée, calquées sur
 * Communecter — `priceFilters`, défaut true). En option : **réseaux thématiques**
 * du lieu porteur (`thematicFilter`, CÔTÉ SERVEUR via `parentId`), **capacité**
 * (`capacityFilter`) et **zone** du lieu porteur (`regionFilter`), **recherche texte**
 * (`searchFilter`) et **vue carte** (`showMap`), CÔTÉ CLIENT.
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
    typologyFilter,
    searchFilter = false,
    showMap = false,
  } = props;

  // Ce qu'il faut pour charger les ressources (`useResourceDirectoryItems`) — référence stable.
  const source = useMemo<ResourceDirectorySource>(
    () => ({ resourceTypes, finderSuffix, fieldSuffixes, costumSlug, contextId, contextType, scope, limit }),
    [resourceTypes, finderSuffix, fieldSuffixes, costumSlug, contextId, contextType, scope, limit],
  );

  // `order` : Type, Thématique ou Typologies (rang 1), Capacité, Zone, puis les prix — les groupes « par réponses »
  // (`filtersByPath`) se rangent avec les autres sur cette même clé.
  const filtersProps = useMemo<FiltersSectionProps>(
    () => ({
      title: filtersTitle,
      hideSearch: !searchFilter,
      // La recherche de l'annuaire porte sur le lieu (nom, ville, code postal), pas sur un nom seul.
      searchPlaceholder: {
        fr: "Lieu, ville, code postal…",
        en: "Place, city, ZIP code…",
      },
      defaultOpenGroups: defaultOpenFilterGroups({
        thematic: !!thematicFilter,
        typology: !!typologyFilter,
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
        ...(typologyFilter
          ? [
              {
                // Id `typologies` et `name` = tag, comme le groupe de `/lieux` : même `?typologies=`.
                // Sans `field` : `selectedFilters.typologies` → filtre CÔTÉ CLIENT (tags du lieu porteur).
                id: "typologies",
                label: typologyFilter.label,
                type: "filters" as const,
                optionStyle: "check" as const,
                keepOptionOrder: true,
                order: 1,
                options: typologyFilter.options,
              },
            ]
          : []),
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
      // Réseaux thématiques : `filterTarget: "parentId"` pose la sélection en `parentId` (lieux
      // membres) ; la liste la croise avec le lieu cliqué (cf. `parentIdsFilter`).
      ...(thematicFilter
        ? {
            filtersByPath: {
              thematic: {
                label: thematicFilter.label,
                thematicPath: thematicFilter.thematicPath,
                finderPath: thematicFilter.finderPath,
                // Sélection posée en `parentId` (lieux membres) : le champ que filtre le backend.
                filterTarget: "parentId" as const,
                notSourceKey: true,
                optionStyle: "check" as const,
                order: 1,
              },
            },
          }
        : {}),
    }),
    [resourceTypes, filtersTitle, priceFilters, capacityFilter, regionFilter, thematicFilter, typologyFilter, searchFilter],
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
                source={source}
                listConf={listConf}
                limit={limit}
                showFilters={showFilters}
                // La popup filtre la liste sur le lieu : sans filtres, ce filtre n'existe pas.
                showMap={showMap && showFilters}
              />
            </div>
          </div>
        </PageFiltersProvider>
      </div>
    </section>
  );
}

interface ResourceDirectoryListProps {
  source: ResourceDirectorySource;
  listConf: ListConf;
  limit?: number;
  showFilters?: boolean;
  showMap?: boolean;
}

function ResourceDirectoryList({
  source,
  listConf,
  limit,
  showFilters,
  showMap,
}: ResourceDirectoryListProps) {
  const t = useT("modules/search");
  const pf = usePageFilters();

  // Filtre « porté par » (clic sur le nom du tiers-lieu d'une carte) → `filters.parentId`
  // CÔTÉ SERVEUR (`Navigator::getRessourceTL`). Pas une facette configurée : piloté
  // depuis les cartes via `ResourceDirectoryActionsProvider`.
  const [activeParent, setActiveParent] = useState<ActiveResourceParent | null>(null);

  // Facettes prix (`field`) → `searchByFields` → filtres SERVEUR. Réseaux thématiques : posés en
  // `parentId` (lieux membres, `filterTarget: "parentId"`), recomposés ici avec le lieu cliqué.
  const { filters } = useMemo(
    () => searchByFieldsToQuery(pf.searchByFields ?? {}),
    [pf.searchByFields],
  );
  const lieuxFiltres = useMemo(
    () => parentIdsFilter(thematicParentIds(pf.searchByFields), showFilters && activeParent ? activeParent.id : null),
    [pf.searchByFields, activeParent, showFilters],
  );
  // Sans colonne de filtres, le type peut venir de l'URL de la page (`?resourceType=coworking`) — posé par
  // les boutons d'un `hero-search` placé au-dessus (`ctaButtons[].filters`), comme sur l'accueil pour la
  // liste des lieux. Avec la colonne, c'est elle qui lit l'URL (`FiltersSection`).
  const [searchParams] = useSearchParams();
  const typesDeLUrl = useMemo(
    () => (showFilters ? [] : decodeCsvParam(searchParams.get("resourceType"))),
    [showFilters, searchParams],
  );
  // Ce type filtre la REQUÊTE (formulaires du type seulement), pas la liste reçue : avec `limit`, la
  // section ne charge que N ressources — les filtrer côté navigateur n'en garderait qu'une partie.
  const sourceDeLaRequete = useMemo(
    () => ({ ...source, resourceTypes: narrowResourceTypes(source.resourceTypes, typesDeLUrl) }),
    [source, typesDeLUrl],
  );
  // Aucun lieu possible (cf. `parentIdsFilter`) : pas de requête — un `$in` vide serait ignoré par le
  // backend, qui rendrait tout l'annuaire — et liste vide.
  const aucunLieu = lieuxFiltres !== null && lieuxFiltres.length === 0;
  const serverFilters = useMemo(() => {
    // `parentId` est recomposé ici (réseaux cochés × lieu cliqué, cf. `parentIdsFilter`).
    const { parentId: _reseaux, ...rest } = filters;
    void _reseaux;
    return { ...rest, ...(lieuxFiltres && lieuxFiltres.length > 0 ? { parentId: { $in: lieuxFiltres } } : {}) };
  }, [filters, lieuxFiltres]);

  const {
    items,
    parents,
    parentsLoading,
    parentsError,
    refetchParents,
    lastItemRef,
    isPending,
    isFetchingNextPage,
    error,
    refetch,
  } = useResourceDirectoryItems(sourceDeLaRequete, { serverFilters, enabled: !aucunLieu });

  // Facettes CLIENT : type (`selectedFilters.resourceType`), capacité (`selectedFilters.capacity`),
  // typologies du lieu porteur (`selectedFilters.typologies`, ses tags),
  // zone du lieu porteur (`searchByFields`, type `scopeList`), recherche texte (`searchQuery`, champ de
  // la colonne de filtres : service, lieu porteur, ville, code postal).
  const selectedFilters = pf.selectedFilters;
  const searchQuery = pf.searchQuery;
  const zones = useMemo(() => selectedZones(pf.searchByFields), [pf.searchByFields]);
  const visible = useMemo(() => {
    if (aucunLieu) return [];
    const typeSel = selectedFilters?.resourceType?.length ? selectedFilters.resourceType : typesDeLUrl;
    const capacitySel = selectedFilters?.capacity ?? [];
    const typologySel = selectedFilters?.typologies ?? [];
    const filtered = items.filter((it) => {
      if (typeSel.length > 0 && !(it.model.type && typeSel.includes(it.model.type.id))) return false;
      if (!matchesCapacity(resourceCapacity(it.model.stats[0]), capacitySel)) return false;
      const parentId = it.model.parent?.id;
      const parent = parentId ? parents.get(parentId) : undefined;
      if (!matchesZones(parent?.zones, zones)) return false;
      if (!matchesTypologies(parent?.tags, typologySel)) return false;
      if (!searchQuery.trim()) return true;
      const parentName = parent?.name ?? it.model.parent?.name;
      return matchesResourceSearch(
        [resourceDisplayName(it.model, t, parentName), parentName, parent?.addressLocality, parent?.postalCode],
        searchQuery,
      );
    });
    return limit === undefined ? filtered : filtered.slice(0, limit);
  }, [aucunLieu, items, selectedFilters, typesDeLUrl, zones, searchQuery, parents, limit, t]);

  // Vue carte : un repère par LIEU (cf. `groupServicesByPoint`), sa popup liste ses services
  // (`map.popup.type: "resource-place"`) ; chacun ouvre sa fiche (même détail que la liste : `listConf`).
  const [view, setView] = useState<"list" | "map">("list");
  const { placeItems, placedCount } = useMemo(() => {
    if (!showMap || view !== "map") return { placeItems: [], placedCount: 0 };
    // Position du service, sinon de son lieu porteur, sinon d'un service voisin (cf. `resolveServicePoints`).
    const points = resolveServicePoints(
      visible.map((it) => {
        const c = getEntryCoords(it as unknown as SearchEntity);
        const parentId = it.model.parent?.id;
        return {
          id: it.id,
          parentId,
          own: c ? { lng: c[0], lat: c[1] } : null,
          parent: (parentId ? parents.get(parentId)?.coords : null) ?? null,
        };
      }),
    );
    const parId = new Map(visible.map((it) => [it.id, it]));
    // Libellé du type (« Salle de réunion »…) : sur la conf des types, pas sur le modèle.
    const libelleType = new Map(source.resourceTypes.map((rt) => [rt.id, t(rt.label)]));
    const placeItems = groupServicesByPoint(points).map((groupe) => {
      const services = groupe.ids.map((id) => parId.get(id)!);
      const premier = services[0];
      const parentId = premier.model.parent?.id;
      const parent = parentId ? parents.get(parentId) : undefined;
      const parentName = parent?.name ?? premier.model.parent?.name;
      return {
        id: parentId ?? `${groupe.lng},${groupe.lat}`,
        serverData: {
          name: parentName,
          address: premier.serverData.address,
          geo: { latitude: groupe.lat, longitude: groupe.lng },
          geoPosition: { type: "Point", coordinates: [groupe.lng, groupe.lat] },
        },
        resources: services.map((it) => ({
          entry: it as unknown as SearchEntity,
          name: resourceDisplayName(it.model, t, parentName),
          typeLabel: libelleType.get(it.model.type?.id ?? ""),
        })),
        getEntityType: () => "organizations" as const,
      };
    });
    return { placeItems, placedCount: points.length };
  }, [showMap, view, visible, parents, source.resourceTypes, t]);

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
        {showMap && (
          <div className="ml-auto flex gap-1" role="group" aria-label={t("resourceDirectory.viewMode")}>
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "default" : "outline"}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List className="mr-1 h-4 w-4" />
              {t("resourceDirectory.viewList")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "map" ? "default" : "outline"}
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              <MapIcon className="mr-1 h-4 w-4" />
              {t("resourceDirectory.viewMap")}
            </Button>
          </div>
        )}
      </div>

      {/* Échec de chargement : un message d'ERREUR (et non « Aucun résultat », qui dirait qu'il n'y a rien)
          et de quoi réessayer. Zone cochée : elle se juge sur l'adresse des lieux porteurs — s'ils n'ont
          pas pu être lus, la liste vide serait un « Aucun résultat » faux. */}
      {error || (zones.length > 0 && parentsError) ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <span>{t(error ? "resourceDirectory.loadError" : "resourceDirectory.parentsError")}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void (error ? refetch() : refetchParents())}
          >
            {t("resourceDirectory.retry")}
          </Button>
        </div>
      ) : !aucunLieu && (isPending || (zones.length > 0 && parentsLoading)) ? (
        // Zone cochée : tant que les lieux porteurs ne sont pas lus, aucune ressource ne passe le filtre —
        // squelette plutôt qu'un « Aucun résultat » faux.
        <SearchListSkeleton />
      ) : visible.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {t("Aucun résultat trouvé.")}
        </div>
      ) : view === "map" ? (
        <div className="space-y-2">
          <div className="relative h-[60vh] min-h-[420px]">
            <ClientOnly fallback={<MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />}>
              {() => (
                <Suspense fallback={<MapSkeleton label={t("Chargement de la carte…")} containerClass={MAP_FILL} />}>
                  <ResourceParentsProvider value={parents}>
                    <SearchMapWrapper
                      results={placeItems as unknown as SearchEntity[]}
                      map={{ popup: { type: "resource-place" } }}
                      card={listConf.card}
                      preview={listConf.preview}
                      list={listConf}
                      containerClass={MAP_FILL}
                    />
                  </ResourceParentsProvider>
                </Suspense>
              )}
            </ClientOnly>
          </div>
          {/* Services sans aucune position connue (ni la leur, ni celle de leur lieu ou d'un service
              voisin) : absents de la carte — on le dit plutôt que de laisser croire la carte complète. */}
          {placedCount < visible.length && (
            <p className="text-sm text-muted-foreground">
              {t("resourceDirectory.mapUnplaced", undefined, { count: visible.length - placedCount })}
            </p>
          )}
        </div>
      ) : (
        <ResourceParentsProvider value={parents}>
          <SearchListView results={visible as unknown as SearchEntity[]} list={listConf} />
        </ResourceParentsProvider>
      )}

      {limit === undefined && view === "list" && (
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
