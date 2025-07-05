import { lazy, Suspense } from "react";
import type { Section, SectionPropsMap } from "@/types/site";
import { ErrorBoundary } from "../layout/ErrorBoundary";

type LazySectionComponent<T extends Section['type']> =
  React.LazyExoticComponent<
    React.ComponentType<{ id?: string; props: SectionPropsMap[T] }>
  >;

/**
 * Certains fichiers de section exportent un composant NOMMÉ (ex. `export const HeroSection = …`).
 * React.lazy attend un export **par défaut**.
 * On transforme donc le module importé pour fournir `{ default: NamedExport }`.
 */
function lazyNamed<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mod extends Record<string, React.ComponentType<any>>, // <- reste `any` ici, c’est interne
  K extends keyof Mod
>(loader: () => Promise<Mod>, exportName: K) {
  // La lib React ne permet pas mieux : on ne connaît pas les props du composant avant d’importer le module.
  // Mais ce `any` est local ; il n’atteint plus SectionRenderer.
  return lazy(() => loader().then((m) => ({ default: m[exportName] })));
}

// -----------------------------------------------------------------------------
// Mapping « type » → Composant paresseux
// Chaque entrée crée un CHUNK séparé (code‑splitting).
// -----------------------------------------------------------------------------
const LazySections: {
  [K in keyof SectionPropsMap]: LazySectionComponent<K>;
} = {
  hero: lazyNamed(() => import("./HeroSection"), "HeroSection"),
  markdown: lazyNamed(() => import("./MarkdownSection"), "MarkdownSection"),
  cards: lazyNamed(() => import("./CardsSection"), "CardsSection"),
  gallery: lazyNamed(() => import("./GallerySection"), "GallerySection"),
  video: lazyNamed(() => import("./VideoSection"), "VideoSection"),
  testimonials: lazyNamed(() => import("./TestimonialsSection"), "TestimonialsSection"),
  pricing: lazyNamed(() => import("./PricingSection"), "PricingSection"),
  faq: lazyNamed(() => import("./FAQSection"), "FAQSection"),
  table: lazyNamed(() => import("./TableSection"), "TableSection"),
  blogPost: lazyNamed(() => import("./BlogPostSection"), "BlogPostSection"),
  blogList: lazyNamed(() => import("./BlogListSection"), "BlogListSection"),
  team: lazyNamed(() => import("./TeamSection"), "TeamSection"),
  stats: lazyNamed(() => import("./StatsSection"), "StatsSection"),
  cta: lazyNamed(() => import("./CTASection"), "CTASection"),
  logoCloud: lazyNamed(() => import("./LogoCloudSection"), "LogoCloudSection"),
  chart: lazyNamed(() => import("./ChartSection"), "ChartSection"),
  accordion: lazyNamed(() => import("./AccordionSection"), "AccordionSection"),
  tabs: lazyNamed(() => import("./TabsSection"), "TabsSection"),
  steps: lazyNamed(() => import("./StepsSection"), "StepsSection"),
  timeline: lazyNamed(() => import("./TimelineSection"), "TimelineSection"),
  banner: lazyNamed(() => import("./BannerSection"), "BannerSection"),
  map: lazyNamed(() => import("./MapSection"), "MapSection"),
  newsletter: lazyNamed(() => import("./NewsletterSection"), "NewsletterSection"),
  contactForm: lazyNamed(() => import("./ContactFormSection"), "ContactFormSection"),
  comparison: lazyNamed(() => import("./ComparisonSection"), "ComparisonSection"),
  featureComparison: lazyNamed(() => import("./FeatureComparisonSection"), "FeatureComparisonSection"),
  socialFeed: lazyNamed(() => import("./SocialFeedSection"), "SocialFeedSection"),
  eventList: lazyNamed(() => import("./EventListSection"), "EventListSection"),
  productShowcase: lazyNamed(() => import("./ProductShowcaseSection"), "ProductShowcaseSection"),
  breadcrumb: lazyNamed(() => import("./BreadcrumbSection"), "BreadcrumbSection"),
  cookieConsent: lazyNamed(() => import("./CookieConsentSection"), "CookieConsentSection"),
  html: lazyNamed(() => import("./HTMLSection"), "HTMLSection"),
  loginForm: lazyNamed(() => import("./LoginFormSection"), "LoginFormSection"),
  registerForm: lazyNamed(() => import("./RegisterFormSection"), "RegisterFormSection"),
  recoverPasswordForm: lazyNamed(() => import("./RecoverPasswordFormSection"), "RecoverPasswordFormSection"),
  searchPro: lazy(() =>
    import("@/modules/search").then(m => ({ default: m.SearchSection }))
  ),
};

export function SectionRenderer({ section }: { section: Section }) {
  const Component = LazySections[section.type] as React.ComponentType<{
    id?: string;
    props: typeof section.props;   // ← props réellement présentes à l’exécution
  }>;

  if (!Component) {
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

  // On transmet les props communes à tous les composants de section
  // `id` est utilisé comme ancres / scroll.
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={<section>⚠️ Section failed to load.</section>}>
        <Component id={section.id} props={section.props} />
      </ErrorBoundary>
    </Suspense>
  );
}
