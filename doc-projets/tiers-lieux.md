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

Dernière mise à jour : **2026-08-11** (SDK **`1.0.184`** publié et réinstallé : la demande `normalizedName` est **livrée**, cf. §11.1 — le fix du bug de données du détail d'un outil, 61 % de lieux faux, n'a plus de dépendance ouverte. Historique : review MR#33 et §9 10/08bis).

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
