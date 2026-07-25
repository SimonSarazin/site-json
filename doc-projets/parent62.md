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
> [Composants média](../doc/33-media-components.md). Mémoire : `[[project-parents62]]`.

Dernière mise à jour : **2026-07-24** (réconciliation MR ↔ main).

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
| **SDK** | `@communecter/cocolight-api-client` — **dépôt en lecture seule**, version **1.0.168** (via le merge du 24/07) |
| **Branche site-json** | `parents62` (MR #25) — merge `main` intégré le 24/07 (`347f853`) |
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
   **modération a priori** (native `preferences.toBeValidated`, SDK 1.0.168).
5. **La navigation territoriale** : 9 pages `/territoire/*` (contact coordo + 887 communes + fil
   d'articles), et un code couleur par territoire réutilisé carte + chips.
6. **Le référencement** préservé (SEO par page, JSON-LD, sitemap, robots, RSS).

La taxonomie est portée par des **champs** de premier niveau (`territoires`/`publics`/`themes`),
partagés par tous les types de contenu ; `tags` reste réservé aux mots-clés WordPress libres.

---

## 3. Architecture générale

```
 WordPress (parent62.org)          Communecter / cocolight-api-client (SDK 1.0.168)
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
| **Territoires** | `src/data/territoires62.ts` (+ `.test`), `scripts/import-communes-territoires62.ts` |
| **Header** | `src/components/layout/header/HeaderTransparentScroll.tsx` (fix lisibilité) |
| **Tests** | `e2e/parent62.spec.ts`, `src/modules/search/lib/colorBy.test.ts`, `src/modules/profil/forms/costum/__fixtures__/configCostum.ts` |
| **Déploiement** | `server/prod-server.js`, `.env` (`VITE_SLUG`, `VITE_BASE_URL_BACKEND`, `SITE_CONFIG_PATH`, `SITE_PUBLIC_URL`) |

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
     (**obligatoire**) et `SITE_PUBLIC_URL=https://reseau.parent62.org`.

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

## 10. Checklist d'avancement

### Partie 1 (3 000 €)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1.1 | Site `reseau.parent62.org`, nav + graphisme proches du WP | ✅ côté code | config réconciliée (24/07) ; reste le déploiement → 1.10. ⚠️ **doublon nav** : deux dropdowns `/blog` (« Actualités » MR + « Contenus » Thomas) à trancher (§12) |
| 1.2 | Pages statiques réseau / charte / équipe / champs d'action | ✅ | `/reseau` `/charte` `/champs-actions` `/equipe` ; arbitrage éditorial réseau ouvert (§13) |
| 1.3 | Page par territoire : contact + **liste des communes** | ✅ | cards coordo + accordéon 887 communes + fil filtré + CTA |
| 1.4 | Double entrée parents / pro | ✅ | `/parents` et `/pro`, accessibles depuis l'accueil |
| 1.5 | Moteur de recherche : types d'info, public, âges, dates, territoire coloré, carte, thèmes | 🟡 | `/recherche` : types d'info (searchTargets 5, défaut « Actualités »), public, thèmes, territoire coloré, **carte** (`enableMap:true`), `dateRange` **borne début seule**. **Âges : livré sur `/temoignages` + form affiche, mais PAS encore dans le groupe de filtres `/recherche`** (à ajouter). Borne de fin des dates = demande backend `$lt/$lte` (§11) |
| 1.6 | Paroles de parents (3 catégories, audio+écrit, transcription, ajout admin) | 🟡 | brique complète (Thomas) : `/temoignages`, form `parent62-affiche` (3 catégories, audio→`medias`, ages, consentement RGPD), pile audio `media/*`, card/preview `testimonial`. **Ajout admin-only ✅** (modération a priori retirée volontairement, commit `17aea3e`). **Manques** : **transcription/sous-titres NON implémentée** (`description` sert d'écrit) ; **0 POI `affiche`** + `typeObj.affiche` déployé en base à confirmer |
| 1.7 | Navigation territoriale (recherche V2) | ✅ | 9 bulles → `/territoire/<slug>` + filtre territoire coloré dans `/recherche` |
| 1.8 | Référencement (SEO, JSON-LD, sitemap, robots, RSS) | ✅ | sitemap/robots (MR) + JSON-LD `BlogPosting` et `/blog/feed.xml` (Thomas) |
| 1.9 | Tests E2E (Playwright) | ✅ | `e2e/parent62.spec.ts` — **7/7 verts le 24/07 sur la stack réelle** (dev server + backend). Scénarios lecture seule : accueil (nav 5 entrées), `/recherche` ×2, `/temoignages`, `/territoire/arrageois`, `/blog`, mode sombre. Ciblé : `npx playwright test e2e/parent62.spec.ts` (jamais la suite complète) |
| 1.10 | Déploiement | ❌ | à la main de Peterson — cf. §8.5 |

### Partie 2 (4 500 €) — statuts revus par l'audit fonctionnel du 24/07

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 2.1 | Module actualités + interop WordPress | ✅ / 🟡 interop | 6 434 articles, `/blog`, `/actualites`, 9 `/theme/*`, admin, RSS, ⌘K. **Interop WP = import batch one-shot** (`tools/wp-migration/`), pas de sync live/webhook ; « ajout de post » = form `parent62-article` admin (le module `interop/` = Discourse/Mediawiki, pas WP) |
| 2.2 | Actualités filtrables dans le moteur de recherche | ✅ config *(était 🟡)* | cible `searchTargets` « Actualités » (`type:article`) dans `/recherche` + filtres territoire/public/thème/dates. Reste : unifier l'UX `/blog`↔`/recherche` |
| 2.3 | Module événementiel (agenda) + affichage territoire | 🟡 | module agenda complet (calendrier + liste, filtre territoire) ; **0 donnée `events`** → vide ; pas de carte agenda (`enableMap:false`) |
| 2.4 | Impression de l'agenda | ❌ | **aucun code print** (`@media print`/`window.print`) — à faire (CSS print ou export iCal/PDF) |
| 2.5 | Événements récurrents | ✅ config+code *(était ❌)* | `parent62-event` : `recurrency` + `openingHours` + `eventDates` + codecs/validators + calendrier « récurrents dépliés ». Non observable (0 event) |
| 2.6 | Ajout partenaires + **modération a priori** | 🟡 *(était ❌)* | bouton public `requiresAdmin:false`, form injecte `preferences.toBeValidated:true`, onglet admin Agenda `validate` + « Proposé le ». **À confirmer** : `searchEventsCostum` masque-t-il les events *pending* côté public ? (pas de gate client sur l'agenda — cf. §12) |
| 2.7 | Annuaire partenaires (référencement + cartographie) | 🟡 *(était ❌)* | cible `searchTargets` « Structures & partenaires » (`organizations`) + carte + templates profils ; **manque page `/annuaire` dédiée + données** (0 org) |

### Partie 3 (2 000 €) — statuts revus par l'audit du 24/07

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 3.1 | Module ressources (POI `recoveryCenter`) | 🟡 | `/ressources` + form `parent62-recovery-center` (catégories Vidéo/Photo/Compte-rendu/Jeu/Doc/Lien, galerie/docs) ; **0 donnée** ; création **admin-only** (pas de bouton public → le « formulaire simple partenaire » du CDC n'est pas exposé) |
| 3.2 | Recherche dans les ressources (territoire/**ville**) | ✅ config *(était ❌)* | `/ressources` filtre `category` + `territoires` + **`commune`** (`address.addressLocality`) + public/thème + `searchBy:[name,description]` |
| 3.3 | Votes « utile » / contributeurs | ❌ | pas de vote sur les ressources (`ADD_VOTE`/`links` à câbler + UI card) ; les votes n'existent que sur le fil news social |

Hors périmètre engagé : publication RS, mailing, migration GoGoCarto, fiches de jeux.

---

## 11. Dépendances site-json ↔ cocolight-api-client

Le SDK est en **lecture seule** : toute évolution passe par une spec `.md` transmise à Aboire
(`spec-cocolight-api-parents62.md`). Le **SDK 1.0.168** (mergé le 24/07) apporte :

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
- **Modération a priori des events** (2.6) : le form pose `preferences.toBeValidated:true`, mais
  l'agenda public (`searchEventsCostum`) **n'applique aucun gate côté client** (le gate
  `applyValidationGate` ne couvre que le searchProStatic POI avec `costumSlug`) → le masquage des
  events *en attente* dépend **entièrement du backend** — à vérifier avec Thomas.
- **Collections vides** : toutes les briques P2/P3 (agenda, paroles, ressources, structures) reposent
  sur des collections **vides** au dump du 20/07 (0 event, 0 affiche, 0 recoveryCenter, 0 organization)
  → invisibles tant que données + `typeObj` non déployés en base.
- **Transcription des paroles** (1.6) : non implémentée — pas de champ dédié (`description` = écrit).
- **URL parole** : on garde `/temoignages` (main canonique). Si le réseau préfère l'URL `/paroles`,
  c'est un re-`path` de la page de Thomas — à confirmer avec lui.
- **Lint** : 4 erreurs pré-existantes dans le code de Thomas (blog/design-sync) — hors périmètre.
- **`.env` quoté** : `VITE_BASE_URL_BACKEND="…"` avec guillemets littéraux fait échouer le préflight
  `environment` (test unitaire) — à corriger avant build de prod.
- **Encodage des libellés** (U+2019, tiret demi-cadratin) — cf. §5.2.
- **Articles sans taxonomie** : 1 173 sans territoire (18 %), 2 181 sans thème/public → invisibles
  sur les pages filtrées. **Images d'articles** encore pointées sur `www.parent62.org/wp-content/…`.
- **Coquilles de communes** dans les PDF officiels, conservées telles quelles — correction à
  demander au réseau.

---

## 13. Évolutions à prévoir & questions en attente

Priorisées par l'audit fonctionnel du 24/07. Le **doublon nav `/blog` est résolu** (§9.5).

| Évolution / question | Pour qui |
|---|---|
| **Impression de l'agenda** (2.4) — non implémentée (CSS print ou export iCal/PDF) | Peterson |
| **Âges dans `/recherche`** (1.5) — la liste `ages` existe (form + `/temoignages`), l'ajouter au groupe de filtres `/recherche` | Peterson |
| **Votes « utile » + contributeurs** des ressources (3.3) — câbler `ADD_VOTE`/`links` + UI card | Peterson / Thomas |
| **Transcription / sous-titres des paroles** (1.6) — champ dédié à ajouter au form + affichage | Peterson / réseau |
| **Masquage public des events *pending*** (2.6) — `searchEventsCostum` applique-t-il un gate `toBeValidated` ? sinon à faire côté backend | Thomas |
| **Page `/annuaire` dédiée** (2.7) — au-delà du filtre « Structures » de `/recherche` | Peterson / réseau |
| **Données P2/P3** — 0 event, 0 affiche, 0 recoveryCenter, 0 organization : à créer/importer | réseau / Thomas |
| `typeObj.affiche` / `recoveryCenter` **déployés en base** (dump local du 20/07 antérieur) | Thomas |
| Borne de fin des dates (`$lt`/`$lte`) dans `SearchNew::getQueries` | Thomas / backend |
| **URL parole** `/temoignages` vs `/paroles` | Thomas / réseau |
| Unifier l'UX `/blog`/`/theme/*` avec `/recherche` (2.2) | Peterson |
| Valeurs `category` ressources · 10e territoire « Familles en sol mineur » (43) · contenu des 4 pages statiques · couleurs `oklch` · coquilles de communes | réseau |
