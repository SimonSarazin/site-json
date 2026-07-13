# Module Articles / Blog — Documentation

> Doc détaillée : [`doc/32-module-articles-blog.md`](../../../doc/32-module-articles-blog.md)

## Vue d'ensemble

Module **piloté par les données** : un article **est un POI `type:"article"`** scopé à un costum
(`source.key`), typiquement issu d'une migration WordPress. Tout passe par `entity.searchCostum` via
`buildSearchPayload` (jamais de payload bespoke) — aligné sur le module **search**.

**Deux façades** :
- **Sections config-driven** — `articleFeed` (fil paginé, île client) · `articleReader` (un article dans une
  page). Distinctes des sections **statiques** `blogList` / `blogPost` (contenu figé en config).
- **Routes reader (SSR + SEO)** — `/blog/:slug` · `/blog/id/:id` (~82 % d'articles sans slug). La **liste**
  `/blog` est une **page de config** portant une section `articleFeed`.

## Architecture

- `module.config.ts` — **`type:"core"`** obligatoire (a un `routes.tsx`).
- `routes.tsx` + `pages/ArticlePage.tsx` — reader (variant + canonical `getServerUrl` + SEO JSON-LD + articles liés).
- `sections/` — `ArticleFeed` · `ArticleReaderSection`. `schema.ts` — leurs schémas zod.
- `hooks/` — `useArticleFeed` (fil, lit les PageFilters) · `useArticle` (slug|id) · `useRelatedArticles`.
- `variants/` — `CARD_VARIANTS {default, compact}` · `READER_VARIANTS {default}` (lazy **vite-preload**, extensibles).
- `server/feed.ts` — flux RSS `/blog/feed.xml`. `commands/register.tsx` — palette Cmd+K. `BlogArticleSeo.tsx` — SEO.
- `configSchema.ts` — `config.blog` (variants par défaut + `feedCostumSlug`).

## Config minimale (section fil)

```json
{ "type": "articleFeed", "props": {
  "costumSlug": "monCostum", "pageSize": 12,
  "cardVariant": "default", "feedLayout": "grid" } }
```

## Pièges (détaillés dans la doc)

- Module **`type:"core"`** (un `optional` casse l'hydratation/navigation app-wide).
- SEO SSR : **`getServerUrl()`** (pas `window.location`) ; JSON-LD en **`<script>` direct** (Helmet n'injecte pas les scripts au SSR).
- Variants : `lazy` de **`vite-preload`** en import statique direct (pas `React.lazy`, pas d'indirection → sinon chunk non tracé).
- Île client : le fil ne prefetch **pas** ses données en SSR (tri `created` déterministe) ; le reader prefetch l'article (SEO).
- Imports depuis **`react-router`** (v7), jamais `react-router-dom`.
- **Visibilité/validation** (masquer les articles en attente) = gate central `buildSearchPayload`, cf. [`doc/19-visibility-system.md`](../../../doc/19-visibility-system.md).

Voir [`doc/32-module-articles-blog.md`](../../../doc/32-module-articles-blog.md) pour la référence complète.
