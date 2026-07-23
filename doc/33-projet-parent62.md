[← Retour à l'index](README.md)

# Projet Parent62 — Réseau Parentalité du Pas-de-Calais

> **Document de référence du projet.** Il intègre le cahier des charges, le modèle de données réel,
> l'état d'avancement et les dépendances. Objectif : ne plus avoir à joindre le PDF du CDC ni à
> re-explorer la base à chaque session. **À tenir à jour à chaque lot livré.**
>
> Voir aussi : [Module Articles/Blog](32-module-articles-blog.md) · [Module Search](07-module-search.md) ·
> [Module formEngine](28-module-formengine.md) · [Système de visibilité](19-visibility-system.md) ·
> [Module Admin](30-module-admin.md).

Dernière mise à jour : **2026-07-23**.

---

## 1. Le projet en bref

Le Réseau Parentalité 62 (REAAP 62) dispose d'un WordPress reconnu, `www.parent62.org` : bon
référencement, production régulière d'articles, mais recherche faible, outils non reliés (WordPress,
GoGoCarto, MyLudo…) et peu de capacité de contribution pour les partenaires. Le projet consiste à
publier une plateforme complémentaire — **`reseau.parent62.org`** — bâtie sur SiteForge (site-json)
et le réseau social Communecter, en **conservant le WordPress** pour les contenus éditoriaux.

| | |
|---|---|
| **Site SiteForge** | slug `parent62` → [`config.prod.parent62.json`](../config.prod.parent62.json), CSS `index-parent62` ([`sites.json`](../sites.json)) |
| **Costum / scope de données** | `parent62` — `source.key` de toutes les entités du réseau |
| **Orga porteuse** | « Parent 62 », `_id 6a450f0ac34c7070327d2a64`, slug `parent62`, type `NGO` |
| **Backend** | Communecter (`~/dev/communecter-php74`), base de travail locale = dump de prod `prod200726` |
| **SDK** | `@communecter/cocolight-api-client` — **dépôt en lecture seule**, branche `pdev`, version 1.0.167 |
| **Branche site-json** | `parents62` |
| **Chef de projet** | Thomas Craipeau (Aboire) — seul habilité à modifier le SDK et le costum backend |

### Historique des chantiers

- **Thomas** : module blog (`src/modules/blog/**`), costum form article, back-office `/admin`,
  widgets `gallery`/`file`/`markdown`, import WordPress (`tools/wp-migration/`), config
  `config.prod.parent62.json` (réplique du WP + articles), **import des 6 434 articles** (19/07/2026).
- **Peterson** : recherche multi-type `/recherche`, Paroles de parents, agenda, communauté,
  pages réseau et 9 pages territoire avec les 887 communes, sitemap/robots, référentiel
  `src/data/territoires62.ts` — dans `config.prod.parents62.json` (slug `parents62`).
- **20/07/2026** : constat que `parents62` **ne correspond à aucune donnée** ; décision de tout
  ramener sur `parent62`, une seule config, et d'adopter la taxonomie par **champs**.
  Plan : `.claude/plans/plan-parent62-convergence-configs.md` (hors dépôt).
- **23/07/2026** : fix `/recherche`–`/paroles` (cible par défaut + vue liste), menu ramené à
  6 entrées, header transparent lisible en sombre, purge des restes `parents62` ; le soir,
  **réalignement `pdev` = `master` (SDK 1.0.168)** et mise à jour des 4 branches backend
  (messagerie/SSBE — aucune livraison parent62).

---

## 2. Cahier des charges (intégré)

### 2.1 Constat et objectifs

**Limites identifiées** : recherche peu efficace · gestion des contenus chronophage · outils non
reliés entre eux (WordPress, GoGoCarto…) et difficulté à en créer d'intégrés (ex. Paroles de
parents) · faible capacité de contribution directe des acteurs du réseau.

**Objectifs** : conserver les qualités actuelles · améliorer l'expérience utilisateur · ajouter des
modules spécifiques intégrés · moteur de recherche performant · centraliser et organiser les
ressources · faciliter la contribution des partenaires · **maintenir le référencement**.

### 2.2 Exigences par domaine (et proposition retenue au CDC)

| Domaine | Exigence CDC | Proposition retenue |
|---|---|---|
| **Accueil / pages statiques** | Réseau parentalité (historique, présentation) ; équipe & contact ; **présentation de chaque territoire avec contact et liste des communes** ; champs d'action et charte | *« Conserver le WordPress, très adapté à ces contenus »* — mais les pages ont été recréées côté SiteForge (décision Peterson du 17/07/2026, contenus extraits du WP) |
| **Parcours** | Mise en place d'une **entrée pro** et d'une **entrée parents** | Clarifier la distinction depuis le WordPress **et** sur la plateforme |
| **Moteur de recherche** | URL dédiée type `reseau.parent62.org`, filtres : **types d'info** (actualités, ressources, programmation de partenaires, événements du réseau, Paroles de parents) · **public** (parents/pro, avec filtrage par âge) · **dates** · **territoire avec un code couleur par territoire** · **vue cartographique filtrable** · **thème** · lieux d'accueil/structures · partenaires | Technologie réseau social co.tools, sur le modèle de `tierslieux.00.re/lieux` |
| **Paroles de parents** | Découverte de contenus **audio et écrits**, navigation selon 3 types : **Compliqué / Difficile / Ce qui est à changer** ; audiodescription ou sous-titres selon le format ; ajout réservé aux administrateurs | Module dédié sur la plateforme |
| **Articles** | Forte activité ; besoin de mieux filtrer et de relier aux ressources | Conserver WordPress pour la rédaction, **créer une entrée dans le réseau par article** pour qu'ils soient dans le moteur de recherche et filtrables |
| **Événements** | Agenda (notamment événements du réseau) **avec affichage par territoire** · impression de l'agenda · événements réguliers (récurrence) · **ajout par les partenaires avec modération a priori** · conserver le référencement | Créer dans WordPress puis afficher en agenda ; à terme tout sur le réseau social. Récurrence côté réseau social. Format impression proposé |
| **Annuaire partenaires** | Suite à la visio du 30/06 : permettre aux partenaires de **se référencer** (format annuaire + cartographie/mapping), cf. `annuaire.institutbleu.re` | — |
| **Ressources** | Vidéos/photos, comptes rendus PDF, jeux PDF. Limites : affichage limité à 3, filtres trop grossiers, suivi des accès Google Drive | Gestion facile (formulaire simple) + recherche filtrable par territoire/ville, cf. `lescommuns.tiers-lieux.org` ; possibilité d'indiquer si la ressource a été utile, qui y contribue |
| **Fiches structures / lieux d'accueil** | Actuellement GoGoCarto, adopté par la coordination | Pas de changement à ce stade ; mise en avant sur la liste, migration en 2e étape |
| **Fiches de jeux + emprunt** | MyLudo et Biblioboost (disponibilité des jeux) | Lien vers ces outils ; mutualisation possible avec un projet santé d'Open Atlas |
| **Publication réseaux sociaux** | Programmation multi-canal | **Non engagé** ; conseil : automatiser avec n8n |
| **Mailing** | Pas de modèle aujourd'hui | **Non engagé** ; enjeu d'automatisation depuis WordPress + réseau social (n8n, Ghost) |

### 2.3 Déroulé et budget

| Partie | Budget | Contenu | Durée annoncée |
|---|---|---|---|
| **Partie 1** | 3 000 € | 1 000 lancement de `reseau.parent62.org` (navigation + graphisme identiques à `parent62.org`) · 1 000 module Paroles de parents (ajout **admin uniquement**) · 1 000 moteur de recherche **V2 avec navigation territoriale** | 3 semaines jusqu'à la bêta, hors debug/tests |
| **Partie 2** | 4 500 € | 1 500 module événementiel (coevents) · 1 500 module actualités (ajout de post, interopérabilité WordPress) · 1 500 moteur de recherche avec événements et actualités, accueils partenaires et parents | 2 semaines jusqu'à la bêta |
| **Partie 3** | 2 000 € | 1 500 module ressources · 500 moteur de recherche dans les ressources | — |
| Autres | 2 500 € | hébergement + maintenance 1 an (500) · retours d'usage et bugs (1 000) · coordination (1 000) | — |

---

## 3. Modèle de données réel

> Constaté sur le dump de production restauré en local (base `prod200726`), **en lecture seule**,
> le 20/07/2026. Les chiffres sont ceux du dump.

### 3.1 Périmètre

| Collection | Documents `source.key = "parent62"` | Types |
|---|---|---|
| `poi` | **6 434** | `article` uniquement |
| `news` | 6 434 | `activityStream` (traces d'import, pas du contenu) |
| autres | 0 | — |

**Aucun** POI `affiche` (paroles), aucune structure, aucun événement, aucune ressource pour l'instant.
La clé `parents62` (avec un **s**) n'existe sur **aucun** document — c'est un slug de développement
abandonné.

### 3.2 Anatomie d'un article (POI `type:"article"`)

| Champ | Présence | Rôle |
|---|---|---|
| `name` | 100 % | titre |
| `slug` | 100 % (tous distincts) | certains dégradés (`"em"`) → le reader tolère `/blog/id/:id` |
| `description` | 96,8 % | corps **markdown** ; images encore pointées sur `www.parent62.org/wp-content/…` |
| `shortDescription` | 92,1 % | chapô |
| `profil*ImageUrl` (×4) | 74,2 % | couverture (rapatriée sur `/upload/communecter/poi/<id>/…`) |
| `tags` | 100 % | ≈210 tags **WordPress libres** (`Actus` sur 5 627, `Zoom` 713, `Offres d'emploi`…) |
| **`territoires`** | 81,8 % | `string[]` — libellés de `costum.lists.territoires` |
| **`publics`** | 66,1 % | `string[]` |
| **`themes`** | 63,8 % | `string[]` |
| `created` / `updated` | 100 % | epoch **secondes** ; `created` s'étale de 2009 à 2026 (tri du fil) |
| `parent` | 100 % | `{ "6a450f0a…2a64": { type:"organizations", name:"Parent 62" } }` |
| `source` | 100 % | `{ insertOrign:"import", key:"parent62", keys:["parent62"] }` |

**Absents partout** : `medias`, `documents`, `links`, `urls`, `address`, `geo`, `category`, `status`,
`costum`, `sourceKey` (le rattachement se fait **uniquement** par `source.key`/`source.keys`).

### 3.3 Les 4 champs transverses (convention retenue le 20/07/2026)

La taxonomie vit dans des **champs de premier niveau**, pas dans des tags. Mêmes noms sur **tous**
les types de contenu (article, parole, événement, ressource, structure) :

| Champ | Type | Source des valeurs |
|---|---|---|
| `territoires` | `string[]` | `costum.lists.territoires` (10 valeurs) |
| `publics` | `string[]` | `costum.lists.publics` (7 valeurs) |
| `themes` | `string[]` | `costum.lists.themes` (18 valeurs) |
| `tags` | `string[]` | libre (mots-clés WordPress) |

**Territoires** (avec le nombre d'articles) : Boulonnais 1 075 · Entre Mer et Terres 990 ·
Arrageois 761 · Audomarois 680 · Calaisis 653 · Familles en sol mineur Lens Liévin 563 ·
Ternois Bruaysis 538 · Artois 502 · Familles en sol mineur Hénin Carvin 306 ·
**Familles en sol mineur** (générique) 43 ← *10e valeur, arbitrage en attente*.

**Publics** : Parents 2 680 · Parents-enfants 1 467 · En famille 1 303 · Enfance 1 091 ·
Professionnels 524 · Futurs parents 343 · Bénévoles 73.

**Thèmes** (18) : Les activités supports à la relation 1 974 · La petite enfance 1 333 ·
L’adolescence 882 · La communication 496 · L’éducation 477 · La santé 447 · Les jeux 418 ·
L’arrivée d’un enfant 339 · Le handicap 325 · Les écrans – Le numérique 270 · La citoyenneté 266 ·
Le répit 183 · L’école 179 · La culture 137 · Les situations de séparation 132 · Les violences 123 ·
Les émotions 64 · Le deuil 6.

> ⚠️ **Encodage.** Les libellés utilisent l'apostrophe typographique **U+2019** (`L’école`) et un
> tiret demi-cadratin dans `Les écrans – Le numérique`. Un filtre écrit avec une apostrophe droite
> renvoie **0 résultat sans erreur**. Copier-coller depuis `costum.lists`, ne jamais retaper.

### 3.4 Le costum backend

Il est **embarqué dans le document de l'orga** (`organizations.costum`), pas dans la collection
`costum` :

```jsonc
{
  "slug": "costumize",              // s'appuie sur le costum générique
  "typeCocity": "region",
  "import": { "mapping": [ {"col":"Titre","attr":"name","type":"STRING"},
                           {"col":"Tags","attr":"tags","type":"ARRAY"},
                           {"col":"Territoires","attr":"territoires","type":"ARRAY"}, … ] },
  "lists": { "territoires": [...10], "publics": [...7], "themes": [...18] },
  "typeObj": {
    "article": {
      "sameAs":"poi", "formParent":"poi", "formType":"article", "add":"onlyAdmin",
      "dynFormCostum": {
        "beforeBuild": { "properties": {
          "description": { "markdown": true },
          "territoires": { "inputType":"selectMultiple", "list":"territoires" },
          "publics":     { "inputType":"selectMultiple", "list":"publics" },
          "themes":      { "inputType":"selectMultiple", "list":"themes" } } },
        "onload": { "actions": { "presetValue": { "type":"article" },
                                 "hide": { "parentfinder":1, "urlsarray":1, "formLocalityformLocality":1 } } }
      }
    }
  }
}
```

`typeObj` ne contient **que `article`** : il manque `affiche` (paroles) — c'est le blocage n°1.

---

## 4. Comment les données arrivent à l'écran

```
POI type=article (source.key=parent62)
        │
        ├─ articleFeed  ──► useArticleFeed ──► useSearchQuery ──► entity.searchCostum
        │                    defaultFilters: {…filtres de section, …filtres de page, type:"article"}
        │                    defaultSortBy: {created:-1} · costumSlug + sourceKey
        │
        ├─ /blog/:slug · /blog/id/:id ──► useArticle ──► entityBySlug | api.poi({id})
        │
        ├─ searchProStatic ──► buildSearchPayload ──► entity.searchCostum
        │                       baseParams.defaultTypes / defaultFilters / sourceKey
        │
        └─ /blog/feed.xml (RSS) · palette ⌘K
```

Deux voies de filtrage, **toutes deux config-driven**, valables pour `articleFeed`,
`searchProStatic` et `agenda` :

| Voie | Écriture en config | Résultat backend |
|---|---|---|
| **Filtre figé** (page thématique / territoriale) | `props.filters` (articleFeed) ou `baseParams.defaultFilters` (searchProStatic) | `{ champ: { $in: [...] } }` |
| **Filtre interactif** (dropdown, sidebar) | filtre portant un `field` (`searchHeader.dropdownFilters[].field`, groupe de `filters`) | converti par `searchByFieldsToQuery`, fusionné dans `defaultFilters` |

Un filtre **sans** `field` retombe sur les tags (`searchTags`, verbe `$all`) — c'est l'ancienne
convention, à ne plus utiliser pour la taxonomie.

**Code couleur par territoire** : `map.marker.colorBy` et `list.card.tagColors` acceptent un
`path` — `{ path: "territoires", mapping: { "Arrageois": "var(--territoire-arrageois)" } }`.
`resolveColorBy` lit n'importe quel chemin, tableau compris ([`lib/colorBy.ts`](../src/modules/search/lib/colorBy.ts)).

> ⚠️ **`applyValidationGate`** ([`buildSearchPayload.ts`](../src/modules/search/lib/buildSearchPayload.ts)) :
> dès qu'un `baseParams` porte un `costumSlug`, les entités en attente de validation
> (`preferences.toBeValidated.<slug>` / `source.toBeValidated.<slug>`) sont **masquées**.
> `useArticleFeed` passe toujours un `costumSlug` → comportement voulu pour le fil public.
> Opt-out : `showUnvalidated: true`. Détail : [Système de visibilité](19-visibility-system.md).

---

## 5. Checklist d'avancement

### Partie 1 (3 000 €)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1.1 | Site `reseau.parent62.org`, nav + graphisme proches du WP | ✅ côté code | config unique fusionnée (22/07) + purge `parents62` (23/07), couleurs réelles du WP ; reste le volet déploiement → 1.10 |
| 1.2 | Pages statiques réseau / charte / équipe / champs d'action | ✅ | `/reseau` `/charte` `/champs-actions` `/equipe` dans la config unique (rédaction Thomas — décision Peterson du 23/07 : conservée) ; l'arbitrage éditorial du réseau reste ouvert (§9) |
| 1.3 | Page par territoire : contact + **liste des communes** | ✅ | fusion faite le 22/07 : cards coordo + accordéon des 887 communes + fil d'articles filtré + CTA |
| 1.4 | Double entrée parents / pro | ✅ | `/parents` et `/pro` portées le 22/07 ; hors menu depuis le 23/07 (décision Peterson), accessibles depuis l'accueil |
| 1.5 | Moteur de recherche : types d'info, public, âges, dates, territoire coloré, carte, thèmes | 🟡 | vérifié dans la config : types d'info (5 cibles, défaut « Actualités » — fix 23/07), public (7), thèmes (18), territoire coloré (9), `dateRange` (borne début), carte en toggle. Restent **bloqués externes** : âges (liste `ages` à trancher avec Thomas, cf. §6) et borne de fin des dates (demande 6 backend) |
| 1.6 | Paroles de parents (3 catégories, audio, transcription, ajout admin) | 🟡 | UI, `AudioPlayer`, preview et costum form prêts ; **création bloquée** faute de `typeObj.affiche` (demande 10 — Thomas) |
| 1.7 | Navigation territoriale (recherche V2) | ✅ | 9 bulles d'accueil → `/territoire/<slug>` + filtre territoire coloré dans `/recherche` |
| 1.8 | Référencement (SEO par page, JSON-LD, sitemap, robots, RSS) | ✅ | sitemap/robots (Peterson) + JSON-LD `BlogPosting` et `/blog/feed.xml` (Thomas) |
| 1.9 | Tests E2E (Playwright) | ✅ | `e2e/parent62.spec.ts` (23/07) — 7 scénarios **lecture seule** verts : accueil (titre, nav 6 entrées, double entrée, 9 bulles), `/recherche` (cible « Actualités » par défaut, groupes, pas de « Aucun résultat »), deep-link `?territoire=Arrageois` (coché + contre-témoin décoché), `/paroles` (onglets), `/territoire/arrageois` (communes), `/blog`, mode sombre (scrim → opaque au scroll). Exécution ciblée : `npx playwright test e2e/parent62.spec.ts` — **ne jamais lancer la suite e2e complète** (specs d'aboire, dont `auth-real`) |
| 1.10 | Déploiement | ❌ | à la main de Peterson — checklist ci-dessous |

**Préparation du déploiement (1.10)** — à exécuter par Peterson :

- DNS : `reseau.parent62.org` → serveur de production.
- Build : `npm run build` avec `VITE_SLUG=parent62` (config + CSS résolus via `sites.json`)
  et `VITE_BASE_URL_BACKEND=<backend de prod>` — **sans guillemets** dans le `.env`
  (une valeur quotée fait échouer le préflight `environment` et se retrouve telle quelle
  dans le bundle).
- Environnement du serveur de prod (`server/prod-server.js`) :
  `SITE_CONFIG_PATH=./config.prod.parent62.json` (obligatoire — le serveur refuse de
  démarrer sinon) et `SITE_PUBLIC_URL=https://reseau.parent62.org` (URLs absolues du
  sitemap/robots).

### Partie 2 (4 500 €)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 2.1 | Module actualités + interopérabilité WordPress | ✅ | module blog complet ; **6 434 articles importés** ; `/blog`, 9 pages `/theme/*`, fil d'accueil, admin, RSS, ⌘K |
| 2.2 | Actualités filtrables dans le moteur de recherche | 🟡 | filtres par champ opérationnels sur `/blog` et `/theme/*` ; reste à unifier avec `/recherche` |
| 2.3 | Module événementiel (coevents) | 🟡 | page `/agenda` prête (liste/calendrier/carte, colorBy) — **aucune donnée `events`** en base |
| 2.4 | Impression de l'agenda | ❌ | |
| 2.5 | Événements récurrents | ❌ | backend |
| 2.6 | Ajout par les partenaires avec **modération a priori** | ❌ | demande 7 de la spec SDK ; brique `isCostumAdmin` livrée, workflow `status` à concevoir |
| 2.7 | Annuaire des partenaires (référencement + cartographie) | ❌ | |

### Partie 3 (2 000 €)

| # | Fonctionnalité | État |
|---|---|---|
| 3.1 | Module ressources (POI `recoveryCenter`) | ❌ — champs proposés à Thomas le 22/07/2026 (`reponse-thomas-2026-07-22.md`) : transverse + `category` (type de ressource, nouvelle `lists.typesRessource`), `urls` (natif), `galerie`/`documents` (widgets existants), `address` facultative. `recoveryCenter` est déjà dans l'enum `ADD_POI` |
| 3.2 | Recherche dans les ressources | ❌ |
| 3.3 | Votes « utile » / contributeurs | ❌ (existant backend — `ADD_VOTE` + `links`, à câbler ; pas des champs de form) |

Hors périmètre engagé : publication réseaux sociaux, mailing, migration GoGoCarto, fiches de jeux.

---

## 6. Dépendances site-json ↔ cocolight-api-client

Le SDK est en **lecture seule** : toute évolution passe par une spec `.md` transmise à Aboire
(cf. `CLAUDE.md` du monorepo). État des demandes de `spec-cocolight-api-parents62.md` au
**23/07/2026**.

> ✅ **Chaîne d'approvisionnement réalignée le 23/07/2026 (soir)** : `pdev` a repris
> `master` (`26fb9e4`, version **1.0.168**) et site-json consomme le SDK via le symlink
> `node_modules/@communecter/cocolight-api-client` → **1.0.168 actif** sans autre
> installation. Les 4 dépôts backend (`pixelhumain`, `co2`, `costum`, `citizenToolKit`)
> ont aussi été remis à jour le 23/07 — contenu : messagerie interne + SSBE, **aucune
> livraison parent62** (demandes 5, 6 et 10 re-vérifiées inchangées dans le code à jour).

| # | Demande | État | Preuve / substitut |
|---|---|---|---|
| 1 | Élargir l'enum `type` POI (+ `affiche`, + `article`) | ❌ (requalifiée → 10) | fait (`eeb5ad8`) puis **reverté** (`1207fa5`). Substitut : la résolution costum **live** relâche l'enum, mais **uniquement pour les clés présentes dans `ctx.presets`** → il faut un `typeObj` côté costum. Master `6fab52d` (21/07) rend le digest **variant-aware** (article + affiche sur le même costum poi) |
| 2 | Entrée registry costum | ❌ (sans objet) | résolution **live** via `getcostumjson` (`liveDigest.ts`, cache TTL 5 min) |
| 3 | Test d'intégration parole | remplacée → 11 | — |
| 4 | Version SDK ≥ 1.0.157 | ✅ close | **1.0.168 installé** (pdev = master depuis le 23/07, symlink `node_modules`) |
| 5 | Upload audio natif | 🟡 | client livré (`UPLOAD_DOCUMENT`, MIME large). **Backend inchangé** (re-vérifié le 23/07 après la m.à.j. des branches) : whitelist de `Document.php` sans mp3/m4a/ogg/wav, limite 15 Mo |
| 6 | Opérateurs `$gte`/`$lt`/`$lte` dans `SearchNew::getQueries` | ❌ | re-vérifié le 23/07 après la m.à.j. des branches (aucun commit sur `SearchNew.php` depuis le 14/07) : seul `$gt` converti en MongoDate ; `$gte` transmis brut, pas de branche `$lt/$lte` |
| 7 | Modération a priori | 🟡 **avance** | `ee42227` (22/07, **désormais dans le SDK installé**) : objet **`preferences.toBeValidated`** ajouté au contrat `ADD_POI` + test `parent62-affiche-mod.test.ts` → **Thomas a retenu la modération NATIVE** (recommandation du 22/07) ; notre champ `status` est abandonné. Le form parole pourra poser `preferences.toBeValidated.parent62` dès que la Demande 10 sera en base et le périmètre validé avec Thomas |
| 8 | Import WordPress | ✅ *(hors SDK)* | 6 434 articles, `tools/wp-migration/` + `costum.import.mapping` |
| 10 | `typeObj.affiche` + dynForm Parole (costum backend) | 🟡 **SDK prêt, backend NON — bloquant** | `f6e330b` (21/07, dans le SDK installé) ajoute `medias` au contrat `ADD_POI` ; mais **aucun « parent62 » dans le code des 4 modules au 23/07**, et en base `organizations.costum.typeObj` = `[article]` seul, pas de lists `categoriesParole`/`ages`/`typesRessource`. Caveat : base locale = dump prod du 20/07 — un ajout fait en prod après cette date resterait invisible localement (nouveau dump ou confirmation de Thomas nécessaire) |
| 11 | Test d'intégration `affiche` | ✅ écrit (sur `pdev` depuis le 23/07) | `tests/integration/advanced/parent62-parole.test.ts` (`f6e330b`) + `tests/integration/costum/parent62-affiche-mod.test.ts` (`ee42227`) — échoueraient contre la base actuelle tant que le `typeObj` manque ; à ne pas exécuter par nous (tests d'un autre dev, règle projet) |

**Blocage n°1 (P1), inchangé** : sans `typeObj.affiche` (avec `presetValue.type:"affiche"`)
et la déclaration de `category`/`medias`/`paroleConsentement` dans le `dynFormCostum`, la
création d'une Parole est rejetée par l'AJV du client.

**À confirmer avec Thomas** : son test parole attend une liste **`ages`** — la tranche d'âge
était dans notre spec d'origine (tags `age:*`) mais n'est PAS dans le costum form site-json
actuel ni dans `costum.lists`. Décider : liste `ages` transverse ou abandon du critère.
Conséquence actée côté site : le filtre `status:"validated"` devra être **retiré de
`/paroles`** quand la voie `preferences.toBeValidated` sera en place (plus personne ne
posera `status`).

**Après le réalignement du 23/07 :**

- **Côté site-json (fait le 23/07 au soir)** : gates re-validés sous 1.0.168 — `tsc -b`
  0 erreur, `test:unit` 1834/1835 (seul échec = `.env` quoté, préexistant hors périmètre ;
  le préflight `costum-forms` valide nos forms contre le contrat 1.0.168), `build` ✓.
- **Côté site-json (à faire quand la Demande 10 sera en base)** : poser
  `preferences.toBeValidated.parent62` dans le costum form parole (le contrat installé
  l'accepte) et retirer le filtre `status:"validated"` de `/paroles`.
- **Côté Thomas** : Demande 10 (`typeObj.affiche` + dynForm Parole — LE bloquant P1),
  Demande 5 (whitelist audio `Document.php`), Demande 6 (`$gte`/`$lt`/`$lte`), liste
  `ages` attendue par son test parole, périmètre exact de `prepData`/`validategroup`.

---

## 7. Décisions techniques et leur pourquoi

| Décision | Pourquoi |
|---|---|
| **Slug unique `parent62`** | c'est la clé des 6 434 articles et de l'orga porteuse ; `parents62` ne référence aucune donnée |
| **Taxonomie en champs, pas en tags** | 5 261 articles portent déjà `territoires[]` ; le costum backend déclare `lists` + `dynFormCostum` dessus ; le moteur filtre par champ sans code. `tags` reste réservé aux mots-clés WP libres |
| **Toujours des tableaux** pour les 3 taxonomies | la base contient des multi-valeurs ; un `select` mono-valeur écraserait un tableau à l'édition |
| **Une seule config de site** | éviter le doublon de pages/sections ; un seul jeu de gates à faire passer |
| **Pages territoire à paths littéraux** | `SiteRenderer` résout par égalité stricte — pas de route paramétrée `/territoire/:slug` |
| **Référentiel territoires versionné front** (`src/data/territoires62.ts`) | source unique des libellés, couleurs (`var(--territoire-*)`) et des 887 communes ; jamais d'hex en dur dans une config |
| **Paroles = POI `affiche` avec `category` native** | `category` est un champ natif du POI (`complique`/`difficile`/`a-changer`), filtrable par `defaultFilters` sans tag |
| **Pas de section `team` sur `/equipe` côté Peterson** | l'avatar y est obligatoire et le réseau n'a pas fourni de photos → `cards` |
| **Pas de `contactForm`** | aucun endpoint `/api/contact` côté serveur |

---

## 8. Points d'attention

- **Encodage des libellés** (U+2019, tiret demi-cadratin) — cf. §3.3.
- **`applyValidationGate`** — cf. §4.
- **Articles sans taxonomie** : 1 173 sans territoire (18 %), 2 181 sans thème, 2 181 sans public →
  invisibles sur les pages filtrées.
- **Images d'articles** : les `description` markdown référencent encore
  `http://www.parent62.org/wp-content/…` (contenu non rapatrié, dépendance au WP).
- **Doublons de tags WP** : `Offres d'emploi` / `offre d'emploi` / `Offre emploi` / `Recrutement`,
  `MoisdelaParentalité2023` vs `Moisdelaparentalite2024`… → à curer si les tags deviennent une facette.
- **Coquilles de communes** dans les PDF officiels, conservées telles quelles (« Walrus » ~ Warlus,
  « Hally », « Latter-Saint-Quentin » ~ Lattre, « Flefs » ~ Fiefs) — correction à demander au réseau.
- **Régressions visuelles du merge `main`** à revalider : sous-titre de `TitleSection` (`<h3>` gras
  → `<p>` muted), carte Leaflet → MapLibre (`streets-v2` → `streets-v4`), onglet Galerie de profil
  désormais réellement rendu, droits d'édition élargis aux admins de costum.
- **`decorateTags`** ne colorie que le tableau `tags` d'une carte : afficher des chips territoire
  colorées sous la convention « champs » demande un ajout (`tagColors.paths`).

## 9. Questions en attente

| Question | Pour qui |
|---|---|
| **Mécanisme de modération a priori** : recommandation transmise le 22/07/2026 = le natif `toBeValidated`/`prepData`/`validategroup` (garde backend existante) plutôt que notre champ `status` — si retenu : demande 7 réduite à l'activation du hook, `status` retiré de la demande 10 **et du filtre de /paroles** | Thomas |
| Périmètre de la modération : tout créateur non-admin (events P2, ressources P3, annuaire), pas seulement les événements — que permet exactement `prepData` ? | Thomas |
| Valeurs de `category` des ressources (`lists.typesRessource` : video · photo · compte-rendu · jeu · guide-outil · site ?) | réseau |
| Que faire de la 10e valeur « Familles en sol mineur » (43 articles) ? | réseau |
| Contenu retenu pour les 4 pages statiques (deux rédactions existantes) | Peterson / réseau |
| Validation des 9 couleurs `oklch` approchées de la carte du WP | réseau |
| Corrections des coquilles de communes | réseau |
| `typeObj.affiche` + champs de la Parole dans le costum backend | Thomas |
| Test d'intégration `affiche` équivalent à `parent62-article-live` | Thomas |
| Fin de la borne de dates (`$lt`/`$lte`) dans `SearchNew::getQueries` | Thomas / backend |
