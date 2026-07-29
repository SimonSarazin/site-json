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
    - [Sections design spécialisées (ex-variantes de site)](#sections-design-spécialisées-ex-variantes-de-site)
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
  "hero-search": lazy(() => import("./HeroSearch")),
  "hero-parallax": lazy(() => import("./HeroParallax")),
  "hero-quick-access": lazy(() => import("./HeroQuickAccess")),
  "features-glass": lazy(() => import("./FeaturesGlass")),
  "action-tiles": lazy(() => import("./ActionTiles")),
  "cta-card-grid": lazy(() => import("./CtaCardGrid")),
  "cta-newsletter": lazy(() => import("./CtaNewsletter")),
  "searchHeader": lazy(() => import("./TitleWithFiltersRezoLaMer")),
  "expandable-actions": lazy(() => import("./ExpandableActions")),
  "hero-tinted-overlay": lazy(() => import("./HeroTintedOverlay")),
  "hero-entity-banner": lazy(() => import("./HeroEntityBanner")),
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

Le système supporte actuellement **66 types de sections** :

### Sections de contenu & layout

| Type               | Composant                | Usage principal                                                        |
| ------------------ | ------------------------ | ---------------------------------------------------------------------- |
| **hero**           | `HeroSection`            | Bandeau d'accueil avec titre, sous-titre, image de fond et boutons CTA |
| **hero-search** | `HeroSearch`       | Hero avec recherche intégrée (autocomplete d’entités), applicateur de filtres headless (`filterGroups`/`filtersByAnswers`) et autocompletion scopée réseau (`searchVariant`/`baseParams`). Le mode sous-site (`/s/`) et ses props (`headlineSubsite`, `subheadSubsite`) ont été supprimés. |
| **hero-quick-access**      | `HeroQuickAccess`               | Variante hero pour le site Sport-Santé-Bien-Être (SSBE)               |
| **categories-grid**| `CategoriesGridSection`  | Grille de catégories cliquables avec icônes et liens                   |
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

| Type                   | Composant                    | Usage principal                                            |
| ---------------------- | ---------------------------- | ---------------------------------------------------------- |
| **contactForm**        | `ContactFormSection`         | Formulaire de contact configurable                         |
| **loginForm**          | `LoginFormSection`           | Formulaire de connexion                                    |
| **registerForm**       | `RegisterFormSection`        | Formulaire d'inscription                                   |
| **recoverPasswordForm**| `RecoverPasswordFormSection` | Récupération de mot de passe                               |
| **newsletter**         | `NewsletterSection`          | Inscription newsletter                                     |
| **coform**             | `CoFormSection`              | Formulaire dynamique généré via CoForm (react-hook-form + Zod) |

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

### Sections design spécialisées (ex-variantes de site)

| Type                              | Composant                              | Usage principal                                    |
| --------------------------------- | -------------------------------------- | -------------------------------------------------- |
| **hero-parallax**              | `HeroParallax`                        | Hero spécialisé RezoLaMer                          |
| **features-glass**          | `FeaturesGlass`                    | Features spécialisées RezoLaMer                    |
| **action-tiles**    | `ActionTiles`               | Boutons d'action RezoLaMer                         |
| **cta-card-grid**         | `CtaCardGrid`                   | Section communauté RezoLaMer                       |
| **cta-newsletter**               | `CtaNewsletter`                | Appel à l'action RezoLaMer                         |
| **searchHeader**| `TitleWithFiltersRezoLaMer`            | Titre avec filtres RezoLaMer                       |
| **expandable-actions**  | `ExpandableActions`    | Cartes d’action en accordéon exclusif (modales)    |
| **hero-tinted-overlay**             | `HeroTintedOverlay`             | Hero plein écran à voile teinté + double slogan    |
| **hero-entity-banner**     | `HeroEntityBanner`       | Hero bannière sourcée depuis l’entité Cocolight    |

### Sections news & notifications (depuis modules)

| Type              | Composant              | Usage principal                                                        |
| ----------------- | ---------------------- | ---------------------------------------------------------------------- |
| **news**          | `NewsSection`          | Flux d'actualités avec commentaires/réactions                          |
| **notifications** | `NotificationsSection` | Panneau de notifications (Popover desktop / Sheet mobile), badge non-lus, redirection vers profil au clic |

### Sections cagnotte (depuis module cagnotte)

| Type                  | Composant                 | Usage principal                                                      |
| --------------------- | ------------------------- | -------------------------------------------------------------------- |
| **actions**           | `ActionsSection`          | Liste des actions de financement participatif d'un projet            |
| **finance**           | `FinanceSection`          | Tableau de bord financier (montants collectés, objectifs, Stripe/HelloAsso) |
| **actions-summary**   | `ActionsSummarySection`   | Résumé synthétique des actions en cours                              |
| **finance-summary**   | `FinanceSummarySection`   | Résumé financier condensé (progress bar, chiffres clés)              |
| **cagnotte-layout**   | `CagnotteLayoutSection`   | Layout conteneur orchestrant les sous-sections cagnotte              |

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

> ⚠️ **Ce n'est pas un changement en 3 étapes.** Les étapes 1 à 4 sont rattrapées par le compilateur,
> les 5 et 6 par `npm run test:preflight` — que **ni hook ni CI ne déclenche** (`.husky/` ne contient
> que `_`, il n'y a pas de `.github/workflows`) — et les étapes 7 à 10 échouent **en silence**.

1. **Déclarer le schéma Zod** dans `src/types/site-schema.ts`, en `const` **non exporté** englobant
   `type` + `id` + `props` (précédent : `HeroSectionSchema`). N'exporter que les types inférés.

   ```ts
   const MySectionSchema = z.object({
     type: z.literal("my-section"),
     id: z.string().optional(),
     props: z.object({
       title: LocalizedString,
       items: z.array(z.string()),
     }),
   });
   export type MySectionProps = z.infer<typeof MySectionSchema>["props"];
   ```

2. **L'inscrire dans l'union `Section`** (`export const Section = z.discriminatedUnion("type", [...])`).

   > ⚠️ **Ne jamais éditer `SectionPropsMap`** : c'est un type **dérivé** de l'union
   > (`{ [K in Section['type']]: … }`), et il ne vit **pas** dans `src/types/site.ts`.

3. **Créer le composant React** avec un `export default`, en **posant `id` sur l'élément racine** —
   c'est le mécanisme d'ancrage de la section — et en passant tout texte localisé par `useT`/`t`,
   jamais par `props.title.fr` (qui casse le changement de langue en silence).

   ```tsx
   // src/components/sections/MySectionSection.tsx
   import { useLocalization } from "@/hooks/useLocalization";
   import type { MySectionProps } from "@/types/site-schema";

   function MySectionSection({ id, props }: { id?: string; props: MySectionProps }) {
     const { t } = useLocalization();
     return (
       <section id={id}>
         <h2>{t(props.title)}</h2>
         <ul>
           {props.items.map((item, i) => <li key={i}>{item}</li>)}
         </ul>
       </section>
     );
   }

   export default MySectionSection;
   ```

4. **Enregistrer dans `SectionRenderer.tsx`**, clé et `lazy(` **sur la même ligne** (un test de
   préflight lit cette table à la regex) :

   ```ts
   const LazySections = {
     // ...
     "my-section": lazy(() => import("./MySectionSection")),
   };
   ```

   > **Important** : `lazy()` vient de **vite-preload** (ni `React.lazy`, qui ne trace pas le chunk et
   > prive la page de son `<link rel="modulepreload">`, ni `lazyNamed`), et le composant doit avoir un
   > `export default`.

5. **Ajouter l'entrée dans `SECTION_META`** (`src/components/admin/section-meta.ts`) : `label`,
   `desc` (> 10 caractères), `image`, `family` prise dans `SECTION_FAMILIES`. Un test de préflight
   impose une **parité exacte** union ⇄ `SECTION_META` ⇄ table `lazy()`, dans les deux sens.

6. **Mettre à jour les compteurs de sections** dans `CLAUDE.md` et `doc/26-assistant-config.md`, tous
   deux gatés par une regex de `tests/preflight/section-meta.test.ts`.

7. **Si la section porte une image de fond pleine largeur et peut être PREMIÈRE d'une page** : ajouter
   son type à `RESPONSIVE_BG_SECTION_TYPES` (`src/lib/extractCriticalResources.ts`), sans quoi elle
   n'émet **aucun `<link rel="preload">` LCP, en silence**. Rendre l'image via `HeroBackgroundImage`,
   dont les `srcSet` correspondent exactement au preload (un `<img>` maison provoque un **double
   téléchargement**).

8. **Écrire une story de props réelles** dans `.design-sync/previews/`, et déclarer le composant dans
   `.design-sync/config.json` (`componentSrcMap`) **et** `.design-sync/ds-entry.ts`.

9. **Documenter les props** dans `scripts/lib/prop-descriptions.ts` (alimente `config:schema section:<type>`).

10. **Mettre à jour les tables de la skill `config-assistant`** — rien ne les teste, la dérive y est silencieuse.

11. **Utiliser la section dans une config JSON** :

    ```json
    {
      "type": "my-section",
      "id": "ma-section",
      "props": {
        "title": { "fr": "Ma section perso", "en": "My custom section" },
        "items": ["Item 1", "Item 2"]
      }
    }
    ```

    > ⚠️ La config n'est **jamais** parsée par Zod à l'exécution : les `.default()` du schéma ne
    > s'appliquent pas. Écrire **chaque clé explicitement**, et placer les valeurs de repli dans le
    > code du composant.

**Portes, dans cet ordre** : `npm run lint` → `npm run typecheck` (toujours `tsc -b`) →
`npm run test:preflight` → `npm run config:render` (une section qui rend `null` passe toutes les
autres portes et sert quand même une page vide).

---

## Voir aussi

- [Schémas sections](05-schemas-sections.md)
- [Architecture](03-architecture.md)
- [Performance](12-performance.md)
