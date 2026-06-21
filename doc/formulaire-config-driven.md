# Formulaires config-driven (JsonFormConfig → formEngine)

> Plan d'objectifs P0→P5. Compagnon de [`moteur-formulaire-generique.md`](./moteur-formulaire-generique.md).
> Issu de l'investigation cross-repo (JsonFormModal, coform, lib costum, dynForm legacy, surface moteur).

## Décision d'architecture

**Adaptateur vers `formEngine`** (pas étendre coform, pas réinventer).

- `formEngine` est la seule base mûre, **~80% sérialisable** : `FieldDescriptor`/`SectionDescriptor`/`LayoutSpec`/`Predicate` sont du JSON ; widgets/layouts/transforms sont des **registres par clé string** ; `computedFrom` est déjà prouvé en mode nommé pur-JSON.
- **`coform` reste séparé** : domaine disjoint (collection **Answers**, pas des entités). Ne pas fusionner.
- **`JsonFormModal` est un prototype mort** (`onSubmit = console.log`, pas de bouton submit, `submitMode`/`entityType`/`extraData` jamais consommés). Son **contrat zod** inspire le nouveau modèle, puis on le **retire**.
- **Source de vérité = `dynForm` legacy** (`jsonSchema.properties` par clé = `inputType`/`label`/`rules`/`order` + overlay `dyFCustom`). On reprend la sémantique **déclarative** sans porter les `eval`-strings.

### Principe central : zéro fonction dans la config

Tout ce qui n'est **pas sérialisable** (validate cross-champ, computed, read/write, mapping submit) est référencé **par NOM** via des **registres par clé string** (généralisation de `engine/transforms.ts`, qui a déjà `registerTransform`/`registerCompute`). La config JSON ne contient **jamais** de fonction ni d'`eval` — uniquement des clés. Le schéma zod l'**interdit**.

### i18n — choix A (pré-résolution)

La config porte des `LocalizedString {fr,en,es,de}` (fr requis, `locale-schema.ts` réutilisé). `configToDescriptor` **pré-résout** chaque `LocalizedString → string` à la langue courante (surcharge `tData` déjà présente dans `useT`/`useLocalization`) **avant** de construire le `FormDescriptor`. Le moteur reste en `I18n=string` (zéro modif de ses types). Recompute mémoïsé sur `(config, locale)`. Option `i18n:'keys'` pour référencer des clés `useT` existantes.

### Submit + costum

- Pipeline générique `runSubmit` : `write` transforms par champ → `payloadFn` (registre, réutilise `buildTiersLieuxPayload`/`buildEditPatch`/cleanup) → **`entityFactory[entityType]`** route `me.costum(slug).X(payload)` sinon `me.X(payload)` → `save()` + `useMutationWithToast` (presets AVANT data, `tagsFrom`→tags, `extraData` merge).
- **Costum Niveau 1 (scope au submit)** = déjà couvert par la lib (CostumScope, `BaseEntity._costumCtx`, prouvé live). **Aucun code lib.**
- **Costum Niveau 2 (générer un form depuis un schéma costum)** = ultérieur, **build-time** depuis `costum-extensions.json` (l'artefact runtime distribué a perdu `enum`/`multiple` — cf. P4).

### 3 verrous moteur à lever

1. `FormDescriptor.validate` doit accepter `string | fn` (+ `validateRegistry`). — P1
2. `read`/`write` par champ sont déclarés mais **jamais câblés** dans `GenericForm`. — P1
3. Pas de **pipeline submit générique** (chaque modal le fait à la main). — P2

---

## Modèle `JsonFormConfig` (cible)

```ts
{
  id: string,
  entityType: 'organization'|'project'|'event'|'poi'|'citoyen',  // → collection + hook
  collection?: FormCollection,                                   // dérivé d'entityType sinon
  costum?: { slug: string },                                     // scope (presets/fields via la lib)
  layout: { kind:'flat'|'tabs'|'wizard'|'accordion', validatePerStep?:bool },
  i18n?: 'localized'|'keys',                                      // défaut 'localized'
  sections: [{ id, label?:LocalizedString, visibleIf?:Predicate,
               groups?:[{columns?,label?,visibleIf?,divider?,fields:string[]}], fields?:string[] }],
  fields: { <name>: {
     type:'string'|'number'|'boolean'|'date'|'array'|'object',
     widget: WidgetKind,                          // aligné sur formEngine
     label: LocalizedString, placeholder?, placeholderSearch?, info?,
     path?, default?, multiple?, optionsKey?,
     enum?: [{value:string, label:LocalizedString}],
     required?, requiredIf?:Predicate, visibleIf?:Predicate,
     rules?:{ url?,min?,max?,minLength?,maxLength?,regex? },
     messages?:{ required?,url?,min?,max?,minLength?,maxLength?,format? }, // LocalizedString par règle (auto-suffisant)
     computedFrom?:{ deps:string[], fn:string },  // fn = clé registre compute
     read?:string, write?:string                  // clés registre transform
  }},
  validateFn?: string,                            // clé registre validate cross-champ
  submit: { mode:'sdk'|'fetch', action?, method?,
            presets?:Record<string,unknown>, tagsFrom?:string[], extraData?:Record<string,unknown>,
            payloadFn?:string, successMessage?:LocalizedString, errorMessage?:LocalizedString },
  submitLabel?: LocalizedString
}
```

Correspondances legacy : `fields.<name>` = `jsonSchema.properties.<name>` ; `widget` ≈ `inputType` (table dans l'adaptateur) ; `submit.presets` = `dyFCustom.presetValue` ; `visibleIf` = `dyFCustom.hide` inversé ; `validateFn`/`payloadFn` remplacent les `eval`-strings.

---

## État (2026-06)

✅ **P0** (schéma + adaptateur) · **P1** (validate:string + read/write) · **P2** (pipeline submit + JsonFormHost) · **P4** (générateur build-time + CLI `config:costum`).
✅ **Bidirectionnel** : `configToDescriptor` (config→descriptor) **et** `formDescriptorToConfig` (descriptor→config, round-trip) — les 2 systèmes coexistent.
✅ **Voie B (runtime/prod)** : la lib enrichie (`scope.describeForm(collection) → CostumFormDescriptor`) alimente le cœur `descriptorToConfig` SANS l'artefact build-time (cf. `profil/forms/costumForm.ts`). Voie A (artefact, dev/CLI) conservée.
⏳ **P3** (valider cyber-reunion live 5080 + payloadFn + re-pointer json-form→JsonFormHost) · **P5** (opt).

## Objectifs (P0 → P5)

### P0 — Schéma de config + adaptateur pur · effort M · ✅ FAIT
**But** : une config JSON rend déjà dans `GenericForm` (rendu + validation par champ), sans submit.
**Livrables** : `src/modules/formEngine/config/{schema.ts, configToDescriptor.ts, index.ts}` + tests.
- `schema.ts` : zod `JsonFormConfig` (feuille, ne dépend que de `locale-schema`) + `PredicateJson` aligné sur `Predicate`.
- `configToDescriptor.ts` : fonction **PURE** `(config, {t}) → FormDescriptor`. Table `inputType↔WidgetKind`, `defaultWidgetForType`, `rules` tels quels, `visibleIf`/`requiredIf` tels quels (déjà Predicate), pré-résolution i18n.
**Acceptation** : test `config→descriptor` sur fixture ; `GenericForm` rend la fixture (rendu + validation par champ OK) ; `tsc`/lint/vitest verts. Aucun câblage submit.

### P1 — `validate: string` + câbler read/write/validate · effort S · ✅ FAIT
**But** : lever les verrous moteur 1 & 2, sans régression des descripteurs TS.
**Livrables** :
- `types.ts` : `FormDescriptor.validate?: string | ((values)=>issues[])` + `validateRegistry` (pattern `transforms.ts`).
- `GenericForm` : appliquer `read` aux `defaultValues`, `write` au submit, résoudre `validate` string.
- Enregistrer les `validate` inline existants (`eventDates`, `tiersLieuAddress`, `addressValid`) sous des clés depuis `modules/profil`.
**Acceptation** : descripteurs TS existants inchangés (fn toujours acceptée) ; e2e moteur 10/10 ; un `validate` string fonctionne en test.

### P2 — Pipeline submit générique + entityFactory + JsonFormHost · effort L · ✅ FAIT
**But** : rendre une config **fonctionnelle** de bout en bout (rendu → save SDK).
**Livrables** :
- `submitRegistry` + `payloadFn` nommés (factoriser `buildTiersLieuxPayload`/`buildEditPatch`/cleanup urls).
- `entityFactory` `{organization|project|event|poi|citoyen}` routant `me.costum(slug).X(payload)` sinon `me.X(payload)`.
- `JsonFormHost` (remplaçant de `JsonFormModal`) : `configToDescriptor` → `GenericForm` + `runSubmit` + `useMutationWithToast` (presets→data, `tagsFrom`→tags, `extraData` merge, succès/erreur) + **bouton submit + état submitting** (manques actuels). Branché dans `ModalRegistry` `'json-form'`.
**Acceptation** : une config crée réellement une entité (toast + invalidate + close) ; scope costum vérifié ; `tsc`/lint/build verts.

### P3 — Valider sur cyber-reunion + retirer les doublons · effort M · ⬜ à faire
**But** : preuve sur une config prod réelle + nettoyage.
**Livrables** : `config.prod.cyber-reunion.json` passe de bout en bout (création org scopée costum) ; bouton `register-cyber-reunion` → `'json-form'` ; **retirer** `JsonFormModal` + `RegisterCyberReunionModal` + helper mort `_submitViaFetch` ; migration douce `JsonFormModalConfig` → `JsonFormConfig`.
**Acceptation** : cyber-reunion crée une org costum (test 5080 si pertinent) ; byte-diff L/B OK ; aucun import résiduel des fichiers retirés.

### P4 *(optionnel)* — Générer une config depuis un schéma costum · effort L · ✅ FAIT (+ voie B runtime)
**But** : industrialiser le costum (Niveau 2).
**Livrables** : générateur **build-time** `costumToConfig(slug, collection) → JsonFormConfig` depuis `costum-extensions.json` (enum/multiple/presets/hidden/createLabel/x-format date) + `defaultWidgetForType`. **Pas de changement lib** (voie A : artefact non distribué consommé au build).
**Acceptation** : une config générée pour un costum connu rend + persiste correctement scopée.

### P5 *(optionnel)* — Migrer les descripteurs TS existants → JSON · effort XL · ⬜ à faire
**But** : piloter add/edit depuis des configs (site-json/costum) plutôt que du code.
**Livrables** : conversion progressive de `addPoi`/`addProject`/`addOrganization`/`addEvent`/`poiEquipement`/`tiersLieu`/`editProfile` `.descriptor.ts` en `JsonFormConfig` (parties non-JSON déjà extraites en registres aux P1/P2).
**Acceptation** : **byte-diff systématique L vs B** (risque parité élevé) ; comportement identique avant/après.

---

## Risques (transverses)

- **byte-compat du submit** : le pipeline générique doit reproduire EXACTEMENT les mappings actuels (reconstruction address, `buildEditPatch` diff, cleanup urls, presets AVANT data) → garder les `payloadFn` métier nommés + byte-diff L/B.
- **non-sérialisable par fuite** : interdire fonctions/`eval` dans la config (schéma zod = clés string uniquement) — sinon on reproduit le couplage legacy.
- **i18n** : oublier la dep `locale` dans le `useMemo` fige les labels → couvrir par test.
- **costum Niveau 2** : `enum`/`multiple` absents du runtime lib (`CostumExtensionField` raboté) → générateur **build-time** depuis `costum-extensions.json` (artefact hors-lib à versionner).
- **rôles** : `dyFCustom.adminOnly` sans équivalent `visibleIf` → ne pas exposer de champs sensibles via config sans contrôle de rôle (le backend reste le write-gate).
- **file/image** : doit passer par le pipeline upload de la lib (idiome `profil_avatar`/`save()`→PROFIL_IMAGE) ; un `JSON.stringify(File)` casserait.
- **options runtime** : `optionsKey`→`serverData.lists`/finder `filters` injectés par le host (`listsOptions`/`fieldProps`).
- **périmètre** : ne PAS fusionner `coform` (Answers) — domaines disjoints.
