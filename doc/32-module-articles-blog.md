[← Retour à l'index](README.md)

# Module Articles / Blog

> Voir aussi : [`src/modules/blog/README.md`](../src/modules/blog/README.md) (résumé), [Module Search](07-module-search.md), [Système de visibilité](19-visibility-system.md).

## Vue d'ensemble

Module **piloté par les données** : un article **est un POI `type:"article"`** scopé à un costum via
`source.key` (pas de collection dédiée). Les articles proviennent typiquement d'une migration WordPress
(`source.originUrl` conservé). Le module expose **deux façades** :

- **Sections config-driven** (posables sur n'importe quelle page) :
  - `articleFeed` — fil paginé (scroll infini), trié par date, **île client** (fetch après hydratation, comme agenda) ;
  - `articleReader` — affiche **un** article précis (par `slug` ou `id`) au sein d'une page.
  - ⚠️ À distinguer des sections **statiques** `blogList` / `blogPost` (contenu figé en config, sans backend).
- **Routes reader** (SSR + SEO) :
  - `/blog/:slug` — reader d'un article slugué (~18 % des articles) ;
  - `/blog/id/:id` — reader des ~82 % d'articles **sans slug** ;
  - la **liste** `/blog` n'est pas une route du module : c'est une **page de config** portant une section `articleFeed`.

## Arborescence

```
src/modules/blog/
├── module.config.ts        # type:"core" OBLIGATOIRE (a un routes.tsx ; "optional" casserait l'hydratation app-wide)
├── routes.tsx              # /blog/:slug + /blog/id/:id  → ArticlePage (+ loaders prefetch SSR)
├── schema.ts               # ArticleFeedSectionSchema · ArticleReaderSectionSchema (zod)
├── configSchema.ts         # BlogConfigSchema (config.blog top-level : variants + feedCostumSlug)
├── pages/ArticlePage.tsx   # reader (route) : variant + canonical + SEO + articles liés
├── sections/
│   ├── ArticleFeed.tsx           # section `articleFeed`
│   └── ArticleReaderSection.tsx  # section `articleReader`
├── hooks/
│   ├── useArticleFeed.ts    # fil (useSearchQuery → searchCostum), lit les PageFilters
│   ├── useArticle.ts        # 1 article : par slug (entityBySlug) OU id (api.poi)
│   └── useRelatedArticles.ts# articles liés (mêmes tags, même costum)
├── components/
│   ├── ArticleCard.tsx · ArticleCardCompact.tsx  # variants de carte
│   ├── ArticleReader.tsx                         # variant de reader (default)
│   └── RelatedArticles.tsx                        # bas du reader
├── variants/
│   ├── registry.ts          # makeVariantRegistry (lazy vite-preload + .preload())
│   ├── cards.ts             # CARD_VARIANTS { default, compact }
│   └── readers.ts           # READER_VARIANTS { default }
├── lib/
│   ├── markdown.ts          # stripMarkdown
│   └── readingTime.ts       # estimateReadingTime (≈200 mots/min)
├── server/feed.ts           # renderBlogFeed → flux RSS 2.0 (/blog/feed.xml)
├── commands/register.tsx    # source palette Cmd+K « Articles » (blog:articles)
├── prefetch/prefetchArticle.ts  # prefetch SSR par slug / id
├── constants/queryKeys.ts   # BLOG_QUERY_KEYS
├── BlogArticleSeo.tsx       # JSON-LD BlogPosting + balises article:* (SSR)
└── i18n/{fr,en}.json        # namespace `modules/blog`
```

## Modèle de données (`ArticleData`)

Champs utiles d'un POI `type:"article"` (cf. `hooks/useArticle.ts`) :

| Champ | Rôle |
|---|---|
| `name` | titre |
| `description` | corps **markdown** (rendu par `ArticleReader`) |
| `shortDescription` | **extrait** édité (chapô des cartes / RSS ; sinon dérivé de `description`) |
| `profilImageUrl` / `profilMediumImageUrl` | image de couverture (16/9) |
| `created` / `updated` | dates (secondes epoch) — tri du fil = `created` DESC |
| `tags` | tags (filtrage + articles liés) |
| `slug` | slug (absent pour ~82 % → reader par id) |
| `source.key` | **costum de rattachement** (scope du fil) |
| `source.originUrl` | URL WordPress d'origine (migration) |

## Sources de données

Tout passe par **`entity.searchCostum`** (moteur générique) via **`buildSearchPayload`** — jamais de payload
bespoke. Trois hooks :

- **`useArticleFeed(costumSlug, …)`** — fil paginé. Passe par `useSearchQuery` ; lit les **PageFilters**
  (`searchText` / `searchTags` / `searchByFields`) comme `SearchProStatic`, donc **réutilise `PageFilters` +
  `searchHeader`** du module search pour filtrer/facetter. `defaultFilters` force `type:"article"` en dernier
  (immuable), scope `sourceKey:[costumSlug]`, tri `created:-1`. **Île client** (`enabled: hydrated`).
- **`useArticle({slug,id})`** — un article : `slug` prioritaire → `entityBySlug` ; sinon `api.poi({id})`.
  Normalise `serverData` (instance) ou JSON déshydraté.
- **`useRelatedArticles(article)`** — mêmes tags (`$in`), **même costum** (`source.key`), exclut l'article
  courant, île client gated (`hydrated && tags.length > 0`).

## Routes, SSR & SEO

- `routes.tsx` : deux routes vers `ArticlePage`, avec **loaders de prefetch SSR** (`prefetchArticleBySlug` /
  `prefetchArticleById`) **best-effort** (un échec ne casse pas le rendu → fallback client).
- `ArticlePage` :
  - choisit le variant de reader (`READER_VARIANTS.get(config.blog?.readerVariant)`) ;
  - **canonical / `og:url`** construits avec **`getServerUrl()`** (env) — marche en SSR **et** client (contrairement
    à `window.location`, vide au SSR). Le **slug est prioritaire** → un article slugué ouvert par `/blog/id/:id`
    canonicalise vers `/blog/:slug` (anti duplicate-content) ;
  - `BlogArticleSeo` : **JSON-LD `BlogPosting`** enrichi (`articleBody` borné, `wordCount`, `dateModified`,
    `keywords`, `publisher`) + `article:published_time` / `modified_time`. ⚠️ Le JSON-LD est rendu dans un
    **`<script>` DIRECT** (Helmet **n'injecte pas** ses `<script>` en SSR) avec échappement `<`→`<` ;
  - `RelatedArticles` en bas.

## Sections (`schema.ts`)

### `articleFeed`

```json
{ "type": "articleFeed", "props": {
  "costumSlug": "monCostum",          // REQUIS (scope source.key)
  "title": { "fr": "Actualités" },
  "pageSize": 12,
  "filters": { "category": "actus" }, // filtre serveur additionnel (type:"article" toujours injecté)
  "featured": true,                    // article « à la une » (le plus récent) en tête
  "cardVariant": "compact",            // registre CARD_VARIANTS ; défaut config.blog.defaultCardVariant sinon "default"
  "feedLayout": "list"                 // "grid" (défaut) | "list"
} }
```
`detailBasePath` est **déprécié** (le reader est canonique `/blog/:slug` ; toute autre valeur est ignorée, warning dev).

### `articleReader`

```json
{ "type": "articleReader", "props": {
  "slug": "mon-article",   // OU "id": "<poiId>"  (l'un des deux requis)
  "readerVariant": "default",
  "showBack": false,        // lien « Retour aux articles »
  "backTo": "/blog"
} }
```
Île client, **pas de SEO propre** (le canonical reste `/blog/:slug`). Ex. « article à la une » sur une home.

## Variants extensibles

`makeVariantRegistry` (`variants/registry.ts`) indexe des composants **`lazy` de `vite-preload`**
(`PreloadableComponent`) : chunk code-splitté **tracé par le plugin** (→ `<link modulepreload>` en SSR,
`preloadAll`) **et** méthode `.preload()` (préchauffe au survol). `get(key)` retombe **toujours** sur `default`.

- `CARD_VARIANTS` — `default` (carte éditoriale 16/9) · `compact` (ligne).
- `READER_VARIANTS` — `default` (reader éditorial). Extensible.

⚠️ Déclarer les variants `lazy(() => import("chemin/statique"))` **directement** dans `cards.ts` / `readers.ts`
(jamais via une indirection/variable, sinon `vite-preload` ne trace pas le chunk — même piège que `lazyNamed`).

## Config site-level `config.blog` (`configSchema.ts`)

```json
{ "blog": {
  "readerVariant": "default",       // variant de reader (route)
  "defaultCardVariant": "default",  // défaut des sections articleFeed
  "defaultFeedLayout": "grid",      // "grid" | "list"
  "feedCostumSlug": "monCostum"     // costum du flux RSS /blog/feed.xml (sinon 400, sauf ?costum=)
} }
```

## Visibilité / validation

Les surfaces **publiques** scopées costum (fil, articles liés, palette, RSS) **masquent les articles EN ATTENTE
de validation** (`preferences.toBeValidated` / `source.toBeValidated`). Ce n'est **pas** codé dans le module :
c'est le **gate central `applyValidationGate`** de `buildSearchPayload` (actif par défaut dès qu'un costum est
scopé). Le backend Node applique le même filtre nativement (byte-parité legacy). Détails, garde-fous et modèle
complet (state / private / toBeValidated) : **[Système de visibilité → Visibilité des données](19-visibility-system.md#visibilité-des-données-recherchevalidation)**.

## Flux RSS

`server/feed.ts` → `renderBlogFeed({costumSlug, …})` réutilise le pipeline du fil (`initApi` +
`buildSearchPayload` + `searchCostum`) **hors React**, et rend un **RSS 2.0** (échappement XML). Route
`/blog/feed.xml` servie par `server/dev-server.js` (dev, `ssrLoadModule`) et `server/prod-server.js`
(prod, via ré-export `entry-server`). `costumSlug` résolu : `?costum=` > `config.blog.feedCostumSlug` > `VITE_FEED_COSTUM_SLUG`.
⚠️ Route enregistrée **au démarrage** → redémarrer le serveur pour la tester.

## Command palette (Cmd+K)

`commands/register.tsx` enregistre la source `blog:articles` (config `commandPalette.articleSearch :
{ enabled?, costumSlug (requis), limit? }`) : recherche d'articles → navigation vers le reader `/blog/:slug`
(ou `/blog/id/:id`). Base forcée `/blog` (anti open-redirect).

## i18n

Namespace `modules/blog` (`i18n/{fr,en}.json`), chargé en side-effect (`import "../i18n"`).

## Pièges et leçons

- **`type:"core"` obligatoire** (`module.config.ts`) : le module a un `routes.tsx` ; le passer `optional`
  bascule TOUTE la construction de routes en async → régression d'hydratation app-wide.
- **SEO SSR** : `getServerUrl()`, **jamais** `window.location` (vide au SSR). JSON-LD en **`<script>` direct**
  (Helmet n'injecte pas les scripts au SSR).
- **Variants** : `lazy` de **`vite-preload`** en import statique direct (pas `React.lazy`, pas d'indirection).
- **Île client** : le fil ne fait **pas** de prefetch SSR de ses données (tri `created` déterministe → OK,
  contrairement à l'agenda `now`-relatif). Le reader, lui, prefetch l'article (SEO).
- **Imports** : `Link` / `useParams` depuis **`react-router`** (v7), jamais `react-router-dom`.
- **Réutiliser search** : filtrer/facetter le fil = `PageFilters` + `searchHeader` du module search (config-driven
  par champ), pas de bespoke.

## Réutilisations (unité avec les autres modules)

- **Search** : `buildSearchPayload` / `useSearchQuery` / `PageFilters` / `searchHeader` (fil + filtres).
- **Agenda** : même patron d'**île client** config-driven + registre de variants + teaser.
- **formEngine** : le costum form du POI `article` déclare les champs éditables (`name`,
  `shortDescription`, `description` markdown, `profil_avatar`, `tags`).
