import { LocalizedString } from "@/types/locale-schema";
import { ActionButtonSchema } from "@/types/action-button-schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { IconName } from "lucide-react/dynamic";
import { z } from "zod";

/**
 * Nom d'icône lucide. Typé `IconName` (au lieu de `z.string()`) sans énumérer les
 * ~1500 littéraux : `z.custom` est permissif au runtime mais expose le bon type
 * → plus de cast `as IconName` côté composant. Réutilisable par tous les champs icône.
 */
export const IconNameSchema = z.custom<IconName>();

//──────────────── Filters Section
// Section sidebar qui pilote le state des filtres (selectedFilters,
// searchByFields, searchQuery) consommé par SearchPro/SearchProStatic via
// PageFiltersContext. Vit dans le module search car elle n'a de sens qu'avec
// un consommateur search dans le même PageFiltersProvider.

// ─── Schémas de filtres (partagés) ───────────────────────────────────────────
// Source unique réutilisée par `FiltersSectionSchema` (UI /lieux) ET par le hero
// (applicateur headless de la home) — évite la duplication inline.

/** Widget COMPACT au lieu de l'accordéon à cases (matrice observatoire) :
 *  {} → Select simple · {multiple} → combobox multi coche-à-droite ·
 *  {searchable} → MultipleSelector (sélection unique) · {multiple, searchable}
 *  → MultipleSelector multi. Absent → accordéon (défaut). Disponible sur les
 *  groupes statiques, scopeList ET les groupes « par réponses ». */
export const FilterSelectConfigSchema = z.object({
  multiple: z.boolean().optional(),
  searchable: z.boolean().optional(),
});

export const FilterGroupSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  type: z.enum(['scopeList', "filters", "entityList"]).default("filters"),
  field: z.string().optional(),
  options: z.array(z.object({
    id: z.string(),
    label: LocalizedString,
    level: z.string().optional(),
    name: z.string().optional(),
    defaultChecked: z.boolean().optional(),
  })).optional(),
  config: z.object({
    countryCode: z.array(z.string()).optional(),
    level: z.array(z.string()).optional(),
    upperLevelId: z.string().optional(),
    sortBy: z.string().optional(),
  }).optional(),
  // Pour `type: "entityList"` — recherche backend qui peuple les options
  // dynamiquement (réseaux régionaux, etc.). Réutilise le shape baseParams
  // des sections search. Forward-ref car SearchBaseParamsSchema est défini
  // plus bas dans le fichier.
  baseParams: z.lazy(() => SearchBaseParamsSchema).optional(),
  // Comment l'option sélectionnée filtre les résultats à droite.
  // "sourceKey" → injecte la valeur dans baseParams.sourceKey (param natif
  // SDK : matching source.key/source.keys/reference.costum côté backend).
  filterType: z.enum(["sourceKey"]).optional(),
  // Champ de l'entité utilisé comme valeur de filtre (défaut: "slug").
  filterBy: z.string().optional(),
  /** Widget compact (cf. {@link FilterSelectConfigSchema}). Absent → accordéon. */
  select: FilterSelectConfigSchema.optional(),
  /** Style des lignes d'option en mode ACCORDÉON : cases (défaut) ou lignes
   *  à coche à DROITE (look SelectItem, comme les combobox). */
  optionStyle: z.enum(["checkbox", "check"]).optional(),
});
export const FilterGroupsSchema = z.array(FilterGroupSchema);

export const FiltersByAnswersSchema = z.record(z.string(), z.object({
  id: z.string().optional(),
  label: LocalizedString,
  type: z.enum(["form", 'answers']).default("answers"),
  path: z.string().optional(),
  forms: z.string().optional(),
  finderPath: z.string().optional(),
  /** Widget compact (cf. {@link FilterSelectConfigSchema}). Absent → accordéon. */
  select: FilterSelectConfigSchema.optional(),
  value: z.record(z.string(), z.object({
    id: z.string(),
    finder: z.string(),
  })).optional(),
}));

// Filtres par thématique CoForm via `coformFilterByPath` (un appel par entrée).
// Même structure de sortie que filtersByAnswers (sélection → filters._id.$in =
// orgaNameArray) mais appel backend différent.
export const FiltersByPathSchema = z.record(z.string(), z.object({
  id: z.string().optional(),
  label: LocalizedString,
  thematicPath: z.string(),
  finderPath: z.string().optional(),
  // notSourceKey: true → cherche dans tout le réseau (cf. coformFilterByPath).
  notSourceKey: z.boolean().optional(),
  /** Widget compact (cf. {@link FilterSelectConfigSchema}). Absent → accordéon. */
  select: FilterSelectConfigSchema.optional(),
}));

export const FiltersSectionSchema = z.object({
  type: z.literal("filters"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    filterGroups: FilterGroupsSchema,
    filtersByAnswers: FiltersByAnswersSchema.optional(),
    filtersByPath: FiltersByPathSchema.optional(),
    defaultOpenGroups: z.array(z.string()).optional(),
    className: z.string().optional(),
  }),
});

export type FiltersSection = z.infer<typeof FiltersSectionSchema>;
export type FiltersSectionProps = z.infer<typeof FiltersSectionSchema>["props"];

//──────────────── Search Pro Section
const TagsFilterSchema = z.object({
  type: z.union([z.literal("tags"), z.literal("type")]),
  name: LocalizedString.or(z.string()),
  list: z.array(LocalizedString.or(z.string()))
         .or(z.record(z.string(), LocalizedString.or(z.string()))),
  active: z.boolean().optional(),
  previewVisible: z.boolean().optional(),
  previewIcon: z.string().optional(),
});

export type TagsFilter = z.infer<typeof TagsFilterSchema>;

/** Contenu du détail (rendu DANS le conteneur `detailsMode`). Axe indépendant
 *  de la carte : `Preview.tsx` dispatche dessus. Noms design/fonctionnalité.
 *  Exporté : réutilisé par le module observatoire (rowAction preview). */
export const PreviewConfSchema = z.object({
  type: z.enum(["default", "poi-amenities", "coform-answer"]).default("default"),
  // Mapping rôle→suffixe de champ CoForm (pour `coform-answer`). Surcharge la
  // table par défaut du composant — découple les IDs de champs du code.
  fields: z.record(z.string(), z.string()).optional(),
}).partial();

const ListConfSchema = z.object({
  columns: z.object({
    lg: z.number().int().min(1).max(6).optional(),
    md: z.number().int().min(1).max(6).optional(),
    sm: z.number().int().min(1).max(6).optional(),
    xl: z.number().int().min(1).max(6).optional(),
  }).partial().optional(),
  card: z.object({
    tagLimit:        z.number().int().min(1).max(50).optional(),
    showDescription: z.boolean().optional(),
    showAddress:     z.boolean().optional(),
    shareButton:     z.boolean().optional(),
    showStar:        z.boolean().optional(),
    // Affiche la barre de progression de financement (cagnotte) sur la carte +
    // déclenche la query useFundingEnvelope. Découple la feature funding du style
    // de carte. Défaut : actif uniquement pour le variant "rezo-la-mer" (rétrocompat).
    showFunding:     z.boolean().optional(),
    detailsMode: z.enum(["drawer", "dialog"]).default("drawer"),
    detailedMode: z.enum(["default", "service-pricing"]).default("default"),
    // Coin haut-droit des cartes à image (`image-cover`) : par défaut les
    // badges génériques (serverData.badges / tags) ; "service-pricing" les
    // remplace par les pastilles de capacité (postes/personnes/couverts).
    overlayStats: z.enum(["service-pricing"]).optional(),
    // Chemins CoForm des données service-pricing (cartes `detailedMode` /
    // `overlayStats`). Surcharge PAR CATÉGORIE la table par défaut du code
    // (précédent : `preview.fields`) — découple les IDs de formulaires/champs.
    // `meeting.room` pointe une commonTable : ligne 0 = en-têtes, colonnes
    // [2..6] = capacité min, capacité max, prix horaire, demi-journée, journée.
    servicePricing: z.object({
      meeting: z.object({ id: z.string(), room: z.string() }).optional(),
      coworking: z.object({
        id: z.string(),
        place: z.string(),
        price: z.object({ hourly: z.string(), halfDay: z.string(), fullDay: z.string() }),
      }).optional(),
      accommodation: z.object({
        id: z.string(),
        place: z.string(),
        price: z.object({ bed: z.string(), room: z.string() }),
      }).optional(),
    }).optional(),
    // Valeurs DESIGN/FONCTIONNALITÉ (jamais de nom de site). `Preview`/détail =
    // axe séparé (`preview.type`/`detailsMode`).
    type: z.enum(["overlay", "default", "image-cover", "event", "funding", "profile", "event-featured", "resource-booking", "poi-amenities", "image-panel", "contact-card", "card-answer"]).default("default"),
    variant: z.enum(["default", "image-cover", "event", "funding", "profile", "event-featured", "resource-booking", "poi-amenities", "image-panel", "contact-card", "card-answer"]).optional(),
  }).partial().optional(),
  preview: PreviewConfSchema.optional(),
}).partial();

export type ListConf = z.infer<typeof ListConfSchema>;


const MapConfSchema = z.object({
  initialZoom: z.number().min(1).max(20).optional(),
  cluster:     z.boolean().optional(),
  popup: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
  /** Action du bouton de la popup : détail du module search (défaut
   *  `preview` — `SwitchDetailsMode` avec `list.card`/`list.preview`) ou
   *  navigation `/profil/:slug` (pattern rowAction observatoire / palette). */
  itemAction: z.object({ kind: z.enum(["profil", "preview"]) }).optional(),
  /** Apparence des marqueurs — chaîne de repli : vignette RONDE de l'item
   *  (`useItemImage`, si l'item a une image) → pin SVG aux couleurs du thème
   *  (`style: "pin"` + `color` en jeton, jamais d'hex) → pin Leaflet. */
  marker: z.object({
    useItemImage: z.boolean().optional(),
    style: z.enum(["default", "pin"]).optional(),
    color: z.enum(["primary", "accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]).optional(),
  }).optional(),
}).partial();

export type MapConf = z.infer<typeof MapConfSchema>;

const SearchTypeSchema = z.enum([
  "NGO",
  "LocalBusiness",
  "Group",
  "GovernmentOrganization",
  "Cooperative",
  "organizations",
  "projects",
  "events",
  "citoyens",
  "poi",
  "answers",
  "news",
  "proposals",
]);

export type SearchType = z.infer<typeof SearchTypeSchema>;

/**
 * Variant du endpoint backend pour `searchCostum` (cf. SDK v1.0.132).
 * - `default` (ou absent) → `/co2/search/globalautocomplete` (comportement historique)
 * - `navigator-tl` → `/costum/navigator/gettl` (payload enrichi avec auto-link Answer)
 */
export const SearchVariantSchema = z.enum(["default", "navigator-tl"]);
export type SearchVariant = z.infer<typeof SearchVariantSchema>;

/**
 * Champs sur lesquels le backend effectue la recherche texte (`searchCostum.name`).
 * 3 formes acceptées par le SDK v1.0.132+ :
 * - `"ALL"` — mot-clé spécial, tous les champs par défaut côté backend
 * - `"name,slug,tags"` — CSV de noms de champs
 * - `["name", "address.addressLocality"]` — array de paths (supporte les paths imbriqués)
 * Le fix paginator du SDK v1.0.132 rend la pagination cohérente entre les 3 formes.
 */
export const SearchBySchema = z.union([z.string(), z.array(z.string())]);
export type SearchBy = z.infer<typeof SearchBySchema>;

/**
 * Paramètres de recherche backend (searchCostum). Partagé entre les sections
 * search (searchPro / searchProStatic) et les groupes de filtre dynamiques
 * (`entityList`) qui peuplent leurs options via une recherche d'entités.
 */
export const SearchBaseParamsSchema = z.object({
  fediverse:     z.boolean().optional(),
  indexStepList: z.number().optional(),
  indexStepMap:  z.number().optional(),
  defaultTypes: z.array(SearchTypeSchema).optional(),
  defaultTags:   z.array(z.string()).optional(),
  defaultFilters: z.record(z.string(), z.unknown()).optional(),
  defaultFields: z.array(z.string()).optional(),
  defaultSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
  // Champs sur lesquels le texte de recherche est matché (cf. SearchBySchema).
  searchBy: SearchBySchema.optional(),
  // Accepte `boolean` (ne pas sourcer par clé) ou `number` (limite custom).
  // Certaines configs historiques utilisent un nombre — schéma assoupli pour compat.
  notSourceKey: z.union([z.boolean(), z.number()]).optional(),
  locality: z.record(z.string(), z.object({
    id: z.string(),
    type: z.string(),
    name: z.string().optional(),
    countryCode: z.string().optional(),
    level: z.union([z.string(), z.number()]).optional(),
    active: z.boolean().optional(),
    key: z.string().optional(),
  })).optional(),
  contextId: z.string().optional(),
  contextType: z.enum(["projects", "organizations"]).optional(),
  costumSlug: z.string().optional(),
  costumEditMode: z.union([z.boolean(), z.string(), z.number()]).optional(),
  sourceKey: z.array(z.string()).optional(),
});
export type SearchBaseParams = z.infer<typeof SearchBaseParamsSchema>;

export const SEARCH_TYPE_ICON_NAMES: Record<SearchType, IconName> = {
  NGO: "hand-heart",
  LocalBusiness: "store",
  Group: "users",
  GovernmentOrganization: "land-plot",
  Cooperative: "handshake",
  organizations: "building-2",
  projects: "layout-dashboard",
  events: "calendar-days",
  citoyens: "user",
  poi: "map-pin",
  answers: "file-text",
  news: "newspaper",
  proposals: "lightbulb",
};

export const SearchProSectionSchema = z.object({
  type: z.literal("searchPro"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString,
    useFilter:   z.boolean().default(true),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    defaultViewMode: z.enum(["list", "map", "graph"]).optional(),
    showActiveFiltersTypes: z.boolean().default(true),
    showActiveFiltersTags: z.boolean().default(true),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    /**
     * Variant SDK pour `searchCostum`. Absent ou `"default"` → endpoint
     * historique `globalautocomplete`. `"navigator-tl"` → endpoint enrichi
     * `costum/navigator/gettl` (auto-link Answer dans `serverData.answers`).
     * Le backend du site doit supporter le variant choisi.
     */
    searchVariant: SearchVariantSchema.optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      linkIcon: IconNameSchema.optional(),
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      indexStepMap:  z.number().optional(),
      defaultTypes: z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      defaultFields: z.array(z.string()).optional(),
      defaultSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
      // Champs sur lesquels le texte de recherche est matché (cf. SearchBySchema).
      searchBy: SearchBySchema.optional(),
      // Accepte `boolean` (ne pas sourcer par clé) ou `number` (limite custom).
      // Certaines configs historiques utilisent un nombre — schéma assoupli pour compat.
      notSourceKey: z.union([z.boolean(), z.number()]).optional(),
      locality: z.record(z.string(), z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().optional(),
        countryCode: z.string().optional(),
        level: z.union([z.string(), z.number()]).optional(),
        active: z.boolean().optional(),
        key: z.string().optional(),
      })).optional(),
    }).optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
  }),
});

export type SearchProSection = z.infer<typeof SearchProSectionSchema>;
export type SearchProSectionProps = z.infer<typeof SearchProSectionSchema>["props"]

const AddButtonConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  modal: z.string().optional(),
  formConfig: z.any().optional(),
  organization: z.boolean().optional().default(true),
  project: z.boolean().optional().default(true),
  event: z.boolean().optional().default(true),
  poi: z.boolean().optional().default(true),
}).optional();

export type AddButtonConfig = z.infer<typeof AddButtonConfigSchema>;

const ZoneSelectorConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  placeholder: LocalizedString.optional(),
  countryCode: z.array(z.string()).optional().default(["RE"]),
  level: z.array(z.union([z.number(), z.string()])).optional().default([1]),
  sortBy: z.string().optional().default("name"),
  costumSlug: z.string().optional(),
  costumEditMode: z.union([z.boolean(), z.string(), z.number()]).optional().default(false),
  costumId: z.string().optional(),
  costumType: z.string().optional(),
}).optional();

export type ZoneSelectorConfig = z.infer<typeof ZoneSelectorConfigSchema>;

const CsvColumnSchema = z.object({
  header: z.string(),
  path: z.string(),
});

const CsvButtonConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  separator: z.string().default(";"),
  filename: z.string().optional(),
  columns: z.array(CsvColumnSchema).optional(),
}).optional();

export type CsvButtonConfig = z.infer<typeof CsvButtonConfigSchema>;

const TagSelectorConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  placeholder: LocalizedString.optional(),
  options: z.record(z.string(), LocalizedString.or(z.string())),
}).optional();

export type TagSelectorConfig = z.infer<typeof TagSelectorConfigSchema>;

// SearchProStatic: Version sans synchronisation URL pour affichage multiple par page
export const SearchProStaticSectionSchema = z.object({
  type: z.literal("searchProStatic"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    icon: z.string().optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString.optional(),
    showSearch:  z.boolean().default(false),
    useFilter:   z.boolean().default(false),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    enableRegions: z.boolean().default(false),
    // Cible de navigation quand on clique sur la carte regions : on redirige
    // vers `path` avec `filterId=<slugs>` en query (le groupe entityList
    // correspondant dans la page cible pré-coche le filtre). Ex. cliquer un
    // réseau régional → /lieux?reseauxRegionaux=<slug>.
    regionsTarget: z.object({
      path: z.string(),
      filterId: z.string(),
    }).optional(),
    // Vue "thematics" : grille de cards (nom + image) des valeurs d'un filtre
    // thématique CoForm (`coformFilterByPath`). S'active via
    // `defaultViewMode: "thematics"` + `thematicSource` (page dédiée, sans toggle).
    // Source de l'appel coformFilterByPath (même forme qu'une entrée
    // `filtersByPath` de la section `filters`).
    thematicSource: z.object({
      id: z.string().optional(),
      label: LocalizedString,
      thematicPath: z.string(),
      finderPath: z.string().optional(),
      notSourceKey: z.boolean().optional(),
    }).optional(),
    // Cible de navigation au clic sur une card thématique : `path` avec
    // `filterId=<name>` en query → la page cible pré-active le filtre. Ex.
    // cliquer un réseau thématique → /lieux?reseauxThematiques=<name>.
    thematicsTarget: z.object({
      path: z.string(),
      filterId: z.string(),
    }).optional(),
    enableGraph: z.boolean().default(false),
    graphTags: z.array(z.string()).optional(),
    graphCategories: z.array(z.string()).optional(),
    graphDefaultGroupMode: z.enum(["country", "category"]).optional(),
    graphEnableCountryGrouping: z.boolean().optional(),
    graphDetailsMode: z.enum(["drawer", "dialog", "link"]).default("drawer"),
    defaultViewMode: z.enum(["list", "map", "graph", "regions", "thematics"]).optional(),
    showActiveFiltersTypes: z.boolean().default(false),
    showActiveFiltersTags: z.boolean().default(false),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    width: z.enum(["container"]).optional(),
    defaultDetailedView: z.boolean().optional(),
    /**
     * Variant SDK pour `searchCostum`. Cf. note sur `SearchProSectionSchema`.
     */
    searchVariant: SearchVariantSchema.optional(),
    addButton: AddButtonConfigSchema,
    zoneSelector: ZoneSelectorConfigSchema,
    tagSelector: TagSelectorConfigSchema,
    csvButton: CsvButtonConfigSchema,
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      linkIcon: IconNameSchema.optional(),
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),

    baseParams: SearchBaseParamsSchema.optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
  }),
});

export type SearchProStaticSection = z.infer<typeof SearchProStaticSectionSchema>;
export type SearchProStaticSectionProps = z.infer<typeof SearchProStaticSectionSchema>["props"]

// CardCountCT: Section dédiée à l'affichage des compteurs par type
const CardCountCTCardConfigSchema = z.object({
  countKey: z.string(),
  label: LocalizedString.or(z.string()),
  icon: z.string().optional(),
  color: z.string().optional(),
  href: z.string().optional(),
});

export const CardCountCTSectionSchema = z.object({
  type: z.literal("cardCountCT"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
    // Accepte tokens sémantiques (énumérés) OU classe Tailwind brute (string libre,
    // ex. `bg-cyan-500`). Cette flexibilité permet aux sites costum d'utiliser
    // des couleurs spécifiques non listées comme tokens globaux.
    bg: z.union([
      z.enum([
        "default", "card", "muted", "primary", "secondary", "accent", "transparent",
        "gradient-teal", "gradient-blue", "gradient-indigo", "gradient-cyan",
      ]),
      z.string(),
    ]).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      defaultTypes: z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      // Accepte `boolean` (ne pas sourcer par clé) ou `number` (limite custom).
      // Certaines configs historiques utilisent un nombre — schéma assoupli pour compat.
      notSourceKey: z.union([z.boolean(), z.number()]).optional(),
      locality: z.record(z.string(), z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().optional(),
        countryCode: z.string().optional(),
        level: z.union([z.string(), z.number()]).optional(),
        active: z.boolean().optional(),
        key: z.string().optional(),
      })).optional(),
    }).optional(),

    cards: z.array(CardCountCTCardConfigSchema).optional(),
  }),
});

export type CardCountCTSection = z.infer<typeof CardCountCTSectionSchema>;
export type CardCountCTSectionProps = z.infer<typeof CardCountCTSectionSchema>["props"]

// Thematics Section - Icon mapping from FontAwesome to Lucide
/**
 * Mapping des icônes FontAwesome vers les icônes Lucide
 * Basé sur les filières disponibles
 */
export const FILIERE_ICON_MAPPING: Record<string, string> = {
  "fa-cutlery": "utensils",
  "fa-heart-o": "heart",
  "fa-chain": "link",
  "fa-link": "link",
  "fa-globe": "globe",
  "fa-bus": "bus",
  "fa-book": "book",
  "fa-user-circle-o": "circle-user",
  "fa-sun-o": "sun",
  "fa-universal-access": "accessibility",
  "fa-tree": "tree-pine",
  "fa-laptop": "laptop",
  "fa-futbol-o": "circle-dot",
  "fa-trash-o": "trash-2",
  "fa-android": "smartphone",
  "fa-leaf": "leaf",
  "fa-money": "banknote",
  "fa-arrows": "move",
  "fa-hand-o-up": "hand",
  "fa-flask": "flask-conical",
  "fa-lightbulb-o": "lightbulb",
  "fa-cross": "cross",
  "fa-gavel": "scale",
  "fa-anchor": "anchor"
};

// Thematics: Section pour afficher les filières de manière dynamique
export const ThematicsSectionSchema = z.object({
  type: z.literal("thematics"),
  id: z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
    emptyMessage: LocalizedString.optional(),
  }),
});

export type ThematicsSection = z.infer<typeof ThematicsSectionSchema>;
export type ThematicsSectionProps = z.infer<typeof ThematicsSectionSchema>["props"]

//──────────────── Search Header (titre + filtres + boutons)
// Header de recherche horizontal (rendu par `sections/SearchHeaderSection`),
// producteur du PageFiltersContext au même titre que `<FiltersSection>`.
// Type config canonique `searchHeader`.
// `ActionButtonSchema` est un contrat partagé (rendu par `modules/profil`) →
// défini dans la feuille `@/types/action-button-schema` (cf. import ci-dessus).

const TitleWithFiltersDropdownOptionSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  value: z.string().optional(),
  field: z.string().optional(),
  icon: z.string().optional(),
});

const TitleWithFiltersDropdownSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  field: z.string().optional(),
  multiple: z.boolean().optional(),
  allLabel: LocalizedString.optional(),
  options: z.array(TitleWithFiltersDropdownOptionSchema).default([]),
});

// Props partagées entre le type canonique `searchHeader` et son alias.
const SearchHeaderProps = z.object({
  headline: LocalizedString.optional(),
  subhead: LocalizedString.optional(),
  // Override de la classe couleur du titre `h1` (déf. `text-foreground`). Utile
  // quand le bandeau a un fond fixe sombre (ex. `bg-[image:var(--gradient-section)]`) où le token
  // `--foreground` (sombre en light) devient illisible : `text-white dark:text-foreground`.
  headlineClassName: z.string().optional(),
  // Override de la classe couleur du sous-titre (déf. `text-foreground`).
  // Remplace le hack par-slug historique : un site dont le subhead ne doit pas
  // forcer `text-foreground` met `subheadClassName: ""`.
  subheadClassName: z.string().optional(),
  // Override du conteneur flex de la rangée de filtres (recherche + dropdowns).
  // Déf. `flex flex-col lg:flex-row lg:items-center`. Permet d'éviter l'étalement
  // pleine largeur (ex. `flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-center`).
  filtersClassName: z.string().optional(),
  types: z.array(
    z.object({
      id: z.string(),
      label: LocalizedString,
    })
  ).optional(),
  dropdownFilters: z.array(TitleWithFiltersDropdownSchema).optional(),
  buttons: z.array(ActionButtonSchema).optional(),
  showSearch: z.boolean().optional(),
  searchPlaceholder: LocalizedString.optional(),
});

export const SearchHeaderSectionSchema = z.object({
  type: z.literal("searchHeader"),
  id: z.string().optional(),
  props: SearchHeaderProps,
});

export type SearchHeaderSection = z.infer<typeof SearchHeaderSectionSchema>;
export type SearchHeaderSectionProps = z.infer<typeof SearchHeaderSectionSchema>["props"];


export interface SearchListViewProps<T extends SearchEntity = SearchEntity> {
  results: T[];
  columns?: ListConf["columns"];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
  isDetailedView?: boolean;
}

export interface SwitchDetailsModeProps<T extends SearchEntity = SearchEntity> {
  openDetails: boolean;
  setOpenDetails: (open: boolean) => void;
  item: T;
  card?: ListConf["card"];
  preview?: ListConf["preview"];
}

export interface DetailsModeProps<T extends SearchEntity = SearchEntity> {
  openDetails: boolean;
  setOpenDetails: (open: boolean) => void;
  preview?: ListConf["preview"];
  item: T;
}

export interface SearchCardProps<T extends SearchEntity = SearchEntity> {
  item: T;
  onClick?: () => void;
  card?: ListConf["card"];
}

export interface PreviewProps<T extends SearchEntity = SearchEntity> {
  item: T;
  preview?: ListConf["preview"];
  /** Ferme le conteneur de détail (drawer/dialog) — fourni par le conteneur. */
  onClose?: () => void;
}

export interface SearchMapWrapperProps<T extends SearchEntity = SearchEntity> {
  results: T[];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
  map?: MapConf;
}

export interface SearchMapProps<T extends SearchEntity = SearchEntity> {
  results: T[];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
  map?: MapConf;
}

export interface MapPopupProps<T extends SearchEntity = SearchEntity> {
  item: T;
  popup?: MapConf["popup"];
  id: string;
  t: (key: string) => string;
  /** Libellé/intention du bouton d'action (cf. MapConf.itemAction). */
  actionKind?: "profil" | "preview";
}