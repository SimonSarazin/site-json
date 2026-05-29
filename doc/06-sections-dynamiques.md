[← Retour à l'index](README.md)

# Sections dynamiques

**Sommaire**

- [Sections dynamiques](#sections-dynamiques)
  - [Vue d'ensemble de `SectionRenderer.tsx`](#vue-densemble-de-sectionrenderertsx)
    - [Code actuel](#code-actuel)
  - [Propriétés communes à toutes les sections](#propriétés-communes-à-toutes-les-sections)
  - [Description rapide des principaux types de section](#description-rapide-des-principaux-types-de-section)
    - [Sections de contenu \& layout](#sections-de-contenu--layout)
    - [Sections de données \& commerce](#sections-de-données--commerce)
    - [Sections d'engagement](#sections-dengagement)
    - [Sections de formulaires](#sections-de-formulaires)
    - [Sections de liste \& événements](#sections-de-liste--événements)
    - [Sections de recherche \& carte (depuis modules)](#sections-de-recherche--carte-depuis-modules)
    - [Sections RezoLaMer \& Commune Transparente](#sections-rezolamer--commune-transparente)
    - [Section news (depuis module news)](#section-news-depuis-module-news)
    - [Autres](#autres)
  - [Comment ajouter ou personnaliser une nouvelle section](#comment-ajouter-ou-personnaliser-une-nouvelle-section)
  - [Voir aussi](#voir-aussi)

---

Cette partie explique comment SiteForge transforme votre configuration JSON en composants React, grâce à un moteur générique de rendu des sections.

---

## Vue d'ensemble de `SectionRenderer.tsx`

Le fichier `src/components/sections/SectionRenderer.tsx` centralise le rendu de toutes les sections. Son principe :

1. **Mapping** : il associe chaque `type` de section (ex. `"hero"`) à un composant React lazy-loaded.
2. **Lazy Loading** : utilise `lazy()` de **vite-preload** (pas `React.lazy`) pour tracer les chunks correctement.
3. **Suspense + ErrorBoundary** : gère le chargement asynchrone et les erreurs.
4. **Rendu** : injecte les `props` dans le composant avec fallbacks appropriés.

### Code actuel

```tsx
import { Suspense } from "react";
import { lazy } from "vite-preload"; // Utiliser lazy de vite-preload pour tracer les chunks
import type { PreloadableComponent } from "react-lazy-with-preload";
import type { Section, SectionPropsMap } from "@/types/site";
import { ErrorBoundary } from "../layout/ErrorBoundary";

// vite-preload retourne PreloadableComponent au lieu de LazyExoticComponent
type LazySectionComponent<T extends Section['type']> =
  PreloadableComponent<
    React.ComponentType<{ id?: string; props: SectionPropsMap[T] }>
  >;

// Mapping « type » → Composant lazy-loaded
// Chaque entrée crée un CHUNK séparé (code‑splitting).
// IMPORTANT: Utiliser lazy() directement (pas lazyNamed) pour que vite-preload
// puisse tracer les chunks correctement. Tous les composants doivent avoir
// un export default.
const LazySections: {
  [K in keyof SectionPropsMap]: LazySectionComponent<K>;
} = {
  hero: lazy(() => import("./HeroSection")),
  "hero-tiers-lieux": lazy(() => import("./HeroTiersLieux")),
  "hero-rezo-la-mer": lazy(() => import("./HeroRezoLaMer")),
  "features-rezo-la-mer": lazy(() => import("./FeaturesRezoLaMer")),
  "action-buttons-rezo-la-mer": lazy(() => import("./ActionButtonsRezoLaMer")),
  "community-rezo-la-mer": lazy(() => import("./CommunityRezoLaMer")),
  "cta-rezo-la-mer": lazy(() => import("./CallToActionRezoLaMer")),
  "title-with-filters-rezo-la-mer": lazy(() => import("./TitleWithFiltersRezoLaMer")),
  "commune-transparente-actions": lazy(() => import("./CommuneTransparenteActionsSection")),
  "hero-nos-communes": lazy(() => import("./NosCommunesBannerSection")),
  "hero-commune-transparente": lazy(() => import("./HeroCommuneTransparenteSection")),
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
  searchPro: lazy(() => import("@/modules/search/SearchProSection")),
  searchProStatic: lazy(() => import("@/modules/search/SearchProStaticSection")),
  cardCountCT: lazy(() => import("@/modules/search/CardCountCTSection")),
  thematics: lazy(() => import("@/modules/search/components/card/ThematicsSection")),
  filters: lazy(() => import("./FiltersSection")),
  gridLayout: lazy(() => import("./GridLayoutSection")),
  news: lazy(() => import("@/modules/news/components/sections/NewsSection")),
  member: lazy(() => import("./MemberSection")),
  heroWithIcon: lazy(() => import("./HeroWithIconSection")),
  meeteem: lazy(() => import("@/modules/ampli/components/sections/MeeteemSection")),
};

// Fallback skeleton pour les sections en cours de chargement
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

**Points clés** :
- **vite-preload** : remplace `React.lazy` pour un meilleur tracking des chunks SSR
- **ErrorBoundary** : isole les erreurs de rendu par section
- **SectionLoadingFallback** : skeleton animé pendant le chargement
- **Types stricts** : `SectionPropsMap` assure la cohérence des props

---

## Propriétés communes à toutes les sections

Bien que chaque section possède son propre schéma Zod et ses props spécifiques, certaines conventions sont partagées :

* **`type`** : identifiant unique (string littéral).
* **`id`** (optionnel) : permet l'ancrage (`<section id={id}>`).
* **`props`** : objet validé contenant toutes les données nécessaires au composant.

Ces conventions garantissent que `SectionRenderer` peut traiter **toutes** les sections uniformément.

---

## Description rapide des principaux types de section

Le système supporte actuellement **57 types de sections** :

### Sections de contenu & layout

| Type               | Composant                | Usage principal                                                        |
| ------------------ | ------------------------ | ---------------------------------------------------------------------- |
| **hero**           | `HeroSection`            | Bandeau d'accueil avec titre, sous-titre, image de fond et boutons CTA |
| **hero-tiers-lieux** | `HeroTiersLieux`       | Hero spécialisé pour Tiers-Lieux avec recherche intégrée               |
| **cards**          | `CardsSection`           | Grille de cartes (grid/masonry/carousel/list)                          |
| **content**        | `ContentSection`         | Bloc de contenu riche avec image, texte, tags et liens                 |
| **title**          | `TitleSection`           | Titre centré pour séparer les parties d'une page                       |
| **markdown**       | `MarkdownSection`        | Contenu Markdown/MDX                                                   |
| **gallery**        | `GallerySection`         | Galerie d'images avec lightbox                                         |
| **video**          | `VideoSection`           | YouTube/Vimeo/Loom/local video                                         |
| **html**           | `HTMLSection`            | Injection HTML brut                                                    |
| **gridLayout**     | `GridLayoutSection`      | Layout en grille deux colonnes configurable                            |

### Sections de données & commerce

| Type                 | Composant                  | Usage principal                                   |
| -------------------- | -------------------------- | ------------------------------------------------- |
| **pricing**          | `PricingSection`           | Présentation des offres et tarifs                 |
| **stats**            | `StatsSection`             | Affichage chiffré (valeurs, icônes, animation)    |
| **table**            | `TableSection`             | Tableau de données sortable/paginable             |
| **chart**            | `ChartSection`             | Visualisation Recharts (line/bar/pie/area/radar)  |
| **productShowcase**  | `ProductShowcaseSection`   | Présentation de produits                          |
| **comparison**       | `ComparisonSection`        | Comparaison avant/après d'images                  |
| **featureComparison**| `FeatureComparisonSection` | Tableau comparatif de features                    |

### Sections d'engagement

| Type             | Composant              | Usage principal                              |
| ---------------- | ---------------------- | -------------------------------------------- |
| **testimonials** | `TestimonialsSection`  | Témoignages clients (grid/carousel/ticker)   |
| **faq**          | `FAQSection`           | Questions/réponses accordéon                 |
| **accordion**    | `AccordionSection`     | Accordéon personnalisé (distinct de FAQ)     |
| **tabs**         | `TabsSection`          | Contenu à onglets (support sections imbriquées) |
| **steps**        | `StepsSection`         | Étapes/progression                           |
| **timeline**     | `TimelineSection`      | Chronologie d'événements                     |
| **team**         | `TeamSection`          | Présentation des membres d'équipe            |
| **cta**          | `CTASection`           | Appel à l'action avec boutons                |
| **banner**       | `BannerSection`        | Bandeau d'annonce (info/warning/error)       |
| **logoCloud**    | `LogoCloudSection`     | Logos partenaires/clients                    |
| **breadcrumb**   | `BreadcrumbSection`    | Navigation fil d'Ariane                      |

### Sections de formulaires

| Type                   | Composant                    | Usage principal                    |
| ---------------------- | ---------------------------- | ---------------------------------- |
| **contactForm**        | `ContactFormSection`         | Formulaire de contact configurable |
| **loginForm**          | `LoginFormSection`           | Formulaire de connexion            |
| **registerForm**       | `RegisterFormSection`        | Formulaire d'inscription           |
| **recoverPasswordForm**| `RecoverPasswordFormSection` | Récupération de mot de passe       |
| **newsletter**         | `NewsletterSection`          | Inscription newsletter             |

### Sections de liste & événements

| Type          | Composant           | Usage principal                         |
| ------------- | ------------------- | --------------------------------------- |
| **blogPost**  | `BlogPostSection`   | Article de blog individuel              |
| **blogList**  | `BlogListSection`   | Liste/grille d'articles                 |
| **eventList** | `EventListSection`  | Liste/grille/calendrier d'événements    |
| **socialFeed**| `SocialFeedSection` | Widget flux réseaux sociaux             |

### Sections de recherche & carte (depuis modules)

| Type              | Composant                  | Usage principal                                         |
| ----------------- | -------------------------- | ------------------------------------------------------- |
| **searchPro**     | `SearchProSection`         | Recherche avancée avec filtres, carte et liste          |
| **searchProStatic** | `SearchProStaticSection` | Recherche statique (pas de sync URL, multi-instances)   |
| **cardCountCT**   | `CardCountCTSection`       | Compteurs par type d'entité (Commune Transparente)      |
| **thematics**     | `ThematicsSection`         | Affichage dynamique des filières/thématiques            |
| **map**           | `MapSection`               | Carte interactive (Leaflet/Google/Mapbox)               |
| **filters**       | `FiltersSection`           | Groupes de filtres dépliables                           |

### Sections RezoLaMer & Commune Transparente

| Type                              | Composant                              | Usage principal                                    |
| --------------------------------- | -------------------------------------- | -------------------------------------------------- |
| **hero-rezo-la-mer**              | `HeroRezoLaMer`                        | Hero spécialisé RezoLaMer                          |
| **features-rezo-la-mer**          | `FeaturesRezoLaMer`                    | Features spécialisées RezoLaMer                    |
| **action-buttons-rezo-la-mer**    | `ActionButtonsRezoLaMer`               | Boutons d'action RezoLaMer                         |
| **community-rezo-la-mer**         | `CommunityRezoLaMer`                   | Section communauté RezoLaMer                       |
| **cta-rezo-la-mer**               | `CallToActionRezoLaMer`                | Appel à l'action RezoLaMer                         |
| **title-with-filters-rezo-la-mer**| `TitleWithFiltersRezoLaMer`            | Titre avec filtres RezoLaMer                       |
| **commune-transparente-actions**  | `CommuneTransparenteActionsSection`    | Actions Commune Transparente                       |
| **hero-nos-communes**             | `NosCommunesBannerSection`             | Bannière Nos Communes                              |
| **hero-commune-transparente**     | `HeroCommuneTransparenteSection`       | Hero Commune Transparente                          |

### Section news (depuis module news)

| Type     | Composant      | Usage principal                              |
| -------- | -------------- | -------------------------------------------- |
| **news** | `NewsSection`  | Flux d'actualités avec commentaires/réactions |

### Autres

| Type              | Composant              | Usage principal                         |
| ----------------- | ---------------------- | --------------------------------------- |
| **cookieConsent** | `CookieConsentSection` | Bandeau de consentement cookies         |
| **member**        | `MemberSection`        | Affichage de membres                    |
| **heroWithIcon**  | `HeroWithIconSection`  | Hero avec icône                         |
| **meeteem**       | `MeeteemSection`       | Section Meeteem (module ampli)          |

Chaque composant se trouve dans `src/components/sections/<Type>Section.tsx` ou dans le module correspondant (ex: `@/modules/search/SearchProSection`) et lit ses props typés.

---

## Comment ajouter ou personnaliser une nouvelle section

Pour créer une section sur mesure :

1. **Définir le schéma Zod** dans `src/types/site-schema.ts`

   ```ts
   // Dans src/types/site-schema.ts
   export const MySectionProps = z.object({
     title: LocalizedString,
     items: z.array(z.string()),
   });
   ```

   Ajouter le type dans `SectionPropsMap` :

   ```ts
   export const SectionPropsMap = {
     // ...
     mySection: MySectionProps,
   };
   ```

2. **Créer le composant React** avec un `export default`

   ```tsx
   // src/components/sections/MySectionSection.tsx
   import type { z } from "zod";
   import type { MySectionProps } from "@/types/site-schema";

   function MySectionSection({ props }: { id?: string; props: z.infer<typeof MySectionProps> }) {
     return (
       <section>
         <h2>{props.title.fr}</h2>
         <ul>
           {props.items.map((item, i) => <li key={i}>{item}</li>)}
         </ul>
       </section>
     );
   }

   export default MySectionSection;
   ```

3. **Enregistrer dans `SectionRenderer.tsx`**

   Ajouter au mapping `LazySections` :

   ```ts
   const LazySections = {
     // ...
     mySection: lazy(() => import("./MySectionSection")),
   };
   ```

   > **Important** : utiliser `lazy()` de vite-preload (pas `lazyNamed`), et le composant doit avoir un `export default`.

4. **Mettre à jour la configuration JSON**
   Dans `config.prod.json` (ou fichier `.env` via `SITE_CONFIG_JSON`), ajoutez une section :

   ```json
   {
     "type": "mySection",
     "props": {
       "title": { "fr": "Ma section perso", "en": "My custom section" },
       "items": ["Item 1", "Item 2"]
     }
   }
   ```

---

## Voir aussi

- [Schémas sections](05-schemas-sections.md)
- [Architecture](03-architecture.md)
- [Performance](12-performance.md)
