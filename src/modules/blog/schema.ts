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
    /**
     * Article « à la une » en tête du fil :
     *  - `true` — le PLUS RÉCENT (comportement historique, automatique) ;
     *  - `"flag"` — la fiche portant `featured: true` en base (épinglage ÉDITORIAL, posé par
     *    l'action admin `setFeatured`/`exclusiveField`), repli sur le plus récent si aucune.
     *    Robuste par construction : une SEULE liste (rien n'est exclu côté serveur, un
     *    double-flag résiduel ne fait perdre aucun article), l'épinglée est cherchée par une
     *    micro-requête serveur dédiée (`{featured:true}`, 1 résultat) — pas dans la fenêtre
     *    chargée — et dédupliquée du fil par id. Décision review MR 44 (option B, 2026-08-21).
     */
    featured: z.union([z.boolean(), z.literal("flag")]).optional(),
    /**
     * Variant de carte (registre `CARD_VARIANTS`, lazy) : `default` (éditorial 16/9) · `compact` (ligne).
     * Défaut : `config.blog.defaultCardVariant` sinon `default`. Un variant inconnu retombe sur `default`.
     */
    cardVariant: z.string().optional(),
    /** Layout du fil : `grid` (défaut, grille responsive) ou `list` (liste verticale, va bien avec `compact`). */
    feedLayout: z.enum(["grid", "list"]).optional(),
    /**
     * Élargit le fil à la pleine largeur (`max-w-[1536px]` + 4ᵉ colonne en xl), pour aligner une page
     * `layout:"fullwidth"` sur searchProStatic/agenda. Défaut `false` → `max-w-6xl` (largeur lecture
     * « magazine », comportement historique partagé par tous les costums).
     */
    fullWidth: z.boolean().optional(),
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

/**
 * Section `articleTeaser` (config-driven, data-backed) : aperçu FIGÉ des N derniers articles d'un costum
 * (POI `type:"article"`, scope `source.key`) — titre en badge incliné, grille de cartes à bouton, CTA
 * « voir tout » en pied. Même patron d'île client que `articleFeed` (réutilise `useArticleFeed`), mais SANS
 * pagination — pensé pour être posé entre deux autres sections (ex. sous `map-bubbles`), pas comme page
 * `/blog` à part entière (→ `articleFeed`). Fond/accent `background`/`accentColor` : MÊME mécanisme que
 * `featured-carousel` (`search/schema.ts`) — couleurs FIXES config-driven, indépendantes du mode clair/sombre
 * (cf. `FeaturedCarouselSection` : « fond fixe → texte blanc fixe, jamais `text-foreground` qui s'inverserait
 * en mode clair »), pour que ce bloc et le carrousel « à la une » restent visuellement de la même famille.
 * cf. doc/32-module-articles-blog.md.
 */
export const ArticleTeaserSectionSchema = z.object({
  type: z.literal("articleTeaser"),
  id: z.string().optional(),
  props: z.object({
    /** Titre affiché en badge incliné (ex. « Zoom sur le réseau »). */
    headline: LocalizedString,
    /** Slug du costum dont on liste les articles (scope `source.key`). Requis pour scoper le fil. */
    costumSlug: z.string(),
    /** Nombre d'articles affichés (défaut 6, pas de pagination). */
    limit: z.number().int().positive().optional(),
    /** Filtre serveur additionnel (ex. `{ category: "actus" }`). `type:"article"` est toujours injecté. */
    filters: z.record(z.string(), z.unknown()).optional(),
    /** Cible du bouton « voir tout » en pied de grille (défaut `/blog`). */
    viewAllHref: z.string().optional(),
    /** Libellé du bouton « voir tout » (défaut i18n `teaser.viewAll`). */
    viewAllLabel: LocalizedString.optional(),
    /** Libellé du bouton par carte (défaut i18n `teaser.cta`). */
    itemCtaLabel: LocalizedString.optional(),
    /** Couleur de fond FIXE (hex), ex. `#2c3e50` — sans valeur, repli sur `bg-foreground`/`text-background` (thème). */
    background: z.string().optional(),
    /** Couleur d'accent FIXE (hex) du badge/boutons, ex. `#4ecdc4` — sans valeur, repli sur `primary` (thème). */
    accentColor: z.string().optional(),
  }),
});
export type ArticleTeaserSectionProps = z.infer<typeof ArticleTeaserSectionSchema>["props"];
