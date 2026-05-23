[← Retour à l'index](README.md)

# Module Search

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Sections JSON exposées](#sections-json-exposées)
  - [`searchPro` — avec synchronisation URL](#searchpro--avec-synchronisation-url)
  - [`searchProStatic` — sans synchronisation URL](#searchprostatic--sans-synchronisation-url)
  - [`cardCountCT` — compteurs par type](#cardcountct--compteurs-par-type)
  - [`thematics` — filières dynamiques](#thematics--filières-dynamiques)
  - [`filters` — sidebar de filtres partagée](#filters--sidebar-de-filtres-partagée)
- [Context et filtres page-scoped (`pageFilters.ts`)](#context-et-filtres-page-scoped-pagefiltersts)
- [Hooks](#hooks)
  - [useSearchQuery](#usesearchquery)
  - [useSearchFilters](#usesearchfilters)
  - [useFiltersByAnswersQuery](#usefiltersbyanswersquery)
  - [useSearchZoneQuery](#usesearchzonequery)
  - [useCsvExport](#usecsvexport)
  - [useZonesQuery](#usezonesquery)
  - [useItem](#useitem)
  - [useSearchProps](#usesearchprops)
- [Composants principaux](#composants-principaux)
  - [SearchPro vs SearchProStatic](#searchpro-vs-searchprostatic)
  - [SearchListView](#searchlistview)
  - [Cartes (card variants)](#cartes-card-variants)
  - [Mode détails (detailsMode)](#mode-détails-detailsmode)
  - [SearchMap et vue carte](#searchmap-et-vue-carte)
  - [SearchBubbleChart](#searchbubblechart)
  - [FranceRegionsMap](#franceregionsmap)
  - [Preview et MapPopup](#preview-et-mappopup)
  - [ActiveFiltersBar et FilterDropdown](#activefiltersbar-et-filterdropdown)
  - [AddEntityModal](#addentitymodal)
  - [SwitchDetailsMode](#switchdetailsmode)
- [SSR — Prefetch](#ssr--prefetch)
- [Variantes de carte JSON (`list.card.type`)](#variantes-de-carte-json-listcardtype)
- [Variante SDK `searchVariant`](#variante-sdk-searchvariant)
- [i18n](#i18n)
- [Exemples de configuration JSON](#exemples-de-configuration-json)
- [Pièges connus](#pièges-connus)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le module **Search** (`src/modules/search/`) implémente l'interface de recherche avancée de SiteForge. Il expose plusieurs sections JSON, gère la pagination infinie, les filtres multidimensionnels (tags, types, zones géographiques, réponses CoForm), la vue carte Leaflet, l'export CSV, et les graphiques en bulles.

**Type de module** : pas de `module.config.ts` avec routes propres. Le module expose des **sections** chargées lazily par `SectionRenderer`.

**Particularité** : `SearchPro` synchronise ses filtres avec les URL query params (navigable, partage de lien). `SearchProStatic` utilise un état local — plusieurs instances peuvent coexister sur la même page.

---

## Architecture interne

```
src/modules/search/
├── SearchPro.tsx                  # Composant principal (sync URL)
├── SearchProStatic.tsx            # Version sans sync URL (multi-instances)
├── schema.ts                      # Zod : FiltersSectionSchema, SearchProSectionSchema,
│                                  #   SearchProStaticSectionSchema, CardCountCTSectionSchema,
│                                  #   ThematicsSectionSchema (+ types dérivés)
├── styles.css                     # Styles spécifiques (carte, overrides Leaflet)
├── index.ts                       # Exports publics
│
├── sections/
│   ├── SearchProSection.tsx        # Wrapper section → SearchPro
│   ├── SearchProStaticSection.tsx  # Wrapper section → SearchProStatic
│   ├── CardCountCTSection.tsx      # Section compteurs (CT)
│   ├── ThematicsSection.tsx        # Section filières dynamiques
│   └── FiltersSection.tsx         # Section sidebar de filtres partagée (PageFilters)
│
├── components/
│   ├── SearchTextInput.tsx        # Champ de recherche texte
│   ├── SearchListView.tsx         # Liste des résultats (grille responsive + infinite scroll)
│   ├── SearchListSkeleton.tsx     # Skeleton loading liste
│   ├── SearchCard.tsx             # Dispatcher → variante de carte
│   ├── SearchCardDetailed.tsx     # Vue "detailed" d'une carte (layout étendu)
│   ├── SearchCardSkeleton.tsx     # Skeleton loading carte individuelle
│   ├── SearchFilters.tsx          # Panneau de filtres (tags, types)
│   ├── ActiveFiltersBar.tsx       # Barre des filtres actifs (chips supprimables)
│   ├── FilterDropdown.tsx         # Dropdown sélection filtre individuel
│   ├── Preview.tsx                # Dispatcher → variante de preview
│   ├── SwitchDetailsMode.tsx      # Ouvre la fiche en drawer ou dialog
│   ├── SearchMap.tsx              # Carte Leaflet avec clusters et popups
│   ├── SearchMapWrapper.tsx       # Wrapper (lazy-loads Leaflet via useClientModule)
│   ├── FranceRegionsMap.tsx       # Carte choroplèthe régions France (type: "regions")
│   ├── SearchBubbleChart.tsx      # Graphique en bulles (enableGraph: true)
│   ├── renderMapPopup.tsx         # Dispatcher → variante de popup carte
│   ├── AddEntityModal.tsx         # Modal création entité depuis la recherche
│   │
│   ├── card/                      # Variantes de cartes
│   │   ├── CardDefault.tsx        # Carte générique (type: "default")
│   │   ├── CardOverlay.tsx        # Carte avec image en overlay (type: "overlay")
│   │   ├── CardTiersLieux.tsx     # Tiers-lieux spécifique (type: "tiers-lieux")
│   │   ├── CardEvent.tsx          # Événement (type: "event")
│   │   ├── CardEventRezoLaMer.tsx # Événement RezoLaMer (type: "event-rezo-la-mer")
│   │   ├── CardPoiRezoLaMer.tsx   # POI RezoLaMer (type: "poi-rezo-la-mer")
│   │   ├── CardPoiSSBE.tsx        # POI SSBE (type: "poi-ssbe")
│   │   ├── CardProfile.tsx        # Profil générique (type: "profile")
│   │   ├── CardRezoLaMer.tsx      # RezoLaMer (type: "rezo-la-mer")
│   │   ├── CardSsbe.tsx           # SSBE (type: "ssbe")
│   │   ├── CardElts.tsx           # Éléments (type: "card-elts")
│   │   ├── CardAnswer.tsx         # Réponse CoForm (type: "card-answer")
│   │   └── CardCountCT.tsx        # Compteur Commune Transparente
│   │
│   ├── detailsMode/               # Variantes d'affichage des détails
│   │   ├── DetailsModeDialog.tsx  # Dialog centré
│   │   ├── DetailsModeDrawer.tsx  # Drawer latéral droit
│   │   ├── AnswerDetailModeDialog.tsx  # Dialog pour réponses CoForm (SSBE)
│   │   └── PoiDetailSSBE.tsx      # Détail POI SSBE
│   │
│   ├── mapPopup/
│   │   └── MapPopupDefault.tsx    # Popup marqueur carte (défaut)
│   │
│   └── preview/
│       └── PreviewDefault.tsx     # Prévisualisation standard (hover/click)
│
├── contexts/
│   ├── pageFilters.ts             # PageFilters (createPageActionsState) + usePageFilters
│   ├── SearchPropsContext.tsx     # Context des props de configuration
│   └── SearchPropsProvider.tsx   # Provider du context
│
├── hooks/
│   ├── useSearchQuery.ts          # Query principale (infinite + normalisation)
│   ├── useSearchFilters.tsx       # Gestion locale des filtres (non-URL)
│   ├── useFiltersByAnswers.ts     # Filtres dérivés des réponses CoForm (SSR-ready)
│   ├── useSearchZone.ts           # Zones géographiques (SSR-ready)
│   ├── useCsvExport.ts            # Export CSV des résultats actuels
│   ├── useZonesQuery.ts           # Query zones pour le ZoneSelector
│   ├── useItem.tsx                # Fusion données serveur + defaults
│   ├── useSearchProps.tsx         # Accès typé aux props via SearchPropsContext
│   └── loadLeaflet.ts             # Import dynamique Leaflet (client only)
│
├── lib/
│   └── canonicalBaseParams.ts     # canonicalSearchProStaticBaseParams()
│
├── prefetch/
│   ├── prefetchSearchResults.ts   # prefetchSearchQuery (SSR)
│   ├── prefetchFilters.ts         # prefetchFilterSection, prefetchSearchZones,
│   │                              #   prefetchFiltersByAnswers, findFiltersSections
│   └── index.ts
│
├── constants/
│   ├── queryKeys.ts               # SEARCH_QUERY_KEYS
│   └── index.ts
│
└── i18n/
    ├── fr.json
    └── en.json
```

---

## Sections JSON exposées

### `searchPro` — avec synchronisation URL

Section full-featured avec synchronisation des filtres dans les query params de l'URL. Utilisation principale : pages de recherche publiques partageables.

Schéma principal (`SearchProSectionSchema`) — props clés :

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `placeholder` | LocalizedString | — | Texte du champ de recherche |
| `useFilter` | boolean | `true` | Activer le panneau de filtres |
| `showMap` | boolean | `false` | Afficher la carte par défaut |
| `enableMap` | boolean | `true` | Activer le toggle carte |
| `defaultViewMode` | `"list"\|"map"\|"graph"` | — | Vue par défaut |
| `showActiveFiltersTypes` | boolean | `true` | Afficher les filtres types actifs |
| `showActiveFiltersTags` | boolean | `true` | Afficher les filtres tags actifs |
| `disableInfiniteScroll` | boolean | — | Désactiver le scroll infini |
| `showDetailedViewToggle` | boolean | — | Bouton bascule vue détaillée |
| `searchVariant` | `"default"\|"navigator-tl"` | — | Variant SDK backend (cf. §Variante SDK) |
| `customHeader` | objet | — | En-tête personnalisé (titre + lien + bouton carte) |
| `filters` | `Record<string, TagsFilter>` | — | Filtres tags/type (structure héritée) |
| `baseParams` | objet | — | Paramètres API (types, tags, tri, champs, locality…) |
| `list.card.type` | string | `"default"` | Variante de carte |
| `list.card.detailsMode` | `"drawer"\|"dialog"` | `"drawer"` | Mode ouverture détails |
| `map.initialZoom` | number | — | Zoom initial de la carte |

**`baseParams.searchBy`** : contrôle les champs de recherche texte. Valeurs : `"ALL"` (tous les champs), `"name,slug,tags"` (CSV), ou `["name", "address.addressLocality"]` (array de paths). Fix SDK v1.0.132 : pagination cohérente pour les 3 formes.

**`baseParams.notSourceKey`** : accepte `boolean` ou `number` (compat historique). `true` désactive le filtrage par sourceKey.

### `searchProStatic` — sans synchronisation URL

Même structure que `searchPro` mais avec état local. Plusieurs instances peuvent coexister sur une même page sans conflits de query params. Champs supplémentaires :

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `showSearch` | boolean | `false` | Afficher le champ texte |
| `enableGraph` | boolean | `false` | Activer le graphique en bulles |
| `graphCategories` | string[] | — | Catégories pour le graphique |
| `graphDefaultGroupMode` | `"country"\|"category"` | — | Mode de groupement graphique |
| `graphDetailsMode` | `"drawer"\|"dialog"\|"link"` | `"drawer"` | Mode ouverture depuis graphique |
| `enableRegions` | boolean | `false` | Activer la carte des régions France |
| `defaultViewMode` | `"list"\|"map"\|"graph"\|"regions"` | — | Vue par défaut |
| `addButton` | `AddButtonConfig` | — | Bouton ajout entité (show, label, types) |
| `zoneSelector` | `ZoneSelectorConfig` | — | Sélecteur de zones géographiques |
| `tagSelector` | `TagSelectorConfig` | — | Sélecteur de tags prédéfinis |
| `csvButton` | `CsvButtonConfig` | — | Export CSV (colonnes configurables) |
| `bg` | string | — | Fond de section |
| `width` | `"container"` | — | Contrainte de largeur |
| `baseParams.contextId` + `contextType` | string | — | Scope de recherche à une entité |
| `baseParams.costumSlug` + `costumEditMode` | string | — | Config multi-costum |
| `baseParams.sourceKey` | string[] | — | Filtrer par sourceKey |

### `cardCountCT` — compteurs par type

Section de compteurs pour Commune Transparente. Affiche une grille de cartes avec un chiffre par type d'entité.

```json
{
  "type": "cardCountCT",
  "props": {
    "title": { "fr": "En chiffres" },
    "bg": "gradient-teal",
    "baseParams": { "defaultTypes": ["organizations", "citoyens"] },
    "cards": [
      { "countKey": "organizations", "label": { "fr": "Associations" }, "icon": "building-2", "href": "/recherche" }
    ]
  }
}
```

**`bg`** : accepte les tokens sémantiques (`default`, `card`, `muted`, `primary`, `secondary`, `accent`, `transparent`) OU des gradients spécifiques (`gradient-teal`, `gradient-blue`, `gradient-indigo`, `gradient-cyan`) OU une classe Tailwind brute (chaîne libre).

### `thematics` — filières dynamiques

Charge dynamiquement les filières (tags agrégés) depuis l'API et les affiche comme liens de navigation.

```json
{
  "type": "thematics",
  "props": {
    "title": { "fr": "Filières" },
    "subtitle": { "fr": "Naviguez par thème" },
    "emptyMessage": { "fr": "Aucune filière disponible" }
  }
}
```

### `filters` — sidebar de filtres partagée

Section sidebar qui pilote le `PageFiltersContext` partagé. Doit être montée dans le même `PageFiltersProvider` que les `SearchProStatic` consommateurs (via `gridLayout` ou `profile-tab-layout`).

```json
{
  "type": "filters",
  "id": "sidebar-filtres",
  "props": {
    "title": { "fr": "Filtres" },
    "defaultOpenGroups": ["categories"],
    "filterGroups": [
      {
        "id": "categories",
        "label": { "fr": "Catégories" },
        "type": "filters",
        "field": "type",
        "options": [
          { "id": "orga", "label": { "fr": "Associations" } }
        ]
      },
      {
        "id": "zones",
        "label": { "fr": "Zone" },
        "type": "scopeList",
        "config": { "countryCode": ["RE"], "level": ["1"] }
      }
    ],
    "filtersByAnswers": {
      "thematique": {
        "label": { "fr": "Thématique" },
        "forms": "monFormId",
        "path": "thematique"
      }
    }
  }
}
```

Les filtres `scopeList` chargent les zones géographiques via `useSearchZoneQuery`. Les `filtersByAnswers` chargent les options depuis les réponses CoForm via `useFiltersByAnswersQuery`.

---

## Context et filtres page-scoped (`pageFilters.ts`)

`src/modules/search/contexts/pageFilters.ts` — state partagé entre plusieurs sections d'une page (ex : `<FiltersSection>` producteur → `<SearchProStatic>` consommateur).

Créé via `createPageActionsState` (cf. `src/lib/pageState/createPageActionsState.tsx`).

**API publique** :

```ts
// Hook principal (throw si hors Provider)
const {
  selectedFilters,     // Record<string, string[]>
  setSelectedFilters,
  searchQuery,         // string
  setSearchQuery,
  searchByFields,      // Record<string, SearchByFieldValue>
  setSearchByFields,
  filterNames,         // string[] — dérivé : toutes les valeurs de selectedFilters à plat
  clearFilters,
} = usePageFilters();

// Version optionnelle (null hors Provider)
const ctx = usePageFiltersOptional();

// Provider à monter autour des sections productrices + consommatrices
<PageFiltersProvider>
  <FiltersSection ... />
  <SearchProStatic ... />
</PageFiltersProvider>

// Alias compat : PageFiltersProvider = PageFilters.Provider
```

`SearchByFieldValue` : `{ field: string, type?: string, value: string[] | Record<string, unknown> }` — permet aux filtres sidebar de transmettre des critères de recherche structurés (scopeList, answers) aux composants search.

---

## Hooks

### useSearchQuery

Hook principal de chargement des résultats via `entity.searchCostum()` (infinite scroll).

```ts
const {
  results,            // SearchEntity[] normalisés
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  lastItemRef,        // Ref pour infinite scroll
  totalCount,
  error,
  refetch,
} = useSearchQuery(props, filters, options);
```

`props` : props de la section search (baseParams, etc.). `filters` : état courant des filtres. La queryKey inclut une serialization JSON de tous les paramètres actifs.

### useSearchFilters

Gestion de l'état local des filtres (pour `SearchPro` qui synchronise avec l'URL). Retourne `{ filters, setFilter, clearFilters, toggleFilter }`.

### useFiltersByAnswersQuery

Charge les options de filtres dérivées des réponses CoForm via `entity.coformFiltersSearch()`.

```ts
const { data, isLoading, error } = useFiltersByAnswersQuery(
  queryId,     // string — identifiant unique pour la queryKey
  options,     // FiltersByAnswersOptions — map des filtres à récupérer
);
// data : Record<string, FilterAnswerType>
// FilterAnswerType : { label: LocalizedString, values: Record<string, {image, name, orgaNameArray}> }
```

**SSR-ready** : `filtersByAnswersQueryKey()` et `fetchFiltersByAnswers()` sont exportés séparément pour les prefetch SSR.

### useSearchZoneQuery

Charge les zones géographiques (pays, régions, villes) via `entity.searchZone()`.

```ts
const { data, isLoading, error } = useSearchZoneQuery(
  queryId,     // string
  { countryCode: ["RE"], level: ["1"], sortBy?: "name" },
);
// data : ZoneItemNormalized[]
```

`staleTime: 30 minutes` (données rarement modifiées). **SSR-ready** via `searchZoneQueryKey()` + `fetchSearchZones()`.

### useCsvExport

Export CSV des résultats courants via [PapaParse](https://www.papaparse.com/).

```ts
const { exportCsv, isExporting } = useCsvExport(results, csvConfig);
// csvConfig : { separator, filename, columns: [{header, path}] }
```

Résout les paths imbriqués (`serverData.*`) avec gestion spéciale de `address` (concatène les parties de l'adresse).

### useZonesQuery

Query pour le `ZoneSelector` (sélecteur de zones dans la barre de recherche). Différent de `useSearchZoneQuery` — usage interne au composant zone selector.

### useItem

Fusionne les données d'un résultat de recherche avec des valeurs par défaut et normalise la structure pour les composants de carte.

### useSearchProps

Accès typé aux props de configuration de la section courante via `SearchPropsContext`.

---

## Composants principaux

### SearchPro vs SearchProStatic

| | `SearchPro` | `SearchProStatic` |
|---|---|---|
| Sync URL | Oui (query params) | Non |
| Multi-instances / page | Non | Oui |
| PageFiltersProvider | Oui (contexte global) | Oui (local ou partagé) |
| Sections extras | — | `addButton`, `zoneSelector`, `tagSelector`, `csvButton`, `enableGraph`, `enableRegions` |

Les deux composants partagent les mêmes sous-composants (`SearchListView`, `SearchCard`, etc.) via `SearchPropsProvider`.

### SearchListView

Grille responsive des résultats. Propriétés CSS grid pilotées par `list.columns.{sm,md,lg,xl}`. Chaque item est rendu par `<SearchCard>` + déclenchement infinite scroll via `lastItemRef` sur le dernier item.

### Cartes (card variants)

`<SearchCard>` dispatch vers la bonne variante selon `list.card.type` :

| `type` | Composant | Usage |
|--------|-----------|-------|
| `default` | `CardDefault` | Carte générique (nom, image, tags, adresse) |
| `overlay` | `CardOverlay` | Image en fond avec overlay gradient |
| `tiers-lieux` | `CardTiersLieux` | Tiers-lieu (logo, type, horaires) |
| `event` | `CardEvent` | Événement (dates, lieu, organisateur) |
| `event-rezo-la-mer` | `CardEventRezoLaMer` | Événement RezoLaMer (mise en page spécifique) |
| `poi-rezo-la-mer` | `CardPoiRezoLaMer` | POI RezoLaMer |
| `poi-ssbe` | `CardPoiSSBE` | POI Sport-Santé Bien-Être |
| `profile` | `CardProfile` | Profil (avatar, nom, bio) |
| `rezo-la-mer` | `CardRezoLaMer` | Organisation RezoLaMer |
| `ssbe` | `CardSsbe` | Organisation SSBE |
| `card-elts` | `CardElts` | Éléments (projets/membres) |
| `card-answer` | `CardAnswer` | Réponse CoForm |

### Mode détails (detailsMode)

Quand `list.card.detailsMode` est configuré, `<SwitchDetailsMode>` ouvre les détails de l'entité sélectionnée :

| Variante | Composant | Description |
|----------|-----------|-------------|
| `drawer` | `DetailsModeDrawer` | Panneau latéral droit |
| `dialog` | `DetailsModeDialog` | Dialog centré |
| `AnswerDetailModeDialog` | — | Dialog spécifique réponses CoForm (SSBE) |
| `PoiDetailSSBE` | — | Détail POI SSBE dans drawer |

### SearchMap et vue carte

`SearchMapWrapper` : charge Leaflet en client-only via `useClientModule()`. `SearchMap` : carte Leaflet avec markers et clustering (`leaflet.markercluster`). Chaque marker ouvre un popup via `renderMapPopup()` → `MapPopupDefault`.

`loadLeaflet.ts` : import dynamique du bundle Leaflet (déclenché uniquement si `showMap: true`, optimisation bundle).

### SearchBubbleChart

Graphique en bulles pour visualiser la distribution des entités par catégorie. Activé via `enableGraph: true`. Rendu via [Recharts](https://recharts.org/) (`ScatterChart`). Clic sur une bulle → ouvre les détails via `graphDetailsMode`.

### FranceRegionsMap

Carte choroplèthe des régions françaises. Activée via `enableRegions: true` (mode `"regions"`). Utilise des données GeoJSON et D3 pour le rendu SVG.

### Preview et MapPopup

`Preview` / `PreviewDefault` : aperçu rapide d'une entité au survol ou au clic. `MapPopupDefault` : popup dans la carte Leaflet.

### ActiveFiltersBar et FilterDropdown

`ActiveFiltersBar` : barre des filtres actifs sous forme de chips avec bouton de suppression individuel + "tout effacer".

`FilterDropdown` : dropdown de sélection d'un filtre (tags, type d'entité). Utilise Radix UI Popover + Checkbox.

### AddEntityModal

Modal de création d'une nouvelle entité directement depuis la recherche. Activé via `addButton.show: true`. Délègue à `ModalRegistry` du module profil.

### SwitchDetailsMode

Composant qui gère l'ouverture du détail (drawer ou dialog) selon `list.card.detailsMode`. Stocke l'entité sélectionnée en state local et rend le composant de détail correspondant.

---

## SSR — Prefetch

Trois helpers exportés depuis `prefetch/` :

**`prefetchSearchResults(queryClient, props, filters)`** — pré-charge la première page de résultats sur le serveur.

**`prefetchFilterSection(queryClient, section)`** — pré-charge zones + filtersByAnswers pour une section `filters` donnée :

```ts
await prefetchFilterSection(queryClient, {
  type: "filters",
  id: "sidebar",
  props: {
    filterGroups: [{ type: "scopeList", config: { countryCode: ["RE"], level: ["1"] } }],
    filtersByAnswers: { thematique: { forms: "abc123", path: "thematique", label: {...} } },
  },
});
```

**`findFiltersSections(sections)`** — découverte récursive des sections `filters` dans un arbre de sections (travers `gridLayout` et `tabs`). Synchronisée avec `findSearchSections` dans `buildRoutes.tsx`.

Les queryKeys générées par `prefetchSearchZones` et `prefetchFiltersByAnswers` matchent exactement celles de `useSearchZoneQuery` et `useFiltersByAnswersQuery` → cache correctement consommé à l'hydratation.

---

## Variantes de carte JSON (`list.card.type`)

La variante de carte configure non seulement le composant de rendu mais aussi les informations affichées dans le détail. La valeur de `type` correspond à la prop `type` du schéma `list.card`.

**Règle d'extension** : pour ajouter une nouvelle variante, créer `components/card/CardMonNom.tsx`, l'enregistrer dans `SearchCard.tsx` (switch), et ajouter l'entrée dans le schéma `ListConfSchema.card.type`.

---

## Variante SDK `searchVariant`

`searchVariant: "navigator-tl"` change l'endpoint backend utilisé :
- `default` (absent) : `/co2/search/globalautocomplete`
- `navigator-tl` : `/costum/navigator/gettl` — enrichit chaque résultat avec `serverData.answers` (réponses CoForm auto-linkées)

Utilisé pour les sites tiers-lieux qui enrichissent les fiches avec des données CoForm sans étape de lookup supplémentaire.

---

## i18n

Namespace : **`modules/search`**. Enregistré en side-effect par `i18n.ts`.

Groupes de clés dans `fr.json` / `en.json` :
- `SearchPro.*` — labels interface de recherche
- `SearchFilters.*` — labels filtres
- `ActiveFiltersBar.*` — boutons de suppression
- `CardCountCT.*` — labels compteurs
- `Thematics.*` — messages section filières
- `FiltersSection.*` — labels sidebar filtres
- `AddEntityModal.*` — labels modal création
- `export.*` — labels export CSV

---

## Exemples de configuration JSON

**SearchPro** (avec sync URL, carte, filtres) :
```json
{
  "type": "searchPro",
  "id": "recherche",
  "props": {
    "placeholder": { "fr": "Rechercher..." },
    "useFilter": true,
    "showMap": false,
    "enableMap": true,
    "searchVariant": "navigator-tl",
    "showDetailedViewToggle": true,
    "baseParams": {
      "defaultTypes": ["organizations"],
      "indexStepList": 12,
      "searchBy": ["name", "tags", "address.addressLocality"]
    },
    "list": {
      "columns": { "lg": 3, "md": 2, "sm": 1 },
      "card": { "type": "tiers-lieux", "detailsMode": "drawer" }
    },
    "map": { "initialZoom": 10, "cluster": true }
  }
}
```

**SearchProStatic** (multi-instances, export CSV) :
```json
{
  "type": "searchProStatic",
  "id": "evenements",
  "props": {
    "title": { "fr": "Événements" },
    "showSearch": true,
    "baseParams": { "defaultTypes": ["events"], "indexStepList": 6 },
    "list": { "columns": { "lg": 3 }, "card": { "type": "event" } },
    "csvButton": {
      "show": true,
      "label": { "fr": "Exporter" },
      "columns": [
        { "header": "Nom", "path": "name" },
        { "header": "Adresse", "path": "address" },
        { "header": "Date", "path": "startDate" }
      ]
    }
  }
}
```

**Section filters + SearchProStatic dans gridLayout** :
```json
{
  "type": "gridLayout",
  "props": {
    "leftSection": {
      "type": "filters",
      "id": "filtres",
      "props": {
        "filterGroups": [
          {
            "id": "zones",
            "label": { "fr": "Communes" },
            "type": "scopeList",
            "config": { "countryCode": ["RE"], "level": ["2"] }
          }
        ]
      }
    },
    "rightSection": {
      "type": "searchProStatic",
      "id": "resultats",
      "props": {
        "baseParams": { "defaultTypes": ["organizations"] },
        "list": { "card": { "type": "default" } }
      }
    }
  }
}
```

---

## Pièges connus

### 1. `PageFiltersProvider` requis pour `FiltersSection`

La section `filters` lit et écrit dans `PageFiltersContext`. Si elle n'est pas montée dans un `PageFiltersProvider`, elle throw. Le container `gridLayout` et `profile-tab-layout` montent automatiquement un `PageFiltersProvider`. Pour d'autres layouts, l'envelopper manuellement.

### 2. `SearchPro` et query params partagés

Une seule instance de `SearchPro` par page — les filtres sont dans l'URL et une deuxième instance écraserait les query params de la première. Utiliser `SearchProStatic` si plusieurs instances sont nécessaires.

### 3. Leaflet SSR

Leaflet doit être chargé en client-only via `useClientModule()` / `loadLeaflet`. Ne jamais importer `leaflet` directement dans un composant SSR. `SearchMapWrapper` gère ce lazy-loading.

### 4. `searchVariant: "navigator-tl"` — support backend requis

Ce variant utilise un endpoint différent qui n'est pas disponible sur tous les serveurs Cocolight. Vérifier que le backend du site supporte `costum/navigator/gettl` avant de l'activer.

### 5. queryKeys et `prefetchSearchResults`

La queryKey de `useSearchQuery` sérialise tous les paramètres actifs en JSON. Pour que le prefetch SSR corresponde au cache client, il faut passer exactement les mêmes paramètres (même ordre de clés dans les objets JSON). Utiliser `canonicalSearchProStaticBaseParams()` de `lib/canonicalBaseParams.ts` pour la normalisation.

---

## Voir aussi

- [Architecture](03-architecture.md) — modules, SectionRenderer, PageFiltersProvider
- [Module Profil](08-module-profil.md) — intégration SearchPro dans onglets profil
- [Visibility System](19-visibility-system.md) — visibilité conditionnelle des sections
- [Performance](12-performance.md) — lazy-loading Leaflet, bundle Recharts
- [Backend & SSR](14-backend-ssr.md) — prefetch search + filters
