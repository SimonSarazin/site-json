[← Retour à l'index](README.md)

# Module Articles / Blog

> Voir aussi : [`src/modules/blog/README.md`](../src/modules/blog/README.md) (résumé), [Module Search](07-module-search.md), [Système de visibilité](19-visibility-system.md).

## Vue d'ensemble

Module **piloté par les données** : un article **est un POI `type:"article"`** scopé à un costum via
`source.key` (pas de collection dédiée). Les articles proviennent typiquement d'une migration WordPress
(`source.originUrl` conservé). Le module expose **deux façades** :

- **Sections config-driven** (posables sur n'importe quelle page) :
  - `articleFeed` — fil paginé (scroll infini), trié par date, **île client** (fetch après hydratation, comme agenda) ;
  - `articleReader` — affiche **un** article précis (par `slug` ou `id`) au sein d'une page ;
  - `articleTeaser` — aperçu **figé** des N derniers articles (défaut 6, pas de pagination), titre en badge
    incliné, grille de cartes à bouton, CTA « voir tout » en pied — patron **teaser** (cf. agenda), pensé pour
    être posé entre deux autres sections plutôt que comme page `/blog` à part entière.
  - ⚠️ À distinguer des sections **statiques** `blogList` / `blogPost` (contenu figé en config, sans backend).
- **Routes reader** (SSR + SEO) :
  - `/blog/:slug` — reader d'un article slugué (~18 % des articles) ;
  - `/blog/id/:id` — reader des ~82 % d'articles **sans slug** ;
  - la **liste** `/blog` n'est pas une route du module : c'est une **page de config** portant une section `articleFeed`.
- **Trois voies mènent au reader** : la section `articleFeed`, la source de palette `blog:articles`, et — depuis une liste de recherche — une règle `list.itemRules` portant `itemAction: {kind: "link", to: "/blog/:slug", toById: "/blog/id/:id"}` (cf. [doc/07](07-module-search.md#rendu-par-item-des-listes-hétérogènes-listitemrules)). C'est ainsi qu'un POI `type:"article"` remonté par la recherche globale ouvre l'article au lieu d'un drawer générique.
  ⚠️ Contrairement à `detailBasePath` (déprécié, gardé contre l'open-redirect), `itemAction.to` accepte **n'importe quel gabarit sans garde** : n'y placer aucune URL dérivée d'une donnée utilisateur. `audit:config` contrôle en revanche que la route ciblée existe.

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
│   ├── ArticleReaderSection.tsx  # section `articleReader`
│   └── ArticleTeaser.tsx         # section `articleTeaser` (aperçu figé N derniers, sans pagination)
├── hooks/
│   ├── useArticleFeed.ts    # fil (useSearchQuery → searchCostum), lit les PageFilters
│   ├── useArticle.ts        # 1 article : par slug (entityBySlug) OU id (api.poi)
│   └── useRelatedArticles.ts# articles liés (mêmes tags, même costum)
├── components/
│   ├── ArticleCard.tsx · ArticleCardCompact.tsx  # variants de carte
│   ├── ArticleReader.tsx                         # variant de reader (default)
│   ├── ArticleGallery.tsx                        # galerie d'images de l'article (about.images contentKey=slider → GalleryGrid + lightbox)
│   ├── ArticleDocuments.tsx                      # documents/fichiers joints (about.files objet keyé _id → FilesList, téléchargement)
│   └── RelatedArticles.tsx                        # bas du reader
├── variants/
│   ├── registry.ts          # makeVariantRegistry (lazy vite-preload + .preload())
│   ├── cards.ts             # CARD_VARIANTS { default, compact }
│   └── readers.ts           # READER_VARIANTS { default }
├── lib/
│   ├── markdown.ts          # stripMarkdown
│   ├── readingTime.ts       # estimateReadingTime (≈200 mots/min)
│   └── articleLink.ts       # normalizeArticleResult / articleHref (résolution /blog/:slug ou /blog/id/:id) — partagé articleFeed + articleTeaser
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

## Édition : le costum form `parent62-article`

Un article s'édite via un **costum form config-driven** déclaré dans `config.prod.parent62.json` sous
`costumForms.parent62-article` (`entityType/collection:"poi"`, `costumSlug:"parent62"`, `layout.kind:"flat"`).
Le POI est **typé à la création** par `mutation.inject.extraFields.type:"article"`. Exemple concret de
**personnalisation d'un costum form** pour l'article (les widgets `gallery`/`file` + affichage sont déjà décrits
côté composants — voir `ArticleGallery` / `ArticleDocuments`) :

**Sections & champs.** Deux sections : `content` (`name`, `shortDescription`, `description` markdown,
`profil_avatar`, `galerie`, `documents`, `tags`) et `taxo` (`territoires`, `publics`, `themes`).

**Champs obligatoires** (`required:true`) : `name`, `description`, **et les 3 taxonomies** `territoires` /
`publics` / `themes` (au moins un choix — `zodGen` traite `isEmpty([])` comme vide, donc un multiselect vide
échoue la validation).

**Territoire en choix UNIQUE.** `territoires` passe de `multiselect` (`string[]`) à **`widget:"select"`**
(sans `multiple`) → valeur **`string`** (un seul territoire). `publics` / `themes` restent `multiselect`
(`string[]`). Même `FormFieldSelectObject`, seul le flag `multiple` distingue les deux modes du form engine.

**Widget adresse RETIRÉ.** Un article n'a pas d'adresse : suppression du champ `location` (`address`) + des
5 champs cachés (`addressCountry`, `addressLocality`, `postalCode`, `streetAddress`, `localityId`) + de la
section `location` + de `serializeGroups.address` (→ `serializeGroups:{}`).

**CREATE reste sur l'admin.** Le form n'est ouvert que **depuis l'admin** (`admin.tabs[2].sections[0]`), donc
`mutation.navigateOnSuccess:false` (plus de redirection vers `/profil/{slug}` au succès) + la table admin est
**rafraîchie** : `mutation.invalidateFn.params.searchKeys` = `["blog:parent62", "admin-poi"]` — `admin-poi`
invalide la requête de la table admin (`useSearchQuery` `queryKeyPrefix = ADMIN_QUERY_KEYS.RESOURCE_PREFIX('poi')`),
donc le nouvel article apparaît immédiatement dans la liste (create **et** edit), en plus du fil blog.

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
  "feedLayout": "list",                // "grid" (défaut) | "list"
  "fullWidth": true                    // élargit le fil : max-w-[1536px] + 4ᵉ colonne xl (xl:grid-cols-4) ; défaut false → max-w-6xl
} }
```
`fullWidth` (`z.boolean().optional()` sur `ArticleFeedSectionSchema.props`) élargit le conteneur externe de
`max-w-6xl` à `max-w-[1536px]` (les **deux** layouts) et, en `feedLayout:"grid"` uniquement, ajoute une 4ᵉ colonne
en xl (`xl:grid-cols-4`) — le layout `list` (`flex flex-col gap-4`) n'est pas affecté par ce changement de colonnes.
But : aligner une page blog avec les pages `layout:"fullwidth"` de searchProStatic/agenda. Comme toute clé de config,
`.optional()` n'a **pas** de défaut runtime (config jamais parsée par Zod) → il faut écrire explicitement `"fullWidth": true`.

`detailBasePath` est **déprécié** (le reader est canonique `/blog/:slug` ; toute autre valeur est ignorée, warning dev).

### `articleTeaser`

```json
{ "type": "articleTeaser", "props": {
  "costumSlug": "monCostum",              // REQUIS (scope source.key)
  "headline": { "fr": "Zoom sur le réseau" }, // REQUIS — titre en badge incliné
  "limit": 6,                              // nb d'articles affichés, défaut 6, PAS de pagination
  "filters": { "category": "actus" },      // filtre serveur additionnel (type:"article" toujours injecté)
  "viewAllHref": "/blog",                  // cible du CTA « voir tout » en pied de grille (défaut /blog)
  "viewAllLabel": { "fr": "En voir plus" }, // défaut i18n teaser.viewAll
  "itemCtaLabel": { "fr": "En savoir plus" }, // défaut i18n teaser.cta, bouton par carte
  "background": "#2c3e50",                 // fond FIXE (hex), défaut : repli bg-foreground/text-background (thème)
  "accentColor": "#4ecdc4"                 // accent FIXE (hex) badge + boutons, défaut : repli primary (thème)
} }
```
Aperçu **figé** (pas de scroll infini/« charger plus ») des `limit` derniers articles d'un costum, triés
`created` décroissant (réutilise `useArticleFeed`, tronqué côté client). Pensé pour être posé **entre deux
sections** d'une page existante (ex. juste sous `map-bubbles`), contrairement à `articleFeed` qui sert
typiquement de section unique d'une page `/blog` dédiée. Chaque carte pointe vers son article
(`/blog/:slug` ou `/blog/id/:id`, même résolution que `articleFeed` via `lib/articleLink.ts`) ; le bouton du
bas pointe vers `viewAllHref`. Carte propre à cette section (pas dans le registre `CARD_VARIANTS` : contrat
de props différent — pas de `featured`/`lastRef` de pagination). `background`/`accentColor` reprennent
**exactement** le mécanisme de `featured-carousel` (`modules/search/schema.ts` — cf. « carrousel à la une »,
posé juste au-dessus sur la home parent62) : couleurs FIXES config-driven, indépendantes du mode clair/sombre
du site, pour que les deux blocs restent visuellement de la même famille.

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

- `CARD_VARIANTS` — `default` (carte éditoriale 16/9) · `compact` (ligne) · `poster` (`ArticleCardPoster` :
  affiches/flyers, image **entière** `object-contain` sur fond flou tiré de la même URL, cadre portrait **3/4** en grille ;
  vedette = écran scindé affiche | texte).
- `READER_VARIANTS` — `default` (reader éditorial) · `poster` (`ArticleReaderPoster` : couverture **entière**
  au ratio naturel, hauteur plafonnée `max-h-[85vh]`, pas de recadrage 16/9). Extensible.

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

> `fullWidth` est une prop **par section** uniquement : il n'existe **pas** de `config.blog.defaultFullWidth`
> — chaque section `articleFeed` la déclare individuellement.

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
- **Search (preview `resource`)** : le nouveau preview config-driven `resource` du module search
  (`useResourceEntity` dans `src/modules/search/hooks/`, `PreviewResourceCard`) est un **miroir fidèle** du
  patron blog `useArticle` / `ArticleGallery` / `ArticleDocuments` — même extraction `about.images`
  (`contentKey="slider"` → `GalleryGrid`) + `about.files` (→ `FilesList`, plus audio via `AudioPlayer` /
  `<video>` natif) au-dessus des **mêmes primitives partagées** `src/components/media/{GalleryGrid,FilesList,AudioPlayer}`.
  L'unité blog ↔ search reste ainsi explicite.
- **formEngine** : le costum form `parent62-article` du POI `article` déclare les champs éditables (`name`,
  `shortDescription`, `description` markdown, `profil_avatar`, `galerie`, `documents`, `tags`, taxonomies
  `territoires`/`publics`/`themes`) — voir [Édition](#édition--le-costum-form-parent62-article). Il illustre
  la personnalisation config-driven d'un costum : champs requis, `select` vs `multiselect`, sections retirées,
  ciblage du `navigateOnSuccess` / `invalidateFn` selon le point d'ouverture (admin).

> Config parent62 (hors module) : le CTA header « Contact » (`config.header.ctaButton`) a été supprimé
> (824ad17) — sans rapport avec l'édition d'article, mais dans le même fichier de config.
