[← Retour à l'index](README.md)

# Module Cagnotte

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Modèle de données](#modèle-de-données)
  - [Sync croisé `projects.oceco.milestones[]` ↔ `answers.aapStep1.depense[]`](#sync-croisé-projectsocecomilestones--answersaapstep1depense)
  - [Types canoniques (`types.ts`)](#types-canoniques-typests)
  - [Entity Cocolight et `serverData`](#entity-cocolight-et-serverdata)
- [Surface API publique (`index.ts`)](#surface-api-publique-indexts)
- [Hooks](#hooks)
- [Mutations & factories](#mutations--factories)
- [Forms : Zod + React Hook Form](#forms--zod--react-hook-form)
- [Composants et rendu](#composants-et-rendu)
  - [Sections JSON](#sections-json)
  - [Dialogs autonomes RHF](#dialogs-autonomes-rhf)
  - [Parts présentationnels](#parts-présentationnels)
- [Permissions](#permissions)
- [Services de paiement](#services-de-paiement)
- [React Query](#react-query)
- [SSR / Prefetch](#ssr--prefetch)
- [i18n](#i18n)
- [Pièges connus](#pièges-connus)
- [Décisions design en attente](#décisions-design-en-attente)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le **module Cagnotte** (`src/modules/cagnotte/`) gère le **financement collaboratif de projets par jalons (milestones)**. Il expose des sections JSON, un dialog de contribution, des dialogs CRUD pour milestones/actions, et l'intégration de paiement Stripe + HelloAsso.

**Particularité centrale** : un même jalon existe en double dans deux collections backend distinctes (`projects.oceco.milestones[]` et `answers.aapStep1.depense[]`). Chaque mutation doit synchroniser les deux côtés. Comprendre ce point est le prérequis avant de toucher au code.

**Type module** : `core` (`module.config.ts`) — chargé en eager pour éviter le flash de chargement sur les pages publiques où une carte cagnotte peut apparaître.

**Modules dépendants** : `profil` (pages projets avec onglets cagnotte, utilisation de `useOptionalProfileEntity`).

---

## Architecture interne

```
src/modules/cagnotte/
├── module.config.ts                    # name: "cagnotte", type: "core", enabled: true
├── index.ts                            # API publique du module
├── i18n.ts                             # Enregistre le namespace "modules/cagnotte" (side-effect)
├── i18n/
│   ├── fr.json
│   └── en.json
├── schema.ts                           # 5 schémas Zod des sections JSON site-config (+ props étendues)
├── schemaForm.ts                       # Schémas Zod pour forms RHF (milestone + action + contribution)
├── types.ts                            # Types canoniques (FundingMilestone, FundingAction, …)
│
├── actions/mutations/
│   ├── milestone.ts                    # Factory createMilestoneMutation + 5 mutations (Create/Edit/Close/Restore/Delete)
│   ├── action.ts                       # Factory createActionMutation<TParams, TData> + 6 mutations (incl. useCreateAction)
│   └── index.ts
│
├── components/
│   ├── CagnotteDialog.tsx              # Modal principal de contribution
│   ├── PaymentConfigPage.tsx           # Page configuration Stripe + HelloAsso
│   ├── StripePaymentForm.tsx           # Formulaire carte Stripe Elements
│   ├── PiggyBankHeaderButton.tsx       # Bouton piggy-bank header (montant live + dialog)
│   ├── ProjectsFinancingDisplay.tsx    # @deprecated PLACEHOLDER vide
│   ├── parts/                          # Sous-composants de CagnotteDialog
│   │   ├── CagnotteAmountPicker.tsx
│   │   ├── CagnotteContributeButton.tsx
│   │   ├── CagnotteMilestoneList.tsx
│   │   ├── CagnotteProjectProgressCard.tsx
│   │   ├── CagnotteProjectSelector.tsx
│   │   └── CagnotteSuccessScreen.tsx
│   └── sections/
│       ├── ActionsSection.tsx          # Section JSON `actions` (orchestrateur)
│       ├── FinanceSection.tsx          # Section JSON `finance`
│       ├── ActionsSummarySection.tsx   # Section JSON `actions-summary` (sidebar)
│       ├── FinanceSummarySection.tsx   # Section JSON `finance-summary` (sidebar)
│       ├── CagnotteLayoutSection.tsx   # Section JSON `cagnotte-layout` (wrapper + provider)
│       ├── CreateMilestoneDialog.tsx   # Dialog autonome RHF de création
│       ├── MilestoneCreateTrigger.tsx
│       ├── MilestoneManageActions.tsx  # UI boutons edit/close/restore/delete
│       ├── SummaryMilestoneCreateCard.tsx
│       ├── projectMilestonesSummary.ts # @deprecated NON UTILISÉ — helpers summary (non branchés)
│       └── parts/
│           ├── MilestoneCard.tsx              # Rendu d'une carte milestone open
│           ├── ClosedMilestonesSection.tsx    # Section repliable jalons clôturés
│           ├── ActionCreateDialog.tsx         # Dialog autonome RHF
│           ├── ActionEditDialog.tsx           # Dialog autonome RHF
│           ├── MilestoneEditDialog.tsx        # Dialog autonome RHF
│           └── badges.tsx                     # MilestoneStatusBadge, ActionStatusBadge, ContributorsAvatars
│
├── constants/
│   └── queryKeys.ts                    # CAGNOTTE_QUERY_KEYS (6 keys dont 3 préfixes)
│
├── contexts/
│   ├── CagnotteContext.tsx             # Type CagnotteContextValue
│   ├── CagnotteProvider.tsx            # Event-bus typé (request edit/delete/scroll milestone)
│   └── index.ts
│
├── hooks/
│   ├── useFundingEnvelope.ts           # Query React Query principale (envelope normalisée) + exports normalizeFundingEnvelope, extractFormIdFromEnvelope, mergeEnvelopePayloads
│   ├── useCagnottePermissions.ts       # Wrapper typé sur usePermissions
│   ├── useCagnotteContext.ts           # Accès au CagnotteProvider (safe + strict)
│   ├── useActionGuards.ts              # requireConnected + requireApiContext
│   ├── useOrganizationProjectsWithAnswers.ts  # Liste projets org + réponses CoForm
│   ├── useProjectModalCagnotte.ts      # Query : projet par défaut d'une org
│   ├── useProjectModalPreference.ts    # Mutation : persiste la préférence côté DB (entity.updateField)
│   ├── useSaveCagnotteContribution.ts  # Mutation contribution (atomique)
│   └── useUserAdminOrganizations.ts    # Query : orgs admin du user (filtre MongoDB)
│
├── lib/
│   ├── milestoneSyncContext.ts         # resolveMilestoneSyncContext, getEnvelopeProjects, getEntityIdFromUnknown (alias)
│   ├── milestoneMutationHandlers.ts    # edit/close/restore/deleteMilestoneWithSync + getApiErrorMessage
│   ├── actionMilestonePathUpdates.ts   # Wrappers entity-oriented (appendProjectMilestone, appendAnswerDepense, updateProjectMilestoneFields, updateAnswerDepenseFields, deleteProjectMilestoneAtIndex, deleteAnswerDepenseAtIndex, deleteActionById)
│   ├── actionIdResolvers.ts            # @unused — resolveActionEntityId, resolveCreatedActionId (workaround remplacé par action.id SDK)
│   ├── actionDiffCalculator.ts         # calculateActionDiff (helper pur), types DiffActionPrevious/Next, ActionUpdateFields
│   ├── actionDiffCalculator.test.ts    # Tests unitaires calculateActionDiff
│   └── actionIdResolvers.test.ts       # Tests unitaires resolveActionEntityId / resolveCreatedActionId
│
├── pages/
│   └── FinancingPages.tsx              # @deprecated PLACEHOLDER vide
│
├── permissions/
│   ├── calculators/cagnotte.ts         # 11 permissions calculées (calculateCagnottePermissions)
│   ├── defaults.ts                     # DEFAULT_CAGNOTTE_PERMISSIONS
│   ├── register.ts                     # registerPermissions(namespace: "cagnotte")
│   ├── types.ts                        # CagnottePermissions, CagnottePermissionData, CagnotteMilestoneLike, CagnotteActionLike
│   └── index.ts
│
├── prefetch/
│   ├── prefetchFundingEnvelope.ts      # Helper SSR (exporté, voir §SSR)
│   └── index.ts                        # prefetchFundingEnvelope + hasCagnotteSection + CAGNOTTE_SECTION_TYPES
│
├── services/
│   ├── stripeService.ts                # Stripe public key + error mapping
│   ├── helloAssoCheckoutIntent.ts      # Création checkout HelloAsso + popup
│   ├── helloAssoVerification.ts        # Polling statut paiement
│   ├── helloAssoService.ts             # 4 exports @deprecated + 2 actifs (buildHelloAssoPaymentData, validateHelloAssoConfig)
│   ├── helloAssoWebhook.ts             # @deprecated PAS BRANCHÉ
│   ├── fundingEnvelopePayment.ts       # @deprecated REMPLACÉ
│   └── paymentDataProcessor.ts         # @deprecated SCHEMA OBSOLÈTE
│
└── utils/
    ├── dataTransform.ts                # asRecord, getServerData, getEntityId, toNumber, toString, toArray, toArrayOrValues, toSafeInt, normalizeIdOrNull, getNonEmptyRecord, readEntityPreferences
    ├── dataTransform.test.ts           # Tests unitaires de tous les helpers dataTransform
    ├── format.ts                       # formatCurrency (Intl.NumberFormat), formatDate, initials
    ├── format.test.ts                  # Tests unitaires format
    ├── actionDateHelpers.ts            # parseFrenchDateToIso, frenchDate↔pickerValue, timestampToFrenchDate
    ├── actionDateHelpers.test.ts       # Tests unitaires actionDateHelpers
    ├── idGeneration.ts                 # generateMilestoneId (24-char hex Mongo-like)
    └── idGeneration.test.ts            # Tests unitaires generateMilestoneId
```

---

## Modèle de données

### Sync croisé `projects.oceco.milestones[]` ↔ `answers.aapStep1.depense[]`

Chaque jalon cagnotte existe en **double** dans deux collections backend distinctes :

| Collection | Chemin | Rôle |
|---|---|---|
| **`projects`** | `oceco.milestones[]` | Définition du jalon : `{ milestoneId, name, description, status: open\|done\|close }` |
| **`answers`** (CoForm) | `answers.aapStep1.depense[]` | Miroir financier : `{ poste, price, milestone, financer[], include }` |

→ Toute mutation milestone doit être **propagée des deux côtés** :

| Action | Côté project | Côté answer |
|---|---|---|
| Édition | `updateProjectMilestoneFields({ name, description, status })` | `updateAnswerDepenseFields({ poste, price })` |
| Clôture | `status: "close"` | `include: false` |
| Restauration | `status: "open"` | `include: true` |
| Suppression | `deleteProjectMilestoneAtIndex` | `deleteAnswerDepenseAtIndex` + suppression des actions liées |

Cette orchestration est centralisée dans :
- `lib/milestoneMutationHandlers.ts` — `editMilestoneWithSync`, `closeMilestoneWithSync`, `restoreMilestoneWithSync`, `deleteMilestoneWithSync`
- `lib/milestoneSyncContext.ts` — `resolveMilestoneSyncContext({ rawEnvelope, projectId, answerId, milestoneId })` retourne `{ projectMilestoneIndex, answerDepenseIndex }` ou `null`

> Le nom `aapStep1` vient de « Appel À Projet, étape 1 ». Le module suppose que le CoForm cible contient cette structure. **Non généralisé** pour d'autres structures.

### Types canoniques (`types.ts`)

Source unique de vérité pour tous les types data du module :

```
FundingEnvelopeNormalizedData
├─ projects[] : FundingProject[]
│  ├─ id, slug, name, description, tags
│  ├─ totalCouts, totalFinancement, userFinancement
│  ├─ paymentMethods?: FundingPaymentMethods
│  └─ milestones[] : FundingMilestone[]
│     ├─ id, title, description, status (open|done|close)
│     ├─ date_start?, date_end?, targetAmount
│     ├─ transactions[] : FundingTransaction[]
│     │  ├─ id, financerName, financerId?, amount, date
│     │  └─ paymentStatus (pending|paid|failed|refunded)
│     └─ actions[] : FundingAction[]
│        ├─ id, name, credits, status (todo|done)
│        ├─ date_start?, date_end?, tags[]
│        └─ contributors[] : FundingContributor[]
│
├─ selectedProject : FundingProject | null   # résolu via projectId ou profileSlug
├─ paymentMethods : FundingPaymentMethods | null
├─ milestones : FundingMilestone[]           # raccourci → selectedProject?.milestones
├─ contributors : FundingContributor[]       # agrégation projet → actions → contributors
├─ funders : Array<{ id, name, amount, avatar? }>
├─ finance : { totalCost, totalFunding, userFunding, remaining, totalSpent }
└─ rawEnvelope : unknown                     # conservé pour les handlers de sync
```

Deux types supplémentaires définis dans `types.ts` servent à l'orchestration interne :
- `EditActionContext` — bag passé du parent à `ActionEditDialog` (`{ milestoneId, action, actionEntityId }`)
- `PendingDeleteActionContext` — bag pour les confirmations de suppression (`{ milestoneId, action }`)

Tous les types sont exportés depuis `@/modules/cagnotte/types`. Le hook `useFundingEnvelope` les ré-exporte pour compat ascendante.

### Entity Cocolight et `serverData`

Les méthodes du SDK qui retournent des entités linkées (cf. `BaseEntity.fundingEnvelope` → `_linkEntity`) rangent les données du document Mongo sous `entity.serverData` (getter sur `_serverData`), **pas à la racine de l'instance**.

`useFundingEnvelope` post-traite via `getServerData(entity)` (`utils/dataTransform.ts`) qui résout cette indirection :

```ts
export function getServerData(value: unknown): UnknownRecord {
  const record = asRecord(value);
  return (
    getNonEmptyRecord(record._serverData) ||
    getNonEmptyRecord(record.serverData) ||
    getNonEmptyRecord(record) ||
    {}
  );
}
```

`utils/dataTransform.ts` exporte également d'autres helpers utilisés à travers le module :

| Fonction | Description |
|---|---|
| `asRecord(value)` | Coerce en `Record<string, unknown>`, retourne `{}` pour les non-objets |
| `getNonEmptyRecord(value)` | Retourne l'objet si non-vide, sinon `null` |
| `toArrayOrValues<T>(value)` | Tableaux pass-through, objets → `Object.values`, sinon `[]` |
| `toArray<T>(value)` | `null/undefined → []`, tableau pass-through, scalaire → `[value]` |
| `toNumber(value)` | Coerce en number fini, retourne `0` pour NaN/Infinity |
| `toString(value)` | Retourne la string identique, `''` pour tout non-string |
| `normalizeIdOrNull(value)` | Trim + retourne `null` si vide ou non-string |
| `toSafeInt(value)` | `Math.trunc` + parse string FR (`"1 234,5"` → `1234`) |
| `getEntityId(value)` | Extrait un id depuis string, `{ id }`, `{ _id.$id }`, `{ _id._str }`, `{ $id }` |
| `readEntityPreferences(entity, source)` | Lit `entity.data.preferences` ou `entity.serverData.preferences` |

Cas piège : accéder à `entity.oceco.milestones` retourne `undefined` car `oceco` est sous `entity.serverData.oceco`. Ce bug a été corrigé dans `milestoneSyncContext.ts` et `useFundingEnvelope.ts` (cf. [Pièges connus](#pièges-connus)).

---

## Surface API publique (`index.ts`)

Exports principaux consommés hors du module :

| Export | Type | Consommateurs externes |
|---|---|---|
| `moduleConfig` | `ModuleConfigSchema` | `discoverModules()` |
| `CagnotteDialog` | Composant | `PiggyBankHeaderButton`, `FinanceSection`, `FinanceSummarySection` |
| `PaymentConfigPage` | Composant | Interne (rendu par `CagnotteDialog`) |
| `StripePaymentForm` | Composant | `PaymentConfigPage` |
| `useFundingEnvelope` | Hook | Sections cagnotte, `PiggyBankHeaderButton` |
| `useCagnottePermissions` | Hook | Sections cagnotte (gates UI) |
| `useCagnotteContext`, `useCagnotteContextSafe` | Hooks | Composants dans un `CagnotteLayout` |
| `useUserAdminOrganizations` | Hook | `PaymentConfigPage` |
| `useSaveCagnotteContribution` | Hook | `PaymentConfigPage` |
| `useProjectModalCagnotte` | Hook | `PiggyBankHeaderButton` / headers |
| `CagnotteProvider`, `CagnotteContext` | Context | Usage avancé externe |
| `createMilestoneMutation` + 5 hooks mutation milestone | Hooks | `FinanceSection`, `ActionsSection` |
| `createActionMutation` + 6 hooks mutation action (incl. `useCreateAction`) | Hooks | `ActionsSection` |
| Helpers lib (`editMilestoneWithSync`, `appendProjectMilestone`, `getApiErrorMessage`, …) | Fonctions | Composants qui veulent appeler directement (rare) |
| Types : `FundingMilestone`, `FundingAction`, `FundingProject`, `CagnottePermissions`, `MilestoneSyncContext`, … | Types | DTO publics |
| `CAGNOTTE_QUERY_KEYS` | Constants | Invalidations cross-modules |
| `prefetchFundingEnvelope`, `hasCagnotteSection`, `CAGNOTTE_SECTION_TYPES` | Helpers SSR | Loader / entry-server (cf. §SSR) |
| `calculateCagnottePermissions`, `DEFAULT_CAGNOTTE_PERMISSIONS` | Fonctions | Système de permissions central |

Les **sections JSON** (`ActionsSection`, `FinanceSection`, etc.) ne sont **pas** exposées via `index.ts` — elles sont chargées en lazy par `SectionRenderer` via import dynamique pour préserver le code-splitting `vite-preload`.

`index.ts` charge également deux **side-effects** au montage :
- `import "./i18n"` — enregistre le namespace `modules/cagnotte` auprès d'i18next
- `import "./permissions/register"` — enregistre le calculateur `cagnotte` auprès du registre central des permissions

---

## Hooks

### Query

| Hook | Signature | Rôle |
|---|---|---|
| `useFundingEnvelope(idProjet?, opts?)` | `(idProjet?: string, opts?: { enabled?: boolean }) => UseQueryResult<FundingEnvelopeNormalizedData>` | **Hook central** — appelle `entity.fundingEnvelope()` 2x (`getEnvelopeData` puis `getFormData` si user connecté), normalise et expose milestones/actions/contributors/finance. Enabled uniquement côté client (`typeof window !== 'undefined'`) et si `me?.id` est défini |
| `useOrganizationProjectsWithAnswers(entityId?)` | `() => UseQueryResult<{ projects, answers }>` | Liste projets de l'org + réponses CoForm — utilisé par `PaymentConfigPage` et `CagnotteDialog` |
| `useProjectModalCagnotte(entityId, projectModalId)` | `() => UseQueryResult<ProjectModalCagnotteData>` | Stats financières du projet "principal" sélectionné (header) |
| `useUserAdminOrganizations(currentUser, params?)` | `() => UseQueryResult<AdminOrganization[]>` | Orgs où l'user est admin (filtre serveur strict) |

`useFundingEnvelope.ts` exporte également trois fonctions utilitaires consommées par `prefetchFundingEnvelope` :
- `normalizeFundingEnvelope(rawEnvelope, _contextEntityId?, _contextType?, forcedProjectId?, forcedProfileSlug?)` — normalisation pure, appelable côté SSR
- `extractFormIdFromEnvelope(rawEnvelope)` — extrait le `formId` depuis l'enveloppe `getEnvelopeData`
- `mergeEnvelopePayloads(envelopeData, formData)` — merge minimal des deux réponses backend

### Mutation

| Hook | Rôle |
|---|---|
| `useSaveCagnotteContribution()` | Sauvegarde une contribution dans `answers.aapStep1.depense[N].financer[]`. Se branche au context (`useCocolight()` → `api` + `me`). Mutation atomique via `Answer.updateField` (R0-R9 auto côté lib 1.0.137+) |
| `useProjectModalPreference(entity)` | Persiste le `projectModalId` côté DB via `entity.updateField("preferences", merged)` + appel non-bloquant `entity.get()` pour resynchroniser. Retourne `{ save(projectId): Promise<boolean>, isSaving }` |

### Context/Permissions/Guards

| Hook | Rôle |
|---|---|
| `useCagnotteContext()` / `useCagnotteContextSafe()` | Accès à l'event-bus typé du `CagnotteProvider` (`requestEditMilestone`, `requestDeleteMilestone`, `requestScrollToMilestone`, + 3 `on*` listeners avec `Unsubscribe`) |
| `useCagnottePermissions(entity, data?)` | Wrapper sur `usePermissions(["cagnotte"], entity, ...)` avec mémoisation |
| `useActionGuards({ isConnected, apiClient, projectId, answerId })` | Retourne `{ requireConnected(suffix), requireApiContext(namespace) }` — centralise les gardes répétés dans 6+ handlers |

---

## Mutations & factories

### Pattern factory

`milestone.ts` et `action.ts` exposent chacune une factory `create*Mutation` qui wrappe `useMutationWithToast`. Exemple pour la factory action :

```ts
export function createActionMutation<TParams = void, TData = void>(
  config: ActionMutationConfig<TParams, TData>,
) {
  return function useActionMutation(ctx: ActionMutationContext) {
    const queryClient = useQueryClient();
    return useMutationWithToast<TData, TParams>({
      mutationFn: async (params) => {
        const resolved = resolveContextOrThrow(ctx, queryClient);
        return await config.action(resolved, params);
      },
      namespace: "modules/cagnotte",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      getSuccessParams: config.getSuccessParams
        ? (data, variables) => config.getSuccessParams!(variables, data)
        : undefined,
      invalidateQueries: config.invalidate
        ? config.invalidate(ctx)
        : [CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX()],
    });
  };
}
```

Avantages :
- **Toast auto** (succès + erreur via clés i18n)
- **Invalidation auto** de la query active après succès
- **Validation du contexte** (throw si `apiClient`/`projectId` manquent)
- **Retour typé `TData`** (utilisé pour `useCreateAction` qui retourne `{ actionId }` résolu)

### Mutations exposées

**Milestone** (5) :
- `useCreateMilestone` — crée jalon des 2 côtés (`appendProjectMilestone` + `appendAnswerDepense`)
- `useEditMilestone` — sync name/description/status/targetAmount
- `useCloseMilestone` — `status: close` + `include: false`
- `useRestoreMilestone` — `status: open` + `include: true`
- `useDeleteMilestone` — refuse si financé ; supprime actions liées puis milestone et dépense

**Action** (6) — API **entity-oriented** du SDK (depuis SDK 1.0.130) :
- `useCreateAction` — via `project.action({ ... })` + `action.save()`. La méthode `project.action()` crée un draft `Action` lié au projet parent. Les contributeurs sont passés via `mentions` (liste de `username`s — le backend résout username → userId). `action.id` est peuplé automatiquement après `save()` depuis `content.id` de la réponse serveur. Retourne `{ actionId: string }`.
- `useEditAction` — charge l'entité via `project.action({ id })`, assigne les diffs sur `action.data.*` (proxy SDK), appelle `action.save()`. Les dates DD/MM/YYYY sont converties en ISO 8601 via `parseFrenchDateToIso` avant assignation.
- `useMarkActionDone` — charge l'entité via `project.action({ id })`, appelle `action.updateStatus("done")` (endpoint `set_status` dédié — peuple l'historique des transitions + auto-injecte `endDate` côté backend)
- `useDeleteAction` — charge l'entité via `project.action({ id })`, appelle `action.delete("delete action via cagnotte")` (guard `isAuthorOrAdmin({ checkHierarchy: true })`)
- `useCandidateAction` — charge l'entité via `project.action({ id })`, appelle `action.joinContributor()` (le userId courant est résolu côté serveur)
- `useEditMilestone`, `useCloseMilestone`, `useRestoreMilestone`, `useDeleteMilestone`, `useCreateMilestone` — voir §Milestone ci-dessus

**Pourquoi entity-oriented ?** Le SDK 1.0.130 expose `Action` comme une entité à part entière. Les méthodes de l'entité (`save()`, `updateStatus()`, `joinContributor()`, `delete()`) sont type-safe et maintenues par le SDK. `actionIdResolvers.ts` (workaround historique qui refetchait l'envelope pour récupérer l'id créé) est désormais `@unused` — marqué explicitement dans le fichier.

### Context requis

```ts
MilestoneMutationContext = { api: Api | null, rawEnvelope: unknown, projectId: string, answerId: string }
ActionMutationContext    = { api: Api | null, project: Project | null, projectId: string }
```

`ActionMutationContext.project` est l'entité `Project` du SDK Cocolight (depuis 1.0.130), nécessaire pour accéder à `project.action()`. Récupéré et injecté par `ActionsSection` qui charge le projet courant. `ActionMutationContext.api` est passé en plus de `project` car `ResolvedActionContext` expose un `queryClient` pour les mutations composites.

---

## Forms : Zod + React Hook Form

Tous les dialogs de saisie utilisent **React Hook Form** + **`@hookform/resolvers/zod`** avec les schémas de `schemaForm.ts` :

| Schéma | Form data | Utilisé par |
|---|---|---|
| `milestoneCreateFormSchema` | `{ name, description, targetAmount }` | `CreateMilestoneDialog` |
| `milestoneEditFormSchema` | `{ name, description, targetAmount, status }` | `MilestoneEditDialog`, modal inline dans `FinanceSection` |
| `actionCreateFormSchema` | `{ name, credits, status, milestoneId, tags, contributors: SelectMemberValue[], startDate, endDate }` | `ActionCreateDialog` |
| `actionEditFormSchema` | `{ id, name, credits, status, tags, contributors: SelectMemberValue[], startDate, endDate }` | `ActionEditDialog` |
| `contributionFormSchema` | `{ projectId, totalAmount, financerType, financerId, allocations[], paymentMethod? }` | `CagnotteDialog` / `PaymentConfigPage` (déclaratif, validation runtime) |

**Note** : les champs `contributors` (création et édition d'action) sont de type `SelectMemberValue[]` (`{ id, type, name, username? }`) — défini par `selectMemberValueSchema` interne à `schemaForm.ts`, miroir structurel de `SelectMemberValue` dans `src/components/form/SelectMember.tsx`.

Validation cross-field via `.superRefine` (ex. `startDate ≤ endDate`).

Erreurs affichées via `form.formState.errors.<field>?.message` (les messages sont des **clés i18n** résolues par `t(...)` au rendu).

---

## Composants et rendu

### Sections JSON

5 sections exposées via `schema.ts` + `SectionRenderer` :

| `type` (JSON) | Composant | Rôle |
|---|---|---|
| `actions` | `ActionsSection.tsx` | Liste détaillée des actions par milestone (CRUD complet) |
| `finance` | `FinanceSection.tsx` | Liste milestones avec progression financière + transactions |
| `actions-summary` | `ActionsSummarySection.tsx` | Carte synthèse actions (sidebar) — compteurs + contributeurs |
| `finance-summary` | `FinanceSummarySection.tsx` | Carte synthèse financement (sidebar) — totaux + financeurs |
| `cagnotte-layout` | `CagnotteLayoutSection.tsx` | Wrapper qui rend `<CagnotteProvider>` + dispose `leftSections` / `rightSections` en 2 colonnes |

Schéma commun (4 premières) : `CagnotteBaseSectionPropsSchema = { idProjet?: string, maxItems?: number = 10 }` mutualisé via `.extend()`.

Les 4 sections data-driven ont des props étendues au-delà de la base :
- `actions` : `showStatus`, `showProgress`, `showDates` (boolean, défaut `true`), `layout` (`"list" | "grid" | "timeline"`, défaut `"list"`)
- `finance` : `showProgress`, `showFundingGoal`, `showContributors` (boolean, défaut `true`), `showTimeline` (défaut `false`), `layout` (`"cards" | "list" | "compact"`, défaut `"cards"`)
- `actions-summary` : `showKpis`, `showCharts` (boolean, défaut `true`), `charts.statusDistribution.type` (`"pie" | "bar" | "list"`), `charts.timeline.type` (`"bar" | "line" | "list"`)
- `finance-summary` : `showKpis`, `showCharts` (boolean, défaut `true`), `charts.fundingProgress.type` (`"progress" | "bar" | "list"`), `charts.amountByMilestone.type` (`"bar" | "list"`)

**Attention** : ces props étendues sont déclarées dans `schema.ts` mais leur implémentation effective dans les composants peut différer — les schémas servent principalement à la validation JSON de la config site.

### Dialogs autonomes RHF

Chaque dialog embarque son propre `useForm + zodResolver` + sa mutation. API uniforme :

```ts
interface MilestoneEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: MilestoneEditFormData;
  milestoneId: string;
  mutation: UseMutationResult<void, Error, EditMilestoneParams>;
  apiErrorFallbackKey: string;
  onSuccess?: () => void;
}
```

4 dialogs autonomes :
- `CreateMilestoneDialog` (`components/sections/`)
- `MilestoneEditDialog` (`parts/`)
- `ActionCreateDialog` (`parts/`) — utilise `useCreateAction`, retourne `CreateActionResult` (`{ actionId }`) en callback `onSuccess` pour orchestrer le scroll target côté parent
- `ActionEditDialog` (`parts/`) — calcule le diff via `calculateActionDiff` avant la mutation ; si delta vide (`Object.keys(diff).length === 0`), affiche toast `"noModification"` et ferme sans appel API

### Parts présentationnels

Sans state interne, callbacks remontés au parent :

| Composant | Rôle |
|---|---|
| `parts/MilestoneCard.tsx` | Rendu d'une carte milestone open : titre, stats, boutons admin, sections collapsibles actions/done. ~30 props (perms, loading IDs, refs, handlers) |
| `parts/ClosedMilestonesSection.tsx` | Section repliable des milestones clôturés (avec bouton `restore`) |
| `parts/badges.tsx` | `MilestoneStatusBadge`, `ActionStatusBadge`, `ContributorsAvatars` |
| `MilestoneManageActions.tsx` | Trio boutons admin (edit/close/restore/delete) avec spinners |

### `PiggyBankHeaderButton`

Composant header (`components/PiggyBankHeaderButton.tsx`) affiché dans les headers de site (ex. `HeaderTransparentScroll`) :

- Lit `entity.serverData.preferences.projectModalId` via `useReactiveProperty` (réactif aux mutations live)
- Consomme `useFundingEnvelope(projectModalId)` — partage le cache React Query avec `CagnotteDialog` (0 fetch supplémentaire à l'ouverture)
- Affiche le montant `targetProject.totalFinancement` en temps réel (PiggyBank icon + montant en €)
- Masqué si `me?.id` est nul (feature member-only, évite d'afficher "0 €" pour les anonymes)
- Ouvre `<CagnotteDialog>` au clic avec `defaultProjectId` pré-sélectionné

### `CagnotteDialog` — parts supplémentaires

En plus des 4 parts documentés, `components/parts/` contient :
- `CagnotteContributeButton.tsx` — bouton "Contribuer" (standalone)
- `CagnotteProjectProgressCard.tsx` — carte de progression d'un projet sélectionné

---

## Permissions

Le module enregistre un namespace `cagnotte` via `register.ts` (side-effect). 11 permissions calculées dans `calculators/cagnotte.ts` :

| Permission | Règle |
|---|---|
| `canContribute` | connecté (`isConnected`) + `projectId` non vide + `hasActiveMilestones === true` (passé via `data`) |
| `canCreateMilestone` | admin du projet |
| `canEditMilestone(m)` | admin + milestone non `close` (statut `open` ou `done`) |
| `canCloseMilestone(m)` | admin + milestone en statut `open` exactement |
| `canRestoreMilestone(m)` | admin + milestone en statut `close` exactement |
| `canDeleteMilestone(m)` | admin + `m.hasTransactions !== true` |
| `canCreateAction(m)` | admin + milestone non `close` |
| `canEditAction(a)` | si `a.status === "done"` : admin uniquement ; sinon : admin OU contributeur (`a.contributorIds.includes(currentUserId)`) |
| `canMarkActionDone(a)` | (admin OU contributeur) + `a.status === "todo"` |
| `canDeleteAction(a)` | admin uniquement (signature `(action) => isAdmin` — le paramètre `action` est ignoré) |
| `canCandidateAction(a)` | `currentUserId` non vide + `a.status === "todo"` + pas déjà contributeur |

Métadonnées exposées : `isConnected`, `isAdmin`, `isContributor`, `currentUserId`.

**Note sur `canContribute`** : `canContribute` requiert que `me` soit connecté (`isConnected`). Si l'utilisateur n'est pas connecté ou si `entity` est absent, le calculateur fait un early-return vers `DEFAULT_CAGNOTTE_PERMISSIONS` (`canContribute: false`). La condition complète est : connecté + `projectId` non vide + `hasActiveMilestones === true`.

**Usage** :
```ts
const perms = useCagnottePermissions(entity, {
  hasActiveMilestones: openMilestones.length > 0,
  projectId,
});
if (perms.canCreateMilestone) { /* ... */ }
if (perms.canEditAction(action)) { /* ... */ }
```

**Note importante** sur le choix de l'`entity` : sur une page profil projet, c'est l'entité du **profil consulté** qu'il faut passer (via `useOptionalProfileEntity()`), pas l'entité du site (via `useCocolight().entity`). Voir [Pièges connus](#pièges-connus).

---

## Services de paiement

3 services actifs :

| Service | Rôle |
|---|---|
| `stripeService.ts` | `getStripePublicKey()` (env), `getStripeErrorMessage(code)` (mapping codes Stripe → messages i18n) |
| `helloAssoCheckoutIntent.ts` | `createHelloAssoCheckoutIntent(payload)` → `/api/helloasso/checkout-intent` ; `openHelloAssoPaymentWithCheckout(url, config)` ouvre la popup, gère close-watcher |
| `helloAssoVerification.ts` | `verifyHelloAssoCheckoutStatus(id)` → `/api/helloasso/checkout-status/:id` ; utilisé en polling 5s |

4 services dépréciés (cf. `@deprecated` en tête) :
- `helloAssoService.ts` : 4 exports morts (popup direct) ; conserve `buildHelloAssoPaymentData` + `validateHelloAssoConfig`
- `helloAssoWebhook.ts` : handlers webhook non branchés (front utilise polling)
- `fundingEnvelopePayment.ts` : v1 obsolète, remplacée par `entity.fundingEnvelope()` SDK natif
- `paymentDataProcessor.ts` : schema `financer` obsolète

### Flux paiement complet

```
CagnotteDialog (sélection projet/milestones/montant)
  ↓
PaymentConfigPage (sélection financeur + méthode)
  ↓
  ├─ Stripe → StripePaymentForm (Elements inline)
  │  └─ entity.fundingEnvelope({ action: "stripePay", ... })
  │
  └─ HelloAsso → openHelloAssoPaymentWithCheckout (popup)
     └─ polling verifyHelloAssoCheckoutStatus toutes les 5s
        → verification.isValid === true
  ↓
useSaveCagnotteContribution.saveContribution()
  └─ Answer.updateField("aapStep1.depense.N.financer", [...]) atomique (lib 1.0.137+, R0-R9 auto)
  ↓
launchConfettiBurst + toast succès
```

---

## React Query

6 clés (dont 3 préfixes pour invalidations) dans `constants/queryKeys.ts` :

| Key | Forme |
|---|---|
| `FUNDING_ENVELOPE(entityId, contextType, projectId, profileSlug, userId)` | `["funding-envelope", entityId, contextType, projectId, profileSlug, userId]` |
| `FUNDING_ENVELOPE_PREFIX()` | `["funding-envelope"]` (invalidations globales) |
| `ORGANIZATION_PROJECTS_WITH_ANSWERS(entityId)` | `["organization-projects-with-answers", entityId]` |
| `ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX()` | `["organization-projects-with-answers"]` |
| `PROJECT_MODAL_CAGNOTTE(entityId, projectModalId)` | `["projectModalCagnotte", entityId, projectModalId]` |
| `PROJECT_MODAL_CAGNOTTE_PREFIX()` | `["projectModalCagnotte"]` |

**Invalidation** : toutes les mutations milestone/action invalident `FUNDING_ENVELOPE_PREFIX()` via la factory. `CagnotteDialog` invalide en plus `ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX` après contribution.

**Pourquoi `userId` dans la queryKey ?** Le `queryFn` de `useFundingEnvelope` enrichit via `getFormData` avec `financerId: me.id` ; sans cette dimension dans la clé, deux utilisateurs distincts dans la même session pourraient se voir servir les données enrichies du premier depuis le cache. Bug corrigé.

---

## SSR / Prefetch

`prefetchFundingEnvelope(queryClient, params)` (`prefetch/prefetchFundingEnvelope.ts`) :

```ts
await prefetchFundingEnvelope(queryClient, {
  entity,                  // EntityTypes (project / organization / user)
  entityId: entity.id,
  contextType: "projects", // ou "organizations", "citoyens"
  projectId,
  profileSlug: params.slug,
  me,                      // User | null (null côté SSR si pas d'auth)
});
```

La queryKey générée par le prefetch match celle de `useFundingEnvelope` (incluant `me?.id ?? null`), donc le cache est correctement consommé à l'hydratation. Échec silencieux si l'entité n'expose pas `fundingEnvelope()` → le client fera le fetch normalement.

**`prefetch/index.ts`** exporte également :
- `CAGNOTTE_SECTION_TYPES` — `Set<string>` des 4 types de sections (`"actions"`, `"finance"`, `"actions-summary"`, `"finance-summary"`)
- `hasCagnotteSection(sections)` — walk récursif sur une liste de sections JSON (inclut les `leftSections`/`rightSections` de `profile-tab-layout`) pour détecter la présence d'une section cagnotte

**Statut au repo** : exporté mais pas branché côté loader / entry-server (cf. [Décisions design en attente](#décisions-design-en-attente)).

---

## i18n

Namespace : **`modules/cagnotte`**. Enregistré en side-effect par `i18n.ts`.

Sections dans `i18n/fr.json` et `i18n/en.json` :

- `validation.*` — erreurs Zod (milestone/action/amount/date/id/contribution)
- `toasts.*` — succès/erreurs des mutations contribution (`contributionSaved`, `contributionPartial`, `errors.*`)
- `milestone.errors.*` — messages levés depuis les handlers `lib/` (apiClientUnavailable, projectIdMissing, answerIdMissing, syncContextMissing, cannotCloseWithOpenActions, cannotDeleteIfFunded, noIndexForDelete, actionIdMissing, deleteActionUnavailable, projectMissing)
- `CreateMilestoneDialog.*` — labels + toasts de création milestone
- `MilestoneCreateTrigger.*` — toast connexion requise (trigger)
- `MilestoneManageActions.*` — labels boutons admin
- `FinanceSection.*` — section finance complète (milestones, toasts, dialogs inline)
- `ActionsSection.*` — section actions complète (toasts, dialogs, erreurs, badges, confirm)
- `ActionsSummarySection.*` — synthèse jalons (stats, contributeurs)
- `FinanceSummarySection.*` — synthèse financement (stats, financeurs)
- `CagnotteDialog.*` — dialog principale (labels, toasts, success screen, celebration)
- `PaymentConfigPage.*` — configuration paiement (Stripe, HelloAsso, toasts, erreurs)
- `StripePaymentForm.*` — formulaire Stripe Elements (erreurs, actions, toasts, configErrors)
- `common.*` — labels partagés (loading, addMilestone, progress, supportProject)
- `a11y.*` — labels accessibilité (back)

Usage hors composant React (libs) :
```ts
import i18n from "@/i18n";
const t = (key: string): string => String(i18n.t(key, { ns: "modules/cagnotte" }));
```

---

## Pièges connus

### 1. Entity Cocolight → `serverData`

`envelope.project` retourné par `entity.fundingEnvelope()` est une **Entity Cocolight** (instance de classe), pas un POJO. Les données du document Mongo (`oceco`, `name`, etc.) sont rangées sous `entity.serverData`, pas à la racine.

Symptôme du bug initial : impossible d'éditer un jalon avec message « ce jalon est absent de `projects.oceco.milestones` (côté projet) » alors que la BDD contenait bien le jalon. Cause : accès `entity.oceco.milestones` au lieu de `entity.serverData.oceco.milestones`.

Fix : utiliser `getServerData(entity)` (`utils/dataTransform.ts`) qui résout l'indirection.

### 2. `useFundingEnvelope` fait deux appels backend

`getEnvelopeData` toujours appelé. `getFormData` appelé en plus si `formId` extractible **et** `me?.id` non null. Le merge (`mergeEnvelopePayloads`) écrase certains champs : `projects`, `links`, `contextData`, `nopropProject`. Implication : côté SSR (sans auth), seul `getEnvelopeData` est consommé ; le client ré-appelle si l'utilisateur est connecté.

La query est également **désactivée côté SSR** (`enabled: typeof window !== 'undefined' && ...`) : le serveur n'a pas de session, donc `me` est null, ce qui retournerait une enveloppe anonyme avec `totalFinancement: 0`. Le prefetch SSR passe par `prefetchFundingEnvelope` qui réutilise le même `queryFn` avec les mêmes règles.

### 3. AJV — flatten objet imbriqué (résolu SDK 1.0.126, puis supplanté)

Avant `1.0.126`, le schéma AJV de `COSTUM_PROJECT_ACTION_REQUEST_NEW` déclarait `"milestone[milestoneId]": string` (notation bracket) et refusait `milestone: { milestoneId }` (objet imbriqué). Depuis `1.0.126`, le schéma accepte l'objet imbriqué. Cette correction est désormais sans portée pratique car `useCreateAction` utilise l'API entity-oriented `project.action()` + `action.save()` depuis SDK 1.0.130, qui ne passe plus par `endpointApi.costumProjectActionRequestNew`.

### 4. Permissions : entité du profil vs entité du site

Sur une page profil (`/profil/:slug`), `useCocolight().entity` retourne l'entité **du site** (l'org configurée via `VITE_SLUG`), pas l'entité **du profil consulté**. Conséquence : un user admin du projet visité mais pas du site verrait `canEditMilestone = false`.

Fix appliqué dans les sections cagnotte :
```ts
const profileCtx = useOptionalProfileEntity();
const permissionEntity = profileCtx?.entity ?? entity;
const perms = useCagnottePermissions(permissionEntity, { ... });
```

`CagnotteDialog` (header) reste sur l'entité site car son action (préférence `projectModalId`) cible l'org.

### 5. `checkHierarchy` non utilisé pour project

Pour cohérence avec `profil/permissions/calculators/project.ts` (qui n'utilise pas `entity.isAdmin({ checkHierarchy: true })`), le calculateur cagnotte considère qu'un admin de l'orga parente **n'est pas** automatiquement admin du projet enfant. Seul `event.ts` du module profil applique `checkHierarchy: true`.

### 6. Atomicité `deleteMilestoneWithSync`

La boucle `for await` qui supprime les actions liées une par une n'est pas atomique. Si la 3ᵉ suppression échoue, les 2 premières restent supprimées sans rollback. Pas critique en pratique mais à robustifier si forte volumétrie d'actions.

### 7. Couplage au schéma `aapStep1`

Le module suppose que le CoForm cible contient `answers.aapStep1.depense[]`. Pour généraliser à d'autres structures d'appel à projet, il faudrait paramétriser ce chemin.

---

## Décisions design en attente

1. **Webhook HelloAsso vs polling** : `services/helloAssoWebhook.ts` contient le handler webhook (validation HMAC + processing) mais n'est pas branché. Le front utilise polling à la place. Choix à acter.

3. **Prefetch SSR non câblé** : `prefetchFundingEnvelope` est exporté mais pas invoqué côté loader. Raison : pas d'auth SSR (`me` est null côté serveur), donc `getFormData` ne serait pas appelé — le bénéfice est limité. À reconsidérer si auth SSR est mise en place.

4. **Placeholders à statuer** : `FinancingPages.tsx`, `ProjectsFinancingDisplay.tsx` (vides, marqués `@deprecated`). Implémenter ou supprimer.

5. **`CagnotteDialog.tsx` (>900 lignes)** : refactor envisageable en sous-composants (sélecteur projet, sélecteur milestones, sélecteur montant, écran succès).

6. **Tests** : les helpers purs disposent déjà de tests unitaires (Vitest) :
   - `utils/dataTransform.test.ts` — 9 fonctions testées
   - `utils/format.test.ts`
   - `utils/actionDateHelpers.test.ts`
   - `utils/idGeneration.test.ts`
   - `lib/actionDiffCalculator.test.ts`
   - `lib/actionIdResolvers.test.ts`

   Manquent encore : tests d'intégration des factories de mutations, E2E du flux contribution.

---

## Exemple de configuration JSON

Page profil projet avec onglets cagnotte (Finance + Actions) :

```json
{
  "path": "/projet/:slug",
  "sections": [
    {
      "type": "cagnotte-layout",
      "props": {
        "leftSections": [
          { "type": "finance", "props": { "maxItems": 10 } }
        ],
        "rightSections": [
          { "type": "finance-summary", "props": { "maxItems": 5 } }
        ]
      }
    }
  ]
}
```

Section autonome dans la sidebar d'une autre page :
```json
{
  "type": "finance-summary",
  "props": {
    "idProjet": "65a1f7b3c2d4e8f9a0b1c2d3",
    "maxItems": 5
  }
}
```

---

## Voir aussi

- [Architecture](03-architecture.md) — système de modules et `SectionRenderer`
- [Module Profil](08-module-profil.md) — `useOptionalProfileEntity`, conventions de structure
- [Permissions](10-permissions.md) — registre central des permissions
- [API & Authentification](11-api-authentification.md) — `cocolight-api-client` (Entity, `endpointApi`)
- [Internationalisation](13-i18n.md) — pattern `useT` + namespaces
- [Backend & SSR](14-backend-ssr.md) — Express dev/prod, hydratation React Query
