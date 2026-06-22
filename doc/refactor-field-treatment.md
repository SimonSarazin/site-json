# Refactor — traitement des champs unifié (form engine)

> Roadmap issue de l'audit « effacement des champs » (2026-06). Objectif : sortir le quadruplet
> **READ / WRITE / diff / clear** des mappers bespoke par entité et le rendre **déclaratif** sur le
> `FieldDescriptor`, exécuté par un pipeline unique du moteur (`modules/formEngine`).

## 1. Constat — coût de la duplication

Le moteur (`GenericForm`) ne couvre aujourd'hui que **rendu + validation**. Deux crochets déclaratifs
existent mais sont **sous-exploités** : `field.read` (seeding, `GenericForm` `seededDefaults`) et
`field.write` (avant `onSubmit`, `submitWithWrites`) — ils produisent un payload **plat et complet**,
sans notion de **baseline / diff / clear / path**. Résultat : 3 familles de mappers à la main.

| Famille | READ | WRITE | diff / clear |
|---|---|---|---|
| Profil multi-entité | `useProfileFormData` (extractAddress 14 clés, extractSocial 9 clés) | `editProfilePayload.buildProfileUpdateData` (162 LOC, switch entityType) | aucun (`Object.assign` + `\|\| ""`) |
| Tiers-lieu | `tiersLieuxMapping.mapEntityToTiersLieuxValues` | `buildTiersLieuxPayload` (~140 LOC, mappings de noms inline) | **à la main** dans `useEditTiersLieu` |
| POI équipement | `poiEquipement.buildEditDefaults` (5 coercers `toX`) | `transformFormDataWithAddress` | `buildEditPatch` (diff partiel + adresse atomique) |

Symptômes :
- **~400 LOC** de mappers dupliqués ; le mapping nom-form↔serveur (`structureName→holderOrganization`,
  `family→typePlace`, `manageModel`, `socialLinks→socialNetwork`) est écrit **3× par champ**.
- `buildProfileUpdateData` est le **miroir exact** de `useProfileFormData` → toute divergence READ/WRITE = **bug silencieux**.
- `isSameValue` redéfini 2× ; logique d'adresse atomique (`ADDRESS_PATCH_KEYS`) dupliquée.
- **Bug d'effacement** : un payload qui omet les vides + un diff itérant les clés du *payload* → un champ
  vidé n'a pas de clé → jamais comparé → jamais effacé. N'existait structurellement que sur tiers-lieu
  (corrigé), mais profil/POI n'effacent que **par convention** (`\|\| ""`, itération clés form) — latent.

## 2. Couche proposée — déclaratif par champ

Étendre `FieldDescriptor` et exécuter le traitement dans un **pipeline unique** :

- **`path` câblé** (déclaré mais ignoré aujourd'hui) → READ lit `serverData[path]`, WRITE écrit `payload[path]`
  ⟹ subsume **tous** les remaps de nom, sans code.
- **`serializeGroup`** → un groupe de champs plats ↔ 1 objet serveur (subsume address 14 clés,
  socialNetwork 9 clés, openingHours). C'est le **seul vrai trou** du moteur (« unpack d'objet imbriqué »).
- **`atomicGroup`** → champs écrits/effacés **ensemble** (subsume `ADDRESS_PATCH_KEYS` + la garde `localityId`).
- **`clear`** + **`reconcile(payload, baseline)`** itérant l'**union** baseline∪payload ⟹ l'effacement devient
  un **invariant natif** (clé du baseline absente/falsy du payload → branche clear), pour **toute** entité.
- **baseline dérivé** d'un seul `valuesToPayload ∘ seedFromEntity` ⟹ fin de la classe de bugs READ/WRITE-miroir.

Transformers **métier** enregistrés en side-effect (comme `validators.ts` le prouve déjà) :
`readOpeningHours`/`writeOpeningHours`, `readTypePlace`/`writeTypePlace`, `readSocialNetwork`/`writeSocialNetwork`, …

### Sémantique du vide (non négociable)
Le SDK costum (`_saveCostumViaElementSave`) reconnaît `null` / `""` / `[]` comme effacement → envoie `""`
→ backend `prepElementData` → `$unset`. **JAMAIS `{}`** pour un objet (le backend MERGE → no-op) : un objet
vidé doit valoir `""`. La validation AJV de requête est **permissive** pour une clé effacée
(`BaseEntity.ts _saveCostumViaElementSave` : `props[key] = isClear ? {} : schémaStrict`), sinon `""` est rejeté
contre un schéma objet/array.

## 3. Phasage (gated par la parité byte-compat)

| Phase | Portée | Risque | Supprime |
|---|---|---|---|
| **P0** ✅ | Helper `reconcileClearedFields` + `isSameValue` partagés (`formEngine/engine/reconcile.ts`) ; câblé dans `useEditTiersLieu` ; dé-dup `isSameValue` (poiEquipement) | faible | boucle ad-hoc + 2× `isSameValue` |
| P1 | Étendre `FieldDescriptor` (`path` câblé, `clear`, `atomicGroup`, `serializeGroup`) + `fieldPipeline.ts` (additif, derrière flag) | moyen | rien (additif) |
| P2 | Migrer **POI équipement** (diff déjà explicite) | moyen | `buildEditDefaults`/`buildEditPatch`/coercers (~110 LOC) |
| P3 | Migrer **tiers-lieu** (transformers de groupe) | élevé | `tiersLieuxMapping` (~140 LOC) |
| P4 | Migrer **profil** (5 entités) | élevé | `buildProfileUpdateData` + miroir `useProfileFormData` (~300 LOC) |
| P5 | Unifier CREATE/EDIT dans `runSubmit`, retirer les `payloadFn` nommés | moyen | `payloadRegistry` |

**Règle d'or** : ne **jamais** supprimer un mapper bespoke sans **snapshot byte-à-byte du payload + sweep
parité 5080 (legacy) vs 5099 (backend)** pour l'entité concernée. La forme legacy fait FOI (cf. `CLAUDE.md`).

## 4. Risques

- **Byte-compat** : `socialNetwork` = objet (pas array), `openingHours` = 7 entrées DOW `Mo..Su`, ObjectId/MongoDate.
  Les transformers de groupe doivent reproduire **byte-pour-byte**.
- **Adresse atomique + garde `localityId`** : sans `localityId` réel, `addressValid` backend rejette et le save
  **atomique** échoue. `serializeGroup(address)` doit renvoyer `undefined` (omettre) sans `localityId`, et
  émettre `geo`/`geoPosition` non relus par le READ (sinon écrasement lossy).
- **Sémantique du vide** : voir §2 — `{}` n'est pas un clear.
- **Costum** : presets (`mainTag`, `role`, `preferences`) injectés par la lib (`me.costum(slug)`), **pas** par le
  payload → garder l'ordre `presets AVANT data` et le scope. Drift artefact↔config surveillé par `/contract-check` §F.
- **Champs serveur non modélisés** (geo, level2-4) : « ce que je ne touche pas, je ne réécris pas » → baseline
  dérivé de `serverData`, `atomicGroup` pour les blocs.
- **RHF** : ne pas casser `seededDefaults` (useMemo), `computedFrom`, ni le rapport `isDirty` (garde de fermeture).

## 5. État

- **P0 — FAIT** : `formEngine/engine/reconcile.ts` (`isSameValue`, `reconcileClearedFields`), câblé dans
  `useEditTiersLieu`, `isSameValue` dé-dupliqué (poiEquipement), tests `reconcile.test.ts`.
  Le correctif d'effacement tiers-lieu (réconciliation + schéma AJV permissif côté lib) est désormais exprimé
  via le helper partagé — première brique du `reconcile` final.
- **P1 — cœur FAIT (additif, pur, non branché)** : `FieldDescriptor` étendu (`clear`, `atomicGroup` — `path`
  préexistant) ; `formEngine/engine/fieldPipeline.ts` (`seedFromEntity` READ, `valuesToPayload` WRITE en modèle
  COMPLET, `diffForEdit` diff baseline-aware avec clear typé + groupe atomique), tests `fieldPipeline.test.ts`.
  Le bug d'effacement est absorbé nativement (champ vidé = clé modifiée vers vide → branche clear).
- **P1 — GROUPES DE SÉRIALISATION FAITS** : `FieldDescriptor.group` + `FormDescriptor.serializeGroups`
  (`{ serverKey, read, write }`) câblés dans `seedFromEntity` (objet serveur → champs plats des membres) et
  `valuesToPayload` (champs plats → objet serveur, `undefined` = clé omise). Subsume `extractAddressFields`/
  `buildAddressFromForm`, `extractSocial`/`buildSocialNetwork`. Tests `fieldPipeline.test.ts` (READ/WRITE/omission/clear).
  Reste : branchement dans `GenericForm` + un pipeline submit — fait à la 1re migration (P2).
- **P2 — POI READ migré** : `buildEditDefaults` délègue désormais à `seedFromEntity(POI_READ_DESCRIPTOR)`
  (coercers enregistrés en transformers nommés + descripteur de lecture déclaratif read/default + adresse en
  `serializeGroup`). Le mapping coercer-par-coercer (~60 lignes) est supprimé. Équivalence prouvée
  (`poiEquipement.readMigration.test.ts` : création → createEmptyDefaults ; édition → coercition + adresse imbriquée).
  Effacement prouvé contre legacy (lib `costum-update-singlefield` : string/objet/number, **5080 ↔ 5099**).
  **Reste de P2** : WRITE/diff (`buildEditPatch` → `valuesToPayload`+`diffForEdit` avec adresse `serializeGroup`
  + `geo`/`geoPosition` atomiques), branchement `PoiEquipementGenericModal`, suppression de `buildEditPatch`.
- NB : **profil** (`\|\| ""`) efface correctement par convention — à rendre structurel via `fieldPipeline` = P4.
- Reste : P2-suite (WRITE POI) → P3 (tiers-lieu) → P4 (profil) → P5, sous garde de parité (tests d'intégration lib vs 5080).
