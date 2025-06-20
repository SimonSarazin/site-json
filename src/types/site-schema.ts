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

export const NavItem: z.ZodType<any> = z.lazy(() =>
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
  HTMLSection,
]);
export type Section = z.infer<typeof Section>;

/*───────────────────────────────────────────────────────────────*/
/* 4. Page                                                       */
/*───────────────────────────────────────────────────────────────*/
export const Page = z.object({
  path: z.string(),
  title: LocalizedString,
  seo: z.object({ title: LocalizedString.optional(), description: LocalizedString.optional(), ogImage: z.string().optional(), noIndex: z.boolean().optional() }).optional(),
  layout: z.enum(["default", "fullwidth", "sidebar-left", "sidebar-right", "landing"]).default("default"),
  auth: z.object({ required: z.boolean().default(false), roles: z.array(z.string()).optional() }).optional(),
  sections: z.array(Section),
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
});
export type Page = z.infer<typeof Page>;

/*───────────────────────────────────────────────────────────────*/
/* 5. Header & Footer                                            */
/*───────────────────────────────────────────────────────────────*/
export const Header = z.object({
  logo: z.string(),
  logoAlt: LocalizedString.optional(),
  nav: z.array(NavItem),
  sticky: z.boolean().default(true),
  utilities: z.object({
    themeSwitch: z.boolean().default(true),
    langSwitch: z.boolean().default(true),
    search: z.boolean().default(false),
    auth: z.boolean().default(false), // login/logout btn
  }).default({}),
});
export type Header = z.infer<typeof Header>;

export const Footer = z.object({
  columns: z.array(z.object({ title: LocalizedString, links: z.array(z.object({ href: z.string(), label: LocalizedString, external: z.boolean().optional() })) })),
  socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
  extra: z.string().optional(),
  newsletter: NewsletterSection.optional(),
  copyright: LocalizedString,
});
export type Footer = z.infer<typeof Footer>;

/*───────────────────────────────────────────────────────────────*/
/* 6. Intégrations externes & features                           */
/*───────────────────────────────────────────────────────────────*/
const AnalyticsIntegration = z.object({ provider: z.enum(["ga4", "matomo", "plausible", "posthog"]), id: z.string() });
const ChatIntegration       = z.object({ provider: z.enum(["intercom", "crisp", "hubspot"]), id: z.string() });
const ScriptTag            = z.object({ src: z.string(), async: z.boolean().default(true), defer: z.boolean().default(true) });

export const Integrations = z.object({ analytics: AnalyticsIntegration.optional(), chat: ChatIntegration.optional(), scripts: z.array(ScriptTag).optional() });
export type Integrations = z.infer<typeof Integrations>;

/*───────────────────────────────────────────────────────────────*/
/* 7. Feature flags / A‑B tests                                  */
/*───────────────────────────────────────────────────────────────*/
export const FeatureFlag = z.object({ key: z.string(), enabled: z.boolean().default(false), variant: z.string().optional() });

/*───────────────────────────────────────────────────────────────*/
/* 8. SiteConfig – racine                                         */
/*───────────────────────────────────────────────────────────────*/
export const SiteConfig = z.object({
  version: z.string().optional(),
  generated: z.string().optional(), // ISO timestamp
  meta: z.object({
    title: LocalizedString,
    description: LocalizedString.optional(),
    defaultLang: z.enum(LOCALES).default("fr"),
    languages: z.array(z.enum(LOCALES)).default(LOCALES),
    favicon: z.string().optional(),
    themeColor: z.string().optional(),
  }),
  header: Header,
  pages: z.array(Page),
  footer: Footer,
  integrations: Integrations.optional(),
  features: z.array(FeatureFlag).optional(),
});
export type SiteConfig = z.infer<typeof SiteConfig>;

/*───────────────────────────────────────────────────────────────*/
/* 9. Exemple type‑safe                                          */
/*───────────────────────────────────────────────────────────────*/
export const example: SiteConfig = {
  meta: {
    title: { fr: "Mon Site", en: "My Site" },
    defaultLang: "fr",
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
  },
  pages: [
    {
      path: "/",
      title: { fr: "Bienvenue", en: "Welcome" },
      sections: [
        {
          type: "hero",
          props: {
            headline: { fr: "Site JSON", en: "JSON‑Driven" },
            subhead: { fr: "Tout vient du fichier", en: "Everything from JSON" },
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
    { key: "newNavbar", enabled: false },
  ],
};