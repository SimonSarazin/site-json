[← Retour à l'index](README.md)

# Sections -- Schemas complets

**Sommaire**

- [Sections -- Schemas complets](#sections----schemas-complets)
  - [`hero`](#hero)
  - [`heroWithIcon`](#herowithicon)
  - [`cards`](#cards)
  - [`stats`](#stats)
  - [`logoCloud`](#logocloud)
  - [`testimonials`](#testimonials)
  - [`pricing`](#pricing)
  - [`faq`](#faq)
  - [`cta`](#cta)
  - [`blogList`](#bloglist)
  - [`contactForm`](#contactform)
  - [`registerForm`, `loginForm`, `recoverPasswordForm`](#registerform-loginform-recoverpasswordform)
  - [`markdown`](#markdown)
  - [`gallery`](#gallery)
  - [`video`](#video)
  - [`table`](#table)
  - [`chart`](#chart)
  - [`map`](#map)
  - [`newsletter`](#newsletter)
  - [`comparison`](#comparison)
  - [`featureComparison`](#featurecomparison)
  - [`socialFeed`](#socialfeed)
  - [`search` (deprecie)](#search-deprecie)
  - [`eventList`](#eventlist)
  - [`productShowcase`](#productshowcase)
  - [`cookieConsent`](#cookieconsent)
  - [`html`](#html)
  - [`banner`](#banner)
  - [`breadcrumb`](#breadcrumb)
  - [`accordion`](#accordion)
  - [`tabs`](#tabs)
  - [`steps`](#steps)
  - [`team`](#team)
  - [`timeline`](#timeline)
  - [`blogPost`](#blogpost)
  - [`member`](#member)
  - [`searchPro`](#searchpro)
    - [Details de `ListConfSchema`](#details-de-listconfschema)
    - [Details de `MapConfSchema`](#details-de-mapconfschema)
  - [`searchProStatic`](#searchprostatic)
  - [`hero-tiers-lieux`](#hero-tiers-lieux)
  - [`hero-rezo-la-mer`](#hero-rezo-la-mer)
  - [`hero-nos-communes`](#hero-nos-communes)
  - [`hero-commune-transparente`](#hero-commune-transparente)
  - [`features-rezo-la-mer`](#features-rezo-la-mer)
  - [`action-buttons-rezo-la-mer`](#action-buttons-rezo-la-mer)
  - [`community-rezo-la-mer`](#community-rezo-la-mer)
  - [`cta-rezo-la-mer`](#cta-rezo-la-mer)
  - [`title-with-filters-rezo-la-mer`](#title-with-filters-rezo-la-mer)
  - [`commune-transparente-actions`](#commune-transparente-actions)
  - [`meeteem`](#meeteem)
  - [`cardCountCT`](#cardcountct)
  - [`thematics`](#thematics)
  - [`title`](#title)
  - [`content`](#content)
  - [`filters`](#filters)
  - [`gridLayout`](#gridlayout)
  - [`news`](#news)
  - [Voir aussi](#voir-aussi)

---

Chaque section est un objet :

```ts
SectionSchema = z.object({ type: z.literal(<SECTION_TYPE>), id?: string, props: <PropsSchema> })
```

## `hero`

```ts
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
```

## `heroWithIcon`

```ts
const HeroWithIconSectionSchema = z.object({
  type: z.literal("heroWithIcon"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    icon: z.object({
      show: z.boolean().default(true),
      name: z.string().optional(),
      size: z.number().default(64),
      backdrop: z.boolean().default(false),
    }),
    backgroundImage: z.string().optional(),
    videoBg: z.string().optional(),
    align: Alignment.default("center"),
    overlay: z.boolean().default(false),
    cta: z.array(
      z.object({ label: LocalizedString, icon: z.string().optional(), href: z.string(), variant: z.string().optional() })
    ).optional(),
    listContent: z.object({
      items: z.array(z.object({
        title: LocalizedString,
        icon: z.string().optional(),
        iconPosition: z.enum(["left", "right", "top", "bottom"]).default("left"),
      })),
      layout: z.enum(["rows", "columns"]).default("columns"),
    }).optional(),
    scrollTo: z.string().optional(),
  })
});
```

| Propriete     | Type     | Description                                   |
| ------------- | -------- | --------------------------------------------- |
| `headline`    | `LocalizedString` | Titre principal                        |
| `subhead`     | `LocalizedString?` | Sous-titre                            |
| `icon`        | `object` | Configuration de l'icone (show, name, size, backdrop) |
| `backgroundImage` | `string?` | Image de fond                         |
| `videoBg`     | `string?` | Video de fond                               |
| `align`       | `enum`   | Alignement (defaut: `"center"`)               |
| `overlay`     | `boolean` | Afficher un overlay (defaut: `false`)         |
| `cta`         | `array?` | Boutons CTA avec label, icon, href, variant   |
| `listContent` | `object?` | Liste de contenu avec items et layout         |
| `scrollTo`    | `string?` | Ancre pour scroll                             |

## `cards`

```ts
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
        iconSvg: z.string().optional(),
        iconColor: z.string().optional(),
        iconImage: z.string().optional(),
        iconClipPath: z.string().optional(),
      })
    ),
    columns: Columns.default(3),
    layout: z.enum(["grid", "masonry", "carousel", "list"]).default("grid"),
    variant: z.enum(["default", "tiers-lieux", "event", "icon-card"]).default("default"),
    className: z.string().optional(),
    showHeader: z.boolean().default(false),
    headerTitle: LocalizedString.optional(),
    showResultCount: z.boolean().default(false),
    showViewToggle: z.boolean().default(false),
  }),
});
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `items` | `array` | Liste des cartes a afficher |
| `columns` | `1-6` | Nombre de colonnes (defaut: 3) |
| `layout` | `"grid" \| "masonry" \| "carousel" \| "list"` | Mode d'affichage |
| `variant` | `"default" \| "tiers-lieux" \| "event" \| "icon-card"` | Variante visuelle |
| `showHeader` | `boolean` | Afficher l'en-tete de section |
| `headerTitle` | `LocalizedString?` | Titre de l'en-tete |
| `showResultCount` | `boolean` | Afficher le compteur de resultats |
| `showViewToggle` | `boolean` | Afficher le toggle de vue |

## `stats`

```ts
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
```

| Propriete     | Type     | Description                             |
| ------------- | -------- | --------------------------------------- |
| `items`       | `array`  | Liste des statistiques                  |
| `description` | `LocalizedString?` | Description (optionnel)        |
| `icon`        | `string?` | Icone (optionnel)                      |
| `layout`      | `enum`   | Disposition (defaut: `"horizontal"`)    |
| `animated`    | `boolean` | Animation (defaut: `true`)             |

## `logoCloud`

```ts
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
```

| Propriete   | Type      | Description                              |
| ----------- | --------- | ---------------------------------------- |
| `title`     | `LocalizedString?` | Titre de la section             |
| `logos`     | `array`   | Liste des logos (src, alt, href)          |
| `src`       | `string`  | Chemin ou URL de l'image                 |
| `href`      | `string?` | Lien optionnel sur le logo               |
| `grayscale` | `boolean` | Logos en niveaux de gris (defaut: `true`) |
| `animated`  | `boolean` | Animation (defaut: `false`)              |

## `testimonials`

```ts
const TestimonialsSectionSchema = z.object({
  type: z.literal("testimonials"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({
      quote: LocalizedString,
      author: LocalizedString,
      role: LocalizedString.optional(),
      avatar: z.string().optional()
    })),
    style: z.enum(["grid", "carousel", "ticker"]).default("carousel"),
    autoplay: z.boolean().default(true),
  }),
});
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `items` | `array` | Liste des temoignages |
| `style` | `"grid" \| "carousel" \| "ticker"` | Mode d'affichage (ticker = defilement continu) |
| `autoplay` | `boolean` | Lecture automatique du carousel/ticker |

## `pricing`

```ts
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
```

| Propriete   | Type      | Description                                     |
| ----------- | --------- | ----------------------------------------------- |
| `currency`  | `string`  | Devise (defaut: `"€"`)                          |
| `plans`     | `array`   | Liste des plans tarifaires                       |
| `highlight` | `number?` | Index du plan mis en avant (optionnel)           |
| `period`    | `string?` | Periode de facturation (optionnel)               |
| `sku`       | `string?` | Identifiant produit                              |

## `faq`

```ts
const FAQSectionSchema = z.object({
  type: z.literal("faq"),
  id: z.string().optional(),
  props: z.object({
    items: z.array(z.object({ q: LocalizedString, a: LocalizedString })),
    accordion: z.boolean().default(true),
  }),
});
```

## `cta`

```ts
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
```

| Propriete         | Type      | Description                                  |
| ----------------- | --------- | -------------------------------------------- |
| `headline`        | `LocalizedString` | Titre principal                       |
| `subhead`         | `LocalizedString?` | Sous-titre                           |
| `backgroundImage` | `string?` | Image de fond                                |
| `backgroundColor` | `string?` | Couleur de fond                              |
| `buttons`         | `array`   | Boutons CTA                                  |
| `variant`         | `enum`    | `"default" \| "secondary" \| "outline" \| "ghost"` |
| `align`           | `enum`    | Alignement (defaut: `"center"`)              |

## `blogList`

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `posts` | `array` | Liste des articles |
| `layout` | `"grid" \| "list" \| "masonry"` | Mode d'affichage |
| `columns` | `1-6` | Nombre de colonnes |
| `pagination` | `boolean` | Activer la pagination |
| `postsPerPage` | `number` | Articles par page |

## `contactForm`

```ts
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
      validation: z.string().optional(),
    })),
    submitLabel: LocalizedString,
    action: z.string(),
    method: z.enum(["GET", "POST"]).default("POST"),
    successMessage: LocalizedString.optional(),
    errorMessage: LocalizedString.optional(),
  }),
});
```

## `registerForm`, `loginForm`, `recoverPasswordForm`

Ces trois formulaires ont des props **vides** (`z.object({})`). Le rendu est entierement gere par le composant React correspondant.

```ts
const LoginFormSectionSchema = z.object({
  type: z.literal("loginForm"),
  id: z.string().optional(),
  props: z.object({}),
});

const RegisterFormSectionSchema = z.object({
  type: z.literal("registerForm"),
  id: z.string().optional(),
  props: z.object({}),
});

const RecoverPasswordFormSectionSchema = z.object({
  type: z.literal("recoverPasswordForm"),
  id: z.string().optional(),
  props: z.object({}),
});
```

> **Note** : contrairement a `contactForm`, ces sections ne prennent aucune propriete `props`. Le formulaire est genere cote composant.

## `markdown`

```ts
const MarkdownSectionSchema = z.object({
  type: z.literal("markdown"),
  id: z.string().optional(),
  props: z.object({
    md: z.string(),
    sourceType: z.enum(["file", "inline"]).default("file"),
    animation: z.string().optional(),
  }),
});
```

## `gallery`

```ts
const GallerySectionSchema = z.object({
  type: z.literal("gallery"),
  id: z.string().optional(),
  props: z.object({
    images: z.array(z.object({ src: z.string(), alt: LocalizedString.optional(), caption: LocalizedString.optional() })),
    columns: Columns.default(3),
    lightbox: z.boolean().default(true),
  }),
});
```

## `video`

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `src` | `string` | URL ou ID de la video |
| `provider` | `"youtube" \| "vimeo" \| "local" \| "loom"` | Plateforme video |
| `ratio` | `"16/9" \| "4/3" \| "1/1" \| "9/16"` | Format d'affichage |
| `autoplay` | `boolean?` | Lecture automatique |
| `controls` | `boolean` | Afficher les controles |
| `loop` | `boolean` | Lecture en boucle |

## `table`

```ts
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
```

## `chart`

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `kind` | `"line" \| "bar" \| "pie" \| "area" \| "radar"` | Type de graphique |
| `data` | `array` | Donnees a afficher |
| `xKey` | `string` | Cle de l'axe X |
| `yKeys` | `string[]` | Cles des series Y |
| `stacked` | `boolean?` | Graphique empile (bar/area) |
| `legend` | `boolean` | Afficher la legende |

## `map`

```ts
const MapSectionSchema = z.object({
  type: z.literal("map"),
  id: z.string().optional(),
  props: z.object({
    provider: z.enum(["leaflet", "google", "mapbox"]).default("leaflet"),
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number().int().default(13),
    markers: z.array(z.object({
      position: z.tuple([z.number(), z.number()]),
      label: LocalizedString.optional(),
      popup: LocalizedString.optional()
    })).optional(),
  }),
});
```

| Propriete  | Type     | Description                                |
| ---------- | -------- | ------------------------------------------ |
| `provider` | `enum`   | `"leaflet" \| "google" \| "mapbox"` (defaut: `"leaflet"`) |
| `center`   | `[number, number]` | Coordonnees du centre               |
| `zoom`     | `number` | Niveau de zoom (defaut: `13`)              |
| `markers`  | `array?` | Marqueurs optionnels                       |

## `newsletter`

```ts
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
```

| Propriete          | Type              | Description                  |
| ------------------ | ----------------- | ---------------------------- |
| `headline`         | `LocalizedString` | Titre                        |
| `subhead`          | `LocalizedString?` | Sous-titre                  |
| `formAction`       | `string`          | Endpoint du formulaire       |
| `emailPlaceholder` | `LocalizedString?` | Placeholder (optionnel)     |
| `submitLabel`      | `LocalizedString` | Texte du bouton              |
| `successMessage`   | `LocalizedString?` | Message de succes (optionnel) |

## `comparison`

```ts
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
```

| Propriete     | Type              | Description                      |
| ------------- | ----------------- | -------------------------------- |
| `beforeImage` | `string`          | Image "avant"                    |
| `afterImage`  | `string`          | Image "apres"                    |
| `beforeLabel` | `LocalizedString?` | Label "avant" (optionnel)       |
| `afterLabel`  | `LocalizedString?` | Label "apres" (optionnel)       |
| `orientation` | `enum`            | Orientation (defaut: `"horizontal"`) |

## `featureComparison`

```ts
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
      features: z.array(z.union([z.boolean(), z.string()])),
      highlighted: z.boolean().default(false),
    })),
  }),
});
```

| Propriete            | Type      | Description                               |
| -------------------- | --------- | ----------------------------------------- |
| `features`           | `array`   | Liste des fonctionnalites                 |
| `features[].description` | `LocalizedString?` | Description optionnelle          |
| `plans`              | `array`   | Plans a comparer                          |
| `plans[].highlighted` | `boolean` | Plan mis en avant                        |

## `socialFeed`

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `platform` | `"twitter" \| "instagram" \| "linkedin" \| "facebook"` | Plateforme sociale |
| `feedId` | `string` | Identifiant du flux |
| `limit` | `number` | Nombre d'elements a afficher (defaut: 6) |
| `layout` | `"grid" \| "carousel" \| "masonry"` | Mode d'affichage |

## `search` (deprecie)

> Cette section de recherche a ete retiree du schema.
> Utilisez desormais [`searchPro`](#searchpro) pour les fonctionnalites de recherche avancee.

## `eventList`

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `events` | `array` | Liste des evenements |
| `layout` | `"list" \| "grid" \| "calendar"` | Mode d'affichage |
| `showPastEvents` | `boolean` | Afficher les evenements passes |

## `productShowcase`

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `products` | `array` | Liste des produits |
| `layout` | `"grid" \| "carousel" \| "featured"` | Mode d'affichage (featured = mise en avant) |
| `showPrices` | `boolean` | Afficher les prix |

## `cookieConsent`

```ts
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
```

## `html`

```ts
const HTMLSectionSchema = z.object({
  type: z.literal("html"),
  id: z.string().optional(),
  props: z.object({ html: z.string() }),
});
```

## `banner`

```ts
const BannerSectionSchema = z.object({
  type: z.literal("banner"),
  id: z.string().optional(),
  props: z.object({
    text: LocalizedString,
    variant: z.enum(["info", "success", "warning", "error"]).default("info"),
    dismissible: z.boolean().default(false),
  }),
});
```

| Propriete     | Type      | Description                                     |
| ------------- | --------- | ----------------------------------------------- |
| `text`        | `LocalizedString` | Texte du bandeau                         |
| `variant`     | `enum`    | `"info" \| "success" \| "warning" \| "error"` (defaut: `"info"`) |
| `dismissible` | `boolean` | Peut etre ferme (defaut: `false`)               |

---

## `breadcrumb`

```ts
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
```

---

## `accordion`

```ts
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
```

| Propriete       | Type      | Description                                      |
| --------------- | --------- | ------------------------------------------------ |
| `items`         | `array`   | Liste des elements (title, content, defaultOpen)  |
| `allowMultiple` | `boolean` | Autoriser l'ouverture de plusieurs (defaut: `false`) |

---

## `tabs`

```ts
const TabsSectionSchema = z.object({
  type: z.literal("tabs"),
  id: z.string().optional(),
  props: z.object({
    tabs: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      content: z.union([
        LocalizedString,
        z.array(z.lazy(() => SectionSchemaLazy)),
      ]),
      icon: z.string().optional(),
    })),
    defaultTab: z.string().optional(),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  }),
});
```

| Propriete     | Type      | Description                                        |
| ------------- | --------- | -------------------------------------------------- |
| `tabs`        | `array`   | Liste des onglets                                  |
| `tabs[].id`   | `string`  | Identifiant unique de l'onglet                     |
| `tabs[].label` | `LocalizedString` | Libelle de l'onglet (pas `title`)         |
| `tabs[].content` | `LocalizedString \| Section[]` | Texte ou tableau de sections |
| `tabs[].icon` | `string?` | Icone de l'onglet                                  |
| `defaultTab`  | `string?` | ID de l'onglet ouvert par defaut                   |
| `orientation` | `enum`    | `"horizontal" \| "vertical"` (defaut: `"horizontal"`) |

---

## `steps`

```ts
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
```

| Propriete      | Type      | Description                                         |
| -------------- | --------- | --------------------------------------------------- |
| `steps`        | `array`   | Liste des etapes                                    |
| `completed`    | `boolean` | Etape completee (defaut: `false`)                   |
| `orientation`  | `enum`    | `"horizontal" \| "vertical"` (defaut: `"horizontal"`) |
| `showProgress` | `boolean` | Afficher la barre de progression (defaut: `true`)   |

---

## `team`

```ts
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
```

| Propriete | Type      | Description                           |
| --------- | --------- | ------------------------------------- |
| `members` | `array`   | Liste des membres                     |
| `avatar`  | `string`  | Avatar (requis, pas de `.url()`)      |
| `socials` | `array?`  | Reseaux sociaux (platform, url)       |
| `layout`  | `enum`    | `"grid" \| "carousel"`               |
| `columns` | `1-6`     | Nombre de colonnes (defaut: 3)        |

---

## `timeline`

```ts
const TimelineSectionSchema = z.object({
  type: z.literal("timeline"),
  id: z.string().optional(),
  props: z.object({
    events: z.array(z.object({ date: z.string(), title: LocalizedString, text: LocalizedString })),
    alternating: z.boolean().default(true),
  }),
});
```

| Propriete    | Type      | Description                           |
| ------------ | --------- | ------------------------------------- |
| `events`     | `array`   | Liste des evenements                  |
| `alternating` | `boolean` | Alternance gauche/droite (defaut: `true`) |

## `blogPost`

```ts
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
```

| Propriete       | Type                 | Description                                    |
| --------------- | -------------------- | ---------------------------------------------- |
| `title`         | `LocalizedString`    | Titre de l'article                             |
| `excerpt`       | `LocalizedString?`   | Resume ou chapeau                              |
| `content`       | `LocalizedString`    | Contenu principal (Markdown inline ou fichier) |
| `author`        | `object?`            | Informations sur l'auteur                      |
| `publishedAt`   | `string?`            | Date de publication (ISO)                      |
| `tags`          | `LocalizedString[]?` | Liste de mots-cles                             |
| `featuredImage` | `string?`            | URL de l'image a la une                        |
| `readTime`      | `number?`            | Duree de lecture estimee (minutes)             |

---

## `member`

Section d'affichage des membres d'une organisation ou d'un projet.

```ts
const MemberCardConfSchema = z.object({
  type: z.enum(["default", "profile"]).default("default"),
  showDescription: z.boolean().optional().default(true),
  showAddress: z.boolean().optional().default(true),
  detailsMode: z.enum(["drawer", "dialog", "link"]).default("link"),
}).partial();

const MemberSectionSchema = z.object({
  type: z.literal("member"),
  id: z.string().optional(),
  props: z.object({
    organizationId: z.string().optional(),
    projectId: z.string().optional(),
    title: LocalizedString.optional(),
    showRole: z.boolean().optional().default(true),
    showManagement: z.boolean().optional().default(false),
    showCard: z.boolean().optional().default(true),
    showMap: z.boolean().optional().default(false),
    enableMap: z.boolean().optional().default(false),
    limit: z.number().optional(),
    card: MemberCardConfSchema.optional(),
  }),
});
```

| Propriete        | Type      | Description                                |
| ---------------- | --------- | ------------------------------------------ |
| `organizationId` | `string?` | ID de l'organisation                       |
| `projectId`      | `string?` | ID du projet                               |
| `title`          | `LocalizedString?` | Titre de la section                |
| `showRole`       | `boolean` | Afficher les roles (defaut: `true`)        |
| `showManagement` | `boolean` | Afficher la gestion (defaut: `false`)      |
| `showCard`       | `boolean` | Afficher les cartes (defaut: `true`)       |
| `showMap`        | `boolean` | Afficher la carte (defaut: `false`)        |
| `enableMap`      | `boolean` | Charger la carte (defaut: `false`)         |
| `limit`          | `number?` | Limite du nombre de membres                |
| `card`           | `object?` | Configuration de la carte membre           |

---

## `searchPro`

```ts
import { SearchProSectionSchema } from "@/modules/search/schema";
```

```ts
export const SearchProSectionSchema = z.object({
  type: z.literal("searchPro"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString,
    useFilter:   z.boolean().default(true),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    showActiveFiltersTypes: z.boolean().default(true),
    showActiveFiltersTags: z.boolean().default(true),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      showMapButton: z.boolean().default(true),
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      indexStepMap:  z.number().optional(),
      defaultTypes:  z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      defaultFields:  z.array(z.string()).optional(),
      defaultSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
      notSourceKey: z.boolean().optional(),
      locality: z.record(z.string(), z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().optional(),
        countryCode: z.string().optional(),
        level: z.union([z.string(), z.number()]).optional(),
        active: z.boolean().optional(),
        key: z.string().optional(),
      })).optional(),
    }).optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
  }),
});
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `title` | `LocalizedString?` | Titre affiche au-dessus de la recherche |
| `description` | `LocalizedString?` | Texte introductif optionnel |
| `placeholder` | `LocalizedString` | Texte du champ de recherche |
| `useFilter` | `boolean` | Afficher/masquer les filtres |
| `showMap` | `boolean` | Afficher/masquer la carte |
| `enableMap` | `boolean` | Charger les ressources cartographiques |
| `showActiveFiltersTypes` | `boolean` | Afficher les types actifs |
| `showActiveFiltersTags` | `boolean` | Afficher les tags actifs |
| `disableInfiniteScroll` | `boolean?` | Desactiver le scroll infini |
| `showDetailedViewToggle` | `boolean?` | Afficher le bouton vue detaillee |
| `customHeader` | `object?` | Configuration de l'en-tete personnalise |
| `filters` | `Record<string, TagsFilterSchema>?` | Filtres personnalises (tags, categories) |
| `baseParams` | `object?` | Parametres de base pour la recherche avancee |
| `list` | `ListConfSchema?` | Configuration de l'affichage en liste |
| `map` | `MapConfSchema?` | Configuration de l'affichage sur la carte |

### Details de `ListConfSchema`

```ts
const ListConfSchema = z.object({
  columns: z.object({
    lg: z.number().int().min(1).max(6).optional(),
    md: z.number().int().min(1).max(6).optional(),
    sm: z.number().int().min(1).max(6).optional(),
    xl: z.number().int().min(1).max(6).optional(),
  }).partial().optional(),
  card: z.object({
    tagLimit:        z.number().int().min(1).max(50).optional(),
    showDescription: z.boolean().optional(),
    showAddress:     z.boolean().optional(),
    shareButton:     z.boolean().optional(),
    showStar:        z.boolean().optional(),
    detailsMode: z.enum(["drawer", "dialog"]).default("drawer"),
    type: z.enum(["overlay", "default", "tiers-lieux", "event", "rezo-la-mer","profile","event-rezo-la-mer","poi-rezo-la-mer", "card-elts","ssbe"]).default("default"),
    variant: z.enum(["default", "tiers-lieux", "event", "rezo-la-mer","profile","event-rezo-la-mer","poi-rezo-la-mer", "card-elts","ssbe"]).optional(),
  }).partial().optional(),
  preview: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
}).partial();
```

* **`card.type`** : `overlay` (texte sur l'image), `default`, `tiers-lieux`, `event`, `rezo-la-mer`, `profile`, `event-rezo-la-mer`, `poi-rezo-la-mer`, `card-elts`, `ssbe`.
* **`card.variant`** : variante visuelle de la carte.
* **`card.detailsMode`** : affichage des details dans un `drawer` ou un `dialog`.
* **`card.showStar`** : afficher le bouton favori.
* **`preview.type`** : type de previsualisation (actuellement `default`).

### Details de `MapConfSchema`

```ts
const MapConfSchema = z.object({
  initialZoom: z.number().min(1).max(20).optional(),
  cluster:     z.boolean().optional(),
  popup: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
}).partial();
```

* **`popup.type`** : type de popup sur la carte (actuellement `default`).

---

## `searchProStatic`

Version statique de `searchPro` sans synchronisation URL, concue pour afficher plusieurs recherches sur une meme page.

```ts
import { SearchProStaticSectionSchema } from "@/modules/search/schema";
```

```ts
export const SearchProStaticSectionSchema = z.object({
  type: z.literal("searchProStatic"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    icon: z.string().optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString.optional(),
    showSearch:  z.boolean().default(false),
    useFilter:   z.boolean().default(false),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    enableGraph: z.boolean().default(false),
    graphCategories: z.array(z.string()).optional(),
    graphDetailsMode: z.enum(["drawer", "dialog", "link"]).default("drawer"),
    defaultViewMode: z.enum(["list", "map", "graph"]).optional(),
    showActiveFiltersTypes: z.boolean().default(false),
    showActiveFiltersTags: z.boolean().default(false),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    width: z.enum(["container"]).optional(),
    defaultDetailedView: z.boolean().optional(),
    addButton: AddButtonConfigSchema,
    zoneSelector: ZoneSelectorConfigSchema,
    tagSelector: TagSelectorConfigSchema,
    csvButton: CsvButtonConfigSchema,
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      showMapButton: z.boolean().default(true),
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),
    baseParams: z.object({ /* meme structure que searchPro */ }).optional(),
    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
  }),
});
```

**Differences avec `searchPro`** :
- **Pas de synchronisation URL** : les filtres ne modifient pas l'URL
- **Defaults differents** : `useFilter: false`, `showActiveFiltersTypes: false`, `showActiveFiltersTags: false`
- **Placeholder optionnel** : contrairement a `searchPro` ou il est obligatoire
- **Fonctionnalites supplementaires** : `addButton`, `zoneSelector`, `tagSelector`, `csvButton`, `enableGraph`, `bg`
- **Ideal pour** : integrer plusieurs recherches sur une meme page sans conflits de query params

---

## `hero-tiers-lieux`

Hero specialise pour les sites Tiers-Lieux avec recherche integree.

```ts
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
          variant: z.enum(["default", "secondary", "accent"]).optional(),
        })
      )
      .optional(),
    placeholder: LocalizedString.optional(),
    searchButtonText: LocalizedString.optional(),
  }),
});
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `headline` | `LocalizedString` | Titre principal |
| `subhead` | `LocalizedString?` | Sous-titre |
| `backgroundImage` | `string?` | Image de fond |
| `ctaButtons` | `array?` | Boutons d'action (variant: `"default" \| "secondary" \| "accent"`) |
| `placeholder` | `LocalizedString?` | Placeholder du champ de recherche |
| `searchButtonText` | `LocalizedString?` | Texte du bouton de recherche |

---

## `hero-rezo-la-mer`

Hero specialise pour le site Rezo la Mer.

```ts
export const HeroRezoLaMerSchema = z.object({
  type: z.literal("hero-rezo-la-mer"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    logoIcon: z.string().optional(),
    backgroundImage: z.string().optional(),
    backgroundImageAlt: LocalizedString.optional(),
    badges: z
      .array(
        z.object({
          label: LocalizedString,
          icon: z.string().optional(),
        })
      )
      .optional(),
    ctaButtons: z
      .array(
        z.object({
          label: LocalizedString,
          path: z.string().optional(),
          variant: z.enum(["default", "secondary", "accent"]).optional(),
        })
      )
      .optional(),
    showScrollIndicator: z.boolean().optional(),
    variant: z.enum(["ocean", "cyber"]).optional(),
  }),
});
```

| Propriete             | Type              | Description                        |
| --------------------- | ----------------- | ---------------------------------- |
| `headline`            | `LocalizedString` | Titre principal                    |
| `subhead`             | `LocalizedString?` | Sous-titre                        |
| `logoIcon`            | `string?`         | Icone du logo                      |
| `backgroundImage`     | `string?`         | Image de fond                      |
| `backgroundImageAlt`  | `LocalizedString?` | Alt de l'image                    |
| `badges`              | `array?`          | Badges (label, icon)               |
| `ctaButtons`          | `array?`          | Boutons CTA                        |
| `showScrollIndicator` | `boolean?`        | Indicateur de scroll               |
| `variant`             | `"ocean" \| "cyber"` | Variante visuelle               |

---

## `hero-nos-communes`

Hero specialise pour le site Nos Communes.

```ts
export const HeroNoCommunesShema = z.object({
  type: z.literal("hero-nos-communes"),
  id: z.string().optional(),
  props: z.object({
    badge: LocalizedString.optional(),
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    tagline: LocalizedString.optional(),
    taglineSubtext: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    backgroundImageAlt: LocalizedString.optional(),
    ctaButtons: z
      .array(
        z.object({
          label: LocalizedString,
          path: z.string().optional(),
          variant: z.enum(["default", "secondary", "accent"]).optional(),
        })
      )
      .optional(),
    badges: z
      .array(
        z.object({
          label: LocalizedString,
          icon: z.string().optional(),
        })
      )
      .optional(),
    showScrollIndicator: z.boolean().optional(),
    variant: z.enum(["nos-communes"]).optional(),
  })
});
```

| Propriete             | Type              | Description                          |
| --------------------- | ----------------- | ------------------------------------ |
| `badge`               | `LocalizedString?` | Badge au-dessus du titre            |
| `headline`            | `LocalizedString` | Titre principal                      |
| `subhead`             | `LocalizedString?` | Sous-titre                          |
| `tagline`             | `LocalizedString?` | Slogan                              |
| `taglineSubtext`      | `LocalizedString?` | Sous-texte du slogan                |
| `backgroundImage`     | `string?`         | Image de fond                        |
| `backgroundImageAlt`  | `LocalizedString?` | Alt de l'image                      |
| `ctaButtons`          | `array?`          | Boutons CTA                          |
| `badges`              | `array?`          | Badges (label, icon)                 |
| `showScrollIndicator` | `boolean?`        | Indicateur de scroll                 |
| `variant`             | `"nos-communes"`  | Variante visuelle                    |

---

## `hero-commune-transparente`

Hero specialise pour le site Commune Transparente.

```ts
export const HeroCommuneTransparenteSchema = z.object({
  type: z.literal("hero-commune-transparente"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    logoIcon: z.string().optional(),
    logoImage: z.string().optional(),
    backgroundImage: z.string().optional(),
    backgroundImageAlt: LocalizedString.optional(),
    badges: z
      .array(
        z.object({
          label: LocalizedString,
          icon: z.string().optional(),
          href: z.string().optional(),
        })
      )
      .optional(),
    ctaButtons: z
      .array(
        z.object({
          label: LocalizedString,
          path: z.string().optional(),
          href: z.string().optional(),
          variant: z.enum(["default", "secondary", "outline"]).optional(),
        })
      )
      .optional(),
    showScrollIndicator: z.boolean().optional(),
    variant: z.enum(["commune-transparente"]).optional(),
  }),
});
```

| Propriete             | Type              | Description                          |
| --------------------- | ----------------- | ------------------------------------ |
| `headline`            | `LocalizedString` | Titre principal                      |
| `subhead`             | `LocalizedString?` | Sous-titre                          |
| `logoIcon`            | `string?`         | Icone du logo                        |
| `logoImage`           | `string?`         | Image du logo                        |
| `backgroundImage`     | `string?`         | Image de fond                        |
| `backgroundImageAlt`  | `LocalizedString?` | Alt de l'image                      |
| `badges`              | `array?`          | Badges (label, icon, href)           |
| `ctaButtons`          | `array?`          | Boutons CTA (variant: default/secondary/outline) |
| `showScrollIndicator` | `boolean?`        | Indicateur de scroll                 |
| `variant`             | `"commune-transparente"` | Variante visuelle             |

---

## `features-rezo-la-mer`

Section de fonctionnalites pour Rezo la Mer.

```ts
export const FeaturesRezoLaMerSchema = z.object({
  type: z.literal("features-rezo-la-mer"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["ocean", "cyber"]).optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
    features: z.array(
      z.object({
        icon: z.string(),
        title: LocalizedString,
        description: LocalizedString,
        color: z.enum(["turquoise", "cyan-bright", "primary", "turquoise-light", "accent", "chart-2", "chart-3"]).optional(),
      })
    ),
  }),
});
```

| Propriete   | Type      | Description                             |
| ----------- | --------- | --------------------------------------- |
| `headline`  | `LocalizedString` | Titre                            |
| `subhead`   | `LocalizedString?` | Sous-titre                      |
| `variant`   | `"ocean" \| "cyber"` | Variante visuelle             |
| `bg`        | `enum`    | Couleur de fond                         |
| `features`  | `array`   | Liste des fonctionnalites (icon, title, description, color) |

---

## `action-buttons-rezo-la-mer`

Section de boutons d'action pour Rezo la Mer.

```ts
export const ActionButtonsRezoLaMerSchema = z.object({
  type: z.literal("action-buttons-rezo-la-mer"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["ocean", "cyber"]).optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
    actions: z.array(
      z.object({
        icon: z.string(),
        title: LocalizedString,
        subtitle: LocalizedString.optional(),
        href: z.string(),
        color: z.enum(["primary", "turquoise", "amber", "cyan-bright", "teal", "accent", "eco", "chart-2"]).optional(),
      })
    ),
  }),
});
```

| Propriete  | Type      | Description                              |
| ---------- | --------- | ---------------------------------------- |
| `headline` | `LocalizedString` | Titre                             |
| `subhead`  | `LocalizedString?` | Sous-titre                       |
| `variant`  | `"ocean" \| "cyber"` | Variante visuelle              |
| `bg`       | `enum`    | Couleur de fond                          |
| `actions`  | `array`   | Boutons d'action (icon, title, subtitle, href, color) |

---

## `community-rezo-la-mer`

Section communaute pour Rezo la Mer.

```ts
export const CommunityRezoLaMerSchema = z.object({
  type: z.literal("community-rezo-la-mer"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["ocean", "cyber"]).optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
    image: z.string().optional(),
    imageAlt: LocalizedString.optional(),
    actions: z.array(
      z.object({
        icon: z.string(),
        title: LocalizedString,
        description: LocalizedString,
        ctaLabel: LocalizedString,
        href: z.string(),
      })
    ).optional(),
    stats: z
      .array(
        z.object({
          value: z.string(),
          label: LocalizedString,
          color: z.enum(["primary", "turquoise", "cyan-bright", "accent", "teal"]).optional(),
        })
      )
      .optional(),
  }),
});
```

| Propriete  | Type      | Description                                |
| ---------- | --------- | ------------------------------------------ |
| `headline` | `LocalizedString` | Titre                               |
| `subhead`  | `LocalizedString?` | Sous-titre                          |
| `variant`  | `"ocean" \| "cyber"` | Variante visuelle                 |
| `bg`       | `enum`    | Couleur de fond                            |
| `image`    | `string?` | Image de la section                        |
| `imageAlt` | `LocalizedString?` | Alt de l'image                     |
| `actions`  | `array?`  | Actions (icon, title, description, ctaLabel, href) |
| `stats`    | `array?`  | Statistiques (value, label, color)         |

---

## `cta-rezo-la-mer`

Call to action pour Rezo la Mer.

```ts
export const CallToActionRezoLaMerSchema = z.object({
  type: z.literal("cta-rezo-la-mer"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["ocean", "cyber"]).optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
    newsletterPlaceholder: LocalizedString.optional(),
    newsletterButtonLabel: LocalizedString.optional(),
    newsletterDisclaimer: LocalizedString.optional(),
    buttons: z
      .array(
        z.object({
          label: LocalizedString,
          href: z.string(),
          variant: z.enum(["default", "outline", "accent"]).optional(),
        })
      )
      .optional(),
  }),
});
```

| Propriete               | Type              | Description                       |
| ----------------------- | ----------------- | --------------------------------- |
| `headline`              | `LocalizedString` | Titre                             |
| `subhead`               | `LocalizedString?` | Sous-titre                       |
| `variant`               | `"ocean" \| "cyber"` | Variante visuelle              |
| `bg`                    | `enum`            | Couleur de fond                   |
| `newsletterPlaceholder` | `LocalizedString?` | Placeholder newsletter           |
| `newsletterButtonLabel` | `LocalizedString?` | Label bouton newsletter          |
| `newsletterDisclaimer`  | `LocalizedString?` | Disclaimer newsletter            |
| `buttons`               | `array?`          | Boutons CTA                       |

---

## `title-with-filters-rezo-la-mer`

Section titre avec filtres et boutons d'action pour Rezo la Mer.

```ts
export const ActionButtonSchema = z.object({
  label: LocalizedString,
  icon: z.string().optional(),
  href: z.string().optional(),
  variant: z.enum(["default", "outline", "primary", "turquoise"]).optional(),
  action: z.enum(["join-dropdown", "add-project", "add-event", "add-poi", "add-organization", "add-structure", "add-offer"]).optional(),
  modal: z.string().optional(),
  formConfig: JsonFormModalConfigSchema.optional(),
  requiresAdmin: z.boolean().optional(),
});

export const TitleWithFiltersRezoLaMerSchema = z.object({
  type: z.literal("title-with-filters-rezo-la-mer"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString.optional(),
    subhead: LocalizedString.optional(),
    categories: z.array(
      z.object({
        id: z.string(),
        label: LocalizedString,
      })
    ).optional(),
    types: z.array(
      z.object({
        id: z.string(),
        label: LocalizedString,
      })
    ).optional(),
    buttons: z.array(ActionButtonSchema).optional(),
    showSearch: z.boolean().optional(),
    searchPlaceholder: LocalizedString.optional(),
  }),
});
```

| Propriete          | Type              | Description                            |
| ------------------ | ----------------- | -------------------------------------- |
| `headline`         | `LocalizedString?` | Titre                                 |
| `subhead`          | `LocalizedString?` | Sous-titre                            |
| `categories`       | `array?`          | Categories de filtre (id, label)       |
| `types`            | `array?`          | Types de filtre (id, label)            |
| `buttons`          | `ActionButton[]?` | Boutons d'action                       |
| `showSearch`       | `boolean?`        | Afficher le champ de recherche         |
| `searchPlaceholder` | `LocalizedString?` | Placeholder de la recherche          |

---

## `commune-transparente-actions`

Section d'actions pour Commune Transparente.

```ts
const CommuneTransparenteActionButtonSchema = z.object({
  label: LocalizedString,
  href: z.string().optional(),
  variant: z.enum(["primary", "secondary"]).optional(),
  action: z.enum(["add-project", "add-event", "add-poi", "add-organization", "add-offer"]).optional(),
  modal: z.string().optional(),
  formConfig: JsonFormModalConfigSchema.optional(),
  requiresAuth: z.boolean().optional(),
});

const CommuneTransparenteActionItemSchema = z.object({
  title: LocalizedString,
  description: LocalizedString,
  icon: z.string(),
  iconBg: z.enum(["blue", "slate", "purple", "green", "blue-dark", "orange", "lime"]).optional(),
  buttons: z.array(CommuneTransparenteActionButtonSchema).default([]),
});

export const CommuneTransparenteActionsSectionSchema = z.object({
  type: z.literal("commune-transparente-actions"),
  id: z.string().optional(),
  props: z.object({
    imageSrc: z.string().optional(),
    imageAlt: LocalizedString.optional(),
    brandTitle: LocalizedString.optional(),
    description: LocalizedString.optional(),
    highlightText: LocalizedString.optional(),
    items: z.array(CommuneTransparenteActionItemSchema).default([]),
  }),
});
```

| Propriete       | Type              | Description                          |
| --------------- | ----------------- | ------------------------------------ |
| `imageSrc`      | `string?`         | Image de la section                  |
| `imageAlt`      | `LocalizedString?` | Alt de l'image                      |
| `brandTitle`    | `LocalizedString?` | Titre de la marque                  |
| `description`   | `LocalizedString?` | Description                         |
| `highlightText` | `LocalizedString?` | Texte mis en avant                  |
| `items`         | `array`           | Elements d'action (title, description, icon, iconBg, buttons) |

---

## `meeteem`

Section Meeteem pour l'integration de formulaires.

```ts
const MeeteemSectionSchema = z.object({
  type: z.literal("meeteem"),
  id: z.string().optional(),
  props: z.object({
    coform: z.string().min(1),
    path: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      address: z.string().min(1),
      image: z.string().optional(),
      finder: z.string().optional(),
      tags: z.string().optional(),
    })
  })
});
```

| Propriete        | Type     | Description                         |
| ---------------- | -------- | ----------------------------------- |
| `coform`         | `string` | Identifiant du formulaire (requis)  |
| `path.name`      | `string` | Chemin du nom (requis)              |
| `path.description` | `string?` | Chemin de la description         |
| `path.address`   | `string` | Chemin de l'adresse (requis)        |
| `path.image`     | `string?` | Chemin de l'image                  |
| `path.finder`    | `string?` | Chemin du finder                   |
| `path.tags`      | `string?` | Chemin des tags                    |

---

## `cardCountCT`

Section d'affichage de compteurs par type, utilisee pour Commune Transparente.

```ts
const CardCountCTCardConfigSchema = z.object({
  countKey: z.string(),
  label: LocalizedString.or(z.string()),
  icon: z.string().optional(),
  color: z.string().optional(),
  href: z.string().optional(),
});

export const CardCountCTSectionSchema = z.object({
  type: z.literal("cardCountCT"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
    bg: z.enum([
      "default", "card", "muted", "primary", "secondary", "accent", "transparent",
      "gradient-teal", "gradient-blue", "gradient-indigo", "gradient-cyan",
    ]).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      defaultTypes: z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      notSourceKey: z.boolean().optional(),
      locality: z.record(z.string(), z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().optional(),
        countryCode: z.string().optional(),
        level: z.union([z.string(), z.number()]).optional(),
        active: z.boolean().optional(),
        key: z.string().optional(),
      })).optional(),
    }).optional(),

    cards: z.array(CardCountCTCardConfigSchema).optional(),
  }),
});
```

| Propriete    | Type              | Description                           |
| ------------ | ----------------- | ------------------------------------- |
| `title`      | `LocalizedString?` | Titre de la section                  |
| `subtitle`   | `LocalizedString?` | Sous-titre                           |
| `bg`         | `enum`            | Couleur de fond (inclut des gradients) |
| `baseParams` | `object?`         | Parametres de recherche de base       |
| `cards`      | `array?`          | Cartes de compteur (countKey, label, icon, color, href) |

---

## `thematics`

Section d'affichage des thematiques.

```ts
export const ThematicsSectionSchema = z.object({
  type: z.literal("thematics"),
  id: z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
    emptyMessage: LocalizedString.optional(),
  }),
});
```

| Propriete      | Type              | Description                        |
| -------------- | ----------------- | ---------------------------------- |
| `title`        | `LocalizedString?` | Titre de la section               |
| `subtitle`     | `LocalizedString?` | Sous-titre                        |
| `emptyMessage` | `LocalizedString?` | Message si aucune thematique      |

---

## `title`

Section de titre centree, ideale pour separer les parties d'une page.

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `title` | `LocalizedString` | Titre principal |
| `subtitle` | `LocalizedString?` | Sous-titre optionnel |
| `align` | `"left" \| "center" \| "right"` | Alignement du texte |
| `size` | `"sm" \| "md" \| "lg" \| "xl"` | Taille du titre |
| `className` | `string?` | Classes CSS additionnelles |

---

## `content`

Section de contenu riche avec image, texte, tags et liens.

```ts
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
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `category` | `LocalizedString?` | Categorie affichee au-dessus du titre |
| `title` | `LocalizedString` | Titre de la section |
| `description` | `LocalizedString` | Description principale |
| `tags` | `LocalizedString[]?` | Liste de tags |
| `image` | `string?` | URL de l'image |
| `imagePosition` | `"left" \| "right"` | Position de l'image |
| `links` | `array?` | Liens vers d'autres pages |
| `iconCard` | `object?` | Carte avec icone SVG |
| `stats` | `array?` | Statistiques a afficher |

---

## `filters`

Section de filtres avec groupes depliables.

```ts
const FiltersSectionSchema = z.object({
  type: z.literal("filters"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    filterGroups: z.array(z.object({
      id: z.string(),
      label: LocalizedString,
      type: z.enum(['scopeList', "filters"]).default("filters"),
      field: z.string().optional(),
      options: z.array(z.object({
        id: z.string(),
        label: LocalizedString,
        level: z.string().optional(),
        name: z.string().optional(),
        defaultChecked: z.boolean().optional(),
      })).optional(),
      config: z.object({
        countryCode: z.array(z.string()).optional(),
        level: z.array(z.string()).optional(),
        upperLevelId: z.string().optional(),
        sortBy: z.string().optional(),
      }).optional(),
    })),
    filtersByAnswers: z.record(z.string(), z.object({
      id: z.string().optional(),
      label: LocalizedString,
      type: z.enum(["form", 'answers']).default("answers"),
      path: z.string().optional(),
      forms: z.string().optional(),
      finderPath: z.string().optional(),
      value: z.record(z.string(), z.object({
        id: z.string(),
        finder: z.string(),
      })).optional(),
    })).optional(),
    defaultOpenGroups: z.array(z.string()).optional(),
    className: z.string().optional(),
  }),
});
```

| Propriete          | Type      | Description                              |
| ------------------ | --------- | ---------------------------------------- |
| `title`            | `LocalizedString?` | Titre de la section filtres      |
| `filterGroups`     | `array`   | Groupes de filtres                       |
| `filterGroups[].type` | `enum` | Type de filtre (`"scopeList" \| "filters"`) |
| `filterGroups[].field` | `string?` | Champ cible du filtre                |
| `filterGroups[].config` | `object?` | Configuration du filtre (countryCode, level, etc.) |
| `filtersByAnswers` | `Record?` | Filtres par reponses de formulaires      |
| `defaultOpenGroups` | `string[]?` | IDs des groupes ouverts par defaut     |

---

## `gridLayout`

Layout en grille avec deux colonnes configurable.

```ts
const GridLayoutSectionPropsSchema = z.object({
  leftSection: z.lazy(() => SectionSchemaLazy).optional(),
  rightSection: z.lazy(() => SectionSchemaLazy).optional(),
  leftColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  rightColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  gap: z.number().optional(),
  className: z.string().optional(),
  leftWrapperClass: z.string().optional(),
  rightWrapperClass: z.string().optional(),
  fixedHeight: z.string().optional(),
});

const GridLayoutSectionSchema = z.object({
  type: z.literal("gridLayout"),
  id: z.string().optional(),
  props: GridLayoutSectionPropsSchema,
});
```

| Propriete           | Type      | Description                              |
| ------------------- | --------- | ---------------------------------------- |
| `leftSection`       | `Section?` | Section a afficher a gauche (lazy)       |
| `rightSection`      | `Section?` | Section a afficher a droite (lazy)       |
| `leftColumns`       | `1-4`    | Nombre de colonnes pour la gauche        |
| `rightColumns`      | `1-4`    | Nombre de colonnes pour la droite        |
| `gap`               | `number?` | Espacement entre les colonnes            |
| `className`         | `string?` | Classes CSS additionnelles               |
| `leftWrapperClass`  | `string?` | Classes CSS du wrapper gauche            |
| `rightWrapperClass` | `string?` | Classes CSS du wrapper droit             |
| `fixedHeight`       | `string?` | Hauteur fixe de la grille                |

---

## `news`

Section de flux d'actualites avec commentaires et reactions.

```ts
import { NewsSectionSchema } from "@/modules/news/schema";
```

```ts
export const NewsSectionSchema = z.object({
  type: z.literal("news"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    entitySlug: z.string().optional(),
    maxItems: z.number().positive().optional().default(10),
    showAddButton: z.boolean().optional().default(true),
    showFilters: z.boolean().optional().default(false),
    showComments: z.boolean().optional().default(true),
    showReactions: z.boolean().optional().default(true),
  }),
});
```

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `title` | `LocalizedString?` | Titre de la section |
| `entitySlug` | `string?` | Slug de l'entite pour filtrer les news |
| `maxItems` | `number` | Nombre maximum d'elements a afficher |
| `showAddButton` | `boolean` | Afficher le bouton d'ajout |
| `showFilters` | `boolean` | Afficher les filtres |
| `showComments` | `boolean` | Afficher les commentaires |
| `showReactions` | `boolean` | Afficher les reactions |

---

## Voir aussi

- [Schema principal](04-schema-principal.md)
- [Sections dynamiques](06-sections-dynamiques.md)
- [Module Search](07-module-search.md)
