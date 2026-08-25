[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Parent62 — Réseau Parentalité du Pas-de-Calais

> **Document de travail du projet de configuration.** Il intègre le cahier des charges, le
> modèle de données réel, l'architecture, l'état d'avancement, les impacts et les dépendances.
> Objectif : ne plus rejoindre le PDF du CDC ni re-explorer la base à chaque session, et offrir
> une base partagée entre les intervenants (Peterson / Thomas). **À tenir à jour à chaque lot
> livré**, selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Articles/Blog](../doc/32-module-articles-blog.md) ·
> [Module Search](../doc/07-module-search.md) · [Module formEngine](../doc/28-module-formengine.md) ·
> [Système de visibilité](../doc/19-visibility-system.md) · [Module Agenda](../doc/29-module-agenda.md) ·
> [Composants média](../doc/33-media-components.md). Mémoire : `[[project-parent62]]`
> (`.claude/memory/project-parent62.md`) — slug corrigé le 25/07 (`parents62` avec **s** est abandonné, cf. §1).

Dernière mise à jour : **2026-08-25** (thèmes/catégorie de "parole de parent" en saisie libre,
promotion admin-only vers la liste partagée `costum.lists`, filtres et formulaire réactifs sans
reload — cf. §9septies ; commit `bcd90e6d` sur `parents62`, **non pushé** ; typecheck/lint propres,
`config:validate` 45 pages/158 sections, 990 tests unitaires ciblés ✅).
Précédemment : **2026-08-19** (diagnostic + correctifs événements récurrents de l'agenda,
testés avec des données de test locales — 3 bugs backend corrigés ; réponse au §2.6/§12 (le filtre de
modération `toBeValidated` fonctionne) — cf. §9sexies ; `test:unit` ciblé **899/899** ✅, suite
complète 2 499/2 508, 3 échecs pré-existants sans rapport).
Précédemment : **2026-08-13** ajustement hauteur header stacked/section "à la une",
fix affichage champ thème/catégorie dynamique, dédoublonnage territoire « Familles en sol
mineur » — cf. §9quinquies ; `test:unit` **2 342/2 348** ✅, `e2e parent62` **8/8** ✅.
**2026-08-06** refonte accueil/header/footer + 11 nouvelles pages —
committé sur `parents62`, cf. §9quater ; puis corrections de review de la MR !32 sur
`fix/parents62-review` : gates du skill resynchronisées, e2e réaligné header stacked, fixes
composants, images WebP — `test:unit` 2 229/2 229 ✅.

---

## 1. Contexte du projet

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
| **SDK** | `@communecter/cocolight-api-client` — **dépôt en lecture seule**, version **1.0.172 publiée sur npm** (`^1.0.172`, commit `09e145a0` du 03/08, résolue depuis `registry.npmjs.org` — fini le tarball `npm pack` local) |
| **Branche site-json** | `main` — MR #25 mergée le 25/07 (`f599357a`) ; lot `feat/search-item-rules` **intégré à `main`** (les 3 commits sont dans son historique first-parent) ; dernier merge `fix/institut-bleu-ui` le 03/08 (`94251b7b`, 17 commits) |
| **Chef de projet** | Thomas Craipeau (Aboire) — seul habilité à modifier le SDK et le costum backend |

### Historique des chantiers

- **Thomas (sur `main`)** : module blog (`src/modules/blog/**`), back-office `/admin`, widgets
  `gallery`/`file`/`markdown`, import WordPress (`tools/wp-migration/`), **import des 6 434 articles**
  (19/07). Puis (22-24/07) l'**approche générique config-driven** : contrats de design
  `testimonial`/`resource`, page `/temoignages` (paroles) + `/ressources` + `/agenda`, formulaires
  costum `parent62-affiche` (parole), `parent62-article`, `parent62-recovery-center`, `parent62-event`,
  **pile audio mutualisée** (`src/components/media/*`), news (`/actualites`), et les ajouts SDK 1.0.168.
- **Peterson (sur `parents62`, MR #25)** : couche filtres `searchTargets`/`dateRange` (« type d'info »
  sans tag fantôme) + coloration `colorBy`/`tagColors`, recherche `/recherche`, pages audience
  `/parents`/`/pro`, `/communaute`, pages réseau et **9 pages territoire** avec les 887 communes,
  référentiel `src/data/territoires62.ts`, sitemap/robots, **fix header transparent**, **suite e2e**.
- **20/07** : constat que le slug `parents62` (avec **s**) ne correspond à aucune donnée → tout
  ramené sur `parent62`, une seule config, taxonomie par **champs**.
- **23/07** : purge des restes `parents62` ; réalignement `pdev` = `master` (SDK **1.0.168**).
- **24/07 — réconciliation MR ↔ main** (ce document) : Thomas n'ayant pas mergé le MR et ayant
  développé parent62 en parallèle sur `main`, le merge `main` → `parents62` a produit une **union
  redondante**. Décision **« main canonique »** : on retire les doublons du MR, on garde les apports
  uniques. Détail au §9 (Impacts).
- **25/07 — MR #25 mergée dans `main`** (`f599357a`), suivie de correctifs de revue :
  `55288375` (3 bugs latents du filtrage search : `dateRange`, `field defaultChecked`, radio select),
  `b3cf8f4f` (labels de date i18n, chips `tagLimit`, ligatures communes NFKC), `f3a58609` (4 noms
  d'icônes hors catalogue lucide, qui rendaient `null` en silence), `994cba75` (4 `editModals`
  orphelins — les boutons « Modifier » remarchent), `ced1417f` (5 références de modales mortes),
  `b4584949` (couleurs de statut branchées).
- **25/07 — rendu par item de la recherche globale** (`feat/search-item-rules`, depuis **intégré à
  `main`**) : la page `/recherche` rendait une carte générique pour toutes les collections et son
  filtre « Paroles » ne renvoyait rien. Détail au §9bis.
- **27-30/07 — hygiène CSS du thème (Thomas, `main`)** : `79dc4637` (palette dupliquée retirée
  d'`index-parent62.css` — déjà injectée au runtime par `config.theme`) et `53f28ca1` (`.access-card`
  promue en **plancher partagé** dans `styles/shared.css`, le traitement parent62 devient le défaut
  du parc). Seuls commits du projet depuis le 25/07. Détail au §9ter.
- **03/08 — merge `fix/institut-bleu-ui` dans `main`** (`94251b7b`, 17 commits) : SDK **1.0.172**
  publié (`09e145a0`) et nouvelle variable **`VITE_SITE_PUBLIC_URL`** (`be7a320c`) — cf. §8.5 et
  §11. typecheck + préflight (22 fichiers / 412 tests) verts après merge, mesurés le 03/08.
- **06/08 — refonte accueil/header/footer + 11 nouvelles pages** (committé sur `parents62` —
  18 fichiers modifiés, 8 fichiers de code neufs) : accueil réduit à 3 sections data-driven
  (`featured-carousel` + `map-bubbles` + `articleTeaser`, 3 types de section neufs), header
  `type:"stacked"` (neuf), footer `type:"minimal-centered"` + image de fond (neuf), nav
  restructurée (dropdown « Publics » ajouté, entrée top-level « Rechercher » retirée), 11 pages
  ajoutées (35→46, 153→176 sections).
- **06/08 — review de la MR !32 → branche `fix/parents62-review`** (7 commits par-dessus
  `parents62`, dont préflight : l'agent local gitignoré `siteforge-config-auditor.md` n'est
  plus exigé par skill-integrity ; et **refactor `HeaderStacked` → bandeau dans le flux +
  barre sticky** : l'ancien bloc fixed à hauteur animée + spacer clippait logo/sous-titre
  sur petits écrans (Nexus 5), laissait transparaître la page dans la barre compactée
  (alpha de l'image) et faisait sauter le contenu de ~370px — recette navigateur
  desktop + mobile des deux mécaniques, rendu au repos et barre compacte conservés) :
  gates du skill config-assistant resynchronisées (table
  Headers + `stacked`,
  comptes 71→74, exemples `footer-contact-partners`/`header-transparent-scroll` re-pointés vers
  eXtremeDefiAdeme, recette `home-a-la-une` remplace `home-portail-services`) ; e2e réaligné
  (header stacked, dropdown « Publics ») ; fixes composants (`font-serif` égaré dans `rel`,
  `relative` manquant sur les pastilles MapBubbles, scrim sans fond supprimé, conflits de classes
  tranchés, variant `xs:` → `min-[475px]:`, boutons icône du header en prop `className`, autoplay
  pausable + `prefers-reduced-motion`, `aria-label` du footer retiré) ; images converties en WebP
  (**5,7 Mo → ~1,0 Mo**, `carte-territoire.png` jamais référencée supprimée) —
  `test:unit` **2 229/2 229** ✅.
- **06/08 — unification des couleurs du thème sur l'identité de la home** (stratégie A du
  rapport `commentaire/parent62-unite-couleurs-home.md`, local) : le thème passe
  d'indigo/or à **marine/turquoise/teal** (~12 tokens clair+sombre — `primary`→marine
  #2c3e50, `accent`→turquoise #4ecdc4, `secondary`→menthe, `chart1`→teal) ; les 35
  bandeaux `searchHeader` (`--gradient-section` dérivé de primary/accent), CTA, badges
  et liens suivent d'un coup. Tokens de marque `--p62-marine`/`--p62-turquoise` déclarés
  dans `index-parent62.css` et consommés par la config home (`background`/`accentColor`/
  `header.textColor` en `var()` — une seule source de vérité) ; hex territoires dupliqués
  de `/recherche` + `/temoignages` → `var(--territoire-*)` ; 7 snapshots du skill
  resynchronisés (`config:example --write`). Home visuellement inchangée (vérifié).
- **06/08 — mode sombre « de marque »** : 9 tokens de fond sombre re-basés famille marine
  (teinte 250, fini l'indigo-nuit hérité), chrome header/footer voilé par
  `dark:bg-background/90` (teinté par le thème, générique, ~10 % de texture aquarelle),
  wordmark `dark:text-accent` (les lettres creuses marine-sur-marine), carte des
  territoires tamisée en sombre (dégradé `.dark` assombri + `dark:brightness-75` sur
  l'illustration — le « projecteur » devient lueur douce). Clair strictement inchangé.
- **06/08 — lisibilité bandeaux territoires** : 5 des 9 bandeaux HTML (`Artois`,
  `Audomarois`, `Calaisis`, `Entre Mer et Terres`, `Ternois Bruaysis`) passent en encre
  marine (`var(--p62-marine)`) — le blanc y était à 1,8–2,5:1 (mesure WCAG), le marine
  monte à 4,4–6,2:1. Les 4 fonds foncés gardent le blanc. ⚠ tranche le « parti pris du
  site historique » documenté dans le CSS — à confirmer avec Sylvany/Peterson.
- **06/08 — unification de l'idiome titre des pages de liste** : les 15 pages `/theme/*`
  + `/public/*` passent de « section `title` + `searchHeader compact` » (patron
  historique, propagé par copie dans la MR) à l'idiome de `/blog` : `headline`/`subhead`
  DANS le `searchHeader` (le bandeau EST le hero) — 176→161 sections, recette
  `page-thematique` mise à jour (2 sections, couvre thèmes + publics). Les pages
  territoire gardent leur bandeau coloré (idiome à part, assumé).
- **25/08 — thèmes/catégorie de "parole de parent" en saisie libre, réservé admin** : les champs
  "Thèmes" (4 formulaires) et "Catégorie" (`parent62-affiche`) passent en `valueSelect` creatable ;
  une valeur inédite acceptée par un **admin** grandit aussi `costum.lists.themes`/
  `categoriesParole` (config-driven, `false` par défaut), un visiteur non-admin ne choisit que
  parmi l'existant ; filtres et formulaire se mettent à jour sans reload via la réactivité native
  du SDK (pas de store maison). Détail §9septies. Commit `bcd90e6d` sur `parents62`, **non pushé**.

---

## 2. Objectifs de la configuration

Ce que la config `parent62` doit produire, concrètement :

1. **Un site vitrine + réseau** calqué sur la navigation/graphisme du WP, sur le domaine
   `reseau.parent62.org`, en complément (non remplacement) du WordPress éditorial.
2. **Un moteur de recherche multi-type** (`/recherche`) filtrable par **type d'information**,
   **public**, **thème**, **territoire coloré**, **dates**, avec **vue carte** en bascule.
3. **Les contenus du réseau comme entités filtrables** : articles (POI `article`), **paroles de
   parents** (POI `affiche`), **ressources** (POI `recoveryCenter`), **événements** (agenda).
4. **La contribution des partenaires** via formulaires costum (config-driven, dynForm), avec
   **modération a priori** (native `preferences.toBeValidated`, SDK ≥ 1.0.168).
5. **La navigation territoriale** : 9 pages `/territoire/*` (contact coordo + 887 communes + fil
   d'articles), et un code couleur par territoire réutilisé carte + chips.
6. **Le référencement** préservé (SEO par page, JSON-LD, sitemap, robots, RSS).

La taxonomie est portée par des **champs** de premier niveau (`territoires`/`publics`/`themes`),
partagés par tous les types de contenu ; `tags` reste réservé aux mots-clés WordPress libres.

---

## 3. Architecture générale

```
 WordPress (parent62.org)          Communecter / cocolight-api-client (SDK 1.0.172)
   contenus éditoriaux                 poi (article/affiche/recoveryCenter) · events · costum
        │  import (6 434 articles)          ▲
        ▼                                   │ searchCostum / ADD_POI / ADD_NEWS
   ┌─────────────────────────── SiteForge (site-json) ───────────────────────────┐
   │  config.prod.parent62.json  →  SiteRenderer  →  pages / sections             │
   │    header.nav · pages[] · costumForms{} · theme                              │
   │  searchProStatic / articleFeed / agenda  →  buildSearchPayload  →  backend   │
   │  costumForms (dynForm) → registerCostumForm → EntityFormModal → ADD_POI      │
   └──────────────────────────────────────────────────────────────────────────────┘
        reseau.parent62.org (SSR : server/prod-server.js, VITE_SLUG=parent62)
```

**Comment les données arrivent à l'écran** — deux voies de filtrage, **toutes deux config-driven**,
valables pour `articleFeed`, `searchProStatic` et `agenda` :

| Voie | Écriture en config | Résultat backend |
|---|---|---|
| **Filtre figé** (page thématique / territoriale) | `props.filters` (articleFeed) ou `baseParams.defaultFilters` (searchProStatic) | `{ champ: { $in: [...] } }` |
| **Filtre interactif** (dropdown, sidebar) | filtre portant un `field` (`dropdownFilters[].field`, groupe `filters`, `searchTargets`) | converti par `searchByFieldsToQuery`, fusionné dans `defaultFilters` |

Un filtre **sans** `field` retombe sur les tags (`$all`) — ancienne convention, à ne plus utiliser.

**Cible « type d'information »** : les groupes `searchTargets` (filtre radio « type d'info ») portent
une cible par défaut appliquée à l'hydratation d'URL (`applyDefaultSearchTargets`) — sans injecter de
tag fantôme (apport MR, [`computeFiltersFromUrl.ts`](../src/modules/search/lib/computeFiltersFromUrl.ts)).

**Troisième voie : quel presenter pour quel item** (25/07). Les deux voies ci-dessus disent *quoi
chercher* ; elles ne disent pas *comment rendre*. Sur `/recherche`, aucune cible cochée ⇒ la liste est
**hétérogène** (articles, paroles, ressources, événements, structures mélangés) et le presenter ne
peut donc pas venir du filtre : il se décide **sur la donnée de chaque item**, via
`list.itemRules` — des règles à prédicat (`PredicateJson`, la grammaire de `visibleIf`) évaluées
contre `{...serverData, collection, sourceKey, sourceKeys}`. La première règle qui matche impose sa
carte, sa preview, son contrat de presenter et son action au clic. Voir
[doc/07 §Rendu PAR ITEM](../doc/07-module-search.md#rendu-par-item-des-listes-hétérogènes-listitemrules).

> ⚠️ **Deux pièges, tous deux silencieux.** (1) `serverData.type` a deux sémantiques — sous-type POI
> (`article`/`affiche`/`recoveryCenter`) mais sous-type d'ORGANISATION (`NGO`/`Group`…) sur
> `collection:"organizations"` : ancrer toute règle sur `collection` **avant** `type`. (2) Un champ
> testé absent de `baseParams.defaultFields` vaut `undefined` ⇒ la règle ne matche **jamais**, sans
> erreur. Les deux sont gatés par `tests/preflight/list-item-rules.test.ts`.

**Code couleur par territoire** : `map.marker.colorBy` et `list.card.tagColors` acceptent un `path` —
`{ path:"territoires", mapping:{ "Arrageois":"var(--territoire-arrageois)" } }`. `resolveColorBy` /
`decorateTags` lisent n'importe quel chemin ([`lib/colorBy.ts`](../src/modules/search/lib/colorBy.ts),
schémas `ColorByConfSchema`/`TagColorsConfSchema` dans [`schema.ts`](../src/modules/search/schema.ts)).

> ⚠️ **`applyValidationGate`** ([`buildSearchPayload.ts`](../src/modules/search/lib/buildSearchPayload.ts)) :
> dès qu'un `baseParams` porte un `costumSlug`, les entités en attente de validation
> (`preferences.toBeValidated.<slug>`) sont **masquées**. Opt-out : `showUnvalidated:true`.

---

## 4. Cahier des charges (intégré)

### 4.1 Constat et objectifs

**Limites** : recherche peu efficace · gestion des contenus chronophage · outils non reliés
(WordPress, GoGoCarto…) · faible capacité de contribution directe des acteurs.
**Objectifs** : conserver les qualités actuelles · améliorer l'UX · ajouter des modules intégrés ·
moteur de recherche performant · centraliser les ressources · faciliter la contribution ·
**maintenir le référencement**.

### 4.2 Exigences par domaine (proposition retenue au CDC)

| Domaine | Exigence CDC | Proposition retenue |
|---|---|---|
| **Pages statiques** | Réseau, équipe & contact, **présentation de chaque territoire (contact + communes)**, champs d'action, charte | Recréées côté SiteForge (contenus extraits du WP) |
| **Parcours** | Entrée **pro** et entrée **parents** | Pages `/parents` et `/pro` (accessibles depuis l'accueil) |
| **Moteur de recherche** | types d'info · public (âge) · dates · territoire coloré · carte filtrable · thème | `/recherche` (searchProStatic), sur le modèle `tierslieux.00.re/lieux` |
| **Paroles de parents** | audio + écrit, 3 types (Compliqué / Difficile / Ce qui est à changer), transcription, **ajout admin** | POI `affiche`, page `/temoignages`, form `parent62-affiche` + pile audio (approche Thomas) |
| **Articles** | forte activité, filtrage + liens ressources | WordPress pour la rédaction, **une entrée réseau par article** (moteur de recherche) |
| **Événements** | agenda par territoire · impression · récurrence · **ajout partenaires modéré** | `/agenda` + form `parent62-event` ; récurrence côté réseau social |
| **Ressources** | vidéos/photos, PDF, jeux ; filtres fins par territoire/ville | `/ressources` + form `parent62-recovery-center` (POI `recoveryCenter`) |
| **Annuaire partenaires** | référencement + cartographie | — (P2/P3) |
| **Publication RS / Mailing** | — | **Non engagé** (conseil : n8n) |

### 4.3 Déroulé et budget

| Partie | Budget | Contenu | Durée |
|---|---|---|---|
| **Partie 1** | 3 000 € | lancement `reseau.parent62.org` · module Paroles (admin) · moteur V2 territorial | 3 sem. bêta |
| **Partie 2** | 4 500 € | module événementiel · module actualités (interop WP) · recherche events+actus, accueils | 2 sem. bêta |
| **Partie 3** | 2 000 € | module ressources · recherche ressources | — |
| Autres | 2 500 € | hébergement + maintenance 1 an · retours/bugs · coordination | — |

---

## 5. Modèle de données réel

> Constaté sur le dump de production restauré en local (base `prod200726`), **en lecture seule**,
> le 20/07/2026. Chiffres du dump.

### 5.1 Périmètre

| Collection | Docs `source.key = "parent62"` | Types |
|---|---|---|
| `poi` | **6 434** | `article` uniquement |
| `news` | 6 434 | `activityStream` (traces d'import) |
| autres | 0 | — |

**Aucun** POI `affiche` (paroles), aucune structure, aucun événement, aucune ressource au 20/07.
La clé `parents62` (avec un **s**) n'existe sur **aucun** document — slug de dev abandonné.

### 5.2 Les 4 champs transverses (convention du 20/07)

La taxonomie vit dans des **champs de premier niveau**, mêmes noms sur tous les types :

| Champ | Type | Source des valeurs |
|---|---|---|
| `territoires` | `string[]` | `costum.lists.territoires` (10 valeurs) |
| `publics` | `string[]` | `costum.lists.publics` (7 valeurs) |
| `themes` | `string[]` | `costum.lists.themes` (18 valeurs) |
| `tags` | `string[]` | libre (mots-clés WordPress) |

**Territoires** (nb d'articles) : Boulonnais 1 075 · Entre Mer et Terres 990 · Arrageois 761 ·
Audomarois 680 · Calaisis 653 · Familles en sol mineur Lens Liévin 563 · Ternois Bruaysis 538 ·
Artois 502 · Familles en sol mineur Hénin Carvin 306 · **Familles en sol mineur** (générique) 43
← *10e valeur, arbitrage réseau en attente*.
**Publics** : Parents 2 680 · Parents-enfants 1 467 · En famille 1 303 · Enfance 1 091 ·
Professionnels 524 · Futurs parents 343 · Bénévoles 73.
**Thèmes** (18) : Les activités supports à la relation 1 974 · La petite enfance 1 333 …
Le deuil 6.

> ⚠️ **Encodage.** Les libellés utilisent l'apostrophe typographique **U+2019** (`L’école`) et un
> tiret demi-cadratin (`Les écrans – Le numérique`). Un filtre écrit avec une apostrophe droite
> renvoie **0 résultat sans erreur**. Copier-coller depuis `costum.lists`, ne jamais retaper.

### 5.3 Le costum backend

Embarqué dans le document de l'orga (`organizations.costum`). Au 20/07, `typeObj` ne contenait que
`article`. L'approche retenue (Thomas, main) déclare désormais les formulaires costum
`parent62-affiche`/`-article`/`-recovery-center`/`-event` côté **config** (dynForm), adossés aux
`typeObj` backend — dont le déploiement effectif en base reste à confirmer (cf. §11).

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| **Config & CSS** | [`config.prod.parent62.json`](../config.prod.parent62.json), `src/index-parent62.css`, [`sites.json`](../sites.json) |
| **Recherche (apports MR conservés)** | `src/modules/search/schema.ts` (`FilterGroup.field`, `searchTargets`, `dateRange`, `ColorByConfSchema`, `TagColorsConfSchema`), `lib/colorBy.ts`, `lib/computeFiltersFromUrl.ts`, `lib/computeUrlFromFilters.ts`, `lib/filterToggles.ts`, `hooks/useFilterToggles.ts`, `components/card/CardDefault.tsx` |
| **Parole / ressource / event (main canonique)** | `components/card/CardTestimonial.tsx`, `CardResource.tsx`, `preview/PreviewTestimonial.tsx`, `PreviewResource.tsx`, `lib/testimonial.ts`, `hooks/useResource*.ts`, `modules/agenda/*`, `components/media/*` (AudioPlayer/Recorder…) |
| **Rendu par item / action au clic (25/07)** | `src/lib/entityMatch.ts` (+ `.test`), `src/modules/search/lib/resolveListItemConf.ts` (+ `.test`), `lib/itemAction.ts` (+ `.test`), `tests/preflight/list-item-rules.test.ts` ; modifs `schema.ts` (`CardConfSchema` extrait, `ListItemRuleSchema`, `ListItemActionSchema`), `components/SearchListView.tsx`, `SearchCard.tsx`, `Preview.tsx`, `SearchMap*.tsx` ; outillage `scripts/lib/prop-descriptions.ts`, `scripts/audit-config.ts`, `scripts/lib/config-blocks.ts` |
| **Territoires** | `src/data/territoires62.ts` (+ `.test`), `scripts/import-communes-territoires62.ts` |
| **Header** | `src/components/layout/header/HeaderTransparentScroll.tsx` (fix lisibilité) |
| **Refonte accueil/header/footer (06/08)** | `src/components/layout/header/HeaderStacked.tsx` (neuf), `src/components/layout/footer/FooterMinimalCentered.tsx`, `src/components/sections/MapBubbles.tsx` (neuf), `src/modules/search/sections/FeaturedCarouselSection.tsx`+`FeaturedCarouselSlide.tsx` (neufs), `src/modules/search/lib/featuredCarouselFilters.ts` (+`.test`, neufs), `src/modules/blog/sections/ArticleTeaser.tsx` (neuf), `src/modules/blog/lib/articleLink.ts` (+`.test`, neuf, extrait d'`ArticleFeed.tsx`) ; schémas `src/types/site-schema.ts` (`MapBubblesSchema`, `Header.backgroundImage/textColor/logoTitleAccent`, `Footer.backgroundImage`), `src/modules/search/schema.ts` (`FeaturedCarouselSectionSchema`), `src/modules/blog/schema.ts` (`ArticleTeaserSectionSchema`) ; câblage `src/components/layout/SiteHeader.tsx`, `src/components/sections/SectionRenderer.tsx`, `src/components/admin/section-meta.ts` ; `src/index-parent62.css` (breakpoint `xs`, `@layer base`, police) |
| **Ajustement hauteur header/à la une (13/08)** | `src/components/layout/header/HeaderStacked.tsx` (`min-h` désormais `xl:`-only, échelle logo/titre/sous-titre), `src/modules/search/sections/FeaturedCarouselSection.tsx`+`FeaturedCarouselSlide.tsx` (padding réduit, `object-contain`, ratio `16/10`) (§9quinquies) |
| **Champ dynamique thème/catégorie** | `src/components/ui/select-objet.tsx` (widget `SelectObject`, générique, utilisé entre autres par les listes dynamiques costum — feature `9e789e38`) |
| **Dédoublonnage territoire « Familles en sol mineur » (13/08)** | `config.prod.parent62.json` (nav, filtres `enum`, `TagColorsConfSchema`, logo), `src/index-parent62.css` (variable `--territoire-familles-en-sol-mineur`) (§9quinquies) |
| **Thèmes/catégorie en saisie libre, promotion admin (25/08)** | `config.prod.parent62.json` (`widgetProps.saveNewValue`/`list`, `optionsKey` sur 23 filtres, `afterSubmit` par formulaire) ; nouveaux `src/modules/profil/forms/costum/parent62/fns.ts` (+ `.test.ts`), `src/hooks/useCostumLists.tsx` (+ `.test.tsx`), `src/modules/profil/forms/fields/valueSelectAccess.ts` (+ `.test.ts`) ; modifs `src/modules/profil/forms/fields/ValueSelectField.tsx`, `src/modules/profil/forms/registerWidgets.tsx`, `src/modules/profil/forms/registerSpecFns.ts`, `src/modules/search/hooks/useDynamicFilterOptions.ts`, `src/modules/search/schema.ts` (`optionsKey`), `src/modules/search/lib/dropdownFilters.ts` (`mergeDeduped`, + `.test.ts`), `src/lib/costumLists.ts` (§9septies) |
| **Tests** | `e2e/parent62.spec.ts`, `src/modules/search/lib/colorBy.test.ts`, `src/modules/profil/forms/costum/__fixtures__/configCostum.ts` |
| **Déploiement** | `server/prod-server.js`, `server/lib/sitemap.js`, `.env` (`VITE_SLUG`, `VITE_BASE_URL_BACKEND`, `SITE_CONFIG_PATH`, `VITE_SITE_PUBLIC_URL`) — dérivable via `npm run deploy:env` (`scripts/lib/sites.ts`) |

---

## 7. Choix techniques et leur pourquoi

| Décision | Pourquoi |
|---|---|
| **`main` canonique pour parole/ressource/event/audio** | Thomas (chef de projet) a développé l'approche **générique et config-driven** sur `main` (contrats `testimonial`/`resource`, pile audio mutualisée) ; elle suit la philosophie moteur (« noms de design, jamais de site ») et sera maintenue |
| **Slug unique `parent62`** | clé des 6 434 articles et de l'orga ; `parents62` ne référence aucune donnée |
| **Taxonomie en champs, pas en tags** | 5 261 articles portent déjà `territoires[]` ; le moteur filtre par champ sans code |
| **Toujours des tableaux** pour les 3 taxonomies | la base contient des multi-valeurs ; un select mono écraserait un tableau à l'édition |
| **`searchTargets`/`dateRange` conservés (apport MR)** | absents de `main` ; portent la cible « type d'info » par défaut sans tag fantôme + le filtre par plage de dates |
| **`colorBy`/`tagColors` conservés (apport MR)** | consommés par les chips `/recherche` (`CardDefault`) et la carte (`markerVisual`) — pas un doublon des badges `testimonial` |
| **Pages territoire à paths littéraux** | `SiteRenderer` résout par égalité stricte — pas de route paramétrée |
| **Référentiel territoires versionné front** | source unique libellés/couleurs (`var(--territoire-*)`)/887 communes ; jamais d'hex en dur |
| **Une règle de rendu porte SA tranche complète** (carte + preview + contrat + action) | carte et détail sortent de la MÊME résolution → l'incohérence entre ce qu'on voit dans la grille et ce qu'on voit au clic devient impossible par construction |
| **Faire varier la valeur de `list`, plutôt qu'ajouter une prop** | tout l'aval (`SearchCard`, `Preview`, `SwitchDetailsMode`, presenters typés) reste inchangé ; sans règles, `list` est renvoyé **par identité référentielle** → non-régression prouvable (`toBe(list)`) pour les ~13 autres sections search du site |
| **Une actualité ouvre le reader blog, pas un drawer** | un POI `type:"article"` a déjà sa page canonique `/blog/:slug` (SSR + SEO) ; la rouvrir en drawer dupliquerait l'UX et perdrait le référencement |
| **`/public/*` scope par le champ `publics` existant, pas un nouveau champ** (06/08) | les 7 valeurs de `publics` (§5.2) sont déjà portées par les articles ; une page par valeur (`filters:{publics:{$in:[...]}}` sur `articleFeed`) est purement config-driven, zéro donnée/costum neuf |
| **`/appels-a-projets` et `/offres-emploi` filtrent par `tags`, pas par un champ dédié** (06/08) | même convention que les pages `/theme/*` existantes (mots-clés WordPress libres, cf. §2) ; pas de nouvelle taxonomie pour deux catégories de contenu ponctuelles |
| **`background`/`accentColor` en couleur FIXE (hex), jamais `text-foreground`** (`featured-carousel`, `articleTeaser`, 06/08) | ces blocs posent un fond marine fixe pour rester de la même famille visuelle sur toute la home ; `text-foreground` s'inverserait en mode clair et deviendrait illisible sur un fond sombre qui, lui, ne s'inverse pas |
| **Wordmark header en 2 segments (`logoTitle`+`logoTitleAccent`)** (`stacked`, 06/08) | rendre « parent » (contour) + « 62 » (plein) séparément, en couleurs fixes indépendantes du mode, sans dupliquer tout le champ `logoTitle` ni coder le découpage en dur dans le composant |
| **Liste statique + écriture front, plutôt que recette dynamique backend** (thèmes/catégorie, 25/08) | la conversion en recette dynamique (le mécanisme "propre", déjà éprouvé sur institut-bleu) est hors de portée depuis `site-json` seul |
| **`saveNewValue` config-driven, `false` par défaut** (25/08) | opt-in explicite par champ, introspection du descripteur du formulaire plutôt qu'une liste de champs codée en dur en TS — un futur champ `valueSelect` n'écrit dans aucune liste partagée sauf déclaration explicite en config |
| **`saveNewValue` restreint aussi `creatable` aux admins** (25/08) | un visiteur non-admin sur un champ qui promeut vers la liste partagée ne doit pas pouvoir taper une valeur inédite — sinon la saisie serait acceptée sur sa fiche mais jamais partagée, incohérence silencieuse |
| **Réactivité via les signaux natifs du SDK (`useReactiveProperty`), pas un store maison** (25/08) | réutilise un mécanisme déjà éprouvé (~14 usages dans le repo) plutôt que d'en inventer un parallèle ; `carrier.refresh()` suffit, `_setData` préservant les signaux réactifs sur le même proxy — aucun nouveau `setEntity`/contexte |

---

## 8. Étapes de mise en place

1. **Config** : `config.prod.parent62.json` + `src/index-parent62.css` référencés dans `sites.json`
   (slug `parent62`).
2. **Données** : import WordPress → 6 434 POI `article` (`source.key=parent62`) ; taxonomie mappée
   sur `territoires`/`publics`/`themes` via `costum.import.mapping`.
3. **Formulaires costum** : déclarés en config (`costumForms{}`), compilés par `registerCostumForm`
   (voie unique runtime = test), fns génériques via `registerSpecFns`.
4. **Validation** (gates, dans `site-json/`) :
   `npm run config:validate` · `npm run audit:config` · `npm run typecheck` · `npm run lint` ·
   `npm run test:unit` · `npm run build`. E2E ciblé : `npx playwright test e2e/parent62.spec.ts`
   (jamais la suite e2e complète — specs d'autres devs).
5. **Déploiement (1.10, à la main de Peterson)** :
   - DNS `reseau.parent62.org` → serveur de prod.
   - Build : `VITE_SLUG=parent62` + `VITE_BASE_URL_BACKEND=<backend prod>` **sans guillemets**
     dans le `.env` (une valeur quotée fait échouer le préflight `environment` et se retrouve dans
     le bundle).
   - Serveur (`server/prod-server.js`) : `SITE_CONFIG_PATH=./config.prod.parent62.json`
     (**obligatoire**) et `VITE_SITE_PUBLIC_URL=https://reseau.parent62.org` (nouvelle variable,
     merge du 03/08, `be7a320c`) — **l'URL publique du site-json lui-même** : canonical,
     `og:url`/`og:image`, `sitemap.xml`, flux RSS. Lue par `getSitePublicUrl()`
     ([`src/lib/constant/common.ts`](../src/lib/constant/common.ts)) et
     [`server/lib/sitemap.js`](../server/lib/sitemap.js) ; repli `getServerUrl()` si absente
     (comportement historique) ; l'ancien nom `SITE_PUBLIC_URL` n'est plus accepté qu'en repli
     legacy par `sitemap.js`. **Ne PAS confondre avec `VITE_SERVER_URL`** (= serveur communecter :
     images `/upload`, embed co2, cagnotte), qui garde sa valeur parc.
   - ⚠️ `npm run deploy:env` dérive `VITE_SITE_PUBLIC_URL` de `sites.json` (`aliases[0]`
     prioritaire, sinon `domain`) — or l'entrée `parent62` n'a **pas d'`aliases`** et déclare
     `domain: parent62.00.re` : la dérivation donnerait `https://parent62.00.re`. Pour
     `reseau.parent62.org`, déclarer l'alias dans `sites.json` ou poser la variable à la main (§13).

---

## 9. Impacts des modifications — réconciliation MR ↔ main (24/07)

Le merge `main` → `parents62` (`347f853`) était propre côté git mais **redondant** : la config
unionnait les deux approches. Décision **« main canonique »**. Réalisé :

### 9.1 Réparation d'un conflit de merge (build cassé)

`src/modules/search/schema.ts` référençait `ColorByConfSchema`/`TagColorsConfSchema` **sans leurs
définitions** (perdues à la résolution du conflit) → `config:validate`/`build` en `ReferenceError`.
Définitions **restaurées** (apport MR `b0e8062`) juste avant `ListConfSchema`.

### 9.2 Doublons du MR retirés (au profit de la version de Thomas)

| Retiré (MR) | Conservé (main, canonique) |
|---|---|
| Page `/paroles` (+ sections `type:"parole"`) | Page `/temoignages` |
| Form `parent62-parole` + champ `paroleAudioUrl` + transforms `parent62:audioUrlRead/omit/mediasWrite` | Form `parent62-affiche` |
| `PreviewParole.tsx` (+ `case "parole"` de `Preview.tsx`) | `PreviewTestimonial.tsx` |
| Pile audio `ui/audio-player.tsx` + `lib/audioPlayerUtils.ts` (+ test) | `components/media/AudioPlayer`/`AudioRecorder` |
| `costum/parent62/fns.ts` (+ import dans `registerSpecFns.ts`, entrée fixture `configCostum.ts`) | — (config-only) |
| Entrée nav top-level « Paroles » → `/paroles` ; 2 CTA `/paroles` **repointés** → `/temoignages` | Entrée « Paroles de parents » → `/temoignages` (menu « Contenus ») |
| **Page `/agenda` en double** (path dupliqué, `config:validate` exige des paths uniques) | Page `/agenda` de Thomas (module agenda + `parent62-event`) |

### 9.3 Apports du MR conservés (absents de `main`)

Couche `searchTargets`/`dateRange`, coloration `colorBy`/`tagColors`, **fix header transparent**,
**suite e2e**, **territoires62** (data + import + 9 pages `/territoire/*`), pages `/recherche`,
`/parents`, `/pro`, `/communaute`.

### 9.4 Régressions à revalider (visuel, hérité du merge)

Sous-titre `TitleSection` (`<h3>` gras → `<p>` muted), carte Leaflet → MapLibre
(`streets-v2` → `streets-v4`), onglet Galerie de profil réellement rendu, droits d'édition élargis
aux admins costum.

### 9.5 Nav consolidée + audit fonctionnel (24/07)

- **Nav** : doublon `/blog` résolu — « Actualités » (MR) remplacée par le dropdown « Thèmes »
  canonique de Thomas. Nav = 5 entrées (cf. §12).
- **Audit fonctionnel sur la stack** (dev server :5173 + backend `communecter74-dev` up) : les
  35 pages rendent en **200 sans erreur SSR** ; **e2e 7/7 vert** (accueil nav 5 entrées,
  `/recherche` ×2, `/temoignages`, `/territoire/arrageois`, `/blog`, mode sombre). Les statuts
  P2/P3 ont été revus à cette occasion (§10) — plusieurs sont plus avancés que la config seule
  ne le laissait penser (récurrence, recherche ressources, modération events câblées).

### 9.6 Validation (gates)

`config:validate` ✅ (35 pages, 153 sections) · `audit:config` ✅ (0 constat parent62) ·
`typecheck` ✅ (0) · `build` ✅ (48 s) · **e2e 7/7 ✅**. `test:unit` : 1834 ✅, 2 échecs
**pré-existants hors périmètre** (`bundle-size` 2,43 MB — bloat du merge ; `environment` `.env`
quoté). `lint` : 4 erreurs **pré-existantes** identiques à `main` (`blog/ArticlePage`,
`ArticleFeed`, `ArticleReaderSection`, `.design-sync/`) — code de Thomas, hors périmètre.

---

## 9bis. Impacts — rendu par item de la recherche globale (25/07)

> Lot `feat/search-item-rules` : `caa0a364` (moteur), `fd3d9a4c` (config parent62),
> `7017dc77` (doc + skill). **Intégré à `main`** depuis — les 3 commits figurent dans
> l'historique first-parent de `main` (constaté le 03/08).

### 9bis.1 Le constat

Les pages **dédiées** par type fonctionnaient (`/blog`, `/temoignages`, `/ressources`, `/agenda`,
`/communaute`). La seule défaillante était `/recherche`, pour trois raisons cumulées, toutes dans sa
config :

| Symptôme | Cause | Preuve |
|---|---|---|
| Filtre « Paroles » : **liste vide** | la cible portait `defaultFilters: {type:"affiche", **status:"validated"**}`, or `status` n'existe pas sur ces documents — la modération a priori avait été retirée (`17aea3e`) et le filtre était resté orphelin | `{type:"affiche"}` seul renvoie les paroles ; `+ status` en renvoie **0**, sans erreur |
| Actualités : carte générique, clic vers un drawer | `list.card.type:"default"` valait pour les 4 collections ; aucun `preview`, aucun bloc de presenter | comparaison ligne à ligne avec `/blog`, `/temoignages`, `/ressources` |
| Ordre arbitraire | ni `defaultSortBy` ni `defaultFields`, là où les trois pages dédiées déclarent les deux | idem |

### 9bis.2 Ce qui a changé

**Moteur** (`src/`) — le choix du presenter devient config-driven et **par item** : `list.itemRules`
(règles à prédicat) + `list.itemAction` (`preview` / `profil` / `link`). Le trio *(vue matchable +
première règle + garde)* est extrait en `src/lib/entityMatch.ts`, désormais partagé avec les
`iconRules` de la palette (qui n'avaient aucun test et en héritent). La cascade de décision au clic
est une fonction pure partagée par la liste et la popup de carte, qui l'appliquaient en double.

**Config parent62** — `status` retiré de la cible « Paroles » ; cible « **Ressources** » ajoutée
(elle manquait alors que `/ressources` existe) ; `defaultSortBy {created:-1}` + `defaultFields`
(25 champs) ; **5 règles** : `poi-article` (presenter `resource` + clic vers `/blog/:slug`),
`poi-parole` (testimonial en dialog), `poi-ressource`, `events`, `structures`.

**Deux bugs préexistants corrigés au passage** :
- `list` n'était pas transmis au détail ouvert **depuis la carte géographique** → les previews
  config-driven (`resource`/`testimonial`) y retombaient sur les défauts génériques ;
- l'identité d'item **divergeait** entre l'écriture de `?preview=` (`getEntryId`) et sa relecture
  (`serverData.id ?? id`), or `serverData.id` n'est pas toujours peuplé → un deep-link pouvait ne
  pas rouvrir son item. Unifié sur `getEntryId`.

**Outillage** — `baseParams.defaultFields` enfin décrit dans le registre de props (c'est la clé dont
dépend tout le matching, elle n'y était pas) ; ratchet de couverture remonté 45→60 et 57→72 ;
`audit:config` contrôle désormais `itemAction.to`/`toById` ; nouveau préflight
`tests/preflight/list-item-rules.test.ts` — **seul endroit où `ListItemRuleSchema` est réellement
exécuté**, la config n'étant jamais parsée par Zod au runtime.

### 9bis.3 Régressions à revalider

- **`defaultFields` introduit là où il n'y en avait pas** : la projection devient restrictive sur
  `/recherche`. Recette visuelle faite sur les 6 familles (liste hétérogène + chaque cible) — à
  refaire si un champ est ajouté à un presenter.
- **Chemin carte non vérifiable** : aucune famille de ce jeu de données n'est géolocalisée (la vue
  carte affiche « Aucun résultat » pour les actualités comme pour les structures). L'action au clic
  depuis la popup est donc couverte **par tests unitaires uniquement** — à revalider dès que des
  données porteront des coordonnées.

### 9bis.4 Validation (gates) — mesurés le 25/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 35 pages, 153 sections |
| `audit:config` | ✅ parent62 **RAS** (0 constat) |
| `typecheck` | ✅ |
| `test:unit` | ✅ **1977** sur 155 fichiers — dont `bundle-size` et `environment`, les **2 échecs pré-existants du 24/07, désormais verts** |
| `build` | ✅ client 33,7 s + SSR 15,5 s |
| `e2e` | ✅ **7/7** (57,1 s) sur la stack réelle — `npx playwright test e2e/parent62.spec.ts` |
| `lint` | 29 erreurs / 47 warnings, **0 sur les fichiers du lot** — pré-existantes et identiques à `main` (`blog/*`, `agenda`, `.design-sync/`, `ds-bundle/`, `admin/zod-auto-form`, `entityIcons`, `profil/forms`) |

---

## 9ter. Impacts — hygiène CSS du thème (27-30/07) et état au 03/08

Deux correctifs de Thomas sur `main` — les **seuls commits touchant les fichiers du projet depuis
le 25/07** (`git log 4e6e0f3c..HEAD -- config.prod.parent62.json src/index-parent62.css …`). La
config `config.prod.parent62.json` est **inchangée** : 35 pages / 153 sections, 4 `costumForms`
(revérifié le 03/08).

### 9ter.1 `79dc4637` (27/07) — palette dupliquée retirée du CSS

`src/index-parent62.css` redéclarait en `:root`/`.dark` les 46 + 32 tokens que `config.theme`
injecte déjà au runtime via `SiteTheme` (−115/+14 lignes) — même palette écrite deux fois, risque
de divergence silencieuse. Vérifié avant coupe : les 46 variables retirées ont toutes un équivalent
parmi les 54 injectées (diff d'ensembles contre le `<style id="site-theme">` réellement servi).
Piège relevé : `--radius` vient de `theme.borderRadius.base`, pas d'un `theme.radius`. Les ombres
teintées indigo supprimées étaient **mortes** (les ombres neutres de la config l'emportaient) —
les promouvoir dans `theme.shadows` reste une décision de design, consignée en commentaire.
Rendu comparé avant/après sur `/temoignages`, clair et sombre : **identique**.

### 9ter.2 `53f28ca1` (30/07) — `.access-card` devient un plancher partagé

`HeroQuickAccess` émet `access-card access-card-{public|pro}`, mais la classe n'était définie que
dans 2 feuilles de thème (parent62, sport-santé) sur 5 configs utilisatrices → cartes « nues »
ailleurs, panne silencieuse qu'aucun test ne voit. Le traitement **parent62** (verre translucide,
lift doux) est déplacé tel quel dans `src/styles/shared.css` (`@layer components`), entièrement
piloté par les tokens injectés au runtime (`--card`/`--border`) ; le bloc local
d'`index-parent62.css` est retiré, devenu identique. **parent62 vérifié inchangé** en navigateur
(le commit corrige saint-paul-sport, pas parent62).

### 9ter.3 Régressions à revalider

Aucune spécifique parent62 : les deux commits annoncent un rendu comparé identique. À garder à
l'œil lors de la prochaine recette visuelle : cartes d'accès rapide de l'accueil (verre
translucide) et palette indigo en clair **et** sombre (les tokens ne viennent plus que de
`config.theme`).

### 9ter.4 Validation (gates)

| Gate | 30/07 (commit `53f28ca1`) | 03/08 (post-merge `fix/institut-bleu-ui`, mesuré ce jour) |
|---|---|---|
| `lint` | ✅ 0 erreur | ✅ **0 erreur** / 18 warnings |
| `typecheck` (`tsc -b`) | ✅ | ✅ |
| `test:preflight` | ✅ 331 tests | ✅ **412 tests / 22 fichiers** (4,4 s) |
| `test:unit` | ✅ 2090 tests | non relancé le 03/08 |
| `config:render` parent62 | ✅ 153/153 sections | — (config inchangée) |

---

## 9quater. Impacts — refonte accueil/header/footer + pages Publics (06/08)

> **Chantier committé sur `parents62`** le 06/08 (18 fichiers modifiés + 8 fichiers de code
> neufs + assets). Validation automatisée (gates) faite, cf. §9quater.3. **Validation fonctionnelle/visuelle
> (recette) et auteur du design original (Peterson/Thomas ?) restent à confirmer avant fusion
> dans `main`.**

### 9quater.1 Ce qui a changé

**Accueil (`/`)** — passe de 7 sections (`hero-quick-access`, 2×`action-tiles`,
`cta-card-grid`, `html`, `articleFeed`, `cta`, `layout:"default"`) à **3 sections data-driven**
(`layout:"fullwidth"`) :
1. `featured-carousel` (id `home-featured-poi`) — carrousel plein écran des POI tagués
   `"A la une"` (`sourceKey:["parent62"]`), CTA vers `/blog/:slug` ou `/blog/id/:id`, fond
   `#2c3e50`/accent `#4ecdc4`, autoplay 6 s.
2. `map-bubbles` (id `carte-territoires`) — carte illustrée (`carte-territoire-teal.webp`) +
   9 bulles-marqueurs cliquables (positions `x`/`y`/`size` en %, calibrées à la main sur la
   maquette — **ne pas les retoucher sans re-regarder le rendu**) vers les 9 pages
   `/territoire/*`, dégradé de fond `--p62-map-bg-from/to`.
3. `articleTeaser` (id `zoom-reseau`) — aperçu figé des 6 derniers articles du costum
   (sans pagination), CTA « voir tout » vers `/blog`.

**Trois types de section neufs**, tous génériques (moteur, pas parent62-only) :

| Type | Schéma | Composant | Doc |
|---|---|---|---|
| `featured-carousel` | `src/modules/search/schema.ts` (`FeaturedCarouselSectionSchema`) | `src/modules/search/sections/FeaturedCarouselSection.tsx` + `FeaturedCarouselSlide.tsx`, filtre `lib/featuredCarouselFilters.ts` (+ `.test.ts`, 10 tests ✅) | — (à ajouter à doc/07) |
| `map-bubbles` | `src/types/site-schema.ts` (`MapBubblesSchema`) | `src/components/sections/MapBubbles.tsx` | — |
| `articleTeaser` | `src/modules/blog/schema.ts` (`ArticleTeaserSectionSchema`) | `src/modules/blog/sections/ArticleTeaser.tsx` | `doc/32-module-articles-blog.md` (mis à jour) |

`articleFeed` et `articleTeaser` partagent désormais `src/modules/blog/lib/articleLink.ts`
(`normalizeArticleResult`/`articleHref`, extrait de `ArticleFeed.tsx` — 10 tests ✅ dans
`articleLink.test.ts`) : même résolution `/blog/:slug` ou `/blog/id/:id`, une seule source.

**`featured-carousel` et `articleTeaser` partagent le même mécanisme `background`/`accentColor`**
(couleurs FIXES config-driven, indépendantes du mode clair/sombre — cf. commentaires des deux
schémas) : volontaire, pour que les deux blocs restent visuellement de la même famille sur la home.

**Header** — `type:"transparent-scroll"` → **`type:"stacked"`** (neuf, `HeaderStacked.tsx`,
290 lignes, générique) : 2 sections empilées sur image de fond (`backgroundImage`, réutilise
`bg-footer.webp`) — logo + wordmark **bicolore 2 segments** (`logoTitle` "parent" en
`textColor`/contour blanc + `logoTitleAccent` "62" en blanc fixe) plein écran (`50vh`), qui
collapse en barre compacte au scroll (logo remonte à gauche de la nav, même mécanique que
`HeaderTransparentScroll`/`useScrollAware`). Nouveaux champs `Header.backgroundImage`,
`Header.textColor`, `Header.logoTitleAccent` dans `site-schema.ts` — génériques, ignorés par
les autres variantes.

**Footer** — `type:"contact-partners"` → **`type:"minimal-centered"`**, désormais avec image de
fond (`Footer.backgroundImage`/`backgroundImageAlt`, neufs, génériques). `FooterMinimalCentered.tsx`
bascule en mode « texte blanc sur fond image » quand `backgroundImage` est posé (nav/liens légaux/
copyright), sinon rendu inchangé. Tailles de police de la nav/bas de page relevées d'un cran
(`sm:text-sm`→`sm:text-base`, `sm:text-xs`→`sm:text-sm`) pour matcher le header.

**Nav** — restructurée en **5 dropdowns** (tous avec enfants désormais) : « Le Réseau
parentalité » (absorbe `/mois-parentalite`, `/contact`, `/communaute` comme enfants — ils
n'étaient pas dans ce dropdown avant), « Territoires » (10, inchangé), « Thèmes » (8, inchangé),
**« Publics » (neuf, 7 entrées)**, « Contenus » (4, inchangé). **L'entrée top-level
« Rechercher » → `/recherche` est retirée** ; la page `/recherche` existe toujours
(`config:validate` la compte) mais n'est plus liée depuis la nav — la recherche reste accessible
via `header.utilities.search` (⌘K, `CommandTriggerButton`, inchangé).

**11 pages ajoutées** (35→46 pages, 153→176 sections, `config:validate` ✅ le 06/08) :
- **7 pages `/public/<slug>`** (`benevoles`, `en-famille`, `enfance`, `futurs-parents`,
  `parents`, `parents-enfants`, `professionnels`) — une par valeur du champ `publics` déjà
  présent en base (cf. §5.2, mêmes 7 valeurs). Chacune : `title` + `searchHeader` (filtres
  thème/territoire) + `articleFeed` scopé `filters:{publics:{$in:["<Valeur>"]}}`. Purement
  config-driven, **aucune donnée ni costum neuf**.
- **2 pages de contenu tagué** : `/appels-a-projets` et `/offres-emploi` — même patron que les
  pages `/theme/*` existantes : `articleFeed` filtré par **tag WordPress libre**
  (`filters:{tags:"Appels à projets"}` / `"Offres d'emploi"`), pas un nouveau champ de taxonomie.
  Zéro impact backend.
- **2 pages légales/placeholder** : `/archives`, `/politique-cookies` — contenu statique
  « en construction ».

### 9quater.3 Validation (gates) — suite complète rejouée le 06/08, avant commit

| Gate | Résultat |
|---|---|
| `config:validate` parent62 | ✅ **46 pages, 176 sections** |
| `audit:config` parent62 | ✅ RAS |
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ **0 erreur** / 18 warnings — **0 sur les fichiers du lot** (tous les warnings sont dans `EntityFormModal.tsx`, pré-existant hors périmètre) |
| `test:unit` (suite complète, inclut `test:preflight`) | ✅ **2 227/2 229** — 2 échecs restants, **pré-existants et hors périmètre** (`bundle-size` : bundle principal **2,56 Mo** > 2 Mo ; `.claude/agents/siteforge-config-auditor.md` manquant — confirmés identiques sur `HEAD` via `git stash`) |
| `test:integration` (SSR) | ❌ **2 échecs / 56 tests** dans `config-driven-ssr.test.ts` (title + footer copyright) — **pré-existants et sans rapport avec ce chantier** : le test lit ses valeurs attendues dans `config.prod.json` (générique, repli par défaut de `SITE_CONFIG_PATH`, non défini dans cet environnement) alors que le serveur SSR réel sert `config.prod.parent62.json` (`VITE_SLUG=parent62` dans `.env`) — mismatch d'environnement de test, **confirmé identique sur `HEAD`** via `git stash` (2/56 déjà rouges avant ce chantier) |
| `e2e` ciblé (`npx playwright test e2e/parent62.spec.ts`) | ❌ **2 échecs / 8** (6 ✅) — `page.locator("nav.fixed")` se résout ; les 2 mêmes tests restent rouges pour des raisons **distinctes** (pas des bugs de composant) — « Professionnels » désormais dans le header (contredit la décision du 23/07) et assertion `bg-background/90` écrite pour l'ancien header `transparent-scroll`, pas pour la mécanique d'opacité de `stacked`. Le test « accueil : bandeau à la une » (nouveau du 06/08) passe |

---

## 9quinquies. Impacts — ajustement hauteur header/à la une, catégorie dynamique, dédoublonnage territoire (13/08)

> Périmètre de ce lot : `HeaderStacked.tsx`, `FeaturedCarouselSection.tsx`/
> `FeaturedCarouselSlide.tsx`, `select-objet.tsx`, `config.prod.parent62.json` (logo + territoires)
> et `index-parent62.css` (territoires). **Un autre chantier coexiste dans le même répertoire de
> travail mais reste volontairement EXCLU de ce lot** (traité séparément) : un fix « événement
> récurrent » (`useItem.tsx`/`eventDates.ts`). Les exemples du skill `config-assistant` et
> `ArticleFeed.tsx` (fix scroll infini du fil d'articles) ne sont pas non plus repris ici.

### 9quinquies.1 Ce qui a changé

**Header stacked — hauteur adaptative par breakpoint** (`HeaderStacked.tsx`) : le plancher
`min-h-[50vh]` posé le 06/08 (§9quater) s'appliquait à TOUS les écrans, y compris mobile — sur
petit écran, ça repoussait la section « à la une » hors du premier écran (demande explicite : la
voir sans scroller). Retravaillé en plusieurs passes :
- Mobile/tablette (`<xl`, <1280px) : plus de `min-h` — le bandeau suit son contenu (logo/titre/
  sous-titre) + son padding, jamais de plancher artificiel.
- Desktop (`xl:`, ≥1280px) : `min-h-[50vh]` conservé — partage moitié bandeau / moitié « à la
  une » au premier écran. **`xl:` choisi, PAS `lg:`(1024px)** — bug trouvé en testant les
  breakpoints intermédiaires : à `lg:`, le bandeau prenait déjà sa forme desktop (grand logo/
  titre) alors que la barre de nav en dessous restait en mode hamburger (elle ne bascule en nav
  complète qu'à `xl:`/1280px) — décalage visuel entre 1024 et 1279px, corrigé en alignant les
  deux sur le même breakpoint.
- Logo/titre/sous-titre : échelle réduite par défaut, échelle `xl:` (desktop) réajustée pour
  rester proportionnelle au bandeau restauré à 50vh.
- Vérifié à 7 largeurs de viewport (375/430/768/1024/1280/1440/1920) via Playwright contre le
  vrai site parent62 (dev server + vraies données) — captures d'écran à l'appui, aucun
  chevauchement/débordement après le fix `xl:`.

**Section « à la une » (`FeaturedCarouselSection.tsx`, `FeaturedCarouselSlide.tsx`)** — réduite
pour tenir, avec le header, dans le premier écran sans scroll :
- Padding vertical : `py-16 md:py-24` → `py-6 md:py-10` (section + skeleton de chargement,
  gardés synchronisés).
- Badge/titre/description/CTA de la diapositive réduits d'un cran (`text-2xl`→`text-xl`, etc.).
- Image : `object-cover` → **`object-contain`** (l'image entière reste visible, jamais rognée —
  le fond de la section comble l'espace résiduel) + ratio `aspect-[4/3]` → **`aspect-[16/10]`**
  (boîte moins haute à largeur égale).
- Vérifié (Playwright, vraies données) : header + « à la une » tiennent ensemble sans scroll à
  375/768/1440/1920px ; à 1280×800 (viewport de laptop inhabituellement bas), déborde encore de
  **12px** — non retravaillé plus avant (retour utilisateur : suffisant).

**Champ thème/catégorie dynamique — fix d'affichage (`select-objet.tsx`)** : ce widget
`SelectObject` est utilisé (entre autres) pour les listes dynamiques de thème/catégorie posées
par la feature « valeurs distinctes des listes dynamiques » (commit `9e789e38`, mergée avant ce
lot). Bug corrigé ici : une valeur **créée** (creatable), pas encore présente dans `options` au
moment du rendu, s'affichait comme le placeholder vide — alors qu'elle était bien enregistrée
dans le formulaire. Repli sur la valeur brute (ou son `.name` si objet) quand `options.find`
échoue ; le mode multiple avait déjà ce repli, le mode mono ne l'avait pas.

**Dédoublonnage territoire « Familles en sol mineur »** (`config.prod.parent62.json`,
`index-parent62.css`) : le territoire générique « Familles en sol mineur » faisait doublon avec
ses deux déclinaisons déjà existantes « Familles en sol mineur Hénin Carvin » et « … Lens
Liévin » — retiré de la nav, des filtres `enum` (`territoire`, plusieurs occurrences), du mapping
couleur `TagColorsConfSchema` et de la variable CSS `--territoire-familles-en-sol-mineur`
associée. Le sous-titre de la page coordinations territoriales, qui comptait « dix territoires »,
est corrigé à « neuf territoires ». Compte pages/sections **inchangé** (45/158) — le
dédoublonnage ne touche que des entrées `enum`, pas des pages. Logo header basculé sur le nouvel
asset `Logo-Aquarelle.png` dans la foulée.

### 9quinquies.3 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur / 20 warnings — 0 sur les fichiers du lot (tous pré-existants dans `EntityFormModal.tsx`, hors périmètre) |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 45 pages, 158 sections (inchangé — le dédoublonnage territoire ne touche que des entrées `enum`) |
| `test:unit` (suite complète) | ✅ **2 342/2 348** (6 skipped, 0 échec) |
| `e2e` ciblé (`npx playwright test e2e/parent62.spec.ts`) | ✅ **8/8** — y compris les 2 spécs dédiées : « mode sombre : header stacked » et « bandeau à la une (carrousel POI tagués) ne casse pas le rendu » |

---

## 9sexies. Impacts — événements récurrents de l'agenda (14-19/08)

> Périmètre : diagnostic + correctifs autour des événements récurrents du module `agenda` (page
> `/agenda`), déclenché par l'ajout d'**événements de test** sur parent62 — voir note importante
> ci-dessous — qui a enfin permis d'observer ce qui restait « non observable (0 event) » depuis le
> 24/07 (§10, checklist 2.3/2.5).

**⚠️ Donnée de test locale, pas de la production.** Les événements utilisés pour ce diagnostic
(`teste`, `teste recurrent`, `test event`, `teste non reccurent`, `mos de la parentalié`,
`event reccur`, `aganda rec`, `recurren `, `teste `) ont été créés spécifiquement pour déboguer
cette fonctionnalité, sur le backend de **dev local** (`communecter-dev`). Ce ne sont **pas** des
données de production réelles du réseau parentalité — le volume réel d'événements en production
reste **à confirmer**, comme les autres lignes « 0 donnée » de ce document (§12).

### 9sexies.1 Bugs backend trouvés (`AgendaAction.php`, hors monorepo — pas d'accès direct, documentés en handoff)

1. **Matching récurrent par jour de semaine (mode CALENDRIER)** : `searchEventsCostum` (avec
   `startDateUTC`/`endDateUTC`) ne comparait que le jour de semaine de `startDateUTC` **lui-même** à
   `openingHours`, sans balayer toute la plage demandée — un événement récurrent n'apparaissait que
   les jours où « aujourd'hui » tombait pile sur son jour configuré. Documenté dans `Document de
   spécification — Agenda événements récurrents invisibles (AgendaAction.php).md` (racine du
   monorepo, 14/08). **Corrigé** (vérifié : 418 occurrences hebdomadaires correctement dépliées sur
   une fenêtre de 12 mois après le fix).
2. **Mode LISTE excluant les récurrents** : `searchEventsCostum` sans dates (flux paginé) ne
   renvoyait que les événements ponctuels. Évolution proposée puis **implémentée** : le mode LISTE
   inclut désormais les récurrents, une ligne chacun (leur prochaine occurrence,
   `startDateSort`/`startDateSortFormat`). Documenté dans `Document de spécification — Pagination
   des événements récurrents dans l'agenda (AgendaAction.php).md` (racine du monorepo, 19/08).
3. **« Prochaine occurrence » sautant le créneau du jour en cours** : la première version de
   l'évolution ci-dessus calculait toujours le prochain **futur** début, jamais « aujourd'hui, déjà
   commencé » — un récurrent activement dans son créneau ne remontait jamais daté du jour même, donc
   ne pouvait jamais atterrir dans l'onglet « En cours ». **Corrigé le 19/08** — revérifié : un
   récurrent interrogé pendant son créneau actif remonte daté du jour même, et apparaît bien dans
   « En cours » sur la vraie page.

**Répond à la question ouverte du §2.6/§12** (« `searchEventsCostum` masque-t-il les events *pending*
côté public ? ») : **oui, confirmé le 19/08.** `costumSlug` (toujours injecté par le SDK en usage
réel) déclenche le filtre de modération — les événements avec
`preferences.toBeValidated.parent62:true` sont exclus. Vérifié sur les 10 événements de test :
corrélation exacte (les 3 qui restent sont les 3 sans `toBeValidated`). Pas un bug.

### 9sexies.2 Ce qui a changé côté `site-json` (testé, fonctionnel, non commité à ce stade)

- Nouveau helper partagé `resolveEventStartDate()` (`src/helpers/formatDate.ts`) — repli `startDate`
  → `startDateSort` → `startDateSortFormat` (un événement récurrent n'a pas de `startDate`). Réutilisé
  dans le module `agenda` (`eventDates.ts`), `search` (`useItem.tsx`, cartes), `admin`
  (`resourceHelpers.ts`, colonne « Début »), `profil` (`ProfileEventDates.tsx`, corrige un affichage
  « Invalid Date »).
- Nouveau `formatRecurrenceLabel()` (`src/modules/search/lib/openingHoursDays.ts`) — affiche « Chaque
  vendredi » à la place d'une date isolée (trompeuse : elle change chaque semaine) pour un
  événement récurrent, sur la carte de recherche (`CardEvent`), la page profil d'un événement et la
  table admin.
- Refonte de `Agenda.tsx` : un seul fetch `useAgendaList` (mode LISTE) sert désormais les 3 onglets
  (En cours / À venir / Passés) au lieu d'un fetch CALENDRIER séparé et large (12 mois) pour « À
  venir » — élimine le sur-fetch (auparavant jusqu'à ~150 lignes reçues pour quelques événements
  distincts) et ajoute une vraie pagination « charger plus » partagée entre les 3 onglets. La grille
  Calendrier (`gridFetch`) est inchangée.
- Un helper de dédoublonnage client (`dedupeByEvent`) a été ajouté puis **retiré** : une fois le mode
  LISTE corrigé, le backend dédoublonne déjà (une ligne par événement récurrent) — le rendait
  redondant.
- Documentation technique moteur mise à jour : `../doc/29-module-agenda.md` (architecture, pièges,
  écarts backend connus, référence aux deux documents de spec).

### 9sexies.3 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur (2 warnings pré-existants, sans rapport, sur `Agenda.tsx` ligne 93) |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 46 pages, 160 sections (inchangé — ce lot ne touche aucun config) |
| `test:unit` ciblé (`agenda`+`search`+`admin`+`profil`+`helpers`) | ✅ **899/899** |
| `test:unit` (suite complète) | 2 499/2 508 — **3 échecs pré-existants et sans rapport** (config parent62 modifiée en parallèle sur un autre chantier : ajout page `/annuaire`, dédoublonnage territoire « Familles en sol mineur ») |

---

## 9septies. Impacts — thèmes/catégorie en saisie libre, promotion admin vers la liste partagée (25/08)

> Périmètre : les champs "Thèmes" (`parent62-affiche`/`-article`/`-recovery-center`/`-event`) et
> "Catégorie" (`parent62-affiche` seul) passent d'un choix fermé à un choix **+ saisie libre**, avec
> promotion admin-only de la valeur inédite vers la liste partagée du costum. Commit `bcd90e6d` sur
> `parents62`, **non pushé** à ce stade.

### 9septies.1 Ce qui a changé

Le mécanisme "propre" pour qu'un thème/catégorie inédit apparaisse aussi dans les **filtres** et les
**suggestions** du formulaire pour les utilisateurs suivants existe déjà dans le parc
(`config.prod.institut-bleu.json` : `territoires`/`auteurs`/`financeurs`, recettes **dynamiques**
`{collection, distinct, where}` résolues par `costum/co/listvalues`) — mais `costum.lists.themes` de
parent62 est déclarée **statique** côté backend, pas dynamique. Approche retenue : garder la liste
statique et la faire **grandir depuis le front**, à l'écriture.

**Écriture (`growCostumLists`, nouveau fichier
`src/modules/profil/forms/costum/parent62/fns.ts`)** — après une soumission réussie
(`afterSubmit`), pour chaque champ `valueSelect` du formulaire dont `widgetProps.saveNewValue: true`
(config, **`false` par défaut** — opt-in explicite, aucune liste de champs codée en dur : la fonction
introspecte le descripteur du formulaire) : les valeurs vraiment nouvelles (dédoublonnage
casse/accents, `normalizeFilterValue`) sont poussées dans `costum.lists.<listKey>`
(`carrier.updateField(path, valeur, {arrayForm:true})`, un `$push` Mongo par valeur — pas de `$addToSet`
exposé par le SDK). **Réservé admin** (`carrier.isAdmin()`) : plusieurs de ces formulaires sont aussi
accessibles en public sans authentification (`requiresAdmin:false`) — sans la garde, n'importe quel
visiteur pourrait injecter une valeur dans la taxonomie partagée avant modération. La saisie libre du
champ lui-même reste ouverte à tous ; seule la **promotion** vers la liste partagée est gardée — et
`saveNewValue` restreint en plus la saisie libre elle-même aux admins pour ces champs précis (un
visiteur non-admin y voit un choix fermé, comme un `select`).

**`listKey` distinct du nom de champ** : `category` sur `parent62-affiche` (Compliqué/Difficile/À
changer) porte le même nom de champ qu'un filtre `resource-category` totalement différent (Vidéo/…,
sur un autre formulaire) — écrire dans `costum.lists.category` aurait mélangé les deux taxonomies.
`widgetProps.list: "categoriesParole"` fixe la liste cible.

**Lecture — filtres et formulaire** : nouvelle clé de schéma `optionsKey` (pendant **statique** de
`optionsFrom`, qui reste réservé aux recettes dynamiques) sur les 23 blocs de filtre `themes`/
`category` ; `ValueSelectField` (formulaire) fusionne l'`enum` déclaré en config avec
`costum.lists.<list>` (`mergeDeduped`, dédoublonnage casse/accents partagé avec l'écriture — nouveau
helper dans `src/modules/search/lib/dropdownFilters.ts`, testé).

**Mise à jour sans reload** : `carrier` (`useCocolight().entity`) est un `useState` rempli une fois
au boot, jamais rafraîchi après un `updateField`. `carrier.refresh()` (méthode SDK) après l'écriture,
combiné à un nouveau hook `useCostumListsReactive` (`src/hooks/useCostumLists.tsx`) qui s'abonne —
via `useReactiveProperty`, déjà utilisé ~14 fois ailleurs dans le repo — aux signaux réactifs
**natifs du SDK** : `_setData` réassigne `costum`/`lists` sur le **même** proxy réactif, donc les
filtres et le formulaire se remettent à jour tout seuls, sans store applicatif dédié.

> ⚠️ **Piège à connaître** : `useCostumListsReactive` doit renvoyer une référence STABLE pour le cas
> "aucune liste costum" (constante partagée `Object.freeze({})`, jamais un littéral `{}`) — sinon la
> section `filters` générique entre en boucle de rendu infinie sur tout site sans `costum.lists`/
> `lists` statique déclarée (donc la plupart des sites, pas que parent62). Gaté par 4 tests dans
> `useCostumLists.test.tsx`.

### 9septies.2 Limite assumée

**Pas de cohérence multi-utilisateur instantanée** : `carrier.refresh()` ne rafraîchit que
l'instance du **navigateur/session courante** — un autre utilisateur (ou un autre onglet) ne verra
la valeur ajoutée qu'à son prochain chargement naturel de page, pas en temps réel.

### 9septies.3 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur sur les fichiers du lot |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 45 pages, 158 sections (inchangé) |
| `test:unit` ciblé (`search`+`profil/forms`+`lib`+`hooks`) | ✅ **990/990** |

---

## 10. Checklist d'avancement

### Partie 1 (3 000 €)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1.1 | Site `reseau.parent62.org`, nav + graphisme proches du WP | 🟡 | config réconciliée (24/07) ; doublon nav `/blog` **résolu** (§9.5) ; **06/08 (committé sur `parents62`)** : accueil, header (`stacked`) et footer (`minimal-centered`) entièrement refondus, nav passée à 5 dropdowns dont un nouveau « Publics » (§9quater) ; reste `/parents`/`/pro` orphelines à trancher (1.4), la recette visuelle et le déploiement → 1.10 |
| 1.2 | Pages statiques réseau / charte / équipe / champs d'action | ✅ | `/reseau` `/charte` `/champs-actions` `/equipe` ; arbitrage éditorial réseau ouvert (§13) |
| 1.3 | Page par territoire : contact + **liste des communes** | ✅ | cards coordo + accordéon 887 communes + fil filtré + CTA ; navigation depuis l'accueil désormais via `map-bubbles` (carte à bulles, §9quater) au lieu des cartes d'accès rapide |
| 1.4 | Double entrée parents / pro | 🟡 *(était ✅)* | **régression confirmée le 06/08** (config **et** e2e) : `/parents`/`/pro` existent mais ne sont plus liées nulle part (ni accueil, ni nav) depuis la refonte du 06/08 — un dropdown « Publics » (7 pages `/public/*`) semble les remplacer fonctionnellement, mais rien ne le confirme. **À trancher avant fusion dans `main`** (§13) |
| 1.5 | Moteur de recherche : types d'info, public, âges, dates, territoire coloré, carte, thèmes | 🟡 | `/recherche` : types d'info (**searchTargets 6** depuis le 25/07 — « Ressources » ajoutée —, défaut « Actualités »), public, thèmes, territoire coloré, **carte** (`enableMap:true`), `dateRange` **borne début seule**. **25/07** : chaque famille a désormais sa carte et son action au clic (`list.itemRules`, §9bis) ; tri `created:-1` et projection explicite ajoutés. **Âges : livré sur `/temoignages` + form affiche, mais PAS encore dans le groupe de filtres `/recherche`** (à ajouter — `ages` est projeté, il ne manque que le groupe). Borne de fin des dates = demande backend `$lt/$lte` (§11) |
| 1.6 | Paroles de parents (3 catégories, audio+écrit, transcription, ajout admin) | 🟡 | brique complète (Thomas) : `/temoignages`, form `parent62-affiche` (3 catégories, audio→`medias`, ages, consentement RGPD), pile audio `media/*`, card/preview `testimonial`. **Ajout admin-only ✅** (modération a priori retirée volontairement, commit `17aea3e`). **25/07** : la cible « Paroles » de `/recherche` renvoyait **0 résultat** (filtre `status:"validated"` sur un champ inexistant) — corrigé, et les paroles y rendent en bulles avec leur dialog (§9bis). **Données observées le 25/07** : `/temoignages` affiche « Toutes les paroles (**3**) » — la mention « 0 POI `affiche` » du 24/07 est caduque. **25/08** : catégorie **et** thèmes passés en saisie libre, valeur inédite promue vers la liste partagée par un admin (§9septies). **Manque** : **transcription/sous-titres NON implémentée** (`description` sert d'écrit) |
| 1.7 | Navigation territoriale (recherche V2) | ✅ | 9 bulles → `/territoire/<slug>` + filtre territoire coloré dans `/recherche` |
| 1.8 | Référencement (SEO, JSON-LD, sitemap, robots, RSS) | ✅ | sitemap/robots (MR) + JSON-LD `BlogPosting` et `/blog/feed.xml` (Thomas) |
| 1.9 | Tests E2E (Playwright) | ✅ *(était 🟡 6/8 le 06/08)* | **13/08 : 8/8 verts** — les 2 désaccords contenu/test relevés le 06/08 (« Professionnels » dans le header, mécanique d'opacité `stacked` vs `transparent-scroll`) sont résolus, cf. §9quinquies. `npx playwright test e2e/parent62.spec.ts` (jamais la suite complète) |
| 1.10 | Déploiement | ❌ | à la main de Peterson — cf. §8.5 |

### Partie 2 (4 500 €) — statuts revus par l'audit fonctionnel du 24/07

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 2.1 | Module actualités + interop WordPress | ✅ / 🟡 interop | 6 434 articles, `/blog`, `/actualites`, 9 `/theme/*`, admin, RSS, ⌘K. **Interop WP = import batch one-shot** (`tools/wp-migration/`), pas de sync live/webhook ; « ajout de post » = form `parent62-article` admin (le module `interop/` = Discourse/Mediawiki, pas WP). **06/08** : 2 pages de contenu tagué ajoutées sur le même patron, `/appels-a-projets` et `/offres-emploi` (`articleFeed` filtré par tag WordPress libre, zéro impact backend, §9quater) |
| 2.2 | Actualités filtrables dans le moteur de recherche | ✅ *(était ✅ config, 🟡 UX)* | cible `searchTargets` « Actualités » (`type:article`) dans `/recherche` + filtres territoire/public/thème/dates. **25/07 — UX unifiée** : une actualité de `/recherche` rend une carte dédiée et son clic ouvre le **reader canonique** `/blog/:slug` (repli `/blog/id/:id`), plus un drawer générique |
| 2.3 | Module événementiel (agenda) + affichage territoire | 🟡 *(diagnostiqué le 14-19/08)* | module agenda complet (calendrier + liste, filtre territoire) ; testé avec des **événements de test locaux** (dev, pas de la production — cf. §9sexies), a révélé 3 bugs backend, **tous corrigés** (§9sexies.1) ; **0 donnée `events` en production, toujours à confirmer** ; pas de carte agenda (`enableMap:false`) |
| 2.4 | Impression de l'agenda | ❌ | **aucun code print** (`@media print`/`window.print`) — à faire (CSS print ou export iCal/PDF) |
| 2.5 | Événements récurrents | ✅ *(était « config+code, non observable » le 24/07)* | `parent62-event` : `recurrency` + `openingHours` + `eventDates` + codecs/validators + calendrier « récurrents dépliés ». **Testé le 14-19/08 avec des événements de test locaux (dev, pas la production)** — a révélé 3 bugs backend dans `AgendaAction.php`, **tous corrigés** : matching par jour de semaine, mode LISTE excluant les récurrents, occurrence du jour en cours jamais renvoyée / onglet « En cours ». Front `site-json` entièrement corrigé et testé (899/899) — cf. §9sexies et les 2 documents de spécification à la racine du monorepo |
| 2.6 | Ajout partenaires + **modération a priori** | ✅ *(était ❌, confirmé le 19/08)* | bouton public `requiresAdmin:false`, form injecte `preferences.toBeValidated:true`, onglet admin Agenda `validate` + « Proposé le ». `searchEventsCostum` masque bien les events *pending* côté public — confirmé (cf. §9sexies, §12) |
| 2.7 | Annuaire partenaires (référencement + cartographie) | 🟡 *(était ❌)* | cible `searchTargets` « Structures & partenaires » (`organizations`) + carte + templates profils ; **25/07** : règle de rendu dédiée (`image-cover`, `imageFit:"contain"` pour des logos hétérogènes) ; **manque page `/annuaire` dédiée + données** (0 org) |

### Partie 3 (2 000 €) — statuts revus par l'audit du 24/07

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 3.1 | Module ressources (POI `recoveryCenter`) | 🟡 | `/ressources` + form `parent62-recovery-center` (catégories Vidéo/Photo/Compte-rendu/Jeu/Doc/Lien, galerie/docs). **Données observées le 25/07** : `/ressources` affiche « Toutes les ressources (**4**) » — la mention « 0 donnée » du 24/07 est caduque. Création **admin-only** (pas de bouton public → le « formulaire simple partenaire » du CDC n'est pas exposé) |
| 3.2 | Recherche dans les ressources (territoire/**ville**) | ✅ config *(était ❌)* | `/ressources` filtre `category` + `territoires` + **`commune`** (`address.addressLocality`) + public/thème + `searchBy:[name,description]`. **25/07** : les ressources sont aussi atteignables depuis `/recherche` (cible « Ressources » + règle de rendu dédiée) |
| 3.3 | Votes « utile » / contributeurs | ❌ | pas de vote sur les ressources (`ADD_VOTE`/`links` à câbler + UI card) ; les votes n'existent que sur le fil news social |

Hors périmètre engagé : publication RS, mailing, migration GoGoCarto, fiches de jeux.

---

## 11. Dépendances site-json ↔ cocolight-api-client

Le SDK est en **lecture seule** : toute évolution passe par une spec `.md` transmise à Aboire
(`spec-cocolight-api-parents62.md`). Version courante : **1.0.172, publiée sur npm** (`^1.0.172`,
commit `09e145a0` du 03/08, résolue depuis `registry.npmjs.org` dans le lockfile — fini le tarball
`npm pack` local). La 1.0.172 règle notamment la **pose du scope costum côté back-office**
(`setCostumScope`, présent dans le dist installé, consommé par
[`src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts) —
le `/admin` du blog parent62 en dépend). Le **1.0.168** (mergé le 24/07) avait apporté :

| Apport SDK 1.0.168 | Effet parent62 |
|---|---|
| `ADD_POI.preferences` (`ee42227`) | modération a priori native (`preferences.toBeValidated.parent62`) |
| `ADD_POI.medias` (`f6e330b`) | audio des paroles matérialisé en `medias:[{type:"audio",url}]` |
| digest costum **variant-aware** (`6fab52d`) | un POI costum multi-type (article + affiche) expose chaque sous-type |
| `news` dans `globalautocomplete` (`ceaff2a`) | débloque la page Actualités |

**Restant côté Thomas / backend** : confirmer le **`typeObj.affiche` déployé en base** (le dump
local du 20/07 ne contient que `article`) ; whitelist audio `Document.php` (demande 5) ; opérateurs
`$gte`/`$lt`/`$lte` dans `SearchNew::getQueries` (demande 6, borne de fin des dates) ; liste `ages`
attendue par le test parole ; périmètre `prepData`/`validategroup`.

---

## 12. Points d'attention / limitations

- **Nav** : 5 entrées — Le Réseau · **Thèmes** · Territoires · Contenus · Rechercher. Le doublon
  `/blog` (« Actualités »+thèmes du MR vs « Contenus » de Thomas) a été **résolu le 24/07** :
  « Actualités » remplacée par le dropdown « Thèmes » canonique de Thomas (décision Peterson : quand
  deux entrées ouvrent la même page, on garde celle de Thomas ; les thèmes restent navigables).
- **Vue cartographique** : uniquement sur `/recherche` (`enableMap:true`, cluster + marker colorBy) ;
  `/agenda`, `/ressources`, `/temoignages` ont `enableMap:false`.
- **Modération a priori des events** (2.6) : le form pose `preferences.toBeValidated:true` ; l'agenda
  public (`searchEventsCostum`) n'applique aucun gate côté client, mais le masquage des events *en
  attente* est **confirmé fonctionnel côté backend** (19/08, cf. §9sexies) — déclenché par
  `costumSlug`, toujours injecté par le SDK en usage réel.
- **Collections quasi vides** : les briques P2/P3 reposaient sur des collections **vides** au dump du
  20/07. **Relevé du 25/07 dans l'application** : 3 paroles, 4 ressources — les articles, eux, sont
  massivement présents. Les events et organisations restent à confirmer (la vue carte de `/recherche`
  ne renvoie rien, mais elle ne mesure que le **sous-ensemble géolocalisé**, pas le total).
- **Aucune donnée géolocalisée** : la vue carte de `/recherche` affiche « Aucun résultat » pour
  toutes les familles testées le 25/07 → le `map.marker.colorBy` par territoire et l'action au clic
  depuis la popup ne sont **pas observables** en l'état.
- **Une règle `itemRules` qui teste un champ hors `defaultFields` ne matche jamais**, en silence
  (même famille de piège que l'encodage U+2019). Un `console.warn` DEV le signale, et le préflight
  `list-item-rules` le gate ; l'ordre des règles (catch-all en dernier) est gaté aussi.
- **Trois `itemAction` homonymes** de formes différentes coexistent (`list.itemAction`,
  `map.itemAction`, `commandPalette.entitySearch.itemAction`) — source de confusion en config, cf.
  l'encadré de [doc/07](../doc/07-module-search.md#rendu-par-item-des-listes-hétérogènes-listitemrules).
- **Transcription des paroles** (1.6) : non implémentée — pas de champ dédié (`description` = écrit).
- **URL parole** : on garde `/temoignages` (main canonique). Si le réseau préfère l'URL `/paroles`,
  c'est un re-`path` de la page de Thomas — à confirmer avec lui.
- ~~**Lint** : 29 erreurs pré-existantes au 25/07~~ : dette résorbée entre-temps — **0 erreur /
  18 warnings** au 03/08 (`npm run lint` sur `main` ; déjà 0 erreur au commit `53f28ca1` du 30/07).
- ~~**`.env` quoté**~~ : le préflight `environment` **passe au 25/07** (comme `bundle-size`) — les
  deux échecs signalés le 24/07 sont résolus.
- **Encodage des libellés** (U+2019, tiret demi-cadratin) — cf. §5.2.
- **Articles sans taxonomie** : 1 173 sans territoire (18 %), 2 181 sans thème/public → invisibles
  sur les pages filtrées. **Images d'articles** encore pointées sur `www.parent62.org/wp-content/…`.
- **Coquilles de communes** dans les PDF officiels, conservées telles quelles — correction à
  demander au réseau.
- **Chantier accueil/header/footer du 06/08** (§9quater), committé sur `parents62` mais **pas
  encore recetté visuellement ni fusionné dans `main`** : `/parents`/`/pro` **orphelines** (plus
  aucun lien depuis la config).
- **Thèmes/catégorie promus par un admin ne sont visibles qu'après le prochain chargement de page
  des AUTRES utilisateurs/onglets** (25/08, §9septies.2) — `carrier.refresh()` ne rafraîchit que la
  session courante, pas de push temps réel entre sessions.

---

## 13. Évolutions à prévoir & questions en attente

Priorisées par l'audit fonctionnel du 24/07, révisées le 25/07, complétées le 03/08 (déploiement).
Le **doublon nav `/blog` est résolu** (§9.5) ; l'**UX `/blog` ↔ `/recherche` est unifiée** (§9bis) ;
les **paroles ne sont plus muettes** dans le moteur (§9bis.1).

| Évolution / question | Pour qui |
|---|---|
| **Impression de l'agenda** (2.4) — non implémentée (CSS print ou export iCal/PDF) | Peterson |
| **Alias `reseau.parent62.org` dans `sites.json`** (champ `aliases`) pour que `deploy:env` dérive `VITE_SITE_PUBLIC_URL` correctement — aujourd'hui l'entrée `parent62` n'a que `domain: parent62.00.re` (§8.5) | Peterson / Thomas |
| **Âges dans `/recherche`** (1.5) — la liste `ages` existe (form + `/temoignages`), l'ajouter au groupe de filtres `/recherche` | Peterson |
| **Votes « utile » + contributeurs** des ressources (3.3) — câbler `ADD_VOTE`/`links` + UI card | Peterson / Thomas |
| **Transcription / sous-titres des paroles** (1.6) — champ dédié à ajouter au form + affichage | Peterson / réseau |
| **Masquage public des events *pending*** (2.6) — `searchEventsCostum` applique-t-il un gate `toBeValidated` ? sinon à faire côté backend | Thomas |
| **Page `/annuaire` dédiée** (2.7) — au-delà du filtre « Structures » de `/recherche` | Peterson / réseau |
| **Données P2/P3** — relevé du 25/07 : 3 paroles, 4 ressources ; events et organisations à confirmer. Volumétrie réelle à créer/importer | réseau / Thomas |
| **Géolocalisation** — aucune donnée ne porte de coordonnées : la vue carte de `/recherche` est vide et le `colorBy` par territoire est invérifiable | réseau / Thomas |
| Borne de fin des dates (`$lt`/`$lte`) dans `SearchNew::getQueries` | Thomas / backend |
| **URL parole** `/temoignages` vs `/paroles` | Thomas / réseau |
| Harmoniser `/theme/*` avec `/recherche` (2.2 — le volet `/blog` est fait) | Peterson |
| **Carte `CardEvent`** — hauteur figée `h-72`, aucun fond, ignore `card`/`list` : dans une liste hétérogène elle laisse un trou et laisse voir le fond de page. Correctif à recetter sur `/agenda` | Thomas |
| Valeurs `category` ressources · 10e territoire « Familles en sol mineur » (43) · contenu des 4 pages statiques · couleurs `oklch` · coquilles de communes | réseau |
| **[06/08] `/parents`/`/pro` orphelines** — confirmé statiquement (config), et indirectement par e2e (le test dédié échoue avant d'atteindre l'assertion sur ces liens) ; le dropdown « Publics » (7 pages `/public/*`) les remplace-t-il volontairement, ou faut-il relier ces deux pages (nav ou accueil) ? | Peterson / Thomas |
| **[06/08] « Professionnels » désormais dans le header** (dropdown « Publics ») — contredit la décision du 23/07 (« Parents / Professionnels hors menu ») ; si le nouveau nav est acté, l'assertion e2e correspondante est à réviser | Peterson / Thomas |
| **[06/08] Assertion e2e d'opacité du header** (« mode sombre… », `bg-background/90`) écrite pour `transparent-scroll` — à réécrire pour la mécanique réelle de `stacked` (scrim interne, opacité jamais posée sur le `<nav>`) | Peterson |
| **[06/08] `build`** jamais relancé depuis la refonte — à faire avant tout commit (`test:unit` — 2 227/2 229, seuls les 2 pré-existants restent —, `test:integration` et `e2e` ciblé ont été rejoués le 06/08, cf. §9quater.3) |
| **[25/08] Convertir `costum.lists.themes` et `costum.lists.categoriesParole` en recette dynamique côté backend** — résoudrait la limite multi-utilisateur (§9septies.2) et rapprocherait parent62 du mécanisme déjà utilisé sur institut-bleu ; le champ `themes` est réparti sur 2 collections (`poi`/`events`), une recette `distinct` classique n'en couvre qu'une | Thomas / backend |
| **[25/08] `build`** jamais relancé depuis ce lot — commit `bcd90e6d` non pushé, à recetter avant fusion dans `main` | Peterson |
