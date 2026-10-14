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
  /**
   * Propose « Supprimer » dans le menu d'actions, aux ADMINISTRATEURS de la fiche seulement.
   * Défaut `false` : la suppression est DÉFINITIVE et sort l'élément de tout Communecter (ce n'est
   * pas le « retrait » du référencement, qui se contente de le détacher du costum). Le SDK
   * (`isAuthorOrAdmin`) puis le backend (`canDeleteElement`) restent juges en dernier ressort.
   */
  showDeleteButton: z.boolean().optional().default(false),
  /** Destination après suppression — la page de la fiche n'existe plus. Défaut `/`. */
  deleteRedirectPath: z.string().optional().default("/"),
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
  /**
   * Ressources réservables comptées dans l'encart (`compteRessources`) : `{ id, place, type, … }`.
   * `id` = formulaire CoForm lu, `place` = chemin du champ, et `type` décide de CE QU'ON COMPTE :
   * `single` (défaut) additionne la CAPACITÉ saisie (places, postes), `array` compte les lignes d'un
   * tableau (moins son en-tête), `answer` compte les OFFRES déposées. Se tromper de mode affiche un
   * chiffre plausible et faux — « 1 » pour un lieu qui déclare 10 places dans une seule offre.
   */
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
  /**
   * Ressources réservables comptées dans l'encart (`compteRessources`) : `{ id, place, type, … }`.
   * `id` = formulaire CoForm lu, `place` = chemin du champ, et `type` décide de CE QU'ON COMPTE :
   * `single` (défaut) additionne la CAPACITÉ saisie (places, postes), `array` compte les lignes d'un
   * tableau (moins son en-tête), `answer` compte les OFFRES déposées. Se tromper de mode affiche un
   * chiffre plausible et faux — « 1 » pour un lieu qui déclare 10 places dans une seule offre.
   */
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

/** Fiche « À propos » générique pour une organisation parent62 (`costumForms.parent62-partenaire`) :
 *  type de structure, catégorie thématique (`costum.lists.categoryThematic`), thèmes, territoires,
 *  publics — aucun de ces champs n'est couvert par `profile-info` (contact) ni `profile-tags`. */
export const ProfileParent62AboutSectionSchema = z.object({
  type: z.literal("profile-parent62-about"),
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
  /** Tags NON affichés (égalité stricte) : un marqueur d'annuaire (`lieux-sante`) filtre, il ne se lit pas. */
  hideTags: z.array(z.string()).optional(),
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

/**
 * « Mes lieux » — portage de `costum.views.custom.franceTierslieux.listOrga` (legacy) : les
 * organisations dont le compte connecté est MEMBRE (`links.members.<id>` existe, `isInviting`
 * absent — exactement le filtre par défaut de `getOrganizations()`, cf. `useUserOrganizations`),
 * PAS les fiches suivies (`links.follows`/`getSubscriptions`). Onglets secondaires (actus, agenda,
 * projets liés à ces lieux) : cf. `MyPlacesSection.tsx`.
 *
 * Section GÉNÉRIQUE (pas un `Profile*Section` : elle ne lit pas `useProfileEntity()`, mais `me`
 * directement) — page dédiée, pas un onglet de profil, pour rester adressable (`/mes-lieux`) sans
 * dépendre du slug — inconnu en config — du compte connecté. Enregistrée dans le `SectionRenderer`
 * générique, PAS dans `ProfileSectionRenderer`.
 */
export const MyPlacesSectionSchema = z.object({
  type: z.literal("my-places"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    emptyStateText: LocalizedString.optional(),
    /**
     * PÉRIMÈTRE costum du réseau tiers-lieux — même convention que `MembershipQueryParams.sourceKey`
     * (`$or[source.keys ∈, reference.costum ∈]`). Sur tiers-lieux.org : `["franceTierslieux",
     * "tierslieuxbelgique", "navigatorDesTierslieux"]` (déjà utilisé ailleurs dans cette config,
     * ex. `hero-search`). Absent = réseau Communecter entier.
     */
    sourceKey: z.array(z.string()).optional(),
  }),
});
export type MyPlacesSection = z.infer<typeof MyPlacesSectionSchema>;
export type MyPlacesSectionProps = MyPlacesSection["props"];

// Profile-specific sections union
export const ProfileOnlySectionSchema = z.discriminatedUnion("type", [
  ProfileHeaderSectionSchema,
  ProfileInfoSectionSchema,
  ProfileTiersLieuxInfoSectionSchema,
  ProfileTiersLieuxAboutSectionSchema,
  ProfileAboutSectionSchema,
  ProfileSsbeAboutSectionSchema,
  ProfileParent62AboutSectionSchema,
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

/**
 * Props de l'onglet « Structures » (`component: "StructuresTab"`) : les structures que le compte
 * connecté administre, chacune avec ses créneaux (réponses d'un formulaire CoForm) et un bouton
 * d'ajout qui préremplit puis MASQUE le champ structure. Tout ce qui est propre à un site
 * (formulaire, chemin du finder) vient d'ici : l'onglet ne connaît aucun costum.
 */
export const StructuresTabPropsSchema = z.object({
  answers: z.object({
    /** Formulaire des créneaux (ObjectId). */
    formId: z.string().regex(/^[0-9a-f]{24}$/, "id de formulaire CoForm attendu (ObjectId 24 hex)"),
    /**
     * Chemin Mongo du finder « structure » dans la réponse : `answers.<étape>.finder<kunik>`. Sert à
     * la fois au filtre serveur (créneaux d'une structure), au préremplissage et au masquage.
     */
    structureFinderPath: z
      .string()
      .regex(/^answers\.[^.]+\.finder[^.]+$/, "chemin attendu : answers.<étape>.finder<kunik>"),
    /** « Modifier » dans le détail d'un créneau, pour qui le gère ou l'a déposé (`canEditCoformAnswer`). Absent = lecture seule. */
    editButton: z.boolean().optional(),
    /**
     * Groupe des créneaux DÉPOSÉS par le compte hors des structures qu'il administre (ou sans
     * structure), tous statuts. Exige que le serveur montre à l'auteur ses réponses non validées
     * (SSBE : `SportSanteBienetre::isBoundToOwnAnswers`) — sinon seuls ses créneaux validés y viendraient.
     */
    submittedSlots: z.boolean().optional(),
  }),
  /** `costum` (défaut code) : seules les structures rattachées au site porteur ; `network` : toutes. */
  scope: z.enum(["costum", "network"]).optional(),
  /** Action proposée quand le compte n'administre aucune structure (ex. la page des structures). */
  emptyAction: z.object({ label: LocalizedString, href: z.string().startsWith("/") }).optional(),
  /**
   * Champ de MODÉRATION des structures (chemin pointé, ex. `statusActor`) : hors « Validé », pastille
   * dans l'en-tête et explication au dépliage. Absent = rien d'affiché. Réservé à `scope: costum` :
   * hors du site porteur, le même champ peut dire autre chose (« Une personne morale » ailleurs).
   */
  structureStatusField: z
    .string()
    .regex(/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/, "chemin pointé attendu (ex. statusActor)")
    .optional(),
}).refine((props) => !(props.structureStatusField && props.scope === "network"), {
  message: "structureStatusField n'a de sens qu'en scope costum : hors du site porteur, le champ peut dire autre chose",
  path: ["structureStatusField"],
});
export type StructuresTabProps = z.infer<typeof StructuresTabPropsSchema>;

// Schema pour un tab de profil
export const ProfileTabSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  path: z.string().optional(), // chemin URL personnalisé (par défaut = id)

  // Option 1 : Utiliser des sections composables
  sections: z.array(ProfileSectionSchema).optional(),

  // Option 2 : Utiliser un composant dédié
  component: z.enum(["SocialTab", "MembershipTab", "NewsTab", "StructuresTab"]).optional(),

  /**
   * Options passées au composant du mode `component`. Un onglet à `sections` configure chacune de ses
   * sections par ses `props` ; un onglet à `component` n'avait aucun équivalent et rendait donc
   * toujours la même chose. Cf. `MembershipTabProps` (`types`, `scope`) et `StructuresTabProps`
   * (validées ci-dessous) ; les autres composants ignorent la clé.
   */
  props: z.record(z.string(), z.unknown()).optional(),

  // Sous-routes pour les pages de détail (ex: news/:newsId)
  subRoutes: z.array(ProfileTabSubRouteSchema).optional(),

  condition: ProfileTabConditionSchema,
}).refine(
  (data) => (data.sections && data.sections.length > 0) || data.component,
  { message: "Un tab doit avoir soit 'sections' soit 'component'" }
).superRefine((tab, ctx) => {
  // `props` est un record libre (le mode `component` sert plusieurs composants) : sans cette passe,
  // un formulaire ou un chemin de finder MAL FORMÉ ne se verrait qu'à l'écran, onglet vide (un id
  // bien formé mais faux, lui, ne se voit toujours qu'à l'écran).
  if (tab.component !== "StructuresTab") return;
  const parsed = StructuresTabPropsSchema.safeParse(tab.props);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: "custom", message: issue.message, path: ["props", ...issue.path] });
  }
});

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
export type ProfileParent62AboutSection = z.infer<typeof ProfileParent62AboutSectionSchema>;
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
  type: z.enum(["default", "profile", "team"]).default("default"),
  /** Disposition de la carte « équipe ». `stack` (défaut) : grand portrait 4/3 au-dessus du texte.
   *  `row` : vignette RONDE à gauche de l'identité — pour une carte posée dans une colonne étroite
   *  à côté d'autres blocs, où le grand portrait ferait une colonne bien plus haute que ses
   *  voisines. Sans effet sur les autres types de carte. */
  layout: z.enum(["stack", "row"]).optional(),
  /** Convention de rattachement de la carte « équipe » : où pointe le bouton, et d'où viennent
   *  ses couleurs. OBLIGATOIRE dès que `type: "team"` (gate préflight `member-team-card` ; à
   *  l'exécution, la section échoue tôt plutôt que de rendre une carte sans lien ni couleur) —
   *  aucun gabarit n'est codé en repli dans le module, qui reste générique : un site regroupe ses
   *  membres par territoire, région, filière ou antenne en le déclarant ici. */
  rattachement: z.object({
    /** Gabarit du chemin de la page de regroupement ; `{slug}` est remplacé. */
    cheminGabarit: z.string(),
    /** Préfixe des variables CSS : `<prefixe>-<slug>-carte` et `<prefixe>-<slug>-encre`. */
    prefixeCouleur: z.string(),
  }).optional(),
  /** Couleur FIXE de la carte « équipe », pour une section sans territoire (ex. l'animation
   *  départementale, un contact unique) où `couleursTerritoire` retomberait sur le neutre du
   *  thème faute de valeur à résoudre. Prime sur `rattachement` : posée, elle s'applique à TOUTES
   *  les cartes de la section, quel que soit le territoire porté par chaque membre. `bordure`
   *  reprend `fond` si absente (même convention que `couleursTerritoire`). Couleurs CSS libres
   *  (`var(--jeton)` recommandé) — contraste AA à vérifier entre `fond` et `encre`. */
  fixedColors: z.object({
    fond: z.string(),
    encre: z.string(),
    bordure: z.string().optional(),
  }).optional(),
  showDescription: z.boolean().optional().default(true),
  showAddress: z.boolean().optional().default(true),
  // Bloc de compteurs de `CardProfile` (projets liés). Absent = affiché.
  // Miroir de `CardConfSchema.showStats` du module search : la MÊME carte est
  // rendue ici, elle doit donc se piloter pareil depuis les deux sections.
  showStats: z.boolean().optional(),
  detailsMode: z.enum(["drawer", "dialog", "link"]).default("link"),
  /** Plafond de colonnes de la grille « équipe » (`type: "team"` uniquement) — au-delà de 4 cartes,
   *  le nombre de colonnes réelles est normalement plafonné à 4 (`GRILLE_CARTES`, `EntityMembers.tsx`).
   *  Un effectif nombreux mais voulu plus resserré (ex. 9 coordonnateurs en 3×3) le réduit ici plutôt
   *  que de changer le défaut partagé. Sans effet sous ce nombre de cartes (le plafond ne fait
   *  jamais remonter le nombre de colonnes, seulement le réduire). Défaut code : 4 (historique).*/
  maxColumns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
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
    /** Restreint la liste aux membres portant l'un de ces rôles (`links.<famille>[].roles`,
     *  texte libre). Absent → tous les membres. Permet de composer une page équipe par
     *  fonction : une section par rôle. */
    roles: z.array(z.string()).optional(),
    /** Filtre SERVEUR complémentaire sur les documents des membres, fusionné côté SDK sous le
     *  filtre d'appartenance (ex. `{ "territoires": "Arrageois" }`). Égalité Mongo : la valeur
     *  doit être EXACTEMENT celle stockée sur les profils. Combiné à `roles`, donne « le
     *  coordonnateur DE ce territoire » sur les pages `/territoire/*` (SDK ≥ 1.0.194). */
    filters: z.record(z.string(), z.unknown()).optional(),
    /** Champs AJOUTÉS à la projection par défaut de la liste — ceux que la carte « équipe » lit
     *  et que la liste ne ramène pas seule : `territoires`, `telephone`, `phone`, `mobile`,
     *  `email` (`address` y est déjà). */
    fields: z.array(z.string()).optional(),
    /** Efface la section quand la liste finit vide, au lieu d'afficher « Aucun membre ». */
    hideWhenEmpty: z.boolean().optional(),
    /** Texte libre posé SOUS la liste, sauts de ligne respectés. Sert à garder, dans le même
     *  bloc, le canal de contact d'une équipe (adresse, courriel, téléphones) que les fiches
     *  des membres ne portent pas — et qui doit rester visible même sans membre rattaché. */
    footerText: LocalizedString.optional(),
    /** Texte libre posé DANS chaque carte « équipe », sous les contacts de la personne. Distinct
     *  de `footerText` parce qu'il ne dit pas la même chose : la carte porte déjà le courriel et le
     *  téléphone DE LA PERSONNE, lus sur sa fiche — il n'y reste à donner que ce que la fiche
     *  ignore, typiquement le lieu de permanence de l'équipe. */
    cardText: LocalizedString.optional(),
    /** Classes utilitaires sur l'enveloppe de la section — espacement d'une page, surtout. */
    className: z.string().optional(),
    /** Barre d'onglets Membres/Admins. Défaut `true` (historique) ; `false` sur une page qui
     *  n'expose qu'une liste filtrée. */
    showTabs: z.boolean().optional(),
    /** Titre interne de la liste. Défaut `true` (historique) ; `false` quand la page porte
     *  déjà son propre titre de section. */
    showTitle: z.boolean().optional(),
    /** Bouton « Inviter ». Défaut `true` (historique) ; `false` sur une page vitrine. */
    showInvite: z.boolean().optional(),

    card: MemberCardConfSchema.optional(),
  }),
});

export type MemberSection = z.infer<typeof MemberSectionSchema>;
export type MemberSectionProps = z.infer<typeof MemberSectionSchema>["props"];
