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
 *  `preferences.toBeValidated[slug]` (legacy ValidateGroupAction) ; `statusField` = champ métier. */
export const AdminStatusConfigSchema = z.object({
  field: z.string().default("preferences.toBeValidated"),
  mode: z.enum(["costumFlag", "statusField"]).default("costumFlag"),
  states: z.array(z.string()).optional(),
  cascade: z.boolean().default(true),
  notifyEmail: z.boolean().default(false),
});

const AdminDashboardSectionSchema = z.object({
  type: z.literal("dashboard"),
  title: LocalizedString.optional(),
});

const AdminMembersSectionSchema = z.object({
  type: z.literal("members"),
  scope: z.enum(["carrier", "entity"]).default("carrier"),
  /** Onglets/outils rendus : toBeValidated (à valider), isAdmin (admins), isInviting (invités),
   *  text (barre de recherche). Absent → à-valider + admins + recherche (l'onglet « tous » est
   *  toujours présent). */
  filters: z.array(z.enum(["isAdmin", "toBeValidated", "isInviting", "text"])).optional(),
  actions: z.array(z.string()).optional(),
});
export type AdminMembersSection = z.infer<typeof AdminMembersSectionSchema>;

const AdminResourceSectionSchema = z.object({
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
  /** Colonnes : chemin pointé brut (`"address.addressLocality"`) OU `{path, label}` (libellé localisé). */
  columns: z.array(z.union([
    z.string(),
    z.object({ path: z.string(), label: LocalizedString.optional() }),
  ])).optional(),
  create: AdminFormRefSchema.default("inherit"),
  edit: AdminFormRefSchema.default("inherit"),
  rowActions: z.array(z.enum(["edit", "delete", "validate", "reference"])).optional(),
  bulkActions: z.array(z.enum(["export", "validate", "delete"])).optional(),
  status: AdminStatusConfigSchema.optional(),
});
export type AdminResourceSection = z.infer<typeof AdminResourceSectionSchema>;

const AdminImportSectionSchema = z.object({
  type: z.literal("import"),
  title: LocalizedString.optional(),
  entityTypes: z.array(z.string()).optional(),
});
export type AdminImportSection = z.infer<typeof AdminImportSectionSchema>;

const AdminExportSectionSchema = z.object({ type: z.literal("export"), title: LocalizedString.optional() });
/** Section référencement : recherche globale (hors costum) + rattacher/retirer une référence.
 *  `entityTypes` : types proposés dans le sélecteur (défaut organizations/projects/events/poi). */
const AdminReferenceSectionSchema = z.object({
  type: z.literal("reference"),
  title: LocalizedString.optional(),
  entityTypes: z.array(z.string()).optional(),
});
export type AdminReferenceSection = z.infer<typeof AdminReferenceSectionSchema>;
const AdminModerationSectionSchema = z.object({ type: z.literal("moderation"), title: LocalizedString.optional() });

/** Section costum : `type` libre enregistré via `registerAdminSection` (comme une section profil costum).
 *  Permissif (le composant enregistré valide ses props) — mis EN DERNIER dans l'union (fallback). */
const AdminCustomSectionSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const AdminSectionSchema = z.union([
  AdminDashboardSectionSchema,
  AdminMembersSectionSchema,
  AdminResourceSectionSchema,
  AdminImportSectionSchema,
  AdminExportSectionSchema,
  AdminReferenceSectionSchema,
  AdminModerationSectionSchema,
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
  /** Onglets. Si absent → dérivés automatiquement de `config.profiles.addConfig` (P2+). */
  tabs: z.array(AdminTabSchema).optional(),
});
export type AdminConfig = z.infer<typeof AdminConfigSchema>;
