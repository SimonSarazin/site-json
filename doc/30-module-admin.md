[← Retour à l'index](README.md)

# Module Admin — back-office config-driven (`/admin`)

> ⚠️ À ne pas confondre avec l'[Admin Panel](24-admin-panel.md) (`src/components/admin/AdminPanel.tsx`),
> le drawer d'édition **du JSON de config** en mode dev. Ce document décrit `src/modules/admin/` :
> la **page d'administration du site** (`/admin`) destinée aux admins du costum — gestion des membres,
> du contenu, import/export CSV, référencement et modération. Byte-compatible avec l'admin legacy
> (`co2/admin/*`) via le backend cocolight.

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Activation et accès](#activation-et-accès)
- [Onglets (`tabs`)](#onglets-tabs)
- [Les sections](#les-sections)
- [Validation de la config](#validation-de-la-config)
- [i18n, mobile, dark mode](#i18n-mobile-dark-mode)
- [Limites connues / backlog](#limites-connues--backlog)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le module (`src/modules/admin/`, jumeau architectural du module profil) compile le manifeste
`config.admin` en une page d'administration complète : `route → AdminPage → AdminRenderer (onglets)
→ AdminSectionRenderer (sections)`. **Zéro code par site** : tout est déclaré en JSON, validé par
`AdminSectionSchema` (Zod, `src/modules/admin/schema.ts`).

C'est l'équivalent moderne du `htmlConstruct.adminPanel.menu` legacy (lui aussi config-driven).

La page est un **client island** : rien n'est rendu avant hydratation (les droits sont
permission-dépendants, pas de prefetch SSR). Deep-links : `/admin` et `/admin/:tabId`
(bidirectionnel — le clic d'onglet met l'URL à jour, l'URL pilote l'onglet actif).

L'entrée « Administration » est proposée dans le **menu avatar** et la **palette Ctrl+K**, gatée
par `isAdminEntryVisible` (`lib/adminEntry.ts`) — jamais de lien vers une page qui refusera.

## Activation et accès

```jsonc
"admin": {
  "enabled": true,                       // défaut true ; false = page désactivée
  "title": { "fr": "Administration" },   // h1 (optionnel)
  "access": { "min": "siteAdmin" },      // accès minimum à la page
  "tabs": [ /* voir ci-dessous */ ]
}
```

**Entrée « Kanban » du menu avatar** (opt-in `auth.menu.kanban` — cf. [doc/23-module-auth.md](23-module-auth.md),
section `config.auth.menu` ; PAS dans `admin` : activer le kanban n'oblige pas à activer le back-office) :
ajoute dans le **menu avatar** (`AuthMenu`, au même niveau que Profil / Administration, layouts desktop et
mobile) une entrée « Kanban » qui ouvre **dans un nouvel onglet** la vue kanban des actions de la plateforme :
`<serverUrl>/#@<costumSlug>.view.actions` (ex. `https://www.communecter.org/#@sportSanteBienetre.view.actions`).
Visibilité = **admins du costum uniquement**, via le gate `isKanbanEntryVisible` (`lib/adminEntry.ts`, testé
dans `adminEntry.test.ts` : `resolveAdminAccessLevel ≥ siteAdmin`, superAdmin compris) — indépendante de
`admin.enabled`/`access.min`. Le slug est celui du **costum actif** (`useCocolight().entity.slug`, résolu
depuis le `VITE_SLUG` du déploiement — même source que le scoping d'`AdminResourceTable`), la base est
`getServerUrl()` (`VITE_SERVER_URL`, `www.communecter.org` sur tout le parc). Composition testée :
`lib/platformKanbanUrl.ts`. Sans slug de carrier résolu, l'entrée n'apparaît pas (pas de lien cassé).

Trois niveaux (`AdminAccessLevelSchema`, du plus fort au plus faible) :

| Niveau | Qui | Résolution (`resolveAdminAccessLevel`) |
|---|---|---|
| `superAdmin` | admin plateforme | `me.isSuperAdmin()` / `isAdminPlatform()` |
| `siteAdmin` | admin du **carrier** costum | `entity.isAdmin()` sur le carrier |
| `entityAdmin` | admin de l'entité éditée | prévu par-ligne (non résolu par-ligne à ce jour) |

`access` se déclare à **trois niveaux** : page (`admin.access.min`), onglet (`tabs[].access`),
et **section** (`sections[].access`) — le plus restrictif gagne (chaque niveau est un gate).
NB : l'export a un plancher **backend** `superAdmin` non contournable par config.

## Onglets (`tabs`)

```jsonc
{ "id": "content", "label": { "fr": "Contenu" }, "icon": "database",
  "access": "siteAdmin",                    // optionnel
  "condition": { "isConnected": true },     // optionnel — VisibilityCondition (cf. doc 19)
  "sections": [ /* … */ ] }
```

- `condition` utilise le **même moteur de visibilité** que les sections de page
  (`useVisibilityList`) ; elle est évaluée par l'AdminRenderer **et** les tuiles du dashboard.
  La palette Ctrl+K **exclut** les onglets porteurs d'une condition (le moteur vit dans des
  hooks React, inévaluable hors composant — mieux vaut aucun raccourci qu'un raccourci vers un
  onglet masqué).
- Sans `tabs`, la page rend un dashboard seul (la dérivation automatique depuis
  `profiles.addConfig` prévue au plan n'est **pas implémentée** — déclarer les onglets).

## Les sections

7 types builtin + sections costum via `registerAdminSection` (type libre non-builtin).

### `dashboard`

`{ "type": "dashboard", "title": { … } }` — sans autre config, les tuiles sont **dérivées**
des sections `resource` des onglets **visibles** (compteur total + badge « à valider » si la
resource gère la validation, via `searchCostum` variant admin, count serveur) + une tuile
Modération (taille de la file) si l'onglet existe. Chaque tuile est un vrai lien `/admin/<tab>`.

**KPIs déclarés (opt-in)** — `kpis: []` ajoute des tuiles AVANT les dérivées (même anatomie de
Card ; champs communs `label` / `hint` / `icon` (nom lucide, DynamicIcon) / `linkTo`) :

```jsonc
"kpis": [
  { "type": "searchCount",            // compteur d'un périmètre de recherche
    "label": { "fr": "Créneaux actifs" }, "entityType": "answers",
    "source": { /* mêmes baseParams que searchProStatic */ },
    "trend": "monthly" },             // + évolution : créations mois courant vs précédent
  { "type": "membersPending", "label": { "fr": "Pros inscrits" } },  // carrier toBeValidated
  { "type": "analyticsVisitors", "label": { "fr": "Usagers actifs" } } // état « à raccorder »
]
```

- `searchCount` : count de la 1ʳᵉ page seul ; avec `trend: "monthly"`, charge le périmètre complet
  (`useSearchAllResults`, clé `ADMIN_QUERY_KEYS.KPI_SEARCH_PREFIX`) et dérive la tendance des
  `created` (`lib/kpiTrend.ts`, pur + testé). Limite : les **suppressions ne sont pas historisées**
  → on compare les créations, pas les totaux historiques ; tendance rendue seulement sur périmètre
  complet.
- `membersPending` : membres du carrier en attente de validation (même source que la section `members`).
- `analyticsVisitors` : tuile **placeholder explicite** — le moteur n'a aucune API de LECTURE
  d'audience (`IntegrationsLoader` = tracking sortant uniquement) ; brancher un jour un outil RGPD
  (Matomo…) transformera ce type en vraie source.

### `members`

```jsonc
{ "type": "members",
  "filters": ["toBeValidated", "isAdmin", "isInviting", "text"],  // onglets/outils affichés
  "actions": ["invite"] }                                          // absent = tout affiché
```

Gestion de la communauté du **carrier** : réutilise `MemberListRenderer`/`useEntityMembers`/
`InviteMemberDialog` du module profil. Les requêtes des onglets non déclarés dans `filters`
ne sont **pas** lancées. `actions` gate le bouton « Inviter ».

### `resource` — la table de contenu (CRUD)

```jsonc
{ "type": "resource", "entityType": "poi",
  "label": { "fr": "Équipements" },
  "source": { "defaultFilters": { "type": "recoveryCenter" }, "defaultSortBy": { "name": 1 } },
  "columns": ["name", { "path": "address.addressLocality", "label": { "fr": "Commune" } }],
  "create": "inherit", "edit": "inherit",       // false | "inherit" | "add-<key>"/"edit-<key>"
  "rowActions": ["edit", "delete", "validate", "reference"],
  "bulkActions": ["validate", "export", "delete"] }
```

- `source` = mêmes `baseParams` que `searchProStatic` (`SearchBaseParamsSchema`) — y compris la clé
  sucre **`costumSubType`** (sous-type de costum : natifs + référencés annotés, cf.
  [07-module-search](07-module-search.md)) qui remplace un `defaultFilters.type` quand la
  collection est multi-forms.
- **Mode admin** (dès que `validate` ∈ rowActions ou `status` présent) : la recherche passe par
  l'endpoint admin (`globalautocompleteadmin`, documents **complets**, `preferences` lisible) →
  badge/filtre « En attente / Validé », actions de validation contextuelle. `defaultFields` y est
  ignoré (résolution d'édition costum + forms préremplis l'exigent).
- `create`/`edit: "inherit"` : la création prend le form **costum** du site s'il en existe un pour
  ce type (`config.costumForms`), l'édition suit la résolution publique (`editModalMatch`,
  par-ligne). Clé forcée `add-<key>`/`edit-<key>` possible ; `false` = lecture seule.
- **Édition = entité COMPLÈTE** : la ligne de liste (résultat `searchCostum`) est **allégée** — sans
  les champs `images`/`files` fusionnés par `about`. `openEditEntity` **recharge l'entité full par id**
  via `me.poi/organization/project/event({ id })` (mapping `EDIT_LOAD_METHOD` :
  `poi→poi, organizations→organization, projects→project, events→event`) **avant** d'ouvrir le form ;
  sinon le seed galerie (`getGalleryImages` / `data.files`) est vide → galerie/documents **existants**
  invisibles à l'édition. Repli sur la ligne allégée si le chargement échoue (au moins le form s'ouvre).
  Le flag costum-admin (`setCostumAdminAuthorized`) est reposé sur l'entité rechargée
  (`grantCostumAdmin`). (`src/modules/admin/sections/AdminResourceTable.tsx`)
- **Rendu des dates en cellule** (`formatCell`, `resourceHelpers.ts`) : une colonne pointant un
  timestamp backend (`created`/`updated`) rend une date **longue fr, sans heure** (`formatDateLong`,
  ex. « 14 juin 2026 »). Formats acceptés : `Date` (revivifié par la lib sur `serverData`),
  MongoDate `{ sec }` (**secondes** epoch → `sec*1000`), `{ $date }` (nombre/chaîne), et
  `{ $date: { $numberLong } }`.
- Recherche plein-texte (300 ms), tri serveur par colonne (clavier + `aria-sort`), scroll infini
  par 10 avec compteur « X affichés sur Y ».
- **Bulk** : sélection par lignes (l'en-tête sélectionne les lignes **chargées** ; la sélection se
  réinitialise quand recherche/filtre/tri changent), progression x/y pendant les boucles, et en cas
  d'échecs partiels les éléments en échec **restent sélectionnés** avec action « Réessayer ».
- **Create/edit depuis l'admin — rester sur place + rafraîchir la liste** (côté *config* du form
  costum, pas du schéma admin) : un form costum ouvert **depuis** l'admin (ex. articles parent62)
  pose `mutation.navigateOnSuccess: false` → pas de redirection vers `/profil/{slug}` au succès, on
  reste sur la page admin ; et `mutation.invalidateFn.params.searchKeys` inclut le **préfixe de la
  table admin** `ADMIN_QUERY_KEYS.RESOURCE_PREFIX(entityType)` (ex. `"admin-poi"`, le `queryKeyPrefix`
  du `useSearchQuery` de la table) → le nouvel élément apparaît **immédiatement** dans la liste (create
  ET edit), en plus du fil concerné (ex. `blog:<slug>`). Sans ces deux réglages, le create rediligerait
  hors admin et la table ne se rafraîchirait pas.
- `status` — deux modes (`status.mode`) :
  - `costumFlag` (défaut) : présence = mode admin (flag `preferences.toBeValidated[slug]`,
    comportement historique ci-dessus) ;
  - `statusField` (câblé le 31/07/2026, décision 2026-07-07) : le statut est un **champ métier**
    de `serverData` (`field`, chemin pointé) à valeurs dans `states` — colonne **badge toné**
    (tokens `bg-badge-*`, mêmes couleurs que les cartes publiques), **filtre serveur** par état
    (match exact ; les rows sans le champ ne sortent que sur « Tous »), actions par-ligne
    « Marquer : <état> » (gate `rowActions:["validate"]`) via `entity.updateField`
    (UPDATE_PATH_VALUE — un `$set` ciblé, pas un save d'answer complet). La recherche reste sur
    l'endpoint **public** en documents complets (pas de variant admin) ; l'invalidation post-mutation
    couvre `admin-*` **et** les listes publiques (`SEARCH_STATIC_LIST/MAP_PREFIX`).

    ```jsonc
    "status": { "mode": "statusField",
      "field": "answers.<formKey>.<suffixe>",           // ex. select « Administration » d'une answer
      "states": [ "En attente",                          // forme courte
        { "value": "Réfusé",                             // valeur brute VERBATIM (legacy accentué)
          "label": { "fr": "Refusé" },                   // affichage corrigé
          "tone": "negative" } ] }                       // positive | pending | progress | negative
    ```
    `cascade`/`notifyEmail` du contrat initial sont **retirés** (cascade legacy intrinsèque ;
    email de statut = hook costum backend). Premier consommateur : modération des créneaux
    Ekilib.re (answers CoForm, cf. `doc-projets/maison-sport-sante-la-tampon.md` §9.7).

    ⚠ **Lecture ≠ écriture pour les answers** : `field` est le chemin **Mongo imbriqué**
    (`answers.<formKey>.<clé>`) — c'est lui que consomment le filtre serveur et l'écriture
    `UPDATE_PATH_VALUE`. Mais les **hooks costum de recherche aplatissent** les champs d'answer au
    top-level de la ligne en supprimant `answers.*` (ex. `SportSanteBienetre::searchAnswers` pose
    aussi `name`/`structure`/`address` à la racine). La lecture (badge, action courante) passe donc
    par `readStatusValue` (resourceHelpers) : chemin complet d'abord, **repli sur la clé feuille à
    plat**. Les `columns` d'une resource answers doivent viser la **shape aplatie** (`name`,
    `structure.name`, `<formKey+clé>` à plat…), pas les chemins imbriqués.

### `import`

```jsonc
{ "type": "import", "entityTypes": ["poi", "organizations"] }   // z.enum : 5 types importables
```

CSV (papaparse) → `shapeImportRow` (alias d'adresse pliés, tags splittés, `addressCountry` dérivé
du CP — DOM en ISO propre : 974xx → RE) → **préversion géocodée** (`previewImport` : commune
résolue `localityId` + geo, rapport d'erreurs CSV) → import chunké avec barre de progression
(`importElements`). Un « Modèle CSV » téléchargeable par type. Après import : rapport d'erreurs
**par ligne** téléchargeable (`res.elements[].msgError`). Pendant un import : garde de navigation
(beforeunload + blocker SPA avec confirmation). Un type de config hors liste échoue à la
validation (et un filet runtime toast le signale).

### `export`

```jsonc
{ "type": "export", "entityTypes": ["poi", "organizations", "projects", "events"] }
```

Export CSV du costum (`exportElements` + `toCsv`), filtre par statut de validation.
**Réservé super-admin** (plancher backend).

### `reference`

```jsonc
{ "type": "reference", "entityTypes": ["poi", "organizations"], "columns": ["name"],
  "moderateReferenced": false }   // opt-in : les référencés arrivent "à modérer"
```

Deux sous-onglets : « Rechercher & référencer » (recherche **globale hors costum**, garde-fous
legacy : `preferences.isOpenData` + exclusion du déjà rattaché/référencé) et « Référencés »
(+ retrait). Pose/retire `reference.costum` (endpoint `setsource`). `columns` = colonnes de
données (défaut Nom/Commune) ; Type (badge) et Action restent fixes.

**Sous-types de costum** (quand la collection porte ≥ 1 form costum déclarant `subType`, cf.
[28-module-formengine](28-module-formengine.md)) : le référencement pose EN PLUS l'**annotation**
`reference.costumTypes.<slug> = <subType>` — jamais les champs cœur (`type`, `tags`) de l'entité,
qui portent la sémantique d'un autre site. Multi-form (institut-bleu : `document` + `financement`
sur `poi`) → sélecteur « Rattacher comme » au référencement ; l'onglet Référencés gagne une colonne
**Sous-type** avec un sélecteur par ligne (« Classer/Reclasser » — filet quand l'annotation a raté,
et rattrapage de l'existant). Le retrait nettoie l'annotation (best-effort ; une orpheline est
inerte, le périmètre costum s'applique en `$and` au-dessus). Les écritures passent par
`entity.updateField` (voie haut-niveau BaseEntity — jamais `endpointApi` brut) ; la valeur écrite
est la clé **canonique** `subType` (clé typeObj), jamais l'id du form ni le libellé. Les pages et
onglets consomment ensuite la clé sucre `costumSubType` (cf. [07-module-search](07-module-search.md)).

`moderateReferenced: true` pose `preferences.toBeValidated.<slug>` (SCOPÉ, jamais le booléen
global) via **`carrier.validateGroup(type, id, false)`** — l'endpoint d'autorité costum-admin des
deux backends, PAS `updatepathvalue` (sur une entité étrangère, l'admin costum n'a pas les droits
d'élément : le Node durci refuserait). Échec visible (toast `referencedUnmoderated`).
(`src/modules/admin/sections/AdminReferenceSection.tsx`, `hooks/useReferenceElement.ts`,
`src/modules/search/lib/costumSubType.ts`)

### `moderation`

`{ "type": "moderation" }` — file des news + commentaires signalés (`getModerationQueue`),
votes « Laisser publié / C'est un abus » (consolidate + saveModerate byte-compatibles, seuil
legacy 3 votes majoritaires), modale de détail des signalements.

### Sections costum

`registerAdminSection("monType", MonComposant)` puis `{ "type": "monType", "props": { … } }` —
même mécanique que les sections profil costum. Un `type` builtin ne peut PAS être redéclaré ici.

## Validation de la config

`AdminSectionSchema` = `z.discriminatedUnion` sur les 7 types builtin + fallback custom qui
**refuse** les types builtin : une section builtin fautive (`"rowActions": ["edite"]`) échoue à
`npm run config:validate` avec l'erreur précise du bon schéma — elle ne retombe plus
silencieusement dans la section custom. Champs stricts notables : `import.entityTypes` (enum),
`members.actions` (enum), `rowActions`/`bulkActions` (enums).

## i18n, mobile, dark mode

- **i18n** : namespace `modules/admin` (fr + en, ~137 clés, parité vérifiée par le préflight).
  Les libellés de config (`label`, `title`, `columns[].label`) restent des `LocalizedString`.
- **Mobile** : vérifié à 390/768 px (0 px de débordement mesuré) — barres d'onglets défilantes
  (`ScrollableTabsList`), colonne d'actions de table **sticky à droite**, en-tête sticky,
  formulaires empilés, zones tactiles ≥ 36 px.
- **Dark mode** : variantes `dark:` sur les couleurs sémantiques (badges, préversion d'import).

## Limites connues / backlog

- ~~`status.*` non câblé~~ **fait le 31/07/2026** : `mode: "statusField"` implémenté (badge toné +
  filtre serveur + « Marquer » via `entity.updateField`), `cascade`/`notifyEmail` retirés comme
  acté — cf. la section `resource` ci-dessus. Reste ouvert : l'**autorisation backend** d'un
  `updatepathvalue` sur une answer par un admin de costum non-auteur (à vérifier en recette —
  même famille de risque que le save d'answer par un non-propriétaire).
- Dérivation automatique des `tabs` : ne sera **pas** implémentée en runtime — les tabs se
  génèrent explicitement (assistant config / commande à venir), la config reste inspectable.
- `me.isCostumAdmin(slug)` : pas exposé par la lib, et **0/65 costums** de la base n'a
  d'`admins` — backlog froid. Symptôme d'alerte si ça change : un user de `costum.admins`
  passerait les gates API backend mais ne verrait pas l'entrée UI.
- Emails automatiques au changement de statut : responsabilité **backend** (chantier
  costum-hooks, `elementAfterUpdate`) — aucun site déployé n'a de hook email de statut à ce
  jour ; rien à déclarer côté config site-json.
- « Tout sélectionner » ne couvre que les lignes chargées (pas de « sélectionner les N
  correspondants » — exigerait un mécanisme serveur) ; pas d'undo sur Valider/Référencer ;
  `entityAdmin` pas résolu par-ligne ; colonnes d'export non configurables (réutilisent `columns`).

## Voir aussi

- [Configuration](02-configuration.md) — format JSON du site
- [Visibility System](19-visibility-system.md) — les `condition` d'onglets
- [Module formEngine](28-module-formengine.md) — forms costum add/edit résolus par `inherit`
- [Admin Panel](24-admin-panel.md) — l'éditeur de config dev (autre composant)
- `commentaire/plan-module-admin-generique.md` — le plan d'origine (réalisé)
