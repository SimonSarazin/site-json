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

Dernière mise à jour : **2026-09-29** (alerte « tiers-lieu déjà existant » à la création — bloc `duplicateCheck` + slot générique `slot:entityDuplicates`, cf. §9 29/09).

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
| SDK | `@communecter/cocolight-api-client` **1.0.184** (`package.json` : `^1.0.184`, commité `c12f2e43` ; résolu depuis npm, plus de lien local — cf. §11) |
| Historique | **76 commits** — la config la plus travaillée du parc |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction complète ; dernier passage `fb1d6a09` (merge `origin/main` dans `feat/refonte-assistant-config`) |
| 28/07 | Claude | État des lieux et création de ce dossier |
| 09/08 | Claude | Propagation des tags typologie/portage/surface via `mutation.stamps` (`$mapLabels`/`$bucket`) — cf. §9 ; test d'intégration (a révélé le bug serverKey `buildingSurfaceArea`) ; fix middleware `imageUpload` (dossier ← champ `images`). Commité (`9bbd7a4d`, `4831f146`) |
| 10/08 | Thomas + Claude | Review MR#33 du module `toolsCatalog` (branche `mr33-review`) : 15 constats vérifiés, tous corrigés — dont l'évolution SDK `1.0.183` (`communInfo` déplacée `Answer` → `Form`, fuite `financer[]` éliminée) et le fix `commonTable` en lecture seule (`[object Object]`). Cf. §9. Commits `36b4a7dd` · `252b50e8` · `914dcec0` |
| 10/08bis | Schumann + Claude | Bug de données du détail d'un outil : sélection sur le seul `criteriaId` → 61 % des lieux listés attribuaient un outil qu'ils n'avaient jamais saisi. Fix backend + front `normalizedName`, libellés de satisfaction alignés sur l'input `commonTable`. Cf. §9 10/08bis |
| 11/08 | Thomas + Claude | Demande SDK **livrée** : `normalizedName` sur `COSTUM_TOOL_USERS` (lib `d93c7c3`, npm `1.0.184`) + endpoints d'invitation (lib `ca7d65e`, même version). Réinstallation propre (`npm ci`), contenu du tarball vérifié, gates verts. Bump commité `c12f2e43` ; §11/§11.1 mises à jour |
| 29/09 | Peterson + Claude | Alerte non bloquante « tiers-lieu déjà existant » dans le wizard de création, confirmation à la soumission si nom et code postal coïncident — slot générique config-driven, aucun endpoint nouveau (cf. §9) |

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

### 4.1 Les 14 pages

| Page | Sections | Rôle |
|---|---|---|
| `/` | 11 | `hero-search` + résultats + **teaser agenda** + 5 blocs éditoriaux |
| `/lieux` | 1 | `gridLayout` — panneau de filtres (5 groupes) + `searchProStatic` |
| `/observatoire` | 1 | `data-observatory` — cf. §4.3 |
| `/reseaux-regionaux` · `/reseaux-thematiques` | 1 chacune | même périmètre, **deux angles** (cf. §4.2) |
| `/communaute` | 1 | `searchProStatic` |
| `/actualites` | 2 | `searchHeader` + `tabs` — onglet **Actus** (`articleFeed`) / onglet **Événements** (`agenda`, 3 `sourceKey`). **Remplace `/evenements`** (07/09, cf. §9) |
| `/blog` | 1 | `articleFeed` — liste canonique du module blog : cible du repli du lecteur `/blog/:slug` et du `<link>` de canal du flux RSS |
| `/annuaire-ressources` | 2 | `title` + `coform-resource-directory` |
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
  5 sections, **1 slot** (`$slot:duplicates`, posé aux étapes `info` et `contact` — détection de
  doublons à la création, §9 29/09). Sur les 8 non placés, une partie sont des sous-champs de widgets composites (adresse,
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
| `/` (teaser agenda) · `/actualites` (onglet Événements) | **358** événements |
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
| Détection de doublons à la création (29/09) | Config : `slots` + `duplicateCheck` + `$slot:duplicates` (sections `info` et `contact`) + `searchKeys` de l'invalidation · moteur générique : `src/modules/profil/forms/EntityDuplicatesSlot.tsx`, `forms/useDuplicateSubmitGuard.tsx`, `hooks/useEntityDuplicates.ts`, `lib/entityDuplicates.ts`, `lib/duplicateSearch.ts`, `src/lib/foldText.ts` · pipeline : `forms/entityModalSpec.ts`, `costum/costumFormSchema.zod.ts`, `costum/compileCostumSchema.ts`, `resolveModalSpec.ts`, `specRegistries.ts`, `costum/sharedFns.ts`, `EntityFormModal.tsx` · `formEngine/layouts/shared.tsx` (`empty:hidden`) — cf. [`../doc/28-module-formengine.md`](../doc/28-module-formengine.md) § « Détection de doublons à la création » |
| Panneau de filtres | [`../src/modules/search/sections/FiltersSection.tsx`](../src/modules/search/sections/FiltersSection.tsx) — + flag `keepOptionOrder` |
| Observatoire | [`../src/modules/observatoire/`](../src/modules/observatoire) |
| Ampli | [`../src/modules/ampli/`](../src/modules/ampli) |
| Annuaire ressources (`/annuaire-ressources`, 08/09) | Section `coform-resource-directory` (module `search`), variant `searchCostum` `navigator-tl-ressource` — cf. `../doc/07-module-search.md` § `coform-resource-directory` |

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

### 24/09quater — encart d'une fiche : le nombre de PLACES d'hébergement, pas le nombre d'offres

**Bug.** L'encart « Réserver en ligne » affichait « 1 chambre » sur La Plume à Loup, qui déclare
10 places. Le compteur d'hébergement était réglé sur `bedRoomPath.type: "answer"` — « compte les
RÉPONSES au formulaire » — et le lieu n'a déposé qu'une offre. Les deux autres lignes du même encart
ne comptent pas ça : le coworking additionne le champ `place` (`single`), les salles comptent les
lignes d'un tableau (`array`).

**Correctif (config, une ligne)** : `profile-info-tl.bedRoomPath.type` passe à `"single"`, donc la
somme du champ `place` — le même champ que le coworking, qui affiche déjà des « postes de travail ».
**Libellés** alignés : « chambre / chambres » devient « place d'hébergement / places d'hébergement »
(`room/rooms` → `accommodation space(s)`), sans quoi on afficherait « 10 chambres » pour 10 places.
`profile-about-tl` garde `"answer"` : il LISTE les offres, et ses branches `single` et `answer` y sont
identiques.

**Racine du bug, traitée** : rien ne documentait ce que valent `single`, `array` et `answer` — le
schéma typait ces objets en `z.record(z.string(), z.string())`. Les trois modes sont désormais
décrits dans le schéma et dans `doc/08-module-profil.md`, et la logique, qui était **recopiée trois
fois** dans le composant (la copie des salles ayant perdu la branche `answer` au passage), vit dans
une fonction pure testée, `compteRessources.ts` — 7 tests dont celui du bug.

**Non vérifiable en local** : ni la fiche ni le formulaire d'hébergement ne sont dans la base locale,
le nombre affiché ne peut donc être contrôlé que sur un environnement qui porte la donnée.
**Gates** : `typecheck` ✅ 0 erreur · `eslint` ✅ · `config:validate` ✅ (15 pages, 27 sections) ·
`audit:config` RAS (`config.prod.tiers-lieux.json` : trad 0, liens 0, inerte 0, assets 0, strip 0,
prereq 0) · `test:unit` 5 105/5 107 (les 2 échecs d'environnement habituels, étrangers au lot ;
+7 tests nets, `compteRessources.test.ts`).

### 28/09 — « Mes lieux » : page à 4 onglets (portage du legacy `listOrga`)

**Bouton demandé** : « Mes lieux », dans le sous-menu « Les lieux » du header ET le tiroir mobile
(les deux partagent le même `header.nav` — un seul ajout de config suffit aux deux). Config :
`header.nav[0].children` (entrée `visibility:{auth:"required"}`), nouvelle page `/mes-lieux`
(`auth.required: true`), nouvelle section moteur `my-places`.

**Correction en cours de route, importante.** La première implémentation lisait les fiches SUIVIES
(`links.follows`, `me.getSubscriptions()`) — une hypothèse partie de l'ancre `#favoris` de l'URL
legacy citée dans la demande. L'utilisateur a alors collé le VRAI code source de la vue legacy
(`costum.views.custom.franceTierslieux.listOrga`), qui a tout changé : « Mes lieux » = les
organisations dont le compte est **MEMBRE** (`links.members.<id>` existe, `isInviting` absent),
scopées au réseau (`$or[source.keys, reference.costum]` sur `franceTierslieux`/`tierslieuxbelgique`).
Corrigé sur `useUserOrganizations` (déjà dans le SDK, aucun ajout) + `sourceKey` de config. Le hook
`useUserSubscriptions` écrit par erreur a été supprimé (aucun autre appelant, jamais commité).

**4 onglets**, portés depuis le contrôleur PHP réel (lu en local, `~/dev/communecter-dev`, lecture
seule) :

| Onglet | Source de donnée | État |
|---|---|---|
| Mes tiers-lieux (défaut) | `useUserOrganizations` + `sourceKey` | ✅ livré |
| News | `useMemberNewsQuery` — `org.getNews()` **par lieu**, fusionné/trié (PAS un filtre `source.key` sur `news` : une 2ᵉ hypothèse invalidée en lisant `GetLikedNewsAction.php`, qui boucle par organisation) | ✅ livré |
| Agenda | `useLinkedEntitiesQuery` — `entity.searchCostum()` + filtre `$or` sur `links.attendees`/`links.organizer` des lieux membres | ✅ livré |
| Projets | idem, filtre `links.contributors` | ✅ livré |

Les onglets 2 à 4 ne se chargent qu'une fois VISITÉS (`enabled` sur l'onglet actif) — pas de rafale
de requêtes au premier rendu. Helpers purs testés séparément : `buildLinkedEntitiesFilter` (filtre
`$or` lien×organisation), `fusionnerEtTrierNews` (tri par date, portage de `News::sortNews`).

**Correctif moteur, hors du périmètre initial mais nécessaire** : `HeaderMegaMenu` (header de
tiers-lieux ET relief) ne consultait `item.visibility` NULLE PART — ni pour les items racine ni pour
leurs enfants — contrairement à `HeaderStacked`/`HeaderTransparentScroll`. Une entrée
`visibility:{auth:"required"}` se serait donc affichée à un visiteur anonyme, desktop comme mobile
(les deux rendus partagent le même `nav`). Corrigé par `navVisibility.ts` (2 fonctions pures,
testées : aplatir les conditions item+enfants dans l'ordre, reconstruire l'arbre filtré), branché
dans `HeaderMegaMenu.tsx`. Impact : les 2 sites `mega-menu` du parc (tiers-lieux, relief) — relief
n'a aujourd'hui aucune entrée `visibility`, donc rien n'y change visuellement.

**Vérifié** : 15 tests unitaires (5 hors composant : filtre `$or`, fusion des news, filtrage de
visibilité de nav ; 8 sur le composant `MyPlacesSection`, couvrant anonyme/connecté/onglets dérivés).
**Gates** : `typecheck` ✅ 0 erreur · `eslint` ✅ 0 erreur 0 avertissement sur les fichiers du lot ·
`config:validate` ✅ (15 pages, 27 sections) · `test:unit` 5 073/5 075 — 2 échecs d'environnement
local, étrangers au lot.

**Non vérifiable en local au moment de l'écrire** : les 4 onglets réels reposent sur
`entity.searchCostum()`/`getNews()` contre un backend — ni la base locale ni
`VITE_COSTUM_FORCE_LIVE` ne le permettent. Testé ensuite en réel par l'utilisateur (§ 28/09bis) : un
bug l'a confirmé. Le filtre `vote.<criteriaId>` que porte encore la spec SDK (onglet 5) est lui-même
un point ouvert côté legacy — cf. le document.

### 28/09bis — « Mes lieux » : deux correctifs remontés d'un test réel

**Agenda/Projets en 500 — `$or` en tableau, pas en objet.** `buildLinkedEntitiesFilter` envoyait un
tableau Mongo standard (`$or: [{...}, {...}]`). Le DSL Communecter n'accepte `$or` QU'en objet — déjà
documenté (`doc/05-schemas-sections.md` § `searchProStatic.defaultFilters.$or` : « un tableau
provoque une erreur 500 backend »), manqué à l'écriture. Confirmé par le test réel :
`MongoException: $or/$and/$nor entries need to be full objects`. Corrigé : le filtre construit
maintenant `{"$or": {"<champ>.<orgId>": {$exists:true}, …}}` — chaque clé déjà unique (les orgIds
diffèrent), donc aucune clause n'est perdue en passant de l'objet au tableau côté serveur.

**News — rendu aligné sur l'onglet « Actualités » d'une fiche.** Demandé : rendre comme
`/profil/<slug>/news`. La section réutilise désormais le VRAI `NewsItem` (module `news`), pas une
carte générique. ⚠️ **La première version ci-dessous (résolution par `source.key`) s'est révélée
CASSÉE en test réel — page blanche — corrigée le jour même, cf. §28/09ter.**

**Vérifié à ce stade** : régression sur `buildLinkedEntitiesFilter` : un test affirme explicitement
que le résultat n'est JAMAIS un tableau. **Gates** : `typecheck` ✅ 0 erreur · `eslint` ✅ 0 erreur
0 avertissement · `test:unit` 5 080/5 082 — mêmes 2 échecs d'environnement, étrangers au lot.

### 28/09ter — page blanche News corrigée, Agenda/Projets alignés sur le composant Agenda, SDK `answerdirectory` prototypé

**News — la résolution par `source.key` (§28/09bis) ne marche JAMAIS, corrigée.** Confirmé en lisant
`useNewsMutations.tsx` : `source.key` trace le COSTUM AMBIANT du site au moment de la création d'une
actu, PAS son organisation propriétaire — la correspondance échouait donc systématiquement, et
`NewsItem` rend `null` sans `currentEntity` résolue (`!formattedNews || !currentEntity`) : chaque
item invisible, toute la liste en silence, aucune erreur. `useMemberNewsQuery` est réécrit pour
porter l'organisation DÈS le fetch (un `getNews()` déjà PAR organisation) au lieu de la retrouver
après coup : retourne `ActuDeLieu[]` (`{news, lieu}`), plus de reconstruction heuristique. L'ancien
`organisationDeLActu` est supprimé (pas gardé en code mort).

**Agenda/Projets — clic → panneau latéral, carte Agenda réutilisée.** La section rendait via
`EntityCard`/tiroir générique. Remplacé par `SearchListView` (le composant de rendu du module
`search`, celui qu'utilise déjà `Agenda.tsx` lui-même) : clic sur un item → panneau de détail à
droite (`SwitchDetailsMode`), pas une navigation. Carte/aperçu Agenda = **exactement** la config par
défaut de `Agenda.tsx` (`card:{type:"event",detailsMode:"drawer"}`, `preview:{type:"event"}`) ; pour
Projets, aucun variant `"project"` n'existe dans `SearchCard`/`Preview` (vérifié en lisant leur
dispatch) — repli légitime sur `"default"`, pas un design inventé. Limite documentée en commentaire :
pagination non câblée pour ces deux onglets (`SearchListView` est un pur rendu, une seule page,
`indexStep:20`).

**SDK `answerdirectory` — prototypé sous l'autorisation ponctuelle du 28/09** (« fait comme expor pdf
agenda le answerdirectory », même périmètre que l'exception export PDF agenda du 21/08 : édition
locale de `cocolight-api-client/` autorisée, `git push`/`npm publish` toujours bloqués). Ajouté :
endpoint `FRANCETIERSLIEUX_ANSWERDIRECTORY` (`endpoints-copie.json`, régénéré via
`generate:module:publish`/`generate:methodeapi`) + variant SDK `franceTierslieux-answerdirectory`
(`BaseEntity.ts`, patron identique à `navigator-tl-ressource`). `typecheck`/`lint`/tests SDK verts
(140/140 unitaires ; les 135 échecs d'intégration sont un backend absent sur `127.0.0.1:5080`,
étrangers au lot). Dist reconstruit LOCALEMENT (`build:browser`/`build:node`/`build:esm:rollup` —
`site-json` pointe sur le SDK de travail via symlink, cf. [[reference_sdk_symlink_masque_version_lock]]
en mémoire) ; rien publié.

**Vérifié** : `site-json` `typecheck` ✅ · `eslint` (fichiers touchés) ✅ · `test:unit` 5 076/5 078
(mêmes 2 échecs d'environnement, `bundle-size`/`site-assets`, étrangers au lot) ; SDK `typecheck` ✅ ·
`lint` ✅ · `test` 140/140 (hors intégration, backend absent). Rien commité.

### 28/09quater — grille Agenda/Projets à 3 colonnes

**Grille Agenda/Projets corrigée.** `SearchListView` sans `columns` rend une seule colonne pleine
largeur — beaucoup trop large pour une carte agenda/projet dans ce digest compact. Passé
`columns:{sm:1,md:2,lg:3}` (mêmes valeurs déjà utilisées par `CoformResourceDirectorySection.tsx`,
donc déjà scannées par Tailwind — pas de classe dynamique non générée).

**Vérifié** : `site-json` `typecheck` ✅ · `eslint` (fichiers touchés) ✅ · `test:unit` 5 089/5 091
(mêmes 2 échecs d'environnement, étrangers au lot). Rien commité.

### 28/09sexies — cartes Agenda/Projets : le lieu membre lié s'affiche

**Demande.** Sur la carte Projet, afficher le tiers-lieu « parent » ; sur la carte Agenda, le
tiers-lieu organisateur — la liste de chaque onglet mélange les items de plusieurs lieux membres,
sans repère on ne sait pas lequel a fait remonter quoi.

**Investigation avant code (workflow CLAUDE.md)** : `SearchCard`/`CardDefault`/`CardEvent` (moteur
`search`, partagé par **tout le site**) n'ont aucun point d'extension par item ; muter les instances
`Organization`/`Event`/`Project` retournées est risqué (`serverData` est un getter réactif, une copie
superficielle casse le clic → aperçu). Deux options présentées, la première retenue par vous : un
prop générique `list.linkedLabels?: Record<string,string>` (map id item → libellé), rétrocompatible
(absent partout ailleurs → aucun effet sur les autres pages consommant ces cartes). Confirmé aussi :
« parent » = le lieu membre lié via `links.contributors` (aucun champ SDK littéral `parent` trouvé
sur `Project`), symétrique à `links.organizer` pour l'événement.

**Implémentation.** `ListConfSchema.linkedLabels` (nouveau, optionnel). `resolveLinkedLabels.ts`
(nouveau helper pur, `src/modules/profil/lib/`) croise `item.serverData.links.<champ>` avec les ids
des lieux membres déjà en mémoire (`mesLieux.organizations`, onglet 1 — aucun appel réseau
supplémentaire) et résout leurs noms. Câblé dans `MyPlacesSection.tsx` : Agenda lit `organizer`
STRICTEMENT (pas `attendees`, qui a servi à FILTRER la liste mais désigne des participants, pas un
organisateur) ; Projets lit `contributors`. `CardDefault.tsx`/`CardEvent.tsx` affichent un petit
badge (icône `Building2`, `text-muted-foreground` — même token que les autres lignes secondaires de
ces cartes, aucun nouveau risque de contraste) uniquement si `list.linkedLabels[id]` existe.

**Vérifié** : `typecheck` ✅ · `eslint` ✅ · +9 tests (6 sur `resolveLinkedLabels`, 3 d'intégration sur
`MyPlacesSection` — `SearchListView` mocké, comme `NewsItem` l'est déjà dans ce fichier, pour
verrouiller le prop transmis sans dépendre du rendu réel lazy/Suspense du moteur `search`) ·
`test:unit` 5 098/5 100 (mêmes 2 échecs d'environnement, étrangers au lot). ⚠️ Pas de vérification
navigateur réelle (pas d'outil de capture d'écran disponible dans cette session) — à valider
visuellement avant de considérer le lot terminé. Rien commité.

### 28/09septies — carte Projet : le badge « 0 projet » retiré, génériquement

**Demande.** Sur la carte Projet, `CardDefault.tsx` affichait TOUJOURS un badge « N projets »
(nombre de sous-projets, `links.projects`) — pertinent pour un porteur (organisation) mais absurde
sur la carte d'un item qui EST déjà lui-même un projet (« 0 projet » systématique, `links.projects`
n'existant pas sur un `Project`).

**Corrigé génériquement** (pas un correctif « Mes lieux ») : le badge est masqué quand
`collection === "projects"`, MÊME convention déjà utilisée par `CardOverlay.tsx` pour distinguer le
rendu par type d'entité — repris tel quel plutôt que réinventé. `CardDefault` étant le moteur
partagé du site, ce correctif s'applique à TOUS ses consommateurs (recherche globale, annuaires…),
pas seulement à « Mes lieux ».

**Vérifié** : `typecheck` ✅ · `eslint` ✅ · +2 tests (nouveau `CardDefault.test.tsx` — masqué pour un
projet, inchangé pour une organisation) · `test:unit` 5 100/5 102 (mêmes 2 échecs d'environnement,
étrangers au lot). Rien commité.

### 30/09 — onglet Agenda de « Mes lieux » : sous-onglets À venir/En cours/Passés ; nav « Mes lieux » déplacée

**Onglet Agenda.** Par défaut, ne montre plus que les événements À VENIR (le legacy et l'ancien
comportement mélangeaient tout, passés compris, sans repère). Câblé en 3 sous-onglets — mêmes
libellés et même règle de répartition que le composant Agenda du site (`partitionByTime`,
`src/modules/agenda/lib/partitionByTime.ts`, réutilisé tel quel, aucune règle de bucketing
réinventée) : « À venir » (défaut), « En cours », « Passés ». Bucketing CLIENT sur les items déjà
chargés par `useLinkedEntitiesQuery` (digest personnel, volume faible) — pas un nouvel appel réseau.

**Nav « Mes lieux ».** Déplacée en dernière position du sous-menu « Les lieux » (desktop et tiroir
mobile partagent la même donnée `header.nav`), juste après « Coworking, salles & hébergements ».
Au passage, description corrigée : « Les tiers-lieux que vous suivez » → « … dont vous êtes membre »
(texte resté sur l'ancienne sémantique « suivi », déjà corrigée dans le code depuis le 28/09).

**Vérifié** : `typecheck` ✅ · `eslint` ✅ · `config:validate` ✅ (15 pages, 27 sections) ·
`audit:config` RAS · +4 tests (2 sur le câblage des sous-onglets Agenda, dates de mock ajoutées aux
2 tests existants qui en manquaient) · `test:unit` 5449/5451 (mêmes 2 échecs d'environnement,
étrangers au lot) · exemple `header-mega-menu` (assistant config) resynchronisé
(`config:example -- header-mega-menu --write`) après déplacement de l'entrée de nav. Rien commité.

### 30/09bis — liens « Se réunir »/« Coworker »/« Séjourner » : `/annuaire-ressources` filtré, pas `/lieux`

**Demande.** Ces 3 entrées du menu « Les lieux » (+ la carte d'accueil « Se réunir ») pointaient vers
`/lieux?services=…` — l'annuaire des TIERS-LIEUX filtré par service déclaré sur leur fiche. Elles
doivent pointer vers `/annuaire-ressources` (l'annuaire des RESSOURCES réservables — coworking,
salles, hébergement, cf. §21/09), filtré sur le bon type.

**Deep-link générique ajouté**, pas un cas spécial. `CoformResourceDirectorySection.tsx`
(`/annuaire-ressources`) avait déjà sa facette « Type de ressource » (`selectedFilters.resourceType`,
coché à la main) mais aucune lecture d'URL. Câblé avec `usePageFiltersUrlSync` — le MÊME hook
générique qui fait déjà fonctionner `/lieux?services=…`/`?typologies=…` (`computeFiltersFromUrl`,
partagé avec `FiltersSection`) — sur un groupe minimal `{id: "resourceType", options: [...]}`
dérivé des `resourceTypes` déjà configurés. `?resourceType=meeting-room|coworking|accommodation`
pré-coche donc la facette au chargement, sans logique de lecture d'URL réinventée.

Liens mis à jour : nav « Se réunir »/« Coworker »/« Séjourner » (`/annuaire-ressources?resourceType=
meeting-room|coworking|accommodation`) et la carte d'accueil « Se réunir » (seule des 3 à avoir un
raccourci sur la page d'accueil — pas d'équivalent Coworking/Hébergement à y corriger).

**Vérifié** : `typecheck` ✅ · `eslint` ✅ · `config:validate` ✅ (15 pages, 27 sections) ·
`test:unit` 5449/5451 (mêmes 2 échecs d'environnement, étrangers au lot) · exemple `header-mega-menu`
resynchronisé (2e fois du jour, même cause : déplacement/édition d'entrées de `header.nav`). ⚠️ Pas
de vérification navigateur réelle (pas d'outil de capture d'écran dans cette session) — le mécanisme
de deep-link est réutilisé tel quel (déjà en service sur `/lieux` et la home), mais son application à
CETTE page n'a pas été rejouée à l'œil ; à valider avant de considérer le lot terminé. Rien commité.

⚠️ **Corrigé le 30/09ter** : le `usePageFiltersUrlSync` posé ci-dessus était de trop — cf. l'entrée
suivante, il a été retiré.


### 30/09ter — 2 correctifs `/annuaire-ressources` (recherche texte tentée puis retirée)

**Retour utilisateur, 2 bugs.**

1. **Boucle de filtrage infinie au clic sur un lien de menu depuis `/annuaire-ressources`.** Cause :
   le `usePageFiltersUrlSync` posé en 30/09bis était un DEUXIÈME mécanisme de synchro URL↔filtres,
   en plus de celui déjà intégré à `FiltersSection` (rendue en sidebar sur cette même page, avec sa
   propre facette « Type de ressource »). `FiltersSection` a sa propre garde anti-boucle
   (`lastSyncedSearch`/`urlHydrated`) sur le MÊME état partagé `PageFilters` — deux écrivains non
   coordonnés sur le même contexte produisaient la boucle observée. Retiré : `FiltersSection` seule
   suffit, `?resourceType=…` fonctionne déjà par son mécanisme existant (aucun hook à réinventer).
2. **Croix de fermeture de l'aperçu ressource masquée derrière le badge de capacité.** Les deux sont
   `absolute … top-3/4 right-3/4` dans le même coin ; la croix (posée par la coque `DetailsModeDialog`,
   sans z-index explicite) passait dessous. Fix côté coque (`[&>[data-slot=dialog-close]]:z-20`),
   pas côté preview : protège pareil toute future preview qui poserait un contenu en haut à droite.

Une recherche texte libre (barre dédiée, câblée sur `useSearchQuery`'s `searchText`) avait été
ajoutée dans ce lot puis **retirée sur demande** : `searchText` reste `""`, docstring de la section
revenue à « Pas de recherche texte », clés i18n `resourceDirectory.searchPlaceholder`/`clearSearch`
retirées fr/en. Aucune trace du composant `ResourceDirectorySearchBar` dans le code final.

**Vérifié** : `typecheck` ✅ · `eslint` ✅ · `test:unit -- src/modules/search` 673/673 (module entier,
après retrait).
⚠️ Pas de vérification navigateur réelle (pas d'outil de capture d'écran dans cette session) : les 2
correctifs sont tracés par lecture de code, pas rejoués à l'œil. Rien commité.


### 30/09quater — 2 correctifs manqués/insuffisants du lot précédent

**Retour utilisateur, la home pointait encore vers `/lieux?services=…`.** La page d'accueil a en
réalité **deux** sections de cartes d'action sur `/` : `actions-principales` (type `cards`, corrigée
en 30/09bis) et une **deuxième section dupliquée**, `tiers-lieux-actions` (type `html`, contenu HTML
brut), avec sa propre carte « Se réunir » et son propre lien codé en dur — non vue en 30/09bis. Lien
corrigé (`/annuaire-ressources?resourceType=meeting-room`). ⚠️ Les deux sections coexistent sur `/`,
aucune masquée — doublon d'affichage apparent, non traité ici (hors périmètre du bug signalé, à
confirmer si voulu).

**Retour utilisateur, la croix et le badge de capacité se chevauchent encore.** Le `z-20` posé en
30/09ter (coque `DetailsModeDialog`) résout l'ATTEIGNABILITÉ au clic mais pas le chevauchement
VISUEL : les deux pastilles restent l'une sur l'autre (`top-3/4 right-3/4`, quasiment le même coin).
Fix complémentaire côté preview : le badge de capacité de `PreviewResourceDirectory` déplacé de
`right-3` à `left-3` (même coin que `PreviewEvent`, déjà à gauche) — les deux pastilles n'occupent
plus le même coin, plus de chevauchement du tout (le `z-20` de la coque reste en place comme filet de
sécurité générique pour une future preview).

**Vérifié** : `typecheck` ✅ · `eslint` ✅ · `test:unit -- src/modules/search` 673/673 ·
`config:validate` ✅ (15 pages, 27 sections).
⚠️ Pas de vérification navigateur réelle (pas d'outil de capture d'écran dans cette session) : les 2
correctifs sont tracés par lecture de code, pas rejoués à l'œil. Rien commité.



### 01/10 — revue de `tl-dev` avant MR : réutilisation, commentaires épurés

**Réutilisation** : la suppression d'une fiche (`profil/actions/mutations/deleteEntity.ts`) invalide
désormais `publicSurfaceKeys()` — le helper partagé que l'admin utilise déjà — au lieu de 2 clés de
recherche posées à la main ; les compteurs et la recherche du hero sont rafraîchis aussi.

**Commentaires** : retrait des passages qui racontaient l'historique du lot (hypothèses écartées,
« demandé explicitement », « avant ce correctif »…) ; seul le *pourquoi* est conservé.

**Vérifié** : `typecheck` ✅ · `eslint` (fichiers du lot, sortie JSON) 0 message · `test:unit`
5438/5439 (seul échec : `bundle-size`, lié à un `dist/` ancien) · `config:validate` ✅ (15 pages,
27 sections) · `audit:config` RAS.

### 24/09ter — un administrateur peut supprimer sa fiche

**Code + config.** L'en-tête de profil propose « Supprimer cette fiche » **en dernier** dans le menu
d'actions, derrière un séparateur, avec un dialogue de confirmation ; retour sur `/lieux` ensuite, la
page de la fiche n'existant plus. Option opt-in `profile-header.showDeleteButton` (+
`deleteRedirectPath`), posée sur le seul profil `organizations` de ce site.

⚠️ **L'action supprime la fiche de Communecter en entier**, pas seulement de tiers-lieux.org : c'est
`element/delete` via `Organization.delete()`, à ne pas confondre avec le « retrait » de l'onglet
Référencement, qui détache du costum en laissant la fiche vivre.

Quatre gardes superposées : option de config absente par défaut · `permissions.isAdmin` sur CETTE
fiche côté client · `isAuthorOrAdmin` côté SDK · `canDeleteElement` côté backend. La mutation
(`actions/mutations/lifecycle.ts`) invalide la fiche ET les listes de recherche, sinon le lieu
supprimé resterait affiché dans l'annuaire. Libellés neutres dans le moteur (« cette fiche », pas
« ce tiers-lieu ») : le module `profil` sert les 10 sites.

**Vérifié** : 11 tests — la mutation (appel SDK avec raison, invalidations, échec clair si le SDK ne
sait pas supprimer), l'ouverture de l'action (absente par défaut même pour un admin, absente pour un
non-admin, présente et destructive sinon, toujours en dernier) et le GESTE (un clic ouvre la
confirmation, rien ne part avant « Supprimer définitivement »). Page de fiche servie en SSR à un
visiteur anonyme : aucune trace du bouton. Garde de parc `tests/preflight/profile-delete-button.test.ts`
**vérifiée en échec** sur 3 fautes injectées (un autre site qui l'ouvre, une destination inexistante,
un profil non-organisation), configs restaurées à l'octet près (`cmp`).
**Gates** : `typecheck` ✅ · `eslint` ✅ · `config:validate` ✅ · `audit:config` RAS · `test:unit`
5 051/5 053 (après merge de `main` du 24/09) — 2 échecs d'environnement local sans lien.

**Rollback** : retirer `showDeleteButton` de la config suffit à faire disparaître le bouton, sans
toucher au moteur.

### 24/09bis — home : les 3 cartes d'action deviennent des liens · les mots-clés d'un lieu s'éditent

**Cartes d'action (config seule).** La section `html` `tiers-lieux-actions` affichait trois cartes
(« Découvrir », « Se réunir », « Se reconnaître ») avec `cursor-pointer` et une flèche, mais aucun
lien. Chaque carte est maintenant un `<a>` : `/lieux`, `/lieux?services=Salle de Réunion` (le filtre
que pose déjà le bouton du hero) et `/lieux?licoop=Oui`. Mesuré : 22 résultats pour les salles de
réunion, 19 pour Licoop, contre 4 311 sans filtre.

**Et ces liens ne rechargent plus la page** (code, moteur) : `HTMLSection` délègue le clic à
`destinationSpa` (`components/sections/htmlSectionLinks.ts`), bâti sur le `classifyHref` déjà commun
à `NavLink`/`CTASection`/`CardsSection` — un lien interne écrit dans une section `html` navigue donc
comme celui du menu. Ancres `#`, `mailto:`/`tel:`, externes, `target`/`download` et clics
d'ouverture parallèle (Ctrl/Cmd, Maj, Alt, clic milieu) gardent le comportement natif. **Toutes les
sections `html` du parc en bénéficient** (mentions légales, CGU, pages éditoriales de 8 autres
sites) ; aucune n'y perd, le comportement ne change que pour un `href` interne.

**Mots-clés du lieu (code + config).** Le champ `tags` du formulaire `tiers-lieux` devient
SAISISSABLE (onglet « Détails », widget `tags`, autocomplétion sur les mots-clés du réseau), et la
dérivation passe des `mutation.stamps` aux codecs `tl:tagsRead`/`tl:tagsWrite`
(`forms/costum/tiers-lieux/fns.ts`, helpers partagés `derivedTags.ts`) :

| | |
|---|---|
| Lecture (édition) | tags serveur − dérivés des valeurs ENREGISTRÉES (`typePlace`, `manageModel`, `buildingSurfaceArea`) |
| Écriture (save) | mots-clés affichés ∪ dérivés des valeurs CHOISIES (`family`, `managementType`, `surfaceBuilt`) |

Motif : `op:"append"` refusionne les tags DU SERVEUR, donc changer de typologie gardait l'ancien
libellé — le lieu ressortait dans deux facettes — et un mot-clé retiré revenait au save. Les 3
estampilles dérivées sont retirées ; les 2 MARQUEURS de réseau (`$costum.mainTag`, `$costum.compagnon`)
restent des estampilles et restent VISIBLES dans le champ : les masquer les supprimerait au premier
enregistrement, l'estampille compagnon ne s'appliquant qu'à la création. Libellés inchangés (mêmes
tables que les estampilles), donc les facettes de `/lieux` et l'observatoire continuent de filtrer.
**`config.prod.relief.json`, qui recopie ce formulaire, garde ses 5 estampilles** — la bascule n'a eu
lieu que sur ce site. Détail moteur : `doc/28-module-formengine.md` § mots-clés dérivés.

**Vérifié** : 15 tests sur la chaîne réelle (`tags-propagation.test.ts`), dont la SUPPRESSION
(changer de typologie retire l'ancien tag ; un mot-clé retiré ne revient pas) et l'aller-retour
d'édition sans rien toucher, qui rend exactement les tags de la fiche — le point sensible, puisque le
formulaire ENVOIE désormais `tags`. Gardes de non-retour : `spec.test.ts` (les 2 estampilles
restantes portent une valeur littérale) et la sentinelle d'inventaire `tests/preflight/stamps.test.ts`
(`tiers-lieux/tiers-lieux:2`, `relief/tiers-lieux:5`). Instantanés régénérés : descripteur + spec
figés, `__effective__/tiers-lieux.json`.
**Gates** : `typecheck` ✅ · `eslint` ✅ 0 erreur 0 avertissement sur les fichiers du lot ·
`config:validate` ✅ (14 pages, 26 sections) · `audit:config` RAS (`strip: 0`) · `config:render` ✅ ·
`test:unit` 4 788/4 790 — 2 échecs d'environnement local sans lien (bundle principal 3,24 Mo,
dossier vide non suivi `public/images/EcosystemeSanteReunion`). Navigation vérifiée en navigateur sur
les 3 cartes : aucun rechargement (un marqueur posé sur `window` survit au clic ET au retour
arrière), URL et comptes attendus (4 311 / 22 / 19). `config:render` ✅ aussi sur institut-bleu, qui
porte des sections `html` à liens internes.

### 24/09 — home : en-tête « Découvrir les lieux » sous l'illustration, aligné sur les cartes · libellés en pastille

**Code + config.** L'illustration du `hero-search` (style complet : `ctaButtons` + `subhead`)
déborde de 40 px sous la section (`-bottom-10`) et recouvrait le titre et le bouton « Voir tous les
resultats ». La section réserve désormais cette place (`mb-10` quand `backgroundImage` est posé) :
le contenu qui suit descend de 40 px, le hero ne change pas. Nouvelle option opt-in
**Changement de DÉFAUT** sur l'en-tête de `searchProStatic` (`customHeader`) : plus de `container`
ni de marge latérale, et 12 px sous l'en-tête (`mb-3` au lieu de `mb-6`) — titre et boutons
commencent au même bord que les cartes. Ce n'est pas une option : **48 sections de 10 sites** sont
concernées (parent62 21, rezo-sante-reunion 8, tiers-lieux 5, relief 3, sport-sante-bien-etre 3,
institut-bleu / maison-sport-sante / saint-paul-sport 2, équipements sportifs ×2 1). Retirer les
seuls `px-*` n'aurait pas suffi : c'est le `container` (max 1280) qui rentrait le titre de 64 px à
1440. Nouvelle option opt-in `categoryVariant: "pill"` (section `content`) : le libellé au-dessus du titre devient une pastille bordée (`rounded-full border
border-border`) ; posée sur les 4 sections qui en ont un (Les lieux, Outils et ressources,
S'entraider, Observatoire). Le texte passe dans un `<span>` INTERNE au `<p>` : la bordure se réduit
au texte sans que le libellé perde la largeur ni l'alignement du bloc, que le `<p>` continue de
porter (`width: "wide"`, `align: "center"`). Les deux props sont décrites dans le registre
`scripts/lib/prop-descriptions.ts` (plancher `section:content` posé à 1) — donc servie par
`config:schema` et la skill `config-assistant`.

**Autres sites** : le correctif du hero touche aussi la home de **relief** (même design, même défaut
constaté) ; aucun autre site n'utilise `hero-search`. L'alignement de l'en-tête, lui, touche les
10 sites ci-dessus — vérifié sur parent62 (`/ressources`, `/temoignages`) et rezo-sante-reunion
(`/theme/nutrition`, sections en `width: "container"`) : dans chaque cas le titre part du bord de SA
grille, y compris quand un panneau de filtres la décale (432 px sur `/lieux` et `/temoignages`). Sur
une page dont le chrome reste centré (parent62 `/ressources`), le titre est désormais au bord.
`categoryVariant` n'est posé nulle part ailleurs : les libellés de parent62, relief
et rezo-sante-reunion restent en texte simple. Détail moteur : `doc/07-module-search.md`
(`customHeader`), `doc/05-schemas-sections.md` (`content`).

**Vérifié** : mesures + captures à 1440 / 768 / 390 px, clair et sombre (titre à 16 px sous
l'illustration, bords du titre et du bouton = bords de la grille, 12 px au-dessus d'elle ; 4
pastilles bordées à 0 px du bord du paragraphe, bordure au token du thème en clair comme en
sombre) ; relief contrôlé à 1440 / 390 px. Garde de clé strippée **vérifiée en échec** : une faute
injectée sur `categoryVariant` sort en `cle-strippee` à l'audit.
**Gates** : `config:validate` ✅ (14 pages, 26 sections) · `audit:config` RAS (`strip: 0` sur les
4 configs qui consomment ces briques) · `config:render` ✅ 4/4 (tiers-lieux et relief re-joués après le
passage en défaut ; parent62 et rezo-sante-reunion vérifiés en NAVIGATEUR sur cette version) · `typecheck` ✅ · `eslint` ✅ 0 erreur sur les fichiers du lot · `build` ✅
23,9 s · `test:unit` 4 774/4 776 (`--maxWorkers=2`, `--max-old-space-size=4096` : 7 Go de RAM) —
2 échecs d'environnement local sans lien avec ce lot (bundle principal 3,24 Mo > 2 Mo, déjà
au-dessus du plafond sur le build du 23/09 ; dossier VIDE et non suivi `public/images/
EcosystemeSanteReunion`).

### 29/09 — création d'un lieu : alerte si le tiers-lieu existe déjà

**Demande** (Peterson) : « Alerte si le tiers-lieu est déjà existant à la création ». **Constat
mesuré** : « La Plume à Loup » existe (Attin, 62170) ; saisir « La Plume à loup » créait un doublon
— la seule garde était la règle serveur `organizationSameName` (nom + code postal + commune),
comparaison EXACTE et sensible à la casse, jouée à la fin des 5 étapes. Sur la base locale, périmètre
de l'annuaire (4 305 fiches), avec le repli que le code applique : **114 noms présents plusieurs
fois**, dont **34 seulement** partagent aussi un code postal (« L'Archipel » existe dans sept
villes). Le nom seul ne prouve rien : l'alerte informe, elle ne bloque pas. *(Les chiffres 67 / 5 /
six villes d'une première mesure étaient en égalité stricte de chaînes — corrigés par la revue.)*

**Ce que voit l'utilisateur.** Sous le nom (étape Infos), dès 3 caractères, puis de nouveau sous
l'adresse (étape Contact) : jusqu'à 5 fiches au nom proche, avec code postal et commune, un bouton
« Aperçu » et un lien « Ouvrir la fiche » (nouvel onglet — la saisie en cours n'est pas perdue).

| Niveau | Règle | Effet |
|---|---|---|
| Fort | même nom et même code postal | alerte renforcée ; **confirmation à la création** |
| Probable | même nom ailleurs, ou nom approchant au même code postal | alerte |
| Possible | nom approchant seul | information |

**Config** (seul ajout propre au site) :

```jsonc
"slots": { "duplicates": "slot:entityDuplicates" },
"duplicateCheck": {
  "nameField": "name", "postalCodeField": "postalCode", "minChars": 3, "limit": 5,
  "confirmOnSubmit": true,
  "search": { "types": ["organizations"], "from": { "page": "/lieux", "sectionId": "section-events" } }
}
// sections info et contact : "$slot:duplicates" après "name" et après "address"
// mutation.invalidateFn.params.searchKeys : ["entityDuplicates"]
```

**Moteur** — générique et config-driven, réutilisable par tout formulaire costum ; **aucun endpoint
nouveau**, SDK intact. Détail : `doc/28-module-formengine.md` § « Détection de doublons à la
création ». Les choix qui comptent, tous mesurés :

- **Périmètre par référence** à la section de l'annuaire (`from`) : l'alerte cherche là où `/lieux`
  cherche, sans 4ᵉ recopie des filtres (ils sont déjà recopiés 3 fois dans cette config). Le chemin de
  page est requis : l'id `section-events` désigne AUSSI l'agenda de l'accueil.
- **`searchBy` forcé à `["name"]`**, sans le variant `navigator-tl` de l'annuaire (3 requêtes Mongo par
  résultat, inutiles ici).
- **50 résultats demandés, classés côté client, 5 affichés** : le serveur trie par date de mise à
  jour — les homonymes exacts de « La Fabrique » arrivent aux rangs 9, 18, 29 et 30.
- **Terme nettoyé avant envoi, espaces conservés** : « L’Archipel » tapé sur mobile (apostrophe
  typographique) ne retrouvait rien. Et le serveur traduit chaque espace en UN séparateur optionnel :
  replier les espaces rendait **243 fiches (5,6 %) introuvables par leur propre nom** — constat GRAVE
  de la revue, reproduit sur « Coworking Haute-Deûle - En cours ».
- **Le wizard démonte l'étape inactive** : le slot est posé à deux étapes, et la confirmation vit
  dans la modale (elle refait une recherche sur les valeurs soumises).
- **Inerte en édition** : le même document sert `add-tiers-lieux` et `edit-tiers-lieux`.

**Revue adversariale** (workflow, 5 dimensions, chaque constat soumis à 2 sceptiques) —
**29 constats, tous instruits** :

| Dimension | Constats | Ce qui a été corrigé |
|---|---|---|
| Bonnes pratiques | 10 | `$or` en ligne qui écrasait le `$or` de périmètre (`mergeMongoFilters`) ; périmètre hérité partiel ; panneau qui disparaissait à chaque recherche ; affirmation fausse sur le coût réseau (cache porté à 5 min) ; logique pure sortie du composant ; helper dupliqué |
| Données réelles | 3 | 🔴 repli des espaces (ci-dessus) ; la garde lit jusqu'à 3 pages ; chiffres remesurés avec le repli |
| Fonctionnel | 6 | soumission abandonnée si la modale est fermée pendant la vérification ; résultats d'un ancien nom qui réapparaissaient ; aperçu démonté quand la liste se vide ; liens de l'aperçu qui faisaient perdre la saisie ; texte de la confirmation qui se vidait à la fermeture |
| Accessibilité | 8 | région d'annonce montée avant le message ; lien à 3,25:1 en thème clair ; texte secondaire à 4,37:1 sur l'alerte forte ; focus rendu après annulation ; débordement à 375 px ; libellés qui comptaient faux |
| Pipeline | 2 | cohérence du bloc vérifiée par le zod et par un préflight dédié ; ordre de déploiement documenté |

Commit de suivi après le commit initial `c114a91d`. Deux écarts assumés : pas d'index unique côté
serveur (deux créations simultanées ne se voient pas) ; tokens `warning` sombres par défaut du moteur
non corrigés (sans effet sur ce site, dont le thème les redéfinit — documenté dans `doc/28`).

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 14 pages, 26 sections |
| `audit:config` | ✅ RAS |
| Préflight | ✅ 727 tests (dont le nouveau gate `duplicate-check`) |
| Tests du lot (lib, hook, slot, garde, schéma, moteur, registres) | ✅ 530 tests sur les dossiers touchés |
| `tsc -b`, eslint | ✅ sur le lot (erreurs pré-existantes `aac`/`cagnotte` : SDK installé 1.0.189 < requis ^1.0.195) |
| `vite build` (client) | ✅ — slot dans son propre fichier, 6,2 ko ; règle CSS `:has(>[data-slot-quiet]:only-child)` générée |
| `npm run build` | ⛔ non rejouable sur ce poste : son `tsc` bute sur les erreurs pré-existantes ci-dessus |
| Snapshot `compiled.byteparity` | régénéré — diff = `slots`, `duplicateCheck`, 2 ancres `$slot:`, `searchKeys` |
| Fixture `__effective__/tiers-lieux.json` | inchangée |

**Non fait** : recette navigateur (clair, sombre, mobile, lecteur d'écran) ; durcissement de la règle
serveur `organizationSameName` (socle partagé `pixelhumain`, hors périmètre).

### 21/09 — `/annuaire-ressources` : les photos des ressources s'affichent

**Code seul** (module `search`, pas de config). Les photos d'une ressource (documents de la
réponse, ou images de la salle) sont des chemins `/upload/communecter/…` **relatifs au backend** ;
laissés relatifs, `/img` les cherchait dans les fichiers du site → 404. `parseResourceDirectoryItem`
les préfixe avec `getBaseUrl()` (option `baseUrl` obligatoire, `toBackendUrl`) ; carte, détail et
section la passent. Seule la section `coform-resource-directory` est touchée (ce site seulement).
Détail : `doc/07-module-search.md` § `coform-resource-directory`.

### 08/09ter — admin : onglet « Référencement »

**Config seule** (`config.prod.tiers-lieux.json`). Onglet `admin.tabs[]` `referencement` (icône
`link-2`, `access: siteAdmin`), section `type: "reference"` — `entityTypes: ["organizations",
"citoyens"]`, colonnes Nom / Commune / Provenance (`source.key`). Deux sous-onglets natifs :
**Rechercher & référencer** (recherche globale hors costum, politique open-data `optIn`) et
**Référencés** (+ retrait). Le bouton pose `reference.costum ∋ navigatorDesTierslieux` via
`setsource` (`Admin::addSourceInElement`, collection-agnostique — `citoyens` traité comme
`organizations`). Le costum ne déclarant pas de `subType` sur ces collections, le référencement est
nu (`reference.costumTypes` non posé). Fixture `__effective__/tiers-lieux.json` régénérée.

**Gates** : `config:validate` ✅ (14 pages, 26 sections) · `audit:config` RAS · `config:render`
14/14 · module `admin` + `effective-config` ✅.

### 08/09 — page `/annuaire-ressources`

Ajout de la page **`/annuaire-ressources`** (menu « Les lieux » → « Coworking, salles &
hébergements ») : annuaire à plat des ressources d'un tiers-lieu (coworking / salle de réunion /
hébergement), portage du bloc costum `franceTierslieux#annuaires-ressources-tiers-lieux`. Section
moteur config-agnostique **`coform-resource-directory`** (module `search`), variant `searchCostum`
`navigator-tl-ressource` (endpoint `/costum/navigator/getsressourcetl`, `Navigator::getRessourceTL`).
**Détail moteur : `doc/07-module-search.md` § `coform-resource-directory`.**

Contenu : facettes « type » + 3 groupes prix (heure / demi-journée / journée, calqués Communecter) ;
carte à carrousel automatique, clic sur le tiers-lieu porteur = filtre « porté par » ; modal « En
savoir plus » (gabarit `ProfilTiersLieuxAbout`) avec bouton **« Réserver »** (lien de résa) ou
**« Contacter par e-mail »** (`mailto:` de l'e-mail du tiers-lieu) sinon.

**Gates** : `config:validate` ✅ (14 pages, 26 sections) · `audit:config` RAS · `config:render`
14/14 · `tsc -b` / `eslint` / préflights `search` ✅.

### 07/09bis — l'admin peut publier actus et événements · le jaune sort de `secondary`

**Config seule**, deux lots indépendants.

**a) Back-office — deux onglets de publication** (calqués sur `config.prod.saint-paul-sport.json`,
qui porte le patron le plus propre du parc : formulaires sans taxonomie site-spécifique) :

- `costumForms["tiers-lieux-article"]` (poi `type:"article"`) et `costumForms["tiers-lieux-event"]`
  (events), copiés de `saintpaul-article` / `saintpaul-event`. **Retiré à la copie** : les `stamps`
  de référencement croisé vers `equipementsSportifs974` (propres à saint-paul, sans équivalent ici).
- `admin.tabs` : `actualites` (resource poi, `create: "add-tiers-lieux-article"`) et `agenda`
  (resource events, `create: "add-tiers-lieux-event"`), `edit: "inherit"` — d'où deux routes
  `profiles.poi.editModals` / `profiles.events.editModals` (`edit: "inherit"` lit
  `profiles[type].editModals`, jamais `profiles.default`).
- **Effet de bord du moteur** : déclarer un form costum fait qu'il sert AUSSI aux boutons d'ajout
  des profils, dès qu'il est l'**unique** form de sa collection (`costumCreateKey`,
  `AddEntityDropdown.tsx` — « un site qui déclare un formulaire pour ses événements ne veut pas du
  formulaire standard »). D'où le contraste observé : parent62 (3 forms `poi`), saint-paul (2) et
  Ekilib.re (2) gardent le form POI **générique** ; tiers-lieux n'en a qu'un, il capturait donc le
  bouton.
  - **Événements** : « Ajouter un événement » ouvre le form tiers-lieux — voulu.
    `preferences.toBeValidated` **conservé** comme sur saint-paul : la soumission publique reste
    modérée, l'admin valide en un clic depuis son onglet.
  - **POI** : `addConfig.poi` passé à **`false`** sur `citoyens`/`organizations`/`projects`
    (07/09, décision utilisateur révisée). Motif : le bouton ouvrait le form actualité, **qui ne
    peut rien enregistrer** tant que le SDK refuse `type:"article"` (cf. point suivant) — un bouton
    absent vaut mieux qu'un bouton qui plante. Aucune perte fonctionnelle : aucune page du site
    n'affiche de POI générique (tous les `defaultTypes` sont `organizations`/`citoyens`).
    À rouvrir si besoin une fois le SDK publié.

**b) Couleurs — le jaune quittait son rôle.** `secondary` porte, dans la convention shadcn, une
surface **discrète** (badges, boutons secondaires, `bg-secondary/40` du champ de recherche du
`searchHeader`). Le thème y logeait le jaune saturé de la marque (`hsl(43,91%,52%)`) : chaque
surface calme criait, et sur le dégradé teal de `/actualites` le champ de recherche virait à
l'aplat olive.

| token | avant | après |
|---|---|---|
| `light.secondary` | `hsl(43, 91%, 52%)` | `hsl(43, 68%, 90%)` |
| `light.secondaryForeground` | `hsl(25, 20%, 12%)` | `hsl(35, 35%, 20%)` |
| `dark.secondary` | `hsl(43, 85%, 48%)` | `hsl(38, 22%, 24%)` |
| `dark.secondaryForeground` | `hsl(25, 20%, 10%)` | `hsl(43, 38%, 88%)` |

La FAMILLE chaude est conservée (l'identité tiers-lieux), en version sourde ; le jaune vif reste
disponible **inchangé** sous `warning` et `chart2`.

- **Bug préexistant corrigé au passage** : en sombre, `secondaryForeground` était un quasi-noir alors
  qu'il sert de couleur de TEXTE (`text-secondary-foreground` dans `SearchPro`/`SearchProStatic` —
  « Aucun résultat trouvé », « Chargement… ») sur fond sombre. Contraste mesuré **1,06:1**. Il est
  maintenant à **14,74:1**.
- **Contrastes mesurés** sur les éléments réellement rendus (badge de tag de `/actualites`) :
  **10:1** en clair, **7,98:1** en sombre.
- **Section `html` de la home (`tiers-lieux-actions`)** : trois pastilles `bg-yellow-400` codées en
  dur portant des icônes `text-white` — **1,53:1**, échec AA franc. Passées à `bg-warning` /
  `text-warning-foreground` (le jaune vif de la marque, via le token). Découverte au passage :
  **Font Awesome n'est chargé nulle part sur ce site**, les six `<i class="fa-solid …">` de cette
  section n'ont donc JAMAIS rendu (trois pastilles vides + trois flèches absentes) — remplacés par
  du SVG inline, sans dépendance.

**Gates** : `config:validate` ✅ · `audit:config` RAS (1 assumé) · `config:render` 14/14 pages,
26/26 sections · `config:probe` 10/10 périmètres peuplés · `test:preflight` — seuls restent 4 échecs
**étrangers à ce lot** (chantier `resource-directory` en cours + `config.prod.rezo-sante-reunion.json`).

---

### 07/09 — page « Actus & Événements » : le blog rejoint l'agenda, `/evenements` disparaît

**Config seule** (`config.prod.tiers-lieux.json`), sur le patron de `/actualites` de
saint-paul-sport : `searchHeader` + `tabs`. Le costum porte déjà des articles (`type:"article"`
scopés `navigatorDesTierslieux`) que le site n'exposait nulle part — le module `blog` étant `core`,
seule la surface manquait.

- **`/evenements` est remplacée par `/actualites`**, pas doublée : la section `agenda` déménage
  telle quelle dans l'onglet « Événements » (ses 3 `sourceKey` — `franceTierslieux`,
  `tierslieuxbelgique`, `navigatorDesTierslieux` — et sa gestion à venir/en cours/passés sont
  conservées). Les **trois liens entrants** ont suivi : menu « Se gouverner », colonne du footer,
  et le bouton « voir tous » du teaser agenda de la home.
- **Une seule barre de recherche pour les deux onglets** : le `searchHeader` produit le
  `PageFilters` que lisent `articleFeed` (`useArticleFeed`) **et** `agenda` (`Agenda.tsx` — d'où le
  passage de son `filters.text` à `false` : sans ça, deux champs de recherche cohabitaient). Vérifié
  au navigateur : « évaluation » → 1 actu / 0 événement, « phare » → 1 événement.
- **`config.blog` ajouté** (`feedCostumSlug: navigatorDesTierslieux`) — ouvre `/blog/feed.xml` et la
  commande ⌘K `blog:articles`. **Sans `publicFilters`** : les 2 articles du costum n'ont pas de
  `publicationStatus`, un filtre `{publicationStatus:"Publié"}` viderait flux ET palette.
- **Pas de `featured`** sur les fils : les articles n'ont pas d'image, et la « une » du variant
  `default` rendait un aplat vide de ~640 px de haut. Grille simple à la place.
- **Pas de `headlineClassName: "text-white …"`** recopié de saint-paul : `--gradient-section` va ici
  de `primary` (teal foncé) à `accent` (teal très clair) — du blanc y serait illisible à droite. Le
  défaut `text-foreground` tient l'AA sur la partie la plus sombre (≈ 4,6:1), vérifié au navigateur
  en clair **et** en sombre, et à 390/320 px sans débordement horizontal.
- **Gates** : `config:validate` ✅ · `audit:config` RAS (1 assumé) · `config:render` 14/14 pages,
  26/26 sections · `config:probe` 10/10 périmètres peuplés (l'agenda de l'onglet ramène 359 events).
  Deux snapshots resynchronisés en conséquence : `tests/preflight/__effective__/tiers-lieux.json` et
  l'exemple `agenda-multi-sources` de la skill (son sélecteur pointait `pages[path=/evenements]`).
- **⚠️ `/evenements` n'a pas de redirection** — la config ne sait pas en poser. Un lien externe vers
  l'ancienne URL tombe sur le 404. À arbitrer si l'URL était partagée.

---

### 31/08 — un usage non évalué n'était pas compté comme tel

**Correctif backend, sans une ligne de config ni de code côté site.** L'action `toolscatalog` du
costum `franceTierslieux` — partagée par ce site, RELIEF et la Fédération des CAE — comptait comme
usage une saisie de `commonTable` sans **aucune** évaluation. Or une telle saisie n'est pas un usage
constaté : le lieu a coché l'outil sans rien en dire. Elle gonflait les occurrences, les besoins
couverts et les facettes, et la fiche de l'outil listait ces lieux sans rien à montrer — un compteur
de carte qui ne correspondait pas à ce que sa fiche montrait.

La règle est **inconditionnelle** (costum `ce7e367fa`) : une saisie muette ne compte nulle part, et
le détail ne la liste pas. **L'outil, lui, reste au catalogue** avec ses catégories et ses ancres de
détail ; sa carte n'affiche simplement pas de pastille d'usage (le rendu garde déjà
`usagesCount > 0`, il n'y a donc jamais de « 0 usage » à l'écran).

> ⚠️ **Piège — « évaluée » ne veut pas dire « satisfaction renseignée ».** Le `commonTable` pose DEUX
> questions : la satisfaction fonctionnelle (`happiness`) et le besoin d'alternative éthique (`note`,
> sur 5). Une première version de la règle n'exigeait que la première et écartait **47 saisies de ce
> formulaire** qui portaient pourtant une vraie évaluation. La règle retenue est `happiness` non vide
> **OU** `note` numérique **> 0** ; le `0` (numérique ou la chaîne `"0"`, 46 saisies ici) est le
> curseur jamais touché, pas une réponse.

**Ce que ça change ici**, mesuré en A/B sur l'endpoint réel (form `636cd563e2439b7fc12cd680`,
`indexStep=200` — au-delà, le serveur retombe sur 24 et la mesure ne porte que sur la 1ʳᵉ page) :

| | avant | après |
|---|---|---|
| outils au catalogue | 69 | **69** — aucun ne sort |
| occurrences | 183 | 111 |
| outils sans pastille d'usage | 0 | 17 |
| facettes d'usage | 51 | 43 |

C'est le même défaut de donnée qu'ailleurs : **128 saisies sur 355 (36 %)** de ce formulaire n'ont
aucune évaluation. Les facettes perdues sont des besoins qui n'existaient que par des saisies
muettes — autant d'options de filtre qui ne ramenaient rien.

Second correctif du même lot, invisible ici mais qui profite à ce site : la **sous-catégorie** d'une
ligne (le besoin) n'était plus lue que sur la saisie, alors qu'elle appartient à la ligne de
catalogue. Elle est désormais résolue par un helper partagé `Coform::criteriaUsageCatalog`
(citizenToolKit `f40121d2`), consommé par la liste **et** par le détail — c'est l'asymétrie entre
les deux qui laissait une fiche muette là où la liste, elle, nommait le besoin.

⚠️ **Prérequis de déploiement** : les deux modules backend vont ensemble. Sans `citizenToolKit`,
`costum` appelle un helper qui n'existe pas.

### 13/08 — édition d'un lieu : le formulaire du site refusé par la lib

**Constat** (remonté depuis l'usage) : valider la modale « Modifier » d'un lieu échoue sur
`ApiValidationError: [DraftProxy] Le champ "holderOrganization" n'est pas autorisé.` — rien n'est
enregistré.

**Cause** — la lib ouvre à l'écriture les champs du costum de **PROVENANCE** de l'élément
(`source.key`), pas ceux du costum qui rend le **formulaire**. Pour un annuaire, les deux diffèrent :
sur les 3 lieux de contrôle, un seul a un `source.key` déclarant le champ (`franceTierslieux`), les
deux autres pointent hors registre (`tierslieuxorg`) ou n'ont aucun `source`. Asymétrie de fond avec
la **création**, qui passe, elle, explicitement par `me.costum(slug)`.

**Correctif** — `EntityMutationSpec.schemaCostumSlug` : le costum du descripteur est épinglé sur
l'entité avant l'écriture du draft (`setCostumScope(slug, { pinSchema: true })`). Dépend d'un ajout
SDK décrit en **§11.2** ; implémenté et vérifié localement, **non commité côté lib**. 3 tests de
non-régression (`useEntityMutation.test.ts`).

**Revue de conformité de `e12eddf2`** (détail des salles/coworking/hébergement) menée au passage.
Le lot est **conforme** : les textes libres passent bien par `ProseContent` (markdown/HTML
auto-détecté **puis sanitisé**), la largeur de modale surcharge proprement le `sm:max-w-lg` de
`DialogContent` sans toucher au garde-fou mobile `max-w-[calc(100%-2rem)]`, et les lectures de
tableau distinguent `!== undefined` de la troncature falsy — indispensable, `name` et `area` valant
les index `0` et `1`. Trois réserves, aucune bloquante, détaillées au **§13**.

### 10/08bis — détail d'un outil : les lieux listés n'étaient pas les bons

**Constat** (test navigateur, comparaison détail d'outil ⇄ formulaire de réponse du lieu) : la
modale de détail affichait des lieux qui n'avaient **jamais saisi l'outil**. Exemple relevé : un
tiers-lieu présenté comme utilisant *Dokos* pour son site vitrine, alors que sa réponse dit
*YesWiki*.

**Cause** — `ToolUsersAction` sélectionnait les entrées sur le seul `criteriaId`. Or un `criteriaId`
identifie une **ligne du catalogue de besoins** (« site vitrine », « facturation », « CRM »)
**partagée par toutes les réponses du formulaire**, et non la saisie d'un lieu : des dizaines de
lieux portent le même `criteriaId` avec des outils différents. Le `criteriaIds` sert à **restreindre
le scan**, jamais à **identifier** l'outil.

**Mesure** (curl sur la base de dev, outil *Dokos*, `formId` de la config) :

| Requête | Lignes | Outils distincts |
|---|---|---|
| `criteriaIds` seuls, sans `inputKeys` | 69 | 27 |
| **ce que le front recevait** (`criteriaIds` + `inputKeys`) | **62** | **22** — Dolibarr, Paheko, Tibillet, odoo, Wordpress, Louty… |
| avec `normalizedName=dokos` | **24** | **1** |

**61 % des lignes affichées** attribuaient à un lieu un outil d'un autre lieu. Preuve de parité la
plus nette : la liste annonce `totalOccurrences = 24` pour Dokos — exactement le nombre de lignes
après filtre, là où le détail en montrait 62. Liste et détail sont désormais d'accord.

**Correctifs** :

| Couche | Changement |
|---|---|
| costum (`master`) | `ToolUsersAction.php` : paramètre `normalizedName` optionnel + re-filtrage sur `entry.criteria`, via une **réplique exacte** de `ToolsCatalogListAction::normalizeToolName` (la liste groupe avec, le détail filtre avec — une divergence viderait le détail d'un outil pourtant compté) |
| SDK | `normalizedName` sur `COSTUM_TOOL_USERS` / `ToolUsersParams` / `Form.getToolUsers` — **livré le 11/08** (lib `d93c7c3`, npm `1.0.184`), cf. §11.1 |
| site-json | `useToolDetail` transmet le paramètre et l'intègre à la clé React Query ; `ToolDetailDialog` passe `tool.normalizedName` |

**Correctif d'affichage connexe** : les libellés de satisfaction du détail d'un outil ne suivaient
pas ceux de l'input `commonTable` qui les produit (« Content » vs « Satisfait », « J'adore » vs
« Très satisfait »). Alignés au mot près sur `modules/coform/i18n` (fr **et** en) — la référence est
l'input de saisie, pas le vocabulaire legacy (« Bien / Excellent / Décevant »), qui reste un
troisième vocabulaire encore en place côté PHP. Complément au fix `914dcec0` : en lecture seule,
« Ajoutez une solution pour évaluer » invitait à une action impossible → tiret des valeurs vides.

**Commits** : `b69071c3` (fix du détail) · `20a28d9c` (libellés) · `e3cb6a6a` (lecture seule) ·
`d98b6a79` (doc) · `c12f2e43` (SDK `^1.0.184`).

| Gate (11/08, après `npm ci`) | Résultat |
|---|---|
| `tsc -b --noEmit` | ✅ 0 |
| `npx eslint src/modules/toolsCatalog src/modules/coform` | ✅ 0 |
| `test:unit` (unit + préflights) | ✅ 2 346 / 2 346 — dont la parité i18n (`i18n-files`) |
| Contenu du tarball SDK | ✅ `normalizedName` présent dans `types/` **et** `dist/` ; integrity du lock = integrity du registre |

⚠️ **Ce lot n'a aucun test de non-régression** : ni le passage de `normalizedName` à `getToolUsers`,
ni sa présence dans la clé React Query ne sont couverts. Retirer le paramètre laisse `lint`,
`tsc` et les 2 346 tests **verts** (vérifié le 11/08) alors que la liste redevient fausse — le mode
de défaillance est totalement silencieux. Cf. §13 q.8.

---

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
| 6 | Agenda | ✅ | Teaser sur `/` + onglet « Événements » de `/actualites` (ex-page `/evenements`, cf. §9 07/09) — 359 événements |
| 7 | Ajout d'un tiers-lieu | ✅ | Formulaire costum (27 champs) + bouton flottant |
| 8 | Campagne `ampli` | ✅ | « amplifions » — **seul emploi du module dans le parc** |
| 9 | Palette ⌘K | ✅ | `entitySearch` |
| 10 | Socle légal | ✅ | Mentions légales, confidentialité, CGU — rédigées, non réduites à des trames |
| 11 | API et données ouvertes | ✅ | Page `/api-donnees` |
| 12 | Rendu navigateur | ❌ | **Jamais vérifié** dans le cadre de ce dossier |
| 13 | Mode sombre | ❌ | Jamais vérifié |
| 14 | Propagation des tags depuis le form (typologie/portage/surface) | 🟡 | 3 stamps `$mapLabels`/`$bucket` + test d'intégration vraie chaîne (6/6) — commité (`9bbd7a4d`) ; reste l'e2e navigateur live (créer un lieu → facettes) |
| 15 | Middleware `imageUpload` : dossier ← champ `images` de `sites.json` | ✅ | `imageFolderForSlug` + test 7/7 ; tue le dossier fantôme + l'upload dans un dossier non servi. Commité (`4831f146`) |
| 16 | Catalogue d'outils `/usages` (module `toolsCatalog`) | 🟡 | Livré 06/08 (`85520742`, corrections `2a1803ea`) ; review MR#33 le 10/08 : **15 constats corrigés** (`252b50e8`), SDK `1.0.183` (`36b4a7dd`), fix readonly `commonTable` (`914dcec0`) — gates verts. Puis 10/08bis : **bug de données du détail corrigé** (`b69071c3`, `20a28d9c`, `e3cb6a6a`, `d98b6a79`) avec SDK `1.0.184` (`c12f2e43`). Reste : **aucun test de non-régression sur `normalizedName`** (cf. §9 10/08bis) et l'e2e navigateur du parcours complet |
| 17 | Actus & Événements (`/actualites` + `/blog`) | 🟡 | Livré 07/09 — `searchHeader` + `tabs` (`articleFeed` / `agenda`), `config.blog` posé. Gates verts, rendu vérifié clair/sombre/mobile. Reste : **le costum n'a que 2 articles, sans image ni `publicationStatus`** — page maigre tant que la rédaction ne suit pas ; et pas de redirection pour l'ancienne URL `/evenements` |
| 18 | Publication depuis `/admin` (actus + événements) | ⛔ | Onglets et formulaires livrés 07/09 (calqués sur saint-paul, routes `editModals` posées, `parentFromCarrier` ajouté). **La création d'ACTUALITÉ est bloquée par le SDK** : `POI_TYPES` (1.0.191) ne contient pas `"article"`, `ADD_POI` échoue à la validation AVANT l'appel réseau — cf. `Document de spécification — POI_TYPES sans « article »…`. Touche AUSSI saint-paul, parent62 et Ekilib.re. Le volet **événements** n'est pas concerné (`EVENT_TYPES` couvre les 20 valeurs du form). Bouton « Ajouter un POI » des profils désactivé (`addConfig.poi: false`) tant que le SDK bloque, sinon il ouvrait un formulaire incapable d'enregistrer |
| 19 | Palette : le jaune hors de `secondary` | ✅ | 07/09 — `secondary` passé en sable sourd (clair et sombre), jaune vif conservé sous `warning`. Corrige un `text-secondary-foreground` à **1,06:1** en sombre et trois pastilles `bg-yellow-400`/`text-white` à **1,53:1** sur la home. Contrastes remesurés au navigateur |
| 20 | Annuaire des ressources (`/annuaire-ressources`) | ✅ | 08/09 — page ajoutée : section `coform-resource-directory` (module `search`, variant `navigator-tl-ressource`). Facettes type + 3 groupes prix, carte carrousel + filtre « porté par », modal « En savoir plus » (bouton « Réserver » / `mailto:`). Détail moteur : `doc/07-module-search.md`. Gates config/tsc/eslint/préflights ✅ |
| 21 | Admin — onglet « Référencement » | ✅ | 08/09 — `admin.tabs[]` `referencement` + section `type: "reference"`, `entityTypes: ["organizations", "citoyens"]` (config seule). `setsource` add/remove collection-agnostique. Gates config/effective-config/admin ✅ |
| 22 | Alerte « tiers-lieu déjà existant » à la création | 🟡 | 29/09 — slot générique `slot:entityDuplicates` + bloc `duplicateCheck` (config) + confirmation à la soumission. Gates verts, revue adversariale close (29 constats instruits) ; **reste** : recette navigateur |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

SDK installé : **`^1.0.184`**. Le module `toolsCatalog` (page `/usages`, livré le 06/08) consomme
cinq endpoints déployés côté backend, **tous couverts par le SDK publié sur npm** (résolu depuis le
registre, réinstallation propre `npm ci` vérifiée le 11/08 : integrity du lock = integrity du
registre) : un `npm install` propre compile, le lien local n'est plus nécessaire. Contrat détaillé
dans `commentaire/sdk-tools-catalog.md` (notes locales, hors dépôt).

| Demande | État | Preuve / substitut |
|---|---|---|
| `Form.toolsCatalog()` — liste paginée du catalogue (`COSTUM_TOOLS_CATALOG`) | ✅ `1.0.183` | Action `ToolsCatalogListAction.php` déployée (costum `15c5a91af`). ⚠️ Ne PAS router via `_createPaginatorEngine` : `_linkEntities` jette les DTO sans `collection` |
| `Form.getToolUsers()` — lieux utilisateurs d'un outil (`COSTUM_TOOL_USERS`) | ✅ `1.0.183` | `ToolUsersAction.php` déployée ; recherche par `criteriaIds`, jamais par regex sur le nom |
| `Form.getToolUsers()` — **paramètre `normalizedName`** | ✅ `1.0.184` | Livré le 11/08 (lib `d93c7c3`), débloque le fix du §9 10/08bis. Optionnel au contrat (hors `required`) et transmis **conditionnellement** par le SDK : clé-absente ≠ chaîne-vide. Cf. §11.1 |
| `Form.communInfo()` — fiche du commun rattaché (`COSTUM_COMMUN_INFO`) | ✅ `1.0.183` | Déplacée d'`Answer` vers `Form` en `1.0.183` : `api.answer({id})` fetchait le doc AAP complet (fuite `financer[]` nominatif), `api.form({id})` ne charge que la définition publique. `formId` = verrou anti-IDOR (endpoint `auth: none`) |
| `BaseEntity.saveToolEnrichment()` — édition d'un outil (`COSTUM_SAVE_TOOL_ENRICHMENT`, bearer) | ✅ `1.0.183` | `SaveCriteriaAction.php` durcie (elle écrivait sans aucun contrôle d'accès). ⚠️ Sur `BaseEntity`, pas `Organization` — cf. §12 |
| `BaseEntity.getCommunList()` — options du select de rattachement (`COSTUM_COMMUN_LIST`, bearer) | ✅ `1.0.183` | `CommunListAction.php` déployée ; remplace un appel legacy qui ramenait ~300 réponses AAP entières |
| Upload de l'image d'un outil | ✅ présent | `entity.uploadDocument(file, {contentKey: "icons", docType: "image"})` — même `contentKey` que le legacy |
| `BaseEntity.setCostumScope(slug, {pinSchema})` — **épingle du schéma** pour ÉDITER un lieu de l'annuaire | ⛔ **À DEMANDER** | Bloque l'édition d'un lieu (`[DraftProxy] Le champ "holderOrganization" n'est pas autorisé.`). Mesuré sur 3 lieux réels : 2 échouent. Cf. §11.2 |

La config dépend par ailleurs des variants `searchCostum` **`navigator-tl`** (pages `/lieux` etc.) et
**`navigator-tl-ressource`** (page `/annuaire-ressources` → endpoint `/costum/navigator/getsressourcetl`,
`Navigator::getRessourceTL`) : toute évolution de ces endpoints touche la config en premier.

### 11.1 ✅ Livrée le 11/08 — `normalizedName` sur `COSTUM_TOOL_USERS`

> **Statut** : demande **satisfaite** dans la lib (`cocolight-api-endpoint`, commit `d93c7c3`),
> publiée sur npm en **`1.0.184`** et consommée ici (`c12f2e43`). `tsc -b` vert, plus aucun point
> bloquant sur la branche. La spec ci-dessous est conservée comme trace de la demande et du contrat
> effectivement implémenté.
>
> ⚠️ Piège de publication à connaître : dans la lib, le bump de version (`ca7d65e`, endpoints
> d'invitation) **précède** l'ajout de `normalizedName` (`d93c7c3`) — les deux ajouts, additifs et
> indépendants, sont livrés dans la **même** `1.0.184`. Vérifier le CONTENU du tarball et non le seul
> numéro de version (fait le 11/08 : `normalizedName` et `validateInvitation*` sont bien présents
> dans `types/` et le `dist/` installés).

**Pourquoi** : correction d'un bug de données majeur du détail d'un outil (§9, 10/08bis). Un
`criteriaId` identifie une **ligne du catalogue de besoins** partagée par toutes les réponses
(« site vitrine », « facturation »…), **pas** la saisie d'un lieu — sélectionner dessus seul mêle
les outils de lieux différents. Le paramètre est **optionnel au contrat** (aucun appelant existant
ne casse) mais doit être envoyé par tout consommateur.

**Backend** : déjà déployé et rétrocompatible (costum `ToolUsersAction.php`, absent ⇒ comportement
inchangé). Le serveur renormalise la valeur reçue avec `normalizeToolName`, la **même** fonction que
`ToolsCatalogListAction` utilise pour grouper — les deux implémentations doivent rester identiques.

**Trois points d'entrée** (implémentation locale vérifiée, `tsc` SDK vert) :

1. `endpoints-copie.json` → `COSTUM_TOOL_USERS.request.properties`, après `inputKeys` :

   ```json
   "normalizedName": { "type": "string", "description": "Nom normalise de l'outil — filtre INDISPENSABLE en pratique…" }
   ```

   (hors `required`), puis `generate:module:publish` + `generate:methodeapi`.

2. `src/api/serverDataType/ToolsCatalog.ts` → `ToolUsersParams` : `normalizedName?: string;`

3. `src/api/Form.ts` → `getToolUsers`, dans le littéral `data` :

   ```ts
   ...(params.normalizedName !== undefined ? { normalizedName: params.normalizedName } : {}),
   ```

   Le passage conditionnel (et non `normalizedName: params.normalizedName`) préserve la sémantique
   **clé-absente ≠ chaîne-vide** : une chaîne vide côté serveur désactive le filtre, mais l'envoyer
   systématiquement ajouterait une clé vide à un fil `urlencoded`.

**Côté site-json** : `useToolDetail` transmet le paramètre et l'intègre à la clé React Query
(`TOOL_USERS`) — deux outils d'un même besoin partageraient sinon le cache. Le bump `^1.0.184` est
posé (`c12f2e43`) et `ToolDetailDialog` alimente le hook depuis `tool.normalizedName` du DTO de
liste : le câblage est complet de bout en bout.

### 11.2 ⛔ À demander — `pinSchema` sur `setCostumScope` : éditer un lieu de l'annuaire

> **Statut** : demande **à porter à la lib**. Implémentation locale faite et vérifiée sur données
> réelles (`tsc` SDK vert, `lint` vert, 75 tests unitaires verts) ; **rien n'est commité côté SDK**.
> Sans elle, **l'édition d'un lieu est cassée en production** pour la majorité des lieux.

**Le symptôme.** Ouvrir la modale « Modifier » d'un lieu, valider → `ApiValidationError:
[DraftProxy] Le champ "holderOrganization" n'est pas autorisé.` Aucune donnée n'est enregistrée.

**La cause.** La liste blanche du draft (`BaseEntity._buildDraftAndProxy`) ouvre à l'écriture les
champs du costum de **PROVENANCE** de l'élément — son `source.key`, que `_setData` re-dérive à
chaque hydratation (« un élément appartient à UN costum = son `source.key`, qui fait donc
AUTORITÉ »). Or `navigatorDesTierslieux` est un costum **ANNUAIRE** : il liste des lieux qui ne
viennent pas de lui, et leur applique **son** formulaire. Les deux notions divergent, donc les
champs du formulaire ne sont pas dans la liste blanche.

**Mesure** (backend local, `element/about`, sur les 3 lieux ayant servi à valider `e12eddf2`) :

| Lieu | `source.key` | Résolution du contexte | Écriture `holderOrganization` |
|---|---|---|---|
| La Coroutine | `franceTierslieux` | costum bundlé, 14 propriétés | ✅ passe (par chance : ce costum déclare le champ) |
| La Plume à Loup | `tierslieuxorg` | **hors registre** (le registre porte `tierslieuxorg1`) → ctx nu, 0 propriété | ❌ **rejet** |
| Coopérative Baraka | *(aucun `source`)* | `null` | ❌ **rejet** |

Deux lieux sur trois échouent — et le seul qui passe le doit à un costum tiers qui déclare
fortuitement le même champ. Ce n'est pas un cas limite : c'est le cas courant d'un annuaire.

**Pourquoi le contournement n'existe pas côté site.** Trois voies testées, toutes fermées :
`setCostumScope()` après chargement pose bien `_costumCtx` (13 propriétés) mais le proxy **refuse
toujours** — `_getAllowedFieldsForCurrentState()` relit un `combinedSchema` figé au chargement ;
poser le scope **avant** `get()` ne survit pas à `_setData` dès que l'élément a un `source.key`
étranger ; passer `costumCtx` à la construction est ignoré pour la même raison (`BaseEntity.entity`
ne le propage qu'aux entités NEUVES, `!_hasAtLeastOne(data, ["id","slug"])`).

**Ce que la lib promet déjà.** `loadCostumScope` est documentée « pose le contexte COMPLET
(champs/presets/hidden) sur cette entité — **pour l'ÉDITER avec ses champs costum** … comble
l'édition vide ». Cette promesse n'est pas tenue aujourd'hui : le contexte est posé, la liste
blanche ne bouge pas. La demande **rend vraie la documentation existante**.

**Trois points d'entrée** (`src/api/BaseEntity.ts`, implémentation locale vérifiée) :

1. **Un drapeau d'épingle** `_costumCtxPinned` posé par `setCostumScope`/`loadCostumScope`, testé
   dans `_setData` avant la re-dérivation depuis `source.key` — même statut que `_adminScope`, qui
   survit déjà aux ré-hydratations parce qu'il traduit un choix explicite de l'appelant :

   ```ts
   if (!this._costumCtxPinned) { /* … re-dérivation depuis source.key, inchangée … */ }
   ```

2. **Rejouer la liste blanche** quand `_costumCtx` change après le build — sinon poser un scope est
   un no-op visible pour l'édition. Extraire la construction du `allOf` de `_buildDraftAndProxy`
   (`_buildCombinedSchema`, rejouable) et mémoriser les `constants` dans `_allowedFieldsMetadata`.
   ⚠️ **Semer** les champs nouvellement ouverts dans le draft **et dans la baseline** depuis
   `serverData` : sans ce semis, `_hasFieldChanged` les verrait tous « modifiés » (baseline
   `undefined`) et le save émettrait des champs intouchés. Vérifié : `hasChanges()` reste `false`
   juste après la pose, et la baseline est bien semée (`manageModel`, `openingDate`,
   `siteSurfaceArea`, `buildingSurfaceArea` sur `laPlumeALoup`).

3. **Opt-in, pas défaut** — `setCostumScope(slug, { pinSchema?: boolean })`, défaut `false` :

   ```ts
   setCostumScope(slug: string, opts?: { costumId?: string; costumType?: string; pinSchema?: boolean }): void
   ```

   Le défaut `false` est **load-bearing** : `setCostumScope` est déjà appelée par
   `ensureCostumScope` (import/export/validation) sur le carrier de **7 sites du parc**, où la
   provenance doit **rester** maîtresse du schéma (contrat des sens A/B, `admin-scope.test.ts`).
   Épingler par défaut changerait le schéma d'édition de l'hôte de ces sites. `loadCostumScope`,
   elle, épingle **par défaut** : c'est sa raison d'être documentée.

**Côté site-json** : `EntityMutationSpec.schemaCostumSlug`, alimenté en édition depuis
`FormDescriptor.costumSlug` (`resolveModalSpec`) et posé juste avant `submitEntityEdit` — pendant
exact du `me.costum(slug)` de la création, dont l'absence en édition était l'asymétrie de fond.
Couvert par 3 tests de non-régression (`useEntityMutation.test.ts`) dont un faux `DraftProxy` qui
rejette hors liste blanche : retirer `schemaCostumSlug` **ou** son `pinSchema` les fait échouer.

---

## 12. Points d'attention / limitations

- **Détection de doublons (29/09) — ce qu'elle ne voit pas.** Une fiche que le backend masque (en
  attente de validation) n'est pas signalée. Le périmètre est celui de l'annuaire `/lieux` : les 23
  organisations taguées `TiersLieux` mais hors de ses filtres (pays, réseau) ne sont pas vues. La
  règle serveur `organizationSameName` reste le dernier filet, exacte et sensible à la casse. Et la
  fixture `__effective__` ne lit ni `sections` ni `slots` : une dérive du bloc `duplicateCheck` ne
  serait vue que par le snapshot `compiled.byteparity`.

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
| 8 | Verrouiller le fix `normalizedName` : le rendre **requis** dans `UseToolDetailOptions` (le champ est requis sur `ToolCatalogItem`, donc `tsc` reste vert — vérifié) et ajouter un test de non-régression (passage à `getToolUsers` + présence dans la clé React Query). Sans cela, un futur appelant qui l'oublie rétablit les 61 % d'attributions fausses **sans qu'aucun gate ne bronche** | Thomas |
| 9 | Review du 11/08 : deux bugs **préexistants** de `CommonTableField` mis au jour (hors périmètre des 5 commits, mais l'un est aggravé par `e3cb6a6a`) — regroupement des scores sur `usageKey` **brut** sans `groupKeyResolver` (une réponse legacy sans `usageKey` n'apparaît jamais sur sa ligne, et affiche désormais « — » = « non répondu », faux) et `handleActivate` indexé sur la clé brute (clic sans effet sur une ligne ré-ancrée). Chantier coform à planifier | Thomas |
| 10 | La branche `feat/invitations-email` consomme `UserApi.validateInvitation*` (livrés en SDK `1.0.184`) mais son `package.json` est resté en `^1.0.181` : son `tsc` échouera tant que le bump n'est pas posé | Thomas |
| 11 | **Porter §11.2 à la lib** (`setCostumScope(slug, {pinSchema})`). Tant que ce n'est pas publié, l'édition d'un lieu ne marche qu'avec le SDK **rebuildé en local** : un `npm ci` propre la recasse, sans qu'aucun gate ne bronche (`tsc`/`lint` restent verts, `pinSchema` étant optionnel) | Thomas |
| 12 | Revue `e12eddf2` — **`roomPath.catering` pointe-t-il bien sur la question « restauration » ?** Son suffixe d'input (`…mieg8j24m89gm99t5mi`) est celui porté par `equipments` dans `coworkingPath` **et** `bedRoomPath`. Ces formulaires étant des copies l'un de l'autre (préfixe de step différent, suffixe conservé), le même suffixe = la même question d'origine : le détail d'une salle afficherait alors la liste d'**équipements** sous l'intitulé « Restauration ». À trancher sur le formulaire en base (`6925869ad76aaf6c5a2b2f8a`) | Thomas |
| 13 | Revue `e12eddf2` — **code mort dans la branche `array` de l'hébergement.** `area`/`bedPrice`/`roomPrice` y sont lus par `row[section.bedRoomPath.X]`, or ces clés sont des **chemins pointés** et non des index de ligne (contrairement à `roomPath`, en index numériques) → toujours `undefined` → `0`/`""`. Sans effet aujourd'hui (`bedRoomPath.type === "answer"`, la branche n'est jamais prise) mais le jour où un config passe en `array`, le « correctif » ne corrigera rien — exactement le mode de panne silencieux visé par le commit. À supprimer ou à réécrire en `getNestedValue` | Thomas |
| 14 | Revue `e12eddf2` — **clé de config morte laissée en place** : `coworkingPath.extra` n'est toujours lue par personne ; le lot a ajouté `equipments` **avec le même chemin** au lieu de lire `extra`. Deux clés pour une donnée, dont une inerte (cf. §12, « un mapping non lu ne produit aucune erreur ») | Thomas |
| 15 | Alerte doublons (29/09) : **recette navigateur** à faire (clair, sombre, 375 px, lecteur d'écran) ; et faut-il proposer « c'est mon lieu → le modifier » en plus de « Ouvrir la fiche » (question de droits : l'édition d'un lieu dépend de §11.2) ? | Peterson |
| 16 | Durcir la règle serveur `organizationSameName` (ignorer casse et accents) ? Elle vit dans le socle partagé `pixelhumain` : effet sur tous les sites | Thomas |
| 17 | Remettre le poste à niveau (`npm install` : SDK installé 1.0.189, requis ^1.0.195) — `npm run build` et `tsc` y échouent sur `aac` et `cagnotte` | Peterson |
