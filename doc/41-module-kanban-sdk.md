[← Index](README.md)

# Module `kanban` — les routes à livrer dans le SDK

Les 20 routes kanban que le module appelle, décrites pour le mainteneur du SDK
(`@communecter/cocolight-api-client`), et ce que site-json fera quand elles seront livrées.

> **Pourquoi un fichier à part** : ces 20 fiches formaient le lot KANBAN d'[`ENDPOINT.md`](../../ENDPOINT.md).
> Elles en sont sorties le 02/11/2026 : un seul lot y prenait plus de mille lignes. `ENDPOINT.md` garde une fiche
> courte qui renvoie ici, et la règle ne change pas : on ne modifie pas le SDK, on décrit ce qu'il doit livrer
> (CLAUDE.md §3).

**État** : à créer côté SDK, demandé le 28/10/2026. En attendant, le module passe par un **pont** qui sert ces
routes par le SDK sans le modifier ([doc 40 §3](40-module-kanban.md#3-accès-aux-données--le-pont-sdk)). Tout le
module en dépend : liste, tableau des actions et ses vues, fiche de carte, jalons, rôles.

## 1. Ce qui est demandé au mainteneur

- **Enregistrer 20 routes** qui existent déjà côté PHP (`/costum/kanban-<contrôleur>/<action>`) : POST,
  `application/json`, jeton bearer, sans contexte costum. Aucun backend à écrire.
- **Ne déclarer aucun schéma `request`** (ou fournir une option qui garde les `null`) : le SDK retire les `null`
  du corps, et `null` veut dire « effacer » dans ce contrat (§3, point critique).
- **Pas de transformation ni de validation AJV de la réponse** : les gardes de type du front font foi.
- **Façade souhaitée** : `api.kanban.<contrôleur>.<action>(input)`, sur le modèle de `api.discussions`, qui
  renvoie `data` déplié et lève sur un refus avec le corps de la réponse.
- Les conventions communes sont au §3, une fiche par route au §4.

## 2. Bascule de site-json à la livraison (lot 7)

Les constantes demandées (`KANBAN_BOARD_GET_URL`…) sont déjà celles qu'utilise le module : seule la couche de
transport change.

1. **Monter la version du SDK** dans `site-json/package.json` (`npm install
   @communecter/cocolight-api-client@<version livrée>`), puis vérifier que les 20 constantes sont dans son
   registre.
2. **Supprimer le pont** :
   - `src/modules/kanban/transport/kanbanEndpoints.ts` (les 20 entrées de registre du pont) ;
   - dans `transport/sdkKanbanClient.ts`, `bridgeFor` et la copie des jetons : l'appel passe au client principal
     (`main.callEndpoint(constante, corps, false, false)`), ou à la façade `api.kanban.*` si elle est livrée.
     `KanbanSdkClient` se réduit alors à `callEndpoint`.
3. **Garder le reste tel quel** : l'interface `KanbanClient` (`post(constante, corps, garde)`), la traduction des
   erreurs (`kanbanErrorFromSdk`), le dépliage de l'enveloppe (`unwrapKanbanEnvelope`), les fonctions de
   `api/*.ts` et les hooks. Le type `KanbanEndpoint` vient alors des constantes du SDK.
4. **Tests** : `transport/sdkKanbanClient.test.ts` perd les cas du pont (jetons rendus au client principal) ;
   le faux SDK des tests (`__fixtures__/fakeSdk.ts`) sert le client principal au lieu du pont. La suite du module
   doit passer sans autre changement.
5. **Recette** : connexion réelle sur le site de dev (`VITE_BASE_URL_BACKEND=http://communecter74-dev`), puis
   `/kanban`, une carte créée, déplacée, modifiée et archivée, un commentaire, un jalon, un rôle attribué. Le
   chemin authentifié n'a encore jamais été éprouvé contre le vrai backend.
6. **Docs** : retirer le pont de la [doc 40](40-module-kanban.md) §3, passer ce fichier et la fiche
   d'`ENDPOINT.md` en « Livré (vX.Y.Z) ».

## 3. Conventions communes aux 20 fiches

> Ce bloc factorise ce qui vaut pour les 20 fiches `KANBAN_*_URL` du §4. Chaque fiche ne reprend que ce qui
> lui est propre.

- **Statut du lot** : À créer — demandé le 2026-10-28 · module `kanban` de site-json (RFC
  [`site-json/doc/39-rfc-module-kanban.md`](39-rfc-module-kanban.md)) : le kanban de l'app
  co-kanban, branché sur l'organisation ou le projet porteur du site.
- **Ce qui est demandé** : enregistrer dans le registre du SDK des routes **qui existent déjà côté PHP**. Aucun
  backend à écrire. Ce sont les 20 routes d'un tableau relié à un élément Communecter (« board-lien »,
  `source: "communecter"`). Hors lot : les tableaux autonomes (`source: "kanban"`),
  `board/list|update|archive|delete|attach|detach`, `card/search|delete`, `column/create|update|delete`,
  `member/list|add|role|remove|candidates` et `source/*`. `member/list` n'a pas de consommateur : les membres
  arrivent avec `board/get` (`members`), comme dans co-kanban.
  - Contrôleurs : `modules/costum/controllers/Kanban*Controller.php`, sur la base `components/KanbanBaseController.php`.
  - Actions : `modules/citizenToolKit/controllers/kanban/<contrôleur>/*Action.php`. La branche board-lien est dans
    `controllers/kanban/communecter/*Branch.php`.
  - Contrat de référence : `co-kanban/doc/BLUEPRINT.md` §3, §11.6, §12.3 et §13.
  - Formes réelles : les exports du vrai PHP dans `co-kanban/tests/fixtures/php/<contrôleur>/<action>.<cas>.json`.
    Les exemples ci-dessous en sont tirés et abrégés par `"…"`.
- **Prérequis backend, hors SDK** :
  - Le code PHP du kanban n'est **pas encore poussé** (BLUEPRINT §13 : « Rien n'est commité »).
  - Le chemin authentifié n'a jamais été éprouvé contre le serveur de dev (BLUEPRINT §11.10, Q6).
  - Le CORS n'est ouvert qu'aux origines de `kanbanCorsOrigins` (`paramsconfig.php`, D40). L'allow-list accepte
    désormais les motifs de sous-domaine, et sa valeur par défaut couvre `https://*.00.re`, l'hébergement des sites
    SiteForge (`KanbanBaseController::originAllowed()`). Seul un domaine propre (`www.ssbe.re`) reste à déclarer.
- **Transport (identique pour les 20)** :
  - Méthode `POST`.
  - `contentType: "application/json"` **obligatoire**. Sinon : 415 `unsupportedMediaType`
    `{reason: "expectedJson", expected: "application/json"}`. Ce contrôle passe avant celui du jeton.
  - `auth: "bearer"` **obligatoire**. Sans jeton : 401 `unauthorized` `{reason: "missingToken"}`. Jeton refusé :
    401 `unauthorized` `{reason: "invalidToken"}`.
  - L'identité vient du jeton, jamais de la session cookie. Les champs d'auteur envoyés dans le corps
    (`creator`, `author`…) sont ignorés.
- **Contexte costum : NON (les 20)**. Aucune de ces routes n'envoie de mail, et la règle S5 l'exclut du contrat
  (RFC §4.2). Pas de marqueur `costumContext: "request"`, pas de `costumSlug` dans le payload.
- **Enveloppe** :
  - Succès, en HTTP 200 : `{ "result": true, "data": {…} }`.
  - Refus : `{ "result": false, "msg": "<code>", "detail": {…} }`, avec le **vrai** statut HTTP :
    - 400 `badRequest` ;
    - 401 `unauthorized` ;
    - 403 `notMember` ou `forbidden` ;
    - 404 `notFound` ;
    - 409 `conflict`, `boardArchived` ou `sourceManaged` ;
    - 415 `unsupportedMediaType` ;
    - 422 `validation` ;
    - 500 `serverError`.
  - La liste fermée des codes est `KanbanResponse::$statuses` côté PHP, `KANBAN_ERROR_CODES` côté front (co-kanban
    `src/lib/http.ts`). La raison fine voyage dans `detail.reason`. Les raisons traduites sont listées dans
    `KANBAN_ERROR_REASONS` (même fichier).
  - Ce module n'émet jamais `{result: false}` en HTTP 200.
- **Ce que voit le SDK en cas de refus** :
  - Tout statut non-2xx fait lever `ApiClientError(message, status, details)`, où `details` est le **corps** de la
    réponse. Le front lit `details.msg` et `details.detail.reason`. Le `message` est générique (« Erreur lors de
    l'appel de l'API : … »).
  - Les 4xx ne comptent pas dans le circuit breaker, les 5xx y comptent : un 500 `serverError` métier
    (`roleWriteFailed`, `memberWriteFailed`, `missingUniqueIndex`) incrémente le breaker comme une panne.
  - Un 401 `invalidToken` déclenche l'intercepteur de rafraîchissement du jeton.
- **Conventions du fil** :
  - Une entité expose `_id` en chaîne ; un objet de valeur imbriqué (point de checklist, étiquette, ligne de
    `renumbered`, membre de `role/*`) porte `id`.
  - Les dates sont des entiers en **secondes**, bornés à `0 … 4102444800` (2100-01-01).
  - Un champ requis absent donne 422 `{field, reason: "required"}`. Un ObjectId malformé donne 422
    `{field, reason: "objectId"}`. Une valeur hors énumération donne 422 `{field, reason: "notAllowed", allowed}`.
  - Une date de fin antérieure au début donne 422 `{field: "endDate", reason: "beforeStartDate"}`.
- **Droits** :
  - Ils sont décidés par le serveur et renvoyés dans `capabilities` (`board/create`, `board/get`). Le front ne
    déduit jamais un droit d'un rôle.
  - `owner` = `Authorisation::isElementAdmin` de l'élément : admin direct, admin de l'organisation parente,
    superAdmin, surcharge costum.
  - `editor` = contributeur **validé** d'un projet, ou membre citoyen **validé** d'une organisation. Les liens
    `toBeValidated`, `isInviting` et `isAdminPending` sont exclus.
  - Sinon : 403 `notMember` `{boardId}`. Le détail ne révèle pas l'élément lié.
  - Un board-lien n'a pas de rôle `viewer`.
  - Sur un lien archivé, toute écriture répond 409 `boardArchived` `{boardId}`.
- **Ordre des gardes d'une route de lien** (BLUEPRINT §12.3) :
  1. board existant (404 `{boardId}`) ;
  2. droit de voir (403 `notMember` `{boardId}`) ;
  3. pour `milestone/*` et `role/*` seulement : board-lien, sinon 409 `conflict` `{boardId, reason: "notSourceBoard",
     source: "kanban"}` ;
  4. document de l'élément présent (404 `{boardId, reason: "sourceMissing"}`) ;
  5. rôle sur l'élément (403 `notMember`) ;
  6. élément disponible (404 `{parentType, parentId, reason: "sourceMissing"}`, dit au membre seulement) ;
  7. lien inscriptible (409 `boardArchived`) ;
  8. owner (403 `forbidden`) ;
  9. corps (422) ;
  10. pour `role/assign|unassign` : membre lié (404 `{reason: "notLinked"}`) ;
  11. écriture sous condition (409 `conflict` `{reason: "concurrentUpdate"}`).
- **Révision** : toute réponse d'écriture porte `rev`, la révision du tableau estampillée par l'écriture. Seule
  exception : `board/create`, dont la révision est dans `board.rev`. Le front la reçoit sans en dépendre : le
  polling (`board/sync`) réconcilie.
- **⚠️ POINT CRITIQUE pour le mainteneur — ne PAS déclarer de schéma `request` sur ces 20 endpoints** (ou fournir
  une option qui préserve `null`) :
  - Quand un endpoint a un schéma `request`, `ApiClient.callEndpoint` appelle
    `ApiClient.stripNullsInPlace(dataForValidation)` (`cocolight-api-client/src/ApiClient.ts`, étape « 2. Validation
    données (request schema) »).
  - Cette fonction supprime **en profondeur** toute clé à `null` et retire les `null` des tableaux.
  - Or, dans ce contrat, `null` veut dire **« effacer »** :
    - `card/update` : `priority`, `dueDate`, `startDate`, `milestoneId` ;
    - `milestone/update` : `startDate`, `endDate`, `description` ;
    - `card/create` : `priority`, `dueDate`, `milestoneId`.
  - L'effacement serait perdu **en silence** : la route répondrait 200 avec une carte inchangée.
  - Pour `credits` et `timeSpent`, le `null` doit atteindre le serveur pour produire 422 `required`. Supprimé par
    le SDK, il ne produirait rien, ou 422 `noUpdatableField` s'il était le seul champ.
- **Réponses côté SDK** :
  - Pas de `_transformData` : appel avec `transformResponseData = false`. Les normalisations legacy ne s'appliquent
    pas à ces formes.
  - Pas de validation AJV legacy de la réponse : pas de schéma `responses`, ou `validateResponseSchema = false`.
  - La forme est vérifiée par les gardes de type du front (`site-json/src/modules/kanban/types.ts`), qui sont la
    seule source.
- **Mode `clean`** (à confirmer par le mainteneur) :
  - En mode `clean`, `callEndpoint` ajoute l'en-tête `X-Coco-Mode: clean`. Cet en-tête est absent de
    `Access-Control-Allow-Headers` du `KanbanBaseController` (`Content-Type, Authorization, X-Requested-With`) : le
    préflight d'un navigateur échouerait.
  - `_reviveClean` ajouterait en plus un `_id` ObjectID à tout objet portant un `id` de 24 hexa (membres de
    `role/list`, `member` de `role/assign`).
  - site-json tourne en `legacy`, le mode par défaut. Le point compte si le mode change, ou s'il faut exclure ces
    routes du mode `clean`.
- **Façade souhaitée** : `api.kanban.<contrôleur>.<action>(input)`, sur le modèle de `api.discussions`.
  - `api.discussions` est livrée en SDK 1.0.202. Elle est absente du dépôt local (1.0.195) et du `node_modules` de
    site-json (1.0.197).
  - La façade renvoie `data` déplié et typé.
  - Elle lève sur un statut non-2xx comme sur un `result: false`, avec le corps de la réponse
    (`checkAndThrowApiResponseError` pour le second cas).
  - Pas de méthode d'entité : la vue Rôles et les colonnes passent par `boardId`, pas par l'entité
    `Project`/`Organization`.
  - Types de retour : ceux de `site-json/src/modules/kanban/types.ts`, repris de co-kanban `src/types/kanban.ts`.
    Ces types **ne déclarent pas** les champs en plus que le PHP envoie et que les gardes tolèrent :
    - `rev` des écritures ;
    - `capabilities` de `board/create` ;
    - `cardId` de `card/archive` ;
    - `assignedCards`, `addedBy` et `addedAt` des membres ;
    - `origin` et `inheritedFrom` des capacités.

    La façade devrait typer la forme réelle (à confirmer).
- **Consommateur front** : `site-json/src/modules/kanban/api/*.ts`, via le transport
  `site-json/src/modules/kanban/transport/` (`KanbanClient.post(constante, corps, garde)`), appelés par les hooks
  de `site-json/src/modules/kanban/hooks/`.
- **PONT temporaire, en attendant la livraison** :
  - `site-json/src/modules/kanban/transport/kanbanEndpoints.ts` déclare ces 20 mêmes entrées de registre : POST,
    `application/json`, `bearer`, ni `request` ni `responses`.
  - `transport/sdkKanbanClient.ts` les sert par une instance `ApiClient` dédiée, créée avec l'option publique
    `endpoints` du constructeur. L'appel est `callEndpoint(constante, corps, false, false)`.
  - À la livraison, ce fichier sera supprimé. Les constantes restent les mêmes.
- **Query keys** : `KANBAN_QUERY_KEYS` (`site-json/src/modules/kanban/constants/queryKeys.ts`). Toutes ont une
  dimension utilisateur :
  - `CONTEXT_BOARD` : résultat de `board/create`, par élément ;
  - `BOARD` ;
  - `CARD` ;
  - `CARD_COMMENTS` ;
  - `MILESTONES` ;
  - `ROLES` ;
  - `BOARD_ACTIVITY` : fil d'activité de la Vue d'ensemble, `board/sync` sur une fenêtre de révisions (lot 6).
- **Ordre des fiches** : board (`create`, `get`, `sync`), `column/move`, card (`create`, `get`, `update`, `move`,
  `archive`), comment (`list`, `add`, `delete`), milestone (`list`, `create`, `update`), role
  (`list`, `create`, `assign`, `unassign`, `delete`).

---

## 4. Les 20 fiches

### KANBAN_BOARD_CREATE_URL — ouvrir (ou retrouver) le tableau relié à l'élément porteur

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-board/create`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - C'est le point d'entrée du module. Il retrouve le board-lien de l'élément porteur du site (`useCocolight()` →
    `contextType`/`contextId`), ou le crée au premier passage.
  - La route est **idempotente** : un seul lien par élément, garanti par l'index unique partiel `uniq_board_link`.
    La redemander renvoie le lien existant avec `created: false`. Deux créations simultanées sont départagées par
    l'index.
  - Rôle requis : editor de l'élément (owner ou membre validé).
  - Le lien ne stocke que son type, son id d'élément, son statut, sa révision et son empreinte. Titre, description,
    couverture et dates sont lus de l'élément à chaque appel (miroir).
  - Seule la forme `source: "communecter"` est demandée ici. Sans `source`, la même route crée un tableau
    autonome (hors lot).
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `source` | `"communecter"` | oui | Discriminant du board-lien |
  | `parentType` | `"projects"` \| `"organizations"` | oui | Type de l'élément porteur |
  | `parentId` | string (ObjectId, 24 hexa) | oui | Id de l'élément porteur |
  | `lang` | string (`fr`, `en`, `en-US`…) | non | Langue des libellés personnalisés des 6 colonnes renvoyées. À défaut : `Accept-Language`, puis `fr`. `null` ou `""` valent absent |
- **Réponse attendue (shape)** (fixture `board/create.link-created`) :
  ```json
  { "result": true, "data": {
      "board": { "_id": "6adf53089c620bb617091981", "source": "communecter",
        "parentType": "projects", "parentId": "65cf05be238dc11a2b67c563",
        "title": "Corner & Dev", "description": "Le coin des devs", "status": "active",
        "visibility": "parentCommunity", "color": null, "startDate": null, "endDate": null,
        "allowExternalMembers": false, "rev": 2,
        "creator": "6448f244ecf6e50e4b539677", "created": 1708066276, "updated": 1793020680,
        "cover": "/upload/communecter/projects/x/banner.png",
        "creatorProfile": { "_id": "6448f244ecf6e50e4b539677", "name": "Ada", "username": "ada",
          "slug": "ada", "profilThumbImageUrl": null },
        "linkedBy": "5534fd9da1aa14201b0041cb", "linkedAt": 1793020680,
        "members": [], "memberIds": ["6448f244ecf6e50e4b539677", "…"],
        "labels": [{ "id": "tag:web", "name": "web", "color": "#0d9488" }, "…"],
        "counts": { "columns": 6, "cards": 6, "done": 1 } },
      "columns": [
        { "_id": "tracking", "boardId": "6adf53089c620bb617091981", "title": "En cours",
          "titleKey": "tracking", "rank": 1000, "color": null, "wipLimit": null,
          "isDoneColumn": false, "cardCount": 1, "creator": "", "created": 1793020680,
          "updated": 1793020680, "virtual": true },
        "… (6 colonnes virtuelles : todo, next, tracking, totest, discuter, done)" ],
      "capabilities": { "role": "editor", "canEditCards": true, "…": "… (même objet que board/get)",
        "source": "communecter" },
      "created": true } }
  ```
  - `created: false` quand le lien existait déjà (fixture `board/create.link-existing`).
  - Les champs `creator`, `creatorProfile` et `created` sont ceux de l'**élément**. `linkedBy` et `linkedAt`
    disent qui a ouvert le lien, et quand.
  - Pour une organisation sans créateur : `creator: ""` et `creatorProfile: null`
    (fixture `board/create.link-organization`).
- **Méthode d'entité / EndpointApi souhaitée** :
  `api.kanban.board.create({ source: "communecter", parentType, parentId, lang? })`
  → `{ board: Board, columns: Column[], capabilities: CapabilitiesPayload, created: boolean }`. Le type front
  `BoardCreateResult` ne déclare pas `capabilities`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useContextBoard.ts`, avec la clé
  `KANBAN_QUERY_KEYS.CONTEXT_BOARD` (dimensions : utilisateur et élément). Le `boardId` obtenu alimente toutes les
  autres clés.
- **Notes / cas d'erreur** :
  - 403 `notMember` `{parentType, parentId}` : l'appelant n'est ni admin ni membre validé. Le message affiché
    prend le nom de l'élément dans `entity` (RFC §2).
  - 404 `notFound` `{parentType, parentId, reason: "sourceMissing"}` : élément supprimé, ou organisation
    `deletePending`, incomplète ou `disabled`.
  - 422 `validation` : `parentType` hors liste (`notAllowed`), `parentId` absent ou malformé (`required` /
    `objectId`), `lang` malformé (`{field: "lang", reason: "lang"}`).
  - 500 `serverError` `{reason: "missingUniqueIndex", index: "uniq_board_link"}` : l'index unique manque en base.
    Le serveur refuse la création plutôt que de risquer un doublon.
  - Seul le premier appel écrit (insertion du lien et activité `board.created`). Côté front, c'est une mutation
    idempotente consommée comme une lecture : c'est le premier membre qui ouvre la page qui crée le lien.

### KANBAN_BOARD_GET_URL — instantané complet du tableau

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-board/get`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - C'est le **seul** endpoint de chargement d'un tableau. Il renvoie en un appel :
    - le board, miroir de l'élément ;
    - les 6 colonnes virtuelles, dans l'ordre `kanbanColumnOrder.actions` de l'élément ;
    - les cartes, qui sont les actions visibles de l'élément (`status ∉ {disabled, closed}`, nom non vide) ;
    - les membres (citoyens validés, comptes supprimés exclus) ;
    - les capacités de l'appelant ;
    - les jalons.
  - L'ordre est produit par le serveur. Le `rank` des cartes est un rang canonique absolu : priorité, puis date de
    création décroissante.
  - Les checklists sont servies dans un budget de 2 Mo de libellés. Au-delà, la carte arrive avec
    `checklist: []` et `checklistTruncated: true`, et ses compteurs restent exacts. La fiche relit alors la carte
    complète par `card/get`.
  - Rôle requis : editor. La route reste lisible sur un lien archivé.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Id du board-lien (issu de `board/create`) |
  | `lang` | string (`fr`, `en`, `en-US`…) | non | Langue des libellés personnalisés des colonnes. Sans libellé personnalisé, `titleKey` est traduit par le front |
- **Réponse attendue (shape)** (fixture `board/get.link`) :
  ```json
  { "result": true, "data": {
      "board": { "_id": "6adf53089c620bb617091981", "source": "communecter", "parentType": "projects",
        "parentId": "65cf05be238dc11a2b67c563", "title": "Corner & Dev", "rev": 2,
        "…": "… (même forme que board/create)" },
      "columns": [ { "_id": "tracking", "title": "En cours", "titleKey": "tracking", "rank": 1000,
        "isDoneColumn": false, "cardCount": 1, "virtual": true, "…": "…" }, "…" ],
      "cards": [ {
        "_id": "6adf53089c620bb61709196f", "boardId": "6adf53089c620bb617091981", "columnId": "totest",
        "rank": 2368113194.9006376, "title": "Badge auteur", "description": "", "priority": "urgent",
        "assignees": [], "tags": [], "labelIds": [],
        "checklist": [], "checklistDone": 0, "checklistTotal": 0,
        "status": "not_started", "links": [], "linkCount": 0,
        "commentCount": 0, "unseenComments": 0,
        "dueDate": null, "startDate": null, "completedAt": null, "milestone": null,
        "credits": 1, "timeSpent": 0, "archived": false,
        "creator": "", "created": 1734331606, "updated": 1734331606 }, "…" ],
      "members": [ {
        "userId": "6448f244ecf6e50e4b539677", "role": "owner", "origin": "parent",
        "inheritedFrom": "parentAdmin", "removable": false, "addedBy": "", "addedAt": 0,
        "profile": { "_id": "6448f244ecf6e50e4b539677", "name": "Ada", "username": "ada",
          "slug": "ada", "profilThumbImageUrl": null } }, "…" ],
      "capabilities": {
        "role": "editor", "origin": "parent", "inheritedFrom": "parentMember",
        "isExplicitOwner": false, "archived": false,
        "canViewBoard": true, "canEditCards": true, "canManageColumns": false,
        "canReorderColumns": false, "canRenameColumns": false, "canArchiveCards": false,
        "canManageMilestones": false, "canEditCredits": false, "canManageMembers": false,
        "canManageRoles": false, "canEditBoard": false, "canArchiveBoard": false,
        "canDeleteBoard": false, "canAttachBoard": false, "canDetachBoard": false,
        "canLeaveBoard": false, "source": "communecter" },
      "milestones": [ { "milestoneId": "mNYjiwQY7Qyrs7wbs", "name": "KANBAN", "description": "",
        "startDate": 1744243200, "endDate": null, "status": "open" }, "…" ] } }
  ```
  - Carte tronquée (fixture `board/get.link-truncated`) : `{ "checklist": [], "checklistDone": 0,
    "checklistTotal": 1, "checklistTruncated": true, … }`. La clé `checklistTruncated` n'existe que sur une carte
    tronquée.
  - Sur une organisation : `milestones: []` et `canManageMilestones: false` (fixture `board/get.link-organization`).
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.board.get({ boardId, lang? })` →
  `BoardSnapshotPayload` (`{ board, columns, cards, members, capabilities, milestones }`). Le front normalise
  ensuite (`toBoardSnapshot`) et retient la langue servie (`servedLanguage`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useBoard.ts`, avec la clé
  `KANBAN_QUERY_KEYS.BOARD` (utilisateur, `boardId`). La langue n'est pas dans la clé : le front recharge quand la
  langue servie diffère de celle de l'interface.
- **Notes / cas d'erreur** :
  - 404 `notFound` `{boardId}` : board inexistant.
  - 403 `notMember` `{boardId}`.
  - 404 `{boardId, reason: "sourceMissing"}` : le document de l'élément a disparu.
  - 404 `{parentType, parentId, reason: "sourceMissing"}` : élément indisponible (`deletePending`, incomplet,
    `disabled`). Ce détail n'est donné qu'à un membre (fixtures `board/get.sourceMissing`,
    `board/get.link-disabled-organization`).
  - 422 `objectId` ou `lang`.
  - Champs en plus tolérés par la garde : `addedBy` et `addedAt` sur les membres, `origin` et `inheritedFrom`
    dans les capacités.

### KANBAN_BOARD_SYNC_URL — polling delta du tableau

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-board/sync`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - C'est le temps réel du module, sans websocket. Le client rappelle la route avec la dernière révision qu'il
    connaît et rejoue le **delta** d'activités (journal `kanbanActivities`).
  - `full: true` veut dire « recharge tout par `board/get` ». Cinq cas le déclenchent :
    - `sinceRev` absent ou ≤ 0 ;
    - un trou dans le journal (TTL de 180 jours) ;
    - un retard de plus de 200 activités ;
    - un delta de plus de 2 Mo de JSON ;
    - propre au board-lien : une écriture faite **hors de co-kanban** (Kanban gestion, aap.js, rôles changés dans
      Communecter), détectée par empreinte. Le serveur journalise alors aussi un `board.updated` signé
      `actorId: "communecter"`, `payload.reason: "externalChange"`.
  - Rôle requis : editor.
  - La route est appelée en boucle. Dans co-kanban, c'est toutes les 10 s par tableau ouvert. BLUEPRINT §11.10 Q2
    discute du coût : l'empreinte relit toutes les actions de l'élément.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Id du board-lien |
  | `sinceRev` | integer (0 … 2 000 000 000) | oui côté front (non côté PHP) | Dernière révision connue. Absente ou ≤ 0 côté PHP : `full: true` |
- **Réponse attendue (shape)** (fixtures `board/sync.link-delta` et `board/sync.link-full`) :
  ```json
  { "result": true, "data": { "rev": 25, "full": false, "activities": [ {
      "_id": "6adf53099c620bb6170919aa", "boardId": "6adf53089c620bb617091981",
      "cardId": "6adf53099c620bb6170919a9", "columnId": "todo",
      "actorId": "5534fd9da1aa14201b0041cb", "verb": "card.created",
      "payload": { "card": { "_id": "6adf53099c620bb6170919a9", "…": "… (carte sérialisée)" },
        "title": "Apres nettoyage 1" },
      "rev": 24, "at": 1793020681 }, "…" ] } }
  ```
  ```json
  { "result": true, "data": { "rev": 83, "full": true } }
  ```
  - Les verbes possibles sont ceux de `ACTIVITY_VERBS` (co-kanban). Ceux d'un lien : `board.created`,
    `board.updated`, `board.archived`, `column.moved`, `card.created|updated|moved|deleted`, `role.updated`.
  - `payload.card` porte la carte sérialisée, **sans** `unseenComments` (donnée personnelle). Sa checklist suit le
    même budget de 2 Mo, appliqué à elle seule.
  - `full: true` ne porte aucune carte.
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.board.sync({ boardId, sinceRev })` → `SyncResult`
  (`{ rev, full: true }` | `{ rev, full: false, activities: Activity[] }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useBoardSync.ts`. Le hook n'a pas de clé propre :
  il rejoue le delta dans le cache `KANBAN_QUERY_KEYS.BOARD` (`lib/boardSync.ts`). Il invalide `CARD_COMMENTS`
  pour les cartes touchées, et `ROLES` sur une activité `role.updated`. Aussi
  `site-json/src/modules/kanban/hooks/useBoardActivity.ts` (Vue d'ensemble, lot 6) : `sinceRev = max(1, rev - 40)`,
  une fenêtre et non un delta, sous la clé `BOARD_ACTIVITY` (révision dans la clé).
- **Notes / cas d'erreur** :
  - Mêmes refus que `board/get` : 404 `{boardId}`, 403 `notMember`, 404 `sourceMissing`.
  - 422 `{field: "sinceRev", reason: "integer"}` ou `{field: "sinceRev", reason: "outOfRange", min, max}`.
  - Un refus 403 ou 404 suspend le polling côté front (BLUEPRINT §11.9 E25).
  - Le constat d'un changement externe **écrit** : il avance `rev` et `sourceState`, et journalise une activité.

### KANBAN_COLUMN_MOVE_URL — réordonner les colonnes du tableau

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-column/move`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Déplace une des 6 colonnes virtuelles (`todo`, `next`, `tracking`, `totest`, `discuter`, `done`). Ce sont les
    statuts de Kanban gestion.
  - L'écriture porte sur `<élément>.kanbanColumnOrder.actions` (projet ou organisation), l'ordre que lit gestion.
  - C'est la **seule** route de colonne sur un board-lien. Créer, renommer ou supprimer une colonne y répond 409
    `sourceManaged`.
  - Rôle requis : **owner** de l'élément (capacité `canReorderColumns`).
  - Le client envoie une intention de placement. Le rang d'une colonne virtuelle est sa position × 1000.
  - Une activité `column.moved` est journalisée par colonne dont la position change.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Désigne la source : une colonne virtuelle ne dit rien de son tableau |
  | `columnId` | `"todo"` \| `"next"` \| `"tracking"` \| `"totest"` \| `"discuter"` \| `"done"` | oui | Colonne déplacée |
  | `afterColumnId` | même énumération | non | Placer après cette colonne. Prioritaire sur `beforeColumnId` |
  | `beforeColumnId` | même énumération | non | Placer avant cette colonne. Sans aucune borne : en dernier |
  | `lang` | string | non | Langue du libellé personnalisé de la colonne renvoyée |
- **Réponse attendue (shape)** (fixture `column/move.link`) :
  ```json
  { "result": true, "data": {
      "column": { "_id": "done", "boardId": "6adf53089c620bb617091981", "title": "Terminé",
        "titleKey": "done", "rank": 2000, "color": null, "wipLimit": null, "isDoneColumn": true,
        "cardCount": 3, "creator": "", "created": 1793020680, "updated": 1793020681, "virtual": true },
      "renumbered": [ { "id": "todo", "rank": 3000 }, { "id": "next", "rank": 4000 },
        { "id": "totest", "rank": 5000 }, { "id": "discuter", "rank": 6000 } ],
      "rev": 77 } }
  ```
  - `renumbered` liste les **autres** colonnes dont la position change.
  - Si la colonne est déjà à cette place : `renumbered: []`, rien d'écrit, `rev` courant (fixture
    `column/move.link-noop`).
- **Méthode d'entité / EndpointApi souhaitée** :
  `api.kanban.column.move({ boardId, columnId, afterColumnId?, beforeColumnId?, lang? })` → `ColumnMoveResult`
  (`{ column, renumbered, rev }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useBoardMutations.ts`. Le hook fait une mise à jour
  optimiste dans `KANBAN_QUERY_KEYS.BOARD`, puis applique `renumbered`.
- **Notes / cas d'erreur** :
  - 403 `forbidden` `{boardId, role: "editor", required: "owner", capability: "canReorderColumns"}` (fixture
    `column/move.forbidden`).
  - 409 `boardArchived`.
  - 422 `{field, reason: "notAllowed", allowed}` : colonne inconnue.
  - 422 `{field, reason: "selfReference"}` : une borne vaut la colonne déplacée.
  - 422 `{field: "beforeColumnId", reason: "sameReference"}` : les deux bornes sont identiques.

### KANBAN_CARD_CREATE_URL — créer une carte (action Communecter)

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-card/create`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Crée une **action** de l'élément. Le `parentType` de l'action est celui de l'élément.
  - La sémantique est celle de `request/new` de Communecter :
    - `credits: 1`, `timeSpent: 0` ;
    - créateur = jeton ;
    - salle de discussion `idParentRoom`, non bloquante ;
    - dates posées selon la colonne : `done` → début, échéance et historique ; `tracking` → début ; `totest` →
      début. Un début posé par la colonne est ramené à l'échéance si celle-ci le précède.
  - Rôle requis : editor.
  - Les textes sont gardés tels que saisis et stockés échappés (`& < >` en entités, forme de la plateforme). La
    réponse renvoie le texte envoyé : il faut le rendre en **texte**, jamais en HTML.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `columnId` | `"todo"` \| `"next"` \| `"tracking"` \| `"totest"` \| `"discuter"` \| `"done"` | **oui** (board-lien) | La colonne EST le statut |
  | `title` | string, 1 à 500 caractères | oui | Nom de l'action |
  | `description` | string, ≤ 5000 | non | — |
  | `priority` | `"low"` \| `"medium"` \| `"high"` \| `"urgent"` \| `null` | non | Absent ou `null` : aucune priorité, le défaut de Communecter |
  | `assignees` | string[] (ObjectId), ≤ 100 | non | Membres citoyens validés de l'élément |
  | `tags` | string[], ≤ 30 éléments de ≤ 60 caractères | non | Étiquettes libres. Les pseudo-tags de statut (`discuter`, `next`, `totest`) sont écartés : la colonne décide |
  | `dueDate` | integer (secondes) \| `null` | non | Échéance (`endDate` de l'action) |
  | `milestoneId` | string (`[A-Za-z0-9_-]{1,40}`) \| `null` | non | Jalon du **projet** |
- **Réponse attendue (shape)** (fixture `card/create.link`) :
  ```json
  { "result": true, "data": { "card": {
      "_id": "6adf53099c620bb61709198f", "boardId": "6adf53089c620bb617091981", "columnId": "next",
      "rank": 12309424119.90015, "title": "<b>Ajouter</b> un type", "description": "Desc",
      "priority": "high", "assignees": ["5e14a3b3690864e1328b45de"],
      "tags": ["web"], "labelIds": ["tag:web"],
      "checklist": [], "checklistDone": 0, "checklistTotal": 0, "status": "not_started",
      "links": [], "linkCount": 0, "commentCount": 0, "unseenComments": 0,
      "dueDate": null, "startDate": null, "completedAt": null,
      "milestone": { "milestoneId": "mNYjiwQY7Qyrs7wbs", "name": "KANBAN", "status": "open" },
      "credits": 1, "timeSpent": 0, "archived": false,
      "creator": "5534fd9da1aa14201b0041cb", "created": 1793020681, "updated": 1793020681 },
    "rev": 7 } }
  ```
  - La requête de cette fixture envoyait `tags: ["web", "totest"]` et un `creator` tiers. Les deux sont écartés :
    le créateur vient du jeton.
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.card.create(input)` → `{ card: Card, rev: number }`.
  La fonction front (`createCard`) ne garde que `card`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useBoardMutations.ts`. Le hook insère la carte de
  façon optimiste dans `KANBAN_QUERY_KEYS.BOARD`, puis pose la carte serveur.
- **Notes / cas d'erreur** :
  - 409 `boardArchived`.
  - 422 `{field: "columnId", reason: "required" | "notAllowed"}`.
  - 422 `{field: "assignees", reason: "notProjectContributors" | "notOrganizationMembers", userIds}` : ajout d'une
    personne qui n'est pas membre validée (fixture `card/update.notOrganizationMembers` pour la forme).
  - 422 `{field: "milestoneId", reason: "unknownMilestone", milestoneId}` : jalon inconnu, ou **tout** jalon sur une
    organisation.
  - 422 `{field, reason: "required" | "empty" | "tooLong"}` sur `title`.
  - Le PHP ignore les champs propres au tableau autonome (`status`, `labelIds`, `links`, `position`), que le type
    front `CreateCardInput` déclare aussi.

### KANBAN_CARD_GET_URL — carte complète (fiche)

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-card/get`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Lit une carte avec sa checklist **toujours complète**, sans budget, et les non-lus du lecteur.
  - La fiche l'appelle à chaque ouverture d'une carte arrivée tronquée de `board/get` (`checklistTruncated`). C'est
    cette carte qui sert de brouillon et de base à la fusion à trois de `card/update`.
  - Rôle requis : editor. La route reste lisible sur un lien archivé.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Désigne la source : sans lui, la route suit le chemin du tableau autonome |
  | `cardId` | string (ObjectId) | oui | Id de l'action |
- **Réponse attendue (shape)** (fixture `card/get.link`) :
  ```json
  { "result": true, "data": { "card": {
      "_id": "6adf53089c620bb617091970", "boardId": "6adf53089c620bb617091981",
      "columnId": "discuter", "title": "Nouvelle demande", "priority": null,
      "checklist": [], "checklistDone": 0, "checklistTotal": 0,
      "commentCount": 1, "unseenComments": 1,
      "…": "… (forme complète, cf. card/create ; jamais checklistTruncated)" } } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.card.get({ boardId, cardId })` → `{ card: Card }`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useCardDetail.ts`, avec la clé
  `KANBAN_QUERY_KEYS.CARD` (utilisateur, `boardId`, `cardId`).
- **Notes / cas d'erreur** :
  - 404 `notFound` `{cardId}` : action absente, d'un autre élément, archivée (`disabled`), `closed` ou sans nom.
  - 403 `notMember` `{boardId}` (fixture `card/get.notMember`).
  - Refus de l'élément : 404 `sourceMissing`.

### KANBAN_CARD_UPDATE_URL — modifier une carte (écriture partielle, fusion à trois)

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-card/update`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Écriture **partielle** de l'action. Seuls les champs envoyés sont lus, validés et écrits. Champ absent :
    intact ; `null` : effacé. Le front n'envoie que les champs modifiés.
  - Rôle requis : editor. `credits` et `timeSpent` sont réservés à l'**owner** (capacité `canEditCredits`).
  - **Fusion à trois** (BLUEPRINT §11.4, E20) : avec `checklist`, `assignees` ou `tags`, le client joint la base
    correspondante (`checklistBase`, `assigneesBase`, `tagsBase`), c'est-à-dire la valeur vue à l'ouverture de la
    fiche. Le serveur applique la **différence** base → nouvelle valeur à l'état actuel. Ce qu'a ajouté Kanban
    gestion entre-temps survit. Sans base, la liste remplace l'ancienne.
  - Les vecteurs de test sont partagés : `merge-cases.json`, rejoués par le PHP et par Vitest.
  - La réponse porte la carte **fusionnée**, que le front prend pour vérité.
  - Les écritures qui recalculent une valeur depuis l'état lu se font par compare-and-set : trois essais, puis 409.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `cardId` | string (ObjectId) | oui | Id de l'action |
  | `title` | string, 1 à 500 | non | Nom de l'action |
  | `description` | string, ≤ 5000 | non | — |
  | `priority` | `"low"` \| `"medium"` \| `"high"` \| `"urgent"` \| `null` | non | `null` : retirer la priorité (`$unset`) |
  | `assignees` | string[] (ObjectId), ≤ 100 | non | Liste complète. Seuls les **ajouts** doivent être des membres validés : un assigné orphelin déjà présent reste admis |
  | `assigneesBase` | string[] \| `null` | non | Base de fusion de `assignees`, lue seulement avec lui. `null` : pas de base |
  | `tags` | string[], ≤ 30 éléments de ≤ 60 caractères (résultat) | non | Liste complète des tags libres. Le serveur préserve les pseudo-tags de statut et écarte ceux du client |
  | `tagsBase` | string[] \| `null` | non | Base de fusion de `tags` |
  | `dueDate` | integer (secondes) \| `null` | non | Échéance. `null` l'efface |
  | `startDate` | integer (secondes) \| `null` | non | Début. `null` l'efface. Vérification début ≤ échéance sur les valeurs **effectives** |
  | `checklist` | `{ id?: string, label: string, done: boolean }[]`, ≤ 1000 points de ≤ 500 caractères, ≤ 256 Ko de libellés | non | Liste complète. Les ids sont renvoyés tels qu'affichés. Un point neuf part sans id et reçoit celui du serveur (17 caractères) |
  | `checklistBase` | même forme \| `null` | non | Base de fusion de `checklist` |
  | `milestoneId` | string (`[A-Za-z0-9_-]{1,40}`) \| `null` | non | Jalon du projet. `null` : détacher |
  | `credits` | number, 0 … 100 000 | non | **Owner** seulement. **Non effaçable** : `null` donne 422 `required` |
  | `timeSpent` | integer (minutes), 0 … 100 000 | non | **Owner** seulement. Non effaçable |
- **Réponse attendue (shape)** (fixture `card/update.link`) :
  ```json
  { "result": true, "data": { "card": {
      "_id": "6adf53089c620bb61709196c", "boardId": "6adf53089c620bb617091981", "columnId": "todo",
      "title": "Agenda : etat vide", "priority": "low",
      "assignees": ["5e14a3b3690864e1328b45de"], "tags": ["web", "ux"], "labelIds": ["tag:web", "tag:ux"],
      "checklist": [ { "id": "T1", "label": "Maquette", "done": false },
        { "id": "ck_new", "label": "Tests", "done": true } ],
      "checklistDone": 1, "checklistTotal": 2,
      "dueDate": 1777296450, "startDate": 1777000000, "milestone": null,
      "credits": 1, "timeSpent": 0, "unseenComments": 0,
      "…": "… (forme complète, cf. card/create)" },
    "rev": 30 } }
  ```
  - La requête de cette fixture portait `tags: ["web", "next", "ux"]`, `milestoneId: null` et une clé inconnue
    `champInconnu`. Le pseudo-tag `next` du client est écarté, le jalon est détaché, la clé inconnue est ignorée.
  - Fusion à trois : fixture `card/update.link-bases`. Champs owner : fixture `card/update.link-owner`.
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.card.update(input)` → `{ card: Card, rev: number }`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useBoardMutations.ts`. Le hook fait une mise à jour
  optimiste dans `KANBAN_QUERY_KEYS.BOARD`. La carte de `KANBAN_QUERY_KEYS.CARD` est remplacée par la réponse.
- **Notes / cas d'erreur** :
  - **Exemple type du piège `stripNullsInPlace`** : `priority: null`, `dueDate: null`, `startDate: null` et
    `milestoneId: null` doivent arriver tels quels.
  - 403 `forbidden` `{reason: "ownerFieldNotAllowed", fields: ["credits"], required: "owner", boardId}` : un editor
    envoie `credits` ou `timeSpent`.
  - 409 `conflict` `{reason: "concurrentUpdate"}` : trois écritures concurrentes de suite.
  - 409 `boardArchived`.
  - 422 `{reason: "noUpdatableField", allowed}` : aucune clé modifiable.
  - 422 `{field, reason: "required"}` : `credits` ou `timeSpent` à `null`.
  - 422 `{field: "assignees", reason: "notProjectContributors" | "notOrganizationMembers", userIds}`.
  - 422 `{field: "assignees", reason: "contributorsLimit", min, max, count}` : bornes de participants de gestion
    (fixture `card/update.contributorsLimit`).
  - 422 `{field: "milestoneId", reason: "unknownMilestone", milestoneId}`.
  - 422 `{field: "tags", reason: "tooManyItems", max: 30}`.
  - 422 `{field: "checklist", reason: "tooManyItems" | "tooLong"}`.
  - 422 `{field: "endDate", reason: "beforeStartDate"}`.
  - Le statut de la carte n'est pas éditable sur un lien : il découle de la colonne (`card/move`).

### KANBAN_CARD_MOVE_URL — déplacer une carte vers une autre colonne

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-card/move`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Change la colonne, donc le statut, de l'action. La sémantique est celle de `set_status` avec `keepDates` de
    Kanban gestion, en **une** écriture : `$set {status, tags, tracking, updated}` et `$push updateStatus`. Les dates
    ne bougent pas.
  - L'ordre dans une colonne est canonique (priorité, puis date de création), propre à co-kanban : il n'y a pas
    d'ordre manuel.
  - Un dépôt dans la même colonne n'écrit rien et ne journalise rien.
  - Rôle requis : editor.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `cardId` | string (ObjectId) | oui | Id de l'action |
  | `columnId` | `"todo"` \| `"next"` \| `"tracking"` \| `"totest"` \| `"discuter"` \| `"done"` | oui | Colonne d'arrivée |
  | `beforeCardId` / `afterCardId` | string | non | **Ignorés** sur un board-lien (ordre canonique). Le front ne les envoie pas |
- **Réponse attendue (shape)** (fixture `card/move.link`) :
  ```json
  { "result": true, "data": { "card": {
      "_id": "6adf53089c620bb61709196d", "boardId": "6adf53089c620bb617091981",
      "columnId": "tracking", "status": "on_track", "rank": 42368113100.900665,
      "startDate": 1734331606, "…": "… (forme complète, cf. card/create)" },
    "rev": 26 } }
  ```
  - Pas de `renumbered` ni de `wipWarning` sur un board-lien.
  - Même colonne : la carte est renvoyée telle quelle avec le `rev` courant (fixture `card/move.link-same-column`).
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.card.move({ boardId, cardId, columnId })` →
  `CardMoveResult` (`{ card, rev }` ici).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useBoardMutations.ts`. Le déplacement optimiste
  dans `KANBAN_QUERY_KEYS.BOARD` tombe d'emblée à sa place : `lib/canonicalOrder.ts` calcule le même rang que le
  PHP.
- **Notes / cas d'erreur** :
  - 409 `boardArchived` `{boardId}` (fixture `card/move.boardArchived`).
  - 409 `conflict` `{reason: "concurrentUpdate"}`.
  - 404 `{cardId}`.
  - 422 `{field: "columnId", reason: "notAllowed"}`.
  - Effet de bord connu (BLUEPRINT §11.10 Q9) : le `$push updateStatus` retire l'action de la colonne « Terminer »
    de la vue Administration de gestion.

### KANBAN_CARD_ARCHIVE_URL — retirer une carte du tableau

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-card/archive`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Retire la carte du tableau sans la détruire, comme la corbeille de Kanban gestion : l'action passe
    `status: "disabled"` et `tracking` est retiré.
  - C'est la seule « suppression » d'un board-lien : `card/delete` y répond 409 `sourceManaged`.
  - Rôle requis : **owner** de l'élément (capacité `canArchiveCards`).
  - Journalisé en `card.deleted` avec `payload.archived: true` : les autres clients retirent la carte sans
    recharger.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `cardId` | string (ObjectId) | oui | Id de l'action |
- **Réponse attendue (shape)** (fixture `card/archive.link`) :
  ```json
  { "result": true, "data": { "archived": true, "cardId": "6adf53089c620bb617091970", "rev": 85 } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.card.archive({ boardId, cardId })` →
  `{ archived: true, cardId: string, rev: number }`. Le type front `CardArchiveResult` ne déclare qu'`archived`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useBoardMutations.ts`. Le hook retire la carte de
  façon optimiste de `KANBAN_QUERY_KEYS.BOARD`.
- **Notes / cas d'erreur** :
  - 403 `forbidden` `{boardId, role: "editor", required: "owner", capability: "canArchiveCards"}` (fixture
    `card/archive.forbidden`).
  - 409 `boardArchived`.
  - 404 `{cardId}` : action introuvable, ou archivée ou déplacée entre la lecture et l'écriture.

### KANBAN_COMMENT_LIST_URL — fil de discussion d'une carte

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-comment/list`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Renvoie une page du fil de l'action, du plus ancien au plus récent. C'est la collection `comments`
    (`contextType: "actions"`), le même fil qu'affiche Kanban gestion.
  - Chaque commentaire porte le profil **projeté** de son auteur. Il vaut `null` si le compte a disparu.
  - **Effet de bord** : lire marque le fil comme vu pour le lecteur (`views.<userId>`). C'est ce qui fait tomber
    `unseenComments`. Cette écriture personnelle ne donne ni révision ni journal.
  - Rôle requis : editor. La route reste lisible sur un lien archivé.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Désigne la source |
  | `cardId` | string (ObjectId) | oui | Id de l'action |
  | `page` | integer, 1 … 10 000 | non | Défaut : 1 |
  | `limit` | integer, 1 … 100 | non | Défaut : 25 |
- **Réponse attendue (shape)** (fixture `comment/list.link`) :
  ```json
  { "result": true, "data": {
      "comments": [ { "_id": "6adf53089c620bb617091980", "boardId": "6adf53089c620bb617091981",
        "cardId": "6adf53089c620bb617091970", "authorId": "6448f244ecf6e50e4b539677",
        "text": "Une remarque & une question", "created": 1787556450, "updated": 1787556450,
        "author": { "_id": "6448f244ecf6e50e4b539677", "name": "Ada", "username": "ada",
          "slug": "ada", "profilThumbImageUrl": null } } ],
      "total": 1, "page": 1, "limit": 25 } }
  ```
  - `text` est en texte brut, décodé de sa forme stockée. Il faut le rendre en texte.
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.comment.list({ boardId, cardId, page?, limit? })` →
  `CommentListResult` (`{ comments, total, page, limit }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useCardComments.ts`, avec la clé
  `KANBAN_QUERY_KEYS.CARD_COMMENTS` (utilisateur, `boardId`, `cardId`).
- **Notes / cas d'erreur** :
  - 404 `{cardId}`.
  - 403 `notMember`.
  - 422 `{field: "page" | "limit", reason}`.

### KANBAN_COMMENT_ADD_URL — commenter une carte

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-comment/add`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Ajoute un commentaire au fil de l'action et incrémente `commentCount`.
  - L'auteur vient du **jeton**. Un `author` envoyé dans le corps est ignoré.
  - Rôle requis : editor.
  - Le texte est gardé tel que saisi et stocké échappé.
  - Ni notification Communecter ni RocketChat (BLUEPRINT §11.9 E15).
  - Journalisé en `card.updated` (`fields: ["commentCount"]`, avec le commentaire).
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Désigne la source |
  | `cardId` | string (ObjectId) | oui | Id de l'action |
  | `text` | string, 1 à 2000 caractères | oui | Texte du commentaire |
- **Réponse attendue (shape)** (fixture `comment/add.link`) :
  ```json
  { "result": true, "data": {
      "comment": { "_id": "6adf53099c620bb6170919c6", "boardId": "6adf53089c620bb617091981",
        "cardId": "6adf53089c620bb617091970", "authorId": "5534fd9da1aa14201b0041cb",
        "text": "Je prends", "created": 1793020681, "updated": 1793020681,
        "author": { "_id": "5534fd9da1aa14201b0041cb", "name": "Elie", "username": "elie",
          "slug": "elie", "profilThumbImageUrl": "/upload/elie-thumb.jpg" } },
      "commentCount": 2, "rev": 42 } }
  ```
  - `commentCount` est la valeur d'autorité relue sur l'action. Le front la pose telle quelle sur la carte, au
    lieu d'incrémenter son propre compteur.
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.comment.add({ boardId, cardId, text })` →
  `CommentAddResult` (`{ comment, commentCount, rev }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useCardComments.ts`. La mutation écrit dans
  `KANBAN_QUERY_KEYS.CARD_COMMENTS` et pose `commentCount` sur la carte de `KANBAN_QUERY_KEYS.BOARD`.
- **Notes / cas d'erreur** :
  - 409 `boardArchived`.
  - 404 `{cardId}`.
  - 422 `{field: "text", reason: "required" | "empty" | "tooLong"}`.

### KANBAN_COMMENT_DELETE_URL — supprimer un commentaire

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-comment/delete`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Supprime un commentaire du fil et décrémente `commentCount`. Le décrément est conditionné à l'effacement
    effectif : une suppression concurrente ne décrémente qu'une fois.
  - Rôle requis : l'**auteur** du commentaire, ou un **owner** de l'élément (modération). Un editor n'efface pas le
    message d'un collègue.
  - Le texte est aussi effacé des activités antérieures qui l'avaient journalisé (BLUEPRINT §11.9 E24).
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Désigne la source |
  | `cardId` | string (ObjectId) | oui | Id de l'action |
  | `commentId` | string (ObjectId) | oui | Commentaire à supprimer, qui doit appartenir au fil de `cardId` |
- **Réponse attendue (shape)** (fixture `comment/delete.link`) :
  ```json
  { "result": true, "data": { "deleted": true, "commentCount": 1, "rev": 57 } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.comment.delete({ boardId, cardId, commentId })` →
  `CommentDeleteResult` (`{ deleted: true, commentCount, rev }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useCardComments.ts`. Mêmes écritures de cache que
  `comment/add`.
- **Notes / cas d'erreur** :
  - 403 `forbidden` `{reason: "notCommentAuthor", commentId, required: "authorOrOwner"}`.
  - 404 `{commentId}` : absent, d'un autre fil, ou déjà supprimé. Rejouer l'appel donne donc 404.
  - 404 `{cardId}`.
  - 409 `boardArchived`.

### KANBAN_MILESTONE_LIST_URL — jalons du projet

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-milestone/list`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Renvoie tous les jalons du **projet** (`projects.oceco.milestones`), ouverts et clos, dans l'ordre stocké. Ce
    sont les jalons partagés avec Kanban gestion.
  - Sur un lien d'organisation : `{milestones: []}`. Une organisation n'a jamais de jalons (D22).
  - Rôle requis : editor.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
- **Réponse attendue (shape)** (fixture `milestone/list.link`) :
  ```json
  { "result": true, "data": { "milestones": [
      { "milestoneId": "mNYjiwQY7Qyrs7wbs", "name": "KANBAN", "description": "",
        "startDate": 1744243200, "endDate": null, "status": "open" },
      { "milestoneId": "D9Jw3ZHfPeefqrgah", "name": "oceco", "description": "",
        "startDate": null, "endDate": null, "status": "close" } ] } }
  ```
  - `status` vaut `"open"` ou `"close"`, et non `closed` : c'est la valeur stockée par Kanban gestion.
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.milestone.list({ boardId })` → `MilestoneListResult`
  (`{ milestones: Milestone[] }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useMilestones.ts` (lecture de la boîte des jalons),
  avec la clé `KANBAN_QUERY_KEYS.MILESTONES` (utilisateur, `boardId`). Le hook recopie aussi la liste dans
  `BOARD.milestones`.
- **Notes / cas d'erreur** :
  - 409 `conflict` `{boardId, reason: "notSourceBoard", source: "kanban"}` : board autonome, et appelant membre de
    ce board (fixture `milestone/list.notSourceBoard`).
  - 403 `notMember` `{boardId}` : non-membre. Le droit de voir est contrôlé avant de dire ce qu'est le board.

### KANBAN_MILESTONE_CREATE_URL — créer un jalon (projet seulement)

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-milestone/create`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Ajoute un jalon au projet par `$push` dans `projects.oceco.milestones`, avec un id de 17 caractères façon
    Meteor, comme Kanban gestion. Il n'y a jamais d'écriture par index.
  - Le nom est gardé tel que saisi et stocké échappé.
  - Rôle requis : **owner** du projet (capacité `canManageMilestones`), sur un lien de **projet** non archivé.
  - Journalisé en `board.updated` : les autres clients rechargent le tableau (BLUEPRINT §11.10 Q3).
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien de projet |
  | `name` | string, 1 à 200 caractères | oui | Nom du jalon |
  | `description` | string, ≤ 5000 | non | — |
  | `startDate` | integer (secondes) \| `null` | non | Début |
  | `endDate` | integer (secondes) \| `null` | non | Fin. Doit être ≥ début |
- **Réponse attendue (shape)** (fixture `milestone/create.link`) :
  ```json
  { "result": true, "data": {
      "milestone": { "milestoneId": "hT6QKN77SQbS7WA6b", "name": "Sprint 12", "description": "",
        "startDate": 1777000000, "endDate": 1778000000, "status": "open" },
      "rev": 58 } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.milestone.create(input)` →
  `{ milestone: Milestone, rev: number }`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useMilestones.ts` (mutations). La mutation écrit
  dans `KANBAN_QUERY_KEYS.MILESTONES` et dans `BOARD.milestones`.
- **Notes / cas d'erreur** :
  - 409 `conflict` `{boardId, reason: "milestonesUnavailable", parentType: "organizations"}` : lien
    d'organisation. Ce refus passe **avant** la garde owner (fixtures `milestone/create.milestonesUnavailable` et
    `…-member`).
  - 403 `forbidden` `{boardId, role: "editor", required: "owner", capability: "canManageMilestones"}`.
  - 409 `boardArchived`.
  - 409 `notSourceBoard` (board autonome).
  - 422 `{field: "endDate", reason: "beforeStartDate"}`.
  - 422 `{field: "name", reason: "required" | "empty" | "tooLong"}`.

### KANBAN_MILESTONE_UPDATE_URL — modifier, clore ou rouvrir un jalon

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-milestone/update`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Écriture **partielle** d'un jalon, par opérateur positionnel sur `oceco.milestones.milestoneId` et jamais par
    index. Deux personnes qui éditent deux jalons ne s'écrasent pas.
  - Champ absent : intact. `null` : effacé (dates ; `description` aussi selon le docblock PHP).
  - Les copies du jalon dans `actions.milestone` ne sont pas réécrites. Les cartes affichent le nom et le statut
    **courants**, résolus à la lecture.
  - Rôle requis : **owner** du projet (`canManageMilestones`), sur un lien de projet non archivé.
  - Journalisé en `board.updated`.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien de projet |
  | `milestoneId` | string (`[A-Za-z0-9_-]{1,40}`) | oui | Jalon visé |
  | `name` | string, 1 à 200 | non | — |
  | `description` | string, ≤ 5000 (`null` admis côté PHP, pas dans le type front) | non | — |
  | `startDate` | integer (secondes) \| `null` | non | `null` : effacer (`$unset`) |
  | `endDate` | integer (secondes) \| `null` | non | `null` : effacer. Vérification début ≤ fin sur les valeurs effectives |
  | `status` | `"open"` \| `"close"` | non | Rouvrir ou clore |
- **Réponse attendue (shape)** (fixture `milestone/update.link`, requête `{…, "name": "Sprint 12 bis", "status": "close", "endDate": null}`) :
  ```json
  { "result": true, "data": {
      "milestone": { "milestoneId": "hT6QKN77SQbS7WA6b", "name": "Sprint 12 bis", "description": "",
        "startDate": 1777000000, "endDate": null, "status": "close" },
      "rev": 59 } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.milestone.update(input)` →
  `{ milestone: Milestone, rev: number }`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useMilestones.ts` (mutations), avec les clés
  `KANBAN_QUERY_KEYS.MILESTONES` et `BOARD`.
- **Notes / cas d'erreur** :
  - **Cette fixture est exactement le cas que casserait `stripNullsInPlace`** : `endDate: null` serait retiré, et
    la fin du jalon resterait en place sans erreur.
  - 422 `{field: "milestoneId", reason: "required"}`.
  - 404 `{milestoneId}` : jalon inconnu, ou supprimé depuis gestion entre la lecture et l'écriture.
  - 422 `{reason: "noUpdatableField", allowed}`.
  - 422 `beforeStartDate`.
  - 409 `milestonesUnavailable` (organisation), 403 `forbidden` (editor), 409 `boardArchived`.

### KANBAN_ROLE_LIST_URL — kanban des rôles de l'élément

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-role/list`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Alimente la vue « Rôles » (parité avec `kanban.php` de Communecter, D27-D28) : une colonne « Membres », puis
    une colonne par rôle.
  - **Rôles déclarés** : le champ `roles` de l'élément, dans l'ordre.
  - **Rôles portés** : `<membre>.links.<memberOf|projects>.<élément>.roles`, lus **côté membre**.
  - Les colonnes sont l'union des deux, sans doublon : déclarés d'abord.
  - **Membres** : toutes les entrées `links.<members|contributors>` de type `citoyens` ou `organizations` dont le
    document existe et est montré par la plateforme. Les membres en attente sont inclus (`pending: true`), dans
    l'ordre stocké.
  - Rôle requis : editor. L'écriture (`canManageRoles`) est réservée à l'owner d'un lien non archivé.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien (le même que celui du tableau des actions) |
- **Réponse attendue (shape)** (fixture `role/list.link`) :
  ```json
  { "result": true, "data": {
      "roles": [ { "name": "Lead", "declared": true, "memberIds": [] },
        { "name": "Design", "declared": false, "memberIds": ["5e14a3b3690864e1328b45de"] } ],
      "members": [
        { "id": "555eba56c655675cdd65bf19", "type": "organizations", "name": "Open Atlas",
          "slug": "openAtlas", "image": "/upload/communecter/organizations/oa/logo.png",
          "isAdmin": false, "pending": false, "roles": [] },
        { "id": "6448f244ecf6e50e4b539677", "type": "citoyens", "name": "Ada", "slug": "ada",
          "image": null, "isAdmin": true, "pending": false, "roles": [] }, "…" ],
      "canManageRoles": true, "rev": 90 } }
  ```
  - `image` est le chemin tel que stocké (`profilThumbImageUrl`, sinon `profilImageUrl`, sinon `null`).
  - Sur un lien archivé : `canManageRoles: false` (fixture `role/list.link-archived`).
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.role.list({ boardId })` → `RoleListResult`
  (`{ roles, members, canManageRoles, rev }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useRoles.ts` (`useRoles`), avec la clé
  `KANBAN_QUERY_KEYS.ROLES` (utilisateur, `boardId`). La clé est rechargée sur toute activité `role.updated` et
  sur tout `full: true` de `board/sync`.
- **Notes / cas d'erreur** :
  - 409 `conflict` `{boardId, reason: "notSourceBoard", source: "kanban"}` (fixture `role/list.notSourceBoard`).
  - 403 `notMember` `{boardId}`.
  - 404 `sourceMissing`.

### KANBAN_ROLE_CREATE_URL — déclarer un rôle (nouvelle colonne)

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-role/create`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Déclare un rôle dans `roles` de l'élément (`$addToSet`). La colonne existe alors même sans porteur, et
    survit au rechargement.
  - Si le rôle est déjà déclaré : `created: false`, rien d'écrit, ni révision ni journal.
  - Rôle requis : **owner** (`canManageRoles`), sur un lien non archivé.
  - Journalisé en `role.updated` `{role, created: true}`.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `role` | string, ≤ 60 caractères après `trim`, non vide, sans `<`, `>` ni caractère de contrôle | oui | Libellé **tel que saisi** : c'est le serveur qui fait le `trim` et qui refuse |
- **Réponse attendue (shape)** (fixture `role/create.link`, requête `"role": "  QA "`) :
  ```json
  { "result": true, "data": { "role": "QA", "created": true, "rev": 91 } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.role.create({ boardId, role })` → `RoleCreateResult`
  (`{ role, created, rev }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useRoles.ts` (`useRoleMutations`). La mutation
  écrit de façon optimiste dans `KANBAN_QUERY_KEYS.ROLES`.
- **Notes / cas d'erreur** :
  - 403 `forbidden` `{boardId, role: "editor", required: "owner", capability: "canManageRoles", reason:
    "roleManagementNotAllowed"}` (fixture `role/create.forbidden`). Dans ce détail, `role` est le rôle de
    l'appelant, pas le libellé.
  - 422 `{field: "role", reason: "invalidRole", max: 60}`.
  - 409 `boardArchived`.
  - 409 `notSourceBoard`.

### KANBAN_ROLE_ASSIGN_URL — attribuer un rôle à un membre

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-role/assign`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Correspond au glisser d'une carte membre vers une colonne de rôle.
  - La liste des rôles du membre, lue côté membre et augmentée du rôle, est réécrite **des deux côtés du lien** :
    `<élément>.links.<members|contributors>.<id>.roles` et `<membre>.links.<memberOf|projects>.<élément>.roles`.
    C'est l'écriture de `Link::removeRole` (`$set` d'un tableau).
  - Le rôle est aussi déclaré dans `roles` de l'élément, dans la même écriture.
  - Chaque côté est écrit sous condition de la valeur lue (compare-and-set, E49). Deux attributions concurrentes
    convergent vers l'union.
  - Si le rôle est déjà porté : `changed: false`, rien d'écrit.
  - Rôle requis : **owner** (`canManageRoles`), sur un lien non archivé.
  - Journalisé en `role.updated` `{member: {id, type, roles}}`.
  - Une organisation membre peut porter un rôle.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `memberId` | string (ObjectId) | oui | Membre visé |
  | `memberType` | `"citoyens"` \| `"organizations"` | oui | Type du membre. Doit correspondre au type de l'entrée de lien |
  | `role` | string (mêmes règles que `role/create`) | oui | Rôle à attribuer |
- **Réponse attendue (shape)** (fixture `role/assign.link`) :
  ```json
  { "result": true, "data": {
      "member": { "id": "5534fd9da1aa14201b0041cb", "type": "citoyens", "roles": ["QA"] },
      "changed": true, "rev": 94 } }
  ```
  - `member.roles` est la liste **complète** réécrite.
  - Porteur organisation : fixture `role/assign.link-organization-member`.
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.role.assign({ boardId, memberId, memberType, role })`
  → `RoleWriteResult` (`{ member: { id, type, roles }, changed, rev }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useRoles.ts` (`useRoleMutations`), avec écriture
  optimiste dans `KANBAN_QUERY_KEYS.ROLES`.
- **Notes / cas d'erreur** :
  - 404 `notFound` `{reason: "notLinked", memberId, memberType}` : entrée de lien absente, sans `type` ou d'un
    autre type, ou document du membre disparu ou masqué (fixtures `role/assign.notLinked`, `…-untyped`).
  - 409 `conflict` `{boardId, memberId, memberType, reason: "concurrentUpdate"}` : trois écritures refusées
    (fixture `role/assign.concurrentUpdate`).
  - 500 `serverError` `{reason: "memberWriteFailed", memberId, memberType}` : l'élément est écrit mais le document
    du membre a disparu entre-temps.
  - 422 `invalidRole` (fixture `role/assign.invalidRole`).
  - 403 `roleManagementNotAllowed`, 409 `boardArchived`, 409 `notSourceBoard`.

### KANBAN_ROLE_UNASSIGN_URL — retirer un rôle à un membre

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-role/unassign`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Correspond à « Retirer le rôle » sur une carte membre.
  - La liste des rôles du membre, lue côté membre et privée du rôle, est réécrite des deux côtés du lien. Si elle
    devient vide, elle est **retirée** (`$unset` des deux côtés, comme `Link::removeRole` avec `roles: ''`).
  - Le membre reste membre. Le rôle reste **déclaré** : sa colonne reste, à 0. C'est `role/delete` qui la
    supprime.
  - Si le rôle n'est pas porté : `changed: false`, rien d'écrit.
  - Même compare-and-set que `role/assign`.
  - Rôle requis : **owner** (`canManageRoles`), sur un lien non archivé.
  - Journalisé en `role.updated` `{member: {id, type, roles}}`.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `memberId` | string (ObjectId) | oui | Membre visé |
  | `memberType` | `"citoyens"` \| `"organizations"` | oui | Type du membre |
  | `role` | string (mêmes règles que `role/create`) | oui | Rôle à retirer |
- **Réponse attendue (shape)** (fixture `role/unassign.link`, requête `"role": "Ops"`) :
  ```json
  { "result": true, "data": {
      "member": { "id": "5534fd9da1aa14201b0041cb", "type": "citoyens", "roles": ["QA"] },
      "changed": true, "rev": 97 } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** :
  `api.kanban.role.unassign({ boardId, memberId, memberType, role })` → `RoleWriteResult`.
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useRoles.ts` (`useRoleMutations`), avec écriture
  optimiste dans `KANBAN_QUERY_KEYS.ROLES`.
- **Notes / cas d'erreur** : mêmes refus que `role/assign` :
  - 404 `notLinked` ;
  - 409 `concurrentUpdate` ;
  - 500 `memberWriteFailed` ;
  - 422 `invalidRole` ;
  - 403 `roleManagementNotAllowed` ;
  - 409 `boardArchived` ;
  - 409 `notSourceBoard`.

### KANBAN_ROLE_DELETE_URL — supprimer un rôle (colonne et porteurs)

- **Statut** : À créer — lot KANBAN (2026-10-28)
- **Méthode HTTP** : POST
- **URL / path** : `/costum/kanban-role/delete`
- **Auth requise** : oui (bearer)
- **Contexte costum** : non
- **Description précise** :
  - Correspond à « Supprimer ce rôle ».
  - Le rôle est retiré de chaque porteur, des deux côtés du lien, avec `$unset` quand c'était son seul rôle. Le
    membre reste membre. Le rôle est ensuite retiré de `roles` de l'élément (`$pull`).
  - `removedFrom` compte les porteurs réécrits.
  - Si le rôle n'est ni porté ni déclaré : rien d'écrit, `removedFrom: 0`.
  - Chaque porteur est réécrit sous condition. Les écritures ne sont pas atomiques entre elles (Mongo sans
    transaction).
  - Rôle requis : **owner** (`canManageRoles`), sur un lien non archivé.
  - Journalisé en `role.updated` `{role, deleted: true, removedFrom}`.
- **Paramètres de requête (payload)** :
  | Champ | Type | Requis | Description |
  |---|---|---|---|
  | `boardId` | string (ObjectId) | oui | Board-lien |
  | `role` | string (mêmes règles que `role/create`) | oui | Rôle à supprimer |
- **Réponse attendue (shape)** (fixture `role/delete.link`) :
  ```json
  { "result": true, "data": { "role": "Design", "removedFrom": 1, "rev": 99 } }
  ```
- **Méthode d'entité / EndpointApi souhaitée** : `api.kanban.role.delete({ boardId, role })` → `RoleDeleteResult`
  (`{ role, removedFrom, rev }`).
- **Consommateur front** : `site-json/src/modules/kanban/hooks/useRoles.ts` (`useRoleMutations`), avec écriture
  optimiste dans `KANBAN_QUERY_KEYS.ROLES`.
- **Notes / cas d'erreur** :
  - 500 `serverError` `{reason: "roleWriteFailed", role, memberId, removedFrom, cause}`, avec `cause` parmi
    `notLinked`, `concurrentUpdate` et `sourceMissing`. Un porteur a été disputé jusqu'au bout. Rien n'est avalé : les
    porteurs déjà traités le restent, et le prochain `role/list` montre l'état réel (E42). Le front traduit le
    pluriel sur `removedFrom`.
  - Ce 500 métier **compte dans le circuit breaker** du SDK (voir l'en-tête du lot).
  - 422 `invalidRole`, 403 `roleManagementNotAllowed`, 409 `boardArchived`, 409 `notSourceBoard`.
