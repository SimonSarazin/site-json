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
  - [`searchHeader` — header de filtres horizontal](#searchheader--header-de-filtres-horizontal)
- [Context et filtres page-scoped (`pageFilters.ts`)](#context-et-filtres-page-scoped-pagefiltersts)
- [Helpers purs partagés (`lib/`)](#helpers-purs-partagés-lib)
  - [buildSearchPayload](#buildsearchpayload)
  - [searchByFieldsToQuery](#searchbyfieldstoquery)
  - [computeFiltersFromUrl](#computefiltersfromurl)
  - [computeUrlFromFilters](#computeurlfromfilters)
  - [answerFilterClause — filtrer une liste d'answers (filterTarget)](#answerfilterclause--filtrer-une-liste-danswers-filtertarget)
  - [canonicalBaseParams](#canonicalbaseparams)
  - [mongoFilters — fusion des filtres $or](#mongofilters--fusion-des-filtres-or)
  - [schedules — regroupement des créneaux CoForm](#schedules--regroupement-des-créneaux-coform)
  - [coformAnswer — parser partagé carte + détail](#coformanswer--parser-partagé-carte--détail)
- [Hooks](#hooks)
  - [useSearchQuery](#usesearchquery)
  - [useAutocomplete](#useautocomplete)
  - [usePageFiltersUrlSync](#usepagefiltersurlsync)
  - [useSearchFilters](#usesearchfilters)
  - [useFiltersByAnswersQuery](#usefiltersbyanswersquery)
  - [useFiltersByPathQuery](#usefiltersbypathquery)
  - [useFilterEntitiesQuery](#usefilterentitiesquery)
  - [useSearchZoneQuery](#usesearchzonequery)
  - [useCsvExport](#usecsvexport)
  - [useZonesQuery](#usezonesquery)
  - [useItem](#useitem)
  - [useSearchProps](#usesearchprops)
- [Composants principaux](#composants-principaux)
  - [SearchPro vs SearchProStatic](#searchpro-vs-searchprostatic)
  - [SearchListView](#searchlistview)
  - [Cartes (card variants)](#cartes-card-variants)
    - [CardPoiAmenities — POI avec aménagements (`card.type: "poi-amenities"`)](#cardpoiamenities--poi-avec-aménagements-cardtype-poi-amenities)
    - [CardProfile — authentification requise](#cardprofile--authentification-requise)
  - [Mode détails — conteneur (`detailsMode`) vs contenu (`preview.type`)](#mode-détails--conteneur-detailsmode-vs-contenu-previewtype)
    - [PreviewPoiAmenities — fiche détail POI (`preview.type: "poi-amenities"`)](#previewpoiamenities--fiche-détail-poi-previewtype-poi-amenities)
  - [Facettes cliquables & navigation par filtre (`dropdownFilters`)](#facettes-cliquables--navigation-par-filtre-dropdownfilters)
  - [Cartes news dans la recherche (CardNews et PreviewNews)](#cartes-news-dans-la-recherche-cardnews-et-previewnews)
  - [Cartes et previews génériques config-driven (testimonial, resource)](#cartes-et-previews-génériques-config-driven-testimonial-resource)
  - [Rendu PAR ITEM des listes hétérogènes (`list.itemRules`)](#rendu-par-item-des-listes-hétérogènes-listitemrules)
  - [SearchMap et vue carte](#searchmap-et-vue-carte)
  - [SearchBubbleChart](#searchbubblechart)
  - [FranceRegionsMap](#franceregionsmap)
  - [Preview et MapPopup](#preview-et-mappopup)
  - [ActiveFiltersBar et FilterDropdown](#activefiltersbar-et-filterdropdown)
  - [AddEntityModal](#addentitymodal)
  - [SwitchDetailsMode](#switchdetailsmode)
- [SSR — Prefetch](#ssr--prefetch)
- [Flux « Design A » — filtres hero → liste cohérente](#flux-design-a--filtres-hero--liste-cohérente)
- [Variantes de carte JSON (`list.card.type`)](#variantes-de-carte-json-listcardtype)
- [Variante SDK `searchVariant`](#variante-sdk-searchvariant)
- [i18n](#i18n)
- [Exemples de configuration JSON](#exemples-de-configuration-json)
- [Pièges connus](#pièges-connus)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le module **Search** (`src/modules/search/`) implémente l'interface de recherche avancée de SiteForge. Il expose plusieurs sections JSON, gère la pagination infinie, les filtres multidimensionnels (tags, types, zones géographiques, réponses CoForm), la vue carte (MapLibre GL), l'export CSV, et les graphiques en bulles.

**Type de module** : `core` (module.config.ts présent). Pas de routes propres — le module expose des **sections** chargées lazily par `SectionRenderer` et monte automatiquement un `PageFiltersProvider` via `module.config.PageProvider`.

**Particularité** : `SearchPro` synchronise ses filtres avec les URL query params (navigable, partage de lien). `SearchProStatic` utilise un état local — plusieurs instances peuvent coexister sur la même page.

---

## Architecture interne

```
src/modules/search/
├── SearchPro.tsx                  # Composant principal (sync URL)
├── SearchProStatic.tsx            # Version sans sync URL (multi-instances)
├── schema.ts                      # Zod : FiltersSectionSchema, SearchProSectionSchema,
│                                  #   SearchProStaticSectionSchema, CardCountCTSectionSchema,
│                                  #   ThematicsSectionSchema, FilterGroupSchema,
│                                  #   FilterGroupsSchema, FiltersByAnswersSchema,
│                                  #   FiltersByPathSchema, IconNameSchema, SearchBaseParamsSchema,
│                                  #   SearchHeaderSectionSchema, ListConfSchema, CardConfSchema,
│                                  #   PreviewConfSchema, TestimonialConfSchema, ResourceConfSchema,
│                                  #   ListItemRuleSchema, ListItemActionSchema (+ types dérivés)
├── styles.css                     # Styles spécifiques (carte, overrides popup/marqueurs MapLibre)
├── module.config.ts               # type: "core", PageProvider: PageFiltersProvider
├── index.ts                       # Exports publics (incl. useAutocomplete, buildSearchPayload)
│
├── sections/
│   ├── SearchProSection.tsx        # Wrapper section → SearchPro
│   ├── SearchProStaticSection.tsx  # Wrapper section → SearchProStatic
│   ├── CardCountCTSection.tsx      # Section compteurs (CT)
│   ├── ThematicsSection.tsx        # Section filières dynamiques
│   ├── FiltersSection.tsx         # Section sidebar de filtres partagée (PageFilters)
│   └── SearchHeaderSection.tsx    # Header horizontal : titre + dropdownFilters + types,
│                                  #   alias rétro-compat "searchHeader"
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
│   ├── ClickableFacet.tsx        # Primitive : valeur cliquable → filtre (dérivé du field)
│   ├── SwitchDetailsMode.tsx      # Ouvre la fiche en drawer ou dialog
│   ├── SearchMap.tsx              # Carte MapLibre GL (react-map-gl) — clusters supercluster + popups React
│   ├── SearchMapMarkers.tsx       # PointMarker/ClusterMarker + dispatcher de vue marqueur (→ mapMarker/)
│   ├── SearchMapPopup.tsx         # Dispatcher popup (switch popup.type → mapPopup/, lazy)
│   ├── SearchMapWrapper.tsx       # Wrapper (charge la carte client-only via useClientModule)
│   ├── FranceRegionsMap.tsx       # Carte choroplèthe régions France (type: "regions")
│   ├── SearchBubbleChart.tsx      # Graphique en bulles (enableGraph: true)
│   ├── ThematicCards.tsx          # Grille cards thématiques (defaultViewMode: "thematics")
│   ├── renderMapPopup.tsx         # Dispatcher → variante de popup carte
│   ├── AddEntityModal.tsx         # Modal création entité depuis la recherche
│   │
│   ├── card/                      # Variantes de cartes (noms DESIGN)
│   │   ├── CardDefault.tsx        # Carte générique (type: "default")
│   │   ├── CardOverlay.tsx        # Carte avec image en overlay (type: "overlay")
│   │   ├── CardImageCover.tsx     # Image pleine largeur (type: "image-cover")
│   │   ├── CardImagePanel.tsx     # Image en panneau latéral (type: "image-panel")
│   │   ├── CardEvent.tsx          # Événement (type: "event")
│   │   ├── CardEventFeatured.tsx  # Événement mis en avant (type: "event-featured")
│   │   ├── CardFunding.tsx        # Financement/cagnotte (type: "funding")
│   │   ├── CardResourceBooking.tsx # Réservation de ressource (type: "resource-booking")
│   │   ├── CardPoiAmenities.tsx   # POI avec aménagements (type: "poi-amenities")
│   │   ├── CardContact.tsx        # Carte contact (type: "contact-card")
│   │   ├── CardProfile.tsx        # Profil générique (type: "profile")
│   │   ├── CardAnswer.tsx         # Réponse CoForm (type: "card-answer")
│   │   ├── CardNews.tsx           # Actualité éditoriale text-first (type: "news")
│   │   ├── CardTestimonial.tsx    # Coque témoignage (type: "testimonial") → dispatch design
│   │   ├── testimonial/
│   │   │   └── CardTestimonialBubble.tsx  # Design "bubble" (config-driven)
│   │   ├── CardResource.tsx       # Coque ressource (type: "resource") → dispatch design
│   │   ├── resource/
│   │   │   └── CardResourceCard.tsx        # Design "card" (image-first, config-driven)
│   │   └── CardCountCT.tsx        # Compteur Commune Transparente
│   │
│   ├── detailsMode/               # Variantes de CONTENEUR (card.detailsMode)
│   │   ├── DetailsModeDialog.tsx  # Dialog centré
│   │   └── DetailsModeDrawer.tsx  # Drawer latéral droit
│   │
│   ├── mapMarker/                 # Variants de vue marqueur (dispatcher non-lazy, perf : rendu par point)
│   │   ├── MapMarkerPin.tsx        #   goutte (pin) — défaut
│   │   ├── MapMarkerCircle.tsx     #   pastille ronde (style: "circle")
│   │   ├── MapMarkerIcon.tsx       #   icône custom (iconUrl)
│   │   └── MapMarkerAvatar.tsx     #   vignette ronde de l'item (useItemImage)
│   │
│   ├── mapPopup/                   # Variants de popup (dispatcher lazy SearchMapPopup, comme SearchCardDetailed)
│   │   └── MapPopupDefault.tsx    # Popup marqueur carte (défaut)
│   │
│   └── preview/                   # Variantes de CONTENU détail (preview.type)
│       ├── PreviewDefault.tsx     # Prévisualisation standard (type: "default")
│       ├── PreviewPoiAmenities.tsx # Fiche détail POI aménagements (type: "poi-amenities")
│       ├── PreviewCoformAnswer.tsx # Fiche détail réponse CoForm (type: "coform-answer")
│       ├── PreviewEvent.tsx        # Fiche détail événement (type: "event")
│       ├── PreviewFacets.tsx       # Preview générique data-driven (type: "facets")
│       ├── PreviewNews.tsx         # Détail actualité — NewsDetailPage embedded (type: "news")
│       ├── PreviewStructure.tsx    # Fiche détail organisation (type: "structure")
│       ├── PreviewTestimonial.tsx  # Coque témoignage (type: "testimonial") → dispatch design
│       ├── testimonial/
│       │   └── PreviewTestimonialBubble.tsx  # Design "bubble"
│       ├── PreviewResource.tsx     # Coque ressource (type: "resource") → dispatch design
│       └── resource/
│           └── PreviewResourceCard.tsx        # Design "card"
│
├── contexts/
│   ├── pageFilters.ts             # PageFilters (createPageActionsState) + usePageFilters
│   ├── previewNav.ts              # PreviewNavContext (previewParam + closeRaw) — facettes
│   ├── SearchPropsContext.tsx     # Context des props de configuration
│   └── SearchPropsProvider.tsx   # Provider du context
│
├── hooks/
│   ├── useSearchQuery.ts          # Query principale (infinite + normalisation)
│   ├── useAutocomplete.ts         # Suggestions de recherche (DANS le module, ex-src/hooks/)
│   ├── usePageFiltersUrlSync.ts   # Applicateur headless URL → PageFilters
│   ├── useSearchFilters.tsx       # Gestion locale des filtres (non-URL)
│   ├── useFiltersByAnswers.ts     # Filtres dérivés des réponses CoForm (SSR-ready)
│   ├── useFiltersByPath.ts        # Filtres par thématique CoForm (coformFilterByPath)
│   ├── useFilterEntities.ts       # Entités pour groupes entityList (réseaux régionaux)
│   ├── useSearchZone.ts           # Zones géographiques (SSR-ready)
│   ├── useCsvExport.ts            # Export CSV des résultats actuels
│   ├── useZonesQuery.ts           # Query zones pour le ZoneSelector
│   ├── useItem.tsx                # Fusion données serveur + defaults
│   ├── useSearchProps.tsx         # Accès typé aux props via SearchPropsContext
│   ├── useDropdownFilterNav.ts   # Navigation par facette route-aware (même/cross-route)
│   ├── useTestimonialData.ts     # Normalise un item → TestimonialData (config-driven)
│   ├── useResourceData.ts        # Normalise un item → ResourceData (config-driven, split medias)
│   ├── useResourceEntity.ts      # Charge le POI complet → galerie/documents/audio/vidéo
│   └── loadLeaflet.ts             # Import dynamique Leaflet (client only — carte profil)
│
├── lib/
│   ├── buildSearchPayload.ts      # SOURCE UNIQUE : baseParams → payload searchCostum
│   ├── searchByFieldsToQuery.ts   # searchByFields → { filters, locality, sourceKeys, searchTarget }
│   ├── computeFiltersFromUrl.ts   # URL query params → mutations PageFilters
│   ├── computeUrlFromFilters.ts   # PageFilters → URL query params (miroir, inverse du précédent)
│   ├── answerFilterClause.ts      # ANSWER_PATH_TYPE / answerGroupFieldPath / answerFilterClause /
│   │                              #   answerToggleArgs — facettes sur une liste d'answers (filterTarget)
│   ├── mongoFilters.ts            # orClausesOf / mergeMongoFilters — fusion des `$or` de defaultFilters
│   ├── canonicalBaseParams.ts     # canonicalSearchProStaticBaseParams()
│   ├── filterToggles.ts           # Logique des toggles de filtres
│   ├── schedules.ts               # groupSchedules — créneaux CoForm groupés par jour (Lun→Dim)
│   ├── coformAnswer.ts            # parseCoformAnswer / getStatusStyle — partagé Card+Preview
│   ├── dropdownFilters.ts        # helpers purs facettes cliquables (resolve/normalize/owner/toState)
│   ├── resolveListItemConf.ts     # conf `list` EFFECTIVE d'un item (règles `itemRules`)
│   ├── itemAction.ts              # resolveItemLink / resolveItemClick — gabarits :slug / :id
│   └── testimonial.ts             # valueColor/bubbleTint/firstMediaUrl/hostname — partagé testimonial+resource
│
├── prefetch/
│   ├── prefetchSearchResults.ts   # prefetchSearchQuery (SSR)
│   ├── prefetchFilters.ts         # prefetchFilterSection, prefetchSearchZones,
│   │                              #   prefetchFiltersByAnswers, prefetchFiltersByPath,
│   │                              #   prefetchFilterEntities, findFiltersSections (générique)
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
| `customHeader` | objet | — | En-tête personnalisé (titre + lien + icône) |
| `filters` | `Record<string, TagsFilter>` | — | Filtres tags/type (structure héritée) |
| `baseParams` | objet | — | Paramètres API (types, tags, tri, champs, locality…) |
| `list.card.type` | string | `"default"` | Variante de carte |
| `list.card.detailsMode` | `"drawer"\|"dialog"` | `"drawer"` | Mode ouverture détails |
| `list.itemRules` | `ListItemRule[]` | — | Rendu PAR ITEM d'une liste hétérogène (cf. §dédiée) |
| `list.itemAction` | objet | — | Action au clic par défaut (`preview`/`profil`/`link`) |
| `map.initialZoom` | number | — | Zoom initial de la carte |

**`customHeader`** : `{ title?, linkText?, linkHref?, linkIcon? }`. `linkIcon` est typé `IconName` (via `IconNameSchema`). Le champ `showMapButton` a été **supprimé** — le bouton carte est toujours présent quand `enableMap: true`.

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
| `regionsTarget` | `{ path, filterId }` | — | Cible de navigation au clic sur une région |
| `defaultViewMode` | `"list"\|"map"\|"graph"\|"regions"\|"thematics"` | — | Vue par défaut |
| `thematicSource` | `{ thematicPath, finderPath?, notSourceKey? }` | — | Source pour la vue thematics (coformFilterByPath) |
| `thematicsTarget` | `{ path, filterId }` | — | Cible de navigation au clic sur une card thématique |
| `addButton` | `AddButtonConfig` | — | Bouton ajout entité (show, label, types) |
| `zoneSelector` | `ZoneSelectorConfig` | — | Sélecteur de zones géographiques |
| `tagSelector` | `TagSelectorConfig` | — | Sélecteur de tags prédéfinis |
| `csvButton` | `CsvButtonConfig` | — | Export CSV (colonnes configurables) |
| `customHeader` | objet | — | En-tête (titre + lien + icône). Affiche aussi un lien « voir sur la page complète » qui reporte les filtres courants et la recherche texte (`?search=`) via `linkText`/`linkHref`/`linkIcon` |
| `bg` | string | — | Fond de section |
| `width` | `"container"` | — | Contrainte de largeur |
| `baseParams.contextId` + `contextType` | string | — | Scope de recherche à une entité |
| `baseParams.costumSlug` + `costumEditMode` | string | — | Config multi-costum |
| `baseParams.sourceKey` | string[] | — | Filtrer par sourceKey |
| `list.layout` | `"grid"\|"timeline"` | `"grid"` (code) | Disposition des résultats : `timeline` = frise verticale (bulle-date, cartes alternées) — cf. [§SearchListView](#searchlistview) |

**Lien « voir sur la page complète »** : si `customHeader.linkText` est renseigné, un bouton `<Link>` est rendu dans le cluster du `customHeader`. La href est construite depuis `customHeader.linkHref` (défaut `/lieux`) en recopiant les query params courants (`useSearchParams`) PLUS `?search=` si une recherche texte est active — de sorte que les filtres posés par le hero (typologies, services) et le texte saisi soient tous transportés vers la page de liste.

**Lecture de `?search=`** : c'est `FiltersSection` (ligne ~190) qui lit `searchParams.get("search")` pour reporter la recherche texte dans son champ local quand on arrive depuis un lien — voir [§`filters` — sidebar de filtres partagée](#filters--sidebar-de-filtres-partagée).

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

Affiche les filières de l'entité courante sous forme de liens de navigation. Les filières sont lues depuis le champ statique `entity?.serverData?.filiere` de l'entité Cocolight déjà initialisée — aucune requête API supplémentaire n'est effectuée.

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

**Rendu PAR GROUPE configurable** — du plus déployé au plus compact. `select`
s'applique aux **trois familles** de groupes (`filterGroups[]` statiques /
scopeList / entityList, `filtersByAnswers`, `filtersByPath`) ; `optionStyle`
ne joue qu'en mode accordéon (`filterGroups[]`) :

| Config du groupe | Widget rendu |
|---|---|
| *(rien)* | accordéon + cases à cocher (défaut) |
| `"optionStyle": "check"` | accordéon + lignes à coche à DROITE (look SelectItem) |
| `"select": {}` | Select simple (Radix) |
| `"select": {"multiple": true}` | combobox multi coche-à-droite (`ui/multi-combobox`) |
| `"select": {"searchable": true}` | recherche + sélection unique (MultipleSelector, remplace) |
| `"select": {"multiple": true, "searchable": true}` | recherche + badges multi (MultipleSelector) |

Mobile (< `lg`, le breakpoint d'empilement du gridLayout) : champ de
recherche AU-DESSUS d'un bouton « Filtres » + compteur ouvrant un Sheet bas —
bascule pur CSS (pas de flash). Desktop : sidebar. Les champs compacts
(`SelectField`/`MultiCheckboxField`/`MultiField`) vivent dans
`components/filterFields.tsx`, partagés avec l'observatoire ; le multi
coche-à-droite est le composant générique `src/components/ui/multi-combobox.tsx`
(consommé aussi par le searchHeader et FilterDropdown).

**Chargement par groupe** : les groupes `scopeList` (zones), `entityList`
(réseaux) et « par réponses » (CoForm) alimentent leurs options par une query.
Tant qu'elle est en vol et sans options, le groupe **garde sa place et son
libellé** — squelette de champ (mode compact) ou en-tête + spinner (mode
accordéon) — au lieu de disparaître puis surgir. La boucle « par réponses »
itère sur les **clés de config** (et non sur le résultat) pour ça. En
chargement direct, les filtres sont **préchargés en SSR** (`prefetchFilters`)
→ cache React Query rempli, pas de flash ; le squelette ne s'observe que sur
navigation client-side / cache expiré. Chaque `Collapsible` est **par groupe**
(et non un `Accordion` partagé) pour interleaver librement champs compacts,
accordéons et boutons valeur-unique sans casser Radix. Les groupes statiques
(`type: "filters"` avec options en config) rendent immédiatement.

Les schémas de filtres (`FilterGroupSchema`, `FilterGroupsSchema`, `FiltersByAnswersSchema`, `FiltersByPathSchema`) sont extraits dans `schema.ts` comme exports partagés — réutilisés par `FiltersSectionSchema` ET par les sections hero qui déclarent des filtres (ex. section hero de la home avec `filterGroups`/`filtersByAnswers`).

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
      },
      {
        "id": "reseauxRegionaux",
        "label": { "fr": "Réseaux régionaux" },
        "type": "entityList",
        "filterType": "sourceKey",
        "baseParams": { "defaultTypes": ["organizations"], "costumSlug": "mon-reseau" }
      }
    ],
    "filtersByAnswers": {
      "thematique": {
        "label": { "fr": "Thématique" },
        "forms": "monFormId",
        "path": "thematique",
        "filterTarget": "linkedElements"
      }
    },
    "filtersByPath": {
      "reseauxThematiques": {
        "label": { "fr": "Réseaux thématiques" },
        "thematicPath": "reseaux.thematiques"
      }
    }
  }
}
```

Les filtres `scopeList` chargent les zones géographiques via `useSearchZoneQuery`. Les `filtersByAnswers` chargent les options depuis les réponses CoForm via `useFiltersByAnswersQuery`. Les `filtersByPath` chargent les options via `useFiltersByPathQuery` (`coformFilterByPath`). Les `entityList` peuplent leurs options dynamiquement via `useFilterEntitiesQuery`.

**`filterTarget` — sur quel document porte la sélection** (clé des groupes `filtersByAnswers` **et** `filtersByPath`, `schema.ts:125` / `schema.ts:158`) : `"linkedElements"` (défaut historique) filtre les éléments **LIÉS** aux réponses — `_id: {$in: orgaNameArray}`, le cas `/lieux` de l'exemple ci-dessus ; `"answers"` filtre les **RÉPONSES elles-mêmes**, par un prédicat sur le chemin déclaré (`path` / `thematicPath`), pour une liste sœur en `baseParams.defaultTypes: ["answers"]` (`/creneaux` de `maison-sport-sante-la-tampon`) :

```json
"filtersByAnswers": {
  "ald": {
    "label": { "fr": "Affection longue durée (ALD)" },
    "forms": "6a85af345d898a57cb49f029",
    "path": "associationEkilibre…_0.multiCheckboxPlusassociationEkilibre…ald",
    "filterTarget": "answers"
  }
}
```

> ⚠️ Poser une facette sur une liste d'`answers` **sans** cette clé est une panne **SILENCIEUSE** : le groupe s'affiche avec ses options, se coche, et **vide la liste**. Le défaut `linkedElements` vit dans le **code** (la config n'est jamais parsée par Zod au runtime) → la clé doit être écrite explicitement. Prédicat émis, table « type d'input → prédicat », piège du libellé à point et gardes preflight : [§answerFilterClause](#answerfilterclause--filtrer-une-liste-danswers-filtertarget).

`FiltersSection` utilise `computeFiltersFromUrl` pour lire les query params d'URL et appliquer les filtres correspondants au montage et à chaque changement d'URL — la même logique que `usePageFiltersUrlSync` (source unique).

`FiltersSection` lit également `?search=` pour reporter la recherche texte dans son champ local quand on arrive depuis un lien.

**Synchro URL bidirectionnelle.** Au-delà de la lecture, `FiltersSection` écrit aussi l'URL au clic (miroir en `replace`, le `PageFiltersContext` reste la source) via `computeUrlFromFilters` (inverse exact de `computeFiltersFromUrl`). Tous les types de filtres de la sidebar sont couverts dans les deux sens : recherche texte (`?search=`), groupes « tag » (`selectedFilters`), `entityList` / `scopeList` / `searchTargets`, groupes « champ » (`group.field`), `dateRange` et `filtersByAnswers`-`filtersByPath` (`searchByFields`) — couverture détaillée et format de chaque param en [§computeUrlFromFilters](#computeurlfromfilters). Résultat : un clic produit un permalien partageable et le bouton retour restaure l'état précédent.

Trois garde-fous évitent toute boucle avec l'effet de lecture (continu) :
- **echo guard** (`lastSyncedSearch`) — l'effet de lecture ignore les écritures que la section vient elle-même de faire ;
- **`urlHydrated`** — l'écriture ne démarre qu'après la 1ʳᵉ lecture, sinon l'état vide du montage effacerait un deep-link `?reseauxRegionaux=…` avant son hydratation ;
- **options non chargées** (entités / zones / CoForm en vol) — le param correspondant est préservé, jamais effacé.

> Note : `scopeList` (pays / régions) range sa sélection dans `searchByFields` (encodage zone → `locality`). La lecture URL le reconstruit à l'identique du clic ; auparavant elle le rangeait par erreur dans `selectedFilters`, ce qui l'envoyait comme **tag** au lieu d'un filtre de localité.

### `searchHeader` — header de filtres horizontal

Section bandeau de filtres **horizontal** (variante de `FiltersSection` présentée en haut de page). Même `PageFiltersContext` — peut cohabiter avec `SearchProStatic` dans le même provider. Alias rétro-compat : `searchHeader` (9 configs existantes, même composant `SearchHeaderSection.tsx`).

**Schéma** (`SearchHeaderSectionSchema`, type : `searchHeader`) — props :

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `headline` | LocalizedString | — | Titre principal `h1` |
| `subhead` | LocalizedString | — | Sous-titre |
| `headlineClassName` | string | `"text-foreground"` | Override classe couleur du `h1`. Utile sur fonds sombres fixes (`bg-ocean-gradient`) : `"text-white dark:text-foreground"` |
| `subheadClassName` | string | `"text-foreground"` | Override classe couleur du sous-titre. Mettre `""` pour hériter sans forcer `text-foreground` |
| `filtersClassName` | string | `"flex flex-col lg:flex-row lg:items-center"` | Override du conteneur flex de la rangée filtres (texte + dropdowns). Ex. : `"flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-center"` |
| `types` | `Array<{id, label}>` | — | Onglets/badges de type d'entité (bascule `selectedFilters.type`) |
| `dropdownFilters` | `TitleWithFiltersDropdownSchema[]` | — | Dropdowns de filtres multi-sélection |
| `buttons` | `ActionButtonSchema[]` | — | Boutons d'action (modal, lien, rejoindre…) via `ActionButtonGroup` |
| `showSearch` | boolean | — | Afficher le champ de recherche texte (lié au `PageFiltersContext.searchQuery`) |
| `searchPlaceholder` | LocalizedString | — | Placeholder du champ de recherche |

**Comportement mobile des `dropdownFilters`** : sur mobile (`lg:hidden`), les dropdowns sont regroupés derrière un unique bouton `SlidersHorizontal` qui ouvre une `Sheet` latérale du bas (`side="bottom"`). La Sheet affiche tous les dropdowns en liste, un badge avec le compteur de filtres actifs, un bouton « Réinitialiser » (si filtres actifs) et un bouton « Voir les résultats » (SheetClose). Sur desktop (`lg:flex`), les dropdowns s'affichent inline dans la barre. Le compteur `activeFilterCount` compte le nombre de dropdowns ayant au moins une valeur sélectionnée.

```json
{
  "type": "searchHeader",
  "id": "header-equipements",
  "props": {
    "headline": { "fr": "Équipements sportifs" },
    "headlineClassName": "text-white dark:text-foreground",
    "subheadClassName": "",
    "showSearch": true,
    "searchPlaceholder": { "fr": "Rechercher un équipement..." },
    "filtersClassName": "flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-center",
    "dropdownFilters": [
      {
        "id": "equip_type_name",
        "label": { "fr": "Type d'équipement" },
        "allLabel": { "fr": "Tous les types" },
        "field": "equip_type_name",
        "options": [
          { "id": "terrain-football", "label": { "fr": "Terrain de football" } }
        ]
      }
    ]
  }
}
```

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

`SearchByFieldValue` : `{ field: string, type?: string, value: string[] | Record<string, unknown> }` — permet aux filtres sidebar de transmettre des critères de recherche structurés (scopeList, answers, sourceKey) aux composants search.

---

## Helpers purs partagés (`lib/`)

### buildSearchPayload

`src/modules/search/lib/buildSearchPayload.ts` — **source unique** de la transformation `baseParams → payload searchCostum`.

Réutilisé par :
- `useSearchQuery` (liste paginée pour `searchPro`/`searchProStatic`)
- `useAutocomplete` (suggestions du hero)

Garantit que l'autocomplete interroge le **même périmètre réseau** que la liste (mêmes `costumSlug`, `contextId`, `sourceKey`, `searchType`…).

```ts
export interface SearchBaseParamsInput {
  fediverse?: boolean;
  indexStepList?: number;
  indexStepMap?: number;
  defaultTypes?: SearchType[];
  defaultTags?: string[];
  defaultFilters?: Record<string, unknown>;
  defaultFields?: string[];
  defaultSortBy?: Record<string, 1 | -1>;
  searchBy?: string | string[];
  notSourceKey?: boolean | number;
  locality?: Record<string, { id: string; type: string; ... }>;
  // contextId, contextType, costumSlug, costumEditMode, sourceKey
  // lus via cast Record<string, unknown> (présents en config)
}

export interface BuildSearchPayloadOverrides {
  name: string;          // Texte recherché
  tags?: string[];       // Tags à plat (filtres cochés)
  type?: string[];       // searchType — undefined = retombe sur defaultTypes
  mapUsed?: boolean;
  graphUsed?: boolean;
  indexStep?: number;    // Override explicit de l'indexStep (autocomplete)
}

export function buildSearchPayload(
  baseParams: SearchBaseParamsInput,
  overrides: BuildSearchPayloadOverrides,
): Partial<GlobalAutocompleteCostumData>
```

`buildSearchPayload` et le type `SearchBaseParamsInput` sont exportés depuis le barrel `index.ts`.

### searchByFieldsToQuery

`src/modules/search/lib/searchByFieldsToQuery.ts` — traduit le `searchByFields` du `PageFilters` en les 4 morceaux de requête consommés par `searchCostum`.

**Source unique** réutilisée par `SearchProStatic` (liste) **et** `useAutocomplete` (suggestions) — garantit des filtres dynamiques identiques des deux côtés.

```ts
export function searchByFieldsToQuery(
  searchByFields: Record<string, SearchByFieldValue>,
): {
  filters: Record<string, Record<string, unknown>>;    // ex. { "_id": { "$in": [...] } }
  locality: Record<string, unknown>;                   // zones scopeList
  sourceKeys: string[];                                // entityList → sourceKey SDK
  searchTarget: SearchTargetQuery | null;              // { defaultTypes?, defaultFilters? } — HORS Mongo
}
```

`filters` est typé `Record<string, Record<string, unknown>>` (et non `…string[]`) parce qu'il porte aussi
des opérateurs de date (`$gt`/`$lte`) et la clé composée `$or` des facettes sur answers.

Règles de mapping (`searchByFieldsToQuery.ts:40-110`) :
- `type === "scopeList"` → `locality`
- `type === "sourceKey"` → `sourceKeys` (injecté dans `baseParams.sourceKey`)
- `type === "searchTarget"` → `searchTarget` — **pas un filtre Mongo** : porté à part (`defaultTypes` /
  `defaultFilters`), radio → au plus une entrée
- `type === "dateRange"` → `filters[field] = { $gt: start, $lte: end }` (bornes présentes seulement ;
  seul `$gt` est converti en date par le backend)
- `type === "answerPath"` (`ANSWER_PATH_TYPE`) → **pas d'écriture directe** : les valeurs sont regroupées
  par chemin de réponse, chaque groupe devient un `$or`, l'ensemble est composé en ET sous la clé unique
  `filters.$or = { $and: [...] }` (cf. [§answerFilterClause](#answerfilterclause--filtrer-une-liste-danswers-filtertarget)
  et [§mongoFilters](#mongofilters--fusion-des-filtres-or))
- autres → `filters[field] = { $in: value }` (merge des valeurs si le champ apparaît plusieurs fois)

### computeFiltersFromUrl

`src/modules/search/lib/computeFiltersFromUrl.ts` — traduit les query params d'URL en mutations de l'état `PageFilters`.

**Source unique** réutilisée par `FiltersSection` (UI `/lieux`) **et** `usePageFiltersUrlSync` (applicateur headless de la home) — garantit exactement les mêmes filtres produits dans les deux contextes… **à condition de passer le 4ᵉ paramètre** : sans `answerGroupConfs`, un deep-link pose un filtre `_id`/orgaNameArray là où le clic pose un prédicat de chemin (cf. `filterTarget` ci-dessous), et les deux divergent en silence. `FiltersSection` le construit en fusionnant `filtersByAnswers` + `filtersByPath` (`FiltersSection.tsx:199`) ; `usePageFiltersUrlSync` passe son `filtersByAnswers` (`usePageFiltersUrlSync.ts:47`).

```ts
export function computeFiltersFromUrl(
  searchParams: URLSearchParams,
  filterGroups: FilterGroupLike[],
  filterAnswerData: FilterAnswerDataLike,
  // Config des groupes « par réponses » indexée par id — défaut `null` (silencieux).
  answerGroupConfs: Record<string, AnswerGroupConf> | null = null,
): {
  applySelected: (prev: Record<string, string[]>) => Record<string, string[]>;
  applySearchFields: (prev: Record<string, SearchByFieldValue>) => Record<string, SearchByFieldValue>;
}
```

Logique de mapping des query params :
- Groupe `type === "entityList"` → `searchByFields` (type `sourceKey`)
- Groupe `type === "scopeList"` → `searchByFields` (type `scopeList`, encodage `{ id, type: level }` → `locality`)
- Groupe « tag » (options en config) → `selectedFilters[groupId]`
- Clé matchant une entrée `filterAnswerData` → `searchByFields[optionKey]`, via `answerToggleArgs`
  (`lib/answerFilterClause.ts:89`), **source unique partagée avec le clic** de `FiltersSection` :
  - groupe sans `filterTarget` ou `filterTarget: "linkedElements"` → `{ field: "_id", value: orgaNameArray }`
    (comportement historique, listes d'éléments liés type `/lieux`) ;
  - groupe `filterTarget: "answers"` avec un `path`/`thematicPath` → `{ field: "answers.<path>",
    type: "answerPath", value: [libellé] }` (cf. [§answerFilterClause](#answerfilterclause--filtrer-une-liste-danswers-filtertarget)).

Les fonctions retournées sont des **fonctions de merge** (elles préservent les clés non gérées par les groupes déclarés) — sûres à passer directement à `setSelectedFilters` / `setSearchByFields`.

### computeUrlFromFilters

`src/modules/search/lib/computeUrlFromFilters.ts` — **inverse** de `computeFiltersFromUrl` : projette l'état `PageFilters` (selectedFilters + searchByFields + recherche texte) dans des query params, au même format que ceux qu'il lit. C'est le moteur du miroir URL écrit par `FiltersSection` au clic (cf. [§`filters`](#filters--sidebar-de-filtres-partagée)).

```ts
export function computeUrlFromFilters(
  current: URLSearchParams,
  selectedFilters: Record<string, string[]>,
  searchByFields: Record<string, SearchByFieldValue>,
  filterGroups: FilterGroupLike[],
  searchQuery?: string,
  filterAnswerData?: FilterAnswerDataLike,
): URLSearchParams
```

Couvre `?search=` (texte), groupes « tag » (`selectedFilters`), `entityList` / `scopeList` / `searchTargets` et groupes « champ » (`group.field`) — noms d'options présents dans `searchByFields` —, `dateRange` (CSV `start[,end]` sous l'id du groupe) et « par réponses » (clés d'options présentes dans `searchByFields`). Clone `current` → préserve les params hors filtres (pagination…) ; ne touche pas un param dont les options ne sont pas encore chargées. Round-trip et idempotence couverts par `computeUrlFromFilters.test.ts`.

**Encodage symétrique.** Chaque valeur est `encodeURIComponent`-ée avant d'être jointe par une virgule (`encodeValues`, `computeUrlFromFilters.ts:43-45`, appliqué aux trois écritures), en miroir du `split(",")` puis `decodeURIComponent` **par segment** de la lecture (`computeFiltersFromUrl.ts:129-132`). Sans lui, une valeur contenant elle-même une virgule (ex. « Collectivités (Département, Intercommunalité, Région, etc) », groupes `portage` de `relief` et `tiers-lieux`) était redécoupée, ne correspondait plus à aucune option, et le param disparaissait de l'URL — perte **partielle et silencieuse** en liste mixte : les valeurs sans virgule survivaient, l'autre non. Ce n'est pas une nouvelle convention : `dropdownFilters.ts` écrit déjà ainsi, avec sa lecture symétrique dans `SearchHeaderSection` ; et l'encodage est l'**identité** sur une valeur URL-safe (aucune URL déjà partagée ne cesse de fonctionner). ⚠ **Exception : le CSV `dateRange`** (`start,end`) n'est PAS encodé — son lecteur ne décode pas et la position de début vide (`,end`) est significative ; l'encoder ferait glisser la borne de fin en borne de début.

### answerFilterClause — filtrer une liste d'answers (filterTarget)

`src/modules/search/lib/answerFilterClause.ts` — décide du prédicat produit par une option cochée dans un groupe « par réponses » (`filtersByAnswers` / `filtersByPath`), selon ce que la liste affiche vraiment.

Ces deux familles de groupes ont été écrites pour `/lieux`, où l'élément listé (l'organisation) **n'est pas** le document qui porte la réponse : la sélection y part en `{ _id: { $in: orgaNameArray } }`. Sur une liste qui porte les **réponses elles-mêmes** (`baseParams.defaultTypes: ["answers"]` — cas `/creneaux` de `maison-sport-sante-la-tampon`), filtrer par `_id` d'organisation ne peut rien rendre : le prédicat doit porter sur le **chemin de la réponse**. C'est le seul rôle de `filterTarget`.

> ⚠️ **Panne SILENCIEUSE.** Un groupe posé sur une liste d'`answers` **sans** `filterTarget: "answers"` s'affiche normalement, avec ses options, se coche… et **vide la liste**. Aucune erreur, aucun log. Comme toute clé de config, `filterTarget` n'est **jamais** parsé par Zod au runtime : le défaut (`linkedElements`) vit dans le **code** — `answerGroupFieldPath` retourne `null` dès que `filterTarget !== "answers"` (`answerFilterClause.ts:45-50`) — la clé doit donc être écrite **explicitement** dans le JSON.

| Export | Rôle |
|---|---|
| `ANSWER_PATH_TYPE` (`"answerPath"`) | `type` posé dans `searchByFields` par un groupe ciblant les answers |
| `answerGroupFieldPath(conf)` | Chemin complet du champ (`answers.<path\|thematicPath>`), ou `null` si le groupe ne cible pas les answers / n'a pas de chemin |
| `answerFilterClause(fieldPath, value)` | Prédicat Mongo d'**une** valeur cochée (table ci-dessous), ou `null` si la valeur est inexprimable |
| `answerToggleArgs(conf, optionKey, option)` | `{field, value, fieldType}` — **source unique** du clic (`FiltersSection.tsx:860`) et de la lecture d'URL (`computeFiltersFromUrl.ts:234`) |

**Table « type d'input CoForm → prédicat »** (`answerFilterClause.ts:65-78`) — portage du legacy `answerDirectory.js` (`showGenPrevAnswers`, l. 1264-1290), même ordre de tests, même sémantique :

| Le chemin contient | Prédicat émis |
|---|---|
| `multiCheckboxPlus` | `{ "<chemin>.<libellé>": { "$exists": true } }` |
| `multiRadio` | `{ "<chemin>.value": "<libellé>" }` |
| `checkboxNew` / `radioNew` | chemin **amputé** du marqueur, libellé en valeur |
| *(aucun des précédents)* | `{ "<chemin>": "<libellé>" }` |

Pourquoi `$exists` sur une clé dotée et pas un `$in` : un `multiCheckboxPlus` stocke ses libellés en **CLÉS**, pas en valeurs (`[{"Obésité":{…}},{"Douleurs chroniques":{…}}]`) — un `$in` sur le chemin comparerait des objets et rendrait 0. Le test d'existence, lui, est **indexé** (index wildcard `answers.$**_1` → SUBPLAN + OR + IXSCAN).

> ⚠️ **Second piège, silencieux lui aussi : le libellé à POINT.** Un libellé de `multiCheckboxPlus` contenant un `.` (« Facilitateur.rice de Tiers-Lieux ») est **inexprimable** — le point deviendrait un niveau de chemin supplémentaire. `answerFilterClause` renvoie alors `null` et **aucun filtre n'est émis** (plutôt qu'un filtre mort) : simple `console.warn` en DEV côté appelant (`searchByFieldsToQuery.ts:102-106`). Les autres branches placent le libellé en VALEUR, où un point est inoffensif.

**Gardes** : `tests/preflight/answer-facets.test.ts` (règle 1 — `filterTarget: "answers"` sans chemin = no-op silencieux ; règle 2 — dans un `gridLayout`, si la liste sœur porte `defaultTypes: ["answers"]`, les groupes de la colonne de filtres DOIVENT cibler les answers) et `tests/preflight/answer-facet-labels.test.ts` (+ `scripts/answer-facet-labels.mjs`, qui va lire les libellés réels des formulaires).

### canonicalBaseParams

`src/modules/search/lib/canonicalBaseParams.ts` — normalise les `baseParams` (déterminisme de la queryKey, merge filters/locality dynamiques).

```ts
export function canonicalSearchProStaticBaseParams(
  baseParams: Record<string, unknown>,
  filters?: Record<string, unknown>,
  locality?: Record<string, unknown>,
): Record<string, unknown>
```

Les `defaultFilters` de la config et les `filters` dynamiques sont assemblés par **`mergeMongoFilters`** et non par un spread (`canonicalBaseParams.ts:30`) — voir juste en dessous.

### mongoFilters — fusion des filtres $or

`src/modules/search/lib/mongoFilters.ts` — `$or` est une clé **unique** de `defaultFilters`, revendiquée par deux écrivains : le périmètre déclaré en config (`config.prod.tiers-lieux.json` pose `defaultFilters.$or = {tags:{$in:["TiersLieux"]}}` sur les pages qui portent justement des groupes « par réponses ») et le réducteur `searchByFieldsToQuery` (facettes sur answers). Un simple `{...a, ...b}` fait gagner le dernier et **détruit silencieusement** le périmètre de l'autre.

| Export | Rôle |
|---|---|
| `orClausesOf(orValue)` | Normalise une valeur de `$or` en membres de `$and` combinables : forme composée `{$and:[…]}` → ses membres tels quels ; MAP legacy `{champ: op, …}` → une clause `{$or:[…]}` ; tableau → idem (**toléré en lecture seulement**) |
| `mergeMongoFilters(base, extra)` | `{...base, ...extra}` **sauf** `$or`, dont les deux côtés sont composés en ET (`{$and:[…]}`) |

Règles (`mongoFilters.ts:54-77`) : quand un **seul** côté porte un `$or`, sa forme est conservée **telle quelle** (les configs et groupes historiques émettent exactement le fil qu'ils émettaient déjà) ; un `$or` **vide** n'est jamais émis (c'est un 500 legacy, « $or must be a nonempty array ») ; la forme **TABLEAU** `$or: [clause, …]` ne doit jamais être émise (500 legacy — cf. §Pièges connus n°12c).

La forme composée `$or: { $and: [ {$or:[…]}, {$or:[…]} ] }` (ET de OU) est mesurée conforme sur les **deux** backends (legacy 5080 et Node 5099) : `SearchNew::searchFilters` (SearchNew.php:549-574) lit `$or` comme une MAP `champ => opérateur` et recopie la valeur **brute**, donc un `$and` niché y passe intact ; `addQuery` empile ensuite chaque clé sous `$and[]` (cf. §Pièges connus n°12d).

### expandCostumSubType — sous-types de costum (clé sucre `costumSubType`)

`src/modules/search/lib/costumSubType.ts` — une entité appartient au sous-type S du costum C si
elle est **native** (créée par le form : elle matche son `identity`) OU **annotée**
(`reference.costumTypes.C == S`, posée au référencement admin, cf.
[30-module-admin](30-module-admin.md)). Pour ne pas dupliquer ce `$or` dans les configs, les
`baseParams` (pages ET sections admin `resource`) acceptent la clé sucre :

```jsonc
"baseParams": { "costumSubType": "financement", … }
```

expansée côté client en `defaultFilters.$or` **forme OBJET mono-champ** (la seule que le legacy
accepte — `SearchNew::searchFilters` construit `array($champ => $valeur)` par entrée) :

```jsonc
{ "$or": { "type": "financement", "reference.costumTypes.institutBleu": "financement" } }
```

- Le discriminant (`identity`) et la clé canonique (`subType`) vivent UNE fois, dans la
  déclaration du form (`costumForms.<id>`, cf. [28-module-formengine](28-module-formengine.md)) ;
- l'expansion est branchée dans `useSearchQuery` (queryKey + payload) ET `prefetchSearchResults`
  (SSR miroir) ; sans la clé, les baseParams ressortent à l'identique (même référence — aucune
  queryKey existante ne bouge) ;
- pas de fuite hors costum : le périmètre (`source.keys` OU `reference.costum`) est déjà appliqué
  en `$and` au-dessus par le serveur (`buildSourceKey`) ;
- `formsDeCollection`/`formDeSousType` (même fichier) résolvent les forms candidats d'une
  collection (costum du site prioritaire — même règle que `costumCreateKey`).

### schedules — regroupement des créneaux CoForm

`src/modules/search/lib/schedules.ts` (commits e293338 / 5d24b6b) — **factorisé** depuis `CardAnswer` et `PreviewCoformAnswer` (logique dupliquée).

`groupSchedules(scheduleRaw)` regroupe les créneaux horaires d'une réponse CoForm (`{ day, startHour, startMinute, endHour, endMinute }`) par **jour**, sur une **clé canonique** (anglais minuscule = clé i18n `days.<key>`) et **triés Lundi → Dimanche** (l'ancienne version regroupait sur le libellé français et affichait les jours dans l'ordre brut de la donnée — bug). Le libellé d'affichage reste à l'i18n via `t("days." + dayKey)`.

```ts
export const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export interface DaySchedule { dayKey: DayKey; times: string[]; }
export function groupSchedules(scheduleRaw: unknown): DaySchedule[]
```

### coformAnswer — parser partagé carte + détail

`src/modules/search/lib/coformAnswer.ts` (commits e293338 / 5d24b6b) — **parser partagé** par `CardAnswer` (carte) ET `PreviewCoformAnswer` (détail), qui dupliquaient les types, le statut, les IDs de champs et l'extraction.

`parseCoformAnswer(serverData, { slug?, fields? })` normalise une réponse CoForm `serverData` en objet typé `CoformAnswer` (titre, description, type, statut, structure, adresse, horaires via `groupSchedules`, bénéficiaires, installation…). Le mapping rôle → suffixe de champ CoForm est `DEFAULT_COFORM_FIELDS`, **surchargeable** par appelant via l'option `fields` (ex. `list.preview.fields`). Le repli de slug est centralisé (`slug ?? "sportSanteBienetre"`).

`getStatusStyle(status)` retourne les classes du badge de statut (tokens custom `bg-badge-valid`/`bg-badge-waiting`/`bg-badge-in-progress`/`bg-badge-refused`).

```ts
export type ActivityStatus = "Valide" | "En attente" | "En cours" | "Refuse";
export const DEFAULT_COFORM_FIELDS: Record<string, string>; // surchargeable via list.preview.fields
export function parseCoformAnswer(serverData: Record<string, unknown>, opts?: ParseCoformOptions): CoformAnswer
export function getStatusStyle(status: ActivityStatus): string
```

---

## Hooks

### useSearchQuery

Hook principal de chargement des résultats via `entity.searchCostum()` (infinite scroll).

```ts
const {
  transformedResults, // SearchEntity[] normalisés
  isLoading,
  isPending,
  isFetchingNextPage,
  hasCount,
  lastItemRef,        // Ref pour infinite scroll
  totalCount,
  error,
  refetch,
} = useSearchQuery(params);
```

`params` : `UseSearchQueryParams` (queryKeyPrefix, searchText, searchTags, searchType, mapUsed, graphUsed, variant, baseParams). Utilise désormais `buildSearchPayload` pour construire le payload — le `console.log` de debug et la construction inline ont été retirés.

### useAutocomplete

`src/modules/search/hooks/useAutocomplete.ts` — suggestions de recherche texte. Précédemment dans `src/hooks/`, **déplacé dans le module** lors du refactoring.

```ts
const { suggestions, isLoading, error } = useAutocomplete(query, {
  baseParams,    // Même périmètre réseau que le searchProStatic de la page
  variant,       // Même variant SDK que la liste ("navigator-tl", etc.)
  tags,          // Tags de filtres actifs — appliqués comme la liste
  indexMax,      // Nombre de suggestions (défaut: 30)
  debounceMs,    // Délai de debounce (défaut: 300)
  minChars,      // Caractères minimum (défaut: 2)
});
```

Construit son payload via `buildSearchPayload(baseParams, { name, type, tags, indexStep })` — **exactement le même périmètre** que `useSearchQuery`. Avant ce refactoring, l'autocomplete faisait un `searchCostum` global non scopé (sans `costumSlug`/`contextId`/`sourceKey`).

Exporté depuis le barrel `index.ts`.

### usePageFiltersUrlSync

`src/modules/search/hooks/usePageFiltersUrlSync.ts` — applicateur de filtres **headless** (sans UI).

Permet à une section hero de la home de filtrer **exactement comme `/lieux`** en lisant les query params de l'URL et en publiant l'état `PageFilters` — sans aucun composant de filtre visible.

```ts
usePageFiltersUrlSync({
  id?: string;                          // Seed de la queryKey filtersByAnswers
  filterGroups?: FilterGroupLike[];     // Groupes de filtres statiques (typologies…)
  filtersByAnswers?: Record<string, unknown>; // Filtres form-based (services…)
});
```

Fonctionnement :
1. Lit `useSearchParams()` pour détecter les changements d'URL
2. Résout `filtersByAnswers` via `useFiltersByAnswersQuery` avec la queryKey `filters-answers-${id}` — **alignée sur la convention du prefetch SSR** (`findFiltersSections`), donc le cache SSR est consommé sans refetch
3. Appelle `computeFiltersFromUrl` (même logique que `FiltersSection`)
4. Publie via `setSelectedFilters(applySelected)` + `setSearchByFields(applySearchFields)` dans le `PageFiltersContext` courant

Ne fait rien si `usePageFiltersOptional()` retourne `null` (hors Provider).

### useSearchFilters

Gestion de l'état local des filtres (pour `SearchPro` qui synchronise avec l'URL). Retourne `{ filters, setFilter, clearFilters, toggleFilter }`.

### useFiltersByAnswersQuery

Charge les options de filtres dérivées des réponses CoForm via `entity.coformFiltersSearch()`.

```ts
const { data, isLoading, error } = useFiltersByAnswersQuery(
  queryId,     // string — identifiant unique pour la queryKey
  options,     // FiltersByAnswersOptions — map des filtres à récupérer
               //   { [key]: { id, label, forms?, path?, finderPath?, filterTarget? } }
);
// data : Record<string, FilterAnswerType>
// FilterAnswerType : { label: LocalizedString, values: Record<string, {image, name, orgaNameArray}> }
```

**SSR-ready** : `filtersByAnswersQueryKey()` et `fetchFiltersByAnswers()` sont exportés séparément pour les prefetch SSR.

`filterTarget` n'agit **pas** sur cette requête (les options chargées sont les mêmes) : il décide du prédicat produit **au clic** et à la lecture d'URL — cf. [§answerFilterClause](#answerfilterclause--filtrer-une-liste-danswers-filtertarget). Idem pour `useFiltersByPathQuery`.

### useFiltersByPathQuery

`src/modules/search/hooks/useFiltersByPath.ts` — filtres par thématique CoForm via `entity.coformFilterByPath()`. Produit le **même shape** que `useFiltersByAnswersQuery` → les deux sont mergeables dans le `filterAnswerData` de `FiltersSection`.

```ts
const { data, isLoading, error } = useFiltersByPathQuery(
  queryId,    // string
  options,    // FiltersByPathOptions — { [key]: { thematicPath, finderPath?, notSourceKey?, filterTarget? } }
);
// data : Record<string, FilterAnswerType>
```

Un appel `coformFilterByPath` par entrée (en parallèle). `staleTime: 5 minutes`. **SSR-ready** via `filtersByPathQueryKey()` + `fetchFiltersByPath()`.

### useFilterEntitiesQuery

`src/modules/search/hooks/useFilterEntities.ts` — peuple les options d'un groupe `type: "entityList"` (réseaux régionaux…) via `entity.searchCostum()`.

```ts
const { data, isLoading, error } = useFilterEntitiesQuery(
  queryId,    // string
  options,    // FilterEntitiesOptions (= SearchBaseParams)
  filterBy,   // string — champ de l'entité utilisé comme valeur (défaut: "slug")
);
// data : FilterEntity[] — { name: string, value: string }
```

`staleTime: 30 minutes`. **SSR-ready** via `filterEntitiesQueryKey()` + `fetchFilterEntities()`.

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
| Sections extras | — | `addButton`, `zoneSelector`, `tagSelector`, `csvButton`, `enableGraph`, `enableRegions`, `thematicSource`, `thematicsTarget`, `regionsTarget` |
| Lien « voir sur page complète » | Non | Oui (via `customHeader.linkText` + report des filtres URL + `?search=`) |

Les deux composants partagent les mêmes sous-composants (`SearchListView`, `SearchCard`, etc.) via `SearchPropsProvider`.

### SearchListView

Grille responsive des résultats. Propriétés CSS grid pilotées par `list.columns.{sm,md,lg,xl}`. Chaque item est rendu par `<SearchCard>` — enveloppé dans son propre `<Suspense fallback={<SearchCardSkeleton/>}>` — + déclenchement infinite scroll via `lastItemRef` sur le dernier item.

**Conf résolue par item** : avant la boucle, `resolveListItemConfs(results, list)` (mémoïsé) calcule la conf de liste EFFECTIVE de chaque résultat (cf. [§Rendu PAR ITEM](#rendu-par-item-des-listes-hétérogènes-listitemrules)). Sans `list.itemRules`, chaque entrée vaut `list` **lui-même** — comportement mono-carte strictement inchangé. Le clic passe par `resolveItemClick` (`lib/itemAction.ts`) : `link` → navigation, `profil` → `/profil/:slug`, sinon ouverture du détail. Le **mode split** (`onFocusItem`) garde la priorité absolue : le clic focalise le marqueur et l'action est ignorée.

**Un seul `<SwitchDetailsMode>`, monté HORS de la boucle** : il ne peut donc pas recalculer la règle de l'item ouvert. L'état de sélection porte la paire `{ item, list }` (même pattern que `EntityPreviewState` de la palette, `commandPalette/components/CommandPalette.tsx`) — c'est ce qui permet à `card.detailsMode` et `preview.type` de varier d'un item à l'autre dans la même liste.

**Sync URL ↔ preview** (`list.previewParam`, défaut `"preview"`) : ouvrir un item écrit `?<previewParam>=<id>` (`{replace}`) → **deep-link / partage / reload** persistants. L'id est celui de `getEntryId` **des deux côtés** (écriture et relecture) : les deux formules divergeaient auparavant (`getEntryId` à l'écriture, `serverData?.id ?? id` à la relecture), et `serverData.id` n'est pas toujours peuplé sur un résultat de recherche (cf. `lib/searchMapSelection.ts`) — un deep-link pouvait donc ne pas rouvrir son item ; l'effet d'auto-ouverture relit ce param (ouvre l'item correspondant) **et** ferme quand le param disparaît (back/forward, nav sœur) → l'état suit toujours l'URL. Pour **plusieurs listes preview sur une même page**, donner à chacune un `previewParam` distinct en config (ex. `"preview-equipements"`) pour éviter la collision. `SearchListView` fournit aussi le `PreviewNavContext` (`{ previewParam, closeRaw }`) consommé par `useDropdownFilterNav` (cf. [§Facettes cliquables](#facettes-cliquables--navigation-par-filtre-dropdownfilters)).

**Config `list` tuyautée d'un bout à l'autre** : depuis l'introduction des cartes typées (`testimonial` / `resource`), la config `list` COMPLÈTE (`list?: ListConf`, `ListConfSchema` désormais **exporté**) descend tout le pipeline — `SearchListView` → `SearchCard` et `SearchListView` → `SwitchDetailsMode` → `DetailsModeDialog` / `DetailsModeDrawer` → `Preview`. `list` est transmis à **TOUS** les variants de `SearchCard` et de `Preview` (et non aux seuls presenters typés) ; chacun y lit **sa** tranche (`list.testimonial`, `list.resource`), les autres l'ignorent. `SearchMapWrapper` / `SearchMap` le reçoivent aussi désormais — sans quoi un détail ouvert depuis la carte géographique retombait sur les presenters génériques. `SearchListView` / `SwitchDetailsMode` gardent des props `columns` / `card` / `preview` / `previewParam` optionnelles (agenda, observatoire, profil… qui appellent sans objet `list`) et dérivent chaque valeur via `prop ?? list?.x` ; les call-sites search ne passent plus que `list={list}`. Conséquence : **`SearchPro` honore désormais `list.previewParam`** (auparavant ignoré — il ne transmettait pas ce champ à `SearchListView`).

**Layout timeline** (`list.layout: "timeline"`) : `SearchListView` dispatche vers `TimelineListView` (chunk `lazy()`, même convention que les variants de carte) — frise verticale avec ligne pointillée (à gauche en mobile, centrée dès `md`), **bulle-date** (jour/mois abrégé/année, repli icône calendrier + `bg-muted` sans `startDate`) posée sur la ligne, cartes **alternées gauche/droite par index** (pur : stable en scroll infini et identique SSR/client), rendues par `CardEventTimeline` (titre, heure `HH:mm`, chip catégorie — `card.tagLimit` défaut 1, `card.tagColors` honoré —, extrait 3 lignes, visuel à droite, bouton « En savoir plus »). Pensé pour des événements triés `defaultSortBy: {"startDate": -1}`. La **vue détaillée** (`isDetailedView`) et le **mode split** (`onFocusItem`) gardent la priorité (la timeline n'y a pas de sens) ; le détail, le deep-link `?<previewParam>=` et les `itemRules` passent par le MÊME flux que la grille. Défaut **côté code** = grille : la clé absente ou inconnue rend la grille historique (la config n'est jamais parsée par Zod au runtime).

### Cartes (card variants)

`<SearchCard>` (`components/SearchCard.tsx`) dispatch vers la bonne variante selon `list.card.variant || list.card.type` — où `list.card` est la conf **résolue de l'item** quand la liste porte des `itemRules` (cf. [§Rendu PAR ITEM](#rendu-par-item-des-listes-hétérogènes-listitemrules)). **Les variantes sont nommées par DESIGN / FONCTIONNALITÉ, jamais par site** (découplage commit 8cd4070 — les anciens noms `tiers-lieux`, `rezo-la-mer`, `poi-ssbe`, `ssbe`, `card-elts`, `event-rezo-la-mer`, `poi-rezo-la-mer`… ont été supprimés).

Trois **axes orthogonaux** pilotent le rendu (commit 8cd4070) :

- **`card.type` / `card.variant`** → la carte de liste (`SearchCard`) ;
- **`card.detailsMode`** → le *conteneur* de détail (`SwitchDetailsMode` : `drawer`/`dialog`) ;
- **`preview.type`** → le *contenu* du détail rendu DANS ce conteneur (`Preview` : `default`/`poi-amenities`/`coform-answer`/`event`/`facets`/`news`/`testimonial`/`resource`/`structure`).

| `card.type` (ou `variant`) | Composant | Usage |
|--------|-----------|-------|
| `default` | `CardDefault` | Carte générique (nom, image, tags, adresse) |
| `overlay` | `CardOverlay` | Image en fond + overlay gradient |
| `image-cover` | `CardImageCover` | Image de couverture en haut |
| `image-panel` | `CardImagePanel` | Image en panneau latéral |
| `event` | `CardEvent` | Événement (dates, lieu, organisateur) |
| `event-featured` | `CardEventFeatured` | Événement mis en avant |
| `funding` | `CardFunding` | Financement / cagnotte |
| `resource-booking` | `CardResourceBooking` | Ressource réservable |
| `poi-amenities` | `CardPoiAmenities` | POI avec aménagements/équipements (voir ci-dessous) |
| `contact-card` | `CardContact` | Fiche contact |
| `profile` | `CardProfile` | Profil (avatar, nom, bio) — auth requise pour les actions |
| `card-answer` | `CardAnswer` | Réponse CoForm (activité avec horaires) |
| `news` | `CardNews` | Carte éditoriale **text-first** (l'item est une `News`, cast au point de dispatch) — cf. [§Cartes news](#cartes-news-dans-la-recherche-cardnews-et-previewnews) |
| `testimonial` | `CardTestimonial` | Coque (`export default`) → dispatch sur `list.testimonial.design` (repli `bubble`) → `CardTestimonialBubble` — cf. [§génériques config-driven](#cartes-et-previews-génériques-config-driven-testimonial-resource) |
| `resource` | `CardResource` | Coque → dispatch sur `list.resource.design` (repli `card`) → `CardResourceCard` (média-library, **distinct** de `resource-booking`/`CardResourceBooking`) |

> `news`, `testimonial` et `resource` ne sont acceptées **que** par `card.type` : l'enum `card.variant` (schema.ts) ne les inclut pas (comme `overlay`).

**`card.structureAction`** (carte `card-answer` uniquement, `schema.ts:461`) — ce que fait le bouton « Fiche structure » : `{"kind": "profil"}` navigue vers `/profil/:slug` (comportement historique) ; `{"kind": "preview"}` ouvre la fiche **en modale** — `SwitchDetailsMode` monté en `dialog` avec `preview: {type: "structure"}` (`CardAnswer.tsx:215-221`) — sans quitter la liste ni perdre filtres et position de défilement. Défaut **côté code** `profil` : `CardAnswer.tsx:38` teste `=== "preview"`, donc clé absente = navigation ; la config n'étant jamais parsée par Zod au runtime, la poser **explicitement** est le seul moyen d'activer la modale. L'entité complète (la carte ne porte qu'un sous-document de la structure) n'est chargée **qu'au clic** — `useEntityBySlugQuery` conditionné à l'ouverture — et le bouton reste `disabled` pendant ce chargement. Même forme que `map.itemAction`, à dessein : un seul vocabulaire d'action dans le module. Posé en config réelle : `config.prod.maison-sport-sante-la-tampon.json:795`.

Toutes les variantes sont lazy-loadées. Une page **mono-type** ne télécharge que le chunk configuré ; une liste **hétérogène** (`list.itemRules`, cf. [§Rendu PAR ITEM](#rendu-par-item-des-listes-hétérogènes-listitemrules)) en charge un par famille présente — c'est pourquoi `SearchListView` enveloppe chaque carte dans son **propre `<Suspense>`**. Les **couleurs en dur** des cartes ont été remplacées par des **tokens de thème** (commits 4936978 / ad11831 / 06baffb) → chaque carte s'adapte au thème du site et au mode clair/sombre.

#### CardPoiAmenities — POI avec aménagements (`card.type: "poi-amenities"`)

`src/modules/search/components/card/CardPoiAmenities.tsx` (ex-`CardPoiSSBE`, renommé par DESIGN au commit 8cd4070) — carte POI listant les aménagements/équipements (accès PMR, transport, éclairage, douches, libre accès).

**Typage** : le composant caste `item` en `Poi` (type SDK `@communecter/cocolight-api-client`) et lit **uniquement `serverData`** (pas de cast `Record<string, unknown>` global). L'interface locale `Poi` a été supprimée — la lib SDK fournit le type.

**Champs lus depuis `serverData`** :

| Champ `serverData` | Affichage |
|--------------------|-----------|
| `equip_type_name` / `categorie` / `equip_type_famille` | Catégorie (dans cet ordre de priorité) |
| `inst_nom` | Nom de l'installation (`Building2`) |
| `profilMediumImageUrl` / `profilThumbImageUrl` / `profilImageUrl` / `profileImageUrl` / `image` | Image (par ordre de priorité) |
| `address.streetAddress` / `address.postalCode` / `address.addressLocality` | Adresse |
| `inst_acc_handi_bool` | Feature « Accès PMR » |
| `inst_trans_bool` | Feature « Transport en commun » |
| `equip_eclair` | Feature « Éclairage » |
| `equip_douche` | Feature « Douches » |
| `equip_acc_libre` | Feature « Libre accès » |
| `inst_date_creation` / `created` | Date de création (affichage « il y a N ans ») |

**`isTrue()`** : normalise les champs d'accessibilité en booléen depuis `boolean | number | string` (`"1"`, `"oui"`, `"yes"`, `"true"`, `true`, `1`).

**`toDate()`** : gère `Date` (entités revifiées) et `string` ISO (après hydratation SSR — les `Date` JSON sont sérialisées en string). Sans heuristique epoch.

**Image de fallback** : placeholder SVG déterministe (initiales + couleur par hash du nom) généré côté client — SSR-safe.

**`<OptimizedImage>`** remplace `<img>` — srcSet 1x/2x, lazy loading automatique.

**Thème** : plus de couleur en dur — la surface « feature active » utilise `bg-primary/10 text-primary`, le bloc adresse `bg-primary/5` (tokens adaptatifs, commit 06baffb).

**Labels traduits** : la section « Aménagement » et toutes les features utilisent les clés `CardPoiAmenities.*` du namespace `modules/search` (fr/en).

**Badge « Validé »** (`enqueteStatut === "Validé"`) : supprimé de la carte (conservé dans la fiche détail). Plus de badge dans le header de la carte.

#### CardProfile — authentification requise

`src/modules/search/components/card/CardProfile.tsx` — carte profil (utilisateur ou organisation).

**Changement** : les actions « Suivre » et « Contacter », quand l'utilisateur n'est pas connecté, déclenchent désormais `openLogin()` (hook `useAuthModal` du module `auth`) au lieu d'afficher un `toast.error` ou de désactiver le bouton.

- Bouton « Contacter » : **plus de `disabled={!isConnected}`** — toujours cliquable ; si non connecté → `openLogin()`.
- Bouton « Suivre » : **`disabled={isLoadingFollow}` uniquement** (plus de `disabled={!isConnected || isLoadingFollow}`) — toujours cliquable si le follow n'est pas en cours ; si non connecté → `openLogin()`.

Voir [doc/23-module-auth.md](23-module-auth.md) pour l'API `useAuthModal`.

### Mode détails — conteneur (`detailsMode`) vs contenu (`preview.type`)

Le détail d'une entité sélectionnée est **découplé en deux axes** (commit 8cd4070) :

`<SwitchDetailsMode>` choisit le **conteneur** selon `list.card.detailsMode` **uniquement** (il ne lit plus jamais `card.type`) — `list.card` étant, sur une liste à `itemRules`, la conf résolue de l'item ouvert :

| `card.detailsMode` | Composant | Description |
|----------|-----------|-------------|
| `drawer` (défaut) | `DetailsModeDrawer` | Panneau latéral droit |
| `dialog` | `DetailsModeDialog` | Dialog centré |

`<Preview>` (`components/Preview.tsx`) choisit le **contenu** rendu DANS ce conteneur selon `list.preview.type` :

| `preview.type` | Composant | Description |
|----------|-----------|-------------|
| `default` (défaut) | `PreviewDefault` | Aperçu générique (caractéristiques = filtres tags/type via `props.filters`) |
| `poi-amenities` | `PreviewPoiAmenities` | Fiche détail POI avec aménagements (ex-`PoiDetailSSBE`, voir ci-dessous) |
| `coform-answer` | `PreviewCoformAnswer` | Fiche détail réponse CoForm (activité + horaires, ex-`AnswerDetailModeDialog`) |
| `event` | `PreviewEvent` | Fiche détail événement (actions Participer/Suivre/Éditer) |
| `facets` | `PreviewFacets` | **Preview générique data-driven** : rend `preview.facets` (champs `serverData` cliquables) — voir [§Facettes cliquables](#facettes-cliquables--navigation-par-filtre-dropdownfilters) |
| `news` | `PreviewNews` | Détail actualité — embarque `NewsDetailPage` (mode `embedded`) + permalien « Voir en page » (cf. `preview.showDetailLink`) |
| `testimonial` | `PreviewTestimonial` | Coque → `PreviewTestimonialBubble` (dispatch `list.testimonial.design`) |
| `resource` | `PreviewResource` | Coque → `PreviewResourceCard` (dispatch `list.resource.design`) |
| `structure` | `PreviewStructure` | Fiche détail d'une **organisation** : hero (statut / type / logo), affiliation, adresse + carte, représentant légal, infos, documents — champs custom du costum lus via l'index signature de `serverData`. Utilisée par `/structure` (`config.prod.maison-sport-sante-la-tampon.json:2125`) **et** par le bouton « Fiche structure » de `CardAnswer` (cf. `card.structureAction`) |

Chaque contenu de `Preview` borne lui-même sa hauteur/scroll (indépendant du conteneur). `list.preview.fields` surcharge le mappage des IDs de champ CoForm (voir « parser CoForm » ci-dessous).

**`list.preview.width`** (enum `sm|md|lg|xl|2xl|3xl|4xl|5xl|full`) pilote la largeur MAX du conteneur en mode **`dialog`** : `DetailsModeDialog` mappe la valeur sur une classe `sm:max-w-*` (`full` → `sm:max-w-[95vw]`) ; défaut **code** `5xl` (comportement historique). Sans effet en mode `drawer`. **`list.preview.showDetailLink`** (boolean) affiche le lien « Voir en page » dans l'en-tête de la modale de détail (lu par `PreviewNews`, testé `!== false`) ; défaut = affiché, mettre `false` pour le masquer. Comme toute clé de config, ces champs ne sont **jamais** parsés par Zod au runtime (les `.default()` n'agissent pas) → à poser explicitement dans le JSON.

#### PreviewPoiAmenities — fiche détail POI (`preview.type: "poi-amenities"`)

`src/modules/search/components/preview/PreviewPoiAmenities.tsx` (ex-`PoiDetailSSBE`, renommé par DESIGN au commit 8cd4070) — fiche détail complète d'un POI avec aménagements.

**Structure du Dialog** : layout `flex flex-col` avec header fixe (`shrink-0`) et corps défilant (`min-h-0 flex-1 overflow-y-auto`). `ScrollArea` (composant shadcn) remplacé par un `<div>` natif `overflow-y-auto` pour un scroll flex correct sans tronquement. Le bouton de fermeture est rendu comme `DialogClose` custom (icône `X`) positionné en absolu en haut à droite, aux côtés du bouton « Éditer ».

**Typage** : le composant caste `item` en `Poi` (SDK) et accède à `serverData` typé via `sd`. La fonction `toPoi()` ne lit plus que `sd.*` (champs SDK + index signature pour les costum `equip_*`, `inst_*`, `pmr_*`, `pshs_*`). Toutes les heuristiques de résolution `costumData`/`entityData` ont été supprimées.

**Champs `PoiDetail` lus depuis `serverData`** (mappage complet) :

| Champ `serverData` | Champ `PoiDetail` | Section |
|--------------------|-------------------|---------|
| `equip_type_name` / `equip_type_famille` | `category` / `familleEquipement` | Général |
| `inst_nom` | `installation` | Général |
| `aps_name` | `sportPratiquer` | Général |
| `categorie` | `categorie` | Général |
| `inst_date_creation` | `dateCreation` | Suivi |
| `inst_enqu_date` | `dateEnquete` | Suivi |
| `equip_maj_date` | `lastUpdate` | Suivi |
| `equip_prop_nom` | `equipPropNom` | Gestion |
| `equip_prop_type` | `entrepriseFonciere` | Gestion |
| `equip_gest_type` | `equipGestType` | Gestion |
| `equip_loc_type` | `equipLocType` | Gestion |
| `equip_utilisateur` | `equipUtilisateur` | Gestion |
| `equip_douche` | `equipDouche` | Accessibilité |
| `inst_acc_handi_bool` | `handicap` | Accessibilité |
| `inst_trans_bool` | `transportCommun` | Accessibilité |
| `inst_acc_handi_type` | `typeAccessiblHandicap` | Accessibilité |
| `inst_trans_type` | `typeTransportCommun` | Accessibilité |
| `equip_pmr_acc/chem/douche/sanit/trib/vest` | `equipPmr*` | Détails PMR |
| `equip_pshs_aire/chem/sanit/trib/vest/sign` | `equipPshs*` | Détails PSHS |
| `equip_nature` | `nature` | Technique |
| `equip_sol` | `sol` | Technique |
| `equip_surf` | `surface` | Technique |
| `equip_long` / `equip_larg` | `longueur` / `largeur` | Technique |
| `equip_eclair` | `eclairage` | Technique + Accessibilité |
| `equip_acc_libre` | `libreAccess` | Technique + Accessibilité |
| `inst_part_bool` / `inst_part_type` | `partenariat` / `typePartenariat` | Technique |

**`toDate()`** : même logique que `CardPoiAmenities` — gère `Date` et `string` ISO.

**`str()`** : coercion minimale display-only (string brut, tableau → join, number/boolean → String). Ne fait aucune résolution récursive.

**Sections affichées** (dans l'ordre de la grille) :

Colonne principale :
1. **Informations générales** — catégorie, famille, installation, sport pratiqué
2. **Gestion & usages** — propriétaire, gestionnaire, locaux, utilisateurs
3. **Accessibilité & services** — features PMR/transport/éclairage/douches/libre accès + types ; sous-sections « Détails PMR » (6 infos) et « Détails PSHS » (6 infos)

Colonne latérale :
4. **Image** (`OptimizedImage`, masquée si aucune image réelle — le placeholder SVG n'est plus affiché dans la fiche détail)
5. **Carte** (`ProfileMapLeaflet`, coordonnées depuis `sd.geoPosition.coordinates` ou `sd.geo.latitude/longitude` ; message « Coordonnées indisponibles » si absent)
6. **Localisation** — adresse complète + région + pays
7. **Caractéristiques techniques** — nature, revêtement, surface, longueur, largeur, partenariat
8. **Suivi** — dates de création, enquête, mise à jour

**Bouton Éditer** : visible uniquement si `canEditProfile` (hook `useProfilPermissions`). Ouvre `DynamicEditModal` (registry config-driven `config.profiles.poi.editModal`) et ferme la fiche (`setOpenDetails(false)`). Le formulaire d'édition est découplé de la vue détail — `PreviewPoiAmenities` n'embarque plus le formulaire.

**Suppression de la section Activités** : l'ancienne section « Activités qui utilisent cette installation » (rechargement dynamique via `globalAutocompleteCostum` + `useEffect`) a été retirée.

**Suppression du champ `subCategory`** (badge `Star`) : retiré de l'interface `PoiDetail` et du rendu.

**Labels traduits** : tous les libellés passent par `t("PreviewPoiAmenities.*")` (namespace `modules/search`). La fonction helper `yesNo(value?)` retourne `t("PreviewPoiAmenities.yes")` / `t("PreviewPoiAmenities.no")` / `"—"` pour les champs booléens des tableaux PMR/PSHS.

**Valeurs cliquables** : catégorie, type de propriété, locaux, utilisateurs et code postal sont rendus via `<ClickableFacet>` (cf. section suivante) — un clic applique le filtre correspondant sur le listing. `PreviewPoiAmenities` n'embarque **plus** de logique de navigation : plus de `getSiteDropdownFilters`/`findFilterOption`/`handleFilterNavigation`/`setTimeout`/path en dur — tout passe par le mécanisme générique ci-dessous.

### Facettes cliquables & navigation par filtre (`dropdownFilters`)

Mécanisme **générique et agnostique de l'entité** : une valeur affichée dans un preview (ou toute carte/cellule) qui correspond à un `dropdownFilter` du `searchHeader` devient **cliquable** pour filtrer le listing — pattern « recherche à facettes » (rebondir d'un équipement vers tous ceux qui partagent une caractéristique).

**Insight clé** : le lien « champ affiché → filtre » existe DÉJÀ en config, car chaque `dropdownFilter` déclare son `field` (le champ `serverData` qu'il indexe). Le filtre est donc **dérivé du `field`**, jamais codé en dur par site/path.

#### `lib/dropdownFilters.ts` — helpers purs (Layer 0)

Source unique, sans React, testée (`dropdownFilters.test.ts`) :

| Export | Rôle |
|---|---|
| `keyFor(filterId, optionId)` / `splitKey(key)` | Contrat unique de clé `searchByFields` (`filterId:optionId`), écriture ET lecture |
| `normalizeFilterValue(s)` | Normalisation **déterministe** : diacritiques + minuscules + suppression des caractères `(`/`)` seuls (garde le contenu : `Individuel(s)`→`individuels`) + variantes d'apostrophe + espaces autour du `/`. **Pas** de matching substring (élimine les faux positifs ordre-dépendants) |
| `resolveDropdownOption(filter, value)` | id exact → value normalisée → label normalisé → `null` |
| `getDropdownFilterOwner(config, filterId, preferPathname?)` | Page propriétaire + filtre (scan de tous les `searchHeader`, mergés par id) — remplace tout path en dur |
| `findFilterByField(config, field, preferPathname?)` | Idem par `field` `serverData` (dérivation champ → filtre) |
| `dropdownFilterToParam(params, filter, ids)` | Miroir URL `?filterId=ids` ; ids vide → suppression |
| `dropdownFilterToState(setSelected, setSearchByFields, filter, ids)` | Écrit `PageFilters`, sémantique **REPLACE** (prefix-clean + field par option `option.field ?? filter.field`) |
| `resolveServerDataPath(serverData, path)` | Lecture dot-path (`address.postalCode`) |
| `toFacetTokens(value)` | Tokens d'un champ : array → strings, `"a, b"` → `["a","b"]`, number/bool → `[String]` |

> Ces helpers écrivent **exactement** les mêmes shapes que `SearchHeaderSection` lit (`keyFor`) : la feature marche par **compatibilité de contrat**, sans refactorer le header.

#### `useDropdownFilterNav()` — hook route-aware (Layer 1)

`hooks/useDropdownFilterNav.ts` — expose `navigateToFilter(filterId, value, onClose?)` et `navigateToFacet(field, value, onClose?)`. Résout le filtre + sa page propriétaire depuis la config, puis :

- **Même route** (`owner.pathname === current`) : **UNE** mutation `setSearchParams` atomique (supprime le `previewParam` + pose le filtre, `{replace, preventScrollReset}`) + `dropdownFilterToState` (écriture `PageFilters` — **obligatoire**, car l'hydratation URL→état du `searchHeader` est *one-time* au montage) + fermeture brute. **Pas de `setTimeout`, pas de `navigate`.**
- **Route différente** (observatoire, command palette, autre page) : `navigate(owner.pathname?filterId=optionId)` (PUSH → Back revient à l'origine) + `onClose`. L'hydratation au montage de la page cible applique le filtre depuis l'URL (on n'écrit PAS `PageFilters` : provider hors scope).

> **Mutation unique** : deux `setSearchParams` dans le même cycle voient le même `prev` (React Router) et s'écraseraient — d'où le `PreviewNavContext` optionnel (`{ previewParam, closeRaw }`) fourni par `SearchListView` pour fermer sans re-toucher l'URL. Contrainte connue : depuis la **command palette** montée hors `PageFiltersProvider` (`RootLayout`), le cas *même-route* n'applique pas le filtre (comme avant) → le cross-route reste le chemin nominal.

#### `<ClickableFacet field token>` — primitive (Layer 2)

`components/ClickableFacet.tsx` — rend un `token` cliquable **si** un `dropdownFilter` indexe `field` ET résout le token (sinon **texte simple** — jamais de lien mort → dégradation propre sur un site où le filtre n'existe pas). Le contenu affiché (`children`) peut différer du `token` de résolution (ex. code postal `token="97400"` affiché « 97400 Saint-Denis »). Utilisable par n'importe quel preview/entité.

#### `preview.type: "facets"` — renderer générique config-driven

`components/preview/PreviewFacets.tsx` — preview **piloté par la config**, zéro code par site : rend l'en-tête (image/nom/adresse via `useItem`) puis les `preview.facets` déclarées, chacune via `<ClickableFacet>`.

```json
"preview": {
  "type": "facets",
  "facets": [
    { "field": "equip_type_name", "label": { "fr": "Catégorie" }, "icon": "tag" },
    { "field": "address.postalCode", "label": { "fr": "Code postal" }, "icon": "map-pin" }
  ]
}
```

Chaque facette : `{ field, label?, icon? }` (`PreviewFacetSchema`). `field` supporte le dot-path ; les valeurs multiples (`coerce:stringArray` ou `"a, b"`) sont splittées en tokens. L'axe **bespoke** reste disponible (un `preview.type` dédié comme `poi-amenities` compose la même primitive) — cf. le dispatch `Preview.tsx` (générique `default`/`facets` ↔ variantes sur-mesure).

Options : `width` (largeur de la modale, ex. `"3xl"`) et `showDescription` (défaut `true` — la
description de l'entité sous le titre ; hauteur bornée `max-h-[85vh]`, valable tiroir ET modale).
Usage type : `/annuaire` institut-bleu — `card.detailsMode: "dialog"` + `preview.type: "facets"`
(aperçu métier sans navigation vers le profil). ⚠ une facette sur un champ indexé par un
`dropdownFilter` d'une AUTRE page devient cliquable **vers cette page** (`findFilterByField` scanne
toute la config) — ne déclarer que des champs neutres, ou assumer la navigation.

#### Options DYNAMIQUES d'un filtre — `optionsFrom` (listes déclarées du costum)

Un filtre (dropdown ou `filterGroups`) peut tirer ses options d'une **liste déclarée du costum**
(`costum.lists.<nom>` : `{collection, distinct, where}`) au lieu d'options figées :

```jsonc
{ "field": "tags", "optionsFrom": { "list": "tagsDocument" } }   // costumSlug optionnel (défaut : site)
```

`useDynamicFilterOptions` interroge l'endpoint `costum/co/listvalues` (existe côté legacy ET Node,
byte-vérifié) qui résout la liste **hors du cache costum** (valeurs fraîches — une valeur saisie
librement apparaît aux suivants). Garde-fou serveur : le client demande une liste par son NOM, la
déclaration en base porte collection/champ/filtre — une liste non déclarée n'est pas résolvable.
Pagination : plafond client 300 (couvre 7 des 8 listes du parc) ; au-delà, la réponse porte
`total`/`truncated` et la **recherche re-interroge le serveur** (`q`, forme canonique sans
accents/casse, `limit` ≤ 5000) — mesuré : « Zooplancton », rang 1208/1209, trouvé via la saisie.
Sans `optionsFrom`, rien ne change (les options déclarées font foi). Les libellés sont capitalisés
à l'AFFICHAGE seul (la valeur filtrée reste byte-fidèle).

### Cartes news dans la recherche (CardNews et PreviewNews)

Le module search sait rendre des **actualités** (`News`) comme n'importe quelle
entité de résultat — utilisé par les pages type `/actualites` (commit `174e7953`).
Deux nouveaux type strings s'ajoutent aux axes carte/détail :

- **`list.card.type: "news"`** → `CardNews`
  (`components/card/CardNews.tsx`) — carte **éditoriale text-first**. Normalise
  l'item via `useFormatNews` (même source que le mur profil : auteur / avatar /
  date / portée / compteurs) et aplatit le markdown en clair via `newsExcerpt`.
  Trois layouts selon la donnée : extrait **+ image** (vraie news avec média),
  extrait **plein cadre** (news sans image, fondu de coupe) ou **ligne-entité
  citée** (item de fil `activityStream` : « a créé / partagé / modifié [object] »
  + vignette). Tags limités par `card.tagLimit` (repli **code** 3), pied
  d'engagement (votes / commentaires) + affordance « Lire ».
- **`list.preview.type: "news"`** → `PreviewNews`
  (`components/preview/PreviewNews.tsx`) — détail **pleinement fonctionnel** : il
  embarque le **même** `NewsDetailPage` que le mur profil en mode `embedded`
  (commentaires / votes / actions selon permissions) sous un bandeau mince
  (étiquette « Actualité » + CTA permalien « Voir en page »). L'entité **porteuse**
  est résolue via `resolveHostEntity` / `targetRef` (`modules/news/lib`), le
  permalien construit par `buildNewsDetailUrl` (fallback `/profil/:slug`). Le CTA
  est masquable via `list.preview.showDetailLink: false`.

Comme `SearchEntity` (lib) n'inclut pas `News` (serverData hétérogène), le type
local **`SearchListEntity = SearchEntity | News`** (schema.ts) élargit tous les
generics search (`SearchListViewProps`, `SearchCardProps`, `PreviewProps`… tous
défaut `SearchEntity`) ; `SearchCard` / `Preview` **castent** l'item en `News` au
point de dispatch (`case "news"`).

### Cartes et previews génériques config-driven (testimonial, resource)

Deux familles **Card + Preview entièrement config-driven** (elles remplacent
l'ancienne implémentation « parole » spécifique à parent62, supprimée) : le
composant ne connaît **aucun** nom de champ ni couleur de site — tout vient d'un
contrat de config lu par un hook normalizer.

**Contrats de config** (`schema.ts`, exportés) — posés dans `list.testimonial` /
`list.resource` (à côté de `list.card` / `list.preview`) :

- **`TestimonialConfSchema`** (`TestimonialConf`) — champs `.partial()` : `design`
  (enum `["bubble"]`), `quoteField`, `titleField`, `dateField`, `subtitleField`,
  `audioField`, `badge` (`{field, colors?}`), `accent` (`{field, colors?}`),
  `facets` (`PreviewFacetSchema[]`). Replis **code** appliqués par
  `useTestimonialData` (config jamais parsée par Zod au runtime) : `design`→`bubble`,
  `quoteField`→`description`, `titleField`→`name`, `dateField`→`created`,
  `audioField`→`medias`.
- **`ResourceConfSchema`** (`ResourceConf`) — `.partial()` : `design` (enum
  `["card"]`), `titleField`, `descriptionField`, `dateField`, `imageField`, `badge`
  (`{field, colors?, icons?}`), `cityField`, `urlsField`, `mediasField`, `facets`.
  Replis code (`useResourceData`) : `design`→`card`, `name`, `description`,
  `created`, `profilMediumImageUrl`, `badge.field`→`category`,
  `address.addressLocality`, `urls`, `medias`.

**Dispatch à deux niveaux** : `card.type` / `preview.type` sélectionne la famille
(`CardTestimonial` / `CardResource`, `PreviewTestimonial` / `PreviewResource` —
coques `export default`), puis la coque dispatche sur `list.<type>.design` vers le
design concret (`CardTestimonialBubble` / `CardResourceCard`,
`PreviewTestimonialBubble` / `PreviewResourceCard`). Card ↔ Preview partagent le
même contrat → cohérence par construction.

**Hooks normalizers** (`hooks/`) — lisent `serverData` par dot-path
(`resolveServerDataPath`) + splits multi-valeurs (`toFacetTokens`), appliquent les
replis code et résolvent les couleurs :

- `useTestimonialData(item, cfg)` → `TestimonialData` (quote / title / date /
  badge+couleur / accent / audio 1er média / facets).
- `useResourceData(item, cfg)` → `ResourceData` (image héros, badge + icône de
  type, ville, liens, galerie / documents / audio / vidéo **splittés depuis
  `medias` indexé**, facets).
- `useResourceEntity({slug|id})` → charge le **POI complet** (`entityBySlug` ou
  `api.poi`) pour la galerie / documents / audio / vidéo complets (`about.images` /
  `about.files`, classés par **extension**) — la donnée indexée `medias` ne porte
  qu'un sous-ensemble.

**Lib partagée** `lib/testimonial.ts` : `valueColor(value, {map})` (couleur d'une
taxonomie — map de config matchée par `normalizeFilterValue`, sinon palette
déterministe `var(--chart-*)`), `bubbleTint(color)` (teintes `color-mix`
clair/sombre), `firstMediaUrl(medias, kind)`, `hostname(url)`.

Les repères (taxonomies) réutilisent le mécanisme **facettes** générique (`facets`
= `PreviewFacetSchema[]`, rendus en `ClickableFacet`). Pour activer une ressource
ou un témoignage, poser **3 clés** explicites : `list.card.type`,
`list.preview.type` et le bloc `list.<type>` correspondant. Dans une liste
**hétérogène**, ces 3 clés vivent dans une RÈGLE plutôt qu'au niveau de la liste
(§ suivant).

### Rendu PAR ITEM des listes hétérogènes (`list.itemRules`)

**Le problème.** Une recherche globale sans filtre de type mélange articles,
paroles, ressources, événements, projets et structures dans la même grille. Le
presenter ne peut alors pas venir du filtre coché — il doit se décider sur la
donnée de **chaque item**.

**Le principe.** On n'ajoute pas de prop au pipeline : on fait **varier la valeur
de `list`**. `resolveListItemConf(item, list)` (`lib/resolveListItemConf.ts`)
renvoie la conf effective d'un item ; tout l'aval (`SearchCard`, `Preview`,
`SwitchDetailsMode`, `Card`/`PreviewTestimonial`, `Card`/`PreviewResource`) est
**inchangé**. Deux corollaires :

- carte et détail sortent de la MÊME résolution → l'incohérence est impossible
  par construction ;
- sans `itemRules`, la fonction renvoie `list` **par identité référentielle**
  (`expect(...).toBe(list)`) → non-régression prouvable et mémoïsation aval
  préservée. La fonction est **pure** (ni `window`, ni `Date`, ni `Math.random`)
  → SSR ≡ hydratation.

**Le prédicat `when`** utilise la grammaire `PredicateJson` du formEngine — la
même que `visibleIf` / `requiredIf` (cf. [doc/28](28-module-formengine.md)) et
que les `iconRules` de la palette (cf. [doc/17](17-module-command-palette.md)).
Il est évalué contre `entityMatchData(item)` = `{...serverData, collection,
sourceKey, sourceKeys}` derrière un Proxy qui résout les chemins pointés
(`src/lib/entityMatch.ts`). **La première règle qui matche gagne** ; une règle
**sans `when`** est un catch-all, à placer **en dernier** (en tête elle masque
tout). Si aucune règle ne matche, on garde `list`.

> ⚠ **Deux pièges, tous deux silencieux.**
> 1. `serverData.type` a **deux sémantiques** : sous-type POI
>    (`article`/`affiche`/`recoveryCenter`) mais sous-type d'ORGANISATION
>    (`NGO`/`Group`/`Cooperative`…) sur `collection: "organizations"`. Toujours
>    ancrer une règle sur `collection` **avant** `type`.
> 2. Un champ **non projeté** par `baseParams.defaultFields` vaut `undefined` :
>    la règle ne matchera **jamais**, sans erreur. Un `console.warn` DEV nomme
>    les champs manquants au premier item, et `tests/preflight/list-item-rules.test.ts`
>    le gate sur toutes les configs du parc.

**Sémantique de fusion** — à connaître, c'est la source de bugs :

| Clé de la règle | Appliquée comment | Pourquoi |
|---|---|---|
| `card`, `preview` | **fusionnées** (shallow) sur la base | `tagColors`, `detailsMode`, `width` posés une fois au niveau page restent hérités |
| `testimonial`, `resource` | **remplacent** | fusionner deux contrats de mapping produirait un contrat Frankenstein indébuggable |
| `itemAction` | **remplace** | atomique |
| entre règles | aucun cumul — la 1ʳᵉ gagne entièrement | invariant partagé avec `iconRules` et `editModals` |

**`list.itemAction`** route le clic. `resolveItemClick` (`lib/itemAction.ts`) est
la source unique, partagée par la liste et la popup de carte :

| `kind` | Effet | Champs |
|---|---|---|
| `preview` (défaut) | ouvre le détail (`SwitchDetailsMode`) | — |
| `profil` | navigue vers `/profil/:slug` | — |
| `link` | navigue vers un gabarit | `to` (`:slug`), `toById` (`:id`, repli), `newTab` |

Toute action **inexploitable** retombe sur le détail : un `link` sans slug ni id,
un `profil` sur un item sans slug. On ne navigue jamais vers une URL trouée.

> ⚠ **Trois `itemAction` homonymes** coexistent dans le repo :
>
> | Clé | Schéma | Portée |
> |---|---|---|
> | `list.itemAction` / `itemRules[].itemAction` | `ListItemActionSchema` (`preview`\|`profil`\|`link`) | clic sur une **carte de liste** |
> | `map.itemAction` | inline `{kind: "profil"\|"preview"}` | bouton de **popup carte** — sert de défaut quand la règle n'en porte pas |
> | `commandPalette.entitySearch.itemAction[ByType][BySubType]` | `EntityItemActionSchema` | clic sur un résultat de **palette** |

**Exemple** (`config.prod.parent62.json`, page `/recherche`) :

```json
"itemRules": [
  {
    "id": "poi-article",
    "when": { "and": [
      { "field": "collection", "op": "eq", "value": "poi" },
      { "field": "type",       "op": "eq", "value": "article" }
    ]},
    "card": { "type": "resource" },
    "resource": { "design": "card", "titleField": "name", "descriptionField": "shortDescription",
                  "dateField": "created", "imageField": "profilMediumImageUrl" },
    "itemAction": { "kind": "link", "to": "/blog/:slug", "toById": "/blog/id/:id" }
  },
  {
    "id": "poi-parole",
    "when": { "and": [
      { "field": "collection", "op": "eq", "value": "poi" },
      { "field": "type",       "op": "eq", "value": "affiche" }
    ]},
    "card":    { "type": "testimonial", "detailsMode": "dialog" },
    "preview": { "type": "testimonial", "width": "2xl" },
    "testimonial": { "…contrat identique à celui de /temoignages…" }
  }
]
```

Pas de catch-all ici : les collections non couvertes retombent sur `list.card`,
qui joue le rôle de filet.

### SearchMap et vue carte

`SearchMapWrapper` : charge la carte en client-only via `useClientModule()`
(MapLibre accède à `window`/WebGL → jamais en SSR). `SearchMap` : carte
**MapLibre GL** via `react-map-gl/maplibre` (composant `<Map>`). Clustering
**supercluster** (regroupement selon le bbox+zoom courant) → marqueurs HTML
`<Marker>` (`SearchMapMarkers.tsx`) ; chaque point ouvre un `<Popup>`.

**Vues customisables (pattern dispatcher, comme `SearchCard`)** : le **marqueur**
et la **popup** suivent le modèle dispatcher + composants-variants. Le marqueur :
`SearchMapMarkers` dispatche sur le `kind` résolu (cf. `markerVisual.ts` ← config
`map.marker`) vers `mapMarker/MapMarker<X>.tsx` (Pin / Circle / Icon / Avatar) —
**non-lazy** (rendu par point ; un Suspense par marqueur serait coûteux). La
popup : `SearchMapPopup` dispatche sur `map.popup.type` vers
`mapPopup/MapPopup<X>.tsx` en **`lazy()`** (un chunk par page, comme
`SearchCardDetailed`). Pour ajouter une vue : créer le fichier variant
(`export default`), l'importer dans le dispatcher, ajouter le `case`.

> ⚠️ Ne pas confondre avec `ProfileMapLeaflet` (module profil) qui reste sur
> **Leaflet** (`loadLeaflet.ts`, `lib/mapTiles.ts` — tuiles **raster**). Les
> deux moteurs cohabitent et sont dans des chunks séparés (`maps-vendor` =
> Leaflet, `maplibre-vendor` = MapLibre/MapTiler) : une fiche profil ne tire
> pas le SDK MapTiler, et inversement.

**Fond de carte** (`lib/mapStyles.ts`) : avec la variable d'environnement
`VITE_MAPTILER_API_KEY` (jamais dans le config versionné — `.env` en dev,
injectée dans `window.__ENV__` par le prod-server, passthrough
docker-compose), la carte utilise les **styles VECTORIELS MapTiler** via
**`@maptiler/sdk`** (branché comme `mapLib` du `<Map>` ; `config.apiKey` posée
au chargement du chunk). On passe juste l'**ID de style** — le SDK l'expanse en
`style.json` avec la clé, **aucune URL construite à la main**. Style par thème
**configurable par site** via `integrations.map` : `styleLight` (déf.
`streets-v4`) / `styleDark` (déf. `streets-v4-dark`) — ids MapTiler
(`outdoor-v2`, `dataviz`, `satellite`…). La bascule light↔dark = changement de
`mapStyle` (react-map-gl restyle sans toucher aux `<Marker>`/`<Popup>` React).
**Sans clé : repli automatique** sur un style **raster** MapLibre minimal (OSM
light / Carto Dark Matter), MapLibre standard (sans SDK) — aucun site ne casse.

**Chargement de la vue carte** (progressif — même mécanique que
l'observatoire) : la carte ne fait plus un `indexStep: 0` tout-en-1-appel ;
elle passe par **`useSearchAllResults`** (hook dédié, queryKey
`searchCostum[Static]MapAll`) — pages de **500** enchaînées séquentiellement
par le **paginator SDK** (`page.next()` ; sondé : un `indexMin` manuel est
IGNORÉ par le backend, avec ou sans `mapUsed`), plafond **5000**
(`maxResults`), **cache 30 min/1 h** (re-toggle liste↔carte instantané),
`mapUsed: true` conservé dans le payload (sémantique backend préservée).
`indexStepMap` en config : taille de page (déf. 500) ; `0` restaure le
tout-en-1-appel legacy. Côté rendu, l'index supercluster est **reconstruit à
chaque page** (opération bon marché) et seuls les marqueurs du viewport sont
posés en DOM ; `fitBounds` ne joue qu'à la 1ʳᵉ page d'un périmètre (carte non
contrôlée : `initialViewState` + ref) — le viewport de l'utilisateur est
préservé pendant le chargement. `MapProgress` affiche la progression « X / Y »
et l'alerte de plafond.

**Options `map` de la section** (`MapConfSchema`) :
`map.itemAction: {kind: "profil"|"preview"}` — action du bouton de la popup
(défaut `preview` : détail `SwitchDetailsMode` avec `list.card`/`list.preview` ;
`profil` : navigation `/profil/:slug`) · `map.initialZoom` — zoom initial ·
`map.layout: "full"|"split"` — plein écran (défaut) ou split liste+carte · `map.splitRatio:
"40-60"|"50-50"|"60-40"` — répartition largeur liste/carte du split (défaut `40-60`,
liste étroite 1 colonne + carte large, aligné sur l'agenda ; les ratios plus larges
passent la liste à 2 colonnes) · `map.marker`
— apparence des marqueurs (cf. ci-dessous). La **popup** est un
**vrai composant React** (plus de `renderToString` ni de `window.dispatchEvent`) :
le bouton appelle directement `onAction` (handler React fourni par `SearchMap`).
En dev, `window.__searchMapDebug = {map, index, clusters}` permet de piloter la
carte depuis la console/les tests navigateur.

**Marqueurs (`MarkerConfSchema`)** — configurables **par site** via
`integrations.map.marker` (défaut du site) ET **par section** via `map.marker`
(surcharge champ par champ ; sinon repli sur le défaut intégré). Chaîne de repli
par **priorité** (cf. `lib/markerVisual.ts`) :
1. `useItemImage: true` ET l'item a une image → **vignette RONDE** de l'item ;
2. `iconUrl` → **icône custom** (image/SVG brandée — URL relative préfixée par
   `baseUrl`, ou absolue ; `iconSize` px déf. 34, `iconAnchor` `"bottom"`/`"center"`) ;
3. `style: "pin"` / `style: "circle"` (+ `color` en **jeton de thème** :
   `primary`/`secondary`/`accent`/`chart-1..5`) → goutte SVG ou pastille ronde ;
4. sinon → pin par défaut (primary).

```jsonc
// par site (config racine) :
"integrations": { "map": { "marker": { "iconUrl": "/upload/pin.png", "iconSize": 40 } } }
// surcharge ponctuelle d'une section :
"map": { "marker": { "style": "circle", "color": "chart-2" } }
```

### SearchBubbleChart

Graphique en bulles pour visualiser la distribution des entités par catégorie. Activé via `enableGraph: true`. Rendu via D3 circle-packing (`import * as d3`, `d3.pack`, `<svg>` brut) — aucune dépendance Recharts. Clic sur une bulle → ouvre les détails via `graphDetailsMode`.

### FranceRegionsMap

Carte choroplèthe des régions françaises. Activée via `enableRegions: true` (mode `"regions"`). Utilise des données GeoJSON et D3 pour le rendu SVG. Clic sur une région → navigue vers `regionsTarget.path?${regionsTarget.filterId}=<slugs>`.

### Preview et MapPopup

`Preview` / `PreviewDefault` : aperçu rapide d'une entité au survol ou au clic. `MapPopupDefault` : popup (composant React) de la carte MapLibre du search.

### ActiveFiltersBar et FilterDropdown

`ActiveFiltersBar` : barre des filtres actifs sous forme de chips avec bouton de suppression individuel + "tout effacer".

`FilterDropdown` : dropdown de sélection d'un filtre (tags, type d'entité). Utilise Radix UI Popover + Checkbox.

### AddEntityModal

Modal de création d'une nouvelle entité directement depuis la recherche. Activé via `addButton.show: true`. Délègue à `ModalRegistry` du module profil.

### SwitchDetailsMode

Composant qui gère l'ouverture du détail (drawer ou dialog) selon `list.card.detailsMode`, et rend le composant de détail correspondant. Il est monté **hors de la boucle de résultats** : c'est l'appelant (`SearchListView`, `SearchMap`) qui garde en state la paire `{ item, list }` — la conf RÉSOLUE de l'item ouvert — et la lui passe. `detailsMode` et `preview.type` peuvent donc varier d'un item à l'autre au sein d'une même liste.

---

## SSR — Prefetch

Helpers exportés depuis `prefetch/` :

**`prefetchSearchResults(queryClient, props, filters)`** — pré-charge la première page de résultats sur le serveur.

**`prefetchFilterSection(queryClient, section)`** — pré-charge zones + filtersByAnswers + filtersByPath + entités entityList pour une section donnée (en parallèle) :

```ts
await prefetchFilterSection(queryClient, {
  type: "filters",
  id: "sidebar",
  props: {
    filterGroups: [
      { type: "scopeList", config: { countryCode: ["RE"], level: ["1"] } },
      { id: "reseaux", type: "entityList", baseParams: { defaultTypes: ["organizations"] } },
    ],
    filtersByAnswers: { thematique: { forms: "abc123", path: "thematique", label: {...} } },
    filtersByPath: { reseauxThematiques: { thematicPath: "reseaux.thematiques", label: {...} } },
  },
});
```

**`findFiltersSections(sections)`** — découverte récursive des sections éligibles au prefetch dans un arbre de sections (travers `gridLayout` et `tabs`).

La fonction est désormais **générique** : elle détecte toute section qui déclare `filterGroups`, `filtersByAnswers`, ou `filtersByPath` dans ses props — **indépendamment de son `type`**. Auparavant, seule la section `type === "filters"` était détectée. Ce changement permet au hero de la home (qui déclare `filterGroups`/`filtersByAnswers` sans être de type `"filters"`) d'être préfetché en SSR.

La queryKey générée pour `filtersByAnswers` est `filters-answers-${sectionId}` — identique à celle utilisée par `useFiltersByAnswersQuery` dans `FiltersSection` et `usePageFiltersUrlSync`, ce qui garantit que le cache SSR est consommé sans refetch à l'hydratation.

**Prefetchers individuels** (bas niveau, disponibles pour usages ciblés) :
- `prefetchSearchZones(queryClient, queryId, options)` — zones géographiques
- `prefetchFiltersByAnswers(queryClient, queryId, options)` — filtres CoForm answers
- `prefetchFiltersByPath(queryClient, queryId, options)` — filtres CoForm by path
- `prefetchFilterEntities(queryClient, queryId, options, filterBy?)` — entités entityList

---

## Flux « Design A » — filtres hero → liste cohérente

Le « Design A » désigne le pattern où le hero de la page d'accueil pose des filtres dans l'URL (via des liens de navigation ou une action utilisateur) qui sont ensuite repris par la section de liste en-dessous — exactement comme si l'utilisateur avait cliqué sur les filtres de la sidebar de `/lieux`.

**Flux complet** :

1. Le hero (ou le nav) pose `?typologies=orga` / `?services=agriculture` dans l'URL (même format que les query params de `/lieux`).

2. `usePageFiltersUrlSync` (monté dans la section hero via un wrapper sans UI) :
   - Lit `useSearchParams()`
   - Résout `filtersByAnswers` via `useFiltersByAnswersQuery("filters-answers-${id}", ...)` — cache SSR disponible grâce à `findFiltersSections` générique
   - Appelle `computeFiltersFromUrl(searchParams, filterGroups, filterAnswerData)` — même logique que `FiltersSection`
   - Publie dans `PageFiltersContext` via `setSelectedFilters(applySelected)` + `setSearchByFields(applySearchFields)`

3. `SearchProStatic` (consommateur dans le même `PageFiltersProvider`) :
   - Lit `contextFilters.filterNames` → `searchTags`
   - Lit `contextFilters.searchByFields` → `searchByFieldsToQuery()` → `filters`/`locality`/`dynamicSourceKeys`
   - Construit `mergedBaseParams` via `canonicalSearchProStaticBaseParams`
   - Appelle `useSearchQuery({ baseParams: mergedBaseParams, ... })`

4. `useAutocomplete` (champ de recherche du hero) :
   - Reçoit les mêmes `baseParams` et `tags` que `SearchProStatic`
   - Utilise `buildSearchPayload(baseParams, { name, tags })` → même périmètre réseau
   - Les suggestions correspondent aux résultats affichés dans la liste

**Résultat** : saisir dans le hero, cliquer un filtre, ou arriver avec un lien `?typologies=orga` produit exactement les mêmes résultats que sur `/lieux` avec les mêmes filtres cochés.

---

## Variantes de carte JSON (`list.card.type`)

La carte de liste est pilotée par `list.card.variant` (sinon `list.card.type` — `SearchCard` résout `variant || type`). **Les valeurs sont des noms de DESIGN / FONCTIONNALITÉ, jamais de site** (découplage commit 8cd4070). Variantes actuelles : `default`, `overlay`, `image-cover`, `image-panel`, `event`, `event-featured`, `funding`, `resource-booking`, `poi-amenities`, `contact-card`, `profile`, `card-answer`, `news`, `testimonial`, `resource` (cf. la table « Cartes (card variants) » ci-dessus pour le composant correspondant). À noter : `overlay`, `news`, `testimonial` et `resource` ne sont sélectionnables que via `card.type` (l'enum `card.variant` — schema.ts — ne les inclut pas) ; les autres valeurs sont acceptées par les deux clés.

`card.type`/`variant` est **orthogonal** à deux autres axes (commit 8cd4070), à configurer indépendamment :

- **`list.card.detailsMode`** (`drawer` / `dialog`) → le *conteneur* de la fiche détail (`SwitchDetailsMode` → `DetailsModeDrawer` / `DetailsModeDialog`) ;
- **`list.preview.type`** (`default` / `poi-amenities` / `coform-answer` / `event` / `facets` / `news` / `testimonial` / `resource` / `structure`) → le *contenu* rendu DANS ce conteneur (`Preview` → `PreviewDefault` / `PreviewPoiAmenities` / `PreviewCoformAnswer` / `PreviewEvent` / `PreviewFacets` / `PreviewNews` / `PreviewTestimonial` / `PreviewResource` / `PreviewStructure`). `list.preview.fields` surcharge le mappage des IDs de champ CoForm consommés par `parseCoformAnswer` (cf. `lib/coformAnswer.ts`) ; `list.preview.facets` déclare les champs cliquables du preview générique `facets` (cf. [§Facettes cliquables](#facettes-cliquables--navigation-par-filtre-dropdownfilters)) ; `list.preview.width` / `list.preview.showDetailLink` (cf. [§Mode détails](#mode-détails--conteneur-detailsmode-vs-contenu-previewtype)).

**Règle d'extension** : pour ajouter une nouvelle variante, créer `components/card/CardMonDesign.tsx` (nom DESIGN, pas de site), l'enregistrer dans `SearchCard.tsx` (switch), et ajouter l'entrée dans **`CardConfSchema`** (`variant` / `type`) — le bloc `card` est un schéma nommé extrait de `ListConfSchema`, partagé avec `ListItemRuleSchema.card`.

---

## Variante SDK `searchVariant`

`searchVariant: "navigator-tl"` change l'endpoint backend utilisé :
- `default` (absent) : `/co2/search/globalautocomplete`
- `navigator-tl` : `/costum/navigator/gettl` — enrichit chaque résultat avec `serverData.answers` (réponses CoForm auto-linkées)

Utilisé pour les sites tiers-lieux qui enrichissent les fiches avec des données CoForm sans étape de lookup supplémentaire.

---

## i18n

Namespace : **`modules/search`**. Enregistré en side-effect par `i18n.ts`.

Structure de `fr.json` / `en.json` : fichiers **mixtes** — clés plates (chaînes françaises littérales) pour les libellés généraux, plus des blocs **imbriqués** par composant : `CardPoiAmenities` + `PreviewPoiAmenities` (POI aménagements), `coformAnswer` (carte + fiche détail réponse CoForm), `days` (jours de la semaine, utilisés par `groupSchedules`), `testimonial` (Card/PreviewTestimonial) et `resource` (Card/PreviewResource).

**Clés plates (exemples représentatifs)** :

| Clé (fr) | Valeur en (en.json) |
|----------|----------------------|
| `"Filtres actifs :"` | `"Active filters:"` |
| `"Filtres"` | `"Filters"` |
| `"Réinitialiser"` | `"Reset"` |
| `"Voir les résultats"` | `"See results"` |
| `"Effacer"` | `"Clear"` |
| `"Carte"` | `"Map"` |
| `"Voir en liste"` | `"See in list"` |
| `"Chargement…"` | `"Loading…"` |
| `"Aucune image"` | `"No image"` |
| `"Description"` | `"Description"` |
| `"Tags"` | `"Tags"` |
| `"Partager"` | `"Share"` |
| `"type.organizations"` | `"Organizations"` |
| `"toast.card.starSuccess"` | `"Updated"` |

**Bloc `CardPoiAmenities`** (carte POI aménagements) — clés fr / en en parité :

| Clé | fr | en |
|-----|----|----|
| `CardPoiAmenities.amenities` | `"Aménagement"` | `"Amenities"` |
| `CardPoiAmenities.pmrAccess` | `"Accès PMR"` | `"PRM access"` |
| `CardPoiAmenities.publicTransport` | `"Transport en commun"` | `"Public transport"` |
| `CardPoiAmenities.lighting` | `"Éclairage"` | `"Lighting"` |
| `CardPoiAmenities.showers` | `"Douches"` | `"Showers"` |
| `CardPoiAmenities.freeAccess` | `"Libre accès"` | `"Free access"` |
| `CardPoiAmenities.yearsAgo` | `"Il y a {{count}} ans"` | `"{{count}} years ago"` |

**Bloc `PreviewPoiAmenities`** (fiche détail POI aménagements) — structure imbriquée :

```
PreviewPoiAmenities.edit / .close / .validated / .fallbackTitle
PreviewPoiAmenities.createdOn  (interpolation {{date}})
PreviewPoiAmenities.yearsAgo   (interpolation {{count}})
PreviewPoiAmenities.yes / .no

PreviewPoiAmenities.sections.general / .management / .accessibility
PreviewPoiAmenities.sections.pmrDetails / .pshsDetails
PreviewPoiAmenities.sections.location / .technical / .tracking

PreviewPoiAmenities.fields.category / .family / .installation / .sport
PreviewPoiAmenities.fields.ownerName / .ownerType / .managementType / .premises / .users
PreviewPoiAmenities.fields.pmrType / .transportType
PreviewPoiAmenities.fields.nature / .floor / .surface / .length / .width / .partnership

PreviewPoiAmenities.features.pmr / .transport / .lighting / .freeAccess / .showers

PreviewPoiAmenities.pmr.access / .path / .showers / .toilets / .stands / .changing
PreviewPoiAmenities.pshs.playArea / .path / .toilets / .stands / .changing / .signage

PreviewPoiAmenities.map.unavailable
PreviewPoiAmenities.tracking.created / .lastSurvey / .lastUpdate
```

**Bloc `coformAnswer`** (carte `CardAnswer` + fiche détail `PreviewCoformAnswer`) — clés plates : `noTitle`, `noDescription`, `address`, `addressEmpty`, `contact`, `schedule`, `scheduleEmpty`, `activity`, `beneficiaries`, `beneficiariesEmpty`, `accessibility`, `reducedMobility`, `notProvided`, `installation`, `installationEmpty`, `validated`, `noName`, `by`, `showLess`, `moreSlots` (interpolation `{{count}}`), `activitySheet`, `structureSheet`.

**Bloc `days`** (jours de la semaine, utilisés par `groupSchedules` via `t("days." + dayKey)`) : `monday` → `sunday` (fr `"Lundi"`…`"Dimanche"` / en `"Monday"`…`"Sunday"`).

**Bloc `testimonial`** (Card/PreviewTestimonial) — clés : `listen` (`"Écouter"` / `"Listen"`), `listenTitle` (`"Écouter le témoignage"` / `"Listen to the testimony"`).

**Bloc `resource`** (Card/PreviewResource) — clés : `open`, `watch`, `download`, `gallery`, `documents`, `audio`, `video`, `links`.

**Clés plates news** (`CardNews` / `PreviewNews`) : `Actualité`, `Voir en page`, `Lire`, `Aperçu détaillé indisponible pour cette actualité.`, les verbes activity-stream (`a créé`, `a partagé`, `a modifié`, `a publié`, `sur`, `Quelqu'un`) et les libellés de portée (`Privé`, `Réservé aux membres`).

Aucun des préfixes hiérarchiques génériques (`SearchPro.*`, `SearchFilters.*`, `ActiveFiltersBar.*`, etc.) n'existe dans les fichiers réels — uniquement les blocs ci-dessus.

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

**SearchProStatic avec lien « voir sur la page complète »** (Design A — hero de la home) :
```json
{
  "type": "searchProStatic",
  "id": "hero-search",
  "props": {
    "baseParams": { "defaultTypes": ["organizations"], "costumSlug": "mon-reseau" },
    "list": { "card": { "type": "tiers-lieux" } },
    "customHeader": {
      "title": { "fr": "Espaces de travail" },
      "linkText": { "fr": "Voir tous les lieux" },
      "linkHref": "/lieux",
      "linkIcon": "arrow-right"
    }
  }
}
```

Le lien généré reporte automatiquement les filtres actifs (`?typologies=orga&services=coworking`) et la recherche texte (`&search=paris`) vers `/lieux`.

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

### 3. Cartes SSR (MapLibre / Leaflet)

Les moteurs de carte accèdent à `window` / WebGL → **jamais en SSR**. La carte du search (**MapLibre GL** via `react-map-gl/maplibre` + `@maptiler/sdk`) est chargée client-only par `SearchMapWrapper` (`useClientModule()`, import dynamique de `SearchMap`). La carte du profil (**Leaflet**) passe par `useClientModule()` / `loadLeaflet`. Ne jamais importer `maplibre-gl`, `react-map-gl`, `@maptiler/sdk` ni `leaflet` directement dans un composant rendu en SSR.

### 4. `searchVariant: "navigator-tl"` — support backend requis

Ce variant utilise un endpoint différent qui n'est pas disponible sur tous les serveurs Cocolight. Vérifier que le backend du site supporte `costum/navigator/gettl` avant de l'activer.

### 5. queryKeys et `prefetchSearchResults`

La queryKey de `useSearchQuery` sérialise tous les paramètres actifs en JSON. Pour que le prefetch SSR corresponde au cache client, il faut passer exactement les mêmes paramètres (même ordre de clés dans les objets JSON). Utiliser `canonicalSearchProStaticBaseParams()` de `lib/canonicalBaseParams.ts` pour la normalisation.

### 6. `useAutocomplete` est maintenant dans le module

`useAutocomplete` a été déplacé de `src/hooks/` vers `src/modules/search/hooks/`. Mettre à jour les imports si vous l'utilisiez depuis l'ancien chemin. Il est exporté depuis `src/modules/search/index.ts`.

### 7. `customHeader.showMapButton` supprimé

Le champ `customHeader.showMapButton` (ancienne config) n'existe plus dans le schéma. Le bouton carte dans le `customHeader` s'affiche dès que `enableMap: true`. Retirer ce champ des configs existantes.

### 8. Alignement queryKey `usePageFiltersUrlSync` ↔ prefetch SSR

`usePageFiltersUrlSync` utilise la queryKey `filters-answers-${id}` pour `filtersByAnswers` — identique à la convention de `prefetchFilterSection`. Si vous utilisez un `id` différent dans `usePageFiltersUrlSync` et dans le `prefetchFilterSection` correspondant, le cache SSR ne sera pas consommé (refetch client). Utiliser le même `id`.

### 9. `CardProfile` / `SearchProStatic` — `useAuthModal` requis dans le provider

`CardProfile` et `SearchProStatic` appellent `useAuthModal()` (hook du module `auth`). Ce hook requiert que `AuthModalProvider` soit monté dans l'arbre. Si vous intégrez ces composants dans un contexte sans le module `auth` initialisé, `openLogin()` ne fera rien. Vérifier que `AuthModalProvider` est bien présent (monté via le layout global dans `SiteShell`).

### 10. `PreviewPoiAmenities` — `ProfileMapLeaflet` est SSR-incompatible

La carte Leaflet intégrée dans `PreviewPoiAmenities` (`ProfileMapLeaflet`) ne s'affiche qu'après hydratation côté client. En SSR, elle rend un `<div>` placeholder. Ce comportement est intentionnel — Leaflet ne supporte pas le SSR.

### 11. `SearchProStatic` — conteneur pleine largeur

La zone de résultats de `SearchProStatic` (mode liste en sidebar désactivée) utilise désormais `mx-auto w-full max-w-[1536px]` pour éviter un étalement excessif sur très grands écrans. Ce changement affecte uniquement la mise en page — pas la logique de filtres.

### 12. `baseParams.defaultFilters` — DSL backend des filtres (⚠️ pas du Mongo standard)

`defaultFilters` est envoyé **verbatim** au backend (`buildSearchPayload` → `searchCostum`/`globalautocomplete` → `SearchNew::searchFilters`, `modules/citizenToolKit/models/SearchNew.php`). Ce n'est **pas** du Mongo standard : le backend a sa propre traduction, avec quatre pièges à connaître avant d'écrire un filtre.

**a. `tags: ["X"]` (tableau) = match SOUS-CHAÎNE non ancré.** Traduit en `tags: {$in: [/.*X.*/i]}` (regex non ancrée, casse-insensible). Donc `"tags": ["TiersLieux"]` matche aussi **`RéseauTiersLieux`** (qui *contient* « TiersLieux ») → les réseaux fuient dans les listes de lieux. À l'inverse, `tags: {"$in": ["X"]}` en **forme objet** fait un match **exact**.

**b. On ne peut PAS combiner `$in` et `$nin` sur la même clé `tags`.** `searchFilters` est une chaîne if/else qui s'arrête au premier opérateur trouvé, et `$nin` est testé **avant** `$in` (~l.589 vs ~l.598). `"tags": {"$in": [...], "$nin": [...]}` n'appliquera donc QUE le `$nin`.

**c. `$or` doit être un OBJET, jamais un tableau.** Le handler `$or` (~l.549) itère un objet `champ => condition`. Si on passe un tableau `[{...}]`, la clé d'itération est l'entier `0` → `array(0 => …)` devient un array PHP **indexé** → encodé en BSON comme un *array* (pas un document) → crash Mongo **« $or/$and/$nor entries need to be full objects »**. Écrire `"$or": { "tags": {...} }`, **jamais** `"$or": [ { "tags": {...} } ]`.

**d. Tout est empilé en `$and`.** `addQuery` (~l.7) pousse chaque clé de `defaultFilters` dans un `$and` top-level → deux clés distinctes = deux conditions ET.

**e. `status: "validated"` ne matche RIEN.** `status` ne porte que le cycle de vie du document (`uncomplete` / `deleted` / `deletePending`) et ne prend jamais la valeur `validated` — cf. [doc/19](19-visibility-system.md). Un `"defaultFilters": {"status": "validated"}` renvoie donc **0 résultat, sans la moindre erreur** (le cas s'est produit en prod sur la cible « paroles » de parent62). La validation costum se pilote par `preferences.toBeValidated.<slug>` / `source.toBeValidated.<slug>`, posés AUTOMATIQUEMENT par `applyValidationGate` dès qu'un `costumSlug` est présent (opt-out `showUnvalidated`).

**Idiome : exiger un tag ET en exclure un autre.** Impossible sur une seule clé `tags` (cf. b) → on utilise deux clés : un `$or` **objet** mono-clause pour le positif + `tags: {$nin: [...]}` pour l'exclusion. Exemple réel (config `tiers-lieux`, les listes de lieux ne doivent pas montrer les réseaux `RéseauTiersLieux`) :

```json
"defaultFilters": {
  "$or": { "tags": { "$in": ["TiersLieux"] } },
  "tags": { "$nin": ["RéseauTiersLieux"] },
  "address.addressCountry": { "$in": ["FR", "BE", "…"] }
}
```

→ backend : `{$and: [ {$or: [{tags: {$in: [/TiersLieux/i]}}]}, {tags: {$nin: ["RéseauTiersLieux"]}}, {address.addressCountry: {$in: […]}} ]}`. Le `$nin` (exact) retire **tous** les réseaux, y compris ceux **double-taggés** `TiersLieux` + `RéseauTiersLieux`. Appliqué aux 3 recherches `navigator-tl` de lieux (hero, aperçu home, page `/lieux`) ; **pas** à la section `data-observatory` (stats).

> ⚠️ JSON n'autorise pas de commentaire inline, donc ce `$or`-objet mono-clause restera cryptique dans le config — c'est un idiome du DSL backend assumé. Une alternative `"$and": [ … ]` **au premier niveau** reste hors de portée (`SearchNew::searchFilters` n'a pas de handler `$and` ; écarté : code partagé par tous les sites). En revanche un `$and` **niché sous `$or`** passe, sans rien ajouter au backend : `searchFilters` (SearchNew.php:549-574) lit `$or` comme une MAP `champ => opérateur` et recopie la valeur **brute**. La forme composée `"$or": { "$and": [ {"$or": […]}, {"$or": […]} ] }` (ET de OU) traverse donc intacte — vérifiée conforme sur les deux backends (legacy 5080 et Node 5099) et c'est celle qu'émettent les facettes sur answers (`searchByFieldsToQuery.ts:110`) puis que compose `mergeMongoFilters` avec le `$or` de la config (cf. [§mongoFilters](#mongofilters--fusion-des-filtres-or)).

---

## Voir aussi

- [Architecture](03-architecture.md) — modules, SectionRenderer, PageFiltersProvider
- [Module Profil](08-module-profil.md) — intégration SearchPro dans onglets profil
- [Visibility System](19-visibility-system.md) — visibilité conditionnelle des sections
- [Performance](12-performance.md) — lazy-loading Leaflet, bundle Recharts
- [Backend & SSR](14-backend-ssr.md) — prefetch search + filters
