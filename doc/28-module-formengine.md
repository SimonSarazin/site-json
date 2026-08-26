[← Index](README.md)

# Module formEngine (moteur de formulaire générique + costums config-driven)

Système de formulaires en **3 couches**, du plus générique au plus spécifique :

1. **Le moteur** (`src/modules/formEngine/`, *leaf* — zéro import `@/modules/profil`, SDK ou hooks React) : un
   `FormDescriptor` (champs + widgets + sections + read/write) → `GenericForm` (React-Hook-Form + zod généré +
   conditionnel + computed + layouts lazy). Tout ce qui n'est pas sérialisable est une **clé de registre**.
2. **La couche config** (`formEngine/config/`) : un `JsonFormConfig` — la même information, mais **100 % JSON
   sérialisable** ; `configToDescriptor`/`formDescriptorToConfig` font l'aller-retour **sans perte**.
3. **Les costums** (`config.costumForms.<id>`, JSON — « config fait foi ») : un **document fusionné**
   `CostumFormSchema` (form + modale) → `compileCostumSchema` → `{ descriptor, spec }`. Le descripteur nourrit
   le moteur ; la spec (`EntityModalSpec`) nourrit la modale générique `EntityFormModal`. C'est la finalité :
   décrire un costum **en données** ; le seul fichier TS encore possible est un `fns.ts` sous
   `src/modules/profil/forms/costum/<id>/` (les clés de code irréductibles).

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
  rules?: { url?; min?; max?; minLength?; maxLength?; regex? };  // min/max sur un TABLEAU = nb d'éléments
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

> **Plafonner une multi-sélection** (pendant du `maximumSelectionLength` de select2, legacy) :
> `widgetProps.maxItems` bloque la SAISIE au-delà de N (les N premiers sont conservés) et
> `rules: { max: N }` garde la VALIDATION — sur un tableau, `min`/`max` portent sur le **nombre
> d'éléments** (messages `validation.minItems` / `validation.maxItems`), sur un nombre ils gardent
> leur sens scalaire. Pour le widget `tags`, la saisie se plafonne avec `widgetProps.maxTags`.

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
`hidden`, `text`/`email`/`tel`/`textarea`/`markdown`/`number`, `switch`/`checkbox`/`checkboxGroup`,
`select`/`multiselect`/`selectFromLists`, `tags`, `date`/`datetime`/`time`, `urlList`, `image`, `gallery`,
`file`, `location`, `openingHours`, `finder`, `eventDates`, `fieldArray`, `editSocial`, `editSchedule`, `custom`.

| Origine | Widgets | Composant |
|---|---|---|
| **Génériques** (`formEngine/widgets/fields/genericFields.tsx`) | text/number/switch/checkbox/checkboxGroup/select/multiselect/date | `FormFieldText`/`Number`/`Switch`/`Checkbox`/`CheckboxGroup`/`SelectObject`/`Date` |
| **Génériques** (autres fichiers) | textarea, urlList, openingHours, fieldArray | `TextareaFormField`, `FormFieldUrlList`, `OpeningHoursField`, `FieldArrayField` (les 2 derniers lazy) |
| **Domaine profil** (`profil/forms/registerWidgets.tsx`, lazy) | email/tel, tags, markdown, image, gallery, file, location, finder, eventDates, editSocial, editSchedule | `IconFormField`, `FormFieldTags`, `FormFieldMarkdown`, `ImageUploadField`, `GalleryUploadField`, `DocumentUploadField`, `EditLocationTab`, `SelectParent`, `EditEventDatesTab`, `EditSocialTab`, `EditScheduleTab` |

Widgets **composites** (une valeur structurée par-dessous) : `openingHours`/`editSchedule` = `{ [jour]:
{enabled,start,end} }` ; `location` = adresse plate + `geo`/`geoPosition` (autocomplétion BAN/villes) ;
`fieldArray` = `Array<{ <sous-champ>: string }>` (`widgetProps.itemFields`) ; `finder` = `{ id: {type,name} }` ;
`image` = `File | null` (+ flag `_imageDeleted`) routé vers `profil_avatar` ;
`gallery`/`file` = `GalleryValue { existing, added, removedDocIds, contentKey, docType }` (collecte locale ;
upload/suppression APRÈS le save par `processGalleryFields` → `uploadDocument`/`deleteFile`). `gallery` =
images (grille + preview, `GalleryUploadField`, `docType:"image"`), `file` = documents non-image (lignes
icône+nom+taille, `DocumentUploadField`, `docType:"file"`, `contentKey:"file"`).

> **⚠️ Ces champs DOIVENT être seedés avec la FORME complète, même en création.** Le default générique d'un
> `gallery`/`file` non seedé serait `""` — or le widget fait `value={field.value ?? emptyGalleryValue()}` et `""`
> ne retombe PAS (ni `null` ni `undefined`). À l'ajout d'un fichier, `onChange({ ...field.value, added:[File] })`
> part alors de `{...""}` = `{}` → valeur `{added:[File]}` SANS `contentKey`/`removedDocIds` →
> `isGalleryFieldValue` (useEntityMutation) faux → `processGalleryFields` **saute le champ → aucun upload à la
> création**. Le seed (`seedGalleryDefaults`, cf. Couche 3) doit donc poser `{existing,added,removedDocIds,
> contentKey,docType}` au create comme à l'édition (voir `gallery-create-seed.test.ts`).

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

> **Un GROUPE sans champ affichable n'est PAS rendu.** `renderSection` (`layouts/shared.tsx`) filtre dans
> chaque groupe : les champs `widget:"hidden"`, ceux masqués par LEUR `visibleIf`, et ceux dont le nom n'a
> **aucune déclaration** dans `descriptor.fields` — ces derniers sont retirés de la grille **en silence** (un
> `$slot:<id>` compte toujours comme affichable). Si plus aucun champ ne reste, le groupe entier disparaît,
> titre et séparateur compris — sinon le titre resterait orphelin (ex. « Pièces justificatives » quand la forme
> juridique choisie n'en exige pas). Les champs `hidden` restent volontairement PLACÉS dans une section pour
> que le badge d'erreur d'onglet les voie (`sectionHasError` ne teste que les champs placés). Garde :
> `formEngine/layouts/renderSection.test.tsx`.

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

Un **seul** objet décrit toute l'entité costum, posé dans `config.costumForms.<id>`. 100 % données + clés,
aucune closure → JSON natif. Type/compilateur : `forms/costum/compileCostumSchema.ts` ; grammaire validée par
`forms/costum/costumFormSchema.zod.ts`.

```
{
  id, entityType, collection?, costumSlug?, icon?, deriveDefaults?,   // identité
  subType?, subTypeLabel?, identity?,                                 // sous-type costum (cf. § dédié)
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

### `subType` / `subTypeLabel` / `identity` — le sous-type costum

Trois clés d'identité facultatives (`costumFormSchema.zod.ts`). Comme toute clé de config, elles n'existent
que si elles sont **écrites explicitement** dans le JSON — aucun défaut zod ne les remplit au runtime.

| Clé | Rôle |
|---|---|
| `subType` | sous-type CANONIQUE du form DANS son costum (`financement`, `recoveryCenter`…), jamais l'`id` du form (nom local de config, renommable, inconnu du legacy). C'est la valeur écrite dans `reference.costumTypes.<slug>` au référencement (`admin/hooks/useReferenceElement.ts`), et la clé que consomment `baseParams.costumSubType` et les routes `editModals`. |
| `subTypeLabel` | libellé du sous-type dans le sélecteur de référencement (`admin/sections/AdminReferenceSection.tsx`) — clé i18n ou `LocalizedString` inline. |
| `identity` | comment un NATIF de ce form se reconnaît EN BASE : égalité plate champ→valeur, `contains` implicite sur tableau, chemins pointés (même grammaire qu'`editModalMatch`). Le discriminant n'est PAS câblé sur `type` : `{"category": …}`, `{"mainTag": …}` ou un champ costum conviennent. **Jamais ÉCRITE** — seulement testée. `identity` absente = form par DÉFAUT de sa collection. |

Deux consommateurs d'`identity`, tous deux hors du module profil :

- **`expandCostumSubType`** (`src/modules/search/lib/costumSubType.ts`) : expanse `baseParams.costumSubType`
  en `defaultFilters.$or { <champ identity>: <valeur>, "reference.costumTypes.<slug>": <subType> }` — natifs
  ∪ annotés. ⚠ **Contrainte serveur** : la grammaire `$or` legacy ne porte que des clauses MONO-CHAMP ; une
  `identity` multi-champs n'est donc pas exprimable, seule la première clause part au serveur (avertissement
  console). Côté client (routes `editModals`) la grammaire complète reste disponible.
- **`resolveCreateModal`** (`src/modules/admin/sections/resourceHelpers.ts`) : quand `create: "inherit"` laisse
  plusieurs forms costum candidats pour un même `entityType` (site polymorphe), l'`identity` est confrontée aux
  `source.defaultFilters` de la resource pour les départager ; toujours ambigu → modale STANDARD + `console.warn`.

### `mutation.inject` — injections de CRÉATION

Drapeaux DONNÉES (`SpecInject`, `forms/entityModalSpec.ts`) ; les valeurs runtime (parent / carrier / me) sont
prises du contexte par `resolveModalSpec`. Le bloc entier est **strippé en édition** (`inject: undefined`).

| Clé | Effet |
|---|---|
| `role` | `payload.role = values.role` si présent (org/projet/event) |
| `parent` | `buildParentReference(ctx.parent)` → `payload.parent` |
| `parentFromCarrier` | `buildParentReference(ctx.carrier)` → `payload.parent` — variante pour une création costum-scopée SANS entité parente « vue » (ex. depuis un tableau admin) : le porteur du site sert de parent. **Mutuellement exclusif avec `parent`, qui prime si les deux sont posés.** |
| `organizerFallback` | `organizer` vide → `buildOrganizerReference(ctx.parent, ctx.me)` (event) |
| `dropEmptyEmail` | supprime `payload.email === ""` |
| `extraFields` | valeurs fixes ajoutées au payload au CREATE (stamp statique) |
| `extraFieldsFromScope` | `{ champPayload: cléScope }` → `payload[champ] = ctx.scope[cléScope]` |

> ⚠️ **Panne silencieuse sans parent.** Sans `parent` ni `parentFromCarrier`, le parent repose sur le default
> AJV du schéma de base (`{"@userId":{type:"citoyens"}}`) — qui **ne part jamais réellement sur le réseau**
> (écart `data`/`dataForValidation` de `ApiClient.callEndpoint`) : le backend reçoit un POI sans parent et le
> refuse. Le seul usage actuel de `parentFromCarrier` est le form `actualite`
> (`config.prod.maison-sport-sante-la-tampon.json`), gardé par `forms/actualite.configDriven.test.ts`.

## `compileCostumSchema` — la dérivation

`compileCostumSchema(schema) → { descriptor, spec }`.

- **`WIDGET_DEFAULTS`** : table `widget → { type, read, default }` (le « commun » : text→string/coerce:string/"",
  switch→bool/false, number→number/coerce:number, image/location/file→object/renderOnly, openingHours→object + codec…).
  Note : `gallery`/`file` sont `renderOnly` (uploadés APRÈS le save par `processGalleryFields`, hors payload
  `element/save`) ; `gallery` n'a pas d'entrée `WIDGET_DEFAULTS` et exige `renderOnly:true` en config, `file` l'a.
  Précédence : champ explicite > `fieldPresets[widget]` > widget.
- **Conventions** : `label` ⇐ nom si absent ; placeholder d'un `select` ⇐ son label.
- **Règle GROUPE** : un champ avec `group` (membre d'un `serializeGroup`) ne reçoit AUCUN read/write/default
  dérivé (lu/écrit PAR le groupe).
- **`deriveDefaults:false`** : aucun `field.default` (le socle vient de `defaultsBase`, ex. tiers-lieu).
- `icon` (top-level) → `descriptor.icon` + défaut de l'icône de modale.

Il n'existe **plus** de `schema.ts`/`descriptor.ts`/`spec.ts` par costum : ils ont été supprimés parce qu'ils
DUPLIQUAIENT la config. Le document vit dans `config.costumForms.<id>` ; il n'est compilé qu'au boot par
`registerCostumForms.ts`, et en test par la fixture `forms/costum/__fixtures__/configCostum.ts`
(`costumDoc(id)`/`loadCostumForm(id)`), qui relit le document depuis le vrai `config.prod.*.json` et le passe
par la voie unique `registerCostumForm`. Seul un `fns.ts` optionnel subsiste par costum (clés de code).

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
| gallery seed | `resolveModalSpec.ts:seedGalleryDefaults` (pas un registre) | pose la forme `{existing,added,removedDocIds,contentKey,docType}` des champs `gallery`/`file` |
| slots | `registerSlot` | UI React EN PLUS des champs (ancrée par `"$slot:<id>"`) |
| payload | `registerPayloadFn` | form → payload (défaut = pipeline générique) |
| invalidate | `registerInvalidateFn` | clés TanStack Query à rafraîchir |
| cleanValues / existingUrl / schemaFn / afterSubmit | … | hygiène / image / zod externe / effet |

**`FnRef = string | { fn, params }`** : un hook peut référencer une fn générique PARAMÉTRÉE (ex.
`cleanValues:dropEmptyArrayItems` + `{fields}` ; `invalidate:standard` + `{userList, searchKeys}`).

**Inventaire de l'irréductible-TS** — trois modules `fns.ts`, tous listés par `forms/registerSpecFns.ts` :

| `fns.ts` | Clés registrées |
|---|---|
| `equipements-sportifs` | `poi:scope`, `poi:emptyDefaults`, slots React `slot:parentInfo` / `slot:poiDoublons` |
| `tiers-lieux` | transforms `tl:video0` / `tl:videoWrite`, options dynamiques `tl:years`, defaults `tl:emptyDefaults`, scope `tl:scope` |
| `structure` | transform `structure:tagsFromThematic` (table slug→libellé : un transform de CHAMP ne reçoit pas de `params` — seuls les `serializeGroups` en ont — donc la table ne peut pas vivre dans le JSON) |

`tl:payload` **n'existe plus** : aucun `registerPayloadFn(...)` n'est appelé dans le dépôt. Le merge des tags
observatoire est passé aux `mutation.stamps` (`append` + `$costum`, cf. § dédié) ; `buildTiersLieuxPayload`
subsiste comme export mais n'est plus registré — il ne sert que d'ORACLE de parité aux tests.

Le parc porte aujourd'hui **23 déclarations `costumForms` (21 ids uniques) réparties sur 9 `config.prod.*.json`** —
`tiers-lieux` et `equipements-sportifs` sont déclarés par deux sites chacun. Toutes sont compilées au boot par
`registerCostumForms.ts` et posées à blanc par `tests/preflight/costum-forms.test.ts`, qui énumère tous les
`config.prod*.json`.

**Trois seulement ont un dossier TS** (`forms/costum/<id>/`), réduit à un `fns.ts` (plus ses tests) :
`equipements-sportifs`, `tiers-lieux`, `structure` — tous importés par `forms/registerSpecFns.ts`. Les 18 autres
sont **0 code**.

> ⚠️ Ne pas confondre avec la table `CONFIG_FILE` de `forms/costum/__fixtures__/configCostum.ts`, qui ne résout
> que 5 ids (`equipements-sportifs`, `tiers-lieux`, `institut-bleu-acteur`, `structure`, `actualite`). C'est la
> liste que les TESTS savent charger par id, pas l'inventaire du parc.

> **`buildDefaults` seede les champs galerie DANS LES DEUX MODES.** `specToConfig.buildDefaults` appelle
> `seedGalleryDefaults(defaults, jsonConfig, entity)` : les champs `widget:"gallery"` (et `file`) sont `renderOnly`
> → ignorés par le pipeline read/write, donc jamais seedés par `seedFromEntity`. En **édition**, `existing` vient
> de `entity.getGalleryImages(contentKey)` (champ `images` fusionné par about) ; en **création**, `entity=null` →
> `existing:[]`. Dans les DEUX cas on pose la forme complète `{existing,added,removedDocIds,contentKey,docType}`
> (jamais le default `""`) — sinon l'upload est sauté au create (cf. l'encart Couche 1 sur le widget `gallery`).
> Le fix (`resolveModalSpec.ts`) a (a) sorti le calcul de `jsonConfig` hors du bloc `mode==="edit"`, (b) rendu
> `seedGalleryDefaults` tolérant à `entity=null` (`ent = (entity ?? {})` ; boucle indépendante de
> `getGalleryImages`), (c) ajouté l'appel au create. Garde : `gallery-create-seed.test.ts` (parent62-article).

## `mutation.stamps` — valeurs calculées déclaratives (2 canaux, add/edit)

Le remplaçant configurable des effets codés en dur (`inject.extraFields` statique add-only,
`extraFieldsFromScope`, merge tags de l'ex-`tl:payload`, patron afterSave legacy). Moteur pur :
`src/modules/profil/forms/stamps.ts` ; types `SpecStamp`/`StampValue` (`entityModalSpec.ts`).

```jsonc
"mutation": {
  "stamps": [
    { "field": "dateSign", "value": { "$now": "j/M/aaaa" }, "op": "fillIfEmpty", "channel": "pathValue" },
    { "field": "tags", "value": { "$costum": "mainTag" }, "op": "append", "on": "both" },
    { "field": "shortDescription", "value": { "$from": "description" }, "op": "fillIfEmpty" },
    { "field": "type", "value": { "$scope": "poiType" } }
  ]
}
```

**4 axes orthogonaux** (défauts : `op:"set"`, `on:"add"`, `channel:"payload"`) :

| Axe | Valeurs | Sémantique |
|---|---|---|
| `value` | littéral · `{$now:"<format>"}` · `{$from:"<champ>"}` · `{$scope:"<clé>"}` · `{$costum:"<clé>"}` · `{$mapLabels:{from,map,sep?}}` · `{$bucket:{from,buckets}}` | `$now` : jetons `j jj M MM aaaa` SANS padding par défaut (byte-parité stamp legacy → « 6/8/2026 ») ; `$from` lit le PAYLOAD après pipeline (liste ordonnée, un stamp voit les précédents) ; `$scope`/`$costum` résolus **EAGER** dans `buildSpec` — clé absente ⇒ stamp inerte ; `$mapLabels` : slugs du champ `from` (chaîne découpée par `sep`+trim, ou tableau) → LIBELLÉS via `map` (slugs absents ignorés ; vide ⇒ inerte) ; `$bucket` : nombre `from` → `label` du 1er bucket dont `lt` non dépassé (sans `lt` = défaut) |
| `op` | `set` · `fillIfEmpty` · `append` | `set` écrase (sémantique d'`extraFields`) ; `fillIfEmpty` : seulement si vide (undefined/null/`""`/`[]`) ; `append` : union dédupliquée sur tableau — en EDIT fusionne AUSSI `target.serverData[field]` (le merge tags tiers-lieux) |
| `on` | `add` · `edit` · `both` | champ PROPRE de `SpecMutation` — jamais sous `inject`, strippé en édition |
| `channel` | `payload` · `pathValue` | `payload` : fusion dans le payload, point commun add+edit (après `buildPayload`) ; `pathValue` : écriture POST-SAVE via **`entity.updateField`** (voie haut-niveau BaseEntity — jamais `endpointApi` brut), aux points jumeaux de `processGalleryFields` |

**Quel canal ?** `payload` exige un champ du **schéma d'écriture** lib (contrat de base ou schéma
costum) — sinon `_extractWritableFields` le droppe EN SILENCE. `pathValue` est fait pour les
champs hors schéma (ex. `dateSign`, jamais un input dynform → jamais dans le digest live) ;
réservé à l'entité PROPRE (une écriture d'autorité costum-admin sur entité étrangère passe par
setsource/validategroup, cf. [30-module-admin](30-module-admin.md)) ; échec NON bloquant (warn —
fragilité du patron legacy assumée) ; `fillIfEmpty` tranché contre le serverData retourné par le
save (un hook serveur a posé la valeur → on s'abstient) ; `append` non supporté (v1).

**Cas d'école** : `dateSign` institut-bleu — site-json tourne contre le backend LEGACY, où ni le
JS afterSave legacy (jamais chargé par site-json) ni le hook Node ne tournent → le stamp client
comble le trou, byte-fidèle (73/73 en base sans padding). Et le merge tags tiers-lieux :
`tl:payload` supprimé, remplacé par 2 stamps `append $costum` (⚠ mainTag `on:"both"`, compagnon
add SEUL — sémantique de l'ex-fn) ; `buildTiersLieuxPayload` reste l'ORACLE des tests de parité.

**Propagation tags tiers-lieux** (le patron `$mapLabels`/`$bucket`) : les facettes du search
filtrent `tags` sur des **libellés**, mais le form stocke `typePlace`/`manageModel`/`surfaceBuilt`
en **slugs** structurés. Le legacy recopie côté CLIENT (hook `formData`), PAS par hook serveur → 3
stamps `append tags` `on:"both"` le portent : typologie `$mapLabels(typePlace, sep:",")`, portage
`$mapLabels(manageModel)`, m² `$bucket(buildingSurfaceArea, <60/≤200/>200)` (⚠ `from` = le serverKey
lu dans le PAYLOAD, pas le champ form — `surfaceBuilt` sérialise vers `buildingSurfaceArea` ; port client du bucket serveur
`ReseauTierslieux::elementAfterSave`, gelé par le garde ACTIVATION). Maps = options des
`filterGroups` (source de vérité des libellés de facette). `append` union-dédup diverge (voulu) de la
non-idempotence legacy (doublons).

**Gardes** : préflight `tests/preflight/stamps.test.ts` — `on:edit|both` + `op:set` sur un champ
présent dans `fields` du form = INTERDIT (`fillIfEmpty`/`append` permis), jetons `$now` inconnus
refusés, `append`+`pathValue` refusé, grammaire stricte (zod `costumFormSchema.zod.ts`),
sentinelle d'inventaire du parc. Projection `stamps` dans la garde d'impact
(`tests/preflight/effective-config.test.ts`).

## Poser un costum dans la CONFIG GLOBALE (le loader)

C'est la finalité : déclarer un costum **en données** dans `config.costumForms` (par déploiement).

```
config.costumForms.<id>  (JSON)
  → window.__CONFIG__ (boot)
  → registerCostumForms.ts  → registerCostumForm(schema)  (valide zod → compileCostumSchema → descriptor+spec)
  → table runtime costumFormRegistry  (id → EntityModalSpec)
  → ModalRegistry / EditModalRegistry : "add-<id>"/"edit-<id>" → getCostumModalSpec(id) → EntityFormModal
```

- **`costumFormRegistry.ts`** : table `id → spec`, peuplée **exclusivement** par `registerCostumForm(document)`
  (valide via `costumFormSchema.zod.ts` → `compileCostumSchema` → `assertCostumKeysRegistered` → enregistre
  descripteur + spec). Il n'exporte que `registerCostumForm`, `getCostumModalSpec` et `listCostumFormIds` — il
  n'y a ni `spec.ts` auto-enregistré ni fonction `registerCostumModalSpec`.
- **`registerCostumForms.ts`** : importe `../registerSpecFns` (les CLÉS de code, EN PREMIER), puis lit
  `window.__CONFIG__.costumForms` et appelle `registerCostumForm` sur chaque document. **C'est la SEULE voie de
  chargement runtime — aucun costum TS n'est chargé** (« CONFIG FAIT FOI »). Un document qui échoue est signalé
  par un `console.warn` sans faire tomber les autres.
- **`ModalRegistry`/`EditModalRegistry`** : fallback `costumModalThunk`/`costumEditThunk` pour `add-/edit-<id>`
  non hardcodé → `EntityFormModal spec={getCostumModalSpec(id)}`. Le déclencheur `floatingActionButton.modal` est
  un `z.string()` ouvert → accepte n'importe quel `add-<id>` de costum config.
- **Validation au load** : `registerCostumForm` valide le document (zod pragmatique) AVANT compilation → un costum
  de config malformé échoue avec un message clair (chemin) au lieu de crasher au rendu.
- **`site-schema.ts`** : `costumForms: z.record(z.string(), z.unknown())` (permissif ; la vraie validation se fait
  au load côté `modules/profil`, pour ne pas inverser le layering types↔modules).

**Exemple** (`config.prod.tiers-lieux.json`) : `costumForms.tiers-lieux` porte le document complet ; la modale
add/edit du tiers-lieu est alors pilotée par la config (la bascule a été prouvée byte-identique à l'ex-source
TS, désormais supprimée ; la non-régression est aujourd'hui tenue par
`forms/costum/tiers-lieux/compiled.byteparity.test.ts` — snapshot du descripteur + de la spec compilés depuis
`config.prod.tiers-lieux.json` — et par `forms/tiers-lieux.configDriven.test.ts`).

---

## Pièges / gotchas

### Scroll-lock des modales coincé sur `<body>` (scroll de page perdu)

**Symptôme.** Ouvrir une modale add/edit (form costum) à contenu lourd (surtout l'éditeur markdown
`@uiw/react-md-editor`) **puis la fermer** laissait `<body style="overflow:hidden">` verrouillé → la page ne
scrolle plus jusqu'au reload. **TROIS causes indépendantes**, toutes trouvées + corrigées (chacune nécessaire) :

| # | Cause | Mécanisme | Fix | Fichier |
|---|---|---|---|---|
| a | **Animation de SORTIE du `Dialog` partagé** | Radix `Presence` attend l'event `animationend` de l'anim de sortie avant de démonter. L'éditeur markdown re-render pendant la fermeture → l'event n'est jamais émis → le `Dialog` reste monté `data-state=closed` → son `react-remove-scroll` garde `<body>` verrouillé. | Retirer les classes d'anim de sortie (`data-[state=closed]:animate-out/fade-out-0/zoom-out-95`) de `DialogOverlay` + `DialogContent` → démontage immédiat. Anim d'ENTRÉE conservée. | `src/components/ui/dialog.tsx` (e7db310) |
| b | **`modal` sur le `Popover` de `SelectObject`** | `<Popover modal>` pose un 2ᵉ scroll-lock `react-remove-scroll` sur le **même compteur partagé**. Imbriqué dans le `Dialog`, à la fermeture (après ouverture d'un select) le compteur se désynchronise → `overflow:hidden` reste. | Retirer `modal` du `Popover` (le `Dialog` gère la modalité ; un dropdown ne doit pas bloquer le scroll — comportement shadcn standard). Bénéficie à tous les `select`/`multiselect`. | `src/components/ui/select-objet.tsx` (edbc1f6) |
| c | **`MDEditor` écrit `body.style.overflow` inline** | Le `Toolbar` de `@uiw/react-md-editor` gère le scroll du body pour son plein écran via un `useEffect` **SANS cleanup** (`document.body.style.overflow = 'hidden'`). Dans une modale, à la fermeture l'éditeur est démonté et laisse l'inline `overflow:hidden`. Seule lib du repo à toucher `body.style.overflow` en assignation directe. | Passer `overflow={false}` au `MDEditor` (inutile dans une modale). | `src/modules/coform/components/MarkdownEditor.tsx` (643c6b0 — cf. doc coform) |

**Diagnostic (navigateur).** `document.body.getAttribute('data-scroll-locked')` → `null` = libre, `"1"` = coincé ;
`document.querySelectorAll('[data-radix-focus-guard]').length` → `0` attendu après fermeture (guards résiduels =
`Dialog` toujours monté). Vérifier aussi `body.style.overflow` inline (cause **c**). Après les 3 fixes : baseline /
open / close → `locked=null`, guards `0`, la page scrolle.

## Byte-parité (les gardes)

La refonte ne doit RIEN changer aux sorties (defaults/payloads/specs). Gardes :

- **`<id>/compiled.byteparity.test`** : snapshot du `descriptor` ET de la `spec` (figé avant refactor) — toute
  dérive casse le test.
- **`<entity>.configDriven.test`** : round-trip `descriptor → JsonFormConfig → descriptor` SANS PERTE +
  `seedEntity`/`buildPayload` byte-égaux.
- **`costumFormRegistry.test`** : GARDE du loader — résolution par id depuis le document JSON de config
  (`loadCostumForm`), recompilation byte-identique, et REFUS explicite (message clair, chemin) d'un document
  malformé (zod) ou citant une clé de registre non enregistrée.
- `equipements-sportifs/defaults.byteparity` / `<id>/spec.test` / `useEntityMutation.test`.

**Gardes préflight à l'échelle du PARC** (lancées par `npm run test:preflight` — **aucun hook ni CI ne les
exécute**) :

| Test | Ce qu'il garde |
|---|---|
| `tests/preflight/costum-forms.test.ts` | chaque document de `costumForms` de chaque `config.prod*.json` est POSABLE : zod puis `registerCostumForm` à blanc (compile + garde des clés) — exactement le chemin du boot client, donc un doc qui casse ici casserait la modale au runtime |
| `tests/preflight/costum-form-contract.test.ts` | aucun `costumForm` n'envoie une valeur que le CONTRAT costum refuse — en mode BUNDLE **et** en mode LIVE (fixtures commitées `__contract__/costum-types.json` et `costum-types.live.json`) |
| `tests/preflight/costum-form-slug.test.ts` | tout `costumForm` du parc déclare `costumSlug` : son retrait casse EN SILENCE le pin de schéma en édition (`schemaCostumSlug`), la découverte de l'e2e `costum-forms` et la cohérence avec `scope` |

### Outils

| Commande | Rôle |
|---|---|
| `npm run config:costum-drift` | garde de DÉRIVE : compare les champs ÉMIS par `compileCostumSchema(doc)` aux champs AUTORISÉS par la lib dans le scope costum — attrape le champ resté déclaré au formulaire après avoir disparu de la config costum en base (cas `recepisseDeclaration`, SSBE) |
| `npm run contract:snapshot` | régénère `tests/preflight/__contract__/costum-types.json` depuis l'artefact `costum-extensions.json` de la lib. **À lancer après tout upgrade de `@communecter/cocolight-api-client`** : sans ça la garde de contrat est aveugle au changement |
| `npm run contract:snapshot:live` | idem pour le contrat LIVE (`costum-types.live.json`, schéma AJV réel sous `setCostumForceLive`) — indispensable aux sites en `VITE_COSTUM_FORCE_LIVE`, absents de l'artefact |
| `npm run test:costum-forms` | joue l'e2e `tests/integration/costum-forms.e2e.test.ts` dans les DEUX modes enchaînés (bundle, puis `E2E_MODE=live`) |

Gate à chaque commit : `tsc` 0, `vitest src/modules/profil src/modules/formEngine` (311+), `npm run build` 0.

> ⚠️ `npm run build` (tsc `-b` strict) attrape des erreurs que `tsc --noEmit` rate (ex. types de props widget) —
> TOUJOURS le passer avant de conclure.

## Recette : ajouter une entité costum

1. **Si elle réutilise les clés existantes** (codecs communs, scope/payload génériques) → poser un document
   `CostumFormSchema` dans `config.costumForms.<id>` (JSON). **0 code.** Déclencher via
   `floatingActionButton.modal: "add-<id>"` (ou le dropdown).
2. **Si elle a une logique propre** → le document reste TOUJOURS en config (`config.costumForms.<id>`) ; le
   seul fichier TS à créer est `forms/costum/<id>/fns.ts`, qui enregistre les clés irréductibles
   (scope/slots/codecs/options/defaults), puis à référencer dans `forms/registerSpecFns.ts`. Modèle :
   `forms/costum/structure/fns.ts` — un seul fichier, une seule clé (`structure:tagsFromThematic`).

## Limites connues / backlog

- **Codecs `pf:*` (profil) vs `tl:*`** : mêmes formats serveur (openingHours/social), widgets DIFFÉRENTS
  (`editSchedule`/`editSocial` vs `openingHours`/`fieldArray`) → codecs distincts, non fusionnés.
- **Enregistrement UNIFIÉ** : il n'y a plus qu'UNE voie, `registerCostumForm(document)` — appelée au boot par
  `registerCostumForms.ts` (config) et, en test, par la fixture `__fixtures__/configCostum.ts` (qui relit le
  document depuis `config.prod.*.json`). Les ex-`<costum>/{schema,descriptor,spec}.ts` ont été SUPPRIMÉS : ils
  dupliquaient la config. `fns.ts` ne déclare QUE les clés de code (scope/defaults/slots/options/transforms).
- **zod `CostumFormSchema` pragmatique** (structure essentielle + `.passthrough()`) — pas exhaustif champ par champ.
- **Entités STANDARD** (org/projet/event/poi/edit-profil) : pilotées par des descripteurs TS + `EntityModalSpec`
  (`forms/configs/`), pas encore par le document fusionné — hors périmètre costum.
- **`accordion`** : `kind` déclaré mais sans composant de layout fourni.
