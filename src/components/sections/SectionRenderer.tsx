import { lazy, Suspense } from "react";
import type { Section } from "@/types/site";

/**
 * Certains fichiers de section exportent un composant NOMMÉ (ex. `export const HeroSection = …`).
 * React.lazy attend un export **par défaut**.
 * On transforme donc le module importé pour fournir `{ default: NamedExport }`.
 */
function lazyNamed<T extends { [K in keyof T]: React.ComponentType<any> }, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K
) {
  return lazy(() => loader().then((m) => ({ default: m[exportName] })));
}

// -----------------------------------------------------------------------------
// Mapping « type » → Composant paresseux
// Chaque entrée crée un CHUNK séparé (code‑splitting).
// -----------------------------------------------------------------------------
const LazySections: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
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
  search: lazyNamed(() => import("./SearchSection"), "SearchSection"),
  eventList: lazyNamed(() => import("./EventListSection"), "EventListSection"),
  productShowcase: lazyNamed(() => import("./ProductShowcaseSection"), "ProductShowcaseSection"),
  breadcrumb: lazyNamed(() => import("./BreadcrumbSection"), "BreadcrumbSection"),
  cookieConsent: lazyNamed(() => import("./CookieConsentSection"), "CookieConsentSection"),
  html: lazyNamed(() => import("./HTMLSection"), "HTMLSection"),
  loginForm: lazyNamed(() => import("./LoginFormSection"), "LoginFormSection"),
  registerForm: lazyNamed(() => import("./RegisterFormSection"), "RegisterFormSection"),
  recoverPasswordForm: lazyNamed(() => import("./RecoverPasswordFormSection"), "RecoverPasswordFormSection"),
};

interface SectionRendererProps {
  section: Section;
}

export function SectionRenderer({ section }: SectionRendererProps) {
  const C = LazySections[section.type];

  if (!C) {
    return (
      <section id={section.id} className="py-16 bg-muted/30 text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground">
            Section type "{(section as Section).type}" not implemented yet
          </p>
        </div>
      </section>
    );
  }

  // On transmet les props communes à tous les composants de section
  // `id` est utilisé comme ancres / scroll.
  return (
    <Suspense fallback={null}>
      <C {...(section as Section).props} id={section.id} />
    </Suspense>
  );
}
