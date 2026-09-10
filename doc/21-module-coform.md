[← Retour à l'index](README.md)

# Module CoForm

**Sommaire**

- [Module CoForm](#module-coform)
  - [Vue d'ensemble](#vue-densemble)
  - [Architecture interne](#architecture-interne)
  - [Routes](#routes)
  - [Pages](#pages)
    - [CoFormPage](#coformpage)
    - [CoFormPlacePage — vue collaborative « par lieu »](#coformplacepage--vue-collaborative--par-lieu-)
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
    - [CategorizedCheckboxField](#categorizedcheckboxfield)
    - [CommonTableField](#commontablefield)
    - [TimeSlotsField](#timeslotsfield)
    - [DynamicFieldsField](#dynamicfieldsfield)
    - [LocationField](#locationfield)
  - [Brouillon local, récap d'erreurs et sortie non sauvegardée](#brouillon-local-récap-derreurs-et-sortie-non-sauvegardée)
  - [Hooks](#hooks)
    - [useCoFormQuery](#usecoformquery)
    - [useCoFormAnswerQuery](#usecoformanswerquery)
    - [useCoForm / useCoFormNavigation / useCoFormStep / useCoFormSubmit](#usecoform--usecoformnavigation--usecoformstep--usecoformsubmit)
    - [useConditionalFields](#useconditionalfields)
    - [useCoFormPermissions](#usecoformpermissions)
    - [useFinderSearchResults](#usefindersearchresults)
  - [Factory `createCoFormMutation`](#factory-createcoformmutation)
  - [Pipeline d'upload de fichiers](#pipeline-dupload-de-fichiers)
    - [Suppression de fichier : DIFFÉRÉE au save](#suppression-de-fichier--différée-au-save)
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
- Champs avancés : evaluation (tableau multi-critères), commonTable (matrice usage × solution + catalogue collaboratif), finder (recherche entités), simpleTable (tableau 2D), multiRadio (radio + texte), multiCheckboxPlus (checkbox + options dynamiques), categorizedCheckbox (cases à cocher 2 niveaux), timeSlots (créneaux horaires), dynamicFields (lignes dynamiques), location (adresse géolocalisée)
- Brouillon localStorage, récapitulatif d'erreurs et avertissement de sortie non sauvegardée

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
│   ├── AnswerActivityDialog.tsx # Historique d'audit d'une réponse (useCoFormAnswerHistory)
│   ├── CategorizedCheckboxField.tsx # Cases à cocher 2 niveaux (options manuelles ou commonTable distant)
│   ├── CoFormAccessGuard.tsx    # Garde d'accès (6 cas)
│   ├── CoFormAnswerPicker.tsx   # Sélecteur de réponse parmi plusieurs existantes
│   ├── CoFormBanner.tsx         # Bannière partagée (image + overlay ou dégradé + titre)
│   ├── CoFormModal.tsx          # Dialog générique wrappant SmartCoForm
│   ├── CoFormReadOnly.tsx       # Affichage lecture seule d'une réponse
│   ├── CoFormSection.tsx        # Section JSON type "coform" pour SectionRenderer
│   ├── CoFormThankYou.tsx       # Page de remerciement personnalisable
│   ├── CommonTableField.tsx     # Matrice usage × solution (commonTableV2) + catalogue collaboratif
│   ├── CommonTableContributorsDialog.tsx # Contributeurs d'une ligne de commonTable
│   ├── DraftRecoveryBanner.tsx  # Bannière brouillon : restaurable / périmé
│   ├── DynamicCoForm.tsx        # Formulaire mono-étape (react-hook-form + Zod)
│   ├── DynamicFieldsField.tsx   # Répéteur de lignes à sous-champs configurés
│   ├── ErrorSummary.tsx         # Récap des champs invalides (scroll + halo au clic)
│   ├── EvaluationField.tsx      # Champ tableau d'évaluation multi-critères
│   ├── EvaluationVoteCell.tsx   # Cellule de vote (colour/emoji/note/star)
│   ├── FinderElementCard.tsx    # Carte d'un élément sélectionné par Finder
│   ├── FinderField.tsx          # Champ recherche/sélection d'entités Cocolight
│   ├── FinderSearchModal.tsx    # Modale de recherche du Finder
│   ├── FormFields.tsx           # TextField, TextAreaField, RadioField, CheckboxField,
│   │                            #   SectionTitleField, SectionDescriptionField, FieldError
│   │                            #   (+ ré-export de ProseContent, qui vit dans @/components/shared)
│   ├── LocationField.tsx        # Adresse géolocalisée (parité dynForm formLocality) via AddressPicker
│   ├── MarkdownEditor.tsx       # Éditeur Markdown client-only (@uiw/react-md-editor) — thème global,
│   │                            #   toolbar réduite, preview sanitisée (renderMarkdown), overflow={false}
│   ├── MultiCheckboxPlusField.tsx # Checkbox + champ texte optionnel par option
│   ├── MultiEvalChartDialog.tsx # Dialog "Voir les évaluations" (radars agrégés d'une réponse)
│   ├── MultiEvalRadarChart.tsx  # Rendu d'un radar (recharts, importé dynamiquement)
│   ├── MultiEvalRadarTabs.tsx   # Un onglet par step pour les radars multi-eval
│   ├── MultiRadioField.tsx      # Radio à sélection unique avec options simples/complexes
│   ├── MultiStepCoForm.tsx      # Wizard multi-étapes avec navigation
│   ├── PlaceFormView.tsx        # Vue collaborative : réponse partagée d'un lieu
│   ├── PlacesListView.tsx       # Vue collaborative : liste des lieux éligibles du user
│   ├── ReadOnlyUploaderGallery.tsx # Galerie images en lecture seule
│   ├── SimpleTableField.tsx     # Champ tableau 2D éditable
│   ├── SmartCoForm.tsx          # Wrapper intelligent mono/multi-étape
│   ├── SmartCoForm.test.tsx     # Tests unitaires SmartCoForm
│   ├── TimeSlotsField.tsx       # Répéteur de créneaux {jour, début, fin}
│   └── UploaderField.tsx        # Upload fichiers/images avec prévisualisation
├── constants/
│   ├── index.ts             # COFORM_TYPE_MAPPING, BOOTSTRAP_TO_TAILWIND_WIDTH,
│   │                        #   SUBMIT_MODES, DISPLAY_VARIANTS, STEP_STATUS + re-export queryKeys
│   └── queryKeys.ts         # COFORM_QUERY_KEYS (source de vérité), CoformQueryKeyType
├── contexts/
│   ├── CoFormContext.tsx     # Définition CoFormContextType, CoFormStepState
│   ├── CoFormProvider.tsx   # Provider : état multi-étapes, navigation, stepsDataRef, brouillon localStorage
│   ├── CoFormProvider.test.tsx # Tests unitaires CoFormProvider
│   ├── CommonTableCatalogsContext.ts   # Contexte des catalogues collaboratifs commonTable
│   └── CommonTableCatalogsProvider.tsx
├── hooks/
│   ├── useCategorizedCheckboxOptions.ts # Arbre d'options (liste manuelle ∪ questions commonTable distantes)
│   ├── useCoForm.tsx            # useCoForm() + useOptionalCoForm()
│   ├── useCoFormAnswerFiles.tsx # Charge fichiers legacy d'une réponse
│   ├── useCoFormAnswerHistory.tsx # Historique d'audit d'une réponse (≤ 200 entrées, auth serveur)
│   ├── useCoFormCatalogs.ts     # Catalogues collaboratifs commonTable en UN appel batch (0 si aucun)
│   ├── useCoFormDraft.ts        # Brouillon localStorage (TTL 30 j, debounce 500 ms, conflit serveur)
│   ├── useCoFormNavigation.tsx  # useCoFormNavigation() + useCoFormSubmit()
│   ├── useCoFormPermissions.ts  # Wrapper usePermissions(["coform"])
│   ├── useCoFormQuery.tsx       # useCoFormQuery, useCoFormAnswerQuery, useCoFormStepMutation
│   │                            #   (re-exporte useCoFormFinalMutation depuis mutations/file.ts)
│   ├── useCoFormStep.tsx        # react-hook-form + Zod par étape
│   ├── useCommonTableCatalog.ts # Catalogue (lecture seule) d'un input commonTable
│   ├── useCommonTableContributors.tsx # Contributions individuelles d'une ligne de commonTable
│   ├── useConditionalFields.ts  # Visibilité conditionnelle des champs
│   ├── useConditionalFields.test.ts
│   ├── useElementSummary.ts     # Résume un élément (nom + image) via la méthode entity du SDK
│   ├── useFinderElementImages.ts # Re-résout au runtime l'image des éléments finder (img figé/absent)
│   ├── useFinderSearchResults.ts  # Recherche d'entités via searchCostum (RQ + debounce)
│   ├── useFinderSearchResults.test.tsx
│   ├── useMultiEvalData.tsx     # Datasets agrégés des évaluations multiples (radar)
│   └── useUnsavedChangesWarning.ts # beforeunload tant que le formulaire est dirty
├── i18n/
│   ├── en.json / fr.json    # Traductions
│   └── i18n.ts              # Enregistrement namespace "modules/coform"
├── pages/
│   ├── CoFormAnswerPage.tsx # Page réponse : readonly ou édition
│   ├── CoFormPage.tsx       # Page principale : accès, soumission, thank you
│   └── CoFormPlacePage.tsx  # Vue collaborative par lieu (liste / détail)
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
│   ├── categorizedCheckbox.ts # Helpers purs : arbre d'options + résolution des clés `<index>_<slug>`
│   ├── coformLocality.ts    # Sérialisation ↔ désérialisation de la valeur d'un champ adresse
│   ├── commonTableNote.ts   # 5 paliers de couleur de la note (alignés sur commonTableV2.php)
│   ├── commonTableUsage.ts  # Règle de regroupement par usage (partagée avec categorizedCheckbox)
│   ├── finderFilters.ts     # buildFinderMongoFilters (inclusions + exclusions) — voir FinderField
│   ├── formatRelative.ts    # Ancienneté relative (tolère timestamp en s ou en ms)
│   ├── formParser.ts        # parseCoFormFields, generateZodSchema, generateDefaultValues,
│   │                        #   normalizeAnswerData, denormalizeAnswerData, extractFinderLinks,
│   │                        #   mapCoFormTypeToComponentType, getOriginalFieldKey,
│   │                        #   getFieldNameWithPrefix, isRootLevelField, hasFieldPrefix
│   ├── formParser.test.ts
│   ├── helpers.ts           # convertBootstrapWidth, generateFieldId, extractMongoId,
│   │                        #   formatTimestamp, isStepComplete, mergeStepsData
│   ├── helpers.test.ts
│   ├── index.ts             # Re-export formParser + helpers + toFinderSearchResult + toRelativeImageUrl
│   ├── simpleTable.ts       # Helpers purs de mutation des lignes (mode editInModal)
│   ├── slugify.ts           # Réplique EXACTE du slugifyString legacy (moitié d'une clé persistée)
│   ├── timeSlots.ts         # Logique pure des créneaux (format legacy, lecture des données 12 h)
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
| `/coform/:formId/place` | `CoFormPlacePage` | Vue collaborative : liste des lieux du user (`PlacesListView`) |
| `/coform/:formId/place/:placeId` | `CoFormPlacePage` | Vue collaborative : réponse partagée d'un lieu (`PlaceFormView`) |

Le loader `coformLoader` extrait et valide `formId` (404 si absent) — il sert aussi les deux routes `place`. Le loader `coformAnswerLoader` extrait `formId`, `answerId`, et le paramètre `mode` (défaut: `"readonly"`).

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

### CoFormPlacePage — vue collaborative « par lieu »

`pages/CoFormPlacePage.tsx` sert les **deux** routes `place` : sans `:placeId` elle rend `PlacesListView`, avec
elle rend `PlaceFormView`.

- **`PlacesListView`** liste les lieux (organisations) de l'utilisateur via `useUserEligiblePlaces`
  (`modules/profil/hooks/useMembershipQuery` → `user.getEligiblePlaces`), appelé avec les filtres Mongo du **finder partagé** du
  formulaire (`getSharedFinderInfo` → `buildFinderMongoFilters`, cf. [FinderField](#finderfield)) et
  `notSourceKey`. Le filtrage métier est donc fait **côté serveur**, ce qui garde la pagination correcte. La vue
  sépare les lieux validés (admin/membre, via `calculateOrganizationPermissions`) des demandes en attente, et
  propose `FinderSearchModal` pour rejoindre un lieu absent de la liste. Deux props d'intégration :
  `onOpenPlace` (rester dans une modale au lieu de naviguer) et `hidePageChrome` (montée dans un `Dialog`).
- **`PlaceFormView`** pré-remplit le finder partagé avec le lieu sélectionné, puis rend `SmartCoForm`.
- Sur le détail, `useCoFormQuery` reçoit `elementId: placeId` + `elementType: "organizations"` pour que le
  serveur renvoie l'`access` de la **réponse partagée du lieu**, et non la réponse personnelle de l'utilisateur.

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
  discardDraftRef?: React.RefObject<(() => void) | null>; // rejet explicite du brouillon
  baseUpdatedAt?: number | null;// `answer.updated` — OBLIGATOIRE dès qu'on passe `answerId`
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

> **Clé de payload en mono-étape.** `SmartCoForm` emploie l'étape **parsée** (`subFormsFields[0].subFormId`),
> pas la première clé déclarée d'`inputs` — les deux peuvent diverger, et c'est la première qui décrit
> ce qui est réellement rendu.

---

### DynamicCoForm

Formulaire mono-étape basé sur react-hook-form + zodResolver. Gère :

- Génération du schéma Zod via `parseCoFormFields` + `generateZodSchema`
- Rendu de tous les types de champs via switch sur `field.componentType`
- Logique conditionnelle via `useConditionalFields`
- Champs verrouillés (`lockedFields`) : wrapper `pointer-events-none opacity-60`
- Auto-submit sur blur via `useWatch` + debounce
- Propagation de `isDirty` via `onDirtyChange`
- Soumission programmatique via `submitRef`, rejet du brouillon via `discardDraftRef`
- `onSubmit: (data, addedOptions?) => void | boolean | Promise<void | boolean>` — **`false` = échec avéré** (le brouillon est alors conservé), toute autre valeur vaut succès et purge le brouillon

**Bannière** : délégué à `CoFormBanner` (cf. section dédiée).

**Champ inconnu** : affiche un bloc d'erreur rouge avec le type manquant (pas de crash silencieux).

---

### MultiStepCoForm

Wizard multi-étapes. Utilise `CoFormProvider` pour partager l'état entre étapes.

**En-tête d'étapes** (`StepsNav`) : sur ordinateur, un rail de pastilles cliquables, une par étape,
qui a remplacé la barre `<Progress>` ; sous `md`, le rail cède la place à une barre segmentée et à un
bouton d'étape. Cinq statuts, calculés par `buildStepItems` (`utils/stepsNav.ts`), dans cet ordre de
priorité — `current` > `locked` > `error` > `done` > `todo` :

| Statut | Sens |
|---|---|
| `current` | étape affichée — prioritaire sur `error` : l'erreur est déjà sous les yeux |
| `done` | valide au regard de son schéma Zod — constaté à l'ouverture en édition, en quittant l'étape, ou après un envoi d'étape réussi |
| `error` | signalée à corriger : validation RHF ratée, envoi serveur raté, ou garde de soumission finale |
| `locked` | réservée à un autre rôle, non cliquable. **Prévu mais pas encore câblé** : `MultiStepCoForm` ne passe pas `lockedIds` (cf. BACKLOG « droits par étape AAP ») |
| `todo` | ni complétée ni signalée — une étape simplement **traversée** y reste |

Le segment de rail entre deux étapes n'est plein que si **les deux bouts** sont atteints, si bien
qu'un saut laisse visuellement le trou qu'il a créé. Au-delà de 6 étapes, seules 5 sont affichées,
centrées sur l'étape courante (la fenêtre bute aux extrémités plutôt que de raccourcir) ; un nœud
« ⋯ » à chaque bout annonce le **nombre** d'étapes cachées de son côté et ouvre le sommaire — lequel
liste **toutes** les étapes, pas seulement les masquées. Le même sommaire s'ouvre depuis le lien
« toutes les étapes » du pied et, sous `md`, depuis le bouton d'étape.

**Navigation directe** : toutes les étapes sont cliquables (`allowFreeNavigation`, défaut `true` —
prop React uniquement, ce n'est plus une clé de section, cf. § Intégration JSON). Quitter une étape
enregistre son brouillon avant le saut, donc la saisie n'est jamais perdue.

**Garde de soumission finale** : à l'envoi, react-hook-form valide l'étape courante, puis la garde
vérifie **toutes les autres** — y compris celles jamais affichées, dont les valeurs manquantes sont
complétées par `generateDefaultValues`. L'étape courante est exclue à dessein : RHF vient de la
valider et ses valeurs fraîches ne sont pas encore dans `stepsData`. S'il reste une étape invalide,
rien n'est écrit (ni `onStepSubmit`, ni `onFinalSubmit`) et l'utilisateur est ramené sur la première
à corriger.

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

`FormFields.tsx` exporte aussi `FieldError` (message d'erreur accessible avec `role="alert"` et `aria-describedby`) et **ré-exporte** `ProseContent`, qui vit désormais dans `@/components/shared/ProseContent` — les fiches AAC rendent les mêmes valeurs en lecture, une seule implémentation donc une seule garantie de sécurité.

**`ProseContent` (HTML ou Markdown selon le contenu)** — deux points à ne pas confondre :

- **le profil de sanitisation est `sanitizeProse`, PAS `sanitize`.** L'auteur du texte est un visiteur quelconque (la description d'un commun est un textarea ouvert à qui dépose) ; le profil DOMPurify par défaut laisse passer `<form>`, `<input>`, `style`/`class`/`id` — de quoi dessiner un **faux écran de connexion plein écran** servi depuis le domaine du site, sans le moindre script. Le profil restreint (`@/lib/sanitize`) impose `USE_PROFILES: {html:true}` (ni SVG ni MathML), interdit les contrôles de formulaire et `<dialog>`, retire `style`/`class`/`id` et les `data-*` (lus par les sélecteurs `data-[state=…]` des composants de la page) ; la mise en forme vient du conteneur `prose` de l'appelant. `sanitize()` reste le profil des **champs HTML de la config admin** (`server/utils/normalizeSiteConfig.js`, sections `html`/`content`), rédigés par un administrateur du site ;
- **la détection HTML ne reconnaît qu'une VRAIE balise** (ouvrante avec ses attributs, ou fermante, au sens CommonMark). L'ancienne heuristique `<[a-zA-Z][^>]*>` prenait pour une balise tout `<lettre…>` : l'autolien markdown `<https://commun.fr>` ou l'e-mail `<contact@commun.fr>` faisaient basculer **tout** le texte dans la branche HTML, où le markdown n'est plus interprété et où DOMPurify supprime le pseudo-tag — l'URL disparaissait. Ces deux formes repassent en markdown.

**`MarkdownEditor`** (`components/MarkdownEditor.tsx`) : wrapper client-only autour de `@uiw/react-md-editor`. Utilise `useClientModule` (et non `React.lazy`) pour éviter l'erreur SSR `ERR_UNKNOWN_FILE_EXTENSION` causée par le CSS interne de la lib.

Props : `{ value, onChange?, height=200, preview="edit"|"live"|"preview" }`.

**Thème dynamique.** La lib se thème via l'attribut `data-color-mode="light"|"dark"` sur le wrapper. Le wrapper est branché sur le thème **global** du site via `useTheme().resolvedTheme` (next-themes ; `resolvedTheme` résout aussi `"system"`) → `colorMode = resolvedTheme === "dark" ? "dark" : "light"`. L'éditeur suit donc le clair/sombre du site (avant : figé `"light"`).

**`overflow={false}` (fuite `body.style.overflow`).** Le Toolbar de `@uiw/react-md-editor` gère le scroll du `<body>` pour son plein écran via un `useEffect` **SANS cleanup** au démontage (`document.body.style.overflow = 'hidden'/originalOverflow`). Dans une **modale** (`CoFormModal`), à la fermeture l'éditeur est démonté et laisse `<body style="overflow:hidden">` inline → **scroll de page perdu**. C'est la seule lib du repo qui touche `body.style.overflow` en assignation directe. `overflow={false}` désactive cette gestion (inutile dans une modale). Complémentaire du fix Dialog `e7db310` (animation de sortie → libère le compteur `react-remove-scroll`) : les **deux** sont nécessaires (compteur + overflow inline).

**Toolbar réduite** (`commands` / `extraCommands`). La barre par défaut (~25 boutons) est ramenée à l'essentiel article : gras, italique, barré, titres, lien, citation, listes (à puces / numérotée / cochée), image, code, + bascule édition/aperçu (`codeEdit`/`codePreview`). Sont retirés table, code block, comment, et surtout **`fullscreen`** — volontairement, car c'est lui qui manipule `body.style.overflow` (cf. `overflow={false}`).

**Preview sanitisée** (`components.preview`). L'aperçu est rendu via `helpers/renderMarkdown` (markdown-it + DOMPurify de `lib/sanitize`) dans un `<div className="wmde-markdown">` — **exactement le même pipeline** que le rendu public de l'article (`ArticleReader`). Remplace le rendu rehype par défaut de la lib (non assaini) → **anti-XSS** + WYSIWYG fidèle à la publication.

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

**Filtres d'inclusion + exclusion.** La config finder legacy porte deux listes
`{attributeName, valueName}` : `filter` (inclusions, « Filtres appliqués ») et
`filterExclude` (exclusions, « Filtres d'exclusion »), toutes deux réglées dans
`finder.php` (module survey). Elles sont parsées en `FinderConfig.filters` /
`FinderConfig.excludeFilters` puis converties en filtres Mongo par le **builder
partagé** [`utils/finderFilters.ts`](../src/modules/coform/utils/finderFilters.ts)
(`buildFinderMongoFilters(include, exclude)`), consommé à l'identique par les
**deux chemins** de recherche : la liste collaborative (`PlacesListView` →
`getEligiblePlaces`) **et** la modale (`useFinderSearchResults` → `searchCostum`).

Sémantique (DSL legacy `SearchNew::searchFilters`, cf. [[search-filters-backend-dsl]]) :
inclusions groupées → scalaire / `$in`, exclusions → `$nin`. Cas d'usage type :
exclure les **réseaux** (orgs taguées `RéseauTiersLieux`) d'une liste de lieux.
Quand un attribut porte **à la fois** inclusion et exclusion (ex. `tags`
`TiersLieux` inclus + `RéseauTiersLieux` exclu), l'inclusion est relocalisée sous
`$or`-objet + `tags:{$nin}` (le DSL ne combine pas `$in`+`$nin` sur une clé).
⚠️ Hypothèse : **une seule collision** attendue (`$or` mono-niveau → ≥2 attributs
en collision donneraient un OR). Sans exclusion, sortie identique à l'historique.

---

### SimpleTableField

Tableau 2D éditable. Colonnes de types : `"Text"`, `"Case à cocher"`, `"Nombre"`, `"Image"`, `"Images"`.

Valeur stockée : `(SimpleTableCell | SimpleTableCell[])[][]` où la première ligne est les en-têtes, les suivantes sont les données. Une cellule `Image` = URL string ou `ImageUploadValue`, une cellule `Images` = `SimpleTableCell[]`.

Nouvelles lignes ajoutables si `config.activeNewLine: true`.

**Édition en modal (`config.editInModal`).** Quand `true`, le tableau passe en
**lecture seule** et chaque ligne devient cliquable → ouvre un **formulaire modal**
(un champ par colonne). CRUD complet dans le modal (ajout via « Ajouter une ligne »,
suppression via « Supprimer cette ligne »), **indépendant de `activeNewLine`**.
Le mode `readOnly` (vue réponse) désactive toute interaction. Utile pour les
tableaux larges (évite le scroll horizontal pénible à la saisie). **Le shape de
valeur persisté est identique** au mode inline → aucune régression Zod. Mutations
via helpers purs [`utils/simpleTable.ts`](../src/modules/coform/utils/simpleTable.ts)
(`upsertSimpleTableRow` / `removeSimpleTableRow` / `buildSimpleTableHeaders` /
`buildEmptySimpleTableRow` — sans mutation, sème les en-têtes si la valeur est
vide, testés + parité Zod). Le flag est réglé **côté legacy** dans la config de
l'input (`survey/.../cplx/simpleTable.php` → `params.simpleTable{champ}.editInModal`) ;
**le legacy ne rend pas le modal**, seul le rendu React consomme le flag.

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

### CategorizedCheckboxField

Cases à cocher à **deux niveaux** : des catégories, et sous chacune des sous-options. Les options viennent soit
d'une liste saisie par l'admin, soit — c'est la raison d'être de cet input — de questions `commonTableV2` d'un
formulaire **tiers** : chaque question devient une catégorie, chacune de ses criterias une sous-option
(`hooks/useCategorizedCheckboxOptions.ts`, helpers purs `utils/categorizedCheckbox.ts`).
`config.dataSourceToUse` vaut `"manual"` | `"distanceOnly"` | `"both"` (défaut **serveur** `"both"` quand la clé
est absente), complété par `list`/`sublist` (saisis) et `formParamsSource`/`questionsParamsSource` (distants).

Valeur stockée, forme legacy conservée : `{ list: string[], sublist: Record<cléCatégorie, string[]> }`. Les
identifiants sont des clés `<index>_<slug>` — **l'index fait partie de la clé persistée** (position dans la liste
avant déduplication), et le slug vient de `utils/slugify.ts`, réplique exacte du `slugifyString` du template
legacy : toute divergence, même d'un seul caractère, rend une réponse déjà enregistrée irrésoluble. Les clés qui
ne se résolvent plus (question renommée, liste réordonnée) sont affichées quand même.

Deux comportements repris du legacy : cocher une sous-option coche sa catégorie ; décocher la dernière
sous-option décoche la catégorie.

---

### CommonTableField

Matrice usage × solution (`tpls.forms.evaluation.commonTableV2`) : pour chaque usage, le répondant déclare la ou
les solutions qu'il utilise et les qualifie. Colonnes activables une à une par `config.showColumns`
(`criteria`/`happiness`/`note`/`yesNo`/`comment`), intitulés par `config.labels`, lignes par `config.usages`
(`usageKey`, `label`, `group` de regroupement optionnel).

Valeur composite côté React : `{ scores: Record<criteriaId, CommonTableSolution>, myCatalog: Record<criteriaId,
CommonTableMyCatalogEntry> }`. À la dénormalisation elle est **splittée en deux entrées root-level** :
`yesOrNo{key}` (les scores — d'où le préfixe RHF `yesOrNo`) et `criterias{key}` (les ajouts de l'utilisateur au
catalogue). Comme `evaluation`, `commonTable` est donc un champ **stocké à la racine** de `answers`.

Le **catalogue collaboratif** (criterias agrégées sur toutes les réponses + `count` par criteriaId) est chargé en
un seul appel batch par `useCoFormCatalogs` — aucun appel réseau si le formulaire n'a pas de commonTable — et lu
par input via `useCommonTableCatalog` ; le clic sur le badge d'une ligne ouvre `CommonTableContributorsDialog`
(`useCommonTableContributors`, contributions individuelles + lieu évalué pour un form collaboratif par lieu). La
règle de regroupement par usage vit dans `utils/commonTableUsage.ts` — **partagée** avec `categorizedCheckbox`,
qui construit ses sous-options depuis le même catalogue (deux implémentations divergeraient) — et les paliers de
couleur de la note dans `utils/commonTableNote.ts` (5 tranches alignées sur les `states` de `commonTableV2.php`).

---

### TimeSlotsField

Répéteur de lignes `{jour, début, fin}` (`config.enableMultipleSlots`, `minuteStep`, `defaultStartTime` /
`defaultEndTime`). Les `<input type="time">` natifs portent le picker et rendent toujours `"HH:MM"` **24 h**,
si bien que le `timeFormat` legacy (`"24h"` | `"12h"`) ne pilote que l'AFFICHAGE, jamais le stockage.

Format de sauvegarde = legacy (vérifié sur les answers réelles) : jour en anglais capitalisé (`"Monday"`),
heures et minutes en chaînes zéro-paddées séparées. `startAmPm`/`endAmPm` n'existent que dans les données legacy
saisies en 12 h — ils sont **lus** puis résolus en 24 h à l'édition, jamais ré-écrits. Logique pure et testée :
`utils/timeSlots.ts`.

---

### DynamicFieldsField

Répéteur de lignes dont les sous-champs viennent de la config admin (`config.fieldsConfig[]` : `key`, `label`,
`type` — types HTML natifs, plus `select`/`textarea` —, `placeholder`, `required`, `validation`, `options`).
Réglages : `enableMultipleRows`, `minRows`/`maxRows`, `layout.fieldsPerRow` (Tailwind exige des classes
STATIQUES → table de correspondance 1..6, mobile toujours 1 colonne), `ui.addButtonText`/`removeButtonText`.
Format sauvé = legacy : `Array<Record<cléSousChamp, string>>`.

---

### LocationField

Adresse géolocalisée — parité dynForm `formLocality`. Édité via `AddressPicker` (`@/lib/location`) sous forme
d'un tableau d'entrées, dont une principale (`center`). La valeur stockée sous `answers[formId][key]` est
l'objet composite `{ formLocality, address, geo, geoPosition, addresses }` (miroir `addressInDynform.php`), où
`address`/`geo`/`geoPosition` recopient l'adresse principale pour la lecture et la carte. Conversion aux
frontières par `utils/coformLocality.ts` : `parseStoredToEntries` en lecture (tolère l'ancienne chaîne libre et
l'objet legacy plat), `entriesToStored` en écriture (`undefined` si vidé).

> Sans le mapping `location`, ces champs retombaient en `text` : saisie libre et **perte totale de la donnée
> géo** — d'où aussi le fallback regex sur tout segment final adresse/localité (cf. [§ mapping](#utils--formparser)).

---

### Champs AAP / oceco (`milestoneList`, `selection`, `aapEvaluation`, `chooseProposal`)

Quatre champs venus des formulaires d'appel à projets. Ils ont en commun de **ne pas être des champs
de formulaire ordinaires** : leur valeur est scopée par évaluateur ou par contexte, et l'écrire en bloc
au submit effacerait celle des autres. Ils écrivent donc par **chemin ciblé**, hors du schéma Zod (cf.
`denormalizeAnswerData`, qui strippe les inputs de décision des étapes parsées).

**`milestoneList`** (`tpls.forms.ocecoform.newDepenseList` → `MilestoneListField`) — la liste des
dépenses / paliers, persistée dans `answers.<step>.depense[]`.

- Helpers purs dans `utils/depense.ts`. **Toutes les fonctions préservent les clés hors contrat** : une
  ligne réelle porte `financer[]`, `historique[]`, `milestone`… que le champ n'édite pas, et le backend
  remplace la clé **en bloc** (`$mergedAnswers[$step][$input] = $inputValue`) — les stripper détruirait
  la donnée au premier enregistrement (même piège que `timeSlots`).
- **Lecture des montants : `toDepenseAmount`, c'est-à-dire `toSafeInt`** — le lecteur unique des
  montants sur un document (`cagnotte/utils/dataTransform`). Il accepte `"12"`, `12`, `12.7` (tronqué),
  et surtout **`"1 500,00"` comme `"1 500.00"`** (espace de milliers, virgule ou point) ; `true`/`false`,
  `null` et le reste valent **0**. Un `Number(value)` local rendait `NaN` — donc 0 — sur les deux formes
  à espace, et 1 sur `true` ; or `depense[].price` arrive en chaîne sur 178 réponses et en booléen sur 75.
- **`priceInt` n'est stocké sur AUCUN document** (0 sur 2 803) : c'est un champ *calculé* par l'enveloppe
  cagnotte. Il n'est lu (`priceInt ?? price`) que si la ligne vient d'une réponse d'enveloppe, où il fait
  autorité. La clé **`targetAmount` n'existe pas** dans `depense[]` — c'est le nom du champ de
  *formulaire*, pas celui de la donnée.
- **`getFieldShape = 'array'`** est obligatoire : PHP sérialise un tableau vide en `{}`, que le `z.array`
  refuserait — l'étape deviendrait insoumettable alors que le champ s'affiche vide et correct.
- La saisie passe par **`DepenseFormDialog`** (le même dialogue sert l'ajout et la modification ; il ne
  persiste rien, il rend ses valeurs au champ). Ses **valeurs initiales sont figées à l'ouverture** :
  un rendu du parent ne réinitialise plus la saisie en cours. À distinguer de `CreateMilestoneDialog`
  (module cagnotte), qui appelle la mutation serveur et exige donc un `answerId` ; seule la
  **validation** est partagée (`milestoneCreateFormSchema`).

**`selection`** (`tpls.forms.aap.selection` → `SelectionField`) et **`aapEvaluation`** en mode
`noteCriterionBased` — la grille du jury.

- Colonne **« Valeur »** : pour les clés `depense` et `budget`, le legacy affiche la **somme des prix**
  et non le contenu. Cette somme est une somme **entière** via `toSafeInt` (`formatCriterionValue`,
  `utils/selection.ts`) — décimales tronquées, `"1 500,00"` = `1500` — et **non** une somme de flottants
  via `toNote`, qui est fait pour des notes : `"1 500,00"` y valait 1, et `true` 1.
- **Aucune contrainte native `min`/`max`/`step=0.5`** sur l'input de note : le barème est vérifié **au
  blur**, comme l'écriture (on ne veut pas un appel réseau par frappe). Hors barème, le refus est
  **affiché sous l'input** (`coform.selection.noteOutOfRange` / `coform.aapEvaluation.noteOutOfRange`,
  `role="alert"` + `aria-invalid`) et l'input est remis à la **note réelle** — le DOM ne doit jamais
  afficher une note qui n'existe nulle part.
- L'écho local des écritures (`useEcrituresLocales`) expose `noter` / `lire` / **`superposer`**, et porte
  sur la **valeur entière**, pas seulement sur le contrôle : les agrégats en sont dérivés (moyennes de
  `selection`, décompte de `pourContre`). Ne rattraper que le vote laissait « Votants 2 · Pour 1 » sous
  un bouton « Pour » en surbrillance, jusqu'au rechargement.

**`chooseProposal`** (`tpls.forms.aap.chooseProposal` → `ChooseProposalField`) — « sélectionné pour
l'annuaire ». La valeur est scopée par **CONTEXTE** :
`answers.<étape>.choose.<contextId> = { value, type, name }` — une même candidature peut être retenue par
un appel et pas par un autre (9 réponses sur 59 portent 2 ou 3 contextes).

> ⚠️ Le contexte est la **1ʳᵉ entrée de `form.parent`** (`resolveChooseContext` → `firstParent`), **pas**
> le costum courant ni `cocolight.contextId`, ni l'entité du slug du site. C'est la clé qu'emploie le
> backend AAP et celle sur laquelle l'annuaire du module AAC filtre ; l'entité du site peut en diverger
> (formulaire porté par plusieurs parents, ou par une autre organisation), et écrire sous elle
> enregistrerait sans erreur un choix que personne ne lirait. **Sans parent exploitable, le champ ne se
> rend pas** — il n'aurait nulle part où écrire.

---

## Brouillon local, récap d'erreurs et sortie non sauvegardée

Trois mécanismes transverses, actifs sur les **deux** formulaires.

### Brouillon localStorage (`useCoFormDraft`)

`hooks/useCoFormDraft.ts` — clé `coform-draft:v1:<formId>:<userId>:new[:<elementType>/<elementId>][:<scope>]`
pour une nouvelle réponse, `coform-draft:v1:<formId>:<userId>:<answerId>[:<scope>]` en édition (l'élément ne
qualifie que `new` : une réponse existante est déjà identifiée par son id, et elle est ouverte depuis des points
d'entrée qui ne passent pas tous l'élément), TTL **30 jours**, écritures **debouncées 500 ms**. Le contrat `CoFormDraft` porte `{version:1, data, currentStepIndex, completedSteps,
addedOptions, timestamp, baseUpdatedAt}`. Désactivé si utilisateur anonyme, `formId` manquant ou `disabled`.

- **Détection de conflit** : si l'`updatedAt` serveur est postérieur au `baseUpdatedAt` du brouillon, celui-ci
  est supprimé et signalé comme *périmé* (`staleDraftInfo`) au lieu d'être proposé.
- **Robustesse** : un brouillon corrompu ou de version inconnue est supprimé et ignoré (pas de crash au
  restore) ; SSR-safe via `useSyncExternalStore` dont le `getServerSnapshot` est vide, donc pas de divergence
  d'hydratation ; les brouillons écrits **pendant la session courante** sont filtrés, sinon la bannière
  réapparaîtrait à chaque save.
- **Montage** : `DynamicCoForm` appelle le hook directement ; en multi-étapes c'est **`CoFormProvider`** qui le
  monte (auto-save à chaque changement de `stepState`, restauration de la position exacte du wizard) et l'expose
  par le contexte (`restorableDraft`, `staleDraftInfo`, `restoreDraft`, `discardDraft`, `acknowledgeStaleDraft`),
  `MultiStepCoForm` n'en rendant que la bannière. Prop d'entrée : `enableDraft` (défaut `true`).
- **`DraftRecoveryBanner`** rend les deux modes : `restorable` (Restaurer / Ignorer, avec l'ancienneté relative
  via `utils/formatRelative.ts`) et `stale` (information seule).

> ⚠️ **En ÉDITION, pas de brouillon sans `baseUpdatedAt`.** `SmartCoForm` garde
> `enableDraft = … && (!answerId || baseUpdatedAt != null)` : la péremption d'un brouillon ne se décide
> que si sa lignée `baseUpdatedAt` est connue, et elle vient de l'appelant. Un appelant qui passe
> `answerId` **sans** `answer.updated` produirait un brouillon impossible à déclarer obsolète — trente
> jours durant, « Reprendre » remplacerait sans avertir une réponse modifiée entre-temps par quelqu'un
> d'autre. Mieux vaut pas de filet qu'un filet qui efface le travail des autres. La prop de `CoFormModal`
> est donc une **obligation**, pas une recommandation : « à transmettre dès qu'on passe `answerId` ».
> Trois appelants ne la passent pas encore — `PreviewCoformAnswer`, `ProfileTiersLieuxInfo`,
> `ProfilTiersLieuxAbout` : sur eux, le **brouillon d'édition est coupé** tant qu'ils ne transmettent pas
> `answer.updated`.

**Cycle de vie du brouillon** :

| Événement | Effet |
|---|---|
| Succès avéré, mono-étape | purge — `DynamicCoForm` ne purge que si `onSubmit` ne résout **pas** `false` |
| Succès avéré, wizard | purge — `submitAllData` purge après `onFinalSubmit` |
| Échec de soumission | **conservé** (c'est précisément le moment où il sert) |
| « Abandonner les modifications » (`CoFormModal`) | suppression explicite, **avant** la fermeture : `discardDraftRef` supprime la clé ET jette le payload debouncé en attente, que le flush au démontage ne pourra plus réécrire |
| Fermeture sans modification | conservé |

**Contrat `DynamicCoForm.onSubmit`** : `void | boolean | Promise<void | boolean>`. **`false` = échec
avéré** (le brouillon est conservé) ; toute autre valeur vaut succès.

**Nouvelles surfaces** : `discardDraftRef?: React.RefObject<(() => void) | null>` sur `SmartCoForm`,
`DynamicCoForm`, `MultiStepCoForm` et `CoFormProvider` — même patron que `submitRef`. Côté contexte,
`CoFormContextType` porte `draftRestoreCount: number` : `restoreDraft` l'incrémente pour **resynchroniser
l'étape affichée** (l'effet de reset de `useCoFormStep` dépend de `[effectiveStepIndex, draftRestoreCount]`),
`stepState` seul ne pilotant que l'état du wizard.

### Récapitulatif d'erreurs (`ErrorSummary`)

`components/ErrorSummary.tsx` — liste les champs en erreur (libellé + message) et l'erreur serveur éventuelle,
affiché **seulement après une tentative de soumission échouée** (les `errors` ne lui sont passées qu'à partir de
là). Cette même tentative scrolle d'office au 1ᵉʳ champ fautif et émet un toast. Cliquer une entrée du récap
appelle `scrollToFieldByName` (`utils/helpers.ts`) : recherche `[data-field-name]`, repli sur `[name]` puis sa
cellule de grille, `scrollIntoView` centré, focus, puis halo d'attention (Web Animations — court-circuité si
`prefers-reduced-motion`). Chaque champ est enveloppé d'un wrapper `data-field-name` en `display: contents`
(ne casse pas la grille).

> ⚠️ Le composant n'est **ni `memo`, ni `useMemo`é sur `errors`** : RHF peut MUTER `_formState.errors` en place
> en gardant la même référence — toute mémoïsation sur cette référence figerait le récap.

### Avertissement de sortie (`useUnsavedChangesWarning`)

`hooks/useUnsavedChangesWarning.ts` — s'abonne à `beforeunload` tant que `isDirty` : le navigateur affiche son
propre texte générique (le message personnalisé est ignoré par les navigateurs modernes). Appelé par
`DynamicCoForm` et `MultiStepCoForm` avec `form.formState.isDirty`.

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
| `useCoFormNavigation()` | `{ currentStepIndex, totalSteps, isFirstStep, isLastStep, completedSteps, canGoNext, canGoPrevious, next(), previous(), goTo(index) }` |
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
- Les `filters` envoyés sont construits par le builder partagé `buildFinderMongoFilters(config.filters, config.excludeFilters)` (DSL backend, inclusions + exclusions) — même sortie que la liste `getEligiblePlaces`

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
6. **Réconciliation des fichiers** (miroir de l'étape 3) : après un `save()`
   réussi, les fichiers présents à l'ouverture (`answer.serverData.answers`,
   fetché par `form.answer({id})`) mais absents du payload sauvegardé sont
   supprimés en **un seul** `answer.deleteFiles(removed)` (batch parallèle SDK
   via `_uploadInBatches`, best-effort). Helper de diff : `collectUploaderDocIds`
   (exporté de `file.ts`, testé).

### Suppression de fichier : DIFFÉRÉE au save

`UploaderField` ne supprime plus le fichier serveur au clic sur ✕ : il retire
**seulement la référence du form value**. La suppression réelle est différée au
save (étape 6 ci-dessus). Conséquences :

- Un retrait **non sauvegardé ne détruit rien** (annuler/fermer = aucun effet) —
  cohérent avec tous les autres champs (en attente jusqu'au save).
- L'ordre **save → delete** garantit qu'un save échoué ne supprime jamais un
  fichier encore référencé en base (pas de référence orpheline / image cassée).

**Réconciliation = DIFF ∪ EXPLICITE** (`useCoFormFinalMutation`, `actions/mutations/file.ts`). Au save on supprime l'UNION de :

- **diff** : `collectUploaderDocIds(serverData) − collectUploaderDocIds(soumis)` (présents à l'ouverture, retirés du payload). ⚠️ Le collecteur gère SYMÉTRIQUEMENT les 2 formes de `files` — map `{docId:path}` ET Array `[{docId}]` : ignorer l'Array faisait voir le côté soumis VIDE → **sur-suppression** de tout le champ.
- **explicite** : `deletedDocIds` — `handleRemove` trace le vrai `docId` retiré (connu via `getFiles`). SEULE source pour un fichier **legacy non-en-map** (champ `{updateDate}` sans clé `files`), invisible au snapshot. Clé TRANSITOIRE : extraite + strippée au save (`extractDeletedDocIds`), jamais persistée. ⚠️ Doit figurer dans le schéma Zod uploader (`formParser.ts`), sinon strippée à la validation du submit single-step.

`handleRemove` reconstruit la **map** `{docId:path}` (pas un Array) quand tous les fichiers restants sont existants → pas de flip-flop de format en base. Helpers `collectUploaderDocIds` / `extractDeletedDocIds` exportés + testés (`file.test.ts`).

**Autorisation côté answer.** `answer.deleteFile`/`deleteFiles` appellent
l'endpoint coform `DELETE_COFORM_ANSWER_FILE` (`DeleteAnswerFileAction`,
citizenToolKit), **miroir de l'upload** : autorisé par
`$isOwner || Coform::canAdminAnswer($formId, $answer)` — la MÊME auth que le save
et l'upload — puis suppression via `Document::removeDocumentById($docId, true)`
(`canDelete=true` **bypasse le `canEdit` générique** du document, car l'auth
answer-side a déjà validé, + check d'appartenance `docId → answer`). C'est ce qui
permet à un membre autorisé d'éditer une réponse partagée
(`publicCanEditSharedAnswer` / `membersCanEditSharedAnswer`) de **gérer ses
fichiers**. La **lecture** (`GetAnswerFilesAction`) utilise la même
`canAdminAnswer` — sinon l'uploader serait cassé en édition partagée.

**Couverture de test SDK (MR !4).** Les méthodes entité coform du SDK sont
verrouillées par des tests d'intégration ajoutés (commit
`1b0fb86`, `cocolight-api-client/tests/integration/`) :
- `advanced/answer-delete-file.test.ts` — `deleteFile`/`deleteFiles` : préconditions
  client (docId ≠ 24 chars → 400, draft sans id → 400, `deleteFiles([])` no-op),
  round-trip upload→save→delete, **best-effort** (jamais de throw, même sur
  échec/doublon). Tolère un **404 serveur** (route `deleteanswerfile` pas déployée
  sur le backend de test) mais **jamais** le 404 client « Endpoint introuvable »
  (qui trahirait un `endpoints.module.ts` non régénéré).
- `advanced/coform-entity-methods.test.ts` — `getMultiEvalData` (radar) : verrouille
  le contrat **client** post-MR4 (auth `none` → plus de garde `callIsConnected`,
  l'appel atteint le serveur en anonyme ; toute erreur doit venir du serveur, pas
  du verrou client). ⚠️ **Bug backend connu** : `GET_COFORM_MULTIEVAL_DATA` peut
  répondre **500** — Notice PHP « Undefined index: name » dans
  `Coform::getCompleteFormData` (`citizenToolKit/models/Coform.php:438` :
  `$subFormVal["name"]` lu sans garde `isset` quand un subform n'a pas de `name`).
  **À corriger côté PHP.** Le contrat serveur « radar public » peut aussi ne pas
  être déployé sur le backend de test (répond alors `result:false`).

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
  draftRestoreCount: number;         // incrémenté par restoreDraft → resynchronise l'étape affichée
  // Actions
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (stepIndex: number) => void;
  saveStepData: (subFormId: string, data: SubFormData) => void;
  saveAddedOptions: (subFormId: string, fieldName: string, options: string[]) => void;
  submitStepData: (subFormId: string, data: SubFormData) => Promise<void>;
  submitAllData: () => Promise<void>;
  resetForm: () => void;
  // Navigation directe entre étapes
  setStepCompleted: (subFormId: string, completed: boolean) => void;
  markStepInvalid: (subFormId: string, invalid: boolean) => void;
  getStepsData: () => AllStepsData;   // lit `stepsDataRef.current`, jamais la closure
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
  discardDraftRef?: React.RefObject<(() => void) | null>; // même patron que submitRef
}
```

---

## Utils : formParser

`src/modules/coform/utils/formParser.ts` — fonctions pures de transformation :

| Fonction | Description |
|---|---|
| `parseCoFormFields(formData)` | `CoFormData → SubFormFields[]` avec mapping vers `componentType`, largeurs Tailwind col-span, options, configs avancées. Filtre les champs `validateStep*`. |
| `generateZodSchema(subFormsFields, t?)` | `SubFormFields[] → z.ZodObject` dynamique : validation `isRequired` par champ et type, + format **URL tolérant** (`inputType: "url"`, accepte sans schéma, jamais appliqué à un champ vide non requis). Le param `t` (signature `useT`, **optionnel**, défaut = fallback FR) i18n les messages via `t("coform.validation.*", fallbackFR, { label })` — voir [§ i18n](#i18n). |
| `generateDefaultValues(subFormsFields)` | Valeurs par défaut vides typées selon `componentType` |
| `normalizeAnswerData(rawAnswers, subFormsFields)` | Déplace les champs root-level (ex: `evaluation`) de la racine vers leur sous-formulaire pour react-hook-form |
| `denormalizeAnswerData(formData, subFormsFields)` | Inverse : déplace les champs root-level du sous-formulaire vers la racine pour le format PHP. **Point unique** des trois chemins d'écriture, qui **ne ré-émet jamais ce qui n'est pas parsé** : le payload ne porte que les étapes parsées et les clés root-level produites à partir d'un champ parsé — une étape masquée (`hideStep`, `hiddenStepKeys`) en est absente, et le backend la préserve telle quelle (une étape présente serait écrasée clé par clé). Strippe aussi les inputs de décision (`selection`, `choose`…) des étapes parsées. |
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
| `text`, `url`, `email`, `tel`, `number`, `date`, `time`, `datetime-local`, `tpls.forms.emailUser` | `text` (avec `inputType` correspondant ; les types date/heure natifs portent le picker et la valeur ISO) |
| `textarea` | `textarea` |
| `tpls.forms.cplx.radioNew` | `radio` |
| `tpls.forms.cplx.checkboxNew` | `checkbox` |
| `tpls.forms.cplx.multiCheckboxPlus` | `multiCheckboxPlus` |
| `tpls.forms.cplx.multiRadio` | `multiRadio` |
| `tpls.forms.cplx.categorizedCheckbox` | `categorizedCheckbox` |
| `tpls.forms.cplx.evaluation`, `tpls.forms.evaluation.evaluation` | `evaluation` |
| `tpls.forms.evaluation.commonTableV2` | `commonTable` |
| `tpls.forms.cplx.finder`, `tpls.forms.finder.finder` | `finder` |
| `tpls.forms.cplx.simpleTable` | `simpleTable` |
| `tpls.forms.cplx.timeSlots` | `timeSlots` |
| `tpls.forms.cplx.dynamicFields` | `dynamicFields` |
| `formLocality`, `location`, `address`, `tpls.forms.cplx.addressInDynform`, `tpls.forms.cplx.address` | `location` |
| `tpls.forms.uploader` | `uploader` |
| `sectionTitle`, `tpls.forms.sectionTitle` | `sectionTitle` |
| `tpls.forms.sectionDescription` | `sectionDescription` |
| `titleSeparator`, `tpls.forms.titleSeparator` | `titleSeparator` (rendu propre, **plus d'alias** vers `sectionTitle`) |
| `tpls.forms.tags` | `tags` |
| `tpls.forms.ocecoform.newDepenseList` | `milestoneList` |
| `tpls.forms.ocecoform.pourContre` | `pourContre` |
| `tpls.forms.aap.selection` | `selection` |
| `tpls.forms.aap.evaluation` | `aapEvaluation` |
| `tpls.forms.aap.chooseProposal` | `chooseProposal` |
| `select`, `tpls.forms.select` | `select` |
| Inconnu | `unknown` |

> **`multiDecide` n'est PAS un type mappé** : c'est une **indirection**, résolue par
> `utils/multiDecide.ts` vers le type que désigne `inputConfig.multiDecide`. Sans cette config,
> l'input ne se rend pas du tout.

Les six dernières lignes (`titleSeparator` → `chooseProposal`) sont les champs AAP/oceco décrits en
[§ Champs AAP / oceco](#champs-aap--oceco-milestonelist-selection-aapevaluation-chooseproposal).
Types **encore non mappés** côté AAP : `suiviFromBudget`, `generateprojectbtn` — un type non mappé rend
une boîte rouge **et droppe sa valeur au save**.

**Deux fallbacks par expression régulière**, après la table (les costums legacy déclinent leurs propres
templates, `tpls.forms.costum.<slug>.<chose>`) : tout type dont le **segment final** est
`addressInDynform`/`formLocality`/`address`/`location` (insensible à la casse) → `location`, et tout segment
final se terminant par `finder` → `finder` (on perd la création custom du costum, on garde la sélection).

**Préfixes de champs** (FIELD_PREFIX_MAP) : `finder` → `"finder"`, `multiCheckboxPlus` → `"multiCheckboxPlus"`, `multiRadio` → `"multiRadio"`, `evaluation` → `"evaluation"`, `commonTable` → `"yesOrNo"` (le legacy stocke les scores sous `yesOrNo{key}`, le catalogue user sous la clé jumelle `criterias{key}`). Ces préfixes sont ajoutés au nom du champ pour react-hook-form (ex: champ `abc123` de type finder → `name: "finderabc123"`).

**Champs stockés à la RACINE de `answers`** (`ROOT_LEVEL_FIELDS`, cf. `isRootLevelField`) : `evaluation` **et** `commonTable` — `normalizeAnswerData`/`denormalizeAnswerData` font l'aller-retour racine ↔ sous-formulaire.

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
| `SimpleTableConfig` | `{ tableName, columns, rows, activeNewLine, singleAnswerByLine, editInModal }` |
| `CategorizedCheckboxConfig` | `{ dataSourceToUse, list, sublist, formParamsSource, questionsParamsSource }` (+ `CategorizedCheckboxValue` `{list, sublist}`, `CategorizedCheckboxOption`/`Child` pour l'arbre rendu) |
| `CommonTableConfig` | `{ showColumns, labels, usages[] }` (+ `CommonTableValue` `{scores, myCatalog}`, `CommonTableSolution`, `CommonTableMyCatalogEntry`, `CommonTableCatalog(s)`, `HappinessValue`) |
| `TimeSlotsConfig` | `{ enableMultipleSlots?, timeFormat?, minuteStep?, defaultStartTime?, defaultEndTime? }` (+ `TimeSlotValue`) |
| `DynamicFieldsConfig` | `{ enableMultipleRows?, minRows?, maxRows?, fieldsConfig[], layout?, ui? }` (+ `DynamicFieldsSubField`, `DynamicFieldsRow`) |
| `CoFormDraft` | Brouillon localStorage : `{ version:1, data, currentStepIndex, completedSteps, addedOptions, timestamp, baseUpdatedAt }` |
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
| `coform.steps.*` | `navLabel`, `counter`, `stepLabel`, `stepLabelUnnamed`, `allSteps`, `hiddenBefore`, `hiddenAfter`, `goToFirstError`, `status.{done,current,error,locked,todo}` |
| `coform.navigation.*` | `next`, `previous`, `submit`, `save`, `reset` |
| `coform.validation.*` | `required`, `minLength`, `maxLength`, `email`, `url`, `number`, `selectOption`, `selectAtLeastOne`, `requiredField` (`{{label}}`), `urlInvalid` (`{{label}}`), `simpleTableRequired` (`{{label}}`), `multiCheckboxPlusCplxRequired`, `noteRange` |
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

**Messages de validation Zod (traduits au build-time, pas à l'affichage).** Les
sinks (`FieldError`, `ErrorSummary`) rendent le message **verbatim** ; la
traduction se fait donc à la construction du schéma. `generateZodSchema` reçoit
un traducteur `t` (signature `useT`, **optionnel** — défaut = fallback FR pour un
usage hors React / tests) et chaque message devient
`t("coform.validation.<clé>", fallbackFR, { label })` (forme **3-args** :
clé, fallback, params — sinon l'interpolation `{{label}}` ne s'applique pas). Les
call-sites (`DynamicCoForm`, `useCoFormStep`) passent leur `t` **et l'ajoutent aux
deps du `useMemo`** du schéma → recompilation au changement de langue (sinon
messages figés). ⚠️ Le `{{label}}` provient de la **définition backend du
formulaire** (langue de l'auteur), pas de l'UI : un formulaire FR vu en EN garde
son label FR. **Couverture complète** : les 3 derniers constructs qui émettaient
encore un défaut Zod (anglais) sont désormais traduits sans `errorMap` global —
radio requis avec options (`z.enum(opts, { error: t(...) })`, forme Zod v4 ; via
l'UI le seul échec est « rien sélectionné » → message « requis »), radio requis
sans options (`z.string().min(1, t(...))`) et borne `note 0-5` du commonTable
(`z.number().min(0, t("…noteRange")).max(5, …)`). Restent en défaut Zod **par
design** les `z.string()/z.number()/z.enum` **structurels internes** des schémas
composites (commonTable `solutionSchema`/`myCatalogEntrySchema`, finder, uploader)
— jamais saisis directement par l'utilisateur (data machine), le `.refine()`
au-dessus porte déjà le message user-facing traduit.

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
    "title": { "fr": "Inscrivez-vous", "en": "Sign up" },
    "description": { "fr": "Remplissez le formulaire ci-dessous", "en": "Fill in the form below" },
    "showProgress": true,
    "showStepNumbers": true,
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
| `showProgress` | `boolean` | `true` | Affiche l'en-tête d'étapes (`StepsNav`), navigation directe comprise. **Sans effet** si `variant: "stepper"` (qui force l'en-tête) ou si le formulaire n'a qu'une étape |
| `showStepNumbers` | `boolean` | `true` | Numérote les pastilles des étapes **encore à faire** ; l'étape courante affiche toujours son numéro, les autres une icône |
| `redirectAfterSubmit` | `string?` | — | URL redirection post-soumission |
| `className` | `string?` | — | Classe CSS additionnelle pour le conteneur section |

⚠️ **`allowFreeNavigation` n'est plus une clé de section.** Elle a été retirée de
`CoFormSectionSchema` quand la navigation directe est devenue le comportement par défaut. Comme le
schéma **strippe** les clés inconnues au lieu de les rejeter, une config qui la déclare encore ne
produit **aucune erreur** — elle n'a simplement plus aucun effet. La prop existe toujours sur
`MultiStepCoForm` (défaut `true`) pour les appelants React.

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
