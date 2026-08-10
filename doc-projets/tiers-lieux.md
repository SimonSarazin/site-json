[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Tiers-Lieux.org — Le réseau social des tiers-lieux

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config, le
> périmètre de données mesuré et les points d'attention. Créé le 28/07 à partir d'une config **déjà
> aboutie** : c'est, avec parent62, la plus complète du parc, et elle sert de référence à plusieurs
> mécanismes du moteur. **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module Observatoire](../doc/27-module-observatoire.md) · [Module Agenda](../doc/29-module-agenda.md) ·
> [Module Ampli](../doc/22-module-ampli.md) · [Module formEngine](../doc/28-module-formengine.md) ·
> [Module CoForm](../doc/21-module-coform.md). Mémoire : `[[project-tiers-lieux]]`.

Dernière mise à jour : **2026-08-10** (review MR#33 du module `toolsCatalog` : 15 constats corrigés + évolution SDK `communInfo` — voir §9 ; SDK `1.0.183` publié npm).

---

## 1. Contexte du projet

Portail national du réseau des tiers-lieux. C'est le **plus gros jeu de données du parc** — 4 303
lieux référencés, deux ordres de grandeur au-dessus de la plupart des autres sites — et la config
qui exploite le plus largement le moteur : recherche à panneau de filtres, observatoire complet,
agenda, formulaire costum, campagne d'amplification, palette de commandes.

Elle n'a **aucun constat d'audit** et **aucun périmètre vide**. Ce dossier est donc un **état des
lieux**, pas un plan de rattrapage.

### Identité

| | |
|---|---|
| Slug | `navigatorDesTierslieux` |
| Costum backend | `navigatorDesTierslieux` — collection **`projects`** (« Tiers-Lieux.org ») — 1 des 2 seuls du parc, cf. §12 |
| Config | [`../config.prod.tiers-lieux.json`](../config.prod.tiers-lieux.json) |
| CSS | [`../src/index-tiers-lieux.css`](../src/index-tiers-lieux.css) — 54 variables, bloc `theme` complet |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | **`mega-menu`** (le seul du parc à s'en servir vraiment) / `minimal-centered` |
| Variant SDK | **`navigator-tl`** — endpoint dédié ⚠ cf. §12 |
| Marqueurs costum | `mainTag: "TiersLieux"` · `compagnon: "Compagnon France Tiers-Lieux"` |
| SDK | `@communecter/cocolight-api-client` **1.0.183** (`package.json` : `^1.0.183`, bump non commité ; résolu depuis npm, plus de lien local — cf. §11) |
| Historique | **76 commits** — la config la plus travaillée du parc |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction complète ; dernier passage `fb1d6a09` (merge `origin/main` dans `feat/refonte-assistant-config`) |
| 28/07 | Claude | État des lieux et création de ce dossier |
| 09/08 | Claude | Propagation des tags typologie/portage/surface via `mutation.stamps` (`$mapLabels`/`$bucket`) — cf. §9 ; test d'intégration (a révélé le bug serverKey `buildingSurfaceArea`) ; fix middleware `imageUpload` (dossier ← champ `images`). Commité (`9bbd7a4d`, `4831f146`) |
| 10/08 | Thomas + Claude | Review MR#33 du module `toolsCatalog` (branche `mr33-review`) : 15 constats vérifiés, tous corrigés — dont l'évolution SDK `1.0.183` (`communInfo` déplacée `Answer` → `Form`, fuite `financer[]` éliminée) et le fix `commonTable` en lecture seule (`[object Object]`). Cf. §9. Commits `36b4a7dd` · `252b50e8` · `914dcec0` |

---

## 2. Objectifs de la configuration

1. **Référencer et rendre cherchable** l'ensemble des tiers-lieux (4 303).
2. Donner à voir la structuration du réseau : réseaux **régionaux** et **thématiques**.
3. Offrir un **observatoire** exploitable et exportable sur l'ensemble du jeu de données.
4. Permettre à un lieu de **s'ajouter lui-même** (formulaire costum + bouton flottant).
5. Animer : agenda des événements, campagne d'amplification.

---

## 3. Architecture générale

```
                 ┌──────────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json)                       │
                 │   12 pages · 22 sections                     │
                 │   header MEGA-MENU (4 groupes à enfants)     │
                 │   /lieux : panneau de filtres + résultats    │
                 │   /observatoire : 10 dimensions              │
                 │   /usages : catalogue d'outils (toolsCatalog)│
                 └──────────────┬───────────────────────────────┘
                                │ searchCostum — variant `navigator-tl`
                 ┌──────────────▼───────────────────────────────┐
                 │  Backend Cocolight — navigatorDesTierslieux  │
                 │  4 303 lieux · 358 événements                │
                 └──────────────────────────────────────────────┘
```

**Voie de filtrage : le PANNEAU.** `/lieux` emploie `gridLayout` + section `filters` (5 groupes) —
et non le hero à `dropdownFilters`. C'est l'un des rares sites du parc dans ce cas, avec
cyber-reunion et parent62. Les deux voies ne communiquent pas : ne jamais ajouter un `showSearch`
de hero sur une page à panneau, cela produit deux champs de recherche.

---

## 4. Ce que la config met en œuvre

### 4.1 Les 12 pages

| Page | Sections | Rôle |
|---|---|---|
| `/` | 11 | `hero-search` + résultats + **teaser agenda** + 5 blocs éditoriaux |
| `/lieux` | 1 | `gridLayout` — panneau de filtres (5 groupes) + `searchProStatic` |
| `/observatoire` | 1 | `data-observatory` — cf. §4.3 |
| `/reseaux-regionaux` · `/reseaux-thematiques` | 1 chacune | même périmètre, **deux angles** (cf. §4.2) |
| `/communaute` | 1 | `searchProStatic` |
| `/evenements` | 1 | `agenda` |
| `/usages` | 1 | `toolsCatalog` — catalogue d'outils d'usage (livré 06/08, review 10/08 — cf. §9) |
| `/api-donnees` | 1 | `html` — API et données ouvertes |
| `/mentions-legales` · `/confidentialite` · `/cgu` | 1 chacune | socle légal **présent et fourni** (≈ 3,5 k · 11 k · 12 k caractères) |

### 4.2 Deux pages, un périmètre, deux angles

`/reseaux-regionaux` et `/reseaux-thematiques` ont des `baseParams` **strictement identiques**
(`organizations` tagués `RéseauTiersLieux`, 19 résultats chacune). Ce n'est **pas** un doublon :
elles diffèrent par `defaultViewMode` (`regions` vs `thematics`), `enableRegions` /
`thematicSource`, et leurs cibles de renvoi (`regionsTarget` / `thematicsTarget` → `/lieux` avec un
`filterId` distinct). Le même ensemble est présenté sous deux lectures.

### 4.3 L'observatoire — le plus complet du parc

| | |
|---|---|
| Dimensions | 10 — `name`, `commune`, `departement`, `region`, `pays`, `typologie`, `portage`, `surface`, `compagnon`, `equipements` |
| Filtres | 7 — région, typologie, portage, surface, pays, département, compagnon |
| KPI | 5 — `count`, 2× `distinct`, `percentTrue`, `top` |
| Graphes | 6 — `bars` (région), `barsHorizontal` (typologie, portage, équipements), `donut` (surface, pays) |
| Table | oui · **export CSV** oui · **drill-down** activé |

Il porte sur **4 322 entités**, soit légèrement plus que les 4 303 des pages de recherche : les deux
périmètres ne sont pas identiques.

### 4.4 Formulaire costum, bouton flottant, ampli

- **`costumForms["tiers-lieux"]`** — `organizations`, **27 champs déclarés dont 19 placés**,
  5 sections. Sur les 8 non placés, une partie sont des sous-champs de widgets composites (adresse,
  réseaux sociaux) ; cf. le piège du §12.
- **Bouton flottant** « Ajouter un Tiers-Lieu » (bas-gauche, icône `square-plus`) → modale
  `add-tiers-lieux`, gardée par `condition: {auth: …}`. Depuis le 28/07, le garde d'authentification
  de `DynamicModal` prend le relais si la condition venait à sauter.
- **Campagne `ampli`** « amplifions » (`layout: fullwidth`, adossée à un CoForm). C'est **la seule
  config du parc** à employer le module `ampli` — la référence pour tout portage similaire.
- **Palette ⌘K** activée avec `entitySearch`.

---

## 5. Modèle de données réel (sondé le 2026-07-28)

`config:probe` — **10 périmètres, 10 peuplés, 0 vide** :

| Périmètre | Résultats |
|---|---|
| `/observatoire` | **4 322** |
| `/` (hero + résultats) · `/lieux` | **4 303** (les trois) |
| `/` (teaser agenda) · `/evenements` | **358** événements |
| `/communaute` | 31 |
| `/reseaux-regionaux` · `/reseaux-thematiques` · filtre `entityList` de `/lieux` | 19 (les trois) |

De très loin le plus gros jeu de données du parc — pour mémoire, institut-bleu en compte 48 et
rezo-la-mer 79.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.tiers-lieux.json`](../config.prod.tiers-lieux.json) |
| Thème | [`../src/index-tiers-lieux.css`](../src/index-tiers-lieux.css) |
| Déclaration | [`../sites.json`](../sites.json) → `navigatorDesTierslieux` |
| Formulaire costum | [`../src/modules/profil/forms/costum/`](../src/modules/profil/forms/costum) — id `tiers-lieux` |
| Panneau de filtres | [`../src/modules/search/sections/FiltersSection.tsx`](../src/modules/search/sections/FiltersSection.tsx) |
| Observatoire | [`../src/modules/observatoire/`](../src/modules/observatoire) |
| Ampli | [`../src/modules/ampli/`](../src/modules/ampli) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Variant SDK **`navigator-tl`** | Endpoint dédié au navigateur des tiers-lieux. Toute sonde ou tout outil qui l'ignore appelle un AUTRE endpoint et rapporte des chiffres faux — `config-probe` le lit explicitement |
| Panneau `filters` plutôt que hero à `dropdownFilters` | 5 axes de filtrage simultanés sur 4 303 entités : un panneau latéral tient là où une barre de hero sature |
| Deux pages pour un même périmètre | Régions et thématiques sont deux lectures d'un même ensemble de 19 réseaux ; les dupliquer en données serait pire |
| Agenda en **teaser** sur `/` + page dédiée | Patron repris depuis par institut-bleu (`showTabs: false`, `limit`, `customHeader`) |

---

## 8. Étapes de mise en place

```bash
PORT=5245 VITE_SLUG=navigatorDesTierslieux \
  SITE_CONFIG_PATH=config.prod.tiers-lieux.json \
  SITE_CSS_PATH=src/index-tiers-lieux.css \
  node server/dev-server.js

npm run config:validate -- config.prod.tiers-lieux.json
npm run audit:config    -- --file config.prod.tiers-lieux.json
npx tsx scripts/config-probe.ts config.prod.tiers-lieux.json
```

---

## 9. Impacts des modifications

### 10/08 — review MR#33 : module `toolsCatalog` (page `/usages`)

Review multi-agents du diff `mr33-review` vs `main` (46 candidats → 44 confirmés par vérification
adverse → 15 constats retenus), puis application des correctifs, eux-mêmes contre-vérifiés par une
seconde passe adverse (6 réserves mineures, 5 corrigées — la 6ᵉ, garde dirty désarmée entre étapes
d'un form multi-step, est un comportement hérité de tout le module coform, hors périmètre).
**Les 15 constats sont corrigés.** Trois thèmes dominants :

| Thème | Correctifs (commit `252b50e8`) |
|---|---|
| Perte de données dans les dialogs | Garde « modifications non enregistrées » sur Échap/overlay/Annuler (2 modales, pattern `CoFormModal`) ; vraie prop `disabled` sur `SelectObject` (le `pointer-events-none` laissait passer le clavier → no-op silencieux) ; blob URL d'aperçu en handler + révoquée au démontage ; upload d'image réutilisé entre tentatives (plus d'orphelin par retry) |
| Couche React Query | Soumission du questionnaire → invalidation du catalogue ; instance `Form` partagée (`ensureQueryData(FORM_INSTANCE)`, un seul téléchargement au lieu d'un par page/détail/commun) ; config invalide → état vide + warn DEV (plus de squelette perpétuel) ; erreur `useCommunList` affichée |
| Erreurs & divers | Une erreur ne remplace jamais les pages chargées (retry inline) — `isFetchNextPageError`/`isFetching` exposés par `useInfiniteQueryScroll` ; bouton « Répondre » visible déconnecté → `openLogin({onSuccess})` (règle 11) ; image d'outil sur hôte tiers en `<img>` brut (hostname, contrat de l'allowlist `/img`) ; `hidePageChrome` sur les vues coform en modale (Helmet/h1) ; 2 liens legacy de la config → `/usages` ; liens `ContentSection` via `NavLink` (SPA) |

**Évolution SDK obtenue** (constat n°9, inapplicable côté site) : `communInfo` déplacée
`Answer` → `Form` en **`1.0.183` publiée sur npm** (commit `36b4a7dd`) — `api.answer({id})`
déclenchait un `get()` téléchargeant le doc AAP complet (`financer[]` nominatif) dans le navigateur,
à l'encontre de la projection minimale `auth: none` de l'endpoint. Cf. §11.

**Fix connexe coform** (commit `914dcec0`, trouvé au test navigateur par Thomas) : les champs
`commonTable` en lecture seule rendaient `[object Object]` par catégorie d'usage — branche dédiée
réutilisant `CommonTableField` en `readOnly`/`hideLabel` + `formId` (parité badges contributeurs).

| Gate (10/08) | Résultat |
|---|---|
| `npx eslint` (fichiers touchés) | ✅ 0 |
| `tsc -b --noEmit` | ✅ 0 |
| `test:unit` (unit + préflights) | ✅ 191 fichiers / 2 346 tests |
| `config:validate` | ✅ **12 pages / 22 sections** |

Commits : `36b4a7dd` (deps SDK 1.0.183) · `252b50e8` (15 correctifs) · `914dcec0` (readonly
commonTable). Reste non couvert : e2e navigateur du parcours catalogue complet (scroll infini,
modales, enrichissement).

### 09/08 — propagation des tags depuis le formulaire (typologie / portage / surface)

**Constat** (workflow d'analyse 3 facettes `wf_35da462c`) : les facettes du search — typologie,
portage, surface — filtrent le champ `tags` sur des **libellés** (« Bureaux partagés / Coworking »,
« SCIC », « Plus de 200m² »), mais le formulaire costum écrit `typePlace` / `manageModel` /
`surfaceBuilt` dans des **champs structurés en slugs** et n'ajoutait à `tags` que `mainTag` +
`compagnon`. Conséquence : un lieu **créé via site-json apparaissait dans la liste de base et sous la
facette Compagnon, mais dans AUCUNE facette typologie / portage / surface**. Ce n'est pas une
régression du chantier `stamps` — l'ex-`buildTiersLieuxPayload` ne mergeait déjà que mainTag +
compagnon. Le legacy comble ce trou côté **CLIENT** (hook JS `formData`, `delete data[e]`), **pas**
par un hook serveur (le serveur ne dérive que la tranche m² + un renfort `TiersLieux`). Mongo
confirme le modèle « tout dans `tags` » : sur 4 319 orgs `TiersLieux`, seules 44 portent un champ
`typePlace`, 47 `manageModel`.

**Correctif** (Option B + m² côté client) — 3 stamps `append tags` `on:"both"` ajoutés à
`costumForms["tiers-lieux"].mutation.stamps` (aucun champ ni endpoint nouveau) :

| Stamp | Source | Effet |
|---|---|---|
| typologie | `$mapLabels(typePlace, sep:",")` | slugs → libellés (facette typologie) |
| portage | `$mapLabels(manageModel)` | slug → libellé (facette portage) |
| surface m² | `$bucket(buildingSurfaceArea, <60/≤200/>200)` | nombre → tranche (dimension observatoire surface) — **port CLIENT** du bucket serveur `ReseauTierslieux::elementAfterSave`, gelé par le garde ACTIVATION |

Les maps slug→libellé sont **dérivées des options des `filterGroups`** (source de vérité des
libellés cherchés). Le moteur `stamps.ts` a gagné 2 sources de valeur (`$mapLabels`, `$bucket`) —
cf. [Module formEngine §mutation.stamps](../doc/28-module-formengine.md). Divergence assumée : le
legacy pousse **sans idempotence** (doublons dans `tags`) ; notre `append` union-dédup est plus
propre. En review, `sep` du stamp typePlace passé `", "` → `","` (découplé du séparateur du
sérialiseur `multiCsv:write` — `tokens()` trim, tolérant aux deux).

**Bug attrapé par le test d'intégration** : les stamps lisent le PAYLOAD **post-pipeline** (serveurs
keys), pas les champs du form. Le `$bucket` visait `surfaceBuilt` (nom de champ) alors que le champ
sérialise vers `path: "buildingSurfaceArea"` → la tranche m² n'était JAMAIS produite (ni en test ni
en prod). Corrigé `from: "buildingSurfaceArea"`. `typePlace`/`manageModel` coïncident (champ =
serverKey), d'où le piège masqué. Le test `tags-propagation.test.ts` (vraie chaîne
`buildPayload`+stamps) l'a révélé là où une simulation à payload forgé l'avait manqué.

**Preuve e2e** (moteur + config réels) : `typePlace="coworking, fablab" | manageModel="scic" |
surfaceBuilt=350` → `tags = [TiersLieux, Compagnon…, Bureaux partagés / Coworking, Fablab…, SCIC,
Plus de 200m²]`.

| Gate (09/08) | Résultat |
|---|---|
| `tsc -b --noEmit` | ✅ 0 |
| tests stamps / tiers-lieux / préflights | ✅ dont `tags-propagation.test.ts` (vraie chaîne `buildPayload`+stamps → chaque tag ∈ vocabulaire de facette/observatoire) et `server/__tests__/sites.test.ts` (fix middleware) |
| fixtures régénérées | `__effective__/tiers-lieux.json` (garde d'impact) + `compiled.byteparity` — diff = 3 stamps + `sep` |
| `config:validate` | ✅ 11 pages / 21 sections |

**Commité depuis** (arrivé sur `mr33-review` via le merge de `main`) : `9bbd7a4d` (stamps) et
`4831f146` (middleware `imageUpload`). **Non porté** (non bloquant) : le renfort `TiersLieux` de la
voie UPDATE côté Node (`elementAfterUpdate` déféré) — le stamp mainTag le pose déjà.

### 28/07 — aucun changement de config

Ce site n'a pas été modifié. Il a en revanche **bénéficié de correctifs du moteur** livrés pour
d'autres projets, tous vérifiés non régressifs à son égard :

| Correctif | Effet ici |
|---|---|
| `agenda.maxWidth` (`23cdbd94`) | **Aucun** — clé absente, l'agenda garde son `container` historique |
| `CardEvent` sans image (`0aed89c6`) | Ses 24 événements sondés n'ont **aucune image** : ils passent tous sur la variante typographique, donc une grille homogène et non plus 288 px de vide par carte |
| `useItem` → repli `profilImageUrl` (`0aed89c6`) | Aucun de ses événements ne porte ce champ non plus : sans effet |
| Garde d'authentification (`f24a6531`) | Le bouton flottant « Ajouter un Tiers-Lieu » hérite d'une invitation à se connecter si sa `condition` venait à être retirée |
| `charts[].colors` sur bars (`5269fc8e`) | Aucun de ses 6 graphes ne déclare `colors` : sans effet |

### Gates au 28/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 11 pages / 21 sections |
| `audit:config` | ✅ **0 constat** |
| `config:probe` | ✅ **10 périmètres, 10 OK, 0 vide** |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `navigatorDesTierslieux` |
| 2 | Thème | ✅ | Bloc `theme` complet + 54 variables |
| 3 | Recherche des lieux | ✅ | `/lieux` — panneau à 5 groupes sur 4 303 entités |
| 4 | Observatoire | ✅ | 10 dimensions, 7 filtres, 6 graphes, table, export CSV, drill-down |
| 5 | Réseaux régionaux / thématiques | ✅ | Deux angles sur 19 réseaux |
| 6 | Agenda | ✅ | Teaser sur `/` + page dédiée — 358 événements |
| 7 | Ajout d'un tiers-lieu | ✅ | Formulaire costum (27 champs) + bouton flottant |
| 8 | Campagne `ampli` | ✅ | « amplifions » — **seul emploi du module dans le parc** |
| 9 | Palette ⌘K | ✅ | `entitySearch` |
| 10 | Socle légal | ✅ | Mentions légales, confidentialité, CGU — rédigées, non réduites à des trames |
| 11 | API et données ouvertes | ✅ | Page `/api-donnees` |
| 12 | Rendu navigateur | ❌ | **Jamais vérifié** dans le cadre de ce dossier |
| 13 | Mode sombre | ❌ | Jamais vérifié |
| 14 | Propagation des tags depuis le form (typologie/portage/surface) | 🟡 | 3 stamps `$mapLabels`/`$bucket` + test d'intégration vraie chaîne (6/6) — commité (`9bbd7a4d`) ; reste l'e2e navigateur live (créer un lieu → facettes) |
| 15 | Middleware `imageUpload` : dossier ← champ `images` de `sites.json` | ✅ | `imageFolderForSlug` + test 7/7 ; tue le dossier fantôme + l'upload dans un dossier non servi. Commité (`4831f146`) |
| 16 | Catalogue d'outils `/usages` (module `toolsCatalog`) | 🟡 | Livré 06/08 (`85520742`, corrections `2a1803ea`) ; review MR#33 le 10/08 : **15 constats corrigés** (`252b50e8`), SDK `1.0.183` (`36b4a7dd`), fix readonly `commonTable` (`914dcec0`) — gates verts. Reste : e2e navigateur du parcours complet |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

SDK installé : **`^1.0.183`**. Le module `toolsCatalog` (page `/usages`, livré le 06/08) consomme
cinq endpoints déployés côté backend, **tous couverts par le SDK `1.0.183` publié sur npm**
(résolu depuis le registre, vérifié le 10/08) : un `npm install` propre compile, le lien local
n'est plus nécessaire. Contrat détaillé dans `commentaire/sdk-tools-catalog.md` (notes locales,
hors dépôt).

| Demande | État | Preuve / substitut |
|---|---|---|
| `Form.toolsCatalog()` — liste paginée du catalogue (`COSTUM_TOOLS_CATALOG`) | ✅ `1.0.183` | Action `ToolsCatalogListAction.php` déployée (costum `15c5a91af`). ⚠️ Ne PAS router via `_createPaginatorEngine` : `_linkEntities` jette les DTO sans `collection` |
| `Form.getToolUsers()` — lieux utilisateurs d'un outil (`COSTUM_TOOL_USERS`) | ✅ `1.0.183` | `ToolUsersAction.php` déployée ; recherche par `criteriaIds`, jamais par regex sur le nom |
| `Form.communInfo()` — fiche du commun rattaché (`COSTUM_COMMUN_INFO`) | ✅ `1.0.183` | Déplacée d'`Answer` vers `Form` en `1.0.183` : `api.answer({id})` fetchait le doc AAP complet (fuite `financer[]` nominatif), `api.form({id})` ne charge que la définition publique. `formId` = verrou anti-IDOR (endpoint `auth: none`) |
| `BaseEntity.saveToolEnrichment()` — édition d'un outil (`COSTUM_SAVE_TOOL_ENRICHMENT`, bearer) | ✅ `1.0.183` | `SaveCriteriaAction.php` durcie (elle écrivait sans aucun contrôle d'accès). ⚠️ Sur `BaseEntity`, pas `Organization` — cf. §12 |
| `BaseEntity.getCommunList()` — options du select de rattachement (`COSTUM_COMMUN_LIST`, bearer) | ✅ `1.0.183` | `CommunListAction.php` déployée ; remplace un appel legacy qui ramenait ~300 réponses AAP entières |
| Upload de l'image d'un outil | ✅ présent | `entity.uploadDocument(file, {contentKey: "icons", docType: "image"})` — même `contentKey` que le legacy |

La config dépend par ailleurs du variant **`navigator-tl`** : toute évolution de cet endpoint la
touche en premier.

---

## 12. Points d'attention / limitations

- ⚠️ **Le costum vit dans la collection `projects`, pas `organizations`.** Sondé le 28/07 sur les
  12 costums du parc : seuls **`navigatorDesTierslieux` et `eXtremeDefiAdeme`** sont dans ce cas,
  les 9 autres résolus sont en `organizations`. Tout script qui suppose `organizations` en résolvant
  l'entité costum se trompera ici. **Cas vécu le 06/08** : deux méthodes SDK posées sur
  `Organization` au lieu de `BaseEntity` → `is not a function` **au runtime**, avec un `tsc` vert
  des deux côtés (le `entity as Organization` côté consommateur est un cast sans effet à
  l'exécution). Toute méthode passant par `_withCostumContext` va sur `BaseEntity`.
- ⚠️ **Variant `navigator-tl`** : une requête émise sans ce variant frappe un autre endpoint et
  renvoie d'autres chiffres. C'est le piège que `config-probe` documente explicitement.
- **Volume** : 4 303 entités. Tout réglage de pagination, de plafond (`maxResults`) ou de rendu de
  carte se comporte ici différemment des sites à quelques dizaines de fiches.
- **27 champs déclarés au formulaire costum, 19 placés.** Un champ non placé dans une section
  **n'est jamais rendu** (le moteur parcourt `sections → groups → fields[]`). Avant de traduire ou
  de renommer un champ, vérifier qu'il est placé — cf. [[project-sport-sante-bien-etre]].
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement.
- L'observatoire porte sur 4 322 entités là où les pages de recherche en voient 4 303 : les deux
  périmètres diffèrent légèrement. Écart non expliqué à ce jour.
- ⚠️ **Couplage création ↔ search par `tags` (libellés).** Les facettes typologie/portage/surface
  filtrent `tags` sur des LIBELLÉS ; c'est `mutation.stamps` (`$mapLabels`/`$bucket`, §9) qui les y
  recopie depuis les slugs du form. Le contrat implicite : **les libellés poussés doivent rester
  ceux des options des `filterGroups`**. Modifier une option de facette (renommer un libellé) sans
  ajuster la map du stamp — ou l'inverse — recrée l'invisibilité au search. Les deux sont dérivés de
  la même source dans la config, mais aucune garde ne le verrouille encore.
- ⚠️ **Dossier `public/images/navigatorDesTierslieux/` fantôme.** Le vrai dossier d'images du site
  est `public/images/tiersLieux/` (déclaré par `sites.json` → `images: "tiersLieux"`, découplé du
  slug). Le middleware `server/middleware/imageUpload.js` crée `public/images/<VITE_SLUG>/` **au
  montage** du dev-server (keyé sur `VITE_SLUG`, pas sur le champ `images`) → lancer le dev sous
  `VITE_SLUG=navigatorDesTierslieux` fabrique un dossier VIDE que le préflight `site-assets` refuse.
  Corollaire plus grave : un upload AdminPanel sous ce slug atterrirait dans un dossier **qu'aucun
  site ne sert** (accident `jardin`/`jardinCommuns`, 19 Mo). **Corrigé le 09/08** : le middleware
  résout son dossier via `imageFolderForSlug` (champ `images` de `sites.json`, fallback slug ;
  `server/utils/sites.js` + test `server/__tests__/sites.test.ts`) → upload dans le dossier servi,
  plus de dossier fantôme. `sites.json` absent (Docker) → fallback slug, aucune régression. Cf.
  [[site-json-images-folder-vite-slug]].

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | Écart 4 322 (observatoire) vs 4 303 (recherche) : d'où viennent les 19 entités de différence ? | Thomas |
| 2 | Rendu navigateur et mode sombre : jamais vérifiés dans le cadre de ce dossier | Thomas |
| 3 | Les 8 champs non placés du formulaire costum sont-ils tous des sous-champs de widgets composites, ou reste-t-il des vestiges à purger ? | Thomas |
| 4 | Le module `ampli` n'est employé que par ce site. Sa campagne « amplifions » est-elle le patron à reprendre pour rezo-la-mer (`amplifions-le-sens-océanique`) ? | Thomas |
| 5 | ✅ Fait (09/08) — `imageUpload` résout le dossier via le champ `images` de `sites.json` (cf. §12). | Claude |
| 6 | ✅ Fait (10/08) — les chantiers du 09/08 sont arrivés via le merge de `main` (`9bbd7a4d`, `4831f146`) ; la review MR#33 est commitée (`36b4a7dd`, `252b50e8`, `914dcec0`). Reste les e2e navigateur live : créer un lieu → facettes, et parcours catalogue `/usages` complet | Thomas |
| 7 | La garde « modifications non enregistrées » des coforms multi-step se désarme à chaque changement d'étape (reset du form) — trou commun à `CoFormModal`, `PlaceFormView` et `ToolsAnswerDialog`, atténué par le brouillon localStorage. Chantier coform à ouvrir ? | Thomas |
