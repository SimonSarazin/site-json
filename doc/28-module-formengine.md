[← Index](README.md)

# Module formEngine (moteur de formulaire générique + costums config-driven)

Système de formulaires en **3 couches**, du plus générique au plus spécifique :

1. **Le moteur** (`src/modules/formEngine/`, *leaf* — zéro import `@/modules/profil`, SDK ou hooks React) : un
   `FormDescriptor` (champs + widgets + sections + read/write) → `GenericForm` (React-Hook-Form + zod généré +
   conditionnel + computed + layouts lazy). Tout ce qui n'est pas sérialisable est une **clé de registre**.
2. **La couche config** (`formEngine/config/`) : un `JsonFormConfig` — la même information, mais **100 % JSON
   sérialisable** ; `configToDescriptor`/`formDescriptorToConfig` font l'aller-retour **sans perte**.
3. **Les costums** (`src/modules/profil/forms/costum/<id>/`) : un **document fusionné** `CostumFormSchema`
   (form + modale) → `compileCostumSchema` → `{ descriptor, spec }`. Le descripteur nourrit le moteur ; la spec
   (`EntityModalSpec`) nourrit la modale générique `EntityFormModal`. C'est la finalité : décrire un costum
   **en données**, posable dans la config globale (`config.costumForms`).

> **Principe transverse — zéro fonction dans les données.** Descripteur, config et document costum ne contiennent
> que des **données + des CLÉS string**. Le code irréductible (lecture serveur, validation cross-champ, payload,
> options dynamiques, slots UI) vit en TS et est **retrouvé par son nom au runtime** via des registres. Un costum
> « simple » = 0 code ; un costum à logique propre = JSON + un petit `fns.ts`.

---

# Couche 1 — Le moteur (`formEngine`)

## Le contrat `FormDescriptor`

Cœur du système (`formEngine/types.ts`). Consommé par `GenericForm` et par le pipeline read/write.

```ts
interface FormDescriptor {
  id: string;
  icon?: string;                       // icône lucide (ex. "building-2")
  collection: FormCollection;          // "poi" | "organizations" | "projects" | "events" | "citoyens"
  costumSlug?: string;                 // si scopé costum
  layout: LayoutSpec;
  sections: SectionDescriptor[];       // groupes de champs, agnostiques du rendu
  fields: Record<string, FieldDescriptor>;   // clé = name
  validate?: string | ((values) => Array<{ path; message }>);   // cross-champ : clé registre OU fn inline
  serializeGroups?: Record<string, {  // N champs plats ↔ 1 objet serveur
    serverKey: string; read: TransformName; write: TransformName;
    groupReadOnly?: boolean; params?: Record<string, unknown>;
  }>;
}

interface FieldDescriptor {
  // — DONNÉES —
  name: string; path?: string; type: "string"|"number"|"boolean"|"date"|"array"|"object";
  enum?: { value: string; label: I18n }[]; enumFrom?: string;   // options statiques OU clé d'options dynamiques
  multiple?: boolean; default?: unknown;
  // — UI —
  widget: WidgetKind; label: I18n; placeholder?: I18n; placeholderSearch?: I18n; info?: I18n;
  widgetProps?: Record<string, unknown>; optionsKey?: string;
  // — VALIDATION —
  required?: boolean;
  rules?: { url?; min?; max?; minLength?; maxLength?; regex? };
  messages?: Partial<Record<"required"|"url"|"min"|"max"|"minLength"|"maxLength"|"format", string>>;
  // — CONDITIONNEL / CALCUL —
  visibleIf?: Predicate; requiredIf?: Predicate;
  computedFrom?: { deps: string[]; fn: TransformName };
  // — READ / WRITE / CLEAR —
  read?: TransformName; write?: TransformName; clear?: unknown;
  // — GROUPES / ASYMÉTRIES —
  group?: string; atomicGroup?: string; writeOnly?: boolean; readOnly?: boolean; renderOnly?: boolean;
}

interface SectionDescriptor {       // un onglet / une étape / un bandeau
  id: string; label?: I18n; icon?: string; visibleIf?: Predicate;
  fields?: string[];                // format PLAT (1 groupe implicite)
  groups?: FieldGroup[];            // format GROUPES
}
interface FieldGroup {
  columns?: 1|2|3; label?: I18n; required?: boolean; visibleIf?: Predicate; divider?: boolean;
  fields: string[];                 // ordre ; "$slot:<id>" = emplacement d'un slot UI custom
}

type I18n = string | LocalizedString;   // clé i18next OU { fr, en, … } inline
```

> **Champs qui N'EXISTENT PAS** (à ne pas inventer) : `createOnly`, `editOnly`, `hiddenIf`, `disabledIf`,
> `optionsIf`. Pour cacher : `visibleIf` (+ `{ not }`). L'asymétrie create/edit passe par `writeOnly`/`readOnly`.

## Conditionnel — `Predicate`

Un prédicat déclaratif, évalué réactivement (RHF `watch`), réutilisé pour `visibleIf`/`requiredIf` (et le zod
généré). Évaluateur pur et testable : `engine/conditional.ts` (`evaluatePredicate` / `check`).

```ts
type Predicate =
  | { field: string; op: PredicateOp; value?: unknown }
  | { and: Predicate[] } | { or: Predicate[] } | { not: Predicate };

type PredicateOp =
  | "eq" | "ne" | "in" | "nin"            // égalité / appartenance
  | "gt" | "gte" | "lt" | "lte"           // comparaisons numériques
  | "truthy" | "falsy" | "empty" | "notEmpty"
  | "matches"                             // regex sur string
  | "contains";                           // string.includes OU array.includes
```

> **Règle d'or (parité).** Un champ **non visible** (`visibleIf` faux) n'est **ni rendu ni validé** (`zodGen` le
> saute, `GenericForm` ne le rend pas) **mais reste dans le payload** à sa valeur courante — c'est la parité avec
> le legacy (ex. `equip_pmr_*=false` envoyés même bloc PMR replié). À l'édition, un champ caché *inchangé* sort
> du résultat parce qu'il est inchangé, pas parce qu'il est caché. **Ne jamais stripper les champs cachés au
> submit** : cela divergerait du legacy.

## Widgets (registre pluggable)

`registerWidget(kind, render)` / `getWidget(kind)` (`formEngine/widgets/registry.tsx`) — `getWidget` retombe sur
`text` si le kind est inconnu. Inversion de dépendance : le moteur enregistre les widgets **génériques** ; le
domaine **injecte** les siens par side-effect (`profil/forms/registerWidgets.tsx`, importé par `EntityFormModal`).

`WidgetKind` (`types.ts`) :
`hidden`, `text`/`email`/`tel`/`textarea`/`number`, `switch`/`checkbox`/`checkboxGroup`,
`select`/`multiselect`/`selectFromLists`, `tags`, `date`/`datetime`/`time`, `urlList`, `image`, `location`,
`openingHours`, `finder`, `eventDates`, `fieldArray`, `editSocial`, `editSchedule`, `custom`.

| Origine | Widgets | Composant |
|---|---|---|
| **Génériques** (`formEngine/widgets/fields/genericFields.tsx`) | text/number/switch/checkbox/checkboxGroup/select/multiselect/date | `FormFieldText`/`Number`/`Switch`/`Checkbox`/`CheckboxGroup`/`SelectObject`/`Date` |
| **Génériques** (autres fichiers) | textarea, urlList, openingHours, fieldArray | `TextareaFormField`, `FormFieldUrlList`, `OpeningHoursField`, `FieldArrayField` (les 2 derniers lazy) |
| **Domaine profil** (`profil/forms/registerWidgets.tsx`, lazy) | email/tel, tags, image, location, finder, eventDates, editSocial, editSchedule | `IconFormField`, `FormFieldTags`, `ImageUploadField`, `EditLocationTab`, `SelectParent`, `EditEventDatesTab`, `EditSocialTab`, `EditScheduleTab` |

Widgets **composites** (une valeur structurée par-dessous) : `openingHours`/`editSchedule` = `{ [jour]:
{enabled,start,end} }` ; `location` = adresse plate + `geo`/`geoPosition` (autocomplétion BAN/villes) ;
`fieldArray` = `Array<{ <sous-champ>: string }>` (`widgetProps.itemFields`) ; `finder` = `{ id: {type,name} }` ;
`image` = `File | null` (+ flag `_imageDeleted`) routé vers `profil_avatar`.

## Layouts (registre pluggable)

`registerLayout(kind, comp)` / `getLayout(kind)` (`formEngine/layouts/index.tsx`, fallback `flat`). Le descripteur
déclare des **sections** agnostiques ; le layout décide du rendu + de la navigation.

| `kind` | Comportements fournis par le moteur |
|---|---|
| `flat` | sections empilées, validation globale au submit |
| `tabs` | onglets, navigation libre, **badge d'erreur par onglet**, saut au 1ᵉʳ onglet fautif au submit |
| `wizard` | étapes, `Next` **valide l'étape courante** (`form.trigger`), progression, saut au 1ᵉʳ step fautif |
| `accordion` | déclaré dans `LayoutSpec` mais sans composant fourni → à brancher via `registerLayout` |

La détection d'erreur par section traverse les erreurs imbriquées de RHF (`engine/sectionErrors.ts:hasErrorAt`,
gère les chemins pointés `preferences.isOpenData`). Présentation réglable par `LayoutSpec` :
`stepper: "pills"|"tabs"`, `progress: "count"|"bar"|"none"`, `header: "plain"|"gradient"`.

```ts
type LayoutSpec =
  | ({ kind: "flat" }    & Pres) | ({ kind: "tabs" } & Pres)
  | ({ kind: "wizard"; validatePerStep?: boolean } & Pres) | ({ kind: "accordion" } & Pres)
  | { kind: string; [param: string]: unknown };   // custom enregistré
// Pres = { stepper?, progress?, header? }
```

## Validation — zod généré du descripteur

`buildZodSchema(descriptor)` (`engine/zodGen.ts`) construit le schéma, branché via `zodResolver` (RHF) — il
**remplace** les schémas zod écrits à la main. Logique : base *lenient* (tout optionnel par type) ; champ **caché
sauté** ; `required` statique **ou** conditionnel (`requiredIf`) ; `rules` (url/min/max/length/regex) appliquées
si la valeur est non vide ; `validate` cross-champ (clé registre ou fn) en `superRefine`. Le **backend reste le
gate ultime** (`element/save` atomique) ; les erreurs serveur remontent via `useMutationWithToast`.

## Read / Write — le pipeline

Read (serveur→form) et write (form→serveur) sont **déclaratifs** (`field.read`/`write` = clés de transform) et
exécutés par un pipeline unique — fini les mappers bespoke par entité. `GenericForm` ne fait **que** rendu +
validation : l'appelant lui fournit des `defaultValues` déjà *seedés* et reçoit les valeurs brutes dans
`onSubmit` ; c'est lui qui applique le pipeline.

**Primitives pures** (`engine/fieldPipeline.ts`) :
- `seedFromEntity(descriptor, serverData)` — READ : `serverData[path ?? name]` → `field.read` → champ plat ;
  les `serializeGroups` décomposent un objet serveur (`serverData[serverKey]`) en champs plats des membres.
- `valuesToPayload(descriptor, values, { emitEmpty? })` — WRITE : `field.write` → `payload[path ?? name]` ;
  recompose les groupes en objet serveur.
- `clearValue(field)` — valeur d'effacement : `field.clear` sinon `[]` (array) sinon `""`. **Jamais `{}`**.

**Wrappers niveau entité** (`engine/entityForm.ts`, type `FormSpec`) :
- `seedEntity(spec, entity?)` — READ : `baseDefaults` écrasé par `seedFromEntity(…, entity.serverData)`.
- `buildPayload(spec, values)` — WRITE création : `valuesToPayload(…, { emitEmpty:false })` (omit-empty natif).
- `buildEditPayload(spec, values)` — WRITE édition : `valuesToPayload(…, { emitEmpty:true })` (vides typés).

Pattern d'édition : payload **complet** → `Object.assign` sur `entity.data` → `entity.save()`. Le SDK diffe en
interne, le backend `$unset` les vides — **pas de diff côté client** (plus de `buildEditPatch`/`reconcile`).

| Flag champ | READ | WRITE |
|---|---|---|
| `writeOnly` | ❌ jamais relu | ✅ émis (ex. `geo`/`geoPosition` posés AVEC l'adresse, jamais relus → pas d'écrasement lossy) |
| `readOnly` | ✅ seedé | ❌ jamais émis |
| `renderOnly` | ❌ | ❌ (pur ancrage UI, ex. le widget composite `location`) |
| `group` (membre d'un `serializeGroup`) | lu PAR le groupe | écrit PAR le groupe (`groupReadOnly` = lu en groupe, écrit plat) |
| `atomicGroup` | — | si UN membre change, **tout** le groupe est ré-émis (adresse atomique + garde `localityId`) |

> **Sémantique du vide (non négociable).** Le SDK costum reconnaît `null`/`""`/`[]` comme effacement → backend
> `$unset`. Un objet vidé doit valoir `""` (jamais `{}`, que le backend *mergerait* → no-op). En CRÉATION
> (`emitEmpty:false`) une clé `undefined` est **omise** ; en ÉDITION (`emitEmpty:true`) un champ vide devient
> `clearValue(field)` typé ; un champ `writeOnly` absent du form est **omis, pas effacé**.

## Registres « par clé » du moteur

`engine/transforms.ts` — chaque registre est une `Map<string, fn>` peuplée en TS par side-effect, résolue par nom :

| Registre | API | Signature |
|---|---|---|
| transform (read/write) | `registerTransform`/`getTransform`/`applyTransform(name, value, all, params?)` | `(value, all, params?) => unknown` — `params` = 3ᵉ arg (codecs de groupe paramétrés) |
| validate (cross-champ) | `registerValidate`/`getValidate`/`resolveValidate` | `(values) => [{ path, message }]` |
| options (enum dynamique) | `registerOptions`/`getOptions` | `() => EnumOption[]` |
| compute (valeur dérivée) | `registerCompute`/`getCompute` | `(deps[]) => unknown` |

Génériques fournis : `identity`/`toNumber`/`toString`/`toBoolean`/`toStringArray`/`splitCsv`/`joinCsv` (transforms)
et `multiply` (compute). `GenericForm` résout les options d'un champ dans l'ordre
**`enum` (statique) > `enumFrom` (registre) > `listsOptions` (runtime `serverData.lists`)**, et recalcule un
`computedFrom` quand ses `deps` changent.

---

# Couche 2 — La config (`JsonFormConfig`)

Représentation **100 % JSON** d'un formulaire (`formEngine/config/schema.ts`, zod `JsonFormConfigSchema`). C'est
la forme sérialisable du descripteur : mêmes champs, mais `i18n` localisé et clés string partout.

```ts
interface JsonFormConfig {
  id: string; title?: I18n; icon?: string;
  entityType: "organization"|"project"|"event"|"poi"|"citoyen";    // → collection + hook
  collection?: FormCollection; costum?: { slug: string };
  layout: { kind:"flat"|"tabs"|"wizard"|"accordion"; validatePerStep?; stepper?; progress?; header? };
  i18n?: "localized" | "keys";
  sections: Section[];
  fields: Record<string, FieldConfig>;     // = FieldDescriptor en JSON (widget/label/type/path/enum/enumFrom/
                                            //   rules/messages/visibleIf/requiredIf/computedFrom/read/write/
                                            //   group/atomicGroup/writeOnly/readOnly/renderOnly/clear)
  serializeGroups?: Record<string, { serverKey; read; write; groupReadOnly?; params? }>;
  validateFn?: string;                      // clé registre cross-champ
  submit?: Submit; submitLabel?: I18n;
}
```

**`configToDescriptor(config, { tLoc })`** (pur, sans React) : `JsonFormConfig → FormDescriptor`. Il **pré-résout
l'i18n** (`LocalizedString → string` via `tLoc`, ou préserve la clé), applique la table `inputType↔widget`
(compat legacy), et recopie tel quel le pipeline (`read`/`write`/`path`/`group`/`atomicGroup`/flags) et les
prédicats.

**`formDescriptorToConfig(descriptor)`** : l'**inverse** exact. `config → descriptor → config` est byte-identique
par construction (seule limite : un `validate` *inline* n'est pas sérialisable ; une clé string l'est).

Ce round-trip n'est pas théorique — il est **dans le chemin de rendu live** : `EntityFormModal` rend
`configToDescriptor(formDescriptorToConfig(descriptor), …)` (normalisation), et `jsonFormSubmit.ts` expose les
wrappers minces `buildPipelineDefaults`/`buildPipelinePayload` (= `configToDescriptor` → `seedEntity`/
`buildPayload`/`buildEditPayload`) consommés par le résolveur de spec et les `fns.ts` costum.

> `config/costumToConfig.ts` (`descriptorToConfig`/`costumToConfig`) génère une `JsonFormConfig` depuis un overlay
> costum de la lib ou l'artefact `costumExtensions.json`. C'est un **outil build-time / CLI**
> (`scripts/gen-costum-config.ts`), **pas du code runtime de production**.

---

# Couche 3 — Les costums (`CostumFormSchema`)

## Le document costum FUSIONNÉ

Un **seul** objet décrit toute l'entité costum (`forms/costum/<id>/schema.ts`). 100 % données + clés, aucune
closure → posable tel quel en JSON. Type/compilateur : `forms/costum/compileCostumSchema.ts`.

```
{
  id, entityType, collection?, costumSlug?, icon?, deriveDefaults?,   // identité
  layout, serializeGroups?, validateFn?, fieldPresets?,               // form
  fields: { <name>: { widget, ...overrides } },   // TERSE : seul `widget` requis (type/read/default dérivés)
  sections: [ { id, label, groups:[{columns,label?,fields:[…]}] } ],  // placement (wizard/tabs…)
  chrome: { title{add,edit}, description?, submitLabel?, navText?, … },// modale
  scope?, defaultsBase?, slots?, image?, listsFromCarrier?,           // comportement modale
  mutation: { entityType, payloadFn?, inject?, successKey, invalidateFn?, … }
}
```

**Règle « names-once »** : chaque nom de champ n'apparaît que **2×** — sa DÉCLARATION (`fields`) et son PLACEMENT
(`sections`). type/read/default sont DÉRIVÉS du widget.

## `compileCostumSchema` — la dérivation

`compileCostumSchema(schema) → { descriptor, spec }`.

- **`WIDGET_DEFAULTS`** : table `widget → { type, read, default }` (le « commun » : text→string/coerce:string/"",
  switch→bool/false, number→number/coerce:number, image/location→object/renderOnly, openingHours→object + codec…).
  Précédence : champ explicite > `fieldPresets[widget]` > widget.
- **Conventions** : `label` ⇐ nom si absent ; placeholder d'un `select` ⇐ son label.
- **Règle GROUPE** : un champ avec `group` (membre d'un `serializeGroup`) ne reçoit AUCUN read/write/default
  dérivé (lu/écrit PAR le groupe).
- **`deriveDefaults:false`** : aucun `field.default` (le socle vient de `defaultsBase`, ex. tiers-lieu).
- `icon` (top-level) → `descriptor.icon` + défaut de l'icône de modale.

`descriptor.ts`/`spec.ts` de chaque costum ne font plus que `compileCostumSchema(SCHEMA).descriptor` / `.spec`.

## Les codecs — « le traducteur appartient au widget/concept »

Un **codec** est un couple de transforms read/write référencé par clé. Trois familles
(`forms/costum/sharedCodecs.ts`) :

| Famille | Exemples | Mécanisme |
|---|---|---|
| **Lié au WIDGET spécialisé** | `openingHours:read/write` | fourni AUTO par `WIDGET_DEFAULTS` → le champ hérite, 0 code costum |
| **Clé partagée NOMMÉE** | `address:read/write`, `social:read/write` | widget générique → référencée explicitement (champ ou `serializeGroup`) |
| **Codec de groupe PARAMÉTRÉ** | `monthYear`, `enumOrOther`, `multiCsv` | `serializeGroups[x] = { …, params }` ; le pipeline passe `params` en 3ᵉ arg d'`applyTransform` |

Les coercions de TYPE (`coerce:string/bool/number/…`) sont génériques (`engine`). Le `params` d'un codec de groupe
est **donné** dans le schéma → un codec réutilisable (ex. `monthYear` = 2 selects mois+année ↔ `DD/MM/YYYY`,
params `{monthField, yearField, day}`).

### `enumFrom` — options dynamiques par clé

Un champ porte **`enumFrom: "clé"`** au lieu d'un `enum` figé quand la liste est CALCULÉE (qu'un JSON gèlerait) :
ex. `tl:years` = années courante+5 → 1900, recalculées via `new Date()` à chaque rendu. Résolu au rendu par
`registerOptions`/`getOptions`.

### i18n des costums

Les costums utilisent l'inline `{fr,en}` (config self-suffisante). `tLoc` PRÉSERVE l'objet jusqu'au widget
(`EntityFormModal` `PRESERVE_LABELS`), où `useT` le résout ; `I18nBridge` synchronise les deux locales.

## La spec modale + les registres « par clé »

`EntityModalSpec` (`forms/entityModalSpec.ts`) = description SÉRIALISABLE d'une modale add+edit (chrome, scope,
mutation, slots, image, cleanValues, invalidate…). `resolveModalSpec.ts:specToConfig` la compile en closures qui
dispatchent vers les registres (`forms/specRegistries.ts`, peuplés par `forms/registerSpecFns.ts`) :

| Hook | Registre | Rôle |
|---|---|---|
| descriptor | `registerDescriptor` / `getDescriptor(id)` | champs + layout (résolu par `descriptor:{ref}`) |
| scope | `registerScopeFn` | contexte costum lu du **carrier live** (`useCocolight().entity`) |
| defaults | `registerDefaultsFn` | état initial du form en création |
| slots | `registerSlot` | UI React EN PLUS des champs (ancrée par `"$slot:<id>"`) |
| payload | `registerPayloadFn` | form → payload (défaut = pipeline générique) |
| invalidate | `registerInvalidateFn` | clés TanStack Query à rafraîchir |
| cleanValues / existingUrl / schemaFn / afterSubmit | … | hygiène / image / zod externe / effet |

**`FnRef = string | { fn, params }`** : un hook peut référencer une fn générique PARAMÉTRÉE (ex.
`cleanValues:dropEmptyArrayItems` + `{fields}` ; `invalidate:standard` + `{userList, searchKeys}`).

Pour les 2 costums actuels, l'irréductible-TS se réduit à : slots React (`poiDoublons`/`parentInfo`), `tl:payload`
(merge des tags observatoire), et les `scope` (lecture carrier live).

## Poser un costum dans la CONFIG GLOBALE (le loader)

C'est la finalité : déclarer un costum **en données** dans `config.costumForms` (par déploiement).

```
config.costumForms.<id>  (JSON)
  → window.__CONFIG__ (boot)
  → registerCostumForms.ts  → registerCostumForm(schema)  (valide zod → compileCostumSchema → descriptor+spec)
  → table runtime costumFormRegistry  (id → EntityModalSpec)
  → ModalRegistry / EditModalRegistry : "add-<id>"/"edit-<id>" → getCostumModalSpec(id) → EntityFormModal
```

- **`costumFormRegistry.ts`** : table `id → spec`. Les `spec.ts` TS s'auto-enregistrent (`registerCostumModalSpec`) ;
  `registerCostumForm(schema)` (voie config) valide via `costumFormSchema.zod.ts` puis compile.
- **`registerCostumForms.ts`** : importe les costums TS connus + lit `config.costumForms` → `registerCostumForm`.
- **`ModalRegistry`/`EditModalRegistry`** : fallback `costumModalThunk`/`costumEditThunk` pour `add-/edit-<id>`
  non hardcodé → `EntityFormModal spec={getCostumModalSpec(id)}`. Le déclencheur `floatingActionButton.modal` est
  un `z.string()` ouvert → accepte n'importe quel `add-<id>` de costum config.
- **Validation au load** : `registerCostumForm` valide le document (zod pragmatique) AVANT compilation → un costum
  de config malformé échoue avec un message clair (chemin) au lieu de crasher au rendu.
- **`site-schema.ts`** : `costumForms: z.record(z.string(), z.unknown())` (permissif ; la vraie validation se fait
  au load côté `modules/profil`, pour ne pas inverser le layering types↔modules).

**Exemple** (`config.prod.tiers-lieux.json`) : `costumForms.tiers-lieux` porte le document complet ; la modale
add/edit du tiers-lieu est alors pilotée par la config (prouvé byte-identique au TS).

---

## Byte-parité (les gardes)

La refonte ne doit RIEN changer aux sorties (defaults/payloads/specs). Gardes :

- **`<id>/compiled.byteparity.test`** : snapshot du `descriptor` ET de la `spec` (figé avant refactor) — toute
  dérive casse le test.
- **`<entity>.configDriven.test`** : round-trip `descriptor → JsonFormConfig → descriptor` SANS PERTE +
  `seedEntity`/`buildPayload` byte-égaux.
- **`costumFormRegistry.test`** : GARDE ANTI-DRIFT du loader — `registerCostumForm(SCHEMA) ≡ spec du module TS`
  (donc un costum posé en JSON se comporte comme le TS).
- `<id>/defaults.byteparity` / `<id>/spec.test` / `useEntityMutation.test` / `tiersLieuxMapping`.

Gate à chaque commit : `tsc` 0, `vitest src/modules/profil src/modules/formEngine` (311+), `npm run build` 0.

> ⚠️ `npm run build` (tsc `-b` strict) attrape des erreurs que `tsc --noEmit` rate (ex. types de props widget) —
> TOUJOURS le passer avant de conclure.

## Recette : ajouter une entité costum

1. **Si elle réutilise les clés existantes** (codecs communs, scope/payload génériques) → poser un document
   `CostumFormSchema` dans `config.costumForms.<id>` (JSON). **0 code.** Déclencher via
   `floatingActionButton.modal: "add-<id>"` (ou le dropdown).
2. **Si elle a une logique propre** → créer `forms/costum/<id>/{schema.ts, fns.ts}` : `schema.ts` (le document),
   `fns.ts` (enregistre les clés irréductibles : scope/payload/slots/codecs). `descriptor.ts`/`spec.ts` = 1 ligne
   (`compileCostumSchema(SCHEMA).descriptor`/`.spec` + auto-enregistrement). Ajouter à `registerSpecFns.ts`.

## Limites connues / backlog

- **Codecs `pf:*` (profil) vs `tl:*`** : mêmes formats serveur (openingHours/social), widgets DIFFÉRENTS
  (`editSchedule`/`editSocial` vs `openingHours`/`fieldArray`) → codecs distincts, non fusionnés.
- **Enregistrement UNIFIÉ** : un costum TS s'enregistre désormais par la MÊME voie qu'un costum de config —
  `spec.ts` fait `registerCostumForm(SCHEMA)` (compile → garde des clés → descripteur + spec), et `fns.ts` ne
  déclare QUE les clés de code (scope/payload/defaults/slots/options). `descriptor.ts`/`spec.ts` subsistent comme
  **dérivations pures** (`compileCostumSchema(SCHEMA).descriptor/.spec`) car encore importées par des tests et
  quelques utils runtime (`addPoi.payload`, `descriptorToTs`) ; les supprimer (repointer ces importeurs) reste un
  nettoyage possible, à faible valeur.
- **zod `CostumFormSchema` pragmatique** (structure essentielle + `.passthrough()`) — pas exhaustif champ par champ.
- **Entités STANDARD** (org/projet/event/poi/edit-profil) : pilotées par des descripteurs TS + `EntityModalSpec`
  (`forms/configs/`), pas encore par le document fusionné — hors périmètre costum.
- **`accordion`** : `kind` déclaré mais sans composant de layout fourni.
