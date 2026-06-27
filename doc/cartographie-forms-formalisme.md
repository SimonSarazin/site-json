# Cartographie & formalisme — système de formulaires config-driven (site-json)

> Audit multi-agent (2026-06-26). Couvre **registres + descripteurs + lien form**, classe chaque élément
> **générique / partagé / domaine-profil / costum-spécifique**, et formalise le **nommage** (préfixes de clés,
> verbes de `fns`, layout fichiers) avec les **incohérences inter-fichiers**. Toutes les références sont
> `fichier:ligne` relatives à `src/modules/` (sauf indication). À relire avant tout refactor de nommage.

## Plan
0. [⚠️ LIVE vs test/oracle/fallback — à lire EN PREMIER](#0--live-vs-testoraclefallback)
1. [Registres moteur (générique)](#1-registres-moteur-générique)
2. [Clés domaine par préfixe](#2-clés-domaine-par-préfixe)
3. [Descripteurs + lien form](#3-descripteurs--lien-form)
4. [Spec modale + fns](#4-spec-modale--fns)
5. [Formalisme canonique recommandé](#5-formalisme-canonique-recommandé)
6. [Incohérences inter-fichiers (classées par impact)](#6-incohérences-inter-fichiers-classées-par-impact)

---

# 0. ⚠️ LIVE vs test/oracle/fallback

**À NE JAMAIS conflér en relisant ce code.** Plusieurs fichiers TS qui *ressemblent* à « la config » ou « le
pipeline » ne sont **plus la source vivante** : la donnée a été transformée en **config JSON** (costums) ou le
builder est devenu un **oracle de test** (standard). Seul le `fns.ts` (code irréductible référencé par clé)
reste du TS vivant côté costum.

| Domaine | **LIVE (chemin runtime réel)** | **PAS la source — oracle de test / fallback dev** |
|---|---|---|
| **costum** (equipements-sportifs, tiers-lieux) | `config.costumForms.<id>` (**JSON**, par déploiement) → `registerCostumForms.ts:17-28` lit `window.__CONFIG__.costumForms` → `registerCostumForm` (compile + garde clés + table) → `specToConfig`. **Code vivant = `<costum>/fns.ts`** (les clés). | `<costum>/{schema,descriptor,spec}.ts` = **miroir byte** de la JSON, gardés UNIQUEMENT pour les tests (`registerCostumForm(SCHEMA) ≡ spec TS`) + fallback dev. `spec.ts` n'auto-enregistre QUE pour les tests (`registerCostumForms.ts:5-8`). |
| **standard** (poi/projet/org/event/citoyen) | `configs/addStandard.tsx` + `configs/editProfile.tsx` (closures `EntityModalConfig`) + `profilMerged.ts` (`MERGED_*`). | `buildProfileUpdateData` / `seedProfileFormValues` / `PROFIL_SPECS` (`editProfilePayload.ts`) = **oracle byte des tests** depuis la bascule VOIE A — plus appelés au runtime. |

Conséquences de lecture pour ce document :
- Quand une section montre un `<costum>/schema.ts` (ex. §4), c'est l'**oracle TS** ; la donnée VIVANTE identique est dans `config.costumForms.<id>` (le JSON a été généré depuis ce schema). Le schema illustre la *forme*, pas la *source*.
- `buildProfileUpdateData`/`PROFIL_SPECS` apparaissent comme « domaine-profil » dans les tables : ils sont **test-only** désormais — ne pas les compter comme chemin d'écriture vivant.
- L'incohérence #4 (« 2 voies ») compare bien deux chemins **vivants** : closures standard vs données+clés+JSON costum (PAS le TS de test).

---

# 1. Registres moteur (générique)

Localisation : `src/modules/formEngine/` (LEAF générique). Exception : `specRegistries.ts` vit côté domaine sous `src/modules/profil/forms/specRegistries.ts` (registres de code IRRÉDUCTIBLE référencé par clé depuis une `EntityModalSpec`).

Barrel `index.ts:1` ré-exporte tout le moteur. Le ré-export de `coercions` (`index.ts:20`) exécute le module → enregistre les `coerce:*` au chargement (side-effect). Les transforms DOMAINE s'enregistrent depuis `profil/forms/{geoTransforms,validators,editProfilePayload,costum/sharedCodecs,costum/tiers-lieux/fns}.ts`.

### 1. Inventaire des registres (6)

| Registre | Fichier:ligne | Stockage | register | get | autres |
|---|---|---|---|---|---|
| **transform** (read/write/computed-string + `coerce:*`) | `transforms.ts:18` | `Map<string,TransformFn>` | `registerTransform` `:20` | `getTransform` `:23` | `applyTransform` `:28` (3+1 args), `hasRegistered("transform")` `:105` |
| **validate** (cross-champ) | `transforms.ts:56` | `Map<string,ValidateFn>` | `registerValidate` `:57` | `getValidate` `:60` | `resolveValidate` `:65` (inline OU clé), `hasRegistered("validate")` |
| **options** (`enumFrom`) | `transforms.ts:78` | `Map<string,OptionsFn>` | `registerOptions` `:79` | `getOptions` `:82` (warn si absent) | `hasRegistered("options")` |
| **compute** (`computedFrom.fn`) | `transforms.ts:90` | `Map<string,ComputeFn>` | `registerCompute` `:91` | `getCompute` `:94` | `hasRegistered("compute")`. Seed: `multiply` `:98` |
| **widgets** (`WidgetKind`→composant) | `widgets/registry.tsx:49` | `Partial<Record<string,WidgetComponent>>` (objet, pas Map) | `registerWidget` `:132` | `getWidget` `:136` (fallback `text`, JAMAIS undefined) | aucun `has*` |
| **specRegistries** (10 sous-registres domaine) | `profil/forms/specRegistries.ts` | 11 `Map` distinctes | `registerDescriptor/registerDescriptorVariant/registerDefaultsFn/registerPayloadFn/registerScopeFn/registerSlot/registerSchemaFn/registerExistingUrlFn/registerAfterSubmitFn/registerCleanValuesFn/registerInvalidateFn` | `get*` homologues (warn via `warnMissing` `:21` sauf `getDescriptor`/variant) | `hasSpecFn(kind,key)` `:162` (switch, silencieux) |

`specRegistries` agrège en réalité 11 Maps : `descriptors` `:26`, `descriptorVariants` `:38`, `defaultsFns` `:50`, `payloadFns` `:62`, `scopeFns` `:74`, `slotFns` `:86`, `schemaFns` `:98`, `existingUrlFns` `:110`, `afterSubmitFns` `:122`, `cleanValuesFns` `:134`, `invalidateFns` `:146`.

### 2. `coerce:*` génériques (12 clés, `coercions.ts`, enregistrées `:81–92`)

Coerceurs de TYPE (forcent le type) :
- `coerce:string` `:15` — string→string ; number→String(n) ; sinon `""`.
- `coerce:number` `:22` — number fini OU string numérique → number ; vide/non-fini → `undefined` (clé omise).
- `coerce:bool` `:34` — bool ; number→(===1) ; string∈{true,1,oui,yes} insensible casse ; sinon false.
- `coerce:stringArray` `:42` — array→strings non vides ; string→split(`,`) trim filtré ; sinon `[]`.
- `coerce:dateYMD` `:49` — Date/ISO → `"YYYY-MM-DD"` via date-fns `format` (locale-aware) ; sinon `""`.

Coerceurs « truthy/default » (NE coercent PAS le type, idiomes legacy) :
- `coerce:orEmpty` `:59` — `v || ""` (ne stringifie pas un number truthy).
- `coerce:orUndef` `:62` — `v || undefined` (clé omise).
- `coerce:pickString` `:65` — string→v sinon `""` (string-ONLY ; NE coerce PAS les nombres → distinct de `coerce:string`).
- `coerce:arrayOrEmpty` `:68` — `Array.isArray(v) ? v : []`.
- `coerce:truthy` `:71` — `Boolean(v)` (distinct de `coerce:bool` qui interprète "true"/"oui"/1).
- `coerce:dateISO` `:74` — truthy → `new Date(v).toISOString()` ; sinon `""`.
- `coerce:dateYMDfromISO` `:78` — truthy → `toISOString().split("T")[0]` (UTC pur ; distinct de `coerce:dateYMD` locale-aware) ; sinon `""`.

Doublons fonctionnels assumés : (`coerce:dateYMD` vs `coerce:dateYMDfromISO`), (`coerce:bool` vs `coerce:truthy`), (`coerce:string` vs `coerce:pickString`) — la doc les distingue explicitement.

### 3. Transforms génériques de base (`transforms.ts:38–52`)
`identity`, `toNumber`, `toString`, `toBoolean`, `toStringArray`, `splitCsv`, `joinCsv`. Recouvrent en partie les `coerce:*` (ex. `toNumber`≈`coerce:number`, `toStringArray`≈`coerce:stringArray`) — deux familles co-existent.

### 4. Fns moteur : ce qu'elles font + props du descripteur consommées

`entityForm.ts` (3 primitives au-dessus du pipeline) :
- `seedEntity(spec, entity?)` `:24` — READ create+edit. Étale `spec.baseDefaults?.()` puis `seedFromEntity(spec.descriptor, entity.serverData)`. Consomme `FormSpec.baseDefaults` + `EntityLike.serverData`.
- `buildPayload(spec, values)` `:29` — WRITE create. Délègue `valuesToPayload(descriptor, values)` (emitEmpty=false → omit-empty).
- `buildEditPayload(spec, values)` `:39` — WRITE edit. `valuesToPayload(descriptor, values, { emitEmpty: true })` (payload complet, vides typés ; le SDK diffe en interne).

`fieldPipeline.ts` :
- `seedFromEntity(descriptor, serverData)` `:45` — pour chaque groupe : `applyTransform(g.read, serverData[g.serverKey], serverData, g.params)` étalé à plat (`:48–51`) ; pour chaque champ simple : skip si `field.group || writeOnly || renderOnly` (`:54`), lit `serverData[path ?? name]` (`storeKey` `:21`), applique `field.read` (`:56`), retombe sur `field.default` si vide (`:59`). **Consomme** : `serializeGroups.{read,serverKey,params}`, `field.{group,writeOnly,renderOnly,path,name,read,default}`.
- `valuesToPayload(descriptor, values, {emitEmpty})` `:72` — skip si `readOnly || renderOnly` (`:85`) ; skip membre de groupe SAUF si `groupReadOnly` (`:87`) ; applique `field.write` (`:88`) ; en `emitEmpty` (sauf `writeOnly`) un vide → `clearValue(field)` typé (`:93`), sinon omet `undefined` (`:95`) ; groupes recomposés via `g.write` (`:101–110`), `groupReadOnly` non émis au niveau groupe (`:102`), objet vidé → `''` jamais `{}` (`:105`). **Consomme** : `field.{readOnly,renderOnly,group,write,writeOnly,path,name,type,clear}`, `serializeGroups.{write,serverKey,groupReadOnly,params}`, opt `emitEmpty`.
- `clearValue(field)` `:28` — `field.clear` explicite sinon `[]` si `type==="array"` sinon `""`. **Consomme** : `field.{clear,type}`.

`GenericForm.tsx` (consommateur runtime des registres) :
- computedFrom `:91–104` — `getCompute(cf.fn)` puis `fn(cf.deps.map(getValues))`, recalc sur `computedDepsKey`. **Consomme** `field.computedFrom.{deps,fn}`.
- options `:112–120` — `listsOptions[field.optionsKey ?? name]` (runtime) ; `field.enumFrom ? getOptions(...)()` ; priorité `enum` > `enumFrom` > runtime string[]. **Consomme** `field.{optionsKey,enumFrom,enum}`.

### 5. Générique vs domaine

| Élément | G/D |
|---|---|
| transformRegistry + base transforms + `coerce:*` | **G** |
| validateRegistry / optionsRegistry / computeRegistry (+ seed `multiply`) | **G** |
| widgetRegistry (kinds génériques: text/textarea/number/switch/checkbox/checkboxGroup/select/multiselect/date/urlList/openingHours/fieldArray) | **G** |
| widgets domaine (location/finder/eventDates/editSocial/editSchedule/tags/image/email/tel) injectés via `registerWidget` depuis `profil/forms/registerWidgets.tsx` | **D** |
| seedEntity/buildPayload/buildEditPayload/seedFromEntity/valuesToPayload/clearValue/conditional | **G** |
| `specRegistries.ts` (tout) — dépend SDK/zod/React | **D** (vit côté profil) |
| transforms domaine (geo/social/address/openingHours, `tl:*`) | **D** (enregistrés depuis profil) |

### 6. Garde

`assertKeysRegistered.ts` (`profil/forms/costum`) parcourt descripteur+spec et utilise `hasRegistered(kind,key)` (`transform/validate/options/compute`) + `hasSpecFn(kind,key)` pour lever une erreur claire vs le `console.warn` silencieux. C'est le seul consommateur des `has*`.


---

# 2. Clés domaine par préfixe

Toutes les clés sont enregistrées dans **deux familles de registres** distincts :
- **Registre `transforms`** (`formEngine/engine/transforms.ts:20` `registerTransform`) — codecs read/write de champ + coercions ; clés `coerce:`, `pf:`, `tl:`, `geo:`/`geoPosition:`, `address:`/`social:`/`openingHours:`/`monthYear:`/`enumOrOther:`/`multiCsv:`.
- **Registre `validate`** (`transforms.ts:57` `registerValidate`) — validators cross-champ (clés SANS préfixe).
- **Registre `options`** (`transforms.ts:79` `registerOptions`) — sources d'options dynamiques (`tl:years`).
- **Registres `specRegistries`** (`specRegistries.ts`) — fns de spec de modale costum : `registerScopeFn` (75), `registerDefaultsFn` (51), `registerPayloadFn` (63), `registerSlot` (87), `registerExistingUrlFn` (111), `registerCleanValuesFn` (135), `registerInvalidateFn` (147). Clés `tl:`, `poi:`, `image:`, `cleanValues:`, `invalidate:`, + ids de slot SANS préfixe.

### Table maître — toutes les clés enregistrées, groupées par préfixe

| clé | registrar (fichier:ligne) | rôle | consommateurs (fichier:ligne) | portée |
|---|---|---|---|---|
| **coerce:string** | coercions.ts:81 | string\|number→string, sinon "" | tl/schema:89-90 (surface*), poi/schema:36 (description) | générique |
| **coerce:number** | coercions.ts:82 | numérique→number, vide→undefined | descripteurs config (champs `number`) | générique |
| **coerce:bool** | coercions.ts:83 | "true"/"oui"/1→bool | descripteurs config (champs `switch`) | générique |
| **coerce:stringArray** | coercions.ts:84 | array/CSV→string[] | poi/schema:37 (tags) | générique |
| **coerce:dateYMD** | coercions.ts:85 | Date→"YYYY-MM-DD" (date-fns, locale) | descripteurs config | générique |
| **coerce:orEmpty** | coercions.ts:86 | `v \|\| ""` (pas de coercion type) | editProfilePayload.ts:110,113,127-129,142,143,149-166 | générique |
| **coerce:orUndef** | coercions.ts:87 | `v \|\| undefined` (clé omise) | editProfilePayload.ts:149,156,163,176; tl/schema:84-85,89-90,95,100,113 | générique |
| **coerce:pickString** | coercions.ts:88 | string-ONLY→v sinon "" (ne stringifie PAS nombre) | tl/schema:80,84-85,94-95,100,113 | générique |
| **coerce:arrayOrEmpty** | coercions.ts:89 | `Array.isArray(v)?v:[]` | editProfilePayload.ts:130,177 (tags/urls READ) | générique |
| **coerce:truthy** | coercions.ts:90 | `Boolean(v)` (truthiness simple) | editProfilePayload.ts:164 (recurrency READ) | générique |
| **coerce:dateISO** | coercions.ts:91 | `new Date(v).toISOString()` complet | editProfilePayload.ts:165 (start/endDate READ) | générique |
| **coerce:dateYMDfromISO** | coercions.ts:92 | ISO UTC→"YYYY-MM-DD" (UTC pur) | editProfilePayload.ts:143 (birthDate READ) | générique |
| **pf:tags** | editProfilePayload.ts:63 | array non vide→array, sinon "" | COMMON.tags:130 | domaine-profil |
| **pf:recurrency** | editProfilePayload.ts:64 | `v \|\| false` | events:164 | domaine-profil |
| **pf:timeZone** | editProfilePayload.ts:65 | défaut = TZ navigateur | events:166 | domaine-profil |
| **pf:isoDate** | editProfilePayload.ts:66 | `formatISO(new Date(v))` si string | events:165 (start/endDate WRITE) | domaine-profil |
| **pf:entityRef** | editProfilePayload.ts:67 | ref parent/organizer → {name,type} | projects:157, events:167-168 | domaine-profil |
| **pf:openingHours** | editProfilePayload.ts:71 | array→7-DOW serveur, sinon omis | organizations:150, events:171 | domaine-profil |
| **pf:addressWrite** | editProfilePayload.ts:74 | champs plats→objet `address` (gate countryLocality) | ADDR_GROUP:109 | domaine-profil |
| **pf:addressRead** | editProfilePayload.ts:79 | objet `address`→14 champs plats | ADDR_GROUP:109 | domaine-profil |
| **pf:socialRead** | editProfilePayload.ts:83 | objet `socialNetwork`→9 champs plats | SOCIAL_GROUP:110 | domaine-profil |
| **pf:rdRefOrUndef** | editProfilePayload.ts:89 | `v ?? undefined` (parent READ) | projects:157, events:167 | domaine-profil |
| **pf:rdOrganizer** | editProfilePayload.ts:90 | `v ?? {}` | events:168 | domaine-profil |
| **pf:rdPublic** | editProfilePayload.ts:91 | `v !== false` | events:169 | domaine-profil |
| **pf:rdOpeningHours** | editProfilePayload.ts:92 | array serveur→modèle widget (filtré) | organizations:150, events:171 | domaine-profil |
| **tl:video0** | tiers-lieux/fns.ts:112 | `array[0]`→string | tl/schema:99 (videoUrl READ) | costum-spécifique |
| **tl:numOrUndef** | tiers-lieux/fns.ts:124 | `v?Number(v):undefined` | tl/schema:89-90 (surface* WRITE) | costum-spécifique |
| **tl:videoWrite** | tiers-lieux/fns.ts:125 | `v?[v]:undefined` | tl/schema:99 (videoUrl WRITE) | costum-spécifique |
| **tl:years** | tiers-lieux/fns.ts:220 (registerOptions) | options année courante+5→1900 | tl/schema:83 (openingYear `enumFrom`) | costum-spécifique |
| **tl:emptyDefaults** | tiers-lieux/fns.ts:224 (registerDefaultsFn) | socle defaults tiers-lieu | tl/schema:171 (defaultsBase) | costum-spécifique |
| **tl:scope** | tiers-lieux/fns.ts:226 (registerScopeFn) | scope = slug du carrier | tl/schema:170 (scope.derive) | costum-spécifique |
| **tl:payload** | tiers-lieux/fns.ts:229 (registerPayloadFn) | payload mode-aware (create scopé / edit complet) | tl/schema:174 (payloadFn) | costum-spécifique |
| **poi:scope** | equipements-sportifs/fns.ts:78 (registerScopeFn) | scope SSBE (parentId/sourceKey/poiType) | poi/schema:147 (scope.derive) | costum-spécifique |
| **poi:emptyDefaults** | equipements-sportifs/fns.ts:84 (registerDefaultsFn) | defaults dérivés du descripteur | poi/schema:150 (defaultsBase) | costum-spécifique |
| **address:read** | sharedCodecs.ts:27 | objet `address`→14 champs plats (omit-empty) | tl/schema:75, poi/schema:23 | partagé (costum) |
| **address:write** | sharedCodecs.ts:43 | champs plats→objet `address` (buildAddressFromForm) | tl/schema:75, poi/schema:23 | partagé (costum) |
| **openingHours:read** | sharedCodecs.ts:94 | array serveur→modèle 7 jours | hérité par WIDGET_DEFAULTS (widget `openingHours`), tl/schema:111 | partagé (widget) |
| **openingHours:write** | sharedCodecs.ts:95 | modèle 7 jours→array serveur | idem | partagé (widget) |
| **social:read** | sharedCodecs.ts:127 | objet `socialNetwork`→`[{platform,url}]` | tl/schema:102 | partagé (costum) |
| **social:write** | sharedCodecs.ts:128 | `[{platform,url}]`→objet `socialNetwork` | tl/schema:102 | partagé (costum) |
| **monthYear:read** | sharedCodecs.ts:136 | date-string→{month,year} (paramétré) | tl/schema:72 (openingDate) | partagé paramétré |
| **monthYear:write** | sharedCodecs.ts:148 | {month,year}→date-string | tl/schema:72 | partagé paramétré |
| **enumOrOther:read** | sharedCodecs.ts:157 | valeur→{value,other} (known[]) | tl/schema:73 (manageModel) | partagé paramétré |
| **enumOrOther:write** | sharedCodecs.ts:164 | {value,other}→valeur serveur | tl/schema:73 | partagé paramétré |
| **multiCsv:read** | sharedCodecs.ts:172 | CSV→{items[],other} | tl/schema:74 (typePlace) | partagé paramétré |
| **multiCsv:write** | sharedCodecs.ts:181 | {items[],other}→CSV | tl/schema:74 | partagé paramétré |
| **geo:write** | geoTransforms.ts:34 | champs→GeoCoordinates (lat/lng STRING), lié à localityId | editProfilePayload.ts:117 (GEO_FIELDS), tl/schema:122, poi/schema:38 | partagé (toutes entités à adresse) |
| **geoPosition:write** | geoTransforms.ts:35 | champs→GeoJSON Point (coords NUMBER) | editProfilePayload.ts:118, tl/schema:123, poi/schema:39 | partagé |
| **image:profilUrl** | sharedFns.ts:12 (registerExistingUrlFn) | URL image existante (medium>image>thumb) | tl/schema:169, poi/schema:142 (`existingUrlFrom`) | partagé (costum) |
| **cleanValues:dropEmptyArrayItems** | sharedFns.ts:19 (registerCleanValuesFn) | retire items array vides (paramétré `fields`) | poi/schema:152 | partagé paramétré |
| **invalidate:standard** | sharedFns.ts:41 (registerInvalidateFn) | invalidation react-query (paramétré userList/searchKeys) | tl/schema:181, poi/schema:162 | partagé paramétré |
| **addressValid** | validators.ts:64 (registerValidate) | ville sans localityId→erreur | descripteurs add (event) | domaine-profil (SANS préfixe) |
| **addressComplete** | validators.ts:65 (registerValidate) | adresse complète requise | tl/schema (validate), poi | domaine-profil (SANS préfixe) |
| **eventDatesValid** | validators.ts:66 (registerValidate) | dates event ponctuel/récurrent | descripteurs event | domaine-profil (SANS préfixe) |
| **editEventValid** | validators.ts:67 (registerValidate) | organizer + dates (edit) | descripteur edit-event | domaine-profil (SANS préfixe) |
| **addEventValid** | validators.ts:68 (registerValidate) | organizer (sauf _hasParent) + dates + adresse | descripteur add-event | domaine-profil (SANS préfixe) |
| **parentInfo** | equipements-sportifs/fns.ts:91 (registerSlot) | slot React parent readonly | poi/schema (slots) | costum-spécifique (SANS préfixe) |
| **poiDoublons** | equipements-sportifs/fns.ts:92 (registerSlot) | slot React détection doublons | poi/schema (slots) | costum-spécifique (SANS préfixe) |

### Sens de chaque préfixe (ce qu'il signale)

| préfixe | axe | signification | exemples |
|---|---|---|---|
| **coerce:** | par CONCEPT (type) | coercion de TYPE pure/générique du moteur, réutilisable partout (aucune sémantique métier) | coerce:string, coerce:orUndef |
| **pf:** | par MODULE (profil) | codec READ/WRITE propre au domaine PROFIL (citoyens/orgs/projects/events/poi standard), widgets profil | pf:addressRead, pf:openingHours |
| **tl:** | par MODULE (costum tiers-lieux) | code irréductible du costum tiers-lieu (transforms restants + spec fns) | tl:video0, tl:payload, tl:scope |
| **poi:** | par MODULE (costum équipements sportifs) | code irréductible du costum POI SSBE (scope/defaults/slots) | poi:scope, poi:emptyDefaults |
| **address:** | par CONCEPT | codec d'adresse PostalAddress partagé entre costums (objet↔14 champs plats) | address:read/write |
| **social:** | par CONCEPT | codec réseaux sociaux partagé (socialNetwork↔fieldArray) | social:read/write |
| **openingHours:** | par CONCEPT (widget) | codec horaires lié AU WIDGET `openingHours`, hérité via WIDGET_DEFAULTS | openingHours:read/write |
| **monthYear:/enumOrOther:/multiCsv:** | par CONCEPT (codec de groupe) | codecs de GROUPE paramétrés (spécificité = `params` en données) | monthYear:read |
| **geo:/geoPosition:** | par CONCEPT | écriture coords liée à localityId, uniforme toutes entités à adresse | geo:write |
| **image:** | par CONCEPT | source d'URL d'image existante (registre specFns) | image:profilUrl |
| **cleanValues:/invalidate:** | par CONCEPT (étape de cycle) | étapes de spec de modale génériques paramétrées | cleanValues:dropEmptyArrayItems |
| **(sans préfixe)** | mixte | validators cross-champ (validateRegistry) ET ids de slot React | addressValid, parentInfo |

Note de direction (preuves dans les commentaires de tête) : le refactor a CONVERGÉ vers les préfixes par CONCEPT (`address:`/`social:`/`openingHours:`/`coerce:`) en SUPPRIMANT les variantes par module (`tl:addressRead`→`address:read`, `tl:hoursRead`→`openingHours:read`, `tl:socialRead`→`social:read`, `tl:pickNumberString`→`coerce:string`, `poi:dropEmptyUrls`→`cleanValues:dropEmptyArrayItems`, `poi/tl:invalidate`→`invalidate:standard`) — voir tiers-lieux/fns.ts:111-128, equipements-sportifs/fns.ts:93-96, sharedCodecs.ts:23,48,103. Le préfixe `pf:` est l'exception NON convergée (voir divergences).

READER conseillé pour ANGLE suivant : commencer par `src/modules/profil/forms/specRegistries.ts` (carte des 7 registres specFns + signatures) puis `src/modules/formEngine/engine/transforms.ts` (3 registres transform/validate/options) — ce sont les deux points d'entrée qui définissent QUI peut nommer une clé.


---

# 3. Descripteurs + lien form

Tous chemins relatifs à `/home/djabatav/meteor/communecter/cocolight/site-json/src/modules/`. Le module est `formEngine/` sous `src/modules` (et non à la racine).

### (a) Props de FieldDescriptor / FormDescriptor / SerializeGroup → rôle → sémantique → fn moteur qui la lit

Source des types : `formEngine/types.ts`.

#### FieldDescriptor (`types.ts:51-110`)
| prop | rôle | sémantique | fn moteur qui la LIT |
|---|---|---|---|
| `name` | read+write+rendu | clé plate des FormValues ; clé de stockage si pas de `path` | `fieldPipeline.storeKey` (`fieldPipeline.ts:21`), `GenericForm.renderField` (`GenericForm.tsx:107`) |
| `path` | read+write | clé de stockage serveur si ≠ name | `storeKey` (`fieldPipeline.ts:21`) → `seedFromEntity` (`:56`), `valuesToPayload` (`:93,96`) |
| `type` | read+write+rendu | type logique ; pilote base zod + clearValue + number-preprocess | `zodGen.baseFieldSchema` (`zodGen.ts:21-35`), `fieldPipeline.clearValue` (`:28-31`) |
| `enum` | rendu | options statiques `{value,label}` (label I18n) | `GenericForm.renderField` (`GenericForm.tsx:114`) |
| `enumFrom` | rendu | clé registre d'options DYNAMIQUES (résolues au rendu) | `GenericForm` (`:113`) → `getOptions` (`transforms.ts:82`) |
| `multiple` | (rendu) | dérivation widget (générateur) ; pas lu au rendu direct | `defaultWidgetForType` (`configToDescriptor.ts:113`), `costumToConfig` |
| `default` | read | défaut si valeur vide côté serveur (et au create) | `seedFromEntity` (`fieldPipeline.ts:59`) |
| `widget` | rendu | choisit le composant | `GenericForm` (`:124`) → `getWidget` (`registry.tsx:136`) |
| `label`/`placeholder`/`placeholderSearch`/`info` | rendu | libellés I18n (clé OU LocalizedString) | widgets via `WidgetProps.t` (`registry.tsx:42-47`, `registerWidgets.tsx:31`) |
| `widgetProps` | rendu | props ad-hoc passées au widget (rows/inputType/searchTypes/itemFields…) | chaque widget (`registry.tsx`, `registerWidgets.tsx`) ; fusion runtime `GenericForm.fieldProps` (`:123`) |
| `optionsKey` | rendu | clé d'options runtime `listsOptions[optionsKey ?? name]` | `GenericForm` (`:112`) |
| `required` | rendu+validation | « * » + required statique zod | widgets (`registry.tsx:55`…), `zodGen` (`:54-60`) |
| `rules` (url/min/max/minLength/maxLength/regex) | validation | règles par champ (si valeur non vide) | `zodGen` (`:64-77`) |
| `messages` | validation | messages d'erreur pré-résolus par règle | `zodGen` (`:53,59,67…`) |
| `visibleIf` | rendu+validation | masque le champ (ni rendu ni validé) | `GenericForm.renderField` (`:109`) + `zodGen` (`:49`) via `conditional.check` |
| `requiredIf` | validation | required conditionnel | `zodGen` (`:56`) via `evaluatePredicate` |
| `computedFrom {deps,fn}` | rendu (effet) | recalcul réactif (ex. surface=L×l) | `GenericForm` useEffect (`:91-104`) → `getCompute` |
| `read` | read | transformer serveur→form | `seedFromEntity` (`fieldPipeline.ts:56`) |
| `write` | write | transformer form→payload | `valuesToPayload` (`:88`) |
| `clear` | write (édition) | valeur d'effacement (défaut ""/[] selon type ; jamais {}) | `clearValue` (`fieldPipeline.ts:29`) appelé par `valuesToPayload` emitEmpty (`:93`) |
| `atomicGroup` | **MORT** | doc dit « diffForEdit ré-émet le groupe » | **AUCUNE fn moteur** (cf. divergence) ; seulement round-trippé par config (`configToDescriptor.ts:73`, `formDescriptorToConfig.ts:47`, `mergeRenderPipeline.ts:23`) |
| `group` | read+write | membre d'un serializeGroup | `seedFromEntity` skip (`:54`), `valuesToPayload` skip-sauf-groupReadOnly (`:87`) |
| `writeOnly` | write | émis mais jamais relu ; garde omit-empty même en édition | `seedFromEntity` skip (`:54`), `valuesToPayload` (`:92`) |
| `readOnly` | read | seedé mais jamais émis | `valuesToPayload` skip (`:85`) |
| `renderOnly` | ni read ni write | ancre UI composite pure | `seedFromEntity` skip (`:54`) + `valuesToPayload` skip (`:85`) |

#### FormDescriptor (`types.ts:164-184`)
`id`/`icon`/`collection`/`costumSlug` : métadonnées (host modal + générateur config). `layout` : `getLayout` (`GenericForm.tsx:130`) + `layoutPresentation` (`shared.tsx:20`). `sections` : layouts (`shared.sectionGroups`/`renderSection`, `shared.tsx:45-72`). `fields` : map name→descriptor, itérée par toutes les fns moteur. `validate` (string|fn) : `resolveValidate` (`transforms.ts:65`) lu par `zodGen` (`:43`) ET `GenericForm` (`:61`). `serializeGroups` : `seedFromEntity` (`fieldPipeline.ts:48`) + `valuesToPayload` (`:101`).

#### SerializeGroup (`types.ts:183`, schema `schema.ts:100-107`)
`serverKey` (clé objet serveur) ; `read`/`write` (clés transform : objet↔plates) ; `groupReadOnly` (READ décompose mais membres écrits INDIVIDUELLEMENT — asymétrie social profil) ; `params` (données des codecs paramétrés monthYear/enumOrOther/multiCsv, 3e arg `applyTransform`). Lus par `seedFromEntity` (`:48-51`) et `valuesToPayload` (`:101-110`).

#### Section/Group/Layout (`types.ts:118-159`)
`SectionDescriptor` : `id`/`label`/`icon`(stepper)/`visibleIf`/`fields`(plat)/`groups`. `FieldGroup` : `columns`(1-3)/`label`/`required`/`visibleIf`(bloc entier)/`divider`/`titleClassName`/`fields`(+`$slot:id`). `LayoutSpec` : `kind` flat|tabs|wizard|accordion + `LayoutPresentation` (stepper pills|tabs / progress count|bar|none / header plain|gradient) — lus par `shared.tsx` (`renderSection`, `StepTriggers`, `TabBar`, `layoutPresentation`).

### (b) Inventaire des descripteurs et leur NATURE — 3 (en réalité 4) façons d'obtenir « 1 descripteur unifié »

| Descripteur | fichier | nature | unification read+write |
|---|---|---|---|
| `addPoiDescriptor` | `profil/forms/addPoi.descriptor.ts:41` | **PHYSIQUE écrit-à-la-main** (champs inline + `hidden()` local) | unifié dans le fichier même : `address` serializeGroup + membres `hidden(group:"address")` + `geo`/`geoPosition` writeOnly |
| `addProjectDescriptor` / `addOrganizationDescriptor` / `buildAddEventDescriptor` | `addProject.descriptor.ts:18` / `addOrganization.descriptor.ts:33` / `addEvent.descriptor.ts:31` | **RENDER-only** (que des champs de rendu, AUCUN read/write ni serializeGroups) | NON unifiés seuls → fusionnés runtime via `mergeRenderPipeline` |
| `EDIT_DESCRIPTORS` (5 entités) | `editProfile.descriptor.ts:168` | **RENDER-only** (composites `_location`/`_social`/`_schedule`/`_eventDates` sans pipeline) | NON unifiés seuls |
| `PROFIL_DESCRIPTORS` (5 entités) | `editProfilePayload.ts:138` | **PIPELINE-only** (widgets `hidden`, read/write/group/serializeGroups, PARTAGÉ add+edit) | la moitié WRITE/READ, jamais rendue |
| `MERGED_EDIT_DESCRIPTORS` / `MERGED_ADD_*` | `profilMerged.ts:24-32` | **DÉRIVÉ-FUSIONNÉ** (`mergeRenderPipeline(render, pipeline)`) | unifié AU RUNTIME (render+pipeline superposés) |
| `tiersLieuxDescriptor` | `costum/tiers-lieux/descriptor.ts:16` | **COMPILÉ** depuis `TIERS_LIEUX_SCHEMA` (`schema.ts:59`) via `compileCostumSchema` | unifié par compilation (widget→type/read/default + overrides + serializeGroups) |
| `equipementsSportifsDescriptor` | `costum/equipements-sportifs/descriptor.ts:17` | **COMPILÉ** depuis `EQUIPEMENTS_SPORTIFS_SCHEMA` (`schema.ts:17`) | idem |
| config costum lib | `formEngine/config/costumToConfig.ts:68` (`descriptorToConfig`) | **GÉNÉRÉ depuis lib** (base entité + overlay costum NEUTRE → JsonFormConfig) → puis `configToDescriptor` | 4e voie, format → widget |

Le pipeline READ/WRITE (`seedFromEntity`/`valuesToPayload` dans `fieldPipeline.ts`, exposé via `seedEntity`/`buildPayload`/`buildEditPayload` `entityForm.ts`) est COMMUN à toutes ces natures — c'est le `FormDescriptor` qui est obtenu de 4 façons. `PROFIL_SPECS` passe même chaque pipeline par un round-trip config (`editProfilePayload.ts:189-194`).

### (c) Le lien RENDU

- **Widgets** : registre 2-temps. Génériques dans `formEngine/widgets/registry.tsx:49-115` (hidden/text/textarea/number/switch/checkbox/checkboxGroup/select/selectFromLists/multiselect/date/urlList/openingHours/fieldArray). DOMAINE poussés (inversion de dépendance) par `profil/forms/registerWidgets.tsx:34-104` (email/tel/tags/image/location/finder/eventDates/editSocial/editSchedule). `getWidget` fallback → `text` (`registry.tsx:137`).
- **Sections/groups** : `GenericForm.renderField` (`GenericForm.tsx:106-126`) + `shared.sectionGroups`/`renderSection`/`renderEntry` (`shared.tsx:45-72`). Slots `$slot:id` rendus par `renderSlot` (`GenericForm.tsx:128`, `shared.tsx:56-58`).
- **Composites/ancres** : deux conventions coexistantes (cf. divergences). (1) costum/poi-add : nom métier `address`/`_imageFile`/`_logoFile` widget `location`/`image`, marqué `renderOnly` (costum, via `WIDGET_DEFAULTS` `compileCostumSchema.ts:94-95`) ou comptant sur le group-loop-wins (addPoi). (2) profil-edit : noms `_`-préfixés `_location`/`_social`/`_schedule`/`_eventDates` (`editProfile.descriptor.ts:32,33,63,64,127`) SANS pendant pipeline → `mergeRenderPipeline` les marque `renderOnly` (`mergeRenderPipeline.ts:30-33`). Les composites pilotent les champs PLATS via `form.setValue` (ex. `EditLocationTab` pose `addressLocality`/`localityId`/`level*`/`codeInsee`, `EditLocationTab.tsx:287-318`), eux membres du serializeGroup `address`.


---

# 4. Spec modale + fns

> READER : `EntityFormModal.tsx:38-73` (shape `EntityModalConfig`, le contrat unique consommé au rendu) puis `entityModalSpec.ts:77-129` (shape `EntityModalSpec`, la forme sérialisable cible) puis `resolveModalSpec.ts:57-168` (`specToConfig` = le pont des 2 voies). Ensuite lire CÔTE À CÔTE les 2 `schema.ts` costum (toute la divergence vit dans les DONNÉES) + leurs 2 `fns.ts`. Tout `fichier:ligne` ci-dessous.

### 1. Shape `EntityModalSpec` — données + clés, AUCUNE closure

`entityModalSpec.ts:77-129`. Tout champ est soit une DONNÉE (chrome/i18n inline/drapeaux), soit une CLÉ string de registre. Sous-shapes :

| bloc | champ | type | rôle | def |
|---|---|---|---|---|
| identité | `id` / `descriptor` / `descriptorVariant` | string / `DescriptorRef` / clé | id table runtime ; `{ref}`\|`{config}` ; variante runtime | `:78-80` |
| chrome | `title`/`description`/`submitLabel`/`icon`/`gradientHeader`/`dialogClassName`/`validationFailedKey`/`navText` | `I18n` (clé OU `{fr,en}`) | libellés modale + wizard | `:84-97` |
| read | `defaults.base` | clé → `defaultsRegistry` | socle scope-aware ; absent → `buildConfigDefaults` | `:101` |
| image | `image.{field,existingUrlFrom}` | string / clé | champ File + clé URL existante | `:104` |
| selects | `listsFromCarrier` | bool | lists du carrier | `:107` |
| scope | `scope.{slugFrom,slugKey,constant,derive,defaults}` | enum/string/clé/data | provenance slug costum + clé `scopeRegistry` + defaults de config | `:114` |
| slots | `slots` | `Record<id, clé>` | id slot → clé `slotRegistry` | `:117` |
| validation | `schemaFn` | clé → `schemaRegistry` | zod externe ; sinon zod auto | `:120` |
| write | `mutation` (`SpecMutation`) | data + clés | cf. ci-dessous | `:123` |
| effets | `afterSubmit` / `cleanValues` | clé / `FnRef` | post-submit / nettoyage | `:126-128` |

`SpecMutation` (`:60-74`) : `entityType`, `payloadFn?` (ABSENT → pipeline `buildPipelinePayload`), `payloadEmitEmptyOnEdit?`, `inject` (`SpecInject` `:44-58` : `role`/`parent`/`organizerFallback`/`dropEmptyEmail`/`extraFields`/`extraFieldsFromScope`), `successKey`/`errorKey`/`errorContext` en `ByMode<string>` (`:41`), `invalidateFn` en `FnRef` (`:38` : `string` OU `{fn,params}`).

### 2. `specToConfig` — le résolveur (compile spec → config)

`resolveModalSpec.ts:57-168`. Transforme chaque CLÉ en closure dispatchant vers `specRegistries`. Points clés :
- `resolveDescriptor` `:59-66` : variante > `{config}` embarquée > `getDescriptor(ref)`.
- `baseDefaults` `:69-75` : `getDefaultsFn(base)` sinon `buildConfigDefaults(descriptor)`.
- `buildPayload` `:82-85` : `getPayloadFn(payloadFn)` SINON `buildPipelinePayload(..., {emitEmpty: edit && payloadEmitEmptyOnEdit})` — **le défaut générique**.
- `resolveCostumSlug` `:43-55` : `constant` | `carrier` (slug du porteur) | `derived` (`scope[slugKey]`).
- `resolveExtraFields` `:34-40` : `inject.extraFields` ∪ `extraFieldsFromScope` (stamp depuis scope au CREATE).
- édition : `inject`/`costumSlug` forcés `undefined` (`:92,94`) ; defaults via `buildPipelineDefaults` (`:148`).

### 3. Les 2 VOIES vers `EntityFormModal`

`EntityFormModal.tsx:76-88` accepte `config?` OU `spec?` ; `useMemo(() => configProp ?? specToConfig(spec))` `:88`.

| | VOIE COSTUM (cible) | VOIE STANDARD (transitoire) |
|---|---|---|
| forme | `EntityModalSpec` (données + clés) | `EntityModalConfig` (closures live) |
| source | `schema.ts` → `compileCostumSchema` → `{descriptor,spec}` (`compileCostumSchema.ts:169`) | objet TS écrit à la main (`configs/addStandard.tsx`, `configs/editProfile.tsx`) |
| enregistrement | `registerCostumForm(schema)` `costumFormRegistry.ts:21-34` (compile + garde clés + table `id`) | aucun — importé directement par les ModalRegistry |
| payload | clé `payloadFn` OU pipeline auto | closure `buildPayload: (d) => buildPayload({descriptor}, d)` INLINE |
| code irréductible | par CLÉ string → `specRegistries` | closures capturant le runtime directement |
| chargement runtime | `registerCostumForms.ts:17-28` lit `window.__CONFIG__.costumForms` (« config fait foi », plus de TS hardcodé) | imports statiques |

Les `<costum>/spec.ts` (`tiers-lieux/spec.ts:16`, `equipements-sportifs/spec.ts:17`) n'appellent `registerCostumForm` QUE pour les tests désormais (`registerCostumForms.ts:7-8`).

### 4. Les 2 `fns.ts` costum CÔTE À CÔTE (nom de fonction → rôle)

| rôle | tiers-lieux (`tiers-lieux/fns.ts`) | equipements-sportifs (`equipements-sportifs/fns.ts`) |
|---|---|---|
| type form | `interface TiersLieuxFormData` `:25-62` | (aucun — interface scope seulement) |
| scope (interface) | `interface CostumConfig` (mainTag/compagnon) `:83-91` | `PoiEquipementScope` + `PoiEquipementScopeDefaults` `:30-41` |
| scope (résolveur) | inline `registerScopeFn("tl:scope", carrier => ({slug}))` `:226` | `resolvePoiEquipementScope(entity, defaults)` `:48-55` → `registerScopeFn("poi:scope")` `:78-83` |
| defaults | `getDefaultTiersLieuxValues()` HAND-WRITTEN `:66-76` → `registerDefaultsFn("tl:emptyDefaults")` `:224` | `createEmptyDefaults(scope, descriptor)` DÉRIVÉ via `seedEntity(descriptor,null)` `:66-69` → `registerDefaultsFn("poi:emptyDefaults")` `:84-90` |
| socle adresse | (inclus dans defaults hand-written) | `POI_ADDRESS_BASE(scope)` `:59-60` |
| read (seed) | `mapEntityToTiersLieuxValues(entity, descriptor)` via `seedEntity` `:143-145` | `seedEntity` direct dans `createEmptyDefaults` |
| payload | `buildTiersLieuxPayload(data, descriptor, options)` `:177-213` (merge tags + complete) → `registerPayloadFn("tl:payload")` `:229-239` | **AUCUN** — pipeline générique (commentaire `fns.ts:5,76-77`) |
| transforms propres | `tl:video0`/`tl:numOrUndef`/`tl:videoWrite` `:112,124,125` | **AUCUN** propre (`address:*`/`geo:*` communs) |
| options dynamiques | `registerOptions("tl:years", ...)` `:220-223` | (aucune) |
| slots | (aucun) | `registerSlot("parentInfo")` + `registerSlot("poiDoublons")` `:91-92` |
| cleanValues | (aucun) | clé générique `cleanValues:dropEmptyArrayItems` (schema `:152`) |

### 5. Verbes de fns par rôle (registres `specRegistries.ts:27-154`)

`register*`/`get*` appairés pour 10 registres : `Descriptor`, `DescriptorVariant`, `DefaultsFn`, `PayloadFn`, `ScopeFn`, `Slot`, `SchemaFn`, `ExistingUrlFn`, `AfterSubmitFn`, `CleanValuesFn`, `InvalidateFn`. Verbes domaine : `build*` (payload/defaults pipeline), `resolve*` (scope/descriptor/slug), `seed*` (read entity→form), `map*` (read alias tiers-lieu), `get*` (lecture registre + default tiers-lieu), `create*` (defaults poi). `compileCostumSchema` : `buildField`/`buildDescriptor`/`buildSpec`/`compile*`.


---

# 5. Formalisme canonique recommandé

Toutes les références de chemin sont relatives à `/home/djabatav/meteor/communecter/cocolight/site-json/`.

---

### 0. Principe directeur : 2 couches, 2 espaces de registres

| Couche | Source de vérité | Registres | Fichier |
|---|---|---|---|
| **MOTEUR (leaf, générique)** | descripteur déclaratif | `transform` / `validate` / `options` / `compute` (+ `widget`) | `src/modules/formEngine/engine/transforms.ts`, `widgets/registry.tsx` |
| **DOMAINE (profil, impur)** | clé string dans la spec | `descriptor` / `descriptorVariant` / `defaultsFn` / `payloadFn` / `scopeFn` / `slot` / `schemaFn` / `existingUrlFn` / `afterSubmitFn` / `cleanValuesFn` / `invalidateFn` | `src/modules/profil/forms/specRegistries.ts` |

Le moteur ne connaît QUE le générique ; le domaine injecte widgets + transforms + specFns par side-effect. **À conserver tel quel.** Toute clé est résolue au runtime, jamais une closure dans la config.

---

### 1. Nommage des CLÉS de registre

#### Règle 1 — Préfixe par CONCEPT, jamais par MODULE (tranche)

**On préfixe par CONCEPT (`address:`, `social:`, `openingHours:`, `geo:`, `monthYear:`, `enumOrOther:`, `multiCsv:`, `image:`, `invalidate:`, `cleanValues:`) et non par module (`tl:`, `poi:`, `pf:`).**

Justification : le refactor a DÉJÀ prouvé la direction en fusionnant `poi:addressRead` + `tl:addressRead` → `address:read` (`sharedCodecs.ts:23`). Un préfixe-module signale « propriété d'une entité » alors que ces fns sont partageables ; il crée la dette de duplication que le refactor élimine. Le préfixe-concept rend l'intention réutilisable explicite. Le costum `equipements-sportifs` est déjà à zéro clé propre — c'est la cible de tous.

**Exception assumée (à documenter, pas à supprimer) :** une forme cible RÉELLEMENT différente (widget distinct) garde un namespace, mais nommé par CONCEPT + VARIANTE, pas par module. Le profil (`pf:*`) utilise un widget objet-14-champs / grille-9-social / horaires distincts → légitime, mais à renommer en variante de concept.

#### Règle 2 — `<concept>:read` / `<concept>:write` par paire ; coercion = `coerce:*` ; le NOM expose la nuance

Les coercions génériques restent `coerce:*`. **Mais quand deux coercions diffèrent subtilement, le nom doit le dire** (sinon mésusage byte). Mapping :

| Nom actuel | Nom canonique | Raison |
|---|---|---|
| `coerce:pickString` | `coerce:stringStrict` | ne stringifie PAS les nombres (≠ `coerce:string`) |
| `coerce:truthy` | `coerce:boolLoose` | `Boolean(v)` simple (≠ `coerce:bool` qui lit `"true"/"oui"/1`) |
| `coerce:dateYMD` | `coerce:dateYMDlocale` | date-fns locale-aware |
| `coerce:dateYMDfromISO` | `coerce:dateYMDutc` | UTC pur `.split("T")[0]` |
| `coerce:orEmpty` / `coerce:orUndef` | **inchangés** | le suffixe dit déjà la sortie |

#### Règle 3 — TOUTE clé sans préfixe doit en recevoir un (validators, slots, compute)

Aujourd'hui les validators (`addressValid`…) et les slots (`parentInfo`…) sont SANS préfixe ; ils cohabitent avec les concepts préfixés. Et `compute` partage le type `TransformName` avec les transforms (collision de namespace possible).

| Nom actuel | Registre | Nom canonique |
|---|---|---|
| `addressValid` | validate | `validate:address` |
| `addressComplete` | validate | `validate:addressComplete` (variante stricte) |
| `eventDatesValid` / `editEventValid` / `addEventValid` | validate | `validate:eventDates` / `validate:eventEdit` / `validate:eventAdd` |
| `parentInfo` / `poiDoublons` / `organizerInfo` | slot | `slot:parentInfo` / `slot:poiDoublons` / `slot:organizerInfo` |
| `multiply` | compute | `compute:multiply` (isole du namespace transform) |

#### Règle 4 — clés métier résiduelles à migrer vers le commun

| Nom actuel | Nom canonique | Statut |
|---|---|---|
| `tl:numOrUndef` | `coerce:numOrUndef` | migrer (générique, pattern répandu) |
| `tl:video0` / `tl:videoWrite` | `firstOf:read` / `wrapArray:write` (paramétrés) | migrer (array↔scalaire réutilisable) |
| `tl:years` | `options:yearsDesc` | renommer (options dynamiques légitimes, mais axe-concept) |
| `tl:emptyDefaults` | **à supprimer** | dériver via `seedEntity(descriptor,null)` comme `poi:emptyDefaults` |
| `tl:payload` | **réduire au merge-tags** → `payload:mergeTags` paramétré | le create/edit délégué au pipeline (`payloadEmitEmptyOnEdit:true`) |
| `tl:scope` | `scope:carrier` (forme `{sourceKey,parentId}`) | uniformiser avec `poi:scope`, slugKey `sourceKey`, retirer le fallback `getSlug()` |
| `pf:addressRead`/`pf:socialRead`/`pf:openingHours` | `address:readFlat` / `social:readGrid` / `openingHours:readGrid` | axe-concept + variante de forme |
| `pf:rdRefOrUndef`/`pf:rdPublic`/`pf:rdOrganizer`/`pf:rdOpeningHours` | `pf:parentRead`/`pf:publicRead`/`pf:organizerRead`/`pf:openingHoursRead` | éliminer l'abréviation `rd`, suffixe `Read` (déjà la convention du fichier) |

---

### 2. Nommage des FONCTIONS dans `fns.ts` (verbes normalisés par RÔLE)

| Rôle | Verbe canonique | Suffixe d'enregistrement | Exemple |
|---|---|---|---|
| codec read (champ/groupe) | clé `<concept>:read` enregistrée via `registerTransform` | — | `address:read` |
| codec write | clé `<concept>:write` via `registerTransform` | — | `address:write` |
| validateur cross-champ | `register*` → clé `validate:*` | const `*Valid` | `validate:address` |
| options dynamiques | `registerOptions` → clé `options:*` | — | `options:yearsDesc` |
| scope costum | `registerScopeFn` → clé `scope:*` ; fn `resolve*Scope` | `*Fn` | `resolvePoiEquipementScope` |
| defaults | `registerDefaultsFn` → clé `*:emptyDefaults` ; fn `createEmptyDefaults` | `*Fn` | `createEmptyDefaults` |
| payload | `registerPayloadFn` → clé `*:payload` ; fn `build*Payload` | `*Fn` | (réservé à l'irréductible) |
| slot UI | `registerSlot` → clé `slot:*` | (sans suffixe) | `slot:parentInfo` |
| invalidate | `registerInvalidateFn` → clé `invalidate:*` | `*Fn` | `invalidate:standard` |
| cleanValues | `registerCleanValuesFn` → clé `cleanValues:*` | `*Fn` | `cleanValues:dropEmptyArrayItems` |
| existingUrl image | `registerExistingUrlFn` → clé `image:*` | `*Fn` | `image:profilUrl` |

**Décision de cohérence du suffixe `Fn` :** harmoniser. `transforms.ts` n'a PAS de suffixe (`registerTransform`/`registerCompute`/`registerOptions`/`registerValidate`) ; `specRegistries.ts` en a un (`registerPayloadFn`…) SAUF `registerDescriptor`/`registerDescriptorVariant`/`registerSlot` — incohérent même en interne. **Canon : suffixe `Fn` pour tous les enregistreurs de FONCTIONS de domaine** (`specRegistries`) ; **pas de suffixe pour les enregistreurs du moteur** (`transforms`), car ce sont des primitives génériques. Donc renommer `registerSlot`→`registerSlotFn`, `registerDescriptor`→reste (enregistre une DONNÉE descripteur, pas une fn — légitime sans `Fn`).

**Verbes par phase (à conserver) :** `register*`/`get*`/`has*` (registre) · `build*` (construction pipeline) · `resolve*` (résolution runtime) · `seed*` (entité→valeurs) · `map*` (alias read) · `create*` (socle defaults) · `coerce*`/`pick*` (coercition cellule).

**`has*` silencieux / `get*` warne (à conserver et compléter) :** `get*` émet `console.warn` si clé absente ; `has*` est muet (gardes). **Lacune à combler : ajouter `hasWidget(kind)`** dans `widgets/registry.tsx` et l'inclure dans `assertCostumKeysRegistered` (aujourd'hui `getWidget` retombe silencieusement sur `text`).

---

### 3. Nommage FICHIERS / DOSSIERS / VARIABLES

#### Dossier costum = QUINTET par entité (à conserver)
`src/modules/profil/forms/costum/<id>/` avec `{schema.ts, spec.ts, descriptor.ts, fns.ts, *.test.ts}`. `id` du dossier == `EntityModalSpec.id` == `FormDescriptor.id` == clé table runtime. `schema.ts` = SOURCE FUSIONNÉE ; `descriptor.ts`/`spec.ts` ne DÉRIVENT que via `compileCostumSchema` ; `fns.ts` = clés seules (leaf, pas d'import de `descriptor.ts`/`schema.ts`).

#### Deux identifiants distincts (à conserver, à documenter)
- `id` = **slug-case** (`tiers-lieux`, `equipements-sportifs`) — clé technique.
- `costumSlug` = **camelCase legacy** (`navigatorDesTierslieux`, `equipementsSportifs974`) — fil legacy.

#### Variables (à conserver)
`*Schema` (document fusionné) · `*Spec` (EntityModalSpec compilée) · `*Descriptor` (FormDescriptor compilé) · `*Config` (EntityModalConfig, voie standard transitoire) · `*FormData` (type des valeurs).

#### Helper bilingue `L(fr,en)` (à conserver, factorisable)
Redéclaré dans chaque `schema.ts`. Acceptable (leaf, 1 ligne) ; OU exporter un `L` commun depuis `compileCostumSchema`. Préservé jusqu'au rendu (`PRESERVE_LABELS`).

#### Helper « champ caché pipeline-only » (à UNIFIER)
3 variantes : `hidden(name,extra)` (addPoi, `label:''`), `f(name,read,write,type,extra)` (editProfilePayload, `label:name`), `WIDGET_DEFAULTS.hidden` (costums). **Canon : un seul helper exporté** (proposer `f` de `editProfilePayload.ts:98`), réutilisé par addPoi ; les costums restent sur `compileCostumSchema`. Trancher `label:''` vs `label:name` (impact byte nul tant que non rendu — documenter).

#### Ancres composites (à UNIFIER)
Tout widget composite (`location`/`image`/`editSocial`/`editSchedule`) **doit être `renderOnly:true`** (comme `WIDGET_DEFAULTS.location/image` et le profil `_location`). Aujourd'hui `addressField` (`addCommon.ts:34`) n'est PAS `renderOnly` et ne « marche » que par l'ordre des loops dans `valuesToPayload` (groupe écrit après le champ → écrasement). **À corriger.**

#### i18n (à conserver)
`PE(k)=ProfileEdit.fields.${k}`, `TAB(k)=ProfileEdit.tabs.${k}`, `AddEntity.tabs.*` ; `L(fr,en)` inline pour les costums.

---

### 4. Conventions de DONNÉES de spec à uniformiser

- **defaults :** dérivation par défaut (`seedEntity(descriptor,null)`). `deriveDefaults:false` + socle hand-written = anti-pattern (tiers-lieu). Un défaut non-vide se pose en `field.default` (single-source), jamais en socle parallèle.
- **scope :** forme minimale homogène `{sourceKey, parentId}` dérivés du carrier ; constantes de domaine en `scope.defaults` uniquement ; `slugKey` = `sourceKey` partout ; pas de fallback en dur.
- **STAMP create :** `extraFieldsFromScope` SI la valeur existe dans `scope.defaults` (cas `poi` = bon) ; `extraFields` pour les littéraux sans scope (cas `tiers-lieu` `{type:'NGO'}` = acceptable). Documenter la règle au-dessus de `SpecInject` (`entityModalSpec.ts:44`).
- **`inject.parent` interdit si `entityType==='organizations'`** (parité legacy : pas de parent) — à câbler dans la garde zod ou `compileCostumSchema`.
- **`ByMode<T>`** pour tout ce qui diffère add/edit (`successKey`/`errorKey`/`errorContext`), résolu par `pickMode` — à conserver.
- **Voie cible unique :** migrer les 4 configs standard (`configs/addStandard.tsx`) + `editProfile.tsx` en `EntityModalSpec` sérialisables (payload via pipeline, `invalidate:standard` paramétré) → supprimer `configs/*.tsx` et les `invalidateQueries` inline. Objectif annoncé dans `EntityFormModal.tsx` (« config transitoire OU spec cible »).

---

### 5. API à purger (mensonges du descripteur)

`types.ts:82-83` interdit de déclarer une clé non implémentée. Or :
- **`atomicGroup`** : déclaré (`types.ts:95`), validé zod (`config/schema.ts:87`), round-trippé (`configToDescriptor.ts:72`, `formDescriptorToConfig.ts:47`), listé dans `PIPELINE_KEYS` (`mergeRenderPipeline.ts:23`), testé (`fieldPipeline.test.ts:32`) — mais **JAMAIS lu** par `seedFromEntity`/`valuesToPayload`. Prop morte.
- **`diffForEdit` / `buildDelta`** : cités par `entityForm.ts:6`, `fieldPipeline.ts:4,7`, `types.ts:90,94`, `tiers-lieux/fns.ts:122` — **0 implémentation** (migration vers `buildEditPayload`+`emitEmpty`).

**Canon : soit câbler réellement le diff atomique dans `valuesToPayload`, soit retirer `atomicGroup` + ses round-trips et corriger tous les JSDoc citant `diffForEdit`/`buildDelta`.** Le diff étant délégué au SDK (`emitEmpty`+`save()`), la suppression est recommandée.

- **`applyTransform(name,value,all,params?)`** : le 4e arg `params` n'est alimenté QUE par `serializeGroups` (`fieldPipeline.ts:49,103`) ; les champs simples (`:56,88`) passent toujours `params=undefined`. Documenter explicitement « `params` réservé aux groupes » dans `transforms.ts:28` (ou ajouter `field.params` si besoin réel).


---

# 6. Incohérences inter-fichiers (classées par impact)


## #1 — ✅ FAIT (commit a2ed2c1) — API morte / mensonge du descripteur : `atomicGroup` est déclaré + validé zod + round-trippé config + listé dans PIPELINE_KEYS mais AUCUNE fn moteur ne le lit ; les JSDoc renvoient à `diffForEdit`/`buildDelta` qui N'EXISTENT PLUS (migration vers buildEditPayload+emitEmpty). Viole types.ts:82-83 qui interdit de déclarer une clé non implémentée.

- **Impact / effort** : Risque de bug ÉLEVÉ + frein à l'ajout d'entité : un mainteneur câble `atomicGroup` sur un groupe d'adresse en croyant qu'il protège du diff lossy → no-op silencieux, écrasement de level1..4/codeInsee. Les commentaires mentent sur le contrat d'effacement. — *(effort M)*

- **Fichiers** : `src/modules/formEngine/types.ts:90,94-95 ; src/modules/formEngine/config/schema.ts:87 ; src/modules/formEngine/config/configToDescriptor.ts:72 ; src/modules/formEngine/config/formDescriptorToConfig.ts:47 ; src/modules/formEngine/config/mergeRenderPipeline.ts:23 ; src/modules/formEngine/engine/fieldPipeline.ts:4,7 ; src/modules/formEngine/engine/entityForm.ts:6`

- **Forme canonique** : Retirer `atomicGroup` + ses 4 round-trips config et corriger tous les JSDoc citant diffForEdit/buildDelta (le diff est délégué au SDK via emitEmpty). OU câbler un vrai diff atomique dans valuesToPayload.


## #2 — ✅ FAIT (commit 064c5f8) — widgetRegistry sans `has*` ni warn : getWidget(kind) retombe TOUJOURS sur `registry.text` (registry.tsx:137) sans aucun avertissement, et assertCostumKeysRegistered ne vérifie JAMAIS field.widget faute de hasWidget. Un widget non injecté (ex. `tags`/`location` si le module profil n'est pas importé) rend un input texte muet. → hasWidget + warn + check au load + parade d'ordre (sharedRegistrations importe registerWidgets).

- **Impact / effort** : Risque de bug ÉLEVÉ et silencieux : un costum qui référence un widget non enregistré passe toute la garde et rend un champ texte au lieu du composite → adresse/horaires/image cassés sans erreur. Asymétrie avec les 4 autres registres (tous ont hasRegistered/hasSpecFn). — *(effort S)*

- **Fichiers** : `src/modules/formEngine/widgets/registry.tsx:136-138 ; src/modules/profil/forms/costum/assertKeysRegistered.ts:40-50`

- **Forme canonique** : Ajouter hasWidget(kind) dans widgets/registry.tsx, l'appeler dans assertCostumKeysRegistered (boucle sur field.widget), et émettre un console.warn dans getWidget quand on retombe sur le fallback `text`.


## #3 — ⏳ PARTIEL (commit a757741) : tl:numOrUndef → coerce:numOrUndef fait. RESTE : tl:video0/videoWrite (génériser = refactor sémantique), tl:years (options propre TL), pf:* (interne profil, hors vocabulaire config). — Préfixe par MODULE (`pf:`, `tl:`, `poi:`) vs par CONCEPT (`address:`, `social:`, `openingHours:`) pour le MÊME concept — axe de nommage non résolu. Le refactor a fusionné poi:addressRead + tl:addressRead → address:read mais N'A PAS inclus le profil (pf:addressRead/pf:socialRead/pf:openingHours), et tiers-lieu garde encore tl:video0/numOrUndef/videoWrite/years.

- **Impact / effort** : Confusion forte + frein à l'ajout d'entité : un nouveau costum ne sait pas s'il doit créer `xx:foo` ou réutiliser `foo:read` ; la migration partielle laisse 2 conventions concurrentes. pf:rd* (abréviation 'rd') ajoute une 3e convention DANS le même fichier que pf:addressRead. — *(effort L)*

- **Fichiers** : `src/modules/profil/forms/editProfilePayload.ts:79,83,89-92 ; src/modules/profil/forms/costum/sharedCodecs.ts:23,27,127,94 ; src/modules/profil/forms/costum/tiers-lieux/fns.ts:112,124-125,220-223`

- **Forme canonique** : Trancher : préfixe par CONCEPT partout. Renommer pf:addressRead→address:readFlat, pf:socialRead→social:readGrid, pf:rdPublic→pf:publicRead (suffixe Read). Migrer tl:numOrUndef→coerce:numOrUndef, tl:video0/videoWrite→firstOf:read/wrapArray:write, tl:years→options:yearsDesc. Cible : tiers-lieu à zéro clé propre comme equipements.


## #4 — ✅ FAIT (commit b899ce0) — Ancre composite `addressField` NON marquée `renderOnly` (addCommon.ts:34) contrairement à la convention costum (WIDGET_DEFAULTS.location renderOnly) et profil (_location). Traitée comme un vrai champ read/write par le moteur ; ne « marche » qu'en s'appuyant sur l'ordre des loops dans valuesToPayload (groupe address écrit APRÈS le champ → écrase payload['address']).

- **Impact / effort** : Risque de bug FRAGILE : au READ, seedFromEntity charge serverData['address'] dans values['address'] que le widget location ne consomme jamais ; au WRITE, dépend de l'ordre champs-puis-groupes. Un refactor de l'ordre des loops casserait l'adresse de tous les POI standard. — *(effort S)*

- **Fichiers** : `src/modules/profil/forms/addCommon.ts:34-36 ; src/modules/profil/forms/addPoi.descriptor.ts:34 ; src/modules/formEngine/engine/fieldPipeline.ts:84-110`

- **Forme canonique** : Marquer addressField (addCommon.ts:34) `renderOnly: true` — l'écriture passe déjà 100% par les membres hidden(group:'address') + serializeGroups. Aligne addPoi sur costum/profil et supprime la dépendance à l'ordre des loops.


## #5 — Deux voies de DÉFINITION : costum (EntityModalSpec data+clés, sérialisable JSON) vs standard (configs/*.tsx closures). ⚠️ DIVERGENCE PAR CONCEPTION, **PAS une dette à unifier** (corrigé 2026-06-26 après retour user).

- **Re-classement (NE PAS « unifier »)** : costum et standard sont **2 choses différentes par nature**. Le **costum** est défini **par déploiement** → sa config DOIT être de la **donnée** (JSON `config.costumForms`, ajout sans toucher au code). Le **standard** (poi/projet/org/event/citoyen) est une entité **cœur, fixe** → la définir en **code** (closures) est légitime. Forcer le standard dans `EntityModalSpec`/JSON serait FAUX (il n'a pas à être de la donnée par déploiement). La divergence data-vs-code est **en amont** (comment on écrit la config) et justifiée.

- **Ce qui EST (et doit rester) mutualisé** : la machinerie générique — `EntityFormModal`, le pipeline `seedEntity`/`buildPayload`, les registres, le format `FormDescriptor`. Les 2 voies **convergent** sur le même `EntityModalConfig` au point de consommation (`EntityFormModal.tsx:88` `configProp ?? specToConfig(spec)`). Mutualisation correcte ; rien à fusionner de plus.

- **Reste éventuellement à surveiller (mineur, PAS l'objet du #5)** : cohérence INTERNE du style standard (closures homogènes), et le fait que les configs standard ne profitent pas du round-trip/gardes config — mais c'est un choix, pas une incohérence. Effort : **aucun** (ne rien faire).

- **Fichiers** : `src/modules/profil/forms/configs/addStandard.tsx:21-121 ; src/modules/profil/forms/configs/editProfile.tsx ; src/modules/profil/forms/resolveModalSpec.ts:82-106 ; src/modules/profil/forms/EntityFormModal.tsx:88`

- **Forme canonique** : Migrer addPoi/addProject/addOrganization/addEvent + editProfile en EntityModalSpec : descripteur via MERGED_*, payload via pipeline (payloadFn omis + payloadEmitEmptyOnEdit), invalidate via clé invalidate:standard paramétrée. Supprimer configs/*.tsx.


## #6 — Stratégies de defaults OPPOSÉES entre costums : equipements DÉRIVE les defaults du descripteur (deriveDefaults absent → seedEntity(descriptor,null)) ; tiers-lieu les SUPPRIME tous (deriveDefaults:false) et re-liste 23 champs à la main dans getDefaultTiersLieuxValues / tl:emptyDefaults.

- **Impact / effort** : Confusion + dette : deux modèles mentaux pour le même besoin ; le socle hand-written de tiers-lieu se désynchronise du schéma si un champ est ajouté/retiré (pas de single-source). — *(effort M)*

- **Fichiers** : `src/modules/profil/forms/costum/tiers-lieux/schema.ts:66 ; src/modules/profil/forms/costum/tiers-lieux/fns.ts:66-76,224 ; src/modules/profil/forms/costum/equipements-sportifs/fns.ts:62-69 ; src/modules/formEngine/config/../compileCostumSchema.ts:116,125`

- **Forme canonique** : Retirer deriveDefaults:false + getDefaultTiersLieuxValues/tl:emptyDefaults ; dériver via seedEntity(descriptor,null) + socle minimal (hours via WIDGET_DEFAULTS), comme equipements. Tout défaut non-vide → field.default dans schema.fields.


## #7 — payloadFn CUSTOM (tl:payload) pour tiers-lieu qui duplique partiellement la logique pipeline (merge tags + complete/edit) alors qu'equipements n'a AUCUN payloadFn (pipeline pur via payloadEmitEmptyOnEdit). Le même besoin est traité par deux chemins ; tiers-lieu a même déjà payloadEmitEmptyOnEdit:true marqué 'informatif' car tl:payload court-circuite le pipeline.

- **Impact / effort** : Frein à l'ajout d'entité + risque de drift : tl:payload réimplémente le mode create/edit que le résolveur sait déjà faire ; seul le merge tags (mainTag/compagnon→tags) est irréductible. — *(effort M)*

- **Fichiers** : `src/modules/profil/forms/costum/tiers-lieux/schema.ts:174-175 ; src/modules/profil/forms/costum/tiers-lieux/fns.ts:177-213,229-239 ; src/modules/profil/forms/costum/equipements-sportifs/schema.ts:155 ; src/modules/profil/forms/resolveModalSpec.ts:82-85`

- **Forme canonique** : Réduire tl:payload au merge tags via une clé générique paramétrée (payload:mergeTags) ; déléguer create/edit/emitEmpty au pipeline (payloadEmitEmptyOnEdit:true), supprimer le payloadFn custom — comme equipements.


## #8 — ✅ FAIT (commit 92696d3 : register*Fn) — Nommage des enregistreurs INCOHÉRENT entre/dans les fichiers : transforms.ts sans suffixe (registerTransform/Compute/Options/Validate) ; specRegistries.ts avec suffixe Fn (registerPayloadFn/ScopeFn/...) SAUF registerDescriptor/registerDescriptorVariant/registerSlot. Le compute partage le type TransformName avec les transforms (2 Maps distinctes, pas de namespace).

- **Impact / effort** : Confusion + risque de collision silencieuse : un champ peut déclarer computedFrom.fn:'multiply' (compute) et read:'multiply' (transform) résolus sur 2 fns différentes (GenericForm.tsx:95 appelle getCompute, le pipeline appelle getTransform). Aucun préfixe ne sépare les familles. — *(effort M)*

- **Fichiers** : `src/modules/formEngine/types.ts:47-48,86 ; src/modules/formEngine/engine/transforms.ts:20,57,79,91,98 ; src/modules/profil/forms/specRegistries.ts:27,39,63,87 ; src/modules/formEngine/components/GenericForm.tsx:95`

- **Forme canonique** : Suffixe Fn pour tous les enregistreurs de FONCTIONS de domaine (registerSlot→registerSlotFn) ; pas de suffixe pour les primitives du moteur. Préfixer les clés compute (compute:multiply) et typer computedFrom.fn par un ComputeName distinct de TransformName.


## #9 — ✅ FAIT (commit ab3892a) — Coercions à noms quasi-interchangeables masquant des différences byte RÉELLES : coerce:string vs coerce:pickString (ne stringifie pas les nombres), coerce:bool vs coerce:truthy, coerce:dateYMD (locale) vs coerce:dateYMDfromISO (UTC). Les commentaires documentent la nuance, pas les noms.

- **Impact / effort** : Risque de bug byte SUBTIL : choisir coerce:string là où coerce:pickString est requis (ou inversement) casse la parité byte sans erreur visible. Frein à l'ajout : il faut lire le code source de chaque coerce pour choisir. — *(effort S)*

- **Fichiers** : `src/modules/formEngine/engine/coercions.ts:15,34,49,59,62,65,71,78,81-92`

- **Forme canonique** : Renommer pour exposer la nuance : coerce:pickString→coerce:stringStrict ; coerce:truthy→coerce:boolLoose ; coerce:dateYMD→coerce:dateYMDlocale ; coerce:dateYMDfromISO→coerce:dateYMDutc. orEmpty/orUndef restent (suffixe explicite).


## #10 — ✅ FAIT (commits ed60c19 validate: / 7d6a7bd slot:+compute:) — Clés sans préfixe mélangeant validators (verbe-Valid, registre validate) et slots React (nom, registre slot). Concept 'image' modélisé en specFn (image:profilUrl, registre existingUrlFn) alors que les autres codecs read sont des transforms — le préfixe image: suggère un codec de champ co-localisé avec address:/social: mais le registre diffère.

- **Impact / effort** : Confusion de lecture : impossible de distinguer addressValid (validator) de parentInfo (slot) ou image:profilUrl (existingUrl) du call-site sans connaître le registre cible. Incohérence d'axe alors que tous les autres concepts sont préfixés. — *(effort M)*

- **Fichiers** : `src/modules/profil/forms/validators.ts:64-68 ; src/modules/profil/forms/costum/equipements-sportifs/fns.ts:91-92 ; src/modules/profil/forms/costum/sharedFns.ts:12 ; src/modules/profil/forms/costum/sharedCodecs.ts:27,127`

- **Forme canonique** : Préfixer validators (validate:address/validate:eventDates) et slots (slot:parentInfo/slot:poiDoublons). Documenter que image: relève du cycle de modale (existingUrlFn) et non du codec de champ — ou exposer image:read comme transform si l'URL est une valeur de form.


## #11 — Forme de scope à deux niveaux de richesse : equipements a un scope structuré (parentId/sourceKey/poiType/addressCountry, slugKey 'sourceKey', defaults) ; tiers-lieu a un scope minimal ({slug}, slugKey 'slug', pas de defaults) AVEC un fallback getSlug() que poi:scope a explicitement supprimé.

- **Impact / effort** : Confusion + frein : le contrat scope n'est pas homogène ; un nouveau costum ne sait pas quelle forme produire. Le fallback getSlug() de tl:scope est un anti-pattern (ré-injecte un slug en dur) que poi a déjà retiré. — *(effort M)*

- **Fichiers** : `src/modules/profil/forms/costum/equipements-sportifs/schema.ts:146-149 ; src/modules/profil/forms/costum/tiers-lieux/schema.ts:170 ; src/modules/profil/forms/costum/equipements-sportifs/fns.ts:48-55,78-83 ; src/modules/profil/forms/costum/tiers-lieux/fns.ts:226`

- **Forme canonique** : Forme de scope minimale homogène : {sourceKey, parentId} dérivés du carrier (carrierSlug + carrier.id), constantes de domaine en scope.defaults uniquement, slugKey 'sourceKey' partout, abandonner le fallback getSlug().


## #12 — Helper 'champ caché pipeline-only' redupliqué 3× avec défauts divergents : addPoi `hidden(name,extra)` (label:''), editProfilePayload `f(name,read,write,type,extra)` (label:name), costums via WIDGET_DEFAULTS.hidden. Même intention, 3 implémentations.

- **Impact / effort** : Confusion mineure + risque byte : label='' (addPoi) vs label=name (editProfilePayload) diffèrent — impact si jamais rendu. Duplication de code. — *(effort S)*

- **Fichiers** : `src/modules/profil/forms/addPoi.descriptor.ts:23-24 ; src/modules/profil/forms/editProfilePayload.ts:98-107 ; src/modules/profil/forms/costum/compileCostumSchema.ts:98,105-122`

- **Forme canonique** : Exposer un seul helper de champ caché (exporter `f` de editProfilePayload.ts:98) réutilisé par addPoi ; les costums restent sur compileCostumSchema. Documenter/aligner le défaut de label.


## #13 — Validation du même besoin (adresse) portée par des clés/mécanismes différents selon le descripteur : addressValid (poi/project/org add), addressComplete (tiers-lieu), absente en édition profil (déléguée au schema externe greffé dans GenericForm). inject.parent/organizerFallback non gardés vs entityType (un costum organizations qui poserait parent:true passerait la garde).

- **Impact / effort** : Confusion + risque de parité : trois mécanismes pour des règles d'adresse voisines ; pas d'assertion entityType↔inject (org sans parent en legacy). — *(effort M)*

- **Fichiers** : `src/modules/profil/forms/addCommon.ts:49-52 ; src/modules/profil/forms/validators.ts:20-23,64-65 ; src/modules/profil/forms/costum/tiers-lieux/schema.ts:69 ; src/modules/formEngine/components/GenericForm.tsx:56-68 ; src/modules/profil/forms/entityModalSpec.ts:44-58`

- **Forme canonique** : Unifier en clé canonique validate:address paramétrée par gate. Documenter validation interne (descriptor.validate) vs externe (props.schema). Ajouter une garde zod : inject.parent/organizerFallback interdits si entityType==='organizations'.


## #14 — applyTransform expose un 4e arg `params` (codecs paramétrés) mais 2 des 4 sites du pipeline ne le passent jamais : les champs simples read/write (fieldPipeline.ts:56,88) → params=undefined pour TOUT transform de champ ; seuls les groupes (:49,103) transmettent g.params. Un transform de champ ne peut donc pas être paramétré, contrairement à la signature publique.

- **Impact / effort** : Confusion mineure : la signature suggère un codec paramétré par champ, impossible en pratique (asymétrie non documentée côté champ). — *(effort S)*

- **Fichiers** : `src/modules/formEngine/engine/transforms.ts:28 ; src/modules/formEngine/engine/fieldPipeline.ts:49,56,88,103`

- **Forme canonique** : Documenter explicitement que `params` n'est alimenté que par serializeGroups dans transforms.ts:28, ou ajouter un field.params si un codec paramétré par champ devient nécessaire.
