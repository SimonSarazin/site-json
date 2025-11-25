import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/**
 * Schemas Zod pour les sections News
 */

// Section News pour affichage dans d'autres modules
export const NewsSectionSchema = z.object({
  type: z.literal("news"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    entitySlug: z.string().optional(),
    maxItems: z.number().positive().optional().default(10),
    showAddButton: z.boolean().optional().default(true),
    showFilters: z.boolean().optional().default(false),
    showComments: z.boolean().optional().default(true),
    showReactions: z.boolean().optional().default(true),
  }),
});

export type NewsSection = z.infer<typeof NewsSectionSchema>;

// Configuration du module News
export const NewsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxFileSize: z.number().positive().default(10 * 1024 * 1024), // 10MB
  allowedFileTypes: z.array(z.string()).default(["image/jpeg", "image/png", "image/webp"]),
  maxImages: z.number().positive().default(5),
  maxTextLength: z.number().positive().default(2000),
  enableReactions: z.boolean().default(true),
  enableComments: z.boolean().default(true),
  enableSharing: z.boolean().default(true),
  moderationEnabled: z.boolean().default(false),
});

export type NewsConfig = z.infer<typeof NewsConfigSchema>;