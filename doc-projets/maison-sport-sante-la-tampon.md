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

Dernière mise à jour : **2026-08-19** (session 5 : **migration du form créneaux vers le form dédié
Tampon** `6a7cd1d72e263e7c033ad1ea` — §9.8 : plus AUCUN lien form/créneaux avec SSBE, section
`maisonSportSanteLeTampon12082026_2004_0`, filtres CP retirés (le form dédié EST le périmètre),
résolution front des champs par **ids d'inputs stables** (suffixes — préservés par la duplication),
et **modèle costum backend DÉDIÉ `MaisonSportSanteLeTampon.php`** — `SportSanteBienetre.php` intact,
`AssociationEkilibre.php` réécrit en relais (costumSlug front INCHANGÉ).
⚠ Reste UNE commande mongo à exécuter à la main : costum embarqué + `class.function` sur l'orga carrier).

Session 4 (18/08) : **modération des créneaux par statut** (`statusField`) — §9.7, avec correctif
« colonnes vides » (shape aplatie par le hook costum) ; **pull `origin/ekilibre` intégré** (merge
`main` `b8045fc6` : SDK **1.0.184**, `formatCell` multivalué, fixes coform commonTable).

<details><summary>Session 3 (06/08, deux intervenants — dates corrigées)</summary>

La précédente version de ce document datait par erreur toute la session 3 du 31/07 ; les commits
`348237e5`→`a524cf33` sont réellement du **06/08** : merge `main` → `ekilibre` résolu (`348237e5`,
Cael, 12:41) ; **renommage du costumForm `structure-ekilibre` → `structure`** + fiche détail dédiée
`PreviewStructure` (`253dec37`, Nicolas, 13:07 — §9.5 bis) ; **back-office `/admin` + tableau de
bord KPIs** CDC §4.2 (`2bf0007d`/`a524cf33`, Cael, 14:42 — §9.6) ; **nouveau chantier annoncé**
(non codé) : remplacement du flux **News** de la home par un **CRUD d'actualités porté en POI**
(§2, §4, §10 Lot E, §13).

</details>

<details><summary>Historique des sessions précédentes (31/07, sessions 1–2)</summary>

Session 1 : création ; collecte git/config/gates ; revue « bonnes pratiques » + correctifs §9.2 bis ;
inputs coform §9.2 ter ; **lots commités** : `20fc3529` + `2bf81496` + doc `86a6f023` — **poussés sur
`origin/ekilibre`**.

Session 2 (31/07 PM) : auto-inscription structure — costumForm `structure-ekilibre` créé et
**commité par Nicolas** (`9fbe7c02` « add structure with step », 15:43) — la version antérieure de ce
document, rédigée avant ce commit, le décrivait à tort comme resté en working tree.

</details>

---

## 1. Contexte du projet

La **Maison Sport Santé du Tampon (Ekilib.re)** oriente les habitants du Tampon et de Saint-Joseph
(La Réunion) vers des **créneaux d'activité physique adaptée** labellisés sport santé. Le projet
publie un site vitrine + annuaire de créneaux sur SiteForge, adossé au **costum régional
`sportSanteBienetre`** (réseau Sport Santé Bien-être de La Réunion) : Ekilib.re est un **sous-site
territorial** de ce costum. Depuis le **19/08 (§9.8)** : les **créneaux** vivent dans le **form
dédié Tampon** `6a7cd1d72e263e7c033ad1ea` (plus aucun lien avec le form SSBE — le form est le
périmètre, plus de filtre CP) ; les **structures** restent des organizations SSBE partagées,
restreintes aux codes postaux **97430 / 97418**.

| | |
|---|---|
| **Site SiteForge** | slug `associationEkilibre` → [`config.prod.maison-sport-sante-la-tampon.json`](../config.prod.maison-sport-sante-la-tampon.json), CSS `index-sport-sante-bien-etre` (**partagé** avec le site SSBE, cf. [`sites.json`](../sites.json)) |
| **Costum / scope de données** | `sportSanteBienetre` — `source.key` des structures ; préfixe des clés de champs answers |
| **CoForm « créneau »** | **`6a7cd1d72e263e7c033ad1ea`** « Créneau - tampon » (dédié, §9.8) — section `maisonSportSanteLeTampon12082026_2004_0` ; **1 créneau = 1 answer** ; ex-form SSBE partagé `6928096adf5caf0d230e7f26` jusqu'au 19/08 |
| **Orga porteuse** | slug `associationEkilibre`, `_id 692817af564b0621d52ebbc6`, type `organizations` (résolu au boot via `GET_ELEMENTS_KEY`) |
| **Backend (dev)** | environnement de dev local (configuration hors de ce document) ; backend de prod **à définir** |
| **SDK** | `@communecter/cocolight-api-client` — lecture seule. `package.json` committé requiert **`^1.0.173`** (merge `main` du 06/08, `348237e5`) ; **1.0.171 installé sur ce poste** en fin de session 3 (≠ committé, `npm install` recommandé — sans impact observé, typecheck **0 erreur**, §12) |
| **Branche site-json** | **`ekilibre`** (suit `origin/ekilibre`, **0 commit d'écart** au 06/08 — `git pull --ff-only` propre depuis `849a4f07` jusqu'à `a524cf33`, aucun conflit). Working tree propre hors SDK (ci-dessus) |
| **Intervenants (git)** | Francki (init 02/07) · Nicolas (config 20/07, 28/07 ; lot structure 31/07 + 06/08) · Peterson (lot créneaux 06/07) · Cael (merge + doc 06/08, back-office/KPIs 06/08) ; chef de projet **à confirmer** |

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
  `itemRules`/`itemAction`/`colorBy`.
- **31/07 (session 2, Nicolas) — auto-inscription structure** (commité `9fbe7c02`, 15:43) : bouton
  public « Ajouter ma structure » sur `/structure` (`buttons` du `searchHeader`, contrat générique
  `ActionButtonSchema` + `<ActionButtonGroup>`/`DynamicModalButton`, **modules/profil** — zéro
  code nouveau pour le bouton) ouvrant le **premier costumForm du site** :
  `costumForms["structure-ekilibre"]` (moteur **formEngine**, cf. [doc/28](../doc/28-module-formengine.md)),
  wizard 5 étapes (structure · contact · légal · représentant · responsable). Seule clé de code
  ajoutée : `src/modules/profil/forms/costum/structure-ekilibre/fns.ts` (transform pur
  `thematic` → `tags`). Détail au §9.5.
- **06/08 (session 3, Cael, `348237e5` 12:41) — merge `main` → `ekilibre`** : résout 3 conflits
  (`doc-projets/README.md`, `modules/coform/components/CoFormReadOnly.tsx`, `modules/coform/types.ts`)
  et embarque le rattrapage de `main` (dont `institut-bleu`, `rezo-sante-reunion`, config-assistant).
- **06/08 (session 3, Nicolas, `253dec37` 13:07) — renommage `structure-ekilibre` → `structure` +
  fiche détail** : le costumForm et son dossier de code sont renommés (`structure-ekilibre/fns.ts` →
  `structure/fns.ts`, `structure-ekilibre.configDriven.test.ts` → `structure.configDriven.test.ts`),
  `modal: "add-structure-ekilibre"` → `"add-structure"` ; nouveau `preview.type: "structure"`
  (`PreviewStructure.tsx`, fiche détail complète : hero, affiliation, adresse+carte, représentant/
  responsable, documents) sur `/structure` (`detailsMode` passe de `drawer` à `dialog`) ; fix
  `CardContact` (téléphone objet `{mobile,fixe}` du costum SSBE) ; `defaultFields` posé sur la
  recherche structures (25 champs, pour que le preview et l'édition disposent des données) ;
  `responsableSameAsRepresent` passe de `select` (Oui/Non) à `switch` (+ `visibleIf op:"falsy"`) ;
  nouveau transform `number:fromDigits` (contournement typage costum, cf. §9.5 bis). Détail §9.5 bis.
- **06/08 (session 3, Cael, `2bf0007d`+`a524cf33` 14:42) — back-office `/admin` + KPIs (CDC §4.2)** :
  bloc `config.admin` (dashboard/membres/modération) + extension opt-in du moteur admin
  (`AdminDashboardKpiSchema`). Détail §9.6.
- **06/08 (session 3, décision Nicolas, non codée) — chantier « Actualités » requalifié en POI** :
  le CDC (« Section Actualités » de la home + CRUD back-office titre/catégorie/date/contenu/lien/
  statut/mise en avant) sera implémenté via un **costumForm POI** dédié plutôt que via le module
  **News** existant (qui n'a ni catégorie fermée, ni statut brouillon/publié/archivé, ni mise en
  avant unique, ni date de publication planifiable — cf. §2, §4, §10 Lot E, §13).

---

## 2. Objectifs de la configuration

1. **Un site vitrine** (nav 5 entrées : Créneaux · S'informer · Structures · Partenaires · Contact,
   CTA « Espace Pro ») présentant la MSS, le parcours sport santé et ses partenaires.
2. **L'annuaire des créneaux** (`/creneaux`) : recherche texte + 4 filtres (type d'activité,
   bénéficiaires, type sport santé SSsO/SSpT, public), **vue carte**, détail en dialog — restreint
   aux créneaux **validés** du form dédié Tampon (plus de filtre CP depuis §9.8).
3. **La gestion des créneaux par les admins** : créer et modifier un créneau (= une answer du CoForm
   dédié `6a7cd1d72e263e7c033ad1ea` depuis §9.8) **sans quitter le site** (CoFormModal) — commité le 31/07.
4. **L'annuaire des structures référentes** (`/structure`) : organizations SSBE du territoire,
   filtres CP + domaine d'intervention, **fiche détail dédiée** (`PreviewStructure`). **+
   auto-inscription** : toute structure peut se référencer elle-même via un formulaire public
   (costumForm `structure`, commité — §9.5/§9.5 bis).
5. ~~Le flux d'actualités de l'association (home, lecture seule)~~ **à remplacer** : le CDC demande
   une section « Actualités » (une actualité à la une + grille) pilotée en CRUD complet par
   l'admin (catégorie, date de publication planifiable, contenu riche, lien, statut, mise en avant
   unique) — porté en **POI** plutôt qu'en **News**, chantier annoncé le 06/08, **non codé** (§4, §10
   Lot E, §13).
6. **L'accès pro** (espace pro → `/login`) + **le pilotage admin** : back-office `/admin` (dashboard,
   membres, modération) et 4 KPIs du CDC §4.2 (§9.6).
7. **Un formulaire de contact** opérationnel (aujourd'hui cassé — endpoint inexistant, §12).

---

## 3. Architecture générale

```
            Communecter (backend dev) / costum sportSanteBienetre
     answers du CoForm 6a7cd1d72e263e7c033ad1ea (créneaux, dédié Tampon) · organizations (structures) · news
                  ▲ GLOBAL_AUTOCOMPLETE_COSTUM · GET_NEWS · SAVE_COFORM_ANSWER
                  │
   ┌────────────── SiteForge (site-json, branche ekilibre) ───────────────┐
   │  config.prod.maison-sport-sante-la-tampon.json → SiteRenderer        │
   │   /creneaux : searchHeader (4 dropdowns) + searchProStatic           │
   │     baseParams.defaultFilters = { form, CP $in, state:"Validé" }     │
   │     addButton.coform → CoFormModal (création)  [lot 06/07]           │
   │     preview.editButton → CoFormModal (édition) [lot 06/07]           │
   │   /structure : searchProStatic organizations (source.key $in SSBE+  │
   │     Ekilibre + CP) + preview "structure" (fiche détail) + bouton     │
   │     "Ajouter ma structure" → costumForm structure [commité 06/08]    │
   │   /admin : dashboard KPIs + membres + modération [commité 06/08]     │
   │   / : news (entitySlug associationEkilibre) — À REMPLACER par un     │
   │     costumForm POI "actualité" (chantier annoncé, non codé)          │
   └──────────────────────────────────────────────────────────────────────┘
          dev : variables d'environnement locales (.env, non détaillées ici) → :5173
```

**Deux voies de filtrage** (toutes config-driven, cf. [doc/07](../doc/07-module-search.md)) :
- **figée** : `baseParams.defaultFilters` — sur `/creneaux` : `form` (dédié Tampon) et
  `state:"Validé"` (plus de filtre CP, §9.8) ; sur `/structure` :
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
| Pilotage (CDC **4.2**) | tableau de bord admin : créneaux actifs (+ évolution mensuelle), usagers actifs (analytics RGPD), signalements en attente, pros inscrits en attente de validation | back-office `/admin` (§9.6, 06/08) — 2 KPIs branchés sur données réelles, 1 dérivé (modération), 1 **à raccorder** (analytics) |
| Actualités (CDC, cité ci-dessous) | home : 1 actualité à la une + grille secondaire ; back-office : CRUD complet | ❌ **à faire** — décision du 06/08 : porté en **POI** (costumForm dédié), pas en module News (§10 Lot E) |

**Détail CDC — Actualités** (retranscrit tel que fourni par l'utilisateur le 06/08, à faire valider
avec la MSS) :

> Page d'accueil — Section Actualités : une actualité mise en avant (featured) + grille d'actualités
> secondaires. Règle de gestion : les actualités sont gérées depuis le back-office (titre, catégorie,
> date, contenu, statut Publié/Brouillon) par l'admin du site.

Gestion des actualités (CRUD complet, champs CDC) :

| Champ | Type / règle |
|---|---|
| Titre * | texte court |
| Catégorie * | énumération fermée : Nouveau créneau · Évènement · Information santé · Fermeture/modification · Autre |
| Date de publication * | date picker · **planification possible** (publication différée) |
| Contenu * | texte riche (éditeur WYSIWYG en production) |
| Lien associé | URL optionnelle |
| Statut | Publié · Brouillon · Archivé |
| Mise en avant | toggle « À la une » — **1 seule actualité à la fois** en featured |

Pourquoi POI plutôt que News (constat, à confirmer avec l'utilisateur) : le module **News**
(`doc/09-module-news.md`) gère déjà un CRUD (`AddNewsModal`/`EditNewsModal`), mais c'est un flux
social **text-first** (réactions, commentaires, mentions) sans catégorie fermée, sans statut
brouillon/publié/archivé, sans « mise en avant » unique ni date de publication planifiable. Le
moteur search sait déjà rendre des **POI** avec des champs custom pilotés par un `costumForm`
(même mécanisme que `structure` sur les organizations, cf. §9.5 bis) — pattern déjà éprouvé sur ce
site pour porter un contenu structuré sans code nouveau.

---

## 5. Modèle de données réel

> L'accès base directe n'est pas disponible sur ce poste — chiffres **à confirmer** (mes comptages
> via SDK/curl du 31/07 ont échoué sur la validation du payload `GLOBAL_AUTOCOMPLETE_COSTUM` ;
> relevé navigateur à faire). Ce qui est **prouvé** au 31/07 :

- **Entité porteuse** : slug `associationEkilibre` → `{contextId: 692817af564b0621d52ebbc6,
  contextType: organizations}` (répondu par `/co2/slug/getinfo` le 31/07) — le boot du site marche.
- **Créneaux** = answers du CoForm dédié `6a7cd1d72e263e7c033ad1ea` (§9.8), champs sous
  `answers.maisonSportSanteLeTampon12082026_2004_0.<fieldKey>` ; le site n'affiche que
  `state="Validé"` → un créneau non validé est **invisible, sans erreur** (plus de condition CP :
  le form dédié est le périmètre).
- **Structures** = organizations `source.key ∈ {"sportSanteBienetre", "associationEkilibre"}` + CP
  ∈ {97430, 97418} ; domaine d'intervention = valeurs libres de `tags` (**11 options** littérales
  dans la config, vérifiées le 31/07 contre `structure.fields.thematic`, costumForm **renommé** le
  06/08 — cf. §9.5 bis). Le second `source.key` (`associationEkilibre`, entité porteuse d'Ekilib.re)
  a été **ajouté le 31/07** (session 2) : une structure auto-inscrite via le formulaire
  (`scope.slugFrom: carrier`) porte ce `source.key`, pas `sportSanteBienetre` — sans cet
  élargissement elle serait invisible sur la page même qui l'a créée.
- **Actualités** (chantier à venir) : pas encore de collection dédiée — à modéliser en **POI**
  (`collection: "poi"`), avec un costumForm sur le modèle de `structure` (§9.5 bis) ; champs prévus :
  titre, catégorie (enum fermée), date de publication, contenu riche, lien, statut, mise en avant
  (cf. §4). **Aucune donnée réelle à ce stade**.
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
| **Auto-inscription structure (31/07 → 06/08, commité `9fbe7c02` + `253dec37`)** | `config.prod.maison-sport-sante-la-tampon.json` (`costumForms["structure"]`, `buttons` du `searchHeader` `/structure`, `defaultFilters.source.key.$in`, `defaultFields`) · `src/modules/profil/forms/costum/structure/fns.ts` (**seul fichier de code du formulaire**, transforms `structure:tagsFromThematic` + `number:fromDigits`) · `src/modules/profil/forms/registerSpecFns.ts` (barrel, +1 ligne) · `src/modules/profil/forms/costum/__fixtures__/configCostum.ts` (fixture test, +1 ligne) · `src/modules/profil/forms/structure.configDriven.test.ts` (renommé, 40 tests) — moteur réutilisé tel quel : `formEngine` (doc/28), `ActionButtonSchema`/`<ActionButtonGroup>`/`DynamicModalButton` (modules/profil, préexistants) |
| **Fiche détail structure (06/08, `253dec37`)** | `src/modules/search/components/preview/PreviewStructure.tsx` (nouveau, ~540 lignes) · `src/modules/search/components/Preview.tsx` (dispatch `preview.type: "structure"`) · `src/modules/search/components/card/CardContact.tsx` (fix téléphone objet `{mobile,fixe}`) · `src/modules/search/constants/queryKeys.ts` (`DOCUMENTS`) · `src/modules/search/schema.ts` (enum `PreviewConfSchema.type` + `"structure"`) · `src/modules/search/i18n/{fr,en}.json` (clés `PreviewStructure.*`) |
| **Back-office `/admin` + KPIs (06/08, `2bf0007d`)** | `config.prod.maison-sport-sante-la-tampon.json` (bloc `admin`) · `src/modules/admin/schema.ts` (`AdminDashboardKpiSchema`) · `src/modules/admin/sections/DashboardKpis.tsx` (nouveau) · `src/modules/admin/sections/DashboardSection.tsx` · `src/modules/admin/lib/kpiTrend.ts` + `.test.ts` (nouveaux) · `src/modules/admin/constants/queryKeys.ts` (`KPI_SEARCH_PREFIX`) · `src/modules/admin/i18n/{fr,en}.json` — détail §9.6 |
| **Actualités (chantier annoncé, non codé)** | à définir : probable `costumForms["actualite"]` (POI) sur le modèle de `structure/fns.ts`, section home « à la une + grille » (variante de `list`/`preview` existante ou nouvelle) — **aucun fichier créé à ce stade** |
| **Assets** | `public/images/maisonSportSanteLaTampon/` (hero, hero2/3, logo, logo-mss, pictogramme) |
| **Docs workspace** | [`../../FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md) · [`../../ENDPOINT.md`](../../ENDPOINT.md) |
| **Déploiement** | `server/prod-server.js` · variables d'environnement (`.env` local, non détaillées ici) — prod à définir |

---

## 7. Choix techniques et leur pourquoi

| Décision | Pourquoi |
|---|---|
| **Sous-site du costum `sportSanteBienetre`** (pas un costum dédié) | les structures existent déjà dans SSBE (vue territoriale CP 97430/97418). Évolution 19/08 (§9.8) : les **créneaux** sont sortis du form partagé → form dédié Tampon (le contexte costum reste SSBE : hooks backend communs) |
| **CSS partagé `index-sport-sante-bien-etre`** | même identité visuelle que le site régional ; un thème dédié serait à créer si la DA diverge |
| **1 créneau = 1 answer CoForm** (pas un POI/event) | le form créneau (SSBE puis Tampon `…2004_0`, mêmes 91 inputs) porte tous les champs métier (horaires, bénéficiaires, adresse) ; le moteur search sait lister des answers (`defaultTypes:["answers"]` + `filters.form`) |
| **`addButton.coform` / `preview.editButton` = opt-in config** | 2 autres sites utilisent `card-answer`/`coform-answer` (SSBE) — sans ces flags, **comportement strictement inchangé** ailleurs |
| **CoFormModal (pas la route `/coform/:formId`)** | l'admin reste sur `/creneaux`, et le save invalide la liste immédiatement (la route perdrait l'état des filtres) |
| **Re-fetch frais avant édition** (`useCoFormAnswerQuery`) | le save coform renvoie le payload **complet** ; pré-remplir depuis l'item de recherche (potentiellement tronqué) effacerait des champs |
| **Modération par champ `state="Validé"`** (filtre figé, 20/07) | pas de gate backend `toBeValidated` sur ce flux ; le champ état du form fait office de modération — simple mais **dépend de la saisie** (§12) |
| **Filtre CP figé dans `defaultFilters`** | périmètre territorial garanti côté requête (pas seulement à l'affichage) |
| **Auto-inscription = costumForm `formEngine` + `buttons` génériques** (aucun composant nouveau) | le contrat `ActionButtonSchema`/`<ActionButtonGroup>`/`DynamicModalButton` (modules/profil) et le moteur `formEngine` (doc/28) existaient déjà (merge du 30/07) ; Ekilibre n'ajoute que de la **config** + 1 transform pur (`thematic`→`tags`) |
| **`requiresAdmin: false` sur le bouton « Ajouter ma structure »** | auto-inscription ouverte à tout visiteur (non connecté → redirigé login par `DynamicModalButton`) — la structure créée reste rattachée à son auteur (`role: admin` injecté au create) |
| **`source.key` élargi en `$in` plutôt que remplacé** | ne pas faire disparaître les structures SSBE existantes ; les deux sources (costum régional + auto-inscription locale) coexistent sur `/structure` |
| **Renommage `structure-ekilibre` → `structure`** (06/08) | le préfixe `ekilibre` était redondant (le costumForm vit déjà dans la config du site Ekilibre) ; nom plus court, aligné sur `entityType: "organizations"` |
| **`number:fromDigits` (contournement, pas `coerce:number`)** | le costum SSBE déclare `siren`/`representativeTelephone`/`personInChargeTelephone` en `number` par artefact d'inférence (les données réelles sont des chaînes) ; `coerce:number` renverrait `undefined` sur tout séparateur/indicatif, perdant le champ. Le transform ne garde que les chiffres — pertes assumées (`+`, zéro initial) documentées dans le fichier ; correctif définitif attendu côté artefact costum (§11) |
| **Actualités portées en POI, pas en News** (décision 06/08) | le CDC exige catégorie fermée, statut brouillon/publié/archivé, mise en avant unique et date de publication planifiable — absents du module News (flux social lecture/commentaires/réactions) ; le pattern `costumForm` + `formEngine` déjà utilisé pour `structure` couvre ce besoin sans code nouveau |

---

## 8. Étapes de mise en place

1. **Config** : `config.prod.maison-sport-sante-la-tampon.json` + entrée `sites.json`
   (`associationEkilibre` → config + CSS SSBE). ✅
2. **Dev** : configurer les variables d'environnement locales (`.env`, non détaillées dans ce
   document), puis `nvm use` + `npm run dev` → :5173. ⚠️ Prérequis poste :
   `fs.inotify.max_user_watches=524288` (réglé le 06/07 sur le poste de Peterson).
3. **Après chaque merge de `main`** (30/07 puis 06/08) : `npm install`, puis re-passer les gates. 🟡
   refait le 06/08 (session 3, SDK 1.0.173) mais **désynchronisé de nouveau en fin de session** sur
   ce poste (1.0.171 installé, §12) — sans erreur observée à ce jour.
4. **Validation** (gates) : `npm run config:validate -- config.prod.maison-sport-sante-la-tampon.json`
   · `npm run audit:config -- --file …` · `npm run typecheck` · `npm run lint` · `npm run test:unit`
   · `npm run build` (+ `npm run verify:build` depuis le merge).
5. **Commit / MR des lots** (créneaux + structure + admin, tous commités et poussés sur
   `origin/ekilibre`) → **MR `ekilibre` → `main` restant à ouvrir**. 🟡
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

### 9.5 Auto-inscription structure — costumForm `structure-ekilibre` (31/07, session 2, **commité** `9fbe7c02`)

> Nom d'origine du costumForm à la création (`structure-ekilibre`) — **renommé `structure` le 06/08**,
> cf. §9.5 bis. Section conservée telle qu'écrite le 31/07 pour l'historique du contenu fonctionnel.

**Commité** dans `9fbe7c02` (« add structure with step », 31/07 15:43) : `config.prod.maison-sport-sante-la-tampon.json` (M),
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

**Reste (mis à jour au 06/08)** : recette navigateur (wizard complet, upload logo, soumission
réelle) ; confirmer le libellé/l'ordre des étapes avec la MSS. ~~vérifier qu'aucun autre site ne
consomme `ActionButtonSchema.buttons` avec un `modal` id `add-structure-ekilibre`~~ **sans objet**
depuis le renommage (§9.5 bis) : le nouvel id `add-structure` a été revérifié vacant sur les 12
configs.

---

### 9.5 bis Renommage `structure-ekilibre` → `structure` + fiche détail (06/08, session 3, Nicolas — `253dec37`)

**Renommage** (config + code) : `costumForms["structure-ekilibre"]` → `costumForms["structure"]` ;
dossier `src/modules/profil/forms/costum/structure-ekilibre/` → `structure/` ; test
`structure-ekilibre.configDriven.test.ts` → `structure.configDriven.test.ts` (68 lignes touchées,
**40 tests** au 06/08, contre 37 le 31/07 — 3 tests ajoutés pour `number:fromDigits`) ; bouton
`modal: "add-structure-ekilibre"` → `"add-structure"`.

**Fiche détail `PreviewStructure`** (nouveau `preview.type: "structure"`, ~540 lignes) : reprend le
principe de la fiche legacy costum SSBE (`preview.php`) — hero (statut/type/logo/tags), bandeau
d'affiliation, adresse + carte (`ProfileMapLeaflet`), cartes représentant légal / personne en charge
du dossier (fusionnées si même personne), bloc infos (identifiant, catégorie, membre de, date de
création), documents (`org.getDocuments()`, filtrés hors images via `IMAGE_CONTENT_KEYS`, requiert
une session — masqué silencieusement pour un visiteur anonyme). Bouton **Éditer** conditionné à
`useProfilPermissions` + `DynamicEditModal`, avec un garde-fou : si l'item de recherche (tronqué par
`defaultFields`) ne porte aucun champ propre au formulaire `structure` (`siren`/`sigle`/`thematic`),
l'entité est **rechargée en entier** (`org.refresh()`) avant d'autoriser l'édition — même mécanisme
que `PreviewPoiAmenities` pour ses champs `equip_*`. `/structure` passe de `detailsMode: "drawer"` à
`"dialog"`.

**`CardContact`** : `telephone` peut être une chaîne (la plupart des entités) **ou** un objet
`{mobile: string[], fixe: string[]}` (organizations de certains costums SSBE) — React refusant un
objet comme enfant, la carte prenait `mobile[0]` ou `fixe[0]` en fallback plutôt que de crasher.

**`defaultFields`** (25 champs) posé sur `baseParams` de `/structure` : sans cette liste, les
résultats de recherche étaient tronqués et ni la fiche détail ni le garde-fou d'édition ci-dessus ne
disposaient des données du formulaire `structure`.

**Contournement de typage costum** : `responsableSameAsRepresent` passe de `widget: "select"`
(valeurs `"Oui"`/`"Non"`) à `widget: "switch"` (booléen), et les 6 `visibleIf` associés de
`op: "ne", value: "Oui"` à `op: "falsy"`. Nouveau transform pur `number:fromDigits` (`fns.ts`) posé
en `write` sur `siren`/`representativeTelephone`/`personInChargeTelephone` (`clear: null`) : le
costum SSBE les déclare en `number` par artefact d'inférence alors que les données réelles sont des
chaînes (téléphone international, SIREN saisi avec espaces) — `coerce:number` existant aurait rendu
`undefined` (perte silencieuse du champ) sur tout séparateur ; `number:fromDigits` ne garde que les
chiffres (pertes assumées : `+` d'un indicatif, zéro initial — documentées en commentaire dans
`fns.ts`).

**Gates mesurées le 06/08 (session 3, sur ce lot)** : `config:validate` ✅ 11 pages/44 sections ·
`audit:config` ✅ RAS · `lint` (8 fichiers du lot) ✅ 0 erreur · `test:unit`
(`structure.configDriven.test.ts`) ✅ **40/40** · `typecheck` (projet entier) ✅ **0 erreur**.

---

### 9.6 Back-office `/admin` + tableau de bord KPIs — CDC §4.2 (06/08, session 3, Cael)

> Date **corrigée** : la version précédente de ce document datait ce lot du 31/07 par erreur — les
> commits `2bf0007d`/`a524cf33` sont du **06/08, 14:42**.

**Demande** : activer le back-office admin et afficher les 4 KPIs du CDC §4.2. **Réalisation** :
bloc `config.admin` ajouté (onglets `dashboard` / `membres` / `moderation`) + extension **opt-in**
du moteur : `AdminDashboardKpiSchema` (`section.kpis[]`) — sans `kpis`, le dashboard reste 100 %
dérivé, **aucun impact sur les autres sites**.

| KPI (CDC §4.2) | Implémentation | Source de données | État |
|---|---|---|---|
| **Créneaux actifs** (+ évolution vs mois précédent) | `kpis[0]` `searchCount` + `trend:"monthly"` | mêmes `baseParams` que `/creneaux` (form + CP + `state="Validé"`) via `useSearchAllResults` ; tendance dérivée des `created` (`computeMonthlyTrend`, 6 tests) | ✅ réel |
| **Usagers actifs** (visites uniques mensuelles) | `kpis[1]` `analyticsVisitors` | **AUCUNE** — le moteur ne fait que du *tracking* sortant (`IntegrationsLoader`), aucune API de lecture d'audience. Tuile en état « à raccorder » explicite (jamais un chiffre inventé) | 🟡 à raccorder (§13) |
| **Signalements en attente** | tuile **dérivée** modération du dashboard (existant) via l'onglet `moderation` | `me.getModerationQueue()` (news + commentaires signalés) — **superAdmin** (plancher backend) | ✅ (visible superAdmin) |
| **Pros inscrits** (en attente de validation) | `kpis[2]` `membersPending` | `useEntityMembers(carrier, {toBeValidated: true})` — même source que l'onglet Membres | ✅ réel (définition « pro » = membre en attente, **à confirmer** §13) |

**Fichiers moteur** : `admin/schema.ts` (KPI schema + type), `admin/sections/DashboardKpis.tsx`
(tuiles, même anatomie Card que les tuiles dérivées), `admin/sections/DashboardSection.tsx`
(branchement + type guard), `admin/lib/kpiTrend.ts` (+ `.test.ts`, logique pure), `admin/constants/queryKeys.ts`
(`KPI_SEARCH_PREFIX`), i18n admin fr/en (`DashboardKpis.*`). **Config** : bloc `admin` inséré après
`auth` ; le KPI créneaux **réutilise par lecture** les `baseParams` de la page `/creneaux` (copie
générée depuis la config elle-même — à re-synchroniser si les filtres de la page changent, §12).

**Limites assumées** : la tendance mensuelle compare les **créations** (mois courant vs précédent) —
les suppressions ne sont pas historisées côté backend, un « total fin de mois dernier » exact est
impossible ; tendance calculée uniquement sur périmètre complet chargé. La tuile analytics reste
un état vide tant qu'aucun outil RGPD n'est raccordé (décision §13).

**Gates (06/08, session 3)** : `config:validate` ✅ 11 pages/44 sections · `audit:config` ✅ RAS
(strip 0 : le bloc admin est intégralement reconnu) · `typecheck` ✅ 0 erreur · lint ✅ (18 warnings
hérités de `main`) · `kpiTrend` 6/6 ✅ · préflight : reste **1 échec pré-existant** `skill-integrity`
(fichier `.claude/agents/siteforge-config-auditor.md` référencé par le skill mais jamais versionné —
échoue sur tout clone frais, **à remonter au mainteneur**). Au passage : ligne `structure` ajoutée à
la table Presenters du skill `config-assistant` (gate anti-dérive, suite aux commits `253dec37`) et
dossier d'images `maisonSportSanteLaTampon` déclaré dans `sites.json` (gate `site-assets` de main).
Revalidé indépendamment ce même jour (Nicolas, cf. §9.5 bis) : `config:validate`/`audit:config`/
`typecheck` toujours ✅ après `git pull --ff-only` de ces 2 commits.

---

### 9.7 Modération des créneaux dans l'admin — `status.mode: "statusField"` (18/08, session 4, Peterson)

**Demande** : lister les créneaux dans l'onglet Modération avec leur statut, et permettre aux
admins de les passer en Validé / Refusé / En attente (le statut du CoForm). **Réalisation** : câblage
du **contrat `statusField`** prévu de longue date dans le schéma admin (décision 2026-07-07 —
c'était un « contrat futur » jamais implémenté) + une section `resource` answers dans l'onglet
`moderation` de la config.

- **Vérité terrain** (form live) : le statut est le select **« Administration »** (`isAdminOnly`),
  options exactes `["En attente", "En cours", "Validé", "Réfusé"]` — l'orthographe legacy
  **« Réfusé »** est écrite VERBATIM en base ; la config l'écrit telle quelle et l'affiche « Refusé »
  (`states[].label`).
- **Moteur** (générique, tout site) : colonne badge toné (mêmes tokens `bg-badge-*` que les cartes
  `/creneaux`), filtre serveur par état, actions « Marquer : … » par-ligne → `entity.updateField`
  (UPDATE_PATH_VALUE, un `$set` ciblé — pas le save d'answer complet qui exigerait un re-fetch
  anti-effacement). Invalidation : tables/tuiles `admin-*` **et** listes publiques liste+carte
  (un créneau validé apparaît sur `/creneaux` sans F5). `cascade`/`notifyEmail` retirés du schéma
  comme acté.
- **Config** : onglet `moderation` passé **siteAdmin** (la modération des créneaux est le quotidien
  de la MSS) ; la section signalements news/commentaires reste **superAdmin** (plancher backend).
  Périmètre = celui de `/creneaux` **sans** le filtre d'état (on modère tout le territoire), tri
  `created` desc, colonnes Activité / Type / CP / Déclaré le. `create`/`edit: false` (l'édition
  de contenu se fait sur `/creneaux` via le bouton Modifier).
- **Correctif « colonnes vides » (même session)** : les premières colonnes visaient les chemins
  Mongo imbriqués (`answers.<formKey>.<clé>`) — or côté costum SSBE, le hook de recherche
  (`SportSanteBienetre::…`, legacy) **aplatit** les champs d'answer au top-level et **supprime
  `answers.*`**, en posant en bonus `name` (= titre), `structure` {name…} et `address` à la racine
  (vérifié par curl avec `costumSlug` : 48 clés plates). Correctif : colonnes réécrites sur la
  **shape aplatie** (`name` / `structure.name` / type à plat / `address.postalCode` / `created`) et
  lecture du statut via **`readStatusValue`** (resourceHelpers, 3 tests) — chemin complet d'abord,
  repli clé feuille à plat ; le chemin imbriqué reste LE bon pour le filtre serveur et l'écriture
  `UPDATE_PATH_VALUE`. Autre découverte du hook : **`Validé` est forcé pour les non-admins de
  costum** → un admin voit bien tous les états dans la modération, le public non (cohérent).
- **Gates** : typecheck ✅ 0 erreur · lint ✅ · `config:validate` ✅ · `audit:config` ✅ strip 0 ·
  unit **2324** ✅ (reste le pré-existant `skill-integrity`).
- **⚠ À recetter en priorité** : l'autorisation BACKEND d'`updatepathvalue` sur une answer par un
  admin de costum **non-auteur** — même famille de risque que le save d'answer (§12 droits) ; si le
  backend refuse, prévoir une fiche `ENDPOINT.md` (endpoint de modération dédié).

### 9.8 Migration : form créneaux dédié Tampon (19/08, session 5, Peterson)

Décision Peterson (annoncée le 18/08, exécutée le 19/08) : **plus aucun lien form/créneaux avec
SSBE**. Les créneaux du Tampon vivent dans le form dédié **« Créneau - tampon »**
`6a7cd1d72e263e7c033ad1ea` (id humain `maisonSportSanteLeTampon1`, parent = orga
`6a463dd52d396945ff52e854`), **dupliqué du form SSBE le 12/08/2026**. Fait décisif vérifié en base
(getformbyid + answer de test `6a858ed219f28569b6456ff2`) : la duplication **préserve les ids
d'inputs** (queues aléatoires `mdegc9sgox76p87n27`…) — seuls changent l'id du form et le préfixe de
section (`sportSanteBienetre2172025_854_0` → `maisonSportSanteLeTampon12082026_2004_0`). Les
options du select « Administration » sont identiques (« Réfusé » verbatim compris) → le bloc
`states` de la modération reste valable tel quel.

- **Config** : swap intégral form id (4×) + préfixe de section (11×) — `/creneaux` (baseParams +
  4 filtres de page), `addButton.coform`, KPI « Créneaux actifs », resource modération (source,
  colonne type à plat, champ statut). **Filtres CP 97430/97418 RETIRÉS** des 3 sources answers
  (`/creneaux`, KPI, modération) : ils découpaient le form *partagé* par territoire — le form
  dédié EST le périmètre. (Le filtre CP de l'annuaire **structures** est conservé : les orgas
  restent des données SSBE partagées.)
- **Front — résolution par ids stables** (`coformAnswer.ts`) : `DEFAULT_COFORM_FIELDS` ne porte
  plus que les **queues aléatoires** et `parseCoformAnswer` résout par `endsWith` sur les lignes
  aplaties — le remap `associationEkilibre → sportSanteBienetre` (piège historique) **disparaît**,
  cartes/détail marchent pour les DEUX forms sans configuration ; un override `preview.fields`
  portant une clé complète historique reste valide (match par suffixe). +4 tests (SSBE, Tampon,
  override legacy, données sans champs).
- **Backend — modèle costum DÉDIÉ** (demande Peterson : « sans passer par SSBE ») :
  **`modules/costum/models/MaisonSportSanteLeTampon.php`** (dépôt communecter74, classe =
  `ucfirst(slug)` du costum `maisonSportSanteLeTampon` — costum EMBARQUÉ de l'orga
  `6a463dd52d396945ff52e854`, template costumize ; le loader pose `slug` = slug de l'élément et
  `assetsSlug` = costumize, et `Costumize` ne définit ni `searchAnswers` ni `canEditAnswer` → la
  résolution retombe bien sur cette classe). Même **processus** que SSBE, section Tampon SEULE :
  `searchAnswers` (strip géo, `Validé` forcé pour les non-admins du costum, tri/pagination,
  aplatissement + `name` + sous-clés adresse + jointure `structure`), `canEditAnswer` (admin de la
  structure porteuse via le finder), `getAnswerByStructure` (sans rendu html : aucune vue Tampon,
  la vue SSBE appartient à SSBE), `getFormCrenaux` (résolution par id humain
  `maisonSportSanteLeTampon1`, repli `_id` connu). **`SportSanteBienetre.php` restauré à
  l'original** (la généralisation 2-forms de la veille est retirée) ; `AssociationEkilibre.php`
  (copie SSBE pré-existante, clés PÉRIMÉES, sans gate Validé) devient sans objet pour ce flux.
- **Câblage SANS toucher au costumSlug** (contrainte Peterson 19/08 pm) : le front continue
  d'envoyer `costumSlug=associationEkilibre` (slug d'entité, `_withCostumContext` SDK) — **aucun
  changement front**. Côté backend : **`AssociationEkilibre.php` réécrit en RELAIS** (la copie
  SSBE stale est remplacée) qui délègue `searchAnswers` / `canEditAnswer` /
  `getAnswerByStructure` / `getFormCrenaux` à `MaisonSportSanteLeTampon` — un seul modèle de
  référence. Résolution vérifiée dans le loader (`Costum::init`) : slug d'élément →
  `element.costum.slug` comme template → fusion → `slug = associationEkilibre` →
  `ucfirst(slug)` = la classe relais.
- **⚠ DERNIÈRE ÉTAPE (write mongo refusé 2× par les permissions de session — à exécuter à la
  main)** : l'orga carrier `associationEkilibre` (`6a7b4ba00f51f56995200928` dans CE dump) n'a
  **aucun costum embarqué** → rien ne se déclenche sans lui. Poser le costum minimal + la
  déclaration des hooks :
  `docker exec mongo42 mongo prod190826 --eval 'printjson(db.organizations.updateOne({_id: ObjectId("6a7b4ba00f51f56995200928"), costum: {$exists: false}}, {$set: {costum: {slug: "costumize", class: {function: ["searchAnswers", "canEditAnswer"]}}}}))'`
  (garde `$exists:false` = purement additif). Effet de bord assumé : l'orga devient « costumisée »
  côté plateforme legacy (template costumize), comme l'orga MSS. Vérification ensuite :
  la même recherche anonyme doit passer de « 1 réponse brute imbriquée » à **0** (gate Validé —
  « Basket » est En attente) ; après validation dans la modération → 1 ligne APLATIE.
- **Preuves live (anonyme)** : `costumSlug=associationEkilibre` + nouveau form + `notSourceKey` →
  aujourd'hui **1 réponse brute imbriquée SANS gate** (une réponse En attente est publiquement
  visible via l'API : la déclaration ferme aussi cette fuite) ; sans `notSourceKey` → 0 (scoping
  `source.keys`, l'answer de test n'a pas de `source` ; la config front pose bien `notSourceKey`).
  Base vivante : `prod190826` (conteneur `mongo42`) — l'ancienne orga carrier `692817af…` n'existe
  PLUS dans ce dump (« Unknown (deleted) ») ; l'orga `associationEkilibre` y a l'_id
  `6a7b4ba00f51f56995200928`.
- **Alternative écartée** (gardée pour mémoire) : basculer le site sur le slug
  `maisonSportSanteLeTampon` (VITE_SLUG + sites.json + entitySlug news + URL kanban) — plus
  invasif, contraire à la contrainte « on ne touche pas au costumSlug » ; la déclaration
  `class.function` sur l'orga MSS `6a463dd52d396945ff52e854` ne servirait que dans ce scénario.
- **Gates** : typecheck ✅ · lint ✅ · `config:validate` ✅ 11 p/44 s · préflight + search + admin
  **853 tests** ✅ · snapshot effective-config régénéré (diff = exactement la migration) ·
  `php -l` ✅ (`MaisonSportSanteLeTampon.php`).
- **⚠ Recette navigateur** (compte admin costum) : modération de « Basket » (En attente → Marquer
  Validé → apparition sur `/creneaux`), création d'un créneau via `addButton.coform` (nouveau
  form), édition. Les créneaux ANCIENS (form SSBE) ne sont **plus** listés sur le site Tampon —
  voulu (« pas de lien avec SSBE ») ; les re-saisir dans le nouveau form s'ils doivent y figurer.

---

## 10. Checklist d'avancement

### Lot A — Vitrine & annuaires (config)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| A.1 | Site vitrine (home, s'informer, rejoindre, partenaires, espace pro, légal) | ✅ | 11 pages validées ; audit 0 constat |
| A.2 | Annuaire des créneaux `/creneaux` (4 filtres + carte + détail dialog) | ✅ config | **form dédié Tampon** `6a7cd1d72e263e7c033ad1ea` (§9.8) + `state="Validé"` — plus de filtre CP ; **vue carte à recetter** post-merge MapLibre (`npm install` requis) |
| A.3 | Annuaire structures `/structure` (CP + domaine d'intervention) | ✅ config | 28/07 (Nicolas) ; volumétrie des orgas **à confirmer** |
| A.4 | Flux d'actualités (home, lecture seule) | ✅ | `entitySlug associationEkilibre` → `GET_NEWS` |
| A.5 | Auth / Espace Pro | ✅ | CTA header → `/espace-pro` → `/login` (module auth) |
| A.6 | Chiffres clés de la home | 🟡 | **codés en dur** (24 créneaux, 8 activités…) — se désynchroniseront du réel |
| A.7 | Formulaire de contact | ❌ | poste sur `/api/contact` **qui n'existe pas** (ni Express ni SDK) — fiche `CONTACT_SEND_URL` dans [`ENDPOINT.md`](../../ENDPOINT.md) |
| A.8 | Auto-inscription structure (`/structure`, bouton public + wizard) | 🟡 | **commité** (`9fbe7c02` 31/07 + renommé/complété `253dec37` 06/08, Nicolas) — costumForm `structure` (§9.5/§9.5 bis) + fiche détail `PreviewStructure` ; 40 tests config-driven ✅ ; recette navigateur (upload logo, soumission réelle) à faire |

### Lot B — Gestion des créneaux (admins)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| B.1 | Bouton « Ajouter un créneau » (création) | 🟡 | **code fait, revu, commité (`2bf81496`)** ; **public depuis le 31/07** (`adminOnly: false`, à côté du bouton Carte) ; CoFormModal + invalidation liste **et** carte ; recette navigateur connecté à faire |
| B.2 | Bouton « Modifier » sur le détail | 🟡 | droits = super-admin / admin costum / admin structure (`canEditCoformAnswer`, §9.2 bis) ; re-fetch frais anti-perte de champs ; recette à faire |
| B.2b | Inputs CoForm `date` / `timeSlots` / `dynamicFields` | 🟡 | **portés le 31/07** (§9.2 ter) — le formulaire créneau est maintenant complet (91 inputs rendus) ; recette à faire |
| B.3 | Suppression de fichiers à l'édition | ✅ SDK | **résolu** : le SDK **1.0.169** (installé le 31/07) expose `Answer.deleteFiles(docIds[])` — l'erreur typecheck `file.ts:167` a disparu. La fiche `DELETE_COFORM_ANSWER_FILE` ([`ENDPOINT.md`](../../ENDPOINT.md)) est **satisfaite** ; reste à recetter la suppression réelle |
| B.4 | Suppression d'un créneau | ❌ | non câblé (SDK `Answer.delete()` existe ; hook front `useDeleteAnswer` à créer via `createCoFormMutation`) |
| B.5 | Commit + MR du lot | 🟡 | **commité le 31/07** (`20fc3529` coform · `2bf81496` search+config · `e163b6d9` doc) ; reste **push + MR** vers `main` |

### Lot D — Back-office & pilotage (CDC §4.2)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| D.1 | Back-office `/admin` activé (`config.admin`, accès `siteAdmin`) | ✅ config | onglets dashboard / membres / modération (§9.6) ; **recette navigateur connectée à faire** |
| D.2 | KPI « Créneaux actifs » + évolution mensuelle | ✅ | données réelles (mêmes filtres que `/creneaux`) ; tendance = créations, suppressions non historisées |
| D.3 | KPI « Usagers actifs » (visites uniques) | 🟡 | tuile « à raccorder » — **choix d'un analytics RGPD en attente** (§13) |
| D.4 | KPI « Signalements en attente » | ✅ | tuile modération dérivée — visible **superAdmin** seulement (plancher backend) |
| D.5 | KPI « Pros inscrits » (attente de validation) | ✅ | = membres du carrier `toBeValidated` ; **définition à confirmer** (§13) |
| D.6 | Recette du back-office (siteAdmin réel, uploads AdminPanel) | ❌ | à faire ; l'upload AdminPanel écrira dans `public/images/associationEkilibre/` (déclarer ce dossier dans `sites.json` **dès le premier fichier**, cf. §12) |
| D.7 | Modération des créneaux (liste + statuts Validé/Refusé/En attente/En cours) | ✅ code | §9.7 — `status.mode: "statusField"` câblé (moteur) + resource answers dans l'onglet moderation (siteAdmin) ; **recette backend à faire** (updatepathvalue par admin non-auteur) |

### Lot E — Actualités (CDC, remplace le flux News)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| E.1 | Décision d'architecture (POI vs News) | ✅ | tranché le 06/08 par Nicolas : porté en **POI** (costumForm dédié) — §4, §7 |
| E.2 | costumForm « actualité » (POI) : titre, catégorie, date de publication (+ planification), contenu riche, lien, statut, mise en avant | ❌ | à faire — modèle : `costumForms["structure"]` (§9.5 bis) |
| E.3 | Home — section Actualités (1 à la une + grille secondaire) | ❌ | à faire ; page `/` utilise aujourd'hui `news` (module News, lecture seule) — à remplacer |
| E.4 | Back-office — CRUD actualités par l'admin (dont statut Publié/Brouillon/Archivé et toggle « à la une » unique) | ❌ | à faire ; back-office `/admin` déjà activé (Lot D) — onglet à ajouter |
| E.5 | Éditeur de contenu riche (WYSIWYG, cf. CDC « en production ») | ❌ | composant/lib à identifier dans le moteur (aucun repéré à ce stade pour `costumForms`) |

### Lot C — Industrialisation & mise en ligne

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| C.1 | `npm install` post-merge + gates verts | 🟡 | refait le 06/08 (session 3) après le merge `main` (`348237e5`) : SDK **1.0.173**, typecheck **0 erreur** — **redésynchronisé en fin de session 3** sur ce poste (1.0.171 réinstallé, §12), sans erreur observée à ce jour |
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

- ~~Lot auto-inscription structure non commité~~ **résolu** : commité par Nicolas (`9fbe7c02` puis
  renommé/complété `253dec37`) et mergé (`849a4f07`).
- **`node_modules` désynchronisé — réapparu une 3ᵉ fois, en fin de session 3 (06/08)**, sur ce poste :
  `npm install` avait bien été refait après le merge `main` (SDK 1.0.173, typecheck 0 erreur), mais
  au moment d'écrire cette mise à jour le `package.json` local montre **1.0.171** installé, ≠
  `^1.0.173` committé. **Aucune erreur observée à ce jour** (`typecheck` repasse toujours ✅ 0 erreur
  avec cette version) mais le piège est **récurrent sur ce poste** (déjà vécu en session 1 et 2) —
  toujours **revérifier `node_modules/@communecter/cocolight-api-client/package.json` en début de
  session**, ne pas se fier au dernier `npm install` documenté.
- **Dossier d'uploads `public/images/associationEkilibre/`** : créé **vide** à chaque boot du dev
  server (`imageUpload.js` le crée au montage pour le `VITE_SLUG`) → le gate `site-assets` (venu de
  `main`) le signale comme orphelin ; **vide, il ne doit PAS être déclaré** dans `sites.json` (un
  dossier déclaré vide fait échouer l'autre assert). Le supprimer avant commit ; **dès le premier
  upload réel AdminPanel, le déclarer** (`images: ["maisonSportSanteLaTampon", "associationEkilibre"]`).
- **Filtres du KPI « Créneaux actifs » = copie des `baseParams` de `/creneaux`** (générée depuis la
  config elle-même à l'insertion, mais **statique ensuite**) : si les filtres de la page changent
  (CP, état, form), re-synchroniser le bloc `admin.tabs[0]…kpis[0].source` — sinon le KPI compte un
  autre périmètre que la page, sans erreur.
- **Answers : chemins imbriqués pour FILTRER/ÉCRIRE, shape APLATIE pour LIRE.** Le hook costum SSBE
  de recherche aplatit les champs d'answer à la racine des lignes (supprime `answers.*`, pose
  `name`/`structure`/`address`) → des `columns` en `answers.<formKey>.<clé>` affichent des colonnes
  **vides sans erreur** (piège vécu §9.7). Filtres serveur (`defaultFilters`, filtre d'état) et
  `UPDATE_PATH_VALUE` gardent, eux, le chemin Mongo imbriqué. Le badge statut est protégé par le
  repli `readStatusValue` ; les colonnes, non — viser la shape aplatie.
- **Convention `.env` locale** : une valeur entre guillemets fait échouer le préflight
  `environment` (piège déjà vécu le 06/07, corrigé depuis dans la configuration locale). Poste
  dev : limite inotify relevée à 524 288 (06/07).
- **Lots créneaux poussés** : `ekilibre` = `origin/ekilibre` (0 commit d'écart, vérifié 31/07
  session 2) — les 3 commits de la session 1 (`20fc3529`, `2bf81496`, `86a6f023`) sont bien sur le
  remote ; reste à ouvrir la **MR vers `main`**.
- **Modération = champ `state`** : un créneau dont l'état n'est pas exactement `"Validé"` est
  invisible sur `/creneaux` — vérifier que le form pose bien ce champ (et qui a le droit de le
  changer). (Le piège « CP hors zone → invisible » a disparu avec le form dédié, §9.8.)
- **Clés et valeurs dupliquées config ↔ form** : les clés de champs
  (`maisonSportSanteLeTampon12082026_2004_0…`) et les valeurs d'options (littéraux exacts, accents
  compris) apparaissent dans les `dropdownFilters` et les `defaultFilters` ; côté code,
  `DEFAULT_COFORM_FIELDS` ne porte plus que les **ids stables** d'inputs (§9.8 — insensibles à la
  duplication de form) — mais toute modification du CoForm casse silencieusement filtres et
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
- **Chantier Actualités** : décision d'architecture prise (POI, §4/§7) mais **rien n'est codé** — le
  flux `news` actuel reste actif sur la home tant que le nouveau costumForm n'est pas livré, pour
  éviter toute régression d'affichage entre-temps.

---

## 13. Évolutions à prévoir & questions en attente

| Évolution / question | Pour qui |
|---|---|
| **Ouvrir la MR `ekilibre` → `main`** (lots créneaux + structure + admin ; les merges `main` du 30/07 et du 06/08 sont déjà intégrés) | Peterson |
| **Cadrer et coder le costumForm « actualité » (POI)** : champs titre/catégorie/date de publication (+ planification)/contenu riche/lien/statut/mise en avant, section home « à la une + grille », onglet CRUD back-office (§4, §10 Lot E) — remplace le flux `news` actuel | Nicolas / MSS |
| **`node_modules` désynchronisé une 3ᵉ fois** (SDK 1.0.171 installé vs `^1.0.173` committé, §12) — relancer `npm install` avant la prochaine session | Peterson |
| **Choisir l'outil de mesure d'audience RGPD** pour le KPI « Usagers actifs » (Matomo auto-hébergé recommandé — le moteur n'a AUCUNE lecture d'audience aujourd'hui, `IntegrationsLoader` ne fait que du tracking ; il faudra une API de lecture + probablement une route Express proxy) | Thomas / MSS |
| **Définition « Pros inscrits »** : le KPI compte les **membres du carrier en attente de validation** — est-ce la bonne maille (vs un tag/rôle « professionnel de santé ») ? | MSS / Peterson |
| **Tuile « Signalements » visible superAdmin seulement** (plancher backend de `getModerationQueue`) : acceptable, ou faut-il un endpoint siteAdmin ? (fiche `ENDPOINT.md` si besoin) | Thomas |
| **Versionner `.claude/agents/siteforge-config-auditor.md`** (référencé par le skill `config-assistant`, jamais commité → gate `skill-integrity` rouge sur tout clone frais) | mainteneur (aboire ?) |
| **Recette back-office `/admin`** (compte siteAdmin réel : KPIs, membres, modération) | Peterson / MSS |
| **Recette modération créneaux** : `updatepathvalue` sur une answer par un admin **non-auteur** — le backend l'autorise-t-il ? (sinon fiche `ENDPOINT.md` endpoint de modération dédié) | Peterson → Thomas |
| **Recette du wizard auto-inscription** (upload logo, soumission réelle, libellés/ordre des étapes validés par la MSS) | Peterson / MSS |
| ~~SDK : `Answer.deleteFiles` ?~~ **résolu** — livré (présent depuis 1.0.169, SDK installé : **1.0.173**) ; reste la recette de suppression réelle | — |
| **Formulaire de contact** : endpoint SDK (`CONTACT_SEND_URL`) ou route Express locale — trancher | Thomas / Peterson |
| **Recette création/modification d'un créneau** en admin (navigateur, backend réel) | Peterson / MSS |
| **Volumétrie réelle** : combien de créneaux à saisir dans le form dédié Tampon (les anciens créneaux SSBE ne sont plus listés, §9.8) ? de structures ? | MSS / réseau SSBE |
| **Qui valide les créneaux** : le process est désormais **outillé** (onglet Modération de `/admin`, §9.7) — reste à désigner qui l'opère à la MSS | MSS / réseau SSBE |
| **`useDeleteAnswer`** (suppression de créneau) — si le besoin est confirmé | Peterson |
| **Spec e2e Ekilibre** (lecture seule, modèle parent62) | Peterson |
| **Chiffres clés dynamiques** sur la home (compter les answers au lieu du dur) | Peterson / MSS |
| **Filtres pathologies** : pré-appliquer un filtre depuis les cartes de la home ? | MSS |
| **Backend de prod + domaine** (DNS, build mono-slug) | MSS / Thomas |
| Chef de projet / budget / phasage du CDC | à confirmer |
