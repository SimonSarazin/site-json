# Formulaires costum (`config.costumForms`) — recette avancée

> Chargé à la demande depuis la skill `config-assistant` (SKILL.md § Recettes
> avancées). Prérequis : avoir lu la Règle d'or et le Workflow de la skill.

Une modale **add+edit d'une entité scopée costum** (tiers-lieu, équipement sportif…) se déclare **EN DONNÉES**
dans `config.costumForms.<id>` — aucun composant ni schéma TS. Mécanisme, forme du document et recette
canonique : **[doc/28-module-formengine.md](../../../../doc/28-module-formengine.md)** (couche 3). Forme
introspectable (règle d'or « dériver ») : `npm run config:schema costumForm`.

**Recette d'un costum « simple » (0 code)** — possible UNIQUEMENT si le formulaire ne référence que des clés
**déjà enregistrées** (codecs/scope/validate partagés : `address:read/write`, `openingHours:read/write`,
`social:read/write`, `geo:write`, `image:profilUrl`, `monthYear`, `validateFn:"addressComplete"`…) :

1. **Le document** `config.costumForms.<id>` = un `CostumFormSchema`. Obligatoire : `id` (= `<id>`), `entityType`
   (`organization|project|event|poi|citoyen`), `layout` (`{kind:"wizard"|"tabs"|"flat"}`), `sections`, `fields`
   (chaque champ : au moins `widget`), `chrome.title.{add,edit}`, `mutation.entityType`. Recommandé : `costumSlug`
   (slug du costum porteur — sert au create), `icon`, `submitLabel`. Laisser `payloadFn`/`defaultsBase` ABSENTS
   = pipeline générique (read/write/defaults dérivés des widgets).
2. **Déclencher l'ajout** : `floatingActionButton.modal = "add-<id>"` (ou un bouton de section `modal:"add-<id>"`).
3. **Déclencher l'édition** : `profiles.<entityTypePluriel>.editModal = "edit-<id>"`, + `editModalMatch`
   (`{champ: valeur}`) pour UN sous-type conditionnel. Si PLUSIEURS sous-types partagent le même
   `entityType` (ex. `poi` = `recoveryCenter` + `article`), utiliser la **TABLE** `profiles.<pluriel>.editModals`
   = `[{editModal, editModalMatch:{type:…}}, …]` (**1er match gagne** ; le catch-all sans condition doit
   être **EN DERNIER**, sinon il masque les sous-types). La résolution `add-/edit-<id>` → table runtime est
   **automatique** (aucune entrée hardcodée à ajouter).

   ⚠ **BORNER AU PÉRIMÈTRE DU COSTUM — obligatoire.** Une route sans condition s'applique à TOUTES les
   entités du type, y compris étrangères au costum : sur une page profil publique, n'importe quelle
   organisation du site ouvrirait ton formulaire (bug constaté sur institutBleu — ~29 400 organisations
   concernées). **Le sous-type ne suffit pas** : `type: recoveryCenter` compte 3 765 POI en base dont
   3 079 étrangers. Et aucun champ PLAT ne porte l'appartenance : la provenance vit dans `source.key`/
   `source.keys`, le rattachement secondaire dans `reference.costum`. Ajouter donc sur CHAQUE route un
   prédicat `when` (grammaire `and`/`or`/`not`, celle de `list.itemRules`), cumulatif avec `editModalMatch` :

   ```jsonc
   { "editModal": "edit-<id>", "editModalMatch": { "type": "<sousType>" },
     "when": { "or": [
       { "field": "sourceKeys",       "op": "contains", "value": "<slugCostum>" },
       { "field": "reference.costum", "op": "contains", "value": "<slugCostum>" }
     ]}}
   ```

   `sourceKeys` est un champ synthétique normalisé (fusionne `source.key` + `source.keys`, y compris la
   forme « objet à trous » d'un `unset` PHP) ; `reference.costum` est un chemin pointé, résolu lui aussi.
   Le générateur `--all` **n'émet PAS ce `when`** : à ajouter à la main après fusion, sinon le bug se
   rejoue. Vérifier aussi que les champs testés sont PROJETÉS là où la modale est montée (`element/about`
   les renvoie ; une entité issue d'une recherche est limitée à `defaultFields`).
4. **Valider** : un test qui appelle `registerCostumForm(doc)` (cf. `costumFormRegistry.test.ts`) joue
   `CostumFormSchemaZod` (structure) **puis** `assertCostumKeysRegistered` (existence des clés). Une clé citée
   (`read`/`write`/`enumFrom`/`scope.derive`/`payloadFn`/`validateFn`/`slots`…) non enregistrée **lève une erreur
   claire au load** (nom de la clé + où la définir), plus de `console.warn` silencieux au rendu. Si la garde
   pointe une clé absente → c'est une clé **métier** → il te faut un `fns.ts` (voir ci-dessous).

**Point de départ GÉNÉRÉ (recommandé)** : `npm run config:costum -- <slugCostum> <collection> --format costumForm`
émet un `CostumFormSchema` complet et VALIDE (auto-vérifié zod + clés partagées uniquement) depuis la
connaissance costum de la lib. Ajoute `--live` (+ env CONFIG_LIVE_BACKEND/EMAIL/PWD) pour partir du costum
RÉEL en base (getcostumjson) — couvre TOUT costum, même absent de l'artefact bundlé (lib ≥ 1.0.164). Contenu : sections base+costum, widgets déduits des types, pattern adresse
(groupe + codecs), image de profil, mutation/invalidation standard, presets → `mutation.inject.extraFields`.
Ce squelette se pose tel quel dans `config.costumForms.<id>` puis s'ENRICHIT conversationnellement — voir
les 5 écarts attendus plus bas.

**Costum à PLUSIEURS formulaires par collection (sous-types)** — ex. `sportSanteBienetre` = `poi`(recoveryCenter+article),
`organizations`(base+mss), `projects`(formation), `events`(sessionFormation). Utiliser le mode **`--all`** (requiert
`--live`, lib ≥ 1.0.166) : `npm run config:costum -- <slugCostum> [out.json] --all --live` émet un **BUNDLE**
`{ costumForms:{ <slug>-<typeKey>:<CostumFormSchema>, … }, profiles:{ <kind>:{ editModals:[…] } } }` — UN form par clé
`typeObj` (id unique `<slug>-<typeKey>`) + la **table de routage** `editModals` (discriminant = `presetValue.type` ;
sous-types matchés d'abord, form de base en catch-all). **Fusionner** `costumForms` (les N forms) + chaque
`profiles[kind].editModals` dans le config du site, puis enrichir (libellés, widgets, discriminant si faux). Les
sous-types non-standard (sans `sameAs` vers poi/org/project/event, ex. `Cooperative`) sont ignorés.
5 écarts attendus vs un costum fini : (1) layout `flat` → `wizard`/groups/colonnes ; (2) labels humanisés →
libellés fr/en curés ; (3) `text`/`tags` → `selectFromLists`/`urlList`/`checkboxGroup` selon le sens métier ;
(4) scope/type dérivés (`scope.derive` métier) + masquage des champs stampés ; (5) `visibleIf`/`computedFrom`/
`cleanValues` métier. Le préflight `tests/preflight/costum-forms.test.ts` re-valide tous les costumForms du
repo (zod + garde des clés) à chaque run.

**Quand il faut du code (PAS 100 % config)** : transfo métier inédite (`payloadFn` propre), `scope` dérivé,
defaults structurés, **slot React** (placé par `"$slot:<id>"` dans `sections`), codec `serializeGroup` inédit,
`validate` cross-champ inédit. Créer alors `src/modules/profil/forms/costum/<id>/fns.ts`
(`registerXxx("clé", impl)`) + l'ajouter au barrel `registerSpecFns.ts`.

> **Clés génériques garanties** : les clés « partagées » (codecs/coercions/geo/validators/`image:profilUrl`/
> `cleanValues:*`/`invalidate:standard`) sont enregistrées inconditionnellement par le barrel
> `forms/costum/sharedRegistrations.ts` (importé par `registerSpecFns` et par le loader `registerCostumForms`
> avant toute compilation) — un costum 100 %-config qui ne réutilise que ces clés se compile sans dépendre
> d'aucun costum métier. Toute clé MÉTIER manquante est signalée par la garde du loader (cf. point 4).
