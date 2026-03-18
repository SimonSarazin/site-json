# Module CoForm - Documentation

## Vue d'ensemble

Le module CoForm permet d'afficher et de gérer des formulaires dynamiques multi-étapes à partir des données retournées par l'API CoForm. Il transforme automatiquement la structure CoForm en formulaires React avec validation Zod, gestion par react-hook-form, contrôle d'accès serveur (dates, membership, active flag), et support de la consultation/édition de réponses existantes.

## Architecture

```
coform/
├── components/
│   ├── CoFormAccessGuard.tsx    # Garde d'accès (6 cas : already_answered, not_member, form_not_started, form_closed, form_inactive, not_logged_in)
│   ├── CoFormReadOnly.tsx       # Affichage d'une réponse en lecture seule (markdown, badges, grille)
│   ├── CoFormThankYou.tsx       # Page de remerciement après soumission (personnalisable)
│   ├── DynamicCoForm.tsx        # Formulaire dynamique mono-étape (react-hook-form + Zod)
│   ├── FormFields.tsx           # Composants de champs : TextField, TextAreaField, RadioField, CheckboxField, HintText
│   ├── MultiStepCoForm.tsx      # Formulaire multi-étapes avec stepper/wizard/tabs
│   └── SmartCoForm.tsx          # Wrapper intelligent : choisit mono ou multi-étape automatiquement
├── constants/
│   └── index.ts                 # Type mapping, largeurs Bootstrap→Tailwind, query keys, modes, variantes
├── contexts/
│   ├── CoFormContext.tsx         # Définition du contexte React (CoFormContextType, CoFormStepState)
│   └── CoFormProvider.tsx       # Provider : état multi-étapes, soumissions, navigation, stepsDataRef
├── hooks/
│   ├── useCoForm.tsx            # Accès au contexte CoForm (+ variante optionnelle)
│   ├── useCoFormNavigation.tsx  # Navigation : next(), previous(), goTo(), progressPercent
│   ├── useCoFormQuery.tsx       # React Query : chargement formulaire, soumissions, chargement réponse
│   └── useCoFormStep.tsx        # Hook par étape : react-hook-form configuré avec Zod + reset on step change
├── i18n/
│   ├── en.json                  # Traductions anglaises
│   ├── fr.json                  # Traductions françaises
│   └── i18n.ts                  # Enregistrement des bundles dans le namespace modules/coform
├── pages/
│   ├── CoFormAnswerPage.tsx     # Page réponse : readonly ou édition, garde d'édition serveur (canEdit)
│   └── CoFormPage.tsx           # Page principale : garde d'accès, soumission, thank you page
├── prefetch/
│   └── index.ts                 # prefetchCoFormQuery, invalidateCoFormQuery, invalidateCoFormAnswersQuery
├── utils/
│   ├── formParser.ts            # Parsing CoForm → SubFormFields[], Zod schema, default values, grid conversion
│   ├── helpers.ts               # convertBootstrapWidth, generateFieldId, extractMongoId, formatTimestamp, isStepComplete, mergeStepsData
│   └── index.ts                 # Re-export formParser + helpers
├── index.ts                     # Barrel export centralisé
├── module.config.ts             # Config module : name: "coform", type: "core", enabled: true
├── routes.tsx                   # Définition des routes (ModuleRouteFactory)
├── schema.ts                    # Schemas Zod pour la config du module (variantes, modes, sections)
└── types.ts                     # Définitions TypeScript complètes
```

## Routes

| Route | Composant | Description |
|---|---|---|
| `/coform/:formId` | `CoFormPage` | Formulaire dynamique avec contrôle d'accès |
| `/coform/:formId/answer/:answerId?mode=edit\|readonly` | `CoFormAnswerPage` | Consultation ou édition d'une réponse existante |

Les routes sont injectées dynamiquement dans le router principal via `ModuleRouteFactory`.

## Utilisation

### 1. Afficher un formulaire CoForm

```tsx
import { SmartCoForm } from "@/modules/coform";
import type { CoFormData } from "@/modules/coform";

function MyFormPage({ formData }: { formData: CoFormData }) {
  const handleSubmit = async (data: AllStepsData) => {
    console.log("Données soumises:", data);
  };

  return (
    <SmartCoForm
      formData={formData}
      submitMode="final"
      onFinalSubmit={handleSubmit}
      showProgress={true}
      showStepNumbers={true}
    />
  );
}
```

`SmartCoForm` détecte automatiquement si le formulaire a une ou plusieurs étapes et utilise `DynamicCoForm` ou `MultiStepCoForm` en conséquence.

### 2. Formulaire multi-étapes avec contexte

```tsx
import { CoFormProvider, MultiStepCoForm } from "@/modules/coform";

<CoFormProvider formData={formData} submitMode="final">
  <MultiStepCoForm
    formData={formData}
    onFinalSubmit={handleSubmit}
  />
</CoFormProvider>
```

Le `CoFormProvider` gère :
- L'état de chaque étape (données, statut)
- La navigation entre étapes
- La soumission finale avec `stepsDataRef` (évite les stale closures)

### 3. Hooks disponibles

| Hook | Description |
|---|---|
| `useCoForm()` | Accès au contexte CoForm |
| `useCoFormStep()` | Config react-hook-form + Zod pour l'étape courante |
| `useCoFormNavigation()` | `next()`, `previous()`, `goTo()`, `progressPercent` |
| `useCoFormQuery({ formId })` | Charge le formulaire + access info via React Query |
| `useCoFormAnswerQuery({ formId, answerId })` | Charge une réponse existante |
| `useCoFormStepMutation({ formId })` | Sauvegarde locale par étape |
| `useCoFormFinalMutation({ formId, answerId? })` | Soumission/mise à jour finale |

### 4. Types de champs supportés

| Type CoForm | Composant React | Description |
|---|---|---|
| `text` | `TextField` | Input texte simple |
| `textarea` | `TextAreaField` | Zone de texte avec éditeur Markdown (@uiw/react-md-editor) |
| `tpls.forms.cplx.radioNew` | `RadioField` | Boutons radio |
| `tpls.forms.cplx.checkboxNew` | `CheckboxField` | Cases à cocher (multiple) |

Le mapping est défini dans `COFORM_TYPE_MAPPING` (constants/index.ts).

### 5. Validation automatique

Le module génère dynamiquement un schéma Zod basé sur les règles CoForm :

- **Champs requis** : `isRequired: true` → validation `.min(1)`
- **Types** : text/textarea → `z.string()`, checkbox → `z.array(z.string())`
- **Options** : radio/checkbox → `z.enum([...])` basé sur `params.list`
- **Largeurs** : conversion automatique Bootstrap (`col-md-6`) → Tailwind (`col-span-6`)

### 6. Contrôle d'accès

Le contrôle d'accès est calculé **côté serveur** (`Coform::getFormAccessInfo()`) et retourné dans `CoFormAccessInfo` :

| Vérification | Raison | Description |
|---|---|---|
| Flag `active` | `form_inactive` | Le formulaire est désactivé par l'admin |
| Dates (dual system) | `form_not_started` / `form_closed` | Dates pour comptes confirmés et temporaires séparées |
| Membership | `not_member` | Réservé aux membres de la communauté |
| Une réponse par personne | `already_answered` | L'utilisateur a déjà répondu (avec lien vers modification) |
| Login requis | `not_logged_in` | Connexion obligatoire |

Le composant `CoFormAccessGuard` affiche une page d'erreur visuelle adaptée à chaque cas.

### 7. Page de remerciement

Après soumission, `CoFormThankYou` affiche une page style Google Forms. Elle est personnalisable via `CoFormThankYouConfig` :

```ts
interface CoFormThankYouConfig {
  title?: string;
  message?: string;
  additionalInfo?: string;
  accentColor?: string;
  showSubmitAnother?: boolean;
}
```

### 8. Mode lecture seule

`CoFormReadOnly` affiche une réponse existante avec :
- Bannière du formulaire
- Métadonnées (auteur, dates)
- Sections par étape avec grille responsive
- Rendu **Markdown** pour les champs textarea (ReactMarkdown + remarkGfm)
- **Badges** pour les valeurs de checkbox
- Badge Oui/Non pour les booléens

### 9. Autorisation d'édition (serveur)

L'endpoint `findanswered` retourne `canEdit` et `editDeniedReason` pour chaque réponse :

| Raison | Description |
|---|---|
| `not_logged_in` | Non connecté |
| `not_owner` | L'utilisateur n'est pas le propriétaire |
| `form_inactive` | Formulaire désactivé |
| `form_closed` | Période de modification terminée |

`CoFormAnswerPage` masque le bouton "Modifier" si `canEdit === false` et affiche un bandeau d'erreur si le mode edit est demandé sans autorisation.

## i18n

**Namespace** : `modules/coform`

Langues supportées : français (`fr.json`), anglais (`en.json`).

Utilisation :
```tsx
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n"; // side-effect pour enregistrer les traductions

useLoadNamespace("modules/coform");
const t = useT("modules/coform");

t("coform.navigation.next"); // → "Suivant"
t("coform.answer.submittedAt", undefined, { date: "..." }); // → "Soumis le ..."
```

Groupes de clés : `steps`, `navigation`, `progress`, `validation`, `status`, `errors`, `banner`, `answer`, `thankYou`, `access`.

## Constantes

```ts
COFORM_QUERY_KEYS = {
  form: (formId) => ["coform", "form", formId],
  formAnswers: (formId) => ["coform", "answers", formId],
  formAnswer: (formId, answerId) => ["coform", "answer", formId, answerId],
};

SUBMIT_MODES = { STEP: "step", FINAL: "final", BOTH: "both" };
DISPLAY_VARIANTS = { DEFAULT: "default", WIZARD: "wizard", ACCORDION: "accordion", TABS: "tabs", STEPPER: "stepper" };
STEP_STATUS = { PENDING: "pending", CURRENT: "current", COMPLETED: "completed", ERROR: "error" };
```

## Types principaux

| Type | Description |
|---|---|
| `CoFormData` | Données complètes d'un formulaire (inputs, params, subForms, access, thankYou, bannière) |
| `CoFormAnswer` | Réponse complète avec `answers: AllStepsData`, `canEdit`, `editDeniedReason`, métadonnées |
| `CoFormAccessInfo` | Info d'accès serveur : `canAnswer`, `reason`, `formStatus`, dates, flags |
| `CoFormThankYouConfig` | Configuration de la page de remerciement |
| `FormFieldMapping` | Mapping d'un champ pour react-hook-form (name, label, type, componentType, options, width...) |
| `SubFormFields` | `{ subFormId, subFormName, fields: FormFieldMapping[] }` |
| `AllStepsData` | `Record<string, SubFormData>` — toutes les données par étape |
| `FormFieldValue` | `string | number | boolean | string[] | null | undefined` |

## Backend PHP associé

| Fichier | Description |
|---|---|
| `Coform.php` | Modèle : `getFormAccessInfo()`, `saveAnswer()`, `getCompleteFormData()`, `extractDateISO()` |
| `GetFormByIdAction.php` | Charge un formulaire + enrichit avec access info |
| `SaveAnswerAction.php` | Sauvegarde/mise à jour avec contrôle d'accès (CREATE vs UPDATE) |
| `FindAnsweredByIdAction.php` | Charge une réponse + calcule `canEdit` / `editDeniedReason` |

## Personnalisation

### Ajouter un nouveau type de champ

1. Ajouter le mapping dans `COFORM_TYPE_MAPPING` (`constants/index.ts`)
2. Créer le composant dans `components/FormFields.tsx`
3. Ajouter la logique de validation dans `generateZodSchema()` (`utils/formParser.ts`)
4. Mettre à jour le rendu dans `DynamicCoForm.tsx` et `CoFormReadOnly.tsx`

### Modifier les styles

Les composants utilisent shadcn/ui + Tailwind CSS. Pour personnaliser :
- Modifier les classes Tailwind dans `FormFields.tsx`
- Ajuster les composants UI dans `@/components/ui/`
- Les largeurs de grille sont converties automatiquement depuis Bootstrap via `BOOTSTRAP_TO_TAILWIND_WIDTH`
