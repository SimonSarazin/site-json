import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/**
 * Section `articleFeed` (config-driven, data-backed) : fil d'articles d'un costum (POI `type:"article"`
 * scopés `source.key`), paginé (scroll infini), trié par date. Île client (fetch après hydratation, comme
 * agenda). Distincte des sections STATIQUES `blogList`/`blogPost` (posts figés en config). cf.
 * doc/32-module-articles-blog.md.
 */
export const ArticleFeedSectionSchema = z.object({
  type: z.literal("articleFeed"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    /** Slug du costum dont on liste les articles (scope `source.key`). Requis pour scoper le fil. */
    costumSlug: z.string(),
    /** Nombre d'articles par page (défaut 12). */
    pageSize: z.number().int().positive().optional(),
    /** Filtre serveur additionnel (ex. `{ category: "actus" }`). `type:"article"` est toujours injecté. */
    filters: z.record(z.string(), z.unknown()).optional(),
    /**
     * ⚠️ DÉPRÉCIÉ (items 2+3). Le reader d'article est CANONIQUE et unique : `/blog/:slug` (+ `/blog/id/:id`).
     * Un `articleFeed` peut être posé sur N pages mais pointe TOUJOURS vers ce reader (le retour est dynamique,
     * `navigate(-1)` — cf. ArticleReader). Toute autre valeur est ignorée (la section force `/blog`, warning dev).
     */
    detailBasePath: z.string().optional(),
    /** Afficher un article « à la une » (le plus récent) en tête. */
    featured: z.boolean().optional(),
    /**
     * Variant de carte (registre `CARD_VARIANTS`, lazy) : `default` (éditorial 16/9) · `compact` (ligne).
     * Défaut : `config.blog.defaultCardVariant` sinon `default`. Un variant inconnu retombe sur `default`.
     */
    cardVariant: z.string().optional(),
    /** Layout du fil : `grid` (défaut, grille responsive) ou `list` (liste verticale, va bien avec `compact`). */
    feedLayout: z.enum(["grid", "list"]).optional(),
  }),
});
export type ArticleFeedSectionProps = z.infer<typeof ArticleFeedSectionSchema>["props"];

/**
 * Section `articleReader` (config-driven, data-backed) : affiche UN article précis (par `slug` OU `id`) sur
 * n'importe quelle page — fetch entité (`useArticle`) + rendu via le registre `READER_VARIANTS`. À distinguer
 * du `blogPost` STATIQUE (contenu figé en config). Île client (pas de SEO propre — le canonical reste
 * `/blog/:slug`, cf. item 2). Ex. « article à la une » sur une home. cf. doc/32-module-articles-blog.md (Sections).
 */
export const ArticleReaderSectionSchema = z.object({
  type: z.literal("articleReader"),
  id: z.string().optional(),
  props: z.object({
    /** Slug de l'article à afficher. */
    slug: z.string().optional(),
    /** Id de l'article (pour les articles sans slug). */
    id: z.string().optional(),
    /** Variant de reader (registre `READER_VARIANTS`). Défaut : `config.blog.readerVariant` sinon `default`. */
    readerVariant: z.string().optional(),
    /** Afficher le lien « Retour aux articles » (défaut : non — section embarquée). */
    showBack: z.boolean().optional(),
    /** Cible du retour si `showBack` (défaut `/blog`). */
    backTo: z.string().optional(),
  }).refine((p) => Boolean(p.slug || p.id), { message: "articleReader : `slug` ou `id` requis" }),
});
export type ArticleReaderSectionProps = z.infer<typeof ArticleReaderSectionSchema>["props"];
