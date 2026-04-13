import { LocalizedString } from "@/types/locale-schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { IconName } from "lucide-react/dynamic";
import { z } from "zod";

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
    detailsMode: z.enum(["drawer", "dialog"]).default("drawer"),
    type: z.enum(["overlay", "default", "tiers-lieux", "event", "rezo-la-mer","profile","event-rezo-la-mer","poi-rezo-la-mer", "card-elts","ssbe"]).default("default"),
    variant: z.enum(["default", "tiers-lieux", "event", "rezo-la-mer","profile","event-rezo-la-mer","poi-rezo-la-mer", "card-elts","ssbe"]).optional(),
  }).partial().optional(),
  preview: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
}).partial();

export type ListConf = z.infer<typeof ListConfSchema>;


const MapConfSchema = z.object({
  initialZoom: z.number().min(1).max(20).optional(),
  cluster:     z.boolean().optional(),
  popup: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
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
]);

export type SearchType = z.infer<typeof SearchTypeSchema>;

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
    showActiveFiltersTypes: z.boolean().default(true),
    showActiveFiltersTags: z.boolean().default(true),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      showMapButton: z.boolean().default(true),
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
      notSourceKey: z.boolean().optional(),
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

const DynamicTagSelectorConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  placeholder: LocalizedString.optional(),
}).optional();

export type DynamicTagSelectorConfig = z.infer<typeof DynamicTagSelectorConfigSchema>;

const ThematicSelectorConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  placeholder: LocalizedString.optional(),
  thematics: z.array(z.string()).optional(),
}).optional();

export type ThematicSelectorConfig = z.infer<typeof ThematicSelectorConfigSchema>;

export const DEFAULT_12_THEMATICS = [
  "alimentation", "santé", "déchets", "transport",
  "éducation", "citoyenneté", "économie", "énergie",
  "culture", "environnement", "numérique", "sport",
] as const;

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
    enableGraph: z.boolean().default(false),
    graphCategories: z.array(z.string()).optional(),
    graphDetailsMode: z.enum(["drawer", "dialog", "link"]).default("drawer"),
    defaultViewMode: z.enum(["list", "map", "graph"]).optional(),
    showActiveFiltersTypes: z.boolean().default(false),
    showActiveFiltersTags: z.boolean().default(false),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    width: z.enum(["container"]).optional(),
    defaultDetailedView: z.boolean().optional(),
    addButton: AddButtonConfigSchema,
    zoneSelector: ZoneSelectorConfigSchema,
    tagSelector: TagSelectorConfigSchema,
    dynamicTagSelector: DynamicTagSelectorConfigSchema,
    thematicSelector: ThematicSelectorConfigSchema,
    csvButton: CsvButtonConfigSchema,
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      showMapButton: z.boolean().default(true),
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
      notSourceKey: z.boolean().optional(),
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
    bg: z.enum([
      "default", "card", "muted", "primary", "secondary", "accent", "transparent",
      "gradient-teal", "gradient-blue", "gradient-indigo", "gradient-cyan",
    ]).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      defaultTypes: z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      notSourceKey: z.boolean().optional(),
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

export const  ALL_THEME: Record<string, { name: string; icon: string; tags: string[] }> = {
  "alimentation" : {
      "name" : "Alimentation",
      "icon" : "fa-cutlery",
      "tags" : [ 
          "agriculture", 
          "alimentation", 
          "nourriture", 
          "AMAP"
      ]
  },
  "santé" : {
      "name" : "Santé",
      "icon" : "fa-heart-o",
      "tags" : [ 
          "santé"
      ]
  },
  "déchets" : {
      "name" : "Déchets",
      "icon" : "fa-trash-o",
      "tags" : [ 
          "déchets"
      ]
  },
  "transport" : {
      "name" : "Transport",
      "icon" : "fa-bus",
      "tags" : [ 
          "Urbanisme", 
          "transport", 
          "construction"
      ]
  },
  "éducation" : {
      "name" : "Education",
      "icon" : "fa-book",
      "tags" : [ 
          "éducation", 
          "petite enfance"
      ]
  },
  "citoyenneté" : {
      "name" : "Citoyenneté",
      "icon" : "fa-user-circle-o",
      "tags" : [ 
          "citoyen", 
          "society"
      ]
  },
  "économie" : {
      "name" : "Economie",
      "icon" : "fa-money",
      "tags" : [ 
          "ess", 
          "économie social solidaire"
      ]
  },
  "économie bleu" : {
      "name" : "Economie bleu",
      "icon" : "fa-money",
      "tags" : [ 
          "économie bleu"
      ]
  },
  "énergie" : {
      "name" : "Energie",
      "icon" : "fa-sun-o",
      "tags" : [ 
          "énergie", 
          "climat"
      ]
  },
  "culture" : {
      "name" : "Culture",
      "icon" : "fa-universal-access",
      "tags" : [ 
          "culture", 
          "animation"
      ]
  },
  "environnement" : {
      "name" : "Environnement",
      "icon" : "fa-tree",
      "tags" : [ 
          "environnement", 
          "biodiversité", 
          "écologie"
      ]
  },
  "numérique" : {
      "name" : "Numerique",
      "icon" : "fa-laptop",
      "tags" : [ 
          "informatique", 
          "tic", 
          "internet", 
          "web",
          "numérique"
      ]
  },
  "sport" : {
      "name" : "Sport",
      "icon" : "fa-futbol-o",
      "tags" : [ 
          "sport"
      ]
  },
  "tiers lieux" : {
      "name" : "Tiers lieux",
      "icon" : "fa-globe",
      "tags" : [
          "TiersLieux"
      ]
  },
  "pacte" : {
      "name" : "Pact",
      "icon" : "fa-hand-o-up",
      "tags" : [
          "pacte"
      ]
  },
  "associations" : {
      "name" : "Associations",
      "icon" : "fa-chain",
      "tags" : [
          "associations"
      ]
  },
  "innovation" : {
      "name" : "Innovation",
      "icon" : "fa-lightbulb-o",
      "tags" : [
          "Innovation"
      ]
  },
  "ess" : {
      "name" : "ESS",
      "icon" : "fa-leaf",
      "tags" : [
          "ess"
      ]
  },
  "océan" : {
      "name" : "Ocean",
      "icon" : "fa-anchor",
      "tags" : [
          "océan"
      ]
  }
};

// Thematics: Section pour afficher les filières de manière dynamique
export const ThematicsSectionSchema = z.object({
  type: z.literal("thematics"),
  id: z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
    emptyMessage: LocalizedString.optional(),
    filterHref: z.string().optional(),
  }),
});

export type ThematicsSection = z.infer<typeof ThematicsSectionSchema>;
export type ThematicsSectionProps = z.infer<typeof ThematicsSectionSchema>["props"]


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
}

export interface SearchMapWrapperProps<T extends SearchEntity = SearchEntity> {
  results: T[];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
}

export interface SearchMapProps<T extends SearchEntity = SearchEntity> {
  results: T[];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
}

export interface MapPopupProps<T extends SearchEntity = SearchEntity> {
  item: T;
  popup?: MapConf["popup"];
  id: string;
  t: (key: string) => string;
}