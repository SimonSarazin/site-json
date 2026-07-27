[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Institut Bleu — Annuaire de l'économie bleue (La Réunion)

> **Document de travail du projet de configuration.** Portage **bout-en-bout** du costum legacy
> `institutBleu` (Communecter/PixelHumain, PHP) vers SiteForge (site-json) + backend Node
> (cocolight-backend). Il intègre le cahier des charges dérivé du costum, le modèle de données réel
> mesuré en base, l'architecture, l'avancement et les dépendances. **À tenir à jour à chaque lot
> livré**, selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) · [Module formEngine](../doc/28-module-formengine.md) ·
> [Module Profil](../doc/08-module-profil.md) · [Module Agenda](../doc/29-module-agenda.md) ·
> [Module Admin](../doc/30-module-admin.md) · [Système de visibilité](../doc/19-visibility-system.md).
> Mémoire : `[[project-institut-bleu]]` (à créer côté cocolight-backend).

Dernière mise à jour : **2026-07-28** (lots 0→9 : annuaire · cartographie · agenda · fiche acteur ·
formulaire acteur · pages éditoriales · back-office · auth & palette · hooks costum backend ·
**design de la home, thème et finitions**).
Restent : les essais UI connectés (formulaire acteur, back-office), le `npm run build` et le
déploiement (lot 10), plus les reliquats de parité listés en §8.6.

---

## 1. Contexte du projet

L'**Institut Bleu** (La Réunion) opère un **annuaire des acteurs de l'économie bleue** publié sur
`annuaire.institutbleu.re`. Le site tourne aujourd'hui sur le **costum legacy** Communecter
(moteur `costumize` + code PHP dédié) : annuaire filtrable, fiche acteur, formulaire d'autorisation
de diffusion des données, back-office de modération/invitation, export CSV, pages éditoriales CMS.

Le projet consiste à **rejouer ce périmètre dans SiteForge**, sur le backend Node (byte-compatible)
plutôt que sur le PHP, sans perte de fonctionnalité pour les 51 acteurs déjà référencés.

| | |
|---|---|
| **Site SiteForge** | slug `institutBleu` → [`config.prod.institut-bleu.json`](../config.prod.institut-bleu.json), CSS `index-institut-bleu` ([`sites.json`](../sites.json)) |
| **État de la config** | 🟡 en cours (non commité) : socle IB posé (meta, header/nav, footer, thème, home) + **lot 2** (annuaire, cartographie, agenda) — 4 pages / 8 sections, `config:validate` ✅ |
| **Costum / scope de données** | `source.key = "institutBleu"` sur toutes les entités du réseau |
| **Porteur du costum** | org **« Institut Bleu »** `_id 66f2adcfba41c614b86c0af8`, slug `institutBleu`, type `LocalBusiness` — la config vit dans son champ `costum` (pattern *costum-in-org*, moteur `costum.slug = "costumize"`), host `annuaire.institutbleu.re` |
| **Snapshot template** | `db.templates` `6914f0a0237b07198836c919` (`type: costum`, `name: "Institut Bleu"`, 15 Ko, créé le 2025-11-12) |
| **Legacy (référence)** | `/home/djabatav/pixelhumain-docker-php7/code` — servi sur `http://127.0.0.1:5080` |
| **Backend Node** | `cocolight-backend` — `http://127.0.0.1:5099` (base partagée `mongodb://127.0.0.1:5018/communecter`) |
| **SDK** | `@communecter/cocolight-api-client` **1.0.169** (lecture seule ; modifs → Thomas) |
| **Branche site-json** | `main` (dernier commit `ac8ee07d`) — branche de chantier à créer |
| **Chef de projet** | Thomas Craipeau (Aboire) |

### Historique des chantiers

- **Amont (backend/lib)** : le costum est déjà cartographié côté Node — `src/costum/registry.ts`
  (costumId + host + engine `costumize`), `src/costum/schemas/institutBleu.ts` (17 champs orgs,
  bundle **transitoire**), `runtime-map.ts`, `types.ts`. Les 3 hooks PHP sont recensés **non portés**
  dans `tools/parity/manifest/costum-hooks.json`.
- **2026-07-27 (matin/après-midi, session parallèle)** : refonte du **socle** de la config —
  meta/SEO IB, header `standard` + nav (Accueil · Annuaire · Cartographie · Agenda), footer IB,
  thème `light` avec palette IB, home réécrite (`html` + `action-tiles`), assets
  `public/images/institutBleu/` (logo + favicon). Travail **non commité**.
- **2026-07-27 (cette session)** : état des lieux complet (ce document) + **lot 2** — pages
  `/annuaire`, `/cartographie`, `/agenda` posées et vérifiées en SSR contre le backend Node.

---

## 2. Objectifs de la configuration

1. **Annuaire filtrable** des acteurs de l'économie bleue (facettes catégorie / forme juridique /
   mots-clés / territoire, recherche texte, carte).
2. **Fiche acteur** publique exposant les champs costum (acronyme, SIRET, code NAF, catégories,
   lieu d'exploitation, réseaux sociaux, forme juridique).
3. **Formulaire « autorisation de diffusion des données »** (création + édition d'un acteur) —
   l'entrée principale du réseau, aujourd'hui `dynFormCostum` legacy.
4. **Pages éditoriales** (accueil, Institut bleu, charte, guide des étapes, mentions, confidentialité).
5. **Agenda** des événements maritimes (21 events en base).
6. **Back-office** `/admin` : modération des acteurs (`displayAuth` / `toBeValidated`), invitations,
   communauté, export CSV.
7. **Parité de traitement** avec le legacy sur les hooks d'écriture (tags, sources, référencement).

---

## 3. Architecture générale

```
        ┌──────────────── Mongo partagée (communecter, :5018) ────────────────┐
        │  organizations (51 acteurs source.key=institutBleu) · citoyens (88)  │
        │  events (21) · cms (99) · org porteuse 66f2adcf… (champ `costum`)    │
        └───────────────┬───────────────────────────┬─────────────────────────┘
                        │                           │
        legacy PHP :5080│                           │ backend Node :5099 (byte-compat)
   (annuaire.institutbleu.re)                       │
        Costum::init → org.costum                   │  registry.ts (costumId/host/engine)
        InstitutBleu.php (hooks)                    │  + hooks costum NON PORTÉS (cf. §13)
                                                    │
                                        SiteForge (site-json, slug institutBleu)
                                        config.prod.institut-bleu.json
                                        ├─ pages/sections (search, agenda, blog…)
                                        ├─ costumForms.<id>  (formEngine)
                                        ├─ profiles.organizations (fiche acteur)
                                        └─ admin.tabs (back-office)
```

**Voie de filtrage retenue** : `source.key = "institutBleu"` (scope de provenance), comme tous les
costums sans form dédié — cf. `docs/18-COSTUM-SCOPE-SOURCEKEY.md` côté backend.

---

## 4. Cahier des charges (dérivé du costum legacy)

Source : champ `costum` de l'org porteuse (21 clés racine), lu le 2026-07-27.

### 4.1 Pages (`costum.app` — 16 entrées)

| Hash legacy | Nom | Type | Restriction | Cible SiteForge |
|---|---|---|---|---|
| `#welcome` | Accueil | CMS | — | page `/` (sections) |
| `#search` | Annuaire | search `organizations` | — | `/annuaire` (searchHeader + searchProStatic) |
| `#mapping` | Mapping | CMS + carte | — | vue carte de `/annuaire` |
| `#agenda` | Agenda | CMS | draft/admins | `/agenda` (module agenda) |
| `#financement` | Financement | CMS | draft/admins | différé (lot 6) |
| `#bibliotheque` | Bibliothèque | CMS | draft/admins | différé (lot 6) |
| `#actus` | Actualités | search `news`+`events` | membres | `/actualites` (lot 5) |
| `#institut-bleu` | Institut bleu | CMS | — | `/institut-bleu` |
| `#charte` | Charte | CMS | — | `/charte` |
| `#guide-des-etapes` | Guide des étapes | CMS | — | `/guide-des-etapes` |
| `#confidentialityrules`, `#mentions` | Légal | CMS | — | `/confidentialite`, `/mentions-legales` |
| `#contact`, `#forum`, `#documentation`, `#yuna-test` | — | CMS | draft/admins | hors périmètre |

Menu principal legacy (`htmlConstruct.header.menuTop`) : Accueil · Annuaire · Mapping · Agenda ·
Financement · Bibliothèque.

### 4.2 Formulaire acteur (`typeObj.organizations.dynFormCostum`)

Titre legacy : « Formulaire d'autorisation de diffusion des données ». 21 champs ordonnés :

| # | Champ | Widget legacy | Contrainte | Cible formEngine |
|---|---|---|---|---|
| 1 | `infoGeneral` | custom (HTML) | — | bloc `html`/info de section |
| 3 | `displayAuth` | checkboxSimple (Oui/Non) | **requis**, `checked: true` | `switch` requis |
| 4 | `sextionInfo` | custom (HTML) | — | info de section |
| 5 | `name` | text | — | `text` requis |
| 6 | `similarLink` | custom (doublons) | — | slot (détection doublons) |
| 7 | `acronym` | text | — | `text` |
| 8 | `codeNaf` | text | — | `text` |
| 9 | `siret` | text | — | `text` |
| 10 | `categoryThematic` | selectMultiple (select2) | **requis**, **max 2** | `multiselect` + `enum` (8) |
| 11 | `tags` | tags | max 5, liste `listTag` | `tags` |
| 12 | `legalStatus` | tags | max 1, liste `legalStatus` | `select` (11 valeurs) |
| 13 | `image` | upload | 1 fichier | `image` (`profil_avatar`) |
| 14 | `description` | textarea markdown | — | `markdown` |
| 15-17 | `formLocality`, `location`, `operatingLocation` | adresse | — | `location` + `text` |
| 18 | `mobile` | text | — | `tel` |
| 19 | `email` | text | **requis** | `email` requis |
| 20 | `link` | text | — | `text` (url) |
| 21 | `otherSociaNetworks` | lists (type+link) | 4 lignes préremplies | `fieldArray` |
| — | `type`, `role` | presets | `LocalBusiness`, `admin` | `presets` |

Champs masqués par le legacy (`onload.actions.hide`) : `shortDescription`, `url`, `type`, `role`.

### 4.3 Listes (`costum.lists`)

`family` (28 valeurs, métiers) · `categoryThematic` (8, facette principale) · `legalStatus` (11) ·
`listTag` (16 mots-clés proposés).

### 4.4 Back-office (`costum.adminPanel.menu`)

`organizations` « Acteurs à modérer » · `reference` (référencement) · `community` (+ mailing,
zone de saisie destinataires) · `listInvitation` · `statistic` · `directory`. Export CSV via
`ExportCsvAction` + `InstitutBleu::getCsv/parseFields`.

### 4.5 Mails

`mailsConfig.invitation` → tpl `costum.views.custom.institutBleu.mails.invitation`,
**`acceptInvitationWithoutUser: true`** (invitation sans compte préalable) ; footer dédié.
Statut d'envoi lu dans la collection `cron` (`InstitutBleu::getStatusMail`).

### 4.6 Charte graphique

`color1 = #0065b3` (bleu), titres h1 `#0065b3` / h2 `#61ce70` (vert), `#044679` (bleu foncé,
progress + menu hover), police Poppins ; thème oklch light+dark déjà défini côté costum
(`css.theme.lightTheme`/`darkTheme`) — réutilisable pour `src/index-institut-bleu.css`.

---

## 5. Modèle de données réel (mesuré le 2026-07-27)

Base locale `communecter` (Docker mongo 4.2, `:5018`) — **lecture seule**.

| Collection | Filtre | Volume |
|---|---|---|
| `organizations` | `source.keys: "institutBleu"` | **51** |
| `citoyens` | idem | **88** |
| `events` | idem | **21** |
| `cms` | `source.key: "institutBleu"` | **99** (13 pages) |
| `forms` / `answers` | idem | 0 |
| `costum` (collection) | — | **aucun doc IB** (la config vit dans l'org porteuse) |

### Acteurs (organizations) — remplissage des champs

Tous `type: LocalBusiness`. `displayAuth: true` sur 50/51.

| Champ | Rempli | Champ | Rempli |
|---|---|---|---|
| `name`, `email`, `tags`, `slug` | 51 | `mobile` | 46 |
| `categoryThematic` | 50 | `link` | 42 |
| `otherSociaNetworks`, `dateSign`, `reference`, `referentId` | 50 | `description` | 43 |
| `legalStatus` | 49 | `operatingLocation` | 34 |
| `profil*ImageUrl` | 49 | `acronym` | 33 |
| `address`, `geo`, `geoPosition` | 47 | `nameSign` | 29 |
| `telephone` | 46 | `siret` | 18 · `codeNaf` 11 |

Répartition `categoryThematic` : Tourisme bleu et activités nautiques 25 · Appui & soutien et
accompagnement 18 · Environnement & Recherche et Innovation 18 · Pêche et produits de la mer 8 ·
Industrie et maintenance navale 6 · Transport maritime & infrastructures portuaires 6 ·
Action de l'Etat en mer 3.

### Événements

5 types : `Evenement public` 9 · `Salon professionnel` 7 (+1 `"Salon professionnel,"` — **valeur
polluée par une virgule**) · `Séminaire` 3 · `conference` 1. Dates 2025→2026.

### Pages CMS legacy (à reprendre en éditorial)

`welcome` 57 blocs · `institut-bleu` 7 · `forum` 6 · `documentation` 6 · `guide-des-etapes` 5 ·
`mapping` 3 · `charte`/`mentions`/`confidentialityrules`/`agenda`/`financement`/`bibliotheque` 2 ·
`yuna-test` 2. Blocs majoritaires : `superCms.container` (34), `supertext` (10), `icon`/`image` (5).

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config du site | [`config.prod.institut-bleu.json`](../config.prod.institut-bleu.json), [`sites.json`](../sites.json) |
| Thème | [`src/index-institut-bleu.css`](../src/index-institut-bleu.css) |
| Formulaire acteur | `config.costumForms["institut-bleu-acteur"]` (JSON, **0 code**) + `floatingActionButton` ; garde `src/modules/profil/forms/institut-bleu-acteur.configDriven.test.ts` |
| Back-office | `config.admin` (6 onglets) — module `src/modules/admin/`, aucun code ajouté |
| Connexion & palette | `config.auth` (module `src/modules/auth/`) et `config.commandPalette` (module `src/modules/commandPalette/`) — aucun code ajouté ; le bouton ⌘K du header dépend de `header.utilities.search` |
| Moteur (ajouts de ce chantier) | `src/modules/profil/{schema.ts, ProfileSectionRenderer.tsx, lib/profileFields.ts(+test), components/sections/ProfileFields.tsx}` · `src/modules/formEngine/engine/{coercions.ts(+test), zodGen.ts, validate.test.ts}` · `src/modules/formEngine/widgets/{registry.tsx, fields/genericFields.tsx}` · i18n `profil/i18n/{fr,en}.json` (`validation.minItems`/`maxItems`) · fixture `forms/costum/__fixtures__/configCostum.ts` |
| Recherche/annuaire | modules `search` (`searchHeader`, `searchProStatic`, `PageFilters`) — aucun code attendu |
| Fiche acteur | `config.profiles.organizations` (tabs/sections) |
| Agenda | section `agenda` (module `src/modules/agenda/`) |
| Back-office | `config.admin.tabs` (module `src/modules/admin/`) |
| Backend (parité) | `cocolight-backend` — hooks costum, export CSV, statut mails |
| Doc | ce fichier + [`doc-projets/README.md`](README.md) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Scope par **`source.key`** (pas `costum.slug` sur les items) | 92,6 % des costums fonctionnent ainsi ; les 51 acteurs portent `source.keys: ["institutBleu"]`, aucun ne porte de champ `costum` |
| Formulaire acteur en **`config.costumForms` (JSON)** | Recette « 0 code » du formEngine ; les widgets nécessaires (text/multiselect/tags/markdown/image/location/fieldArray) existent tous |
| **Ne pas** ajouter de schéma costum en dur dans la lib | Les bundles costum sont transitoires ; la cible est live-only (`getcostumjson`/`describeForm`) |
| Annuaire = `searchProStatic` + `PageFilters` | Patron config-driven éprouvé (parent62, cyber-reunion) ; les facettes se déclarent par champ |
| Thème repris du costum (`css.theme` oklch) | Le costum porte déjà light+dark cohérents avec la charte IB |
| Reprise éditoriale **manuelle** des pages CMS | Les blocs `superCms` legacy n'ont pas d'équivalent 1:1 ; conversion en sections SiteForge au cas par cas |

---

## 8. Étapes de mise en place (lots)

| Lot | Contenu | État |
|---|---|---|
| **0** | État des lieux + doc de travail | ✅ 27/07 |
| **1** | Socle config : meta/SEO, header+nav, footer, thème IB, home | ✅ 27/07 (session parallèle) |
| **2** | **Annuaire** `/annuaire` (facettes catégorie/activité/forme juridique + CSV) · **`/cartographie`** · **`/agenda`** | ✅ 27/07 — vérifié SSR |
| **3** | **Fiche acteur** : `profiles.organizations` avec les champs costum | ✅ 27/07 — via la nouvelle section générique `profile-fields` |
| **4** | **Formulaire acteur** `costumForms` (create + edit) | ✅ 27/07 — 21 champs, 0 code ; **essai UI/écriture réelle à faire** |
| **5** | Actualités | ⛔ **sans objet** — 0 news rédigée en base (les 400 entrées `news` du costum sont des `activityStream` vides). L'agenda du lot 2 couvre les événements |
| **6** | Pages éditoriales (institut-bleu, guide, charte, légal) | ✅ 27/07 — 5 pages reprises du CMS legacy |
| **7** | **Back-office** `/admin` (modération, invitations, export) | ✅ 27/07 — 6 onglets, 0 code |
| **8** | Parité backend : hooks costum, export CSV, statut mails | ✅ 27/07 pour les **effets d'écriture** (11/11) + « retirer de l'annuaire » ; reliquats en §8.6 |
| **9** | Gates (typecheck/lint/tests/build) + déploiement (DNS, env, Docker) | 🟡 gates vertes au 27/07 (`tsc -b` 0 · `test:unit` **2012 tests / 158 fichiers** · `test:integration` **sur la config IB : 345 tests / 20 fichiers** · lint : 0 problème sur les fichiers du chantier, 29 erreurs **pré-existantes** ailleurs — blog/ds-bundle) ; `npm run build` et le déploiement restent à faire |

Commandes de vérification par lot :

```bash
# dev (site-json) — un serveur par site, ports distincts ; backend = Node (5099)
PORT=5175 VITE_SLUG=institutBleu SITE_CONFIG_PATH=config.prod.institut-bleu.json \
  VITE_BASE_URL_BACKEND=http://localhost:5099 VITE_SERVER_URL=http://localhost:5175 \
  node server/dev-server.js
# (le .env du repo pointe par défaut sur le LEGACY :5080 — surcharger pour viser le Node)

# gates
npm run config:validate -- config.prod.institut-bleu.json
npm run typecheck && npm run lint && npm run test:unit && npm run build
```

---

## 9. Impacts des modifications

*(à remplir à chaque lot livré : ce qui change, régressions à revalider, résultat des gates)*

| Date | Lot | Changement | Régressions revalidées | Gates |
|---|---|---|---|---|
| 2026-07-27 | 0 | Création de la doc projet | — | — |
| 2026-07-27 | 2 | 3 pages posées dans `config.prod.institut-bleu.json` : `/annuaire` (searchHeader + `gridLayout` filtres/résultats + export CSV), `/cartographie` (searchProStatic `defaultViewMode: map`), `/agenda` (module agenda, `sourceKey: ["institutBleu"]`). La page héritée `/projets` a été **remplacée** par `/annuaire` | Socle (meta/header/footer/thème/home) inchangé ; `/communaute` avait déjà été retirée par la session parallèle | `config:validate` ✅ (4 pages, 8 sections) ; SSR : `/annuaire` **48 acteurs**, `/cartographie` **45** (= les géolocalisés), `/agenda` 200 (îlot client, **21 events** confirmés via l'API) |

| 2026-07-27 | 3 | **Fiche acteur** : nouvelle section **générique** `profile-fields` (moteur) + branchement dans `profiles.organizations` (onglet « À propos », 2 colonnes, 7 champs costum) | Aucune section existante modifiée (ajout pur au renderer + union du schéma) | `tsc -b` **0 erreur** ; `vitest src/modules/profil` **301 tests / 28 fichiers** ✅ (dont 7 nouveaux) ; `config:validate` ✅ ; SSR `/profil/reunionDiving` : acronyme, catégories, forme juridique, SIRET, code NAF, lieu d'exploitation et réseaux sociaux rendus |

| 2026-07-27 | 4 | **Formulaire acteur** : `costumForms["institut-bleu-acteur"]` (21 champs, 4 onglets, **0 code**) + `floatingActionButton` « Référencer ma structure » (auth requise) + transform moteur `coerce:boolString` | Aucun autre costum touché (ajout d'un transform + d'une entrée fixture) | `preflight/costum-forms` **29 tests** ✅ (structure + `registerCostumForm` à blanc + clés de registre) ; nouveau `institut-bleu-acteur.configDriven.test.ts` **13 tests** ✅ ; `coercions.test.ts` **5 tests** ✅ |

| 2026-07-27 | 4bis | **Limite dure de multi-sélection** (moteur) : `widgetProps.maxItems` sur le widget `multiselect` (bloque la saisie) + `rules.min/max` appliqués à la **longueur** d'un tableau (bloque la validation, messages `validation.minItems`/`maxItems`, fr+en) ; posés sur `categoryThematic` (2) et `tags` (5) | `rules.max` n'était utilisé sur AUCUN champ tableau du repo (`Number([…])` = NaN → règle jamais déclenchée) : extension sans régression, prouvée par un test de non-régression sur les nombres | `validate.test.ts` + form IB + préflight : **57 tests** ✅ |
| 2026-07-27 | 7 | **Back-office `/admin`** : `config.admin` — 6 onglets (tableau de bord · acteurs · agenda · référencement · communauté · export), **0 code** | — | `config:validate` ✅ (la clé `admin` est bien couverte par `SiteConfig` — vérifié par un test négatif : `rowActions: ["edite"]` est rejeté) ; SSR `/admin` → 200 |

| 2026-07-27 | 10 | **`config.auth`** (variant, menu de compte, textes login/register/recover) + **`config.commandPalette`** (⌘K, recherche d'acteurs scopée annuaire) + `header.utilities.search: true` (le bouton de la palette est gaté par ce flag) | Les textes d'auth hérités du modèle « Sport Santé Bien-être » sont remplacés — **0 trace du modèle** dans la config désormais | `config:validate` ✅ ; SSR 200 sur `/login`, `/register`, `/recover-password` (textes IB rendus) et bouton de palette présent sur la home |
| 2026-07-27 | 8 | **Analyse détaillée du lot 8** (backend / lib / site-json) — voir la section dédiée | — | Analyse seule, aucun code |
| 2026-07-27 | 6bis | Titre de la home aligné sur `meta.title` | — | Corrige le **seul échec** de `test:integration` sur la config IB (`config-driven-ssr` exige que le `<title>` contienne `meta.title` ; la home affichait « Accueil »). Après fix : **345 tests / 20 fichiers** ✅ |
| 2026-07-27 | 6 | **5 pages éditoriales** reprises du CMS legacy : `/institut-bleu`, `/guide-des-etapes`, `/charte`, `/mentions-legales`, `/confidentialite` + « L’Institut » au menu, colonne « Informations » et liens légaux au footer | Pages `/`, `/annuaire`, `/cartographie`, `/agenda` inchangées | `config:validate` ✅ (**9 pages, 14 sections**) ; SSR 200 sur les 5 pages, contenu vérifié (titres, listes, 6 captures du guide) |

### Lot 8 — analyse détaillée par dépôt (27/07)

#### 8.0 Le point de départ : le legacy écrit depuis le NAVIGATEUR

C'est le fait structurant, et il n'est pas dans le modèle PHP : la quasi-totalité du travail de
rattachement d'un acteur est faite par le **JavaScript du costum**, dans le `afterSave` du
formulaire (`modules/costum/assets/js/costumize/institutBleu/institutBleu_index.js:513-700`), via
des appels `dataHelper.path2Value` / `path: "allToRoot"` et deux routes maison. Le backend PHP,
lui, ne pose que `source` (`Element::prepData`).

Effets observés à la **création** d'un acteur (et vérifiés sur les documents en base) :

| # | Effet | Posé par |
|---|---|---|
| 1 | `source = {insertOrign:"costum", key:"institutBleu", keys:["institutBleu"]}` | backend PHP (`Element::prepData`) |
| 2 | `costumId` + `costumType` (l'org porteuse) | JS (path2Value) |
| 3 | `reference.costum = ["institutBleu"]` | JS |
| 4 | `referentId = <userId>` | JS |
| 5 | `dateSign = "j/m/aaaa"` | JS |
| 6 | `preferences.toBeValidated.institutBleu = true` — **inconditionnel à la création** (`if(!uploadObj.update)`, l.614) | JS |
| 7 | `preferences.isOpenData = true`, `isOpenEdition = true` | JS |
| 8 | `telephone.mobile = [mobile]` en plus du champ `mobile` | JS |
| 9 | **`tags` = tags saisis ∪ `thematic` ∪ `categoryThematic`**, moins les valeurs de `lists.family` non retenues | JS (l.632-700) |
| 10 | `links.memberOf.<costumId>` + `links.members.<userId>` | route `costum/institutbleu/connect` → `InstitutBleu::connect` |
| 11 | Mail aux admins « Une structure demande à devenir membre » (`costum.admin.email`) | JS → `mailmanagement/createandsend` |

> Le point 6 **confirme par le code** la modération a priori déjà retenue au lot 4 (et documentée
> dans le guide des étapes). Le point 9 explique pourquoi les 48 acteurs portent leurs catégories
> dans `tags` — et pourquoi `prepDataForUpdate` les en retire à la LECTURE du formulaire.

#### 8.1 Ce que notre pile fait déjà

- **backend Node** — `element/save` porte `Element::prepData` : il pose l'effet **1** quand le
  costum résout (`saveCostum.found`). Il **ne peut pas** poser 2 et 10 : `costumId`/`costumType`
  sont des clés de contrôle jamais stockées (`SAVE_CONTROL_KEYS`) et `links` est une clé sensible
  jamais écrite par `element/save` (`SENSITIVE_SAVE_KEYS`) — exactement comme le legacy.
- **lib** — injecte `{costumSlug, costumId, costumType}` dans le payload (`BaseEntity`, contexte
  `_costumCtx`) ; c'est ce qui permet au backend de résoudre le costum. Rien à changer.
- **site-json** — le formulaire du lot 4 pose 7 (`isOpenData`/`isOpenEdition`) et 6
  (`toBeValidated`) via `mutation.inject.extraFields`.

**Manquent donc : 2, 3, 4, 5, 8, 9, 10, 11.**

#### 8.2 Où porter quoi — recommandation

| Effet | Dépôt cible | Comment | Pourquoi là |
|---|---|---|---|
| 2, 3, 4, 5, 8, 9 | **backend Node** | hook costum `InstitutBleu.elementAfterSave` (+ `prepData` pour la fusion des tags avant écriture) dans `src/shared/costumHooks.ts` | le mécanisme existe (18 hooks, 5 costums) ; la donnée devient cohérente pour **tout** client (site-json, mobile, import), pas seulement le nôtre |
| 10 | **backend Node** | même hook — `connectLink` est déjà importé par `costumHooks.ts` | `element/save` ne peut pas écrire `links` ; le legacy passait par une route dédiée |
| 11 | **backend Node** | `enqueueMail` depuis le hook | un mail envoyé depuis le navigateur (legacy) est ni fiable ni sécurisé |
| 6, 7 | **site-json** → à **retirer** de `inject.extraFields` une fois 8.2 livré | une seule source de vérité | sinon deux endroits pour la même règle |
| — | **lib** | **rien** | le transport et le contexte costum sont déjà en place |

#### 8.3 Les 3 fonctions du modèle `InstitutBleu.php`

| Fonction | Point d'extension RÉEL | À porter ? |
|---|---|---|
| `prepDataForUpdate` | **LECTURE** — `citizenToolKit/models/Element.php:551` (`Element::getElementById`), malgré son nom | **Partiellement.** Le passage de `tags` en CSV est une contrainte du widget legacy → à ne pas reproduire. En revanche le **retrait des catégories de `tags`** à l'ouverture du formulaire est nécessaire si le backend porte l'effet 9 (sinon l'édition ré-ajoute les catégories comme mots-clés libres). Porter côté backend dans le hook `getElement` (déjà utilisé par `Costumize`), scopé au chemin d'édition |
| `removeSourceFromElement` | route `costum/institutbleu/deletewithsource`, appelée par la fiche acteur ET l'admin legacy | **Oui** — c'est « retirer de l'annuaire » (≠ supprimer). Purge tags de catégorie, `source`/`source.keys`, `reference.costum`, et `$unset` de 10 champs. Côté site-json : une `rowAction` d'admin à ajouter une fois l'endpoint disponible |
| `isElementMember` | gate d'appartenance (droits élargis) | **À évaluer** — utile seulement si l'on veut que les membres d'une structure référencée héritent de droits d'édition ; aucun besoin identifié dans les lots 1-7 |

#### 8.4 Les 7 actions du contrôleur legacy

| Action | Usage | Notre équivalent |
|---|---|---|
| `connect` | après création (effet 10) | à absorber dans le hook backend (§8.2) |
| `updatevalue` | `path2Value` maison (id/collection/path/value) | déjà couvert : `element/updatefields` du backend + `updateField` de la lib |
| `deletewithsource` | « retirer de l'annuaire » | à porter (§8.3) |
| `csv` (`ExportCsvAction` → `getCsv`/`parseFields`) | bouton CSV de l'annuaire ET export admin | **écart assumé** : `/admin` utilise `exportElements` (générique). Le legacy met à plat scope/parent/adresses/réseaux et retire les `#`. À rapprocher seulement si l'Institut Bleu compare les deux fichiers |
| `getstatusmail` | statut d'envoi des invitations (collection `cron`) | rien côté Node ; utile seulement si l'écran d'invitations affiche ce statut |
| `elementhome` (`HomeAction`) / `ficheacteur` | rendent la **vue PHP** de la fiche acteur | **sans objet** : notre fiche est `profiles.organizations` (lot 3) |

#### 8.5 ✅ Livré le 27/07 (backend)

| Effet | Où | Vérifié par |
|---|---|---|
| 2,3,4,5,6,7,8,9,10,11 | `InstitutBleu.elementAfterSave` / `.elementAfterUpdate` — `cocolight-backend/src/shared/costumHooks.ts` | `institutBleuHooks.e2e.test.ts` (5 cas) contre la **vraie base**, données jetables + cleanup vérifié |
| « retirer de l'annuaire » | **mécanique générique** `runRemoveSource` + table `REMOVE_SOURCE_SPECS` (les **6** implémentations PHP transcrites) branchée sur `admin/setsource action=remove` — remplace un `TODO(costum-hooks)` | idem (2 cas : Institut Bleu **et** famille « formation », pour prouver la généricité) |
| Source unique | `preferences` **retiré** de `costumForms.institut-bleu-acteur.mutation.inject.extraFields` | `institut-bleu-acteur.configDriven.test.ts` |

Deux découvertes ont demandé des changements de moteur :

1. **Le costum ne déclare pas `elementAfterSave`** — et pour cause : côté legacy ces effets sont en
   JavaScript, or le JS ne déclare rien dans `costum.class.function`. D'où l'option
   **`registerCostumHook(..., { implicit: true })`** : un hook peut être marqué « portage d'un
   comportement JS », donc actif sans déclaration PHP. Documenté dans `docs/15-COSTUM-HOOKS.md`.
2. **Le gate existait en double** — `costumOverrides` (décide d'appeler) et `applyCostumHook`
   (exécute) testaient chacun `functions.includes(hook)`. N'ayant étendu que le premier, le hook
   passait le gate d'appel et se faisait **refuser silencieusement** par le second. Les deux
   partagent désormais `isHookDeclared()`. C'était un piège latent pour tout futur portage.

Le contrat du hook gagne `isUpdate` (`element.routes.ts`) : le legacy distingue création et édition
(`if(!uploadObj.update)`), il fallait la même information côté Node.

3. **Le « retirer de l'annuaire » n'est pas propre à IB.** Mesuré : **6 implémentations PHP** du même
   hook, dont **3 copies littérales** (empreintes identiques `sha1:7d12aee5…`) et `InstitutBleu` qui
   dérive de `Meir`. Toutes font les mêmes 3 opérations — retirer des tags, `$unset` des champs, couper
   le rattachement — seules les **données** changent (jusqu'au détail : `Meir` cherche la *clé* de ses
   listes, `InstitutBleu` la *valeur*, parce que leurs listes n'ont pas la même forme en base). D'où une
   **table de paramètres** plutôt que 6 hooks. Reproduire le copier-coller du legacy aurait été un choix,
   pas une fatalité.

4. **Le détecteur de parité était aveugle au CONTENU.** `costum-hooks:check` voyait apparaître ou
   disparaître un implémenteur, jamais un changement *dans* une implémentation — or notre table le
   transcrit. Ajout d'un **tripwire d'empreinte** sur le corps de chaque méthode PHP des hooks portés
   (`implementerHashes` au manifeste) → drift `changed-implementation`. Vérifié en altérant une
   empreinte : le détecteur sort en erreur. Actif sur les **11 hooks portés**, pas seulement celui-ci.

Gates : `tsc` 0 · suite backend **294 tests / 47 fichiers** ✅ · base vérifiée à **0 résidu**
(51 acteurs IB intacts).

#### 8.5 bis — Reliquats traités le 27/07 (2ᵉ passe)

| Sujet | Livré |
|---|---|
| **Rendu CSV** (site-json) | `src/modules/search/lib/csvValue.ts` + 9 tests. Résolution récursive : tableau d'objets → la valeur lisible (`link`/`url`/`name`…), objet composite → sa valeur (pas ses clés), objet-**ensemble** (`{a:true,b:true}`) → ses clés, borne de profondeur (pas de plantage sur structure cyclique). Un cas trouvé **par le test** : une entrée `{type:"Facebook", link:""}` retombait sur son libellé — le legacy l'omet, on l'omet |
| **`prepDataForUpdate`** (backend) | Effet (a) sur `element/about`, table `PREP_TAGS_DROP_LISTS` (`InstitutBleu` + `Costumize`, qui sont le même code). Contexte costum dérivé de l'élément — le contrat `GET_ELEMENTS_ABOUT` (`additionalProperties:false`) interdit de l'envoyer. `BUG-N-318` |

Gates : backend **296 tests / 47 fichiers** ✅ (dont le nouveau cas de lecture), site-json module search
**296 tests / 23 fichiers** ✅, `tsc -b` 0, base **0 résidu** (51 acteurs IB intacts).

#### 8.6 Reste à faire

| Sujet | État |
|---|---|
| `prepDataForUpdate` (lecture) | ✅ **porté le 27/07** — effet (a) seul : les catégories sortent des `tags` renvoyés par `element/about` (la base, elle, garde la fusion). La mise en CSV (b) et la normalisation `otherSociaNetworks` (c) ne sont **pas** portées : béquilles des widgets legacy. Le contexte costum est **dérivé de l'élément**, le contrat interdisant de l'envoyer (`BUG-N-318`) |
| `isElementMember` | **non porté** — aucun besoin identifié dans les lots 1-7 |
| Export CSV costum (`getCsv`/`parseFields`) | **écart de FORMAT assumé** (`, ` vs `\n`, adresse en 2 colonnes). Mais le **rendu des valeurs a été durci** le 27/07 : `src/modules/search/lib/csvValue.ts` — un tableau d'objets (`otherSociaNetworks`) sortait `[object Object]`, un objet composite (`telephone: {mobile:[…]}`) sortait ses **clés** (« mobile »). 9 tests. Au passage, la colonne « Téléphone » de `/annuaire` pointait `telephone` (objet) → corrigée en `mobile` |
| `getStatusMail` (statut des invitations) | **non porté** — utile seulement si l'écran d'invitations affiche ce statut |
| ~~Action « retirer de l'annuaire » dans `/admin`~~ | ✅ **rien à câbler** (correction du 27/07) — l'UI l'a déjà : `AdminResourceTable` propose « Détacher » (`set=source`) ou « Retirer la référence » (`set=reference`) selon la ligne, et l'onglet Référencement le second. Les deux appellent `carrier.removeFromSource` / `removeReference` de la lib → le **même** endpoint `admin/setsource` que l'admin legacy. **Aucune méthode SDK à ajouter.** Depuis le 27/07 les deux branches déclenchent le hook (cf. `BUG-N-317`) |

#### Plan d'exécution initial (pour mémoire)

1. **Mesurer d'abord** : créer un acteur de test via l'API Node (costumSlug `institutBleu`), comparer
   le document obtenu à un acteur legacy, **puis le supprimer** — la base est partagée avec la prod
   de démonstration, donc écriture uniquement sur accord explicite et nettoyage vérifié.
2. Implémenter `InstitutBleu.elementAfterSave` (effets 2,3,4,5,8,10) + `prepData` (effet 9) +
   `enqueueMail` (effet 11) dans `cocolight-backend`, avec un test e2e sur le modèle de
   `costumHooks.e2e.test.ts`.
3. Retirer les effets 6/7 de `inject.extraFields` côté site-json une fois 2 livré.
4. Porter `removeSourceFromElement` (endpoint + `rowAction` admin).
5. Trancher `isElementMember`, l'export CSV et `getStatusMail` selon l'usage réel.

### Cadrage initial (repris ci-dessus)

Le backend Node **a déjà** le dispatch équivalent à `Costum::isSameFunction` / `sameFunction` :
`cocolight-backend/src/shared/costumHooks.ts` (`resolveActiveCostum` → `costumOverrides` →
`applyCostumHook`), avec **18 hooks portés pour 5 costums** (`Costumize`, `CressReunion`,
`FiliereGenerique`, `ReseauTierslieux`, `SportSanteBienetre`, `Transiter`). **Aucun pour
`InstitutBleu`** : le costum déclare 3 fonctions, aucune n'est enregistrée → le backend prend
systématiquement la branche par défaut.

Le nom de classe résolu est `ucfirst(costumSlug)` = **`InstitutBleu`** (et non `Costumize`, bien que
`costum.slug` vaille `costumize`) : le client envoie `costumSlug: "institutBleu"`.

| Fonction legacy | Point d'extension réel | Effet | Impact SiteForge |
|---|---|---|---|
| `prepDataForUpdate` | **LECTURE** — `Element::getElementById` (`citizenToolKit/models/Element.php:551`), pas l'écriture malgré son nom | retire de `tags` les valeurs de `lists.family`/`lists.categoryThematic`, **joint `tags` en chaîne CSV**, normalise `otherSociaNetworks` | le CSV est une contrainte du **widget legacy** ; notre formulaire attend un tableau → **ne pas porter tel quel**. Reste à trancher : faut-il reproduire le filtrage des tags de catégorie à l'édition ? |
| `removeSourceFromElement` | action `deleteWithSource` du contrôleur costum | purge tags de catégorie + `source`/`source.keys` + `reference.costum`, `$unset` de 10 champs (`legalStatus`, `displayAuth`, `referentId`, `dateSign`…) | nécessaire si `/admin` doit proposer « retirer de l'annuaire » (aujourd'hui : suppression pure) |
| `isElementMember` | gate d'appartenance (droits d'édition élargis) | vrai si l'utilisateur est admin/membre d'une structure du costum | à porter si l'on veut la même surface de droits que le legacy |

S'ajoutent hors dispatch : l'export CSV (`ExportCsvAction` + `getCsv`/`parseFields` : mise à plat
scope/parent/adresses/réseaux, suppression des `#`) et `getStatusMail` (statut d'envoi lu dans la
collection `cron`). La section `export` de `/admin` utilise l'export **générique** du backend, pas
celui du costum : colonnes et mise en forme diffèrent du legacy.

### Détail du lot 6 — la reprise éditoriale

Le CMS legacy encode sa hiérarchie par des **styles inline** (`font-size` + `font-weight` sur des
`<div>` imbriqués), pas par des balises sémantiques. Un convertisseur dédié
(`tools`/scratch `cms2html.py`, non versionné) rejoue ces signaux en `h1/h2/h3`, `<ul>`, `<p>` et
**abandonne les couleurs/tailles en dur** (elles casseraient le thème). Le markdown résiduel du
legacy (`[label](url)`, `**gras**`) est converti, les URL nues deviennent des liens.

| Page legacy | Page SiteForge | Forme |
|---|---|---|
| `#institut-bleu` (2 blocs) | `/institut-bleu` | section `html` (`prose`) |
| `#guide-des-etapes` | `/guide-des-etapes` | section `title` + section **`markdown` inline** — le legacy stockait déjà du markdown (`isMarkdown: true`, 6 captures d'écran) ; les niveaux de titres sont décalés d'un cran pour rester sous le bandeau |
| `#charte` | `/charte` | `html` (1 h1, 4 h2, 3 h3, listes) |
| `#mentions` | `/mentions-legales` | `html` |
| `#confidentialityrules` | `/confidentialite` | `html` (11 h2, 30 items — 14,5 Ko) |

Non repris : `#forum`, `#documentation`, `#financement`, `#bibliotheque`, `#yuna-test` (tous
`restricted: draft/admins` côté legacy) et `#actus` (cf. lot 5, sans objet).

#### Corrections de contenu (27/07, à la demande de Thomas)

Le texte legacy portait des défauts de copier-coller (PDF → CMS). Les collages ont été trouvés
**par confrontation au dictionnaire système** (un mot inconnu qui se découpe en deux mots connus
= une espace avalée), pas à l'œil :

| Correction | Occurrences |
|---|---|
| `auxacteurs` → « aux acteurs » · `échellelocale` → « échelle locale » · `unannuaire` → « un annuaire » · `InstitutBleu` → « Institut Bleu » · `InterventionMaritime` → « Intervention Maritime » | 5 (page L’Institut) |
| « actions partenariales se **développement** » → « se **développent** » | 1 |
| Espace manquante après un point de fin de phrase (« …La Réunion.Pour cela… ») | règle générale, minuscule/URL épargnées |
| **Nom propre normalisé** en « Institut Bleu » — le CMS legacy l'écrivait de 16 façons (`Institut bleu`, `institut Bleu`…) | ~110 ; les slugs/URL (`institutbleu`, `institutBleu`) sont **intacts** |
| URL du site : `communecter.org/costum/co/index/slug/institutBleu` → **`https://annuaire.institutbleu.re`** | 4 (charte ×2, confidentialité ×2) |

Vérifié après coup sur la config **et** sur le rendu SSR : 0 collage restant, 0 URL legacy, 170
occurrences du nom normalisé.

#### Version anglaise

- `/institut-bleu` : **traduction rédigée** (contenu institutionnel).
- `/charte`, `/mentions-legales`, `/confidentialite` : corps français **précédé d'une mention**
  « *This page is only available in French. The French text is the legally binding version.* » —
  traduire un texte juridique engagerait l'association ; mieux vaut le dire que servir du français
  sans prévenir.
- `/guide-des-etapes` : reste en français (la section `markdown` n'a qu'un champ `md`, non localisé,
  et les 6 captures d'écran sont en français).

### Détail du lot 7 — le back-office

Traduction du `costum.adminPanel.menu` legacy dans le [module admin](../doc/30-module-admin.md) :

| Legacy | SiteForge |
|---|---|
| `organizations` « Acteurs à modérer » | onglet **Acteurs** — section `resource` (organizations), colonnes Nom · Catégories · Commune · Mail · Ajouté le ; `rowActions` edit/validate/reference/delete ; `bulkActions` validate/export/delete ; création via le form costum `add-institut-bleu-acteur` |
| `reference` « Référencement » | onglet **Référencement** — section `reference` (organizations) |
| `community` (+ mailing) | onglet **Communauté** — section `members` (filtres toBeValidated/isAdmin/isInviting/text, action `invite`) |
| `statistic` / `directory` | onglet **Tableau de bord** — section `dashboard` (tuiles dérivées des `resource`, dont le compteur « à valider ») |
| `ExportCsvAction` | onglet **Export** — section `export`, `access: superAdmin` (plancher backend) |
| `import`, `converter`, `mails`, `log`, `moderation`, `spamobservatoire`, `zoneadmin`, `notsendmail` (tous `false` côté legacy) | **non activés** |

L'onglet **Agenda** (`resource` sur `events`) n'a pas d'équivalent legacy : il est ajouté parce que
le costum porte 21 événements et que la page `/agenda` publique doit être alimentée.

⚠️ Le périmètre de la table admin est **plus large que l'annuaire** : `$or {source.key, source.keys}`
**sans** `displayAuth` ni `toBeValidated` — sinon les fiches à modérer seraient invisibles… dans
l'écran de modération. La `listInvitation` legacy n'a pas d'écran dédié : les invitations passent
par la section `members`.

### Détail du lot 4 — le formulaire acteur

Document JSON dans `config.costumForms["institut-bleu-acteur"]` (recette « 0 code » du formEngine),
qui rejoue le `dynFormCostum` legacy champ par champ. Onglets : **Autorisation** (la case
`displayAuth`) · **La structure** · **Contact** · **Localisation**. Déclencheur : bouton flottant
`add-institut-bleu-acteur`.

> ⚠️ **Parité de type sur `displayAuth`.** Le legacy stocke une **chaîne** `"true"` (form-urlencoded),
> et l'annuaire filtre dessus. Un `switch` produit un booléen : sans conversion, toute fiche créée
> depuis SiteForge **serait invisible dans l'annuaire**. Le moteur n'avait aucun transform pour ça
> (`coerce:string` renvoie `""` pour un booléen) → ajout de **`coerce:boolString`**
> (`src/modules/formEngine/engine/coercions.ts`, générique, testé). Le champ déclare
> `read: "coerce:bool"` / `write: "coerce:boolString"`.

Autres décisions du lot :

| Point | Décision |
|---|---|
| `legalStatus` | `select` dont l'enum = liste costum (11) **∪** valeurs réellement saisies (`GIE`, `Etablissement public de l'Etat`, `syndicat professionnel`, `eurl`…) → l'édition d'une fiche existante ne perd pas sa valeur |
| Site web | champ **`link`** (legacy IB), pas `url` |
| Modération | création avec `preferences.toBeValidated.institutBleu: true` (a priori) — cohérent avec le filtre de l'annuaire ; **à confirmer** (question 3) |
| `categoryThematic` | requis, multi, **plafond de 2** — `widgetProps.maxItems: 2` (saisie) + `rules.max: 2` (validation) après l'extension du moteur (lot 4bis) ; `tags` plafonné à 5 de la même façon |
| `similarLink` (doublons), `dateSign`/`nameSign` | hors périmètre du formulaire (slot de détection de doublons côté legacy ; champs de signature posés ailleurs) |
| `mobile` vs `telephone` | le formulaire écrit `mobile` (comme le legacy) ; le legacy alimente **aussi** `telephone.mobile[]` — à vérifier lors du premier ajout réel |

### Détail du lot 3 — la section `profile-fields`

Le module profil n'avait **aucune** section générique pour afficher des champs arbitraires : les
précédents costums ont chacun poussé une section codée (`profile-info-tl`, `profile-about-tl`,
`profile-about-ssbe`) — exactement ce que le repo cherche à supprimer (cf. les commits
« noms de DESIGN, fin des noms de site »). Plutôt qu'un `profile-about-ib`, ce lot ajoute le
**pendant profil de `preview.type: "facets"`** :

| Fichier | Rôle |
|---|---|
| `src/modules/profil/schema.ts` | `ProfileFieldSchema` (`field`/`label`/`icon`/`format`) + `ProfileFieldsSectionSchema` (+ union + types) |
| `src/modules/profil/lib/profileFields.ts` | logique **pure** : `buildProfileFieldRows`, `fieldHref` |
| `src/modules/profil/lib/profileFields.test.ts` | 7 tests (dot-paths, champs vides, `socialLinks`, href) |
| `src/modules/profil/components/sections/ProfileFields.tsx` | rendu (lazy, `variant` card/plain, `columns` 1-2) |
| `src/modules/profil/ProfileSectionRenderer.tsx` | enregistrement du type `profile-fields` |
| `doc/08-module-profil.md` | documentation de la section (19 sections désormais) |

Réutilise `resolveServerDataPath`/`toFacetTokens` du module search → même sémantique que les
facettes de recherche. **Piège de donnée rencontré** : `otherSociaNetworks` contient, chez certains
acteurs (« Duocean WOS »), des entrées où `type` **et** `link` sont des *tableaux parallèles* —
le lecteur les aplatit au lieu de les perdre.

### Détail du lot 2 — périmètre de l'annuaire

Filtre repris **à l'identique du legacy** (`filters.php:456` + `:486`) :

```json
"notSourceKey": true,
"defaultFilters": {
  "$or": { "source.key": "institutBleu", "source.keys": "institutBleu" },
  "displayAuth": "true",
  "preferences.toBeValidated.institutBleu": { "$exists": false }
}
```

→ **48 acteurs** (51 au total − 1 sans `displayAuth` − 2 en attente de validation).

> ⚠️ **`displayAuth` se compare à la CHAÎNE `"true"`, pas au booléen.** Le legacy écrit
> `defaultFilters['displayAuth'] = true` en JS, mais poste en **form-urlencoded** : PHP reçoit la
> chaîne `"true"`, qui est ce qui est stocké en base (50/51 en `string`). Un filtre JSON `true`
> (booléen) depuis SiteForge ne matcherait **aucun** acteur.

Facettes (valeurs **réellement présentes**, mesurées sur les 48) : `categoryThematic` (8) ·
`tags` restreints à la liste `family` du costum (24 présentes sur 28) · `legalStatus` (13 valeurs
réelles — la base contient 4 valeurs hors liste costum : `Etablissement public de l'Etat`, `GIE`,
`syndicat professionnel`, `eurl` en minuscules).

---

### Lot 9 — design de la home, thème et finitions (28/07)

Branche `feat/institut-bleu-et-correctifs-parc`, **13 commits** au-dessus de `ac8ee07d`.

#### Ce qui change dans la config

| Page | Changement |
|---|---|
| `/` | Home portée de 2 à **4 sections** : `hero-parallax` (photo plein cadre, header transparent au repos et opaque au défilement) · `data-observatory` (portrait chiffré de la filière, KPI en ligne) · `agenda` en **teaser** · `action-tiles`. Les quatre alignées sur la **même largeur** (`5xl`) — deux échelons différents sur une page se voient immédiatement |
| `/` | CTA du hero : « Voir la carte » remplacé par **« Référencer ma structure » → `/register`**. La cartographie avait déjà deux entrées (nav + tuile) ; se faire référencer n'en avait aucune, alors que c'est le mécanisme de croissance de l'annuaire |
| `/annuaire` | Retrait de `showSearch` (doublon exact du champ que le panneau `filters` rend **sans condition**, cf. `FiltersSection.tsx:543`), de `searchPlaceholder` (sans objet) et de `showActiveFiltersTags` (**inerte** : `activeFilterTags` ne se dérive que de `dropdownFilters`, absent de cette section) |
| Pied de page | Les **trois blocs-marques du cofinancement** (État — Ministère chargé de la Mer et de la Pêche · La Mer en Commun / Année de la mer · Région Réunion) et la mention légale complète, relevés sur la page « Outils de communication » du site institutionnel du client. Le logo Région, livré sur un carré 1500×1500 dont le dessin n'occupait qu'une bande, a été détouré puis remargé à 8 % (1260×593) |
| Pied de page | Le guide de référencement rejoint la barre de liens bas. La colonne « Ressources » est **supprimée** : elle n'existait que pour porter ce lien orphelin, et ses deux autres entrées dupliquaient la nav |

Thème « **le trait de côte** » : `src/index-institut-bleu.css` perd **90 déclarations de variables**
que le bloc `theme.colors` de la config recouvrait déjà, et gagne les utilitaires propres au site
(`.trait-cote`, `.surtitre`, `.tabular`, `.cote-puces`, `.cote-cta`).

#### Six défauts du moteur trouvés en posant cette config

Tous de la même famille, la plus insidieuse du projet : **une clé déclarée au schéma que le code
ignore en silence**. La config n'étant jamais parsée par Zod à l'exécution, rien ne les signale.

| Défaut | Correctif | Commit |
|---|---|---|
| `hero-parallax.badges[].icon` n'acceptait que du SVG inline — écrire `"waves"` imprimait le mot | accepte aussi un nom lucide, comme le reste du moteur | `bcf43aec` |
| `ctaButtons[].variant: "outline"` retombait sur la branche primaire — deux boutons pleins identiques | variant implémenté ; les CTA passent sur le `Button` shadcn | `bcf43aec` |
| `charts[].colors` déclarée pour TOUS les graphes, lue par `donut`/`pie` seulement | `<Cell>` gardés sur `bars`/`barsHorizontal` ; défaut monochrome inchangé | `5269fc8e` |
| `max-w-8xl` ne générait aucun CSS (l'échelle Tailwind s'arrête à `7xl`) → conteneur sans largeur max | jeton `--container-8xl` dans `shared.css` + helper mono-source `src/lib/sectionMaxWidth.ts` | `23cdbd94` |
| L'agenda plaçait son contenu dans `container` (plafond 1536 px), un échelon qu'aucune autre section n'emploie | `agenda.maxWidth` ; ABSENT = comportement historique, les 4 sections agenda du parc sont inchangées | `23cdbd94` |
| `useItem` ne lisait que `profilMediumImageUrl`/`Thumb`, or `searchEventsCostum` ne projette QUE `profilImageUrl` | repli ajouté ; **15 des 41 événements du parc** retrouvent leur image | `0aed89c6` |

Deux corrections d'ergonomie en découlent :

- **`CardEvent` sans image** — carte-affiche dont la photo est le fond : sans elle, les deux panneaux
  de verre flottaient sur 288 px de vide, ce qui est le cas des 26 autres événements du parc (appels
  à projets, assises). Variante typographique bâtie sur le `Card` shadcn, `h-full` au lieu de `h-72`.
  Même bascule si l'image **ne charge pas** — on observe des `profilImageUrl` dont le chemin contient
  littéralement `/null/null/`.
- **Garde d'authentification des modales d'ajout** (`f24a6531`) — toutes les clés de `DynamicModal`
  sont des modales d'ajout, et `runEntityMutation` crée sur `me` : sans session elle lève
  « No entity provided ». Un visiteur pouvait remplir les quatre onglets du formulaire acteur pour ne
  récolter qu'un toast technique. Textes surchargeables par formulaire sous `chrome.authPrompt` —
  écrits pour IB. Le garde `condition: {auth: "required"}` du bouton flottant reste en place, mais
  **il n'est plus le seul rempart**.

#### Revue adversariale

Une revue multi-agents a passé le diff et le parc au crible : **85 constats bruts, 19 confirmés**
après réfutation. Un seul portait sur ce lot, de gravité haute — et le panel l'avait **rejeté à
tort** : dans `ExpandableActions` (6 communes, hors périmètre IB), les boutons vivent dans la branche
`isExpanded &&` d'une carte portant `onClick={onToggle}` ; sans arrêt de propagation, tout clic
repliait la carte et **démontait** le composant. Corrigé, avec un test validé par la négative.

#### Gates au 28/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 11 pages / 22 sections |
| `audit:config` | ✅ **0 constat actif** |
| `config:probe` | ✅ **6 périmètres, 6 OK, 0 vide** (48 acteurs ×4, 21 events ×2) |
| `typecheck` | ✅ `tsc -b` propre |
| `lint` | ✅ **0 erreur**, 37 avertissements (1392 fichiers) — cf. `b8cfcf65`/`c7c555e9` |
| `test:unit` | ✅ **2043 tests**, 163 fichiers |
| `build` | ⬜ non lancé (lot 10) |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS déclarés dans `sites.json` | ✅ | `institutBleu` → `config.prod.institut-bleu.json` / `index-institut-bleu` |
| 2 | Config propre au site | ✅ | meta/header/nav/footer/home IB (session parallèle du 27/07) |
| 3 | Thème IB (light/dark) | ✅ | « Le trait de côte » : palette en `theme.colors`, CSS du site allégé de 90 déclarations redondantes, utilitaires propres (`.trait-cote`, `.surtitre`, `.tabular`, `.cote-*`). Contrastes des CTA mesurés en sombre : 6,35:1 et 5,87:1 |
| 4 | Annuaire filtrable | ✅ | `/annuaire` — 48 acteurs, 3 facettes, export CSV, carte activable |
| 4b | Cartographie | ✅ | `/cartographie` — 45 acteurs géolocalisés |
| 5 | Fiche acteur | ✅ | 7 champs costum exposés via `profile-fields` (section générique ajoutée au moteur) |
| 6 | Formulaire acteur | 🟡 | Document posé + gardes vertes ; **ouverture de la modale et création réelle non encore essayées** (exige un compte + une écriture en base) |
| 7 | Agenda | ✅ | `/agenda` (21 events) **vérifiée en navigateur** + teaser sur la home (3 événements, lien « Tout l'agenda ») |
| 8 | Pages éditoriales | ✅ | 5 pages reprises ; les 5 pages legacy en brouillon (`forum`, `documentation`, `financement`, `bibliotheque`, `yuna-test`) restent hors périmètre |
| 9 | Back-office | ✅ | 6 onglets (`config.admin`) ; **essai UI connecté à faire** |
| 10 | Parité hooks backend | ✅ | 11 effets d'écriture portés + retrait de l'annuaire (`cocolight-backend`, e2e 5 cas) ; reliquats de lecture/export en §8.6 |
| 11 | Connexion / inscription (`config.auth`) | ✅ | Textes IB, menu de compte ; `/login`, `/register`, `/recover-password` rendus |
| 12 | Palette ⌘K (`config.commandPalette`) | ✅ | Recherche d'acteurs scopée **annuaire public** (`displayAuth` respecté) ; événements volontairement exclus |
| 13 | Home (design) | ✅ | 4 sections alignées sur `5xl` : hero photo · portrait chiffré · teaser agenda · tuiles d'accès. Header transparent au repos, opaque au défilement |
| 14 | Parcours « se faire référencer » | ✅ | CTA du hero → `/register` (route vérifiée). Le bouton flottant reste réservé aux connectés ; la modale d'ajout propose désormais la connexion au lieu d'une impasse |
| 15 | Observatoire | ✅ | `/observatoire` + résumé en home (`kpiLayout: "inline"`, `maxWidth`) ; graphe monochrome assumé — la longueur des barres encode déjà la valeur |
| 16 | Pied de page — cofinancement | ✅ | 3 blocs-marques (État/Mer-Pêche · Année de la mer · Région Réunion) + mention légale FIM/DGAMPA complète, via `footer.partners.note` |
| 17 | Mode sombre | 🟡 | Home, agenda et pied de page vérifiés en navigateur ; **les 7 autres pages restent à parcourir** |
| 18 | Rendu mobile | ❌ | Jamais vérifié — `resize_window` ne change pas le viewport rendu dans l'outillage employé |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

| Besoin | État | Preuve / substitut |
|---|---|---|
| Recherche scopée `source.key` | ✅ résolu | Le param natif `sourceKey` élargit trop (il matche aussi `reference.costum`/`costumId` : « Open Atlas », l'org porteuse…). **Substitut retenu** : `notSourceKey: true` + `defaultFilters.$or` explicite — comme cyber-reunion, et comme le legacy lui-même. Vérifié : 48 résultats |
| Events scopés costum (`searchEventsCostum`) | ✅ | `sourceKey: ["institutBleu"]` → 21 events (vérifié sur `:5099` le 27/07) |
| Form costum live (`getcostumjson`/`describeForm`) | disponible ≥ 1.0.164 | `src/modules/admin/hooks/useCostumFormLive.ts` |
| Champs costum typés `institutBleu` | présent (transitoire) | `src/costum/schemas/institutBleu.ts` (17 champs) |

---

## 12. Points d'attention / limitations

- **Hooks costum non portés côté Node** — les 3 fonctions de `InstitutBleu.php`. Cadrage fait le
  27/07 (cf. §14 lot 8) : le mécanisme de dispatch **existe déjà** dans le backend
  (`src/shared/costumHooks.ts`, 18 hooks portés pour 5 costums) ; il ne manque que les
  implémentations `InstitutBleu`. Correction d'une idée reçue : **`prepDataForUpdate` n'est pas un
  hook d'écriture** — le legacy l'appelle depuis `Element::getElementById`
  (`citizenToolKit/models/Element.php:551`), donc à la **lecture**, pour préparer le pré-remplissage
  du formulaire.
- **`#search` legacy pointe `sourceKey: "oceanoOi"` / `sourceId: 5a8d040040bb4eba04d62bdf`**
  (= org « Rézo la mer »), ce qui élargit le `$or` du legacy. **Tranché le 27/07** : `oceanoOi`
  ne porte **0 organisation** en base → clause morte, non reprise dans SiteForge. (À revoir si la
  prod diffère de la base locale.)
- **Co-édition du fichier de config** : `config.prod.institut-bleu.json` a été modifié par une
  session parallèle pendant ce chantier (15:49 → 15:56 le 27/07). Toujours relire le fichier avant
  d'écrire ; ne jamais réécrire le socle en aveugle.
- **Valeur polluée** `"Salon professionnel,"` (virgule finale) sur 1 event → facette à normaliser.
- L'org porteuse elle-même porte `source.key: "meir"` (créée depuis le costum MEIR) — ne pas la
  compter comme acteur de l'annuaire.
- **Clones du costum** : `ibv2` et `laMaisonDesFaiseurs` déclarent exactement les mêmes champs —
  toute généralisation faite pour IB doit rester réutilisable.
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement
  (les `.default()` des schémas ne s'appliquent pas).
- **Corollaire mesuré au lot 9** : une clé déclarée au schéma mais non lue par le composant est
  *invisible* — ni typecheck, ni audit, ni erreur au rendu. Six cas trouvés en posant cette seule
  config (cf. §9 lot 9). Réflexe à garder : après avoir écrit une clé, **vérifier dans le composant
  qu'elle est lue**, et se méfier des valeurs d'énumération (`variant: "outline"` était déclaré,
  jamais traité).
- **`searchEventsCostum` ne projette que `profilImageUrl`** — ni `profilMediumImageUrl`, ni
  `profilThumbImageUrl`. Tout code qui résout une image d'événement doit retomber sur ce champ.
- **Deux systèmes de filtrage qui ne se parlent pas** : le HERO (`searchHeader` avec `showSearch` /
  `dropdownFilters`) et le PANNEAU (`gridLayout` + `filters`). `/annuaire` emploie le panneau ; y
  ajouter `showSearch` produit deux champs de recherche, le panneau rendant le sien **sans
  condition**. Même piège déjà rencontré sur cyber-reunion.
- **Les logos de financeurs publics ont une zone de protection imposée par leur charte** : le
  bloc-marque de l'État et celui de l'Année de la mer sont laissés tels que fournis, jamais détourés.
  Seul le logo Région, livré sur un carré à marges excessives, a été recadré.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | ~~Scope de l'annuaire : conserver le lien `oceanoOi` ?~~ **Tranché 27/07** : 0 org sous `oceanoOi` → non repris | — |
| 2 | Les 3 hooks PHP doivent-ils être portés côté Node, ou l'écriture SiteForge assume-t-elle une forme différente (tags en tableau plutôt qu'en CSV) ? | Thomas |
| 3 | ~~Modération a priori ?~~ **Tranché 27/07 par le legacy lui-même** : le guide des étapes du costum écrit « les nouvelles structures apparaissent avec le statut *En attente de validation* […] un administrateur doit valider manuellement chaque structure ». Le `toBeValidated.institutBleu: true` du formulaire est donc conforme | — |
| 7 | Contenu juridique : ~~URL legacy~~ (**corrigée le 27/07** → `annuaire.institutbleu.re`), mais les **mentions légales gardent des champs vides** du legacy : n° SIRET, nom du directeur de publication, article de référence. À compléter par l'Institut Bleu | Institut Bleu |
| 8 | Traduction anglaise des 3 pages juridiques (aujourd'hui : corps français + mention « French only ») et du guide des étapes (captures d'écran en français à refaire) | Institut Bleu |
| 6 | Un acteur créé depuis SiteForge doit-il aussi porter `telephone.mobile[]` (le legacy écrit les deux) et `dateSign`/`nameSign` ? À trancher au premier ajout réel | Thomas |
| 4 | Pages `financement` / `bibliothèque` / `forum` (draft côté legacy) : dans le périmètre du portage ? | Institut Bleu |
| 5 | Invitations sans compte (`acceptInvitationWithoutUser`) : reprises dans `/admin` ? | Thomas |
| 9 | ~~Logos des financeurs~~ **Tranché 28/07** : les trois blocs-marques (État — Mer et Pêche, Année de la mer, Région Réunion) ont été relevés sur la page « Outils de communication » du site institutionnel et installés dans `public/images/institutBleu/` | — |
| 10 | **Logo ARIPA manquant** parmi les membres de `/nos-membres` (17 des 18 collectés) | Institut Bleu |
| 11 | **Rendu mobile jamais vérifié** — l'outillage de capture ne change pas le viewport rendu. À reprendre sur un vrai appareil ou un navigateur piloté autrement | Thomas |
| 12 | **Mode sombre** vérifié sur la home, l'agenda et le pied de page seulement ; les 7 autres pages restent à parcourir. Le hero photo est le point exposé (son voile dérive de `--color-background`) | Thomas |
| 13 | Le **Cluster Maritime de La Réunion** est cité comme partenaire du projet (et non comme financeur) dans la mention légale du pied de page. Faut-il aussi afficher son logo, dans un bloc distinct de « Avec le soutien de » ? | Institut Bleu |
