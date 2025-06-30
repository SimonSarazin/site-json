
import { LocalizedString } from "@/types/locale-schema";
import { z } from "zod";

//──────────────── Search Pro Section
const TagsFilter = z.object({
  type: z.literal("tags"),
  name: LocalizedString.or(z.string()),
  list: z.array(LocalizedString.or(z.string()))
         .or(z.record(LocalizedString.or(z.string()))),
});

const ListConf = z.object({
  columns: z.object({
    lg: z.number().int().min(1).max(6).optional(),
    md: z.number().int().min(1).max(6).optional(),
    sm: z.number().int().min(1).max(6).optional(),
  }).partial().optional(),
  card: z.object({
    tagLimit:        z.number().int().min(1).max(50).optional(),
    showDescription: z.boolean().optional(),
    shareButton:     z.boolean().optional(),
  }).partial().optional(),
}).partial();

const MapConf = z.object({
  initialZoom: z.number().min(1).max(20).optional(),
  cluster:     z.boolean().optional(),
}).partial();

export const SearchProSection = z.object({
  type: z.literal("searchPro"),
  id:   z.string().optional(),

  props: z.object({
    placeholder: LocalizedString,
    useFilter:   z.boolean().default(true),
    showMap:     z.boolean().default(false),

    filters: z.record(TagsFilter).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      indexStepMap:  z.number().optional(),
      defaultTypes:  z.array(z.string()).optional(),
      defaultTags:   z.array(z.string()).optional(),
    }).optional(),

    list: ListConf.optional(),
    map:  MapConf.optional(),
  }),
});
