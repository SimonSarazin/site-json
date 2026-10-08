import { z } from "zod";

import { PreviewConfSchema, SearchBaseParamsSchema } from "@/modules/search/schema";
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

/**
 * `create` d'une resource `answers` : les réponses CoForm n'ont AUCUNE modale d'entité (ni
 * standard, ni costumForm — `resolveCreateModal` rend `null` pour ce type). La création passe par
 * le `CoFormModal` du form, comme le bouton public `addButton.coform` de `searchProStatic` :
 * `{ "coform": "<formId>" }` (ObjectId 24 hex, même contrat que `answerCopy.targetForm`). Forme
 * objet plutôt qu'une chaîne devinée au format : un id de form n'est pas une clé de modale, et
 * `audit:config` vérifie les clés `add-<id>` contre le registre.
 */
export const AdminCreateRefSchema = z.union([
  AdminFormRefSchema,
  z.object({ coform: z.string().regex(/^[0-9a-f]{24}$/, "id de form CoForm attendu (ObjectId 24 hex)") }),
]);

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
    /**
     * En-tête cliquable pour trier ? Défaut `true` (comportement historique).
     * `false` rend un simple libellé — à poser sur toute colonne dont le `path` n'existe PAS
     * en base : le tri est SERVEUR (`defaultSortBy`), donc une colonne FABRIQUÉE après la
     * requête (champs aplatis par un hook costum, jointures) trierait sur une clé absente,
     * c'est-à-dire dans un ordre arbitraire — tout en écrasant le tri par défaut, et en
     * déstabilisant la pagination du scroll infini (skip/limit sans ordre total).
     */
    sortable: z.boolean().optional(),
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
  create: AdminCreateRefSchema.default("inherit"),
  /**
   * Détail d'une ligne au CLIC (et par l'action « Aperçu » du menu de ligne, accessible au
   * clavier) : MÊME contenu que le détail des listes publiques (`Preview.tsx`, dispatch sur
   * `preview.type` — ex. `coform-answer` avec `editButton` pour corriger une réponse depuis la
   * modération), dans le conteneur `dialog`. Opt-in : sans ce bloc, les lignes ne réagissent pas
   * au clic (zéro changement pour les tables existantes). Un modérateur vérifie une fiche AVANT de
   * la marquer « Validé » : les colonnes de la table n'en montrent qu'une tranche.
   */
  preview: PreviewConfSchema.optional(),
  /**
   * Valeurs SEMÉES dans la modale de CRÉATION ouverte depuis cette section (jamais en édition —
   * l'entité fait alors foi). Fusionnées PAR-DESSUS les défauts dérivés du formulaire
   * (`fields.<nom>.default`), donc une clé absente d'ici garde son défaut normal.
   *
   * Sert le cas « un onglet = un sous-ensemble » : une table filtrée par `source` (ex.
   * `defaultTags:["Appels à projets"]`) ouvre le formulaire DÉJÀ positionné sur le sous-type
   * correspondant, sans faire re-choisir à l'admin ce que l'onglet dit déjà. Sans ce canal, il
   * faudrait un formulaire costum cloné par sous-type pour ne varier qu'un défaut.
   *
   * Les clés sont des noms de champs du formulaire résolu par `create` ; une clé qu'il ne déclare
   * pas est écartée par `applyCreateDefaults` (semis inerte, jamais de valeur fantôme).
   */
  createDefaults: z.record(z.string(), z.unknown()).optional(),
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

/** Id Mongo (24 hexadécimaux) — forme des ids de form. */
const MONGO_ID = /^[0-9a-f]{24}$/;

/**
 * Section « reprise de réponses » : liste les réponses d'un form SOURCE (déposées sur un autre
 * site) et les copie UNE PAR UNE dans le form CIBLE du site — bouton « Copier ». L'écriture est
 * SERVEUR (action `copy` de `survey/answer/newanswer` → `Coform::copyAnswer`) : renommage du
 * préfixe de section, contexte/`source` du site cible, idempotence par `copiedFrom` (une copie
 * existante est renvoyée, jamais dupliquée). Prérequis : le form cible est un DUPLICATA du
 * source (mêmes ids d'inputs — la duplication legacy les préserve — seul le préfixe change).
 *
 * Trois états par ligne : « Copié » (une réponse cible porte `copiedFrom` = cette ligne),
 * « Doublon probable » (une réponse cible SANS trace partage l'empreinte `duplicateKeys` —
 * copie faite par un autre canal : confirmation demandée) et « À copier ».
 */
const AdminAnswerCopySectionSchema = z.object({
  ...sectionAccess,
  type: z.literal("answerCopy"),
  title: LocalizedString.optional(),
  /** Form SOURCE : ses réponses sont les candidates (filtre `form` posé d'office par la section). */
  sourceForm: z.string().regex(MONGO_ID),
  /** Form CIBLE : reçoit les copies (l'admin doit être admin de son contexte porteur — garde serveur). */
  targetForm: z.string().regex(MONGO_ID),
  /**
   * Requête des candidates — MÊME forme que `resource.source` (`defaultFilters` mongo, `searchBy`,
   * `defaultSortBy`, `indexStepList`…). `notSourceKey: true` est posé d'office : les réponses source
   * appartiennent à un autre site, le scope costum les exclurait.
   */
  source: SearchBaseParamsSchema.partial().optional(),
  /** Colonnes de DONNÉES (lignes APLATIES par le hook costum, comme `resource`) : `"path"` ou `{ path, label }`
   *  — sans `type`/`sortable` : la table n'a ni tri ni cellule audio, une clé promise puis ignorée serait un faux
   *  contrat. Statut de copie et Action sont fixes. */
  columns: z.array(z.union([z.string(), z.object({ path: z.string(), label: LocalizedString.optional() })])).optional(),
  /**
   * Chemins (lignes aplaties) formant l'EMPREINTE d'un doublon probable — une réponse cible sans
   * `copiedFrom` qui partage ces valeurs. Défaut : `["name", "structure.name", "address.postalCode"]`.
   */
  duplicateKeys: z.array(z.string().min(1)).optional(),
}).refine((s) => s.sourceForm !== s.targetForm, { message: "sourceForm et targetForm doivent différer", path: ["targetForm"] });
export type AdminAnswerCopySection = z.infer<typeof AdminAnswerCopySectionSchema>;

const BUILTIN_SECTION_TYPES = ["dashboard", "members", "resource", "import", "export", "reference", "moderation", "answerCopy"] as const;

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
    AdminAnswerCopySectionSchema,
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
