[← Retour à l'index](README.md)

# Module CoForm

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Routes](#routes)
- [Pages](#pages)
  - [CoFormPage](#coformpage)
- [Composants principaux](#composants-principaux)
  - [SmartCoForm](#smartcoform)
  - [DynamicCoForm](#dynamiccoform)
  - [MultiStepCoForm](#multistepcoform)
  - [CoFormModal](#coformmodal)
  - [CoFormAccessGuard](#coformaccessguard)
  - [CoFormReadOnly](#coformreadonly)
  - [CoFormThankYou](#coformthankyou)
  - [CoFormBanner](#coformbanner)
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
  - [useCoFormAnswerQuery](#usecoformanswerquery)
  - [useCoForm / useCoFormNavigation / useCoFormStep / useCoFormSubmit](#usecoform--usecoformnavigation--usecoformstep--usecoformsubmit)
  - [useConditionalFields](#useconditionalfields)
  - [useCoFormPermissions](#usecoformpermissions)
  - [useFinderSearchResults](#usefindersearchresults)
- [Factory `createCoFormMutation`](#factory-createcoformmutation)
- [Pipeline d'upload de fichiers](#pipeline-dupload-de-fichiers)
- [Contrôle d'accès (CoFormAccessInfo)](#contrôle-daccès-coformaccessinfo)
- [Permissions CoForm](#permissions-coform)
- [CoFormProvider et contexte](#coformprovider-et-contexte)
- [Utils : formParser](#utils--formparser)
- [Utils : helpers, toFinderSearchResult, toRelativeImageUrl](#utils--helpers-tofindersearchresult-torelativeimageurl)
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
- Pipeline d'upload de fichiers délégué à `@communecter/cocolight-api-client` (`Answer.processUploads`)
- Logique conditionnelle (afficher/masquer des champs selon les valeurs)
- Champs avancés : evaluation (tableau multi-critères), finder (recherche entités), simpleTable (tableau 2D), multiRadio (radio + texte), multiCheckboxPlus (checkbox + options dynamiques)

**Type de module** : `core` — chargé en eager.

---

## Architecture interne

```
src/modules/coform/
├── actions/mutations/
│   ├── core.ts              # Factory createCoFormMutation
│   ├── file.ts              # useCoFormFinalMutation — délègue à Answer.processUploads + Answer.save
│   └── index.ts             # Barrel export mutations
├── components/
│   ├── CoFormAccessGuard.tsx    # Garde d'accès (6 cas)
│   ├── CoFormAnswerPicker.tsx   # Sélecteur de réponse parmi plusieurs existantes
│   ├── CoFormBanner.tsx         # Bannière partagée (image + overlay ou dégradé + titre)
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
│   ├── FormFields.tsx           # TextField, TextAreaField, RadioField, CheckboxField,
│   │                            #   SectionTitleField, SectionDescriptionField, ProseContent, FieldError
│   ├── MarkdownEditor.tsx       # Éditeur Markdown client-only (@uiw/react-md-editor)
│   ├── MultiCheckboxPlusField.tsx # Checkbox + champ texte optionnel par option
│   ├── MultiRadioField.tsx      # Radio à sélection unique avec options simples/complexes
│   ├── MultiStepCoForm.tsx      # Wizard multi-étapes avec navigation
│   ├── ReadOnlyUploaderGallery.tsx # Galerie images en lecture seule
│   ├── SimpleTableField.tsx     # Champ tableau 2D éditable
│   ├── SmartCoForm.tsx          # Wrapper intelligent mono/multi-étape
│   ├── SmartCoForm.test.tsx     # Tests unitaires SmartCoForm
│   └── UploaderField.tsx        # Upload fichiers/images avec prévisualisation
├── constants/
│   ├── index.ts             # COFORM_TYPE_MAPPING, BOOTSTRAP_TO_TAILWIND_WIDTH,
│   │                        #   SUBMIT_MODES, DISPLAY_VARIANTS, STEP_STATUS + re-export queryKeys
│   └── queryKeys.ts         # COFORM_QUERY_KEYS (source de vérité), CoformQueryKeyType
├── contexts/
│   ├── CoFormContext.tsx     # Définition CoFormContextType, CoFormStepState
│   ├── CoFormProvider.tsx   # Provider : état multi-étapes, navigation, stepsDataRef
│   └── CoFormProvider.test.tsx # Tests unitaires CoFormProvider
├── hooks/
│   ├── useCoForm.tsx            # useCoForm() + useOptionalCoForm()
│   ├── useCoFormAnswerFiles.tsx # Charge fichiers legacy d'une réponse
│   ├── useCoFormNavigation.tsx  # useCoFormNavigation() + useCoFormSubmit()
│   ├── useCoFormPermissions.ts  # Wrapper usePermissions(["coform"])
│   ├── useCoFormQuery.tsx       # useCoFormQuery, useCoFormAnswerQuery, useCoFormStepMutation
│   │                            #   (re-exporte useCoFormFinalMutation depuis mutations/file.ts)
│   ├── useCoFormStep.tsx        # react-hook-form + Zod par étape
│   ├── useConditionalFields.ts  # Visibilité conditionnelle des champs
│   ├── useConditionalFields.test.ts
│   ├── useFinderSearchResults.ts  # Recherche d'entités via searchCostum (RQ + debounce)
│   └── useFinderSearchResults.test.tsx
├── i18n/
│   ├── en.json / fr.json    # Traductions
│   └── i18n.ts              # Enregistrement namespace "modules/coform"
├── pages/
│   ├── CoFormAnswerPage.tsx # Page réponse : readonly ou édition
│   └── CoFormPage.tsx       # Page principale : accès, soumission, thank you
├── permissions/
│   ├── calculators/coform.ts  # Calculateur permissions (avec tests)
│   ├── calculators/coform.test.ts
│   ├── defaults.ts
│   ├── index.ts
│   ├── register.ts            # registerPermissions({ namespace: "coform", calculate })
│   └── types.ts               # CoFormPermissions, CoFormAnswerLike, CoFormPermissionData
├── prefetch/
│   └── index.ts             # prefetchCoFormQuery, invalidateCoFormQuery, invalidateCoFormAnswersQuery
├── utils/
│   ├── formParser.ts        # parseCoFormFields, generateZodSchema, generateDefaultValues,
│   │                        #   normalizeAnswerData, denormalizeAnswerData, extractFinderLinks,
│   │                        #   mapCoFormTypeToComponentType, getOriginalFieldKey,
│   │                        #   getFieldNameWithPrefix, isRootLevelField, hasFieldPrefix
│   ├── formParser.test.ts
│   ├── helpers.ts           # convertBootstrapWidth, generateFieldId, extractMongoId,
│   │                        #   formatTimestamp, isStepComplete, mergeStepsData
│   ├── helpers.test.ts
│   ├── index.ts             # Re-export formParser + helpers + toFinderSearchResult + toRelativeImageUrl
│   ├── toFinderSearchResult.ts  # SDK SearchEntity → FinderSearchResult
│   ├── toFinderSearchResult.test.ts
│   ├── toRelativeImageUrl.ts    # URL absolue → chemin relatif (robustesse migration)
│   └── toRelativeImageUrl.test.ts
├── README.md                # Documentation de référence (structure, hooks, types, backend PHP)
├── index.ts                 # Barrel export centralisé
├── module.config.ts         # name: "coform", type: "core", enabled: true
├── routes.tsx               # Routes ModuleRouteFactory
├── schema.ts                # Schemas Zod section JSON (CoFormSectionSchema, CoFormConfigSchema)
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

## Pages

### CoFormPage

`pages/CoFormPage.tsx` — Page principale pour `/coform/:formId`. Gère : contrôle d'accès (`CoFormAccessGuard`), sélection de réponse (`CoFormAnswerPicker`), rendu du formulaire (`SmartCoForm`), page de remerciement (`CoFormThankYou`), et le déclenchement du login.

**Login via le modal global** : depuis le refactor `537a9f3`, `CoFormPage` n'embarque plus de `Dialog` + `LoginForm` local. Le login passe par le **modal d'authentification global** (`useAuthModal` du module auth).

```tsx
// CoFormPage.tsx — extrait simplifié
const { openLogin } = useAuthModal();

// Fourni comme prop onLogin à CoFormAccessGuard :
onLogin={() => openLogin({ onSuccess: refetch })}
```

Le callback `onSuccess: refetch` permet de recalculer immédiatement les champs `access.canAnswer`, `access.existingAnswerId`, etc. après une connexion réussie, sans quitter ni recharger la page.

**Ce qui a été supprimé** (ancienne implémentation) :
- `useState(loginDialogOpen)` et le `<Dialog>` local
- `resolveAuthVariant(config.auth?.variant)` pour charger `LoginForm` en lazy
- `useSite()` pour lire `config.auth?.variant`
- `import { Dialog, DialogContent, DialogTitle }` et `import { Suspense }`

**Flux actuel** :
1. L'utilisateur non connecté accède à `/coform/:formId` → `useCoFormQuery` retourne `access.reason = "not_logged_in"`
2. `CoFormAccessGuard` affiche la carte de refus "non connecté" avec un bouton "Se connecter"
3. Le clic appelle `onLogin` → `openLogin({ onSuccess: refetch })`
4. `AuthModalProvider` (monté en amont dans `RootLayout`) ouvre le modal de connexion global
5. Après succès : `refetch()` est appelé → `access` est recalculé → `CoFormAccessGuard` laisse passer les enfants

Voir [Module Auth](23-module-auth.md) pour le mécanisme global (`AuthModalProvider`, `useAuthModal`, `AuthModalOptions`).

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
  className?: string;
  showProgress?: boolean;
  showStepNumbers?: boolean;
  defaultValues?: AllStepsData; // Pré-remplissage (mode édition)
  answerId?: string;            // ID réponse en cours d'édition
  stepKey?: string;             // Afficher une seule étape (mode standalone)
  inputKey?: string;            // Afficher un seul champ (auto-résout stepKey)
  onAfterSubmit?: () => void | Promise<void>;
  readOnly?: boolean;           // Mode lecture seule → CoFormReadOnly
  initialStepKey?: string;      // Étape initiale pour wizard
  onDirtyChange?: (isDirty) => void;
  submitRef?: React.RefObject<(() => void) | null>;
  lockedFields?: string[];      // Champs en lecture seule (pointer-events-none)
}
```

**Logique de sélection du mode :**

1. `standaloneFormData` (stepKey ou inputKey résolu) → toujours `DynamicCoForm`
2. `forceSingleStep: true` → `DynamicCoForm`
3. `forceMultiStep: true` → `MultiStepCoForm`
4. `stepsCount >= multiStepThreshold` → `MultiStepCoForm`, sinon `DynamicCoForm`

**Mutation interne** : si aucun `onFinalSubmit` n'est fourni, `SmartCoForm` utilise `useCoFormFinalMutation` qui délègue au pipeline d'upload de la lib.

**Mode standalone** (`stepKey` fourni, ou `inputKey` qui auto-résout `stepKey`) : filtre `formData.inputs` pour ne garder que l'étape désignée ; `useBannerImg` est forcé à `false`.

**Mode input standalone** (`inputKey`) : filtre jusqu'à un seul champ ; `hideSubmitButton: true` + `autoSubmitOnBlur: true` → soumission automatique au blur.

**Mode readOnly** : délègue directement à `CoFormReadOnly`.

---

### DynamicCoForm

Formulaire mono-étape basé sur react-hook-form + zodResolver. Gère :

- Génération du schéma Zod via `parseCoFormFields` + `generateZodSchema`
- Rendu de tous les types de champs via switch sur `field.componentType`
- Logique conditionnelle via `useConditionalFields`
- Champs verrouillés (`lockedFields`) : wrapper `pointer-events-none opacity-60`
- Auto-submit sur blur via `useWatch` + debounce
- Propagation de `isDirty` via `onDirtyChange`
- Soumission programmatique via `submitRef`

**Bannière** : délégué à `CoFormBanner` (cf. section dédiée).

**Champ inconnu** : affiche un bloc d'erreur rouge avec le type manquant (pas de crash silencieux).

---

### MultiStepCoForm

Wizard multi-étapes avec navigation. Utilise `CoFormProvider` pour partager l'état entre étapes. Affiche un stepper visuel avec statuts `pending`/`current`/`completed`/`error`.

**Bannière** : délégué à `CoFormBanner`.

---

### CoFormModal

Dialog générique wrappant `SmartCoForm`. Gère la fermeture avec confirmation si le formulaire est modifié (`isDirty`).

```ts
export interface CoFormModalProps {
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
  closeOnSubmit?: boolean;    // défaut: true si inputKey absent, false si inputKey fourni
  className?: string;
  lockedFields?: string[];
}
```

**Comportement de fermeture** :
- Si `isDirty && !isSubmitting` → affiche `AlertDialog` avec 3 options : "Continuer l'édition", "Annuler les modifications", "Enregistrer"
- "Enregistrer" appelle `submitRef.current()` (soumission programmatique)
- `closeOnSubmit` est `false` par défaut si `inputKey` est fourni (pas de fermeture sur chaque auto-submit)

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

**Props de `CoFormAccessGuard` :**
```ts
interface CoFormAccessGuardProps {
  access: CoFormAccessInfo | null;
  onEditExisting?: () => void;   // Cas "already_answered" — bascule en mode édition
  onLogin?: () => void;          // Cas "not_logged_in" — délégué à l'appelant
  children: ReactNode;
}
```

`onLogin` est une simple callback sans paramètre — `CoFormAccessGuard` ne connaît pas le mécanisme de login utilisé. C'est `CoFormPage` qui fournit l'implémentation concrète (voir [Pages › CoFormPage](#coformpage)).

---

### CoFormReadOnly

Affiche une réponse existante en lecture seule. Caractéristiques :

- Bannière du formulaire via `CoFormBanner`
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

### CoFormBanner

Composant extrait de `DynamicCoForm` et `MultiStepCoForm`. Gère la bannière du formulaire de façon centralisée.

```ts
interface CoFormBannerProps {
  formData: CoFormData;
  hidden?: boolean;  // Si true, ne rend rien (court-circuit pour modes embedded/standalone)
}
```

**Logique de rendu :**
1. `hidden: true` → `null`
2. `formData.useBannerImg && formData.profilBannerUrl` → image avec overlay gradient dégradé + titre en overlay
3. `formData.name` (sans image) → bloc dégradé `from-primary/10 via-primary/5` avec titre
4. Sinon → `null`

---

## Types de champs

### Champs standard

Définis dans `FormFields.tsx` :

| `componentType` | Composant | Description |
|---|---|---|
| `text` | `TextField` | `<input type="text|url|email|tel|number|date">` selon `inputType` |
| `textarea` | `TextAreaField` | Zone de texte ; si `field.markdown: true` → éditeur Markdown via `MarkdownEditor` (client-only) |
| `radio` | `RadioField` | Boutons radio (`tpls.forms.cplx.radioNew`) |
| `checkbox` | `CheckboxField` | Cases à cocher multiples (`tpls.forms.cplx.checkboxNew`) |
| `sectionTitle` | `SectionTitleField` | Titre décoratif (showBar, barPosition, align, textDecoration) |
| `sectionDescription` | `SectionDescriptionField` | Texte de description (ProseContent, forceMarkdown) |

`FormFields.tsx` exporte aussi `ProseContent` (HTML ou Markdown selon le contenu) et `FieldError` (message d'erreur accessible avec `role="alert"` et `aria-describedby`).

**`MarkdownEditor`** (`components/MarkdownEditor.tsx`) : wrapper client-only autour de `@uiw/react-md-editor`. Utilise `useClientModule` (et non `React.lazy`) pour éviter l'erreur SSR `ERR_UNKNOWN_FILE_EXTENSION` causée par le CSS interne de la lib.

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

**Stockage racine** : les champs `evaluation` sont stockés **à la racine** de `answers` dans le PHP (pas dans leur sous-formulaire). `normalizeAnswerData` / `denormalizeAnswerData` gèrent ce déplacement automatiquement.

---

### FinderField

Recherche et sélection d'entités Cocolight (organisations, citoyens, événements, projets, etc.).

- Ouvre `FinderSearchModal` qui utilise `useFinderSearchResults` (React Query + debounce 300ms) appelant `searchCostum`
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

Les `data:URI` sont collectés lors de la soumission par `Answer.processUploads` (côté lib) avant l'envoi des données finales.

---

## Hooks

### useCoFormQuery

```ts
const {
  formData,      // CoFormData | null
  access,        // CoFormAccessInfo | null (raccourci de formData.access)
  isLoading,
  error,
  refetch,
  stepsCount,    // Object.keys(formData.inputs).length
  isMultiStep,   // stepsCount > 1
} = useCoFormQuery({
  formId: string,
  enabled?: boolean, // défaut: true
});
```

**queryKey** : `COFORM_QUERY_KEYS.FORM(formId)` → `["coform", "form", formId]`

Charge le formulaire via `api.form({ id: formId })`. Les informations d'accès (`CoFormAccessInfo`) sont incluses dans `formData.access` et aussi retournées directement comme `access`.

Ce fichier **re-exporte** également `useCoFormFinalMutation` depuis `mutations/file.ts` pour la compatibilité ascendante avec les consommateurs.

---

### useCoFormAnswerQuery

```ts
const {
  answer,       // CoFormAnswer | null
  answerData,   // AllStepsData | null (answer.answers)
  isLoading,
  error,
  refetch,
} = useCoFormAnswerQuery({
  formId: string,
  answerId: string,
  enabled?: boolean,
});
```

**queryKey** : `COFORM_QUERY_KEYS.FORM_ANSWER(formId, answerId, me?.id ?? null)`

Charge une réponse existante via `api.form({ id: formId })` → `form.answer({ id: answerId })`. La normalisation uploader (format Array → `{updateDate, files}`) est effectuée côté lib (`_transformServerData`), plus besoin de `normalizeAnswerData` pour les champs uploader.

---

### useCoForm / useCoFormNavigation / useCoFormStep / useCoFormSubmit

Hooks de contexte pour le wizard multi-étapes :

| Hook | Retourne |
|---|---|
| `useCoForm()` | Contexte CoForm complet (throws si hors Provider) |
| `useOptionalCoForm()` | Contexte CoForm ou `null` (safe — **nom exact**, pas `useCoFormOptional`) |
| `useCoFormNavigation()` | `{ currentStepIndex, totalSteps, isFirstStep, isLastStep, progressPercent, completedSteps, canGoNext, canGoPrevious, next(), previous(), goTo(index) }` |
| `useCoFormStep(options?)` | `{ form, fields, subFormId, stepName, isSubmitting, isCompleted, hasError, submitStep(), saveStep() }` |
| `useCoFormSubmit(options?)` | `{ allData, isSubmitting, isComplete, error, submit(), reset() }` |

**Note** : `goTo()` prend un **index numérique**, pas une `stepKey` chaîne.

Ces hooks ne fonctionnent que dans un arbre avec `CoFormProvider`.

---

### useConditionalFields

Évalue la visibilité des champs en temps réel selon les valeurs du formulaire.

```ts
const { isFieldVisible } = useConditionalFields(allFields, control);
// allFields : FormFieldMapping[] (tous les champs de l'étape)
// control : react-hook-form Control
// isFieldVisible(fieldName) : fieldName = nom react-hook-form (préfixé)
```

**Logique** :
1. Collecte les `sourceInput` (clés brutes) de toutes les règles `conditionalDisplay`
2. Résout les clés brutes en noms préfixés (via `getOriginalFieldKey`)
3. Observe uniquement ces champs via `useWatch` (optimisé)
4. Pour chaque champ cible : évalue les règles groupées par action (`show`/`hide`)
5. Opérateurs : `equals`, `notEquals`, `contains`, `matches` (regex), `isEmpty`, `isNotEmpty`
6. Logique `"and"`/`"or"` au niveau du groupe de règles
7. `hide` est prioritaire sur `show`

La fonction `evaluateRule(rule, sourceValue)` est exportée séparément pour les tests unitaires.

---

### useCoFormPermissions

```ts
const permissions = useCoFormPermissions(entity?, data?);
// entity: EntityTypes | null
// data: CoFormPermissionData = { access?: CoFormAccessInfo | null, answer?: CoFormAnswer | null }
```

Wrapper sur `usePermissions(["coform"], entity, data)`. Retourne `CoFormPermissions`. Mémoïse les données additionnelles pour stabiliser la référence passée au calculateur.

---

### useFinderSearchResults

```ts
const {
  results,     // FinderSearchResult[]
  isFetching,  // boolean
  error,       // Error | null
} = useFinderSearchResults({
  query: string,    // texte tapé (debounce appliqué en interne, 300ms)
  config: FinderConfig,
  enabled?: boolean, // défaut: true
});
```

Hook React Query pour la recherche d'entités via `entity.searchCostum`. Caractéristiques :
- Debounce 300ms intégré
- Activation uniquement si `query.length >= 2` et entité disponible
- Cache 30s
- Transforme `SearchEntity → FinderSearchResult` via `toFinderSearchResult`
- Le filtrage des éléments déjà sélectionnés se fait côté composant

---

## Factory `createCoFormMutation`

`src/modules/coform/actions/mutations/core.ts` expose une factory pour créer des hooks de mutation typés.

```ts
function createCoFormMutation<TParams = void, TData = void>(
  config: CoFormMutationConfig<TParams, TData>
): (ctx: CoFormMutationContext) => UseMutationResult<TData, Error, TParams>

interface CoFormMutationContext {
  api: Api | null;
  formId: string;
  answerId?: string;
}

// Contexte résolu (api non-null + formId validé) injecté dans action
interface ResolvedCoFormContext {
  api: Api;
  formId: string;
  answerId?: string;
}

interface CoFormMutationConfig<TParams, TData> {
  action: (ctx: ResolvedCoFormContext, params: TParams) => Promise<TData>;
  i18n: { successKey: string; errorKey: string };
  invalidate?: (ctx: CoFormMutationContext) => QueryKey[];
  getSuccessParams?: (params: TParams, data: TData) => Record<string, string>;
}
```

**Ce que la factory encapsule :**
- `useMutationWithToast` pour les toasts succès/erreur automatiques (namespace `modules/coform`)
- Résolution du contexte (`api` non-null, `formId` non-vide) avec throw `CoFormContextError` si invalide
- Invalidation React Query après succès (clés configurables par fonction)
- Paramètres dynamiques pour les messages de succès (`getSuccessParams(params, data)`)

---

## Pipeline d'upload de fichiers

`src/modules/coform/actions/mutations/file.ts` — `useCoFormFinalMutation`

Depuis le refactor Module 2, toute l'orchestration upload est **déléguée à `@communecter/cocolight-api-client` (≥ 1.0.134)**. Les anciens helpers manuels (`collectPendingUploads`, `uploadInBatches`, `normalizeUploaderValue`, `cleanUploaderUrls`, `dataUriToFile`, etc.) ont été supprimés du repo.

**Orchestration actuelle :**

1. `api.form({ id: formId })` → charge le Form parent
2. `form.answer({ id: answerId })` (mise à jour) ou `form.answer()` (création) → crée/fetch l'Answer
3. `answer.processUploads(allData)` → **pipeline complet en une ligne** : scanne les `data:URI`, upload par batches, normalise le format legacy uploader, nettoie les URLs absolues en chemins relatifs
4. `answer.data.answers = prepared` + affectation des champs annexes (`addedOptions`, `links`)
5. `answer.save()` → POST `SAVE_COFORM_ANSWER` + refresh `canEdit`/`editDeniedReason`

---

## Contrôle d'accès (CoFormAccessInfo)

Le contrôle d'accès est calculé **côté serveur** et retourné dans `CoFormData.access`.

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
    startNoConfirmation: string | null;
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

// Sous-ensemble d'une réponse utilisé pour les calculs par-réponse
interface CoFormAnswerLike {
  user?: string;    // userId de l'auteur
  canEdit?: boolean; // calculé côté serveur
  draft?: boolean;
}

interface CoFormPermissionData {
  access?: CoFormAccessInfo | null;
  answer?: CoFormAnswer | null;
}
```

`canEditAnswer` et `canDeleteAnswer` sont des fonctions pour permettre l'évaluation par réponse (pas globale).

**Enregistrement :**
```ts
// src/modules/coform/permissions/register.ts
registerPermissions<CoFormPermissions>({
  namespace: "coform",
  calculate: (ctx) => calculateCoFormPermissions(ctx.entity, ctx.me, ctx.data?.coform),
});
```

**Logique du calculateur (`calculators/coform.ts`)** :
- Sans `access` → retourne les defaults sécurisés avec `canSubmitAnswer: false`
- `canViewForm` : `false` uniquement si `access.isOnlyMember && !isMember`
- `canEditAnswer` : priorité à `answer.canEdit` (backend), sinon brouillon de l'auteur, sinon ownership
- `canDeleteAnswer` : seul l'auteur peut supprimer (pas de feature admin côté backend)

---

## CoFormProvider et contexte

`CoFormProvider` gère l'état partagé pour le wizard multi-étapes :

```ts
// src/modules/coform/contexts/CoFormContext.tsx

interface CoFormStepState {
  currentStepIndex: number;
  stepsData: AllStepsData;           // données saisies par subFormId
  completedSteps: string[];          // subFormIds complétés
  errorSteps: string[];              // subFormIds en erreur
  submittingStep: string | null;     // subFormId en cours de soumission
  addedOptions: Record<string, AddedOptionsMap>; // options dynamiques par subFormId
}

interface CoFormContextType {
  formData: CoFormData | null;
  subFormsFields: SubFormFields[];
  stepState: CoFormStepState;
  totalSteps: number;
  currentSubFormId: string | null;
  answerId?: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  isLoading: boolean;
  error: Error | null;
  // Actions
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  saveStepData: (subFormId: string, data: SubFormData) => void;
  saveAddedOptions: (subFormId: string, fieldName: string, options: string[]) => void;
  submitStepData: (subFormId: string, data: SubFormData) => Promise<void>;
  submitAllData: () => Promise<void>;
  resetForm: () => void;
}
```

`stepsDataRef` est un `useRef` synchronisé avec `stepsData` pour éviter les stale closures lors de la soumission finale (`submitAllData` lit depuis `stepsDataRef.current`).

**Props de `CoFormProvider`** :
```ts
interface CoFormProviderProps {
  children: ReactNode;
  formData: CoFormData;
  onStepSubmit?: (subFormId, data, stepIndex) => Promise<void>;
  onFinalSubmit?: (allData, addedOptions?, links?) => Promise<void>;
  submitMode?: "step" | "final" | "both";
  defaultValues?: AllStepsData;
  answerId?: string;
  initialStepKey?: string;  // subFormId de l'étape initiale
}
```

---

## Utils : formParser

`src/modules/coform/utils/formParser.ts` — fonctions pures de transformation :

| Fonction | Description |
|---|---|
| `parseCoFormFields(formData)` | `CoFormData → SubFormFields[]` avec mapping vers `componentType`, largeurs Tailwind col-span, options, configs avancées. Filtre les champs `validateStep*`. |
| `generateZodSchema(subFormsFields)` | `SubFormFields[] → z.ZodObject` dynamique avec validation `isRequired` par champ et type |
| `generateDefaultValues(subFormsFields)` | Valeurs par défaut vides typées selon `componentType` |
| `normalizeAnswerData(rawAnswers, subFormsFields)` | Déplace les champs root-level (ex: `evaluation`) de la racine vers leur sous-formulaire pour react-hook-form |
| `denormalizeAnswerData(formData, subFormsFields)` | Inverse : déplace les champs root-level du sous-formulaire vers la racine pour le format PHP |
| `extractFinderLinks(formData, subFormsFields)` | Extrait les `FinderValue` pour créer `answer.links` (`{ [type]: { [id]: { name, type } } }`) |
| `mapCoFormTypeToComponentType(coFormType)` | Mappe un type CoForm brut vers un `componentType` React |
| `getOriginalFieldKey(field)` | Retourne la clé brute du champ (sans préfixe react-hook-form) |
| `getFieldNameWithPrefix(componentType, originalKey)` | Génère le nom avec préfixe selon le type |
| `isRootLevelField(componentType)` | Indique si un type est stocké à la racine de answers |
| `hasFieldPrefix(componentType)` | Indique si un type utilise un préfixe |

**Largeurs** : `parseBootstrapWidth` (interne à `formParser.ts`) convertit les classes Bootstrap en classes Tailwind **col-span** (grille CSS 12 colonnes). Exemples : `col-lg-6 col-md-6 col-xs-12` → `"col-span-12 md:col-span-6"`. La constante `BOOTSTRAP_TO_TAILWIND_WIDTH` dans `constants/index.ts` utilise `w-*` et sert uniquement à `convertBootstrapWidth` dans `helpers.ts`.

**Mapping de types CoForm → componentType** (depuis `mapCoFormTypeToComponentType`) :

| Type CoForm | `componentType` |
|---|---|
| `text`, `url`, `email`, `tel`, `number` | `text` (avec `inputType` correspondant) |
| `textarea` | `textarea` |
| `tpls.forms.cplx.radioNew` | `radio` |
| `tpls.forms.cplx.checkboxNew` | `checkbox` |
| `tpls.forms.cplx.multiCheckboxPlus` | `multiCheckboxPlus` |
| `tpls.forms.cplx.multiRadio` | `multiRadio` |
| `tpls.forms.cplx.evaluation`, `tpls.forms.evaluation.evaluation` | `evaluation` |
| `tpls.forms.cplx.finder`, `tpls.forms.finder.finder` | `finder` |
| `tpls.forms.cplx.simpleTable` | `simpleTable` |
| `tpls.forms.uploader` | `uploader` |
| `sectionTitle`, `tpls.forms.sectionTitle` | `sectionTitle` |
| `tpls.forms.sectionDescription` | `sectionDescription` |
| `select` | `select` |
| Inconnu | `unknown` |

**Préfixes de champs** (FIELD_PREFIX_MAP) : `finder` → `"finder"`, `multiCheckboxPlus` → `"multiCheckboxPlus"`, `multiRadio` → `"multiRadio"`, `evaluation` → `"evaluation"`. Ces préfixes sont ajoutés au nom du champ pour react-hook-form (ex: champ `abc123` de type finder → `name: "finderabc123"`).

---

## Utils : helpers, toFinderSearchResult, toRelativeImageUrl

`src/modules/coform/utils/helpers.ts` :

| Fonction | Description |
|---|---|
| `convertBootstrapWidth(bootstrapClass?)` | Bootstrap → `w-full md:w-1/2` etc. (utilise `BOOTSTRAP_TO_TAILWIND_WIDTH`) |
| `generateFieldId(subFormId, fieldKey)` | Génère `"${subFormId}_${fieldKey}"` |
| `extractMongoId(id)` | Extrait l'ID MongoDB depuis `{ $id: string } | string` |
| `formatTimestamp(timestamp)` | Formate un timestamp Unix en date lisible |
| `isStepComplete(data, requiredFields)` | Vérifie si tous les champs requis sont remplis |
| `mergeStepsData(stepsData)` | Fusionne `AllStepsData` → `SubFormData` plat |

`src/modules/coform/utils/toFinderSearchResult.ts` :

```ts
function toFinderSearchResult(entity: SearchEntity, fallbackType: FinderElementType): FinderSearchResult
```

Transforme une instance SDK (`SearchEntity`) en `FinderSearchResult` plat pour l'UI Finder. Lit `entity.id` et `entity.serverData.*`. Évite l'extraction manuelle de `_id.$oid`.

`src/modules/coform/utils/toRelativeImageUrl.ts` :

```ts
function toRelativeImageUrl(absoluteOrRelative: string | undefined): string | undefined
```

Convertit une URL d'image absolue en chemin relatif (`pathname + search`) pour une persistance robuste en base de données (migration env, fédération inter-instances). `FinderElementCard` rebase le chemin relatif à la lecture via sa prop `baseUrl`.

---

## Types principaux

| Type | Description |
|---|---|
| `CoFormData` | Structure complète d'un formulaire (id, name, inputs, params, subForms, access, thankYou, bannière) |
| `CoFormAnswer` | Réponse : `answers: AllStepsData`, `canEdit`, `editDeniedReason`, user, created, updated, draft, finished |
| `CoFormAccessInfo` | Info d'accès serveur (canAnswer, reason, formStatus, dates, flags) |
| `CoFormAnswerSummary` | Aperçu d'une réponse existante (id, createdAt, updatedAt, answers?, preview?) |
| `CoFormThankYouConfig` | Config page remerciement (title, message, additionalInfo, accentColor, showSubmitAnother) |
| `CoFormAnswerLike` | Sous-ensemble `{ user?, canEdit?, draft? }` pour les calculs de permissions par réponse |
| `FormFieldMapping` | Mapping champ pour react-hook-form (name, label, componentType, options, width col-span, configs avancées) |
| `SubFormFields` | `{ subFormId, subFormName, fields: FormFieldMapping[] }` |
| `CoFormStepState` | `{ currentStepIndex, stepsData, completedSteps, errorSteps, submittingStep, addedOptions }` |
| `AllStepsData` | `Record<subFormId, SubFormData>` — données tous sous-formulaires |
| `SubFormData` | `Record<fieldKey, FormFieldValue>` |
| `SubFormDataWithMeta` | `{ data: SubFormData, _addedOptions?: AddedOptionsMap }` |
| `FormFieldValue` | Union de tous les types de valeurs possibles |
| `AddedOptionsMap` | `Record<fieldName, string[]>` — options ajoutées dynamiquement |
| `SubmitMode` | `"step" \| "final" \| "both"` |
| `CoFormVariant` | `"default" \| "wizard" \| "stepper" \| "tabs"` |
| `ConditionalRule` | `{ sourceInput, operator, value, action, targetInput?, targetStep? }` |
| `ConditionalDisplay` | `{ enabled, logic: "and"\|"or", rules: ConditionalRule[] }` |
| `EvaluationConfig` | Config évaluation (categories, criterias, criteriaLabel, categoryNumber, categoryTitle, voteType, multiVotePerLine, colours/emojis/noteMax/starCount) |
| `FinderConfig` | Config finder (type, filters, multiple, addNew, invite, singleAnswerPerElement, addToLinks...) |
| `FinderElement` | `{ id, name, type, img?, address? }` |
| `FinderValue` | `Record<string, FinderElement> \| null` |
| `FinderSearchResult` | `{ id, name, type, profilThumbImageUrl?, email?, address? }` |
| `FinderLinksMap` | `Record<type, Record<id, { name, type }>>` — liens à injecter dans `answer.links` |
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
// Re-exporté proprement depuis ./constants/index.ts.
//
// `userId` (3ᵉ param de FORM_ANSWER / ANSWER_FILES) isole le cache par
// utilisateur connecté pour éviter une fuite cross-user.
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
DISPLAY_VARIANTS = { DEFAULT: "default", WIZARD: "wizard", ACCORDION: "accordion", TABS: "tabs", STEPPER: "stepper" }
STEP_STATUS = { PENDING: "pending", CURRENT: "current", COMPLETED: "completed", ERROR: "error" }

// Mapping types CoForm → composants (simplifié — la table complète est dans formParser.ts)
COFORM_TYPE_MAPPING = {
  text: "text", textarea: "textarea",
  "tpls.forms.cplx.radioNew": "radio",
  "tpls.forms.cplx.checkboxNew": "checkbox",
  select: "select", email: "email", number: "number",
  date: "date", file: "file", url: "url",
}

// Largeurs Bootstrap → classes Tailwind w-* (utilisé par convertBootstrapWidth dans helpers.ts)
BOOTSTRAP_TO_TAILWIND_WIDTH = {
  "col-lg-12 col-md-12 col-xs-12": "w-full",
  "col-lg-6 col-md-6 col-xs-12": "w-full md:w-1/2",
  // ...etc
}
```

---

## i18n

**Namespace** : `modules/coform`

Enregistrement : importer `"../i18n/i18n"` en side-effect ou utiliser `useLoadNamespace("modules/coform")`.

Usage dans les composants :
```tsx
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";

useLoadNamespace("modules/coform");
const t = useT("modules/coform");
t("coform.navigation.next"); // → "Suivant"
t("coform.access.formClosed.title"); // → "Période de réponse terminée"
```

**Groupes de clés :**

| Groupe | Exemples de clés |
|---|---|
| `coform.steps.*` | `step`, `of`, `completed`, `current`, `pending` |
| `coform.navigation.*` | `next`, `previous`, `submit`, `save`, `reset` |
| `coform.progress.*` | `title`, `percent` |
| `coform.validation.*` | `required`, `minLength`, `maxLength`, `email`, `url`, `number`, `selectOption`, `selectAtLeastOne` |
| `coform.status.*` | `loading`, `submitting`, `success`, `updateSuccess`, `error`, `stepSuccess`, `stepError` |
| `coform.errors.*` | `formNotFound`, `networkError`, `serverError` |
| `coform.banner.*` | `alt` |
| `coform.answer.*` | `submittedAt`, `updatedAt`, `author`, `editDenied.{reason}` |
| `coform.thankYou.*` | `title`, `message`, `updateTitle`, `updateMessage`, `editAnswer`, `submitAnother`, `goHome` |
| `coform.access.*` | `alreadyAnswered.{title,description,editButton,viewButton}`, `notMember.{title,description}`, `formNotStarted.{title,description}`, `formClosed.{title,description}`, `formInactive.{title,description}`, `notLoggedIn.{title,description,loginButton}`, `dateRange`, `dateStart`, `dateEnd` |
| `coform.modal.*` | `unsavedTitle`, `unsavedDescription`, `continueEditing`, `discardChanges`, `save`, `ariaTitleFallback` |
| `coform.smart.*` | `loading`, `errorTitle`, `retry`, `emptyMessage` |
| `coform.multiCheckboxPlus.*` | `maxSelections`, `withInput`, `enterDetails`, `textRequired`, `rank`, `addNewValue` |
| `coform.evaluation.*` | `noCategories` |
| `coform.uploader.*` | `addFile`, `addFiles`, `dropzoneLabel`, `maxFiles`, `maxSize`, `invalidExtension`, `fileTooLarge`, `tooManyFiles`, `deleteFile`, `gallery.{openPdf,download}` |
| `coform.finder.*` | `fallbackElement`, `modal.{title,searchPlaceholder,noResults,addNewButton,validate,...}`, `types.{organizations,citoyens,...}` |
| `coform.answerPicker.*` | `title`, `description`, `answerLabel`, `updated`, `newAnswer` |

---

## Prefetch SSR

`src/modules/coform/prefetch/index.ts` expose des helpers pour les loaders SSR :

```ts
// Précharger les données d'un formulaire (évite waterfall client)
// Requiert un fetchFn qui sera appelé par React Query si le cache est vide
await prefetchCoFormQuery(queryClient, formId, fetchFn);

// Invalider après mutation
invalidateCoFormQuery(queryClient, formId);
invalidateCoFormAnswersQuery(queryClient, formId);
```

**Note** : `prefetchCoFormQuery` prend **trois** paramètres (`queryClient`, `formId`, `fetchFn`). Le `fetchFn` est requis car le prefetch SSR n'a pas accès au hook `useCocolight`.

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
| `variant` | `"default"\|"wizard"\|"stepper"\|"tabs"` | `"wizard"` | Variante d'affichage |
| `submitMode` | `"step"\|"final"\|"both"` | `"final"` | Quand sauvegarder |
| `title` | `LocalizedString?` | — | Titre de la section |
| `description` | `LocalizedString?` | — | Description |
| `showProgress` | `boolean` | `true` | Barre de progression |
| `showStepNumbers` | `boolean` | `true` | Numéros d'étapes |
| `allowFreeNavigation` | `boolean` | `false` | Navigation libre entre étapes |
| `redirectAfterSubmit` | `string?` | — | URL redirection post-soumission |
| `className` | `string?` | — | Classe CSS additionnelle pour le conteneur section |

**Comportement de `variant` dans `CoFormSection`** :
- `"wizard"` → `forceMultiStep: true` sur `SmartCoForm`
- `"default"` → `forceSingleStep: true` sur `SmartCoForm`
- `"stepper"`, `"tabs"` → pas de forçage (sélection automatique selon `stepsCount`)

---

## Voir aussi

- [Architecture](03-architecture.md) — pattern `createPageActionsState`, modules
- [Module Profil](08-module-profil.md) — CoFormPage accessible depuis les profils
- [Module Auth](23-module-auth.md) — `useAuthModal`, `AuthModalProvider`, `AuthModalOptions` — mécanisme de login global utilisé par `CoFormPage`
- [Tests](15-tests.md) — tests CoForm helpers (formParser.test.ts, helpers.test.ts, useConditionalFields.test.ts, coform.test.ts, SmartCoForm.test.tsx, CoFormProvider.test.tsx, useFinderSearchResults.test.tsx, toFinderSearchResult.test.ts, toRelativeImageUrl.test.ts)
- `src/modules/coform/README.md` — documentation technique complémentaire (backend PHP associé, personnalisation, step-mode status)
