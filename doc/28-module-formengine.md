[← Index](README.md)

# Module formEngine (moteur de formulaire générique + costums config-driven)

Moteur de formulaire **descriptor-driven** (`src/modules/formEngine/`) + la couche qui permet de décrire un
**formulaire costum ENTIÈREMENT en données** — à terme posable dans la config globale JSON (`config.costumForms`),
résolu et rendu sans code spécifique. Le code irréductible (lecture du serveur, scope, payload, slots UI) est
référencé **par CLÉ string** depuis des registres.

Compagnons (détail/historique) : [`moteur-formulaire-generique.md`](moteur-formulaire-generique.md) (le moteur),
[`formulaire-config-driven.md`](formulaire-config-driven.md) (la couche JSON P0→P5),
[`refactor-field-treatment.md`](refactor-field-treatment.md) (le pipeline read/write).

---

## Vue d'ensemble : 2 couches

1. **Le moteur** (`formEngine`, leaf — zéro import `@/modules/profil`/SDK/React-hooks) : un `FormDescriptor`
   (champs + widgets + sections + read/write) → `GenericForm` (RHF + zod généré + conditionnel + computed +
   layouts lazy). Tout ce qui n'est pas sérialisable est une **clé de registre** (transforms, options, validate,
   compute, widgets).
2. **Les costums** (`src/modules/profil/forms/costum/<entity>/`) : un **document fusionné** `CostumFormSchema`
   (form + modale) → `compileCostumSchema` → `{ descriptor, spec }`. Le descripteur nourrit le moteur ; la spec
   (`EntityModalSpec`) nourrit la modale générique `EntityFormModal`.

---

## Le document costum FUSIONNÉ — `CostumFormSchema`

Un **seul** objet décrit toute l'entité costum (`forms/costum/<entity>/schema.ts`). 100 % données + clés, aucune
closure → posable tel quel en JSON. Type : `forms/costum/compileCostumSchema.ts`.

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

`compileCostumSchema(schema) → { descriptor, spec }` (`forms/costum/compileCostumSchema.ts`).

- **`WIDGET_DEFAULTS`** : table `widget → {type, read, default}` (le « commun » : text→string/coerce:string/"",
  switch→bool/false, number→number/coerce:number/—, image/location→object/renderOnly, openingHours→object +
  codec, …). Précédence : champ explicite > `fieldPresets[widget]` > widget.
- **Conventions** : `label` ⇐ nom si absent ; placeholder d'un `select` ⇐ son label.
- **Règle GROUPE** : un champ avec `group` (membre d'un `serializeGroup`) ne reçoit AUCUN read/write/default
  dérivé (lu/écrit PAR le groupe).
- **`deriveDefaults:false`** : aucun `field.default` (le socle vient de `defaultsBase`, ex. tiers-lieu).
- `icon` (top-level) → `descriptor.icon` + défaut de l'icône de modale.

`descriptor.ts`/`spec.ts` de chaque costum ne font plus que `compileCostumSchema(SCHEMA).descriptor` / `.spec`.

---

## Les codecs — « le traducteur appartient au widget/concept »

Un **codec** traduit entre la forme du FORM et la forme du SERVEUR (read = serveur→form, write = form→serveur).
C'est du code, référencé par clé. Trois familles (`forms/costum/sharedCodecs.ts`) :

| Famille | Exemples | Mécanisme |
|---|---|---|
| **Lié au WIDGET spécialisé** | `openingHours:read/write` (widget openingHours) | fourni AUTO via `WIDGET_DEFAULTS` → le champ hérite, zéro code costum |
| **Clé partagée NOMMÉE** | `address:read/write`, `social:read/write` | widget générique (fieldArray/location) → référencée explicitement dans le champ/serializeGroup |
| **Codec de groupe PARAMÉTRÉ** | `monthYear`, `enumOrOther`, `multiCsv` | `serializeGroups[x] = { codec…, params }` ; le pipeline passe `g.params` en **3ᵉ arg** d'`applyTransform` |

- Les coercions de TYPE (`coerce:string/bool/number/stringArray/dateYMD/pickString/orUndef…`) vivent dans
  `engine/coercions.ts` (génériques).
- Le `params` d'un codec de groupe est **donné** dans le schéma → un codec générique réutilisable (ex. `monthYear`
  = 2 selects mois+année ↔ date `DD/MM/YYYY`, params `{monthField, yearField, day}`).

### `enumFrom` — options dynamiques par clé

Un champ peut porter **`enumFrom: "clé"`** au lieu d'un `enum` figé : les options sont résolues AU RENDU depuis
`registerOptions`/`getOptions` (`engine/transforms.ts`) — pour les listes CALCULÉES qu'un `enum` statique
gèlerait dans un JSON (ex. `tl:years` = années courante+5→1900, recalculées via `new Date()` à chaque rendu).
`GenericForm` résout les options dans l'ordre `enum > enumFrom > listsOptions`.

### i18n

Libellé = clé i18n string (résolue par i18next) **OU** `LocalizedString` inline `{fr,en,…}` (résolu locale-aware
par `useLocalization`). `I18n = string | LocalizedString` (`types.ts`). `tLoc` PRÉSERVE l'objet jusqu'au widget
(`EntityFormModal` `PRESERVE_LABELS`), où `useT` le résout — `I18nBridge` synchronise les deux locales. Les
costums utilisent l'inline `{fr,en}` (config self-suffisante).

---

## La spec modale + les registres « par clé »

`EntityModalSpec` (`forms/entityModalSpec.ts`) = description SÉRIALISABLE d'une modale add+edit (chrome, scope,
mutation, slots, image, cleanValues, invalidate…). `resolveModalSpec.ts:specToConfig` la compile en closures qui
dispatchent vers les registres. Hooks et registres :

| Hook | Registre (`specRegistries.ts`) | Rôle |
|---|---|---|
| descriptor | `registerDescriptor` / `getDescriptor(id)` | champs + layout (résolu par `descriptor:{ref}`) |
| scope | `registerScopeFn` | contexte costum résolu du **carrier live** (`useCocolight().entity`) |
| defaults | `registerDefaultsFn` | état initial du form en création |
| slots | `registerSlot` | UI React EN PLUS des champs |
| payload | `registerPayloadFn` | form → payload (défaut = pipeline générique) |
| invalidate | `registerInvalidateFn` | clés TanStack Query à rafraîchir |
| cleanValues / existingUrl / schemaFn / afterSubmit | … | hygiène / image / zod externe / effet |

**`FnRef = string | { fn, params }`** : un hook peut référencer une fn générique PARAMÉTRÉE (ex.
`cleanValues:dropEmptyArrayItems` + `{fields}` ; `invalidate:standard` + `{userList, searchKeys}`). Les fns
sont enregistrées en TS par side-effect (`registerSpecFns.ts` importe chaque `costum/<entity>/fns.ts`).

### La frontière JSON / TS

> **Le JSON porte des NOMS (clés) + des DONNÉES. Le CODE derrière les clés vit en TS, retrouvé par son nom au
> runtime.** Un costum « simple » (réutilisant des clés génériques) = **0 code**. Un costum à logique propre =
> JSON + un petit `fns.ts` (scope qui lit le carrier, payload métier, slots React).

Pour les 2 costums actuels, l'irréductible-TS se réduit à : slots React (`poiDoublons`/`parentInfo`),
`tl:payload` (merge des tags observatoire), et les `scope` (lecture carrier live).

---

## Poser un costum dans la CONFIG GLOBALE (le loader)

C'est la finalité : déclarer un costum **en données** dans `config.costumForms` (par déploiement).

```
config.costumForms.<id>  (JSON)
  → window.__CONFIG__ (boot)
  → registerCostumForms.ts  → registerCostumForm(schema)  (valide zod → compileCostumSchema → descriptor+spec)
  → table runtime costumFormRegistry  (id → EntityModalSpec)
  → ModalRegistry / EditModalRegistry : "add-<id>"/"edit-<id>" → getCostumModalSpec(id) → EntityFormModal
```

- **`costumFormRegistry.ts`** : table `id → spec`. `registerCostumModalSpec(spec)` (les `spec.ts` TS s'auto-
  enregistrent) ; `registerCostumForm(schema)` (voie config : valide via `costumFormSchema.zod.ts` puis compile).
- **`registerCostumForms.ts`** : importe les costums TS connus + lit `config.costumForms` → `registerCostumForm`.
- **`ModalRegistry`/`EditModalRegistry`** : fallback `costumModalThunk`/`costumEditThunk` pour `add-/edit-<id>`
  non hardcodé → `EntityFormModal spec={getCostumModalSpec(id)}`. Le déclencheur `floatingActionButton.modal` est
  un `z.string()` (ouvert) → accepte n'importe quel `add-<id>` de costum config.
- **Validation** : `registerCostumForm` valide le document (`CostumFormSchemaZod`, pragmatique) AVANT compilation
  → un costum de config malformé échoue avec un message clair (chemin) au lieu de crasher au rendu.
- **`site-schema.ts`** : `costumForms: z.record(z.string(), z.unknown())` (permissif ; la vraie validation se
  fait au load, côté `modules/profil`, pour ne pas inverser le layering types↔modules).

**Exemple** (`config.prod.tiers-lieux.json`) : `costumForms.tiers-lieux` porte le document complet ; la modale
add/edit du tiers-lieu est alors pilotée par la config (prouvé byte-identique au TS).

---

## Byte-parité (les gardes)

La refonte ne doit RIEN changer aux sorties (defaults/payloads/specs). Gardes :

- **`<entity>/compiled.byteparity.test`** : snapshot du `descriptor` ET de la `spec` (figé avant refactor) — toute
  dérive casse le test.
- **`<entity>.configDriven.test`** : round-trip `descriptor → JsonFormConfig → descriptor` SANS PERTE + seedEntity/
  buildPayload byte-égaux.
- **`costumFormRegistry.test`** : GARDE ANTI-DRIFT du loader — `registerCostumForm(SCHEMA) ≡ spec du module TS`
  (donc un costum posé en JSON se comporte comme le TS).
- `defaults.byteparity` / `spec.test` / `useEntityMutation.test` / `tiersLieuxMapping`.

Gate à chaque commit : `tsc 0`, `vitest src/modules/profil src/modules/formEngine` (311+), `npm run build` 0.

> ⚠️ `npm run build` (tsc `-b` strict) attrape des erreurs que `tsc --noEmit` rate (ex. types de props widget) —
> TOUJOURS le passer avant de conclure.

---

## Recette : ajouter une entité costum

1. **Si elle réutilise les clés existantes** (codecs communs, scope/payload génériques) → poser un document
   `CostumFormSchema` dans `config.costumForms.<id>` (JSON). 0 code. Déclencher via `floatingActionButton.modal:
   "add-<id>"` (ou le dropdown).
2. **Si elle a une logique propre** → créer `forms/costum/<id>/{schema.ts, fns.ts}` : `schema.ts` (le document),
   `fns.ts` (enregistre les clés irréductibles : scope/payload/slots/codecs). `descriptor.ts`/`spec.ts` = 1 ligne
   (`compileCostumSchema(SCHEMA).descriptor`/`.spec` + auto-enregistrement dans la table). Ajouter à
   `registerSpecFns.ts` (fns) ; `spec.ts` s'auto-enregistre dans `costumFormRegistry`.

---

## Limites connues / backlog

- **Codecs `pf:*` (profil) vs `tl:*`** : mêmes formats serveur (openingHours/social), widgets DIFFÉRENTS
  (editSchedule/9-grille vs openingHours/fieldArray) → codecs distincts, non fusionnés.
- **Suppression de `descriptor.ts`/`spec.ts`** (le loader les produit) non faite : couplage `fns ↔ descripteur`
  au module-load + faible valeur (la compilation se déplace).
- **zod `CostumFormSchema` pragmatique** (structure essentielle + `.passthrough()`) — pas exhaustif champ par champ.
- **Entités STANDARD** (org/projet/event/poi/edit-profil) : `EntityModalConfig` + closures (`configs/addStandard`,
  `editProfile`), pas encore le document fusionné — hors périmètre costum.
- **`scope`/`emptyDefaults`** restent par-costum (frictions : `slugKey` redondant, shapes différentes, getSlug).
