[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Ekilib.re — Maison Sport Santé du Tampon

> **Document de travail du projet de configuration.** Il intègre le contexte, le modèle de données,
> l'architecture, l'état d'avancement, les impacts et les dépendances. Objectif : ne plus re-explorer
> le dépôt ni la base à chaque session, et offrir une base partagée entre les intervenants
> (Francki / Nicolas / Peterson). **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) · [Module CoForm](../doc/21-module-coform.md) ·
> [Assistant Config](../doc/26-assistant-config.md) · projet frère
> [Sport Santé Bien-être](sport-sante-bien-etre.md) (même costum, même CSS). Docs workspace :
> [`FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md) (analyse fonctionnelle + endpoints,
> 06/07) · [`ENDPOINT.md`](../../ENDPOINT.md) (fiches d'endpoints SDK à créer). Mémoire :
> `[[project-maison-sport-sante-la-tampon]]`.

Dernière mise à jour : **2026-07-31** (création du document ; collecte git/config/gates du 31/07).

---

## 1. Contexte du projet

La **Maison Sport Santé du Tampon (Ekilib.re)** oriente les habitants du Tampon et de Saint-Joseph
(La Réunion) vers des **créneaux d'activité physique adaptée** labellisés sport santé. Le projet
publie un site vitrine + annuaire de créneaux sur SiteForge, adossé au **costum régional
`sportSanteBienetre`** (réseau Sport Santé Bien-être de La Réunion) : Ekilib.re est un **sous-site
territorial** de ce costum — il en consomme les données (créneaux = answers d'un CoForm SSBE,
structures = organizations SSBE), restreintes aux codes postaux **97430 / 97418**.

| | |
|---|---|
| **Site SiteForge** | slug `associationEkilibre` → [`config.prod.maison-sport-sante-la-tampon.json`](../config.prod.maison-sport-sante-la-tampon.json), CSS `index-sport-sante-bien-etre` (**partagé** avec le site SSBE, cf. [`sites.json`](../sites.json)) |
| **Costum / scope de données** | `sportSanteBienetre` — `source.key` des structures ; préfixe des clés de champs answers |
| **CoForm « créneau »** | **`6928096adf5caf0d230e7f26`** — formKey `sportSanteBienetre2172025_854_0` ; **1 créneau = 1 answer** |
| **Orga porteuse** | slug `associationEkilibre`, `_id 692817af564b0621d52ebbc6`, type `organizations` (résolu au boot via `GET_ELEMENTS_KEY`) |
| **Backend (dev)** | `http://communecter74-dev` (`.env` : `VITE_SLUG=associationEkilibre`) ; backend de prod **à définir** |
| **SDK** | `@communecter/cocolight-api-client` — lecture seule. Requis **`^1.0.169`** (merge du 30/07), installé **1.0.152** → `npm install` requis (§10.3) |
| **Branche site-json** | **`ekilibre`** (suit `origin/ekilibre`) ; merge `main` → `ekilibre` le 30/07 (`6f4e83bf`). **Lot créneaux en working tree, non commité** (§9.2) |
| **Intervenants (git)** | Francki (init 02/07) · Nicolas (config 20/07 et 28/07) · Peterson (lot créneaux 06/07) ; chef de projet **à confirmer** |

### Historique des chantiers

- **02/07 — init** (`9ee0024a`, Francki) : `feat: init ekilib.re` — config 10 pages (accueil,
  `/creneaux`, s'informer, rejoindre/soutenir, partenaires, espace pro, contact, 3 pages légales),
  header `transparent-scroll`, footer `contact-partners`, thème teal/orange (oklch), fr/en.
- **06/07 — analyse + lot « créneaux » (Peterson, non commité)** : analyse fonctionnelle complète
  ([`FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md)) + inventaire endpoints ; puis
  implémentation **création/modification de créneau** : `addButton.coform` (bouton « Ajouter un
  créneau », admins) + `preview.editButton` (bouton « Modifier » sur le détail), `CoFormModal` lazy,
  helper pur `getAnswerRef` (+ 9 tests), invalidations search, i18n fr/en. 3 fiches d'endpoints
  manquants déposées dans [`ENDPOINT.md`](../../ENDPOINT.md). Détail au §9.2.
- **20/07** (`63fe84f0`, Nicolas) : images du site (`public/images/maisonSportSanteLaTampon/` :
  hero2/hero3, logo MSS, pictogramme) + **filtre implicite `state = "Validé"`** sur `/creneaux`
  (modération par champ : seuls les créneaux validés sont listés).
- **28/07** (`ba93f7a0`, Nicolas) : **page `/structure`** (« Structure référentes ») — annuaire des
  organizations du costum SSBE (CP 97430/97418), cartes `contact-card` + drawer, 2 dropdowns :
  code postal (97430/97418) et **domaine d'intervention** (11 valeurs sur `tags`). Entrée nav ajoutée.
- **30/07 — merge `main` → `ekilibre`** (`6f4e83bf`) : rattrapage de ~304 commits de `main` —
  modules `blog`/`admin`, migration carte **Leaflet → MapLibre**, SDK requis `^1.0.169`, nouveaux
  scripts (`config:init/probe/render/fix`, `verify:build`, `admin:scaffold`), capacités search
  `itemRules`/`itemAction`/`colorBy`. ⚠️ **`npm install` non relancé** depuis (§10.3).

---

## 2. Objectifs de la configuration

1. **Un site vitrine** (nav 5 entrées : Créneaux · S'informer · Structures · Partenaires · Contact,
   CTA « Espace Pro ») présentant la MSS, le parcours sport santé et ses partenaires.
2. **L'annuaire des créneaux** (`/creneaux`) : recherche texte + 4 filtres (type d'activité,
   bénéficiaires, type sport santé SSsO/SSpT, public), **vue carte**, détail en dialog — restreint
   aux créneaux **validés** des CP **97430/97418**.
3. **La gestion des créneaux par les admins** : créer et modifier un créneau (= une answer du CoForm
   `6928096adf5caf0d230e7f26`) **sans quitter le site** (CoFormModal) — lot du 06/07, à committer.
4. **L'annuaire des structures référentes** (`/structure`) : organizations SSBE du territoire,
   filtres CP + domaine d'intervention.
5. **Le flux d'actualités** de l'association (home, lecture seule) + **auth** (espace pro → `/login`).
6. **Un formulaire de contact** opérationnel (aujourd'hui cassé — endpoint inexistant, §12).

---

## 3. Architecture générale

```
            Communecter (communecter74-dev) / costum sportSanteBienetre
     answers du CoForm 6928096adf5caf0d230e7f26 (créneaux) · organizations (structures) · news
                  ▲ GLOBAL_AUTOCOMPLETE_COSTUM · GET_NEWS · SAVE_COFORM_ANSWER
                  │
   ┌────────────── SiteForge (site-json, branche ekilibre) ───────────────┐
   │  config.prod.maison-sport-sante-la-tampon.json → SiteRenderer        │
   │   /creneaux : searchHeader (4 dropdowns) + searchProStatic           │
   │     baseParams.defaultFilters = { form, CP $in, state:"Validé" }     │
   │     addButton.coform → CoFormModal (création)  [lot 06/07]           │
   │     preview.editButton → CoFormModal (édition) [lot 06/07]           │
   │   /structure : searchProStatic organizations (source.key SSBE + CP)  │
   │   / : news (entitySlug associationEkilibre)                          │
   └──────────────────────────────────────────────────────────────────────┘
          dev : VITE_SLUG=associationEkilibre (.env) → :5173
```

**Deux voies de filtrage** (toutes config-driven, cf. [doc/07](../doc/07-module-search.md)) :
- **figée** : `baseParams.defaultFilters` — sur `/creneaux` : `form`, `postalCode.$in
  [97430,97418]` (champ adresse de l'answer) et `state:"Validé"` ; sur `/structure` :
  `source.key:"sportSanteBienetre"` + `postalCode.$in`.
- **interactive** : `dropdownFilters[].field` (dot-path `answers.<formKey>.<fieldKey>`) →
  `searchByFieldsToQuery` → `{ field: { $in: [...] } }` fusionné dans `defaultFilters`.

**Cycle de vie d'un créneau** (lot 06/07) : pas d'endpoint « create » — `form.answer()` (draft
local) → `answer.save()` → `SAVE_COFORM_ANSWER` (sans `answerId` = création, avec = édition).
L'édition **re-fetch l'answer fraîche** (`useCoFormAnswerQuery`) avant d'ouvrir la modale : les
résultats de recherche peuvent être tronqués et le save renvoie le payload **complet** — pré-remplir
depuis l'item de recherche effacerait des champs. Après save : invalidation
`SEARCH_QUERY_KEYS.RESULTS_PREFIX` (liste + carte) + `COFORM_QUERY_KEYS.FORM_ANSWER`.

> ⚠️ Le mapping rôle→champ du créneau (titre, type, état, horaires, adresse…) vit dans
> **`DEFAULT_COFORM_FIELDS`** ([`lib/coformAnswer.ts`](../src/modules/search/lib/coformAnswer.ts)),
> surchargeable par `preview.fields` en config. Les suffixes (`…mdegc9sgox76p87n27` = titre,
> `…mdn1jcq445i0mb9bap7` = état, `…mdr0xcsmmpnr6ez17q` = adresse…) sont ceux du form SSBE.

---

## 4. Cahier des charges (intégré)

**Aucun CDC formel n'est disponible dans le dépôt** — le périmètre ci-dessous est reconstitué de la
config et des échanges (à faire valider). Budget/phasage : **à confirmer**.

| Domaine | Exigence (reconstituée) | Réalisation |
|---|---|---|
| Vitrine | présentation MSS, parcours d'inscription, idées reçues, bénéfices APA | pages `/`, `/s-informer` (statiques) |
| Créneaux | annuaire filtrable + carte, réservé au territoire (Tampon/St-Joseph), créneaux validés seulement | `/creneaux` (searchProStatic answers) |
| Gestion créneaux | ajout + modification par les admins, depuis le site | lot 06/07 (`addButton.coform`, `editButton`) |
| Structures | annuaire des structures référentes + domaines d'intervention | `/structure` (28/07) |
| Engagement | bénévolat, comité des usagers, don (HelloAsso en lien externe) | `/rejoindre-soutenir` (hors nav, liée depuis la home) |
| Pros de santé | ressources, prescription, PandaLab, connexion | `/espace-pro` (CTA header) + auth |
| Contact | formulaire 7 champs (RGPD) | `/contact` — **non opérationnel** (§12) |
| Légal | mentions, confidentialité, accessibilité | 3 pages `html` |

---

## 5. Modèle de données réel

> L'accès base directe n'est pas disponible sur ce poste — chiffres **à confirmer** (mes comptages
> via SDK/curl du 31/07 ont échoué sur la validation du payload `GLOBAL_AUTOCOMPLETE_COSTUM` ;
> relevé navigateur à faire). Ce qui est **prouvé** au 31/07 :

- **Entité porteuse** : slug `associationEkilibre` → `{contextId: 692817af564b0621d52ebbc6,
  contextType: organizations}` (répondu par `/co2/slug/getinfo` le 31/07) — le boot du site marche.
- **Créneaux** = answers du CoForm `6928096adf5caf0d230e7f26`, champs sous
  `answers.sportSanteBienetre2172025_854_0.<fieldKey>` ; le site n'affiche que
  `state="Validé"` **et** CP ∈ {97430, 97418} → un créneau saisi sans état validé ou hors zone est
  **invisible, sans erreur**.
- **Structures** = organizations `source.key="sportSanteBienetre"` + CP ∈ {97430, 97418} ;
  domaine d'intervention = valeurs libres de `tags` (11 options littérales dans la config).
- **Volumétrie** : nombre de créneaux/structures en base **à confirmer** (le SSR du 31/07 rend les
  pages 200 mais les listes en skeleton — prefetch non observé, cf. §10.3).

> ⚠️ **Valeurs littérales exactes.** Les options des dropdowns (`"Sports collectifs"`,
> `"Santé/prévention"`, `"Sport santé sur ordonnance - SSsO"`…) et le `state` (`"Validé"`, avec
> accent) doivent correspondre **au caractère près** aux valeurs saisies dans les answers/tags —
> un écart renvoie 0 résultat sans erreur. Copier-coller depuis le form/costum, ne jamais retaper.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| **Config & CSS** | [`config.prod.maison-sport-sante-la-tampon.json`](../config.prod.maison-sport-sante-la-tampon.json) · `src/index-sport-sante-bien-etre.css` (partagé SSBE) · [`sites.json`](../sites.json) |
| **Lot créneaux (06/07, non commité)** | `src/modules/search/schema.ts` (`addButton.coform`, `preview.editButton`) · `SearchProStatic.tsx` (bouton + CoFormModal lazy + invalidation) · `components/preview/PreviewCoformAnswer.tsx` (bouton Modifier + re-fetch) · `components/Preview.tsx` (pass-through `preview`) · `lib/coformAnswer.ts` (`getAnswerRef`) + `lib/coformAnswer.test.ts` (nouveau) · `constants/queryKeys.ts` (préfixes partagés) · `i18n/fr.json`/`en.json` (`coformAnswer.edit`) · `modules/coform/components/CoFormModal.tsx` (export default) · `modules/coform/index.ts` (barrel `useCoFormAnswerQuery`) |
| **Rendu créneau (lecture)** | `components/card/CardAnswer.tsx` (⚠️ modif locale non commitée : slug `sportSanteBienetre` en dur) · `lib/coformAnswer.ts` (`DEFAULT_COFORM_FIELDS`, `parseCoformAnswer`) |
| **Assets** | `public/images/maisonSportSanteLaTampon/` (hero, hero2/3, logo, logo-mss, pictogramme) |
| **Docs workspace** | [`../../FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md) · [`../../ENDPOINT.md`](../../ENDPOINT.md) |
| **Déploiement** | `server/prod-server.js` · `.env` (`VITE_SLUG=associationEkilibre`, `VITE_BASE_URL_BACKEND`, `PORT`) — prod à définir |

---

## 7. Choix techniques et leur pourquoi

| Décision | Pourquoi |
|---|---|
| **Sous-site du costum `sportSanteBienetre`** (pas un costum dédié) | les créneaux/structures existent déjà dans SSBE ; Ekilibre est une **vue territoriale** (CP 97430/97418) — zéro duplication de données |
| **CSS partagé `index-sport-sante-bien-etre`** | même identité visuelle que le site régional ; un thème dédié serait à créer si la DA diverge |
| **1 créneau = 1 answer CoForm** (pas un POI/event) | le form SSBE `…854_0` porte déjà tous les champs métier (horaires, bénéficiaires, adresse) ; le moteur search sait lister des answers (`defaultTypes:["answers"]` + `filters.form`) |
| **`addButton.coform` / `preview.editButton` = opt-in config** | 2 autres sites utilisent `card-answer`/`coform-answer` (SSBE) — sans ces flags, **comportement strictement inchangé** ailleurs |
| **CoFormModal (pas la route `/coform/:formId`)** | l'admin reste sur `/creneaux`, et le save invalide la liste immédiatement (la route perdrait l'état des filtres) |
| **Re-fetch frais avant édition** (`useCoFormAnswerQuery`) | le save coform renvoie le payload **complet** ; pré-remplir depuis l'item de recherche (potentiellement tronqué) effacerait des champs |
| **Modération par champ `state="Validé"`** (filtre figé, 20/07) | pas de gate backend `toBeValidated` sur ce flux ; le champ état du form fait office de modération — simple mais **dépend de la saisie** (§12) |
| **Filtre CP figé dans `defaultFilters`** | périmètre territorial garanti côté requête (pas seulement à l'affichage) |

---

## 8. Étapes de mise en place

1. **Config** : `config.prod.maison-sport-sante-la-tampon.json` + entrée `sites.json`
   (`associationEkilibre` → config + CSS SSBE). ✅
2. **Dev** : `.env` avec `VITE_SLUG=associationEkilibre`, `VITE_BASE_URL_BACKEND=http://communecter74-dev`
   (**sans guillemets** — une valeur quotée fait échouer le préflight `environment`), puis
   `nvm use` + `npm run dev` → :5173. ⚠️ Prérequis poste : `fs.inotify.max_user_watches=524288`
   (réglé le 06/07 sur le poste de Peterson).
3. **Après le merge du 30/07** : `npm install` (MapLibre + SDK 1.0.169), puis re-passer les gates. ❌
4. **Validation** (gates) : `npm run config:validate -- config.prod.maison-sport-sante-la-tampon.json`
   · `npm run audit:config -- --file …` · `npm run typecheck` · `npm run lint` · `npm run test:unit`
   · `npm run build` (+ `npm run verify:build` depuis le merge).
5. **Commit / MR du lot créneaux** (working tree → branche → MR vers `main`). ❌
6. **Déploiement** : backend de prod + DNS **à définir** ; build mono-slug
   (`VITE_SLUG=associationEkilibre`, `SITE_CONFIG_PATH=./config.prod.maison-sport-sante-la-tampon.json`,
   `SITE_PUBLIC_URL=<domaine>`). ❌

---

## 9. Impacts des modifications

### 9.1 Init + config Nicolas (02→28/07, commitées)

`9ee0024a` (10 pages) → `63fe84f0` (images + filtre `state="Validé"`) → `ba93f7a0` (page
`/structure` + 2 dropdowns). Config à 11 pages / 44 sections, nav 5 entrées + CTA Espace Pro.
Pages hors nav (liées depuis la home/footer) : `/rejoindre-soutenir`, `/espace-pro`, 3 légales.

### 9.2 Lot « créneaux » (06/07, Peterson — **working tree, non commité**)

**Moteur** (opt-in, sans effet sans config) : `AddButtonConfigSchema.coform` (le bouton « Ajouter »
existant — déjà gated `permissions.isAdmin` + login — ouvre un `CoFormModal` de création au lieu
d'une modale d'entité, chunk coform chargé **au 1er clic**) ; `PreviewConfSchema.editButton`
(bouton « Modifier » admin sur le détail `coform-answer`, re-fetch frais puis `CoFormModal`
d'édition) ; préfixes de queryKey `searchCostumStatic(MapAll)` extraits en constantes partagées ;
helper pur `getAnswerRef` + **9 tests** ; fix pass-through `preview` dans `Preview.tsx` ;
`export default CoFormModal` ; clé i18n `coformAnswer.edit` fr/en.

**Config** : `addButton {show, coform, label}` + `preview.editButton:true` sur `creneaux-list`.

**Gates au 06/07** (avant le merge du 30/07) : lint 0 erreur sur le lot · unit 1537 ✅ (dont les 9
nouveaux) · `config:validate` ✅ · parité i18n ✅ · typecheck : uniquement les 2 erreurs
pré-existantes SDK (`deleteFiles`, `inviteByEmail`) · intégration SSR : échecs **identiques sur
arbre propre** (cause : le `.env` fait servir la config Ekilibre au serveur de test qui attend la
démo — environnemental, prouvé par stash).

**Reste sur ce lot** : commit + MR ; recette navigateur connecté en admin (créer/modifier un vrai
créneau) ; la **suppression de fichiers uploadés à l'édition** dépend de `Answer.deleteFiles`
(SDK ≥ 1.0.158, cf. §11).

### 9.3 Merge `main` → `ekilibre` (30/07, `6f4e83bf`)

Rattrapage ~304 commits : modules `blog`/`admin`, **Leaflet → MapLibre** (la vue carte de
`/creneaux` passe sur `SearchMap` MapLibre), SDK `^1.0.169`, scripts `config:*`/`verify:build`,
capacités search `itemRules`/`itemAction`/`colorBy`/`searchTargets` (utilisables par Ekilibre mais
non configurées ici). **Régressions à revalider après `npm install`** : vue carte `/creneaux`
(MapLibre + clé MapTiler ?), rendu des cartes `card-answer` dans le nouveau `SearchListView`,
comportement du lot créneaux (aucun conflit git constaté — les fichiers du lot restent en `M`).

### 9.4 Gates — mesurés le 31/07 (avant `npm install`)

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ **11 pages, 44 sections** |
| `audit:config` (fichier ciblé) | ✅ **RAS** (0 constat : trad/liens/assets/strip/prereq/theme) |
| `typecheck` | ❌ **23 erreurs — toutes causées par `node_modules` désynchronisé** : deps MapLibre absentes (`maplibre-gl`, `react-map-gl`, `supercluster`, `@maptiler/sdk`) + SDK 1.0.152 vs `^1.0.169` (`deleteFiles`, `inviteByEmail`, `toCsv`, `previewImport`, `MeLike`). **0 causée par le lot créneaux** |
| `lint` (périmètre lot) | ✅ 0 erreur (1 warning pré-existant `usePageFiltersUrlSync`) |
| Serveur dev | ✅ boote malgré les deps manquantes ; `/`, `/creneaux`, `/structure` → **200** ; listes en skeleton au SSR (prefetch non observé — à revoir après `npm install`) |
| `test:unit` / `build` / e2e | non relancés depuis le merge — **à passer après `npm install`** ; aucun spec e2e Ekilibre n'existe |

---

## 10. Checklist d'avancement

### Lot A — Vitrine & annuaires (config)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| A.1 | Site vitrine (home, s'informer, rejoindre, partenaires, espace pro, légal) | ✅ | 11 pages validées ; audit 0 constat |
| A.2 | Annuaire des créneaux `/creneaux` (4 filtres + carte + détail dialog) | ✅ config | filtres figés CP + `state="Validé"` ; **vue carte à recetter** post-merge MapLibre (`npm install` requis) |
| A.3 | Annuaire structures `/structure` (CP + domaine d'intervention) | ✅ config | 28/07 (Nicolas) ; volumétrie des orgas **à confirmer** |
| A.4 | Flux d'actualités (home, lecture seule) | ✅ | `entitySlug associationEkilibre` → `GET_NEWS` |
| A.5 | Auth / Espace Pro | ✅ | CTA header → `/espace-pro` → `/login` (module auth) |
| A.6 | Chiffres clés de la home | 🟡 | **codés en dur** (24 créneaux, 8 activités…) — se désynchroniseront du réel |
| A.7 | Formulaire de contact | ❌ | poste sur `/api/contact` **qui n'existe pas** (ni Express ni SDK) — fiche `CONTACT_SEND_URL` dans [`ENDPOINT.md`](../../ENDPOINT.md) |

### Lot B — Gestion des créneaux (admins)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| B.1 | Bouton « Ajouter un créneau » (création, admins) | 🟡 | **code fait (06/07), non commité** ; CoFormModal + invalidation liste/carte ; recette navigateur connecté à faire |
| B.2 | Bouton « Modifier » sur le détail (admins) | 🟡 | idem — re-fetch frais anti-perte de champs ; recette à faire |
| B.3 | Suppression de fichiers à l'édition | ❌ SDK | `answer.deleteFiles` absent du SDK installé (1.0.152) — **vérifier si 1.0.169 l'apporte** après `npm install` ; sinon fiche `DELETE_COFORM_ANSWER_FILE` ([`ENDPOINT.md`](../../ENDPOINT.md)) |
| B.4 | Suppression d'un créneau | ❌ | non câblé (SDK `Answer.delete()` existe ; hook front `useDeleteAnswer` à créer via `createCoFormMutation`) |
| B.5 | Commit + MR du lot | ❌ | 11 fichiers `M` + 1 test nouveau en working tree sur `ekilibre` |

### Lot C — Industrialisation & mise en ligne

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| C.1 | `npm install` post-merge + gates verts | ❌ | 23 erreurs typecheck tant que MapLibre/SDK 1.0.169 ne sont pas installés |
| C.2 | Recette navigateur complète (dont carte MapLibre) | ❌ | jamais faite depuis le merge du 30/07 |
| C.3 | Spec e2e Ekilibre | ❌ | aucun `e2e/*.spec.ts` pour ce site (modèle : `parent62.spec.ts`, lecture seule, ciblé) |
| C.4 | Volumétrie réelle (créneaux/structures en base) | ❌ | à relever (navigateur ou base) — comptages SDK du 31/07 non concluants |
| C.5 | Déploiement (backend prod, DNS, build mono-slug) | ❌ | rien de défini ; docker-compose ne référence pas ce site |

---

## 11. Dépendances site-json ↔ cocolight-api-client

SDK en **lecture seule** — toute évolution passe par une fiche dans [`ENDPOINT.md`](../../ENDPOINT.md)
(racine du workspace). Fiches déposées le 06/07 :

| Demande | Sévérité | État au 31/07 |
|---|---|---|
| **`DELETE_COFORM_ANSWER_FILE`** + `Answer.deleteFiles(docIds[])` (suppression batch answer-side, auth save/upload) | 🔴 bloquant typecheck (`file.ts:167`) | SDK requis passé à `^1.0.169` au merge — **vérifier après `npm install`** si la méthode y est ; sinon la fiche reste due |
| **`CONTACT_SEND_URL`** (formulaire de contact) — ou route Express locale `/api/contact` | 🔴 fonctionnalité cassée | aucune évolution constatée |
| Alias générique de `COFORM_ANSWERS_BY_FORMS` (hors controller `/costum/francetierslieux/*`) | 🟡 conditionnel | requis seulement si on liste/édite les créneaux **depuis la fiche d'une structure** (pattern tiers-lieux) |

Rappel : la création/modification d'un créneau ne demande **aucun nouvel endpoint**
(`SAVE_COFORM_ANSWER` couvre les deux, `GET_COFORM_BY_ID`/`COFORM_ANSWERS_BY_ID` pour le
chargement, `GLOBAL_AUTOCOMPLETE_COSTUM` pour la liste).

---

## 12. Points d'attention / limitations

- **Lot créneaux non commité** : 11 fichiers modifiés + 1 test en working tree sur `ekilibre` —
  fragile (un `git checkout`/`stash` mal placé le perd). À committer en priorité.
- **`node_modules` désynchronisé** depuis le merge du 30/07 : typecheck rouge (23 erreurs), carte
  MapLibre non testable, SDK 1.0.152. **`npm install` d'abord**, puis re-passer les gates.
- **Modération = champ `state`** : un créneau dont l'état n'est pas exactement `"Validé"` est
  invisible sur `/creneaux` — vérifier que le form pose bien ce champ (et qui a le droit de le
  changer). Idem **CP hors 97430/97418** ou answer sans adresse → invisible, sans erreur.
- **Clés et valeurs dupliquées config ↔ form** : les suffixes de champs
  (`sportSanteBienetre2172025_854_0…`) et les valeurs d'options (littéraux exacts, accents
  compris) apparaissent dans les `dropdownFilters`, les `defaultFilters` **et**
  `DEFAULT_COFORM_FIELDS` — toute modification du CoForm SSBE casse silencieusement filtres et
  cartes. Même famille de piège sur `/structure` (valeurs de `tags`).
- **`CardAnswer.tsx` : slug `sportSanteBienetre` en dur** (modif locale non commitée, antérieure au
  lot créneaux) — contraire au config-driven ; à re-brancher sur `preview.fields`/slug d'entité ou à
  assumer par commentaire.
- **Chiffres clés de la home en dur** ; les 8 cartes pathologies pointent vers `/creneaux` **sans
  filtre pré-appliqué** (les dropdowns ne couvrent pas les pathologies).
- **Le détail d'un créneau ne re-fetch pas** (parse l'item de la recherche) : si le backend tronque
  des champs dans `globalautocomplete`, le dialog est incomplet. L'**édition**, elle, re-fetch (lot 06/07).
- **`.env`** : valeurs **sans guillemets** (une valeur quotée fait échouer le préflight
  `environment` — vécu le 06/07). Poste dev : limite inotify relevée à 524 288 (06/07).
- **Don HelloAsso** = lien externe (le endpoint serveur `/api/helloasso/checkout-intent` existe mais
  n'est pas branché pour ce site).
- **CSS partagé avec SSBE** : un changement de thème SSBE impacte Ekilibre (et réciproquement).

---

## 13. Évolutions à prévoir & questions en attente

| Évolution / question | Pour qui |
|---|---|
| **Committer le lot créneaux** (+ MR `ekilibre` → `main`) | Peterson |
| **`npm install`** puis gates complets (typecheck/unit/build/`verify:build`) + recette carte MapLibre | Peterson |
| **SDK 1.0.169 : contient-il `Answer.deleteFiles`** ? (sinon relancer la fiche `DELETE_COFORM_ANSWER_FILE`) | Peterson → Thomas |
| **Formulaire de contact** : endpoint SDK (`CONTACT_SEND_URL`) ou route Express locale — trancher | Thomas / Peterson |
| **Recette création/modification d'un créneau** en admin (navigateur, backend réel) | Peterson / MSS |
| **Volumétrie réelle** : combien de créneaux validés CP 97430/97418 ? de structures ? | MSS / réseau SSBE |
| **Qui valide les créneaux** (passage `state` → `"Validé"`) et où — process de modération à documenter | MSS / réseau SSBE |
| **`useDeleteAnswer`** (suppression de créneau) — si le besoin est confirmé | Peterson |
| **Spec e2e Ekilibre** (lecture seule, modèle parent62) | Peterson |
| **Chiffres clés dynamiques** sur la home (compter les answers au lieu du dur) | Peterson / MSS |
| **Filtres pathologies** : pré-appliquer un filtre depuis les cartes de la home ? | MSS |
| **Backend de prod + domaine** (DNS, build mono-slug) | MSS / Thomas |
| Chef de projet / budget / phasage du CDC | à confirmer |
