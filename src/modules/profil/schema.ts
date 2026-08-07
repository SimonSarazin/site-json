import { z } from "zod";
import { LocalizedString } from "../../types/locale-schema";
import { VisibilityConditionSchema } from "@/lib/visibility/schema";
import { PredicateJson } from "@/modules/formEngine/config";

// Types d'entités supportés
export const ProfileTypeSchema = z.enum([
  "events",
  "organizations",
  "projects",
  "citoyens",
  "poi"
]);

export type ProfileType = z.infer<typeof ProfileTypeSchema>;

// Configuration pour le dropdown d'ajout d'entités (déplacé ici pour être utilisé dans ProfileHeaderSectionSchema)
export const AddConfigSchema = z.object({
  organization: z.boolean().optional().default(true),
  project: z.boolean().optional().default(true),
  event: z.boolean().optional().default(true),
  poi: z.boolean().optional().default(true),
  /**
   * Items personnalisés à afficher dans le dropdown "Ajouter". Chaque entrée pointe vers
   * un modal du `ModalRegistry` (ex: `add-tiers-lieux`). Permet à un site costum
   * d'ajouter ses propres types d'entités sans modifier le code.
   */
  custom: z.array(z.object({
    modalKey: z.string(),
    label: LocalizedString,
    icon: z.string().optional(),
    /**
     * Condition de visibilité optionnelle (auth, routes, permissions…).
     * Si absente → toujours visible.
     */
    condition: VisibilityConditionSchema,
  })).optional(),
}).optional();

// Variantes de sections de profil
export const ProfileHeaderVariantSchema = z.enum(["hero", "simple", "cover", "minimal", "banner-overlay", "complete"]);
export const ProfileInfoVariantSchema = z.enum(["sidebar", "inline", "tabs"]);
export const ProfileLayoutVariantSchema = z.enum(["default", "modern", "compact", "full-width"]);

// Sections de profil
export const ProfileHeaderSectionSchema = z.object({
  type: z.literal("profile-header"),
  variant: ProfileHeaderVariantSchema.optional().default("hero"),
  showBackButton: z.boolean().optional().default(true),
  showShareButton: z.boolean().optional().default(true),
  showEditButton: z.boolean().optional().default(false),
  // Props pour variant "banner-overlay"
  showBanner: z.boolean().optional().default(true),
  showAvatar: z.boolean().optional().default(true),
  bannerHeight: z.string().optional().default("384px"),
  avatarSize: z.string().optional().default("160px"),
  avatarOverlap: z.boolean().optional().default(true),
  showLocation: z.boolean().optional().default(true),
  allowUpload: z.boolean().optional().default(true),
  // Props pour variant "complete"
  showActions: z.boolean().optional().default(true),
  showAddDropdown: z.boolean().optional().default(true),
  addConfig: AddConfigSchema,
  addDropdownLabel: LocalizedString.optional(),
  showEmailButton: z.boolean().optional().default(true),
  showReservationButton: z.boolean().optional().default(false),
  // Le bouton « Voir toutes les photos » s'affiche automatiquement quand le type de
  // profil a un onglet `gallery` (cf. ProfileHeaderComplete → lien vers cet onglet).
  // Ce flag permet de le forcer masqué (`false`) même si l'onglet existe. La galerie
  // elle-même (section `profile-gallery`) reste à implémenter.
  showAllPhotosButton: z.boolean().optional().default(true),
});

export const ProfileInfoSectionSchema = z.object({
  type: z.literal("profile-info"),
  variant: ProfileInfoVariantSchema.optional().default("sidebar"),
  sticky: z.boolean().optional().default(true),
  // Contact info
  showUsername: z.boolean().optional().default(true),
  showEmail: z.boolean().optional().default(true),
  showPhone: z.boolean().optional().default(true),
  showWebsite: z.boolean().optional().default(true),
  // Location & dates
  showAddress: z.boolean().optional().default(true),
  showDates: z.boolean().optional().default(true),
  showOpeningDate: z.boolean().optional().default(true),
  // Related info
  showOrganizer: z.boolean().optional().default(true),
  showAttendees: z.boolean().optional().default(true),
  showCounts: z.boolean().optional().default(true),
  // Actions
  showRegistrationButton: z.boolean().optional().default(true),
});

export const ProfileTiersLieuxInfoSectionSchema = z.object({
  type: z.literal("profile-info-tl"),
  variant: ProfileInfoVariantSchema.optional().default("sidebar"),
  sticky: z.boolean().optional().default(true),
  // Contact info
  showEmail: z.boolean().optional().default(true),
  showPhone: z.boolean().optional().default(true),
  showWebsite: z.boolean().optional().default(true),
  bedRoomPath: z.record(z.string(), z.string()).optional(),
  coworkingPath: z.record(z.string(), z.string()).optional(),
  roomPath: z.record(z.string(), z.string()).optional(),
  // Formulaires : objet clé → { name, finder?, linked, category? }
  forms: z.record(z.string(), z.object({
    name: z.string(),
    finder: z.string().optional(),
    linked: z.boolean(),
    category: z.enum(["salle-reunion", "coworking", "hebergement", "evaluation"]).optional(),
    hide: z.boolean().optional().default(false), // Option pour cacher le formulaire dans le profil
    /** Méthode d'ouverture : "modal" = CoFormModal intégré, "tab" = nouvel onglet (défaut) */
    openMode: z.enum(["modal", "tab"]).optional().default("tab"),
  })).optional(),
});

export const ProfileTiersLieuxAboutSectionSchema = z.object({
  type: z.literal("profile-about-tl"),
  // Description
  showShortDescription: z.boolean().optional().default(true),
  showDescription: z.boolean().optional().default(true),
  markdownEnabled: z.boolean().optional().default(true),
  // Sections
  showEquipements: z.boolean().optional().default(true),
  showActivities: z.boolean().optional().default(true),
  showNews: z.boolean().optional().default(true),
  showRooms: z.boolean().optional().default(true),
  showCoworking: z.boolean().optional().default(true),
  showAccommodation: z.boolean().optional().default(true),
  activity: z.record(z.string(), z.string()).optional(),
  equipement: z.record(z.string(), z.string()).optional(),
  bedRoomPath: z.record(z.string(), z.string()).optional(),
  coworkingPath: z.record(z.string(), z.string()).optional(),
  roomPath: z.record(z.string(), z.string()).optional(),
  // Formulaires (hérité de TiersLieux)
  forms: z.record(z.string(), z.object({
    name: z.string(),
    finder: z.string().optional(),
    linked: z.boolean(),
    category: z.enum(["salle-reunion", "coworking", "hebergement", "evaluation"]).optional(),
    hide: z.boolean().optional().default(false), // Option pour cacher le formulaire dans le profil
    /** Méthode d'ouverture : toujours "modal" dans cette section */
    openMode: z.enum(["modal", "tab"]).optional().default("modal"),
  })).optional(),
});

export const ProfileAboutSectionSchema = z.object({
  type: z.literal("profile-about"),
  showDescription: z.boolean().optional().default(true),
  showShortDescription: z.boolean().optional().default(true),
  showLongDescription: z.boolean().optional().default(true),
  markdownEnabled: z.boolean().optional().default(true),
  layout: z.enum(["column", "grid"]).optional().default("column"),
});

export const ProfileSsbeAboutSectionSchema = z.object({
  type: z.literal("profile-about-ssbe"),
  hidden: z.boolean().optional().default(false),
});

export const ProfileMapSectionSchema = z.object({
  type: z.literal("profile-map"),
  height: z.string().optional().default("400px"),
  zoom: z.number().optional().default(15),
  showMarker: z.boolean().optional().default(true),
});

export const ProfileOrganizerSectionSchema = z.object({
  type: z.literal("profile-organizer"),
  title: LocalizedString.optional(),
  showLogo: z.boolean().optional().default(true),
  showDescription: z.boolean().optional().default(true),
  showLink: z.boolean().optional().default(true),
});

export const ProfileMembersSectionSchema = z.object({
  type: z.literal("profile-members"),
  title: LocalizedString.optional(),
  limit: z.number().optional(),
  showRole: z.boolean().optional().default(true),
  showManagement: z.boolean().optional().default(false),
});

export const ProfileGallerySectionSchema = z.object({
  type: z.literal("profile-gallery"),
  title: LocalizedString.optional(),
  columns: z.number().optional().default(3),
  lightbox: z.boolean().optional().default(true),
});

export const ProfileDocumentsSectionSchema = z.object({
  type: z.literal("profile-documents"),
  title: LocalizedString.optional(),
});

export const ProfileRelatedSectionSchema = z.object({
  type: z.literal("profile-related"),
  title: LocalizedString.optional(),
  relationType: z.enum(["organizations", "projects", "events", "poi"]).optional(),
  limit: z.number().optional().default(4),
  /**
   * `costum` borne la liste au périmètre du site porteur (côté SERVEUR : `source.keys` OU
   * `reference.costum`) ; `network` — le défaut — laisse le réseau entier, comme avant. Sur un site
   * costum, les onglets « Projets »/« Événements » d'une organisation listaient tout Communecter.
   */
  scope: z.enum(["costum", "network"]).optional(),
});

export const ProfileActionsSectionSchema = z.object({
  type: z.literal("profile-actions"),
  showEditButton: z.boolean().optional().default(true),
  showEntityActions: z.boolean().optional().default(true),
  showEmailButton: z.boolean().optional().default(true),
  showReservationButton: z.boolean().optional().default(false),
  // Dropdown "Créer" pour ajouter des entités
  showAddDropdown: z.boolean().optional().default(true),
  addConfig: AddConfigSchema,
  addDropdownLabel: LocalizedString.optional(),
  emailButtonLabel: LocalizedString.optional(),
  reservationButtonLabel: LocalizedString.optional(),
  layout: z.enum(["horizontal", "vertical", "grid"]).optional().default("horizontal"),
});

export const ProfileEventDatesSectionSchema = z.object({
  type: z.literal("profile-event-dates"),
  showType: z.boolean().optional().default(true),
  dateFormat: z.string().optional(),
});

export const ProfileBadgesSectionSchema = z.object({
  type: z.literal("profile-badges"),
  title: LocalizedString.optional(),
  showIcon: z.boolean().optional().default(true),
  layout: z.enum(["grid", "flex", "list"]).optional().default("flex"),
  maxDisplay: z.number().optional(),
});

export const ProfileTagsSectionSchema = z.object({
  type: z.literal("profile-tags"),
  title: LocalizedString.optional(),
  maxDisplay: z.number().optional().default(20),
  linkable: z.boolean().optional().default(false),
  searchOnClick: z.boolean().optional().default(false),
});

/**
 * Un champ affiché par `profile-fields` — MÊME contrat que `preview.facets` du
 * module search (`{ field, label?, icon? }`), étendu d'un `format` de rendu.
 * `field` accepte un dot-path `serverData` (ex. `address.postalCode`).
 */
export const ProfileFieldSchema = z.object({
  field: z.string(),
  label: LocalizedString.optional(),
  /** Icône lucide (via `DynamicIcon`). Défaut : `tag`. */
  icon: z.string().optional(),
  /**
   * Rendu de la valeur :
   * - `text` (défaut) : tokens séparés par des virgules ;
   * - `link` / `email` / `tel` : ancre cliquable ;
   * - `socialLinks` : liste `[{ type, link }]` (champ `otherSociaNetworks` du legacy).
   */
  format: z.enum(["text", "link", "email", "tel", "socialLinks"]).optional(),
});

/**
 * Section **générique** d'affichage de champs d'entité — l'équivalent profil de
 * `preview.type: "facets"` côté recherche. Expose les champs costum (acronyme,
 * SIRET, catégories…) SANS code par site. Les champs vides sont omis.
 */
export const ProfileFieldsSectionSchema = z.object({
  type: z.literal("profile-fields"),
  title: LocalizedString.optional(),
  variant: z.enum(["card", "plain"]).optional().default("card"),
  columns: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  fields: z.array(ProfileFieldSchema),
});

export const ProfileOpeningHoursSectionSchema = z.object({
  type: z.literal("profile-opening-hours"),
  title: LocalizedString.optional(),
  format: z.enum(["table", "list", "compact"]).optional().default("table"),
  showCurrentStatus: z.boolean().optional().default(false),
});

export const ProfileTabLayoutSectionSchema = z.object({
  type: z.literal("profile-tab-layout"),
  leftSections: z.array(z.unknown()),
  rightSections: z.array(z.unknown()),
});

export const ProfileTemplateDynamicSchema = z.object({
  type: z.literal("profile-template-dynamic"),
});

/**
 * Section générique "Nos outils" — affiche/édite `serverData.ourTools`
 * (regroupé par catégorie via `TOOLS_MAP`), sans vocabulaire tiers-lieux.
 * Éditable par les admins de l'entité (`canEditProfile`) via `OurToolsEditDialog`.
 */
export const ProfileToolsSectionSchema = z.object({
  type: z.literal("profile-tools"),
  title: LocalizedString.optional(),
  sticky: z.boolean().optional(),
});

// Profile-specific sections union
export const ProfileOnlySectionSchema = z.discriminatedUnion("type", [
  ProfileHeaderSectionSchema,
  ProfileInfoSectionSchema,
  ProfileTiersLieuxInfoSectionSchema,
  ProfileTiersLieuxAboutSectionSchema,
  ProfileAboutSectionSchema,
  ProfileSsbeAboutSectionSchema,
  ProfileMapSectionSchema,
  ProfileOrganizerSectionSchema,
  ProfileMembersSectionSchema,
  ProfileGallerySectionSchema,
  ProfileDocumentsSectionSchema,
  ProfileRelatedSectionSchema,
  ProfileActionsSectionSchema,
  ProfileEventDatesSectionSchema,
  ProfileBadgesSectionSchema,
  ProfileTagsSectionSchema,
  ProfileFieldsSectionSchema,
  ProfileOpeningHoursSectionSchema,
  ProfileTabLayoutSectionSchema,
  ProfileTemplateDynamicSchema,
  ProfileToolsSectionSchema,
]);

// Union of profile sections + any site section (to avoid circular dependency)
// Site sections will be validated at runtime by the site schema
export const ProfileSectionSchema = z.union([
  ProfileOnlySectionSchema,
  z.object({
    type: z.string(),
    id: z.string().optional(),
    props: z.any().optional(),
  }).loose(), // Allow any site section structure
]);

export type ProfileSection = z.infer<typeof ProfileSectionSchema>;

// Schema pour les conditions d'affichage des tabs
export const ProfileTabConditionSchema = z.object({
  entityTypes: z.array(ProfileTypeSchema).optional(),
  permissions: z.array(z.string()).optional(),
  userContext: z.enum(["own", "other", "any"]).optional(),
  // `required` = visible uniquement si connecté (ex: tabs cagnotte finance/actions
  // qui nécessitent un user pour fetcher les données financières).
  // `anonymous` = visible uniquement si non-connecté (ex: bandeau d'incitation).
  // `any` (ou champ absent) = visible pour tous.
  // ⚠️ Le filtre s'applique côté client après hydration de `me` pour éviter les
  // mismatches SSR (cf. ProfileTemplateDynamic).
  auth: z.enum(["required", "anonymous", "any"]).optional(),
}).optional();

// Schema pour les sous-routes d'un tab
export const ProfileTabSubRouteSchema = z.object({
  path: z.string(), // ex: ":newsId" pour /profil/:slug/news/:newsId
  component: z.string(), // ex: "NewsDetailPage"
  loader: z.string().optional(), // nom de la fonction loader optionnelle
});

// Schema pour un tab de profil
export const ProfileTabSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  path: z.string().optional(), // chemin URL personnalisé (par défaut = id)

  // Option 1 : Utiliser des sections composables
  sections: z.array(ProfileSectionSchema).optional(),

  // Option 2 : Utiliser un composant dédié
  component: z.enum(["SocialTab", "MembershipTab", "NewsTab"]).optional(),

  /**
   * Options passées au composant du mode `component`. Un onglet à `sections` configure chacune de ses
   * sections par ses `props` ; un onglet à `component` n'avait aucun équivalent et rendait donc
   * toujours la même chose. Cf. `MembershipTabProps` (`types`, `scope`) ; les autres composants
   * ignorent la clé.
   */
  props: z.record(z.string(), z.unknown()).optional(),

  // Sous-routes pour les pages de détail (ex: news/:newsId)
  subRoutes: z.array(ProfileTabSubRouteSchema).optional(),

  condition: ProfileTabConditionSchema,
}).refine(
  (data) => (data.sections && data.sections.length > 0) || data.component,
  { message: "Un tab doit avoir soit 'sections' soit 'component'" }
);

export type ProfileTab = z.infer<typeof ProfileTabSchema>;
export type ProfileTabCondition = z.infer<typeof ProfileTabConditionSchema>;
export type ProfileTabSubRoute = z.infer<typeof ProfileTabSubRouteSchema>;

// Configuration d'un type de profil
export const ProfileConfigSchema = z.object({
  layout: ProfileLayoutVariantSchema.optional().default("default"),
  tabs: z.array(ProfileTabSchema).optional(), // NOUVEAU: tabs configurables
  sections: z.array(ProfileSectionSchema), // sections globales (hors tabs)
  hideHeader: z.boolean().optional().default(false), // Option pour cacher le header principal
  hideFooter: z.boolean().optional().default(false), // Option pour cacher le footer principal
  /**
   * Clé du modal d'édition à utiliser (ex: "edit-tiers-lieux"). Si absent → "edit-profile" (générique).
   * Le modal est résolu via `EditModalRegistry`.
   *
   * Si `editModalMatch` est défini, le modal custom n'est utilisé que pour les entités dont
   * `serverData` satisfait la condition. Sinon (absent), le modal s'applique à TOUTES les
   * entités du kind concerné (cf. `profiles.{kind}`).
   */
  editModal: z.string().optional(),
  /**
   * Condition optionnelle pour cibler quelles entités ouvrent `editModal`.
   * Objet plain `{ key: value }` — AND implicite sur toutes les clés.
   * Pour chaque clé : strict equality si la valeur courante est primitive,
   * ou `.includes(value)` si c'est un array.
   *
   * Évaluée sur la vue `entityMatchData` : les chemins pointés (`reference.costum`) et les champs
   * synthétiques (`sourceKey`/`sourceKeys`) y sont résolus. Pour une condition composée (OU, NON),
   * préférer `when` ci-dessous.
   *
   * @example { tags: "TiersLieux" }     // tags est un array → tags.includes("TiersLieux")
   * @example { type: "recoveryCenter" } // strict equality sur la string
   * @example { tags: "TL", type: "Lab" } // les deux conditions doivent matcher
   */
  editModalMatch: z.record(z.string(), z.unknown()).optional(),
  /**
   * Condition RICHE (prédicat `PredicateJson` du formEngine : `and`/`or`/`not`, ops `eq`/`ne`/
   * `contains`/`in`/…), cumulative avec `editModalMatch` si les deux sont présents. Même grammaire
   * que `list.itemRules` et les règles d'icônes de la palette.
   *
   * Sert notamment à borner un formulaire costum à SON périmètre — condition impossible à écrire en
   * `editModalMatch` car elle est disjonctive : provenance (`sourceKeys`) OU rattachement secondaire
   * (`reference.costum`, posé par l'`afterSave` legacy quand la provenance diffère du costum).
   *
   * @example { or: [ { field: "sourceKeys", op: "contains", value: "monCostum" },
   *                  { field: "reference.costum", op: "contains", value: "monCostum" } ] }
   */
  when: PredicateJson.optional(),
  /**
   * Table de routage MULTI sous-types (optionnelle) : plusieurs `editModal` conditionnels pour un même kind
   * (ex. poi → `recoveryCenter` vs `article` selon `serverData.type`). Le PREMIER dont la condition
   * (`editModalMatch` et/ou `when`) est satisfaite gagne ; sinon fallback sur `editModal`/`editModalMatch`
   * ci-dessus, puis `"edit-profile"`. Émise par l'assistant costum pour les costums à plusieurs
   * formulaires par collection.
   *
   * ⚠ Une route SANS condition est un CATCH-ALL : elle s'applique à toutes les entités du type — y
   * compris celles étrangères au costum — et masque les routes suivantes. À placer en dernier, et à
   * n'utiliser que si le formulaire vaut pour toute la collection (cf. `when` pour borner au costum).
   *
   * `strictObject` VOLONTAIRE : sans lui, une faute de frappe (`wen` au lieu de `when`) serait
   * silencieusement supprimée par Zod et la route redeviendrait un catch-all — soit exactement le
   * bug que `when` corrige, sans le moindre signal. Ici la clé inconnue fait échouer la validation.
   */
  editModals: z.array(z.strictObject({
    editModal: z.string(),
    editModalMatch: z.record(z.string(), z.unknown()).optional(),
    when: PredicateJson.optional(),
    /** Commentaire libre (JSON n'en a pas) : justifier une condition de périmètre non évidente. */
    _comment: z.string().optional(),
  })).optional(),
  seo: z.object({
    titleTemplate: z.string().optional(),
    descriptionTemplate: z.string().optional(),
  }).optional(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

// Configuration de tous les profils
export const ProfilesConfigSchema = z.object({
  default: ProfileConfigSchema.optional(), // Configuration par défaut pour tous les types
  events: ProfileConfigSchema.optional(),
  organizations: ProfileConfigSchema.optional(),
  projects: ProfileConfigSchema.optional(),
  citoyens: ProfileConfigSchema.optional(),
  poi: ProfileConfigSchema.optional(),
}).optional();

export type ProfilesConfig = z.infer<typeof ProfilesConfigSchema>;

// Types inférés depuis les schémas Zod
export type ProfileHeaderSection = z.infer<typeof ProfileHeaderSectionSchema>;
export type ProfileInfoSection = z.infer<typeof ProfileInfoSectionSchema>;
export type ProfileAboutSection = z.infer<typeof ProfileAboutSectionSchema>;
export type ProfileSsbeAboutSection = z.infer<typeof ProfileSsbeAboutSectionSchema>;
export type ProfileMapSection = z.infer<typeof ProfileMapSectionSchema>;
export type ProfileOrganizerSection = z.infer<typeof ProfileOrganizerSectionSchema>;
export type ProfileMembersSection = z.infer<typeof ProfileMembersSectionSchema>;
export type ProfileGallerySection = z.infer<typeof ProfileGallerySectionSchema>;
export type ProfileDocumentsSection = z.infer<typeof ProfileDocumentsSectionSchema>;
export type ProfileRelatedSection = z.infer<typeof ProfileRelatedSectionSchema>;
export type ProfileActionsSection = z.infer<typeof ProfileActionsSectionSchema>;
export type AddConfig = z.infer<typeof AddConfigSchema>;
export type ProfileEventDatesSection = z.infer<typeof ProfileEventDatesSectionSchema>;
export type ProfileBadgesSection = z.infer<typeof ProfileBadgesSectionSchema>;
export type ProfileTagsSection = z.infer<typeof ProfileTagsSectionSchema>;
export type ProfileField = z.infer<typeof ProfileFieldSchema>;
export type ProfileFieldsSection = z.infer<typeof ProfileFieldsSectionSchema>;
export type ProfileOpeningHoursSection = z.infer<typeof ProfileOpeningHoursSectionSchema>;
export type ProfileTabLayoutSection = z.infer<typeof ProfileTabLayoutSectionSchema>;
export type ProfileTiersLieuxAboutSection = z.infer<typeof ProfileTiersLieuxAboutSectionSchema>;
export type ProfileTiersLieuxInfoSection = z.infer<typeof ProfileTiersLieuxInfoSectionSchema>;
export type ProfileToolsSection = z.infer<typeof ProfileToolsSectionSchema>;
//──────────────── Section site `member`
// Section JSON-driven (SectionRenderer) affichant les membres/contributeurs/
// participants d'une entité. L'entité est résolue par `useSectionEntity`
// (slug → fetch, sinon contexte). Rendu par le cœur générique `<EntityMembers>`.
const MemberCardConfSchema = z.object({
  type: z.enum(["default", "profile"]).default("default"),
  showDescription: z.boolean().optional().default(true),
  showAddress: z.boolean().optional().default(true),
  // Bloc de compteurs de `CardProfile` (projets liés). Absent = affiché.
  // Miroir de `CardConfSchema.showStats` du module search : la MÊME carte est
  // rendue ici, elle doit donc se piloter pareil depuis les deux sections.
  showStats: z.boolean().optional(),
  detailsMode: z.enum(["drawer", "dialog", "link"]).default("link"),
}).partial();

export type MemberCardConf = z.infer<typeof MemberCardConfSchema>;

export const MemberSectionSchema = z.object({
  type: z.literal("member"),
  id: z.string().optional(),
  props: z.object({
    // Slug de l'entité à afficher. Absent → entité du contexte (page profil / costum).
    slug: z.string().optional(),
    title: LocalizedString.optional(),
    showRole: z.boolean().optional().default(true),
    showManagement: z.boolean().optional().default(false),
    showCard: z.boolean().optional().default(true),
    // Recherche affichée par défaut (l'ancienne section l'affichait toujours).
    search: z.boolean().optional().default(true),
    card: MemberCardConfSchema.optional(),
  }),
});

export type MemberSection = z.infer<typeof MemberSectionSchema>;
export type MemberSectionProps = z.infer<typeof MemberSectionSchema>["props"];
