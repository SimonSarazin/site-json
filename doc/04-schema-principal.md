[← Retour à l'index](README.md)

# Documentation exhaustive du schema JSON (`SiteConfigSchema`)

**Sommaire**

- [Documentation exhaustive du schema JSON (`SiteConfigSchema`)](#documentation-exhaustive-du-schema-json-siteconfigschema)
  - [Proprietes racine](#proprietes-racine)
  - [`MetaSchema`](#metaschema)
  - [`HeaderSchema`](#headerschema)
    - [`EnhancedNavItem`](#enhancednavitem)
    - [`NavBadge`](#navbadge)
    - [`MegaMenu`](#megamenu)
    - [Utilitaires](#utilitaires)
  - [`PageSchema`](#pageschema)
    - [`PageMeta`](#pagemeta)
  - [Sections (`SectionSchemaUnion`)](#sections-sectionschemaunion)
  - [`FooterSchema`](#footerschema)
  - [`IntegrationsSchema`](#integrationsschema)
  - [`FeatureFlagSchema`](#featureflagschema)
  - [`ThemeConfigSchema`](#themeconfigschema)
  - [`PerformanceConfigSchema`](#performanceconfigschema)
  - [`ProfilesConfigSchema`](#profilesconfigschema)
  - [`AmpliConfigSchema`](#ampliconfigschema)
  - [`floatingQRCode`](#floatingqrcode)
  - [`auth`](#auth)
  - [`AdvancedSiteConfig`](#advancedsiteconfig)
  - [Voir aussi](#voir-aussi)

---

Ci-dessous la description complete de chaque propriete du schema global **`SiteConfigSchema`**, ainsi que de tous les types de sections supportes, basee sur le fichier source `src/types/site-schema.ts`.

---

## Proprietes racine

```ts
export const SiteConfig = z.object({
  version: z.string().optional(),
  generated: z.string().optional(), // ISO timestamp
  meta: z.object({ /* MetaSchema */ }),
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
  auth: z.object({
    login: z.object({
      title: LocalizedString.optional(),
      subtitle: LocalizedString.optional(),
    }).optional(),
  }).optional(),
  profiles: ProfilesConfigSchema,
  floatingQRCode: z.object({
    enabled: z.boolean().default(false),
    url: z.string().optional(),
    position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).default("bottom-right"),
    size: z.number().optional().default(80),
    expandedSize: z.number().optional().default(200),
    includeFavicon: z.boolean().optional().default(true),
    bgColor: z.string().optional().default("#ffffff"),
    fgColor: z.string().optional().default("#000000"),
  }).optional(),
  ampli: z.array(AmpliConfigSchema).optional(),
});
```

| Propriete        | Type                    | Requis ? | Description                                                        |
| ---------------- | ----------------------- | -------- | ------------------------------------------------------------------ |
| **version**      | `string`                | Non      | Version du schema de configuration                                 |
| **generated**    | `string`                | Non      | Timestamp ISO de generation                                        |
| **meta**         | `MetaSchema`            | Oui      | Metadonnees globales du site                                       |
| **header**       | `Header`                | Oui      | Configuration de l'en-tete (logo, menu, utilitaires)               |
| **pages**        | `Page[]`                | Oui      | Liste des pages du site avec leur configuration et leurs sections  |
| **footer**       | `Footer`                | Oui      | Configuration du pied de page                                      |
| **integrations** | `Integrations`          | Non      | Integrations externes (analytics, chat, etc.)                      |
| **features**     | `FeatureFlag[]`         | Non      | Feature flags / tests A-B                                          |
| **theme**        | `ThemeConfig`           | Non      | Theme et design system                                             |
| **performance**  | `PerformanceConfig`     | Non      | Configuration de performance                                       |
| **redirects**    | `array`                 | Non      | Regles de redirection                                              |
| **customDomains**| `string[]`              | Non      | Domaines supplementaires                                           |
| **maintenance**  | `object`                | Non      | Mode maintenance                                                   |
| **auth**         | `object`                | Non      | Configuration de l'authentification                                |
| **profiles**     | `ProfilesConfigSchema`  | Non      | Configuration des pages profil                                     |
| **floatingQRCode** | `object`              | Non      | QR Code flottant                                                   |
| **ampli**        | `AmpliConfigSchema[]`   | Non      | Configuration du module Ampli                                      |

---

## `MetaSchema`

```ts
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
})
```

| Cle           | Type                            | Requis ? | Exemple                         | Description                               |
| ------------- | ------------------------------- | -------- | ------------------------------- | ----------------------------------------- |
| `title`       | `LocalizedString`               | Oui      | `{ fr: "Accueil", en: "Home" }` | Titre multi-langues du site               |
| `description` | `LocalizedString`               | Non      | `{ fr: "...", en: "..." }`      | Description multi-langues                 |
| `defaultLang` | `z.enum(LOCALES)`               | Oui      | `"fr"`                          | Langue par defaut (defaut: `"fr"`)        |
| `languages`   | `z.enum(LOCALES)[]`             | Oui      | `["fr","en"]`                   | Langues supportees (defaut: toutes)       |
| `favicon`     | `string`                        | Non      | `"/favicon.ico"`                | Chemin ou URL de l'icone                  |
| `themeColor`  | `string`                        | Non      | `"#3b82f6"`                     | Couleur principale (meta `<theme-color>`) |
| `author`      | `LocalizedString`               | Non      | `{ fr: "Auteur" }`             | Auteur du site                            |
| `keywords`    | `string[]`                      | Non      | `["tiers-lieux", "social"]`    | Mots-cles pour le SEO                     |
| `robots`      | `string`                        | Non      | `"index, follow"`              | Directive robots                          |

---

## `HeaderSchema`

```ts
export const Header = z.object({
  type: z.enum(["tiers-lieux", "rezo-la-mer", "cyber-reunion", "julie-pot-vin", "nos-communes", "commune-transparente", "default"]).default("default"),
  logo: z.string().optional(),
  logoAlt: LocalizedString.optional(),
  logoTitle: LocalizedString.optional(),
  logoIcon: z.string().optional(),
  path: z.string().min(1).optional(),
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
  ctaButton: z.object({
    label: LocalizedString,
    path: z.string().optional(),
  }).optional(),
  piggyBank: z.object({
    amount: z.string().optional(),
    icon: z.string().optional(),
    path: z.string().optional(),
  }).optional(),
  urgenceButton: z.object({
    label: LocalizedString,
    icon: z.string().optional(),
    path: z.string().optional(),
  }).optional(),
  announcement: z.object({
    text: LocalizedString,
    href: z.string().optional(),
    dismissible: z.boolean().default(true),
    variant: z.enum(["info", "success", "warning", "error"]).default("info"),
  }).optional(),
});
```

| Cle              | Type                     | Defaut      | Description                                       |
| ---------------- | ------------------------ | ----------- | ------------------------------------------------- |
| `type`           | `enum`                   | `"default"` | Variante du header                                |
| `logo`           | `string`                 | -           | URL ou chemin du logo                             |
| `logoAlt`        | `LocalizedString`        | -           | Texte alternatif du logo                          |
| `logoTitle`      | `LocalizedString`        | -           | Titre affiche a cote du logo                      |
| `logoIcon`       | `string`                 | -           | Nom d'icone (lucide) pour le logo                 |
| `path`           | `string`                 | -           | Chemin de redirection du logo (lien accueil)      |
| `nav`            | `EnhancedNavItem[]`      | -           | Elements de navigation                            |
| `sticky`         | `boolean`                | `true`      | Header fixe en haut de page                       |
| `transparent`    | `boolean`                | `false`     | Header transparent                                |
| `height`         | `"sm" \| "md" \| "lg"`  | `"md"`      | Hauteur du header                                 |
| `utilities`      | `object`                 | -           | Utilitaires (voir ci-dessous)                     |
| `ctaButton`      | `object`                 | -           | Bouton d'appel a l'action dans le header          |
| `piggyBank`      | `object`                 | -           | Tirelire (montant, icone, lien)                   |
| `urgenceButton`  | `object`                 | -           | Bouton d'urgence dans le header                   |
| `announcement`   | `object`                 | -           | Bandeau d'annonce au-dessus du header             |

### `EnhancedNavItem`

```ts
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
```

| Cle           | Type                  | Requis ? | Description                              |
| ------------- | --------------------- | -------- | ---------------------------------------- |
| `label`       | `LocalizedString`     | Oui      | Texte du menu multi-langues              |
| `path`        | `string`              | Non      | Route interne (`"/about"`)               |
| `href`        | `string (URL)`        | Non      | Lien absolu externe                      |
| `icon`        | `string`              | Non      | Nom d'icone (lucide, etc.)               |
| `badge`       | `NavBadge`            | Non      | Badge associe (ex. "Nouveau")            |
| `roles`       | `string[]`            | Non      | Visibilite RBAC                          |
| `children`    | `EnhancedNavItem[]`   | Non      | Sous-menus recursifs                     |
| `megaMenu`    | `MegaMenu`            | Non      | Mega menu a colonnes                     |
| `description` | `LocalizedString`     | Non      | Description de l'element de navigation   |

### `NavBadge`

```ts
const NavBadge = z.object({ text: LocalizedString }).optional();
```

| Cle    | Type              | Description             |
| ------ | ----------------- | ----------------------- |
| `text` | `LocalizedString` | Texte du badge          |

### `MegaMenu`

```ts
const MegaMenu = z.object({
  columns: z.array(MegaMenuColumn),
  width: z.enum(["sm", "md", "lg", "xl", "full"]).default("lg"),
});

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
```

### Utilitaires

| Cle             | Type      | Defaut  | Description                    |
| --------------- | --------- | ------- | ------------------------------ |
| `themeSwitch`   | `boolean` | `true`  | Affiche le switch dark/light   |
| `langSwitch`    | `boolean` | `true`  | Affiche le selecteur de langue |
| `search`        | `boolean` | `false` | Affiche l'icone recherche      |
| `auth`          | `boolean` | `false` | Affiche l'authentification     |
| `cart`          | `boolean` | `false` | Affiche le panier              |
| `notifications` | `boolean` | `false` | Affiche les notifications      |

---

## `PageSchema`

```ts
export const Page = z.object({
  path: z.string(),
  title: LocalizedString,
  seo: PageMeta.optional(),
  layout: z.enum(["default", "fullwidth", "sidebar-left", "sidebar-right", "landing"]).default("default"),
  auth: z.object({ required: z.boolean().default(false), roles: z.array(z.string()).optional() }).optional(),
  middleware: z.array(z.string()).optional(),
  sections: z.array(Section),
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  customCSS: z.string().optional(),
  customJS: z.string().optional(),
});
```

| Cle          | Type                     | Requis ? | Description                                           |
| ------------ | ------------------------ | -------- | ----------------------------------------------------- |
| `path`       | `string`                 | Oui      | Chemin de la route (`"/"`, `"/about"`)                |
| `title`      | `LocalizedString`        | Oui      | Titre multi-langues de la page                       |
| `seo`        | `PageMeta`               | Non      | Metadonnees SEO de la page                           |
| `layout`     | `enum`                   | Non      | Layout de la page (defaut: `"default"`)              |
| `auth`       | `object`                 | Non      | Authentification requise et roles autorises           |
| `middleware` | `string[]`               | Non      | Fonctions middleware a executer avant rendu           |
| `sections`   | `Section[]`              | Oui      | Sections de la page                                  |
| `hideHeader` | `boolean`                | Non      | Masquer l'en-tete sur cette route                    |
| `hideFooter` | `boolean`                | Non      | Masquer le pied de page sur cette route              |
| `customCSS`  | `string`                 | Non      | CSS additionnel par page                             |
| `customJS`   | `string`                 | Non      | JS additionnel par page                              |

### `PageMeta`

```ts
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
```

| Cle              | Type              | Description                                   |
| ---------------- | ----------------- | --------------------------------------------- |
| `title`          | `LocalizedString` | Meta `<title>` (optionnel)                    |
| `description`    | `LocalizedString` | Meta `<meta name="description">`              |
| `keywords`       | `string[]`        | Mots-cles SEO                                 |
| `ogImage`        | `string`          | OpenGraph image                               |
| `ogType`         | `string`          | Type OG (`website`, `article`...)             |
| `twitterCard`    | `enum`            | `summary`, `summary_large_image`, etc.        |
| `canonical`      | `string`          | URL canonique de la page                      |
| `noIndex`        | `boolean`         | Empecher l'indexation par les moteurs         |
| `noFollow`       | `boolean`         | Empecher le suivi des liens                   |
| `structuredData` | `Record`          | JSON-LD (Schema.org)                          |

---

## Sections (`SectionSchemaUnion`)

> Pour la reference complete des types de sections, voir [Schemas sections](05-schemas-sections.md).

---

## `FooterSchema`

```ts
export const Footer = z.object({
  type: z.enum(["tiers-lieux", "rezo-la-mer", "cyber-reunion", "nos-communes", "commune-transparente", "default"]).default("default"),
  columns: z.array(FooterColumn),
  socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
  extra: z.string().optional(),
  newsletter: NewsletterSectionSchema.optional(),
  copyright: LocalizedString,
  logo: z.string().optional(),
  logoIcon: z.string().optional(),
  logoTitle: LocalizedString.optional(),
  logoAlt: LocalizedString.optional(),
  description: LocalizedString.optional(),
  legalLinks: z.array(z.object({
    href: z.string(),
    label: LocalizedString,
  })).optional(),
  bottomLinks: z.array(z.object({
    href: z.string(),
    label: LocalizedString,
  })).optional(),
  paymentMethods: z.array(z.string()).optional(),
  website: z.string().optional(),
});
```

| Cle              | Type                          | Requis ? | Description                                  |
| ---------------- | ----------------------------- | -------- | -------------------------------------------- |
| `type`           | `enum`                        | Non      | Variante du footer (defaut: `"default"`)     |
| `columns`        | `FooterColumn[]`              | Oui      | Colonnes de liens du footer                  |
| `socials`        | `{ platform, url }[]`         | Non      | Liens reseaux sociaux                        |
| `extra`          | `string`                      | Non      | HTML ou texte complementaire                 |
| `newsletter`     | `NewsletterSectionSchema`     | Non      | Formulaire d'abonnement newsletter           |
| `copyright`      | `LocalizedString`             | Oui      | Texte de copyright                           |
| `logo`           | `string`                      | Non      | URL ou chemin du logo                        |
| `logoIcon`       | `string`                      | Non      | Nom d'icone (lucide) pour le logo            |
| `logoTitle`      | `LocalizedString`             | Non      | Titre affiche a cote du logo                 |
| `logoAlt`        | `LocalizedString`             | Non      | Texte alternatif du logo                     |
| `description`    | `LocalizedString`             | Non      | Texte descriptif du footer                   |
| `legalLinks`     | `{ href, label }[]`           | Non      | Liens legaux                                 |
| `bottomLinks`    | `{ href, label }[]`           | Non      | Liens en bas du footer                       |
| `paymentMethods` | `string[]`                    | Non      | Icones de moyens de paiement                 |
| `website`        | `string`                      | Non      | URL du site web                              |

`FooterColumn` :

```ts
const FooterColumn = z.object({
  title: LocalizedString,
  links: z.array(z.object({
    href: z.string(),
    label: LocalizedString,
    external: z.boolean().optional(),
    icon: z.string().optional(),
  })),
});
```

---

## `IntegrationsSchema`

```ts
export const Integrations = z.object({
  analytics: AnalyticsIntegration.optional(),
  chat: ChatIntegration.optional(),
  scripts: z.array(ScriptTag).optional(),
  seo: SEOIntegration.optional(),
  ecommerce: EcommerceIntegration.optional(),
  email: EmailIntegration.optional(),
  crm: CRMIntegration.optional(),
});
```

* **analytics** (`AnalyticsIntegration`)
* **chat** (`ChatIntegration`)
* **scripts** (`ScriptTag[]`) : injections de `<script>` conditionnelles.
* **seo** (`SEOIntegration`)
* **ecommerce** (`EcommerceIntegration`)
* **email** (`EmailIntegration`)
* **crm** (`CRMIntegration`)

---

## `FeatureFlagSchema`

```ts
export const FeatureFlag = z.object({
  key: z.string(),
  enabled: z.boolean().default(false),
  variant: z.string().optional(),
  description: z.string().optional(),
  rolloutPercentage: z.number().min(0).max(100).default(100),
  conditions: z.record(z.string(), z.any()).optional(),
});
```

* **key** : identifiant du flag.
* **enabled** : active ou non la feature.
* **variant** : variante du test A/B.
* **description** : information sur le flag.
* **rolloutPercentage** : pourcentage d'utilisateurs cibles.
* **conditions** : filtre segmente (IP, geolocalisation...).

---

## `ThemeConfigSchema`

```ts
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
  defaultMode: z.enum(["light", "dark", "system"]).optional().default("light"),
  colors: z.object({
    light: ColorPalette,
    dark: ColorPalette,
  }).optional(),
  typography: Typography.optional(),
  spacing: Spacing.optional(),
  borderRadius: BorderRadius.optional(),
  shadows: z.object({
    light: Shadows,
    dark: Shadows,
  }).optional(),
  customCSS: z.string().optional(),
});
```

| Cle            | Type                             | Description                                 |
| -------------- | -------------------------------- | ------------------------------------------- |
| `defaultMode`  | `"light" \| "dark" \| "system"` | Mode par defaut (defaut: `"light"`)         |
| `colors`       | `{ light: ColorPalette, dark: ColorPalette }` | Palettes light et dark         |
| `typography`   | `Typography`                     | Famille de fontes et letter-spacing         |
| `spacing`      | `Spacing`                        | Echelle de base (`base: string`)            |
| `borderRadius` | `BorderRadius`                   | Rayon d'arrondi de base (`base: string`)    |
| `shadows`      | `{ light: Shadows, dark: Shadows }` | Ombres par mode (2xs a 2xl)             |
| `customCSS`    | `string`                         | CSS global additionnel                      |

---

## `PerformanceConfigSchema`

```ts
const PerformanceConfig = z.object({
  lazyLoading: z.boolean().default(true),
  imageOptimization: z.boolean().default(true),
  caching: z.object({
    enabled: z.boolean().default(true),
    strategy: z.enum(["stale-while-revalidate","cache-first","network-first"]).default("stale-while-revalidate"),
    maxAge: z.number().default(3600)
  }),
  compression: z.boolean().default(true),
  minification: z.boolean().default(true),
  criticalCSS: z.boolean().default(true)
});
```

* **lazyLoading** : activer le chargement differe.
* **imageOptimization** : optimiser les images a la volee.
* **caching** : strategie et duree de cache.
* **compression** : activer gzip/brotli.
* **minification** : minifier HTML/CSS/JS.
* **criticalCSS** : extraire le CSS critique.

---

## `ProfilesConfigSchema`

Configuration des pages profil par type d'entite. Le schema complet est defini dans `src/modules/profil/schema.ts`.

```ts
export const ProfilesConfigSchema = z.object({
  default: ProfileConfigSchema.optional(),
  events: ProfileConfigSchema.optional(),
  organizations: ProfileConfigSchema.optional(),
  projects: ProfileConfigSchema.optional(),
  citoyens: ProfileConfigSchema.optional(),
  poi: ProfileConfigSchema.optional(),
}).optional();
```

Chaque `ProfileConfigSchema` configure le layout, les sections et les onglets du profil pour un type d'entite donne.

> Pour la reference complete, voir [Module Profil](08-module-profil.md).

---

## `AmpliConfigSchema`

Configuration du module Ampli (amplification de projets). Defini dans `src/modules/ampli/schema.ts`.

```ts
export const AmpliConfigSchema = z.object({
  layout: AmpliLayoutVariantSchema.optional().default("default"),
  seo: z.object({
    titleTemplate: z.string().optional(),
    descriptionTemplate: z.string().optional(),
  }).optional(),
  slug: z.string().min(1),
  props: z.object({
    coform: z.string().min(1),
    path: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      address: z.string().min(1),
      image: z.string().optional(),
      finder: z.string().optional(),
      tags: z.string().optional(),
    }),
    hero: z.object({ /* ... */ }).optional(),
    intro: z.object({ /* ... */ }).optional(),
    features: z.object({ /* ... */ }).optional(),
    message: z.object({ /* ... */ }).optional(),
    community: z.object({ /* ... */ }).optional(),
    dashboard: z.object({ /* ... */ }).optional(),
    news: z.object({ /* ... */ }).optional(),
  }),
});
```

| Cle      | Type     | Requis ? | Description                              |
| -------- | -------- | -------- | ---------------------------------------- |
| `layout` | `enum`   | Non      | Variante de layout (defaut: `"default"`) |
| `seo`    | `object` | Non      | Templates SEO                            |
| `slug`   | `string` | Oui      | Slug de la page Ampli                    |
| `props`  | `object` | Oui      | Contenu et chemins de la page            |

---

## `floatingQRCode`

```ts
floatingQRCode: z.object({
  enabled: z.boolean().default(false),
  url: z.string().optional(),
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).default("bottom-right"),
  size: z.number().optional().default(80),
  expandedSize: z.number().optional().default(200),
  includeFavicon: z.boolean().optional().default(true),
  bgColor: z.string().optional().default("#ffffff"),
  fgColor: z.string().optional().default("#000000"),
}).optional()
```

| Cle              | Type      | Defaut           | Description                          |
| ---------------- | --------- | ---------------- | ------------------------------------ |
| `enabled`        | `boolean` | `false`          | Activer le QR code flottant          |
| `url`            | `string`  | -                | URL encodee dans le QR code          |
| `position`       | `enum`    | `"bottom-right"` | Position sur l'ecran                 |
| `size`           | `number`  | `80`             | Taille en pixels                     |
| `expandedSize`   | `number`  | `200`            | Taille au survol                     |
| `includeFavicon` | `boolean` | `true`           | Inclure le favicon dans le QR code   |
| `bgColor`        | `string`  | `"#ffffff"`      | Couleur de fond                      |
| `fgColor`        | `string`  | `"#000000"`      | Couleur du QR code                   |

---

## `auth`

```ts
auth: z.object({
  login: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
  }).optional(),
}).optional()
```

| Cle              | Type              | Description                        |
| ---------------- | ----------------- | ---------------------------------- |
| `login.title`    | `LocalizedString` | Titre de la page de connexion      |
| `login.subtitle` | `LocalizedString` | Sous-titre de la page de connexion |

---

## `AdvancedSiteConfig`

Les proprietes avancees sont integrees directement dans `SiteConfigSchema` :

```ts
// Deja inclus dans SiteConfig
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
```

* **redirects** (`{ from, to, permanent }[]`) : regles de redirection.
* **customDomains** (`string[]`) : domaines supplementaires.
* **maintenance** : mode maintenance avec message et IPs autorisees.

---

## Voir aussi

- [Schemas sections](05-schemas-sections.md)
- [Sections dynamiques](06-sections-dynamiques.md)
