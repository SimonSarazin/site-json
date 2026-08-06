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

Dernière mise à jour : **2026-07-28** (création du dossier — état des lieux, aucun chantier en cours).

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
| SDK | `@communecter/cocolight-api-client` **1.0.169** |
| Historique | **76 commits** — la config la plus travaillée du parc |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction complète ; dernier passage `fb1d6a09` (merge `origin/main` dans `feat/refonte-assistant-config`) |
| 28/07 | Claude | État des lieux et création de ce dossier |

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
                 │   11 pages · 21 sections                     │
                 │   header MEGA-MENU (4 groupes à enfants)     │
                 │   /lieux : panneau de filtres + résultats    │
                 │   /observatoire : 10 dimensions              │
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

### 4.1 Les 11 pages

| Page | Sections | Rôle |
|---|---|---|
| `/` | 11 | `hero-search` + résultats + **teaser agenda** + 5 blocs éditoriaux |
| `/lieux` | 1 | `gridLayout` — panneau de filtres (5 groupes) + `searchProStatic` |
| `/observatoire` | 1 | `data-observatory` — cf. §4.3 |
| `/reseaux-regionaux` · `/reseaux-thematiques` | 1 chacune | même périmètre, **deux angles** (cf. §4.2) |
| `/communaute` | 1 | `searchProStatic` |
| `/evenements` | 1 | `agenda` |
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

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

SDK installé : **`^1.0.171`**. Le module `toolsCatalog` (page `/usages`, livré le 06/08) consomme
**cinq endpoints déployés côté backend mais absents du SDK** — contrat détaillé dans
[`doc/35-sdk-tools-catalog.md`](../doc/35-sdk-tools-catalog.md).

> ⚠️ Tant qu'ils ne sont pas publiés, **site-json ne compile que via un lien local vers le SDK** :
> un `npm install` propre casse le `tsc` (la 1.0.171 npm ne contient ni les méthodes ni les types).

| Demande | État | Preuve / substitut |
|---|---|---|
| `Form.toolsCatalog()` — liste paginée du catalogue (`COSTUM_TOOLS_CATALOG`) | ❌ absent du SDK | Action `ToolsCatalogListAction.php` déployée (costum `15c5a91af`). ⚠️ Ne PAS router via `_createPaginatorEngine` : `_linkEntities` jette les DTO sans `collection` |
| `Form.getToolUsers()` — lieux utilisateurs d'un outil (`COSTUM_TOOL_USERS`) | ❌ absent du SDK | `ToolUsersAction.php` déployée ; recherche par `criteriaIds`, jamais par regex sur le nom |
| `Answer.getCommunInfo()` — fiche du commun rattaché (`COSTUM_COMMUN_INFO`) | ❌ absent du SDK | `CommunInfoAction.php` déployée ; `formId` obligatoire = verrou anti-IDOR (endpoint `auth: none`) |
| `BaseEntity.saveToolEnrichment()` — édition d'un outil (`COSTUM_SAVE_TOOL_ENRICHMENT`, bearer) | ❌ absent du SDK | `SaveCriteriaAction.php` durcie (elle écrivait sans aucun contrôle d'accès). ⚠️ Sur `BaseEntity`, pas `Organization` — cf. §12 |
| `BaseEntity.getCommunList()` — options du select de rattachement (`COSTUM_COMMUN_LIST`, bearer) | ❌ absent du SDK | `CommunListAction.php` déployée ; remplace un appel legacy qui ramenait ~300 réponses AAP entières |
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

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | Écart 4 322 (observatoire) vs 4 303 (recherche) : d'où viennent les 19 entités de différence ? | Thomas |
| 2 | Rendu navigateur et mode sombre : jamais vérifiés dans le cadre de ce dossier | Thomas |
| 3 | Les 8 champs non placés du formulaire costum sont-ils tous des sous-champs de widgets composites, ou reste-t-il des vestiges à purger ? | Thomas |
| 4 | Le module `ampli` n'est employé que par ce site. Sa campagne « amplifions » est-elle le patron à reprendre pour rezo-la-mer (`amplifions-le-sens-océanique`) ? | Thomas |
