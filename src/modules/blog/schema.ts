import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

/**
 * Section `articleFeed` (config-driven, data-backed) : fil d'articles d'un costum (POI `type:"article"`
 * scopés `source.key`), paginé (scroll infini), trié par date. Île client (fetch après hydratation, comme
 * agenda). Distincte des sections STATIQUES `blogList`/`blogPost` (posts figés en config). cf.
 * docs/module-articles-blog.md.
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
    /** Base de l'URL de détail (défaut `/blog`). Le reader vit à `<base>/:slug` (+ `<base>/id/:id`). */
    detailBasePath: z.string().optional(),
    /** Afficher un article « à la une » (le plus récent) en tête. */
    featured: z.boolean().optional(),
  }),
});
export type ArticleFeedSectionProps = z.infer<typeof ArticleFeedSectionSchema>["props"];
