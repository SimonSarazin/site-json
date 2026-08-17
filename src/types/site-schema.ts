// ------------------------------------------------------------
// site-schema.ts – Schéma ultra‑complet d'un site piloté par JSON
// ------------------------------------------------------------
// Objectif : couvrir un maximum de cas d'usage « no‑code » sans modifier le runtime React.
// Technologies cibles : React 19 + Vite 5 + Tailwind 4 + shadcn/ui.
// Validation : Zod 4.x – le schéma sert à la fois de typings, de runtime‑guard,
//               et d'autocomplétion dans VS Code.
// ------------------------------------------------------------
import { SearchProSectionSchema, SearchProStaticSectionSchema, CardCountCTSectionSchema, ThematicsSectionSchema, FiltersSectionSchema, SearchVariantSchema, SearchBaseParamsSchema, FilterGroupsSchema, FiltersByAnswersSchema, SearchHeaderSectionSchema, MarkerConfSchema, FeaturedCarouselSectionSchema } from "@/modules/search/schema";
import { DataObservatorySectionSchema } from "@/modules/observatoire/schema";
import { NewsSectionSchema } from "@/modules/news/schema";
import { NotificationsSectionSchema } from "@/modules/notification/schema";
import { JsonFormModalConfigSchema } from "./form-modal-schema";
import { ActionButtonSchema } from "./action-button-schema";
import { z } from "zod";
import { LocalizedString, LOCALES } from "./locale-schema";
import { AgendaSectionSchema } from "@/modules/agenda/schema";
import { ArticleFeedSectionSchema, ArticleReaderSectionSchema, ArticleTeaserSectionSchema } from "@/modules/blog/schema";
export { LocalizedString, LOCALES };
import { ProfilesConfigSchema, MemberSectionSchema } from "../modules/profil/schema";
import { AdminConfigSchema } from "../modules/admin/schema";
import { AmpliConfigSchema } from "@/modules/ampli/schema";
import { CommandPaletteConfigSchema } from "@/modules/commandPalette/schema";
import { BlogConfigSchema } from "@/modules/blog/configSchema";
import { VisibilityConditionSchema, type VisibilityCondition } from "@/lib/visibility/schema";

/**
 * Schéma réutilisable pour les champs qui acceptent soit un nom d'icône
 * Lucide (kebab-case, ex: `"waves"`, `"piggy-bank"`), soit un SVG inline
 * (string commençant par `"<svg"`).
 *
 * Consommé côté composant via `<IconOrSvg value={...} />` (`@/components/ui/icon-or-svg`)
 * qui détecte le format au render.
 */
export const LucideIconOrSvg = z.string().refine(
  (val) => {
    const trimmed = val.trim();
    return /^[a-z][a-z0-9-]*$/.test(trimmed) || trimmed.startsWith("<svg");
  },
  {
    message:
      'Doit être un nom d\'icône Lucide en kebab-case (ex: "waves") ou un SVG inline (string commençant par "<svg").',
  }
);

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
  visibility?: VisibilityCondition;
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
    visibility: VisibilityConditionSchema, // condition de visibilité (auth/routes/permissions)
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
// Nombre de colonnes de grille par breakpoint (mobile = 1 implicite). Partagé
// par les sections en grille (stats, action-tiles…) ; rendu via le helper
// `buildGridColsClass` (mapping de classes statiques, cf. responsiveGridCols.ts).
const ResponsiveColumns = z.object({
  sm: Columns.optional(),
  md: Columns.optional(),
  lg: Columns.optional(),
  xl: Columns.optional(),
});

// eslint-disable-next-line prefer-const
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

//──────────────── Hero With Icon
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
})

export type HeroWithIconSection = z.infer<typeof HeroWithIconSectionSchema>;
export type HeroWithIconSectionProps = z.infer<typeof HeroWithIconSectionSchema>["props"];


//──────────────── Hero recherche (autocomplete + boutons-filtres auto-porteurs)
export const HeroSearchSchema = z.object({
  type: z.literal("hero-search"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    // Boutons de catégorie AUTO-PORTEURS : chaque bouton déclare son effet —
    // `filters` pose des query params (?param=v1,v2 — format pluriel de
    // `computeFiltersFromUrl`, identique à la sidebar /lieux), `href` navigue,
    // ni l'un ni l'autre = réinitialise les filtres gérés. Remplace l'ancien
    // mapping positionnel codé en dur (taxonomie tiers-lieux).
    ctaButtons: z
      .array(
        z.object({
          label: LocalizedString,
          variant: z.enum(["default", "secondary", "accent", "primary", "outline"]).optional(),
          // Filtres posés par ce bouton (multi-params, multi-valeurs).
          // NB : les valeurs ne doivent pas contenir de virgule (format URL
          // partagé avec /lieux — `split(",")`).
          filters: z
            .array(
              z.object({
                param: z.string().min(1),
                values: z.array(z.string().min(1)).min(1),
              })
            )
            .optional(),
          // Navigation (ex. « + » → page de recherche complète).
          href: z.string().optional(),
        })
      )
      .optional(),
    // Id de la section vers laquelle scroller au lancement d'une recherche
    // (ex. la liste `searchProStatic` de la page). Pas de scroll si absent.
    scrollTarget: z.string().optional(),
    placeholder: LocalizedString.optional(),
    searchButtonText: LocalizedString.optional(),
    // Scope de l'autocomplétion du hero — aligner sur le `searchProStatic` de la page
    // (mêmes valeurs que `section-lieux`) pour interroger le même périmètre réseau.
    searchVariant: SearchVariantSchema.optional(),
    baseParams: SearchBaseParamsSchema.optional(),
    // Filtres de l'applicateur headless de la home (catégories du hero) — mêmes
    // schémas partagés que la `FiltersSection` de /lieux (typologies + services).
    filterGroups: FilterGroupsSchema.optional(),
    filtersByAnswers: FiltersByAnswersSchema.optional(),
  }),
});

export type HeroSearch = z.infer<typeof HeroSearchSchema>;

export type HeroSearchProps = z.infer<typeof HeroSearchSchema>["props"];

//──────────────── Hero Rézo la Mer
export const HeroParallaxSchema = z.object({
  type: z.literal("hero-parallax"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    logoIcon: LucideIconOrSvg.optional(),
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
          variant: z.enum(["default", "secondary", "accent", "primary", "outline"]).optional(),
        })
      )
      .optional(),
    /**
     * Boutons d'ACTION — ouvrent une modale d'ajout (`modal`/`action`) au lieu
     * de naviguer. Rendus par `<ActionButtonGroup>`, le même composant que
     * `searchHeader` (SearchHeaderSection.tsx:373), donc même comportement :
     * un visiteur non connecté obtient l'invite `chrome.authPrompt` du
     * formulaire, et le formulaire la remplace dès la connexion.
     *
     * `ctaButtons` reste la voie des LIENS (`path`). Les deux cohabitent :
     * `ActionButtonSchema` se dit d'ailleurs prévu pour « header de recherche,
     * hero… » (action-button-schema.ts:6) — il n'était simplement branché que
     * sur le premier.
     */
    buttons: z.array(ActionButtonSchema).optional(),
    showScrollIndicator: z.boolean().optional(),
    // Tonalité des décorations : token qui les teinte (primary par défaut).
    variant: z.enum(["primary", "accent"]).optional(),
  }),
});

export type HeroParallax = z.infer<typeof HeroParallaxSchema>;

export type HeroParallaxProps = z.infer<typeof HeroParallaxSchema>["props"];

export const HeroQuickAccessSchema = z.object({
  type: z.literal("hero-quick-access"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    backgroundImageAlt: LocalizedString.optional(),
    // Art-direction : image dédiée au mobile (≤ 640px) — typiquement un cadrage
    // portrait. Si absente, le mobile utilise `backgroundImage` (srcSet responsive).
    backgroundImageMobile: z.string().optional(),
    // CSS object-position de l'image de fond (maîtrise le recadrage, surtout en
    // mobile portrait où une image paysage est rognée). Ex. "center" (défaut),
    // "top", "50% 30%". Cf. valeurs CSS object-position.
    backgroundPosition: z.string().optional(),
    overlayOpacity: z.string().optional(),
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
          variant: z.enum(["default", "secondary", "accent", "primary", "outline"]).optional(),
        })
      )
      .optional(),
    quickAccessTitle: LocalizedString.optional(),
    quickAccessCards: z
      .array(
        z.object({
          path: z.string(),
          // label/title/description optionnels : <HeroQuickAccess> les rend de façon
          // conditionnelle (`card.title && …`), et des configs (ex. equipements-Sportifs)
          // déclarent des cartes-raccourci avec seulement label + path + icon.
          label: LocalizedString.optional(),
          title: LocalizedString.optional(),
          description: LocalizedString.optional(),
          icon: z.string().optional(),
        })
      )
      .optional(),
  }),
});

export type HeroQuickAccess = z.infer<typeof HeroQuickAccessSchema>;
export type HeroQuickAccessProps = z.infer<typeof HeroQuickAccessSchema>["props"];

// Nos-commune
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
          variant: z.enum(["default", "secondary", "accent", "primary", "outline"]).optional(),
        })
      )
      .optional(),
    // `badges` (pluriel) a été RETIRÉ le 2026-07-29 : déclaré ici mais jamais lu par
    // HeroTintedOverlay, et zéro usage dans le parc. Le composant rend `badge`
    // (singulier), juste au-dessus. Ne pas le réintroduire sans l'implémenter.
    showScrollIndicator: z.boolean().optional(),
  })
});

export type HeroTintedOverlay = z.infer<typeof HeroTintedOverlaySchema>;

export type HeroTintedOverlayProps = z.infer<typeof HeroTintedOverlaySchema>["props"];

//──────────────── Hero à diapositives
/**
 * Une diapositive = un mini-héro. `backgroundImage` reste SCALAIRE ici, comme
 * dans les 7 autres héros (`z.string().optional()`) : c'est la forme que
 * `extractCriticalResources.ts:129` sait lire (`typeof bg === "string"`).
 * Un `backgroundImage: z.array(...)` sur un héro existant aurait cassé cet
 * invariant de famille ET fait échouer le garde du preload EN SILENCE.
 *
 * Pas de `backgroundImageMobile` par diapositive en v1, malgré le précédent de
 * `hero-quick-access` : `generatePreloadTags.ts:24` appelle `buildResponsiveSrcSet`
 * SANS largeurs et code `imagesizes="100vw"` en dur, et `CriticalImage` n'a aucun
 * champ pour transporter des largeurs alternatives. L'art-direction mobile
 * rouvrirait donc le double téléchargement que la chaîne de preload évite — trou
 * PRÉEXISTANT (hero-quick-access l'a déjà), à traiter séparément.
 */
const HeroCarouselSlideSchema = z.object({
  headline: LocalizedString,
  subhead: LocalizedString.optional(),
  backgroundImage: z.string().optional(),
  backgroundImageAlt: LocalizedString.optional(),
  /** Lien de la diapositive (rendu comme un CTA sous le sous-titre). */
  ctaLabel: LocalizedString.optional(),
  ctaPath: z.string().optional(),
});

const HeroCarouselSectionSchema = z.object({
  type: z.literal("hero-carousel"),
  id: z.string().optional(),
  props: z.object({
    slides: z.array(HeroCarouselSlideSchema),

    // ── Chrome de SECTION, pas de diapositive ──
    // Aucune des instances réelles de `hero-tinted-overlay` du parc ne porte de
    // badge ni de CTA PAR écran : les mettre par diapositive fabriquerait du
    // schéma mort. Ne PAS introduire `badges` au pluriel (cf. l'interdit écrit
    // sur `hero-tinted-overlay` plus haut).
    badge: LocalizedString.optional(),
    showScrollIndicator: z.boolean().optional(),

    // ── Spécifiques carrousel ──
    // ⚠ La config n'est JAMAIS parsée par Zod à l'exécution : `.default()` ne
    // tournerait pas. Les valeurs de repli vivent dans HeroCarousel.tsx
    // (autoplay false, intervalle 6000 ms).
    autoplay: z.boolean().optional(),
    autoplayIntervalMs: z.number().optional(),
    /** Nom accessible de la région — indispensable si deux carrousels coexistent. */
    ariaLabel: LocalizedString.optional(),
  }),
});

export type HeroCarouselSlide = z.infer<typeof HeroCarouselSlideSchema>;

export type HeroCarouselProps = z.infer<typeof HeroCarouselSectionSchema>["props"];

//──────────────── Commune Transparente Hero
export const HeroEntityBannerSchema = z.object({
  type: z.literal("hero-entity-banner"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    // `logoIcon` a été RETIRÉ le 2026-07-29 : déclaré ici mais jamais lu par
    // HeroEntityBanner (qui source son logo depuis l'entité Cocolight, via
    // `bannerLogoUrl`), et zéro usage dans le parc.
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
    // Base des médias sourcés depuis l'entité Cocolight (bannerImageUrl /
    // bannerLogoUrl du costum sont des chemins relatifs à la plateforme).
    // Défaut : https://www.communecter.org. Ne s'applique JAMAIS aux assets
    // locaux passés en fallback (backgroundImage / logoImage).
    mediaBaseUrl: z.string().optional(),
  }),
});

export type HeroEntityBanner = z.infer<typeof HeroEntityBannerSchema>;
export type HeroEntityBannerProps = z.infer<typeof HeroEntityBannerSchema>["props"];

//──────────────── Features Rézo la Mer
export const FeaturesGlassSchema = z.object({
  type: z.literal("features-glass"),
  id: z.string().optional(),
  props: z.object({
    // `headline` rendu optionnel : utilisable en sous-section (rightSection
    // d'un gridLayout) où le titre vit côté `leftSection`.
    headline: LocalizedString.optional(),
    subhead: LocalizedString.optional(),
    // Tonalité des décorations (primary par défaut).
    variant: z.enum(["primary", "accent"]).optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
    features: z.array(
      z.object({
        icon: z.string(),
        title: LocalizedString,
        // `description` rendu optionnel : certaines features n'ont qu'un
        // titre/icône sans corps de texte (cf. sport-sante page santé).
        description: LocalizedString.optional(),
        color: z.enum(["turquoise", "cyan-bright", "primary", "turquoise-light", "accent", "chart-2", "chart-3"]).optional(),
        link: z.string().optional(),
      })
    ),
  }),
});

export type FeaturesGlass = z.infer<typeof FeaturesGlassSchema>;
export type FeaturesGlassProps = z.infer<typeof FeaturesGlassSchema>["props"];

//──────────────── Categories Grid (Generic)
export const CategoriesGridSectionSchema = z.object({
  type: z.literal("categories-grid"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString.optional(),
    subhead: LocalizedString.optional(),
    // primary = teinte primaire + glow au survol · accent = teinte accent ·
    // frosted = verre dépoli lourd (backdrop-blur-md).
    variant: z.enum(["primary", "accent", "frosted"]).optional().default("primary"),
    columns: z.number().min(2).max(6).optional().default(3),
    cards: z.array(
      z.object({
        // `icon` et `title` rendus optionnels : certaines configs utilisent
        // uniquement subtitle pour un affichage minimaliste (cf.
        // config.prod.sport-sante-bien-etre.json).
        icon: z.string().optional(),
        title: LocalizedString.optional(),
        subtitle: LocalizedString.optional(),
        link: z.string().optional(),
      })
    ),
  }),
});

export type CategoriesGridSection = z.infer<typeof CategoriesGridSectionSchema>;
export type CategoriesGridSectionProps = z.infer<typeof CategoriesGridSectionSchema>["props"];

//──────────────── Action Buttons Rézo la Mer
export const ActionTilesSchema = z.object({
  type: z.literal("action-tiles"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    // Tonalité des décorations (primary par défaut).
    variant: z.enum(["primary", "accent"]).optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
    // Colonnes par breakpoint (mobile = 1). Sans lui : défaut sm:2 lg:4 (idéal
    // pour 4/8 tuiles). À régler quand le compte ne tombe pas sur 4 (ex. 3 → lg:3).
    columns: ResponsiveColumns.optional(),
    actions: z.array(
      z.object({
        icon: z.string(),
        title: LocalizedString,
        subtitle: LocalizedString.optional(),
        href: z.string(),
        /**
         * Couleur de la tuile — TOKENS du thème. `ActionTiles` les résout via sa
         * table `TILE_TOKEN`. `turquoise`/`cyan-bright`/`teal`/`amber`/`eco` sont
         * des ALIAS HISTORIQUES conservés pour les 5 configs du parc qui les
         * emploient : ils codaient des couleurs Tailwind en dur (les mêmes sur
         * tous les sites) et pointent désormais sur `chart-2..4`, la palette
         * catégorielle propre à chaque site.
         */
        color: z.enum([
          "primary", "accent", "destructive",
          "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
          // alias historiques
          "turquoise", "cyan-bright", "teal", "amber", "eco",
        ]).optional(),
      })
    ),
  }),
});

export type ActionTiles = z.infer<typeof ActionTilesSchema>;
export type ActionTilesProps = z.infer<typeof ActionTilesSchema>["props"];

//──────────────── Community Rézo la Mer
export const CtaCardGridSchema = z.object({
  type: z.literal("cta-card-grid"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    // Tonalité des décorations : token qui les teinte (primary par défaut).
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
          color: z.enum(["primary", "turquoise", "cyan-bright", "accent", "teal", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]).optional(),
        })
      )
      .optional(),
  }),
});

export type CtaCardGrid = z.infer<typeof CtaCardGridSchema>;
export type CtaCardGridProps = z.infer<typeof CtaCardGridSchema>["props"];

//──────────────── Call To Action Rézo la Mer
export const CtaNewsletterSchema = z.object({
  type: z.literal("cta-newsletter"),
  id: z.string().optional(),
  props: z.object({
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    // Tonalité des décorations : token qui les teinte (primary par défaut).
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

export type CtaNewsletter = z.infer<typeof CtaNewsletterSchema>;
export type CtaNewsletterProps = z.infer<typeof CtaNewsletterSchema>["props"];

// ─── Schémas déplacés — réexportés ici pour rétro-compat des imports `@/types/site-schema` ───
// • JsonFormModal*  → `./form-modal-schema` (feuille partagée, sans cycle)
// • ActionButton*   → `./action-button-schema` (feuille neutre : contrat partagé
//   searchHeader ↔ profil, cf. `ActionButtonGroup`)
// • searchHeader → `@/modules/search/schema`
//   (vivent avec leur section). Importés ci-dessus pour l'union discriminée et
//   l'usage local (CommuneTransparente), réexportés ci-dessous.
export { JsonFormModalConfigSchema, ActionButtonSchema, SearchHeaderSectionSchema };
export type { JsonFormModalConfig, JsonFormModalField, JsonFormModalStep } from "./form-modal-schema";
export type { ActionButton } from "./action-button-schema";
export type {
  SearchHeaderSection,
  SearchHeaderSectionProps,
} from "@/modules/search/schema";

// ──────────────── Meeteem Props

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
})

export type MeeteemSection = z.infer<typeof MeeteemSectionSchema>;
export type MeeteemSectionProps = z.infer<typeof MeeteemSectionSchema>["props"];

//──────────────── Actions Commune Transparente
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

export type ExpandableActions = z.infer<typeof ExpandableActionsSchema>;
export type ExpandableActionsProps = z.infer<typeof ExpandableActionsSchema>["props"];

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
    // Nombre de colonnes par breakpoint (mobile = 1). Optionnel : sans lui, le
    // défaut `horizontal` reste md:2 lg:4 (idéal pour 4/8 items). À régler quand
    // le nombre d'items ne « tombe » pas juste sur 4 (ex. 6 items → lg:3 = 3×2).
    columns: ResponsiveColumns.optional(),
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
    // Sous-titre/description optionnel sous le titre (paragraphe muted, centré).
    // Les sauts de ligne (`\n`) du contenu sont préservés (whitespace-pre-line).
    subtitle: LocalizedString.optional(),
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
    // `date` rendu optionnel : certaines timelines servent à raconter des étapes
    // sans date précise (ex. parcours d'idée, jalons fonctionnels).
    events: z.array(z.object({ date: z.string().optional(), title: LocalizedString, text: LocalizedString })),
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

//──────────────── Carte à bulles (illustration + marqueurs-bulles cliquables positionnés en %)
export const MapBubblesSchema = z.object({
  type: z.literal("map-bubbles"),
  id: z.string().optional(),
  props: z.object({
    // Rendu à la fois comme le <h2> sémantique et le badge-pastille incliné — pas de titre séparé.
    headline: LocalizedString,
    subhead: LocalizedString.optional(),
    backgroundImage: z.string().optional(),
    backgroundImageAlt: LocalizedString.optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
    // Dégradé décoratif optionnel derrière l'illustration. Couleurs CSS arbitraires
    // (typiquement des var() de thème du site) : le composant ne code aucune couleur en dur.
    backgroundOverlay: z
      .object({
        from: z.string(),
        to: z.string(),
        angle: z.number().optional(), // degrés, défaut 90 (gauche → droite)
      })
      .optional(),
    items: z.array(
      z.object({
        label: LocalizedString,
        href: z.string(),
        image: z.string(),
        size: z.number().min(0).max(100), // % de la largeur du conteneur
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      })
    ),
  }),
});

export type MapBubbles = z.infer<typeof MapBubblesSchema>;

export type MapBubblesProps = z.infer<typeof MapBubblesSchema>["props"];

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

// Sections auth (loginForm / registerForm / recoverPasswordForm) : schémas
// déplacés dans `@/modules/auth/schema` (importés + ré-exportés plus haut).

const HTMLSectionSchema = z.object({
  type: z.literal("html"),
  id: z.string().optional(),
  // `html` accepte string brute OU LocalizedString (`{ fr, en, ... }`) pour les
  // sites multilingues (cf. config.prod.tiers-lieux.json pages.6.sections.0).
  props: z.object({ html: z.union([z.string(), LocalizedString]) }),
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

export type GridLayoutSection = z.infer<typeof GridLayoutSectionSchema>;
export type GridLayoutSectionProps = z.infer<typeof GridLayoutSectionSchema>["props"];

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
// Section Member — schéma déplacé dans `@/modules/profil/schema`
// (vit avec son cœur `<EntityMembers>`). Importé pour l'union + réexporté ici
// pour rétro-compat des imports `@/types/site-schema`.
//───────────────────────────────────────────────────────────────
export type { MemberSection, MemberSectionProps, MemberCardConf } from "../modules/profil/schema";

//──────────────── Sections du module cagnotte (schemas définis dans le module)
// Cf. src/modules/cagnotte/schema.ts
import {
  ActionsSectionSchema,
  FinanceSectionSchema,
  ActionsSummarySectionSchema,
  FinanceSummarySectionSchema,
  CagnotteLayoutSectionSchema,
} from "@/modules/cagnotte/schema";
import { CoFormSectionSchema } from "@/modules/coform/schema";
import { ToolsCatalogSectionSchema } from "@/modules/toolsCatalog/schema";
import {
  AacConfigSchema,
  AacSectionSchema,
  AacDirectorySectionSchema,
  AacHighlightSectionSchema,
} from "@/modules/aac/schema";
import {
  LoginFormSectionSchema,
  RegisterFormSectionSchema,
  RecoverPasswordFormSectionSchema,
  AuthConfigSchema,
} from "@/modules/auth/schema";

// Re-exports pour la backward-compat (les consommateurs peuvent continuer à
// importer depuis `@/types/site-schema`, mais l'origine est `@/modules/cagnotte/schema`).
export {
  ActionsSectionSchema,
  FinanceSectionSchema,
  ActionsSummarySectionSchema,
  FinanceSummarySectionSchema,
  CagnotteLayoutSectionSchema,
  CoFormSectionSchema,
};
export type {
  ActionsSection,
  ActionsSectionProps,
  FinanceSection,
  FinanceSectionProps,
  ActionsSummarySection,
  ActionsSummarySectionProps,
  FinanceSummarySection,
  FinanceSummarySectionProps,
  CagnotteLayoutSection,
  CagnotteLayoutSectionProps,
} from "@/modules/cagnotte/schema";
export type { CoFormSection } from "@/modules/coform/schema";
export {
  LoginFormSectionSchema,
  RegisterFormSectionSchema,
  RecoverPasswordFormSectionSchema,
};
export type {
  LoginFormSection,
  LoginFormSectionProps,
  RegisterFormSection,
  RegisterFormSectionProps,
  RecoverPasswordFormSection,
  RecoverPasswordFormSectionProps,
} from "@/modules/auth/schema";

//───────────────────────────────────────────────────────────────
// Union de toutes les sections
//───────────────────────────────────────────────────────────────
export const Section = z.discriminatedUnion("type", [
  HeroSectionSchema,
  HeroWithIconSectionSchema,
  HeroSearchSchema,
  HeroParallaxSchema,
  HeroQuickAccessSchema,
  HeroTintedOverlaySchema,
  HeroCarouselSectionSchema,
  HeroEntityBannerSchema,
  FeaturesGlassSchema,
  ActionTilesSchema,
  CtaCardGridSchema,
  CtaNewsletterSchema,
  SearchHeaderSectionSchema,
  ExpandableActionsSchema,
  CategoriesGridSectionSchema,
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
  MapBubblesSchema,
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
  FiltersSectionSchema,
  ContentSectionSchema,
  SearchProSectionSchema,
  SearchProStaticSectionSchema,
  MeeteemSectionSchema,
  CardCountCTSectionSchema,
  ThematicsSectionSchema,
  FeaturedCarouselSectionSchema,
  GridLayoutSectionSchema,
  NewsSectionSchema,
  NotificationsSectionSchema,
  MemberSectionSchema,
  ActionsSectionSchema,
  FinanceSectionSchema,
  ActionsSummarySectionSchema,
  FinanceSummarySectionSchema,
  CagnotteLayoutSectionSchema,
  CoFormSectionSchema,
  ToolsCatalogSectionSchema,
  AacSectionSchema,
  AacDirectorySectionSchema,
  AacHighlightSectionSchema,
  DataObservatorySectionSchema,
  AgendaSectionSchema,
  ArticleFeedSectionSchema,
  ArticleReaderSectionSchema,
  ArticleTeaserSectionSchema,
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
  visibility?: VisibilityCondition;
  children?: EnhancedNavItemType[];
  megaMenu?: {
    columns: z.infer<typeof MegaMenuColumn>[];
    width?: "sm" | "md" | "lg" | "xl" | "full";  // Make width optional to match the schema
  };
  description?: LocalizedString;
  /** Affiche le sous-menu en mise en avant (colonne "lien principal" via `path` + grille). */
  featured?: boolean;
}

const EnhancedNavItem: z.ZodType<EnhancedNavItemType> = z.lazy(() =>
  z.object({
    label: LocalizedString,
    path: z.string().min(1).optional(),
    href: z.string().url().optional(),
    icon: z.string().optional(),
    badge: NavBadge,
    roles: z.array(z.string()).optional(),
    visibility: VisibilityConditionSchema, // condition de visibilité (auth/routes/permissions)
    children: z.array(EnhancedNavItem).optional(),
    megaMenu: MegaMenu.optional(),
    description: LocalizedString.optional(),
    featured: z.boolean().optional(),
  }).refine(d => d.path || d.href || d.children || d.megaMenu, {
    message: "NavItem : path, href, children ou megaMenu obligatoire"
  })
);

export const Header = z.object({
  // Variante de DESIGN (jamais un nom de site) — résolue par `SiteHeader`.
  // standard = horizontal sticky · mega-menu = méga-menu hover · transparent-scroll =
  // fixed transparent→opaque · minimal = compact · underline-nav = nav soulignée ·
  // transparent-dark = transparent sombre · stacked = 2 lignes (logo+titre/sous-titre
  // puis nav) sur fond image, qui collapse en barre compacte au scroll.
  type: z.enum(["standard", "mega-menu", "transparent-scroll", "minimal", "underline-nav", "transparent-dark", "stacked", "default"]).default("default"),
  logo: z.string().optional(),
  // Image de fond plein-cadre du header `type: "stacked"` (les deux sections
  // reposent dessus). Ignorée par les autres variantes.
  backgroundImage: z.string().optional(),
  // Couleur (hex) du wordmark (fixe, 2 segments, quel que soit le mode) ET du
  // sous-titre/nav en mode CLAIR uniquement, du header `type: "stacked"` — repli
  // noir. En mode sombre, sous-titre/nav sont blancs (fixe, non piloté par ce
  // champ). Ignorée par les autres variantes de header.
  textColor: z.string().optional(),
  logoAlt: LocalizedString.optional(),
  logoTitle: LocalizedString.optional(),
  // Segment optionnel accolé à la suite de `logoTitle`, dans un ton distinct
  // (ex. "parent" en fond plein contour clair + "62" en ton plein uni) —
  // wordmark bicolore en 2 segments. Ignoré si absent : `logoTitle` seul
  // garde son rendu habituel.
  logoTitleAccent: LocalizedString.optional(),
  // Sous-titre optionnel affiché sous le titre du logo (plus petit, muted).
  // Permet un logo "marque sur 2 lignes" (titre + localité/baseline).
  logoSubtitle: LocalizedString.optional(),
  logoIcon: LucideIconOrSvg.optional(),
  // Variantes contextuelles de l'IMAGE de logo (toutes optionnelles, repli sur
  // `logo`). Résolues par `<HeaderLogo>` / `resolveHeaderLogo` :
  // - `logoDark` : image affichée en mode sombre (swap CSS `dark:`, sans flash SSR).
  // - `logoOverlay` : image quand le header transparent est posé sur un héro
  //   (état non opaque) — typiquement une version claire/monochrome.
  logoDark: z.string().optional(),
  logoOverlay: z.string().optional(),
  // Ton du `logoIcon` (SVG/Lucide rendu en `currentColor`). Défaut côté header
  // (ex. transparent-scroll = "primary"). "foreground" suit l'ink du thème →
  // marine en clair, clair en sombre, idéal pour une marque monochrome.
  logoIconTone: z.enum(["foreground", "primary", "white"]).optional(),
  // Taille du logo dans la barre : "sm" = défaut historique de chaque header,
  // "md" ≈ 40px, "lg" ≈ 48px sur desktop — toujours ramené plus compact sur
  // mobile (classes responsive, cf. header/logoSize.ts). Honoré par les 6
  // headers ; sur `standard`, "lg" suppose `height: "md"|"lg"` (barre sm = 48px).
  logoSize: z.enum(["sm", "md", "lg"]).optional(),
  // Opt-in : remplace logo/titre par ceux de l'entité costum au runtime
  // (plateforme communecter `transparentCommune`). Désactivé par défaut → le
  // header ne dépend d'aucune logique de site sans cette option.
  entityLogoOverride: z.boolean().optional(),
  path: z.string().min(1).optional(),
  nav: z.array(EnhancedNavItem),
  navVisibleOnlyForListedPages: z.boolean().optional(),
  secondaryNav: z.array(EnhancedNavItem).optional(),
  secondaryNavVisibleOnlyForListedPages: z.boolean().optional(),
  // Rendu de la sous-nav (children des groupes) dans le menu MOBILE :
  // "sections" = groupes déployés, enfants toujours visibles (défaut) ;
  // "accordion" = groupes pliables (chevron). Un parent avec `path` réel reste
  // un lien ; un parent sans path (ou "#") est un en-tête/toggle de groupe.
  mobileNavDisplay: z.enum(["sections", "accordion"]).optional(),
  sticky: z.boolean().default(true),
  transparent: z.boolean().default(false),
  // Quand `transparent: true` (overlay possible), `transparentMode` décide où l'overlay
  // s'applique : "always" (défaut, comportement historique = overlay sur TOUTES les pages)
  // ou "auto" (overlay UNIQUEMENT sur une page qui débute par un héro ; opaque + spacer
  // ailleurs — profil, légales, recherche…). Évite que le texte du header transparent
  // (adaptatif au thème) devienne illisible sur une cover/contenu imprévisible.
  transparentMode: z.enum(["always", "auto"]).optional(),
  // Surcharges par préfixe de chemin (gagnent sur `transparentMode`) :
  // `opaqueOnPaths` force la barre opaque sur ces chemins ; `overlayOnPaths` force l'overlay.
  // Précédence : opaqueOnPaths > overlayOnPaths > transparentMode.
  opaqueOnPaths: z.array(z.string()).optional(),
  overlayOnPaths: z.array(z.string()).optional(),
  height: z.enum(["sm", "md", "lg"]).default("md"),
  utilities: z.object({
    themeSwitch: z.boolean().default(true),
    langSwitch: z.boolean().default(true),
    search: z.boolean().default(false),
    auth: z.boolean().default(false),
    cart: z.boolean().default(false),
    notifications: z.boolean().default(false),
    piggyBank: z.boolean().default(false),
    pledge: z.boolean().default(false)
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

const FooterContactItem = z.object({
  icon: z.string().optional(),
  label: LocalizedString.optional(),
  lines: z.array(LocalizedString).optional(),
  value: LocalizedString.optional(),
  href: z.string().optional(),
});

const FooterContactSection = z.object({
  title: LocalizedString.optional(),
  items: z.array(FooterContactItem),
});

const FooterPartnerLogo = z.object({
  image: z.string(),
  alt: LocalizedString,
  href: z.string().optional(),
});

const FooterPartnersSection = z.object({
  title: LocalizedString.optional(),
  logos: z.array(FooterPartnerLogo),
  // Mention de financement, sous les logos. Un cofinancement public s'accompagne
  // d'une formulation IMPOSÉE par le financeur (dispositif, opérateur, cadre) que
  // les seuls logos ne portent pas : sans ce champ, elle finissait recopiée dans
  // le `copyright`, où elle n'a rien à faire.
  note: LocalizedString.optional(),
});

export const Footer = z.object({
  // Variante de DESIGN (jamais un nom de site) — résolue par `SiteFooter`.
  // rich = newsletter+colonnes+socials · minimal-centered = logo+nav+légal ·
  // sidebar-columns = sidebar+colonnes · contact-partners = contacts+partenaires.
  type: z.enum(["rich", "minimal-centered", "sidebar-columns", "contact-partners", "default"]).default("default"),
  // Sous-style visuel pour `sidebar-columns` (fond plein vs aspect carte).
  style: z.enum(["plain", "card"]).optional(),
  // Optionnel : certains designs de footer (ex. minimal : logo + copyright +
  // socials sans colonnes de liens) n'utilisent pas `columns` → reste optionnel.
  columns: z.array(FooterColumn).optional(),
  socials: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
  extra: z.string().optional(),
  newsletter: NewsletterSectionSchema.optional(),
  copyright: LocalizedString,
  logo: z.string().optional(),
  logoIcon: LucideIconOrSvg.optional(),
  logoTitle: LocalizedString.optional(),
  logoAlt: LocalizedString.optional(),
  description: LocalizedString.optional(),
  // Image de fond plein-cadre (ex. `minimal-centered`). Optionnel, tous types de footer.
  // Purement décorative (CSS background) : pas d'alternative textuelle — un
  // `aria-label` sur le <footer> renommerait le landmark contentinfo.
  backgroundImage: z.string().optional(),
  legalLinks: z.array(z.object({
    href: z.string(),
    label: LocalizedString,
  })).optional(),
  bottomLinks: z.array(z.object({
    href: z.string(),
    label: LocalizedString,
  })).optional(),
  paymentMethods: z.array(z.string()).optional(), // Array of payment method icons
  website: z.string().optional(),
  contactSection: FooterContactSection.optional(),
  partners: FooterPartnersSection.optional(),
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

/**
 * Carte du module search (MapLibre GL) — réglages PAR SITE. Le fond utilise les
 * styles vectoriels MapTiler par thème ; la CLÉ d'API vit en ENVIRONNEMENT
 * (`VITE_MAPTILER_API_KEY`), jamais dans le config versionné — sans clé, repli
 * sur un style raster libre (OSM / Carto) quel que soit ce bloc.
 * NB : la carte du module profil reste sur Leaflet (mêmes ids de style raster).
 */
const MapIntegration = z.object({
  /** Id de style MapTiler en thème clair (ex. "streets-v4", "outdoor-v4", "dataviz"). */
  styleLight: z.string().default("streets-v4"),
  /** Id de style MapTiler en thème sombre (ex. "streets-v4-dark", "dataviz-dark"). */
  styleDark: z.string().default("streets-v4-dark"),
  /** Marqueur PAR DÉFAUT du site (surchargé par `map.marker` de chaque section). */
  marker: MarkerConfSchema.optional(),
});

export const Integrations = z.object({
  analytics: AnalyticsIntegration.optional(),
  chat: ChatIntegration.optional(),
  scripts: z.array(ScriptTag).optional(),
  seo: SEOIntegration.optional(),
  ecommerce: EcommerceIntegration.optional(),
  email: EmailIntegration.optional(),
  crm: CRMIntegration.optional(),
  map: MapIntegration.optional(),
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

const CagnotteModuleConfig = z.object({
    defaultType: z.enum(["standard", "aac"]).optional().default("standard"),
    predefinedAmounts: z.array(z.number()).optional(),
    context: z.string().optional(),
});

export type CagnotteModuleConfig = z.infer<typeof CagnotteModuleConfig>;



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
    ogImage: z.string().optional(), // image Open Graph par défaut du site (les pages surchargent via seo.ogImage)
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
  auth: AuthConfigSchema.optional(),
  // Contexte costum du déploiement. Le SLUG du costum vient de l'entité porteuse
  // (useCocolight().entity = VITE_SLUG, constant) ; costumId/costumType viennent du registry de la lib
  // via `me.costum(slug)`. Ce bloc ne sert donc plus qu'aux TAGS observatoire (mainTag/compagnon).
  costum: z.object({
    mainTag: z.string().optional(),
    compagnon: z.string().optional(),
  }).optional(),
  // Modales costum déclarées EN DONNÉES (document fusionné `CostumFormSchema` par id). Compilées au boot
  // (`registerCostumForm`) en descriptor+spec → résolues par `add-/edit-<id>` via la table runtime, SANS code.
  // zod permissif (record) : la structure est validée par le compilateur/registre (durcissement zod = à part).
  costumForms: z.record(z.string(), z.unknown()).optional(),
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
  floatingActionButton: z.object({
    enabled: z.boolean().default(false),
    // Modale à ouvrir. Entités standard + `add-<id>` d'un costum (résolu par la table runtime costumFormRegistry,
    // qu'il soit déclaré en TS ou dans `config.costumForms`). Ouvert en string (ex-enum fermé) pour les costums de config.
    modal: z.string(),
    label: LocalizedString,
    icon: z.string().optional().default("plus"),
    position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).default("bottom-right"),
    condition: VisibilityConditionSchema,
  }).optional(),
  ampli: z.array(AmpliConfigSchema).optional(),
  // Config site-level de l'Appel à Communs — SINGULIER (un seul AAC par site,
  // contrairement à `ampli` qui est un tableau). Le site déclare son `formId` ;
  // la section `aac` et la route `/aac` le lisent depuis ici. cf. modules/aac.
  aac: AacConfigSchema.optional(),
  commandPalette: CommandPaletteConfigSchema.optional(),
  // Config site-level du blog : défauts des variants extensibles (card/reader/feedLayout). cf. modules/blog.
  blog: BlogConfigSchema.optional(),
  // Page d'Administration (config-driven, jumeau du module profil). Onglets/sections/accès déclarés en
  // données. Absent → pas de page admin. cf. modules/admin + commentaire/plan-module-admin-generique.md
  admin: AdminConfigSchema.optional(),
  cagnotteModuleConfig: CagnotteModuleConfig.optional(),
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
      type: "default",
      logo: "/logo.svg",
      nav: [],
      utilities: {
        themeSwitch: true,
        langSwitch: true,
        search: false,
        auth: false,
        cart: false,
        notifications: false,
        piggyBank: false,
        pledge: false
      },
      sticky: false,
      transparent: false,
      height: "sm"
    },
    pages: [],
    footer: {
      type: "default",
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
    type: "default",
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
      notifications: false,
      piggyBank: false,
      pledge: false
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
            showHeader: false,
            showResultCount: false,
            showViewToggle: false, 
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
    type: "default",
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