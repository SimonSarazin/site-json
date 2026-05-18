import { Suspense } from "react";
import { lazy } from "vite-preload"; // Utiliser lazy de vite-preload pour tracer les chunks
import type { PreloadableComponent } from "react-lazy-with-preload";
import type { Section, SectionPropsMap } from "@/types/site";
import { useCocolight } from "@/hooks/useCocolight";
import { ErrorBoundary } from "../layout/ErrorBoundary";

// vite-preload retourne PreloadableComponent au lieu de LazyExoticComponent
type LazySectionComponent<T extends Section['type']> =
  PreloadableComponent<
    React.ComponentType<{ id?: string; props: SectionPropsMap[T] }>
  >;

// -----------------------------------------------------------------------------
// Mapping « type » → Composant paresseux
// Chaque entrée crée un CHUNK séparé (code‑splitting).
// IMPORTANT: Utiliser lazy() directement (pas lazyNamed) pour que vite-preload
// puisse tracer les chunks correctement. Tous les composants doivent avoir
// un export default.
// -----------------------------------------------------------------------------
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
  loginForm: lazy(() => import("./LoginFormSection")),
  registerForm: lazy(() => import("./RegisterFormSection")),
  recoverPasswordForm: lazy(() => import("./RecoverPasswordFormSection")),
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
  coform: lazy(() => import("@/modules/coform/components/CoFormSection")),
  actions: lazy(() => import("@/modules/cagnotte/components/sections/ActionsSection")),
  finance: lazy(() => import("@/modules/cagnotte/components/sections/FinanceSection")),
  "actions-summary": lazy(() => import("@/modules/cagnotte/components/sections/ActionsSummarySection")),
  "finance-summary": lazy(() => import("@/modules/cagnotte/components/sections/FinanceSummarySection")),
  "cagnotte-layout": lazy(() => import("@/modules/cagnotte/components/sections/CagnotteLayoutSection")),
};

// Fallback skeleton pour les sections en cours de chargement
// Ce fallback est visible en SSR et pendant l'hydratation
function SectionLoadingFallback({ id, type }: { id?: string; type: string }) {
  return (
    <section
      id={id}
      className="py-8 animate-pulse"
      data-loading-section={type}
    >
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
  const projectAwareSectionTypes: Section['type'][] = ['actions', 'finance', 'actions-summary', 'finance-summary'];
  const selectedProjectId = (() => {
      const propsRecord = section.props as Record<string, unknown>;
      const fromProps = typeof propsRecord?.idProjet === 'string' ? propsRecord.idProjet : '';
      if (fromProps) return fromProps;

      if (typeof window === 'undefined') return '';

      const storageScopeId = contextId || entity?.id || '';
      if (!storageScopeId) return '';

      return '';
    })();
  
    const resolvedSectionProps = projectAwareSectionTypes.includes(section.type)
      ? ({ ...(section.props as Record<string, unknown>), idProjet: selectedProjectId } as typeof section.props)
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
