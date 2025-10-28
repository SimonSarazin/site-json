import { LocalizedString } from "@/types/locale-schema";
import type { Organization, Poi, Project, User, Event as EventType } from "@communecter/cocolight-api-client";
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
    detailsMode: z.enum(["drawer", "dialog"]).default("drawer"),
    type: z.enum(["overlay", "default", "tiers-lieux", "event"]).default("default"),
    variant: z.enum(["default", "tiers-lieux", "event"]).optional(),
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
      notSourceKey: z.boolean().optional()
    }).optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
  }),
});

export type SearchProSection = z.infer<typeof SearchProSectionSchema>;
export type SearchProSectionProps = z.infer<typeof SearchProSectionSchema>["props"]

// SearchProStatic: Version sans synchronisation URL pour affichage multiple par page
export const SearchProStaticSectionSchema = z.object({
  type: z.literal("searchProStatic"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString.optional(),
    useFilter:   z.boolean().default(false),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    showActiveFiltersTypes: z.boolean().default(false),
    showActiveFiltersTags: z.boolean().default(false),
    disableInfiniteScroll: z.boolean().optional(),
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
      notSourceKey: z.boolean().optional()
    }).optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
  }),
});

export type SearchProStaticSection = z.infer<typeof SearchProStaticSectionSchema>;
export type SearchProStaticSectionProps = z.infer<typeof SearchProStaticSectionSchema>["props"]

export type SearchEntity = User | Organization | Project | EventType | Poi;

export interface SearchResultPage<T extends SearchEntity = SearchEntity> {
  count?: Record<string, number>;
  /** Tableau de résultats (mélange possible) */
  results: T[];
  pageNumber: number;
  hasNext: boolean;
  next: () => Promise<SearchResultPage<T>>;
}


export interface SearchListViewProps<T extends SearchEntity = SearchEntity> {
  results: T[];
  columns?: ListConf["columns"];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
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