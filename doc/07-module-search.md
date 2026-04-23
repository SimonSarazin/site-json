[← Retour à l'index](README.md)

# Module Search

**Sommaire**

- [Module Search](#module-search)
  - [Module Search (`src/modules/search`)](#module-search-srcmodulessearch)
    - [Architecture interne](#architecture-interne)
    - [Schéma de configuration (`schema.ts`)](#schéma-de-configuration-schemats)
    - [Context et hooks](#context-et-hooks)
    - [Composants clés](#composants-clés)
    - [Exemple de configuration JSON](#exemple-de-configuration-json)
  - [Récapitulatif](#récapitulatif)
  - [Structure commune des modules](#structure-commune-des-modules)
  - [Voir aussi](#voir-aussi)

---

Les **modules** de SiteForge apportent des logiques avancées au-delà des simples sections. Chaque module est organisé sous `src/modules/<moduleName>` et se compose généralement de :

* **Composants** (`components/`)
* **Hooks** (`hooks/`)
* **Contexts** (`contexts/`)
* **Schéma de validation** (`schema.ts`)
* **Fichiers de localisation** (`i18n/`)

Nous détaillons ici le **module Search** comme exemple, puis donnons un aperçu des autres modules.

---

## Module Search (`src/modules/search`)

Ce module permet d'afficher une interface de recherche avancée avec filtres, liste et carte.

### Architecture interne

```
src/modules/search/
├── SearchPro.tsx              # Composant principal avec synchronisation URL
├── SearchProStatic.tsx        # Version sans synchronisation URL
├── SearchProSection.tsx       # Section wrapper pour SearchPro
├── SearchProStaticSection.tsx # Section wrapper pour SearchProStatic
├── CardCountCTSection.tsx     # Section compteurs par type (Commune Transparente)
├── components/
│   ├── ActiveFiltersBar.tsx   # Affichage des filtres actifs
│   ├── AddEntityModal.tsx     # Modal d'ajout d'entité
│   ├── FilterDropdown.tsx     # Dropdown de sélection de filtres
│   ├── Preview.tsx            # Prévisualisation
│   ├── SearchBubbleChart.tsx  # Graphique en bulles pour visualisation
│   ├── SearchCard.tsx         # Carte de résultat (dispatch vers variantes)
│   ├── SearchCardDetailed.tsx # Vue détaillée d'une carte
│   ├── SearchCardSkeleton.tsx # Skeleton pour chargement
│   ├── SearchFilters.tsx      # Panneau de filtres
│   ├── SearchListView.tsx     # Liste des résultats
│   ├── SearchListSkeleton.tsx # Skeleton pour liste
│   ├── SearchMap.tsx          # Carte Leaflet
│   ├── SearchMapWrapper.tsx   # Wrapper avec lazy loading
│   ├── SearchTextInput.tsx    # Champ de recherche
│   ├── SwitchDetailsMode.tsx  # Switch drawer/dialog
│   ├── renderMapPopup.tsx     # Rendu des popups carte
│   ├── card/
│   │   ├── CardCountCT.tsx        # Carte compteur Commune Transparente
│   │   ├── CardDefault.tsx        # Carte standard
│   │   ├── CardElts.tsx           # Carte éléments
│   │   ├── CardEvent.tsx          # Carte événement
│   │   ├── CardEventRezoLaMer.tsx # Carte événement RezoLaMer
│   │   ├── CardOverlay.tsx        # Carte avec overlay
│   │   ├── CardPoiRezoLaMer.tsx   # Carte POI RezoLaMer
│   │   ├── CardProfile.tsx        # Carte profil
│   │   ├── CardRezoLaMer.tsx      # Carte RezoLaMer
│   │   ├── CardSsbe.tsx           # Carte SSBE
│   │   ├── CardTiersLieux.tsx     # Carte tiers-lieux
│   │   └── ThematicsSection.tsx   # Section thématiques/filières
│   ├── detailsMode/
│   │   ├── DetailsModeDialog.tsx  # Modal détails
│   │   └── DetailsModeDrawer.tsx  # Drawer détails
│   ├── mapPopup/
│   │   └── MapPopupDefault.tsx    # Popup carte par défaut
│   └── preview/
│       └── PreviewDefault.tsx     # Prévisualisation par défaut
├── constants/
│   ├── index.ts               # Exports
│   └── queryKeys.ts           # Clés React Query
├── contexts/
│   ├── SearchPropsContext.tsx     # Context des props
│   └── SearchPropsProvider.tsx    # Provider du context
├── hooks/
│   ├── loadLeaflet.ts         # Chargement dynamique de Leaflet
│   ├── useCsvExport.ts        # Export CSV des résultats
│   ├── useItem.tsx            # Fusion données serveur/valeurs par défaut
│   ├── useSearchFilters.tsx   # Gestion des états de filtres
│   ├── useSearchProps.tsx     # Accès aux props du context
│   ├── useSearchQuery.ts      # Query pour résultats de recherche
│   └── useZonesQuery.ts       # Query pour les zones géographiques
├── i18n/
│   ├── en.json                # Traductions anglaises
│   └── fr.json                # Traductions françaises
├── i18n.ts                    # Pont vers react-i18next
├── prefetch/
│   ├── index.ts               # Exports
│   └── prefetchSearchResults.ts # Pré-chargement SSR des résultats
├── schema.ts                  # Schémas Zod (SearchProSectionSchema, SearchProStaticSectionSchema, CardCountCTSectionSchema, ThematicsSectionSchema)
├── styles.css                 # Styles spécifiques au module
└── index.ts                   # Exports: SearchSection, SearchProSectionSchema
```

### Schéma de configuration (`schema.ts`)

Le module expose deux schémas principaux:

**`SearchProSectionSchema`** (voir section 5.5.34) - avec synchronisation URL:
* `title`, `description`: textes d'en-tête
* `placeholder`: texte du champ
* `useFilter`, `showMap`, `enableMap`: booléens d'activation
* `showActiveFiltersTypes`, `showActiveFiltersTags`: affichage des filtres actifs
* `disableInfiniteScroll`: désactiver le scroll infini
* `showDetailedViewToggle`: bouton toggle vue détaillée
* `customHeader`: en-tête personnalisé avec titre, lien et bouton carte
* `filters`: structure des filtres (tags, type)
* `baseParams`: paramètres initiaux (API, defaultTypes, defaultTags, defaultSortBy, etc.)
* `list`: configuration liste (colonnes, card type/variant, detailsMode, preview)
* `map`: configuration carte (initialZoom, cluster, popup type)

**`SearchProStaticSectionSchema`** (voir section 5.5.35) - sans synchronisation URL:
* Même structure de base mais avec des defaults différents (useFilter: false, showMap: false, showSearch: false)
* Champs supplémentaires par rapport à SearchPro:
  * `icon`: icône optionnelle
  * `showSearch`: affichage du champ de recherche (default: false)
  * `enableGraph`: activer le graphique en bulles (default: false)
  * `graphCategories`: catégories pour le graphique
  * `graphDetailsMode`: mode détails du graphique (`"drawer"` | `"dialog"` | `"link"`, default: `"drawer"`)
  * `defaultViewMode`: mode d'affichage par défaut (`"list"` | `"map"` | `"graph"`)
  * `width`: largeur optionnelle (`"container"`)
  * `defaultDetailedView`: vue détaillée par défaut
  * `addButton`: configuration du bouton d'ajout (show, label, modal, formConfig, types d'entités)
  * `zoneSelector`: sélecteur de zones géographiques (show, label, countryCode, level, etc.)
  * `tagSelector`: sélecteur de tags (show, label, placeholder, options)
  * `csvButton`: bouton d'export CSV (show, label, separator, filename, columns)
  * `bg`: couleur de fond (`"default"` | `"card"` | `"muted"` | `"primary"` | `"secondary"` | `"accent"` | `"transparent"`)
* Permet d'afficher plusieurs instances sur une même page sans conflit d'URL

**`CardCountCTSectionSchema`** - compteurs par type:
* `title`, `subtitle`: textes d'en-tête
* `bg`: couleur de fond (inclut des variantes gradient: `"gradient-teal"`, `"gradient-blue"`, `"gradient-indigo"`, `"gradient-cyan"`)
* `baseParams`: paramètres de recherche (fediverse, defaultTypes, defaultTags, defaultFilters, locality)
* `cards`: tableau de cartes avec `countKey`, `label`, `icon`, `color`, `href`

**`ThematicsSectionSchema`** - filières dynamiques:
* `title`, `subtitle`, `emptyMessage`: textes d'en-tête et message vide

### Context et hooks

* **`SearchPropsContext`** expose les props validées à tous les composants enfants (filtres, liste, carte).
* **`useSearchFilters`** gère l'état local des filtres (sélection, reset).
* **`loadLeaflet`** importe dynamiquement le bundle Leaflet uniquement si `showMap` est à `true` (optimisation du bundle).
* **`useItem`** fusionne les données serveur avec des valeurs par défaut et normalise la structure.

### Composants clés

| Composant              | Rôle                                                         |
| ---------------------- | ------------------------------------------------------------ |
| `SearchPro`            | Composant principal avec synchronisation URL (query params)  |
| `SearchProStatic`      | Version sans synchronisation URL (pour multi-instances)      |
| `SearchProSection`     | Section wrapper pour `SearchPro`                             |
| `SearchProStaticSection` | Section wrapper pour `SearchProStatic`                     |
| `ActiveFiltersBar`     | Affiche les filtres actifs avec boutons de suppression       |
| `FilterDropdown`       | Dropdown de sélection de filtres (tags, types)               |
| `SearchListView`       | Liste des résultats avec infinite scroll                     |
| `SearchMapWrapper`     | Wrapper avec lazy loading de Leaflet                         |
| `SearchMap`            | Carte Leaflet avec clusters et popups                        |
| `SearchCard`           | Carte individuelle (dispatch vers variantes)                 |
| `CardDefault`          | Variante carte standard                                      |
| `CardOverlay`          | Variante carte avec image en overlay                         |
| `CardTiersLieux`       | Variante carte tiers-lieux                                   |
| `CardEvent`            | Variante carte événement                                     |
| `CardEventRezoLaMer`   | Variante carte événement RezoLaMer                           |
| `CardPoiRezoLaMer`     | Variante carte POI RezoLaMer                                 |
| `CardRezoLaMer`        | Variante carte RezoLaMer                                     |
| `CardProfile`          | Variante carte profil                                        |
| `CardElts`             | Variante carte éléments                                      |
| `CardSsbe`             | Variante carte SSBE                                          |
| `CardCountCT`          | Carte compteur Commune Transparente                          |
| `ThematicsSection`     | Section thématiques/filières                                 |
| `SearchBubbleChart`    | Graphique en bulles pour visualisation                       |
| `SearchCardDetailed`   | Vue liste détaillée                                          |
| `SwitchDetailsMode`    | Ouvre les détails en `drawer` ou `dialog`                    |
| `DetailsModeDrawer`    | Drawer latéral pour détails                                  |
| `DetailsModeDialog`    | Modal dialog pour détails                                    |
| `PreviewDefault`       | Prévisualisation standard des informations                   |
| `MapPopupDefault`      | Popup par défaut pour les marqueurs de carte                 |
| `AddEntityModal`       | Modal d'ajout d'une nouvelle entité                          |

### Exemple de configuration JSON

**SearchPro** (avec synchronisation URL):
```json
{
  "type": "searchPro",
  "props": {
    "title": { "fr": "Recherche", "en": "Search" },
    "description": { "fr": "Trouvez des ressources", "en": "Find resources" },
    "placeholder": { "fr": "Rechercher...", "en": "Search..." },
    "useFilter": true,
    "showMap": true,
    "enableMap": true,
    "showActiveFiltersTypes": true,
    "showActiveFiltersTags": true,
    "showDetailedViewToggle": true,
    "customHeader": {
      "title": { "fr": "Nos partenaires", "en": "Our partners" },
      "linkText": { "fr": "Voir tout", "en": "See all" },
      "linkHref": "/partners",
      "showMapButton": true
    },
    "filters": {
      "tags": {
        "type": "tags",
        "name": { "fr": "Thèmes", "en": "Topics" },
        "list": ["Culture", "Sport", "Environnement"],
        "active": true,
        "previewVisible": true
      },
      "types": {
        "type": "type",
        "name": { "fr": "Type", "en": "Type" },
        "list": {
          "organizations": { "fr": "Organisations", "en": "Organizations" },
          "projects": { "fr": "Projets", "en": "Projects" }
        }
      }
    },
    "baseParams": {
      "indexStepList": 12,
      "indexStepMap": 100,
      "defaultTypes": ["organizations", "projects"],
      "defaultTags": ["Culture"],
      "defaultSortBy": { "name": 1 }
    },
    "list": {
      "columns": { "lg": 3, "md": 2, "sm": 1 },
      "card": {
        "type": "tiers-lieux",
        "variant": "tiers-lieux",
        "detailsMode": "drawer",
        "showDescription": true,
        "showAddress": true,
        "tagLimit": 3
      },
      "preview": { "type": "default" }
    },
    "map": { "initialZoom": 10, "cluster": true, "popup": { "type": "default" } }
  }
}
```

**SearchProStatic** (sans synchronisation URL - pour multi-instances):
```json
{
  "type": "searchProStatic",
  "props": {
    "title": { "fr": "Événements à venir", "en": "Upcoming Events" },
    "placeholder": { "fr": "Rechercher un événement...", "en": "Search event..." },
    "useFilter": false,
    "showMap": false,
    "baseParams": {
      "defaultTypes": ["events"],
      "indexStepList": 6
    },
    "list": {
      "columns": { "lg": 3 },
      "card": { "type": "event", "variant": "event" }
    }
  }
}
```

---

## Récapitulatif

| Module | Type | Routes | Usage |
|--------|------|--------|-------|
| **search** | — | Non | Sections `searchPro` et `searchProStatic` |

## Structure commune des modules

> **Note** : `eventList`, `contactForm`, `blogList`, `newsletter` sont des **types de sections** (voir [Schémas sections](05-schemas-sections.md)), pas des modules avec leur propre structure.

Tous les modules suivent la même structure :

1. **Validation des props** avec Zod (`schema.ts`)
2. **Context/Hooks** pour la logique métier
3. **Composants** pour l'UI
4. **i18n** pour textes multi-langues
5. **Configuration** via `module.config.ts` (si routes)
6. **Routes** via `routes.tsx` (si nécessaire)
7. **Permissions** via `permissions/` (si le module gère des permissions)

---

## Voir aussi

- [Module Profil](08-module-profil.md)
- [Module News](09-module-news.md)
- [Schémas sections](05-schemas-sections.md)
- [Permissions](10-permissions.md)
