// ------------------------------------------------------------
// site-schema.ts – Schéma ultra‑complet d'un site piloté par JSON
// ------------------------------------------------------------
// Objectif : couvrir un maximum de cas d'usage « no‑code » sans modifier le runtime React.
// Technologies cibles : React 19 + Vite 5 + Tailwind 4 + shadcn/ui.
// Validation : Zod 3.x – le schéma sert à la fois de typings, de runtime‑guard,
//               et d'autocomplétion dans VS Code.
// ------------------------------------------------------------
import { SearchProSectionSchema } from "@/modules/search/schema";
import { z } from "zod";
import { LocalizedString, LOCALES } from "./locale-schema";

// export const CocolightConfig = z.object({
//   baseUrl: z.string().url().default("http://localhost:5080"),
//   debug: z.boolean().default(false),
//   context: z.object({
//     type: z.enum(["organizations", "projects"]).optional(),
//     slug: z.string().optional(), // slug du site, utilisé pour l'API et les URLs
//     id: z.string().optional(), // ID de l'organisation ou du projet
//   })
// });

// export type CocolightConfig = z.infer<typeof CocolightConfig>;

/*───────────────────────────────────────────────────────────────*/
/* 2. Navigation                                                 */
/*───────────────────────────────────────────────────────────────*/
const NavBadge = z.object({ text: LocalizedString }).optional();

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
const Columns = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);

let SectionSchemaLazy: z.ZodTypeAny;


//──────────────── Hero
const HeroSectionSchema = z.object({
  type: z.literal("hero"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
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

export type HeroSection = z.infer<typeof HeroSectionSchema>;

export type HeroSectionProps = z.infer<typeof HeroSectionSchema>["props"];

//──────────────── Hero Tiers-Lieux
export const HeroTiersLieuxSchema = z.object({
  type: z.literal("hero-tiers-lieux"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    ctaButtons: z
      .array(
        z.object({
          label: LocalizedString,
          variant: z.enum(["default", "secondary"]).optional(),
        })
      )
      .optional(),
    placeholder: LocalizedString.optional(),
    searchButtonText: LocalizedString.optional(),
  }),
});

export type HeroTiersLieux = z.infer<typeof HeroTiersLieuxSchema>;

export type HeroTiersLieuxProps = z.infer<typeof HeroTiersLieuxSchema>["props"];

//──────────────── Markdown / MDX
const MarkdownSectionSchema = z.object({
  type: z.literal("markdown"),
  id: z.string().optional(),
  props: z.object({
    md: z.string(),                // chemin .mdx ou contenu inline
    sourceType: z.enum(["file", "inline"]).default("file"),
    animation: z.string().optional(),
  }),
});

export type MarkdownSection = z.infer<typeof MarkdownSectionSchema>;

export type MarkdownSectionProps = z.infer<typeof MarkdownSectionSchema>["props"];

//──────────────── Cards / Features
const CardsSectionSchema = z.object({
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
        location: LocalizedString.optional(),
        badges: z.array(z.object({
          icon: z.string(),
          label: z.string().optional()
        })).optional(),
        avatarIcon: z.string().optional(),
        avatarColor: z.string().optional(),
        date: z.string().optional(),
        eventTitle: LocalizedString.optional(),
        organizerName: LocalizedString.optional(),
      })
    ),
    columns: Columns.default(3),
    layout: z.enum(["grid", "masonry", "carousel"]).default("grid"),
    variant: z.enum(["default", "tiers-lieux", "event"]).default("default"),
    className: z.string().optional(),
  }),
});

export type CardsSection = z.infer<typeof CardsSectionSchema>;

export type CardsSectionProps = z.infer<typeof CardsSectionSchema>["props"];

//──────────────── Gallery
const GallerySectionSchema = z.object({
  type: z.literal("gallery"),
  id: z.string().optional(),
  props: z.object({
    images: z.array(z.object({ src: z.string(), alt: LocalizedString.optional(), caption: LocalizedString.optional() })),
    columns: Columns.default(3),
    lightbox: z.boolean().default(true),
  }),
});

export type GallerySection = z.infer<typeof GallerySectionSchema>;

export type GallerySectionProps = z.infer<typeof GallerySectionSchema>["props"];

//──────────────── Video
const VideoSectionSchema = z.object({
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

export type VideoSection = z.infer<typeof VideoSectionSchema>;

export type VideoSectionProps = z.infer<typeof VideoSectionSchema>["props"];

//──────────────── FAQ
const FAQSectionSchema = z.object({
  type: z.literal("faq"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({ q: LocalizedString, a: LocalizedString })),
    accordion: z.boolean().default(true),
  }),
});

export type FAQSection = z.infer<typeof FAQSectionSchema>;

export type FAQSectionProps = z.infer<typeof FAQSectionSchema>["props"];

//──────────────── Testimonials
const TestimonialsSectionSchema = z.object({
  type: z.literal("testimonials"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({ quote: LocalizedString, author: LocalizedString, role: LocalizedString.optional(), avatar: z.string().optional() })),
    style: z.enum(["grid", "carousel", "ticker"]).default("carousel"),
    autoplay: z.boolean().default(true),
  }),
});

export type TestimonialsSection = z.infer<typeof TestimonialsSectionSchema>;

export type TestimonialsSectionProps = z.infer<typeof TestimonialsSectionSchema>["props"];

//──────────────── Pricing
const PricingSectionSchema = z.object({
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

export type PricingSection = z.infer<typeof PricingSectionSchema>;

export type PricingSectionProps = z.infer<typeof PricingSectionSchema>["props"];

//──────────────── Contact Form
const ContactFormSectionSchema = z.object({
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

export type ContactFormSection = z.infer<typeof ContactFormSectionSchema>;

export type ContactFormSectionProps = z.infer<typeof ContactFormSectionSchema>["props"];

//──────────────── Blog Post
const BlogPostSectionSchema = z.object({
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

export type BlogPostSection = z.infer<typeof BlogPostSectionSchema>;

export type BlogPostSectionProps = z.infer<typeof BlogPostSectionSchema>["props"];

//──────────────── Blog List
const BlogListSectionSchema = z.object({
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

export type BlogListSection = z.infer<typeof BlogListSectionSchema>;

export type BlogListSectionProps = z.infer<typeof BlogListSectionSchema>["props"];

//──────────────── Team Section
const TeamSectionSchema = z.object({
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

export type TeamSection = z.infer<typeof TeamSectionSchema>;

export type TeamSectionProps = z.infer<typeof TeamSectionSchema>["props"];

//──────────────── Stats/Metrics Section
const StatsSectionSchema = z.object({
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

export type StatsSection = z.infer<typeof StatsSectionSchema>;

export type StatsSectionProps = z.infer<typeof StatsSectionSchema>["props"];

//──────────────── CTA (Call to Action) Section
const CTASectionSchema = z.object({
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

export type CTASection = z.infer<typeof CTASectionSchema>;

export type CTASectionProps = z.infer<typeof CTASectionSchema>["props"];

//──────────────── Logo Cloud/Partners
const LogoCloudSectionSchema = z.object({
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

export type LogoCloudSection = z.infer<typeof LogoCloudSectionSchema>;

export type LogoCloudSectionProps = z.infer<typeof LogoCloudSectionSchema>["props"];

//──────────────── Accordion Section
const AccordionSectionSchema = z.object({
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

export type AccordionSection = z.infer<typeof AccordionSectionSchema>;

export type AccordionSectionProps = z.infer<typeof AccordionSectionSchema>["props"];

//──────────────── Tabs Section
const TabsSectionSchema = z.object({
  type: z.literal("tabs"),
  id: z.string().optional(),
  props: z.object({
    tabs: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      content: z.union([
        LocalizedString,
        z.array(z.lazy(() => SectionSchemaLazy)), // plusieurs sections
      ]),
      icon: z.string().optional(),
    })),
    defaultTab: z.string().optional(),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  }),
});

export type TabsSection = z.infer<typeof TabsSectionSchema>;

export type TabsSectionProps = z.infer<typeof TabsSectionSchema>["props"];

//──────────────── Progress/Steps Section
const StepsSectionSchema = z.object({
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

export type StepsSection = z.infer<typeof StepsSectionSchema>;

export type StepsSectionProps = z.infer<typeof StepsSectionSchema>["props"];

//──────────────── Before/After Comparison
const ComparisonSectionSchema = z.object({
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

export type ComparisonSection = z.infer<typeof ComparisonSectionSchema>;

export type ComparisonSectionProps = z.infer<typeof ComparisonSectionSchema>["props"];

//──────────────── Feature Comparison Table
const FeatureComparisonSectionSchema = z.object({
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

export type FeatureComparisonSection = z.infer<typeof FeatureComparisonSectionSchema>;

export type FeatureComparisonSectionProps = z.infer<typeof FeatureComparisonSectionSchema>["props"];

//──────────────── Social Feed
const SocialFeedSectionSchema = z.object({
  type: z.literal("socialFeed"),
  id: z.string().optional(),
  props: z.object({
    platform: z.enum(["twitter", "instagram", "linkedin", "facebook"]),
    feedId: z.string(),
    limit: z.number().default(6),
    layout: z.enum(["grid", "carousel", "masonry"]).default("grid"),
  }),
});

export type SocialFeedSection = z.infer<typeof SocialFeedSectionSchema>;

export type SocialFeedSectionProps = z.infer<typeof SocialFeedSectionSchema>["props"];


//──────────────── Event List
const EventListSectionSchema = z.object({
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

export type EventListSection = z.infer<typeof EventListSectionSchema>;

export type EventListSectionProps = z.infer<typeof EventListSectionSchema>["props"];

//──────────────── Product Showcase
const ProductShowcaseSectionSchema = z.object({
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

export type ProductShowcaseSection = z.infer<typeof ProductShowcaseSectionSchema>;

export type ProductShowcaseSectionProps = z.infer<typeof ProductShowcaseSectionSchema>["props"];

//──────────────── Breadcrumb
const BreadcrumbSectionSchema = z.object({
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

export type BreadcrumbSection = z.infer<typeof BreadcrumbSectionSchema>;

export type BreadcrumbSectionProps = z.infer<typeof BreadcrumbSectionSchema>["props"];

//──────────────── Cookie Consent
const CookieConsentSectionSchema = z.object({
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

export type CookieConsentSection = z.infer<typeof CookieConsentSectionSchema>;

export type CookieConsentSectionProps = z.infer<typeof CookieConsentSectionSchema>["props"];

//──────────────── Table (sortable / paginée)
const TableSectionSchema = z.object({
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

export type TableSection = z.infer<typeof TableSectionSchema>;

export type TableSectionProps = z.infer<typeof TableSectionSchema>["props"];

//──────────────── Chart (via recharts)
const ChartSectionSchema = z.object({
  type: z.literal("chart"),
  id: z.string().optional(),
  props: z.object({
    kind: z.enum(["line", "bar", "pie", "area", "radar"]),
    data: z.array(
      z.record(z.string(), z.union([z.number(), z.string()]))
    ),
    xKey: z.string(),
    yKeys: z.array(z.string()),
    stacked: z.boolean().optional(),
    legend: z.boolean().default(true),
  }),
});

export type ChartSection = z.infer<typeof ChartSectionSchema>;

export type ChartSectionProps = z.infer<typeof ChartSectionSchema>["props"];

//──────────────── Timeline
const TimelineSectionSchema = z.object({
  type: z.literal("timeline"),
  id: z.string().optional(),
  props: z.object({
    events: z.array(z.object({ date: z.string(), title: LocalizedString, text: LocalizedString })),
    alternating: z.boolean().default(true),
  }),
});

export type TimelineSection = z.infer<typeof TimelineSectionSchema>;

export type TimelineSectionProps = z.infer<typeof TimelineSectionSchema>["props"];

//──────────────── Map (leaflet / google…)
const MapSectionSchema = z.object({
  type: z.literal("map"),
  id: z.string().optional(),
  props: z.object({
    provider: z.enum(["leaflet", "google", "mapbox"]).default("leaflet"),
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number().int().default(13),
    markers: z.array(z.object({ position: z.tuple([z.number(), z.number()]), label: LocalizedString.optional(), popup: LocalizedString.optional() })).optional(),
  }),
});

export type MapSection = z.infer<typeof MapSectionSchema>;

export type MapSectionProps = z.infer<typeof MapSectionSchema>["props"];

//──────────────── Alert / Banner
const BannerSectionSchema = z.object({
  type: z.literal("banner"),
  id: z.string().optional(),
  props: z.object({
    text: LocalizedString,
    variant: z.enum(["info", "success", "warning", "error"]).default("info"),
    dismissible: z.boolean().default(false),
  }),
});

export type BannerSection = z.infer<typeof BannerSectionSchema>;

export type BannerSectionProps = z.infer<typeof BannerSectionSchema>["props"];

//──────────────── Newsletter signup
const NewsletterSectionSchema = z.object({
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

export type NewsletterSection = z.infer<typeof NewsletterSectionSchema>;

export type NewsletterSectionProps = z.infer<typeof NewsletterSectionSchema>["props"];

//──────────────── Login Form
const LoginFormSectionSchema = z.object({
  type: z.literal("loginForm"),
  id: z.string().optional(),
  props: z.object({}),
});

export type LoginFormSection = z.infer<typeof LoginFormSectionSchema>;

export type LoginFormSectionProps = z.infer<typeof LoginFormSectionSchema>["props"];

//──────────────── Register Form
const RegisterFormSectionSchema = z.object({
  type: z.literal("registerForm"),
  id: z.string().optional(),
  props: z.object({}),
});

export type RegisterFormSection = z.infer<typeof RegisterFormSectionSchema>;

export type RegisterFormSectionProps = z.infer<typeof RegisterFormSectionSchema>["props"];

//──────────────── Recover Password Form
const RecoverPasswordFormSectionSchema = z.object({
  type: z.literal("recoverPasswordForm"),
  id: z.string().optional(),
  props: z.object({}),
});

export type RecoverPasswordFormSection = z.infer<typeof RecoverPasswordFormSectionSchema>;

export type RecoverPasswordFormSectionProps = z.infer<typeof RecoverPasswordFormSectionSchema>["props"];

const HTMLSectionSchema = z.object({
  type: z.literal("html"),
  id: z.string().optional(),
  props: z.object({ html: z.string() }),
});

export type HTMLSection = z.infer<typeof HTMLSectionSchema>;

export type HTMLSectionProps = z.infer<typeof HTMLSectionSchema>["props"];

//──────────────── title center
const TitleSectionSchema = z.object({
  type: z.literal("title"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString,
    subtitle: LocalizedString.optional(),
    className: z.string().optional(),
    align: z.enum(["left", "center", "right"]).default("center"),
    size: z.enum(["sm", "md", "lg", "xl"]).default("lg"),
  }),
});

export type TitleSection = z.infer<typeof TitleSectionSchema>;

export type TitleSectionProps = z.infer<typeof TitleSectionSchema>["props"];

const ContentSectionSchema = z.object({
  type: z.literal("content"),
  id: z.string().optional(),
  props: z.object({
    category: LocalizedString.optional(),
    title: LocalizedString,
    description: LocalizedString,
    tags: z.array(LocalizedString).optional(),
    image: z.string().optional(),
    imagePosition: z.enum(["left", "right"]).default("right"),
    links: z.array(z.object({
      label: LocalizedString,
      href: z.string(),
    })).optional(),
    iconCard: z.object({
      svg: z.string(),
    }).optional(),
    infoText: LocalizedString.optional(),
    decorativeElements: z.object({
      type: z.enum(["corner-icon", "colored-squares", "none"]),
    }).optional(),
    className: z.string().optional(),
    stats: z.array(z.object({
      value: z.string(),
      label: LocalizedString
    })).optional(),
  }),
});

export type ContentSection = z.infer<typeof ContentSectionSchema>;

export type ContentSectionProps = z.infer<typeof ContentSectionSchema>["props"];

//───────────────────────────────────────────────────────────────
// Union de toutes les sections
//───────────────────────────────────────────────────────────────
export const Section = z.discriminatedUnion("type", [
  HeroSectionSchema,
  HeroTiersLieuxSchema,
  MarkdownSectionSchema,
  CardsSectionSchema,
  GallerySectionSchema,
  VideoSectionSchema,
  FAQSectionSchema,
  TestimonialsSectionSchema,
  PricingSectionSchema,
  ContactFormSectionSchema,
  TableSectionSchema,
  ChartSectionSchema,
  TimelineSectionSchema,
  MapSectionSchema,
  BannerSectionSchema,
  NewsletterSectionSchema,
  LoginFormSectionSchema,
  RegisterFormSectionSchema,
  RecoverPasswordFormSectionSchema,
  BlogPostSectionSchema,
  BlogListSectionSchema,
  TeamSectionSchema,
  StatsSectionSchema,
  CTASectionSchema,
  LogoCloudSectionSchema,
  AccordionSectionSchema,
  TabsSectionSchema,
  StepsSectionSchema,
  ComparisonSectionSchema,
  FeatureComparisonSectionSchema,
  SocialFeedSectionSchema,
  EventListSectionSchema,
  ProductShowcaseSectionSchema,
  BreadcrumbSectionSchema,
  CookieConsentSectionSchema,
  HTMLSectionSchema,
  TitleSectionSchema,
  ContentSectionSchema,
  SearchProSectionSchema,
]);
export type Section = z.infer<typeof Section>;

export type SectionPropsMap = {
  [K in Section['type']]: Extract<Section, { type: K }>['props'];
};

SectionSchemaLazy = Section;

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
  structuredData: z.record(z.string(), z.any()).optional(), // JSON-LD
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
export interface EnhancedNavItemType {
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
  type: z.string(),
  logo: z.string(),
  logoAlt: LocalizedString.optional(),
  nav: z.array(EnhancedNavItem),
  sticky: z.boolean().default(true),
  transparent: z.boolean().default(false),
  height: z.enum(["sm", "md", "lg"]).default("md"),
  utilities: z.object({
    themeSwitch: z.boolean().default(true),
    langSwitch: z.boolean().default(true),
    search: z.boolean().default(false),
    auth: z.boolean().default(false),
    cart: z.boolean().default(false),
    notifications: z.boolean().default(false),
  }),
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
  type: z.string().optional(),
  columns: z.array(FooterColumn),
  socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
  extra: z.string().optional(),
  newsletter: NewsletterSectionSchema.optional(),
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
  config: z.record(z.string(), z.any()).optional(),
});

const ChatIntegration = z.object({
  provider: z.enum(["intercom", "crisp", "hubspot", "zendesk", "freshchat"]),
  id: z.string(),
  config: z.record(z.string(), z.any()).optional(),
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
  config: z.record(z.string(), z.any()),
});

const EmailIntegration = z.object({
  provider: z.enum(["mailchimp", "sendgrid", "mailgun", "postmark"]),
  config: z.record(z.string(), z.any()),
});

const CRMIntegration = z.object({
  provider: z.enum(["hubspot", "salesforce", "pipedrive", "airtable"]),
  config: z.record(z.string(), z.any()),
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
  conditions: z.record(z.string(), z.any()).optional(), // User segments, geo, etc.
});

/*───────────────────────────────────────────────────────────────*/
/* 8. Theme & Design System                                      */
/*───────────────────────────────────────────────────────────────*/
const ColorPalette = z.object({
  primary: z.string(),
  primaryForeground: z.string().optional(),
  secondary: z.string(),
  secondaryForeground: z.string().optional(),
  accent: z.string(),
  accentForeground: z.string().optional(),
  background: z.string(),
  foreground: z.string(),
  muted: z.string(),
  mutedForeground: z.string().optional(),
  destructive: z.string().optional(),
  destructiveForeground: z.string().optional(),
  border: z.string(),
  input: z.string().optional(),
  ring: z.string().optional(),

  success: z.string().optional(),
  successForeground: z.string().optional(),
  warning: z.string().optional(),
  warningForeground: z.string().optional(),
  error: z.string().optional(),
  errorForeground: z.string().optional(),
  info: z.string().optional(),
  infoForeground: z.string().optional(),

  card: z.string().optional(),
  cardForeground: z.string().optional(),
  popover: z.string().optional(),
  popoverForeground: z.string().optional(),

  sidebar: z.string().optional(),
  sidebarForeground: z.string().optional(),
  sidebarPrimary: z.string().optional(),
  sidebarPrimaryForeground: z.string().optional(),
  sidebarAccent: z.string().optional(),
  sidebarAccentForeground: z.string().optional(),
  sidebarBorder: z.string().optional(),
  sidebarRing: z.string().optional(),

  chart1: z.string().optional(),
  chart2: z.string().optional(),
  chart3: z.string().optional(),
  chart4: z.string().optional(),
  chart5: z.string().optional(),
});

const Typography = z.object({
  fontFamily: z.object({
    sans: z.array(z.string()),
    serif: z.array(z.string()).optional(),
    mono: z.array(z.string()).optional(),
  }),
  letterSpacing: z.string().optional(),
});

const Spacing = z.object({
  base: z.string().optional(),
});

const BorderRadius = z.object({
  base: z.string().optional(),
});

const Shadows = z.object({
  shadow2xs: z.string().optional(),
  shadowXs: z.string().optional(),
  shadowSm: z.string().optional(),
  shadow: z.string().optional(),
  shadowMd: z.string().optional(),
  shadowLg: z.string().optional(),
  shadowXl: z.string().optional(),
  shadow2xl: z.string().optional(),
});

export const ThemeConfig = z.object({
  colors: z.object({
    light: ColorPalette,
    dark: ColorPalette,
  }),
  typography: Typography,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: z.object({
    light: Shadows,
    dark: Shadows,
  }),
  customCSS: z.string().optional(),
});

export type ThemeConfig = z.infer<typeof ThemeConfig>;
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
  pages: z
    .array(Page)
    .check((ctx) => {
      // On extrait tous les chemins
      const paths = ctx.value.map((p) => p.path);
      // Si doublon, on pousse une issue
      if (new Set(paths).size !== paths.length) {
        ctx.issues.push({
          code: "custom",           // code littéral, comme préconisé
          message: "Chaque page doit avoir un path unique.",
          input: ctx.value,         // l’entrée invalidée (le tableau complet)
        });
      }
    }),
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
      type: "tiers-lieux",
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
    type: "tiers-lieux",
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
            variant: "default",
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