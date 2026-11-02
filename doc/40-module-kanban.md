[← Index](README.md)

# Module `kanban` — le kanban de l'élément porteur

Le kanban de l'application co-kanban, branché sur l'organisation ou le projet qui porte le site :
`/kanban` liste les kanbans de cet élément (les actions, les rôles), un clic ouvre l'un d'eux.

> **En un mot** : le backend existe déjà (routes `POST /costum/kanban-*`), la logique se reprend de
> co-kanban avec ses tests, et le SDK, qui ne connaît pas encore ces routes, est servi par un
> **pont** qui passe par lui sans le modifier (§3).

**État** (02/11/2026, branche `judi-kanban`) : lots 0 à 6 de la [RFC](39-rfc-module-kanban.md) livrés :
l'écran de liste du lot 1, le **tableau des actions** (lot 3, §9), la **fiche de carte** (lot 4, §10),
le **kanban des rôles** (lot 5, §8) et les **autres vues** du tableau des actions avec la gestion des
jalons (lot 6, §11). Lot 7 : l'entrée « Kanban » du menu du compte mène à `/kanban` (§1) ; reste le
branchement sur le SDK, une fois les routes livrées ([doc 41](41-module-kanban-sdk.md)).

## 1. Activer le module

```json
"kanban": {}
```

- Sa présence monte `/kanban`, `/kanban/actions` et ses vues (`liste`, `table`, `chronologie`,
  `vue-ensemble`, `jalons`), la fiche d'une carte sous chaque vue (`/kanban/actions/carte/:cardId`,
  `/kanban/actions/liste/carte/:cardId`…) et `/kanban/roles` (`routes.tsx`). Sans elle, ces URL tombent
  sur le catch-all du site, comme `aac`.
- `"boards": ["actions"]` restreint les kanbans proposés et fixe leur ordre (`schema.ts`).
- **Entrée de menu** : avec `"auth": { "menu": { "kanban": true } }`, l'entrée « Kanban » du menu du compte
  (avatar, et menu mobile) mène à `/kanban`, dans le même onglet, à la place de l'ancien lien vers la vue
  actions de la plateforme. Elle est montrée aux admins du porteur, aux membres d'une organisation et aux
  contributeurs d'un projet (`resolveKanbanEntry`, [doc 30](30-module-admin.md)). Sans le module, l'entrée
  garde l'ancien lien, pour les admins du costum (cas de `tiers-lieux`).
- **Prérequis** :
  - le porteur du site est une **organisation** ou un **projet** (`useCocolight().contextType`). Sinon
    la page dit « Pas de kanban sur ce site » ;
  - le domaine du site passe le CORS des routes kanban (§4).

## 2. Ce que voit le visiteur

L'état se décide après hydratation (`lib/accessState.ts`) : au rendu serveur, `me` vaut `null`, et une
invite de connexion rendue côté serveur ferait clignoter l'écran pour un membre connecté.

| Visiteur | `/kanban` |
|---|---|
| Rendu serveur, premier rendu client | Les tuiles du registre, sans état ni chiffre (squelette) |
| Non connecté | Les tuiles, et l'invitation à se connecter (`LoginPrompt`, modale globale) |
| Connecté, pas membre | « Réservé aux membres », tuiles inertes. C'est le serveur qui tranche : 403 `notMember` |
| Membre / contributeur | Tuiles actives. Celle des actions montre le **flux** du tableau (une bande par colonne, large comme sa part de cartes, nommée dans une légende) ; celle des rôles, le nombre de rôles et de membres, leurs portraits et les rôles sans titulaire |
| Échec (réseau, serveur) | Titre et conseil de la classe d'échec, bouton « Réessayer » |

Le flux et ses chiffres viennent de `board/create` (`board.counts`, `cardCount` des colonnes) : l'écran
ne charge pas l'instantané complet. Les colonnes ouvertes prennent la couleur primaire du site, de plus
en plus soutenue vers l'aval ; « Terminé » prend un vert adouci, pour ne pas éclipser le travail ouvert
sur un tableau mûr (une barre haute comme la plus grosse colonne, l'ancienne silhouette, réduisait les
colonnes ouvertes à un trait dès que « Terminé » grossissait).

L'aperçu des rôles vient de `role/list`, par `useRoles` : le même cache que la vue Rôles, qui s'ouvre
donc sans attendre depuis la tuile. Un pied par type de kanban (`TILE_FOOTERS`, un `Record` sur les
identifiants du registre), squelette tant que la session ou les chiffres chargent, rien si l'accès
est refusé ou si l'appel échoue.

## 3. Accès aux données : le pont SDK

Le SDK n'a aucune route kanban et il est en lecture seule (CLAUDE.md §3). Les **20 routes**
utilisées sont décrites pour le mainteneur dans la [doc 41](41-module-kanban-sdk.md), avec la bascule à
faire à leur livraison ; `ENDPOINT.md` y renvoie. En attendant :

```
api/*.ts ──► KanbanClient.post(constante, corps, garde)        transport/kanbanClient.ts
                │
                ▼
     createSdkKanbanClient                                       transport/sdkKanbanClient.ts
        ├─ prend les jetons du client principal du site
        ├─ bridge.callEndpoint(constante, corps, false, false)   ApiClient DÉDIÉ, construit avec
        │                                                         KANBAN_ENDPOINTS (option publique
        ├─ rend au client principal les jetons rafraîchis         `endpoints`) — transport/kanbanEndpoints.ts
        ├─ ApiClientError → KanbanApiError (code, raison, classe d'échec)
        └─ déplie {result, data} et valide data par la garde
```

- **Pas de `fetch` brut, pas de SDK modifié.** L'appel passe par `callEndpoint` du SDK : en-tête
  Bearer, rafraîchissement sur 401, disjoncteur, erreurs typées.
- **Pas de schéma `request` dans le registre du pont** : avec un schéma, le SDK retire tous les `null`
  du payload (`stripNullsInPlace`), et `null` veut dire « effacer » dans ce contrat (`dueDate`,
  `milestoneId`…). La forme des payloads est tenue par les types de `api/*.ts`.
- **Jetons** : le pont n'a pas de session propre. Il copie les jetons du client principal avant chaque
  appel et lui rend ceux que le SDK a rafraîchis (jeton d'accès de 10 min, polling toutes les 10 s).
  Le jeton de rafraîchissement de Communecter n'est ni stocké ni révoqué : deux clients peuvent s'en
  servir sans se gêner.
- **À la livraison du SDK** : supprimer `kanbanEndpoints.ts` et faire appeler par `sdkKanbanClient.ts`
  le client principal. Les constantes sont les mêmes, rien d'autre ne change.

**Session du module** : `KanbanSessionProvider` (racine des pages) pose `{hydrated, userId, profile,
client}` à partir de `useCocolight()`. Les hooks repris de co-kanban gardent leurs deux entrées,
`useCurrentUserId` et `useKanbanClient`.

**Mutations** : `useMutation` direct, avec `onMutate` optimiste, file par tableau (`scope`) et
retour arrière conditionnel (`hooks/mutationFeedback.ts`), échecs annoncés par `sonner` avec la
raison du serveur. C'est l'écart assumé à `useMutationWithToast` (bonnes pratiques §6), le même que
le module `comment` : un glisser-déposer ne peut pas attendre la réponse du serveur.

**Clés de cache** : `KANBAN_QUERY_KEYS` (`constants/queryKeys.ts`), toutes avec la dimension
utilisateur (id du compte, après hydratation). Les requêtes ne réessaient qu'**une** fois, et
seulement un échec passager (`shouldRetryKanbanQuery`) : un 403 s'affiche tout de suite.

## 4. CORS

Le navigateur du site appelle le backend en direct. `KanbanBaseController` reflète l'origine si elle
figure dans `kanbanCorsOrigins` (`paramsconfig.php`), jamais `*`.

- L'allow-list accepte des **motifs de sous-domaine** : `https://*.00.re` couvre `ssbe.00.re`, pas
  `a.ssbe.00.re`, ni `00.re`, ni `evil00.re`, ni `http://`.
- **Par défaut** (param absent), `https://*.00.re` est accepté : c'est l'hébergement des sites
  SiteForge. Un site sur un domaine propre (`www.ssbe.re`) doit être déclaré.
- Une liste configurée **remplace** les défauts : y redéclarer `https://*.00.re`.

Vérifié sur le backend local : préflight `ssbe.00.re` → origine reflétée ; `evil00.re` → aucun en-tête ;
401 `invalidToken` → en-tête présent.

## 5. Arborescence

```
src/modules/kanban/
  module.config.ts · routes.tsx · schema.ts · index.ts · i18n.ts · i18n/{fr,en}.json
  types.ts                 types et gardes de réponse de co-kanban
  transport/               KanbanClient, pont SDK, registre des 20 routes
  api/                     les 20 fonctions d'appel (constante + garde)
  constants/queryKeys.ts   KANBAN_QUERY_KEYS
  hooks/                   useContextBoard (board/create idempotent), useBoard, useBoardSync,
                           useBoardMutations, useCardDetail, useCardComments, useMilestones,
                           useBoardActivity, useRoles, mutationFeedback, useKanbanSession
  lib/                     logique pure de co-kanban (rangs, fusion à trois, synchronisation,
                           filtres, dates, rôles, jalons…) + accessState, contextParent,
                           boardFlow, kanbanPaths (adresses et routes des vues), activityFeed,
                           sessionProfile, kanbanErrors
  components/              KanbanPageFrame, KanbanSessionProvider, KanbanAccessNotice,
                           home/ (registre boardTypes, tuiles, flux du tableau, aperçu des rôles),
                           board/ (cadre des tableaux, tableau, colonnes, cartes, glisser-déposer,
                           barre de filtres, masquage local, teintes de colonne), actions/ (mise
                           en page du tableau des actions et ses six vues, §11), card/ (fiche de
                           carte : formulaire, éditeurs, fil de commentaires), milestones/
                           (gestion des jalons),
                           roles/ (vue Rôles), ui/ (pièces sans équivalent dans le site)
  lazyDialogs.ts           boîtes chargées à la demande (fiche de carte, jalons), déclarées dans
                           le chunk d'entrée (§9) ; les vues le sont dans `routes.tsx`
  pages/                   KanbanHomePage, KanbanActionsPage, KanbanRolesPage (lazy)
  __fixtures__/            faux SDK, harnais des hooks, instantanés de test
```

## 6. Tests

- `npx vitest run -c vitest.config.unit.ts src/modules/kanban` : 74 fichiers, 805 tests.
  - Logique pure reprise de co-kanban, tests compris (17 fichiers). `lib/__fixtures__/merge-cases.json`
    est une **copie** des vecteurs de fusion (front co-kanban, PHP, site-json) : une correction se
    reporte dans les trois.
  - Hooks (polling delta, mutations optimistes, rôles) sur le harnais `__fixtures__/hookHarness.ts` :
    le backend simulé est le pont du SDK (`FakeBridge`), servi par le vrai transport.
  - Pont : registre, traduction de chaque erreur du SDK, enveloppe, jetons rendus, annulation.
  - Écran de liste : les six états du §2.
- Préflight : `i18n-files` (parité fr/en, aucune valeur vide, pas de placeholder répété),
  `module-routes`, `skill-integrity` (ligne du skill config-assistant).
- Navigateur (28/10) : `/kanban` et `/kanban/actions` sur SSBE, rendu serveur puis hydratation sans
  erreur, sans défilement horizontal à 375 et 1440 px.
- **Pas encore éprouvé** : le chemin authentifié contre le vrai backend. Il se teste en se connectant
  sur le site de dev (`VITE_BASE_URL_BACKEND=http://communecter74-dev`).

## 7. Suite

| Lot | Contenu |
|---|---|
| 7 | Fait : entrée de menu (`auth.menu.kanban` → `/kanban`, §1). Reste : branchement sur le SDK une fois les routes livrées (procédure : [doc 41](41-module-kanban-sdk.md) §2), recette multi-sites |

**Élagage fait au lot 3** : les gardes de réponse et les types des tableaux autonomes de co-kanban
(liste des tableaux, suppression, membres, colonnes gérées, recherche, éléments source), les lecteurs
secondaires de `useBoard`, `replaceColumn`, la réglette de colonne (`computeRulerFill`, inutilisée
dans co-kanban même), et 206 clés i18n par langue (coque de l'application, connexion, thème,
raccourcis, gestion des tableaux et des colonnes). Ce qui était gardé pour le lot 4 sert à la fiche de
carte ; la **gestion des jalons** (`useMilestones`, `milestone/*`) sert depuis le lot 6 (§11).

**Élagage fait au lot 6** : ce qui servait la cloche de co-kanban (marqueur « vu » du fil d'activité,
clés `activity.bell`, `unseen`…), l'écran « Mes cartes » (clés `myCards` hors des en-têtes de table),
la vue Rôles des vues d'un tableau (elle a sa page), la colonne « Liens » et ses clés (`links`).
`knip` ne signale plus rien dans le module.

## 8. Kanban des rôles (`/kanban/roles`)

« Membres », puis une colonne par rôle de l'élément, et « + Ajouter un rôle ». Repris de co-kanban
(`components/roles/`, `pages/board/RolesView.tsx`), logique et tests compris.

- **Glisser = copie** : une carte de « Membres » lâchée sur une colonne lui attribue le rôle
  (`role/assign`) et reste dans « Membres ». Souris (6 px de seuil) et doigt (appui long) ; au clavier,
  le menu « ⋯ » de la carte ouvre « Rôles… », une case par rôle. Annonces au lecteur d'écran à chaque
  étape du glisser.
- **Retrait** depuis une colonne (confirmation), **création** par le composeur (validation avant
  l'appel : vide, trop long, caractère interdit, doublon), **suppression** par le menu de la colonne
  (confirmation qui compte les porteurs). Toutes optimistes, avec retour arrière et raison du refus.
- **Lecture seule** sans `canManageRoles` : ni prise, ni menu de carte, ni retrait, ni composeur.
- **Masquage local** des colonnes de rôle (préférence du poste, `localStorage`, clé
  `kanban.hiddenColumns.<boardId>:roles`, lue après hydratation), « Colonnes affichées » et
  l'indicateur « N colonnes masquées · Tout afficher ».
- **Primitives** : celles du site (`DropdownMenu`, `Dialog`, `Popover`, `Avatar`, `Button`, `Input`) ;
  restent dans le module les pièces sans équivalent (`ActionMenu` à sections, `ChoiceRow` à case
  native, `DangerNotice`/`FailureNotice`, `Pill`, `stopTouchOnControls`). Géométrie de co-kanban
  (`styles.css`, classe `.kanban-module`), couleurs et polices du site.
- **Pas de polling delta** sur cette page : il exigerait l'instantané complet du tableau pour suivre
  les seuls rôles. La liste se relit au retour sur l'onglet et après chaque écriture.
- **Écart corrigé au portage** : à la fermeture de « Rôles… », ouverte depuis le menu d'une carte, le
  focus retombait sur `<body>` (le menu Radix a disparu avant l'ouverture de la boîte). Il revient
  désormais au menu de la carte (`memberMenuIn`).
- **Tests** : 22 tests de la vue montée (rendu, lecture seule, recherche, « Rôles… », retrait,
  suppression, composeur, glisser rejoué, masquage), logique pure, boîte « Colonnes affichées », garde
  tactile, et un test des clés i18n mortes de `views.roles`. Rendu vérifié en capture sur le thème SSBE
  (clair, sombre, 375 px).

## 9. Tableau des actions (`/kanban/actions`)

Une colonne par statut des actions de l'élément (`todo`, `next`, `tracking`, `totest`, `discuter`,
`done`). Repris de co-kanban (`KanbanBoard`, `KanbanColumn`, `TaskCard`, `CardPreview`,
`CardComposer`, `BoardFilterBar`, et leur logique pure : `kanbanDnd`, `canonicalDnd`,
`dragAnnouncements`, `boardCollision`, `columnView`, `cardMeta`, `filterBar`), tests compris.

- **Glisser-déposer** d'une carte d'une colonne à l'autre : souris (6 px de seuil), doigt (appui
  long de 220 ms, un glissement reste un défilement), clavier (poignée de la carte, flèches). L'ordre
  dans une colonne est **canonique** (priorité, puis date de création, D16) : l'aperçu montre d'emblée
  la place que le serveur donnera, et un dépôt dans la même colonne n'envoie rien. Les colonnes se
  réordonnent par leur titre quand le serveur le permet (`canReorderColumns`). Annonces au lecteur
  d'écran à chaque étape.
- **« Déplacer vers… »** (menu « ⋯ » de la carte) : l'alternative sans glisser, sur les mêmes helpers.
- **Carte** : priorité (point à quatre formes, lisible sans la couleur), titre (cinq lignes), étiquettes,
  échéance (« en retard » au jour civil, icône d'alerte), assignés, checklist, commentaires et non-lus,
  liens, crédits, temps passé. Colonne de fin : titre barré, coche, **« Archiver »** avec confirmation.
- **Création** au pied de chaque colonne : la saisie se garde en cas d'échec, Entrée enchaîne, la carte
  créée est montrée et annoncée à son rang. Filtré sur un seul jalon, la carte y est rattachée.
- **Barre de filtres** : recherche, Assignés, Priorité, Étiquettes, Échéance, Statut, et Jalon sur le
  tableau d'un projet. Compteurs sur tout le tableau, résultat annoncé après une pause.
- **Avancement** (« 2/9 terminées · 22 % »), **masquage local** des colonnes (clé
  `kanban.hiddenColumns.<boardId>`), fenêtre de 50 cartes par colonne (« Afficher N de plus »), total
  des montants au pied de chaque colonne, **polling delta** (`useBoardSync`, toutes les 10 s).
- **Réduit à un tableau relié**, comme le menu de colonne : ni création, renommage, limite ou suppression
  de colonne, ni « Ajouter en tête » (ordre canonique), ni suppression de carte (le serveur répond 409).
- **Écarts avec co-kanban** :
  - pas de raccourci ⌘F / Ctrl+F : sur une page de site, il confisquerait la recherche du navigateur ;
  - les teintes de priorité et la coche de fin restent celles de co-kanban (`--ck-prio-*`,
    `--ck-success-ink` dans `styles.css`) : elles ont un sens fixe, et les `--success`/`--warning` du
    site sont des teintes de fond, trop pâles pour un tracé.
- **Corrigé au portage** : après « Déplacer vers… » vers une autre colonne, le focus tombait sur
  `<body>` (la carte démontée emportait le menu qui devait le reprendre). Il suit maintenant la carte
  dans sa nouvelle colonne, comme après un dépôt au clavier ; s'il n'y a pas de déplacement, il revient
  au menu.
- **Boîtes à la demande** : « Colonnes affichées » et « Déplacer vers… » sont chargées au premier
  geste, et déclarées dans `lazyDialogs.ts`, importé par `routes.tsx`. Un `import()` écrit dans le chunk
  d'une page lui ferait perdre sa façade de manifest, donc ses modulepreload SSR (préflight
  `lazy-entry-facades`).
- **Tests** : logique pure de co-kanban (11 fichiers), tableau monté (fenêtre de cartes, focus après un
  archivage, composeur, annonces, focus après « Déplacer vers… »), glisser rejoué dans les deux modes
  d'ordre, composeur, barre de filtres, carte et « Déplacer vers… », vue montée sur le faux pont du
  SDK (chargement, recherche, masquage, archivage, échec et « Réessayer »). Rendu vérifié en capture sur
  le thème SSBE (clair, sombre, 375 px), sans défilement horizontal de la page.

## 10. Fiche de carte (`/kanban/actions/carte/:cardId`)

Un clic n'importe où sur une carte ouvre sa fiche ; au clavier, c'est le **lien du titre** (Entrée), ou
« Ouvrir la carte » dans le menu « ⋯ ». La fiche est une **route fille** de la vue qui l'ouvre
(`<vue>/carte/:cardId`, §11) : un lien la rouvre, « Précédent » la referme, et la même instance de la
vue sert aux deux routes (`actionsChildRoutes`), donc la vue, la recherche et les filtres restent tels
quels dessous. La fiche est rendue par la mise en page (`ActionsLayout`), par-dessus n'importe quelle vue. Reprise de co-kanban (`CardDialog`,
`cardForm`, `ChecklistEditor`, `AssigneePicker`, `DueDateField`, `TagsEditor`, fil de commentaires),
tests compris (`cardForm`, `cardDialogCommunecter`, `cardDialogTruncated`).

- **Champs d'une action** : titre, description, priorité (« Aucune » comprise), échéance (fin de jour,
  aide « en retard » / « dans N jours » après hydratation), date de début, **jalon** (projet seulement,
  D22 ; un jalon clos reste proposé s'il est celui de la carte), **étiquettes libres** (tags, Entrée ou
  virgule, suggestions du tableau, pseudo-tags de statut refusés), assignés (orphelins listés pour qu'on
  puisse les retirer), **montant et temps passé** (modifiables par un administrateur de l'élément,
  `canEditCredits`, lisibles par tous), checklist, puis le **fil de commentaires** (hors du formulaire).
- **Ce qui part** : seulement les champs modifiés, et chaque liste modifiée (checklist, assignés, tags)
  avec sa **base**, la valeur vue à l'ouverture (`buildCardPatch`) : le serveur n'applique que la
  différence, une écriture faite ailleurs pendant que la fiche est ouverte n'est pas effacée. Seuls les
  champs envoyés sont validés : un état hérité de Kanban gestion qu'on n'a pas touché ne bloque rien.
- **Droits** lus dans `capabilities` : éditeur (tout), lecteur assigné (sa checklist seulement), lecteur
  (lecture). « Archiver » si `canArchiveCards`, avec confirmation, optimiste comme depuis le tableau :
  la fiche se ferme aussitôt, un refus remet la carte et se notifie. Pas de suppression (409 sur un
  tableau relié).
- **Refus** : le premier champ fautif prend le focus, son message est sous lui ; un refus du serveur qui
  nomme un champ (`detail.field`) s'affiche sous ce champ ; le résumé, l'échec et les confirmations sont
  dans une zone fixe au-dessus du pied, toujours en vue. Fermer une fiche modifiée demande confirmation.
- **Carte tronquée** (checklist non servie par `board/get`, §11.9 E29) : la fiche relit `card/get` à
  chaque ouverture et en fait son brouillon et sa base ; un échec se dit, avec « Réessayer ». Un lien
  vers une carte qui n'est plus sur le tableau le dit, plutôt qu'un chargement sans fin.
- **Écarts avec co-kanban** :
  - réduite à une action Communecter : ni statut choisi, ni étiquettes du tableau, ni liens, ni
    suppression (code de co-kanban non repris) ;
  - en-tête et pied fixes, seul le corps défile (co-kanban bornait le corps à 70 % de l'écran) ;
  - l'échéance proche s'écrit en ambre `--ck-warn-ink` (encre de texte, >= 4.5:1), le `--warning` du
    site étant une teinte de fond.
- **Corrigé au portage** : la boîte, rendue dans un **portail**, sortait de `.kanban-module` et perdait
  les variables `--ck-*` (points de priorité, coche de checklist). Elle porte la classe elle-même, comme
  le panneau des filtres, qui avait le même défaut depuis le lot 3.
- Chargée à la demande (`lazyDialogs.ts`, 34 Ko, 10 Ko compressés).

## 11. Autres vues du tableau des actions (lot 6)

Les vues de co-kanban, reprises avec leur logique et leurs tests (`pages/board/*`, `boardViews`,
`BoardViewControls`, `MilestonesDialog`, `activityFeed`), sur une **mise en page commune**.

| Vue | Adresse | Ce qu'elle montre |
|---|---|---|
| Tableau | `/kanban/actions` | Une colonne par statut (§9) |
| Liste | `…/liste` | Les cartes groupées en lignes denses ; « Grouper par » (colonne, statut, priorité, assigné·e, aucun) et « Trier » ; groupes repliables, vides compris |
| Table | `…/table` | Un vrai `<table>` triable par en-tête (`aria-sort`), tri partagé avec « Trier » ; colonnes secondaires masquées par paliers sous 1 280 px |
| Chronologie | `…/chronologie` | Une piste par colonne, l'axe des semaines (trous longs sautés et signalés), « Aujourd'hui » écrit, gouttière des non datées |
| Vue d'ensemble | `…/vue-ensemble` | Avancement, en retard, à échéance cette semaine, non assignées ; répartitions par colonne et par statut ; charge par contributeur ; dernières activités |
| Vue Jalons | `…/jalons` | Projet seulement : « Sans jalon » puis une colonne par jalon ouvert, cartes en cours ; glisser ou « Déplacer vers… » change le jalon (`card/update {milestoneId}`), « Clore le jalon » au menu de la colonne, « Ajouter un jalon » |

- **Mise en page** (`ActionsLayout`, parent des routes de vue) : avancement, sélecteur « Tableau |
  Liste » (plus la vue courante si elle vient du menu), menu « ⋯ » (autres vues, « Gérer les
  jalons… » sur un projet, « Copier le lien de cette vue »), barre de filtres (remplacée par une phrase
  sur la Vue d'ensemble, qui résume tout le tableau), « Grouper / Trier » et masquage des colonnes selon
  la vue (`actionsViews.ts` : une commande sans effet sur une vue qui en accepte d'autres reste visible,
  désactivée avec sa raison). L'instantané, le polling delta, la recherche et les filtres y vivent :
  passer d'une vue à l'autre ne relit rien et garde la recherche. Les vues reçoivent tout par le
  contexte d'`<Outlet>` (`actionsOutlet.ts`).
- **Vue et carte lues sur l'adresse** (`parseActionsPath`), pas sur `useParams` : la mise en page est le
  parent des routes. `lib/kanbanPaths.ts` est la source unique des segments ; `actionsChildRoutes`
  fabrique les routes filles, pour `routes.tsx` (vues paresseuses) comme pour les tests (vues directes).
- **Chargement** : chaque vue a son chunk (6 à 9 Ko ; le Tableau et la vue Jalons partagent celui du
  tableau et de dnd-kit, 33 Ko) ; la page tombe de 51 à 20 Ko. La gestion des jalons est une boîte de
  `lazyDialogs.ts` (8 Ko).
- **Fil d'activité** : `board/sync` sur une fenêtre de 40 révisions (`useBoardActivity`, clé
  `BOARD_ACTIVITY` avec la révision) ; instants à l'heure du lecteur après hydratation. Sans la cloche ni
  le marqueur « vu » de co-kanban.
- **Gestion des jalons** (`MilestonesDialog`) : liste relue à l'ouverture (un jalon créé dans Kanban
  gestion n'est pas journalisé), créer (validation, focus au champ fautif), renommer en place (Échap
  annule sans fermer), clore et rouvrir ; un contributeur lit la même liste sans commandes.
- **Teinte des colonnes** (`columnTone.ts`) : la même que la bande du flux sur `/kanban`, en point devant
  le titre d'une colonne dans la Liste, la Chronologie et la Vue d'ensemble. Décorative, le titre est écrit.
- **Écarts avec co-kanban** :
  - la fiche s'ouvre par-dessus la vue qui l'ouvre et la fermer y ramène ; co-kanban renvoyait au
    Tableau ;
  - répartition par colonne de la Vue d'ensemble = **part des cartes** de chaque colonne, et non ses
    terminées : sur une action Communecter, terminée veut dire « dans Terminé », chaque colonne aurait
    dit 0 % ou 100 % ;
  - statuts : ceux de la source (`cardStatusesFor`), trois pour une action ; ni groupe ni barre
    « En recherche » toujours vides (`groupCards`, `statusBreakdown`) ;
  - pas de colonne « Liens » dans la Table (une action n'en porte pas) ;
  - « Colonnes affichées » reste un bouton visible sur le Tableau (lot 3) plutôt qu'une entrée du menu ;
  - « N terminée(s) sur M » accordé dans la charge par contributeur.
- **Corrigé au portage** : à 375 px, les noms d'assignés destinés au lecteur d'écran (`sr-only`)
  échappaient au rognage de la Chronologie et élargissaient la page de 700 px (blocs de vue en
  `relative`) ; le sélecteur à trois segments ne rétrécissait pas (`min-w-0`) ; une pastille de statut
  passait sur deux lignes dans la Table (`whitespace-nowrap`).
- **Tests** : registre des vues, adresses et routes, tri et regroupement, axe des semaines, vue Jalons,
  fil d'activité (purs, repris de co-kanban) ; mise en page montée sous ses vraies routes (sélecteur,
  menu, recherche qui suit, fiche ouverte depuis la Liste, organisation sans jalons) ; chaque vue
  montée ; boîte des jalons (reprise de co-kanban). Rendu vérifié en capture sur le thème SSBE (clair,
  sombre, 375 px), sans défilement horizontal de la page.
