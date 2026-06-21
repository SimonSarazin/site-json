# Moteur de formulaire générique (descriptor-driven)

> Statut : **LIVRÉ** (2026-06). `GenericForm` (RHF + zodResolver via `zodGen`), layouts `flat`/`tabs`/
> `wizard` (Radix) + `accordion`, registre de widgets (lazy), `engine/` (conditional/transforms/
> sectionErrors). Migrés : POI équipement, tiers-lieu, **add** (org/projet/poi/événement via
> `AddEntityDropdown`→ModalRegistry) et **edit** (5 entités via `EditProfileGenericModal`). Anciens
> `TiersLieuxForm`/`Add*Modal`/`EditProfileModal` gardés en fallback (à retirer après validation live).
> Couche **config-driven** (JSON, bidirectionnelle) : cf. [`formulaire-config-driven.md`](./formulaire-config-driven.md).
> Les sections ci-dessous = conception/référence ; certaines formulations « il manque X » sont historiques.

## 1. Principes (décidés)

1. **Séparation données / UI par qualité.**
   - **Lib** (`@communecter/cocolight-api-client`) = couche **DONNÉES**, fiable : quels champs existent, `type`, `path` de stockage, **valeurs d'enum**, multiplicité, `required` (validation), defaults/presets, **normalisation lecture**, **save**. Source : le **contrat** (`endpoints-copie.json`) pour les champs de **base** + le **scan des vraies valeurs** pour le **costum**.
   - **site-json** = couche **UI**, écrite **proprement** : `widget`, `label`/i18n, **libellés** d'enum, **layout/sections/steps**, **conditionnel**, transformers de présentation.
   - **Le legacy `dynForm` est une RÉFÉRENCE** (quels champs/widgets existent typiquement), **jamais une source auto** : sa couche UI (`inputType`/`label`/`eval`-strings) n'est pas de qualité.
2. **site-json d'abord.** L'itération 1 n'exige aucune nouvelle API lib : on écrit le descripteur UI à la main pour 1 costum et on s'appuie sur la lib existante pour les données (schéma `CostumScope`, enums `costum-extensions`, save/read). L'API lib `formDescriptor()` (merge base+costum, **données uniquement**) est une **étape 2**.
3. **Hybride TS + overlay JSON.** La logique (champs, widgets, conditionnel, transformers) vit dans un **module TS typé** (pas d'`eval`-string façon legacy). Un **overlay JSON** léger par déploiement permet de surcharger le présentationnel (libellés i18n, ordre, masquage de champ).
4. **Premier form de preuve : POI équipement** (le plus exigeant : ~50 champs, wizard 4 steps, conditionnel riche PMR/inst_part, select-from-lists, patch partiel à l'édition). S'il passe, le moteur couvre tout.

## 2. Le contrat `FormDescriptor`

Cœur du système. Produit (base, données) par la lib ; **surchargé (UI)** par site-json ; consommé par le moteur.

```ts
interface FormDescriptor {
  collection: "poi" | "organizations" | "projects" | "events" | "citoyens";
  costumSlug?: string;                 // si scopé costum (sinon entité de base)
  sections: SectionDescriptor[];       // groupes de champs, agnostiques du rendu
  layout: LayoutSpec;                  // comment rendre (voir §5)
  fields: Record<string, FieldDescriptor>;  // clé = name
}

interface SectionDescriptor {
  id: string;
  label?: I18n;                        // titre de section/onglet/step
  fields: string[];                    // ordre des champs dans la section
  visibleIf?: Predicate;              // section conditionnelle
  // Mise en page (fidèle au base form) : grilles + sous-blocs à titre conditionnels.
  // `fields` plat = 1 groupe 1 colonne (rétro-compatible) ; sinon `groups` :
  //   groups?: { columns?: 1|2|3; label?: I18n; visibleIf?: Predicate; fields: string[] }[]
}

interface FieldDescriptor {
  // — DONNÉES (lib) —
  name: string;
  path: string;                        // chemin de stockage (ex. "preferences.isOpenData")
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  enum?: EnumOption[];                 // valeurs (lib) + libellés (site)
  multiple?: boolean;
  default?: unknown;                   // preset
  // — UI (site-json) —
  widget: WidgetKind;                  // voir §4
  label: I18n;
  placeholder?: I18n;
  info?: I18n;                         // bulle d'aide
  // — Validation —
  required?: boolean;
  rules?: { url?: boolean; min?: number; max?: number; minLength?: number; maxLength?: number; regex?: string };
  // — Conditionnel (voir §3) — câblés : visibleIf, requiredIf, computedFrom.
  // (disabledIf / optionsIf : envisagés mais NON câblés → retirés du type tant
  //  qu'aucun widget ne les honore, pour ne pas mentir au descripteur.)
  visibleIf?: Predicate;
  requiredIf?: Predicate;
  computedFrom?: { deps: string[]; fn: TransformName };
  // — Read/Write (voir §6) —
  read?: TransformName;                // serverData[path] -> valeur de form
  write?: TransformName;               // valeur de form -> payload[path]
  // — divers UI —
  widgetProps?: Record<string, unknown>;  // props spécifiques au widget (ex. crop ratio, searchTypes finder)
}

type EnumOption = { value: string; label: I18n };
type I18n = string;                    // clé i18n OU LocalizedString (cf. JsonFormModal)
```

**Règle d'or** (validation) : un champ **non visible** (`visibleIf` faux) n'est **ni rendu ni validé** (zodGen le saute). **Attention** : il **reste dans le payload** à sa valeur par défaut — c'est la **parité** avec l'ancien form / le legacy (ex. `equip_pmr_*=false` envoyés même PMR replié à l'ADD). À l'**édition**, `buildEditPatch` ne renvoie que les champs **modifiés** (diff vs `defaultValues`) : un champ caché inchangé sort donc du patch — non pas parce qu'il est caché, mais parce qu'il est inchangé. (Ne pas stripper les champs cachés au submit : cela divergerait du legacy.)

## 3. Conditionnel (complet)

Un `Predicate` déclaratif, évalué réactivement (RHF `watch`), réutilisé pour visible/required (et `computedFrom` pour les valeurs dérivées).

```ts
type Predicate =
  | { field: string; op: Op; value?: unknown }
  | { and: Predicate[] }
  | { or: Predicate[] }
  | { not: Predicate };

type Op =
  | "eq" | "ne" | "in" | "nin"
  | "gt" | "gte" | "lt" | "lte"
  | "truthy" | "falsy" | "empty" | "notEmpty"
  | "matches";   // regex sur string
```

Cas réels couverts (recensés) :
- `managementType == "autre"` → affiche `managementTypeOther` (`visibleIf`/`requiredIf`).
- `recurrency` → dates vs openingHours (deux champs avec `visibleIf` opposés).
- `inst_part_bool` truthy → `inst_part_type`.
- `equip_pmr_acc` truthy → bloc 5 champs PMR.
- `addressCountry == "FR"` → rue BAN vs input libre.
- `equip_surf` `computedFrom { deps:[equip_long,equip_larg], fn:"multiply" }`.

## 4. Widgets (registry pluggable)

`WidgetRegistry : WidgetKind -> Composant`. **Le catalogue existe déjà à ~90 %** dans site-json — il suffit de l'enregistrer.

| `widget` | Composant existant | Format valeur |
|---|---|---|
| `text` / `email` / `tel` | `IconFormField` / `FormFieldText` | string |
| `textarea` | `TextareaFormField` | string |
| `number` | `FormFieldNumber` | number |
| `switch` | `FormFieldSwitch` | boolean |
| `checkboxGroup` | `FormFieldCheckboxGroup` | string[] |
| `select` | `FormFieldSelect` / `FormFieldSelectObject` | string |
| `multiselect` | `FormFieldSelectObject` (multiple) | string[] |
| `selectFromLists` | `FormFieldSelectObject` (options depuis `serverData.lists`) | string / string[] |
| `tags` | `TagsInput` / `FormFieldTags` | string[] |
| `date` | `FormFieldDate` / `DatePickerInput` | "YYYY-MM-DD" |
| `datetime` | `DateTimePicker` | ISO |
| `time` | `TimePicker` | "HH:mm" |
| `urlList` | `FormFieldUrlList` | string[] |
| `image` | `ImageUploadField` (crop) | File\|null → `profil_avatar` |
| `location` | `EditLocationTab` (composite, 14 champs + geo/geoPosition) | objet `address` + geo |
| `openingHours` | `OpeningHoursField` ✅ (composite : `${name}.${jour}.{enabled,start,end}`, `widgetProps.days`/`dayLabelPrefix`) | `{ [jour]: {enabled,start,end} }` |
| `finder` | `SelectParent` / `SelectObject` (async, entités) | `{ [id]: {type,name} }` |
| `fieldArray` | `FieldArrayField` ✅ (composite : `widgetProps.itemFields` = sous-champs `text`/`select`, ex. socialLinks) | objet[] |

**Implémenté pour la migration tiers-lieu** : `openingHours`, `fieldArray`, et la **propagation `value`≠`label`** (le widget reçoit des `{value,label}` traduits, plus `enum.map(e=>e.value)`). `select`/`multiselect`/`checkboxGroup` rendent le label, stockent la value. `image` accepte `widgetProps.shape`. Prédicat `contains` ajouté (tableau multi-select OU string → conditionner ex. `familyOther` si `family` contient `autre`). `openingMonth/Year` se modélise en **2 `select`** + transform d'écriture (pas de widget dédié).

## 5. Layouts (pluggables, extensibles)

Le descripteur déclare des **sections** (agnostiques) ; un `LayoutRegistry : kind -> Composant` décide du rendu + navigation. **Ajouter un layout = enregistrer un composant.**

```ts
type LayoutSpec =
  | { kind: "flat" }
  | { kind: "tabs" }
  | { kind: "wizard"; validatePerStep?: boolean }
  | { kind: "accordion" }
  | { kind: string; [param: string]: unknown };  // custom
```

| `kind` | Usage | Comportements fournis par le moteur, consommés par le layout |
|---|---|---|
| `flat` | simple | 1 page, sections en bandeaux |
| `tabs` | EditProfile, Add modals | onglets + **badge d'erreur par onglet** |
| `wizard` | TiersLieux, PoiEquip | étapes + progression + **validation par step** + **saut au 1er step fautif** + nav Préc/Suiv |
| `accordion` | futur | sections repliables |
| `custom` | extensible | n'importe quel composant enregistré |

Le **moteur** expose l'état (valeurs, erreurs par champ/section, step courant) ; **validation-par-section/step** et **saut-au-fautif** sont des **services du moteur** (pas réimplémentés par form). Les layouts ne font que rendre + naviguer.

## 6. Read / Write (transformers nommés, déclaratifs)

On remplace les 3 implémentations read (`useProfileFormData`, `mapEntityToTiersLieuxValues`, `buildEditDefaults`) et 3 write (`mutationUtils`, `tiersLieuxMapping`, `buildEditPatch`) par un **registre de transformers nommés** (TS, pas d'`eval`).

- **READ** (`serverData → valeurs de form`), piloté par `field.read` + le `path` :
  - coercions typées (extraire `to{String,Number,Boolean,StringArray,DateInput}` de `poiEquipement.ts` au niveau moteur — cf. memory `costum-field-typing-model` : les valeurs costum sont stockées en string, `inputType` ment).
  - transfos : `splitCsv` (typePlace→family), `dowToWeek` (openingHours→objet jour), `parseMonthYear` ("01/MM/YYYY"→{month,year}), `flattenAddress`, `entityRefsToOptions`.
  - la **normalisation lecture** de la lib (`COSTUM_NUMBER_FIELDS`/`DATE_FIELDS`) s'applique en amont.
- **WRITE** (`valeurs → payload`), piloté par `field.write` :
  - inverses : `joinCsv`, `weekToDow`, `formatMonthYear`, `address-atomic` (+ **localityId obligatoire**, cf. `costum-update-via-save`), `tags-merge` (Set), `ref-name-type` (réfs ⇒ {name,type}).
  - **mode patch partiel** optionnel (ne renvoyer que les champs modifiés, address en bloc atomique — cf. `buildEditPatch`).
  - branchement SDK : `me.costum(slug).poi|organization(payload)` puis `.save()` ; image → `profil_avatar`.

## 7. Validation

- **Zod généré du descripteur** (source unique : `type`, `required`/`rules`, `enum`, `visibleIf`→optionnel si caché). Branché via `zodResolver` (RHF). Remplace `schemaForm.ts` + `tiersLieuxSchema`.
- **Backend = gate ultime** : la validation atomique `element/save` (cf. `costum-update-via-save`) reste le filet ; les erreurs serveur sont déjà surfacées (`useMutationWithToast` → `error.message`).

## 8. Architecture du moteur (site-json)

Évolution de `JsonFormModal` (`components/add/JsonFormModal.tsx`) — le germe existe (FieldRenderer + steps + i18n LocalizedString), il lui manque :
1. **RHF + zodResolver** (Zod-gen depuis descripteur) — aujourd'hui state maison.
2. **Prefill** serverData → defaultValues (transformers read).
3. **Write réel** → SDK costum (aujourd'hui `onSubmit`=console.log).
4. **Layouts** (registry §5) + validation par step/section + badges + saut-au-fautif.
5. **Conditionnel** (`visibleIf`/`requiredIf`/…) réactif.
6. **WidgetRegistry** (§4) — brancher le catalogue existant.

Points d'ancrage **déjà config-driven** : `ModalRegistry` (add) + `EditModalRegistry` (`resolveEditModalName` via `editModal`+`editModalMatch`). Le moteur s'y branche : un costum pointe son descripteur, add+edit = même moteur (comme déjà PoiEquip/TiersLieux réutilisent un seul form add/edit).

## 8b. Organisation du code — module `formEngine`

Le moteur est **transverse** (profil aujourd'hui ; `coform` candidat futur) → **module dédié**, suivant la convention site-json (cf. `commandPalette` = moteur + registry). **Frontière** : générique → `formEngine` ; connaissance métier d'un form → **descripteurs** dans le domaine (`profil`).

```
src/modules/formEngine/              ← MOTEUR (domaine-agnostique)
  schema.ts / types.ts               FormDescriptor, FieldDescriptor, Predicate, LayoutSpec, EnumOption
  engine/                            renderer RHF+zodResolver, zod-gen, évaluateur de Predicate, runner transforms
  widgets/   (registry)              WidgetRegistry + widgets génériques (migrés depuis profil/components/{form,profile-edit/fields})
  layouts/   (registry)              LayoutRegistry + flat / tabs / wizard (extensible)
  transforms/                        transformers read/write nommés (coercions + split/join/dow/address-atomic/tags-merge…)
  components/GenericFormModal.tsx    remplace JsonFormModal
  index.ts   module.config.ts   i18n/   i18n.ts

src/modules/profil/forms/            ← DESCRIPTEURS (métier, hybride TS + overlay JSON)
  poiEquipement.descriptor.ts        (premier form de preuve)
  tiersLieux.descriptor.ts
  editProfile.descriptor.ts
  (ModalRegistry / EditModalRegistry → GenericFormModal + descripteur)
```

- **Migrent dans `formEngine/widgets`** (génériques) : `TagsInput`, `OpeningHoursPicker`, `DatePickerInput`, `SelectObject`, `ImageUploadField`, `FormFieldUrlList`, `EditLocationTab` (composite `location`), `SelectParent` (composite `finder`), les `FormField*` génériques. → nettoie `profil`.
- **Restent/naissent dans `profil/forms`** : les descripteurs (champs/labels/layout/conditionnel d'un tiers-lieu/équip) + leurs transformers métier éventuels.
- **Doc module** : à terme une fiche numérotée `doc/28-module-form-engine.md` (le présent doc en est la base).

## 9. Partage lib ↔ site-json (récap)

| | Lib (données, qualité) | site-json (UI propre) |
|---|---|---|
| Champs + types + path + enum-values + multiplicité + required(validation) + presets | ✅ (contrat base + scan costum) | — |
| Read-normalisation + Save générique | ✅ (`me.costum().entity().save()`, normalize) | — |
| **Étape 2** : `CostumScope.formDescriptor(collection)` (merge base+costum, **données only**) + exports types | à ajouter (scanner→schemas lazy ; **pas** d'UI legacy) | — |
| widget / label / enum-labels / layout / sections / steps / conditionnel / transformers | — | ✅ (TS + overlay JSON) |
| Moteur (RHF/Zod-gen/prefill/write/layouts/widgets) | — | ✅ |

## 10. Plan de migration

- **Étape 1 (site-json, sans nouvelle API lib)** : créer le module **`modules/formEngine`** (moteur + widgets registry + layouts registry + transforms + `GenericFormModal`, en repartant de `JsonFormModal`) + descripteur **`modules/profil/forms/poiEquipement.descriptor.ts`** écrit à la main → remplace `PoiEquipementForm`/`AddPoiEquipementModal` (via `ModalRegistry`/`EditModalRegistry`). Valide : wizard, conditionnel (PMR/inst_part), select-from-lists, address, patch partiel, save costum.
- **Étape 2** : généraliser TiersLieux + EditProfile + Add modals (descripteurs de **base** pour le modèle).
- **Étape 3 (lib)** : `formDescriptor()` (données only) + exports → le descripteur de base vient de la lib, site-json ne fait plus que surcharger l'UI. Backfill des costums « gratuitement ».

## 11. Décisions résolues (ex-questions ouvertes)

1. **Données du descripteur** : le descripteur **lit la lib** pour `type` + `enum-values` (`CostumScope.contextFor().schema` + enums `costum-extensions`) ; on n'écrit à la main que la couche **UI** (widget/label/layout/conditionnel). Pas de double-déclaration.
2. **Patch partiel** : **on s'appuie sur le diff de la lib** (`_saveCostumViaElementSave` n'envoie que les champs modifiés, `address` comparée en objet = atomique). Le moteur pose tous les champs sur `entity.data` ; **pas de logique de patch client** (on supprime `buildEditPatch`). → à **confirmer sur 1 cas réel pendant le spike**.
3. **Doublons** (PoiEquip `usePoiEquipementMatches`) : **hors moteur** — hook métier dans `profil`, affiché via une **section custom (slot)** déclarée par le descripteur. Le moteur reste générique.
4. **Overlay JSON** = **présentationnel uniquement** (label, placeholder, ordre, visible on/off, libellés d'enum). Toute **logique** (conditionnel, transformers) reste en **TS**.
5. **Descripteur de base** (modèle) : **écrit à la main en étape 2**, puis **dérivé du contrat lib en étape 3** (quand on expose `formDescriptor()`).
6. **i18n** : **clés namespace** (cohérent avec le reste de site-json, ex. `ProfileEdit.fields.*`) — à câbler au scaffolding de `formEngine/i18n`.
7. **`optionsIf`** : implémenté mais **non sur-conçu** — périmètre limité aux cas réels recensés (à étendre si besoin).

---

### Références (assets existants)

- Germe moteur : `src/modules/profil/components/add/JsonFormModal.tsx` + `src/types/form-modal-schema.ts`
- Registries : `src/modules/profil/components/add/ModalRegistry.tsx`, `.../profile-edit/EditModalRegistry.tsx`
- Widgets : `src/modules/profil/components/profile-edit/fields/*`, `src/modules/profil/components/form/*`, `.../components/ui/select-objet.tsx`, `.../EditLocationTab.tsx`, `fields/SelectParent.tsx`
- Read/Write à unifier : `hooks/useProfileFormData.tsx`, `utils/tiersLieuxMapping.ts`, `components/add/poiEquipement.ts`, `hooks/mutationUtils.ts`, `hooks/useAddMutations.tsx`
- Lib : `../cocolight-api-endpoint/src/costum/runtime.ts` (`CostumScope.contextFor`), `schemas/<slug>.ts`, `normalize.ts`, `BaseEntity._saveCostumViaElementSave`
