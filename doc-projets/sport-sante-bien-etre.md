[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Sport Santé Bien-être — La Réunion

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config, le
> périmètre de données mesuré, l'avancement et les décisions **en attente**. Créé pour ne plus
> re-explorer la config à chaque session et pour porter les arbitrages de contenu qui restent à
> rendre. **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module formEngine](../doc/28-module-formengine.md) · [Module Admin](../doc/30-module-admin.md) ·
> [Module Articles/Blog](../doc/32-module-articles-blog.md) ·
> [Module Profil](../doc/08-module-profil.md). Mémoire : `[[project-sport-sante-bien-etre]]`.

Dernière mise à jour : **2026-09-17**. Lot du 16-17/09 (branche `n-dev` : `16922f73` →
`ae133e6a` → merge de `main` `c3f347aa`) : Nicolas restreint l'accès de 8 pages
(`auth.required: true`) et élague 4 entrées de nav devenues secondaires (`/equipements-sportifs`,
`/mapping`, `/listing-formations`, le dropdown « Communauté ») ; Claude enrichit le formulaire
`sport-sante-bienetre-ressource` (2 nouvelles thématiques — `dispositifs`/`prescription` —, upload
PDF porté à 2 fichiers, photo de profil `profil_avatar` affichée seulement pour « Dispositifs » via
`visibleIf`) et livre la page `/programmes-dispositifs` (réservée aux connectés) qui liste ces
ressources en cartes ; puis merge de `main` dans `n-dev`, qui embarque une montée SDK **1.0.192**
sans rapport avec SSBE — cf. §9, §13 (question 17 partiellement répondue).
Lot du 15/09 (branche `n-dev` : `9deff38a`) : **4 nouvelles
pages** — `/habilitation-mss`, `/faq`, `/faq-pro`, `/prescription` — avec leurs entrées de nav
(Professionnels ×3, Grand Public ×1) ; ferme le lien mort `/prescription` (§13, question 1, il ne
reste que `/strategie`) ; corrige au passage une ancre morte introduite par un renommage manuel
d'`id` de section, et un bug de lisibilité du composant `heroWithIcon` (texte toujours sombre même
sur fond image) contourné en CSS scopé plutôt que dans le composant partagé — cf. §9, §12.
Lot du 10/09 (branche `n-dev` : `518b40e8`) : récupération
des **pièces justificatives** d'une structure — champ d'origine routé par `subKey` à l'upload
(le backend écrase le `contentKey` des `doctype:file`), `seedGalleryDefaults` partitionné,
fiche `PreviewStructure` en emplacements nommés façon fiche legacy (cf. §9). **Prérequis backend** :
patch `Organization::getById` (jointure `images` + `files`, calqué sur `Poi::getById`) porté sur
`master` de `citizenToolKit`. Lot du 09/09 (branche `n-dev` : `070a3267`) : refonte du formulaire
d'ajout de structure aligné sur le dynForm legacy du costum, dérivation `tags` verbatim partagée
avec Ekilib.re, section « Actions rapides », consolidation du modèle MSS ; puis merge de `main`
`8bbe35a2` (module AAC, federation-des-cae). Le lot du 08/09, sur `merge-mr51-mr52`, portait la
fusion MR 51 + MR 52 et la modération des structures.
**Les décisions de contenu en attente sont listées au §13.**

---

## 1. Contexte du projet

Plateforme régionale de promotion du sport-santé à La Réunion : elle met en relation le **grand
public** (trouver un créneau, une structure, un équipement), les **professionnels** (labellisation,
formation, prescription) et la **communauté** des acteurs du réseau.

C'est, par le volume, la **deuxième config du parc** après parent62 : 25 pages, 86 sections,
6 formulaires costum, un back-office à 10 onglets.

### Identité

| | |
|---|---|
| Slug | `sportSanteBienetre` |
| Costum backend | `sportSanteBienetre` (collection `organizations` — « Sport Santé bien-être ») |
| Config | [`../config.prod.sport-sante-bien-etre.json`](../config.prod.sport-sante-bien-etre.json) |
| CSS | [`../src/index-sport-sante-bien-etre.css`](../src/index-sport-sante-bien-etre.css) — 75 variables, bloc `theme` **complet** en config |
| Langues | `fr` (défaut) + `en` |
| SDK | `@communecter/cocolight-api-client` **1.0.192** (`package.json` `^1.0.192`, mesurée le 17/09 — montée arrivée via le merge de `main`, sans rapport avec SSBE ; expose `setSiteCostum`/`hasCostumContext`, cf. commit `ac05a227`) |
| Branche courante | `n-dev` — `070a3267` (lot structure) → `8bbe35a2` (merge de `main`) → `518b40e8` (lot pièces justificatives, 10/09) → `9deff38a` (lot 4 pages pro/public, 15/09) → `16922f73` (restriction d'accès + clean nav, 16/09) → `ae133e6a` (ressource enrichie + page `/programmes-dispositifs`, 16/09) → `c3f347aa` (merge de `main`, 17/09). Prérequis backend : `Organization::getById` porté sur `master` de `citizenToolKit` |
| Historique | **76 commits** touchant la config (`git log --follow`, 03/08) ; `070a3267` réécrit ~2 200 lignes du fichier, le merge de `main` ~1 100 de plus |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction de la config (19 pages), des 6 formulaires costum et du back-office ; travaux blog (fil, RSS, SEO, palette) partagés avec le moteur |
| 25/07 | Thomas | `b1104947` — « rezo-la-mer, SSBE, équipements sportifs : 41 constats levés » |
| 28/07 | Claude | Diagnostic complet, levée de 12 constats (cf. §9), création de ce dossier |
| 30/07 | Claude | `5ae354d2` — réseaux sociaux au patron `fieldArray` (3 formulaires SSBE + 1 cyber-reunion) ; `59a4b6ee` — retrait de `recepisseDeclaration`, disparu du costum (cf. §9) |
| 03/08 | Parc | Merge de `fix/institut-bleu-ui` (17 commits, `94251b7b`) dans `main` ; SDK **1.0.172 publiée** (`09e145a0`) — rien de spécifique SSBE, gates re-passés verts (cf. §9) |
| 02/09 → 08/09 | judi / Nicolas | Créneaux contributifs + modération (`bc99eecc`, `43a93695`), module ressources (`a469da78`), fusion MR 51 + MR 52 et modération des structures (`merge-mr51-mr52`) — cf. §9 |
| 09/09 | Claude | `070a3267` **feat(ssbe)** : refonte du formulaire d'ajout de structure aligné sur le dynForm legacy du costum ; `structure:tagsFromThematic` → miroir verbatim, clé **partagée Ekilib.re + SSBE** ; section « Actions rapides » sur `/espace-professionnels` ; consolidation MSS (champ `mss`, onglet admin dédié, retrait du form `sport-sante-bienetre-mss`) ; `statusActor`. Puis merge de `main` (`8bbe35a2`) — cf. §9 |
| 10/09 | Claude | `518b40e8` **feat(ssbe)** : récupération des **pièces justificatives** en édition et sur la fiche publique. Patch backend `Organization::getById` (joint `images` + `files` à la fiche, calqué sur `Poi::getById`, porté sur `master` de `citizenToolKit`) ; `subKey` = clé du champ posée à l'upload (le backend écrase le `contentKey` des `doctype:file` en bucket MIME) ; `seedGalleryDefaults` partitionné par `subKey` ; `PreviewStructure` en emplacements nommés (parité fiche legacy `ssbe/organizations/preview.php`) — cf. §9 |
| 15/09 | Claude | `9deff38a` **feat(ssbe)** : 4 pages config-only, contenu dérivé de captures d'écran fournies et de recherche web pour les liens officiels (Légifrance, Pôle Ressources National) — `/habilitation-mss`, `/faq`, `/faq-pro`, `/prescription` — + 4 entrées de nav. Ferme le lien mort `/prescription` (question 1, §13). Trois trouvailles en cours de route : une ancre morte (renommage manuel d'`id` de section, hors session), un bug de lisibilité sur `heroWithIcon` (texte toujours sombre sur fond image, contourné en `theme.customCSS` scopé), et un `<Link>` React Router **sans** `classifyHref` dans `HeroQuickAccess.tsx`/`CtaCardGrid.tsx` — signalé, **non corrigé** (composants partagés, changement hors périmètre de cette session) — cf. §9, §12 |
| 16/09 | Nicolas | `16922f73` « Restriction d'accès des pages et clean dans le menu » : `auth.required: true` posé sur 8 pages (`/espace-professionnels`, `/faq-pro`, `/prescription`, `/labellisation`, `/habilitation-mss`, `/formation`, `/listing-formations`, `/ressources`) ; 4 entrées de nav retirées (`/equipements-sportifs`, `/mapping`, `/listing-formations`, tout le dropdown « Communauté » — `/projets`/`/structure`/`/communaute`) et un CTA mort vers `/equipements-sportifs`. Les pages elles-mêmes restent déclarées (atteignables par URL directe), seule la nav et l'auth changent — cf. §9 |
| 16/09 | Claude | `ae133e6a` **feat(ssbe)** : formulaire `sport-sante-bienetre-ressource` — 2 nouvelles thématiques (`dispositifs`, `prescription`, posées par Nicolas juste avant la session), upload `documents` porté à 2 fichiers PDF, champ `profil_avatar` (widget `image`) affiché seulement pour « Dispositifs » via `visibleIf`. Nouvelle page `/programmes-dispositifs` (réservée aux connectés) : hero + recherche libre + cartes `resource` filtrées `thematique: dispositifs`, alimentées par `profil_avatar`. Entrée de nav sous Professionnels — cf. §9 |
| 17/09 | Parc | Merge de `main` dans `n-dev` (`c3f347aa`) — apporte notamment `chore(deps)` SDK **1.0.192** (`ac05a227`, `setSiteCostum`/`hasCostumContext`) et une grosse refonte de `parent62`. Rien de spécifique SSBE ; gates re-passés verts (cf. §9) |

---

## 2. Objectifs de la configuration

1. Servir **trois publics distincts** depuis une même base : grand public, professionnels, communauté.
2. Exposer les jeux de données du territoire : équipements sportifs, créneaux, structures, Maisons
   Sport-Santé, formations.
3. Permettre à une structure de **s'inscrire elle-même** et de faire labelliser son activité.
4. Donner au réseau un back-office autonome (6 types d'entités éditables).

---

## 3. Architecture générale

```
                 ┌───────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json)                    │
                 │   20 pages · 15 types de sections         │
                 │   header transparent-scroll · footer      │
                 │   contact-partners                        │
                 └──────────────┬────────────────────────────┘
                                │ searchCostum / coform
                 ┌──────────────▼────────────────────────────┐
                 │  Backend Cocolight — costum               │
                 │  sportSanteBienetre                       │
                 │  organizations · projects · events · poi  │
                 └───────────────────────────────────────────┘
```

**Deux voies de filtrage** coexistent dans le parc et se retrouvent ici : le HERO
(`searchHeader` avec `dropdownFilters`) et le PANNEAU (`gridLayout` + `filters`). SSBE emploie
massivement le premier — `searchHeader` est présent sur **15 des 20 pages**. ⚠ Depuis le 08/09,
`/creneaux` emploie **les deux** : un `searchHeader` réduit (titre et boutons, sans filtre) et un
panneau `filters` en colonne gauche — le montage du site frère, adopté à la fusion (§9).

---

## 4. Cahier des charges (dérivé de la config)

Aucun CDC formel n'a été versé au dépôt. Le périmètre se lit dans la config elle-même.

### 4.1 Les 25 pages

| Page | Rôle | Sections |
|---|---|---|
| `/` | Accueil | 5 |
| `/public` | Entrée grand public | 6 |
| `/espace-professionnels` | Entrée professionnels | 7 |
| `/communaute` | Membres + organisations (onglets) | 2 |
| `/presentation` | Le dispositif | 7 |
| `/labellisation` | Faire labelliser une activité (timeline) | 7 |
| `/habilitation-mss` | Procédure d'habilitation officielle MSS (15/09) | 10 |
| `/faq` · `/faq-pro` | FAQ grand public · FAQ professionnels (15/09) | 2 · 2 |
| `/prescription` | Aide à la prescription médicale (15/09) | 5 |
| `/programmes-dispositifs` | Cartes des dispositifs « Sport sur ordonnance » (16/09, réservée aux connectés) | 3 |
| `/structure` · `/mss` | Structures · Maisons Sport-Santé | 2 · 4 |
| `/creneaux` · `/equipements-sportifs` · `/mapping` | Jeux de données du territoire | 2 chacune |
| `/formation` · `/listing-formations` · `/projets` | Formation et projets | 3 · 2 · 2 |
| `/ressources` | Bibliothèque de documents pro (filtre thématique latéral) | 2 |
| `/blog` | Actualités (`articleFeed`) | 2 |
| `/contact` | Formulaire de contact | 3 |
| `/mentions-legales` · `/confidentialite` · `/accessibilite` | Socle légal | 1 chacune |

Le socle légal **existe** — c'est ce qui distingue nettement cette config de rezo-la-mer.

Les 4 pages du 15/09 sont **config-only** : aucune entité backend, aucun formulaire, aucune
donnée sondée — du contenu éditorial statique (`hero-quick-access`/`heroWithIcon`/`searchHeader`/
`accordion`/`categories-grid`/`cards` + quelques sections `html` pour les mises en page non
couvertes par le catalogue — cartes numérotées, bandeaux dégradés). Détail au §9.

⚠️ **Depuis le 16/09** (`16922f73`, §9), `/equipements-sportifs`, `/mapping`, `/listing-formations`,
`/projets`, `/structure` et `/communaute` restent déclarées ici (atteignables par URL directe) mais
**ne sont plus reliées à la nav** — Nicolas a élagué le dropdown « Communauté » et 3 entrées jugées
secondaires. La table ci-dessus liste les pages **de la config**, pas celles **du menu** ; se référer
au bloc `header.nav` pour l'état réel de la navigation.

### 4.2 Les 6 formulaires costum

Comptages re-dérivés de la config le **2026-09-09** (`fields{}` déclarés vs référencés dans
`sections[].fields[]` + `sections[].groups[].fields[]`) — **160 déclarés, 108 placés** ; `ressource`
actualisée le **16/09** (`profil_avatar` ajouté, §9) → **161 déclarés, 109 placés** :

| Formulaire | Entité | Champs déclarés | dont **placés** |
|---|---|---|---|
| `sport-sante-bienetre-organizations` | organizations | 49 | 38 |
| `sport-sante-bienetre-recovery-center` | poi | 35 | 28 |
| `sport-sante-bienetre-session-formation` | events | 29 | 14 |
| `sport-sante-bienetre-formation` | projects | 28 | 16 |
| `sport-sante-bienetre-article` | poi | 13 | 6 |
| `sport-sante-bienetre-ressource` | poi | 7 | 7 |

`sport-sante-bienetre-mss` a été **supprimé le 09/09** (`070a3267`, §9) : les Maisons Sport-Santé
sont désormais des structures avec un champ `mss` coché, éditées par le même formulaire.
`organizations` monte de 42/26 à **49/38** dans le même lot — refonte alignée sur le dynForm
legacy du costum (assistant 5 étapes, cascade juridique `statusFile`/`responsableCivilePro`/
`statusPrimaire`·`Secondaire`·`Communale`, champ `mss`, `statusActor`). Les autres formulaires
gonflent légèrement au merge du 08/09 (`geo`/`geoPosition` déclarés sur les 6 formulaires à widget
`location`, `payloadEmitEmptyOnEdit`).

> ⚠️ **L'écart « déclarés vs placés » n'est pas anodin.** Le moteur rend en parcourant
> `sections → groups → fields[]` ([`shared.tsx:47`](../src/modules/formEngine/layouts/shared.tsx),
> [`GenericForm.tsx:107`](../src/modules/formEngine/components/GenericForm.tsx)) : **un champ
> déclaré mais placé dans aucune section n'est jamais rendu.** Une partie de l'écart est
> légitime (sous-champs de widgets composites : `streetAddress`/`postalCode` sous `address`,
> `mobile` sous `telephone`) ; le reste est du vestige de conversion. 10 vestiges ont été
> supprimés le 28/07, puis `facebook`/`instagram` et `recepisseDeclaration` le 30/07 (cf. §9).
> Vestiges encore visibles au 03/08 sur `organizations` : `youtube`, `linkedin` (hors des neuf
> clés de l'ancien widget, jamais peuplés), `autreDescription`, `affiliate`/`affiliateTo`… —
> cf. §13, question 4.

### 4.3 Back-office (`config.admin`, 10 onglets)

`Tableau de bord` · `Membres` · `Organisations` (table « Structures ») · **`Maisons Sport Santé`**
(09/09 — clone de « Structures » filtré `mss: "true"`, `createDefaults: { mss: true }` — booléen, valeur de formulaire, corrigé le 24/09) ·
`Lieux & actualités` (2) · `Formations` (2) · `Import / Export` · `Référencement` ·
`Ressources` (02/09) · `Modération` (02/09).

Avant le 09/09, l'onglet Organisations empilait **deux** tables (Structures + Maisons Sport
Santé, chacune son formulaire). Depuis `070a3267`, une seule table par onglet ; le formulaire
MSS dédié est supprimé, les deux tables ouvrent `add-sport-sante-bienetre-organizations` et
portent le bloc `status` en `statusField` sur `statusActor`.

**Les formulaires costum n'étaient exposés QUE là.** Rien, côté public, n'ouvrait de formulaire
avant le 28/07. Depuis, `organizations` est ouvert par deux boutons publics et le formulaire de
créneau par l'`addButton` de `/creneaux`.

---

## 5. Modèle de données réel (re-sondé le 2026-08-03)

`config:probe` sur le costum `sportSanteBienetre` — **9 périmètres, 8 peuplés, 1 vide**
(entre parenthèses : la mesure du 28/07 — la base vit, les chiffres montent) :

| Page | Périmètre | Résultats |
|---|---|---|
| `/equipements-sportifs` | poi équipements | **3 061** (3 052) |
| `/creneaux` | créneaux | **300** (263) |
| `/structure` · `/mapping` | organisations du réseau | **180** (171) — les deux pages |
| `/mss` | Maisons Sport-Santé | 13 |
| `/formation` | formations | 4 |
| `/listing-formations` · `/projets` | offres · projets | 2 · 2 |
| `/communaute` → onglet « Organisations » | — | **0 ⛔** (inchangé) |

### Le périmètre vide

```jsonc
{ "notSourceKey": true,
  "defaultTypes": ["NGO","LocalBusiness","Group","GovernmentOrganization","Cooperative"],
  "defaultFilters": {
    "preferences.toBeValidated.sportSanteBienetre": { "$exists": false },
    "links.members.682b2ac5e05a1d45844340e7": { "$exists": true }   // ← id EN DUR
  } }
```

L'onglet filtre sur l'appartenance à une organisation dont **l'identifiant est codé en dur**.
Aucune organisation ne porte ce lien en base. Deux lectures possibles — id périmé, ou lien
jamais posé — **à trancher** (§13, question 5). L'onglet « Membres » voisin, lui, fonctionne.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.sport-sante-bien-etre.json`](../config.prod.sport-sante-bien-etre.json) |
| Thème | [`../src/index-sport-sante-bien-etre.css`](../src/index-sport-sante-bien-etre.css) |
| Déclaration | [`../sites.json`](../sites.json) → slug `sportSanteBienetre` |
| Boutons d'action | [`../src/types/action-button-schema.ts`](../src/types/action-button-schema.ts) · [`../src/modules/profil/components/ActionButtonGroup.tsx`](../src/modules/profil/components/ActionButtonGroup.tsx) |
| Modales d'ajout | [`../src/modules/profil/components/add/ModalRegistry.tsx`](../src/modules/profil/components/add/ModalRegistry.tsx) |
| **Créneaux — contribution & modération (02/09, `bc99eecc` + `43a93695`)** | config (section `/creneaux` : `addButton`, `preview.editButton`, `card.structureAction.audience` ; onglet admin `moderation`) · [`../src/modules/search/schema.ts`](../src/modules/search/schema.ts) (`structureAction.audience`, `kind` optionnel) · [`../src/modules/search/components/card/CardAnswer.tsx`](../src/modules/search/components/card/CardAnswer.tsx) (+ `CardAnswer.test.tsx`, `CardAnswer.ssr.test.tsx`) · [`../src/modules/search/lib/coformAnswer.ts`](../src/modules/search/lib/coformAnswer.ts) (`isCoformAnswerManager`, ex-`canEditCoformAnswer`) · [`../src/modules/admin/schema.ts`](../src/modules/admin/schema.ts) (`columns[].sortable`, + `schema.test.ts`) · [`../src/modules/admin/sections/AdminResourceTable.tsx`](../src/modules/admin/sections/AdminResourceTable.tsx) · docs [07](../doc/07-module-search.md) et [30](../doc/30-module-admin.md) |
| Rendu des formulaires | [`../src/modules/formEngine/layouts/shared.tsx`](../src/modules/formEngine/layouts/shared.tsx) · [`../src/modules/formEngine/components/GenericForm.tsx`](../src/modules/formEngine/components/GenericForm.tsx) |
| **Pièces justificatives — structure (10/09, `518b40e8`)** | backend `citizenToolKit/models/Organization.php` (`getById` → jointure `images` + `files`, sur `master`) · [`../src/modules/profil/hooks/useEntityMutation.tsx`](../src/modules/profil/hooks/useEntityMutation.tsx) (`processGalleryFields` → `subKey`) · [`../src/modules/profil/forms/resolveModalSpec.ts`](../src/modules/profil/forms/resolveModalSpec.ts) (`seedGalleryDefaults` partitionné) + [`../src/modules/profil/forms/structure.configDriven.test.ts`](../src/modules/profil/forms/structure.configDriven.test.ts) (tests 16-17) · [`../src/modules/search/components/preview/PreviewStructure.tsx`](../src/modules/search/components/preview/PreviewStructure.tsx) (emplacements nommés par `subKey`) · [`../src/modules/search/constants/queryKeys.ts`](../src/modules/search/constants/queryKeys.ts) (retrait de `DOCUMENTS`) · `../src/modules/search/i18n/{fr,en}.json` |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Pas de `header.ctaButton` — le widget `utilities.auth` porte la connexion | Le CTA en était un doublon **et** pointait vers une page inexistante. Même patron qu'institut-bleu, qui n'en déclare aucun |
| « Inscrire ma structure » ouvre une **modale**, pas une page | Le formulaire existe déjà (`costumForms`) ; `ActionButtonSchema` accepte `modal`, rendu par `ActionButtonGroup:278`. Aucune page à créer, et le chemin bénéficie du garde d'authentification |
| Les champs morts sont **supprimés**, pas traduits | Traduire un champ jamais rendu serait figer du vestige — et, ici, une faute de frappe |
| `searchHeader` plutôt que le panneau `filters` | Cohérence : 14 pages sur 19 l'emploient déjà. Mélanger les deux voies produit des doublons de champ de recherche (piège rencontré sur cyber-reunion puis institut-bleu) |

---

## 8. Étapes de mise en place

```bash
# dev — un serveur par site, ports distincts
PORT=5243 VITE_SLUG=sportSanteBienetre \
  SITE_CONFIG_PATH=config.prod.sport-sante-bien-etre.json \
  SITE_CSS_PATH=src/index-sport-sante-bien-etre.css \
  node server/dev-server.js

# gates
npm run config:validate -- config.prod.sport-sante-bien-etre.json
npm run audit:config    -- --file config.prod.sport-sante-bien-etre.json
npx tsx scripts/config-probe.ts config.prod.sport-sante-bien-etre.json
npm run typecheck && npm run lint && npm run test:unit
```

### Variables d'environnement de déploiement

Depuis le merge de `fix/institut-bleu-ui` (03/08), le déploiement pose **`VITE_SITE_PUBLIC_URL`** :
l'URL publique du site-json lui-même (canonical, `og:url`/`og:image`, `sitemap.xml`, flux RSS),
lue par `getSitePublicUrl()` ([`../src/lib/constant/common.ts`](../src/lib/constant/common.ts)) et
`server/lib/sitemap.js`. `npm run deploy:env` la dérive de `sites.json` (`aliases[0]` prioritaire,
sinon `domain`) — pour SSBE, pas d'`aliases`, `domain: ssbe.00.re` → **`https://ssbe.00.re`**.
Repli `getServerUrl()` si absente (comportement historique). **Ne pas confondre** avec
`VITE_SERVER_URL` (= serveur communecter : images `/upload`, embed co2, cagnotte), qui garde sa
valeur parc.

---

## 9. Impacts des modifications

### Lot du 28/07 — 16 constats d'audit → 4

**1. Le bouton de connexion ne connectait pas.** `header.ctaButton` portait « Se connecter » vers
`/activites`, page inexistante, alors que `utilities.auth` était **déjà à `true`**. Doublon **et**
lien mort. Retiré.

**2. « Inscrire ma structure » n'ouvrait rien.** Le bouton du `searchHeader` de `/communaute`
pointait vers `/inscrire-organisation`, page jamais créée. Le formulaire, lui, existait depuis le
début dans `costumForms` — exposé uniquement dans `/admin`. Remplacé par
`modal: "add-sport-sante-bienetre-organizations"`.

> Effet de bord favorable : ce chemin passe par `DynamicModalButton`, donc par le garde
> d'authentification ajouté le 28/07 (`f24a6531`). Un visiteur non connecté reçoit une invitation à
> se connecter au lieu d'un formulaire qui échouerait à l'envoi.

**3. Dix champs morts supprimés.** L'audit les signalait comme « traduction `en` manquante ». Le
diagnostic a montré autre chose : ces champs ne sont **placés dans aucune section**, chaque clé
n'apparaît **qu'une fois** dans tout le formulaire (sa propre définition), et le moteur ne rend que
ce qui est placé. Ils n'étaient donc ni affichés, ni sérialisés.

Leurs libellés étaient des noms techniques jamais rédigés — « Status file », « Status primaire »,
« Responsable civile pro » — et **« Sextion info »**, faute de frappe pour « Section », répétée
5 fois sur deux formulaires. Invisible en pratique, mais du code mort à retirer plutôt qu'à traduire.

| Formulaire | Champs supprimés |
|---|---|
| `…-organizations` | `sextionInfo`, `sextionInfoRepresentant`, `sextionInfoResponsable`, `statusFile`, `statusPrimaire`, `statusSecondaire`, `statusCommunale`, `responsableCivilePro` |
| `…-mss` | `sextionInfoRepresentant`, `sextionInfoResponsable` |

Chaque retrait a été précédé d'une assertion vérifiant que le champ n'était placé dans aucune section.

### Gates au 28/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 19 pages / 61 sections |
| `audit:config` | 🟡 **4 constats** (4 liens morts — décisions en attente, §13) |
| `config:probe` | 🟡 9 périmètres — **8 OK, 1 vide** (§5) |
| `test:preflight` | ✅ 274 tests |
| `typecheck` · `lint` | ✅ propre · 0 erreur |

### Lot du 30/07 — hygiène des formulaires costum (2 commits)

**1. Les réseaux sociaux passent au patron `fieldArray`** (`5ae354d2`). Trois formulaires SSBE
(`organizations`, `mss`, `formation`) — plus `cyber-reunion-organization` — déclaraient
`socialNetwork` avec le widget `editSocial`. C'est l'ancre du **profil citoyen** : ses neuf saisies
écrivent sous `github`/`facebook`/`instagram`/… et jamais sous `socialNetwork` ; aucune de ces neuf
clés n'étant déclarée dans les descripteurs, **l'utilisateur saisissait dans neuf champs reliés à
rien**. Exception déroutante : `organizations` déclarait `facebook` et `instagram` (non placés) —
deux réseaux sur neuf s'enregistraient par pure coïncidence de nommage. Patron adopté : celui de
`tiers-lieux`, lu depuis sa config — `fieldArray` + `social:read`/`social:write` +
`path: socialNetwork` ; le champ d'UI se nomme `socialLinks`, la clé serveur reste `socialNetwork`.
`facebook`/`instagram` sont retirés (le `fieldArray` les couvre, même destination serveur).

> ⚠️ Piège consigné dans le commit : les sections existent sous **deux formes**
> (`sections[].fields[]` ET `sections[].groups[].fields[]`) — un renommage qui ne traite que l'une
> laisse des références orphelines **qu'aucun gate ne détecte** (ni `config:validate`, ni le
> préflight). Vérifié ici par un audit des 266 références de champ de toutes les configs.

**2. `recepisseDeclaration` retiré** (`59a4b6ee`). Le champ était déclaré dans
`…-organizations` alors que le costum ne le déclare **plus** (disparu de la base entre le 27 et le
30/07, révélé par la régénération de l'artefact costum), et **aucun document** ne le porte dans
aucune collection. Son groupe (`juridique.groups[1]`), qui ne contenait que lui, est supprimé aussi.
Critère de recette : `config:costum-drift` à **0 fantôme** sur SSBE. Réserve du commit : si le
retrait côté costum était accidentel, la bonne correction serait de le remettre **en base**.

Gates du lot (30/07) : config:validate ✅, préflight 337/337 ✅, typecheck ✅, `config:costum-drift`
0 fantôme SSBE ✅.

### État au 03/08 (après merge de `fix/institut-bleu-ui` dans `main` + SDK 1.0.172)

Aucun commit spécifique SSBE dans le merge ; gates re-passés ce jour :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 19 pages / 61 sections |
| `audit:config` | 🟡 **4 constats** (les 4 mêmes liens morts, §13) |
| `config:probe` | 🟡 9 périmètres — **8 OK, 1 vide** (§5, re-sondé) |
| `config:costum-drift` | ✅ **0 fantôme SSBE** (12 « non exposés » informatifs : 10 sur `organizations`, 2 sur `mss` — champs du costum backend volontairement non exposés en config) |
| `test:preflight` | ✅ 412 tests / 22 fichiers |
| `typecheck` | ✅ (`tsc -b`) |

### Lot du 02/09 — les créneaux deviennent contributifs et modérables (branche `judi-ssbe`)

> Commits : `bc99eecc` (carte de créneau) · `43a93695` (modération admin).

**Alignement sur Ekilib.re, sauf là où la donnée dit le contraire.** Le site frère
[Maison Sport Santé du Tampon](maison-sport-sante-la-tampon.md) portait déjà les boutons de
contribution et l'onglet de modération — **le gate `audience` (point 2) est neuf, et Ekilib.re
ne l'a pas encore**. Le reste est transposé sur le form SSBE `6928096adf5caf0d230e7f26` (section
`sportSanteBienetre2172025_854_0`). Fait vérifié en base : la duplication de formulaire **préserve
les ids d'inputs**, donc les 5 suffixes utilisés par la config sont identiques sur les deux sites —
la transposition est mécanique, seul le préfixe de section change.

**1. Ajouter et modifier un créneau depuis `/creneaux`** — `addButton` (avec `adminOnly: false` :
la contribution est publique, un visiteur non connecté est envoyé au login) et
`preview.editButton: true` (bouton « Modifier » dans le détail, réservé aux gestionnaires).

**2. Le bouton « Fiche structure » réservé aux gestionnaires** — nouvelle clé
`card.structureAction.audience` (`"all"` par défaut, donc **parc inchangé** ; `"managers"` sur SSBE).
Il était jusqu'ici visible par **tout le monde**, alors que la fiche structure est un outil de
gestion (affiliation, représentant légal, documents) sans intérêt pour qui compare des créneaux.
Le gate réutilise le prédicat du bouton « Modifier », **renommé** `canEditCoformAnswer` →
`isCoformAnswerManager` : il gouverne désormais une écriture **et** un affichage, et sous l'ancien
nom un futur resserrement du droit d'édition aurait resserré la fiche en silence.
⚠️ **Pertinence d'affichage, pas une frontière de sécurité** : `/profil/:slug` et `/structure`
restent des routes publiques, et l'e-mail de la structure est de toute façon affiché sur la carte.

**Le piège traité : l'hydratation.** `/creneaux` est prérendue côté serveur, où `me` vaut toujours
`null`, alors que le 1er render client d'un gestionnaire a déjà son `me`. Sans garde, HTML serveur ≠
1er render client → mismatch. Le gate passe donc par `useHydrated` : bouton absent des deux, puis
affiché après hydratation chez les seuls ayants droit. Épinglé par `CardAnswer.ssr.test.tsx`, qui
rend en SSR avec le **vrai** hook (le test de câblage, lui, le mocke — il ne prouverait rien ici).

**3. Onglet admin « Modération »** (`siteAdmin`, en dernier, sans icône : conforme aux 7 onglets
existants) — table `resource` en mode `statusField` sur les answers du form. États **verbatim de la
base** : `En attente` · `En cours` · `Validé` · `Réfusé` (la faute est la valeur stockée, lue par le
filtre serveur et écrite par `updatepathvalue` ; seul l'affichage la corrige en « Refusé »).
Volumétrie mesurée le 02/09 : **57 en attente**, 225 validés, 3 sans statut — l'onglet a un vrai
backlog. Effet de bord souhaitable : le tableau de bord admin dérive automatiquement une tuile de
comptage par section `resource` visible.

**Deux écarts assumés vs Ekilib.re, tranchés sur la donnée mesurée :**

| Écart | Pourquoi |
|---|---|
| `notSourceKey: true` au lieu de `sourceKey: ["sportSanteBienetre"]` | Sur les 285 réponses du form, **une** porte `source.keys: associationEkilibre` (import mal étiqueté). Avec `sourceKey` elle resterait **publiée sur `/creneaux` sans être modérable** : le périmètre modéré doit égaler le périmètre publié. Le champ reste borné par `defaultFilters.form`, donc rien d'indésirable n'entre |
| `columns[].sortable` (nouveau, défaut `true`) posé à `false` sur 4 colonnes | Chaque en-tête est un tri **serveur** qui écrase `defaultSortBy`. Or `name`, `structure.name`, le Type à plat et `address.postalCode` n'existent dans **aucun** document : ils sont fabriqués par le hook costum PHP **après** la requête Mongo. Trier dessus ordonnait au hasard — à l'identique en asc et desc — tout en perdant l'ordre par défaut, et déstabilisait le skip/limit du scroll infini. Seul « Déclaré le » (vrai champ Mongo) reste triable. **Ekilib.re porte le même défaut en production** : un `sortable: false` l'y corrigerait aussi |

**Gates du lot (02/09)** : `config:validate` ✅ 19 pages / 61 sections · `audit:config` 🟡 **4
constats, les 4 mêmes qu'au 03/08** (liens morts §13, inchangés) et `strip: 0` · `test:preflight`
✅ 532 · unitaires admin ✅ 128 · `tsc -b` ✅ · lint ✅ 0 erreur · snapshot
`tests/preflight/__effective__/sport-sante-bien-etre.json` régénéré (diff limité à la seule entrée
`moderation/answers`).

⚠️ **Deux gates n'ont PAS pu tourner** : `config:render` et `config:probe` — le backend local
`communecter74-dev` a cessé de répondre en fin de session (HTTP 000, `timeout of 30000ms exceeded`
à la résolution du slug). Cause probable : une sonde `globalautocomplete` en `fieldShow=allFields`
sur les 285 réponses, qui a vraisemblablement saturé PHP-FPM. **À rejouer** une fois le backend
relancé, avec la recette navigateur (§10, ligne 16).

### Lot du 02/09 (2) — documents ressources dans le back-office

> Commits : `a469da78` (site) · `21c961a0` (description en markdown) · dépôt costum
> `bf66a550f` (déclaration en base). Lot posé APRÈS le merge de `main` dans `judi-ssbe`
> (`1cc73861`), qui apporte le module ressources d'Ekilib.re **et son correctif** `76a47a8d`.

Transposition du module ressources d'[Ekilib.re](maison-sport-sante-la-tampon.md), **0 code
front** : `formEngine` (widgets `file`/`urlList`/`select`) et la table admin en mode
`statusField` sont réutilisés tels quels. Une ressource = un **POI** scopé
`source.keys: sportSanteBienetre`, avec `thematique` et `status` (Visible / **Brouillon** par
défaut — pas de publication accidentelle). Trois morceaux de config :
`costumForms["sport-sante-bienetre-ressource"]` · onglet admin **« Ressources »** (`siteAdmin` :
listing, création, édition, suppression) · route `edit-sport-sante-bienetre-ressource` dans
`profiles.poi.editModals`, **bornée au costum** (`sourceKeys contains sportSanteBienetre` —
le snapshot effectif le prouve : un POI étranger retombe sur `edit-profile`).

**Le sous-type est DÉDIÉ, et c'est le point qui distingue SSBE d'Ekilib.re.** Ekilib.re porte ses
ressources sur `recoveryCenter` ; ici ce sous-type est **déjà pris** par « Équipements Sportifs »
(déclaré dans `costum.typeObj`, avec son onglet admin « lieux » et son propre formulaire d'ajout).
Les y mêler aurait pollué les deux listings. D'où un sous-type **`ressource`**, déclaré à part.

**Thématiques** (7 valeurs fournies par le porteur) : `mss` · `rapports` · `has` · `guides` ·
`outils` · `communication` · `financements`. Le champ stocke la **clé**, pas le libellé : le site
est bilingue fr/en, un libellé français en base rendrait la version anglaise fausse et imposerait
une migration de données à chaque retouche de formulation. ⚠️ **Conséquence assumée** : la colonne
« Thématique » du listing admin affiche la clé brute (`formatCell` ne résout aucune énumération) ;
si l'affichage du libellé est souhaité, c'est une évolution du schéma des colonnes admin (§13).
Le nom de champ évite `thematic`, déjà une taxonomie du costum SSBE (Sport, Santé/prévention…).

⚠️ **Prérequis dur, à rejouer en PROD** : `costum.typeObj.ressource` doit être déclaré en base,
sinon le SDK écarte `thematique`/`status` **en silence** à la création et les rejette à l'édition
(`[DraftProxy] Le champ … n'est pas autorisé`). Action URL dédiée :
`http://<host>/costum/ssbeMigration/declareRessourceType` (dry run) puis `/apply/1`.

**Deux enseignements repris du correctif `76a47a8d` du site frère**, arrivé par le merge :
`description` est en **`markdown`** et non `textarea` (le presenter `resource` rend ce champ en
markdown — sinon l'auteur saisit du texte brut pendant que le lecteur voit du markdown interprété) ;
et la garde `costum-form-contract` **ignore silencieusement** tout champ absent du contrat live
(`tests/preflight/__contract__/costum-types.live.json`, ligne 113 : « champ CŒUR »). `thematique`
n'y est donc pas encore audité — il le sera **une fois `declareRessourceType` joué**, ce qui
imposera de **régénérer cette fixture**, exactement comme `76a47a8d` l'a fait pour Ekilib.re.

**Page publique `/ressources`** (commits `3deeb89f` · `425cfa7e`) — livrée dans la foulée, sur le
patron de `/creneaux` d'Ekilib.re : `searchHeader` (**recherche par nom**) + `gridLayout` 1/3 dont
le `leftSection` est une section **`filters`** (filtre **latéral** à cases, thématique, ouvert par
défaut) et le `rightSection` la liste en presenter `resource`. Seuls les documents **publiés**
(`status: "Visible"`) y paraissent — les brouillons restent au back-office. Chaque thématique porte
sa couleur (5 tokens `chart*` + `primary`/`accent`, **aucune couleur en dur**) et son icône lucide.
**Elle ferme un lien mort** : la tuile « Rapports & Publications » de `/espace-professionnels`
pointait vers `/ressources` — l'audit passe de **4 à 3** constats (§13, question 1). Elle est aussi
dans la nav (`a6584b0e`) : entrée **« Ressources »** du dropdown **Professionnels**, en 2ᵉ position —
après le hub, avant les entrées d'action (Labelliser, Formation), parce que c'est une bibliothèque
et non une démarche. Icône `book-open`, la même que le formulaire et l'onglet d'administration.

**Un manque du moteur, comblé** (`425cfa7e`, générique) : le presenter `resource` mappait déjà
valeur→couleur et valeur→icône mais affichait la valeur **stockée** telle quelle — une pastille
« mss » ou « has » en public. `badge.labels` (map valeur → `LocalizedString`) est la troisième
carte ; `ResourceData.badge` dissocie désormais `value` (affiché) et `raw` (stocké, qui indexe les
styles et les filtres). Absente, la map laisse le comportement du parc strictement inchangé.
C'est ce qui rend tenable le choix de stocker la clé sur un site bilingue.

**Gates (02/09, backend revenu)** : `config:validate` ✅ 19 pages / 61 sections ⚠ *chiffre erroné au relevé : ce lot ajoutait `/ressources`, le compte réel après lui est 20 / 63 — la sortie a vraisemblablement été recopiée d'avant le lot* · `audit:config`
🟡 4 constats préexistants, `strip: 0` · `test:preflight` ✅ **553** · `tsc -b` ✅ · lint ✅
0 erreur · snapshot régénéré (2 ajouts : la route d'édition et `ressources/poi`) ·
**`config:render` ✅ 19/19 pages, 61/61 sections** *(même réserve)* · **`config:probe` 10 périmètres — 7 OK,
3 vides** : pages 4 et 11, **antérieurs à ce lot** (la doc en notait 1 au 03/08, un second a dérivé
depuis), plus `/ressources` — vide tant qu'aucun document n'est saisi, ce qui est l'état attendu. `/creneaux` remonte bien ses **285** réponses, ce qui valide au passage le `notSourceKey`
du lot précédent.

---

### Lot du 07→08/09 — analyse croisée avec le site frère, fusion MR 51 + MR 52

> Branche `merge-mr51-mr52`, **non poussée**. Commits `e14ef18e` · `a5a29e41` · `b3579bec` ·
> `3ad39655` (fusion) · `9a261d64`.

**Ce que l'analyse a renversé.** L'historique git montre qu'Ekilib.re a **copié** la page
`/creneaux` de SSBE en août, puis l'a corrigée en huit commits (20→23/08) — dont `8a1f2fbe`
(`searchBy`) et `5f8cfae4` (montage `gridLayout`). SSBE lui a ensuite emprunté la contribution et
la modération le 02/09, **sans aucune de ces corrections**. La relation n'est pas une dérivation à
sens unique : c'est une **dette de rétro-portage**.

**Onze correctifs, chacun mesuré avant/après contre le backend** :

| Correctif | Effet mesuré |
|---|---|
| `/creneaux` — filtre d'état « Validé » + `searchBy` sur 3 chemins d'answers | 224 avant / 224 après : durcissement, le hook PHP forçait déjà l'état pour les non-admins |
| `/mapping` aligné sur `/structure` (`$or` à 3 branches, `notSourceKey` retiré) | 138 / 138 — équivalence prouvée, la garde de validation se réarme |
| `/projets` — `defaultFilters` supprimé en entier | mêmes 2 projets, mêmes ObjectID ; l'id d'organisation en dur disparaît |
| `geo`/`geoPosition` déclarés sur les 6 formulaires à widget `location` | les coordonnées atteignent enfin le payload |
| `navigateOnSuccess: false` sur les **3** formulaires admin-only | plus d'éjection hors de `/admin` |
| `payloadEmitEmptyOnEdit: true` sur 6 formulaires | effacer un champ en édition l'efface réellement |
| `"validate"` dans `rowActions` de l'onglet Ressources | le menu « Marquer » s'arme, une ressource devient publiable |
| `var(--chart1)` → `var(--chart-1)` ×5 | 5 pastilles de `/ressources` retrouvent leur couleur |
| `searchBy: ["name","description"]` sur `/ressources` | comme le site frère |
| Onglet Référencement configuré (`openData: "optOut"`, `moderateReferenced`) | le vivier cesse d'être vide |
| Filtres de `/creneaux` — listes redressées sur la donnée | bénéficiaires 6→9 options, codes postaux 25→30 |

**`scope` volontairement NON posé.** La proposition initiale — poser `scope` sur 6 formulaires —
était fausse : cette clé choisit la branche de portée à la création, pas le retour admin. La poser
aurait **cassé la création** de `article`, `recovery-center` et `session-formation`, qui perdraient
`parent`/`organizer` — un test le fige (`actualite.configDriven.test.ts:63-68`).

**Fusion MR 51 + MR 52.** Les deux branches avaient divergé le 04/09 et retravaillé `/creneaux` en
parallèle. Un seul fichier en conflit. **Le montage de MR 52 l'emporte** — `gridLayout` + panneau
`filters` — contre l'avis initial de l'analyse, pour trois raisons : c'est le patron d'Ekilib.re et
des gros annuaires du parc ; SSBE l'emploie **déjà** sur `/ressources` depuis MR 51, ce qui périme
l'argument de cohérence du §7 ; et il corrige *par construction* le bug `multiple: false` — un
`filterGroups` sans clé `select` rend un accordéon à cases à cocher, multi-sélection native.
Convergence notable : la tuile « Activités validées » de MR 52 emploie **le même champ de statut**
que le filtre posé par MR 51 — deux découvertes indépendantes de la même clé.

**Modération des structures — le trépied `statusActor`** (`9a261d64`), transposé d'Ekilib.re. Fait
décisif mesuré : **le champ était déjà rempli en base** — 105 « Validé », 31 « En attente », 1 « En
cours », 1 absent sur 138 organisations. Il n'y avait rien à rétro-remplir ; le lot rend effectif un
tri qui existait déjà et que l'annuaire ignorait.

| Pièce | Où |
|---|---|
| Semis | `organizations` → `"En cours"` (ouvert au public) · `mss` → `"Validé"` (admin seul : l'administrateur qui crée EST la validation) |
| Garde publique | `/structure` 138→105 · `/mapping` 138→105 · `/mss` 13→12 · compteur d'accueil 138→105 |
| Promotion | bloc `status` en `statusField` sur les tables Structures et Maisons Sport Santé |
| Palette ⌘K | `params.filters` en **`$nin`** et non en égalité |

⚠ **Pourquoi `$nin` sur la palette.** Elle interroge `organizations`, `projects` et `poi` en **une
seule requête**, avec **un seul** bloc `filters`. Or `statusActor` n'existe que sur les
organisations, et une égalité Mongo exige que le champ existe. Mesuré sur le chemin réel de la
palette : `{"statusActor": "Validé"}` ramène les projets de 2 à **0** et les POI de 63 à **0**. Le
`$nin` laisse passer les documents sans le champ et exclut les organisations non validées —
vérifié nommément, « PROMOTION SANTÉ LA RÉUNION » et « AQUA LÉ LA » passent de 1 à 0 résultat.

⚠ **Une fiche à valider dès la mise en ligne** : « Maison Sport-Santé de Saint-Louis » n'a **aucun**
`statusActor` — champ absent, pas statut refusé — et disparaît donc de `/mss`, `/structure` et
`/mapping`. Un clic dans l'onglet Organisations, qui vient de gagner le menu « Marquer ».

**Le défaut de fond des bénéficiaires, non résolu.** Le filtre le plus attendu de `/creneaux` ne
répond que sur une fraction du catalogue, et redresser les options n'y change presque rien :
**232 réponses stockent les cases cochées en une seule chaîne collée** —
`["Adultes (18-55 ans), Personnes de plus de 55 ans"]` — qu'un `$in`, égalité exacte, ne peut pas
matcher. Vérifié en lisant Mongo : type BSON `array`, un élément, virgules à l'intérieur. Les 232
datent **toutes du 2026-08-11**, un import en masse ; les réponses créées depuis via le formulaire
sont correctes, ici comme chez le frère. Un script de normalisation existe —
[`../tools/ssbe-creneaux/normalize-beneficiaires.mjs`](../tools/ssbe-creneaux/normalize-beneficiaires.mjs),
dry-run vert, 8 contrôles bloquants, rollback par document, relu de façon adversariale — **non
exécuté** : il attend l'arbitrage de vocabulaire (§13).

**Gates (08/09)** : `config:validate` ✅ **20 pages / 63 sections** · Ekilib.re ✅ 13/49 ·
`audit:config` 🟡 3 constats (liens morts §13) · `tsc -b` ✅ · `test:preflight` ✅ 567 ·
unitaires ✅ **1 994** · `config:probe` **14 périmètres** — 12 OK, 2 vides (préexistants).

---

### Lot du 09/09 — le formulaire d'ajout de structure aligné sur le dynForm legacy, MSS consolidé

> Branche `n-dev`. Commit `070a3267` (config + `structure/fns.ts` + son test + `costum-form-drift.ts`
> + snapshot), puis merge de `main` (`8bbe35a2`).

**Point de départ.** `costumForms["sport-sante-bienetre-organizations"]` était une version allégée
du formulaire `structure` d'[Ekilib.re](maison-sport-sante-la-tampon.md). Le porteur a fourni le
**dynForm legacy** du costum (`typeObj.organizations.dynFormCostum`) et des fiches réelles créées
avant/après : la comparaison a servi d'oracle à chaque écart.

**1. Refonte à parité avec le dynForm legacy.** Assistant 5 étapes (identité / coordonnées / forme
juridique / représentant / personne chargée du dossier), cascade `visibleIf` sur `legalStatus`
(`statusFile`, `responsableCivilePro` en widget `file` ; `statusPrimaire`·`Secondaire`·`Communale`
en `select` — la liste `statusCommunale` reçoit les **36 communes** fournies), `validateFn:
"validate:addressComplete"`, `scope` sportSanteBienetre, `identity: {type: "Cooperative"}`, chrome
complet. `openingHours` retiré (absent du legacy).

**2. Stockage aligné sur les fiches legacy** (chaque point vérifié contre une fiche DB réelle) :

| Champ | Avant (n-dev allégé) | Après (= legacy) |
|---|---|---|
| Téléphone | `telephone: { mobile: ["…"] }` (serializeGroup) | `mobile: "…"` — champ plat, widget `tel` |
| `affiliate`, `mss` | `select` → `"Oui"`/`"Non"` | `switch` + `write: "coerce:boolString"` → `"true"`/`"false"` |
| `representativeTitle`, `personInChargeTitle` | widget `tags` → **array** | widget **`valueSelect` mono** (`multiple: false`, `creatable: true`, `read: "coerce:string"`) → **chaîne** : choisir dans les 5 titres OU saisir librement |
| `statusActor` | absent | `"En cours"` à la création (`inject.extraFields`, comme Ekilib.re) — modifiable ensuite depuis le panel (bloc `status` `statusField`) |

Le porteur a ajouté `statusActor`, `mss` et `statusPrimaire` au **schéma d'écriture du costum
en base** pendant la session (le costum d'Ekilib.re les porte déjà) — le canal `inject.extraFields`
suffit donc, pas de contournement `pathValue`.

**3. `tags` ⇐ `thematic` : miroir verbatim, clé PARTAGÉE.** `structure:tagsFromThematic`
(`src/modules/profil/forms/costum/structure/fns.ts`) recopiait `thematic` dans `tags` en
**raccourcissant** les libellés (« Scolaire 1er degré - Maternelle et primaire » →
« Scolaire 1er degré »). Les fiches réelles montrent `thematic == tags` **à l'identique**. La clé
devient un miroir verbatim (dédup, ordre préservé) ; plus de préservation de tag « étranger »
puisque le seul marqueur qui vivait dans `tags` — `mss` — est maintenant un champ. **La clé sert
les DEUX formulaires `structure` du parc** (Ekilib.re + SSBE) ; l'oracle de
`structure.configDriven.test.ts` est mis à jour (tags attendus en long). Acté avec le porteur :
le filtre `/structure` d'Ekilib.re (valeurs courtes) et ses ~14 fiches ne sont pas un blocage,
`/mapping` SSBE va disparaître.

**4. Consolidation MSS.** `sport-sante-bienetre-mss` (costumForm + route `editModals`
`edit-sport-sante-bienetre-mss`) **supprimé**. Une Maison Sport-Santé = une structure avec `mss`
coché. Admin : l'onglet Organisations ne porte plus que « Structures » ; un nouvel onglet
**`maisons-sport-sante`** est un clone filtré `mss: "true"` + `createDefaults: { mss: "true" }` (⚠ corrigé le 24/09 en `mss: true` : la chaîne bloquait la création, cf. `doc/30`),
avec le même bloc `status`/`statusActor` — « même data et même modération que les structures »
(demande du porteur). `type` passe de `NGO` à `Cooperative` : les listes publiques et l'admin
l'acceptent déjà (`defaultTypes`), l'onglet Référencement excepté.

**5. Section « Actions rapides »** sur `/espace-professionnels`, juste sous le bandeau :
`searchHeader` (titre + sous-titre rouge) + 2 boutons `requiresAdmin: false` — « Étape 1 – Ajouter
sa structure » (`modal: "add-sport-sante-bienetre-organizations"`, Dialog) et « Étape 2 – Ajouter
son créneau » (`href: "/coform/6928096adf5caf0d230e7f26"`, page). ⚠ Un bouton `searchHeader` ne
peut **pas** ouvrir un `CoFormModal` (réservé à l'`addButton` de `searchProStatic`) → le créneau
est une navigation, pas une modale.

**6. Merge de `main` (`8bbe35a2`).** `main` apporte le module **AAC** (appels à communs),
**federation-des-cae**, et du travail SSBE **parallèle** : il gardait le modèle MSS séparé
(`type: NGO`, `tags: ["mss"]`) et sa propre page `/ressources` + costumForm
`sport-sante-bienetre-ressource`. **7 zones de conflit** dans la config, toutes sur la divergence
de modèle MSS. Résolution : **modèle `n-dev` (unifié) retenu** ; les ajouts additifs de `main`
(`/ressources`, `sport-sante-bienetre-ressource`, onglet `moderation`, expansions de filtres)
conservés. Une incohérence corrigée à la relecture : le snapshot
`tests/preflight/__effective__/sport-sante-bien-etre.json` portait encore `tags: ["mss"]` côté
`main` alors que la config résolue est `mss: "true"` → régénéré.

**Gates (09/09)** : `config:validate` ✅ **20 pages / 64 sections** · `audit:config` 🟡 3 liens
morts (§13, inchangés), `strip: 0` · `config:costum-drift` SSBE — 4 formulaires ✅, `-organizations`
et `-ressource` **sans fantôme** (`mss` inscrit dans `ASSUMES` de `costum-form-drift.ts`, motif :
exposé via `describeCostumForms` mais pas via le chemin `api.organization` de la garde ;
8 « non exposés » informatifs) · `tsc -b` ✅ (arbre mergé complet : module AAC, cagnotte, coform) ·
`test:preflight` ✅ **633** (2 échecs **préexistants hors périmètre** : `bundle-size` — bundle JS
> 2 Mo, la config n'y entre pas ; `site-assets` — dossier `public/images/associationEkilibre` non
déclaré) · unitaires ciblés (profil + formEngine + admin + préflight costum) ✅ **749** ·
`config:probe` / `config:render` **non joués** ce lot.

---

### Lot du 10/09 — récupération des pièces justificatives (modale d'édition + fiche publique)

> Branche `n-dev`, commit `518b40e8` (site-json). Backend : `citizenToolKit/models/Organization.php`
> porté sur `master`.

**Constat.** En édition d'une structure, les champs `file` (« Statuts », « Responsabilité civile
pro ») ne re-pré-remplissaient jamais les documents déjà déposés, et la fiche publique les listait
en vrac (l'image de profil comprise). Deux causes distinctes.

**1. `about.files` absent pour les `organizations`.** `element/about` (SDK `get()`) charge la fiche
via `Element::getByTypeAndId` → `Organization::getById`, qui — contrairement à `Poi::getById`,
`Classified::getById`, `Project::getById` — ne joignait ni `images` ni `files`. Correctif calqué
sur `Poi::getById` : `$organization["images"]` (galerie, `contentKey ≠ mdImage`) + `$organization["files"]`
(`Document::getListDocumentsWhere([… "doctype" => "file"], "file")`). Aucun impact SDK (endpoint
`GET_ELEMENTS_ABOUT` sans schéma `responses`, `additionalProperties: true`) ni site-json.

**2. `contentKey` des fichiers écrasé à l'écriture.** `Document::save` remplace le `contentKey` de
tout `doctype:file` par un bucket MIME (`pdf`/`spreadsheet`/`text`/`presentation`, via
`getFileContentKey`) — la clé du champ (`statusFile`, `responsableCivilePro`) est perdue. `subKey`,
lui, est conservé verbatim. On y route donc l'identité du champ :

- `processGalleryFields` (`useEntityMutation`) pose `subKey = contentKey` du champ à l'upload des
  `doctype:file` (images inchangées : `contentKey:"slider"` survit) ;
- `seedGalleryDefaults` (`resolveModalSpec`) partitionne `about.files` par `subKey` — chaque widget
  `file` ne pré-remplit que SES documents ; **repli passe-tout** si aucun fichier ne porte de
  `subKey`, pour ne pas régresser les costums déjà en place (poi/classifieds/projects) ;
- `structure.configDriven` tests 16 (partition) et 17 (repli).

**Fiche publique `PreviewStructure`.** La section « Documents » passe d'une liste à plat
(`getDocuments()` / `DOCUMENT_LIST`, sans `subKey`, sous authentification) à **2 emplacements
nommés** appariés par `subKey`, repli « Non renseigné », repris de la fiche legacy
`ssbe/organizations/preview.php` :

| Emplacement | `subKey` acceptés |
|---|---|
| Récépissé de déclaration | `statusFile` (form SiteForge) **ou** `recepisseDeclaration` (fiches legacy — champ retiré du form le 30/07, `59a4b6ee`) |
| Responsabilité civile professionnelle | `responsableCivilePro` |

La fiche complète est rechargée par slug (`useEntityBySlugQuery`, même patron que
`useResourceEntity`) pour disposer de `about.files`. ~~`element/about` étant **public**, sur `/mss`
(page publique) les PDF deviennent téléchargeables par un visiteur anonyme — comportement **identique
à la fiche legacy** (§13).~~ **Faux, corrigé le 24/09** (review de la MR) : la fiche legacy
`ssbe/organizations/preview.php` réserve le bloc Documents à `$ssbeCanManage` (admin de la structure
ou du costum). Parité rétablie des deux côtés — cf. §13 question 15. `SEARCH_QUERY_KEYS.DOCUMENTS`
devenu orphelin, retiré.

**À refaire.** Les documents déposés avant ce lot n'ont pas de `subKey` → à redéposer.

**Gates (10/09)** : `tsc -b` ✅ · `eslint` ✅ · `config:validate` ✅ **20 pages / 64 sections** ·
`php -l Organization.php` ✅ · unitaires ciblés — `search` **462**, `i18n-files` (parité fr/en)
**69**, `profil` **487**, `structure.configDriven` **46** (44 + 2) ✅ · recette navigateur **non
faite** (dépend du déploiement du patch backend).

---

### Lot du 15/09 — 4 pages éditoriales (Habilitation MSS, FAQ, FAQ Pro, Prescrire & Orienter)

> Branche `n-dev`, commit `9deff38a`. **Config-only** — aucun code, aucune entité backend.
> Chaque page a été composée à partir d'une capture d'écran fournie par le porteur (design déjà
> arrêté) plutôt que d'une conception depuis les archétypes ; le travail a consisté à retrouver la
> composition la plus proche dans le catalogue de sections et à ne jamais inventer un contenu ou
> une URL absente de la capture.

**1. `/habilitation-mss`** (10 sections) — la procédure d'habilitation administrative d'une
Maison Sport-Santé (décret 2023-170, arrêté du 25/04/2023) : `hero-quick-access` (fond
`hero2.jpg`, réutilisé — la photo colle exactement à la capture), bandeau de contact
(`html`, `bg-gradient-hero`), 3 cartes numérotées « Procédure en 3 étapes » (`html` — cf. ci-dessous
pourquoi pas `cta-card-grid`), `categories-grid` (engagements), `gridLayout` (rapport annuel +
checklist), `accordion` (« Aux termes de l'habilitation »), `cards` (textes de référence). Liens
externes **vérifiés par recherche web**, pas inventés : Légifrance pour le décret
(`JORFTEXT000047278435`) et l'arrêté (`JORFTEXT000047558874`), `pole-sante.creps-vichy.sports.gouv.fr`
pour le Pôle Ressources National. Entrée de nav « Habilitation MSS » ajoutée sous Professionnels.

**2. `/faq` et `/faq-pro`** (2 sections chacune) — `searchHeader` (bannière sans image) +
`accordion`. Contenu réel : la FAQ de `www.ssbe.re/#faq` n'a **pas pu être récupérée** (page
rendue côté client, `WebFetch` n'y voit qu'un écran de connexion) — le porteur a fourni le texte
des 7 questions (FAQ) puis des captures des 12 questions (FAQ Pro), retranscrites intégralement,
liens internes posés vers les pages réelles correspondantes (`/mss`, `/creneaux`, `/mapping`,
`/labellisation`, `/espace-professionnels`, `/ressources`, `/listing-formations`). Toutes les
réponses repliées par défaut (`defaultOpen: false`) sur demande explicite — la première version de
`/faq` les avait toutes ouvertes, corrigé avant `/faq-pro`. Entrées de nav : « FAQ » sous Grand
Public, « FAQ Pro » sous Professionnels.

**3. `/prescription`** (5 sections) — ferme le lien mort de longue date signalé au §13 (question 1) :
la tuile « Aide à la prescription » de `/espace-professionnels` pointait vers `/prescription`
depuis la création de la config, sans que la page existe. `heroWithIcon` (médaillon `stethoscope`),
2 sections `html` (cartes « Qui / Pour qui / Par qui », cartes « Bonnes pratiques » colorées),
bandeau CTA dégradé. Fond de hero : posé sur `hero4.png` (réutilisé) faute d'asset dédié au moment
de la session, puis **remplacé par le porteur** juste après par un asset dédié
(`public/images/sportSanteBienetre/prescription.png`, ajouté au même commit) — la photo réelle du
formulaire APA de la capture. Les 2 sections « Guides et modèles » (cartes PDF) de la capture
**n'ont volontairement pas été posées** : les documents réels n'existaient pas encore au moment de
la session (ni en fichiers statiques, ni comme entités `ressource` du backend, cf. §4.2/§9 lot
02/09) — **à compléter** (§13, nouvelle question).

**Trois trouvailles en cours de route, sans rapport direct avec le contenu livré :**

- **Ancre morte.** Le CTA du hero d'`/habilitation-mss` (`#habilitation-procedure-steps`) a cessé
  de matcher après qu'une édition manuelle du fichier, hors de cette session, a renommé l'`id` de
  la section cible en `"Dépôt des demandes"` (espaces — invalide comme `id` HTML). Détecté par
  `audit:config` (catégorie `ancre-morte`), corrigé en restaurant l'`id` d'origine.
- **`heroWithIcon` illisible sur fond image.** Contrairement à `HeroSection.tsx`, le composant
  garde toujours `text-foreground` (sombre) même avec `backgroundImage` — jamais de bascule en
  blanc. **Seul usage de `heroWithIcon` dans tout le parc**, donc corrigé sans toucher au composant
  partagé : règle CSS scopée à `#prescription-hero` dans `theme.customCSS` (déjà utilisé sur cette
  config pour d'autres overrides ponctuels, cf. `.ssso-card`/`.sspt-card` plus haut dans la même
  clé). Vérifié au passage : `page.customCSS` (déclaré au schéma, à côté de `page.customJS`)
  n'est lu par **aucun composant de rendu** — un correctif posé là aurait été silencieusement sans
  effet ; c'est `theme.customCSS` (`SiteTheme.tsx`, injection globale) qui fonctionne, d'où le
  scoping par sélecteur d'`id` de section plutôt qu'un mécanisme par page.
- **`<Link>` sans `classifyHref` dans `HeroQuickAccess.tsx` et `CtaCardGrid.tsx`.** Les deux
  composants routent leur CTA via un `<Link to={...}>` React Router nu, sans le contrat à 4 voies
  que `CardsSection`/`NavLink`/`CTASection` appliquent déjà (`src/lib/linkKind.ts`) : une URL
  externe posée dans ce CTA est mal routée et retombe **silencieusement** sur la page d'accueil.
  Constaté à deux reprises pendant la session (CTA du hero d'Habilitation MSS, puis carte de
  `cta-card-grid` envisagée pour « Procédure en 3 étapes ») ; contourné à chaque fois côté config
  (ancre interne pour le premier, type `html` conservé pour le second — cf. §13, nouvelle question).
  **Ni l'un ni l'autre composant n'a été corrigé** : `heroQuickAccess` est utilisé par la moitié du
  parc, `cta-card-grid` par au moins parent62 — un correctif y engage plus large que cette session.

**Gates (15/09)** : `config:validate` ✅ **24 pages / 83 sections** · `audit:config` 🟡 **2
constats** — `/strategie` et `/rejoindre`, tous deux préexistants et inchangés (§13, questions
1 et 2 ; l'audit était à 3 avant ce lot, `/prescription` en sortait) · `config:render` ✅ **24/24
pages, 83/83 sections** · icônes lucide utilisées (`landmark`\*, `shield-check`, `help-circle`,
`stethoscope`, `user-round`, `footprints`, `file-text`, `network`, `bell`, `clipboard-check`)
vérifiées une à une contre `node_modules/lucide-react`. *(\*`landmark` remplacé en session par un
SVG inline sur demande du porteur, même structure que les badges déjà posés en `html` ailleurs
dans la config.)* `typecheck`/`lint`/`test:preflight` **non rejoués** ce lot (aucun fichier `.ts`/
`.tsx` modifié — le seul essai de correction de composant, sur `HeroWithIconSection.tsx`, a été
annulé avant écriture, cf. ci-dessus).

---

### Lot du 16/09 — restriction d'accès + clean nav (Nicolas)

> Commit `16922f73`, config-only.

**1. `auth.required: true` posé sur 8 pages** : `/espace-professionnels`, `/faq-pro`,
`/prescription`, `/labellisation`, `/habilitation-mss`, `/formation`, `/listing-formations`,
`/ressources`. Le site se referme : une bonne partie du contenu « Professionnels » (et `/ressources`,
déjà gardée depuis le 02/09) passe derrière la connexion.

**2. Nav élaguée** : retrait de 4 entrées jugées secondaires — « Équipements sportifs »
(`/equipements-sportifs`), « Cartographie » (`/mapping`), « Organismes de formation »
(`/listing-formations`), et tout le dropdown « Communauté » (`/projets`, `/structure`,
`/communaute`) — ainsi qu'un CTA mort vers `/equipements-sportifs` sur `/presentation`. **Les pages
elles-mêmes ne sont pas supprimées** de `pages[]` : diff mesuré 24 insertions / 90 suppressions sur
114 lignes, aucune section de page touchée — seul `header.nav` et les blocs `auth` bougent. Elles
restent donc atteignables par URL directe, orphelines de menu (cf. §4.1).

**Gates (16/09)** : `config:validate` ✅ **24 pages / 83 sections** (inchangé, aucune page
ajoutée/retirée) · revérifié le 17/09.

---

### Lot du 16/09 (2) — formulaire ressource enrichi + page `/programmes-dispositifs`

> Branche `n-dev`, commit `ae133e6a`. Deux demandes du porteur traitées dans la même session :
> élargir l'upload et la photo du formulaire `sport-sante-bienetre-ressource`, puis publier une
> page dédiée aux dispositifs « Sport sur ordonnance », sur maquette fournie.

**1. Formulaire `sport-sante-bienetre-ressource`.** Le porteur avait déjà ajouté deux valeurs à
l'énum `thematique` (`dispositifs`, `prescription`) juste avant la session — restées non commitées,
embarquées dans ce même commit. Deux changements dessus :

- `documents` (widget `file`, PDF) : `widgetProps.maxItems` **1 → 2**, libellés/info passés au
  pluriel (« Fichiers PDF », « jusqu'à 2 ») — patron déjà employé ailleurs dans le parc
  (`institut-bleu`/`parent62`/`saint-paul-sport`, `maxItems: 8`).
- Nouveau champ **`profil_avatar`** (widget `image`, `shape: square`) affiché **seulement** si
  `thematique === "dispositifs"`, via `visibleIf: { field: "thematique", op: "eq", value:
  "dispositifs" }` (moteur `formEngine`, `doc/28-module-formengine.md`). `profil_avatar` est le nom
  de champ déjà utilisé 5× ailleurs dans **cette même config** (organizations, article, équipements
  sportifs, session-formation) — champ **cœur** du POI, pas spécifique au sous-type `ressource`,
  donc a priori non soumis au piège `costum.typeObj.ressource` non déclaré (§9, lot 02/09 (2)) qui
  avait fait écarter `thematique`/`status` en silence. **Non vérifié en navigateur** — à confirmer
  en créant/éditant une ressource « Dispositifs » que la photo survit bien en base.
- Bloc racine `image: { field: "profil_avatar", existingUrlFrom: "image:profilUrl" }` ajouté au
  costumForm (même patron que les 5 usages existants), sans quoi le fichier saisi ne serait jamais
  routé vers `profil_avatar` à la sauvegarde.

**2. Nouvelle page `/programmes-dispositifs`** (réservée aux connectés, cohérent avec le lot du
16/09 de Nicolas ci-dessus). Composée à partir d'une maquette fournie, mais **simplifiée sur
instruction explicite du porteur** pour le contenu : la maquette montrait des cartes riches
(logo, « Comment ça marche », « Pour qui », bouton de prescription) — le porteur a demandé de
réutiliser **le type de carte de `/ressources`** (`card.type: "resource"`) plutôt que de
construire ce design dédié.

- `hero` (pas `heroWithIcon` — évite le bug de lisibilité texte du 15/09, §12) : titre/sous-titre
  de la maquette, fond `/images/sportSanteBienetre/dispositif.png` (~2,9 Mo, plus lourd que les
  `.jpg` des autres heros — à optimiser si le poids de page devient un sujet), `overlay: true`.
- `searchHeader` réduit à une simple zone de texte libre (`showSearch` seul, pas de titre ni de
  filtres) — demande explicite du porteur, contrairement au filtre latéral par thématique de
  `/ressources`.
- `searchProStatic` : mêmes réglages que `/ressources` (`card.type`/`preview.type: "resource"`,
  colonnes `sm:1/md:2/lg:2`) mais `defaultFilters` **figé** sur `thematique: "dispositifs"` (en plus
  de `type: "ressource"` et `status: "Visible"`) — pas de filtre thématique proposé à
  l'utilisateur, il n'y en a qu'une. `badge` volontairement **omis** (`ResourceConfSchema.badge` est
  optionnel) : toutes les cartes partageant la même thématique, la pastille colorée serait
  redondante et n'apparaît pas dans la maquette.
- Image des cartes : `profilMediumImageUrl`, dérivée du champ `profil_avatar` ajouté au point 1 —
  les deux livrables du lot se rejoignent, une ressource « Dispositifs » sans photo retombe sur le
  visuel de repli standard du composant.
- Entrée de nav « Programmes et dispositifs » sous Professionnels, après « Prescrire & Orienter ».

**Répond partiellement à la question 17 (§13)** : la direction choisie pour les documents de
`/prescription` — des entités `ressource` avec un filtre `thematique` dédié plutôt que des fichiers
statiques — est celle-ci, mais concrétisée comme une **page séparée** (`/programmes-dispositifs`)
plutôt qu'intégrée aux sections « Guides et modèles » de `/prescription` elle-même. Cette dernière ne
lie pas encore vers la nouvelle page — question laissée ouverte, reformulée au §13.

**Écart non traité, à trancher** : les 2 nouvelles valeurs de `thematique` (`dispositifs`,
`prescription`) ne sont mappées ni dans les cases à cocher du filtre latéral de `/ressources`
(`filterGroups[0].options`), ni dans ses `badge.colors`/`icons`/`labels` — une ressource
« Dispositifs » ou « Prescription » saisie via le formulaire enrichi n'apparaîtra donc sur
`/ressources` qu'avec une pastille non stylée (clé brute affichée, cf. le mécanisme documenté au
lot 02/09 (2)). Nouvelle question au §13.

**Gates (16/09)** : `config:validate` ✅ **25 pages / 86 sections** · `audit:config` 🟡 **2 constats
préexistants inchangés** (`/strategie`, `/rejoindre`, §13) · `typecheck` ✅ · `lint` ✅ **0 erreur**
(24 warnings React Compiler préexistants, fichiers non touchés) · `test:preflight` ✅ **633** (2
échecs préexistants hors périmètre, identiques au lot du 09/09) · snapshot
`tests/preflight/__effective__/sport-sante-bien-etre.json` régénéré (diff limité à la nouvelle
route `/programmes-dispositifs/searchProStatic`) · **recette navigateur non faite**.

---

### Lot du 17/09 — merge de `main` dans `n-dev`

> Commit `c3f347aa`, sans commit SSBE dédié — fusion de routine après le lot ci-dessus.

Apporte notamment `chore(deps)` **SDK 1.0.192** (`ac05a227`, expose `setSiteCostum`/
`hasCostumContext` — active le branding costum des e-mails, cf. §11) et une refonte importante de
`config.prod.parent62.json`, sans rapport avec SSBE. `config.prod.sport-sante-bien-etre.json`
lui-même **non touché** par le merge (aucun conflit).

**Gates (17/09, revérifiés post-merge)** : `config:validate` ✅ **25 pages / 86 sections** ·
`typecheck` ✅ · `test:preflight` ✅ **636/638** (2 mêmes échecs préexistants hors périmètre — le
nombre total de tests monte avec le merge, sans lien avec SSBE).

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `sportSanteBienetre` → config + `index-sport-sante-bien-etre` |
| 2 | Thème | ✅ | Bloc `theme` complet en config + 75 variables CSS |
| 3 | Socle légal | ✅ | `/mentions-legales`, `/confidentialite`, `/accessibilite` existent |
| 4 | Jeux de données du territoire | ✅ | Équipements (3 061), créneaux (300), structures (180), MSS (13) — sondés le 03/08 |
| 5 | Communauté | 🟡 | Onglet « Membres » OK ; onglet « Organisations » **vide** (id en dur, §5) |
| 6 | Formulaires costum | 🟡 | **6** déclarés (le form `mss` supprimé le 09/09, §9) ; 2 ouverts côté public (structure, créneau) |
| 7 | Inscription d'une structure | ✅ | Modale branchée sur `/communaute`, gardée par l'authentification |
| 8 | Connexion | ✅ | Widget `utilities.auth` ; le CTA cassé du header est retiré |
| 9 | Back-office | ✅ | **10 onglets** (« Ressources » + « Modération » le 02/09 ; « Maisons Sport Santé » le 09/09) — **essai UI connecté à faire** |
| 10 | Blog | ✅ | `articleFeed` + RSS + SEO + palette (travaux du 25/07) |
| 11 | Palette ⌘K | ✅ | `entitySearch` + `articleSearch` |
| 12 | Grille « professionnels » | ❌ | 3 tuiles sur 6 mènent à des pages inexistantes (§13) |
| 13 | Hero `/public` | ❌ | 1 CTA mort, 1 CTA qui renvoie à l'accueil depuis une sous-page (§13) |
| 14 | Rendu navigateur | ❌ | **Jamais vérifié** — aucune capture de ce site à ce jour |
| 15 | Mode sombre | ❌ | Jamais vérifié |
| 16 | Créneaux — ajouter / modifier depuis `/creneaux` | ✅ config | `addButton` (`adminOnly: false`) + `preview.editButton` (02/09, §9) — **recette navigateur à faire** (backend indisponible en fin de session) |
| 17 | Créneaux — « Fiche structure » réservée aux gestionnaires | ✅ | `card.structureAction.audience: "managers"` + gate `isCoformAnswerManager` sous `useHydrated` (02/09, §9) ; 12 tests dont 2 de parité SSR |
| 18 | Créneaux — modération dans le back-office | ✅ config | Onglet `moderation` en mode `statusField`, 57 en attente à traiter (02/09, §9) — **recette à faire** : passer un « En attente » à « Validé » et vérifier qu'il apparaît sur `/creneaux` |
| 19 | Ressources — listing et ajout côté admin | ✅ config | Onglet « Ressources » + `costumForms` dédié (02/09, §9) — **bloqué tant que `declareRessourceType` n'est pas joué en base** |
| 20 | Ressources — page publique `/ressources` | ✅ config | Filtre latéral par thématique + recherche par nom, publiés seulement (02/09, §9) ; ferme le lien mort de la tuile « Rapports & Publications ». Périmètre vide tant qu'aucun document n'est saisi |
| 21 | Fusion MR 51 + MR 52 | ✅ config | Branche `merge-mr51-mr52`, montage `gridLayout` retenu, 11 correctifs mesurés (08/09, §9) — **non poussée** |
| 22 | Modération des structures | ✅ config | Trépied `statusActor` + garde `$nin` sur la palette (08/09, §9) — **1 fiche à valider** : MSS de Saint-Louis |
| 23 | Filtre « Bénéficiaires » de `/creneaux` | ❌ | Aveugle sur 232 réponses stockées en chaîne collée. Script de normalisation prêt, **non exécuté** — arbitrage de vocabulaire en attente (§13) |
| 24 | Ressources — saisie réelle | ❌ | `declareRessourceType` joué en DEV (contrat live 23→25 champs) ; **reste à rejouer en PROD**, avec ses trois clés |
| 25 | Formulaire structure aligné legacy | ✅ config | `070a3267` (§9) : assistant 5 étapes + cascade juridique, `mobile` plat, `affiliate`/`mss` en `"true"`/`"false"`, titres en `valueSelect` chaîne, `statusActor` — vérifié contre 3 fiches DB créées en session. **Recette navigateur à faire** |
| 26 | MSS consolidé | ✅ config | Form `mss` supprimé, champ `mss` sur la structure, onglet admin `maisons-sport-sante` dédié (filtre `mss: "true"`). Les 13 fiches MSS d'avant (`type: "NGO"`, `tags: ["mss"]`) : `mss: "true"` **posé à la main en base, dev + prod** (Nicolas) — sondé le 24/09 : `/mss` → 13 en prod, 16 en dev |
| 27 | `tags` = miroir verbatim de `thematic` | ✅ | Clé `structure:tagsFromThematic` partagée Ekilib.re + SSBE ; oracle de test mis à jour. `mss` n'est plus un tag |
| 28 | Section « Actions rapides » sur `/espace-professionnels` | ✅ config | 2 boutons (structure en Dialog, créneau en navigation `/coform/…`) — **recette navigateur à faire** |
| 29 | Merge de `main` dans `n-dev` (`8bbe35a2`) | ✅ | Module AAC + federation-des-cae + travail SSBE parallèle. 7 conflits config résolus vers le modèle unifié `n-dev` ; `tsc -b` et préflight verts (2 échecs préexistants hors périmètre) |
| 30 | Pièces justificatives récupérées en édition | ✅ code (`518b40e8`) | `subKey` posé à l'upload + `seedGalleryDefaults` partitionné + patch backend `Organization::getById` (`about.files`, sur `master`). **Fonctionnel une fois le backend déployé** ; documents d'avant le 10/09 à redéposer. Recette navigateur à faire |
| 31 | Documents de la fiche publique en emplacements nommés | ✅ code (`518b40e8`) | `PreviewStructure` : 2 slots par `subKey` (Récépissé / RC pro), repli « Non renseigné », parité fiche legacy. Réservé aux gestionnaires depuis le 24/09 (front `canEditProfile` + garde backend `Organization::getById`) — §13 question 15 |
| 32 | Page `/habilitation-mss` | ✅ config (`9deff38a`, 15/09) | 10 sections, liens Légifrance/démarches-simplifiées/Pôle Ressources vérifiés par recherche web. Entrée de nav Professionnels — **recette navigateur à faire** |
| 33 | Pages `/faq` et `/faq-pro` | ✅ config (`9deff38a`, 15/09) | Contenu réel fourni par le porteur (7 + 12 Q/R), tout replié par défaut. Entrées de nav Grand Public / Professionnels — **recette navigateur à faire** |
| 34 | Page `/prescription` | ✅ config (`9deff38a`, 15/09) | Ferme le lien mort historique de la tuile « Aide à la prescription » (§13, question 1 close). Sections « Guides et modèles » (cartes PDF) **non posées**, documents à fournir — §13 nouvelle question |
| 35 | ~~Lisibilité `heroWithIcon` sur fond image~~ | ✅ sans objet (25/09) | Le héros de `/prescription` est passé en **`hero-quick-access`** (review de la MR : `heroWithIcon` posait l'image en `url()` CSS brut → 3,9 Mo téléchargés ; `hero-quick-access` passe par `/img`, 13–58 Ko, + preload LCP). Même `id`, titre, sous-titre et image ; icône et centrage abandonnés (choix de Nicolas). Les 2 règles CSS blanches de `#prescription-hero` sont **retirées** (texte blanc illisible sur le voile clair de `hero-quick-access`). `heroWithIcon` n'est plus utilisé nulle part dans le parc — composant toujours non corrigé (image brute + texte sombre) : à éviter |
| 36 | `<Link>` sans `classifyHref` (`HeroQuickAccess`, `CtaCardGrid`) | ❌ | Bug identifié deux fois en session (15/09), contourné côté config à chaque fois. Affecte potentiellement tout le parc (parent62 pour `cta-card-grid`) — correctif de composant **non fait**, hors périmètre de la session |
| 37 | Restriction d'accès + clean nav | ✅ config (`16922f73`, 16/09, Nicolas) | `auth.required: true` sur 8 pages, 4 entrées de nav retirées (§9) — **recette navigateur à faire** (vérifier qu'un visiteur non connecté est bien redirigé/invité à se connecter sur les 8 pages) |
| 38 | Formulaire ressource — upload 2 fichiers + photo conditionnelle | ✅ config (`ae133e6a`, 16/09) | `documents.maxItems` 1→2 ; `profil_avatar` affiché seulement si `thematique: "dispositifs"` (§9) — **recette navigateur à faire** : créer/éditer une ressource « Dispositifs », vérifier que la photo est bien envoyée et relue en édition |
| 39 | Page `/programmes-dispositifs` | ✅ config (`ae133e6a`, 16/09) | Hero + recherche libre + cartes `resource` filtrées `thematique: dispositifs`, entrée de nav Professionnels (§9). Répond partiellement à la question 17 (§13) — **recette navigateur à faire**, et aucune ressource « Dispositifs » saisie à ce jour donc page vide en pratique |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande en cours. La config n'emploie que des méthodes publiques déjà disponibles
(`searchCostum`, `coformAnswersSearch`).

Version installée : **1.0.192** (`package.json` `^1.0.192`, mesurée le 17/09 — montée arrivée par le
merge de `main` du 17/09, `ac05a227`, sans action ni impact spécifique SSBE ; expose
`setSiteCostum`/`hasCostumContext` pour le branding costum des e-mails). Le poste sensible
reste la pose du scope costum côté admin (`setCostumScope`, cf.
[`../src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts)) —
pertinent ici : SSBE a un back-office `/admin` à 9 onglets (§4.3).

⚠ **L'enum `ADD_POI` du SDK ne connaît pas le sous-type `ressource`** : la création est refusée en
validation AJV, avant tout appel réseau, tant que le costum ne déclare pas le type avec son
`presetValue`. Ce n'est pas une demande d'évolution du SDK — c'est une écriture en base (§9).

⚠ **Récupération des documents d'une structure** (lot 10/09) : suppose le patch
`Organization::getById` (jointure `images` + `files`, calqué sur `Poi::getById`) **déployé** —
il est porté sur `master` de `citizenToolKit`. Sans lui, `about.files` reste vide pour les
organisations → la modale d'édition et la fiche `PreviewStructure` ne montrent aucun document
(dégradation silencieuse, pas d'erreur). Modification backend, pas une demande d'évolution du SDK.

---

## 12. Points d'attention / limitations

- **Écart « champs déclarés vs placés »** dans les 7 formulaires (cf. §4.2). Avant de traduire ou de
  renommer un champ, vérifier qu'il est **placé dans une section** — sinon il n'existe pas à l'écran.
- **Les sections de formulaire ont deux formes** — `sections[].fields[]` ET
  `sections[].groups[].fields[]` (piège rencontré le 30/07, `5ae354d2`) : un renommage/retrait de
  champ doit traiter **les deux**, et aucun gate ne détecte une référence de section orpheline
  (ni `config:validate`, ni le préflight).
- **Id d'organisation codé en dur** dans le filtre de `/communaute` (§5). Le même piège que le
  `localityId` figé de commune-transparente : une valeur d'instance dans une config.
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement, et une
  clé déclarée au schéma mais non lue par le composant est invisible (ni typecheck, ni audit).
- **`notSourceKey: true`** est employé sur plusieurs périmètres. À chaque fois, vérifier que les
  `defaultFilters` restreignent réellement — sans quoi la page sert la base entière.
- **`structure:tagsFromThematic` est une clé PARTAGÉE** (`src/modules/profil/forms/costum/structure/fns.ts`) :
  `costumForms["structure"]` d'Ekilib.re **et** `sport-sante-bienetre-organizations` la référencent.
  Toucher son comportement impacte les deux sites — l'oracle est
  `src/modules/profil/forms/structure.configDriven.test.ts`.
- **Le marqueur MSS est le champ `mss: "true"`, plus le tag `"mss"`** — la page publique `/mss`
  **et** l'onglet admin `maisons-sport-sante` filtrent dessus. Les 13 fiches MSS de prod
  (`type: "NGO"`, `tags: ["mss"]`) ont été migrées **à la main en base, dev + prod** (pas de script
  dans le dépôt). Toute autre base (backend local, nouvelle instance) doit recevoir la même mise à
  jour, sinon `/mss` et l'onglet sortent vides (constaté en review de la MR sur un backend local non
  migré : 12 avec l'ancien filtre, 0 avec le nouveau).
- **`contentKey` d'un `doctype:file` n'est PAS fiable** : `Document::save` le remplace par un bucket
  MIME (`pdf`/`spreadsheet`/`text`/`presentation`). Pour rattacher un document à un champ précis, se
  fier à **`subKey`** (conservé verbatim, posé par `processGalleryFields` = `contentKey` du champ).
  Les documents déposés **avant le 10/09** n'ont pas de `subKey` : dans la **modale d'édition**, ils
  restent proposés dans chaque champ fichier (visibles et supprimables — corrigé le 24/09 en review de
  la MR, avant ils disparaissaient dès le premier nouvel upload, sur tous les costums) ; sur la **fiche
  publique** (`PreviewStructure`, emplacements nommés), ils n'apparaissent pas — à redéposer.
- **Téléphone des structures : on écrit `mobile` à plat, on lit aussi `telephone`.** Le costum ne
  déclare que `mobile` (contrat live), et le backend ne recopie pas ce `mobile` dans `telephone.mobile`
  lors d'un enregistrement complet. Or 123 fiches sur 148 en prod n'ont que `telephone.mobile`/`fixe`
  (mesuré le 24/09). La lecture passe donc par `telephonePrincipal` (`src/lib/`) : `mobile` plat
  d'abord (valeur la plus récente quand les deux coexistent), sinon `telephone`. Utilisé par
  `PreviewStructure`, `CardContact` et le pré-remplissage du formulaire (`read: "structure:mobileRead"`,
  dans les deux configs). Vérifié en lecture seule sur toutes les fiches SSBE et Ekilib.re, en dev et
  en prod : aucun numéro perdu ; en prod SSBE, le formulaire s'ouvrait vide sur 123 fiches, il ne
  reste que les 9 sans aucun numéro.
- **Site web des structures : on écrit `link`, on lit aussi `url`.** Même schéma que le téléphone :
  le formulaire écrit `link` — comme le legacy ssbe.re (vérifié le 24/09 sur une fiche créée par
  l'ancien site : `link` seul, valeur telle que saisie, sans `https://` ajouté) —, mais 43 fiches
  sur 148 en prod n'ont que `url`. `siteWebPrincipal` (`src/lib/`) lit `link` d'abord puis `url` ;
  utilisé par `PreviewStructure` et le pré-remplissage (`read: "structure:linkRead"`, deux configs,
  valeur relue telle que stockée). Le lien AFFICHÉ passe par `normalizeToolHref` (`https://` ajouté
  s'il manque : 8 liens relatifs cassés en prod → 0). Vérifié en lecture seule, dev et prod : aucun
  site web perdu ; formulaire vide 140 → 97 fiches (celles sans aucun site).
- **Sections `html` : `props.html` en `{ fr, en }`, pas en chaîne brute** — une chaîne brute s'affiche
  en français dans les deux langues. Les 4 blocs de `/habilitation-mss` (bandeau « Avant de déposer »,
  3 étapes, colonnes du rapport annuel) sont traduits depuis le 25/09 (review de la MR ; seuls les
  textes remplacés, balises/liens identiques). **Restent en français seul** (déjà le cas sur `main`) :
  `/espace-professionnels` `#mission`, `#national-plan`, `#declinaison-regionale`, et `/formation`
  `#formation-html-section`. `audit:config` ne signale pas ce cas (`trad: 0`).
- **`geo` / `geoPosition` du formulaire structure : `writeOnly`** (contrat de `geoTransforms.ts`, comme
  le Tampon et l'édition de profil). Le merge de `main` avait laissé ces deux clés **en double** dans
  `fields` (bloc `writeOnly` d'`e14ef18e`, 08/09, puis bloc sans `writeOnly` de `070a3267`, 09/09) ; en
  JSON la DERNIÈRE gagne, donc les coordonnées étaient relues et renvoyées à chaque édition. Doublon
  retiré le 25/09 (review de la MR) : édition sans toucher l'adresse → `geo` omis, coordonnées en base
  préservées. ⚠ Une clé dupliquée dans un JSON de config ne fait échouer NI `config:validate` NI
  l'audit — seul un scan du texte brut la voit.
- **`affiliate` a deux formes en base** : `"Oui"`/`"Non"` (fiches historiques, majoritaires) et
  `"true"`/`"false"` (formulaire actuel ET legacy ssbe.re — vérifié le 24/09), ces dernières
  **livrées en booléens par l'API**. Toute lecture passe par `coerceBool`
  (`formEngine/engine/coercions`), jamais `=== "Oui"`. Le badge « Affiliée » de `PreviewStructure`
  testait `"Oui"` (comme `preview.php` legacy) : corrigé le 25/09 — en prod, 14 structures affiliées
  retrouvent leur badge (49 → 63), aucune ne le perd. `ProfileSsbeAbout` avait déjà son `toBoolean`
  équivalent.
- **⚠ Contraste des cartes d'accès rapide de l'accueil — NON corrigé ici** (« Professionnels » /
  « Grand Public », `hero-quick-access` de `/`). Même cause que sur Ekilib.re (corrigé là-bas le 25/09) :
  la règle de base `h1…h6, p { text-foreground }` d'`index-sport-sante-bien-etre.css` impose le texte
  foncé au titre et à la description au lieu de la couleur de la carte → 2,25 à 3,11:1 (sous AA), en
  clair comme en sombre. Correctif prêt, décidé hors MR le 25/09 : la même règle hors `@layer` que le
  Tampon (`.access-card h3, .access-card p, .access-card span { color: inherit; opacity: 1 }`) →
  4,63 à 5,79:1.
- **Image de fond d'un héros : passer par un type qui utilise `HeroBackgroundImage`** (`hero`,
  `hero-quick-access`, `hero-parallax`, `hero-tinted-overlay`, `hero-carousel`) — ils servent l'image
  via `/img` (srcSet AVIF/WebP) et ont le preload LCP. **`heroWithIcon` ne le fait pas** : `url()` CSS
  brut, l'original est téléchargé tel quel (`prescription.png`, 1400×700 : 3,9 Mo, contre 13–58 Ko
  optimisé). Constaté en review de la MR le 25/09 ; `/prescription` est passé en `hero-quick-access`.
  Note : le preload LCP ne tient pas compte de `page.auth` — sur une page réservée, un visiteur non
  connecté télécharge l'image préchargée (≈ 50 Ko) avant d'être redirigé.
- **`PreviewStructure` est partagé Ekilib.re + SSBE** (`preview.type: "structure"` dans les deux
  configs). Les emplacements documents (`DOCUMENT_SLOTS`) et la réservation aux gestionnaires des blocs
  Informations + Documents (24/09, §13 q.15) valent donc aussi pour la fiche structure du Tampon.
  Pour un gestionnaire, la fiche **affiche la fiche complète rechargée par slug** — celle que la
  modale d'édition modifie — et la **recharge à la fermeture** de la modale (avant le 24/09, elle
  affichait l'item de recherche et restait sur les anciennes valeurs après enregistrement). Couvert
  par `PreviewStructure.test.tsx`.
- Ce site n'a **jamais été regardé en navigateur** dans le cadre de ce dossier. Tous les constats
  ci-dessus sont dérivés de la config, du code et du sondage — pas d'un rendu observé.
- **`<Link>` sans `classifyHref` dans `HeroQuickAccess.tsx` et `CtaCardGrid.tsx`** (15/09) : une
  URL externe posée dans leur CTA retombe silencieusement sur la page d'accueil (le React Router
  `<Link>` nu la traite comme un chemin interne). `CardsSection`/`NavLink`/`CTASection` ont déjà le
  correctif (`src/lib/linkKind.ts`) ; ces deux-là ne l'ont pas. Avant de poser un lien externe dans
  un CTA `hero-quick-access` ou `cta-card-grid`, vérifier qu'il reste interne, ou passer par une
  ancre + lien natif dans une section `html` (contournement employé sur `/habilitation-mss`).
- **`page.customCSS` (schéma) n'est lu par aucun composant de rendu** — seul `theme.customCSS`
  (`SiteTheme.tsx`, injection globale) l'est réellement. Pour un override scopé à une page/section,
  poser la règle dans `theme.customCSS` avec un sélecteur ciblant l'`id` de la section, jamais dans
  `page.customCSS` (vérifié le 15/09, cf. §9).
- **Un `id` de section est une ancre potentielle** (CTA `#id`, `theme.customCSS`) — un renommage
  manuel casse silencieusement ces deux usages ; seul `audit:config` (catégorie `ancre-morte`) le
  détecte, ni `config:validate` ni le préflight.
- **`thematique` de `/ressources` n'est mappée que pour 7 valeurs sur 9** (16/09, §9) — le filtre
  latéral (`filterGroups[0].options`) et le `resource.badge` (`colors`/`icons`/`labels`) de la page
  n'ont pas été mis à jour avec les 2 valeurs ajoutées au formulaire (`dispositifs`, `prescription`).
  Une ressource saisie avec l'une de ces thématiques reste invisible du filtre et affiche une
  pastille non stylée (clé brute) sur `/ressources` — cf. §13, nouvelle question.
- **`profil_avatar` est un nom de champ CONVENTIONNEL, pas arbitraire** (`doc/28-module-formengine.md`,
  widget `image`) : il doit être répété **à l'identique** comme nom de champ ET dans le bloc racine
  `image.field` du costumForm pour que `useEntityMutation` route le fichier au bon endroit
  (`payload.profil_avatar`). Un autre nom (ex. `_imageFile`, employé côté Ekilib.re) fonctionne aussi
  tant que les deux occurrences concordent — mais **cette config-ci** utilise `profil_avatar` partout
  (5 formulaires avant le lot du 16/09, 6 depuis) : y rester pour la cohérence interne du fichier.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | ~~Grille « Le réseau Sport Santé »~~ (`/espace-professionnels`, `features-glass`, 6 tuiles) : 3 tuiles menaient à des pages inexistantes. **`/ressources` FAITE le 02/09** (question 7), **`/prescription` FAITE le 15/09** (§9, `9deff38a`). **Il ne reste que « Stratégie régionale Sport Santé » → `/strategie`** — créer la page, repointer vers `/presentation` (rapprochement possible mais non équivalent), ou retirer la tuile ? | Thomas |
| 2 | **Hero de `/public`** : le CTA « Sport et santé pour tous » pointe vers `/rejoindre` (inexistant), et le second, « Sport et santé sur ordonnance », vers `/` — un lien vers l'accueil depuis une sous-page. Les deux libellés sont des **slogans, pas des actions** : le hero est à repenser plutôt qu'à rafistoler | Thomas |
| 3 | Les 5 autres formulaires costum (`mss`, `formation`, `session-formation`, `recovery-center`, `article`) doivent-ils être ouverts au public comme l'a été `organizations`, ou rester réservés au back-office ? | Thomas |
| 4 | Les 7 formulaires déclarent **196 champs dont 121 placés** (re-dérivé le 08/09 ; trois vestiges purgés le 30/07 : `facebook`, `instagram`, `recepisseDeclaration`). Faut-il purger les vestiges restants — dont `youtube`/`linkedin`/`autreDescription` sur `organizations` —, ou certains sont-ils attendus par le backend en écriture ? | Thomas |
| 5 | `/communaute` → onglet « Organisations » : l'id `682b2ac5e05a1d45844340e7` est-il périmé, ou aucune organisation n'a-t-elle jamais été rattachée ? | Thomas |
| 6 | Rendu navigateur et mode sombre : à parcourir sur les 20 pages | Thomas |
| 7 | ~~Page publique `/ressources`~~ — **FAITE le 02/09** (§9) : filtre latéral par thématique + recherche par nom. Elle a fermé le lien mort « Rapports & Publications » de la question 1 (audit 4 → 3). Entrée de nav ajoutée le 02/09 dans le dropdown Professionnels. **Reste un point de rédaction** : le hub « Espace professionnels » se décrit comme « Ressources et outils pour les pros », juste au-dessus d'une entrée « Ressources » — redondance légère, à retoucher si elle gêne | Thomas |
| 8 | **Thématique affichée en clé** dans le listing admin (`mss`, `has`…) : `formatCell` ne résout aucune énumération, et seul le mode `statusField` sait mapper une valeur vers un libellé. Vit-on avec (compact, sans ambiguïté pour un usage interne), ou ajoute-t-on au schéma des colonnes admin une table de libellés — utile bien au-delà de ce site ? | Thomas |
| 9 | **Vocabulaire des bénéficiaires** — après normalisation, 215 fiches diront « Personnes de plus de 55 ans » et 2 « Séniors (plus de 55 ans) » pour la même population ; 27 diront « Personnes en perte d'autonomie », absente du référentiel. Réécrire l'existant vers le libellé du formulaire, ou remettre l'ancien au référentiel ? **Bloque le `--apply` du script de normalisation** | Thomas |
| 10 | **`publicType`** — 7 fiches portent « Mixte »/« Féminin » là où les options disent « mixte »/« femmes ». Doubler les options afficherait deux « Mixte » dans le panneau : c'est une normalisation de donnée, pas une correction de config | Thomas |
| 11 | **Branche de destination** — la fusion MR 51 + MR 52 puis le lot structure du 09/09 vivent maintenant sur `n-dev` (merge de `main` `8bbe35a2` fait). Pousser `n-dev` tel quel, ou passer par une MR relue ? Prévenir Nicolas : son montage `/creneaux` est conservé, mais ses deux listes d'options ont changé | Thomas |
| 13 | ~~**Modèle MSS**~~ — **tranché** : le modèle unifié de `n-dev` (champ `mss` sur la structure) est la direction retenue, à la place du formulaire `type: "NGO"` séparé de `main`. Les 13 fiches MSS existantes portent `mss: "true"` (posé à la main, dev + prod) | Thomas / dev SSBE `main` |
| 14 | **`representativeTitle` / `personInChargeTitle` en `valueSelect` mono** — stocke une chaîne, saisie libre autorisée. Vérifier que l'affichage profil (`ProfileSsbeAbout`) et les exports gèrent bien une valeur hors des 5 titres proposés | Thomas |
| 12 | **Périmètre de la palette ⌘K** — SSBE cite `equipementsSportifs974` mais jamais `associationEkilibre`, alors que le site du Tampon cite SSBE. L'agrégation ne va que dans un sens : à corriger ou à documenter | Thomas |
| 15 | ~~**Pièces justificatives publiques sur `/mss`**~~ — **tranché le 24/09** (review de la MR) : parité avec la fiche legacy `ssbe/organizations/preview.php`, qui réserve à `$ssbeCanManage` (admin de la structure ou du costum) les boutons Modifier/Supprimer et les blocs **Informations** (identifiant, catégorie, membre de, créé le), **Documents** et **Activités rattachées** (la doc disait à tort que le legacy montrait les documents). `PreviewStructure` réserve donc Informations et Documents à `canEditProfile` (Modifier l'était déjà ; Supprimer et créneaux n'y existent pas) et ne recharge la fiche complète que pour ce droit. Backend : `Organization::getById` (`citizenToolKit`) ne joint `files` que pour `isElementAdmin` ou `isCostumAdmin` — **modifié en local, à committer et déployer** ; vérifié en anonyme sur le dev (11 fiches SSBE avec documents en base, 0 exposée). **Recette à faire connecté en gestionnaire** : Informations + Documents visibles, pièces jointes présentes dans la modale d'édition | Nicolas |
| 16 | **Intitulé du 1er emplacement documents** — la fiche affiche « Récépissé de déclaration » (libellé legacy) alors que le champ du formulaire s'appelle « Statuts » ; l'emplacement accepte les deux `subKey` (`statusFile`, `recepisseDeclaration`). Aligner l'intitulé sur « Statuts » (1 ligne d'i18n) ou garder le libellé legacy ? | Thomas |
| 17 | ~~`/prescription` — 4 documents PDF non posés~~ — **direction tranchée le 16/09** (§9, `ae133e6a`) : entités `ressource` avec filtre `thematique` dédié plutôt que fichiers statiques, comme pressenti. Concrétisé comme une **page séparée** `/programmes-dispositifs` plutôt qu'intégré aux sections « Guides et modèles » de `/prescription`. **Reste à trancher** : `/prescription` doit-elle lier vers `/programmes-dispositifs` (CTA, carte…), ou les deux pages restent-elles indépendantes ? Et les 4 documents de la capture d'origine (« Guide Consultation et prescription… ») sont-ils à saisir comme ressources `dispositifs`/`prescription`, ou visaient-ils autre chose ? | Thomas |
| 18 | **`<Link>` sans `classifyHref`** sur `HeroQuickAccess.tsx` et `CtaCardGrid.tsx` (§9, §12) — les aligner sur `CardsSection`/`NavLink`/`CTASection` casserait potentiellement des CTA qui comptent aujourd'hui, par accident, sur l'ancien comportement. À planifier comme un lot dédié, testé sur tout le parc (parent62 pour `cta-card-grid`), pas en aparté d'un lot de contenu. **Fait partiellement le 25/09** (review de la MR) : les **boutons-ancres** (`#id`) de `HeroQuickAccess` font désormais défiler vers la section (comme `CTASection`) — le bouton « Déposer une demande » de `/habilitation-mss` ne bougeait pas ; seul bouton-ancre de `hero-quick-access` du parc, donc sans risque (`HeroQuickAccess.test.tsx`). **Reste** : voies externe / `tel:` / `mailto:` des boutons et des cartes de `HeroQuickAccess`, et tout `CtaCardGrid` | Thomas |
| 19 | **`/ressources` pas à jour des 2 nouvelles thématiques** (16/09, §9, §12) : `dispositifs`/`prescription` absentes du filtre latéral et du `resource.badge` de la page. Faut-il les y ajouter (une ressource « Dispositifs » resterait alors visible aux deux endroits, `/ressources` **et** `/programmes-dispositifs`), ou `/ressources` doit-elle au contraire **exclure** ces 2 thématiques puisqu'elles ont désormais leur page dédiée ? | Thomas |
| 20 | **Photo `profil_avatar` sur une ressource « Dispositifs »** — jamais vérifié en navigateur (§9) : l'upload est-il bien accepté par le costum backend (champ cœur POI, a priori non soumis au filtre `typeObj.ressource`, mais non confirmé empiriquement), et l'image survit-elle bien au cycle création → édition ? | Thomas / dev SSBE |
