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
  | "form_not_started"
  | "form_closed"
  | "form_inactive"
  | "not_logged_in"
  | "form_not_found"
  | null;

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
}

/**
 * Types pour le mapping des champs CoForm vers react-hook-form
 */
export interface FormFieldMapping {
  name: string; // Nom du champ pour react-hook-form
  label: string;
  type: string; // Type CoForm (text, textarea, tpls.forms.cplx.radioNew, etc.)
  componentType: "text" | "textarea" | "radio" | "checkbox" | "select" | "multiCheckboxPlus" | "evaluation" | "finder";
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
  // Spécifique evaluation
  evaluationConfig?: EvaluationConfig;
  // Spécifique finder
  finderConfig?: FinderConfig;
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
  | FinderValue
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

  // Champs supplémentaires selon le type d'élément
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
