// ------------------------------------------------------------
// site-schema.ts – Schéma ultra‑complet d'un site piloté par JSON
// ------------------------------------------------------------
// Objectif : couvrir un maximum de cas d'usage « no‑code » sans modifier le runtime React.
// Technologies cibles : React 19 + Vite 5 + Tailwind 4 + shadcn/ui.
// Validation : Zod 3.x – le schéma sert à la fois de typings, de runtime‑guard,
//               et d'autocomplétion dans VS Code.
// ------------------------------------------------------------
import { z } from "zod";

/*───────────────────────────────────────────────────────────────*/
/* 1. Locales & textes                                           */
/*───────────────────────────────────────────────────────────────*/
export const LOCALES = ["fr", "en", "es", "de"] as const; // extensible
export type Locale = (typeof LOCALES)[number];

export const LocalizedString = z.record(z.enum(LOCALES), z.string().min(1));
export type LocalizedString = z.infer<typeof LocalizedString>;

/*───────────────────────────────────────────────────────────────*/
/* 2. Navigation                                                 */
/*───────────────────────────────────────────────────────────────*/
const NavBadge = z.object({ text: LocalizedString, color: z.string() }).optional();

// Define interface for the NavItem type
interface NavItemType {
  label: LocalizedString;
  path?: string;
  href?: string;
  icon?: string;
  badge?: z.infer<typeof NavBadge>;
  roles?: string[];
  children?: NavItemType[];
}

export const NavItem: z.ZodType<NavItemType> = z.lazy(() =>
  z.object({
    label: LocalizedString,
    path: z.string().min(1).optional(),   // route interne
    href: z.string().url().optional(),    // lien externe absolu
    icon: z.string().optional(),
    badge: NavBadge,
    roles: z.array(z.string()).optional(), // visibilité RBAC
    children: z.array(NavItem).optional(), // sous‑menu infini
  }).refine(d => d.path || d.href, { message: "NavItem : path ou href obligatoire" })
);
export type NavItem = z.infer<typeof NavItem>;

/*───────────────────────────────────────────────────────────────*/
/* 3. Sections – Bibliothèque étendue                            */
/*───────────────────────────────────────────────────────────────*/
// Helpers génériques
const Alignment = z.enum(["left", "center", "right"]);
const Columns   = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);

//──────────────── Hero
const HeroSection = z.object({
  type: z.literal("hero"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead:  LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    videoBg: z.string().optional(),
    align: Alignment.default("center"),
    overlay: z.boolean().default(false),
    cta: z.array(
      z.object({ label: LocalizedString, href: z.string(), variant: z.string().optional() })
    ).optional(),
    scrollTo: z.string().optional(),
  }),
});

//──────────────── Markdown / MDX
const MarkdownSection = z.object({
  type: z.literal("markdown"),
  id: z.string().optional(),
  props: z.object({
    md: z.string(),                // chemin .mdx ou contenu inline
    sourceType: z.enum(["file", "inline"]).default("file"),
    animation: z.string().optional(),
  }),
});

//──────────────── Cards / Features
const CardsSection = z.object({
  type: z.literal("cards"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(
      z.object({
        icon: z.string().optional(),
        image: z.string().optional(),
        title: LocalizedString,
        text: LocalizedString,
        href: z.string().optional(),
        target: z.enum(["_self", "_blank"]).optional(),
      })
    ),
    columns: Columns.default(3),
    layout: z.enum(["grid", "masonry", "carousel"]).default("grid"),
  }),
});

//──────────────── Gallery
const GallerySection = z.object({
  type: z.literal("gallery"),
  id: z.string().optional(),
  props: z.object({
    images: z.array(z.object({ src: z.string(), alt: LocalizedString.optional(), caption: LocalizedString.optional() })),
    columns: Columns.default(3),
    lightbox: z.boolean().default(true),
  }),
});

//──────────────── Video
const VideoSection = z.object({
  type: z.literal("video"),
  id: z.string().optional(),
  props: z.object({
    src: z.string(),
    provider: z.enum(["youtube", "vimeo", "local", "loom"]).default("youtube"),
    ratio: z.enum(["16/9", "4/3", "1/1", "9/16"]).default("16/9"),
    autoplay: z.boolean().optional(),
    controls: z.boolean().default(true),
    loop: z.boolean().default(false),
  }),
});

//──────────────── FAQ
const FAQSection = z.object({
  type: z.literal("faq"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({ q: LocalizedString, a: LocalizedString })),
    accordion: z.boolean().default(true),
  }),
});

//──────────────── Testimonials
const TestimonialsSection = z.object({
  type: z.literal("testimonials"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({ quote: LocalizedString, author: LocalizedString, role: LocalizedString.optional(), avatar: z.string().optional() })),
    style: z.enum(["grid", "carousel", "ticker"]).default("carousel"),
    autoplay: z.boolean().default(true),
  }),
});

//──────────────── Pricing
const PricingSection = z.object({
  type: z.literal("pricing"),
  id: z.string().optional(),
  props: z.object({
    currency: z.string().default("€"),
    plans: z.array(z.object({
      sku: z.string().optional(),
      name: LocalizedString,
      price: z.string(),
      period: z.string().optional(),
      features: z.array(LocalizedString),
      badge: LocalizedString.optional(),
      cta: z.object({ label: LocalizedString, href: z.string() }),
    })),
    highlight: z.number().int().optional(),
  }),
});

//──────────────── Contact Form
const ContactFormSection = z.object({
  type: z.literal("contactForm"),
  id: z.string().optional(),
  props: z.object({
    fields: z.array(z.object({
      name: z.string(),
      label: LocalizedString,
      type: z.enum(["text", "email", "tel", "number", "textarea", "select", "checkbox", "radio", "file"]).default("text"),
      required: z.boolean().default(false),
      placeholder: LocalizedString.optional(),
      options: z.array(LocalizedString).optional(),
      validation: z.string().optional(), // regex ou mot‑clé (email, tel…)
    })),
    submitLabel: LocalizedString,
    action: z.string(),
    method: z.enum(["GET", "POST"]).default("POST"),
    successMessage: LocalizedString.optional(),
    errorMessage: LocalizedString.optional(),
  }),
});

//──────────────── Blog Post
const BlogPostSection = z.object({
  type: z.literal("blogPost"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString,
    excerpt: LocalizedString.optional(),
    content: LocalizedString,
    author: z.object({
      name: LocalizedString,
      avatar: z.string().optional(),
      bio: LocalizedString.optional(),
    }).optional(),
    publishedAt: z.string().optional(),
    tags: z.array(LocalizedString).optional(),
    featuredImage: z.string().optional(),
    readTime: z.number().optional(),
  }),
});

//──────────────── Blog List
const BlogListSection = z.object({
  type: z.literal("blogList"),
  id: z.string().optional(),
  props: z.object({
    posts: z.array(z.object({
      id: z.string(),
      title: LocalizedString,
      excerpt: LocalizedString,
      slug: z.string(),
      publishedAt: z.string(),
      author: z.object({
        name: LocalizedString,
        avatar: z.string().optional(),
      }).optional(),
      featuredImage: z.string().optional(),
      tags: z.array(LocalizedString).optional(),
      readTime: z.number().optional(),
    })),
    layout: z.enum(["grid", "list", "masonry"]).default("grid"),
    columns: Columns.default(3),
    pagination: z.boolean().default(true),
    postsPerPage: z.number().default(9),
  }),
});

//──────────────── Team Section
const TeamSection = z.object({
  type: z.literal("team"),
  id: z.string().optional(),
  props: z.object({
    members: z.array(z.object({
      name: LocalizedString,
      role: LocalizedString,
      bio: LocalizedString.optional(),
      avatar: z.string(),
      socials: z.array(z.object({
        platform: z.string(),
        url: z.string(),
      })).optional(),
    })),
    layout: z.enum(["grid", "carousel"]).default("grid"),
    columns: Columns.default(3),
  }),
});

//──────────────── Stats/Metrics Section
const StatsSection = z.object({
  type: z.literal("stats"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({
      value: z.string(),
      label: LocalizedString,
      description: LocalizedString.optional(),
      icon: z.string().optional(),
    })),
    layout: z.enum(["horizontal", "vertical"]).default("horizontal"),
    animated: z.boolean().default(true),
  }),
});

//──────────────── CTA (Call to Action) Section
const CTASection = z.object({
  type: z.literal("cta"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    backgroundColor: z.string().optional(),
    buttons: z.array(z.object({
      label: LocalizedString,
      href: z.string(),
      variant: z.enum(["default", "secondary", "outline", "ghost"]).default("default"),
    })),
    align: Alignment.default("center"),
  }),
});

//──────────────── Logo Cloud/Partners
const LogoCloudSection = z.object({
  type: z.literal("logoCloud"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    logos: z.array(z.object({
      src: z.string(),
      alt: LocalizedString,
      href: z.string().optional(),
    })),
    grayscale: z.boolean().default(true),
    animated: z.boolean().default(false),
  }),
});

//──────────────── Accordion Section
const AccordionSection = z.object({
  type: z.literal("accordion"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({
      title: LocalizedString,
      content: LocalizedString,
      defaultOpen: z.boolean().default(false),
    })),
    allowMultiple: z.boolean().default(false),
  }),
});

//──────────────── Tabs Section
const TabsSection = z.object({
  type: z.literal("tabs"),
  id: z.string().optional(),
  props: z.object({
    tabs: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      content: LocalizedString,
      icon: z.string().optional(),
    })),
    defaultTab: z.string().optional(),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  }),
});

//──────────────── Progress/Steps Section
const StepsSection = z.object({
  type: z.literal("steps"),
  id: z.string().optional(),
  props: z.object({
    steps: z.array(z.object({
      title: LocalizedString,
      description: LocalizedString,
      icon: z.string().optional(),
      completed: z.boolean().default(false),
    })),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
    showProgress: z.boolean().default(true),
  }),
});

//──────────────── Before/After Comparison
const ComparisonSection = z.object({
  type: z.literal("comparison"),
  id: z.string().optional(),
  props: z.object({
    beforeImage: z.string(),
    afterImage: z.string(),
    beforeLabel: LocalizedString.optional(),
    afterLabel: LocalizedString.optional(),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  }),
});

//──────────────── Feature Comparison Table
const FeatureComparisonSection = z.object({
  type: z.literal("featureComparison"),
  id: z.string().optional(),
  props: z.object({
    features: z.array(z.object({
      name: LocalizedString,
      description: LocalizedString.optional(),
    })),
    plans: z.array(z.object({
      name: LocalizedString,
      features: z.array(z.union([z.boolean(), z.string()])), // true/false or custom text
      highlighted: z.boolean().default(false),
    })),
  }),
});

//──────────────── Social Feed
const SocialFeedSection = z.object({
  type: z.literal("socialFeed"),
  id: z.string().optional(),
  props: z.object({
    platform: z.enum(["twitter", "instagram", "linkedin", "facebook"]),
    feedId: z.string(),
    limit: z.number().default(6),
    layout: z.enum(["grid", "carousel", "masonry"]).default("grid"),
  }),
});

//──────────────── Search Section
const SearchSection = z.object({
  type: z.literal("search"),
  id: z.string().optional(),
  props: z.object({
    placeholder: LocalizedString,
    searchEndpoint: z.string(),
    categories: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
    })).optional(),
    filters: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      type: z.enum(["checkbox", "radio", "range"]),
      options: z.array(z.object({
        value: z.string(),
        label: LocalizedString,
      })).optional(),
    })).optional(),
  }),
});

//──────────────── Event List
const EventListSection = z.object({
  type: z.literal("eventList"),
  id: z.string().optional(),
  props: z.object({
    events: z.array(z.object({
      id: z.string(),
      title: LocalizedString,
      description: LocalizedString,
      startDate: z.string(),
      endDate: z.string().optional(),
      location: LocalizedString.optional(),
      image: z.string().optional(),
      registrationUrl: z.string().optional(),
      price: z.string().optional(),
      tags: z.array(LocalizedString).optional(),
    })),
    layout: z.enum(["list", "grid", "calendar"]).default("list"),
    showPastEvents: z.boolean().default(false),
  }),
});

//──────────────── Product Showcase
const ProductShowcaseSection = z.object({
  type: z.literal("productShowcase"),
  id: z.string().optional(),
  props: z.object({
    products: z.array(z.object({
      id: z.string(),
      name: LocalizedString,
      description: LocalizedString,
      price: z.string().optional(),
      images: z.array(z.string()),
      features: z.array(LocalizedString).optional(),
      cta: z.object({
        label: LocalizedString,
        href: z.string(),
      }).optional(),
    })),
    layout: z.enum(["grid", "carousel", "featured"]).default("grid"),
    showPrices: z.boolean().default(true),
  }),
});

//──────────────── Breadcrumb
const BreadcrumbSection = z.object({
  type: z.literal("breadcrumb"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({
      label: LocalizedString,
      href: z.string().optional(),
    })),
    separator: z.string().default("/"),
  }),
});

//──────────────── Cookie Consent
const CookieConsentSection = z.object({
  type: z.literal("cookieConsent"),
  id: z.string().optional(),
  props: z.object({
    message: LocalizedString,
    acceptLabel: LocalizedString,
    declineLabel: LocalizedString.optional(),
    settingsLabel: LocalizedString.optional(),
    policyUrl: z.string().optional(),
    position: z.enum(["bottom", "top", "bottom-left", "bottom-right"]).default("bottom"),
    categories: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      description: LocalizedString,
      required: z.boolean().default(false),
    })).optional(),
  }),
});

//──────────────── Table (sortable / paginée)
const TableSection = z.object({
  type: z.literal("table"),
  id: z.string().optional(),
  props: z.object({
    headers: z.array(LocalizedString),
    rows: z.array(z.array(LocalizedString)),
    sortable: z.boolean().default(true),
    pagination: z.boolean().default(false),
    perPage: z.number().int().default(10),
  }),
});

//──────────────── Chart (via recharts)
const ChartSection = z.object({
  type: z.literal("chart"),
  id: z.string().optional(),
  props: z.object({
    kind: z.enum(["line", "bar", "pie", "area", "radar"]),
    data: z.array(z.record(z.string(), z.number())),
    xKey: z.string(),
    yKeys: z.array(z.string()),
    stacked: z.boolean().optional(),
    legend: z.boolean().default(true),
  }),
});

//──────────────── Timeline
const TimelineSection = z.object({
  type: z.literal("timeline"),
  id: z.string().optional(),
  props: z.object({
    events: z.array(z.object({ date: z.string(), title: LocalizedString, text: LocalizedString })),
    alternating: z.boolean().default(true),
  }),
});

//──────────────── Map (leaflet / google…)
const MapSection = z.object({
  type: z.literal("map"),
  id: z.string().optional(),
  props: z.object({
    provider: z.enum(["leaflet", "google", "mapbox"]).default("leaflet"),
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number().int().default(13),
    markers: z.array(z.object({ position: z.tuple([z.number(), z.number()]), label: LocalizedString.optional(), popup: LocalizedString.optional() })).optional(),
  }),
});

//──────────────── Alert / Banner
const BannerSection = z.object({
  type: z.literal("banner"),
  id: z.string().optional(),
  props: z.object({
    text: LocalizedString,
    variant: z.enum(["info", "success", "warning", "error"]).default("info"),
    dismissible: z.boolean().default(false),
  }),
});

//──────────────── Newsletter signup
const NewsletterSection = z.object({
  type: z.literal("newsletter"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    formAction: z.string(),
    emailPlaceholder: LocalizedString.optional(),
    submitLabel: LocalizedString,
    successMessage: LocalizedString.optional(),
  }),
});

//──────────────── Login Form
const LoginFormSection = z.object({
  type: z.literal("loginForm"),
  id: z.string().optional(),
  props: z.object({}),
});

//──────────────── Register Form
const RegisterFormSection = z.object({
  type: z.literal("registerForm"),
  id: z.string().optional(),
  props: z.object({}),
});

//──────────────── Recover Password Form
const RecoverPasswordFormSection = z.object({
  type: z.literal("recoverPasswordForm"),
  id: z.string().optional(),
  props: z.object({}),
});

//──────────────── HTML libre
const HTMLSection = z.object({
  type: z.literal("html"),
  id: z.string().optional(),
  props: z.object({ html: z.string() }),
});

//───────────────────────────────────────────────────────────────
// Union de toutes les sections
//───────────────────────────────────────────────────────────────
export const Section = z.union([
  HeroSection,
  MarkdownSection,
  CardsSection,
  GallerySection,
  VideoSection,
  FAQSection,
  TestimonialsSection,
  PricingSection,
  ContactFormSection,
  TableSection,
  ChartSection,
  TimelineSection,
  MapSection,
  BannerSection,
  NewsletterSection,
  LoginFormSection,
  RegisterFormSection,
  RecoverPasswordFormSection,
  BlogPostSection,
  BlogListSection,
  TeamSection,
  StatsSection,
  CTASection,
  LogoCloudSection,
  AccordionSection,
  TabsSection,
  StepsSection,
  ComparisonSection,
  FeatureComparisonSection,
  SocialFeedSection,
  SearchSection,
  EventListSection,
  ProductShowcaseSection,
  BreadcrumbSection,
  CookieConsentSection,
  HTMLSection,
]);
export type Section = z.infer<typeof Section>;

/*───────────────────────────────────────────────────────────────*/
/* 4. Page                                                       */
/*───────────────────────────────────────────────────────────────*/
const PageMeta = z.object({
  title: LocalizedString.optional(),
  description: LocalizedString.optional(),
  keywords: z.array(z.string()).optional(),
  ogImage: z.string().optional(),
  ogType: z.string().optional(),
  twitterCard: z.enum(["summary", "summary_large_image", "app", "player"]).optional(),
  canonical: z.string().optional(),
  noIndex: z.boolean().optional(),
  noFollow: z.boolean().optional(),
  structuredData: z.record(z.any()).optional(), // JSON-LD
});

export const Page = z.object({
  path: z.string(),
  title: LocalizedString,
  seo: PageMeta.optional(),
  layout: z.enum(["default", "fullwidth", "sidebar-left", "sidebar-right", "landing"]).default("default"),
  auth: z.object({ required: z.boolean().default(false), roles: z.array(z.string()).optional() }).optional(),
  middleware: z.array(z.string()).optional(), // Custom middleware functions
  sections: z.array(Section),
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  customCSS: z.string().optional(),
  customJS: z.string().optional(),
});
export type Page = z.infer<typeof Page>;

/*───────────────────────────────────────────────────────────────*/
/* 5. Header & Footer                                            */
/*───────────────────────────────────────────────────────────────*/
const MegaMenuColumn = z.object({
  title: LocalizedString.optional(),
  links: z.array(NavItem),
  featured: z.object({
    title: LocalizedString,
    description: LocalizedString,
    image: z.string().optional(),
    href: z.string(),
  }).optional(),
});

const MegaMenu = z.object({
  columns: z.array(MegaMenuColumn),
  width: z.enum(["sm", "md", "lg", "xl", "full"]).default("lg"),
});

// Enhanced NavItem with mega menu support
// Define interface for EnhancedNavItem to avoid 'any'
interface EnhancedNavItemType {
  label: LocalizedString;
  path?: string;
  href?: string;
  icon?: string;
  badge?: z.infer<typeof NavBadge>;
  roles?: string[];
  children?: EnhancedNavItemType[];
  megaMenu?: {
    columns: z.infer<typeof MegaMenuColumn>[];
    width?: "sm" | "md" | "lg" | "xl" | "full";  // Make width optional to match the schema
  };
  description?: LocalizedString;
}

const EnhancedNavItem: z.ZodType<EnhancedNavItemType> = z.lazy(() =>
  z.object({
    label: LocalizedString,
    path: z.string().min(1).optional(),
    href: z.string().url().optional(),
    icon: z.string().optional(),
    badge: NavBadge,
    roles: z.array(z.string()).optional(),
    children: z.array(EnhancedNavItem).optional(),
    megaMenu: MegaMenu.optional(),
    description: LocalizedString.optional(),
  }).refine(d => d.path || d.href || d.children || d.megaMenu, { 
    message: "NavItem : path, href, children ou megaMenu obligatoire" 
  })
);

export const Header = z.object({
  logo: z.string(),
  logoAlt: LocalizedString.optional(),
  nav: z.array(EnhancedNavItem),
  sticky: z.boolean().default(true),
  transparent: z.boolean().default(false),
  height: z.enum(["sm", "md", "lg"]).default("md"),
  utilities: z.object({
    themeSwitch: z.boolean().default(true),
    langSwitch : z.boolean().default(true),
    search     : z.boolean().default(false),
    auth       : z.boolean().default(false),
    cart       : z.boolean().default(false),
    notifications: z.boolean().default(false),    
  }).default({}),
  announcement: z.object({
    text: LocalizedString,
    href: z.string().optional(),
    dismissible: z.boolean().default(true),
    variant: z.enum(["info", "success", "warning", "error"]).default("info"),
  }).optional(),
});
export type Header = z.infer<typeof Header>;

const FooterColumn = z.object({
  title: LocalizedString,
  links: z.array(z.object({
    href: z.string(),
    label: LocalizedString,
    external: z.boolean().optional(),
    icon: z.string().optional(),
  })),
});

export const Footer = z.object({
  columns: z.array(FooterColumn),
  socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
  extra: z.string().optional(),
  newsletter: NewsletterSection.optional(),
  copyright: LocalizedString,
  logo: z.string().optional(),
  description: LocalizedString.optional(),
  legalLinks: z.array(z.object({
    href: z.string(),
    label: LocalizedString,
  })).optional(),
  paymentMethods: z.array(z.string()).optional(), // Array of payment method icons
});
export type Footer = z.infer<typeof Footer>;

/*───────────────────────────────────────────────────────────────*/
/* 6. Intégrations externes & features                           */
/*───────────────────────────────────────────────────────────────*/
const AnalyticsIntegration = z.object({ 
  provider: z.enum(["ga4", "matomo", "plausible", "posthog", "mixpanel", "amplitude"]), 
  id: z.string(),
  config: z.record(z.any()).optional(),
});

const ChatIntegration = z.object({ 
  provider: z.enum(["intercom", "crisp", "hubspot", "zendesk", "freshchat"]), 
  id: z.string(),
  config: z.record(z.any()).optional(),
});

const ScriptTag = z.object({ 
  src: z.string(), 
  async: z.boolean().default(true), 
  defer: z.boolean().default(true),
  position: z.enum(["head", "body"]).default("head"),
  condition: z.string().optional(), // Conditional loading
});

const SEOIntegration = z.object({
  sitemap: z.boolean().default(true),
  robots: z.string().optional(),
  googleSiteVerification: z.string().optional(),
  bingSiteVerification: z.string().optional(),
  yandexVerification: z.string().optional(),
});

const EcommerceIntegration = z.object({
  provider: z.enum(["stripe", "paypal", "shopify", "woocommerce"]),
  config: z.record(z.any()),
});

const EmailIntegration = z.object({
  provider: z.enum(["mailchimp", "sendgrid", "mailgun", "postmark"]),
  config: z.record(z.any()),
});

const CRMIntegration = z.object({
  provider: z.enum(["hubspot", "salesforce", "pipedrive", "airtable"]),
  config: z.record(z.any()),
});

export const Integrations = z.object({ 
  analytics: AnalyticsIntegration.optional(), 
  chat: ChatIntegration.optional(), 
  scripts: z.array(ScriptTag).optional(),
  seo: SEOIntegration.optional(),
  ecommerce: EcommerceIntegration.optional(),
  email: EmailIntegration.optional(),
  crm: CRMIntegration.optional(),
});
export type Integrations = z.infer<typeof Integrations>;

/*───────────────────────────────────────────────────────────────*/
/* 7. Feature flags / A‑B tests                                  */
/*───────────────────────────────────────────────────────────────*/
export const FeatureFlag = z.object({ 
  key: z.string(), 
  enabled: z.boolean().default(false), 
  variant: z.string().optional(),
  description: z.string().optional(),
  rolloutPercentage: z.number().min(0).max(100).default(100),
  conditions: z.record(z.any()).optional(), // User segments, geo, etc.
});

/*───────────────────────────────────────────────────────────────*/
/* 8. Theme & Design System                                      */
/*───────────────────────────────────────────────────────────────*/
const ColorPalette = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  foreground: z.string(),
  muted: z.string(),
  border: z.string(),
  success: z.string().optional(),
  warning: z.string().optional(),
  error: z.string().optional(),
});

const Typography = z.object({
  fontFamily: z.object({
    sans: z.array(z.string()),
    serif: z.array(z.string()).optional(),
    mono: z.array(z.string()).optional(),
  }),
  fontSize: z.record(z.string()).optional(),
  fontWeight: z.record(z.number()).optional(),
  lineHeight: z.record(z.string()).optional(),
});

const Spacing = z.object({
  scale: z.enum(["tight", "normal", "relaxed"]).default("normal"),
  custom: z.record(z.string()).optional(),
});

const BorderRadius = z.object({
  scale: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
  custom: z.record(z.string()).optional(),
});

const ThemeConfig = z.object({
  colors: z.object({
    light: ColorPalette,
    dark: ColorPalette,
  }),
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  animations: z.object({
    enabled: z.boolean().default(true),
    duration: z.enum(["fast", "normal", "slow"]).default("normal"),
  }),
  customCSS: z.string().optional(),
});

/*───────────────────────────────────────────────────────────────*/
/* 9. Performance & Optimization                                 */
/*───────────────────────────────────────────────────────────────*/
const PerformanceConfig = z.object({
  lazyLoading: z.boolean().default(true),
  imageOptimization: z.boolean().default(true),
  caching: z.object({
    enabled: z.boolean().default(true),
    strategy: z.enum(["stale-while-revalidate", "cache-first", "network-first"]).default("stale-while-revalidate"),
    maxAge: z.number().default(3600), // seconds
  }),
  compression: z.boolean().default(true),
  minification: z.boolean().default(true),
  criticalCSS: z.boolean().default(true),
});

/*───────────────────────────────────────────────────────────────*/
/* 10. SiteConfig – racine                                        */
/*───────────────────────────────────────────────────────────────*/
export const SiteConfig = z.object({
  version: z.string().optional(),
  generated: z.string().optional(), // ISO timestamp
  meta: z.object({
    title: LocalizedString,
    description: LocalizedString.optional(),
    defaultLang: z.enum(LOCALES).default("fr"),
    languages: z.array(z.enum(LOCALES)).default([...LOCALES]),
    favicon: z.string().optional(),
    themeColor: z.string().optional(),
    author: LocalizedString.optional(),
    keywords: z.array(z.string()).optional(),
    robots: z.string().optional(),
  }),
  header: Header,
  pages: z.array(Page),
  footer: Footer,
  integrations: Integrations.optional(),
  features: z.array(FeatureFlag).optional(),
  theme: ThemeConfig.optional(),
  performance: PerformanceConfig.optional(),
  redirects: z.array(z.object({
    from: z.string(),
    to: z.string(),
    permanent: z.boolean().default(false),
  })).optional(),
  customDomains: z.array(z.string()).optional(),
  maintenance: z.object({
    enabled: z.boolean().default(false),
    message: LocalizedString.optional(),
    allowedIPs: z.array(z.string()).optional(),
  }).optional(),
});
export type SiteConfig = z.infer<typeof SiteConfig>;

/*───────────────────────────────────────────────────────────────*/
/* 11. Helpers & Utilities                                       */
/*───────────────────────────────────────────────────────────────*/

// Helper function to validate a site config
export function validateSiteConfig(config: unknown): SiteConfig {
  return SiteConfig.parse(config);
}

// Helper function to get default config
export function getDefaultSiteConfig(): Partial<SiteConfig> {
  return {
    meta: {
      title: { en: "My Site", fr: "Mon Site" },
      description: { en: "A beautiful website", fr: "Un beau site web" },
      defaultLang: "en",
      languages: ["en", "fr"],
    },
    header: {
      logo: "/logo.svg",
      nav: [],
      utilities: {
        themeSwitch: true,
        langSwitch: true,
        search: false,
        auth: false,
        cart: false,
        notifications: false
      },
      sticky: false,
      transparent: false,
      height: "sm"
    },
    pages: [],
    footer: {
      columns: [],
      copyright: { en: "© 2025 My Company", fr: "© 2025 Ma Société" },
    },
  };
}

/*───────────────────────────────────────────────────────────────*/
/* 12. Exemple type‑safe                                         */
/*───────────────────────────────────────────────────────────────*/
export const example: SiteConfig = {
  meta: {
    title: { fr: "Mon Site", en: "My Site" },
    defaultLang: "fr",
    languages: []
  },
  header: {
    logo: "/logo.svg",
    nav: [
      { path: "/", label: { fr: "Accueil", en: "Home" } },
      { path: "/pricing", label: { fr: "Tarifs", en: "Pricing" } },
      {
        label: { fr: "Docs", en: "Docs" },
        children: [
          { path: "/docs/getting-started", label: { fr: "Démarrer", en: "Getting Started" } },
        ],
      },
    ],
    sticky: false,
    transparent: false,
    height: "sm",
    utilities: {
      themeSwitch: true,
      langSwitch: true,
      search: false,
      auth: false,
      cart: false,
      notifications: false
    }
  },
  pages: [
    {
      path: "/",
      title: { fr: "Bienvenue", en: "Welcome" },
      layout: "default",
      sections: [
        {
          type: "hero",
          props: {
            headline: { fr: "Site JSON", en: "JSON‑Driven" },
            subhead: { fr: "Tout vient du fichier", en: "Everything from JSON" },
            align: "center",
            overlay: false,
            cta: [
              { label: { fr: "Commencer", en: "Start" }, href: "#features" },
              { label: { fr: "Tarifs", en: "Pricing" }, href: "/pricing" },
            ],
          },
        },
        {
          type: "cards",
          props: {
            layout: "masonry",
            items: [
              {
                icon: "zap",
                title: { fr: "Rapide", en: "Fast" },
                text: { fr: "HMR instantané", en: "Instant HMR" },
              },
              {
                icon: "sun",
                title: { fr: "Thémable", en: "Themable" },
                text: { fr: "Clair / Sombre", en: "Light / Dark" },
              },
            ],
            columns: 3,
          },
        },
      ],
    },
  ],
  footer: {
    columns: [
      {
        title: { fr: "Liens", en: "Links" },
        links: [
          { href: "/", label: { fr: "Accueil", en: "Home" } },
          { href: "/legal", label: { fr: "Mentions", en: "Legal" } },
        ],
      },
    ],
    socials: [
      { platform: "github", url: "https://github.com" },
    ],
    copyright: { fr: "© 2025 MaSociété", en: "© 2025 MyCompany" },
  },
  integrations: {
    analytics: { provider: "ga4", id: "G-XXXXXXX" },
  },
  features: [
    {
      key: "newNavbar", enabled: false,
      rolloutPercentage: 0
    },
  ],
};