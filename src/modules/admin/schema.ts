import { z } from "zod";

import { SearchBaseParamsSchema } from "@/modules/search/schema";
import { VisibilityConditionSchema } from "@/lib/visibility/schema";

import { LocalizedString } from "../../types/locale-schema";

/**
 * Manifeste de la page d'Administration — `config.admin` (par site, JSON).
 *
 * Équivalent moderne du `htmlConstruct.adminPanel.menu` legacy : le layout de l'admin (onglets,
 * sections, ordre, accès) est 100% déclaré en config. Le module admin (jumeau du module profil)
 * compile ce manifeste en UI, en réutilisant l'existant (SearchListView, DynamicModal, getMembersAdmin…).
 *
 * cf. commentaire/plan-module-admin-generique.md
 */

/** Niveaux d'accès (du plus fort au plus faible). superAdmin = plateforme ; siteAdmin = admin du costum
 *  porteur (carrier) ; entityAdmin = admin de l'entité éditée (résolu par-ligne). */
export const AdminAccessLevelSchema = z.enum(["superAdmin", "siteAdmin", "entityAdmin"]);
export type AdminAccessLevel = z.infer<typeof AdminAccessLevelSchema>;

/** Résolution du form add/edit d'une resource : `false` (désactivé) · `"inherit"` (hérite de
 *  addConfig / profiles.<type>.editModal) · `"add-<key>"`/`"edit-<key>"` (clé forcée, standard ou costum). */
export const AdminFormRefSchema = z.union([z.literal(false), z.literal("inherit"), z.string()]);

/** Un état métier du mode `statusField` : `value` = valeur brute écrite/lue en base (VERBATIM,
 *  orthographes legacy comprises — ex. « Réfusé » du CoForm SSBE) ; `label` = affichage (permet de
 *  corriger l'orthographe sans toucher la donnée) ; `tone` = ton visuel du badge (mêmes tokens
 *  `bg-badge-*` que les badges des cartes publiques). Forme courte : la string seule. */
export const AdminStatusStateSchema = z.union([
  z.string(),
  z.object({
    value: z.string(),
    label: LocalizedString.optional(),
    tone: z.enum(["positive", "pending", "progress", "negative"]).optional(),
  }),
]);
export type AdminStatusState = z.infer<typeof AdminStatusStateSchema>;

/** Workflow de statut d'une resource :
 *  - `costumFlag` (défaut) = `preferences.toBeValidated[slug]` (legacy ValidateGroupAction), lu en
 *    booléen — présence de `status` = mode admin, au même titre que rowActions:["validate"].
 *  - `statusField` (câblé le 31/07, décision 2026-07-07) = le statut est un CHAMP MÉTIER de
 *    `serverData` (`field`, chemin pointé, ex. le select « Administration » d'une answer CoForm) à
 *    valeurs dans `states` : colonne badge toné, filtre serveur par état, actions « Marquer … »
 *    par-ligne via `entity.updateField` (UPDATE_PATH_VALUE — un $set ciblé, pas un save complet).
 *    `cascade`/`notifyEmail` du contrat initial sont RETIRÉS comme acté (cascade legacy
 *    intrinsèque ; email de statut = hook costum backend, pas un levier du front). */
export const AdminStatusConfigSchema = z.object({
  field: z.string().default("preferences.toBeValidated"),
  mode: z.enum(["costumFlag", "statusField"]).default("costumFlag"),
  states: z.array(AdminStatusStateSchema).optional(),
});

/** Colonnes de table : chemin pointé brut (`"address.addressLocality"`) OU `{path, label, type}` (libellé localisé). */
export const AdminColumnsSchema = z.array(z.union([
  z.string(),
  z.object({
    path: z.string(),
    label: LocalizedString.optional(),
    /** Rendu de la cellule : `text` (défaut) ou `audio` (lecteur audio depuis un `medias[].url` / une URL). */
    type: z.enum(["text", "audio"]).optional(),
  }),
]));

/** Accès minimum d'une SECTION (surcharge l'accès page/onglet — cf. AdminConfig.access). */
const sectionAccess = { access: AdminAccessLevelSchema.optional() };

/** Champs communs des KPIs opt-in du dashboard. `linkTo` = raccourci de la tuile (path site
 *  ou onglet admin) ; `icon` = nom lucide (DynamicIcon), défaut par type. */
const kpiBase = {
  label: LocalizedString,
  /** Sous-titre descriptif de la tuile (ex. « Créneaux publiés (état Validé) »). */
  hint: LocalizedString.optional(),
  linkTo: z.string().optional(),
  icon: z.string().optional(),
};

/** KPIs déclarés du dashboard — OPT-IN (sans `kpis`, le dashboard reste 100 % dérivé) :
 *  - `searchCount` : compteur d'un périmètre de recherche (même contrat `source` que les
 *    resources / `baseParams` de searchProStatic). `trend: "monthly"` charge le périmètre
 *    complet (useSearchAllResults) et dérive l'évolution mensuelle des dates `created` —
 *    les suppressions ne sont pas historisées, cf. computeMonthlyTrend ;
 *  - `membersPending` : membres du carrier en attente de validation (même source que
 *    l'onglet members) ;
 *  - `analyticsVisitors` : visites uniques mensuelles. AUCUNE intégration analytics en
 *    LECTURE n'existe dans le moteur (IntegrationsLoader ne fait que du tracking) : la
 *    tuile affiche un état « à raccorder » explicite plutôt qu'un chiffre inventé. */
export const AdminDashboardKpiSchema = z.discriminatedUnion("type", [
  z.object({
    ...kpiBase,
    type: z.literal("searchCount"),
    entityType: z.string(), // answers | organizations | poi | …
    source: SearchBaseParamsSchema.partial().optional(),
    trend: z.enum(["monthly"]).optional(),
  }),
  z.object({ ...kpiBase, type: z.literal("membersPending") }),
  z.object({ ...kpiBase, type: z.literal("analyticsVisitors") }),
]);
export type AdminDashboardKpi = z.infer<typeof AdminDashboardKpiSchema>;

const AdminDashboardSectionSchema = z.object({
  ...sectionAccess,
  type: z.literal("dashboard"),
  title: LocalizedString.optional(),
  /** Tuiles KPI déclarées, rendues AVANT les tuiles dérivées (resources/modération). */
  kpis: z.array(AdminDashboardKpiSchema).optional(),
});
export type AdminDashboardSection = z.infer<typeof AdminDashboardSectionSchema>;

const AdminMembersSectionSchema = z.object({
  ...sectionAccess,
  type: z.literal("members"),
  /** Onglets/outils rendus : toBeValidated (à valider), isAdmin (admins), isInviting (invités),
   *  text (barre de recherche). Absent → à-valider + admins + recherche (l'onglet « tous » est
   *  toujours présent). */
  filters: z.array(z.enum(["isAdmin", "toBeValidated", "isInviting", "text"])).optional(),
  /** Actions proposées. Absent → tout (comportement historique). `invite` gate le bouton « Inviter ». */
  actions: z.array(z.enum(["invite"])).optional(),
});
export type AdminMembersSection = z.infer<typeof AdminMembersSectionSchema>;

const AdminResourceSectionSchema = z.object({
  ...sectionAccess,
  type: z.literal("resource"),
  entityType: z.string(), // organizations | projects | poi | events | answers | citoyens | …
  label: LocalizedString.optional(),
  /**
   * Paramètres de la requête de recherche — MÊME forme que les `baseParams` de `searchProStatic`
   * (SearchBaseParamsSchema) : `defaultFilters` (filtres Mongo, ex. {"type":"recoveryCenter"}),
   * `defaultTags`, `searchBy`, `defaultSortBy` (tri initial, surchargé par le tri colonne UI),
   * `indexStepList` (taille de page), `notSourceKey`, `locality`… NB : en mode admin (rowActions
   * `validate`/`status`), `defaultFields` est ignoré — la table charge les documents COMPLETS
   * (résolution d'édition costum + forms préremplis, cf. AdminResourceTable).
   */
  source: SearchBaseParamsSchema.partial().optional(),
  columns: AdminColumnsSchema.optional(),
  create: AdminFormRefSchema.default("inherit"),
  edit: AdminFormRefSchema.default("inherit"),
  rowActions: z.array(z.enum(["edit", "delete", "validate", "reference", "setFeatured"])).optional(),
  /**
   * Gating par APPARTENANCE (opt-in) : sur une ligne NON possédée (`source.keys` ∌ slug du site —
   * référencée ou étrangère), seules la lecture et l'action `reference` restent ; `edit`/`delete`/
   * `validate`/statusField sont masqués. Modèle « la propriété porte les fonctionnalités, la
   * référence ne porte que la visibilité » : le Node durci refuse déjà ces écritures sur une
   * entité étrangère (401, cf. useReferenceElement) — sans ce gate, l'UX proposait des actions
   * vouées à l'échec. Gating d'AFFICHAGE ≠ vérité des droits (un superAdmin peut éditer une
   * étrangère) : v1 par appartenance, opt-in par section pour ne pas changer les sites qui
   * modèrent du référencé (`moderateReferenced`).
   */
  restrictActionsToOwned: z.boolean().optional(),
  /** `transfer` requiert `transferFrom` (le bouton reste caché sans lui) — ouvre le dialog de
   *  migration d'appropriation en mode ids[] sur la sélection (mêmes contrôles/gate serveur). */
  bulkActions: z.array(z.enum(["export", "validate", "delete", "transfer"])).optional(),
  /** Slug du costum CÉDANT pour la bulkAction `transfer` (les fiches cochées lui appartiennent). */
  transferFrom: z.string().min(1).optional(),
  status: AdminStatusConfigSchema.optional(),
  /**
   * Champ booléen à EXCLUSIVITÉ (un seul document du périmètre `source` à `true` à la fois, ex.
   * `featured`/« à la une »). OPT-IN strict : n'a d'effet que combiné à `rowActions:["setFeatured"]`
   * — sans lui, l'action « Mettre à la une » ne s'affiche pas, zéro impact sur les sections
   * `resource` existantes. Portée de l'exclusivité (depuis la review MR 44) : une RECHERCHE
   * SERVEUR dédiée sur le périmètre déclaré par `source` (`fetchFlagged` — jamais les lignes
   * chargées de l'infinite scroll, jamais les filtres UI transitoires), cf. `runExclusiveFlag`.
   */
  exclusiveField: z.string().optional(),
});
export type AdminResourceSection = z.infer<typeof AdminResourceSectionSchema>;

const AdminImportSectionSchema = z.object({
  ...sectionAccess,
  type: z.literal("import"),
  title: LocalizedString.optional(),
  /** Types importables (aligné IMPORT_ELEMENTS backend). Strict : un type hors liste échoue à la
   *  validation de config (avant ce z.enum, il était silencieusement filtré au runtime → Select vide). */
  entityTypes: z.array(z.enum(["poi", "organizations", "projects", "events", "citoyens"])).optional(),
});
export type AdminImportSection = z.infer<typeof AdminImportSectionSchema>;

const AdminExportSectionSchema = z.object({
  ...sectionAccess,
  type: z.literal("export"),
  title: LocalizedString.optional(),
  /** Types proposés à l'export (défaut organizations/projects/poi/events). NB : l'export reste
   *  réservé super-admin (plancher BACKEND, non contournable par config). */
  entityTypes: z.array(z.string()).optional(),
});
export type AdminExportSection = z.infer<typeof AdminExportSectionSchema>;
/** Section référencement : recherche globale (hors costum) + rattacher/retirer une référence.
 *  `entityTypes` : types proposés dans le sélecteur (défaut organizations/projects/events/poi). */
const AdminReferenceSectionSchema = z.object({
  ...sectionAccess,
  type: z.literal("reference"),
  title: LocalizedString.optional(),
  entityTypes: z.array(z.string()).optional(),
  /**
   * Recherche de CANDIDATES (« Rechercher & référencer ») configurable — décision 2026-08-20 :
   *  - `openData` : politique de consentement, au niveau SECTION (uniforme) —
   *      `optIn` (défaut) = fidèle legacy referenceTable (`isOpenData: true` exigé ; commit
   *      c097823fc 2021, Bouboule) ; `optOut` = tout sauf refus EXPLICITE
   *      (`$nin [false, "false"]` — 2 241 orgs + 1 741 events du parc l'ont posé, respectés) ;
   *      `off` = aucun filtre open-data.
   *  - `defaultFilters` : ciblage du VIVIER commun à toutes les collections de la section
   *      (grammaire Mongo-ish du parc : `source.keys`, `address.postalCode`…).
   *  - `defaultFiltersByType` : ciblage PAR collection, fusionné PAR-DESSUS le commun — une
   *      section multi-collections (sélecteur) ne fait pas fuiter un filtre d'orgs vers les events.
   * Les garde-fous `$nin` du déjà-rattaché/référencé restent NON configurables (fusionnés
   * même-clé après la config — parité : add/reference ne déduplique pas).
   */
  search: z.object({
    openData: z.enum(["optIn", "optOut", "off"]).default("optIn"),
    defaultFilters: z.record(z.string(), z.unknown()).optional(),
    defaultFiltersByType: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  }).optional(),
  /** Colonnes de DONNÉES des deux tables (défaut name + address.addressLocality). Les colonnes
   *  structurelles Type (badge collection) et Action restent fixes. */
  columns: AdminColumnsSchema.optional(),
  /**
   * Pose `preferences.toBeValidated.<slug>` (SCOPÉ — jamais le boolean global, qui masquerait
   * l'entité chez les autres sites) au référencement : un référencé passe alors par la modération
   * a priori du site comme un natif, au lieu d'être publié d'office. Échec-tolérant.
   */
  moderateReferenced: z.boolean().optional(),
});
export type AdminReferenceSection = z.infer<typeof AdminReferenceSectionSchema>;
const AdminModerationSectionSchema = z.object({ ...sectionAccess, type: z.literal("moderation"), title: LocalizedString.optional() });

const BUILTIN_SECTION_TYPES = ["dashboard", "members", "resource", "import", "export", "reference", "moderation"] as const;

/** Section costum : `type` libre enregistré via `registerAdminSection` (comme une section profil costum).
 *  Permissif (le composant enregistré valide ses props) — mais REFUSE les types builtin : sans ce
 *  refine, une section builtin fautive (ex. rowActions:["edite"]) retombait silencieusement ici et
 *  passait la validation (l'erreur réelle avalée, l'action absente au runtime sans aucun message). */
const AdminCustomSectionSchema = z.object({
  ...sectionAccess,
  type: z.string().refine((t) => !(BUILTIN_SECTION_TYPES as readonly string[]).includes(t), {
    message: "type de section builtin invalide (voir les erreurs du schéma builtin correspondant)",
  }),
  props: z.record(z.string(), z.unknown()).optional(),
});

/** Builtin en discriminatedUnion (erreurs précises par type) + fallback custom pour les types costum. */
export const AdminSectionSchema = z.union([
  z.discriminatedUnion("type", [
    AdminDashboardSectionSchema,
    AdminMembersSectionSchema,
    AdminResourceSectionSchema,
    AdminImportSectionSchema,
    AdminExportSectionSchema,
    AdminReferenceSectionSchema,
    AdminModerationSectionSchema,
  ]),
  AdminCustomSectionSchema,
]);
export type AdminSection = z.infer<typeof AdminSectionSchema>;

/** Un onglet de l'admin (miroir de `profiles.<type>.tabs[]`) : un groupe de sections avec son propre accès. */
export const AdminTabSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  icon: z.string().optional(),
  access: AdminAccessLevelSchema.optional(), // surcharge l'accès global pour cet onglet
  condition: VisibilityConditionSchema.optional(),
  sections: z.array(AdminSectionSchema),
});
export type AdminTab = z.infer<typeof AdminTabSchema>;

export const AdminConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Titre de la page (h1 + tuile). Défaut : « Administration ». */
  title: LocalizedString.optional(),
  /** Accès minimum à la page admin (surchargé par onglet/section). */
  access: z.object({ min: AdminAccessLevelSchema.default("siteAdmin") }).default({ min: "siteAdmin" }),
  /** Onglets. Si absent → dashboard SEUL (pas de dérivation automatique — décision 2026-07-07 :
   *  les tabs se GÉNÈRENT explicitement, la config reste la source de vérité inspectable). */
  tabs: z.array(AdminTabSchema).optional(),
});
export type AdminConfig = z.infer<typeof AdminConfigSchema>;
