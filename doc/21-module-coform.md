[← Retour à l'index](README.md)

# Module CoForm

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Routes](#routes)
- [Composants principaux](#composants-principaux)
  - [SmartCoForm](#smartcoform)
  - [DynamicCoForm](#dynamiccoform)
  - [MultiStepCoForm](#multistepcoform)
  - [CoFormModal](#coformmodal)
  - [CoFormAccessGuard](#coformaccessguard)
  - [CoFormReadOnly](#coformreadonly)
  - [CoFormThankYou](#coformthankyou)
- [Types de champs](#types-de-champs)
  - [Champs standard](#champs-standard)
  - [MultiRadioField](#multiradiofield)
  - [MultiCheckboxPlusField](#multicheckboxplusfield)
  - [EvaluationField](#evaluationfield)
  - [FinderField](#finderfield)
  - [SimpleTableField](#simpletablefield)
  - [UploaderField](#uploaderfield)
- [Hooks](#hooks)
  - [useCoFormQuery](#usecoformquery)
  - [useCoForm / useCoFormNavigation / useCoFormStep](#usecoform--usecoformnavigation--usecoformstep)
  - [useConditionalFields](#useconditionalfields)
  - [useCoFormPermissions](#usecoformpermissions)
- [Factory `createCoFormMutation`](#factory-createcoformmutation)
- [Pipeline d'upload de fichiers](#pipeline-dupload-de-fichiers)
- [Contrôle d'accès (CoFormAccessInfo)](#contrôle-daccès-coformaccessinfo)
- [Permissions CoForm](#permissions-coform)
- [CoFormProvider et contexte](#coformprovider-et-contexte)
- [Utils : formParser](#utils--formparser)
- [Types principaux](#types-principaux)
- [Constantes](#constantes)
- [i18n](#i18n)
- [Prefetch SSR](#prefetch-ssr)
- [Intégration JSON (section)](#intégration-json-section)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le module **CoForm** (`src/modules/coform/`) affiche et gère des formulaires dynamiques multi-étapes générés depuis des CoForms Cocolight. Il transforme la structure CoForm en formulaires React avec :

- Validation Zod générée dynamiquement depuis la structure backend
- Gestion par react-hook-form avec types forts
- Contrôle d'accès serveur (dates, membership, active flag)
- Support consultation/édition de réponses existantes
- Pipeline d'upload de fichiers (images, documents)
- Logique conditionnelle (afficher/masquer des champs selon les valeurs)
- Champs avancés : evaluation (tableau multi-critères), finder (recherche entités), simpleTable (tableau 2D), multiRadio (radio + texte), multiCheckboxPlus (checkbox + options dynamiques)

**Type de module** : `core` — chargé en eager.

---

## Architecture interne

```
src/modules/coform/
├── actions/mutations/
│   ├── core.ts              # Factory createCoFormMutation
│   ├── file.ts              # useCoFormFinalMutation — pipeline upload + soumission finale
│   ├── index.ts             # Barrel export mutations
│   └── uploadHelpers.ts     # Helpers upload testés séparément (collectPendingUploads, uploadInBatches, etc.)
├── components/
│   ├── CoFormAccessGuard.tsx    # Garde d'accès (6 cas)
│   ├── CoFormAnswerPicker.tsx   # Sélecteur de réponse parmi plusieurs existantes
│   ├── CoFormModal.tsx          # Dialog générique wrappant SmartCoForm
│   ├── CoFormReadOnly.tsx       # Affichage lecture seule d'une réponse
│   ├── CoFormSection.tsx        # Section JSON type "coform" pour SectionRenderer
│   ├── CoFormThankYou.tsx       # Page de remerciement personnalisable
│   ├── DynamicCoForm.tsx        # Formulaire mono-étape (react-hook-form + Zod)
│   ├── EvaluationField.tsx      # Champ tableau d'évaluation multi-critères
│   ├── EvaluationVoteCell.tsx   # Cellule de vote (colour/emoji/note/star)
│   ├── FinderElementCard.tsx    # Carte d'un élément sélectionné par Finder
│   ├── FinderField.tsx          # Champ recherche/sélection d'entités Cocolight
│   ├── FinderSearchModal.tsx    # Modale de recherche du Finder
│   ├── FormFields.tsx           # TextField, TextAreaField, RadioField, CheckboxField, ProseContent
│   ├── MultiCheckboxPlusField.tsx # Checkbox + champ texte optionnel par option
│   ├── MultiRadioField.tsx      # Radio à sélection unique avec options simples/complexes
│   ├── MultiStepCoForm.tsx      # Wizard multi-étapes avec navigation
│   ├── ReadOnlyUploaderGallery.tsx # Galerie images en lecture seule
│   ├── SimpleTableField.tsx     # Champ tableau 2D éditable
│   ├── SmartCoForm.tsx          # Wrapper intelligent mono/multi-étape
│   └── UploaderField.tsx        # Upload fichiers/images avec prévisualisation
├── constants/
│   └── index.ts             # COFORM_TYPE_MAPPING, BOOTSTRAP_TO_TAILWIND_WIDTH, COFORM_QUERY_KEYS, SUBMIT_MODES, DISPLAY_VARIANTS, STEP_STATUS
├── contexts/
│   ├── CoFormContext.tsx     # Définition CoFormContextType, CoFormStepState
│   └── CoFormProvider.tsx   # Provider : état multi-étapes, navigation, stepsDataRef
├── hooks/
│   ├── useCoForm.tsx            # Accès contexte CoForm (+ variante optionnelle)
│   ├── useCoFormAnswerFiles.tsx # Charge fichiers legacy d'une réponse
│   ├── useCoFormNavigation.tsx  # next(), previous(), goTo(), progressPercent
│   ├── useCoFormPermissions.ts  # Wrapper usePermissions(["coform"])
│   ├── useCoFormQuery.tsx       # Chargement formulaire + soumission finale
│   ├── useCoFormStep.tsx        # react-hook-form + Zod par étape
│   └── useConditionalFields.ts  # Visibilité conditionnelle des champs
├── i18n/
│   ├── en.json / fr.json    # Traductions
│   └── i18n.ts              # Enregistrement namespace "modules/coform"
├── pages/
│   ├── CoFormAnswerPage.tsx # Page réponse : readonly ou édition
│   └── CoFormPage.tsx       # Page principale : accès, soumission, thank you
├── permissions/
│   ├── calculators/coform.ts  # Calculateur permissions (avec tests)
│   ├── defaults.ts
│   ├── index.ts
│   ├── register.ts            # registerPermissions({ namespace: "coform", calculate })
│   └── types.ts               # CoFormPermissions, CoFormPermissionData
├── prefetch/
│   └── index.ts             # prefetchCoFormQuery, invalidateCoFormQuery, invalidateCoFormAnswersQuery
├── utils/
│   ├── formParser.ts        # parseCoFormFields, generateZodSchema, generateDefaultValues, normalizeAnswerData, denormalizeAnswerData, extractFinderLinks
│   ├── helpers.ts           # convertBootstrapWidth, generateFieldId, extractMongoId, formatTimestamp, isStepComplete, mergeStepsData
│   └── index.ts             # Re-export
├── README.md                # Documentation de référence (structure, hooks, types, constantes, backend PHP)
├── index.ts                 # Barrel export centralisé
├── module.config.ts         # name: "coform", type: "core", enabled: true
├── routes.tsx               # Routes ModuleRouteFactory
├── schema.ts                # Schemas Zod section JSON
└── types.ts                 # Tous les types TypeScript du module
```

---

## Routes

| Route | Composant | Description |
|---|---|---|
| `/coform/:formId` | `CoFormPage` | Formulaire avec contrôle d'accès, soumission, thank you page |
| `/coform/:formId/answer/:answerId?mode=edit\|readonly` | `CoFormAnswerPage` | Consultation ou édition d'une réponse existante |

Le loader `coformLoader` extrait et valide `formId` (404 si absent). Le loader `coformAnswerLoader` extrait `formId`, `answerId`, et le paramètre `mode` (défaut: `"readonly"`).

---

## Composants principaux

### SmartCoForm

**Point d'entrée principal.** Choisit automatiquement entre `DynamicCoForm` (mono-étape) et `MultiStepCoForm` (multi-étapes) selon le nombre de `subForms`.

```ts
interface SmartCoFormProps {
  formId?: string;              // Charge depuis l'API si fourni
  formData?: CoFormData;        // Données externes (prioritaires sur formId)
  submitMode?: SubmitMode;      // "step" | "final" | "both" (défaut: "final")
  forceMultiStep?: boolean;
  forceSingleStep?: boolean;
  multiStepThreshold?: number;  // Seuil nb d'étapes → multi-step (défaut: 2)
  onStepSubmit?: (subFormId, data, stepIndex) => Promise<void>;
  onFinalSubmit?: (allData, addedOptions?, links?) => Promise<void>;
  onError?: (error) => void;
  defaultValues?: AllStepsData; // Pré-remplissage (mode édition)
  answerId?: string;            // ID réponse en cours d'édition
  stepKey?: string;             // Afficher une seule étape (mode standalone)
  inputKey?: string;            // Afficher un seul champ (requiert stepKey)
  onAfterSubmit?: () => void | Promise<void>;
  readOnly?: boolean;           // Mode lecture seule → CoFormReadOnly
  initialStepKey?: string;      // Étape initiale pour wizard
  onDirtyChange?: (isDirty) => void;
  submitRef?: React.RefObject<(() => void) | null>;
  lockedFields?: string[];      // Champs en lecture seule (pointer-events-none)
}
```

**Logique de sélection du mode :**

1. `standaloneFormData` (stepKey fourni) → toujours `DynamicCoForm`
2. `forceSingleStep: true` → `DynamicCoForm`
3. `forceMultiStep: true` → `MultiStepCoForm`
4. `stepsCount >= multiStepThreshold` → `MultiStepCoForm`, sinon `DynamicCoForm`

**Mutation interne** : si aucun `onFinalSubmit` n'est fourni, `SmartCoForm` utilise `useCoFormFinalMutation` qui gère automatiquement le pipeline d'upload.

**Mode standalone** (`stepKey` fourni) : filtre `formData.inputs` pour ne garder que l'étape désignée ; `useBannerImg` est forcé à `false`.

**Mode input standalone** (`inputKey` + `stepKey`) : filtre jusqu'à un seul champ ; `hideSubmitButton: true` + `autoSubmitOnBlur: true` → soumission automatique au blur après 600ms de debounce.

**Mode readOnly** : délègue directement à `CoFormReadOnly`.

---

### DynamicCoForm

Formulaire mono-étape basé sur react-hook-form + zodResolver. Gère :

- Génération du schéma Zod via `parseCoFormFields` + `generateZodSchema`
- Rendu de tous les types de champs via switch sur `field.componentType`
- Logique conditionnelle via `useConditionalFields`
- Champs verrouillés (`lockedFields`) : wrapper `pointer-events-none opacity-60`
- Auto-submit sur blur via `useWatch` + debounce 600ms
- Propagation de `isDirty` via `onDirtyChange`
- Soumission programmatique via `submitRef`

**Bannière** : si `formData.useBannerImg && formData.profilBannerUrl` → image avec overlay gradient ; sinon si `formData.name` → bloc dégradé primary ; sinon rien.

**Champ inconnu** : affiche un bloc d'erreur rouge avec le type manquant (pas de crash silencieux).

---

### MultiStepCoForm

Wizard multi-étapes avec navigation. Utilise `CoFormProvider` pour partager l'état entre étapes. Affiche un stepper visuel avec statuts `pending`/`current`/`completed`/`error`.

---

### CoFormModal

Dialog générique wrappant `SmartCoForm`. Gère la fermeture avec confirmation si le formulaire est modifié (`isDirty`).

```ts
interface CoFormModalProps {
  formId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  stepKey?: string;
  inputKey?: string;
  answerId?: string;
  defaultValues?: AllStepsData;
  readOnly?: boolean;
  onAfterSubmit?: () => void | Promise<void>;
  closeOnSubmit?: boolean;    // défaut: true (false si inputKey fourni)
  className?: string;
  lockedFields?: string[];
}
```

**Comportement de fermeture** :
- Si `isDirty && !isSubmitting` → affiche `AlertDialog` avec 3 options : "Continuer l'édition", "Annuler les modifications", "Sauvegarder"
- "Sauvegarder" appelle `submitRef.current()` (soumission programmatique)
- `closeOnSubmit: false` est automatiquement activé si `inputKey` est fourni (pas de fermeture sur chaque auto-submit)

---

### CoFormAccessGuard

Vérifie `access.canAnswer` et affiche soit les enfants (accès autorisé), soit une carte de refus visuellement différenciée.

**6 cas de refus :**

| `reason` | Icône | Couleur d'en-tête | Action proposée |
|---|---|---|---|
| `already_answered` | AlertCircle | `bg-warning` | Bouton "Modifier ma réponse" (`onEditExisting`) |
| `not_member` | Users | `bg-info` | — |
| `form_not_started` | Clock | `bg-info` | Affiche la date d'ouverture |
| `form_closed` | Lock | `bg-destructive` | Affiche la date de clôture |
| `form_inactive` | Power | `bg-muted` | — |
| `not_logged_in` | LogIn | `bg-primary` | Bouton "Se connecter" (`onLogin`) |

Les couleurs utilisent les **tokens sémantiques shadcn/ui** (`bg-warning`, `bg-info`, `bg-destructive`, `bg-primary`, `bg-muted`) pour la compatibilité automatique mode sombre.

Si `access === null`, les enfants sont rendus sans garde.

---

### CoFormReadOnly

Affiche une réponse existante en lecture seule. Caractéristiques :

- Bannière du formulaire (si présente)
- Métadonnées : auteur, dates création/modification (optionnel `hideMetadata`)
- Sections par étape avec grille responsive
- Rendu Markdown pour les champs `textarea`
- Badges pour les valeurs checkbox
- Badge Oui/Non pour les booléens
- `ReadOnlyUploaderGallery` pour les fichiers uploadés

Props : `{ formData, answerData, answerId?, hideBanner?, hideStepHeaders?, hideMetadata? }`

---

### CoFormThankYou

Page de remerciement style Google Forms, affichée après soumission réussie. Personnalisable via `CoFormThankYouConfig` dans `formData.thankYou` :

```ts
interface CoFormThankYouConfig {
  title?: string;           // Remplace le titre i18n par défaut
  message?: string;
  additionalInfo?: string;  // Prochaines étapes, contact, etc.
  accentColor?: string;     // Couleur hex de la bande supérieure
  showSubmitAnother?: boolean;
}
```

---

## Types de champs

### Champs standard

Définis dans `FormFields.tsx` :

| `componentType` | Composant | Description |
|---|---|---|
| `text` | `TextField` | `<input type="text|url|email|tel|number|date">` selon `inputType` |
| `textarea` | `TextAreaField` | Zone de texte ; si `field.markdown: true` → éditeur Markdown |
| `radio` | `RadioField` | Boutons radio (`tpls.forms.cplx.radioNew`) |
| `checkbox` | `CheckboxField` | Cases à cocher multiples (`tpls.forms.cplx.checkboxNew`) |
| `sectionTitle` | `SectionTitleField` | Titre décoratif (showBar, align, textDecoration) |
| `sectionDescription` | `SectionDescriptionField` | Texte de description (ProseContent) |

---

### MultiRadioField

Radio à sélection unique avec deux types d'options :
- `simple` : radio seul
- `cplx` : radio + champ texte obligatoire (si sélectionné)

Valeur stockée : `{ value: string; type?: "simple" | "cplx"; textsup?: string }`

Le texte supplémentaire (`textsup`) n'est activé que si l'option de type `cplx` est sélectionnée. Le placeholder par option est configurable via `multiRadioConfig.placeholdersradio`.

---

### MultiCheckboxPlusField

Checkbox multiple avec options de deux types :
- `simple` : checkbox seule
- `cplx` : checkbox + champ texte optionnel/obligatoire

Fonctionnalités avancées :
- Classement par drag (si `config.rank: true`)
- Ajout dynamique d'une valeur non listée (si `config.addValue: true`)
- Nombre max de sélections (`config.nbAnswersMax`)
- Images par option (`config.optimage`)
- Info supplémentaire par option (`config.optinfo`)

Valeur stockée : `Array<Record<string, MultiCheckboxPlusSelectedOption>>` où `MultiCheckboxPlusSelectedOption = { value, type, rank?, textsup? }`.

Les options ajoutées dynamiquement remontent via `onAddedOptionsChange(fieldName, opts)`.

---

### EvaluationField

Tableau multi-critères. Configurations supportées :

| `voteType` | Rendu dans `EvaluationVoteCell` |
|---|---|
| `colour` | Bouton Oui (OK)/Non (NotOK) avec couleurs configurables |
| `emoji` | Sélection parmi liste d'emojis |
| `note` | Input numérique 1..noteMax |
| `star` | N étoiles cliquables (1..starCount) |

Structure hiérarchique des catégories (`EvaluationCategories`) : objet imbriqué N niveaux, les feuilles sont des tableaux `[""]`. `categoryNumber` indique le nombre de niveaux.

Valeur stockée : `Record<string, Record<string, EvaluationVoteValue>>` où la clé externe est le `path` de catégorie et la clé interne est l'ID du critère.

---

### FinderField

Recherche et sélection d'entités Cocolight (organisations, citoyens, événements, projets, etc.).

- Ouvre `FinderSearchModal` qui appelle `globalautocomplete` avec le type configuré
- Sélection simple ou multiple selon `config.multiple`
- Affiche les éléments sélectionnés via `FinderElementCard`
- Contrôles additionnels : `addNew`, `invite` (email), `editElement`, `linkToAnswer`

Valeur stockée : `Record<string, FinderElement> | null` (clé = `element.id`).

Types d'éléments recherchables (`FinderElementType`) : `organizations`, `citoyens`, `events`, `projects`, `news`, `cities`, `things`, `poi`, `classified`, `products`, `services`, `surveys`, `bookmarks`, `proposals`, `rooms`, `actions`, `networks`, `urls`, `circuits`, `risks`, `badges`.

---

### SimpleTableField

Tableau 2D éditable. Colonnes de types : `"Text"`, `"Case à cocher"`, `"Nombre"`, `"Image"`, `"Images"`.

Valeur stockée : `(SimpleTableCell | SimpleTableCell[])[][]` où la première ligne est les en-têtes, les suivantes sont les données. Une cellule `Image` = URL string ou `ImageUploadValue`, une cellule `Images` = `SimpleTableCell[]`.

Nouvelles lignes ajoutables si `config.activeNewLine: true`.

---

### UploaderField

Upload fichiers/images avec prévisualisation. Supporte :

- `docType: "image"` → aperçu image immédiat via `data:URI`
- `docType: "file"` → affichage nom de fichier
- Limite de taille (`config.sizeLimit`) et formats (`config.formats`)
- Valeur pendant l'édition : `Array<string | ImageUploadValue | ExistingUploadFile>`
- Valeur format legacy (base de données) : `UploaderLegacyValue = { updateDate: string[], files: Record<string, string> }`

Les `data:URI` sont collectés par `collectPendingUploads()` lors de la soumission et uploadés avant l'envoi des données finales.

---

## Hooks

### useCoFormQuery

```ts
const {
  formData,          // CoFormData | null
  isLoading,
  error,
  refetch,
  stepsCount,        // Object.keys(formData.inputs).length
  useCoFormFinalMutation, // Ré-exporté pour usage interne SmartCoForm
} = useCoFormQuery({
  formId: string,
  enabled?: boolean, // défaut: true
});
```

**queryKey** : `COFORM_QUERY_KEYS.FORM(formId)` → `["coform", "form", formId]`

Charge le formulaire via `entity.coform.getFormById(formId)`. Les informations d'accès (`CoFormAccessInfo`) sont incluses dans `formData.access`.

---

### useCoForm / useCoFormNavigation / useCoFormStep

Hooks de contexte pour le wizard multi-étapes :

| Hook | Retourne |
|---|---|
| `useCoForm()` | Contexte CoForm complet (throws si hors Provider) |
| `useCoFormOptional()` | Contexte CoForm ou `null` (safe) |
| `useCoFormNavigation()` | `{ next(), previous(), goTo(stepKey), progressPercent, currentStepIndex, totalSteps }` |
| `useCoFormStep()` | `{ form, fields, isValid, isSubmitting, submitStep() }` — react-hook-form + Zod pour l'étape courante |

Ces hooks ne fonctionnent que dans un arbre avec `CoFormProvider`.

---

### useConditionalFields

Évalue la visibilité des champs en temps réel selon les valeurs du formulaire.

```ts
const { isFieldVisible } = useConditionalFields(allFields, control);
// allFields : FormFieldMapping[] (tous les champs de l'étape)
// control : react-hook-form Control
```

**Logique** :
1. Collecte les `sourceInput` de toutes les règles `conditionalDisplay`
2. Observe uniquement ces champs via `useWatch` (optimisé)
3. Pour chaque champ cible : évalue les règles groupées par action (`show`/`hide`)
4. Opérateurs : `equals`, `notEquals`, `contains`, `matches` (regex), `isEmpty`, `isNotEmpty`
5. Logique `"and"`/`"or"` au niveau du groupe de règles
6. `hide` est prioritaire sur `show`

La fonction `evaluateRule(rule, sourceValue)` est exportée séparément pour les tests unitaires.

---

### useCoFormPermissions

```ts
const permissions = useCoFormPermissions(entity?, data?);
// data: CoFormPermissionData = { access?: CoFormAccessInfo | null, answer?: CoFormAnswer | null }
```

Wrapper sur `usePermissions(["coform"], entity, data)`. Retourne `CoFormPermissions`.

---

## Factory `createCoFormMutation`

`src/modules/coform/actions/mutations/core.ts` expose une factory pour créer des hooks de mutation typés.

```ts
function createCoFormMutation<TParams, TData = void>(
  config: CoFormMutationConfig<TParams, TData>
): (ctx: CoFormMutationContext) => UseMutationResult<TData, Error, TParams>

interface CoFormMutationContext {
  api: Api | null;
  formId: string;
  answerId?: string;
}

interface CoFormMutationConfig<TParams, TData> {
  action: (ctx: CoFormMutationContext & { api: Api }, params: TParams) => Promise<TData>;
  i18n: { successKey: string; errorKey: string };
  invalidate?: (ctx: CoFormMutationContext) => QueryKey[];
  getSuccessParams?: (data: TData) => Record<string, unknown>;
}
```

**Ce que la factory encapsule :**
- `useMutationWithToast` pour les toasts succès/erreur automatiques (namespace `modules/coform`)
- Résolution du contexte (`api` non-null, `formId` non-vide) avec throw `CoFormContextError` si invalide
- Invalidation React Query après succès (clés configurables par fonction)
- Paramètres dynamiques pour les messages de succès (`getSuccessParams`)

---

## Pipeline d'upload de fichiers

`src/modules/coform/actions/mutations/file.ts` — `useCoFormFinalMutation`

**Orchestration :**

1. `collectPendingUploads(data)` — scanne toute la structure `AllStepsData` pour trouver les `data:URI` en attente
2. Si aucun fichier → POST direct `saveCoformAnswer`
3. Si fichiers :
   a. Premier upload vers l'endpoint fichiers pour obtenir un `answerId`
   b. Batches de 4 uploads parallèles via `uploadInBatches(files, batchSize=4)`
   c. Normalisation des champs `uploader` (format legacy `{ updateDate, files }`) via `normalizeUploaderValue()`
   d. Nettoyage des URLs absolues → chemins relatifs via `cleanUploaderUrls()`
4. POST final `saveCoformAnswer` avec `answers` JSON sérialisé

**Helpers (`uploadHelpers.ts`) — testés dans `uploadHelpers.test.ts` :**

| Fonction | Description |
|---|---|
| `collectPendingUploads(data)` | Trouve tous les `data:URI` dans la structure `AllStepsData` |
| `uploadInBatches(files, batchSize=4)` | Upload parallèle par batches de N fichiers |
| `normalizeUploaderValue(value)` | Normalise le format legacy `{ updateDate, files }` |
| `cleanUploaderUrls(data)` | Remplace les URLs absolues par des chemins relatifs |
| `dataUriToFile(dataUri, filename)` | Convertit un `data:URI` en `File` |
| `getValueAtPath(obj, path)` | Accès par chemin pointé (ex: `"step1.field2"`) |
| `setValueAtPath(obj, path, value)` | Mutation par chemin pointé |

---

## Contrôle d'accès (CoFormAccessInfo)

Le contrôle d'accès est calculé **côté serveur** (`Coform::getFormAccessInfo()`) et retourné dans `CoFormData.access`.

```ts
interface CoFormAccessInfo {
  canAnswer: boolean;
  reason: CoFormAccessReason; // null si canAnswer=true
  formStatus: "open" | "not_started" | "closed" | "inactive";
  existingAnswerId: string | null;
  existingAnswer: AllStepsData | null;
  existingAnswers?: CoFormAnswerSummary[]; // mode réponse multiple
  requiresLogin: boolean;
  allowTemporary: boolean;
  withConfirmation: boolean;
  isOnlyMember: boolean;
  isOneAnswerPerPers: boolean;
  isActive: boolean;
  dates: {
    start: string | null;
    end: string | null;
    startNoConfirmation: string | null; // Dates séparées pour comptes temporaires
    endNoConfirmation: string | null;
  };
}
```

**Raisons de refus (`CoFormAccessReason`) :**

| Valeur | Déclencheur |
|---|---|
| `"form_inactive"` | Flag `active` désactivé par l'admin |
| `"form_not_started"` | Date de début pas encore atteinte |
| `"form_closed"` | Date de fin dépassée |
| `"not_member"` | `isOnlyMember: true` et l'utilisateur n'est pas membre du costum |
| `"already_answered"` | `isOneAnswerPerPers: true` et l'utilisateur a déjà soumis |
| `"not_logged_in"` | `requiresLogin: true` et utilisateur non connecté |
| `"form_not_found"` | Formulaire introuvable |
| `null` | Accès autorisé |

**Autorisation d'édition** : l'endpoint `findanswered` retourne `canEdit` et `editDeniedReason` pour chaque `CoFormAnswer` :

| `editDeniedReason` | Signification |
|---|---|
| `"not_logged_in"` | Non connecté |
| `"not_owner"` | L'utilisateur n'est pas l'auteur |
| `"form_inactive"` | Formulaire désactivé |
| `"form_closed"` | Période de modification terminée |

---

## Permissions CoForm

```ts
// src/modules/coform/permissions/types.ts
interface CoFormPermissions {
  canSubmitAnswer: boolean;
  cannotSubmitReason?: CoFormAccessReason;
  canEditAnswer: (answer: CoFormAnswerLike | null | undefined) => boolean;
  canDeleteAnswer: (answer: CoFormAnswerLike | null | undefined) => boolean;
  canViewForm: boolean;
  isConnected: boolean;
  isMember: boolean;
  currentUserId: string;
}
```

`canEditAnswer` et `canDeleteAnswer` sont des fonctions pour permettre l'évaluation par réponse (pas globale).

**Enregistrement :**
```ts
// src/modules/coform/permissions/register.ts
registerPermissions({
  namespace: "coform",
  calculate: (entity, me, data: CoFormPermissionData) => ({
    canSubmitAnswer: data?.access?.canAnswer ?? true,
    cannotSubmitReason: data?.access?.reason ?? null,
    canEditAnswer: (answer) => !!(answer?.canEdit),
    canDeleteAnswer: (answer) => /* logic admin/auteur */,
    canViewForm: /* logic isOnlyMember */,
    isConnected: !!me,
    isMember: /* logic membership */,
    currentUserId: me?.id ?? "",
  }),
});
```

---

## CoFormProvider et contexte

`CoFormProvider` gère l'état partagé pour le wizard multi-étapes :

```ts
interface CoFormContextType {
  formData: CoFormData;
  currentStepIndex: number;
  currentStepKey: string;
  stepsKeys: string[];
  stepsData: Record<string, SubFormData>;
  stepStatuses: Record<string, StepStatus>; // "pending" | "current" | "completed" | "error"
  submitMode: SubmitMode;
  // Actions
  setStepData: (stepKey: string, data: SubFormData) => void;
  setStepStatus: (stepKey: string, status: StepStatus) => void;
  navigateTo: (index: number) => void;
}
```

`stepsDataRef` est un `useRef` synchronisé avec `stepsData` pour éviter les stale closures lors de la soumission finale.

---

## Utils : formParser

`src/modules/coform/utils/formParser.ts` — fonctions pures de transformation :

| Fonction | Description |
|---|---|
| `parseCoFormFields(formData)` | `CoFormData → SubFormFields[]` avec mapping vers `componentType`, largeurs Tailwind, options, configs avancées |
| `generateZodSchema(subFormsFields)` | `SubFormFields[] → z.ZodObject` dynamique avec validation `isRequired` par champ et type |
| `generateDefaultValues(subFormsFields)` | Valeurs par défaut vides typées selon `componentType` |
| `normalizeAnswerData(rawData, subFormsFields)` | Normalise les données backend (champs root-level evaluation) vers format react-hook-form |
| `denormalizeAnswerData(formData, subFormsFields)` | Inverse : format react-hook-form → format PHP (root-level pour evaluation) |
| `extractFinderLinks(formData, subFormsFields)` | Extrait les `FinderValue` pour création de liens entre entités |
| `getOriginalFieldKey(field)` | Retourne la clé brute du champ (avant préfixage react-hook-form) |

**Mapping de types CoForm → componentType :**

| Type CoForm | `componentType` |
|---|---|
| `text`, `url`, `email`, `tel`, `number`, `date` | `text` (avec `inputType` correspondant) |
| `textarea` | `textarea` |
| `tpls.forms.cplx.radioNew` | `radio` |
| `tpls.forms.cplx.checkboxNew` | `checkbox` |
| `tpls.forms.cplx.multiCheckboxPlus` | `multiCheckboxPlus` |
| `tpls.forms.cplx.multiRadio` | `multiRadio` |
| `tpls.forms.cplx.evaluation` | `evaluation` |
| `tpls.forms.finder` | `finder` |
| `tpls.forms.simpleTable` | `simpleTable` |
| `uploader` | `uploader` |
| `sectionTitle` | `sectionTitle` |
| `sectionDescription` | `sectionDescription` |

---

## Types principaux

| Type | Description |
|---|---|
| `CoFormData` | Structure complète d'un formulaire (id, name, inputs, params, subForms, access, thankYou, bannière) |
| `CoFormAnswer` | Réponse : `answers: AllStepsData`, `canEdit`, `editDeniedReason`, user, created, updated, draft, finished |
| `CoFormAccessInfo` | Info d'accès serveur (canAnswer, reason, formStatus, dates, flags) |
| `CoFormAnswerSummary` | Aperçu d'une réponse existante (id, createdAt, preview) |
| `CoFormThankYouConfig` | Config page remerciement (title, message, accentColor, showSubmitAnother) |
| `FormFieldMapping` | Mapping champ pour react-hook-form (name, label, componentType, options, width, configs avancées) |
| `SubFormFields` | `{ subFormId, subFormName, fields: FormFieldMapping[] }` |
| `AllStepsData` | `Record<subFormId, SubFormData>` — données tous sous-formulaires |
| `SubFormData` | `Record<fieldKey, FormFieldValue>` |
| `FormFieldValue` | Union de tous les types de valeurs possibles |
| `AddedOptionsMap` | `Record<fieldName, string[]>` — options ajoutées dynamiquement |
| `SubmitMode` | `"step" \| "final" \| "both"` |
| `CoFormVariant` | `"default" \| "wizard" \| "stepper" \| "tabs"` |
| `ConditionalRule` | `{ sourceInput, operator, value, action, targetInput?, targetStep? }` |
| `ConditionalDisplay` | `{ enabled, logic: "and"\|"or", rules: ConditionalRule[] }` |
| `EvaluationConfig` | Config évaluation (categories, criterias, voteType, colours/emojis/noteMax/starCount) |
| `FinderConfig` | Config finder (type, filters, multiple, addNew, invite, singleAnswerPerElement...) |
| `FinderElement` | `{ id, name, type, img?, address? }` |
| `FinderValue` | `Record<string, FinderElement> \| null` |
| `SimpleTableConfig` | `{ tableName, columns, rows, activeNewLine, singleAnswerByLine }` |
| `UploaderConfig` | `{ docType, itemLimit, sizeLimit, formats?, displayMode? }` |
| `UploaderValue` | `Array<string \| ImageUploadValue \| ExistingUploadFile>` |
| `MultiRadioValue` | `{ value: string; type?: "simple"\|"cplx"; textsup?: string }` |
| `MultiCheckboxPlusValue` | `Array<Record<string, MultiCheckboxPlusSelectedOption>>` |
| `EvaluationValue` | `Record<categoryPath, Record<criteriaId, EvaluationVoteValue>>` |

---

## Constantes

```ts
// COFORM_QUERY_KEYS — vit dans src/modules/coform/constants/queryKeys.ts
// (fichier dédié depuis le commit b03db2c, conforme aux 11 règles de
// la convention "or" — cf. commentaire/retour-equipe-refactor-mai-2026.md
// section 2.17). Re-export propre depuis ./constants/index.ts.
//
// `userId` (3ᵉ param de FORM_ANSWER / ANSWER_FILES) isole le cache par
// utilisateur connecté pour éviter une fuite cross-user (commit 7837d57).
// Les hooks coform passent automatiquement `me?.id ?? null`.
COFORM_QUERY_KEYS.FORM(formId)                        // ["coform", "form", formId]
COFORM_QUERY_KEYS.FORM_PREFIX(formId?)                // ["coform", "form"] OU ["coform", "form", formId]
COFORM_QUERY_KEYS.FORM_ANSWERS(formId)                // ["coform", "answers", formId]
COFORM_QUERY_KEYS.FORM_ANSWERS_PREFIX(formId?)        // idem avec/sans formId
COFORM_QUERY_KEYS.FORM_ANSWER(formId, answerId, userId?)
                                                       // ["coform", "answer", formId, answerId, userId]
COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX(formId, answerId?)
                                                       // ["coform", "answer", formId] OU [..., answerId]
COFORM_QUERY_KEYS.ANSWER_FILES(answerId, subKey, userId?)
                                                       // ["coform", "answerFiles", answerId, subKey, userId]
COFORM_QUERY_KEYS.ANSWER_FILES_PREFIX(answerId)       // ["coform", "answerFiles", answerId]

// Type associé (consommateurs externes)
type CoformQueryKeyType = ReturnType<(typeof COFORM_QUERY_KEYS)[keyof typeof COFORM_QUERY_KEYS]>;

// Modes
SUBMIT_MODES = { STEP: "step", FINAL: "final", BOTH: "both" }
DISPLAY_VARIANTS = { DEFAULT, WIZARD, ACCORDION, TABS, STEPPER }
STEP_STATUS = { PENDING, CURRENT, COMPLETED, ERROR }

// Largeurs Bootstrap → grille Tailwind
BOOTSTRAP_TO_TAILWIND_WIDTH = {
  "col-lg-12 col-md-12 col-xs-12": "w-full",
  "col-lg-6 col-md-6 col-xs-12": "w-full md:w-1/2",
  // ...etc
}
```

---

## i18n

**Namespace** : `modules/coform`

Enregistrement : importer `"../i18n/i18n"` en side-effect dans les composants qui l'utilisent.

Usage dans les composants :
```tsx
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "../i18n/i18n";

useLoadNamespace("modules/coform");
const t = useT("modules/coform");
t("coform.navigation.next"); // → "Suivant"
t("coform.access.formClosed.title"); // → "Formulaire clôturé"
```

**Groupes de clés :**

| Groupe | Exemples de clés |
|---|---|
| `coform.steps.*` | `stepOf`, `stepCompleted` |
| `coform.navigation.*` | `next`, `previous`, `submit`, `saving` |
| `coform.progress.*` | `percent`, `stepsCompleted` |
| `coform.validation.*` | `required`, `invalidFormat` |
| `coform.status.*` | `submitting`, `error`, `success` |
| `coform.errors.*` | `loadFailed`, `submitFailed` |
| `coform.banner.*` | `alt` |
| `coform.answer.*` | `submittedAt`, `updatedAt`, `submitSuccess`, `submitError` |
| `coform.thankYou.*` | `title`, `message`, `submitAnother` |
| `coform.access.*` | `alreadyAnswered.title`, `notMember.title`, `formClosed.title`, `notLoggedIn.loginButton`, `dateRange` |
| `coform.modal.*` | `unsavedTitle`, `unsavedDescription`, `continueEditing`, `discardChanges`, `save` |
| `coform.smart.*` | `loading`, `errorTitle`, `retry`, `emptyMessage` |

---

## Prefetch SSR

`src/modules/coform/prefetch/index.ts` expose des helpers pour les loaders SSR :

```ts
// Précharger les données d'un formulaire (evite waterfall client)
await prefetchCoFormQuery(queryClient, formId);

// Invalider après mutation
invalidateCoFormQuery(queryClient, formId);
invalidateCoFormAnswersQuery(queryClient, formId);
```

---

## Intégration JSON (section)

Le module expose un type de section JSON `"coform"` pour `SectionRenderer` :

```json
{
  "type": "coform",
  "props": {
    "formId": "abc123",
    "variant": "wizard",
    "submitMode": "final",
    "title": "Inscrivez-vous",
    "description": "Remplissez le formulaire ci-dessous",
    "showProgress": true,
    "showStepNumbers": true,
    "allowFreeNavigation": false,
    "redirectAfterSubmit": "/merci"
  }
}
```

Schema Zod : `CoFormSectionSchema` dans `src/modules/coform/schema.ts`.

| Prop | Type | Défaut | Description |
|---|---|---|---|
| `formId` | `string` | requis | ID du formulaire CoForm |
| `variant` | `"default"\|"wizard"\|"stepper"\|"tabs"` | `"default"` | Variante d'affichage |
| `submitMode` | `"step"\|"final"\|"both"` | `"final"` | Quand sauvegarder |
| `title` | `LocalizedString?` | — | Titre de la section |
| `description` | `LocalizedString?` | — | Description |
| `showProgress` | `boolean` | `true` | Barre de progression |
| `showStepNumbers` | `boolean` | `true` | Numéros d'étapes |
| `allowFreeNavigation` | `boolean` | `false` | Navigation libre entre étapes |
| `redirectAfterSubmit` | `string?` | — | URL redirection post-soumission |

---

## Voir aussi

- [Architecture](03-architecture.md) — pattern `createPageActionsState`, modules
- [Module Profil](08-module-profil.md) — CoFormPage accessible depuis les profils
- [Tests](15-tests.md) — tests CoForm helpers (tests uploadHelpers.test.ts, formParser.test.ts, helpers.test.ts, useConditionalFields.test.ts, coform.test.ts)
- `src/modules/coform/README.md` — documentation technique complémentaire (backend PHP associé, personnalisation)
