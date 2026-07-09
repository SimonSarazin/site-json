# Module `articles / blog` (site-json) — doc de conception

> **Statut : DOC DE TRAVAIL (réflexion, avant code).** Branche `feat/module-articles-blog`.
> But : un module blog/articles **piloté par les données** (POI `type:"article"`), servant **deux sources** —
> les articles **costum** (ex. sport-sante, saisis au form) ET un **import massif WordPress** (parent62.org,
> ~8 000 articles). Fondé sur l'analyse multi-agents du 2026-07-08 (archi module, données, composants, routing/SEO)
> + inspection de l'API REST WordPress parent62.org.

---

## 1. Objectifs & périmètre

- **Lister** des articles (fil éditorial) : grille de cartes, article à la une, filtres par thème/catégorie, recherche, pagination/scroll infini — **tenant la volumétrie (~8 000 articles)**.
- **Lire** un article : page dédiée (hero, titre, méta auteur/date/temps de lecture, **corps riche**, tags, articles liés, partage) — **SEO server-side** (un blog vit du référencement).
- **Écrire/éditer** un article costum (déjà couvert par le form costum `…-article`, à raffiner pour un corps riche).
- **Migrer** le contenu WordPress parent62.org → articles Coco (POI `type:"article"`), idempotent, avec médias.
- **Un seul modèle** pour les deux sources (costum + WP), scopé par costum (`source.key`).

**Hors-périmètre (pour l'instant)** : commentaires/réactions (le module `news` les a, mais couple au modèle News — voir §9), newsletter, multi-langue du contenu d'article (le WP est FR).

---

## 2. Contexte : deux sources + volumétrie

| Source | Volume | Corps | Métadonnées |
|---|---|---|---|
| **Costum** (sport-sante…) | quelques | `description` = **texte brut** (`\r\n`) | tags, image, date, auteur=parent |
| **WordPress** (parent62.org) | **~8 153** | `content.rendered` = **HTML riche** | 18 catégories, excerpt, featured image, auteur, slug, `acf` |

**WordPress parent62.org (API REST `wp/v2`)** — un post porte : `title.rendered`, `content.rendered` (HTML), `excerpt.rendered`, `date`, `slug`, `categories[]` (« Actus » 5667, « Zoom » 719, « Offres d'emploi » 186, « À la une » 18…), `tags[]`, `featured_media` (image via `_embedded`), `author` (via `_embedded`), `acf` (Advanced Custom Fields), `guid`/`link` (URL d'origine).

**Conséquence structurante** : le corps d'un article peut être **du texte brut (costum)** OU **du HTML (WP)**. Le modèle et le rendu doivent gérer **les deux formats** (voir §3 et §7).

---

## 3. Modèle de données — un article = POI `type:"article"`

Un article **n'est pas une collection à part** : c'est un document `poi` discriminé par `type:"article"`, scopé costum par `source.key`. (2354 en base aujourd'hui, 15 costums.)

| Champ POI | Rôle article | Notes |
|---|---|---|
| `name` | **Titre** | widget text |
| `description` | **Corps** | costum = texte brut `\r\n` ; WP = **HTML** → besoin d'un **format** (voir ci-dessous) |
| `shortDescription` | **Chapô / excerpt** | fallback = description tronquée |
| `profil*ImageUrl` | **Image** (à la une + vignette) | déjà résolu serveur (`profilImageUrl`/`profilMediumImageUrl`/`profilThumbImageUrl`) ; champ de form = `profil_avatar` |
| `tags[]` | **Thèmes / catégories** | facette principale (fiable) ; `category` existe mais peu rempli (~14%) → ne pas s'en servir comme facette |
| `parent` / `creator` | **Auteur** | `parent[0].name` (org/citoyen porteur) affiché ; `creator` = userId technique |
| `created` / `updated` | **Dates** (unix **secondes**) | tri `created:-1` ; `modified` hétérogène (ISO vs `{sec,usec}`) → **ne pas trier dessus** |
| `source.key` | **Scope costum** | `{insertOrign:'costum', key, keys[]}` |
| `slug` | URL propre | **présent sur ~18 % seulement** → chemin détail par **id** obligatoire (§5) |
| `urls[]` | Liens externes | |
| `geo` / `address` | Localisation (optionnelle) | widgets hidden |

**Décision-clé — le corps (`description`) et son format.** Le costum stocke du texte brut ; WP du HTML. Options :
- **(recommandé)** ajouter un discriminant de **format** (ex. champ `contentFormat` ∈ `plain|markdown|html`, ou heuristique) et un **rendu unique sanitizé** (voir §7) : `html` → sanitize DOMPurify ; `markdown` → markdown-it + sanitize ; `plain` → `white-space: pre-line` + échappement.
- Pour l'**authoring costum**, passer le corps en **markdown** (éditeur `MarkdownEditor` déjà dispo) plutôt que texte brut → cohérent avec un rendu riche.
- Les articles **migrés WP** arrivent en **HTML** → stockés tels quels (nettoyés) + rendus sanitizés.

**Référence source WP** (pour la migration idempotente + backlink) : conserver `guid`/`link` WP dans un champ (`source.originUrl` ou `urls`), et une clé stable (`wpId`/`guid`) pour l'upsert.

---

## 4. Architecture du module (site-json)

site-json a **deux mécanismes** de module (auto-découverts par convention de fichiers) :
1. **Section config-driven** (patron **AGENDA**) : un `type` de section listé dans `config.pages[].sections[]`, rendu par `SectionRenderer` via une map lazy. Enregistrement = 2 points : (a) schéma zod dans l'union `Section` de `src/types/site-schema.ts` ; (b) entrée `LazySections` dans `src/components/sections/SectionRenderer.tsx`.
2. **Route de module** (patron **PROFIL/ADMIN**) : `module.config.ts` + `routes.tsx` découverts par `discoverModules()` (`import.meta.glob`), fusionnés par `buildRoutes`. Les **routes à paramètre** (`/blog/:slug`) **doivent** être des routes de module (une page config ne peut pas avoir de paramètre).

**Cible = HYBRIDE, module `blog` (ou `articles`), `type:"core"`** :
- **Section data-backed `articleFeed`** (île client calquée sur Agenda) : fil paginé + facettes, posable dans `config.pages[]` (ex. la page `/blog`, ou une section dans n'importe quelle page).
- **Routes de module** : `/blog` (liste dédiée) + **`/blog/:slug`** (article) + **`/blog/id/:id`** (fallback slugless) avec **loader SSR** de prefetch (SEO).

⚠️ **Pièges d'archi (documentés)** :
- Il existe **déjà** des sections `blogList`/`blogPost` **STATIQUES** (posts figés dans le JSON, aucun fetch) ; `BlogListSection` navigue vers `/blog/:slug` **qui n'existe pas** → lien mort. → **Ne pas réutiliser ces `type`** : créer de **nouveaux** types data-backed (`articleFeed`/`articleReader`) pour ne pas écraser le comportement statique.
- Module **sans `routes.tsx` doit être `type:"core"`** ; un seul module `optional` bascule **toute** la construction de routes en async → **régression d'hydratation app-wide**. Notre module ayant des routes, `core` + routes est le bon combo.
- Composant de section **sans `export default`** casse la map lazy.
- **i18n** : `import "../i18n"` en side-effect **dans le fichier de section** (enregistre le namespace avant rendu) ; consommer via `useT("modules/blog")`.

---

## 5. Routing, SSR & SEO

- **Liste** `/blog` : soit une page config avec une section `articleFeed` (SEO liste via `page.seo`), soit une route de module. La section fetch **après hydratation** (île client) → squelette identique serveur/client (pas de mismatch), comme Agenda.
- **Article** `/blog/:slug` (route de module, patron `profil/:slug`) + **`/blog/id/:id`** (car **~82 % sans slug**). **Loader SSR** = prefetch de l'article (`entityBySlug(slug)` ou `entity('poi',{id}).get()` → `getElementsAbout`) dans le QueryClient → dehydrate → HTML complet côté serveur (crawler-visible).
- **SEO** : `@dr.pogodin/react-helmet` **injecté server-side** (`entry-server` `onHead`). Créer un **`BlogArticleSeo`** (calqué sur `ProfileSeo`) émettant `title/description/OpenGraph/Twitter/canonical/robots` + **JSON-LD `@type:"BlogPosting"`** (headline, image, datePublished, author, articleBody). La **page liste** utilise `Seo.tsx` (déjà rendu par SiteRenderer) + `page.seo.structuredData` (`Blog`/`ItemList`).
- ⚠️ **Gap SEO à corriger** : `ProfileSeo` construit `canonical`/`og:url` depuis `window.location` (gardé `typeof window`) → **vide en SSR**. Pour le blog, **dériver l'URL de base de la config/env côté serveur** (`getServerUrl()`), pas de `window`.

---

## 6. Volumétrie & recherche (tenir ~8 000 articles)

- **Fil** : `entity.searchCostum(payload)` (endpoint `globalAutocompleteCostum`) — **pattern déjà en prod** dans `AdminResourceTable`. Payload : `searchType:{type:['poi']}` (⚠️ obligatoire — `defaultTypes` seul ne suffit pas), `filters:{type:'article'}`, scope `costumSlug`/`sourceKey`, `sortBy:{created:-1}`, `name` (recherche plein-texte), pagination `indexMin`/`indexStep` + `page.next()`.
- **Réutiliser** `useSearchQuery` + `buildSearchPayload` + `SearchListView` (scroll infini via `lastItemRef`) + `useItem` (normalise titre/excerpt/image/tags/dates pour la carte). **Zéro-code possible** : une section `SearchProStatic` configurée (mais un `articleFeed` dédié = meilleure UX éditoriale).
- **Facettes** : par **tags** (`searchTags` + `options.tags.verb:'$all'`), calquées sur les catégories WP (18). Pas `category` (peu rempli).
- **Ne jamais tout charger** (8k). Scroll infini + facettes + recherche. Réserver `useSearchAllResults` (charge par 500) aux vues carte/dashboard, pas au fil.

---

## 7. Composants — réutiliser vs créer

**Réutiliser tel quel** :
- `modules/search/hooks/useSearchQuery` + `lib/buildSearchPayload` + `components/SearchListView` + `hooks/useItem` — fil paginé + normalisation carte.
- `helpers/renderMarkdown.ts` + `lib/sanitize.ts` (markdown-it + **DOMPurify**, SSR-safe) — **rendu sûr du corps** (déjà en prod dans `ProfileAbout`).
- `components/ui/OptimizedImage` + `lib/imageUtils` (`/img?url=`) — hero + vignettes.
- `components/ui/{card,badge,tabs,pagination,skeleton,avatar,aspect-ratio,separator}` — primitives shadcn.
- `modules/coform/components/MarkdownEditor` (client-only, SSR-safe) — authoring du corps.
- `modules/profil/{ProfilePage,ProfileRenderer,ProfileSeo}` + `useEntityBySlugQuery` — **patron** de la route reader + SEO.
- `helpers/formatDate` (`formatDateLong`), `SearchFilters`/`FilterDropdown`/`ActiveFiltersBar` — dates + filtres tags.

**À créer** :
- **`ArticleCard`** (carte éditoriale 16/9, excerpt long, temps de lecture) — extraire/adapter le `PostCard` interne de `BlogListSection` et le **brancher sur l'entité** (`useItem`/`serverData`).
- **`ArticleReader`** — hero image + `<h1>` + méta (auteur/date/temps de lecture) + **corps sanitizé** (`renderRichBody`) + tags + **articles liés** (searchCostum par tags) + partage.
- **`renderRichBody(content, {format})`** — pipeline UNIQUE : `html`→sanitize ; `markdown`→markdown-it+sanitize ; `plain`→`pre-line`. **Choisir UNE stack markdown** (markdown-it, la stack prod) — ne pas embarquer aussi `react-markdown` (news).
- **`articleFeed`** (section data-backed) + **`articleReader`** (route) — les nouveaux `type` (ne pas réutiliser `blogList`/`blogPost` statiques).
- **`BlogArticleSeo`** (JSON-LD `BlogPosting`, canonical server-side).
- **`CategoryNav`** (nav des thèmes/tags, calquée sur les catégories WP).
- Le module `blog/` : `module.config.ts` (core), `routes.tsx`, `sections/ArticleFeed.tsx`, `pages/ArticlePage.tsx`, `hooks/`, `prefetch/prefetchArticle.ts`, `i18n/`, `schema.ts`.

**Design/UX attendu** (cohérent avec le design system tailwind/shadcn du site) :
- **Liste** : grille responsive de `ArticleCard` (image 16/9, badge catégorie, titre `line-clamp-2`, excerpt `line-clamp-3`, date+temps de lecture), **article à la une** en tête (hero large), barre de facettes (tags) + recherche, **scroll infini** + skeletons, état vide.
- **Article** : hero pleine largeur, titre + méta, **corps `prose prose-lg dark:prose-invert`** (largeur de lecture max ~72ch), tags cliquables (→ fil filtré), **articles liés**, partage. Responsive + dark mode (`lightMode` actif).

⚠️ **Sécurité** : `BlogPostSection` existant fait `dangerouslySetInnerHTML` **NON sanitizé** → notre reader **doit** passer par `sanitize()`/`renderRichBody`.

---

## 8. Pipeline de migration WordPress → POI `type:"article"`

**Source** : `https://www.parent62.org/wp-json/wp/v2/posts?per_page=100&_embed&page=N` (~82 pages). `categories`/`tags`/`media`/`users` via leurs endpoints (ou `_embed`).

**Mapping** :
| WP | → Coco (POI article) |
|---|---|
| `title.rendered` | `name` |
| `content.rendered` (HTML) | corps (`description`) + `contentFormat:"html"` |
| `excerpt.rendered` | `shortDescription` (HTML nettoyé → texte) |
| `date` | `created` (→ unix secondes) |
| `categories[]` (noms) | `tags[]` (+ éventuellement `category`) |
| `tags[]` | `tags[]` (fusion) |
| `_embedded` featured image | image (réhébergée **ou** URL référencée — **décision §9**) |
| `_embedded` author | auteur (byline / `parent` si mappé sur une entité) |
| `slug` | `slug` |
| `guid`/`link` | `source.originUrl` + clé d'idempotence |
| `acf` | champs supplémentaires si pertinents |

**Exécution** :
- Pipeline **batch, paginé, resumable, idempotent** (upsert par clé WP guid/slug → pas de doublon en re-run).
- Voie d'import : **backend `importData`** (route admin existante, tâches #14/#17) OU **script de migration dédié** (Node, lit WP REST → écrit via la lib `entity('poi').save()` scopé costum). À trancher §9.
- **Médias** : ~8k images à la une → réhéberger dans `/upload/communecter/poi/{id}/` (robuste, autonome) **ou** garder les URLs parent62.org (rapide, mais dépend de la survie du WP). Réhébergement = plus lourd mais pérenne.
- **Rythme** : throttle (ne pas marteler parent62 ni Coco), reprise sur incident, journal des upserts.

---

## 9. Décisions actées (2026-07-08)

1. **Volume migré** : ✅ **TOUT** (~6 486 posts publiés — l'API `posts` en compte 6 486 ; la somme des catégories ~8 153 double-compte les posts multi-catégories).
2. **Médias WP** : ✅ **RÉHÉBERGER** côté Coco (le script télécharge tout, ~16 000 images ≈ ~4 Go).
3. **Corps** : ✅ **MARKDOWN** — le contenu WP (HTML) est **converti en markdown** à l'extraction (turndown), et l'authoring costum passera aussi en markdown. Rendu unique sanitizé (`renderMarkdown` + DOMPurify). Champ `contentFormat:"markdown"`.
4. **Voie de migration** : ✅ **SCRIPT Node dédié** de RÉCUPÉRATION (`tools/wp-migration/fetch-wp.mjs`, fait + validé sur 100 articles) → sortie JSON + images locales. L'IMPORT (JSON+images → POI) reste à définir : **à réfléchir** si `importData` sait télécharger/rattacher les images, sinon import via lib (`entity('poi').save()` + upload image par article).
5. **`news` vs `article`** : ✅ **`article` distinct** (POI `type:"article"`), PAS le module news.
6. **Slug** : conservés depuis WP (le script garde `slug`) ; fallback `/blog/id/:id` pour les rares sans slug.
7. **Scope** : ✅ parent62 = **son PROPRE costum** (source.key dédié) → nouveau site-json + costum parent62.

### Import — mécanisme tranché + implémenté (2026-07-09)

On réutilise **`importData`** (machinerie admin import : CSV → mapping → checkdataimport → importData, scopé costum). Deux chantiers de **parité legacy/backend** ont comblé ce qui manquait :
- **A — date d'origine (`created`)** : le save standard stampe `created=now` (inchangé) ; l'**action importData** corrige `created` par un update ciblé SI la ligne fournit une date (unix s / parsable). **`created` reste le champ standard** (pas de `publishedAt` divergent), le save cœur n'est pas touché. Ajouté au **legacy** (`Import.php`) + **backend** (route importData).
- **B — image à la une** : la branche `afterSaveImport` du **backend** (stubée) est **portée** → `importData` télécharge l'image depuis `profilImageUrl` (URL) et la **réhéberge** (`saveDocument` contentKey=profil) exactement comme le legacy. (Fix : l'id réel est passé à afterSaveImport.)

Prouvé (backend e2e, 283 passed) : `created` préservé + image réhébergée. Champs POI : **aucun ajout** (name/description[markdown]/shortDescription/tags/type/profilImageUrl/created/slug/source suffisent). Costum import.mapping : non requis pour le contenu (descripteur poi couvre) ; `created` lu **en propre** par l'action d'import (hors descripteur).

**Reste** :
- **Images inline** du corps : `importData` ne gère QUE l'image à la une → passe séparée (upload local → réécrit markdown). Ou v1 : garder les URLs inline en attendant.
- Serveur d'import : cibler **5099 (backend)** ou **5080 (legacy)** — les deux réhébergent maintenant (parité faite).
- Run complet `fetch-wp` (~6 486 articles, ~16 k images, reprenable) : à lancer.

---

## 10. Phasage proposé (après validation du doc)

- **P0 — Fondations lecture** : module `blog` core + section `articleFeed` (data-backed, réutilise useSearchQuery) + route `/blog/:slug` + `/blog/id/:id` + `ArticleReader` (corps sanitizé) + `BlogArticleSeo` (JSON-LD). Testé sur les **articles costum sport-sante** (3 réels).
- **P1 — Design éditorial** : `ArticleCard` 16/9, article à la une, `CategoryNav`, facettes tags, scroll infini, skeletons, dark mode.
- **P2 — Migration WP (pilote)** : script/route sur **1 catégorie** (ex. « À la une », 18 posts) → valider mapping + médias + rendu HTML + idempotence.
- **P3 — Migration WP (masse)** : batch complet (selon décision §9.1), médias, resumable, journal.
- **P4 — Authoring** : corps markdown dans le form costum article (`MarkdownEditor`), édition depuis l'admin.

---

## 11. Backlog — à traiter APRÈS la revue adversariale de P0

P0 est codé + testé navigateur (fil `/blog` + reader markdown + SEO). Points identifiés à reprendre :

1. **Command palette (Ctrl+K) — recherche d'articles.** Le `commandPalette` doit pouvoir chercher et
   ouvrir des **articles** (POI `type:"article"`) → `/blog/:slug`. Aujourd'hui il ne les cible pas.

2. ✅ **FAIT (2026-07-09).** **Un POI `article` = 2 vues possibles.** **Décision : le reader `/blog/:slug` est
   la présentation CANONIQUE** ; `/profil/:slug` reste accessible (un article EST un POI) mais **canonicalise
   vers `/blog/:slug`** (`ProfileSeo` : `type==="article"` → canonical + og:url `/blog/:slug`, JSON-LD
   `@type:"BlogPosting"`, og:type `article`) → plus de contenu dupliqué SEO. **Palette** : les articles sont
   exclus de l'annuaire générique (`entitySearch.excludeTypes:["article"]`, post-filtre sur `serverData.type`)
   → ils n'apparaissent QUE dans le groupe « Articles » (source `blog:articles`, item 1). **Reliquat optionnel** :
   les cartes de recherche génériques (/lieux, preview drawer) ouvrent encore un article via `/profil/:slug` —
   acceptable (le canonical corrige le SEO) ; router ces cartes vers `/blog` serait un raffinement ultérieur.

3. ✅ **FAIT (2026-07-09) — par l'item 4.** **`articleFeed` posable sur N pages.** La section est config-driven
   et autonome (costumSlug dans ses props) → posable sur autant de pages qu'on veut. Tous les fils pointent vers
   le **reader canonique unique `/blog/:slug`** (décision item 2), et le retour dynamique (item 4) ramène à la
   page d'origine → cohérent depuis N emplacements. Le `detailBasePath` (multi-base) devient **obsolète** (il
   contredisait le reader canonique unique) : la section force `/blog` (garde P0) ; prop dépréciée.

4. ✅ **FAIT (2026-07-09).** **Retour DYNAMIQUE.** `ArticleReader` : bouton retour = `navigate(-1)` si on vient
   d'une page de l'app (`location.key !== "default"` → retour exactement là d'où on vient, préserve scroll/filtres
   SPA), sinon (deep-link) repli sur `backTo` (défaut `/blog`). Plus de `/blog` imposé → débloque l'item 3
   (fils à N endroits, retour toujours cohérent). Vérifié live : `/blog` → article → Retour → `/blog`.

5. ✅ **FAIT (2026-07-09).** **queryKeys dédiés (convention module).** `BLOG_QUERY_KEYS`
   (`src/modules/blog/constants/queryKeys.ts`) : `FEED_PREFIX(costumSlug)`, `ARTICLE_BY_ID(id)`,
   `ARTICLE_BY_ID_PREFIX()`. `useArticleFeed`/`useArticle`/`prefetchArticleById` refactorés (valeurs
   identiques → comportement inchangé).

6. ✅ **FAIT (2026-07-09).** **Invalidation des queries blog à l'ajout/édition d'un article.** Nouveau
   `invalidateFn` **`invalidate:blog`** (`sharedFns.ts`) = `invalidate:standard` (fil via `searchKeys` +
   about-par-slug en édition + userList en création) **+ la clé détail PAR ID** (`ARTICLE_BY_ID` — les ~82 %
   d'articles slugless routés `/blog/id/:id`, non couverts par l'about-slug). Câblé sur `mutation.invalidateFn`
   du `costumForm` `sport-sante-bienetre-article` (`fn: "invalidate:blog"`, `searchKeys: ["blog:sportSanteBienetre"]`).
   Vérifié par test comportemental déterministe (`invalidateBlog.test.ts`, sans mutation).

7. ✅ **FAIT (2026-07-09).** **Champ contenu en MARKDOWN dans le form article (authoring).** Le champ `description` (corps) du
   `costumForm` `sport-sante-bienetre-article` est aujourd'hui un **`textarea`** (widget `text`). Or le reader
   rend le corps en **markdown** (`renderMarkdown`) → l'auteur doit pouvoir écrire du markdown. Mettre un
   **widget markdown** (l'éditeur `MarkdownEditor` de coform, déjà client-only/SSR-safe) sur le champ
   `description` du sous-type `article` (config.costumForms) — et vérifier que le formEngine sait rendre ce
   widget d'édition. Cohérent avec la décision « corps = markdown » (§9.3).
   **⇒ Dans la MÊME passe d'authoring : ajouter un champ `tags`** (multi-select / liste) au costum form
   article. C'est le prérequis data des **facettes P1 (§14)** : aujourd'hui les articles costum n'ont pas de
   tags → les `dropdownFilters` restent vides. Une fois le champ `tags` posé (+ articles tagués), déclarer les
   facettes correspondantes en config allume le filtrage. Cf. le caveat §14.

8. ✅ **FAIT (2026-07-09) — par l'archi P1 (§14).** **`heroSearch` sur la page blog.** Toutes les questions
   ouvertes sont tranchées : le **« SearchProvider » = `PageFilters`**, monté **par page** par `SiteRenderer`
   (`key={pathname}`) → PAS besoin de wrapper quoi que ce soit. Le fil **EST piloté** par la recherche partagée
   (`useArticleFeed` lit `PageFilters.searchQuery` + filtres). N'importe quelle section de recherche qui écrit
   `setSearchQuery` pilote le fil : **`searchHeader`** (posé sur `/blog` en P1, prouvé live « Opération » → fil
   filtré) OU **`heroSearch`** (`triggerSearch()` fait le même `pageFilters.setSearchQuery`) — au choix, sans
   code. **Reliquat optionnel** (mutualisé avec le reliquat item 2) : l'autocomplete de `heroSearch` et les
   cartes de recherche génériques ouvrent un article via `/profil/:slug` ; un helper « href de détail selon le
   type » (article → `/blog`, sinon `/profil`) partagé les routerait vers `/blog` — raffinement ultérieur (le
   canonical, item 2, couvre déjà le SEO).

### Extensibilité / architecture (à cadrer)

9. ✅ **FAIT (2026-07-09).** **Registres de variants — lazy + default.** Helper générique
   `variants/registry.ts` (`makeVariantRegistry` : map `Record<string, lazy(loader)>` + `get(key)` avec
   fallback `default` + `preload` vite-preload + garde « default requis »). Registres : **`CARD_VARIANTS`**
   (`default` éditorial 16/9 + `compact` liste ; `ArticleCardProps` partagé) et **`READER_VARIANTS`**
   (`default` ; extensible). Ajouter un variant = un composant + une entrée. Le **feedLayout** (`grid`/`list`)
   est un enum léger (arrangement du conteneur, pas un chunk lazy). Test `registry.test.ts` (5/5).

10. ✅ **FAIT (2026-07-09).** **Config liée aux variants.** Section : `articleFeed.props.cardVariant` +
    `feedLayout`. Site-level : **bloc `config.blog`** (`configSchema.ts`, câblé dans `SiteConfig`) —
    `readerVariant` (lu par `ArticlePage`), `defaultCardVariant`, `defaultFeedLayout`. Résolution :
    props section > `config.blog` > défaut registre/enum. `ArticleFeed` préchauffe le chunk carte (`preload`).

11. ✅ **FAIT (2026-07-09) — DÉCISION : PAS de `BlogContext`.** L'état partagé fil↔reader↔hero vit déjà dans
    **`PageFilters`** (item 8, monté par page) ; les variants sont de la **config** (items 9+10) ; le fil est
    une île autonome (`useArticleFeed`) et le reader une route (`useArticle`). Aucun état transverse ne
    justifie un contexte blog dédié → on ne sur-architecture pas. À rouvrir seulement si un besoin concret
    d'état partagé non couvert par PageFilters émerge.

12. **Section d'affichage d'UN article (data-backed).** Une section config-driven `articleReader` (ou
    `articlePost`) pour poser **un article précis** (par slug/id) sur n'importe quelle page — data-backed
    (fetch entité), à distinguer du `blogPost` STATIQUE existant. Utile pour une home (« article à la une »),
    une page dédiée, etc. Réutilise `ArticleReader` + `useArticle`.

## 12. État P0 (2026-07-09)
Fait + testé : module `blog` core, section `articleFeed` (data-backed), routes `/blog/:slug` + `/blog/id/:id`,
`ArticleReader` (markdown sanitizé) + `BlogArticleSeo` (JSON-LD). 4 bugs corrigés au test (react-router v7,
Helmet string-child ×2, retour/extrait). Reste connu : **images non chargées en dev** (URL `/upload` relative +
backend 5080 → 404 ; OK en prod même host — à confirmer / absolutiser `OptimizedImage` en dev).

## 13. Revue adversariale P0 (2026-07-09) — 5 findings confirmés / 11, TOUS traités
Workflow 4 dimensions (security/correctness/react-ssr/data-robustness) → vérif par réfutation. 6 réfutés
(dont le « XSS JSON-LD » : `helmet.script` n'est jamais réinjecté au SSR ; et « serverData.id absent » :
empiriquement peuplé sur l'appel searchCostum réel — repli ajouté quand même par convention).

| # | Sév. | Défaut | Correctif |
|---|---|---|---|
| 1 | HIGH | `/blog/id/:id` sans loader → ~82% articles (slugless) sans SEO/contenu SSR | `prefetchArticleById` (clé `["blog:article:id",id]`) + `articleByIdLoader` sur la route (`routes.tsx`, `prefetch/prefetchArticle.ts`) |
| 2 | MED | `canonical`/`og:url` jamais émis (prop `url` jamais passée) → duplicate content | `ArticlePage` calcule l'URL absolue (`window.location.origin`, priorité slug) et la passe à `BlogArticleSeo` |
| 4 | MED | Feed lit `id` sur `serverData` seul (pas de repli) → risque `/blog/id/undefined` | `norm()` : repli `?? item.id` (id racine, comme SearchListView/CardFunding/AdminResourceTable) |
| 5 | LOW | Feed sans état d'erreur → panne search déguisée en « aucun article » | branche erreur + bouton Réessayer (`error`/`refetch`, i18n `feed.error`/`feed.retry`) |
| 3 | MED (latent) | `detailBasePath ≠ /blog` = liens morts (prod OK, défaut `/blog`) | **gardé** : `base` figé `/blog` + `console.warn` dev + `schema.ts` marqué « RÉSERVÉ, non câblé » → **relève des backlog §11 items 3+4** (routing multi-base) |

## 14. P1 — Design éditorial + filtrage (2026-07-09)

**Décision d'archi (après retour utilisateur) : RÉUTILISER le moteur de filtres du module `search`, PAS de
bespoke.** Un premier jet (CategoryNav/TagFacets/articleUrlParams maison) a été **jeté** : il réinventait
`PageFilters` + sa synchro URL + `FiltersSection`. Le bon patron :

- **`PageFilters` est monté par page** (`SiteRenderer.tsx`, `key={pathname}`). Toutes les sections d'une page
  partagent donc l'état filtres/texte.
- **`useArticleFeed` lit `PageFilters`** (comme `SearchProStatic`) : `searchQuery`→searchText,
  `filterNames`→searchTags (filtres SANS `field`), `searchByFields`→`searchByFieldsToQuery`→`defaultFilters`
  (filtres AVEC `field`). La queryKey de `useSearchQuery` intègre tout ça → **re-fetch + reset scroll auto**.
- **Facettes = composer les sections search existantes** sur la page blog (config) : `heroSearch` (texte) et/ou
  `searchHeader` (recherche + `dropdownFilters` + chips actifs + Sheet mobile + synchro URL). Le fil (`articleFeed`)
  ne fait que **lire** PageFilters — aucun code de filtre propre au blog.

### Filtrage CONFIG-DRIVEN et agnostique au champ (la demande clé)

Au-delà de `tags`, un POI article peut recevoir des champs via le **costum form** (dont des champs **`list`**).
Chacun devient une facette en le déclarant dans `dropdownFilters` d'un `searchHeader` — **zéro code** :

- **Filtre par tags** (facette SANS `field`) — l'`id` d'option = la valeur de tag :
  ```json
  { "id": "cat", "label": {"fr":"Catégorie"}, "options": [
      { "id": "Actus", "label": {"fr":"Actus"} }, { "id": "Zoom", "label": {"fr":"Zoom"} } ] }
  ```
  → `selectedFilters.cat` → `filterNames` → `searchTags` (`$all`) côté backend.
- **Filtre par un champ `list` du costum** (facette AVEC `field`) — ex. un champ `theme` :
  ```json
  { "id": "theme", "label": {"fr":"Thème"}, "field": "theme", "multiple": true, "options": [
      { "id": "prevention", "label": {"fr":"Prévention"}, "value": "prevention" } ] }
  ```
  → `searchByFields` → `searchByFieldsToQuery` → `defaultFilters.theme = { $in: [...] }` (Mongo) côté backend.
- **Tags cliquables sur la carte** (recette, non câblé par défaut pour ne pas coupler `ArticleCard`) : envelopper
  chaque tag dans `<ClickableFacet field="tags" token={tag}>` ; il devient cliquable SSI un `dropdownFilter`
  `field:"tags"` est déclaré sur la page (sinon texte simple, dégradé gracieux).

### État & caveat données

- **Livré** : `articleFeed` piloté par PageFilters ; page `/blog` sport-sante = `searchHeader` (recherche texte
  **fonctionnelle** : filtre par nom d'article) + `articleFeed`.
- **Caveat** : le **champ `tags` existe désormais** dans le costum form article (§11.7 done), mais les 3 articles
  costum sport-sante **ne sont pas encore tagués** (données). Les **facettes** s'allument donc quand des articles
  portent des `tags` : (a) via le **WordPress importé** (categories+tags fusionnés en `tags[]`, cf. §8), (b) en
  **taguant les articles** via le nouveau champ, ou (c) via un autre champ `list` costum. Il ne reste alors qu'à
  déclarer les `dropdownFilters` correspondants en config (zéro code).
- **Pas de `BlogContext`** (backlog §11 item 11) : l'état vit dans le `PageFilters` partagé → inutile.
