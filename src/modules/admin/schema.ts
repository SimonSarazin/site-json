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

/** Workflow de statut d'une resource (validation pending→validated). `costumFlag` =
 *  `preferences.toBeValidated[slug]` (legacy ValidateGroupAction) ; `statusField` = champ métier.
 *
 *  ⚠ CONTRAT FUTUR — aujourd'hui `status` n'est lu qu'en BOOLÉEN (présence = active le mode admin,
 *  au même titre que rowActions:["validate"]) : les sous-champs ne sont PAS ENCORE câblés.
 *  Décision 2026-07-07 : à l'implémentation (prévue avec SSBE), `mode`/`field`/`states` seront
 *  câblés (filtre Select des states + badge + UPDATE_PATH_VALUE) ; `cascade` et `notifyEmail`
 *  seront RETIRÉS — la cascade legacy est intrinsèque (pas un paramètre de requête, à re-vérifier
 *  dans ValidateGroupAction) et l'email de statut est un hook costum BACKEND (chantier
 *  costum-hooks), pas un levier du front. Ne PAS écrire de valeur non-défaut d'ici là. */
export const AdminStatusConfigSchema = z.object({
  field: z.string().default("preferences.toBeValidated"),
  mode: z.enum(["costumFlag", "statusField"]).default("costumFlag"),
  states: z.array(z.string()).optional(),
  cascade: z.boolean().default(true),
  notifyEmail: z.boolean().default(false),
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
  rowActions: z.array(z.enum(["edit", "delete", "validate", "reference"])).optional(),
  bulkActions: z.array(z.enum(["export", "validate", "delete"])).optional(),
  status: AdminStatusConfigSchema.optional(),
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
  /** Colonnes de DONNÉES des deux tables (défaut name + address.addressLocality). Les colonnes
   *  structurelles Type (badge collection) et Action restent fixes. */
  columns: AdminColumnsSchema.optional(),
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
