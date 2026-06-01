[← Retour à l'index](README.md)

# Performance et optimisation

**Sommaire**

- [Performance et optimisation](#performance-et-optimisation)
  - [Lazy loading des sections et des images](#lazy-loading-des-sections-et-des-images)
    - [Chargement asynchrone des sections](#chargement-asynchrone-des-sections)
    - [Optimisation et lazy loading des images](#optimisation-et-lazy-loading-des-images)
  - [Lazy-loading des variants conditionnels](#lazy-loading-des-variants-conditionnels)
    - [Composants avec variants lazy](#composants-avec-variants-lazy)
    - [Migration `React.lazy` → `vite-preload.lazy`](#migration-reactlazy--vite-preloadlazy)
  - [Code splitting et bundling](#code-splitting-et-bundling)
    - [Tree-shaking de lucide-react](#tree-shaking-de-lucide-react)
    - [Configuration SSR](#configuration-ssr)
  - [Optimisation des images — Middleware sharp](#optimisation-des-images--middleware-sharp)
    - [Architecture](#architecture)
    - [Route API](#route-api)
    - [Securite](#securite)
    - [Utilitaire `buildOptimizedUrl`](#utilitaire-buildoptimizedurl)
    - [Docker](#docker)
  - [Caching et hydratation des données](#caching-et-hydratation-des-données)
  - [Compression et réseau](#compression-et-réseau)
  - [Voir aussi](#voir-aussi)

---

Pour garantir une expérience utilisateur fluide et un chargement rapide, plusieurs techniques d'optimisation sont mises en œuvre, tant côté client que côté serveur.

---

## Lazy loading des sections et des images

### Chargement asynchrone des sections

Le rendu des sections utilise **`vite-preload`** (et non `React.lazy`) pour un meilleur tracking SSR des chunks :

```tsx
// src/components/sections/SectionRenderer.tsx
import { Suspense } from "react";
import { lazy } from "vite-preload"; // ← vite-preload pour SSR
import type { PreloadableComponent } from "react-lazy-with-preload";
import type { Section, SectionPropsMap } from "@/types/site";
import { useCocolight } from "@/hooks/useCocolight";
import { ErrorBoundary } from "../layout/ErrorBoundary";

// Type pour les composants lazy avec préchargement
type LazySectionComponent<T extends Section['type']> =
  PreloadableComponent<
    React.ComponentType<{ id?: string; props: SectionPropsMap[T] }>
  >;

// Mapping « type » → Composant lazy-loaded (66 types au total)
// IMPORTANT: Utiliser lazy() directement (pas lazyNamed) pour que vite-preload
// puisse tracer les chunks correctement. Tous les composants doivent avoir
// un export default.
const LazySections: {
  [K in keyof SectionPropsMap]: LazySectionComponent<K>;
} = {
  hero: lazy(() => import("./HeroSection")),
  "hero-tiers-lieux": lazy(() => import("./HeroTiersLieux")),
  "hero-rezo-la-mer": lazy(() => import("./HeroRezoLaMer")),
  "hero-ssbe": lazy(() => import("./HeroSSBE")),
  "features-rezo-la-mer": lazy(() => import("./FeaturesRezoLaMer")),
  "action-buttons-rezo-la-mer": lazy(() => import("./ActionButtonsRezoLaMer")),
  "community-rezo-la-mer": lazy(() => import("./CommunityRezoLaMer")),
  "cta-rezo-la-mer": lazy(() => import("./CallToActionRezoLaMer")),
  "title-with-filters-rezo-la-mer": lazy(() => import("./TitleWithFiltersRezoLaMer")),
  "commune-transparente-actions": lazy(() => import("./CommuneTransparenteActionsSection")),
  "hero-nos-communes": lazy(() => import("./NosCommunesBannerSection")),
  "hero-commune-transparente": lazy(() => import("./HeroCommuneTransparenteSection")),
  "categories-grid": lazy(() => import("./CategoriesGridSection")),
  markdown: lazy(() => import("./MarkdownSection")),
  cards: lazy(() => import("./CardsSection")),
  gallery: lazy(() => import("./GallerySection")),
  video: lazy(() => import("./VideoSection")),
  testimonials: lazy(() => import("./TestimonialsSection")),
  pricing: lazy(() => import("./PricingSection")),
  faq: lazy(() => import("./FAQSection")),
  table: lazy(() => import("./TableSection")),
  blogPost: lazy(() => import("./BlogPostSection")),
  blogList: lazy(() => import("./BlogListSection")),
  team: lazy(() => import("./TeamSection")),
  stats: lazy(() => import("./StatsSection")),
  cta: lazy(() => import("./CTASection")),
  logoCloud: lazy(() => import("./LogoCloudSection")),
  chart: lazy(() => import("./ChartSection")),
  accordion: lazy(() => import("./AccordionSection")),
  tabs: lazy(() => import("./TabsSection")),
  steps: lazy(() => import("./StepsSection")),
  timeline: lazy(() => import("./TimelineSection")),
  banner: lazy(() => import("./BannerSection")),
  map: lazy(() => import("./MapSection")),
  newsletter: lazy(() => import("./NewsletterSection")),
  contactForm: lazy(() => import("./ContactFormSection")),
  comparison: lazy(() => import("./ComparisonSection")),
  featureComparison: lazy(() => import("./FeatureComparisonSection")),
  socialFeed: lazy(() => import("./SocialFeedSection")),
  eventList: lazy(() => import("./EventListSection")),
  productShowcase: lazy(() => import("./ProductShowcaseSection")),
  breadcrumb: lazy(() => import("./BreadcrumbSection")),
  cookieConsent: lazy(() => import("./CookieConsentSection")),
  html: lazy(() => import("./HTMLSection")),
  title: lazy(() => import("./TitleSection")),
  content: lazy(() => import("./ContentSection")),
  loginForm: lazy(() => import("@/modules/auth/sections/LoginFormSection")),
  registerForm: lazy(() => import("@/modules/auth/sections/RegisterFormSection")),
  recoverPasswordForm: lazy(() => import("@/modules/auth/sections/RecoverPasswordFormSection")),
  searchPro: lazy(() => import("@/modules/search/sections/SearchProSection")),
  searchProStatic: lazy(() => import("@/modules/search/sections/SearchProStaticSection")),
  cardCountCT: lazy(() => import("@/modules/search/sections/CardCountCTSection")),
  thematics: lazy(() => import("@/modules/search/sections/ThematicsSection")),
  filters: lazy(() => import("@/modules/search/sections/FiltersSection")),
  gridLayout: lazy(() => import("./GridLayoutSection")),
  news: lazy(() => import("@/modules/news/components/sections/NewsSection")),
  notifications: lazy(() => import("@/modules/notification/components/sections/NotificationsSection")),
  member: lazy(() => import("./MemberSection")),
  heroWithIcon: lazy(() => import("./HeroWithIconSection")),
  meeteem: lazy(() => import("@/modules/ampli/components/sections/MeeteemSection")),
  coform: lazy(() => import("@/modules/coform/components/CoFormSection")),
  actions: lazy(() => import("@/modules/cagnotte/components/sections/ActionsSection")),
  finance: lazy(() => import("@/modules/cagnotte/components/sections/FinanceSection")),
  "actions-summary": lazy(() => import("@/modules/cagnotte/components/sections/ActionsSummarySection")),
  "finance-summary": lazy(() => import("@/modules/cagnotte/components/sections/FinanceSummarySection")),
  "cagnotte-layout": lazy(() => import("@/modules/cagnotte/components/sections/CagnotteLayoutSection")),
};

// Fallback skeleton animé pendant le chargement
function SectionLoadingFallback({ id, type }: { id?: string; type: string }) {
  return (
    <section id={id} className="py-8 animate-pulse" data-loading-section={type}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-8 bg-muted/40 rounded-lg w-1/3 mb-4" />
        <div className="h-4 bg-muted/30 rounded w-2/3 mb-2" />
        <div className="h-4 bg-muted/30 rounded w-1/2" />
      </div>
    </section>
  );
}

export function SectionRenderer({ section, index }: { section: Section; index?: number }) {
  const { entity, contextId } = useCocolight();
  const sectionContext = `Section[type=${section.type}, id=${section.id || "none"}]`;

  // Les sections cagnotte reçoivent idProjet depuis les props ou le contexte
  const projectAwareSectionTypes: Section['type'][] = ['actions', 'finance', 'actions-summary', 'finance-summary'];
  const resolvedSectionProps = projectAwareSectionTypes.includes(section.type)
    ? ({ ...(section.props as Record<string, unknown>), idProjet: /* résolu depuis props ou contexte */ '' } as typeof section.props)
    : section.props;

  const LazyComponent = LazySections[section.type] as React.ComponentType<{ id?: string; props: typeof section.props }>;

  if (!LazyComponent) {
    console.warn(`[SectionRenderer] Unknown section type: "${section.type}"`);
    return (
      <section id={section.id} className="py-16 bg-muted/30 text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground">
            Section type "{section.type}" not implemented yet
          </p>
        </div>
      </section>
    );
  }

  return (
    <div data-section-index={index} data-section-type={section.type}>
      <Suspense fallback={<SectionLoadingFallback id={section.id} type={section.type} />}>
        <ErrorBoundary
          context={sectionContext}
          fallback={
            <section id={section.id} className="py-8 bg-destructive/10">
              <div className="container mx-auto px-4 text-center text-destructive">
                Failed to load section: {section.type}
              </div>
            </section>
          }
        >
          <LazyComponent id={section.id} props={resolvedSectionProps} />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
}
```

**Avantages de vite-preload** :
* **Tracking SSR** : les chunks sont correctement tracés pour le préchargement côté serveur
* **Preload hints** : génération automatique de `<link rel="preload">` pour les chunks nécessaires
* **Type-safe** : `PreloadableComponent` offre un typage précis
* **ErrorBoundary** : isolation des erreurs par section, pas de crash global
* **Skeleton animé** : feedback visuel pendant le chargement

**Notes** :
* Chaque section est packagée dans un chunk distinct (code-splitting automatique)
* Les composants de sections **doivent** avoir un `export default`
* Les sections des modules (search, news) sont importées depuis leurs chemins respectifs

### Optimisation et lazy loading des images

Le composant `OptimizedImage` (dans `src/components/ui/OptimizedImage.tsx`) gère automatiquement l'optimisation et le lazy loading de toutes les images :

```tsx
import { OptimizedImage } from "@/components/ui/OptimizedImage";

// Image standard (lazy par defaut, format auto WebP/AVIF)
<OptimizedImage src="/images/photo.jpg" alt="Photo" width={400} />

// Image prioritaire (LCP) — eager + fetchPriority="high"
<OptimizedImage src={bannerUrl} alt="Banner" width={1200} priority />

// Avec gestion d'erreur
<OptimizedImage src={avatarUrl} alt="Avatar" width={96} onError={() => setError(true)} />
```

**Props disponibles** :

| Prop | Type | Defaut | Description |
|------|------|--------|-------------|
| `src` | `string` | — | URL source (locale ou distante) |
| `alt` | `string` | — | Texte alternatif (obligatoire) |
| `width` | `number` | — | Largeur souhaitee (genere srcSet 1x/2x) |
| `height` | `number` | — | Hauteur (optionnel, ratio preserve) |
| `quality` | `number` | `80` | Qualite 1-100 |
| `format` | `string` | `"auto"` | `webp`, `avif`, `jpeg`, `png`, `auto` |
| `priority` | `boolean` | `false` | `true` = eager + fetchPriority="high" |
| `sizes` | `string` | — | Attribut `sizes` pour responsive images |
| `className` | `string` | — | Classes CSS |
| `title` | `string` | — | Attribut title (tooltip) |
| `style` | `CSSProperties` | — | Styles inline |
| `onError` | `function` | — | Callback en cas d'erreur de chargement |

**Comportement** :
* Genere automatiquement un `srcSet` 1x/2x quand `width` est fourni (`width * 1` et `width * 2`, avec `height * 2` si `height` est aussi fourni)
* `loading="lazy"` par defaut, `loading="eager"` + `fetchPriority="high"` si `priority`
* Bypass automatique (rendu `<img>` classique, sans passer par `/img`) pour : `src` vide/falsy, SVG (`.svg`), data URIs (`data:`), blob URLs (`blob:`)
* Les chemins relatifs (`images/foo.png`) sont normalises en `/images/foo.png` par `buildOptimizedUrl`

---

## Lazy-loading des variants conditionnels

Les composants avec plusieurs variantes d'affichage (header, cards, etc.) sont lazy-loadés conditionnellement : seule la variante utilisée est chargée, pas toutes les alternatives.

### Composants avec variants lazy

| Composant | Variants lazy | Types JSON (`header.type` / `footer.type`) |
|---|---|---|
| `SiteHeader` | 6 variants | `default` (`DefaultHeader`), `tiers-lieux` (`HeaderTiersLieux`), `rezo-la-mer`/`cyber-reunion` (`HeaderRezoLaMer`), `julie-pot-vin` (`HeaderJuliePotVin`), `nos-communes` (`HeaderNosCommunes`), `commune-transparente` (`HeaderCommuneTransparente`) |
| `SiteFooter` | 4 variants | `default` (`DefaultFooter`), `tiers-lieux` (`FooterTiersLieux`), `rezo-la-mer`/`cyber-reunion` (`FooterRezoLaMer`), `ssbe` (`FooterSSBE`) |
| `SearchCard` | 12 variants | organization, event, project, user, poi, tiers-lieux, etc. |
| `ProfileHeader` | 6 variants | `ProfileHeaderHero`, `ProfileHeaderSimple`, `ProfileHeaderCover`, `ProfileHeaderBannerOverlay`, `ProfileHeaderComplete`, `ProfileHeaderMinimal` |
| `SwitchDetailsMode` | 4 variants | list, grid, map, calendar |
| `FloatingActionButton` | — | lazy-monté uniquement si configuré |
| `DiscourseGlobalModal` | — | lazy-monté uniquement si Discourse configuré |

Chaque composant switch utilise `lazy()` de `vite-preload` : seul le variant actif est téléchargé côté client (un seul `header.type` par déploiement). Côté SSR, `preloadAll()` charge tous les variants en mémoire Node sans impact réseau.

### Migration `React.lazy` → `vite-preload.lazy`

7 fichiers supplémentaires ont été migrés de `React.lazy()` vers `lazy()` de `vite-preload` pour bénéficier de `preloadAll()` SSR et de l'injection automatique de `<link modulepreload>` :

- `AmpliSectionRenderer.tsx` — sous-composants `AmpliHeader`, `AmpliIntro`, `AmpliFeatures`, `AmpliMessages`
- `ProfileAbout.tsx`
- `DiscourseSection.tsx`
- `MediawikiSection.tsx`
- `CagnotteDialog.tsx` (+ lazy-mount de `PaymentConfigPage` à l'intérieur)
- `FormFields.tsx` (coform)
- `RootLayout.tsx` — providers lazy

**Règle :** utiliser `lazy()` de `vite-preload` pour **tout** composant lazy afin de garantir le tracking SSR.

## Code splitting et bundling

* **Entrées multiples** : Vite sépare le code `entry-client.tsx` et `entry-server.tsx` en bundles distincts.
* **Chunks par import dynamique** : chaque `lazy()` crée un nouveau chunk, optimisant le cache et le parallélisme.
* **Configuration Vite** (`vite.config.ts`) — liste complète des `manualChunks` :

  ```ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // react-vendor : react, react-dom, react-router
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')) return 'react-vendor';

          // ui-vendor : tous les composants @radix-ui/*
          if (id.includes('node_modules/@radix-ui/')) return 'ui-vendor';

          // query-vendor : @tanstack/react-query
          if (id.includes('node_modules/@tanstack/react-query')) return 'query-vendor';

          // utils-vendor : clsx, tailwind-merge, class-variance-authority, date-fns
          if (id.includes('node_modules/clsx') ||
              id.includes('node_modules/tailwind-merge') ||
              id.includes('node_modules/class-variance-authority') ||
              id.includes('node_modules/date-fns')) return 'utils-vendor';

          // i18n-vendor : i18next uniquement (PAS react-i18next — voir ci-dessous)
          if (id.includes('node_modules/i18next') &&
              !id.includes('node_modules/react-i18next')) return 'i18n-vendor';

          // form-vendor : react-hook-form, zod, @hookform
          if (id.includes('node_modules/react-hook-form') ||
              id.includes('node_modules/zod') ||
              id.includes('node_modules/@hookform')) return 'form-vendor';

          // maps-vendor : leaflet, leaflet.markercluster
          if (id.includes('node_modules/leaflet') ||
              id.includes('node_modules/leaflet.markercluster')) return 'maps-vendor';

          // markdown-vendor : markdown-it
          if (id.includes('node_modules/markdown-it')) return 'markdown-vendor';

          // sanitize-vendor : dompurify, isomorphic-dompurify
          if (id.includes('node_modules/dompurify') ||
              id.includes('node_modules/isomorphic-dompurify')) return 'sanitize-vendor';

          // api-vendor : @communecter/cocolight-api-client
          if (id.includes('node_modules/@communecter/cocolight-api-client')) return 'api-vendor';

          // lucide-react : PAS de manualChunks → Vite décide (voir section suivante)
          // react-i18next : garde dans le bundle principal (voir note)
          // recharts : garde dans le bundle principal (voir note)
        }
      }
    }
  }
  ```

**Packages délibérément maintenus dans le bundle principal :**

| Package | Raison |
|---|---|
| `react-i18next` | Dépend du contexte React — le séparer dans un chunk vendor provoque des erreurs d'initialisation (le contexte n'est pas encore disponible au chargement du chunk) |
| `recharts` | Dépendances circulaires internes — le séparer provoque des erreurs "Cannot access before initialization" au runtime |

**`lucide-react` — pas de règle `manualChunks` :**  les icônes nommées importées statiquement (`import { MapPin } from "lucide-react"`) sont tree-shakées vers le chunk qui les utilise. Les icônes dynamiques (via `DynamicIcon`) sont chunked à la demande. Ne **pas** créer de règle `icons-vendor` : cela forçait les ~1900 icônes du manifest dynamic dans un seul chunk de ~1 MB.

### Tree-shaking de lucide-react

La règle `manualChunks` qui forçait **tout** lucide-react dans un chunk `icons-vendor` unique a été supprimée. Chaque icône a désormais son propre chunk et est chargée à la demande.

**Cela impose des règles strictes selon le type d'usage :**

| Usage | Pattern correct | Pattern incorrect (casse le tree-shaking) |
|---|---|---|
| Icônes dynamiques (nom en variable) | `<DynamicIcon name={iconName} />` | `import * as LucideIcons from "lucide-react"` |
| Mapping statique | `import { MapPin, Clock } from "lucide-react"` | `import * as Icons from "lucide-react"` |

Le composant `DynamicIcon` (`src/lib/entityIcons.tsx`) encapsule l'import dynamique d'icône par nom sans casser le tree-shaking.

**Fichiers migrés (4) :**
- `SearchProStatic` → `DynamicIcon` (usages dynamiques)
- `JsonFormModal` → `DynamicIcon` (usages dynamiques)
- `ThematicsSection` → imports nommés (mapping statique)
- `CardCountCT` → imports nommés (mapping statique)

**Bilan mesuré (page `/lieux`) :**

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| Bundle initial total | ~1280 KB | ~793 KB | -38% |
| Bundle main chunk | ~975 KB | ~260 KB | -73% |

### Configuration SSR

La configuration SSR utilise `noExternal: true` pour le build SSR (bundler tous les packages) avec une liste explicite de packages externes :

```ts
// vite.config.ts
ssr: {
  noExternal: isSsrBuild ? true : undefined,
  external: isSsrBuild
    ? [
        'express',
        'compression',
        'serialize-javascript',
        'isomorphic-dompurify',
        '@communecter/cocolight-api-client',
        'sharp',
        'pino',
        'pino-pretty',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ]
    : [
        '@communecter/cocolight-api-client',
        'pino',
        'pino-pretty',
      ],
}
```

**Points cles** :
* En build SSR (`isSsrBuild = true`) : `noExternal: true` bundle tout, sauf les packages listés dans `external`
* En dev SSR (`isSsrBuild = false`) : seuls `@communecter/cocolight-api-client`, `pino` et `pino-pretty` sont externes
* React et React DOM sont externes en build SSR pour eviter la duplication avec le client

---

## Optimisation des images — Middleware sharp

Le middleware Express `/img` optimise les images a la volee avec **sharp** (resize + conversion de format) et les met en cache sur disque.

### Architecture

```
Navigateur  →  GET /img?url=/images/bg.jpg&w=800&f=auto
                    ↓
            [Middleware imageOptimizer]
                    ↓
            Cache disque (.cache/images/)
            ├── HIT  → stream le fichier cache (immutable, 1 an)
            └── MISS → fetch source → sharp(resize+format) → cache + reponse
```

### Route API

`GET /img?url=<source>&w=<width>&h=<height>&q=<quality>&f=<format>`

| Param | Requis | Defaut | Validation |
|-------|--------|--------|------------|
| `url` | Oui | — | String, domaine dans allowlist ou chemin local (`/...`) |
| `w` | Non | original | Entier 16..4096 |
| `h` | Non | original | Entier 16..4096 |
| `q` | Non | 80 | Entier 1..100 |
| `f` | Non | `auto` | `webp`, `avif`, `jpeg`, `png`, `auto` |

* **Format `auto`** : negocie via le header `Accept` du navigateur (AVIF > WebP > JPEG)
* **Cache** : cle SHA-256 de `url:w:h:q:format_resolu` (le format negocié est inclus dans la clé — pas le `auto` brut), header `Cache-Control: public, max-age=31536000, immutable`
* **Resize** : sharp avec `fit: "inside"`, `withoutEnlargement: true` — l'image n'est jamais agrandie, le ratio est préservé si une seule dimension est fournie
* **Formats d'entrée supportes** : JPEG, PNG, WebP, AVIF, GIF, TIFF — validés par lecture des magic bytes du buffer (pas seulement l'extension)
* **Header `X-Image-Cache`** :
  - `HIT` — réponse depuis le cache disque
  - `MISS` — transformation effectuée, mise en cache
  - `ERROR` — erreur sharp, fallback vers l'image source originale (avec `Cache-Control: public, max-age=3600`)
  - `PASSTHROUGH` — image locale dont le format n'est pas reconnu par les magic bytes, servie telle quelle sans transformation

**Comportements spéciaux :**

* **SVG locaux** (`url` se termine par `.svg`) : redirect 301 vers l'URL source, pas de transformation
* **SVG distants** (Content-Type `image/svg+xml`) : proxié sans transformation avec `Cache-Control: public, max-age=86400` (1 jour, pas immutable)
* **data URIs** (`url` commence par `data:`) : redirect 301 vers l'URL source
* **Fetch distant** : timeout de 10 secondes (`AbortSignal.timeout(10_000)`), erreur 502 si l'upstream retourne un status non-2xx ou si le fetch échoue, erreur 400 si la réponse n'est pas de type `image/*` (message « Not an image »)

### Securite

* **Allowlist de domaines** pour les URLs distantes : construite dynamiquement depuis `localhost`/`127.0.0.1` + hostname de `VITE_BASE_URL_BACKEND` + domaines dans `IMAGE_OPTIMIZER_ALLOWED_DOMAINS` (séparés par virgules). Les URLs distantes hors allowlist reçoivent une 403.
* **Protection path traversal** pour les fichiers locaux : `path.resolve(localPath)` doit commencer par `path.resolve(staticRoot)`, sinon 403.
* Les chemins locaux doivent commencer par `/` (chemin absolu depuis la racine statique).
* **Validation du Content-Type distant** : la réponse doit avoir un Content-Type `image/*`, sinon 400.
* **Validation magic bytes** : le buffer est inspecté octet par octet (PNG, JPEG, WebP, GIF, AVIF/HEIF, TIFF) — les fichiers non reconnus sont rejetés (400) sauf pour les fichiers locaux qui sont servis en passthrough.

### Utilitaire `buildOptimizedUrl`

```ts
import { buildOptimizedUrl } from "@/lib/imageUtils";

buildOptimizedUrl("/images/bg.jpg", { w: 800, q: 80, f: "auto" });
// → "/img?url=%2Fimages%2Fbg.jpg&w=800&q=80&f=auto"

buildOptimizedUrl("images/foo.png", { w: 400 });
// → "/img?url=%2Fimages%2Ffoo.png&w=400"  (chemin relatif normalisé en absolu)
```

Bypass automatique (retourne `src` tel quel sans construire l'URL `/img`) pour :
* `src` vide ou falsy
* SVG (extension `.svg`)
* data URIs (commence par `data:`)
* blob URLs (commence par `blob:`)

Les chemins relatifs (ex. `images/foo.png`) sont normalisés en chemin absolu (`/images/foo.png`) avant encodage dans le query param `url`.

### Docker

Le cache d'images est persiste via un volume Docker :

```yaml
# docker-compose.yml
volumes:
  - image-cache:/app/.cache/images
```

---

## Caching et hydratation des données

* **React Query** gère le cache des requêtes API :

  ```tsx
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, refetchOnWindowFocus: false }
    }
  });
  ```
* **Streaming SSR + Hydrate** :

  * Côté serveur, on collecte l'état via `dehydrate(queryClient)` après toutes les requêtes.
  * Côté client, `Hydrate` réinjecte cet état pour éviter de refetcher.

---

## Compression et réseau

* **Compression gzip** (Express) :

  ```js
  import compression from "compression";
  app.use(compression());
  ```
* **HTTP/2** : conseillé pour réduire la latence des multiples requêtes de chunks.
* **Preload SSR dynamique** — à chaque requête SSR, `entry-server.tsx` injecte dans le `<head>` trois catégories de hints, dans cet ordre de priorité :

  1. **Google Fonts** (`extractCriticalFonts` + `generateFontPreloadTags`) : `<link rel="preconnect">` + `<link rel="preload">` pour chaque famille Google Fonts configurée dans le site JSON.
  2. **Images LCP** (`extractCriticalImages` + `generateImagePreloadTags`) : `<link rel="preload" as="image">` pour les images critiques de la page en cours (banner hero, logo, etc.), extraites depuis la config JSON et les données de loaders.
  3. **Chunks lazy** (`collector.getTags()` via `ChunkCollectorContext`) : `<link rel="modulepreload">` pour chaque chunk `vite-preload` utilisé lors du rendu de la page.

  Ces hints sont injectés dans `onShellReady` avant de commencer le streaming du corps HTML, ce qui donne au navigateur un maximum d'avance pour charger les ressources critiques.

---

## Voir aussi

- [Sections dynamiques](06-sections-dynamiques.md)
- [Backend & SSR](14-backend-ssr.md)
- [Déploiement Docker](16-deploiement-docker.md)
