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
├── schema.ts                           # 5 schémas Zod des sections JSON site-config
├── schemaForm.ts                       # Schémas Zod pour forms RHF (milestone + action + contribution)
├── types.ts                            # Types canoniques (FundingMilestone, FundingAction, …)
│
├── actions/mutations/
│   ├── milestone.ts                    # Factory + 5 mutations (Create/Edit/Close/Restore/Delete)
│   ├── action.ts                       # Factory <TParams, TData> + 5 mutations (incl. useCreateAction)
│   └── index.ts
│
├── components/
│   ├── CagnotteDialog.tsx              # Modal principal de contribution
│   ├── PaymentConfigPage.tsx           # Page configuration Stripe + HelloAsso
│   ├── StripePaymentForm.tsx           # Formulaire carte Stripe Elements
│   ├── ProjectsFinancingDisplay.tsx    # @deprecated PLACEHOLDER vide
│   ├── parts/                          # Sous-composants de CagnotteDialog
│   │   ├── CagnotteAmountPicker.tsx
│   │   ├── CagnotteMilestoneList.tsx
│   │   ├── CagnotteProjectSelector.tsx
│   │   └── CagnotteSuccessScreen.tsx
│   └── sections/
│       ├── ActionsSection.tsx          # 731 l. — section JSON `actions` (orchestrateur)
│       ├── FinanceSection.tsx          # Section JSON `finance`
│       ├── ActionsSummarySection.tsx   # Section JSON `actions-summary` (sidebar)
│       ├── FinanceSummarySection.tsx   # Section JSON `finance-summary` (sidebar)
│       ├── CagnotteLayoutSection.tsx   # Section JSON `cagnotte-layout` (wrapper + provider)
│       ├── CreateMilestoneDialog.tsx   # Dialog autonome RHF de création
│       ├── MilestoneCreateTrigger.tsx
│       ├── MilestoneManageActions.tsx  # UI boutons edit/close/restore/delete
│       ├── SummaryMilestoneCreateCard.tsx
│       └── parts/
│           ├── MilestoneCard.tsx              # Rendu d'une carte milestone open
│           ├── ClosedMilestonesSection.tsx    # Section repliable jalons clôturés
│           ├── ActionCreateDialog.tsx         # Dialog autonome RHF
│           ├── ActionEditDialog.tsx           # Dialog autonome RHF
│           ├── MilestoneEditDialog.tsx        # Dialog autonome RHF
│           └── badges.tsx                     # MilestoneStatusBadge, ActionStatusBadge, ContributorsAvatars
│
├── constants/
│   └── queryKeys.ts                    # CAGNOTTE_QUERY_KEYS (4 keys)
│
├── contexts/
│   ├── CagnotteContext.tsx             # Type CagnotteContextValue
│   ├── CagnotteProvider.tsx            # Event-bus typé (request edit/delete/scroll milestone)
│   └── index.ts
│
├── hooks/
│   ├── useFundingEnvelope.ts           # Query React Query principale (envelope normalisée)
│   ├── useCagnottePermissions.ts       # Wrapper typé sur usePermissions
│   ├── useCagnotteContext.ts           # Accès au CagnotteProvider (safe + strict)
│   ├── useActionGuards.ts              # requireConnected + requireApiContext
│   ├── useOrganizationProjectsWithAnswers.ts  # Liste projets org + réponses CoForm
│   ├── useProjectModalCagnotte.ts      # Query : projet par défaut d'une org
│   ├── useProjectModalPreference.ts    # Mutation : persiste la préférence (DB + localStorage)
│   ├── useSaveCagnotteContribution.ts  # Mutation contribution (atomique)
│   └── useUserAdminOrganizations.ts    # Query : orgs admin du user (filtre MongoDB)
│
├── lib/
│   ├── milestoneSyncContext.ts         # resolveMilestoneSyncContext, getEnvelopeProjects
│   ├── milestoneMutationHandlers.ts    # edit/close/restore/deleteMilestoneWithSync
│   ├── actionMilestonePathUpdates.ts   # Helpers bas-niveau (updatePathValue, deleteElement)
│   ├── actionIdResolvers.ts            # resolveActionEntityId, resolveCreatedActionId
│   └── actionDiffCalculator.ts         # calculateActionDiff (helper pur)
│
├── pages/
│   └── FinancingPages.tsx              # @deprecated PLACEHOLDER vide
│
├── permissions/
│   ├── calculators/cagnotte.ts         # 11 permissions calculées
│   ├── defaults.ts                     # DEFAULT_CAGNOTTE_PERMISSIONS
│   ├── register.ts                     # registerPermissions(namespace: "cagnotte")
│   ├── types.ts                        # CagnottePermissions, CagnottePermissionData
│   └── index.ts
│
├── prefetch/
│   ├── prefetchFundingEnvelope.ts      # Helper SSR (exporté, voir §SSR)
│   └── index.ts
│
├── services/
│   ├── stripeService.ts                # Stripe public key + error mapping
│   ├── helloAssoCheckoutIntent.ts      # Création checkout HelloAsso + popup
│   ├── helloAssoVerification.ts        # Polling statut paiement
│   ├── helloAssoService.ts             # 4 exports @deprecated + 2 actifs
│   ├── helloAssoWebhook.ts             # @deprecated PAS BRANCHÉ
│   ├── fundingEnvelopePayment.ts       # @deprecated REMPLACÉ
│   └── paymentDataProcessor.ts         # @deprecated SCHEMA OBSOLÈTE
│
└── utils/
    ├── dataTransform.ts                # asRecord, getServerData, toNumber, toArray, getEntityId, …
    ├── format.ts                       # formatCurrency (Intl.NumberFormat), formatDate, initials
    ├── actionDateHelpers.ts            # parseFrenchDateToIso, frenchDate↔pickerValue, timestampToFrenchDate
    └── idGeneration.ts                 # generateMilestoneId (24-char hex Mongo-like)
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

Cas piège : accéder à `entity.oceco.milestones` retourne `undefined` car `oceco` est sous `entity.serverData.oceco`. Ce bug a été corrigé dans `milestoneSyncContext.ts` et `useFundingEnvelope.ts` (cf. [Pièges connus](#pièges-connus)).

---

## Surface API publique (`index.ts`)

Exports principaux consommés hors du module :

| Export | Type | Consommateurs externes |
|---|---|---|
| `moduleConfig` | `ModuleConfigSchema` | `discoverModules()` |
| `CagnotteDialog` | Composant | `HeaderRezoLaMer`, `FinanceSection`, `FinanceSummarySection` |
| `PaymentConfigPage` | Composant | Interne (rendu par `CagnotteDialog`) |
| `useFundingEnvelope` | Hook | Sections cagnotte, cartes profil |
| `useCagnottePermissions` | Hook | Sections cagnotte (gates UI) |
| `useUserAdminOrganizations` | Hook | `PaymentConfigPage` |
| `useSaveCagnotteContribution` | Hook | `PaymentConfigPage` |
| `useProjectModalCagnotte`, `useProjectModalPreference` | Hooks | `HeaderRezoLaMer` |
| Factory + 5 hooks mutation milestone | Hooks | `FinanceSection`, `ActionsSection` |
| Factory + 5 hooks mutation action (incl. `useCreateAction`) | Hooks | `ActionsSection` |
| Helpers lib (`editMilestoneWithSync`, …) | Fonctions | Composants qui veulent appeler directement (rare) |
| Types : `FundingMilestone`, `FundingAction`, `FundingProject`, `CagnottePermissions`, … | Types | DTO publics |
| `CAGNOTTE_QUERY_KEYS` | Constants | Invalidations cross-modules |
| `prefetchFundingEnvelope`, `hasCagnotteSection` | Helpers SSR | Loader / entry-server (cf. §SSR) |

Les **sections JSON** (`ActionsSection`, `FinanceSection`, etc.) ne sont **pas** exposées via `index.ts` — elles sont chargées en lazy par `SectionRenderer` via import dynamique pour préserver le code-splitting `vite-preload`.

---

## Hooks

### Query

| Hook | Signature | Rôle |
|---|---|---|
| `useFundingEnvelope(projectId?)` | `() => UseQueryResult<FundingEnvelopeNormalizedData>` | **Hook central** — appelle `entity.fundingEnvelope()` 2x (`getEnvelopeData` puis `getFormData` si user connecté), normalise et expose milestones/actions/contributors/finance |
| `useOrganizationProjectsWithAnswers(entityId?)` | `() => UseQueryResult<{ projects, answers }>` | Liste projets de l'org + réponses CoForm — utilisé par `PaymentConfigPage` et `CagnotteDialog` |
| `useProjectModalCagnotte(entityId, projectModalId)` | `() => UseQueryResult<ProjectModalCagnotteData>` | Stats financières du projet "principal" sélectionné (header) |
| `useUserAdminOrganizations(currentUser, params?)` | `() => UseQueryResult<AdminOrganization[]>` | Orgs où l'user est admin (filtre serveur strict) |

### Mutation

| Hook | Rôle |
|---|---|
| `useSaveCagnotteContribution(answerEntity, apiClient)` | Sauvegarde une contribution dans `answers.aapStep1.depense[N].financer[]` (atomique via `updatePathValue`, fallback `entity.save()`) |
| `useProjectModalPreference(entity)` | Persiste le `projectModalId` côté DB (`organizations.preferences`) + miroir localStorage |

### Context/Permissions/Guards

| Hook | Rôle |
|---|---|
| `useCagnotteContext()` / `useCagnotteContextSafe()` | Accès à l'event-bus typé du `CagnotteProvider` (`requestEditMilestone`, `requestDeleteMilestone`, `requestScrollToMilestone`) |
| `useCagnottePermissions(entity, data?)` | Wrapper sur `usePermissions(["cagnotte"], entity, ...)` avec mémoisation |
| `useActionGuards({ isConnected, apiClient, projectId, answerId })` | Retourne `{ requireConnected(suffix), requireApiContext(namespace) }` — centralise les gardes répétés dans 9+ handlers |

---

## Mutations & factories

### Pattern factory

`milestone.ts` et `action.ts` exposent chacune une factory `create*Mutation` qui wrappe `useMutationWithToast` :

```ts
export function createActionMutation<TParams, TData = void>(
  config: ActionMutationConfig<TParams, TData>,
) {
  return function useActionMutation(ctx: ActionMutationContext) {
    const queryClient = useQueryClient();
    return useMutationWithToast<TData, TParams>({
      mutationFn: async (params) => config.action(resolveContextOrThrow(ctx, queryClient), params),
      namespace: "modules/cagnotte",
      successKey: config.i18n.successKey,
      errorKey: config.i18n.errorKey,
      invalidateQueries: config.invalidate?.(ctx) ?? [CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX()],
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

**Action** (5) :
- `useCreateAction` — composite : appelle `endpointApi.costumProjectActionRequestNew` (méthode typée SDK depuis 1.0.126) → `refetchQueries` → `resolveCreatedActionId` → `updateProjectActionFields` pour metadata (tags, contributeurs, dates). Retourne `{ actionId }`.
- `useEditAction` — met à jour les champs édités (diff calculé via `calculateActionDiff`)
- `useMarkActionDone` — `status: done`
- `useDeleteAction` — supprime l'action
- `useCandidateAction` — ajoute l'user comme contributor

### Context requis

```ts
MilestoneMutationContext = { apiClient, rawEnvelope, projectId, answerId }
ActionMutationContext    = { apiClient, api, projectId }
```

`api` est l'instance `Api` du SDK Cocolight, nécessaire pour accéder à `endpointApi.<method>` (méthodes typées). Récupéré via `useCocolight()`.

---

## Forms : Zod + React Hook Form

Tous les dialogs de saisie utilisent **React Hook Form** + **`@hookform/resolvers/zod`** avec les schémas de `schemaForm.ts` :

| Schéma | Form data | Utilisé par |
|---|---|---|
| `milestoneCreateFormSchema` | `{ name, description, targetAmount }` | `CreateMilestoneDialog` |
| `milestoneEditFormSchema` | `{ name, description, targetAmount, status }` | `MilestoneEditDialog`, modal inline dans `FinanceSection` |
| `actionCreateFormSchema` | `{ name, credits, status, milestoneId, tags, contributorIds, startDate, endDate }` | `ActionCreateDialog` |
| `actionEditFormSchema` | `{ id, name, credits, status, tags, contributorIds, startDate, endDate }` | `ActionEditDialog` |
| `contributionFormSchema` | `{ projectId, totalAmount, financerType, financerId, allocations[], paymentMethod? }` | `CagnotteDialog` / `PaymentConfigPage` (déclaratif, validation runtime) |

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
- `ActionCreateDialog` (`parts/`) — utilise `useCreateAction`, callback `onSuccess(actionId, status)` pour orchestrer le scroll target côté parent
- `ActionEditDialog` (`parts/`) — calcule le diff via `calculateActionDiff` avant la mutation ; si delta vide, affiche toast "noModification" et ferme sans appel API

### Parts présentationnels

Sans state interne, callbacks remontés au parent :

| Composant | Rôle |
|---|---|
| `parts/MilestoneCard.tsx` | Rendu d'une carte milestone open : titre, stats, boutons admin, sections collapsibles actions/done. ~30 props (perms, loading IDs, refs, handlers) |
| `parts/ClosedMilestonesSection.tsx` | Section repliable des milestones clôturés (avec bouton `restore`) |
| `parts/badges.tsx` | `MilestoneStatusBadge`, `ActionStatusBadge`, `ContributorsAvatars` |
| `MilestoneManageActions.tsx` | Trio boutons admin (edit/close/restore/delete) avec spinners |

---

## Permissions

Le module enregistre un namespace `cagnotte` via `register.ts` (side-effect). 11 permissions calculées dans `calculators/cagnotte.ts` :

| Permission | Règle |
|---|---|
| `canContribute` | `projectId` non vide + au moins un milestone non clôturé |
| `canCreateMilestone` | connecté + admin du projet |
| `canEditMilestone(m)` | admin + milestone non `close` |
| `canCloseMilestone(m)` | admin + milestone `open` |
| `canRestoreMilestone(m)` | admin + milestone `close` |
| `canDeleteMilestone(m)` | admin + pas de transactions |
| `canCreateAction(m)` | admin + milestone non `close` |
| `canEditAction(a)` | admin OU contributeur de l'action (pas si `done` pour non-admin) |
| `canMarkActionDone(a)` | (admin OU contributeur) + action `todo` |
| `canDeleteAction(a)` | admin uniquement |
| `canCandidateAction(a)` | connecté + action `todo` + pas déjà contributeur |

Métadonnées exposées : `isConnected`, `isAdmin`, `isContributor`, `currentUserId`.

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
  └─ updatePathValue atomique sur answers.aapStep1.depense[N].financer[]
  ↓
launchConfettiBurst + toast succès
```

---

## React Query

4 query keys (`constants/queryKeys.ts`) :

| Key | Forme |
|---|---|
| `FUNDING_ENVELOPE` | `["funding-envelope", entityId, contextType, projectId, profileSlug, userId]` |
| `FUNDING_ENVELOPE_PREFIX` | `["funding-envelope"]` (invalidations globales) |
| `ORGANIZATION_PROJECTS_WITH_ANSWERS` | `["organization-projects-with-answers", entityId]` |
| `PROJECT_MODAL_CAGNOTTE` | `["projectModalCagnotte", entityId, projectModalId]` |

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

**Statut au repo** : exporté mais pas branché côté loader / entry-server (cf. [Décisions design en attente](#décisions-design-en-attente)).

---

## i18n

Namespace : **`modules/cagnotte`**. Enregistré en side-effect par `i18n.ts`.

Sections dans `i18n/fr.json` et `i18n/en.json` :

- `validation.*` — erreurs Zod (milestone/action/amount/date/id/contribution)
- `toasts.*` — succès/erreurs des mutations (contributionSaved, milestoneCreated, …)
- `CreateMilestoneDialog.*`, `FinanceSection.*`, `ActionsSection.*`, `CagnotteDialog.*`, `PaymentConfigPage.*`, `StripePaymentForm.*` — labels UI
- `milestone.errors.*` — messages levés depuis les handlers `lib/`

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

`getEnvelopeData` toujours appelé. `getFormData` appelé en plus si `formId` extractible **et** `me?.id` non null (cf. `useFundingEnvelope.ts:570-600`). Le merge écrase certains champs (`projects`, `links`, `contextData`, `nopropProject`). Implication : côté SSR (sans auth), seul `getEnvelopeData` est consommé ; le client ré-appelle si l'utilisateur est connecté.

### 3. AJV — flatten objet imbriqué (résolu SDK 1.0.126)

Avant `1.0.126`, le schéma AJV de `COSTUM_PROJECT_ACTION_REQUEST_NEW` déclarait `"milestone[milestoneId]": string` (notation bracket) et refusait `milestone: { milestoneId }` (objet imbriqué). Un fallback hacky utilisait `apiClient._client.request()` (API privée). Depuis `1.0.126`, le schéma accepte l'objet imbriqué et `endpointApi.costumProjectActionRequestNew(...)` est la méthode typée à utiliser. Plus de fallback.

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

1. **HelloAsso côté serveur non branché** : `server/api/helloasso-checkout.js` exporte 5 handlers Express mais n'est pas mounté dans `server/dev-server.js` ni `prod-server.js`. Les routes `/api/helloasso/*` retournent 404. Pour activer :
   ```js
   import {
     helloassoCheckoutIntentHandler,
     helloassoCheckoutStatusHandler,
     helloassoCallbackHandler,
     ...
   } from "./api/helloasso-checkout.js";
   app.post("/api/helloasso/checkout-intent", helloassoCheckoutIntentHandler);
   app.get("/api/helloasso/checkout-status/:checkoutIntentId", helloassoCheckoutStatusHandler);
   app.get("/api/helloasso/callback", helloassoCallbackHandler);
   ```

2. **Webhook HelloAsso vs polling** : `services/helloAssoWebhook.ts` contient le handler webhook (validation HMAC + processing) mais n'est pas branché. Le front utilise polling à la place. Choix à acter.

3. **Prefetch SSR non câblé** : `prefetchFundingEnvelope` est exporté mais pas invoqué côté loader. Raison : pas d'auth SSR (`me` est null côté serveur), donc `getFormData` ne serait pas appelé — le bénéfice est limité. À reconsidérer si auth SSR est mise en place.

4. **Placeholders à statuer** : `FinancingPages.tsx`, `ProjectsFinancingDisplay.tsx` (vides, marqués `@deprecated`). Implémenter ou supprimer.

5. **`CagnotteDialog.tsx` (>900 lignes)** : refactor envisageable en sous-composants (sélecteur projet, sélecteur milestones, sélecteur montant, écran succès).

6. **Tests** : aucun test dédié cagnotte (`tests/` ni `e2e/`). Priorités envisagées : tests unitaires des helpers purs (`actionDateHelpers`, `actionDiffCalculator`, `actionIdResolvers`), tests d'intégration des factories de mutations, E2E du flux contribution.

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
