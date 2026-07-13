import { z } from "zod";

/**
 * Config site-level du blog (`config.blog`, top-level optionnel) — défauts des variants extensibles (item 10).
 * Les sections `articleFeed` peuvent surcharger `cardVariant`/`feedLayout` ; le reader (route, pas une section)
 * lit son variant ICI. Absent → tous les défauts (`default` / `grid`).
 */
export const BlogConfigSchema = z.object({
  /** Variant de reader (registre `READER_VARIANTS`), lu par `ArticlePage`. Défaut : `default`. */
  readerVariant: z.string().optional(),
  /** Variant de carte par défaut si une section `articleFeed` ne le précise pas. Défaut : `default`. */
  defaultCardVariant: z.string().optional(),
  /** Layout de fil par défaut si une section ne le précise pas. Défaut : `grid`. */
  defaultFeedLayout: z.enum(["grid", "list"]).optional(),
  /** Costum du flux RSS `/blog/feed.xml` (scope `source.key`). Sans lui, le flux répond 400 (sauf `?costum=`). */
  feedCostumSlug: z.string().optional(),
});
export type BlogConfig = z.infer<typeof BlogConfigSchema>;
