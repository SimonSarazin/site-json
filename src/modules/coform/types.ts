/**
 * Types pour les données CoForm
 * Basés sur la structure retournée par l'API GET_COFORM_BY_ID
 *
 * TODO (Round 3 — migration types vers @communecter/cocolight-api-client) :
 *  - CoFormData                → FormItemNormalized (drop cast dans useCoFormQuery)
 *  - CoFormAnswer              → AnswerItemNormalized
 *  - CoFormAccessInfo          → FormAccess
 *  - CoFormParent              → ParentsMap
 *  - CoFormAccessReason        → AnswerEditDeniedReason-like (vérifier compat)
 *  - AllStepsData              → AllStepsData (re-export depuis lib)
 *
 * Les types très spécifiques (EvaluationConfig, FinderConfig, MultiCheckboxPlusValue,
 * UploaderConfig, etc.) restent ici — ils ne dupliquent rien de la lib.
 *
 * Voir MIGRATION_COFORM.md Module 6.
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
 * Méta d'une réponse existante (créateur, dernier modifieur, timestamps).
 * Hydratés par `useCoFormQuery` quand on charge une réponse, propagés ensuite
 * via `CoFormProvider` pour affichage par `AnswerActivityDialog` ou pour la
 * détection de conflit dans `useCoFormDraft` (`baseUpdatedAt`).
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
   * Méta de la réponse existante (créateur, dernier modifieur, timestamps).
   * Peuplé côté serveur par `Coform::buildExistingAnswerMeta`, exposé pour
   * affichage via `AnswerActivityDialog` et détection de conflit de draft.
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
   * Liste des champs restreints calculée par le backend en mode élément
   * (`Coform::getFormAccessInfo` avec elementId+elementType). Résultat du
   * croisement entre `placeAdminOnlyFields` / `placeMemberOnlyFields` côté
   * Form et le rôle de l'user sur le lieu. Vide ou absent en flow user-personal.
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
  /**
   * Position d'affichage **par formulaire parent**, `positions[<formId>]`.
   *
   * Un même document d'étape sert parfois plusieurs formulaires (766 inputs du
   * parc portent une position pour au moins deux parents), d'où la map. Elle
   * fait AUTORITÉ sur `position`, qui n'est alors souvent même pas écrite :
   * mesuré sur l'étape 2 d'« Appel à commun des tiers lieux », 15 inputs sur 17
   * n'ont que `positions`. Les lire comme des zéros regroupait les titres de
   * section en tête au lieu de les intercaler. Cf. `resolveInputOrder`.
   */
  positions?: Record<string, string>;
  type: string;
  isRequired?: boolean;
  activeComments?: boolean;
  width?: string;
  /**
   * Éditeur markdown sur un textarea. ACTIF PAR DÉFAUT : seul un `false`
   * explicite le désactive (cf. `parseCoFormFields`).
   *
   * Typé `boolean | string` parce que le parc stocke volontiers ses booléens en
   * chaînes (`activateLocalCriteria` vaut `"true"` sur des formulaires réels) ;
   * un `"false"` écrit demain doit désactiver, pas activer.
   */
  enableMarkdown?: boolean | string;
  /**
   * L'input n'est pas rendu dans le formulaire. Statique (indépendant de
   * l'utilisateur), contrairement à `isAdminOnly`. Sert à sortir du parcours
   * de dépôt la partie *instruction* d'un dossier — 42 inputs du parc, dont
   * les 19 champs de suivi de `fondationTerritorialeDesLumieres` et le
   * `decide` (multiDecide) des étapes de jury AAP.
   *
   * La valeur déjà saisie n'est pas perdue pour autant : le champ absent du
   * payload, `SaveAnswerAction` fusionne clé par clé et conserve l'existant.
   */
  hideInForm?: boolean | string;
  /**
   * L'input est **masqué à l'affichage** pour qui n'est pas admin du contexte,
   * et son écriture est refusée côté serveur (`SaveAnswerAction` strippe la
   * clé du payload). Ce n'est PAS de la confidentialité : la valeur déjà
   * enregistrée continue de transiter dans le payload de la réponse, comme
   * pour les listes place-level et comme dans le legacy.
   *
   * Contrairement à `hideInForm`, la décision dépend de l'utilisateur : elle
   * est prise côté serveur (`Coform::computeAdminOnlyFields`) et arrive au
   * client fondue dans `access.restrictedFields`. Présent ici pour documenter
   * le champ tel qu'il est stocké — React ne le lit pas lui-même.
   */
  isAdminOnly?: boolean | string;
  conditionalDisplay?: ConditionalDisplay;
  [key: string]: unknown;
}

export interface CoFormSubFormInputs {
  name: string;
  info?: string;
  id: string;
  formParent: string;
  hasMultiEval?: boolean;
  /**
   * Étape masquée — case « Cacher etape » du wizard de config AAP. L'étape
   * disparaît du parcours ET du sommaire, en réponse comme en lecture, **pour
   * tout le monde**.
   *
   * Écart assumé avec le legacy, qui exempte l'admin de la réponse
   * (`Formv2::getParamsWizard`) : arbitrage user du 25/08 — une étape cochée
   * « cachée » l'est pour tous, c'est plus simple à expliquer et à vérifier.
   * Le legacy ne masque en outre que si une réponse existe déjà ; ici la règle
   * vaut aussi à la création, sans quoi l'étape apparaîtrait puis
   * disparaîtrait au premier enregistrement.
   *
   * Le drapeau vit dans le doc `aapConfig` (`subForms.<step>.hideStep`) et
   * n'atteint le client que parce que `Coform::getCompleteFormData` le recopie
   * — **uniquement dans la branche `aap`/`templatechild`**. Sur un formulaire
   * non-aap, la projection ne le remonte pas et le drapeau reste inopérant ;
   * c'est sans conséquence aujourd'hui (0 occurrence hors `aapConfig` en base)
   * mais ce serait le point à étendre le jour où un form générique en aurait
   * besoin.
   *
   * Typé `boolean | string` par prudence, comme `hideInForm` : le backend
   * normalise bien en booléen, mais le parse lit via `isTruthyFlag` et rien
   * n'empêche une écriture directe en base de poser une chaîne.
   *
   * Une lecture STRUCTURELLE (où se trouve tel champ, par opposition à quoi
   * afficher) doit passer `includeHiddenSteps` à `parseCoFormFields` —
   * cf. `getSharedFinderInfo`.
   */
  hideStep?: boolean | string;
  /**
   * Case « Cacher etape sur le standalone ». **Volontairement non appliqué** :
   * le `standAlone` du legacy désigne la page de réponse dédiée
   * (`survey/views/tpls/forms/standalone/`), qui n'a pas d'équivalent ici. Le
   * mode « standalone » de site-json est autre chose — une étape que la config
   * du site demande explicitement par `stepKey` ; y appliquer ce drapeau
   * viderait une page qu'on vient tout juste de réclamer. Exposé pour que la
   * donnée soit disponible le jour où un mode équivalent existera.
   */
  hideStepStandalone?: boolean | string;
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
  /**
   * Métadonnées posées par le backend au save : indiquent qui a contribué
   * cette entrée et depuis quelle réponse. Préservés à travers les saves
   * suivants pour ne pas écraser les entrées d'autres users (cas d'une
   * réponse partagée éditée par plusieurs personnes).
   */
  me?: boolean;
  userId?: string;
  fromAnswerId?: string;
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

// ============================================================================
// categorizedCheckbox — cases à cocher à deux niveaux
// ============================================================================

/**
 * Valeur d'un champ `categorizedCheckbox` — forme legacy conservée telle quelle.
 * `list` porte les catégories cochées, `sublist` les sous-options cochées par catégorie.
 * Les identifiants sont des clés `<index>_<slug>` (cf. `utils/slugify.ts`).
 */
export interface CategorizedCheckboxValue {
  list: string[];
  sublist: Record<string /* clé de catégorie */, string[]>;
}

/** D'où proviennent les options : liste saisie à la main, questions commonTable distantes, ou les deux. */
export type CategorizedCheckboxSource = "manual" | "distanceOnly" | "both";

/**
 * Config admin lue dans `params.categorizedCheckbox{fieldKey}` (réglée côté legacy — cf. le
 * précédent `simpleTable` : la config reste PHP, seul le rendu passe en React).
 */
export interface CategorizedCheckboxConfig {
  /** Défaut serveur `"both"` quand la clé est absente (cf. `categorizedCheckbox.php:17`). */
  dataSourceToUse: CategorizedCheckboxSource;
  /** Catégories saisies à la main, dans l'ordre — l'index EST une partie de la clé persistée. */
  list: string[];
  /** Sous-options manuelles, par clé de catégorie. */
  sublist: Record<string, string[]>;
  /** Formulaires sources (finder legacy) : seules les CLÉS (ids) nous intéressent. */
  formParamsSource: string[];
  /** Questions sources, au format `<formId>-<stepId>-<inputKey>`. */
  questionsParamsSource: string[];
}

/** Une sous-option (niveau 2) de l'arbre rendu. */
export interface CategorizedCheckboxChild {
  /** Clé persistée `<index>_<slug>`, index pris AVANT déduplication. */
  key: string;
  label: string;
  /** Nombre de répondants ayant renseigné cet usage (source commonTable seulement). */
  count?: number;
}

/** Une catégorie (niveau 1) de l'arbre rendu. */
export interface CategorizedCheckboxOption {
  key: string;
  label: string;
  children: CategorizedCheckboxChild[];
  /** `true` si la catégorie vient d'une question commonTable distante. */
  fromSource: boolean;
}

/**
 * Entrée du catalogue collaboratif d'un input commonTable.
 * Représente une criteria (solution) déclarée par n'importe quel répondant
 * pour un usage donné — agrégée côté serveur depuis tous les
 * `answers.criterias{key}`.
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

/**
 * Configuration d'un champ (sous-objet de `params[fieldKey]`).
 *
 * Couvre les patterns concrets utilisés par le backend Cocolight :
 * - multiCheckboxPlus / multiRadio : list, tofill, optinfo, placeholders, optimage
 * - finder    : filter (filtres `attributeName/valueName`)
 * - simpleTable : columns, rows, tableName, activeNewLine, singleAnswerByLine
 * - sectionTitle : showBar, barPosition, align, textDecoration
 * - uploader  : itemLimit, sizeLimit, fileType, displayMode
 *
 * Pour les clés non explicites, l'index signature `unknown` permet l'accès
 * sans cast — le call-site doit alors faire son narrow.
 */
export interface CoFormFieldConfig {
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
  /** Type par option : simple (checkbox seul) ou cplx (checkbox + input texte) */
  tofill?: Record<string, MultiCheckboxPlusOptionType>;
  /** Info supplémentaire par option */
  optinfo?: Record<string, string>;
  /** Placeholder radio (multiRadio) */
  placeholdersradio?: Record<string, string>;
  /** Placeholder du champ texte par option (pour type cplx) */
  placeholdersckb?: Record<string, string>;
  /** Champ texte obligatoire si option cplx cochée */
  mandatoryCplx?: boolean;
  /** Images par option (array d'objets avec docPath) */
  optimage?: Record<string, Array<{ docPath?: string; [key: string]: unknown }> | null>;
  // ─── Finder ─────────────────────────────────────────────────────────────
  /** Filtres backend d'inclusion (id de filtre → `{attributeName, valueName}`) */
  filter?: Record<string, { attributeName?: string; valueName?: string }>;
  /** Filtres backend d'exclusion (`$nin`) — même shape que `filter` */
  filterExclude?: Record<string, { attributeName?: string; valueName?: string }>;
  // ─── SimpleTable ────────────────────────────────────────────────────────
  /** Colonnes : array OU object keyé par id de colonne */
  columns?:
    | Array<{ label?: string; type?: string }>
    | Record<string, { label?: string; type?: string }>;
  /** Rows : array OU object keyé par id de ligne */
  rows?: Array<{ label?: string }> | Record<string, { label?: string }>;
  tableName?: string;
  activeNewLine?: boolean | string;
  singleAnswerByLine?: boolean | string;
  /** Édition en modal : la ligne devient cliquable → formulaire en modal (CRUD complet), plus d'édition directe dans le tableau. */
  editInModal?: boolean | string;
  // ─── SectionTitle ──────────────────────────────────────────────────────
  showBar?: boolean | string;
  barPosition?: string;
  align?: string;
  textDecoration?: string;
  // ─── Uploader ──────────────────────────────────────────────────────────
  itemLimit?: number | string;
  sizeLimit?: number | string;
  fileType?: string | string[];
  displayMode?: string;
  [key: string]: unknown;
}

/**
 * `formData.params` côté backend Cocolight — sac de paramètres très libre.
 *
 * **2 patterns mixés** dans le même objet :
 *  1. **Sous-config par fieldKey** : `params["finderXXX"]`, `params["simpleTableXXX"]`,
 *     `params["uploaderXXX"]`, etc. → objet de type `CoFormFieldConfig`
 *  2. **Valeurs à la racine avec suffixe fieldKey** (pattern evaluation) :
 *     `params["categoriesXXX"]`, `params["criteriasXXX"]`, `params["criteriaLabelXXX"]`,
 *     `params["categoryNumberXXX"]`, `params["voteTypeXXX"]`, etc. → valeurs scalaires
 *     ou records typés par le call-site
 *
 * Le type valeur est `CoFormFieldConfig` (l'index signature `[k: string]: unknown`
 * de `CoFormFieldConfig` couvre les patterns racine via cast côté call-site).
 */
export interface CoFormParams {
  [key: string]: CoFormFieldConfig;
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
  /**
   * Configuration portée par le formulaire PARENT. `multiDecide` y désigne le
   * type d'input de décision réellement rendu à la place du placeholder
   * `tpls.forms.ocecoform.multiDecide` — cf. `resolveMultiDecide`.
   */
  inputConfig?: { multiDecide?: string } & Record<string, unknown>;
  /**
   * Critères de l'input `tpls.forms.aap.evaluation`, portés par le formulaire
   * PARENT. Le legacy les fait primer sur ceux du document de configuration
   * partagé quand `activateLocalCriteria` est vrai — ce qui est le cas de 125
   * des 126 formulaires configurés. Cf. `utils/aapEvaluation.ts`.
   */
  evaluationCriteria?: {
    type?: unknown;
    criterions?: unknown;
    activateLocalCriteria?: unknown;
    whoCanEvaluate?: unknown;
  } | null;
  type: string;
  profilBannerUrl?: string;
  profilRealBannerUrl?: string;
  useBannerImg?: boolean;
  /** Informations d'accès enrichies par le serveur */
  access?: CoFormAccessInfo;
  /**
   * Forms publics : autorise tout user (même non membre) à éditer la réponse
   * partagée d'un lieu. Bypass le flow "demande à rejoindre" dans PlacesListView.
   */
  publicCanEditSharedAnswer?: boolean;
  /**
   * Champs réservés aux admins du lieu/projet. Croisés côté serveur avec le
   * rôle de l'user (`Coform::getFormAccessInfo`) pour produire
   * `access.restrictedFields`.
   */
  placeAdminOnlyFields?: string[];
  /** Champs réservés aux membres du lieu/projet. Cf. `placeAdminOnlyFields`. */
  placeMemberOnlyFields?: string[];
  /** Configuration de la page de remerciement (personnalisable par l'admin) */
  thankYou?: CoFormThankYouConfig | null;
  /**
   * Chemins `{subFormId}.{fieldName}` des questions partagées (mode collaboratif
   * "par lieu"). Si un de ces chemins pointe vers un input finder, c'est ce
   * finder qui détermine le lieu / l'entité ciblée pour la réponse partagée.
   * Voir `getSharedFinderInfo` (utils/formParser).
   */
  sharedQuestionPath?: string[] | null;
}

/**
 * Valeur d'un champ `tags` — liste plate de libellés libres.
 *
 * Le legacy écrit `$("#key").val().split(",")`, donc toujours un tableau de
 * chaînes ; vérifié sur les réponses réelles du formulaire CAE
 * (`["open source"]`, `["peertube"]`).
 */
export type TagsValue = string[];

/**
 * Config d'un champ `tags`, dérivée de `form.params.<inputKey>`.
 */
export interface TagsConfig {
  /**
   * Vocabulaire partagé du formulaire (`params.<inputKey>.list`) : les tags
   * déjà saisis par d'autres répondants, proposés en autocomplétion. Vide
   * quand le formulaire n'en a pas encore accumulé.
   */
  list: string[];
}

/**
 * Types pour le mapping des champs CoForm vers react-hook-form
 */
export interface FormFieldMapping {
  name: string; // Nom du champ pour react-hook-form
  label: string;
  type: string; // Type CoForm (text, textarea, tpls.forms.cplx.radioNew, etc.)
  componentType: "text" | "textarea" | "radio" | "checkbox" | "select" | "multiCheckboxPlus" | "multiRadio" | "evaluation" | "commonTable" | "categorizedCheckbox" | "finder" | "simpleTable" | "uploader" | "timeSlots" | "dynamicFields" | "location" | "sectionTitle" | "sectionDescription" | "milestoneList" | "titleSeparator" | "tags" | "selection" | "pourContre" | "aapEvaluation" | "chooseProposal" | "unknown";
  inputType?: string; // Type HTML pour l'input (url, email, tel, etc.) - utilisé quand componentType est "text"
  placeholder?: string;
  info?: string;
  isRequired: boolean;
  width?: string;
  markdown?: boolean;
  // Pour les champs avec options (radio, checkbox, select)
  options?: string[];
  /**
   * Libellés d'affichage par valeur, pour le `select` à options associatives
   * legacy (`{cle: "Label"}` dans `params[fieldKey].options`). `options`
   * porte alors les CLÉS (la valeur réellement stockée), `optionLabels` la
   * correspondance clé→label affiché. Absent pour les `select` à liste plate
   * (value === label) et pour radio/checkbox.
   */
  optionLabels?: Record<string, string>;
  /**
   * `select` recherchable (combobox) — port du flag legacy `enableSelect2`
   * (`params[fieldKey].enableSelect2`). `true` → champ de recherche dans la
   * liste ; absent/false → liste déroulante simple.
   */
  searchable?: boolean;
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
  // Spécifique finder
  finderConfig?: FinderConfig;
  // Spécifique simpleTable
  simpleTableConfig?: SimpleTableConfig;
  // Spécifique uploader
  uploaderConfig?: UploaderConfig;
  // Spécifique timeSlots
  timeSlotsConfig?: TimeSlotsConfig;
  // Spécifique dynamicFields
  dynamicFieldsConfig?: DynamicFieldsConfig;
  // Spécifique sectionTitle
  sectionTitleConfig?: {
    showBar: boolean;
    barPosition: "above" | "between" | "below";
    align: "left" | "center" | "right";
    textDecoration: "uppercase" | "lowercase" | "capitalize" | "none";
  };
  // Logique conditionnelle
  conditionalDisplay?: ConditionalDisplay;
  // Spécifique commonTable
  commonTableConfig?: CommonTableConfig;
  // Spécifique categorizedCheckbox
  categorizedCheckboxConfig?: CategorizedCheckboxConfig;
  /**
   * Spécifique `tags` (`tpls.forms.tags`) — vocabulaire partagé du formulaire.
   *
   * Le legacy accumule dans `form.params.<inputKey>.list` chaque tag saisi par
   * un répondant, et s'en sert comme source d'autocomplétion pour les suivants.
   * Comme `params` est déjà chargé avec le formulaire, la liste arrive
   * gratuitement — aucune requête n'est nécessaire pour suggérer.
   *
   * Mesuré (2026-08-19) : peuplée sur 40 des 124 inputs `tags` du parc,
   * médiane 83 entrées, max 166. Vide ailleurs → repli sur l'index global
   * (`api.searchTags`), qui est la branche non-aap du legacy.
   */
  tagsConfig?: TagsConfig;
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

// ============================================================================
// Types pour timeSlots (tpls.forms.cplx.timeSlots) — créneaux jour + horaires
// ============================================================================

/**
 * Un créneau horaire — format de SAUVEGARDE legacy (`timeSlots.php`), vérifié
 * sur les answers réelles SSBE : jour anglais Capitalisé ("Monday"), heures et
 * minutes en strings zéro-paddées. `startAmPm`/`endAmPm` n'existent que dans
 * les données legacy saisies en mode 12h — lues puis résolues en 24h à
 * l'édition (cf. `utils/timeSlots.ts`), jamais ré-écrites.
 */
export interface TimeSlotValue {
  day: string;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  startAmPm?: string;
  endAmPm?: string;
}

/** Config du champ (params legacy `timeSlots{fieldKey}`), valeurs numériques déjà coercées. */
export interface TimeSlotsConfig {
  /** Autorise plusieurs créneaux (défaut legacy : true). */
  enableMultipleSlots?: boolean;
  /** Format d'AFFICHAGE legacy — la sauvegarde reste en 24h. */
  timeFormat?: "24h" | "12h";
  /** Pas des minutes (5/15/30/60) → attribut `step` des inputs time. */
  minuteStep?: number;
  /** "HH:MM" pré-rempli à l'ajout d'un créneau. */
  defaultStartTime?: string;
  /** "HH:MM" pré-rempli à l'ajout d'un créneau. */
  defaultEndTime?: string;
}

// ============================================================================
// Types pour dynamicFields (tpls.forms.cplx.dynamicFields) — répéteur de lignes
// ============================================================================

/** Un sous-champ d'une ligne (config legacy `fieldsConfig[]`). */
export interface DynamicFieldsSubField {
  key: string;
  label: string;
  placeholder?: string;
  /** Types HTML natifs supportés par le legacy (text, email, tel, number, url, password, date, time, datetime-local) + select/textarea. */
  type: string;
  required?: boolean;
  validation?: { minLength?: number; maxLength?: number };
  /** Options du `select` (clé stockée → label affiché). */
  options?: Record<string, string>;
}

/** Une ligne saisie = { cléSousChamp: valeur } — format de sauvegarde legacy vérifié (`[{postalCode, placeName}]`). */
export type DynamicFieldsRow = Record<string, string>;

/** Config du champ (params legacy `dynamicFields{fieldKey}`), valeurs numériques déjà coercées. */
export interface DynamicFieldsConfig {
  enableMultipleRows?: boolean;
  minRows?: number;
  maxRows?: number;
  fieldsConfig: DynamicFieldsSubField[];
  layout?: { fieldsPerRow?: number; showLabels?: boolean; showPlaceholders?: boolean };
  ui?: { addButtonText?: string; removeButtonText?: string };
}

// ============================================================================
// Types pour la multi-évaluation (datasets radar agrégés cross-contributeurs)
// ============================================================================

/**
 * Entrée de la matrice multi-eval côté MongoDB : `multieval.{userId}.{inputKey}`.
 *
 * Le backend stocke le `value` (= index 1..N de l'option choisie) et parfois
 * un `answer` (= libellé sérialisé pour rétro-compat lecture des dumps legacy
 * non encore migrés (radar legacy, etc.).
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
  | FinderValue
  | SimpleTableValue
  | UploaderValue
  | UploaderLegacyValue
  | TimeSlotValue[]
  | DynamicFieldsRow[]
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
 * Fichier de la collection `documents`, tel que renvoyé (map keyée par `_id`) dans
 * `answer.documents`. `subKey` porte le chemin `<subFormId>.<field.name>` du champ
 * uploader qui l'a créé — c'est le seul moyen fiable de rattacher un document à
 * SON champ (plusieurs uploaders peuvent coexister dans la même réponse).
 */
export interface AnswerDocumentFile {
  id?: string;
  name: string;
  /** Chemin relatif sous `/upload/<moduleId>/` (ex: `answers/<formId>/restricted`) */
  folder: string;
  moduleId?: string;
  subKey?: string;
  doctype?: string;
  size?: number;
  [key: string]: unknown;
}

/**
 * Données d'une réponse CoForm retournée par l'API (findanswered)
 */
export interface CoFormAnswer {
  _id?: { $id: string } | string;
  /** Réponses groupées par sous-formulaire */
  answers: AllStepsData;
  /** ID du formulaire parent */
  form?: string;
  /**
   * ID BRUT du déposant, posé par `FindAnsweredByIdAction` avant tout
   * remaniement. C'est la seule source fiable pour « qui a déposé ce commun » :
   * cf. l'avertissement sur `user` juste en dessous.
   */
  userId?: string;
  /**
   * ⚠️ PAS l'id du déposant en général. Le backend ÉCRASE ce champ par l'entité
   * résolue pour l'affichage, en prenant d'abord `links.organizations`, puis
   * `links.answered[0]` (`FindAnsweredByIdAction`). Sur une réponse portée par
   * une organisation, on y trouve donc l'ORGANISATION, pas la personne.
   * Pour une comparaison d'auteur, lire `userId`.
   */
  user?: string | { _id?: string; name?: string; profilMediumImageUrl?: string };
  /** Timestamp de création */
  created?: number;
  /** Timestamp de dernière mise à jour */
  updated?: number;
  /** Brouillon ? */
  draft?: boolean;
  /** Terminé ? */
  finished?: boolean;
  /** Documents joints — Mongo rend indifféremment une map keyée `_id` ou un tableau */
  documents?: Record<string, AnswerDocumentFile> | AnswerDocumentFile[];
  /** Commentaires */
  comments?: unknown[];
  /** L'utilisateur courant peut-il éditer cette réponse ? (calculé côté serveur) */
  canEdit?: boolean;
  /** Raison du refus d'édition (not_logged_in, not_owner, form_inactive, form_closed) */
  editDeniedReason?: string | null;
  vote?: VotesRecord;
  links?: LinksRecord;
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
  /** Filtres d'inclusion appliqués à la recherche */
  filters: FinderFilter[];
  /** Filtres d'exclusion (`$nin`) — ex: exclure les orgs taguées `RéseauTiersLieux` */
  excludeFilters?: FinderFilter[];
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
  /**
   * Si `true` : le tableau passe en lecture seule et chaque ligne s'édite dans
   * un formulaire modal (CRUD complet — ajout/édition/suppression dans le modal,
   * indépendamment de `activeNewLine`). Plus aucune édition directe dans le tableau.
   */
  editInModal: boolean;
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
  /**
   * Traçage TRANSITOIRE des docId réels retirés à l'édition. Seule source pour
   * supprimer un legacy non-en-map (snapshot de réconciliation aveugle). Lu puis
   * STRIPé au save — jamais persisté.
   */
  deletedDocIds?: string[];
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

type VoteStatus = 'love' | 'like' | 'dislike';

interface VoteDetail {
  status: VoteStatus;
  date: Date;
}

type VotesRecord = Record<string, VoteDetail>;

interface MetaDetails {
  [key: string]: any;
}

interface LinksRecord {
  answered: string[];
  canEdit: Record<string, MetaDetails>;
  contributors: Record<string, MetaDetails>;
  organizations: Record<string, MetaDetails>;
  tls: Record<string, MetaDetails>;
}
