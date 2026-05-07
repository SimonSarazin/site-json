/**
 * Types pour les données CoForm
 * Basés sur la structure retournée par l'API GET_COFORM_BY_ID
 */

/**
 * Raisons possibles de refus d'accès à un formulaire
 */
export type CoFormAccessReason =
  | "already_answered"
  | "not_member"
  | "not_authorized"
  | "form_not_started"
  | "form_closed"
  | "form_inactive"
  | "not_logged_in"
  | "form_not_found"
  | null;

/**
 * Résumé d'une réponse existante (pour le sélecteur de réponses multiples)
 */
export interface CoFormAnswerSummary {
  id: string;
  createdAt: string;
  updatedAt?: string;
  /** Données complètes de la réponse (pour le rendu readonly) */
  answers?: AllStepsData;
  /** Aperçu des premières valeurs remplies (clé label → valeur affichable) */
  preview?: Record<string, string>;
}

/**
 * Métadonnées de traçabilité d'une réponse existante (créateur + dernier
 * modifieur). Vit à côté de `existingAnswer` pour ne pas polluer le payload
 * des réponses. Tous les champs sont optionnels :
 * - `createdBy`/`createdAt` : présents pour toute réponse (champs natifs).
 * - `lastModifier*` : peuplés depuis le déploiement de la traçabilité.
 *   Pour les réponses créées avant ce déploiement, `lastModifier === null`.
 */
export interface ExistingAnswerMeta {
  createdBy?: string | null;
  createdAt?: number | null;
  lastModifier?: string | null;
  lastModifierName?: string | null;
  lastModifiedAt?: number | null;
}

/**
 * Une entrée de l'historique d'audit, retournée par GET_COFORM_ANSWER_HISTORY.
 * `userName`/`userSlug` sont dénormalisés au moment de la modification :
 * survivent à une suppression du user.
 */
export interface AnswerChange {
  userId: string;
  userName: string;
  userSlug: string;
  at: number;
  mutationType: "create" | "update";
  changedFields: string[];
}

/**
 * Informations d'accès retournées par le serveur
 * Contrôle d'accès enrichi : droits, dates, réponse existante
 */
export interface CoFormAccessInfo {
  canAnswer: boolean;
  reason: CoFormAccessReason;
  formStatus: "open" | "not_started" | "closed" | "inactive";
  existingAnswerId: string | null;
  existingAnswer: AllStepsData | null;
  /**
   * Métadonnées de la réponse existante (créateur, dernier modifieur).
   * Présent uniquement quand `existingAnswer` est non null.
   */
  existingAnswerMeta?: ExistingAnswerMeta | null;
  /** Liste des réponses existantes de l'utilisateur (mode réponse multiple) */
  existingAnswers?: CoFormAnswerSummary[];
  requiresLogin: boolean;
  allowTemporary: boolean;
  withConfirmation: boolean;
  isOnlyMember: boolean;
  isOneAnswerPerPers: boolean;
  isActive: boolean;
  dates: {
    start: string | null;
    end: string | null;
    startNoConfirmation: string | null;
    endNoConfirmation: string | null;
  };
  /**
   * Liste de input keys (kunik) que l'utilisateur courant ne doit pas voir/éditer
   * sur ce form. Calculée côté serveur via `placeAdminOnlyFields` /
   * `placeMemberOnlyFields` croisé avec la relation user↔lieu (via
   * sharedQuestionPath). Toujours présent (vide si aucune restriction
   * applicable). Le rendu React skip ces fields ; le save backend strip ces
   * fields au cas où (defense in depth).
   */
  restrictedFields?: string[];
}

/**
 * Configuration de la page de remerciement (personnalisable par l'admin du formulaire)
 * Si absente, la page de remerciement générique est affichée.
 */
export interface CoFormThankYouConfig {
  /** Titre personnalisé (remplace le défaut i18n) */
  title?: string;
  message?: string;
  /** Informations supplémentaires (ex: prochaines étapes, contact) */
  additionalInfo?: string;
  /** Couleur d'accent de la bande supérieure (hex) */
  accentColor?: string;
  showSubmitAnother?: boolean;
}

export interface CoFormParent {
  [organizationId: string]: {
    type: "organizations" | "projects";
    name: string;
  };
}

// ============================================================================
// Types pour la logique conditionnelle
// ============================================================================

export type ConditionalOperator = "equals" | "notEquals" | "contains" | "matches" | "isEmpty" | "isNotEmpty";
export type ConditionalAction = "show" | "hide";

export interface ConditionalRule {
  sourceInput: string;
  operator: ConditionalOperator;
  value: string;
  action: ConditionalAction;
  targetInput?: string;
  targetStep?: string;
}

export interface ConditionalDisplay {
  enabled: boolean;
  logic: "and" | "or";
  rules: ConditionalRule[];
}

export interface CoFormInputField {
  label?: string;
  placeholder?: string;
  info?: string;
  position?: string;
  type: string;
  isRequired?: boolean;
  activeComments?: boolean;
  width?: string;
  enableMarkdown?: boolean;
  conditionalDisplay?: ConditionalDisplay;
  [key: string]: unknown;
}

export interface CoFormSubFormInputs {
  name: string;
  info?: string;
  id: string;
  formParent: string;
  hasMultiEval?: boolean;
  inputs: Record<string, CoFormInputField>;
}

/**
 * Type d'option pour multiCheckboxPlus: simple (checkbox seul) ou cplx (checkbox + champ texte)
 */
export type MultiCheckboxPlusOptionType = "simple" | "cplx";

// ============================================================================
// Types pour le champ Evaluation
// ============================================================================

/**
 * Type de vote pour le champ Evaluation
 */
export type EvaluationVoteType = "colour" | "emoji" | "note" | "star";

/**
 * Configuration d'un critère d'évaluation
 */
export interface EvaluationCriteria {
  name: string;
  coeff: number;
}

/**
 * Structure hiérarchique des catégories
 * Peut être imbriquée sur N niveaux (categoryNumber)
 * Les feuilles sont des arrays vides [""]
 */
export interface EvaluationCategories {
  [key: string]: EvaluationCategories | string[];
}

/**
 * Configuration du champ Evaluation
 */
export interface EvaluationConfig {
  /** Structure hiérarchique des catégories */
  categories: EvaluationCategories;
  /** Critères d'évaluation (colonnes) : { id: { name, coeff } } */
  criterias: Record<string, EvaluationCriteria>;
  /** Label affiché au-dessus des critères */
  criteriaLabel: string;
  /** Nombre de niveaux de catégories */
  categoryNumber: number;
  /** Titre affiché au-dessus des catégories */
  categoryTitle: string;
  /** Permettre plusieurs votes par ligne */
  multiVotePerLine: boolean;
  /** Type de vote */
  voteType: EvaluationVoteType;
  /** Couleurs pour le type "colour" */
  colours?: { OK: string; NotOK: string };
  /** Emojis pour le type "emoji" */
  emojis?: string[];
  /** Valeur max pour le type "note" */
  noteMax?: number;
  /** Nombre d'étoiles pour le type "star" */
  starCount?: number;
}

/**
 * Valeur d'un vote selon le type
 * - colour: "OK" | ""
 * - emoji: string (l'emoji sélectionné)
 * - note: number (1 à noteMax)
 * - star: number (1 à starCount)
 */
export type EvaluationVoteValue = string | number | "";

/**
 * Valeur stockée pour un champ Evaluation
 * Structure: { [categoryPath]: { [criteriaId]: vote } }
 */
export type EvaluationValue = Record<string, Record<string, EvaluationVoteValue>>;

// ============================================================================
// Types pour le champ CommonTable (calculateur de bonheur — commonTableV2)
// ============================================================================

/**
 * Niveaux de satisfaction possibles. "" = non renseigné.
 */
export type HappinessValue = "" | "love" | "happySmile" | "neutral" | "sad" | "cry";

/**
 * Une solution déclarée par l'utilisateur pour un usage donné.
 * Plusieurs solutions peuvent coexister par usage ; chacune a ses propres scores.
 */
export interface CommonTableSolution {
  criteriaId: string;
  /** Nom de la solution (ex: "Odoo") */
  criteria: string;
  /** Libellé de l'usage parent (ex: "Comptabilité") */
  usage: string;
  /** Clé technique de l'usage (lien avec config.usages) */
  usageKey: string;
  /** Niveau d'urgence 0..5 */
  note: number;
  happiness: HappinessValue;
  yesOrNo: boolean;
  comment: string;
}

/** Scores per-criteriaId — match avec MongoDB `answers.yesOrNo{key}`. */
export type CommonTableScores = Record<string /* criteriaId */, CommonTableSolution>;

/**
 * Entrée du catalogue local de l'utilisateur (ses propres ajouts pour ce form).
 * Sera persisté côté serveur dans `answers.criterias{key}` de SA réponse.
 */
export interface CommonTableMyCatalogEntry {
  /** Libellé optionnel (souvent vide ; le nom de la solution vit dans scores.criteria) */
  label?: string;
  /** Libellé de l'usage parent (ex: "Comptabilité") */
  usage: string;
  /** Clé technique de l'usage parent */
  usageKey: string;
  coeff?: number;
}

/** Catalogue propre à l'utilisateur — match avec MongoDB `answers.criterias{key}`. */
export type CommonTableMyCatalog = Record<string /* criteriaId */, CommonTableMyCatalogEntry>;

/**
 * Valeur composite d'un champ commonTable côté React.
 * Combine les scores (matrice utilisateur) et les ajouts de l'utilisateur au
 * catalogue. À la dénormalisation, ces deux sous-structures sont splittées en
 * deux entrées root-level distinctes (`yesOrNo{key}` et `criterias{key}`).
 */
export interface CommonTableValue {
  scores: CommonTableScores;
  myCatalog: CommonTableMyCatalog;
}

/**
 * Entrée du catalogue collaboratif d'un input commonTable.
 * Représente une criteria (solution) déclarée par n'importe quel répondant pour
 * un usage donné — agrégée côté serveur depuis tous les `answers.criterias{key}`.
 */
export interface CommonTableCatalogEntry {
  label?: string;
  /**
   * Nom canonique de la solution (ex: "Odoo"). Mode de la distribution
   * `names` — celui avec le count le plus élevé. Disponible seulement si au
   * moins un répondant a saisi un nom de solution.
   */
  name?: string;
  usage: string;
  usageKey: string;
  coeff?: number;
  /** Nombre de répondants ayant rempli `criteria` non-vide pour ce criteriaId */
  count: number;
  /**
   * Distribution complète des noms de solutions saisis par les users pour
   * ce criteriaId, avec leur fréquence. Permet de proposer plusieurs
   * suggestions distinctes par ligne (cf. legacy autocomplete `accriteria`).
   */
  names?: Record<string, number>;
}

/** Catalogue collaboratif d'un input, keyé par criteriaId. */
export type CommonTableCatalog = Record<string, CommonTableCatalogEntry>;

/** Catalogues collaboratifs d'un formulaire, keyés par inputKey. */
export type CommonTableCatalogs = Record<string, CommonTableCatalog>;

/**
 * Configuration admin du champ commonTable.
 */
export interface CommonTableConfig {
  showColumns: {
    criteria: boolean;
    happiness: boolean;
    note: boolean;
    yesNo: boolean;
    comment: boolean;
  };
  labels: {
    usage?: string;
    criteria?: string;
    happiness?: string;
    note?: string;
    yesNo?: string;
    comment?: string;
  };
  usages: Array<{
    usageKey: string;
    label: string;
    /** Header de regroupement optionnel (ex: "Administration / Gestion") */
    group?: string;
  }>;
}

/**
 * Valeur stockée pour un champ multiRadio
 * Objet avec la valeur sélectionnée et optionnellement un texte supplémentaire
 */
export interface MultiRadioValue {
  value: string;
  type?: "simple" | "cplx";
  textsup?: string;
}

/**
 * Valeur d'une option sélectionnée dans multiCheckboxPlus
 */
export interface MultiCheckboxPlusSelectedOption {
  value: string;
  type: MultiCheckboxPlusOptionType;
  rank?: number;
  textsup?: string; // Texte supplémentaire saisi (pour type cplx)
}

/**
 * Valeur stockée pour un champ multiCheckboxPlus
 * Array d'objets où la clé est le label de l'option
 */
export type MultiCheckboxPlusValue = Array<Record<string, MultiCheckboxPlusSelectedOption>>;

export interface CoFormParams {
  [fieldKey: string]: {
    list?: string[];
    positionType?: "column" | "row";
    rowMode?: "fixed" | "auto";
    nbPerRow?: string;
    attributeValueRadio?: boolean;
    // Spécifique multiCheckboxPlus
    global?: {
      list?: string[];
      nbAnswersMax?: number;
      rank?: "true" | "false" | boolean;
      addValue?: "true" | "false" | boolean;
      newValuePlaceholder?: string;
      width?: string;
      dependOn?: string;
    };
    /** Type par option: simple (checkbox seul) ou cplx (checkbox + input texte) */
    tofill?: Record<string, MultiCheckboxPlusOptionType>;
    /** Info supplémentaire par option */
    optinfo?: Record<string, string>;
    /** Placeholder du champ texte par option (pour type cplx) */
    placeholdersckb?: Record<string, string>;
    /** Champ texte obligatoire si option cplx cochée */
    mandatoryCplx?: boolean;
    /** Images par option (array d'objets avec docPath) */
    optimage?: Record<string, Array<{ docPath?: string; [key: string]: unknown }> | null>;
    [key: string]: unknown;
  };
}

export interface CoFormData {
  _id: { $id: string };
  id: string;
  name?: string;
  parent?: CoFormParent | null;
  created: number;
  creator: string;
  subForms?: string[] | null;
  updated?: number;
  params?: CoFormParams | null;
  inputs?: Record<string, CoFormSubFormInputs> | null;
  type: string;
  profilBannerUrl?: string;
  profilRealBannerUrl?: string;
  useBannerImg?: boolean;
  /** Informations d'accès enrichies par le serveur */
  access?: CoFormAccessInfo;
  /** Configuration de la page de remerciement (personnalisable par l'admin) */
  thankYou?: CoFormThankYouConfig | null;
  /**
   * Chemins (subFormId.fieldName) des inputs partagés du form. Pour les forms
   * collaboratifs liés à un lieu, contient typiquement le path du finder qui
   * détermine ce lieu (ex: ["step1.finderXYZ"]). Utilisé par la vue
   * `CoFormPlacePage` pour pré-remplir + verrouiller le finder.
   */
  sharedQuestionPath?: string[] | null;
  /**
   * Si `true`, n'importe quel utilisateur connecté peut créer ou modifier la
   * réponse partagée d'un lieu — la membership du lieu n'est pas requise.
   * Côté UX, on bypass le flow "demande à rejoindre" et on ouvre directement
   * le formulaire pré-rempli pour le lieu sélectionné.
   */
  publicCanEditSharedAnswer?: boolean;
  /**
   * Liste d'input keys (kunik) réservés aux admins du lieu lié au form (via
   * sharedQuestionPath). Configuré au niveau form via le wizard legacy.
   * N'est pas utilisé directement côté React pour le rendu — c'est
   * `access.restrictedFields` qui contient le résultat calculé pour l'user
   * courant. Exposé ici principalement pour la persistance/typage et un
   * éventuel debug côté admin.
   */
  placeAdminOnlyFields?: string[];
  /**
   * Liste d'input keys (kunik) réservés aux admins ET membres du lieu lié
   * au form. Cf. `placeAdminOnlyFields`.
   */
  placeMemberOnlyFields?: string[];
}

/**
 * Types pour le mapping des champs CoForm vers react-hook-form
 */
export interface FormFieldMapping {
  name: string; // Nom du champ pour react-hook-form
  label: string;
  type: string; // Type CoForm (text, textarea, tpls.forms.cplx.radioNew, etc.)
  componentType: "text" | "textarea" | "radio" | "checkbox" | "select" | "multiCheckboxPlus" | "multiRadio" | "evaluation" | "commonTable" | "finder" | "simpleTable" | "uploader" | "sectionTitle" | "sectionDescription" | "unknown";
  inputType?: string; // Type HTML pour l'input (url, email, tel, etc.) - utilisé quand componentType est "text"
  placeholder?: string;
  info?: string;
  isRequired: boolean;
  width?: string;
  markdown?: boolean;
  // Pour les champs avec options (radio, checkbox, select)
  options?: string[];
  positionType?: "column" | "row";
  rowMode?: "fixed" | "auto";
  nbPerRow?: string;
  // Spécifique multiCheckboxPlus
  multiCheckboxPlusConfig?: {
    /** Type par option: simple ou cplx */
    tofill: Record<string, MultiCheckboxPlusOptionType>;
    /** Info supplémentaire par option */
    optinfo: Record<string, string>;
    /** Placeholder du champ texte par option */
    placeholdersckb: Record<string, string>;
    /** Nombre max de sélections */
    nbAnswersMax: number;
    /** Classement activé */
    rank: boolean;
    /** Champ texte obligatoire si option cplx cochée (affichage erreur locale) */
    mandatoryCplx: boolean;
    /** Valider les champs cplx requis dans le schema Zod (bloque soumission) */
    validateCplxRequired: boolean;
    /** Ajout dynamique de valeur */
    addValue: boolean;
    /** Placeholder pour l'input d'ajout */
    newValuePlaceholder: string;
    /** Images par option */
    optimage: Record<string, string[]>;
  };
  // Spécifique multiRadio
  multiRadioConfig?: {
    /** Type par option: simple (radio seul) ou cplx (radio + champ texte) */
    tofill: Record<string, "simple" | "cplx">;
    /** Placeholder du champ texte par option (pour type cplx) */
    placeholdersradio: Record<string, string>;
  };
  // Spécifique evaluation
  evaluationConfig?: EvaluationConfig;
  // Spécifique commonTable
  commonTableConfig?: CommonTableConfig;
  // Spécifique finder
  finderConfig?: FinderConfig;
  // Spécifique simpleTable
  simpleTableConfig?: SimpleTableConfig;
  // Spécifique uploader
  uploaderConfig?: UploaderConfig;
  // Spécifique sectionTitle
  sectionTitleConfig?: {
    showBar: boolean;
    barPosition: "above" | "between" | "below";
    align: "left" | "center" | "right";
    textDecoration: "uppercase" | "lowercase" | "capitalize" | "none";
  };
  // Logique conditionnelle
  conditionalDisplay?: ConditionalDisplay;
  /**
   * Si `true`, l'input radio active le mode "évaluation multiple" : la valeur
   * de chaque user est stockée séparément dans `_multiEval.{userId}` au lieu
   * de la place classique. Permet à plusieurs users de contribuer à la même
   * réponse partagée et d'agréger les évaluations dans un radar chart.
   * Cf. legacy `radioNew.php` + `Form.php:hasMultiEval`.
   */
  activeMultieval?: boolean;
  /**
   * Label de l'axe radar pour les inputs multi-eval (ex: "A", "B"). Utilisé
   * comme tick du radar chart à la place du label brut de l'input pour rester
   * compact. Si vide, on fallback sur le label de l'input.
   */
  evaluationKey?: string;
}

/**
 * Une entrée stockée dans `answers.{stepKey}.{inputKey}_multiEval.{userId}`
 * pour le mode évaluation multiple.
 *
 * Format étendu (stratégie expand → migrate → contract) :
 * - `value` : canonical (nouveau, robuste au reorder d'options).
 * - `date` : timestamp d'évaluation (ISO string en pratique).
 * - `answer` : legacy "{idx}_{slug}" — gardé pour la rétro-compat des readers
 *   non encore migrés (radar legacy, etc.).
 *
 * En lecture, on préfère `value` ; à défaut on parse `answer`.
 */
export interface MultiEvalEntry {
  value?: string;
  date?: string | number;
  answer?: string;
}

/** Un axe du radar (= un input multi-eval d'une step donnée). */
export interface MultiEvalAxis {
  /** Clé de l'input (sans préfixe `radioNew`). */
  key: string;
  /** Label affiché sur le tick radar (`evaluationKey` si défini). */
  label: string;
  /** Options du radio dans leur ordre actuel — pour mapper les valeurs 1..N en labels. */
  options: string[];
}

/** Un dataset = la contribution d'un user à un step (1 dataset = 1 user). */
export interface MultiEvalDataset {
  userId: string;
  userName: string;
  userSlug: string;
  /** Unix timestamp de la dernière modification de cet user pour cette step. */
  evaluatedAt: number | null;
  /** Map { inputKey: index 1..N } — manquant pour les axes que ce user n'a pas évalués. */
  values: Record<string, number>;
}

/** Une step (sous-formulaire) avec ses axes et ses contributeurs. */
export interface MultiEvalStep {
  stepKey: string;
  stepName: string;
  axes: MultiEvalAxis[];
  datasets: MultiEvalDataset[];
}

/** Réponse de `GET_COFORM_MULTIEVAL_DATA`. */
export interface MultiEvalDataResponse {
  steps: MultiEvalStep[];
}

export interface SubFormFields {
  subFormId: string;
  subFormName: string;
  fields: FormFieldMapping[];
}

/**
 * Types pour les modes de soumission
 */
export type SubmitMode = "step" | "final" | "both";
export type CoFormVariant = "default" | "wizard" | "stepper" | "tabs";

/**
 * Type générique pour les valeurs de champs de formulaire
 */
export type FormFieldValue =
  | string
  | number
  | boolean
  | string[]
  | MultiCheckboxPlusValue
  | EvaluationValue
  | CommonTableValue
  | FinderValue
  | SimpleTableValue
  | UploaderValue
  | UploaderLegacyValue
  | null
  | undefined;

/**
 * Type pour les options ajoutées dynamiquement (par champ)
 */
export type AddedOptionsMap = Record<string, string[]>;

/**
 * Type pour les données d'un sous-formulaire
 */
export type SubFormData = Record<string, FormFieldValue>;

/**
 * Type pour les données d'un sous-formulaire avec métadonnées
 */
export interface SubFormDataWithMeta {
  data: SubFormData;
  /** Options ajoutées dynamiquement par les champs multiCheckboxPlus */
  _addedOptions?: AddedOptionsMap;
}

/**
 * Type pour les données de tous les sous-formulaires
 */
export type AllStepsData = Record<string, SubFormData>;

/**
 * Données d'une réponse CoForm retournée par l'API (findanswered)
 */
export interface CoFormAnswer {
  _id?: { $id: string } | string;
  /** Réponses groupées par sous-formulaire */
  answers: AllStepsData;
  /** ID du formulaire parent */
  form?: string;
  /** ID de l'utilisateur qui a répondu */
  user?: string | { _id?: string; name?: string; profilMediumImageUrl?: string };
  /** Timestamp de création */
  created?: number;
  /** Timestamp de dernière mise à jour */
  updated?: number;
  /** Brouillon ? */
  draft?: boolean;
  /** Terminé ? */
  finished?: boolean;
  /** Documents joints */
  documents?: unknown[];
  /** Commentaires */
  comments?: unknown[];
  /** L'utilisateur courant peut-il éditer cette réponse ? (calculé côté serveur) */
  canEdit?: boolean;
  /** Raison du refus d'édition (not_logged_in, not_owner, form_inactive, form_closed) */
  editDeniedReason?: string | null;
}

// ============================================================================
// Types pour le champ Finder (recherche d'éléments)
// ============================================================================

/**
 * Types d'éléments recherchables via le Finder
 */
export type FinderElementType =
  | "organizations"
  | "citoyens"
  | "events"
  | "projects"
  | "news"
  | "cities"
  | "things"
  | "poi"
  | "classified"
  | "products"
  | "services"
  | "surveys"
  | "bookmarks"
  | "proposals"
  | "rooms"
  | "actions"
  | "networks"
  | "urls"
  | "circuits"
  | "risks"
  | "badges";

/**
 * Filtre de recherche pour le Finder
 */
export interface FinderFilter {
  attributeName: string;
  valueName: string;
}

/**
 * Configuration de la liaison avec d'autres liens
 */
export interface FinderAddToLinks {
  value: boolean;
  links: string;
}

/**
 * Configuration du champ Finder
 */
export interface FinderConfig {
  /** Type d'élément à rechercher (organizations, citoyens, etc.) */
  type: FinderElementType;
  /** Filtres appliqués à la recherche */
  filters: FinderFilter[];
  /** Recherche globale (true) ou sourcée (false) */
  notSourceKey: boolean;
  /** Chercher parmi mes contacts */
  myContacts: boolean;
  /** Initialiser avec l'utilisateur connecté */
  initCurrentUser: boolean;
  /** Label de l'élément recherché (ex: "Organisation", "Tiers-lieu") */
  elementLabel: string;
  /** Texte du bouton de recherche */
  buttonLabel: string;
  /** Placeholder du champ de recherche */
  placeholderSearchField: string;
  /** Nom du champ (pour identifier les éléments sélectionnés) */
  field: string;
  /** Permettre la sélection multiple */
  multiple: boolean;
  /** Permettre l'ajout de nouveaux éléments */
  addNew: boolean;
  /** Permettre l'invitation par email si non trouvé */
  invite: boolean;
  /** Créer un lien entre l'élément et la réponse */
  linkToAnswer: boolean;
  /** Une seule réponse par élément (bloque si déjà existant) */
  singleAnswerPerElement: boolean;
  /** Message si réponse existante */
  msgSingleAnswerPerElement: string;
  /** Redirection après message d'alerte */
  redirectSingleAnswerPerElement: "Accueil" | "Page précédente" | "Réponse existante";
  /** Permettre l'édition de l'élément sélectionné */
  editElement: boolean;
  /** Ajouter à des liens spécifiques */
  addToLinks: FinderAddToLinks;
}

/**
 * Un élément sélectionné/trouvé par le Finder
 */
export interface FinderElement {
  /** ID unique de l'élément (MongoDB ID) */
  id: string;
  /** Nom de l'élément */
  name: string;
  /** Type de l'élément */
  type: FinderElementType;
  /** Chemin relatif de l'image de profil */
  img?: string;
  /** Adresse de l'élément (optionnel) */
  address?: {
    streetAddress?: string;
    postalCode?: string;
    addressLocality?: string;
  };
}

/**
 * Valeur stockée pour un champ Finder
 * Mode single: { [elementId]: FinderElement } (un seul élément)
 * Mode multiple: { [elementId]: FinderElement } (plusieurs éléments)
 */
export type FinderValue = Record<string, FinderElement> | null;

/**
 * Types pour le champ SimpleTable (tableau 2D)
 */
export type SimpleTableColumnType = "Text" | "Case à cocher" | "Nombre" | "Image" | "Images";

export interface SimpleTableColumn {
  label: string;
  type: SimpleTableColumnType;
}

export interface SimpleTableRow {
  label: string;
}

export interface SimpleTableConfig {
  tableName: string;
  columns: SimpleTableColumn[];
  rows: SimpleTableRow[];
  activeNewLine: boolean;
  singleAnswerByLine: boolean;
}

/**
 * Image en attente d'upload (avant sauvegarde côté serveur).
 */
export interface ImageUploadValue {
  /** Nom original du fichier, préservé pour nommer le fichier sur le serveur */
  name: string;
  /** Data URI base64 (utilisé pour la prévisualisation locale) */
  data: string;
}

/**
 * Fichier déjà uploadé et enregistré en base (collection documents).
 */
export interface ExistingUploadFile {
  /** ID MongoDB du document dans la collection 'documents' */
  docId: string;
  /** Chemin relatif vers le fichier (ex: /upload/.../file.jpg) */
  docPath: string;
  /** Nom du fichier */
  name?: string;
}

/**
 * Configuration du champ uploader (subset utile pour site-json)
 */
export interface UploaderConfig {
  docType: "image" | "file";
  itemLimit: number;
  sizeLimit: number;
  formats?: string[];
  displayMode?: "simple" | "advanced";
}

/**
 * Valeur stockée pour un champ uploader
 */
export type UploaderValue = Array<string | ImageUploadValue | ExistingUploadFile>;

/**
 * Format legacy d'un champ uploader (ancien système).
 */
export interface UploaderLegacyValue {
  updateDate: string[];
  /** En DB: objet { docId: docPath }. Pendant l'édition: tableau mixte (string | ImageUploadValue | ExistingUploadFile). */
  files?: Array<string | ImageUploadValue | ExistingUploadFile> | Record<string, string>;
}

/** Valeur d'une cellule : URL déjà enregistrée (string) ou image en attente (ImageUploadValue) */
export type SimpleTableCell = string | ImageUploadValue;

/**
 * Valeur stockée pour un champ SimpleTable
 * Tableau 2D : row 0 = headers, row 1+ = données
 * Chaque cellule est un SimpleTableCell (ou SimpleTableCell[] pour Images)
 */
export type SimpleTableValue = (SimpleTableCell | SimpleTableCell[])[][];

/**
 * Résultat de recherche du Finder (depuis l'API globalautocomplete)
 */
export interface FinderSearchResult {
  id: string;
  name: string;
  type: string;
  collection?: string;
  profilThumbImageUrl?: string;
  email?: string;
  address?: {
    streetAddress?: string;
    postalCode?: string;
    addressLocality?: string;
  };
}
