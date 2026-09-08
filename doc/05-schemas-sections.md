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
    - [Details de `CardConfSchema`](#details-de-cardconfschema-listcard)
    - [Details de `ListItemRuleSchema`](#details-de-listitemruleschema-listitemrules)
    - [Details de `ListItemActionSchema`](#details-de-listitemactionschema-listitemaction)
    - [Details de `PreviewConfSchema`](#details-de-previewconfschema)
    - [Details de `TestimonialConfSchema`](#details-de-testimonialconfschema)
    - [Details de `ResourceConfSchema`](#details-de-resourceconfschema)
    - [Details de `MapConfSchema`](#details-de-mapconfschema)
  - [`searchProStatic`](#searchprostatic)
  - [`hero-search`](#hero-search)
  - [`hero-parallax`](#hero-parallax)
  - [`hero-tinted-overlay`](#hero-tinted-overlay)
  - [`hero-entity-banner`](#hero-entity-banner)
  - [`features-glass`](#features-glass)
  - [`action-tiles`](#action-tiles)
  - [`cta-card-grid`](#cta-card-grid)
  - [`cta-newsletter`](#cta-newsletter)
  - [`searchHeader`](#searchHeader)
  - [`expandable-actions`](#expandable-actions)
  - [`hero-quick-access`](#hero-quick-access)
  - [`categories-grid`](#categories-grid)
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

> **Schémas partagés (module search)** : `FilterGroupSchema`, `FilterGroupsSchema`,
> `FiltersByAnswersSchema`, `FiltersByPathSchema`, `SearchBaseParamsSchema`,
> `SearchVariantSchema` et `IconNameSchema` sont définis dans
> `src/modules/search/schema.ts` et réutilisés par `FiltersSectionSchema`,
> `SearchProSectionSchema`, `SearchProStaticSectionSchema` et
> `HeroSearchSchema` — aucune duplication inline.

Chaque section est un objet :

```ts
SectionSchema = z.object({ type: z.literal(<SECTION_TYPE>), id?: string, props: <PropsSchema> })
```

> **Les `.default()` Zod ne s'appliquent pas à l'exécution.** La config JSON n'est
> jamais parsée par Zod au runtime (`SiteConfigSchema` ne sert qu'aux tests et à
> l'AdminPanel ; le serveur livre `normalizeSiteConfig(raw)` — assainissement
> DOMPurify seulement — et `SectionRenderer` passe les `props` telles quelles).
> Les défauts notés dans ce document sont donc **documentaires** : c'est **chaque
> composant qui fusionne ses propres défauts** (destructuration `= …` pour un
> scalaire, fusion **clé par clé** pour un sous-objet). Conséquence pour un
> sous-objet de booléens comme `filters` de `aac-directory` : un bloc partiel
> `{ "search": false }` veut dire « je change celui-là, le reste par défaut » —
> jamais « tout le reste éteint ». Un défaut de destructuration
> (`filters = {…}`) ne joue que si le bloc est **absent** : ne pas l'utiliser
> pour un sous-objet, passer par une fonction de fusion testée (ex.
> `resolveDirectoryFilters` dans `src/modules/aac/lib/directoryFilters.ts`).

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

**Contrat de lien** (`items[].href`) — meme `classifyHref` que [`cta`](#cta)
(`CardsSection.tsx:114`) : `"#"` rend la carte **non cliquable** (`<div class="block">`) tandis qu'un `href`
absent ou vide ne pose **aucun conteneur** (fragment — la garde `if (href)` de `CardsSection.tsx:112` precede
l'appel a `classifyHref`),
`mailto:`/`tel:`/`sms:` sortent en `<a href>` natif (handler OS), `http(s)://` ou `//` en
`<a target="_blank" rel="noopener noreferrer">` (ou `items[].target` s'il est pose), tout le reste
en `<Link>` React Router — les ancres `#ancre` incluses.

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

**Contrat de lien** (`buttons[].href`) — tranche par `classifyHref` (`src/lib/linkKind.ts`,
`CTASection.tsx:16`), partage avec `cards` et `categories-grid` :

| `href` | Effet |
| ------ | ----- |
| `"#"` ou chaine vide | **INERTE** : le bouton ne fait rien (placeholder de config) |
| `#ancre` | Defilement vers l'element de la page courante (`scrollIntoView`) |
| `mailto:` / `tel:` / `sms:` | Navigation de document remise au handler de l'OS — **jamais** un nouvel onglet |
| `http(s)://` ou `//` | Nouvel onglet (`noopener noreferrer`) |
| tout le reste | Navigation SPA React Router |

> Avant ce contrat, tout ce qui n'etait ni `#` ni `http` partait dans `navigate()` : un `tel:` ou un
> `mailto:` de config tombait sur le catch-all et rendait la **page d'accueil en 200** — aucune
> erreur, donc invisible en recette, et le tap-to-call ne se declenchait jamais sur mobile.

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
      // Role du champ dans le message envoye (cf. `src/lib/contactPayload.ts`). Facultatif :
      // a defaut, le role est deduit du `name` par convention.
      role: z.enum(["senderName", "senderEmail", "phone", "subject", "message", "extra"]).optional(),
    })),
    submitLabel: LocalizedString,
    /** @deprecated IGNORE — cf. la note ci-dessous. */
    action: z.string().optional(),
    /** @deprecated IGNORE — cf. `action`. */
    method: z.enum(["GET", "POST"]).optional(),
    successMessage: LocalizedString.optional(),
    errorMessage: LocalizedString.optional(),
  }),
});
```

> ⚠️ **`action`/`method` ne sont plus lus.** Le composant ne les deconstruit meme plus : le message
> part par la lib (`api.endpointApi.contactSend` → `CONTACT_SEND` → `/co2/mailmanagement/createandsend`),
> et le destinataire est resolu **cote serveur** depuis le costum porteur — d'ou `costumSlug`
> (`getSlug()`) comme seul parametre d'adressage.
>
> **Ordre de resolution : `costum.contactMail` d'ABORD, `costum.admin.email` seulement en REPLI**
> (parite du bloc CMS legacy, `contactForm.php:606` : `costum.contactMail || costum.admin.email`).
> Ce n'est pas cosmetique : `sportSanteBienetre` declare DEUX adresses en `contactMail` alors que son
> `admin.email` n'en porte qu'une — le second destinataire disparaitrait —, et `cyberReunion` n'a QUE
> `contactMail`, donc aucun message ne partirait. Plusieurs adresses (tableau ou chaine a virgules) =
> **un mail par destinataire**. L'overlay porte par l'element l'emporte sur le document `costum` du
> moteur. Si aucune adresse n'est trouvee : le backend Node **refuse explicitement**, la le legacy
> retombe sur `replyTo` et **renvoie le message a son auteur**. Les deux cles restent optionnelles au
> schema pour ne pas invalider une config existante, mais `tests/preflight/contact-form.test.ts:51-56`
> **fait echouer** toute config de SITE qui en declare encore une. ⚠️ Son filtre est
> `/^config\.prod\..+\.json$/` (l.31) : il exige un suffixe de slug et ne scanne donc **pas**
> `config.prod.json`, qui porte pourtant une section `contactForm`. (L'ancien fil postait du JSON sur
> `/api/contact`, une route qui n'a jamais existe.)

**Roles des champs** (`src/lib/contactPayload.ts`)

La section declare des champs LIBRES, alors que l'endpoint attend des cles FIXES (`names`,
`emailSender`, `tplObject`, `message`, `sign`). Le rattachement se fait de deux facons :

1. `field.role` explicite — recommande pour tout nouveau formulaire ;
2. a defaut, la **convention de nommage** : `name`/`nom`/`fullname` → `senderName`,
   `email`/`mail`/`courriel` → `senderEmail`, `phone`/`tel`/`telephone` → `phone`,
   `subject`/`objet` → `subject`, `message` → `message`. Tout le reste retombe sur `extra`.

| Role | Requis ? | Effet |
| ---- | -------- | ----- |
| `senderName`  | **Oui** | `names` + signature |
| `senderEmail` | **Oui** | `emailSender` + `replyTo` (mis en minuscules) |
| `subject`     | **Oui** | `subject` et `tplObject` |
| `message`     | **Oui** | Corps du message |
| `phone`       | Non     | **Pas de champ dedie cote endpoint** : replie en TEXTE dans le corps et dans la signature |
| `extra`       | Non     | Champ non rattache (rgpd, newsletter…) : valide localement, **jamais envoye** |

> ⚠️ Sans les **quatre roles requis**, `buildContactPayload` rend `null` : le formulaire affiche le
> message d'erreur et **n'envoie rien** (`ContactFormSection.tsx:97-104`). Le preflight
> `tests/preflight/contact-form.test.ts:58-64` refuse une telle config — sans lui, la panne est
> silencieuse a la relecture.

## `registerForm`, `loginForm`, `recoverPasswordForm`

Ces trois formulaires ont des props **vides** (`z.object({})`). Le rendu est entierement gere par le composant React correspondant.

> Ces schémas vivent dans `src/modules/auth/schema.ts` (ré-exportés par
> `src/types/site-schema.ts` pour rétro-compat). Les pages `/login`, `/register`
> et `/recover-password` sont fournies par le [module auth](23-module-auth.md) :
> ces sections ne servent qu'à embarquer un formulaire dans une page config
> existante.

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
    defaultViewMode: z.enum(["list", "map", "graph"]).optional(),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      linkIcon: IconNameSchema.optional(),
      // Note: showMapButton a été SUPPRIMÉ (était une config morte jamais lue —
      // le bouton carte est gated sur `enableMap`)
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      indexStepMap:  z.number().optional(),
      defaultTypes: z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      defaultFields: z.array(z.string()).optional(),
      defaultSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
      searchBy: SearchBySchema.optional(),
      notSourceKey: z.union([z.boolean(), z.number()]).optional(),
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

> `baseParams` de `searchPro` est un objet **inline** (pas le schéma partagé `SearchBaseParamsSchema`). Il ne contient pas `contextId`, `contextType`, `costumSlug`, `costumEditMode`, ni `sourceKey` — ces champs appartiennent uniquement au schéma partagé utilisé par `searchProStatic` et le hero.

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
| `defaultViewMode` | `"list" \| "map" \| "graph"?` | Vue par defaut au chargement |
| `disableInfiniteScroll` | `boolean?` | Desactiver le scroll infini |
| `showDetailedViewToggle` | `boolean?` | Afficher le bouton vue detaillee |
| `searchVariant` | `"default" \| "navigator-tl"?` | Variant SDK endpoint backend |
| `customHeader` | `object?` | En-tete personnalise (`title`, `linkText`, `linkHref`, `linkIcon`) |
| `customHeader.linkHref` | `string?` | URL du lien "voir sur la page complete" |
| `customHeader.linkIcon` | `IconName?` | Icone Lucide du lien (type `IconName`, pas `string`) |
| `filters` | `Record<string, TagsFilterSchema>?` | Filtres personnalises (tags, categories) |
| `baseParams` | `object?` | Parametres de base pour la recherche (objet inline, voir code block) |
| `list` | `ListConfSchema?` | Configuration de l'affichage en liste |
| `map` | `MapConfSchema?` | Configuration de l'affichage sur la carte |

### Details de `ListConfSchema`

```ts
export const ListConfSchema = z.object({
  columns: z.object({
    lg: z.number().int().min(1).max(6).optional(),
    md: z.number().int().min(1).max(6).optional(),
    sm: z.number().int().min(1).max(6).optional(),
    xl: z.number().int().min(1).max(6).optional(),
  }).partial().optional(),
  // Schéma NOMMÉ extrait de ListConfSchema pour être réutilisable par ListItemRuleSchema.
  card: CardConfSchema.optional(),
  preview: PreviewConfSchema.optional(),
  testimonial: TestimonialConfSchema.optional(),
  resource: ResourceConfSchema.optional(),
  previewParam: z.string().optional(),
  // Rendu PAR ITEM des listes hétérogènes (cf. doc/07 §Rendu PAR ITEM).
  itemRules: z.array(ListItemRuleSchema).optional(),
  itemAction: ListItemActionSchema.optional(),
}).partial();
```

* **`card.type`** : `overlay` (texte sur l'image), `default`, `image-cover`, `image-panel`, `event`, `event-featured`, `funding`, `resource-booking`, `poi-amenities`, `contact-card`, `profile`, `card-answer`, `news` (carte éditoriale actualité → `CardNews`), `testimonial` (carte témoignage bulle → `CardTestimonial`), `resource` (carte média-thèque → `CardResource`) (noms de DESIGN — cf. doc/07). Dispatch = `card.variant || card.type`.
* **`card.variant`** : variante visuelle de la carte (memes valeurs que `card.type`, sauf `overlay`).
* **`card.detailsMode`** : affichage des details dans un `drawer` ou un `dialog`.
* **`card.showStar`** : afficher le bouton favori.
* **`card.showFunding`** : afficher la barre de progression de financement (cagnotte) sur la carte ; declenche la query `useFundingEnvelope`. Actif par defaut uniquement pour le variant `rezo-la-mer` (retrocompat).
* **`preview.type`** : contenu du détail rendu dans le conteneur `detailsMode` (axe indépendant de `card.type`) — `default`, `poi-amenities`, `coform-answer`, `event`, `facets`, `news` (→ `PreviewNews`), `testimonial` (→ `PreviewTestimonial`), `resource` (→ `PreviewResource`). Voir [Details de `PreviewConfSchema`](#details-de-previewconfschema).
* **`preview.width`** : largeur MAX du conteneur de détail en mode `dialog` (échelle `sm`..`5xl`|`full`, défaut code `5xl`) — sans effet en mode `drawer`.
* **`preview.showDetailLink`** : booléen (défaut : affiché) ; `false` masque le lien « Voir en page » (permalien) — lu par `PreviewNews`.
* **`testimonial`** : contrat générique config-driven du design `testimonial` (card + preview). Voir [Details de `TestimonialConfSchema`](#details-de-testimonialconfschema).
* **`resource`** : contrat générique config-driven du design `resource` (card + preview). Voir [Details de `ResourceConfSchema`](#details-de-resourceconfschema).
* **`previewParam`** : nom du paramètre URL synchronisant l'item ouvert en preview (défaut `preview`) — utile quand plusieurs listings coexistent sur une même page.
* **`itemRules`** : règles de rendu PAR ITEM d'une liste hétérogène (la 1ʳᵉ dont `when` matche impose son presenter). Voir [Details de `ListItemRuleSchema`](#details-de-listitemruleschema-listitemrules).
* **`itemAction`** : action au clic par défaut de la liste, surchargeable par règle. Voir [Details de `ListItemActionSchema`](#details-de-listitemactionschema-listitemaction).

### Details de `CardConfSchema` (`list.card`)

Bloc `card` **extrait** de `ListConfSchema` en schéma nommé — il est partagé avec `ListItemRuleSchema.card`, d'où son émission en `$ref` dans le dump JSON Schema (`config:schema`).

```ts
export const CardConfSchema = z.object({
  tagLimit:        z.number().int().min(1).max(50).optional(),
  tagColors:       TagColorsConfSchema.optional(),
  showDescription: z.boolean().optional(),
  showAddress:     z.boolean().optional(),
  shareButton:     z.boolean().optional(),
  showStar:        z.boolean().optional(),
  showFunding:     z.boolean().optional(),
  detailsMode:     z.enum(["drawer", "dialog"]).default("drawer"),
  detailedMode:    z.enum(["default", "service-pricing"]).default("default"),
  overlayStats:    z.enum(["service-pricing"]).optional(),
  imageFit:        z.enum(["cover", "contain"]).optional(),
  servicePricing:  z.object({ /* meeting / coworking / accommodation */ }).optional(),
  installationFilter: InstallationFilterConfSchema.optional(),
  type:    z.enum([...15 designs...]).default("default"),
  variant: z.enum([...11 designs...]).optional(),
}).partial();
```

### Details de `ListItemRuleSchema` (`list.itemRules`)

Choix du presenter **par item**, pour les listes hétérogènes (recherche globale sans filtre de type). Mécanisme complet : [doc/07 §Rendu PAR ITEM](07-module-search.md#rendu-par-item-des-listes-hétérogènes-listitemrules).

```ts
export const ListItemRuleSchema = z.object({
  id: z.string().optional(),
  when: PredicateJson.optional(),
  card: CardConfSchema.optional(),
  preview: PreviewConfSchema.optional(),
  testimonial: TestimonialConfSchema.optional(),
  resource: ResourceConfSchema.optional(),
  itemAction: ListItemActionSchema.optional(),
});
```

* **`id`** : identifiant lisible (debug, tests, warning DEV). Aucun effet fonctionnel.
* **`when`** : prédicat `PredicateJson` du formEngine (même grammaire que `visibleIf`), évalué contre `{...serverData, collection, sourceKey, sourceKeys}` avec chemins pointés résolus. **La 1ʳᵉ règle qui matche gagne** ; une règle **sans `when`** est un catch-all → à placer **en dernier**.
* **`card`, `preview`** : **fusionnés** (shallow) sur `list.card` / `list.preview` — les clés posées au niveau page restent héritées.
* **`testimonial`, `resource`, `itemAction`** : **remplacent** la valeur de la liste (un contrat de mapping est atomique).
* ⚠ `serverData.type` a deux sémantiques (sous-type POI vs sous-type d'organisation) : ancrer toute règle sur `collection` avant `type`.
* ⚠ Tout champ testé doit figurer dans `baseParams.defaultFields`, sinon la règle ne matche jamais — en silence. Gaté par `tests/preflight/list-item-rules.test.ts`.

### Details de `ListItemActionSchema` (`list.itemAction`)

```ts
export const ListItemActionSchema = z.object({
  kind: z.enum(["preview", "profil", "link"]).default("preview"),
  to: z.string().optional(),
  toById: z.string().optional(),
  newTab: z.boolean().optional(),
});
```

* **`kind`** : `preview` (défaut, ouvre le détail) · `profil` (`/profil/:slug`) · `link` (gabarit `to`).
* **`to`** : gabarit d'URL, `:slug` substitué (ex. `/blog/:slug`). Sans placeholder = lien statique.
* **`toById`** : gabarit de repli quand l'item n'a pas de slug, `:id` substitué (ex. `/blog/id/:id`).
* **`newTab`** : ouvre dans un nouvel onglet.
* Toute action inexploitable (ni slug ni id, `profil` sans slug) retombe sur l'ouverture du détail — jamais d'URL trouée.
* ⚠ À ne pas confondre avec `map.itemAction` (bouton de popup carte) ni avec `commandPalette.entitySearch.itemAction` (clic dans la palette) : trois clés homonymes, trois schémas.

### Details de `PreviewConfSchema` (`list.preview`)

Contenu du **détail** (rendu DANS le conteneur `detailsMode`), axe indépendant de la carte : `Preview.tsx` dispatche sur `preview.type`. Schéma partagé (exporté par `src/modules/search/schema.ts`), réutilisé aussi par le module observatoire (rowAction preview).

```ts
export const PreviewConfSchema = z.object({
  type: z.enum(["default", "poi-amenities", "coform-answer", "event", "facets", "news", "testimonial", "resource"]).default("default"),
  fields: z.record(z.string(), z.string()).optional(),
  facets: z.array(PreviewFacetSchema).optional(),
  showDetailLink: z.boolean().optional(),
  width: z.enum(["sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "full"]).optional(),
}).partial();
```

* **`type`** : `default`, `poi-amenities`, `coform-answer`, `event`, `facets`, `news` (→ `PreviewNews`), `testimonial` (→ `PreviewTestimonial`), `resource` (→ `PreviewResource`).
* **`fields`** : mapping `rôle → suffixe de champ CoForm` (pour `type: "coform-answer"`) — surcharge la table par défaut du composant, découple les IDs de champs.
* **`facets`** : facettes data-driven du preview générique (`type: "facets"`). Chaque facette (`PreviewFacetSchema` : `field`, `label?`, `icon?`) affiche une valeur `serverData` (dot-path supporté) et, si indexée par un dropdownFilter, devient cliquable pour filtrer le listing.
* **`showDetailLink`** : booléen (défaut : affiché, testé `!== false`) ; `false` masque le lien « Voir en page » (permalien vers le détail/profil) dans l'en-tête de la modal de détail — lu par `PreviewNews`.
* **`width`** : largeur MAX du conteneur de détail en mode `dialog` (échelle Tailwind `max-w-*` : `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `full` = `95vw`). **Défaut code : `5xl`** (fallback dans `DetailsModeDialog`, pas via Zod). Sans effet en mode `drawer`.

### Details de `TestimonialConfSchema` (`list.testimonial`)

Contrat « témoignage » **générique et config-driven** : découple la carte/le détail des noms de champs et couleurs d'un site. Un `design` sélectionne une paire cohérente `CardTestimonial{Design}` + `PreviewTestimonial{Design}`, toutes deux nourries par le même contrat via `useTestimonialData`. Consommé par `card.type`/`preview.type` = `testimonial`. Remplace l'ancienne carte « parole » de parent62 (`CardParole`/`PreviewParole`/`lib/parole.ts` supprimés).

```ts
export const TestimonialConfSchema = z.object({
  design: z.enum(["bubble"]).default("bubble"),
  quoteField: z.string(),
  titleField: z.string().optional(),
  dateField: z.string().optional(),
  subtitleField: z.string().optional(),
  audioField: z.string().optional(),
  badge: z.object({ field: z.string(), colors: z.record(z.string(), z.string()).optional() }).optional(),
  accent: z.object({ field: z.string(), colors: z.record(z.string(), z.string()).optional() }).optional(),
  facets: z.array(PreviewFacetSchema).optional(),
}).partial();
```

* **`design`** : `bubble` (repli code) — sélectionne la paire `CardTestimonial{Design}` + `PreviewTestimonial{Design}`.
* **`quoteField`** : champ `serverData` de la citation (le héros). Repli code `description`.
* **`titleField`** : champ du titre / attribution. Repli code `name`.
* **`dateField`** : champ de la date. Repli code `created`.
* **`subtitleField`** : champ secondaire affiché en pied de carte teaser (ex. thème) — optionnel.
* **`audioField`** : champ du média audio (`[{type:"audio", url}]`). Repli code `medias`.
* **`badge`** : `{ field, colors? }` — catégorie pilotant la teinte de la bulle + la pastille ; `colors` = map `valeur → couleur` (`var()` ou hex), matchée via `normalizeFilterValue`, sinon palette déterministe.
* **`accent`** : `{ field, colors? }` — accent (ex. territoire) pilotant le point coloré ; même mécanisme `colors`.
* **`facets`** : repères (taxonomies) data-driven, réutilise `PreviewFacetSchema` (aucun champ en dur).

> Les replis de champs vivent dans `useTestimonialData` : la config JSON n'étant jamais parsée par Zod au runtime, les `.default()` du schéma n'agissent pas — écrire les clés explicitement dans le JSON.

### Details de `ResourceConfSchema` (`list.resource`)

Contrat « ressource » **générique et config-driven** (même esprit que `testimonial`), pour une média-thèque **image-first** : galerie/photo + liens externes + documents, avec catégorie (badge coloré + icône de type), ville et repères. Alimenté par `useResourceData` (item de recherche) et `useResourceEntity` (charge le **POI complet** : galerie `about.images`, fichiers `about.files` classés par extension → documents/audio/vidéo). Consommé par `card.type`/`preview.type` = `resource`.

```ts
export const ResourceConfSchema = z.object({
  design: z.enum(["card"]).default("card"),
  titleField: z.string().optional(),
  descriptionField: z.string().optional(),
  dateField: z.string().optional(),
  imageField: z.string().optional(),
  badge: z.object({
    field: z.string(),
    colors: z.record(z.string(), z.string()).optional(),
    icons: z.record(z.string(), z.string()).optional(),
  }).optional(),
  cityField: z.string().optional(),
  urlsField: z.string().optional(),
  mediasField: z.string().optional(),
  facets: z.array(PreviewFacetSchema).optional(),
}).partial();
```

* **`design`** : `card` (repli code) — sélectionne `CardResource{Design}` + `PreviewResource{Design}`.
* **`titleField`** : repli code `name`.
* **`descriptionField`** : extrait card / markdown preview. Repli code `description`.
* **`dateField`** : repli code `created`.
* **`imageField`** : image de vignette. Repli code `profilMediumImageUrl` (puis `profilImageUrl`, puis 1re image de `medias`).
* **`badge`** : `{ field, colors?, icons? }` — catégorie (repli code `field = "category"`) pilotant la pastille colorée + l'icône de type ; `icons` = map `valeur → nom d'icône lucide`. Map par défaut : `video→video`, `photo→images`, `compte-rendu→file-text`, `jeu→gamepad-2`, `document→file`, `lien→link` (sinon `file`).
* **`cityField`** : ville affichée. Repli code `address.addressLocality`.
* **`urlsField`** : liens externes (`string[]`). Repli code `urls`.
* **`mediasField`** : médias (`[{type,url,name}]`) découpés par type → galerie (images), documents (fichiers), audio, vidéo. Repli code `medias`.
* **`facets`** : repères (taxonomies) data-driven (`PreviewFacetSchema`).

> Comme `testimonial`, les replis vivent dans `useResourceData` (config non parsée par Zod au runtime) — écrire les clés explicitement dans le JSON.

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
      linkIcon: IconNameSchema.optional(),
      // Note: showMapButton a été SUPPRIMÉ (gated sur enableMap)
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),
    baseParams: SearchBaseParamsSchema.optional(),
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
- **`customHeader.linkHref` + `customHeader.linkIcon`** : lien "voir sur la page complete" utilise avec `linkText` pour pointer vers la version `searchPro` complète. `showMapButton` a été supprimé.
- **`defaultFilters.$or`** : peut contenir un filtre `$or` sous forme d'**objet** (pas de tableau MongoDB standard) pour scoper a des costums précis :
  ```json
  "defaultFilters": {
    "$or": {
      "source.keys": { "$in": ["my-key"] },
      "source.key":  { "$in": ["my-key"] },
      "reference.costum": { "$in": ["my-costum"] }
    }
  }
  ```
  > **Attention** : le DSL Communecter attend `$or` comme un objet. Un tableau provoque une erreur 500 backend.

---

## `hero-search`

Hero avec recherche intégrée — autocomplete d’entités (ex-`hero-tiers-lieux`). Ce hero peut piloter un **applicateur de filtres headless** (memes schémas de filtres que la `FiltersSection` de `/lieux`) et une **autocompletion scopee réseau** — sans passer par l'URL. Le mode "sous-site" (`/s/`) ainsi que les props `headlineSubsite`/`subheadSubsite` et `header.navSubsite` ont été entièrement supprimés.

```ts
export const HeroSearchSchema = z.object({
  type: z.literal("hero-search"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    // Boutons de categorie AUTO-PORTEURS : chaque bouton declare son effet.
    ctaButtons: z
      .array(
        z.object({
          label: LocalizedString,
          variant: z.enum(["default", "secondary", "accent", "primary", "outline"]).optional(),
          // Filtres poses par ce bouton (multi-params, multi-valeurs) → `?param=v1,v2`
          filters: z
            .array(
              z.object({
                param: z.string().min(1),
                values: z.array(z.string().min(1)).min(1),
              })
            )
            .optional(),
          // Navigation (ex. « + » → page de recherche complete).
          href: z.string().optional(),
        })
      )
      .optional(),
    // Id de la section vers laquelle scroller au lancement d'une recherche.
    scrollTarget: z.string().optional(),
    placeholder: LocalizedString.optional(),
    searchButtonText: LocalizedString.optional(),
    // Scope de l'autocompletion — aligner sur le searchProStatic de la page
    searchVariant: SearchVariantSchema.optional(),
    baseParams: SearchBaseParamsSchema.optional(),
    // Filtres de l'applicateur headless (catégories du hero)
    // Memes schémas partagés que FiltersSection (/lieux)
    filterGroups: FilterGroupsSchema.optional(),
    filtersByAnswers: FiltersByAnswersSchema.optional(),
  }),
});
```

> `SearchVariantSchema`, `SearchBaseParamsSchema`, `FilterGroupsSchema` et
> `FiltersByAnswersSchema` sont définis dans `src/modules/search/schema.ts` et
> réutilisés sans duplication par ce schema et par `FiltersSectionSchema`.

| Propriete | Type | Description |
| --------- | ---- | ----------- |
| `headline` | `LocalizedString` | Titre principal |
| `subhead` | `LocalizedString?` | Sous-titre |
| `backgroundImage` | `string?` | Image de fond |
| `ctaButtons` | `array?` | Boutons d'action AUTO-PORTEURS (variant: `"default" \| "secondary" \| "accent" \| "primary" \| "outline"`) |
| `ctaButtons[].filters` | `{param, values[]}[]?` | Pose des query params `?param=v1,v2` (format pluriel de `computeFiltersFromUrl`, identique a la sidebar `/lieux`) |
| `ctaButtons[].href` | `string?` | Navigue (ex. « + » → page de recherche complete) |
| `scrollTarget` | `string?` | Id de la section vers laquelle defiler au lancement d'une recherche (ex. le `searchProStatic` de la page). Absent = pas de defilement |
| `placeholder` | `LocalizedString?` | Placeholder du champ de recherche |
| `searchButtonText` | `LocalizedString?` | Texte du bouton de recherche |
| `searchVariant` | `"default" \| "navigator-tl"` | Variant SDK de l'endpoint backend pour l'autocompletion |
| `baseParams` | `SearchBaseParamsSchema?` | Parametres de filtrage du périmetre réseau (scope de l'autocompletion) |
| `filterGroups` | `FilterGroupSchema[]?` | Groupes de filtres headless (typologies, services — meme format que `FiltersSection`) |
| `filtersByAnswers` | `Record<string, ...>?` | Filtres par réponses de formulaires CoForm |

> **Trois effets possibles pour un bouton** (`site-schema.ts:180-205`) : avec `filters` il POSE les
> query params correspondants ; avec `href` il NAVIGUE ; sans ni l'un ni l'autre il **réinitialise**
> les filtres gérés par le hero. Ce mécanisme remplace l'ancien mapping positionnel codé en dur.
>
> ⚠️ **Valeurs contenant une virgule** : l'écriture les ENCODE avant de joindre
> (`computeUrlFromFilters.encodeValues`) et la lecture décode chaque fragment
> (`computeFiltersFromUrl`) — mais `HeroSearch` compare encore les siennes **sans décoder**
> (`HeroSearch.tsx:64-72`, `raw.split(",")`). Tant qu'une page ne porte pas à la fois un
> `hero-search` et une section `filters`, les deux espaces de noms ne se croisent pas.

---

## `hero-parallax`

Hero specialise pour le site Rezo la Mer.

```ts
export const HeroParallaxSchema = z.object({
  type: z.literal("hero-parallax"),
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
    variant: z.enum(["primary", "accent"]).optional(),
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
| `variant`             | `"primary" \| "accent"` | Tonalité des décorations (token qui les teinte) |

---

## `hero-tinted-overlay`

Hero plein écran à voile teinté de marque et double slogan (ex-`hero-nos-communes`).

```ts
export const HeroTintedOverlaySchema = z.object({
  type: z.literal("hero-tinted-overlay"),
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

## `hero-entity-banner`

Hero bannière dont le contenu (bannière/logo/titre) est sourcé depuis l’entité Cocolight (ex-`hero-commune-transparente`).

```ts
export const HeroEntityBannerSchema = z.object({
  type: z.literal("hero-entity-banner"),
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

## `features-glass`

Section de fonctionnalites pour Rezo la Mer.

```ts
export const FeaturesGlassSchema = z.object({
  type: z.literal("features-glass"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["primary", "accent"]).optional(),
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
| `variant`   | `"primary" \| "accent"` | Tonalité des décorations      |
| `bg`        | `enum`    | Couleur de fond                         |
| `features`  | `array`   | Liste des fonctionnalites (icon, title, description, color) |

---

## `action-tiles`

Section de boutons d'action pour Rezo la Mer.

```ts
export const ActionTilesSchema = z.object({
  type: z.literal("action-tiles"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["primary", "accent"]).optional(),
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
| `variant`  | `"primary" \| "accent"` | Tonalité des décorations       |
| `bg`       | `enum`    | Couleur de fond                          |
| `actions`  | `array`   | Boutons d'action (icon, title, subtitle, href, color) |

---

## `cta-card-grid`

Section communaute pour Rezo la Mer.

```ts
export const CtaCardGridSchema = z.object({
  type: z.literal("cta-card-grid"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["primary", "accent"]).optional(),
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
| `variant`  | `"primary" \| "accent"` | Tonalité des décorations          |
| `bg`       | `enum`    | Couleur de fond                            |
| `image`    | `string?` | Image de la section                        |
| `imageAlt` | `LocalizedString?` | Alt de l'image                     |
| `actions`  | `array?`  | Actions (icon, title, description, ctaLabel, href) |
| `stats`    | `array?`  | Statistiques (value, label, color)         |

---

## `cta-newsletter`

Call to action pour Rezo la Mer.

```ts
export const CtaNewsletterSchema = z.object({
  type: z.literal("cta-newsletter"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    variant: z.enum(["primary", "accent"]).optional(),
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
| `variant`               | `"primary" \| "accent"` | Tonalité des décorations       |
| `bg`                    | `enum`            | Couleur de fond                   |
| `newsletterPlaceholder` | `LocalizedString?` | Placeholder newsletter           |
| `newsletterButtonLabel` | `LocalizedString?` | Label bouton newsletter          |
| `newsletterDisclaimer`  | `LocalizedString?` | Disclaimer newsletter            |
| `buttons`               | `array?`          | Boutons CTA                       |

---

## `searchHeader`

Bandeau titre + rangee de filtres + boutons d'action, en tete d'une page de recherche.

> **Source** : le schema s'appelle `SearchHeaderSectionSchema` et vit dans
> `src/modules/search/schema.ts:1133-1172` (re-exporte par `src/types/site-schema.ts:628`) — le nom
> `TitleWithFiltersRezoLaMerSchema` n'existe plus, pas plus que le composant
> `TitleWithFiltersRezoLaMer` (c'est `SearchHeaderSection`). `ActionButtonSchema` est un contrat
> **partage** declare dans `src/types/action-button-schema.ts` (feuille neutre : le schema
> `searchHeader` le declare, `<ActionButtonGroup>` du module profil le rend).

```ts
// src/types/action-button-schema.ts
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

// src/modules/search/schema.ts
const SearchHeaderProps = z.object({
  headline: LocalizedString.optional(),
  subhead: LocalizedString.optional(),
  headlineClassName: z.string().optional(),
  subheadClassName: z.string().optional(),
  filtersClassName: z.string().optional(),
  types: z.array(
    z.object({
      id: z.string(),
      label: LocalizedString,
    })
  ).optional(),
  dropdownFilters: z.array(TitleWithFiltersDropdownSchema).optional(),
  buttons: z.array(ActionButtonSchema).optional(),
  showSearch: z.boolean().optional(),
  searchPlaceholder: LocalizedString.optional(),
  compact: z.boolean().optional(),
  showActiveFiltersTags: z.union([z.boolean(), z.enum(["mobile", "desktop"])]).optional(),
});

export const SearchHeaderSectionSchema = z.object({
  type: z.literal("searchHeader"),
  id: z.string().optional(),
  props: SearchHeaderProps,
});
```

| Propriete          | Type              | Description                            |
| ------------------ | ----------------- | -------------------------------------- |
| `headline`         | `LocalizedString?` | Titre                                 |
| `subhead`          | `LocalizedString?` | Sous-titre                            |
| `headlineClassName` | `string?`        | Override de la classe couleur du `h1` (def. `text-foreground`) — utile sur fond fixe sombre, ou `--foreground` devient illisible en light |
| `subheadClassName` | `string?`         | Override de la classe couleur du sous-titre (def. `text-foreground`) ; `""` pour ne rien forcer |
| `filtersClassName` | `string?`         | Override du conteneur flex de la rangee de filtres (def. `flex flex-col lg:flex-row lg:items-center`) |
| `types`            | `array?`          | Types de filtre (id, label)            |
| `dropdownFilters`  | `array?`          | Filtres en menu deroulant (`id`, `label`, `field?`, `multiple?`, `allLabel?`, `options[]`, `optionsFrom?` — `{list: string \| string[], costumSlug?, withDeclared?}`, cf. `doc/07-module-search.md`) |
| `buttons`          | `ActionButton[]?` | Boutons d'action                       |
| `showSearch`       | `boolean?`        | Afficher le champ de recherche         |
| `searchPlaceholder` | `LocalizedString?` | Placeholder de la recherche          |
| `compact`          | `boolean?`        | Padding vertical REDUIT (`py-4` au lieu de `py-12`) — a activer quand une section `title` au-dessus tient lieu de hero. Defaut `false` |
| `showActiveFiltersTags` | `boolean \| "mobile" \| "desktop"?` | Rangee de chips de filtres actifs : `true`/absent = partout, `"desktop"` = ≥ lg, `"mobile"` = < lg, `false` = masquee |

> La prop `categories` **n'existe plus** dans ce schema.

---

## `expandable-actions`

Cartes d’action en accordéon exclusif ouvrant des modales de contribution (ex-`commune-transparente-actions`).

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

export const ExpandableActionsSchema = z.object({
  type: z.literal("expandable-actions"),
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
| `bg`         | `enum \| string`  | Couleur de fond : tokens sémantiques énumérés OU classe Tailwind brute (ex. `bg-cyan-500`) |
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

> **Rendu du sous-titre** (`TitleSection.tsx:22-27`, `48-58`) : `subtitle` est rendu en `<p>` **subordonné** au titre — `text-muted-foreground`, `font-normal`, `leading-relaxed`, `max-w-3xl` (centré via `mx-auto` si `align === "center"`), et non plus en `<h3>` gras. Sa taille suit `subtitleSizeClasses[size]` (`sm→text-base`, `md→text-lg`, `lg→text-lg md:text-xl`, `xl→text-xl`), toujours plus petite que celle du titre quelle que soit la valeur de `size`.

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
| `links` | `array?` | Liens vers d'autres pages (label, href) |
| `iconCard` | `object?` | Carte avec icone SVG (`{ svg }`) |
| `infoText` | `LocalizedString?` | Ligne d'info avec icone (rendue en HTML brut) |
| `decorativeElements` | `object?` | Element decoratif : `{ type: "corner-icon" \| "colored-squares" \| "none" }` |
| `stats` | `array?` | Statistiques a afficher (`{ value: string, label: LocalizedString }`) |
| `className` | `string?` | Classes CSS additionnelles |

> **Rendu du bloc `stats`** (`ContentSection.tsx:55-65`) : rangee flex à retour à la ligne, chaque entree = `value` en `text-3xl font-bold text-primary` surmontant `label` en `text-sm text-muted-foreground`. Placé entre la description et les tags.
>
> **Colonne unique sans visuel** (`ContentSection.tsx:32`, `42`, `128`) : `hasVisual = image OU (decorativeElements.type !== "none")`. Quand il n'y a pas de visuel, la mise en page passe de la grille `lg:grid-cols-2` à une **colonne unique** `max-w-3xl` et la colonne image n'est pas rendue (au lieu d'une colonne de droite vide).
>
> **iconCard/links découplés** (`ContentSection.tsx:82-114`) : le bloc s'affiche dès que `iconCard` **ou** `links` est présent (auparavant les deux étaient requis). L'icone et la carte de liens sont rendues indépendamment.

---

## `filters`

Section de filtres avec groupes depliables. Pilote `PageFiltersContext` consomme par `SearchPro`/`SearchProStatic` sur la meme page.

> **Source** : `FiltersSectionSchema` est défini dans `src/modules/search/schema.ts` et réutilise les schémas partagés `FilterGroupSchema`/`FilterGroupsSchema`/`FiltersByAnswersSchema`/`FiltersByPathSchema` — sources uniques pour tous les consommateurs (section `filters`, section `hero-search`, schéma du prefetch SSR).

```ts
// Depuis src/modules/search/schema.ts
export const FilterGroupSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  type: z.enum(['scopeList', "filters", "entityList", "searchTargets", "dateRange"]).default("filters"),
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
  // Pour type "entityList" : recherche backend qui peuple les options
  baseParams: SearchBaseParamsSchema.optional(),
  filterType: z.enum(["sourceKey"]).optional(),
  filterBy: z.string().optional(),
});
export const FilterGroupsSchema = z.array(FilterGroupSchema);

export const FiltersByAnswersSchema = z.record(z.string(), z.object({
  id: z.string().optional(),
  label: LocalizedString,
  type: z.enum(["form", "answers"]).default("answers"),
  path: z.string().optional(),
  forms: z.string().optional(),
  finderPath: z.string().optional(),
  value: z.record(z.string(), z.object({
    id: z.string(),
    finder: z.string(),
  })).optional(),
}));

// Filtres par thématique CoForm (appel coformFilterByPath)
export const FiltersByPathSchema = z.record(z.string(), z.object({
  id: z.string().optional(),
  label: LocalizedString,
  thematicPath: z.string(),
  finderPath: z.string().optional(),
  notSourceKey: z.boolean().optional(),
}));

export const FiltersSectionSchema = z.object({
  type: z.literal("filters"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    filterGroups: FilterGroupsSchema,
    filtersByAnswers: FiltersByAnswersSchema.optional(),
    filtersByPath: FiltersByPathSchema.optional(),
    defaultOpenGroups: z.array(z.string()).optional(),
    className: z.string().optional(),
  }),
});
```

| Propriete          | Type      | Description                              |
| ------------------ | --------- | ---------------------------------------- |
| `title`            | `LocalizedString?` | Titre de la section filtres      |
| `filterGroups`     | `FilterGroupSchema[]` | Groupes de filtres              |
| `filterGroups[].type` | `"scopeList" \| "filters" \| "entityList" \| "searchTargets" \| "dateRange"` | Type de filtre. `"entityList"` charge les options dynamiquement via `baseParams` ; `"searchTargets"` est un filtre « type d'information » à sélection UNIQUE dont chaque option porte sa cible `target: {defaultTypes?, defaultFilters?}` (elle REMPLACE les `defaultTypes` de la section et FUSIONNE ses `defaultFilters`) ; `"dateRange"` filtre par date (`filters[field].$gt`). ⚠ Une cible dit *quoi chercher*, pas *comment rendre* — le presenter se choisit par `list.itemRules`. |
| `filterGroups[].field` | `string?` | Champ cible du filtre               |
| `filterGroups[].config` | `object?` | Configuration du filtre (countryCode, level, etc.) |
| `filterGroups[].baseParams` | `SearchBaseParamsSchema?` | Pour `entityList` : périmetre de la recherche backend |
| `filterGroups[].filterType` | `"sourceKey"?` | Comment l'option filtre les résultats (injection dans baseParams.sourceKey) |
| `filtersByAnswers` | `Record?` | Filtres par réponses de formulaires CoForm |
| `filtersByPath`    | `Record?` | Filtres par thématique CoForm via `coformFilterByPath` |
| `defaultOpenGroups` | `string[]?` | IDs des groupes ouverts par defaut    |

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

## `hero-quick-access`

Section hero spécialisée pour les sites sport-santé-bien-être. Variante avec badges, boutons CTA et cartes d'accès rapide.

```ts
const HeroQuickAccessSchema = z.object({
  type: z.literal("hero-quick-access"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    backgroundImageAlt: LocalizedString.optional(),
    overlayOpacity: z.string().optional(),
    badges: z.array(z.object({
      label: LocalizedString,
      icon: z.string().optional(),
    })).optional(),
    ctaButtons: z.array(z.object({
      label: LocalizedString,
      path: z.string().optional(),
      variant: z.enum(["default", "secondary", "accent", "primary", "outline"]).optional(),
    })).optional(),
    quickAccessTitle: LocalizedString.optional(),
    quickAccessCards: z.array(z.object({
      path: z.string(),
      label: LocalizedString,
      title: LocalizedString,
      description: LocalizedString,
      icon: z.string().optional(),
    })).optional(),
  }),
});
```

| Propriete | Type | Description |
|---|---|---|
| `headline` | `LocalizedString` | Titre principal |
| `subhead` | `LocalizedString?` | Sous-titre |
| `backgroundImage` | `string?` | URL image de fond |
| `badges` | `array?` | Badges texte/icône affichés sous le titre |
| `ctaButtons` | `array?` | Boutons CTA avec variante de style |
| `quickAccessTitle` | `LocalizedString?` | Titre de la section d'accès rapide |
| `quickAccessCards` | `array?` | Cartes d'accès rapide (path, label, title, description, icon) |

---

## `categories-grid`

Grille de catégories thématiques avec icônes, titres et liens. Variantes visuelles: `primary`
(teinte primaire + glow au survol), `accent` (teinte accent), `frosted` (verre dépoli lourd,
`backdrop-blur-md`).

```ts
const CategoriesGridSectionSchema = z.object({
  type: z.literal("categories-grid"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString.optional(),
    subhead: LocalizedString.optional(),
    variant: z.enum(["primary", "accent", "frosted"]).optional().default("primary"),
    columns: z.number().min(2).max(6).optional().default(3),
    cards: z.array(z.object({
      icon: z.string().optional(),
      title: LocalizedString.optional(),
      subtitle: LocalizedString.optional(),
      link: z.string().optional(),
    })),
  }),
});
```

| Propriete | Type | Description |
|---|---|---|
| `headline` | `LocalizedString?` | Titre de la grille |
| `subhead` | `LocalizedString?` | Sous-titre |
| `variant` | `"primary"\|"accent"\|"frosted"` | Style visuel de la grille (défaut code `primary`) |
| `columns` | `number` | Nombre de colonnes (2–6, défaut 3) |
| `cards` | `array` | Cartes de catégorie (icon optionnel, title/subtitle/link optionnels) |

Note : `icon` et `title` sont rendus optionnels car certaines configs utilisent uniquement `subtitle` (cf. `config.prod.sport-sante-bien-etre.json`).

**Contrat de lien** (`cards[].link`) : les cartes sont rendues par `NavLink`
(`CategoriesGridSection.tsx:128-141`), donc en **navigation SPA** — auparavant un `<a href>` natif
qui rechargeait TOUTE l'application à chaque clic (re-téléchargement du HTML + réhydratation). Le
même contrat `classifyHref` que [`cta`](#cta) s'applique : `"#"`/vide rend un `<span>` inerte,
`mailto:`/`tel:`/`sms:` une ancre native remise à l'OS, `http(s)://` ou `//` un
`<a target="_blank" rel="noopener noreferrer">`, tout le reste un `<Link>` React Router. Une carte
sans `link` n'est pas enveloppée du tout.

---

## Voir aussi

- [Schema principal](04-schema-principal.md)
- [Sections dynamiques](06-sections-dynamiques.md)
- [Module Search](07-module-search.md)
