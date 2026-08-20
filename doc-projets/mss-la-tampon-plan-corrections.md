# MSS La Tampon — plan de corrections post-review MR 43

> Réflexion du 2026-08-20 (branche `fix/mr43-review-findings`). Constat de départ : la config
> MR 43 fonctionne mais **dévie du modèle de la plateforme** — elle écrit sous le costum d'un
> autre site (ssbe), duplique ses enums à la main, et modère via un champ (`statusActor`)
> déclaré nulle part.
> Ce doc consolide les chantiers AVANT exécution. Rien ici n'est codé tant que non coché.

## Décisions actées (avec l'utilisateur)

1. **`associationEkilibre` devient auto-porteur** : copie MINIMALE du dynForm ssbe
   (périmètre réduit au seul nœud que le form utilise — pas d'héritage du bagage ssbe).
2. **Modération multi-états conservée sur `statusActor`, au patron `statusField`**
   (correction du 2026-08-20 : la 1ʳᵉ décision « basculer sur toBeValidated » était erronée —
   `toBeValidated` est BINAIRE alors que le workflow régional est multi-états, et le module
   admin site-json a DEUX modes de modération par design : `costumFlag` ET `statusField`,
   décision 2026-07-07, `src/modules/admin/schema.ts:42-52`). Ce qui était réellement cassé
   n'est PAS le choix du champ, c'est sa **déclaration** : `statusActor` n'existe ni au
   typeObj, ni au dynForm, ni au contrat → rabotage whitelist → hack stamp `pathValue`.
3. **Pas de transfert d'appropriation — référencement CURATÉ seulement** : le stock reste
   ssbe-owned ; l'admin référence fiche par fiche (`reference.costum`), pas d'automatisme.
   La propriété porte les fonctionnalités, la référence ne porte que la visibilité : une
   fiche référencée est en lecture seule côté admin (seule action : (dé)référencer). La
   config devient mono-slug via la traduction serveur
   `sourceKey → $or[source.keys, reference.costum]`.

## Faits mesurés (base du 2026-08-19)

- `associationEkilibre.costum` : moteur `costumize`, hooks `searchAnswers`/`canEditAnswer`,
  **AUCUN typeObj, AUCUNE lists** (contexte nu → d'où le `scope.constant: "sportSanteBienetre"`).
- `sportSanteBienetre.costum.typeObj` : 7 nœuds ; la résolution se fait **par collection**
  (`typeObj[coll|sameAs]`, cf. `transfersource.ts:198` backend) → tout le parc résout sur
  `organizations` (43 props). `Cooperative` = `{add}` seul (menu de création legacy, 0 champ) ;
  `mss` = type métier régional à part (25 props, `sameAs`) — hors périmètre tous les deux.
- Lists réellement référencées par le dynForm `organizations` : `thematic`, `titleRepresentative`
  (les 6 autres = inline ou monde équipements sportifs/POI).
- Parc (`source.keys ∈ {sportSanteBienetre, associationEkilibre}`) : 138 fiches —
  types `null:134, Cooperative:2, NGO:2` ; `statusActor` : `Validé:105, En attente:31,
  En cours:1, absent:1` ; `preferences.toBeValidated` : **0**.
- Jointure config↔dynForm : 2 storeKeys du form ne sont **ni cœur ni dynForm** →
  `otherRepresentativeTitle` / `otherPersonInChargeTitle` (rabotés par la whitelist au save,
  mécanisme identique au bug statusActor) — alors que la donnée EXISTE (11 et 23 fiches,
  écrites par le legacy plus laxiste).
- Gate serveur `toBeValidated` : `src/shared/search.ts:336-357` (backend), keyé sur
  **`$_POST.costumSlug`** — « sans costumSlug (sourceKey seul) → gate sauté ». Les recherches
  MSS n'envoient pas de `costumSlug` aujourd'hui.
- La commandPalette ne cherche que `sourceKey: ["sportSanteBienetre"]` → les fiches nées
  `associationEkilibre` y seraient introuvables (bug indépendant de la copie).
- Le form n'a **pas de bloc `identity`** (2ᵉ couche de la triple déclaration absente).

## Chantier A — copie Mongo ssbe → associationEkilibre (minimale, amendée)

- [x] **FAIT (dev, 2026-08-20)** — copier `costum.typeObj.organizations` (43 props) **+ amender à la copie** : ajouter les
      props `otherRepresentativeTitle`, `otherPersonInChargeTitle` **et `statusActor`**
      (la déclaration rejoint la réalité des données ; vérifier par un save de test que le
      rabotage disparaît sur les trois).
- [x] **FAIT (dev)** — copier `costum.lists.thematic` + `costum.lists.titleRepresentative`.
- [ ] NE PAS copier : `Cooperative`, `mss`, `article`, `formation`, `sessionFormation`,
      `recoveryCenter`, ni les listes `category`/`familleEquipement`/`nature`/`sol`/
      `legalStatus`/`titleResponsable`.
- [x] Script `tools/mss-la-tampon/copy-costum-decl.mjs` (13 contrôles, rollback avant update) — appliqué DEV (modified=1, vérif 46 props + 2 lists, rollback conservé) ; **PROD RESTE À JOUER** (même script, MONGO_URI prod).
- [x] **PROUVÉ 2026-08-20** — byte-diff LIVE L(5080)↔B(5099) du save structure (patron des probes de
      mutation `tools/parity` du backend, comme les autres chantiers) : créer PUIS éditer une
      fiche par `element/save` sous costum `associationEkilibre`, et diff de la RÉPONSE + du
      DOCUMENT stocké. Pièges connus à respecter : `costumSlug` au **BODY** (le legacy résout
      le costum par le body, pas le host) ; **form-urlencoded** (JSON → `$_POST` vide côté
      legacy = faux négatifs) ; token PAR serveur (clés JWT différentes) ; vérifier que les
      3 props amendées (`other*Title`, `statusActor`) passent des DEUX côtés ; nettoyage
      0 résidu, jamais l'utilisateur de test `55ed9107…`. Rejoué aux jalons B (scope basculé)
      et C (inject statusActor).
- [ ] E2E site-json des forms (`tests/integration/costum-forms.e2e.test.ts`, découvre le parc
      automatiquement) : le form MSS est le SEUL sans `costumSlug` → non jouable, et l'édition
      privée du pin de schéma (`resolveModalSpec.ts:158`). Décision 2026-08-20 : la clé n'est
      PAS posée avant la copie — elle est ajoutée avec **`associationEkilibre`** DÈS la copie
      A faite, en même temps que la bascule du scope (chantier B). D'ici là ces deux trous
      restent ouverts (assumé). Jouer ensuite la suite en modes `bundle` ET `live` sur
      `maison-sport-sante-la-tampon/structure` aux jalons B et C.
- [ ] Après copie : régénérer artefact + lib (`costum-fields:check` verra le nouveau costum à
      champs) — **à batcher** avec le drift META `host` ssbe déjà en attente.

## Chantier B — recible la config sur associationEkilibre (mono-slug après F)

- [x] **FAIT 2026-08-20** — `scope.constant` ET `costumSlug` basculés ensemble sur
      `"associationEkilibre"` (jamais de valeur ssbe transitoire). ⚠️ **GATE DE DÉPLOIEMENT** :
      cette config suppose la copie A jouée sur la base CIBLE — jouer
      `tools/mss-la-tampon/copy-costum-decl.mjs` (dry-run puis --apply) en PROD **AVANT** tout
      déploiement de la branche, sinon whitelist costum VIDE (champs métier rabotés au save).
- [x] **FAIT 2026-08-20** — `/structure` basculé : `notSourceKey` et le filtre brut RETIRÉS,
      `sourceKey: ["associationEkilibre"]` posé (le schéma exige un TABLEAU). Équivalence
      PROUVÉE avant bascule : ancien prédicat vs traduction serveur `$or[source.keys,
      reference.costum]` → mêmes 14 ids sur la base.
      Le filtre postal `{97430, 97418}` RESTE : territoire produit = **Le Tampon seul**
      (bourg + Plaine des Cafres), décision utilisateur 2026-08-20 — orthogonal à la
      provenance, il borne aussi les futures fiches possédées. Historique : la MR étiquetait
      97418 « Saint-Joseph » à tort ; le fix `d00ac109` avait relabellisé ET ajouté 97480
      (Saint-Joseph) en suivant le doc-projet — ajout REVERTÉ sur décision. ⚠️ Le doc-projet
      (l.59 « du Tampon et de Saint-Joseph », l.209 « Tampon/St-Joseph ») contredit désormais
      la config : à corriger, et à signaler à l'auteur dans le commentaire de review MR.
- [x] commandPalette `sourceKey` += `associationEkilibre` (2026-08-20) ; → eki seul après F.
- [x] **FAIT 2026-08-20 (correction du plan)** — editModals `when` RECENTRÉS eki : le matcher
      sait déjà tester `reference.costum` directement (la MR l'utilisait), donc
      `or[sourceKeys ∋ eki, reference.costum ∋ eki]` = « mes fiches + celles que j'ai
      référencées », auto-entretenu, sans nommer ssbe. La branche MR `reference.costum ∋ ssbe`
      (fiches référencées PAR ssbe) n'avait pas de sens ici — retirée. Une fiche ssbe NON
      référencée retombe sur le form standard (correct : pas une fiche du site). Seule reste
      mixte À DESSEIN la section admin Structures : c'est l'outil de CURATION, il doit voir le
      vivier ssbe du territoire pas-encore-référencé (un sourceKey eki ne le montrerait pas).

## Chantier C — modération multi-états `statusActor` au patron `statusField` (DÉCIDÉ, révisé)

Le design est centré sur **associationEkilibre** : c'est SON workflow de modération, sur SES
données. Les valeurs ci-dessous sont retenues parce que le stock hérité les porte déjà
(compat données, VERBATIM) — les références legacy ssbe ne sont que la provenance de
l'héritage, pas une contrainte de design :
- **création** → `statusActor = "En cours"` (l'intention de la MR ; même valeur que l'héritage,
  `sportSanteBienetre_index.js:132`) ;
- **états** : `En attente` / `En cours` / `Validé` / `Refusé`, défaut affiché « En attente » si
  absent (valeurs présentes dans le stock, `costumize/sportSanteBienetre/admin.js:290-298`) ;
- **affichage public** : filtre `statusActor = "Validé"`.

- [x] Prérequis FAIT : `statusActor` déclaré dans le dynForm copié (chantier A, dev).
- [x] **FAIT 2026-08-20** — inject payload `statusActor: "En cours"` restauré, stamp
      `pathValue` retiré ; sentinelle stamps et test configDriven 11 mis à jour (même gate de
      déploiement que B : déclaration requise sur la base cible).
- [ ] Lecture : le defaultFilter `statusActor: "Validé"` sur `/structure` posé le 2026-08-19
      **RESTE** (même sémantique que le site régional). Pas de gate `toBeValidated`, donc pas
      de `costumSlug` à ajouter pour ça. Assumé : pas de « l'auteur voit ses propres
      en-attente » — parité UX avec le régional.
- [x] **FAIT 2026-08-20** — bloc `status` statusField (statusActor, 4 états tonés) posé sur la
      section « Structures » du tab admin + rowAction `validate`. Le scoping aux POSSÉDÉES est
      assuré par le gate G (`restrictActionsToOwned` : le dropdown de statut n'apparaît que sur
      les lignes possédées) — pas besoin d'une section séparée.
- [ ] Backfill : **AUCUN**. Les 33 non-Validé gardent leur statut tel quel ; la fiche sans
      `statusActor` est cachée par le filtre public et l'admin l'affiche « En attente ».
- [ ] `toBeValidated` : ne sert PAS pour les structures MSS.
- [ ] Créneaux (answers) : étage SÉPARÉ, inchangé — le statut vit dans la réponse, contrat du
      hook legacy `searchAnswers` byte-vérifié.
- Note transitoire (tant que le stock reste ssbe-owned, cf. chantier F) : le champ est aussi
  lu/écrit par le site régional legacy sur les 138 fiches héritées. Ce n'est PAS un driver de
  design — la sortie propre de cette situation, c'est l'appropriation du stock (F).
- Note feature (à décider, hors périmètre minimal) : le legacy mailait la structure au
  changement de statut ; notre `updateField` admin ne le fait pas.

## Chantier D — identity du form

- [x] **FAIT 2026-08-20** — `identity: {type: "Cooperative"}` posé. Nuance d'exécution :
      `identity` est DÉCLARATIF (discriminant `costumSubType` côté recherche) — l'inject reste
      l'ÉCRIVAIN du type à la création ; les deux couches coexistent, chacune son rôle.

## Chantier E — enums depuis le costum (fin de la duplication à la main)

- Constat : le form recopie en dur des enums dont la source vit dans le dynForm/lists Mongo
  (`thematic` → `list: "thematic"`). Dérive silencieuse si la liste bouge.
- Le mécanisme `optionsFrom: {list, costumSlug}` existe côté **filtres search**
  (`useDynamicFilterOptions` + primitives `src/lib/costumLists.ts`) mais pas côté moteur de form.
- **DIFFÉRÉ** (décision 2026-08-20) : on y réfléchira APRÈS l'exécution de A→D/F/G.
  Reco en attente : étendre `optionsFrom` au moteur de form ; sinon garde préflight anti-dérive.

## Chantier F — référencement CURATÉ du stock (DÉCIDÉ : pas de transfert, pas d'automatisme)

Décision 2026-08-20 (affinée) : **PAS de migration d'appropriation** (`transfersource` écarté),
et **PAS de référencement automatique**. Le modèle : **la propriété (`source.key`) porte les
fonctionnalités ; le référencement (`reference.costum`) ne porte que la visibilité**. Une fiche
ssbe référencée dans Tampon est en LECTURE SEULE côté admin MSS — seule action : (dé)référencer.
Réciproque possible (ssbe référence des acteurs Tampon) mais c'est l'affaire du site régional,
aucune écriture de notre côté. La config vise `associationEkilibre` seul via la traduction
serveur `sourceKey` (`search.ts:302-305` : `$or[source.keys ∈, reference.costum ∈]`).

Machinerie DÉJÀ existante (`useReferenceElement.ts`, P5, 6 sites l'exposent) :
ops `reference`/`unreference`/`detach` via le carrier lib (SET_SOURCE, parité legacy) ;
toggle 3 états par ligne (possédée → Détacher / référencée → Retirer / sinon → Référencer,
`AdminResourceTable.tsx:534-540`) ; opt-in `moderateReferenced` (modération scopée
`validateGroup`) — qu'on N'ACTIVE PAS pour MSS : référencer EST l'acte de curation.

- [x] **FAIT 2026-08-20 (dev)** — les 14 fiches du territoire (97430 : 11, 97418 : 3, toutes
      Validé, l'org porteuse EKILIB.RE incluse) référencées **14/14** via le CANAL de l'action
      admin (`setsource action/add/set/reference` sur B, gate isCostumAdmin) — script local
      `tools/mss-la-tampon/reference-stock.mjs` (dry-run/apply/rollback), fichier de rollback
      conservé. En PROD : rejouer (même script BACKEND_URL prod, ou à la main via le tab
      Structures).
- [ ] PAS de `reference.costumTypes` : orgs typées nativement, rien à classer.
- Nouvelles fiches : nées `source.key=associationEkilibre`, aucune écriture vers ssbe.
- Note (rétrécie par le modèle) : chaque site n'écrit `statusActor` que sur SES fiches —
  MSS ne touche jamais au statut du stock ssbe référencé.

## Chantier G — gating des actions admin par appartenance (NOUVEAU, manque avéré)

Constat 2026-08-20 : la table admin affiche `edit` (`AdminResourceTable.tsx:609`),
`validate`/dropdown statusField (614/633) et `delete` (670) **sans condition
d'appartenance** — seule l'action `reference` (648) consomme `isAttached`. Or le Node durci
REFUSE déjà `updatepathvalue`/save/delete sur une entité étrangère pour un admin de site sans
droits d'élément (401, cf. `useReferenceElement.ts:151-158`) → l'UX propose des actions qui
échoueraient au clic.

- [x] **FAIT 2026-08-20** — `edit`/`delete`/`validate`/dropdown statusField conditionnés à
      `actionnable = !restrictActionsToOwned || isAttached` (la ligne référencée ne garde que
      lecture + action `reference`).
- [x] Modalité TRANCHÉE à l'exécution : **opt-in de section** `restrictActionsToOwned`
      (schema.ts) — pas de changement des sites qui modèrent du référencé (`moderateReferenced`),
      pas de gêne superAdmin ailleurs ; flip en défaut possible plus tard. v1 par appartenance
      (gating d'affichage ≠ vérité des droits), raffinement droits réels différé.
- [x] Section admin « Structures » MSS créée (tab `structures`, resource organizations,
      territoire 2 CP + les 2 provenances, `restrictActionsToOwned: true`, rowActions
      edit/reference/delete, colonnes nom/CP/statut/provenance) — c'est l'OUTIL de curation
      du chantier F : les lignes ssbe n'offrent que « Référencer ».

## Ordre d'exécution

**A (copie costum) → G (gating par appartenance) → F (référencement curaté des 18) →
B (recible mono-slug) → C (modération) → D (identity)** ; E selon arbitrage. G précède F pour
que l'admin qui curate voie une UX honnête ; B dépend de F (le mono-slug via `sourceKey`
suppose le stock référencé). A est la seule écriture Mongo scriptée (dry-run/rollback, dev
puis prod) — F se fait à la main via l'admin. Tests à chaque étape : suite configDriven,
sentinelles préflight (stamps, __effective__), save de test (whitelist), byte-diff L/B si le
chemin legacy est touché, vérification navigateur sur données réelles.

## Restes hors périmètre de ce plan (déjà tracés ailleurs)

- Points produit MR 43 à arbitrer avec l'auteur : stats home en dur, hero 2,1 Mo + assets
  morts 1,9 Mo, page /contact sans backend, contradictions doc-projet, readOnly manquant
  sur timeSlots/dynamicFields.
- Régen artefact lib (drift META host ssbe) — batché avec A.
- Push citizenToolKit (BUG-L-236) ; commentaires GitLab MR 42 / MR 43.

## Journal d'exécution

- **2026-08-20 — Jalon A (dev) PROUVÉ.** Copie appliquée (script `tools/mss-la-tampon/copy-costum-decl.mjs`,
  13 contrôles verts, rollback conservé dans le dossier du script). Preuves : `getcostumjson`
  L=B **identiques à l'octet** (typeObj.organizations 46 props dont les 3 amendées + 2 lists,
  après purge du cache costum legacy) ; probe de mutation
  `cocolight-backend/tools/parity/mutation/save-structure-eki.mjs` **PASS intégral** (create+edit,
  réponses et documents byte-identiques, props amendées persistées L=B, 0 résidu).
  Deux divergences découvertes et REGISTRÉES côté backend : **BUG-L-238** (legacy persiste
  costumId/costumType dans le document — divergence volontaire T1, tolérée nommément par la
  probe) et **BUG-N-339** (save slug-seul sous costum-élément : source non stampé côté B —
  à trancher ; le triplet nominal du client n'est pas affecté).
  Restent pour clore A : miroir PROD de la copie + régen artefact/lib (batch drift host).

- **2026-08-20 (soir) — Jalons B/C prouvés par l'e2e du parc + régression telephone attrapée
  et corrigée.** L'e2e `costum-forms` (chaîne client réelle, add+edit+forme stockée) : **22/22
  PASS en mode bundle**, MSS `structure` inclus — jouable depuis la pose de `costumSlug`.
  En chemin, l'e2e a attrapé une régression de la branche : les codecs `telephone:read/write`
  ajoutés le 2026-08-19 pour MSS DOUBLONNAIENT des codecs partagés existants (même nom,
  sémantique différente — dernier enregistré gagne) et écrasaient le codec LOSSLESS du parc
  (ssbe/cyber-reunion : champ `telephone` + porteurs `_telSlot`/`_telRest`). Correction : doublons
  SUPPRIMÉS, form MSS ALIGNÉ sur le patron du parc (le codec partagé est meilleur : round-trip
  sans perte, multiples, slot d'origine). Mode live : 21/22 — seul échec `relief/tiers-lieux`,
  PRÉEXISTANT et hors périmètre (asymétrie bundle/live : l'inférence live type `string` là où
  l'artefact déclare `oneOf string|number` → candidate à un fix lib, à batcher).

- **2026-08-20 (nuit) — F FAIT + /structure mono-slug.** Décision en séance : la régen
  artefact/lib est ABANDONNÉE (cible live-only — on n'ajoute pas de nouveau schéma costum en
  dur dans la lib ; eki résout live, prouvé). La garde `costum-fields` signalera le drift
  `associationEkilibre` : assumé et documenté ici. Référencement des 14 exécuté par script
  rejouant le canal admin (`reference-stock.mjs`, 14/14, rollback conservé) ; `/structure`
  basculé sur `sourceKey: ["associationEkilibre"]` après preuve d'équivalence (14 = 14 ids
  identiques). L'état mixte de la config est CLOS côté listing public ; restent mixtes à
  dessein : la section admin Structures (outil de curation) et les `when` des editModals.

- **2026-08-20 (correction sur interpellation) — l'admin séparé en DEUX vues** (le mélange
  initial « une section mixte » était une erreur de design) : tab **Structures** = les fiches
  DU site (`sourceKey: ["associationEkilibre"]` → possédées + référencées, comme le /structure
  public ; statusField pour l'état ; gate d'appartenance par ligne) ; tab **Référencement** =
  la section dédiée du parc (`type: "reference"`, 6 sites l'utilisent) : recherche globale
  gardée legacy (`isOpenData`, exclusion du déjà-rattaché) + liste des référencés avec retrait.
  NB : la recherche de candidats est GLOBALE (pas territoriale) et exige
  `preferences.isOpenData` — sémantique legacy assumée.

- **2026-08-20 — recherche de candidates configurable (section `reference`).** Décision après
  vérification legacy : le garde-fou `isOpenData: true` date du refactor searchNew (c097823fc,
  2021, Bouboule — pas une décision de consentement documentée) et rendait la vue vide sur nos
  viviers (fiches costum/import sans preferences) alors que le refus explicite EXISTE
  (2 241 orgs + 1 741 events). Nouveau bloc `search` : `openData` optIn(défaut legacy)/optOut/off
  + ciblage `defaultFilters` (commun) et `defaultFiltersByType` (par collection — une section
  multi-collections ne fait pas fuiter un filtre d'orgs vers les events) ; gardes `$nin`
  non-configurables fusionnées MÊME-CLÉ. MSS : optOut + vivier `source.keys: sportSanteBienetre`
  territoire. Prédicat prouvé live : 0 candidate (les 14 référencées exclues par la garde),
  14 sans la garde. Défaut inchangé pour les 6 sections existantes du parc. Aucun changement
  legacy requis (le filtre est un paramètre de requête client ; `$nin` déjà accepté des deux
  moteurs — le referenceTable legacy en envoie lui-même). Suggestion upstream possible.
