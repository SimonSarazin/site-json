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

Dernière mise à jour : **2026-07-31** (session 2 : **auto-inscription structure**, en cours,
**non commitée** — costumForm `structure-ekilibre` via le moteur `formEngine` ; gates repassés,
régression `node_modules` détectée §9.4/§12 ; détails de configuration locale (`.env`) retirés du
document à la demande de l'utilisateur).

<details><summary>Historique des sessions précédentes (31/07, session 1)</summary>

création ; collecte git/config/gates ; revue « bonnes pratiques » + correctifs §9.2 bis ; inputs
coform §9.2 ter ; **lots commités** : `20fc3529` + `2bf81496` + doc `86a6f023` — **poussés sur
`origin/ekilibre`** (vérifié : `ekilibre` = `origin/ekilibre`, 0 commit d'écart).

</details>

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
| **Backend (dev)** | environnement de dev local (configuration hors de ce document) ; backend de prod **à définir** |
| **SDK** | `@communecter/cocolight-api-client` — lecture seule. Requis **`^1.0.169`** (merge du 30/07) ; installé **1.0.158** au 31/07 (session 2) → **`npm install` de nouveau requis** (régression, §9.4) |
| **Branche site-json** | **`ekilibre`** (suit `origin/ekilibre`, **0 commit d'écart** — les 3 commits de la session 1 sont poussés). **Working tree modifié (non commité)** au 31/07 (session 2) : costumForm `structure-ekilibre` (§9.5) |
| **Intervenants (git)** | Francki (init 02/07) · Nicolas (config 20/07 et 28/07) · Peterson (lot créneaux 06/07) ; chef de projet **à confirmer** |

### Historique des chantiers

- **02/07 — init** (`9ee0024a`, Francki) : `feat: init ekilib.re` — config 10 pages (accueil,
  `/creneaux`, s'informer, rejoindre/soutenir, partenaires, espace pro, contact, 3 pages légales),
  header `transparent-scroll`, footer `contact-partners`, thème teal/orange (oklch), fr/en.
- **06/07 — analyse + lot « créneaux » (Peterson ; commité le 31/07, `2bf81496`)** : analyse fonctionnelle complète
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
- **31/07 (session 2, en cours, non commité) — auto-inscription structure** : bouton public
  « Ajouter ma structure » sur `/structure` (`buttons` du `searchHeader`, contrat générique
  `ActionButtonSchema` + `<ActionButtonGroup>`/`DynamicModalButton`, **modules/profil** — zéro
  code nouveau pour le bouton) ouvrant le **premier costumForm du site** :
  `costumForms["structure-ekilibre"]` (moteur **formEngine**, cf. [doc/28](../doc/28-module-formengine.md)),
  wizard 5 étapes (structure · contact · légal · représentant · responsable). Seule clé de code
  ajoutée : `src/modules/profil/forms/costum/structure-ekilibre/fns.ts` (transform pur
  `thematic` → `tags`, cf. §9.5). Détail au §9.5.

---

## 2. Objectifs de la configuration

1. **Un site vitrine** (nav 5 entrées : Créneaux · S'informer · Structures · Partenaires · Contact,
   CTA « Espace Pro ») présentant la MSS, le parcours sport santé et ses partenaires.
2. **L'annuaire des créneaux** (`/creneaux`) : recherche texte + 4 filtres (type d'activité,
   bénéficiaires, type sport santé SSsO/SSpT, public), **vue carte**, détail en dialog — restreint
   aux créneaux **validés** des CP **97430/97418**.
3. **La gestion des créneaux par les admins** : créer et modifier un créneau (= une answer du CoForm
   `6928096adf5caf0d230e7f26`) **sans quitter le site** (CoFormModal) — commité le 31/07.
4. **L'annuaire des structures référentes** (`/structure`) : organizations SSBE du territoire,
   filtres CP + domaine d'intervention. **+ auto-inscription** : toute structure peut se référencer
   elle-même via un formulaire public (costumForm `structure-ekilibre`, en cours §9.5).
5. **Le flux d'actualités** de l'association (home, lecture seule) + **auth** (espace pro → `/login`).
6. **Un formulaire de contact** opérationnel (aujourd'hui cassé — endpoint inexistant, §12).

---

## 3. Architecture générale

```
            Communecter (backend dev) / costum sportSanteBienetre
     answers du CoForm 6928096adf5caf0d230e7f26 (créneaux) · organizations (structures) · news
                  ▲ GLOBAL_AUTOCOMPLETE_COSTUM · GET_NEWS · SAVE_COFORM_ANSWER
                  │
   ┌────────────── SiteForge (site-json, branche ekilibre) ───────────────┐
   │  config.prod.maison-sport-sante-la-tampon.json → SiteRenderer        │
   │   /creneaux : searchHeader (4 dropdowns) + searchProStatic           │
   │     baseParams.defaultFilters = { form, CP $in, state:"Validé" }     │
   │     addButton.coform → CoFormModal (création)  [lot 06/07]           │
   │     preview.editButton → CoFormModal (édition) [lot 06/07]           │
   │   /structure : searchProStatic organizations (source.key $in SSBE+  │
   │     Ekilibre + CP) + bouton "Ajouter ma structure" → costumForm      │
   │     structure-ekilibre [session 2, non commité]                     │
   │   / : news (entitySlug associationEkilibre)                          │
   └──────────────────────────────────────────────────────────────────────┘
          dev : variables d'environnement locales (.env, non détaillées ici) → :5173
```

**Deux voies de filtrage** (toutes config-driven, cf. [doc/07](../doc/07-module-search.md)) :
- **figée** : `baseParams.defaultFilters` — sur `/creneaux` : `form`, `postalCode.$in
  [97430,97418]` (champ adresse de l'answer) et `state:"Validé"` ; sur `/structure` :
  `source.key.$in ["sportSanteBienetre", "associationEkilibre"]` (élargi le 31/07, §9.5) +
  `postalCode.$in`.
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
- **Structures** = organizations `source.key ∈ {"sportSanteBienetre", "associationEkilibre"}` + CP
  ∈ {97430, 97418} ; domaine d'intervention = valeurs libres de `tags` (**11 options** littérales
  dans la config, vérifiées le 31/07 contre `structure-ekilibre.fields.thematic` — cf. §9.5). Le
  second `source.key` (`associationEkilibre`, entité porteuse d'Ekilib.re) a été **ajouté le 31/07**
  (session 2) : une structure auto-inscrite via le formulaire (`scope.slugFrom: carrier`) porte ce
  `source.key`, pas `sportSanteBienetre` — sans cet élargissement elle serait invisible sur la page
  même qui l'a créée.
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
| **Lot créneaux (06/07, commité le 31/07 — `2bf81496`)** | `src/modules/search/schema.ts` (`addButton.coform`, `preview.editButton`) · `SearchProStatic.tsx` (bouton + CoFormModal lazy + invalidation) · `components/preview/PreviewCoformAnswer.tsx` (bouton Modifier + re-fetch) · `components/Preview.tsx` (pass-through `preview`) · `lib/coformAnswer.ts` (`getAnswerRef`) + `lib/coformAnswer.test.ts` (nouveau) · `constants/queryKeys.ts` (préfixes partagés) · `i18n/fr.json`/`en.json` (`coformAnswer.edit`) · `modules/coform/components/CoFormModal.tsx` (export default) · `modules/coform/index.ts` (barrel `useCoFormAnswerQuery`) |
| **Droits d'édition (31/07)** | `lib/coformAnswer.ts` (`canEditCoformAnswer`, `getAnswerStructureId`) + `lib/coformAnswer.test.ts` · réutilise `modules/admin/lib/adminEntry.ts` (`resolveAdminAccessLevel`, non modifié) |
| **Rendu créneau (lecture)** | `components/card/CardAnswer.tsx` (intact — le remap de slug vit dans `parseCoformAnswer`) · `lib/coformAnswer.ts` (`DEFAULT_COFORM_FIELDS`, `parseCoformAnswer`) |
| **Auto-inscription structure (31/07, session 2, non commité)** | `config.prod.maison-sport-sante-la-tampon.json` (`costumForms["structure-ekilibre"]`, `buttons` du `searchHeader` `/structure`, `defaultFilters.source.key.$in`) · `src/modules/profil/forms/costum/structure-ekilibre/fns.ts` (**seul fichier de code**, transform `structure:tagsFromThematic`) · `src/modules/profil/forms/registerSpecFns.ts` (barrel, +1 ligne) · `src/modules/profil/forms/costum/__fixtures__/configCostum.ts` (fixture test, +1 ligne) · `src/modules/profil/forms/structure-ekilibre.configDriven.test.ts` (nouveau, 37 tests) — moteur réutilisé tel quel : `formEngine` (doc/28), `ActionButtonSchema`/`<ActionButtonGroup>`/`DynamicModalButton` (modules/profil, préexistants) |
| **Assets** | `public/images/maisonSportSanteLaTampon/` (hero, hero2/3, logo, logo-mss, pictogramme) |
| **Docs workspace** | [`../../FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md) · [`../../ENDPOINT.md`](../../ENDPOINT.md) |
| **Déploiement** | `server/prod-server.js` · variables d'environnement (`.env` local, non détaillées ici) — prod à définir |

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
| **Auto-inscription = costumForm `formEngine` + `buttons` génériques** (aucun composant nouveau) | le contrat `ActionButtonSchema`/`<ActionButtonGroup>`/`DynamicModalButton` (modules/profil) et le moteur `formEngine` (doc/28) existaient déjà (merge du 30/07) ; Ekilibre n'ajoute que de la **config** + 1 transform pur (`thematic`→`tags`) |
| **`requiresAdmin: false` sur le bouton « Ajouter ma structure »** | auto-inscription ouverte à tout visiteur (non connecté → redirigé login par `DynamicModalButton`) — la structure créée reste rattachée à son auteur (`role: admin` injecté au create) |
| **`source.key` élargi en `$in` plutôt que remplacé** | ne pas faire disparaître les structures SSBE existantes ; les deux sources (costum régional + auto-inscription locale) coexistent sur `/structure` |

---

## 8. Étapes de mise en place

1. **Config** : `config.prod.maison-sport-sante-la-tampon.json` + entrée `sites.json`
   (`associationEkilibre` → config + CSS SSBE). ✅
2. **Dev** : configurer les variables d'environnement locales (`.env`, non détaillées dans ce
   document), puis `nvm use` + `npm run dev` → :5173. ⚠️ Prérequis poste :
   `fs.inotify.max_user_watches=524288` (réglé le 06/07 sur le poste de Peterson).
3. **Après le merge du 30/07** : `npm install` (MapLibre + SDK 1.0.169), puis re-passer les gates. ❌
4. **Validation** (gates) : `npm run config:validate -- config.prod.maison-sport-sante-la-tampon.json`
   · `npm run audit:config -- --file …` · `npm run typecheck` · `npm run lint` · `npm run test:unit`
   · `npm run build` (+ `npm run verify:build` depuis le merge).
5. **Commit / MR du lot créneaux** (working tree → branche → MR vers `main`). ❌
6. **Déploiement** : backend de prod + DNS **à définir** ; build mono-slug
   (`SITE_CONFIG_PATH=./config.prod.maison-sport-sante-la-tampon.json`, `SITE_PUBLIC_URL=<domaine>`,
   + variables d'environnement non détaillées ici). ❌

---

## 9. Impacts des modifications

### 9.1 Init + config Nicolas (02→28/07, commitées)

`9ee0024a` (10 pages) → `63fe84f0` (images + filtre `state="Validé"`) → `ba93f7a0` (page
`/structure` + 2 dropdowns). Config à 11 pages / 44 sections, nav 5 entrées + CTA Espace Pro.
Pages hors nav (liées depuis la home/footer) : `/rejoindre-soutenir`, `/espace-pro`, 3 légales.

### 9.2 Lot « créneaux » (06/07, Peterson — commité le 31/07, `2bf81496`)

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
arbre propre** (cause : configuration locale du serveur de test — environnemental, prouvé par stash).

**Reste sur ce lot** : commit + MR ; recette navigateur connecté en admin (créer/modifier un vrai
créneau) ; la **suppression de fichiers uploadés à l'édition** dépend de `Answer.deleteFiles`
(SDK ≥ 1.0.158, cf. §11).

### 9.2 bis Revue « bonnes pratiques » du lot + correctifs (31/07, dans `2bf81496`)

Revue du lot contre [`bonnes-pratiques-code.md`](../../bonnes-pratiques-code.md). Nécessité : 8 des
11 fichiers justifiés tels quels, 2 discutables, 1 annulé. Corrections appliquées :

| Constat | Correctif |
|---|---|
| **Fonctionnalité inerte** : `Preview.tsx` ne passait pas `preview` au variant `coform-answer` → `preview.editButton` (et `preview.fields`) toujours `undefined`, bouton « Modifier » jamais rendu. Le pass-through du 06/07 avait disparu au merge du 30/07 | pass-through rétabli. **Aucun effet sur SSBE** : son bloc est `{"type":"coform-answer"}` sans `fields` ni `editButton` |
| **Perte de données possible** : sur erreur de fetch (ou answer vide), la modale s'ouvrait quand même avec `defaultValues` vide → le save (payload COMPLET) écrasait la réponse | garde `answerError`/`answerData` avant montage, alignée sur `CoFormAnswerPage` |
| **Droits d'édition faux** : le gate reposait sur `permissions.isAdmin` du site, puis (1ʳᵉ correction) sur `answer.canEdit` du backend. Or `canEdit` est calculé sur la seule **propriété** de la réponse (`AnswerEditDeniedReason = not_logged_in \| not_owner \| form_inactive \| form_closed`) → **un super-admin ou un admin de costum est refusé** parce qu'il n'est pas l'auteur | règle métier explicite en helper pur `canEditCoformAnswer` : **super-admin plateforme** (`isSuperAdmin`/`isAdminPlatform`) **OU admin du costum** (entité porteuse, via `resolveAdminAccessLevel` du module admin — réutilisé, pas redupliqué) **OU admin validé de la structure organisatrice** (`me.links.memberOf[structureId].isAdmin`, hors pending/invitation). `canEdit` n'est plus un verrou. **8 tests** |
| **§4** : `answerRef` recréé à chaque render → deps de `handleEdited` instables, `useCallback` inopérant | `useMemo(() => getAnswerRef(item), [item])` |
| **Hors lot** : `CardAnswer.tsx` figeait le slug sur `sportSanteBienetre` (redondant — `parseCoformAnswer` fait déjà le remap) et cassait tout futur site en `card-answer`, plus 2 lignes commentées | **annulé** (`git checkout`) |
| **Empreinte du lot** : la 1ʳᵉ passe de correctifs avait élargi la dédup des préfixes de queryKey à 4 fichiers hors périmètre (+ 1 helper + 1 test) — 18 fichiers au total | ramené à **11 fichiers (10 `M` + 1 test)**, soit **1 de moins qu'avant la revue**. La dédup hors périmètre est **annulée** et tracée en dette dans le JSDoc de `queryKeys.ts` ; le barrel `coform/index.ts` (export sans consommateur) est annulé lui aussi |

Id de la structure porteuse : lu sur `serverData.structure._id`, **vérifié sur le payload SSR réel** de
`/creneaux` (encodage `{_str}` ; le helper accepte aussi `$oid`/`$id`/string, les 3 autres encodages
possibles selon le chemin de sérialisation).

`CoFormModal|default` reste listé par knip : faux positif de classe connue (la baseline contient déjà
`SmartCoForm|default`, les 6 `ProfileHeader…` — tous convertis pour `lazy()`).

**Gates 31/07 après correctifs** (post-`npm install`, cf. §9.4) : `lint` ✅ 0 erreur ·
`test:unit` search ✅ **318/318** (dont **17** sur `coformAnswer`) · `typecheck` ✅ **1 seule erreur,
pré-existante et hors lot** (`HeaderTransparentScroll` : variable inutilisée) · `config:validate` ✅
Ekilibre 11/44 **et** SSBE 19/61.

### 9.2 ter Lot « inputs CoForm manquants » (31/07, commité — `20fc3529`)

Le form créneau (`6928096adf5caf0d230e7f26`, **91 inputs** relus depuis le backend le 31/07) utilisait
3 types **absents du moteur coform** de site-json — le formulaire d'édition affichait « type de champ
inconnu » à leur place :

| Type legacy | Occurrences dans le form | Portage |
|---|---|---|
| `date` (+ `time`, `datetime-local`) | 5 champs (naissance, validité ×2, validation…) | mappé sur `TextField` avec `inputType` natif — la valeur reste l'ISO stocké (`"1998-09-18"`, vérifié en base) |
| `tpls.forms.cplx.timeSlots` | **1 champ = le cœur du créneau** (jour + plage horaire) | `TimeSlotsField` (répéteur) + logique pure `utils/timeSlots.ts` ; sauvegarde au format legacy vérifié `[{day:"Monday", startHour:"08", …}]` ; données 12h legacy (AmPm) lues et résolues en 24h |
| `tpls.forms.cplx.dynamicFields` | 2 champs (lieu de pratique CP+adresse, partenaires) | `DynamicFieldsField` (répéteur de lignes piloté par `fieldsConfig` admin : text/select/textarea/date/…, min/maxRows, layout) ; format vérifié `[{postalCode:"97430", placeName:"…"}]` |

Références : templates legacy `communecter-php74/modules/survey/views/tpls/forms/cplx/`
(`timeSlots.php`, `dynamicFields.php` + leurs docs). Pipeline complet branché : mapping
(`formParser`), configs `params` (coercion des nombres stockés en string par le PHP), schémas Zod
(complétude + fin > début + required/min/maxLength des sous-champs), defaults, rendu édition
(`DynamicCoForm`), rendu lecture (`CoFormReadOnly`), coercion anti-pollution `{}`↔`[]`, i18n fr/en.

**Gates** : coform **323 tests** ✅ (dont 15 `timeSlots` purs, 10 composants, 6 zod) · lint 0 erreur ·
typecheck 1 erreur pré-existante hors lot · parité i18n 46/46 ✅. **Reste** : recette navigateur
connecté (création + édition d'un créneau réel de bout en bout).

**Complément (31/07)** — bouton « Ajouter un créneau » rendu **public par config** : nouveau flag
générique `addButton.adminOnly` (schéma search, défaut `true` = comportement historique réservé aux
admins). Ekilibre pose `adminOnly: false` → le bouton s'affiche pour tous à côté du bouton Carte
(un non-connecté qui clique passe par le login) ; la modération reste le filtre `state="Validé"` en
aval. Seul site utilisateur d'`addButton` → aucun autre site impacté (vérifié sur les 12 configs).
⚠️ Piège découvert (vérifié en SSR live) : `SearchProStatic` a DEUX headers exclusifs — le standard
et le rendu `customHeader` ; `creneaux-list` étant en `customHeader: true`, le header standard (où
vivait le bouton) ne se rend jamais. Le bouton est factorisé (`addButtonElement`) et rendu dans les
deux, contre le bouton Carte.

### 9.3 Merge `main` → `ekilibre` (30/07, `6f4e83bf`)

Rattrapage ~304 commits : modules `blog`/`admin`, **Leaflet → MapLibre** (la vue carte de
`/creneaux` passe sur `SearchMap` MapLibre), SDK `^1.0.169`, scripts `config:*`/`verify:build`,
capacités search `itemRules`/`itemAction`/`colorBy`/`searchTargets` (utilisables par Ekilibre mais
non configurées ici). **Régressions à revalider après `npm install`** : vue carte `/creneaux`
(MapLibre + clé MapTiler ?), rendu des cartes `card-answer` dans le nouveau `SearchListView`,
comportement du lot créneaux (aucun conflit git constaté — les fichiers du lot restent en `M`).

### 9.4 Gates — mesurés le 31/07

> ⚠️ **Revalidé le 31/07 en session 2** (poste courant) : la ligne « `npm install` fait le 31/07 »
> ci-dessous **ne tient plus** — `node_modules` est de nouveau désynchronisé sur ce poste (SDK
> **1.0.158** installé, ≠ `^1.0.169` requis ; **`maplibre-gl`, `react-map-gl`, `@maptiler/sdk`,
> `supercluster` absents** de `node_modules` bien que présents dans `package.json`). Ce n'est **pas
> une régression du code** — probablement un `node_modules` non réinstallé sur ce poste/session
> depuis le dernier `npm install` documenté. **Voir tableau à jour ci-dessous** (remplace l'ancien).

| Gate | Résultat (31/07, session 2) |
|---|---|
| `config:validate` | ✅ **11 pages, 44 sections** |
| `audit:config` (fichier ciblé) | ✅ **RAS** (0 constat : trad/liens/assets/strip/prereq/theme) |
| `typecheck` | ❌ **10 erreurs** — 9 causées par `node_modules` désynchronisé (modules MapLibre introuvables + `any` implicites dans `SearchMap.tsx`/`SearchMapMarkers.tsx`) + **1 pré-existante hors lot** (`HeaderTransparentScroll`, variable inutilisée). **0 causée par le lot auto-inscription** (§9.5) |
| `lint` (projet entier) | ❌ **1 erreur** (`react-hooks/preserve-manual-memoization` dans un composant `formEngine` préexistant, hors lot Ekilibre) + 32 warnings pré-existants · **0 erreur** sur les 4 fichiers du lot §9.5 |
| `test:unit` (suite complète) | 🟡 **2142 passés / 5 échecs / 6 skip** (166 fichiers) — tous les échecs sont **pré-existants et environnementaux**, aucun sur le périmètre Ekilibre : `environment.test.ts` (configuration locale de l'environnement — **corrigé depuis**, revérifié ✅ 9/9), `section-meta.test.ts` (`CLAUDE.md` introuvable à la racine de `site-json` — le fichier vit à la racine du workspace), `site-assets.test.ts`, `skill-integrity.test.ts` (pré-existants), `useEntityMutation.test.ts` (timeout 5s — contention du poste pendant l'exécution parallèle des gates, non reproduit en isolation : le fichier de test dédié au lot §9.5 passe **37/37** en ~9s) |
| Serveur dev | ✅ boote malgré les deps manquantes ; `/`, `/creneaux`, `/structure` → **200** ; listes en skeleton au SSR (prefetch non observé — à revoir après `npm install`) |
| `build` / e2e | non relancés en session 2 — **à passer après `npm install`** ; aucun spec e2e Ekilibre n'existe |

### 9.5 Auto-inscription structure — costumForm `structure-ekilibre` (31/07, session 2, **non commité**)

**Working tree modifié**, aucun commit : `config.prod.maison-sport-sante-la-tampon.json` (M),
`structure-ekilibre/fns.ts` (nouveau), `registerSpecFns.ts` + `configCostum.ts` (fixture test, M),
`structure-ekilibre.configDriven.test.ts` (nouveau).

**Fonctionnel** : bouton « Ajouter ma structure » (icône `plus`, variant `outline`, public —
`requiresAdmin:false`) à côté du champ de recherche sur `/structure`, ouvre un wizard 5 étapes
(`structure` → `contact` → `legal` → `representant` → `responsable`) : identité (SIREN/SIRET, nom,
sigle, affiliation réseau, **domaines d'intervention** `thematic` en cases à cocher, logo), adresse
(`widget: location`), coordonnées + réseaux sociaux, forme juridique (+ champs conditionnels
`visibleIf` selon collectivité/entreprise — statuts, documents), représentant légal, personne en
charge du dossier (recopie du représentant si `responsableSameAsRepresent = "Oui"`).

**Code strictement minimal** (conforme à la règle « dériver, ne pas réciter ») : tout le formulaire
vit en **données** dans `costumForms["structure-ekilibre"]` (moteur `formEngine`, doc/28 — 3 couches
déjà génériques : scope/carrier, defaults, payload, codecs `address:*`/`social:*`/`geo:*`). **Une
seule clé de code irréductible** : `fns.ts` → `registerTransform("structure:tagsFromThematic")`,
qui projette `thematic` (libellés longs saisis) vers `tags` (libellés courts, déjà indexés côté
backend et interrogés par le filtre « Domaine d'intervention » de `/structure`) — un transform de
champ ne reçoit pas de `params`, la table de correspondance ne peut donc pas vivre dans le JSON.
**Vérifié** : les 11 valeurs du filtre `domaine-structure` (config, ligne 1826) et les clés/valeurs
de `THEMATIC_TO_TAG` sont alignées au caractère près (accents et graphie legacy inclus —
`"Periscolaire 1er degré"` sans accent, `"2eme"` en toutes lettres, cf. commentaire du fichier).

**Pattern costum stamp** (§25 bonnes-pratiques) : `mutation.inject.extraFields = {type:"NGO",
role:"admin"}` posé **au create seulement** (`payloadEmitEmptyOnEdit: true` évite qu'une édition
réémette/écrase ces champs) ; `dropEmptyEmail:true` supprime la clé si vide plutôt que d'envoyer
une chaîne vide. Invalidation post-save générique (`invalidate:standard`, `searchKeys:
["searchCostumStatic"]`) → la liste `/structure` se rafraîchit sans reload.

**Gates mesurés le 31/07 (session 2, sur ce lot)** :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 11 pages, 44 sections (inchangé — `costumForms` n'ajoute pas de page) |
| `audit:config` | ✅ RAS (0 constat) |
| `lint` (4 fichiers du lot) | ✅ 0 erreur |
| `test:unit` (fichier dédié) | ✅ **37/37** — compilation config→descripteur, round-trip payload, oracle réel « NOUT' SPORT ADAPTÉ », pattern costum-stamp, parité `visibleIf` avec l'ancien formulaire jQuery |

**Reste** : commit (aucun commit fait à ce stade — le lot est **entièrement dans le working
tree**) ; recette navigateur (wizard complet, upload logo, soumission réelle) ; confirmer le
libellé/l'ordre des étapes avec la MSS ; vérifier qu'aucun autre site ne consomme
`ActionButtonSchema.buttons` avec un `modal` qui collisionnerait avec l'id `add-structure-ekilibre`.

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
| A.8 | Auto-inscription structure (`/structure`, bouton public + wizard) | 🟡 | **fait, non commité** (session 2, 31/07) — costumForm `structure-ekilibre` (§9.5) ; 37 tests config-driven ✅ ; recette navigateur (upload logo, soumission réelle) à faire |

### Lot B — Gestion des créneaux (admins)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| B.1 | Bouton « Ajouter un créneau » (création) | 🟡 | **code fait, revu, commité (`2bf81496`)** ; **public depuis le 31/07** (`adminOnly: false`, à côté du bouton Carte) ; CoFormModal + invalidation liste **et** carte ; recette navigateur connecté à faire |
| B.2 | Bouton « Modifier » sur le détail | 🟡 | droits = super-admin / admin costum / admin structure (`canEditCoformAnswer`, §9.2 bis) ; re-fetch frais anti-perte de champs ; recette à faire |
| B.2b | Inputs CoForm `date` / `timeSlots` / `dynamicFields` | 🟡 | **portés le 31/07** (§9.2 ter) — le formulaire créneau est maintenant complet (91 inputs rendus) ; recette à faire |
| B.3 | Suppression de fichiers à l'édition | ✅ SDK | **résolu** : le SDK **1.0.169** (installé le 31/07) expose `Answer.deleteFiles(docIds[])` — l'erreur typecheck `file.ts:167` a disparu. La fiche `DELETE_COFORM_ANSWER_FILE` ([`ENDPOINT.md`](../../ENDPOINT.md)) est **satisfaite** ; reste à recetter la suppression réelle |
| B.4 | Suppression d'un créneau | ❌ | non câblé (SDK `Answer.delete()` existe ; hook front `useDeleteAnswer` à créer via `createCoFormMutation`) |
| B.5 | Commit + MR du lot | 🟡 | **commité le 31/07** (`20fc3529` coform · `2bf81496` search+config · `e163b6d9` doc) ; reste **push + MR** vers `main` |

### Lot C — Industrialisation & mise en ligne

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| C.1 | `npm install` post-merge + gates verts | 🟡 | fait une fois le 31/07 (session 1, SDK 1.0.169 + MapLibre) mais **`node_modules` de nouveau désynchronisé sur ce poste** en session 2 (SDK 1.0.158, MapLibre absent) → typecheck **10 erreurs** ; **à relancer `npm install`** avant tout build/e2e |
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
| **`DELETE_COFORM_ANSWER_FILE`** + `Answer.deleteFiles(docIds[])` (suppression batch answer-side, auth save/upload) | ✅ **livré** | **SDK 1.0.169 installé le 31/07 : `Answer.deleteFiles(docIds: readonly string[])` est présent**, l'erreur `file.ts:167` a disparu. Fiche `ENDPOINT.md` à clore après recette |
| **`CONTACT_SEND_URL`** (formulaire de contact) — ou route Express locale `/api/contact` | 🔴 fonctionnalité cassée | aucune évolution constatée |
| Alias générique de `COFORM_ANSWERS_BY_FORMS` (hors controller `/costum/francetierslieux/*`) | 🟡 conditionnel | requis seulement si on liste/édite les créneaux **depuis la fiche d'une structure** (pattern tiers-lieux) |

Rappel : la création/modification d'un créneau ne demande **aucun nouvel endpoint**
(`SAVE_COFORM_ANSWER` couvre les deux, `GET_COFORM_BY_ID`/`COFORM_ANSWERS_BY_ID` pour le
chargement, `GLOBAL_AUTOCOMPLETE_COSTUM` pour la liste).

---

## 12. Points d'attention / limitations

- **Lot auto-inscription structure (§9.5) entièrement non commité** : working tree modifié
  (`config.prod...json`, `registerSpecFns.ts`, `configCostum.ts`) + 2 fichiers nouveaux
  (`fns.ts`, test). Rien n'est perdu tant que le working tree n'est pas touché, mais **aucune
  sauvegarde git n'existe** de ce lot à ce stade — committer avant toute opération git destructive.
- **`node_modules` désynchronisé — réapparu le 31/07 (session 2)**, malgré la résolution notée en
  session 1 : SDK revenu à **1.0.158** (≠ `^1.0.169`), MapLibre (`maplibre-gl`, `react-map-gl`,
  `@maptiler/sdk`, `supercluster`) absent. `npm install` avait bien été fait une fois (session 1),
  mais l'état ne s'est pas maintenu sur ce poste/session → **relancer `npm install` avant de
  considérer les gates verts** (typecheck retombé à 10 erreurs, cf. §9.4).
- **Convention `.env` locale** : une valeur entre guillemets fait échouer le préflight
  `environment` (piège déjà vécu le 06/07, corrigé depuis dans la configuration locale). Poste
  dev : limite inotify relevée à 524 288 (06/07).
- **Lots créneaux poussés** : `ekilibre` = `origin/ekilibre` (0 commit d'écart, vérifié 31/07
  session 2) — les 3 commits de la session 1 (`20fc3529`, `2bf81496`, `86a6f023`) sont bien sur le
  remote ; reste à ouvrir la **MR vers `main`**.
- **Modération = champ `state`** : un créneau dont l'état n'est pas exactement `"Validé"` est
  invisible sur `/creneaux` — vérifier que le form pose bien ce champ (et qui a le droit de le
  changer). Idem **CP hors 97430/97418** ou answer sans adresse → invisible, sans erreur.
- **Clés et valeurs dupliquées config ↔ form** : les suffixes de champs
  (`sportSanteBienetre2172025_854_0…`) et les valeurs d'options (littéraux exacts, accents
  compris) apparaissent dans les `dropdownFilters`, les `defaultFilters` **et**
  `DEFAULT_COFORM_FIELDS` — toute modification du CoForm SSBE casse silencieusement filtres et
  cartes. Même famille de piège sur `/structure` (valeurs de `tags`).
- **Droits d'édition : le front est volontairement plus large que le backend.** `answer.canEdit` est
  calculé sur la seule propriété (`not_owner`), donc il refuse un super-admin ou un admin de costum.
  Le front applique la règle métier (`canEditCoformAnswer`) ; **si le backend refuse le save pour la
  même raison, la saisie est perdue** → à vérifier en recette avec un compte super-admin et un compte
  admin de structure, et à arbitrer avec l'équipe backend si le `save` renvoie 403.
- **Chiffres clés de la home en dur** ; les 8 cartes pathologies pointent vers `/creneaux` **sans
  filtre pré-appliqué** (les dropdowns ne couvrent pas les pathologies).
- **Le détail d'un créneau ne re-fetch pas** (parse l'item de la recherche) : si le backend tronque
  des champs dans `globalautocomplete`, le dialog est incomplet. L'**édition**, elle, re-fetch (lot 06/07).
- **Don HelloAsso** = lien externe (le endpoint serveur `/api/helloasso/checkout-intent` existe mais
  n'est pas branché pour ce site).
- **CSS partagé avec SSBE** : un changement de thème SSBE impacte Ekilibre (et réciproquement).

---

## 13. Évolutions à prévoir & questions en attente

| Évolution / question | Pour qui |
|---|---|
| **Ouvrir la MR `ekilibre` → `main`** (lot créneaux, déjà poussé) | Peterson |
| **Committer le lot auto-inscription structure** (§9.5, actuellement en working tree uniquement) | à faire par la personne courante — à confirmer qui |
| **`npm install`** (de nouveau requis, régression §9.4/§12) puis gates complets (typecheck/unit/build/`verify:build`) + recette carte MapLibre | Peterson |
| **Recette du wizard auto-inscription** (upload logo, soumission réelle, libellés/ordre des étapes validés par la MSS) | Peterson / MSS |
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
