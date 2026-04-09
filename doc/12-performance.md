[← Retour à l'index](README.md)

# Performance et optimisation

**Sommaire**

- [Performance et optimisation](#performance-et-optimisation)
  - [Lazy loading des sections et des images](#lazy-loading-des-sections-et-des-images)
    - [Chargement asynchrone des sections](#chargement-asynchrone-des-sections)
    - [Optimisation et lazy loading des images](#optimisation-et-lazy-loading-des-images)
  - [Code splitting et bundling](#code-splitting-et-bundling)
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
import { ErrorBoundary } from "../layout/ErrorBoundary";

// Type pour les composants lazy avec préchargement
type LazySectionComponent<T extends Section['type']> =
  PreloadableComponent<
    React.ComponentType<{ id?: string; props: SectionPropsMap[T] }>
  >;

// Mapping « type » → Composant lazy-loaded
// IMPORTANT: Utiliser lazy() directement (pas lazyNamed) pour que vite-preload
// puisse tracer les chunks correctement. Tous les composants doivent avoir
// un export default.
const LazySections: {
  [K in keyof SectionPropsMap]: LazySectionComponent<K>;
} = {
  hero: lazy(() => import("./HeroSection")),
  "hero-tiers-lieux": lazy(() => import("./HeroTiersLieux")),
  "hero-rezo-la-mer": lazy(() => import("./HeroRezoLaMer")),
  cards: lazy(() => import("./CardsSection")),
  // ... 57 types de sections au total
  searchPro: lazy(() => import("@/modules/search/SearchProSection")),
  searchProStatic: lazy(() => import("@/modules/search/SearchProStaticSection")),
  cardCountCT: lazy(() => import("@/modules/search/CardCountCTSection")),
  thematics: lazy(() => import("@/modules/search/components/card/ThematicsSection")),
  news: lazy(() => import("@/modules/news/components/sections/NewsSection")),
  member: lazy(() => import("./MemberSection")),
  heroWithIcon: lazy(() => import("./HeroWithIconSection")),
  meeteem: lazy(() => import("@/modules/ampli/components/sections/MeeteemSection")),
};

// Skeleton animé pendant le chargement
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
  const sectionContext = `Section[type=${section.type}, id=${section.id || "none"}]`;
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
          <LazyComponent id={section.id} props={section.props} />
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
* Genere automatiquement un `srcSet` 1x/2x quand `width` est fourni
* `loading="lazy"` par defaut, `loading="eager"` + `fetchPriority="high"` si `priority`
* Bypass automatique pour SVG, data URIs et blob URLs (rendu `<img>` classique)
* Les chemins relatifs (`images/foo.png`) sont normalises en `/images/foo.png`

---

## Code splitting et bundling

* **Entrées multiples** : Vite sépare le code `entry-client.tsx` et `entry-server.tsx` en bundles distincts.
* **Chunks par import dynamique** : chaque `React.lazy` crée un nouveau chunk, optimisant le cache et le parallélisme.
* **Configuration Vite** (`vite.config.ts`) :

  ```ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core, Radix UI, TanStack Query, Lucide icons, etc.
          // Voir vite.config.ts pour le mapping complet
        }
      }
    }
  }
  ```

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
* **Cache** : cle SHA-256 de `url:w:h:q:format`, header `Cache-Control: public, max-age=31536000, immutable`
* **Header `X-Image-Cache`** : `HIT`, `MISS` ou `ERROR` (fallback vers l'image originale)

### Securite

* **Allowlist de domaines** pour les URLs distantes (construit depuis `VITE_BASE_URL_BACKEND` + `IMAGE_OPTIMIZER_ALLOWED_DOMAINS`)
* **Protection path traversal** pour les fichiers locaux (`path.resolve` verifie que le chemin reste dans `staticRoot`)
* Les chemins locaux doivent commencer par `/`

### Utilitaire `buildOptimizedUrl`

```ts
import { buildOptimizedUrl } from "@/lib/imageUtils";

buildOptimizedUrl("/images/bg.jpg", { w: 800, q: 80, f: "auto" });
// → "/img?url=%2Fimages%2Fbg.jpg&w=800&q=80&f=auto"
```

Bypass automatique pour SVG, data URIs et blob URLs (retourne `src` tel quel).

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
* **Préfetch / Preconnect** dans le `<head>` :

  ```html
  <link rel="preconnect" href="https://api.monsite.com">
  <link rel="preload" href="/assets/hero-section.js" as="script">
  ```

---

## Voir aussi

- [Sections dynamiques](06-sections-dynamiques.md)
- [Backend & SSR](14-backend-ssr.md)
- [Déploiement Docker](16-deploiement-docker.md)
