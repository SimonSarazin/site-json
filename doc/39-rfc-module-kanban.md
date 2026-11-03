[← Retour à l'index](README.md)

# RFC — Module `kanban` : le kanban de co-kanban, sur le contexte du site

> Document de DÉCISION, rédigé le 27/10/2026. Il propose de porter dans site-json le kanban de
> l'application co-kanban (`co-preact/co-kanban`), restreint à l'élément qui porte le site.
>
> **Mise à jour du 28/10/2026** : implémentation commencée, lots 0 à 2 livrés (voir
> [doc/40](40-module-kanban.md)). Les deux points bloquants sont levés (§0), les décisions du §10
> appliquées selon les recommandations, Q1 et Q2 tranchées autrement (§10). Les routes utilisées sont
> **20**, et non 22 : le compte du §3.1 était faux (21), et `member/list` est retirée, faute de
> consommateur (les membres arrivent avec `board/get`).
>
> **Mise à jour du 03/11/2026** : les 20 routes sont **livrées dans le SDK 1.0.205** (registre, façade
> `api.kanban.*`) et site-json est basculé sur le client principal (doc 41 §2). Les mentions d'`ENDPOINT.md`
> ci-dessous (§0, §4.1, §4.2, §9) désignent un fichier qui n'a jamais existé dans ce dépôt : la description des
> routes est la doc 41. Le paragraphe « Écart de versions » du §4.1 est périmé (dépôt et `node_modules` en 1.0.204
> au 03/11). Le PHP des routes est sur `master` du legacy depuis le 03/11/2026 (citizenToolKit `5da315fa`, costum
> `6a5479116`) : la recette réelle contre un serveur qui le porte reste à faire.
>
> **Mise à jour du 02/11/2026** : lots 3 (tableau des actions), 4 (fiche de carte, route
> `/kanban/actions/carte/:cardId`), 5 (kanban des rôles) et 6 (vues Liste, Table, Chronologie, Vue
> d'ensemble et Jalons, gestion des jalons ; doc 40 §11) livrés ; lot 7 : entrée de menu faite (Q5 et Q8
> appliquées), routes SDK décrites dans la [doc 41](41-module-kanban-sdk.md), branchement à leur livraison.

## 0. L'essentiel en une page

**Ce qu'on veut.**
- Une page `/kanban` sur les sites qui activent le module, avec la liste des kanbans de l'élément
  porteur du costum (l'organisation ou le projet du site). Pour l'instant, deux kanbans : **les
  actions** et **les rôles**.
- Un clic ouvre le kanban, branché sur cet élément.
- Le kanban est une copie fidèle de celui de co-kanban : colonnes, glisser-déposer, fiche de carte,
  filtres, vue des rôles. Il est livré sous forme de module, comme le module `comment` (panneau
  « Discussions »).

**Ce qui existe déjà.**
- Le **backend** est prêt et ne change pas. Ce sont les 38 routes `POST /costum/kanban-<contrôleur>/<action>`
  (code dans `citizenToolKit/controllers|models/kanban`, contrôleurs dans `modules/costum/controllers`).
  Un tableau « relié » à un élément Communecter (le *board-lien*) n'en utilise que 22 (§3.1).
- Le **front** à porter fait environ 35 000 lignes dans co-kanban, avec la même pile que site-json :
  React 19, React Router 7, TanStack Query, Tailwind 4 et dnd-kit, ce dernier déjà dans les dépendances de site-json.
  Le portage est surtout un **rebranchement** sur le SDK, l'authentification, le contexte, les
  primitives d'interface et le thème de site-json. La logique (rangs, fusion à trois, synchronisation
  par delta, glisser-déposer) se reprend telle quelle.

**Ce qui bloquait** (levé le 28/10, cf. doc/40 §3 et §4).
1. **Le SDK n'a aucune route kanban**, ni de méthode qui appelle une URL quelconque. Or la règle est
   « lecture seule, endpoint à décrire dans `ENDPOINT.md` ». Il faut donc **22 fiches** et une
   livraison du mainteneur avant qu'un écran ne parle au vrai backend (§4).
2. **CORS** : le navigateur appelle le backend en direct (`VITE_BASE_URL_BACKEND`), et les routes
   kanban ne répondent qu'aux origines de la liste `kanbanCorsOrigins`. Chaque domaine de site
   qui active le module doit y figurer (§3.2).

**Ordre de grandeur** : 14 à 20 jours de développement en 8 lots (§9), plus le délai de livraison du SDK.

## 1. Ce qu'on construit

### 1.1 Parcours

```
/kanban                      liste des kanbans de l'élément porteur
├── /kanban/actions          kanban des actions (vue Tableau)
│   ├── /kanban/actions/carte/:cardId     fiche d'une carte (lien profond, au-dessus du tableau)
│   └── /kanban/actions/<vue>             autres vues : liste, vue-ensemble, jalons, table, chronologie (§10, Q4)
└── /kanban/roles            kanban des rôles des membres de l'élément
```

**Écran de liste.**
- Une tuile par kanban, avec titre, description courte et, si c'est bon marché, un chiffre (nombre
  d'actions, part terminée).
- La liste vient d'un **registre** de types de kanban dans le module, pas d'un `if` par type :
  ajouter un troisième type (par exemple les kanbans des projets d'une organisation, §10, Q7)
  revient à ajouter une entrée.

Les états de l'écran sont rendus **après hydratation** : `me` vaut `null` au rendu serveur.

| Visiteur | Ce qu'il voit |
|---|---|
| Non connecté | Les tuiles, et une invitation à se connecter (même invite que le module `comment`) |
| Connecté, pas membre de l'élément | « Réservé aux membres de <nom> ». C'est le serveur qui tranche : 403 `notMember` |
| Membre / contributeur validé | Les tuiles actives |
| Élément d'un type sans kanban (ni organisation ni projet) | Module indisponible : le routeur ne monte pas `/kanban` (§6.2) |

### 1.2 Ce que « copie fidèle » couvre

Tout ce qui sert un tableau relié à un élément Communecter, dans co-kanban :

- **Tableau des actions.**
  - Six colonnes virtuelles (`todo`, `next`, `tracking`, `totest`, `discuter`, `done`), avec leurs
    libellés et leur ordre lus sur l'élément.
  - Glisser-déposer à la souris, au doigt et au clavier, avec annonces au lecteur d'écran.
  - Alternative « Déplacer vers… » dans le menu de la carte.
  - Création rapide, archivage depuis « Terminé », masquage local des colonnes.
  - Filtres (assignés, priorité, étiquettes, échéance, statut, jalon) et recherche.
  - Synchronisation par delta (`board/sync` toutes les 10 s et au retour sur l'onglet).
- **Fiche de carte.**
  - Titre, description, priorité, assignés, étiquettes, dates (fuseau du navigateur), checklist,
    jalon (projet seulement), crédits et temps passé (owner), fil de commentaires avec non-lus.
  - Fusion à trois au moment d'écrire (bases `checklistBase`, `assigneesBase`, `tagsBase`).
- **Kanban des rôles.**
  - Colonnes « Membres », puis une par rôle.
  - Attribution par glisser (copie), création et suppression de rôle, boîte « Rôles… » au clavier,
    masquage des colonnes.
- **Droits.** Ce sont ceux de Communecter, décidés par le serveur et lus dans `capabilities`.
  Le front ne recalcule jamais un droit :
  - `owner` = admin de l'élément ;
  - `editor` = contributeur ou membre validé.
- **Différences organisation / projet**, déjà gérées par le serveur et par le front de co-kanban :
  pas de jalons sur une organisation (D22), membres organisations dans la vue Rôles.

**Hors périmètre** (propre à co-kanban, sans objet sur un site de costum) :
- les tableaux autonomes (`source:"kanban"`), leurs colonnes, membres et réglages ;
- la page « Mes projets », « Mes cartes », le choix d'un élément à relier ;
- la connexion propre à co-kanban et son menu de session.

## 2. Le contexte du site

- `useCocolight()` donne `entity` (l'`Organization` ou le `Project` porteur), ainsi que `contextType`
  et `contextId`. Ces valeurs sont résolues depuis le `VITE_SLUG` du déploiement
  (`src/lib/apiClient.ts:101-140`).
- **Le tableau relié est retrouvé, ou créé, par `board/create {source:"communecter", parentType, parentId, lang}`.**
  Cette route est idempotente : elle renvoie le lien existant (`created:false`). On met en cache
  le `boardId` sous une clé de requête qui contient l'élément et l'utilisateur. C'est le premier
  membre qui ouvre la page qui crée le lien.
- Les deux kanbans partagent ce `boardId` : la vue Rôles lit `role/list {boardId}`.
- Un non-membre reçoit 403 `notMember {boardId}`, sans le nom de l'élément. Le message affiché
  prend donc ce nom dans `entity`, que le site connaît déjà.

## 3. Backend

### 3.1 Routes utilisées (22, toutes existantes)

| Contrôleur | Routes | Rôle requis |
|---|---|---|
| board | `create`, `get`, `sync` | editor |
| column | `move` (ordre des colonnes, écrit sur l'élément) | owner |
| card | `create`, `get`, `update`, `move`, `archive` | editor (`archive`, crédits et temps : owner) |
| comment | `list`, `add`, `delete` | editor (`delete` : auteur ou owner) |
| member | `list` | editor |
| milestone | `list`, `create`, `update` (projet seulement) | `list` : editor ; écriture : owner |
| role | `list`, `create`, `assign`, `unassign`, `delete` | `list` : editor ; écriture : owner |

En option, `board/archive` et `board/delete` (owner, n'agissent que sur le lien), et `source/children`
(projets d'une organisation, §10, Q7).

Le contrat complet est dans co-kanban, `doc/BLUEPRINT.md` §11.6 et §12.3. En résumé : POST JSON,
`Authorization: Bearer` obligatoire, enveloppe `{result, data}` / `{result:false, msg, detail}`,
avec le **vrai** code HTTP.

### 3.2 CORS : à trancher (§10, Q2)

`KanbanBaseController` ne renvoie `Access-Control-Allow-Origin` qu'aux origines déclarées dans
`paramsconfig.php` (`kanbanCorsOrigins`, D40). Les autres contrôleurs de la plateforme répondent
`*`. site-json est multi-domaines, donc chaque site qui active le module doit être déclaré.

| Option | Pour | Contre |
|---|---|---|
| **A. Ajouter chaque domaine à `kanbanCorsOrigins` (recommandé)** | Aucun code. Le module est activé site par site, donc la liste reste courte | Une étape de déploiement par site, à ne pas oublier |
| B. Accepter les domaines des costums enregistrés | Automatique | Code backend nouveau, et il faut une source fiable des domaines |
| C. Répondre `*` | Simple. Le jeton Bearer et le JSON, tous deux obligatoires, ferment déjà la porte au CSRF | Revient sur la défense en profondeur de D40 |

### 3.3 Erreurs et session

Le SDK lève `ApiClientError(msg, status, responseBody)` sur un code non-2xx, et `ApiResponseError`
sur `{result:false}`. Le `detail.reason` reste donc lisible dans `responseBody`, ce qui suffit à
afficher les raisons traduites de co-kanban (`kanbanErrorText`). Un 401 déclenche le
rafraîchissement du jeton du SDK, puis la fin de session : c'est le comportement voulu.

## 4. Accès aux données : le SDK

### 4.1 Le constat

- Le SDK ne connaît aucune route `kanban`. `callEndpoint` refuse toute constante absente du registre
  (`ApiClient.ts:806-809`), et l'option `endpoints` du constructeur **remplace** le registre au lieu
  de l'étendre.
- La règle du workspace : `cocolight-api-client` en lecture seule. Un endpoint à créer se décrit dans
  `ENDPOINT.md` (une fiche par endpoint). Côté front, pas de `fetch` brut en dur.
- Le registre sait déjà décrire ces routes : `contentType: "application/json"`, `auth: "bearer"`. Il
  existe des précédents `costum/...`, comme `COSTUM_PROJECT_ACTION_REQUEST_*`.
- **Écart de versions à signaler au mainteneur** : le dépôt local du SDK est en 1.0.195 et le
  `node_modules` de site-json en 1.0.197, mais `package.json` exige `^1.0.203` (façade
  `api.discussions`, livrée en 1.0.202).

### 4.2 Ce qu'on demandera (lot 0)

- **22 fiches dans `ENDPOINT.md`** au format du modèle. Constantes proposées : `KANBAN_BOARD_CREATE_URL`,
  `KANBAN_BOARD_GET_URL`, … (préfixe `KANBAN_`, suffixe `_URL` recommandé par `ENDPOINT.md`).
  Chaque fiche contient le payload, la réponse et les erreurs, repris des §11.6 et §12.3 du BLUEPRINT.
  Les 104 fixtures exportées depuis le vrai PHP (`co-kanban/tests/fixtures/php/`) servent de
  formes de référence.
- **Une façade**, sur le modèle d'`api.discussions` : `api.kanban.board.get(...)`,
  `api.kanban.card.update(...)`, etc. Elle renvoie les données typées et lève l'erreur avec son
  `responseBody`. Une méthode d'entité (`project.kanban()`) ne conviendrait pas : la vue Rôles et
  les colonnes passent par le `boardId`, pas par l'entité.
- **Contexte costum : non.** Aucune de ces routes n'envoie de mail, et la règle S5 l'exclut du contrat.

### 4.3 En attendant la livraison (§10, Q1)

Tout le module parle à une **interface de transport** (`KanbanTransport`). C'est ce qui fait déjà
la séparation dans co-kanban (`lib/http.ts` + `src/api/*`). On aura :
- **l'implémentation SDK**, la seule livrée en production ;
- **des faux** pour les tests unitaires, déjà écrits dans co-kanban (`tests/fixtures/hookHarness.tsx`).

| Option | Pour | Contre |
|---|---|---|
| **A. Attendre le SDK pour brancher le vrai backend (recommandé)** | Conforme à la règle, rien à défaire | Recette réelle impossible avant la livraison. Les écrans se développent sur les faux |
| B. Transport `fetch` temporaire, un seul fichier, retiré à la livraison | Recette réelle tout de suite | Écart à faire valider en revue (`aboire`). Il existe deux précédents dans site-json (`useRealtimeTopics`, `useWebPush`), mais ce ne sont pas des endpoints métier |

## 5. Front : le module `src/modules/kanban/`

### 5.1 Arborescence

```
src/modules/kanban/
  module.config.ts      { name: "kanban", type: "core", enabled: true } — `core` OBLIGATOIRE (doc/38 §5)
  routes.tsx            path: "kanban" (littéral entre guillemets doubles) ; [] sans `config.kanban` (§6.2)
  schema.ts             KanbanConfigSchema, importé par src/types/site-schema.ts
  index.ts              import "./i18n" + API publique
  i18n.ts, i18n/{fr,en}.json   espace "modules/kanban"
  styles.css            jetons --ck-* rebranchés sur le thème du site (§5.3), requêtes de conteneur
  types.ts              types de co-kanban (types/kanban.ts) réduits à la source communecter
  constants/queryKeys.ts   KANBAN_QUERY_KEYS (dimension utilisateur, invalidation par préfixe)
  transport/            KanbanTransport + implémentation SDK (§4.3)
  lib/                  logique pure reprise de co-kanban, avec ses tests
  hooks/                useContextBoard, useBoard, useBoardSync, useBoardMutations, useCardDetail,
                        useCardComments, useMilestones, useRoles, useBoardPrefs…
  components/home/      écran de liste et registre des types de kanban
  components/board/     tableau, colonnes, cartes, fiche, filtres, jalons
  components/roles/     kanban des rôles
  pages/                KanbanHomePage, KanbanActionsPage, KanbanRolesPage (export default, lazy)
```

### 5.2 Ce qui se reprend, ce qui se rebranche

| Partie de co-kanban | Lignes | Dans site-json |
|---|---|---|
| `lib/` : rangs, ordre canonique, fusion à trois (`cardMerge`), synchronisation, filtres, dates, `phpLowercase`, priorités, rôles, jalons, statistiques | ≈ 5 000 | **Repris tel quel**, tests compris. `merge-cases.json` devient une **troisième copie** des vecteurs (front, PHP, site-json) : à garder alignée (§8) |
| `components/board/` (50 fichiers) et `components/roles/` (9) | ≈ 12 400 | **Repris**, sans les écrans des tableaux autonomes (création, réglages, membres, colonnes éditables) |
| `pages/board/*View.tsx` | ≈ 2 800 | Tableau, Liste et Rôles en V1. Vue d'ensemble, Jalons, Table et Chronologie selon Q4 |
| `hooks/` | ≈ 2 500 | Repris, branchés sur le transport et sur `useCocolight().me`. Mutations : `useMutation` avec `onMutate`, `scope` et retour arrière (même écart que le module `comment`, précédent écrit), erreurs affichées par `sonner` |
| `api/` + `lib/http.ts` | ≈ 1 100 | Remplacés par `transport/` (§4.3) |
| `types/kanban.ts` | ≈ 1 200 | Réduit à la source communecter |
| `components/ui/` (35 primitives) | ≈ 3 300 | **Remplacées par les primitives shadcn de site-json** (dialog, popover, dropdown-menu, select, tooltip, avatar, sonner, skeleton). Restent dans le module les pièces sans équivalent, avec leurs tests (`FailureNotice`, `ChoiceRow`, `stopTouchOnControls`) |
| `components/layout/` : coque, barre du haut, session, thème, raccourcis | ≈ 2 500 | **Non repris** : en-tête du site (`SiteHeader`) et en-tête de tableau du module. On garde les préférences de tableau et la recherche |
| `i18n/{fr,en}.json` | ≈ 1 200 lignes par langue | Repris dans `modules/kanban`, sans les clés hors périmètre. Parité fr/en vérifiée par le préflight |
| Authentification (`useAuth`, `RequireSession`, jeton en `localStorage`) | — | **Non repris** : `useCocolight().me` et la garde de page du module (§6.3) |
| Mock Express (`mock/server.js`, 6 000 lignes) | — | Non repris. Il reste l'outil de co-kanban |

### 5.3 Apparence (§10, Q3)

- co-kanban a son propre jeu de jetons (`styles/tokens.css`, 160 variables `--ck-*`) et un thème
  sombre issu des maquettes. site-json injecte au contraire les couleurs **de chaque site**
  (`SiteTheme.tsx`, clair et sombre par classe `.dark`).
- **Recommandation** :
  - garder la **géométrie** de co-kanban (largeur de colonne, marges de carte, espacements, durées) ;
  - rebrancher ses **couleurs** sur les jetons du site (`--background`, `--card`, `--primary`,
    `--muted`, `--border`, `--success`, `--warning`…) dans `styles.css`, sous une classe racine du module ;
  - la carte, la colonne et la réglette gardent alors leur anatomie, mais prennent la marque du site.
- **Point de vigilance** : co-kanban vérifie ses contrastes (`styles/contrast.check.mjs`, étiquettes
  cyan à encre sombre). Avec des palettes par site, il faut refaire ce contrôle sur chaque site qui
  active le module.

### 5.4 Rendu serveur et chargement

- **Rendu serveur sans données.** `me` vaut `null` au rendu serveur et aucun appel authentifié n'y
  est possible. Les pages rendent un squelette au serveur, et le même squelette au premier rendu client.
- **Chargement paresseux.** Chaque page est chargée par `lazy` de `vite-preload`, avec `export default`
  et un `Suspense` local, tout comme les grosses boîtes (fiche de carte, boîte des jalons).
  Le préflight `lazy-entry-facades` et le budget `bundle-size` s'appliquent.
- **Pas de *loader* SSR** : toutes les données dépendent de l'utilisateur.

## 6. Branchement dans site-json

### 6.1 Config

```json
"kanban": { "boards": ["actions", "roles"] }
```

- **Clé** : `kanban` à la racine de `SiteConfig`, avec un schéma dans `modules/kanban/schema.ts`.
  `boards` est optionnel, les deux kanbans par défaut.
- **Zod ne lit pas la config à l'exécution** : le code reste défensif.
- **À mettre à jour en même temps** : la ligne du tableau « Modules » de
  `.claude/skills/config-assistant/SKILL.md` (le préflight `skill-integrity` échoue sans elle),
  ainsi que `npm run audit:config` et `npm run config:validate`.

### 6.2 Montage

- `routes.tsx` renvoie `[]` sans `config.kanban`, comme `aac`.
- Il renvoie aussi `[]` quand le site n'a pas de porteur organisation ou projet. Ce test se fait
  côté page : la fabrique ne connaît que la config.
- Les pages de la config passent devant les routes de module (`buildRoutes.tsx`). Une page `/kanban`
  déclarée en config masquerait donc le module : `audit:config` doit le signaler.

### 6.3 Garde et mise en page (§10, Q6)

- Les routes de module n'ont ni garde (`page.auth`) ni mise en page. La page se garde elle-même,
  comme `AdminPage` : `useHydrated`, puis l'invite de connexion, puis le refus du serveur.
- **Recommandation de mise en page** : `SiteHeader`, un `<main>` pleine largeur pour le tableau,
  et pas de `SiteFooter` sur le tableau. On le garde sur l'écran de liste.

### 6.4 Entrée de menu (§10, Q5, Q8)

- **L'existant.** `auth.menu.kanban` ajoute au menu du compte une entrée « Kanban » qui ouvre le
  kanban **legacy** (`<serverUrl>/#@<slug>.view.actions`) dans un nouvel onglet. Elle est réservée
  aux admins du costum et activée sur `tiers-lieux` et `sport-sante-bien-etre`.
- **Recommandation** :
  - quand `config.kanban` est posé, l'entrée mène à **`/kanban`**, dans le même onglet ;
  - elle est visible des **membres et contributeurs** (`entity.isMember()` ou
    `entity.isContributor()`), puisque le serveur leur ouvre le tableau ;
  - sans le module, rien ne change.
- Possible aussi : un item `header.nav` `{path:"/kanban"}`, et une source de la palette de
  commandes (`registerCommandSource`).

## 7. Conformité à `bonnes-pratiques-code.md`

| Règle | Application |
|---|---|
| §1 Lazy (`vite-preload`) | Pages et grosses boîtes, avec `export default` et `Suspense` |
| §2 Icônes | Imports nommés de `lucide-react`, comme dans co-kanban. Jamais `import *` (préflight) |
| §3 / §4 `useMemo` / `useCallback` | Repris de co-kanban, où chacun est justifié par un commentaire. À relire au portage |
| §5 SSR | Même HTML serveur et premier rendu client (squelettes). `me` seulement après hydratation |
| §6 React Query | `KANBAN_QUERY_KEYS` avec dimension utilisateur (`useHydratedUserContextId`). Les mutations s'écartent de `useMutationWithToast` (optimiste, `scope`, retour arrière), comme `comment` : écart documenté |
| §7 Entités SDK | Façade `api.kanban.*` (§4.2). Pas de JSON brut. Les cartes sont des actions écrites par le serveur |
| §8 Sécurité / XSS | Les textes des actions sont du texte brut, à rendre **en texte** (E23 de co-kanban). Aucun `innerHTML` |
| §9 / §12 Logique pure | Elle est déjà dans des `.ts` testés dans co-kanban, et se reprend avec ses tests |
| §10 Commentaires | Les commentaires du pourquoi de co-kanban sont repris. Ceux qui citent co-kanban (« la maquette », « le mock ») sont à revoir |

## 8. Tests

- **Unitaires** : les tests co-kanban des parties reprises, environ 60 des 102 fichiers. Ils couvrent
  la logique pure, le glisser-déposer (`kanbanDnd`, `boardCollision`, `dropTarget`, annonces), les
  cartes et la fiche, et la vue Rôles. Ils sont adaptés aux fournisseurs de site-json :
  `QueryClient`, `MemoryRouter`, `vi.mock("@/hooks/useCocolight")` et un faux transport.
- **Vecteurs de fusion** : `merge-cases.json` est rejoué par le PHP et par Vitest. Une copie de plus
  dans site-json crée un risque de divergence ; un test compare l'empreinte de la copie à celle de
  co-kanban tant que les deux vivent.
- **Formes** : les fixtures du vrai PHP valident les gardes de type de la façade.
- **Préflight** :
  - `i18n-files` : parité fr/en, aucune valeur vide ;
  - `module-routes` : chemin littéral dans `routes.tsx` ;
  - `skill-integrity` : ligne du module dans le skill config-assistant ;
  - `no-import-star-lucide` ;
  - `lazy-entry-facades` et `bundle-size`, après build.
- **Navigateur** : Playwright sur un site de recette, à la souris et au doigt, sur un projet et sur
  une organisation, à 375 px et 1440 px, en clair et en sombre. On reprend la méthode qui a trouvé
  les défauts du glisser le 27/10.

## 9. Lots

| Lot | Contenu | Ordre de grandeur |
|---|---|---|
| 0 | Décisions du §10, 22 fiches `ENDPOINT.md`, décision CORS côté backend | 1 j, puis délai de livraison du SDK |
| 1 | Squelette : config et schéma, routes montées sous condition, i18n, ligne du skill, doc `40-module-kanban.md`, écran de liste et ses états | 1 à 1,5 j |
| 2 | Données : types, transport et faux, clés de requête, `useContextBoard` (création idempotente), lecture, synchronisation, mutations ; `lib/` et ses tests | 2 à 3 j |
| 3 | Tableau des actions : colonnes, cartes, glisser-déposer, filtres, recherche, masquage, archivage | 3 à 4 j |
| 4 | Fiche de carte : champs, checklist, assignés, étiquettes, dates, jalons, crédits et temps, commentaires | 2 à 3 j |
| 5 | Kanban des rôles | 2 j |
| 6 | Autres vues (selon Q4) | 2 à 3 j |
| 7 | Branchement sur le SDK livré, entrée de menu, recette multi-sites (thèmes, 375 px, a11y), performance (1 009 actions sur le plus gros projet) | 1,5 à 2 j |

Les lots 1 à 6 avancent sur les faux pendant que le SDK se livre (option A du §4.3).

## 10. Décisions à prendre

| # | Question | Recommandation |
|---|---|---|
| Q1 | Avant la livraison du SDK : attendre (A) ou transport `fetch` temporaire (B) ? | **A**. B demande l'accord de la revue. **Tranché (28/10) : ni A ni B** — un pont qui passe PAR le SDK (instance `ApiClient` dédiée, option publique `endpoints`), sans `fetch` brut ni SDK modifié (doc/40 §3) |
| Q2 | CORS : liste par site (A), domaines des costums (B) ou `*` (C) ? | **A**, le module étant activé site par site. **Tranché (28/10)** : A, avec des motifs de sous-domaine ; `https://*.00.re` par défaut couvre tous les sites SiteForge (doc/40 §4) |
| Q3 | Apparence : thème du site (géométrie de co-kanban, couleurs du site) ou look co-kanban figé ? | **Thème du site** |
| Q4 | Vues de la V1 : Tableau, Liste et Rôles, ou les sept vues de co-kanban d'emblée ? | **Tableau, Liste et Rôles en V1**, le reste au lot 6 |
| Q5 | Qui voit l'entrée « Kanban » : membres et contributeurs, ou admins seulement (comme le lien legacy) ? | **Membres et contributeurs** |
| Q6 | Mise en page du tableau : en-tête du site sans pied de page, ou les deux ? | **En-tête sans pied de page** |
| Q7 | Sur un site d'organisation, proposer aussi les kanbans de ses projets (`source/children`, D35) ? | Plus tard : troisième type du registre |
| Q8 | Lien legacy `auth.menu.kanban` : remplacé par `/kanban` quand le module est actif, ou les deux ? | **Remplacé** |
| Q9 | Le code est désormais en double (co-kanban et site-json) : copie, ou paquet partagé ? | **Copie en V1**. Décider ensuite quelle application reste la référence |

## 11. Risques

- **Livraison du SDK** : c'est le chemin critique. Elle se cumule avec l'écart de versions du §4.1.
- **Chemin authentifié** : le BLUEPRINT de co-kanban le note comme jamais éprouvé contre le vrai
  backend (Q6 de co-kanban). Il est à confirmer au lot 7 sur un compte réel.
- **Thèmes par site** : contraste des étiquettes et des pastilles à revérifier sur chaque palette (§5.3).
- **Taille** : environ 25 000 lignes portées dans site-json. Le chargement paresseux protège le
  reste du site, mais le budget `bundle-size` est à surveiller.
- **Deux copies à maintenir** (Q9) : une correction faite dans co-kanban ne profite pas
  automatiquement à site-json, ni l'inverse.
