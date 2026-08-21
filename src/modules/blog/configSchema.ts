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
  /**
   * Filtres serveur appliqués à TOUTE surface PUBLIQUE du module qui n'a pas de `filters` propre :
   * palette ⌘K (`blog:articles`), flux RSS `/blog/feed.xml` et bloc « Articles liés » du reader.
   * Typiquement `{ "publicationStatus": "Publié" }` — sans quoi ces trois canaux distribuent les
   * brouillons et les archives que les sections `articleFeed` excluent via `props.filters`.
   * `type: "article"` reste posé par le module et n'est jamais surchargeable.
   * ⚠️ La config n'est jamais parsée par Zod au runtime : la clé doit être écrite EXPLICITEMENT.
   */
  publicFilters: z.record(z.string(), z.unknown()).optional(),
  /**
   * Chronologie des surfaces PUBLIQUES sans `sortBy` propre (palette ⌘K, flux RSS, articles liés).
   * Les sections `articleFeed` gardent leur `props.sortBy`. Typiquement `{ "publicationDate": -1 }`
   * pour que le flux et la palette racontent la même chronologie que le fil du site — sinon ces
   * surfaces trient par date de SAISIE (`created`) pendant que le site trie par date éditoriale.
   */
  publicSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
});
export type BlogConfig = z.infer<typeof BlogConfigSchema>;
