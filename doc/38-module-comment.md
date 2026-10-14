[← Index](README.md)

# Module `comment` — discussions génériques

Portage React du module commentaire legacy : un fil de discussion réutilisable par **toute entité
commentable**, au système de design de Discord, plus un panneau « Discussions » qui s'ouvre sur le
contexte demandé au lieu de charger tout le parc.

> **En un mot** : le commentaire n'était pas couplé à `news` par son architecture, mais par un
> **enum de deux valeurs** dans le SDK et par un effet de bord sur le cache des actualités. Lever
> ces deux points suffit à rendre le module générique.

**État** : chantier en cours sur la branche `comment-dev`. Le suivi détaillé (jalons J0→J12, registre
de blocages, jeu d'essai) vit hors dépôt dans `commentaire/module-comment/jalons.md` — ce document-ci
ne porte que ce qui est **acquis et vérifié**.

## 1. Ce qui rendait le module non générique

Trois verrous, mesurés et non supposés :

| Verrou | Où | Nature |
|---|---|---|
| `enum: ["news"]` en lecture | `GET_COMMENTS.pathParams.type` | le SDK refusait tout autre type **avant l'envoi** |
| `enum: ["news"]` + `default: "news"` en écriture | `ADD_COMMENTS.request.contextType` | idem, **et** un appel sans `contextType` écrivait silencieusement sur `news` |
| `Comment` retiré de `poi` | `EntityRegistry` | désalignement : `BaseEntity` le gardait, le registre non → `TypeError` selon la voie de création |

L'**écriture était déjà générique** : `Comment._add` dérive `contextType` de
`this.parent.getEntityType()` et remonte à l'entité racine pour une réponse. Seule la lecture
manquait — `getComments()` n'existait que sur `News`.

Côté backend, aucune liste blanche à l'écriture ; en lecture, `comment/IndexAction.php` accepte une
vingtaine de types. Le périmètre retenu est **l'intersection** avec ce que le SDK sait instancier :

```
citoyens · organizations · projects · events · poi · news · answers · forms · classifieds · actions
```

`comments` et `badges` en sont exclus à dessein (un commentaire ne porte pas de fil propre : ses
réponses arrivent imbriquées).

## 2. Dépendances SDK

> **Le SDK n'est jamais commité.** Cette section est le livrable : elle décrit les modifications à
> reproduire dans `@communecter/cocolight-api-client`, telles qu'elles ont été implémentées et
> vérifiées en local (version de base **1.0.194** ; l'arbre de travail local repose depuis le 07/10
> sur la **1.0.196**). Les modifications venues ensuite sont spécifiées plus loin : l'endpoint
> `discussions` au §9, le marquage en lecture (`MARK_COMMENTS_SEEN`) au §11.6, les images
> (`mediaImg`, `uploadDocument`) au §13. La compatibilité avec `main` est établie au §2.5.
> **La liste complète des demandes à l'équipe SDK, à transmettre telle quelle, est au §14.**
>
> ⚠️ **Trois pièces écrites À LA MAIN, que le module appelle** (relevé par la revue du 29/09) :
> `Api.getDiscussions()` et `Api.markCommentsSeen()` sur la façade `Api` — le générateur ne produit
> que `endpointApi.getDiscussions` / `endpointApi.markCommentsSeen` —, et l'export
> `helper.createFromCollection` (`src/index.ts`). Sans elles, le SDK publié compilerait (le module
> y accède par des conversions de type) mais lèverait « is not a function » à l'exécution.

### 2.1 Les quatre modifications

1. **`endpoints-copie.json`** — élargir les deux enums à la liste des dix types **et supprimer les
   deux `"default": "news"`**.
2. **`BaseEntity`** — y ajouter `getComments({ path? })` (le `type` vient de `getEntityType()`,
   avec un garde `_assertNotEntityType("getComments", ["badges", "comments"])` ; le `path` passe
   par `GET_COMMENTS_BY_PATH`, §14.2) et y **remonter** `comment()`, jusque-là dupliqué à
   l'identique dans `News` et `Comment`. Retirer les copies.
3. **`EntityRegistry`** — rendre `Comment` aux dépendances de `poi`, aux deux emplacements
   (`deps` et `_buildMeta(… { remove: […] })`), pour s'aligner sur `BaseEntity`.
4. **Regénérer**, dans cet ordre :
   `generate:module:publish` → `generate:methodeapi` → `typecheck` → `lint` → `build:esm:rollup` →
   `build:node` → `build:browser` → `build:types`.

Ce sont les quatre modifications du chantier 1 ; la liste complète de ce que le module attend du
SDK, ajouts suivants compris, est au §14.1.

### 2.2 Trois pièges qui invalident une vérification naïve

- **Le runtime ne lit pas le JSON.** La validation AJV lit `src/endpoints.module.ts`, généré par
  `generate:module:publish`. Modifier `endpoints-copie.json` sans relancer ce script ne change
  **rien** au comportement.
- **Ce module généré déduplique les schémas** dans des constantes `common*`. Un `grep` sur son
  contenu ne prouve donc rien : il faut le **charger et résoudre** les constantes pour lire l'enum
  effectif.
- **Élargir l'enum ne suffit pas.** AJV tourne avec `useDefaults: true` : tant que le
  `"default": "news"` subsiste, un appel sans `contextType` se voit **injecter** `news` et écrit
  sur la mauvaise entité, sans erreur.

### 2.3 Sonde de recette

Trois assertions suffisent à prouver le déverrouillage, sur une entité qui n'est pas une news :

```
org.getComments()                → répond (liste, éventuellement vide)
org.comment({ text }).save()     → passe la validation et crée le message
api.poi({ id }).comment({ … })   → ne lève plus de TypeError
```

### 2.4 Limites connues du SDK

| # | Limite | Preuve | Conséquence |
|---|---|---|---|
| ~~Images~~ | ~~`uploadDocument` interdit explicitement `comments`~~ — **levé le 24/09** : le verrou était entièrement côté client | §13.2 à §13.5 | les images sont livrées (bouton, collage, glisser-déposer), vérifiées au navigateur le 07/10 |
| `markdownActive` | `ADD_COMMENTS` est `additionalProperties: false` et ne l'expose pas | schéma de l'endpoint | le champ existe en base mais n'est pas postable → rendu markdown restreint, inconditionnel |
| ~~`path` en lecture~~ | ~~`GET_COMMENTS` ne filtre pas sur le `path`~~ — **levé le 02/10** : nouvel endpoint `GET_COMMENTS_BY_PATH` et `getComments({path})` | §14.2 | le fil d'une question ne montre plus les messages de toutes les questions du formulaire |
| `mentions` | six champs **tous requis** : `id, name, slug, type, value, count` | schéma de l'endpoint | un `{ id, name }` est refusé ; le legacy stocke `count` en **chaîne** et ajoute `avatar` — à l'ÉDITION, le SDK ramène désormais chaque mention aux six champs (§14.4) |
| Résolution d'entité | `api` expose une méthode pour **8** des 10 types | `Api.d.ts` | `news` et `actions` se chargent depuis une entité porteuse ; pour un lien profond, le module construit l'entité par `helper.createFromCollection` (§10.4) |
| `SHOW_VOTE` | conserve `enum: ["news","comments"]` **avec** `default: "news"` | schéma de l'endpoint | sans effet ici (le SDK passe toujours `type: "comments"`), mais le défaut reste un piège pour un futur appelant |

### 2.5 Compatibilité avec `main`, et ordre de livraison (28/09)

**Publier ces modifications avant la fusion du module ne casse pas les commentaires d'actualité
de `main`.** `main` ne touche aux commentaires que par des méthodes d'entité :
`news.getComments()`, `news.comment({ text })`, `comment.comment({ text })`, `save()`,
`delete()`, `addVote()`, `addReportAbuse()`. Son seul appel d'endpoint brut est `showVote`, que ce
chantier ne modifie pas.

| Changement | Effet sur `main` |
|---|---|
| `getComments()` et `comment()` remontés sur `BaseEntity` | aucun : code déplacé à l'identique, même signature, hérité par `News` et `Comment` |
| les deux `default: "news"` supprimés | aucun : `getComments()` passe `type` explicitement (`getEntityType()` → `news`), et `Comment._add` pose toujours `contextType` — ou lève —, sans jamais compter sur le défaut |
| enums élargis, `mediaImg`, nouveaux endpoints | additifs : `news` reste dans l'enum |
| `Comment._update` renvoie `mediaImg` | une **correction** : éditer le texte d'un message illustré n'efface plus ses images |

**Preuve** : l'arbre de `main` (extrait par `git archive`), compilé contre le SDK local modifié
avec la commande du dépôt (`tsc -b --noEmit`) → **0 erreur**. Contre-épreuve : un appel à une
méthode inexistante sur `News` y est bien refusé (`TS2551`). Le backend du chantier est additif
lui aussi : deux routes (`discussions`, `seen`) et des entrées de notification pour les types qui
en manquaient (§3) — `news` n'en faisait pas partie. `main` est passé depuis à la **1.0.196**
(`029def5b`) : ses trois apports — `LINK_SET_ROLES`, `AGENDA_GET_PDF`, `CONNECT` — ne touchent aucun
endpoint du commentaire, et les modifications de ce chantier s'y reposent sans conflit (07/10).

**C'est l'ordre inverse qui casse** : ce module a besoin de ces modifications (endpoints
`discussions` et `seen`, `createFromCollection`, `getComments()` sur les autres types,
`mediaImg`). Le SDK doit donc être publié **avant** la fusion, et la MR doit relever la dépendance
à la version publiée. `comment-dev`, à jour de `main` depuis le 07/10, épingle `^1.0.196` comme lui.

## 3. Dépendance backend — notifications

> Corrigé dans `citizenToolKit` (non commité au moment d'écrire ces lignes).

`models/Notification.php` porte une table par verbe. Elle ne couvrait pas tous les types ouverts
aux commentaires :

| Verbe | Types manquants |
|---|---|
| `VERB_COMMENT` | `organizations`, `events`, `citoyens` |
| `VERB_REACT` | les mêmes, **plus** `projects` et `forms` |

`answers` n'a jamais manqué : la constante `Form::ANSWER_COLLECTION` (`"answers"`), déclarée **plus
bas** dans les deux tables, le couvrait déjà. L'entrée littérale `"answers"` ajoutée au départ était
donc écrasée par elle — du code mort, retiré le 02/10 (revue du 29/09). La mesure initiale
cherchait le littéral et n'avait pas vu la constante.

**Symptôme, contre-intuitif** : poster un message racine passe, mais **répondre au message d'autrui**
sur ces types **écrit le document en base puis renvoie une 500**
(`Undefined index: <collection>`, à la construction de l'url de notification). La différence ne tient
ni au droit ni à la donnée : on ne se notifie pas soi-même, donc une réponse à son propre message
n'atteint jamais le code fautif.

Correctif : ajouter les entrées manquantes aux deux tables. Les libellés peuvent **reprendre les
clés génériques déjà utilisées par `Poi`** (`"{who} commented on {what} in {where}"`,
`"{who} reacts on comment {what} in {where}"`), ce qui évite toute nouvelle clé de traduction.

**Règle qui survit au correctif** : un écrit backend peut **réussir puis échouer** sur un traitement
d'aval. Un client qui poste un commentaire doit traiter une 500 comme « **peut-être écrit** » et
relire le fil, jamais comme un échec franc.

## 4. Base de données

La collection `comments` n'avait **que** l'index `_id_`. Six index couvrent les accès du module
(`Discussion::indexes()`) :

| Nom | Index | Sert à |
|---|---|---|
| `ctx_created` | `{ contextType: 1, contextId: 1, created: -1 }` | tout accès à un contexte part de (type, id) et trie par date |
| `parent_created` | `{ parentId: 1, created: 1 }` | charger les réponses d'un message précis |
| `carrier_ctx` | `{ carrierId: 1, contextType: 1, contextId: 1, created: -1 }` | porteur → contextes, sans charger un message ; et « ce qui reste à reprendre » (§9.10) |
| `ctx_path` | `{ contextType: 1, contextId: 1, path: 1, created: -1 }` | un **fil** est (type, id, chemin) : lire les siens sans parcourir tout son contexte |
| `author_created` | `{ author: 1, created: -1 }` | les fils où le lecteur écrit, d'après ses messages récents |
| `space` | `{ spaceId: 1 }`, creux | commun → messages de son espace (§15.3) |

⚠️ **Aucun code ne créait les deux premiers** : ils n'existaient qu'en base de développement, posés à
la main. En production, c'est la **reprise** (§9.10) qui pose les six — une fois, par une action
réservée au super-administrateur, jamais au détour d'une requête : `comments` est une grosse
collection partagée. Tant qu'ils manquent, le module répond juste, par le chemin d'origine.

Forme d'un document : `contextId`, `contextType`, `parentId` (**chaîne vide** à la racine, jamais
`null`), `text`, `created` (**secondes UNIX**), `author` (identifiant), `views.<userId>.date`
(support des non-lus), `vote.<userId>.status` + `voteCount.<statut>`, `mentions[]`, `path` — et,
depuis le 13/10, le **porteur du fil** écrit sur le message : `carrierType` + `carrierId` (ou
`carrierId: "none"` quand rien ne porte le fil), plus `spaceId` (le commun) sur un fil de l'espace
d'un commun. Ces trois champs sont un **index**, pas une vérité (§9.10) ; un message qui ne porte
pas `carrierId` est « à reprendre ».

⚠️ **Les formes de date divergent entre les deux bouts** : la base stocke des secondes UNIX, l'API
rend un objet `Date`, et des documents legacy portent `{ sec, usec }`. Toute normalisation doit
accepter les trois — plus les chaînes ISO.

⚠️ Les `path` réels sont des **chemins pointés longs** (~190 caractères mesurés), de la forme
`<id>.<id>.<id>.<champ>.question_<champ>.comment`. Une validation qui les borne trop court casse des
cas existants.

## 5. Architecture du module

Un **seul** module, `src/modules/comment/`, `type: "core"`, portant le fil **et** le panneau : ils
partagent types, clés de cache et composants de message. Deux modules créeraient une dépendance.

> `type: "core"` est impératif. Un seul module `optional` suffit à basculer toute la construction de
> routes client en mode asynchrone, ce qui provoque une régression d'hydratation sur tout le site.
> `coform` montre qu'un module peut avoir des routes **et** rester `core`.

```
src/modules/comment/
├── module.config.ts · index.ts · types.ts · styles.css · i18n.ts · i18n/{fr,en}.json
├── constants/       queryKeys.ts · display.ts · voteTypes.ts · reportReasons.ts
├── lib/             fonctions PURES, testables sans DOM ni réseau
│   ├── commentTree.ts      normalisation, TRI chronologique, opérations immuables
│   ├── flattenThread.ts    arbre → lignes (groupes, séparateurs, non-lus, retrait borné à 3)
│   ├── filKey.ts           lien profond (lecture/écriture du paramètre d'URL)
│   ├── resolveTarget.ts    (type, id) → méthode d'`api`
│   ├── optimistic.ts       nœud en cours d'envoi + règle « peut-être écrit »
│   ├── markdownEngine.ts   LE réglage de `markdown-it`, pour le fil et pour l'éditeur (§18)
│   ├── commentProse.ts     les classes de mise en forme d'un message, partagées de même
│   ├── richText/           le schéma de l'éditeur, le pont éditeur ⇄ markdown, l'adresse d'un lien (§18)
│   ├── linkifyMentions.ts  `@slug` → lien, et charge utile `mentions[]`
│   ├── formatWhen.ts       heure, séparateur de jour, « aujourd'hui » / « hier »
│   └── voters.ts           normalisation de `SHOW_VOTE`
├── hooks/           useCommentsQuery · useCommentMutations · useCommentVoters ·
│                    useCommentPermissions
├── components/      CommentThread · CommentRow · CommentMarkdown · CommentComposer (la coquille) ·
│                    editor/ (l'éditeur, chargé côté client — §18) ·
│                    ReactionPills · ReactionPicker · VotersDialog · ContextQuote ·
│                    MessageActions · ThreadSeparators · ReportCommentDialog
└── permissions/     namespace « comment »
```

`voteTypes` (les 8 réactions) et `reportReasons` (les 7 motifs de signalement) **viennent de
`news`** : ils ont été déplacés ici et `news` en garde un ré-export d'une ligne. Deux listes
divergentes auraient produit deux statistiques de modération incomparables.

### 5.1 Pourquoi un arbre de nœuds purs

Le rendu et les mises à jour optimistes travaillent sur un `CommentNode` **immuable**, dérivé des
entités du SDK — pas sur les entités elles-mêmes. Deux raisons, dont une est un bug corrigé :

1. Les entités du SDK sont des **Proxy réactifs**. L'implémentation précédente
   (`news/utils/commentCacheUtils.ts`) écrivait dans `comment.serverData.replies` ; `onError`
   restaurait alors une référence **déjà modifiée**, si bien que **le rollback n'annulait rien**.
2. Un nœud pur se teste sans SDK, sans réseau et sans DOM.

Le cache d'un fil porte donc **deux vues** de la même chose : `nodes` (l'arbre pur, remplacé de façon
immuable à chaque mise à jour optimiste) et `index` (les instances du SDK, dont les mutations ont
besoin pour appeler `parent.comment()`, `comment.delete()` ou `comment.addVote()`). L'index n'est
reconstruit qu'au rechargement.

### 5.2 Invalidation par préfixe

`useHydratedUserContextId` vaut `null` au premier rendu : une clé complète construite trop tôt ne
correspond à rien. Toute invalidation se fait donc **par préfixe**, jamais sur la clé complète — même
règle que pour le temps réel, dont le hub ne transporte qu'un nom de sujet, jamais de donnée.

### 5.3 L'URL comme source de vérité

Les colonnes du panneau ne communiquent pas : le rail écrit l'URL, la clé de requête de la colonne
suivante change, elle se recharge seule. Grammaire du paramètre (`discussion` par défaut) :

| Valeur | Sens |
|---|---|
| `organizations:<id>` | un fil, sur l'entité entière |
| `organizations:<id>:<path>` | un fil, sur un champ précis |
| `@projects:<id>` | un porteur seul : on liste ses fils sans en ouvrir un |
| `all` | tout le parc — **jamais implicite** |

Le message visé vit dans le fragment (`#m-<id>`). Toute valeur mal formée est lue comme « aucune
sélection » : la lecture ne lève jamais, et n'accepte ni chemin de traversée, ni identifiant qui ne
soit pas un ObjectId. À l'ouverture du fil, `CommentThread` lit ce fragment (après hydratation : le
serveur ne le voit jamais), déplie la lignée du message et y saute — le lien copié par « Copier le
lien » n'amenait jusque-là qu'au fil (revue du 29/09, corrigé le 02/10).

### 5.4 Ce qui reste dans `news`

**Une ligne**, et un adaptateur de dix. Le rebranchement a supprimé huit fichiers sans remplaçant :
`NewsComments`, `CommentItem`, `CommentInput`, `DeleteCommentDialog`, `useNewsCommentsQuery`,
`useCommentMutations`, `useFormatComment` et `commentCacheUtils`.

Le couplage réel n'était pas `newsId` mais **l'effet de bord sur le cache des actualités** : trois
blocs de mutation écrivaient `commentCount` dans une structure appartenant à `news`. Il est
remplacé par `onCountChange?: (delta: number) => void` — le module n'invalide que ses propres clés,
le consommateur décide où le delta atterrit (`news/utils/commentCount.ts`).

Deux constantes ont suivi le fil : les **huit réactions** et les **motifs de signalement**
vivent désormais dans `comment/constants/`, et les trois composants `news` qui s'en servent encore
(`ReportDialog`, `NewsVoteDisplay`, `NewsReactionsModal`) les y prennent directement. Les
ré-exports transitoires posés au J8 ont disparu : ils n'étaient plus qu'une indirection, et le
barrel `news/constants` continuait de les annoncer comme siennes alors que `news` ne les possède
plus.

Deux points à connaître avant de brancher le fil ailleurs :

- **`scopeEntity`**. La *cible* du fil et le *contexte des droits* peuvent différer : le fil d'une
  actualité est porté par la news, mais la modération suit l'administration de l'organisation qui
  l'héberge. `entity` désigne la cible, `scopeEntity` le contexte (droits + recherche de mentions).
- **La mutation du compteur est assumée.** `serverData` est un Proxy réactif : y écrire est ce qui
  déclenche `useReactiveProperty`. Cette écriture vit hors composant, dans un helper nommé — dans
  le composant, le lint la refuse à juste titre (`react-hooks/immutability`), et l'en sortir rend
  l'intention lisible.

### 5.5 Rendu du texte

Le texte d'un message est rendu par **`markdown-it` + `sanitizeProse`**, c'est-à-dire le chemin
déjà en place dans le dépôt (`ProseContent`) — et non `react-markdown`. Un second moteur de rendu
markdown aurait voulu dire deux garanties de sécurité à tenir.

La restriction est obtenue **à la source**, ce qu'un filtrage après coup ne donne pas :
`html: false` échappe tout HTML écrit par l'auteur, et la règle `lheading` est désactivée — un
titre « souligné » (une ligne suivie de `===` ou de `---`) **ne peut pas exister** dans la sortie.
Une image écrite dans le texte (`![description](adresse)`) existe depuis le 14/10 : le fil la rend
selon son adresse — importée sur la plateforme, affichée ; d'un autre site, au clic du lecteur ;
`data:` ou autre, jamais (§21). Les titres à croisillons, eux, sont rendus depuis le
14/10, sur six niveaux comme les écrit l'éditeur du legacy (§18.9) ; le HTML écrit dans un titre y
reste échappé comme ailleurs. `sanitizeProse` reste le filet. `breaks: true` est propre au fil : dans une discussion, un retour
à la ligne simple est voulu par celui qui écrit.

Deux points mesurés :

- `sanitizeProse` **retire l'attribut `target`**. Le composant ne le pose donc pas : le poser
  donnerait l'illusion d'un comportement que la sanitisation défait juste après. `rel="noopener
  noreferrer nofollow ugc"`, lui, passe — et c'est l'arme utile contre le spam de liens.
- Les mentions sont résolues **avant** le parsing, par `linkifyMentions`, qui corrige trois défauts
  de `parseMentionsToMarkdown` : slug non échappé, absence de tri par longueur (`@marie` était
  substitué à l'intérieur de `@marie-dupont`) et substitution répétée. Elle épargne en plus les
  blocs de code.

## 6. Pièges relevés dans l'existant

Trois chemins **morts** dans l'implémentation `news`, à ne pas reporter tels quels : `canComment`
(calculé, jamais lu — `showComments` ne masque donc rien), `FormattedComment.canEdit/canDelete`
(jamais lus), et `useCommentVotes` (jamais appelé). Deux incohérences : la réponse optimiste est
fabriquée **à plat** quand l'ajout optimiste produit un objet à `serverData`, si bien qu'elle n'est
probablement jamais rendue ; et le vote optimiste n'est appliqué qu'à la **racine**, pas aux réponses.

Enfin, `Comment.php :: getCommentOptions()` renvoie le document entier au lieu des options : toute
entité portant un champ `commentOptions` perd son réglage `tree` et reçoit son fil **à plat**.

Deux défauts n'ont été vus qu'**au navigateur**, sur des données réelles — ni les tests unitaires
ni les gates ne pouvaient les attraper, parce que l'un portait sur l'ordre rendu par le serveur et
l'autre sur le sens d'un champ. Ils sont documentés au §7 ; la leçon vaut pour la suite du module :
**une grammaire visuelle se vérifie à l'écran, pas seulement en assertions**.

## 7. Comportements du backend, mesurés

Ces sept points ne se devinent pas, et plusieurs sont **contre-intuitifs**. Chacun a été établi en
appelant le vrai backend, puis en relisant la base — pas en lisant le code PHP.

| Sujet | Ce qu'on croit | Ce qui se passe |
|---|---|---|
| **Ordre de lecture** | `GET_COMMENTS` rend le fil dans l'ordre | Il rend les racines en ordre **décroissant** : un fil se lit à l'envers si on ne trie pas. `toCommentTree` trie lui-même, récursivement et de façon stable. |
| **Marque « modifié »** | `updated > created` signale une édition | **L'inverse.** Modifier le texte n'écrit **aucune** date ; c'est une **réaction** qui écrit `updated` et `modified`. L'édition d'un message n'est pas traçable — la marque a été retirée. |
| **Suppression** | Supprimer un parent supprime ses réponses | Le backend ne supprime **que** le document visé. Les réponses restent en base, **orphelines**, et cessent d'être remontées (le fil se reconstruit depuis ses racines) : à l'écran la branche disparaît, mais **des orphelins s'accumulent**. |
| **Réactions** | On peut cumuler plusieurs réactions | **Vote unique** : poser `like` sur un `love` remplace. Reposer la même la retire. |
| **Liste des votants** | Il faut un appel par votant | `SHOW_VOTE` porte déjà `name`, `slug` et `profilThumbImageUrl` : **aucun appel supplémentaire**. |
| **Écriture et erreur** | Un 500 veut dire « rien n'a été écrit » | Un écrit peut **réussir puis échouer** sur un traitement d'aval. Au-delà de 500, on relit le fil au lieu de conclure (voir §3). |
| **`mentions[]`** | `{id, name}` suffit | Le schéma exige les **six** champs (`id, name, slug, type, value, count`), refuse tout le reste, et veut `count` en **nombre** — le legacy en stocke parfois la chaîne `"1"`. |

Le module ne suppose donc rien de l'ordre, des dates ni de la cascade : il trie, il ne déduit pas
l'édition, et son compteur suit **l'affichage** plutôt que le nombre de documents effacés.

## 8. Limites connues, côté produit

| # | Limite | Origine | Ce qu'on fait |
|---|---|---|---|
| B1 | ~~Pas d'image dans un message~~ | **Levé — livré le 24/09** (§13.2 à §13.4), vérifié au navigateur le 07/10 (§13.5) : bouton, collage, glisser-déposer, rendu et visionneuse | — |
| B2 | `markdownActive` non postable | `ADD_COMMENTS` en `additionalProperties: false` | Rendu markdown restreint, inconditionnel |
| B3 | Mentions limitées aux citoyens | `searchMembers` en `personOnly` | Citoyens seuls |
| B6 | Pas de filtre `path` **en lecture** | `GET_COMMENTS` n'a pas de bloc `request` | Filtrage côté client ; l'endpoint générique portera le filtre serveur |
| B10 | L'édition d'un message n'est pas tracée | Mesuré (voir §7) | Aucune marque « modifié » — mieux vaut ne rien dire qu'affirmer faux |
| ~~B11~~ | ~~La saisie montre la syntaxe markdown, elle ne l'interprète pas~~ | Composer maison sur `<textarea>` jusqu'au 13/10 | **Levé le 13/10** : le composer écrit dans un éditeur qui montre la mise en forme (§18) — la valeur stockée reste du markdown |
| B12 | Le panneau n'est atteignable que par `/discussions` | Aucun point d'entrée n'a été posé dans le chrome du site | Décidé le 24/09 : **pas maintenant**. L'API est prête — `DiscussionModal`, `useDiscussionLauncher` et `useDiscussionUnread` sont exportés, ce dernier sans requête supplémentaire |

## 9. Panneau « Discussions » — endpoint `discussions`

> Endpoint **créé** pour ce module (il n'existait pas), côté backend PHP. Comme tout ajout
> d'endpoint, il est documenté ici pour pouvoir être déclaré au SDK sans le deviner.

Chaîne PHP : `co2/controllers/CommentController.php` (clé `discussions`) →
`citizenToolKit/controllers/comment/DiscussionsAction.php` →
`citizenToolKit/models/Discussion.php` (registre d'adaptateurs et agrégation).

Il remplace les deux actions legacy `projectlist` et `actionlist`, câblées en dur sur
**projets → actions** et affligées de tris à bulles en PHP. Le panneau visé est générique :
n'importe quelle entité porteuse, n'importe quel type de fil.

### 9.1 Le sens de marche, et pourquoi il est inverse de l'intuition

Un **fil** est le triplet `(contextType, contextId, path)`. Le `path` n'existe en base que sur
les formulaires, où il désigne une question : **un même document `forms` porte plusieurs fils**.

Un **porteur** est l'entité sous laquelle le fil se range dans le rail. Tout contexte n'en est pas
un : une actualité, une action, un formulaire se rattachent à une organisation, un projet, un
événement, une ville ou une personne.

Le plan initial allait du **porteur vers ses fils**. La mesure a imposé l'inverse :

| Sens | Coût mesuré | Complet ? |
|---|---|---|
| porteur → fils | **89 ms pour UN SEUL porteur** (58 ms de balayage sur 144 576 actualités, 14 ms sur 14 830 actions, 17 ms sur les formulaires) | non |
| **fils → porteur** (retenu) | **9 ms pour tout le parc** : 1 agrégation indexée + des lectures par `_id` | oui |

⚠️ **Ce « 9 ms » a été mesuré avec 30 commentaires en base de dev** (relevé par la revue du 29/09).
Le coût de ce sens suit la taille de `comments`, pas celle de `news` — c'est ce qui le rend
préférable —, mais l'agrégation du rail groupait TOUTE la collection à chaque appel. C'est réglé
depuis le 13/10 : chaque message porte le porteur de son fil, et le rail ne lit plus que ce qui
regarde son lecteur (§9.10, avec la mesure à 500 000 messages).

Trois raisons rendent le premier sens intenable, et elles sont structurelles :

1. `news`, `actions`, `forms` et `answers` n'ont **aucun index** hors `_id_` ;
2. un formulaire se rattache par `parent.<porteurId>`, un chemin **dynamique** : non indexable,
   quoi qu'on fasse — même famille de piège que `views.<userId>` ;
3. le balayage porte sur `news` (144 576 documents), soit une collection **des milliers de fois**
   plus grosse que `comments`, pour en extraire une poignée de fils.

Le sens retenu ne lit que `comments` puis résout par `_id`, toujours indexé.

### 9.2 Route et modes

```
POST /co2/comment/discussions
```

Le défaut **suit le périmètre fourni, il ne l'élargit jamais** : sans contexte on rend le rail,
avec un porteur ses fils, avec un contexte ce seul fil.

| `depth` | Déclenché | Rend | Coût |
|---|---|---|---|
| `rail` | défaut **sans** paramètre | porteurs et compteurs, **aucun titre de fil** | 3 lectures d'index + 1 agrégation sur ce qui regarde le lecteur (§9.10) |
| `fils` | défaut **avec** `carrier` | les fils d'**un** porteur, titrés | idem + résolution des contextes |
| `fil` | `contextType` + `contextId` | un fil : compteurs, porteur, `canComment` | requête ponctuelle |
| `all` | **jamais implicite** | porteurs **et** tous leurs fils | plafonné, `truncated` au-delà |

**Aucun texte de message ne transite par cet endpoint** — uniquement des titres, des compteurs et
des dates. Le fil lui-même se lit par `GET_COMMENTS`.

### 9.3 Paramètres (corps POST)

| Paramètre | Type | Défaut | Effet |
|---|---|---|---|
| `depth` | `"rail"\|"fils"\|"fil"\|"all"` | déduit | force le mode ; une valeur inconnue retombe sur le défaut déduit |
| `carrier` | `"<type>:<id>"` | — | le porteur ; `carrierType` + `carrierId` acceptés séparément |
| `contextType` | `string` | — | type du fil, **liste blanche** des 10 types commentables |
| `contextId` | `string` | — | identifiant du contexte |
| `path` | `string` | — | la question, pour un fil de formulaire |
| `limit` | `int` | `200` | plafonné à **1000**, plancher 1 |

L'utilisateur **n'est jamais un paramètre** : `unread` et `mine` sont calculés pour la session
courante.

Tous ces paramètres se lisent **en chaîne**. Posté sous une autre forme (`path[]=…`), un paramètre
est **refusé** (`bad-request`) — il n'est ni converti ni ignoré : le lire comme absent ferait
répondre sur un autre périmètre que celui demandé, le fil racine à la place d'un fil, le rail à la
place d'un porteur.

### 9.4 Réponse

```jsonc
{
  "result": true,
  "depth": "rail",
  "limit": 200,
  "truncated": false,
  "carriers": [
    { "id": "65a1…", "type": "organizations", "name": "…", "slug": "…", "image": "…",
      "threads": 2, "total": 3, "unread": 1, "last": 1758…, "mine": false }
  ],
  // absent en `rail` — c'est ce qui rend ce mode léger
  "threads": [
    { "key": "actions:65b2…", "contextType": "actions", "contextId": "65b2…", "path": null,
      "title": "…", "carrier": { "type": "projects", "id": "65a1…" },
      "total": 4, "unread": 0, "last": 1758…, "mine": true }
  ]
}
```

En mode `fil` : `thread`, `carrier` et `canComment` remplacent les deux listes.

Les listes portent aussi `scanTruncated`, `carriersTruncated` (§9.9) et, depuis le 13/10,
**`indexed`** : `true` quand la liste a été servie par l'index des porteurs, `false` quand elle l'a
été par le balayage du parc (§9.10). C'est une **observation** — la réponse est la même dans les
deux cas —, utile pour constater en production que la reprise a pris ; l'écran ne la lit pas.

`key` est la clé qui transite dans l'URL du panneau : `type:id`, ou `type:id:path`.
`last` est en **secondes**, la base mêlant `MongoDate` et entiers.

Refus en **HTTP 200** avec `{result:false, code, msg}`, comme les actions voisines — jamais un code
d'erreur HTTP. `code` est **stable** — `login`, `bad-request`, `hidden` — et c'est lui que l'écran
lit ; `msg`, en français, ne sert qu'au diagnostic. Côté client, ce corps n'arrive pas en valeur de
retour : la façade du SDK le rend en **exception** (§14.7).

### 9.5 Le registre d'adaptateurs

Une entrée par type commentable. La forme du lien **diffère d'un type à l'autre parce que la base
est ainsi**, pas par choix :

| Type | Remontée | Taux de résolution mesuré |
|---|---|---|
| `citoyens`, `organizations`, `projects`, `events` | porteur eux-mêmes | — |
| `actions` | `parentType` + `parentId` | 99,96 % |
| `classifieds` | `parent` = `{<porteurId>: {type}}` — la **clé** porte l'identifiant | 94 % |
| `poi` | `parent`, sinon lui-même | 92 % |
| `answers` | `context` = `{<porteurId>: {type}}`, sinon `form` → `forms._id` → le porteur du formulaire | 92,3 % par `context`, 95,1 % par `form` |
| `news` | `target` = `{type, id}` | 78 % |
| `forms` | `parent` **ou** `parentType`/`parentId` — les **deux** formes coexistent | 48 % |

Trois pièges tenus par le registre, chacun mesuré :

- **jamais `answers.formId`** : c'est un **tableau** sur 11 848 réponses sur 17 691. La première
  version le convertissait en chaîne — notice PHP que le gestionnaire d'erreurs de dev/QA change
  en **500 pour TOUT le rail**, dès qu'un seul commentaire visait une telle réponse (contre-épreuve
  du 02/10 : page d'erreur Yii sur `rail`, `all` et `fils`), pour 0,4 % de résolution seulement.
  La remontée lit `context` (même forme que `parent`), puis `form` (l'ObjectId du formulaire, en
  chaîne) — tous deux par `_id`, en lot ;
- **`forms` a deux formes de lien parent**, la carte et les champs plats ;
- **la résolution échoue pour de bon** : 52 % des formulaires et 22 % des actualités n'ont aucun
  lien parent en base. Un fil non résolu n'est **jamais perdu** — il se range sous un porteur nul.

### 9.6 Plan de requête, vérifié

L'agrégation des compteurs tient en **une** passe qui finit par un `$group` réducteur — jamais un
flux de documents, `PHDB::aggregate` matérialisant tout le curseur en mémoire PHP.

| Requête | Étages |
|---|---|
| `rail` / `fils` / `all` | `IXSCAN` sur `ctx_created`, puis `FETCH` |
| `fil` | `IXSCAN` sur `ctx_created`, puis `FETCH` |
| **contre-épreuve** : le même `$match` **sans `contextType`** | `COLLSCAN` |

La contre-épreuve justifie la forme du `$match` : `ctx_created` étant
`{contextType, contextId, created}`, une recherche sur `contextId` seul ne peut pas l'employer.

`views.<userId>` reste un chemin dynamique, donc non indexable : le `$match` sélectif doit
**toujours** précéder le test de non-vu, ce que fait le pipeline.

Ce tableau décrit le chemin d'**origine** (le balayage), qui sert encore tant que la reprise n'a
pas tourné. Les plans du chemin indexé sont au §9.10.

### 9.7 Gardes

- connexion exigée (`Person::logguedAndValid()`), refus en 200 `result/msg` ;
- **liste blanche du type de contexte** et **du type de porteur** avant toute lecture : ces valeurs
  viennent de la donnée (`parentType`, `target.type`) et choisiraient sinon une collection
  arbitraire ;
- `limit` bornée à 1000, quoi qu'on demande ;
- un porteur supprimé n'arrête rien : sur un compte réel, 14 des 218 liens `links.projects`
  pointent vers des projets qui n'existent plus. Un tel porteur n'est pas proposé comme espace
  vierge, et un fil qui s'y rattache se range sous « sans espace » — il était jeté, contre la
  règle « jamais perdu » (revue du 29/09) ;
- **actualité réservée** : le mur legacy ne montre à un non-membre que les actualités de périmètre
  `public` ou `restricted` (`news/controllers/actions/GetAction.php`) — une **liste blanche**. Le
  panneau applique la même : toute autre actualité (`private`, périmètre absent ou inattendu) n'est
  rendue — titre, compteurs, existence même —, dans **tous** les modes, qu'à son auteur et aux
  lecteurs de l'espace qu'elle vise. Les lecteurs se lisent **côté espace**, comme au legacy
  (`canManageNews` sur `Element::$connectTypes`), et non sur les liens de la personne : organisation
  → `links.members`, projet → `links.contributors` (adhésion validée — ni `toBeValidated`, ni
  invitation en attente) ; événement → ses admins confirmés et son organisateur ; personne → elle
  seule. Une lecture par type d'espace. La règle vaut aussi en mode `fils`, qui ne cadre pas le
  porteur demandé, et en mode `all`, dont le cadrage passe par `follows` ;
- **discussions réservées d'un appel à projets** (`path` d'un fil de formulaire contenant
  `.discu_`, hors `.commentPublic`) : retirées de toutes les **listes** du panneau (rail, `fils`,
  `all`), pour tous — le panneau ne connaît pas le commun, et juger chaque ligne coûterait une
  lecture par fil : on refuse plus, jamais moins. Pour un fil **désigné** (mode `fil`, `seen`),
  elles se jugent depuis le 07/10 sur l'audience de la discussion (§15.4) : ouvertes à ceux
  qu'elle admet, refusées (`hidden`) aux autres. Quand plus rien ne permet d'en juger — commun
  supprimé, discussion qui n'y est plus déclarée —, la forme du chemin décide de nouveau ;
- en mode `fil`, un refus est **neutre** (`hidden`) : une actualité introuvable est refusée comme
  une actualité réservée, si bien que la réponse ne dit pas si l'identifiant existe. `seen` suit la
  même règle et rend `marked: 0` sur un fil refusé ;
- en mode `fil` sans `path`, c'est le fil **racine** qui est rendu (`path` nul), jamais le premier
  venu — sur un formulaire, celui d'une autre question ;
- tout refus porte un **`code`** stable — `login`, `bad-request`, `hidden` — que le front traduit ;
  `msg`, en français, ne sert qu'au diagnostic ;
- cadrage : hors mode `fils`, un fil n'est rendu que si son porteur est lié à l'utilisateur ou si
  l'utilisateur y a écrit. **Vérifié** sur deux comptes de rôles différents — les rails obtenus
  sont entièrement disjoints, et les non-lus ne remontent que pour le compte qui ne les a pas lus.

### 9.8 Deux avertissements

**`PHDB::isValidMongoId` lève une exception au lieu de rendre `false`.** Elle construit
`new MongoId($id)` **avant** de valider : sur une entrée utilisateur fantaisiste, le backend rend
une page d'erreur HTML au lieu d'un JSON. Son motif `/^[0-9a-z]{24}$/` accepte de surcroît des
lettres hors hexadécimal. Le module valide donc lui-même, sans rien construire. **Tout appelant
qui passe une entrée utilisateur à cette fonction a le même défaut.**

**Passage à l'échelle.** Le coût était proportionnel à la collection `comments` : l'agrégation,
servie par un index, le parcourait en entier. La voie annoncée ici — écrire le porteur sur le
message à l'insertion — a été prise le 13/10 : §9.10.

### 9.9 Les éléments vierges, et le tri qui coupait trop tôt (24/09)

Deux défauts de justesse, découverts à la relecture et corrigés ensemble parce qu'ils tiennent
au même endroit : le moment où l'on décide ce qui sort de l'agrégation.

**1. Un élément sans aucun message n'existait pas.** C'était une RÉGRESSION sur le legacy, pas
un manque de conception : `ProjectListAction` partait de la collection `projects` et poussait
**toujours** le projet, `count: 0` compris ; `ActionListAction` listait **100 %** des actions
ouvertes. Le nouvel endpoint part de `comments`, où un élément vierge n'a aucune clé — on ne
pouvait donc pas lancer une discussion là où il n'y en avait pas encore.

Le sens de marche reste le bon (fils → porteur : 9 ms pour tout le parc, contre 89 ms pour UN
seul porteur dans l'autre sens). On lui adjoint une seconde source, entièrement servie par
`_id` : `Discussion::memberships()` lit `citoyens.<uid>.links` en **une** fois, en projection
fine, et rend deux ensembles de nature différente — c'est la clé du correctif :

| Ensemble | Rôle | Contenu |
|---|---|---|
| `scope` | **filtrer large** — ce fil vous regarde-t-il ? | tout identifiant rencontré, `follows` et liens en attente compris |
| `carriers` | **énumérer étroit** — où pouvez-vous lancer une discussion ? | appartenance réelle, **typée**, hors `toBeValidated` / `isInviting` / `isAdminPending` |

Une invitation non acceptée cadre donc, mais n'énumère pas. Les porteurs ainsi obtenus
rejoignent les `$in` **déjà construits** par `resolveCarriers` : le surcoût réel est de +0 à
+4 `findByIds`. **Mesuré : +4 ms** pour 253 porteurs vierges de plus (19 → 23 ms médian).

⚠️ Le type vient de l'**entrée**, jamais du seau : `memberOf` est censé mêler organisations,
projets et événements. Mesuré ici : 1 782 entrées, toutes `organizations` — on ne code pas sur
cette coïncidence, et les entrées sans type reconnaissable sont versées aux trois collections
candidates, ce qui ne coûte aucune requête de plus.

**Trier ne suffisait pas.** Un compte à 218 projets verrait cinq porteurs actifs noyés sous 213
vides. Le rail rend donc les porteurs avec activité, puis une section **repliée** « Sans
discussion (N) ». Tout est déjà dans la réponse : le pli est purement visuel, et le champ
`membership` (`self` / `admin` / `member` / `null`) est ce qui permet au front de distinguer
« un espace où je peux écrire » d'« un espace que je croise ».

Côté fils, trois niveaux décroissants en coût, tous gardés par l'appartenance :
le porteur lui-même comme fil racine (**0 requête** — c'est ce qui répond le plus directement
au besoin), les actions dont on est nommément contributeur (+1 lecture par `_id`), puis les
actions ouvertes du porteur (14 ms, mode `fils` seulement). `news` et `forms` sont refusés
partout : 58 ms sur 144 576 documents pour l'un, chemin dynamique `parent.<id>` pour l'autre.

⚠️ **La garde d'appartenance couvre TOUS les fils fabriqués**, pas seulement l'énumération des
actions. La sonde l'a prouvé nécessaire : sans elle, un porteur étranger atteint par lien
profond proposait quand même « Démarrer la discussion » — une promesse que les droits
d'écriture ne tiennent pas forcément. Un refus n'est pas une erreur : on rend les fils déjà
commentés, sans les vierges.

**2. Le tri s'appliquait AVANT le cadrage.** `$sort {last:-1}` et `$limit` s'exécutaient dans
Mongo, le cadrage utilisateur en PHP ensuite : le rail était « les N fils les plus récents de
toute la plateforme, puis filtrés sur vous ». Un utilisateur dont l'activité est plus ancienne
voyait un rail **vide**, et `truncated` mentait. Invisible en base de développement, visible en
production.

La correction ne coûte rien, et c'est ce qui la rendait moins chère que son énoncé : `$group`
traite de toute façon **tout** l'ensemble apparié avant `$sort`/`$limit`, qui ne tronquent que
la **sortie**. Le plafond Mongo devient donc un budget mémoire (`SCAN_MAX`), et la limite
métier s'applique après filtrage. S'y ajoute une branche **indexée** — un `$or` de
`{contextType, contextId: {$in}}`, chunké à 500 — qui garantit les fils portant directement
sur un élément de l'utilisateur, quel que soit le volume du parc.

⚠️ **Limite qui demeure** (revue du 29/09). Cette branche ne couvre que les fils posés
**directement** sur un porteur de l'utilisateur. Les fils **indirects** — sur une actualité, un
formulaire, une réponse, une action sans contribution nominative — ne passent que par
l'agrégation générale : au-delà de `SCAN_MAX` (5 000 fils sur la plateforme), ils sont encore
coupés **avant** le cadrage. `scanTruncated` le dit. **Levée le 13/10** dès que la reprise a
tourné (§9.10) : le rail part alors de ce qui regarde le lecteur, et le budget ne se compte plus
sur le parc mais sur ses propres fils.

⚠️ **Chaque branche du `$or` porte son `contextType`.** Contre-épreuve rejouée le 24/09 :
`{contextType, contextId: {$in}}` donne `SUBPLAN → FETCH → OR → IXSCAN → IXSCAN` ; le même
`$in` **sans** `contextType` retombe en `COLLSCAN`. Et `contextId` est stocké en **chaîne** :
le convertir en `MongoId` rend `nReturned: 0`, sans la moindre erreur.

`scanTruncated` distingue désormais « des fils manquent **pour vous** » de « le parc dépasse le
budget de lecture », et `carriersTruncated` fait de même pour les porteurs.

**Contrat d'API — additif par construction.** Le schéma de *réponse* SDK n'a aucun
`additionalProperties: false` et sa validation est optionnelle : ajouter des champs ne casse
rien. Sont ajoutés `carriers[].membership`, `threads[].virtual`, `scanTruncated`,
`carriersTruncated`, et le paramètre `includeEmpty` (défaut `1` — déclaré au schéma de requête
du SDK le 02/10 seulement : le schéma, fermé, l'aurait refusé, cf. §14). **Aucune valeur n'est ajoutée
à `depth`** : la réponse est un `oneOf` discriminé, ce serait cassant.

**Preuve de rétro-compatibilité, exécutable** : `{}` contre `{includeEmpty: "0"}` rend
exactement le même ensemble de porteurs ayant des fils — écart 0 sur 4 porteurs. La sonde J9
reste **21/21 sans modification**, et la sonde J13 couvre les six points de ce lot.

### 9.10 Le rail ne lit plus que ce qui regarde son lecteur (13/10)

Le défaut annoncé au §9.8, mesuré : à chaque appel, le rail **groupait toute la collection
`comments`**, puis résolvait le porteur de jusqu'à 5 000 fils de la plateforme, pour n'en garder
que ceux du lecteur. Sur un parc de 500 000 messages : **1,85 s et 500 000 messages lus par
appel**. L'espace d'un commun avait le même défaut à l'échelle de son appel (§15.3), et la lecture
d'un seul fil d'un formulaire très commenté aussi.

#### Ce qu'on écrit sur le message

| Champ | Vaut | Écrit quand |
|---|---|---|
| `carrierType`, `carrierId` | le porteur du fil, tel que le registre le résout (§9.5) | le contexte est d'un des dix types commentables |
| `carrierId: "none"` (seul) | rien ne porte ce fil — 52 % des formulaires, 22 % des actualités | idem, sans porteur résolu |
| `spaceId` | le commun, pour un fil de formulaire au chemin d'espace (§15.1) | en plus des précédents |

Trois endroits les écrivent, avec **la même fonction** (`Discussion::carrierFieldsOf`, qui passe par
`resolveRefs`, la source unique du porteur d'un fil) : `Comment::insert`, `Comment::insertFromWebhook`,
et la reprise des messages existants. À l'insertion, c'est une ou deux lectures par `_id` de plus,
et **poster n'en dépend jamais** : `carrierFields` ne lève pas ; en cas d'échec le message part
sans ses champs et reste « à reprendre ». Un message d'un type hors liste ne reçoit rien, et aucune
collection n'est lue pour lui — le type de contexte choisirait sinon une collection.

« À reprendre » se lit à l'**absence** de `carrierId`. D'où la sentinelle `"none"` : sans elle, les
fils que rien ne porte resteraient à reprendre pour toujours.

#### Un index, jamais une vérité

C'est le parti pris du lot, et ce qui le rend sûr : **le porteur écrit sur le message ne sert qu'à
CHOISIR quoi lire.** Le porteur d'un fil reste résolu depuis son contexte, à la lecture ; le
cadrage, les fils réservés (actualité privée, discussion d'appel), les compteurs s'appliquent
ensuite, à l'identique, sur des fils **entiers**. Une valeur périmée ou forgée peut donc ajouter un
candidat — aussitôt rejugé — ou en manquer un ; elle ne peut ni ouvrir un fil réservé, ni fausser
un compteur. Aucune règle de droits n'a été touchée.

#### Ce que le rail lit

`Discussion::listingThreads` choisit les candidats ; `DiscussionsAction::listing` fait le reste,
sans changement. Quatre agrégations, dans cet ordre :

| # | Lecture | Index | Charge des messages ? |
|---|---|---|---|
| 1 | reste-t-il des messages à reprendre ? (`carrierId` absent, bornée à 501) | `carrier_ctx` | non : rien à lire une fois la reprise finie |
| 2 | les **contextes** des porteurs du lecteur — son cadrage, `follows` compris (§9.9) | `carrier_ctx`, couvrant | non |
| 3 | les **fils** où il écrit, d'après ses 5 000 messages les plus récents — au chemin près | `author_created` | les siens seulement |
| 4 | l'agrégation `threads()` d'origine, restreinte à ces candidats | `ctx_created`, `ctx_path` | ceux de ces fils |

Les contextes de (2) se lisent **en entier** : tous leurs fils regardent le lecteur. Les fils de
(3) se lisent **au chemin près** : un message posté dans UNE question d'un appel ne fait pas lire
tout l'appel (mesuré sur le parc de 500 000 : 42 168 messages lus par cette agrégation avant ce
réglage, 2 188 après). S'y ajoutent, lus d'office :
les contextes des messages pas encore repris, ce qui est « chez » le lecteur (ses porteurs, ses
actions — même si le porteur écrit sur leurs messages est faux), le porteur demandé en mode `fils`,
et les actions où l'on s'apprête à proposer « Démarrer la discussion ». Ce dernier point vient du
banc : sans lui, un fil d'action que la sélection avait manqué reparaissait **à lancer**, par-dessus
ses propres messages.

Le mode `fils` ne lit que les contextes du porteur demandé (lectures 1, 2 et 4) ; le mode `fil` et
`seen` n'ont pas changé.

**Le `$or` est à la racine du filtre.** `threads()` recevait ses branches à côté d'autres
conditions ; MongoDB choisit alors **un** plan d'ensemble parmi quelques combinaisons d'index, et
la bonne n'en est pas toujours — mesuré : la branche d'un fil précis et celle d'un commun
retombaient sur `ctx_created` et relisaient tout l'appel. Le statut descend donc dans chaque
branche (`rootedOr`), et le `$or` devient le filtre entier : chaque branche est planifiée pour
elle-même (étage `SUBPLAN`). La liste blanche des types, qui gardait la racine, est vérifiée sur
chaque branche ; une branche qui ne la passe pas fait revenir au filtre d'origine.

#### La bascule, sans réglage

Le chemin indexé sert **si et seulement si** ses quatre index existent (`ctx_created`, `ctx_path`,
`carrier_ctx`, `author_created` — reconnus à leur clé, quel que soit leur nom) **et** s'il reste au
plus 500 messages à reprendre, lesquels sont alors lus comme candidats. Sinon : le balayage
d'origine, à l'identique. Il n'y a donc ni drapeau à poser ni ordre à respecter entre le
déploiement et la reprise : avant, pendant, après, et si elle n'est jamais lancée, **la réponse est
la même** — seul son coût change. `indexed` (§9.4) dit quel chemin a servi.

#### La reprise — ce qu'il faut faire en production

`POST /co2/comment/carrierindex`, réservé au **super-administrateur** (un compte simple, un admin
d'élément : `forbidden` ; une simple visite en GET : `bad-request`). Chaque appel pose les index
qui manquent, puis écrit les champs sur un lot de messages (5 000 lus par défaut, `limit` jusqu'à
50 000, vingt secondes au plus) et dit s'il en reste (`more`). Un lot se traite **par fil** : une
écriture reprend tous les messages du fil. Rejouer n'écrase rien — seuls les messages sans
`carrierId` sont écrits — et deux reprises simultanées ne se gênent pas.

1. Déployer `citizenToolKit` et `co2`. Rien ne change encore : balayage, comme avant.
2. Connecté en super-administrateur, depuis la console du navigateur :

   ```js
   for (;;) {
     const r = await (await fetch("/co2/comment/carrierindex", { method: "POST" })).json();
     console.log(r);
     if (!r.result || !r.more) break;
   }
   ```

3. Constater `"indexed": true` dans une réponse de `discussions`.

Mesuré en développement : 705 messages (108 fils) repris en un appel de 88 ms ; six index
construits en 6,7 s sur 500 000 messages. Sur une collection très volumineuse, les index peuvent se
poser à la main, aux heures creuses, avant l'étape 2 (les commandes sont en tête de
`Discussion::indexes()`). Pour revenir en arrière : retirer les trois champs
(`$unset` de `carrierType`, `carrierId`, `spaceId`) — le balayage reprend de lui-même.

#### Mesures

Base **jetable** de 100 000 puis 500 000 messages au format de la vraie collection, les six index
posés, agrégations envoyées telles que le PHP les envoie, médiane de sept passes, sur une machine
de développement. Les données sont **synthétiques** : elles disent une forme de courbe, pas un
temps de production.

| Lecture | 100 000 messages | 500 000 messages |
|---|---|---|
| Rail — **avant** (balayage) | 411 ms · 100 000 lus | **1 854 ms · 500 000 lus** |
| Rail — **après**, lecteur de 61 porteurs | 16 ms · 1 494 lus | **27 ms · 2 416 lus** |
| Rail — après, lecteur **membre du porteur d'un appel de 40 000 messages** | 60 ms · 9 586 lus | 249 ms · 42 839 lus |
| Lire UN fil d'un gros appel — avant / après (`ctx_path`) | 12 ms · 8 000 lus → 0 ms · 5 | 56 ms · 40 000 lus → 0 ms · 5 |
| Espace d'un commun — avant / après (`space`) | 16 ms · 8 020 lus → 1 ms · 20 | 74 ms · 40 020 lus → 1 ms · 20 |

Le balayage croît avec le parc ; le rail indexé, avec ce que le lecteur suit. Poids des index à
500 000 messages (données : 238 Mo) : 6 à 8 Mo chacun, 0,2 Mo pour `space`.

#### Limites

- **Un lecteur membre du porteur d'un appel très commenté paie encore la taille de cet appel** :
  tous ses fils le regardent, donc tous ses messages sont lus (249 ms pour 40 000). C'est la règle
  de cadrage qui le veut, pas un oubli ; la sortie serait de ne plus compter les non-lus message
  par message (`views.<userId>` n'est pas indexable), ce qui est un autre chantier.
- **Un porteur qui change** (une action déplacée d'un projet à un autre) laisse des messages au
  porteur périmé : le fil manque au rail de ses nouveaux lecteurs jusqu'au prochain message qu'on
  y poste, qui porte le bon. Il ne manque jamais à qui l'ouvre, ni à qui y écrit, ni à qui en est
  contributeur. Pour réparer sans attendre : retirer les champs des messages concernés, puis
  relancer la reprise.
- **Trois plafonds**, tous dits par `scanTruncated` : 5 000 contextes de porteurs (les plus
  récents), les fils tirés des 5 000 derniers messages du lecteur, 5 000 fils rendus. Au-delà de
  200 contextes où il écrit sous un chemin, les suivants se lisent en entier.
- **Un message écrit par une autre voie** que `insert` et `insertFromWebhook` n'a pas ses champs :
  il est lu comme « à reprendre ». Au-delà de 500, le rail repasse au balayage — relancer la
  reprise.
- **La taille de `comments` en production n'est pas connue d'ici**, ni ses index. À relever avant
  la reprise : `db.comments.count()` et `db.comments.getIndexes()`.
- L'insertion elle-même n'est tenue par aucun test versionné (le backend n'a pas d'outillage) :
  elle a été vérifiée par deux vrais messages postés puis supprimés. `insertFromWebhook`, lui, n'a
  **aucun appelant** dans les dépôts lus ici : sa ligne n'a pas pu être exercée de bout en bout.

#### Preuves

| Ce qui est prouvé | Comment |
|---|---|
| Le chemin indexé rend **exactement** ce que rend le balayage, à chaque étape de la reprise | banc sans base (moteur Mongo en mémoire, mondes tirés au hasard : porteurs, liens, statuts, chemins, contextes disparus) — rail, tout, fils d'un porteur, espace, pour chaque lecteur : 40 mondes en PHP 7.4 (194 289 vérifications), 30 d'une autre graine en PHP 8.2 (142 392) |
| … et sur le **vrai** backend | 126 appels (quatre rôles : visiteur, compte simple, admin, super-admin) identiques au relevé pris avant le lot, à six états : code sans index, reprise partielle, reprise finie, index incomplets, dessin final, état livré ; puis 507 appels identiques sur 705 messages semés sur de vrais contextes (rien de repris → balayage ; repris en partie ; repris en entier), nettoyés |
| Des champs périmés ou **forgés** ne montrent rien de plus | même banc : porteurs et communs tirés au hasard sur les messages — tout fil rendu existe à l'identique dans le balayage, aucun compteur ne le dépasse |
| Le banc **mord** | contre-épreuve par mutation : 105 défauts introduits un à un dans le modèle, 24 dans l'action du rail — chacun fait échouer le banc, et toujours par une règle (aucun par le délai ni par le plafond de mémoire qui bornent chaque passage) |
| Le rail indexé ne groupe jamais la collection | même banc : forme et ordre des quatre agrégations, branches du `$or`, lots de 500, plafond des 5 000 contextes vérifié à ce qu'on lit |
| La reprise | même banc (bornée, rejouable, n'écrit que ses trois champs, ne touche ni un type hors liste ni un document sans contexte) ; vrai backend : droits d'accès, quatre index créés, 32 messages repris |
| L'insertion écrit les champs | deux vrais messages (fil général d'un commun, fil de ligne de dépense), relus en base, supprimés ; documents porteurs restaurés |
| Les plans de requête | `explain` sur la base de développement et sur la base de mesure |
| L'écran lit toujours | navigateur, compte admin, sans écriture : le rail est servi par l'index, un fil s'ouvre avec ses messages — le SDK, qui valide les réponses, accepte les trois champs de plus —, l'espace d'un commun rend ses fils |

Ces preuves ont trouvé trois défauts avant qu'ils n'existent ailleurs : le banc, le fil d'action
qui reparaissait « à lancer » ; la mesure, l'appel relu en entier pour un seul message, puis le plan
d'ensemble du `$or` — visible à 500 000 messages, invisible sur les 33 de la base de développement.
La contre-épreuve, elle, a trouvé trois trous du banc — le fil d'un porteur vierge, proposé à son
membre et à lui seul ; le plafond des contextes, qu'un autre plafond masquait dans la réponse ; la
bascule, jugée dans un état où le balayage servait de toute façon — et deux lignes sans effet,
retirées de l'action.

## 10. Le panneau « Discussions »

Trois colonnes — **porteur → fils → messages** — montées par `components/panel/DiscussionPanel`,
et servies en page plein écran par la route `/discussions`.

### 10.1 Les colonnes ne se parlent pas

La sélection vit dans **l'URL**, pas dans React. Le rail écrit l'URL, la clé de requête de la
colonne suivante change, et celle-ci se recharge seule. Aucun état partagé, donc aucune
désynchronisation possible — et une adresse partagée rouvre exactement la même vue.

Conséquence directe : **rien à synchroniser dans un effet**, tout se dérive au rendu. C'est ce
qui évite le `setState` dans un effet que `react-hooks/set-state-in-effect` proscrit, et qui
avait déjà coûté un défaut au J7 (une sélection manuelle perdue à chaque relecture).

Grammaire de l'URL (paramètre configurable, `discussion` par défaut) :

| Valeur | Désigne |
|---|---|
| `@organizations:65a1…` | un porteur seul — on liste ses fils, sans en ouvrir |
| `actions:65b2…` | un fil |
| `forms:65a1…:etape.question_a.comment` | un fil sur une QUESTION précise d'un formulaire |
| `all` | tout le parc — jamais implicite |
| `#m-65c3…` (fragment) | le message visé |

**Écart assumé sur l'historique** : ouvrir et fermer le panneau **empilent** une entrée
(`push`), les changements internes la **remplacent** (`replace`). C'est ce qui donne
gratuitement, au bouton retour d'un mobile, la navigation à trois niveaux :
message → fil → fermeture.

### 10.2 Une asymétrie qui ne se devine pas

Les types **commentables** et les types **porteurs** ne sont pas la même liste :

- `cities` **porte** des fils (une action peut avoir une commune pour parent) sans jamais en
  recevoir ;
- `news`, `actions`, `forms`, `answers` **reçoivent** des fils sans jamais en porter.

Valider un porteur avec la liste des types commentables ferait donc disparaître de l'URL — donc
du panneau — tout fil rattaché à une ville. D'où deux listes distinctes, `COMMENTABLE_TYPES` et
`CARRIER_TYPES`, et un test qui tient chacune des deux directions.

### 10.3 Ce que le panneau charge, et quand

| Sélection | Requête | Ce qui est chargé |
|---|---|---|
| aucune | `rail` | porteurs et compteurs, **aucun titre de fil** |
| un porteur | `carrier` | ses fils, titrés |
| un fil arrivé par LIEN PROFOND | `thread` puis `carrier` | un appel de plus, **seulement à l'entrée** — depuis le rail, le porteur est déjà connu |
| le groupe « sans porteur » | `all` | c'est la seule demande explicite de tout charger |

Les messages, eux, restent chargés par `CommentThread` et son cache à deux vues : le panneau ne
réimplémente rien.

### 10.4 Deux défauts que seul le navigateur a montrés

Ni les tests ni les gates ne pouvaient les voir — comme les deux du J8.

**1. La troisième colonne restait vide** sur un fil d'action. C'était le blocage **B9** : `api`
n'expose de méthode racine que pour huit des dix types commentables, et la colonne ne reçoit
qu'une cible. **B9 est levé** : le registre d'entités du SDK couvre, lui, les douze collections
— il manquait seulement son export. Mesuré : une action ainsi construite rend bien ses
commentaires.

**2. Le fil s'ouvrait en LECTURE SEULE** — pas de composer, et poster aurait levé. Le
calculateur de droits refuse tout tant que l'entité porteuse n'a pas de `userContext`, et
**`api.project({id})` n'en pose pas** : il construit l'entité avec le client pour parent, alors
que `BaseEntity` n'hérite le contexte utilisateur que d'un parent `User`. Mesuré sur un projet
réel : `isConnected: true`, `userContext` absent. La résolution passe donc par
**`me.<méthode>({id})`** — même motif que `useCommunProjectEntity` du module AAC, et pour la
même raison : c'est le contexte utilisateur qui fait remonter l'appartenance.

Ce porteur chargé est passé en `scopeEntity` : la recherche de personnes à mentionner s'y
rapporte.

**Corrigé le 02/10 (revue du 29/09)** — la règle des droits ne dépend plus de l'entité :
**participer** demande seulement d'être connecté (le backend n'applique aucune liste blanche à
l'écriture), si bien qu'un fil sans `userContext` — porteur chargé par `api`, fil sans porteur,
commune — garde son composer. Et **modérer** — supprimer le message d'autrui — suit la règle
exacte de `Comment::delete` : super-admin (`roles.superAdmin`) ou admin de source
(`roles.sourceAdmin`), jamais l'admin de l'espace ni le propriétaire du profil, que le serveur
refuse. L'ancien calculateur lisait la MÉTHODE `isAdmin` sans l'appeler : « Supprimer » s'offrait
à tout connecté.

### 10.5 Une erreur d'hydratation, et sa leçon

La page choisissait quoi rendre selon la session (`me?.id ? panneau : message de connexion`).
Au rendu serveur la session est absente, au rendu client elle est là : les deux arbres
divergeaient, et React le signalait. L'endpoint refusant déjà les appels non connectés, le
message remonte naturellement par l'erreur de la requête — **un seul chemin, et aucun écart
serveur/client**.

Règle générale : sur une page rendue côté serveur, ne jamais brancher le rendu sur un état que
seul le client connaît.

### 10.6 Trois correctifs de relecture (24/09)

Le panneau relu à l'écran a fait remonter un grief d'ergonomie fondé, et une sonde a mis au
jour un défaut de justesse voisin. Les trois correctifs tiennent dans la colonne des fils et
dans la requête du fil ; la grammaire de densité des deux premières colonnes, elle, est un lot
à part.

**1. La métadonnée se repliait sur deux lignes.** Quatre segments dans un flex **sans**
`flex-wrap` ni `whitespace-nowrap` : chaque enfant est alors écrasé à son `min-content`, et
« 1 message » se coupait en deux. La rangée porte désormais `data-thread-meta`, ses enfants
`shrink-0 whitespace-nowrap`, et c'est le conteneur qui rogne. `flex-wrap` aurait été le même
défaut sous un autre nom.

**Ordre de sacrifice, mesuré.** Pire cas réel : « Organisation » — le plus long des dix
libellés en français **comme** en anglais — avec « 128 messages » et « 17 sept. 25 ». Il
débordait de 17 px à 1280 et de 49 px à 1024, et c'est la **date** qui disparaissait, soit
l'information la plus utile. Donc : le compteur devient une icône de bulle et le nombre seul ;
le type devient une icône et son libellé ; **seul ce libellé cède**, sous 16 rem de colonne,
et il cède en `sr-only` — masqué à l'œil, toujours annoncé à la voix. Compteur et date ne se
compriment jamais. Vérifié après correction, sur le markup réellement produit par React injecté
dans la feuille de style du site : **une seule ligne à 208, 240, 256, 288 et 320 px**, date
entière partout, libellé qui cède exactement au seuil.

⚠️ **La mesure porte sur la colonne, pas sur le panneau** : `@container/fils` est posé sur la
colonne 2, et la variante s'écrit `@max-[16rem]/fils:`. Rattachée au panneau, elle masquerait
le libellé en mode une seule colonne, où il reste pourtant 740 px de large.

**2. Deux colonnes s'intitulaient « Discussions ».** L'en-tête de la première rendait
`panel.title` alors que `panel.holders` (« Espaces ») existait déjà — il ne servait que
d'`aria-label`. La troisième se rabattait sur le même `panel.title` en l'absence de fil ouvert,
d'où une nouvelle clé `panel.messages`, **déclarée en français et en anglais** : une clé
ajoutée d'un seul côté sort en brut chez l'autre.

**3. Une cible qui n'existe plus affirmait « Aucun message pour l'instant ».** C'est le lien
partagé dont l'élément a été supprimé, le cas le plus fréquent en exploitation. La cause est
dans le backend, et elle ne se devine pas : sur `/co2/element/about`, un identifiant inconnu ne
provoque **aucune erreur** — il rend un substitut `{name: "Unknown (deleted)", slug: "unknown"}`
**sans `_id`**. L'appel réussit, le fil revient vide, et l'écran affirmait quelque chose de
faux : le fil n'est pas vide, il n'existe pas.

`isMissingDocument` tranche sur un critère **structurel**, l'absence d'identifiant de document,
et non sur le libellé anglais du legacy, qui peut bouger. Il ne s'applique qu'aux entités
obtenues par une méthode racine — seules à devoir arriver chargées : la coquille délibérée de
`createFromCollection` (`news`, `actions`) n'a jamais de données, ce qui ne dit rien de
l'existence du fil. **En cas de doute il rend `false`** : un fil vide à tort est un moindre mal
devant un « supprimé » à tort, qui découragerait d'écrire là où c'est possible.

Dans la foulée, les reprises de la requête passent de trois à une. Un élément supprimé ne
réapparaît pas, et une lecture de fil qui échoue n'est presque jamais transitoire : les trois
tentatives par défaut faisaient patienter **~15 s** sur « Chargement de la discussion… » avant
un message pourtant juste.

**Vérifié au navigateur, aux six bornes** — trois cibles réelles porteuses de messages
(organisation, formulaire, action) chargent leur fil sans que rien ne soit déclaré supprimé ;
une organisation réelle **sans** message dit toujours « Aucun message », ce qui est vrai ; une
organisation supprimée dit « Cette discussion n'existe plus » ; un formulaire supprimé rend son
erreur en **1,5 s** au lieu de ~15 s. Aucune erreur JavaScript.

### 10.7 La grammaire de densité, les bandes et la modale (24/09)

**Le panneau se mesure à son conteneur, jamais au viewport.** C'est la ligne directrice du lot,
et elle règle d'un coup deux problèmes qui semblaient distincts : le responsive et l'ouverture
en modale. Le même panneau, posé dans une colonne étroite d'un grand écran, doit se comporter
comme sur un petit écran.

`useIsMobile` est donc **retiré du layout**. Il valait `false` au rendu serveur comme au premier
rendu client : sous 768 px, les trois colonnes apparaissaient une fraction de seconde avant de
se replier. La bascule est désormais purement CSS, sur `data-step` posé en permanence, et les
trois colonnes restent **montées** — elles ne coûtent aucune requête de plus, elles vivent
toutes dans `DiscussionPanel`.

Bandes mesurées au navigateur (largeur de **panneau**, pas d'écran) :

| Panneau | Rail | Fils | Colonne du fil |
|---|---|---|---|
| < 48 rem | — | — | une seule colonne, 726 px à 768 px d'écran |
| 48 → 64 rem | **plié**, 56 px | 240 px | 562 à 686 px |
| 64 → 96 rem | 224 px | 288 px | 726 à 982 px |
| ≥ 96 rem | 256 px | 320 px | le reste |

Le **pli manuel** du rail est une préférence d'affichage, donc `localStorage` et pas l'URL :
une adresse partagée n'a pas à imposer son pli au destinataire. Elle est lue par
`useSyncExternalStore`, dont le `getServerSnapshot` rend « aucune préférence » — sans quoi
l'hydratation divergerait.

**Le pli connaît trois zones, pas deux** — et les avoir confondues a coûté un défaut complet
(corrigé le 28/09) :

| Largeur du panneau | Pli | Bouton |
|---|---|---|
| **< 48 rem** | jamais — le rail est la **seule** colonne affichée | **retiré** |
| 48 → 64 rem | **imposé** par la largeur | retiré (sans effet) |
| ≥ 64 rem | **libre**, c'est la préférence qui décide | actif |

⚠️ **Le défaut, et pourquoi il ne se voyait pas.** Les règles du pli manuel n'étaient dans
**aucune container query** : une préférence « replié » posée sur un écran de bureau suivait
l'utilisateur sur son téléphone — où le rail occupe pourtant tout l'écran. Mesuré au navigateur :
**56 px de contenu sur un écran de 390 px**, titre de colonne masqué. Et il n'y avait pas
d'issue, le bouton étant rendu `disabled` dès que le panneau passait sous 64 rem. Le commentaire
du CSS disait déjà « sous 48 rem le rail est seul, y masquer les noms serait absurde » — l'intention
était juste, une règle non bornée la défaisait trente lignes plus bas.

Deux leçons qui valent au-delà de ce cas : **une préférence persistée traverse les tailles
d'écran**, donc toute règle qu'elle déclenche doit être bornée là où elle a un sens ; et un
contrôle **grisé plutôt que retiré** annonce une issue qui n'existe pas — sous 48 rem le bouton
est désormais `display: none`, comme il l'était déjà dans la bande intermédiaire.

Le bornage est fait **en CSS**, pas dans le hook, et délibérément : la mesure JS n'existe ni au
rendu serveur ni au premier rendu client, si bien qu'y corriger `data-rail` ferait apparaître un
rail replié une fraction de seconde avant qu'il ne s'ouvre — exactement le défaut que le retrait
de `useIsMobile` avait éliminé. `useRailCollapse` ne corrige donc que ce que le CSS ne peut pas
dire : l'infobulle Radix a-t-elle lieu d'être, et le bouton est-il opérant. **8 tests**
(`useRailCollapse.test.tsx`) couvrent désormais ce hook, qui n'en avait aucun.

⚠️ **L'infobulle du rail plié doit être portalisée**, d'où le `Tooltip` de Radix et non un
`::after`. Constat de la maquette, à ne pas rejouer : une infobulle en `position: absolute`
posée *dans* le rail est **rendue mais invisible** — le rail défile (`overflow-y: auto`) et le
panneau est en `overflow: hidden`, donc elle est rognée. Mesuré : opacité 1, texte correct,
rien à l'écran. Le nom masqué sortant du nom accessible, `aria-label` et `title` sont
**inconditionnels** sur la rangée — et l'`aria-label` porte aussi les non-lus (« Fabrique, 3 non
lus »), la pastille étant cachée au lecteur d'écran : il ne les annonçait pas (02/10).

**La grammaire de densité** des deux premières colonnes vit dans `rowStyles.ts`, partagée : le
grief venait précisément de ce que les colonnes 1 et 2 avaient été écrites comme deux listes
Tailwind génériques, sans grammaire commune, alors que le fil en avait une complète. Rangées
pleine largeur séparées d'un filet (et non des pastilles flottantes), gouttière d'avatar fixe,
**barre verticale en `--primary`** pour l'état — jamais un fond seul, qui serait invisible sur
une configuration pauvre où `--muted` tombe à ~3 % du fond. Trois niveaux typographiques, pas
plus. Les en-têtes de section (« Sans discussion (6) ») sont en capitales espacées de 11 px :
ils doivent trancher **nettement** sur les rangées qu'ils coiffent, sinon on les prend pour
l'une d'elles.

**Les messages longs se replient** (A1 bis) — la seule intervention de ce chantier sur le fil,
et elle est assumée : Discord s'en passe parce que ses messages sont brefs, mais ici un fil
d'appel à projets porte des récapitulatifs de comité qui noient tout le reste. La **hauteur**
est bornée, pas le nombre de lignes : le texte reste entier dans le DOM, donc trouvable par
`Ctrl+F` et restitué par un lecteur d'écran — ce que `-webkit-line-clamp` empêche. L'estompe
est un **masque** et non un dégradé de fond, ce qui la garde juste quelle que soit la couleur
derrière, survol de ligne compris. Un message en cours d'envoi n'est jamais replié.

⚠️ La mesure passe par une **callback ref**, pas par un effet — l'idiome React pour observer le
DOM, et celui qui évite la pose d'état en effet. Et l'appel à `ResizeObserver` est **gardé** :
sans cette garde, un `new` direct lève là où l'API manque et emporte toute la ligne de message.
Constaté immédiatement sur 23 tests.

**La modale** (`DiscussionModal`) emballe `DiscussionPanel` sans rien dupliquer. **`Dialog` et
non `Sheet`, et la raison est dirimante** : `dialog.tsx` a reçu le correctif qui retire
l'animation de sortie (Radix `Presence` attend `animationend` ; un contenu lourd qui se re-rend
pendant la fermeture ne l'émet jamais → dialogue coincé `state=closed` → `react-remove-scroll`
laisse `<body>` verrouillé, page non défilable). `sheet.tsx` **ne l'a pas reçu**, et le panneau
est exactement ce contenu lourd : trois requêtes, temps réel, composer, surfaces Radix
imbriquées.

La croix par défaut est en `absolute top-4 right-4`, pile sur l'en-tête de la colonne du fil :
elle est désactivée, et la nôtre passe par une nouvelle prop `headerEnd`, qui la pose **dans**
la barre de titre, comme chez Discord.

**Sa largeur maximale vit en `md:`, pas sans variante** (corrigé le 07/10). Il faut un
`sm:max-w-none` pour retirer le `sm:max-w-lg` du dialogue de base ; or il l'emportait aussi sur
le plafond `max-w-[min(84rem,calc(100vw-4rem))]`, posé sans variante — une règle `sm:` passe
après. La modale occupait donc toute la largeur de l'écran dès 640 px. Mesuré sur le CSS de
l'application, la modale n'ayant pas de point d'entrée : 1 440 px sur 1 440 avant, 1 344 après ;
704 px à 768 ; plein écran sous 768, comme voulu.

⚠️ **Le panneau n'appelle plus jamais `close()`.** Il était câblé aux boutons « retour » ; si la
visibilité de la modale en dérivait, « retour aux espaces » la fermerait. Les retours passent
donc à `select({ kind: "none" })`, et `close()` devient le verbe exclusif de l'hôte.

`useDiscussionLauncher` expose `{ open, setOpen, openAt, unread }`, avec `open` **dérivé au
rendu** : c'est ce qui fait qu'un lien profond ouvre la modale dès le premier rendu, sans le
clignotement d'un effet qui rattraperait l'URL après coup. `useDiscussionUnread` partage la clé
de cache du rail et ne coûte donc aucune requête : la future cloche sera un fichier de 40 lignes.

### 10.8 La recherche du panneau

**Une seule barre, et non une par colonne.** La question s'est posée dans ces termes ; c'est la
mesure qui l'a tranchée, pas le goût. Côté colonne des fils : médiane 2, p90 = 5, maximum 182 sur
1 799 porteurs — 96 % de ceux qui ont du contenu tiennent en cinq lignes, il n'y a rien à filtrer.
Côté rail : médiane 1 espace, mais **353 comptes au-delà de 20**, 96 au-delà de 100, 2 429 au
maximum. Le débordement est d'un seul côté. Et trois champs, ce serait trois portées que
l'utilisateur oublie — il tape dans le mauvais, conclut « il n'y a rien », et abandonne.

**Elle est posée au-dessus des trois colonnes, pas dans un en-tête de colonne.** Deux raisons
mesurées : le titre d'une colonne porte `flex-1` et sert de cible de focus au changement d'étape ;
et entre 48 et 64 rem de panneau, le CSS réduit la colonne des espaces à 3.5 rem — un champ posé
là n'existerait pas sur des fenêtres d'environ 800 à 1 060 px, c'est-à-dire tablette paysage et
petit portable, précisément là où le rail est réduit à des avatars anonymes.

**Le périmètre est double, et le libellé le dit.** Le rail filtre ses porteurs sur les données
qu'il a déjà — il ne change jamais de requête, donc aucun squelette ne clignote pendant la frappe.
La colonne des fils bascule en résultats transverses, alimentés par le mode `all`, chaque résultat
nommant son espace (`[data-thread-space]`). Ce mode **ne coûte aucune requête Mongo de plus** que
le `rail` déjà lancé : côté serveur, l'agrégation, `directThreads`, `carrierSeeds` et
`resolveCarriers` s'exécutent dans tous les modes, seules la construction de `$kept` et la sortie
diffèrent. Il reste demandé nommément, et c'est l'utilisateur qui le demande en tapant.

⚠️ **Ce que la recherche ne verra jamais, et qu'il faut dire à l'écran** : le **contenu des
messages**. Aucun texte de message ne transite par l'endpoint `discussions`, et la base n'a aucun
index texte — un `find({text:/…/i})` sur `news` examine 144 576 documents. D'où le libellé
« Rechercher un espace ou une discussion », et la clé `panel.searchScopeHint` affichée sous
« aucun résultat ». Un simple « Rechercher… » serait un mensonge d'interface. Ne sont pas vus non
plus : les emplacements vierges « Démarrer la discussion » (le mode `all` n'en fabrique aucun) et
les fils d'un porteur hors cadrage (`all` n'applique le cadrage `scope` qu'en l'absence de porteur
demandé).

**Le repli des accents est à nous.** Le dépôt n'a aucun helper partagé — neuf copies locales de
`normalize("NFD")`, aucune dans `src/lib/` — et le scorer de `cmdk` donne littéralement 0 sur
« creche » → « Crèche ». `lib/searchDiscussions.ts` est donc une fonction pure de plus, avec ses
28 tests. Elle n'importe rien de `@/modules/*` : ce serait le premier import inter-modules du
module, et de `comment` (`type: "core"`) vers un module de fonctionnalité — le mauvais sens.

**Le rail rétréci reprend sa largeur pendant une recherche**, et c'est le fil qui cède la place.
Mesuré à 62 rem de panneau : rail 56 → 224 px, colonne des résultats 240 px inchangée, fil
694 → 526 px. Une **superposition** du rail au-dessus des colonnes 2-3 avait été construite puis
rejetée sur pièce : à cette largeur, le rail élargi recouvrait exactement la colonne des
résultats — on masquait la moitié de ce qu'on venait de chercher.

⚠️ **Trois états à ne jamais confondre**, et c'est ici qu'ils mordent : la prop JS `collapsed`
vaut `etroit || préférence` où `etroit` = panneau < **64 rem**, donc elle est vraie **aussi sous
48 rem**, où le CSS affiche pourtant le rail en pleine largeur ; l'attribut `data-rail` ne suit
que la préférence ; la bande 48–64 rem ne dépend que de la largeur. Les règles CSS s'appuient sur
la container query et sur `data-rail`, jamais sur la prop.

**Sous 48 rem**, une requête empile les deux premières colonnes. `data-step` n'est pas touché et
ne doit jamais l'être : il alimente l'effet de focus du panneau, et le dériver de la requête
volerait le focus du champ à la première frappe. `data-search` lui est **orthogonal**.
⚠️ Les règles de ce basculement doivent rester **après** celles de `data-step` dans `styles.css` :
même spécificité, c'est l'ordre de source qui tranche. Un tri des règles casserait la
fonctionnalité sans casser une seule assertion.

**La requête ne va pas dans l'URL**, pour la raison déjà écrite à propos du pli du rail : une
adresse partagée ne doit pas imposer un filtre à son destinataire. Corollaire à ne pas perdre de
vue : **un lien partagé ne transporte jamais de requête**.

**Échap, et ses trois usages dans la modale.** Radix écoute la touche sur `document` en phase de
**capture** : un `preventDefault` posé dans un gestionnaire React — qui bulle — arrive après que
la modale a décidé de se fermer. Le seul point d'accroche est `onEscapeKeyDown` sur
`DialogContent`. La règle est portée par le DOM, parce que les pièces concernées ne se parlent
pas : chacune pose `data-comment-escape` quand elle revendique la touche (le champ quand il a
quelque chose à effacer, le composeur quand il a une liste de mentions ouverte ou une édition à
annuler), et son propre gestionnaire de bullage fait ensuite son travail. Sans revendication,
Échap ferme la modale.

**Quatre défauts corrigés en chemin, tous antérieurs à ce lot :**

| Où | Ce qui n'allait pas |
|---|---|
| `DiscussionPanel` — `openThread`, `currentTitle` | lisaient la liste **affichée** ; dès qu'elle est filtrée, le titre du fil ouvert retombe sur « Messages » et **le marquage en lecture s'arrête**. Séparé en `filsDuPorteur` / `filsAffiches` |
| `DiscussionPanel` — `dernierPorteur` | `null` signifiait à la fois « je ne sais pas » et « ce fil n'a pas de porteur », si bien qu'ouvrir un fil orphelin laissait en place le porteur **précédent**. Tri-état `CarrierRef \| "none" \| null` |
| `DiscussionPanel` — `activeCarrierKey` | la sélection `all` retombait dans le filet « ce n'est pas un fil » et rendait `null` : cliquer **« Sans espace » dans le rail ne chargeait rien**, la rangée n'était pas marquée, et la colonne annonçait « aucun fil » sur un périmètre qu'elle n'avait pas demandé. Or 52 % des fils de formulaire sont orphelins |
| colonne des fils — erreur | un refus du serveur rendait une liste vide, présentée comme « aucun fil ne correspond » : une erreur affichée comme une absence de résultat. Constaté **au navigateur**, en anonyme |

**Et un défaut de latence**, corrigé au passage : `parseDiscussions` marque désormais les refus
applicatifs, et `useDiscussionsQuery` ne les réessaie plus. Le défaut de React Query — trois
tentatives à délai croissant — faisait attendre **douze secondes** devant des squelettes avant que
l'écran ne dise enfin pourquoi il était vide ; mesuré à moins de quatre après correction. Une
panne de réseau, elle, garde ses tentatives.

**Ce qui n'est pas prouvable en test unitaire** : rien de ce qui relève du CSS — jsdom n'évalue ni
les container queries ni les styles calculés. Les règles `[data-search]` ne sont couvertes que par
leur **cause**, l'attribut posé sur la racine. Les largeurs ont été mesurées au navigateur sur le
serveur de dev (`commentaire/module-comment/verif-recherche.mjs`, non versionné).

### 10.9 Les initiales des avatars

Trois endroits du module fabriquaient des initiales — le rail, l'avatar d'auteur du fil, la liste
des votants — et tous les trois prenaient le **premier caractère** d'un mot, quel qu'il soit.

Mesuré sur les **105 247** noms de la base de dev (organisations, projets, événements, citoyens) :
**998** produisaient une première initiale qui n'est pas une lettre, **4 025** une seconde. Les cas
ne sont pas théoriques — `// Parallèle // RENNES` donnait `//`, `"" Le bonheur est dans le
jardin""` donnait `""`, `SEOR - Société d'Études` donnait `S-`, `#NuitDebout compiegne` donnait
`#N`.

`lib/initiales.ts` remplace les trois recettes par une seule, testée. La règle tient en quatre
points : un mot sans aucune lettre n'est pas un mot et est écarté **avant** qu'on compte les deux
premiers (d'où `PR` et non `/P`) ; dans le mot retenu on prend la première **lettre**, pas le
premier caractère ; un chiffre n'est jamais une initiale (`CAUE 974` rend `C`) ; et s'il ne reste
rien, on rend `?` plutôt qu'une pastille muette. `\p{L}` couvre les alphabets non latins, et le
parcours se fait par point de code pour ne pas couper une paire de substitution sur un emoji.

⚠️ **Cinq autres fabriques d'initiales existent hors du module** et ont le même défaut :
`auth/CurrentUserAvatar`, `search/ThematicCards`, `search/card/CardDefault`,
`coform/CommonTableContributorsDialog`, `ampli/AmpliUserCard`. Les aligner suppose de remonter le
helper dans `src/lib/` — autre lot, autre périmètre.

### 10.10 Le séparateur de jour dans un arbre

Le fil affichait, entre deux messages, **une pile de séparateurs alternés** « 23 septembre » /
« Aujourd'hui » — et la pile grandissait à chaque fois qu'on repliait puis dépliait une branche.
Deux défauts distincts se superposaient, et ils n'ont pas la même nature.

**Le premier est un mauvais choix de clé React.** La ligne de séparateur portait `date-${jour}`.
Or le même jour peut revenir plusieurs fois dans une seule liste : plusieurs lignes avaient donc
la **même clé**, React ne savait plus laquelle remplacer, et les anciennes restaient à l'écran.
La clé est désormais ancrée sur le message qui suit le séparateur — unique par construction, et
non par chance.

**Le second est une règle qui ne tenait pas dans un arbre.** Le séparateur était posé à chaque
changement de jour, le long d'un parcours **en profondeur**. Ce parcours n'est pas chronologique :
il revient en arrière chaque fois qu'on remonte d'une branche. Sur le fil de démonstration — trois
racines du 23 septembre, deux réponses du 28 — il produisait **cinq** séparateurs pour dix
messages, dont trois disant « 23 septembre ». Seul le niveau racine avance dans le temps ; c'est
donc le seul où un séparateur veut dire quelque chose, et le seul où il est désormais posé.

Reste ce que cette règle laissait tomber : une réponse écrite un autre jour que sa racine n'a plus
aucun séparateur au-dessus d'elle, et n'affichait que « 11:08 » — une heure qu'on lit forcément
comme celle du jour affiché plus haut. `flattenThread` marque ces lignes d'un `dayShift`, et la
ligne rend alors la date entière (`dates.at`, ajoutée dans les deux catalogues). Le même libellé
que le séparateur est réutilisé, pour que les deux repères ne puissent pas diverger.

⚠️ Un test « donne une clé unique à chaque ligne » **existait déjà** et était vert. Il portait sur
un fil plat à jours croissants — un cas où les clés sont uniques par accident. Il affirmait donc
une propriété qu'il ne mettait pas à l'épreuve. Il porte maintenant sur un arbre dont le jour
revient en arrière, et les deux correctifs ont été vérifiés par retrait.

### 10.11 Le fil en arbre, du téléphone au grand écran (28/09)

**Le grief** : « la discussion est un peu désordonnée ». **Le diagnostic, mesuré** : on avait
appliqué la grammaire d'un fil *plat* — Discord, la référence du J3 — à un *arbre*. Discord n'a pas
de réponses imbriquées, donc son regroupement par auteur y est sans ambiguïté ; ici il traversait
les frontières de sujet, et « Second sujet, **sans rapport** » s'affichait sans en-tête, collé à la
racine précédente. S'y ajoutaient une hiérarchie de 28 px de retrait par niveau (4 % de la colonne),
un texte haché par deux lignes de service, et — sur téléphone — onze barres d'actions sur onze
affichées en permanence, qui recouvraient les citations.

La donnée tranchait la question du modèle : **86 %** des messages en base sont à profondeur 0 ou
1, la profondeur maximale est **3**, et tous les fils ont plusieurs racines. Trois directions ont
été maquettées (sujets à plat, arbre renforcé, fil chronologique) ; **l'arbre renforcé** a été
retenu, « à condition de bien le gérer, surtout sur mobile ».

| Règle | Où | Ce qu'elle corrige |
|---|---|---|
| Une racine n'est **jamais** groupée | `flattenThread` | le sujet fondu dans le précédent |
| Un filet entre deux sujets | `styles.css` (`data-real-depth="0"`) | on ne voyait pas où une conversation finit |
| **Trois niveaux partout**, citation au-delà | `MAX_VISUAL_DEPTH = 3` | l'arbre réduit à un niveau sur téléphone |
| Un trait par niveau d'ascendance, avatars dégressifs | `styles.css` | une hiérarchie illisible |
| Mesures selon la largeur **du fil** | container query `fil`, seuil 32 rem | la bascule par écran (`useIsMobile`) |
| Une seule ligne de service | `CommentRow` | repli et réactions sur deux lignes |
| Actions : une instance, deux présentations | `MessageActions` + `styles.css` | onze barres flottantes au doigt |
| « Répondre » écrit, au doigt | `(hover: none), (pointer: coarse)` | arbitré par l'user |
| Cibles à la taille du doigt | idem | pastilles 20 px, repli 16 px |
| Composer fixé, la liste défile | `CommentThread` | il fallait descendre pour écrire |
| Plein écran sous 48 rem | page et modale | 58 px de large, ~176 px de haut perdus |
| Repli d'office : > 5 réponses **toutes lues** | `AUTO_COLLAPSE_MIN_REPLIES` | sa propre réponse masquée à l'envoi |
| Répondre **ouvre** la branche | `CommentThread` | une réponse rangée derrière un repli |
| La vue suit l'envoi | `CommentThread` | un envoi sans effet visible, remonté haut |

**Garder l'arbre sur téléphone ne coûte presque rien** quand ce sont les *mesures* qui se
resserrent et non la structure. Mesuré au téléphone (390 px), avant → après : texte à la racine
**280 → 330 px**, pastilles **20 → 32 px**, repli **16 → 36 px**, panneau **358×668 → 390×844**.

**Quatre pièges, à ne pas rejouer.**

1. **Les valeurs étroites vont sur les ENFANTS du conteneur.** Une container query stylise les
   descendants du conteneur, jamais lui-même : les variables larges sont posées sur
   `.comment-thread`, les étroites sur `.comment-thread > *`, dont tout le reste hérite.
2. **Une seule instance d'actions**, que le CSS place en flottant à la souris et dans le flux au
   doigt. Deux instances masquées tour à tour feraient deux « Répondre » pour un lecteur d'écran,
   et deux déclencheurs de menu. C'est pourquoi le positionnement a quitté les classes pour
   `styles.css`.
3. **Les tests de groupement portaient sur des racines.** Ils seraient restés verts après la règle
   « une racine n'est jamais groupée » — pour une mauvaise raison, n'éprouvant plus rien. Ils
   portent désormais sur des réponses ; la règle de minuit, qui n'avait pas de test, en a un.
4. **L'envoi se suit par son texte, pas par son identifiant.** À la confirmation, le message
   provisoire prend l'identifiant du serveur — et c'est précisément là qu'il faut recaler la vue :
   un message en cours d'envoi n'a pas de ligne d'actions, confirmé il en gagne une (+ 36 px au
   doigt) qui repoussait son bas sous le bord. Vu au navigateur, invisible aux tests.

**Vérifié au navigateur** : anonyme à 390 / 900 / 1 500 px, et **connecté au téléphone** (compte
simple) — 9 contrôles sur 9, dont un envoi depuis le haut du fil et une réponse à une branche
repliée, messages supprimés ensuite par l'interface ; base contrôlée, 30 → 30 commentaires.
⚠️ Sur le serveur de dev, le bouton ⚙ de l'éditeur de configuration (`AdminPanel`, chargé en
`DEV` seulement) recouvre « Envoyer » au téléphone : sans effet en production.

### 10.12 La marque d'état : mention non lue, non-lu, survol (28/09)

**Le grief**, capture à l'appui : « le fond passe jusqu'en dessous de la timeline », et la mention
lue comme une « marque de nouveau commentaire ». Puis : « comment disparaît le fond de mention une
fois lu ? ». Maquette : `commentaire/module-comment/maquette-bandeau.html` (non versionnée).

**La cause** est dans la mise en page : le retrait d'une réponse est une marge INTÉRIEURE de sa
ligne (`padding-inline`). Tout fond posé sur la ligne part donc du bord du fil, quel que soit le
niveau, et repeint les traits des niveaux au-dessus. Mesuré : le fond commençait **33 px avant le
trait de la racine** au niveau 1, **101 px** au niveau 3 (27 et 59 au téléphone). Et le non-lu
(fond à 6 %) et la mention (10 %) portaient le même liseré : un seul signe pour deux sens.

**Arbitrages de l'user** :

| Règle | Où | Pourquoi |
|---|---|---|
| Le fond d'état est une MARQUE (`.comment-mark`) posée derrière le contenu, qui part de la colonne du message : `--comment-pad + profondeur × --comment-indent − --comment-mark-lead` (0,5 rem au large, 0 au téléphone) | `styles.css`, `CommentRow` | mesuré au navigateur : **+9 px** après le trait du parent au large, **+1 px** au téléphone — il le longe sans le couvrir |
| Plus de liseré | `CommentRow` | dans un arbre, il imitait un trait (2 px, vertical) ; au téléphone, il ferait une double ligne avec celui du parent |
| Le `@moi` en pastille, teintée de la couleur du lien | `markSelfMentions`, `styles.css` | c'est lui qui dit « pour toi », dans le texte même ; il RESTE après lecture |
| Fond de mention **tant qu'elle n'est pas vue** (`[data-mentioned][data-unread]`) | `styles.css` | le statut existait déjà : `views.<moi>`, écrit à l'ouverture du fil — il n'était pas consulté |
| Le non-lu se lit à l'heure : un point et « nouveau », **sans fond** ; sur une ligne groupée, un point dans la gouttière | `CommentRow`, `styles.css` | le fond est réservé à la mention ; c'est ce qui lève la confusion |
| Survol, échec et surbrillance après un saut passent par la même marque | `styles.css` | le survol repeignait lui aussi l'arbre ; il reste limité aux appareils qui survolent (`@media (hover: hover)`, comme `hover:` de Tailwind v4) |
| Une mention DÉJÀ LUE ne retient plus une branche ouverte (`shouldStayExpanded`) | `flattenThread` | elle cesse d'être une nouvelle, exactement comme son fond disparaît ; non vue, elle est non lue et la règle la couvre |

**La place qui manque** (demande explicite de l'user : nom très long, fil étroit). Ordre de
sacrifice : sous les seuils, le MOT « nouveau » s'efface — il reste dans le DOM, lu par les
lecteurs d'écran — ; au-dessus, un nom très long se tronque et le mot reste (`title` porte le nom
entier). (Précisé le 29/09 : la revue a noté que « le mot d'abord, puis le nom » n'est vrai que
sous les seuils.) Le point et l'heure ne cèdent
jamais. L'en-tête est un conteneur (`container: entete`) avec deux seuils, parce qu'une heure qui
porte son jour (« aujourd'hui à 14:41 », `[data-day-shift]`, lu par `:has()`) prend quatre fois
la place de « 14:41 » : **17 rem** avec une heure longue, **12 rem** sinon — de quoi garder ~90 px
au nom. Vérifié au navigateur : 208 px d'en-tête avec une heure courte, le mot reste ; avec une
heure longue, il s'efface ; à 168 px, il s'efface aussi ; jamais de débord.

**Quatre pièges, à ne pas rejouer** :

1. **`sanitizeProse` retire tout `data-*`** (`ALLOW_DATA_ATTR: false`) : une marque posée par le
   parseur disparaît en silence. `markSelfMentions` l'ajoute APRÈS l'assainissement — un attribut
   fixe, sur une balise d'ouverture reconnue à l'identique (`<a href="…">`, lien normalisé par
   `normalizeLink`) ; rien de ce qu'écrit l'auteur ne peut s'y glisser (testé).
2. **Le marquage « lu » devançait le chargement** : appelé par le panneau à l'ouverture, il
   partait avant la lecture des messages, et le serveur les renvoyait déjà lus — le fond de
   mention et le point n'apparaissaient JAMAIS au premier passage. Désormais `CommentThread`
   l'appelle une fois les messages frais (`isSuccess && !isFetching`), d'après l'arbre AFFICHÉ.
   Le compteur du panneau est écarté : il voit un message arrivé depuis, qu'on aurait marqué lu
   sans qu'il soit vu — une mention perdue.
3. **Le marquage vivait dans le panneau seul** : sous une actualité, rien n'écrivait
   `views.<moi>`, et le non-lu comme le fond de mention y seraient restés pour toujours. Il vit
   dans le fil, donc partout où un fil s'affiche.
4. **Relire le fil après le marquage effacerait les repères sous les yeux** : il est déclaré
   périmé sans relecture (`refetchType: "none"`). Cela ne suffisait pas (revue du 29/09) : une
   relecture survient aussi PENDANT la visite (réponse postée, retour sur l'onglet, temps réel) ;
   les repères disparaissaient alors, et le repli d'office, recalculé, refermait la branche qu'on
   lisait — jusque sur la réponse qu'on venait d'écrire. Corrigé le 02/10 : `CommentThread` FIGE
   pour la visite les non-lus de chaque lecture (`withUnread`, `unreadIds`) ; repères, fond de
   mention et repli d'office lisent cet arbre-là, et ne s'éteignent qu'à la visite suivante.
   Répondre déplie en outre toute la lignée du message (`ancestorsOf`). L'invalidation part même si
   le fil s'est fermé avant la réponse du serveur : il se démonte à chaque changement de fil, et la
   pastille du panneau resterait sinon allumée.
5. **Un message arrivé pendant la visite est marqué à son tour** : `useMarkThreadSeen` retient les
   IDENTIFIANTS déjà marqués, et non plus le fil entier — un message neuf relance le marquage, les mêmes
   jamais (A10, revue du 29/09).

**Limite assumée** : un fil dont les SEULS non-lus sont des réponses orphelines (parent supprimé,
§7) n'est plus marqué — l'arbre ne les montre pas. Sa pastille reste allumée ; la vraie correction
est de ne pas compter les orphelins côté serveur (au BACKLOG).

**Vérification** : 27 tests ajoutés (486 dans le module), et chaque règle a sa contre-épreuve
(7/7 : la réintroduire fait échouer son test). Au navigateur, CONNECTÉ en Raya, sur une branche
de vérification semée puis supprimée : `verif-bandeau-connecte.mjs` **21/21** — fond de mention
ancré (+9 px, +1 px au téléphone), rien sur la ligne, pastille, point sur un non-lu sans fond, nom
long, les deux seuils, puis RETOUR dans l'application et par rechargement : plus de fond, plus de
point, la pastille reste. ⚠️ Une session ouverte sur le même fil marque lus les messages dès
qu'elle les affiche : vérifier sur un fil que personne n'a ouvert.

### 10.13 Corrections du fil et du panneau (02/10, revue du 29/09)

| Défaut | Correction | Preuve |
|---|---|---|
| Un envoi refusé effaçait le texte tapé | l'ajout reste annulé, mais le **brouillon** — texte, mentions, « réponse à » — revient dans le composer, avec un toast qui le dit | `useCommentMutations.test.tsx`, `CommentThread.test.tsx` |
| Une relecture en échec remplaçait des messages pourtant en cache par un écran d'erreur | les messages restent, avec un avertissement discret et « Réessayer » ; l'écran d'erreur seulement sans données | `CommentThread.test.tsx` |
| Le signalement se fermait — et se vidait — avant la réponse du serveur | fermé au succès seulement ; en cas d'échec, il reste ouvert et rempli | `ReportCommentDialog.test.tsx`, `CommentThread.test.tsx` |
| Supprimer un parent décomptait toute sa branche, le serveur une unité | `−1`, comme `Comment::delete` (pas de cascade : les réponses, orphelines, restent comptées) — plus de saut au rechargement | `useCommentMutations.test.tsx` |
| Éditer un message en perdait les mentions | le composer d'édition repart des mentions du message ; seules celles encore présentes partent, normalisées par le SDK (§14.4) | `CommentComposer.test.tsx`, `useCommentMutations.test.tsx`, sonde d'édition |
| Le surlignage de recherche se décalait après un émoji | carte de positions en unités UTF-16, comme `indexOf` | `searchDiscussions.test.ts` |
| Refus du serveur et dates du panneau en dur, en français | refus codés (`login`, `hidden`…) traduits à l'écran ; dates dans la langue de l'interface | `discussions.test.ts`, `DiscussionPanel.test.tsx`, `CarrierRail.test.tsx` |
| Un refus était redemandé à chaque intervalle de sondage | aucun sondage sur un refus ; une connexion change la clé et relance d'elle-même | `useDiscussionsQuery.test.ts` |
| Le fil d'une question montrait les messages de toutes les questions | lecture par `path` (§14.2) | `useCommentsQuery.test.tsx`, sonde du lot R |
| Le fil RACINE d'un élément mêlait à ses messages ceux de ses autres fils | il ne garde que les messages sans `path` | `useCommentsQuery.test.tsx` |
| Le panneau partait dans le bundle initial de tous les sites | route et sélecteur d'émojis en `lazy` de `vite-preload` | — |
| L'ouverture d'un fil sensible — actualité, discussion de formulaire — ne suivait pas toujours la décision du serveur | monté sur l'**accord** du mode `fil` seulement ; refusé → message neutre, anonyme → invitation à se connecter pour lire, panne → message et « Réessayer ». Un fil que le serveur vient de lister pour un connecté se monte sans attendre ; un accord déjà reçu tient face à une panne passagère | `DiscussionPanel.test.tsx` |
| Une édition retypait en citoyen la mention d'une organisation, et ignorait les mentions stockées en objet | type stocké conservé ; mentions lues aussi depuis un objet (liste PHP à trous) | `commentTree.test.ts`, `useCommentMutations.test.tsx` |
| Un anonyme lisait deux fois l'invitation sur un fil vide ; un fil fermé l'invitait quand même | une seule invitation, sous le fil, et seulement si le fil est ouvert | `CommentThread.test.tsx` |

### 10.14 Trois corrections du panneau général (09/10, relecture de l'espace d'un commun)

La relecture de l'espace d'un commun (§15) a montré trois défauts qui touchaient aussi le panneau
général, déjà commité :

| Défaut | Correction | Preuve |
|---|---|---|
| **Un refus n'était jamais lu comme tel.** La façade du SDK ne rend pas le corps `{result:false}`, elle lève (§14.7) ; et sans session elle refuse avant tout appel — le code `login` du serveur n'arrivait donc jamais. À un visiteur, le panneau disait « n'ont pas pu être chargées » au lieu de l'inviter à se connecter, après deux nouvelles tentatives, puis recommençait toutes les 30 s | `rawOrRefusal` (`lib/discussions.ts`) reprend le corps du refus dans l'exception et le rend à `parseDiscussions` ; l'absence de session devient un refus `login`. Une panne reste une panne | `discussions.test.ts`, `useDiscussionsQuery.test.ts` (doublures qui **lèvent** les classes d'erreur du SDK), appel réel au SDK, navigateur (§15.6) |
| **Deux requêtes par montage pour un connecté.** `useHydratedUserContextId` rend `null` au premier rendu de chaque montage : la requête partait sous une clé sans utilisateur, puis sous la bonne | la requête attend le rendu où l'on sait qui lit (`useHydrated`) ; ce rendu d'attente compte comme un chargement | `useDiscussionsQuery.test.ts` |
| **Bande 48–64 rem, et rail plié à la main** : la règle qui pose en coin la pastille de non-lus du rail plié atteignait aussi celle des rangées de la colonne des fils : sortie du flux, elle se posait en coin de rangée, sur la fin d'un titre qui court jusqu'au bord | la règle est bornée à la colonne des porteurs (`[data-panel-column="carriers"]`) | mesure au navigateur, avec contre-épreuve (§15.6) |

La clé d'un fil (`type:id`, plus `:path`) n'a plus qu'une écriture, `threadValue` (`lib/filKey.ts`) :
celle de l'adresse, du cache et du repli de `readThread`.

### 10.15 « Contextes », et un « + » qui se voit (13/10)

Deux retouches demandées à l'écran, sans effet sur les données ni sur les clés :

- **La première colonne du panneau général s'intitule « Contextes »** (« Contexts » en anglais), et
  non plus « Espaces ». Tous les libellés qui nomment la même chose ont suivi — « Sans contexte »,
  « Choisissez un contexte », « Retour aux contextes », « Rechercher un contexte ou une
  discussion », le décompte de la recherche… — pour qu'un titre et son bouton de retour ne se
  contredisent pas. Les **clés** n'ont pas bougé (`panel.holders`, `panel.noCarrier`…), le code dit
  toujours `carrier` / porteur, et les sections datées plus haut citent les libellés tels qu'ils
  étaient. « Espace de discussion » reste le nom de l'espace d'un **commun** (§15) : ce n'est pas
  la même chose, et son message « Cet espace de discussion est introuvable. » n'a pas changé.
- **Le « + » de l'espace d'un commun (« Nouvelle discussion ») est en couleur primaire.** Formulaire
  ouvert, il passe en `secondary` : il n'est plus alors que ce qui referme le formulaire, et
  l'action à faire est « Créer » — une seule action primaire à l'écran. Tenu par
  `SpacePanel.test.tsx`.

## 11. Non-lus et temps réel

Le panneau compte les non-lus depuis le J9 : l'agrégation rend `unread` par fil et par porteur,
calculé pour la **session courante**. Restaient trois choses — les éteindre quand on lit, les
rafraîchir sans attendre, et se comporter correctement quand le flux n'existe pas.

### 11.1 Le temps réel de cette application n'est pas du WebSocket

Distinction à faire d'emblée, car les deux mécanismes coexistent dans le dépôt legacy :

| | Legacy PHP | React (ici) |
|---|---|---|
| Transport | socket.io (`io(coWsConfig.serverUrl)`) | **SSE**, flux HTTP unidirectionnel |
| Émission | le client émet (`discussionSocket.emitEvent(…, "change_n", …)`) | le client n'émet **rien** |
| Charge utile | l'événement porte la donnée | le hub ne transporte **qu'un nom de sujet** |

Le choix du SSE n'est pas récent et ne vient pas de ce chantier : `useRealtimeTopics` ouvre le flux
par `fetch` en streaming — et non par `EventSource`, qui ne sait pas porter d'en-tête
`Authorization`. Le flux passe par un relais SSR (`server/api/realtime.js`) qui prend un ticket à
usage unique auprès de l'émetteur et ne le laisse jamais descendre jusqu'au navigateur.

La conséquence qui compte pour ce module : **le hub ne dit jamais ce qui a changé, seulement que
quelque chose a changé**. On invalide donc un cache, on n'écrit jamais dedans. C'est ce qui rend le
dispositif générique — le transport ne connaît aucun module.

### 11.2 Un seul flux par onglet, quel que soit le nombre de modules

`useRealtimeTopics` ouvre une connexion **par appel**. Tant que la cloche de notifications était
seule à s'en servir, c'était sans conséquence. Le panneau en faisait un deuxième consommateur : un
onglet aurait tenu deux flux, soit **quatre connexions** en comptant le saut relais → hub.

Trois pièces ont été ajoutées pour que ce coût ne croisse plus avec le nombre de modules :

| Pièce | Rôle |
|---|---|
| `src/lib/realtimeBus.ts` | le bus : abonnements par sujet, compteur d'abonnés, état partagé |
| `src/components/layout/RealtimeBridge.tsx` | monté une fois dans `RootLayout`, tient l'**unique** connexion |
| `src/hooks/useRealtimeSubscription.ts` | l'API des modules : `useRealtimeTopic`, `useRealtimeResync`, `useRealtimeEtat` |

Un module n'appelle donc **plus jamais** `useRealtimeTopics` : il s'abonne. La cloche a été migrée
en même temps, ce qui fait du bus le seul chemin.

**L'invariant qui évite une régression : zéro abonné, zéro connexion.** Le pont n'ouvre le flux que
s'il reste au moins un abonné. Sans cette règle, le monter à la racine ouvrirait une connexion
permanente sur tous les sites, y compris ceux qui n'ont ni cloche ni panneau — soit exactement ce
que le multiplexage prétend économiser. C'est aussi pourquoi les rappels passent par une ref : un
rappel recréé à chaque rendu ferait tomber le compteur à zéro puis le remonterait, faisant battre
la connexion au rythme des rendus.

Le pont est un **frère qui ne rend rien**, pas un fournisseur englobant : un contexte re-rendrait
tout l'arbre à chaque changement d'état du flux. L'état vit dans le bus, et seuls ceux qui
l'observent se re-rendent.

Mesuré par `src/hooks/__tests__/useRealtimeSubscription.test.tsx`, qui compte les `fetch` : aucune
connexion sans abonné, **une** pour deux modules abonnés, fermeture au départ du dernier, et pas de
réouverture au re-rendu.

### 11.3 Marquage en lecture — `POST /co2/comment/seen`

Le legacy sait déjà marquer un fil comme lu, mais pour **un seul type** : le code vit dans
`costum/controllers/actions/project/ActionAction.php`, avec `contextType` écrit en dur, appelé
depuis le kanban de gestion. Même câblage projets → actions que le rail legacy.

`SeenAction` généralise, sans rien changer à la forme de l'écriture, qui était bonne :

```php
$where = [
    "contextType" => $type,               // index ctx_created : le $match sélectif d'abord
    "contextId"   => $id,
    "path"        => $path,               // `null` couvre l'absence ET la valeur nulle
    "views." . $userId => ['$exists' => false],   // chemin dynamique : jamais en tête
];
['$set' => ["views." . $userId => ["date" => new MongoDate(time())]]]
```

Trois propriétés à ne pas perdre en le relisant :

- **l'utilisateur n'est jamais un paramètre** — il vient de la session ;
- **`$exists: false` rend l'écriture proportionnelle au retard de lecture**, pas à la taille du
  fil : rouvrir un fil déjà lu n'écrit rien ;
- **le `path` absent vise le fil des messages sans chemin**, et non « tous les fils du contexte ».
  C'est le groupement exact de l'agrégation qui compte les non-lus (`$ifNull` sur `path`) ; marquer
  plus large éteindrait des pastilles jamais affichées.

Les refus sont ceux des actions voisines, en HTTP 200 : `{result:false, code, msg}`, `code` valant
`login` sans session et `bad-request` pour un contexte invalide. Un `path` posté sous une autre
forme qu'une chaîne (`path[]=…`) est un `bad-request` lui aussi : lu comme « pas de chemin », il
ferait marquer le fil des messages sans chemin à la place du fil visé. Un fil que le lecteur ne
peut pas lire (§9.7) n'est en revanche **pas** un refus — la réponse est celle d'un fil où il n'y a
rien à marquer, `{result:true, marked:0}`.

Côté client, `useMarkThreadSeen` n'appelle rien quand le fil ouvert n'a aucun non-lu — le cas le
plus fréquent — et n'invalide le panneau que si le serveur dit avoir marqué quelque chose. Un fil
déjà marqué pendant la visite ne l'est pas deux fois : sans cette retenue, le rafraîchissement qui
suit le marquage redéclencherait l'effet, en boucle.

**Corrigé le 28/09 (§10.12)** : le marquage était appelé par le PANNEAU, à l'ouverture, d'après son
compteur. Deux défauts, vus au navigateur : il partait avant le chargement des messages — le serveur
les marquait lus avant de les renvoyer, et aucun repère de non-lu n'apparaissait jamais ; et le
compteur du panneau voit un message arrivé depuis, que le fil n'a pas montré. C'est désormais
`CommentThread` qui l'appelle, où qu'il soit monté, **une fois les messages chargés** et d'après
les non-lus **affichés** ; le fil est ensuite déclaré périmé sans être relu.

Recette : `commentaire/module-comment/sonde-j11.ts`, **16 contrôles**, écriture réelle puis
restauration de la base à l'identique.

### 11.4 Mode dégradé — et pourquoi c'est le mode par défaut

`refetchInterval` suit l'état du flux : 5 min quand il est `connecte`, 30 s sinon. L'interrogation
périodique n'est jamais coupée, parce qu'un flux peut mourir sans qu'aucun des deux bouts s'en
aperçoive — **sauf après un refus** du serveur (pas connecté, pas le droit) : le redemander
toutes les 30 s ne changeait rien (`intervalleDeSondage`, 02/10).

L'état `degrade` mérite d'être compris : le flux est **ouvert**, les battements arrivent, mais le
bus ne porte plus rien côté serveur. Le client ne peut pas le déduire seul — c'est le hub qui le
dit. Sans cet état, on resterait sur l'intervalle long en se croyant en temps réel, donc **moins
réactif qu'avant de l'avoir branché**. Il est donc traité comme une absence de temps réel.

⚠️ **Sur un déploiement sans `REALTIME_HUB_URL`, le relais répond 503 `{realtime:false}` et le
client n'insiste pas** : la fonctionnalité est absente, pas en panne. C'est le cas de
l'environnement de développement actuel. Autrement dit, le mode dégradé n'est pas un cas limite à
aller chercher : c'est ce qu'on observe par défaut, et le panneau doit y être parfaitement
utilisable.

### 11.4 bis Une écriture périme le panneau elle-même, sans attendre le hub

Le fil et le panneau sont **deux caches distincts**. Poster, répondre ou supprimer n'invalidait
que le fil : les colonnes « espaces » et « fils » — qui portent un nombre de messages, un nombre
de non-lus et une date de dernière activité — ne l'apprenaient que du temps réel, ou à défaut du
rafraîchissement automatique. Soit **jusqu'à 30 secondes** en mode dégradé, qui est le mode de
tout déploiement sans hub, donc de tout le développement local. On voyait son propre message
apparaître dans le fil pendant que la colonne d'à côté continuait d'annoncer l'ancien compte.

`useCommentMutations` invalide désormais `DISCUSSIONS_PREFIX` sur les trois écritures qui changent
ces compteurs — ajout, réponse, suppression — et sur l'erreur « peut-être écrit » (au-delà de 500,
le serveur a pu écrire avant de tomber). L'édition et les réactions ne le font pas : elles ne
changent aucun compteur du panneau.

Ce n'est **pas** le couplage vers l'hôte que la règle du module interdit : `DISCUSSIONS` est une
clé de ce module. Le compteur de l'hôte, lui, passe toujours par `onCountChange`.

Et le coût est nul quand le panneau n'est pas monté — le cas le plus fréquent, le fil étant surtout
rendu dans une fiche : sans observateur, React Query marque la requête périmée sans la relancer.

⚠️ Cela ne remplace pas le temps réel, et ne prétend pas le faire : **l'écriture d'autrui** reste
invisible jusqu'au prochain rafraîchissement. Ce qui est corrigé, c'est la latence sur **sa
propre** écriture, qu'aucun aller-retour serveur ne justifiait.

### 11.5 Le point de passage à l'échelle — demande à l'équipe backend

Ce qui suit n'est **pas** réalisable depuis ce dépôt : le hub vit dans **`cocolight-backend`**
(`src/hub.ts`, et tout `src/realtime/`). C'est une demande, pas un constat de blocage côté React.

> **Corrigé le 28/09/2026.** Cette section désignait `cocolight` comme dépôt du hub. C'était faux :
> `modules/cocolight` est une application front Vite/PWA et ne contient aucun code de temps réel.
> Le hub est un **processus à part** de `cocolight-backend` — image Docker distincte
> (`Dockerfile.hub`), empaquetée en un seul fichier, qui n'embarque ni les 176 endpoints, ni la
> signature JWT, ni rien qui écrive. Le dépôt a été cloné localement le 28/09.

**Ce qu'on sait, désormais par lecture du code et non par déduction.** Le manifeste du hub
(`src/hub.ts:45-58`) ne contient qu'**une** règle : `R-NOTIFICATION`, sur `activityStreamReference`,
qui émet `notification.changed`. Le manifeste du backend complet (`src/realtime/index.ts`) en compte
trois au plus — les deux autres étant `integrite.fanout` (cascade) et `push.notification`, toutes
deux sur `activityStream*` et toutes deux à effet de bord.

**Aucune règle n'observe `comments`.** Le sujet `comment.changed` auquel le panneau s'abonne n'est
donc émis par personne, et ce n'est pas un oubli de configuration : c'est une règle à écrire. La
doc du hub (`docs/29-REALTIME-OPLOG.md` §6) demande explicitement que tout « topic de scope » passe
six questions avant d'être ajouté — l'audience en est une, et `comments` n'a pas de champ
destinataire dont la déduire, à la différence de `userId` sur une notification.

**Le risque, s'il émet un sujet global.** Un sujet sans porteur ne permet à aucun client de se
sentir non concerné : **une écriture réveille tous les clients abonnés**. Le coût croît alors avec
l'audience, pas avec l'activité — la seule courbe qui pose un problème durable. Ordre de grandeur,
avec l'endpoint mesuré à 9 ms : un message posté devant 1 000 panneaux ouverts déclenche 1 000
requêtes, soit environ 9 s de temps Mongo cumulé, en rafale.

**Ce qui est déjà amorti côté client**, et qui ne suffit pas :

| Amortisseur | Ce qu'il règle | Ce qu'il ne règle pas |
|---|---|---|
| Fenêtre de 5 s (`useDiscussionsRealtime`) | une rafale d'écritures → un seul rafraîchissement | rien, si l'écriture est unique |
| Garde de visibilité | les onglets en arrière-plan ne rafraîchissent pas | les onglets au premier plan |
| `refetchType: "active"` | les panneaux non montés ne font rien | les panneaux ouverts |

Aucun ne s'attaque au fan-out lui-même, et **aucun ne le peut** : le client ne peut pas filtrer sur
une information que le nom du sujet ne porte pas.

**Proposition, par ordre de préférence.**

1. **Sujet porté par le contexte** — le hub émet `comment.changed:<contextType>:<contextId>` plutôt
   que `comment.changed`. Les deux champs sont **déjà dans le document inséré** : aucune lecture
   supplémentaire n'est nécessaire pour les dériver. Le client s'abonne aux contextes qu'il affiche,
   et le filtrage est déjà fait par le bus (une entrée de `Map` par nom de sujet, gratuite). C'est la
   variante la moins intrusive : elle ne demande ni salle, ni destinataires, ni changement de
   protocole.
2. **Salle par utilisateur** — le hub route vers les seuls utilisateurs concernés, sur le modèle de
   ce qui existe pour les notifications. Le client n'aurait alors pas une ligne à changer. Réserve :
   cela suppose une liste de destinataires fiable, or `Notification.php` ne couvre pas 4 des 10
   types commentables (voir §8), donc cette liste serait incomplète là où elle manque déjà.
3. **Statu quo assumé** — si le hub ne peut émettre qu'un sujet global, le code livré fonctionne
   tel quel : il s'abonne à `comment.changed`, les amortisseurs jouent, et le poll reste le filet.
   Il faudrait alors documenter un plafond d'audience au-delà duquel le temps réel du panneau est
   désactivé par configuration.

**Question préalable, avant tout choix** : le hub observe-t-il seulement la collection `comments` ?
Si non, les trois options supposent d'abord de l'ajouter à son capteur.

Le nom `comment.changed` retenu côté client est une **attente**, pas un fait. S'abonner à un sujet
que personne n'émet ne coûte rien, et le jour où le hub l'émettra le panneau deviendra réactif sans
qu'une ligne change ici. C'est délibéré : aucune des deux issues ne laisse le module cassé.

### 11.6 Dépendance SDK

Le SDK n'est pas commité (voir la convention du dépôt) ; l'endpoint est implémenté localement et
sa spécification est reproduite ici pour reprise officielle.

| | |
|---|---|
| Constante | `MARK_COMMENTS_SEEN` (le générateur en dérive `endpointApi.markCommentsSeen()` ; la méthode de façade `Api.markCommentsSeen()` est écrite à la main, §2) |
| Route | `POST /co2/comment/seen`, `application/x-www-form-urlencoded` |
| Auth | `bearer` |
| Requête | `contextType` (enum, requis) · `contextId` (`^[a-f0-9]{24}$`, requis) · `path` (optionnel) |
| | `additionalProperties: false`, **aucun `default`** |
| Réponse 200 | `oneOf` — refus `{result:false, msg}` · succès `{result:true, marked:int}` |

⚠️ **Aucun `default` sur aucun champ** : AJV tourne avec `useDefaults: true` côté client, un défaut
déclaré serait **injecté** dans la requête. C'est le piège relevé au J0 avec `default:"news"`, et il
vaut ici pour `path` — un défaut y élargirait silencieusement le marquage.

## 12. Accessibilité — le parcours au clavier

Le grief n'était pas l'absence d'attributs ARIA : ils étaient posés dès le J3. C'était le **coût
de traversée**. Mesuré au navigateur sur un fil réel, avant correction : **44 éléments** du fil
portaient un `tabindex`, et tous étaient atteignables. Atteindre le champ de saisie depuis le haut
d'un fil demandait donc de traverser la barre d'actions de chaque message — réagir, répondre, menu —
soit une quarantaine de pressions de tabulation pour écrire une phrase.

### 12.1 Roving tabindex à deux niveaux

Un seul message est dans l'ordre de tabulation à la fois, et **ses contrôles avec lui** :

| Niveau | Ce qui bouge | Comment |
|---|---|---|
| 1 — entre messages | le privilège de tabulation | `↑` `↓` `Début` `Fin` sur le conteneur `role="log"` |
| 2 — dans un message | les contrôles de la ligne active | `Tab`, une fois le message atteint |

Mesuré après correction, même fil : **6 arrêts sur 14 éléments pilotés**, tous à l'intérieur de la
ligne active. La règle ne dépend d'aucune constante écrite à la main — le nombre de contrôles d'un
message varie (pastilles, repli, citation), et c'est le rapport arrêts / éléments pilotés qui est
vérifié.

Trois décisions méritent d'être dites, parce qu'elles ne se devinent pas à la lecture :

**Le message actif est DÉRIVÉ, jamais corrigé après coup.** L'état ne retient qu'une *intention* ;
si le message visé n'est plus affiché — suppression, branche repliée, relecture du fil — le premier
message reprend le privilège **au rendu**. Poser cette correction dans un effet rouvrirait le défaut
du J7 : un état recalculé après coup, qui efface ce que l'utilisateur vient de faire. C'est aussi ce
qui garantit qu'un fil n'est jamais sans porte d'entrée au clavier.

**Les flèches n'agissent que depuis un message lui-même.** Le gestionnaire est posé sur le
conteneur, où tous les événements remontent ; il se désamorce si la cible n'est pas une ligne. Sans
ce garde, la flèche haut deviendrait inutilisable **dans le champ d'édition** d'un message.

**Rien n'est retiré du DOM.** Les contrôles des messages inactifs passent à `tabindex="-1"`, pas à
`hidden` ni à `inert` : ils restent lisibles par un lecteur d'écran en mode navigation, et
redeviennent tabulables dès que leur message devient actif.

### 12.2 La barre d'actions est masquée par l'opacité, jamais par `display`

Un `display:none` la sortirait de l'ordre de tabulation, donc de la portée du clavier. À la souris,
elle est donc à `opacity: 0`, et remonte à `1` au survol **comme au `focus-within`**. C'est une
règle CSS : aucun test jsdom ne la calcule, seule la vérification navigateur la prouve
(`opacity=1` mesuré sur la ligne qui a le focus).

**Au doigt** (`(hover: none), (pointer: coarse)`), elle ne flotte plus : la même boîte entre dans
la ligne de service du message, visible en permanence, « Répondre » écrit (§10.11). Elle était
jusqu'au 28/09 affichée en permanence *en flottant*, une par message, par-dessus le texte.

### 12.3 Les suggestions de mention s'annoncent — sans rôle hors spécification

Taper `@` ouvrait une liste qu'un lecteur d'écran ne mentionnait jamais, et les flèches y
déplaçaient une surbrillance annoncée nulle part.

> Depuis le 13/10 le champ n'est plus un `<textarea>` mais un éditeur (§18.5) : son rôle `textbox`
> est posé explicitement, les attributs décrits ici sont les mêmes.

**Première tentative, écartée en revue** : poser `role="combobox"` sur le `<textarea>`, comme le
fait [`coform/TagsField`](../src/modules/coform/components/TagsField.tsx). Mais là-bas c'est un
`<input>` : *ARIA in HTML* n'autorise **aucun rôle de remplacement** sur un `<textarea>`, et le
champ cessait d'être annoncé comme zone multiligne. La règle axe correspondante est
`aria-allowed-role`.

**Ce qui est livré** : le rôle implicite `textbox` est conservé, avec les seuls attributs que
`textbox` admet — `aria-autocomplete="list"`, `aria-haspopup="listbox"`, `aria-controls` et
`aria-activedescendant`. Ce que `aria-expanded` aurait dit (interdit sur `textbox`) est porté par
une **région d'état polie** : « 12 personnes proposées », lue à l'ouverture puis silencieuse.

**L'option est le `<li>` lui-même**, pas un `<button role="option">` à l'intérieur. Le bouton
sortait l'option de la liste qui la possède, et surtout la plaçait dans l'ordre de tabulation —
une option ne se tabule pas, elle se désigne pendant que le focus reste dans le champ.

**L'indice surligné est borné au rendu.** `candidates` peut rétrécir **sans qu'on ait tapé** :
`useSearchUsers` refait sa requête au retour sur l'onglet. Un indice resté à 5 sur une liste de 2
pointerait un `aria-activedescendant` inexistant, et Entrée enverrait le message avec le `@jo`
brut au lieu de choisir une mention. Et la touche n'est **confisquée que si l'on va réellement
choisir** : sans `slug`, `pickMention` sort sans rien faire, ce qui donnait une Entrée morte et
un Tab qui n'échappait plus au champ.

⚠️ La recherche n'interroge le serveur **qu'à partir de deux caractères**, et seulement parmi les
membres du porteur (`useSearchUsers`, `searchMode: "personOnly"`). Une amorce d'un seul caractère
ne déclenche rien : ce n'est pas une panne.

### 12.4 Le focus ne se perd pas en changeant de colonne

Sur mobile, le panneau ne montre qu'une colonne : en changer **démonte** celle d'où l'on vient, le
focus retombe sur `<body>`, et la tabulation suivante repart du haut du document. Le titre de la
colonne qui arrive le reçoit donc (`tabindex="-1"`, avec anneau — un point d'arrivée invisible
laisserait l'utilisateur sans repère). Un garde sur l'étape précédente est indispensable : sans lui,
l'effet volerait le focus au premier rendu de la page.

### 12.5 Le focus ne tombe jamais sur `<body>`

Quatre chemins le perdaient, tous sur la ligne qu'on venait de manipuler. Ils partagent une cause :
**un élément focalisé disparaît, et personne ne dit où aller ensuite** — la tabulation suivante
repart alors du haut du document, et le privilège de roving saute au premier message du fil.

| Chemin | Ce qui se passait | Ce qui est fait |
|---|---|---|
| « Modifier » | le champ s'ouvrait **sans curseur** | voir ci-dessous |
| Échap / « Enregistrer » dans l'édition | champ démonté sous le focus → `<body>` | la ligne le reprend |
| « Supprimer » | `AlertDialog` monté **sans déclencheur** : Radix rend le focus à un nœud déjà détaché — un no-op | le message **voisin** le reprend, calculé avant la suppression |
| « Répondre » | ni focus ni annonce ; la cible du champ changeait en silence | le curseur va dans le champ, et le bandeau est une région d'état |

**Le cas « Modifier » mérite son paragraphe**, parce que la solution évidente ne marche pas. Le
champ est monté puis focalisé par son effet — mais le menu joue encore son animation de sortie, et
son `FocusScope` est **toujours piégé** : il ramène à lui tout focus posé au-dehors, puis disparaît
en laissant `<body>`. Mesuré au navigateur : focus sur un `div` du menu à +100 ms, sur `<body>`
ensuite. Le seul point d'accroche correct est donc `onCloseAutoFocus`, qui ne se déclenche qu'une
fois le menu réellement parti — on y refuse la restitution vers le déclencheur *et* on désigne le
champ. `composeEventHandlers` de Radix saute son propre gestionnaire dès que le nôtre a appelé
`preventDefault()`.

**Hors accessibilité, la même revue a trouvé un défaut de données** : `replyingTo` survivait au
changement de fil. En desktop les trois colonnes restent montées, si bien que « Répondre à M »
dans le fil A tenait encore au passage au fil B — et l'envoi partait avec le `parentId` du fil A
sur la cible du fil B. Le fil est désormais remonté à chaque cible (`key`), ce qui réinitialise du
même coup l'édition en cours et le repli.

### 12.6 Anneaux de focus

Les boutons du dépôt (`@/components/ui/button`) portent leur anneau ; les boutons **bruts** du module
— pastilles, sélecteur de réaction, citation de contexte, repli — n'en avaient pas, et s'en
remettaient à l'anneau par défaut du navigateur, qui varie d'un moteur à l'autre et se perd sur un
fond `bg-muted`. Ils reprennent l'anneau des listes du panneau. La ligne de message, elle, prend un
anneau **interne** (`ring-inset`) : pleine largeur, un anneau externe déborderait sous la ligne
voisine.

### 12.7 Ce qui n'est pas fait

| Point | État | Pourquoi |
|---|---|---|
| Roving dans les colonnes 1 et 2 du panneau | non fait | listes courtes et bornées par le serveur ; le coût de traversée n'y a pas été mesuré comme un problème |
| Lien d'évitement vers le fil | non fait | la page `/discussions` n'a qu'un `<h1>` en `sr-only` ; à reconsidérer si le panneau gagne une barre d'outils |
| Annonce du nombre d'arrivées | partiel | `role="log"` annonce les messages qui arrivent, sans totaliser |

### 12.8 Preuves

| Quoi | Preuve |
|---|---|
| Règle de navigation | `CommentThread.test.tsx` — **7 tests**, dont le COMPTE d'arrêts de tabulation |
| Câblage ARIA du champ | `CommentComposer.test.tsx` — la liste fermée ne pointe aucun `aria-activedescendant` ; depuis le 13/10 le champ est un éditeur, dont le rôle `textbox` est posé explicitement (§18.5) |
| Comportement réel | `commentaire/module-comment/verif-j12.mjs` — **21 contrôles**, session connectée ; opacité, anneau et déplacements de focus lus dans le style **calculé** et l'`activeElement` réels |

Chaque contrôle de la sonde est **positif** : il exige d'abord de trouver de quoi mesurer (un rail
qui liste des porteurs, un fil d'au moins deux messages, une barre d'actions non vide). Un fil vide
ou une session perdue font échouer la sonde au lieu de la satisfaire — leçon du J11, où des ensembles
vides avaient tout rendu vert sans rien mesurer.

### 12.9 Corrections du 02/10 (revue du 29/09)

| Défaut | Correction | Preuve |
|---|---|---|
| Une ligne de message était nommée par un `aria-label` (« Message de X, quand ») qui **remplaçait** son contenu : le lecteur d'écran ne lisait jamais le texte | `aria-labelledby` = cette phrase, invisible, **puis** le texte | `CommentRow.test.tsx` |
| Flèches, Début, Fin posaient le focus **sans défiler** | `scrollIntoView({ block: "nearest" })` ; le saut vers un message cité le centre, animé sauf `prefers-reduced-motion` | `CommentThread.test.tsx` |
| La barre de mise en forme n'appliquait qu'au `mouseDown` : morte au clavier, libellés anglais, exemples insérés en français | `onClick` applique (Entrée, Espace), `onMouseDown` ne fait que garder le focus ; libellés traduits (`composer.marks.*`) — les exemples insérés ont disparu avec l'éditeur du 13/10, où une marque s'active sans rien insérer (§18) | `CommentComposer.test.tsx` |
| Les non-lus du rail n'étaient pas annoncés, et « 1 non lus » | dans le nom accessible de la rangée, en phrase entière par langue (`panel.carrierUnread`) ; pluriel i18next ; pastille d'un fil lue à la voix, chiffre caché | `CarrierRail.test.tsx` |
| La modale n'avait pas de description | `DialogDescription` invisible | `DiscussionModal.test.tsx` |
| Un visiteur anonyme lisait le fil sans rien qui l'invite à répondre | `LoginToParticipate` à la place du composer | `CommentThread.test.tsx` |

## 13. Dépendances SDK

Le SDK n'est **jamais commité** : le livrable est cette spec, à porter par l'équipe qui tient
`cocolight-api-client`. Les modifications ci-dessous sont implémentées **en local** et vérifiées.

### 13.1 Rappel des déverrouillages du chantier 1

Enums `type` de `GET_COMMENTS` et `contextType` d'`ADD_COMMENTS` élargis aux dix types
commentables, **et les deux `"default": "news"` supprimés** — AJV tourne avec `useDefaults`,
si bien qu'un appel sans `contextType` écrirait silencieusement sur `news`. Plus
`BaseEntity.getComments()`, `comment()` remonté sur `BaseEntity`, et `Comment` rendu à `poi`.

### 13.2 Images dans un commentaire — le verrou était ENTIÈREMENT côté client (24/09)

Le blocage B1 tenait à deux affirmations du SDK, **toutes deux fausses** :

1. `BaseEntity.uploadDocument` et `getGalleryFiles` excluaient `comments` par
   `_assertNotEntityType`, au motif écrit en commentaire que « badges/comments/actions n'ont
   pas de galerie » ;
2. l'enum `folder` de l'upload générique (`/co2/document/upload-save/…/input/qqfile/…`) et
   l'enum `type` de la galerie (`/co2/gallery/index/…`) ne contenaient pas `comments`.

**Mesuré, contre la base et le code backend :**

| Constat | Preuve |
|---|---|
| Le backend stocke déjà des documents de commentaire | **14 documents `type: "comments"`** en base, sous `folder: "comments/<idCommentaire>/album"`, `contentKey: "slider"`, `doctype: "image"` |
| Ils viennent du legacy, par collage | leur `name` est `pastedimage.jpeg` |
| Le backend n'a aucune liste blanche | `UploadSaveAction::run` reprend `$folder` **tel quel** comme `type` et compose `$folder . "/" . $ownerId` |
| La lecture est type-agnostique | `gallery/IndexAction` l'est déjà, et la description de l'endpoint le dit |

**Modifications à porter** : retirer `comments` des deux `_assertNotEntityType`, et l'ajouter
à l'enum `folder` de l'upload générique ainsi qu'à l'enum `type` de la galerie. Puis
regénérer dans l'ordre `generate:module:publish` → `generate:methodeapi` → `typecheck` →
`lint` → `build:esm:rollup` → `build:types`.

**Vérifié** : `comment.getGalleryFiles()` répond désormais sans lever, sur une entité
construite depuis un simple identifiant. Les gates du SDK et de `site-json` restent verts.

⚠️ **L'upload ne se vérifie qu'au navigateur.** En Node, `_validateUploadInput` échoue avec
`TypeError: ke is not a function` — mais **le même appel sur `organizations`, autorisé de
longue date, échoue exactement pareil** : c'est le bundle ESM/Vite qui ne porte pas
`file-type`, pas le déverrouillage. Le chemin nominal est un `File` de navigateur.

⚠️ **Correction du 24/09, après lecture du code de déplacement.** Cette section affirmait
d'abord qu'une image ne pouvait être attachée qu'APRÈS la création du message, le dossier de
destination portant l'identifiant de celui-ci. C'est **faux**, et l'ordre réel est l'inverse :
`Comment::insert` appelle `updateDocumentsData`, qui appelle `Document::moveDoc` — et `moveDoc`
**déplace le fichier sur le disque** (`fs->copy` puis `fs->delete`, vignette et format moyen
compris) **et** met à jour `folder` et `id` sur l'enregistrement. Le document peut donc être
téléversé n'importe où d'abord. L'ordre retenu est celui du §13.3.

### 13.3 Le backend portait DÉJÀ tout le nécessaire (24/09)

Arbitrage rendu : **le patron `news`**, c'est-à-dire la dénormalisation — le message porte les
identifiants de ses documents, et le backend les hydrate à la lecture. C'est le choix le plus
propre, et il s'avère être celui que le backend implémente **déjà**.

| Ce que fait `Comment.php`, aujourd'hui, sans rien changer | Ligne |
|---|---|
| Accepte un message SANS texte s'il porte des images | `insert`, garde sur `mediaImg` |
| Enregistre `mediaImg` tel quel sur le message | `insert` |
| Rattache les documents au message après insertion | `updateDocumentsData({docIds, commentId})` |
| **Hydrate** `images` en `{id, imagePath, imageThumbPath, name}` à la lecture | `convertParamsForComments` |
| Annonce « N image(s) attachée(s) » dans la notification | `insert` |

C'est exactement la forme que `news` expose (`mediaImg: {countImages, images[]}`) et que le
front sait déjà rendre (`useFormatNews`, `NewsImageGrid`). Les documents disparus décrémentent
`countImages` au passage.

⚠️ **L'hydratation n'est PAS plafonnée**, contrairement à ce que le code laisse croire (revue du
29/09) : la boucle de `convertParamsForComments` déclare `$limit = 5` sans jamais incrémenter son
compteur, et sa branche `else` fait `exit;` — « corriger » le compteur tuerait la requête. Le
plafond de 5 images tient au seul **schéma d'écriture** (`mediaImg.images`, cinq au plus).

**Le seul verrou restant était donc le schéma de requête du SDK** : `/co2/comment/save` est en
`additionalProperties: false` et n'exposait pas `mediaImg` — le même mécanisme qui bloque
`markdownActive` (B2). Il est désormais déclaré, avec `images` en tableau d'identifiants
`^[a-f0-9]{24}$` plafonné à 5, et `countImages` en entier **ou** chaîne (le legacy écrit une
chaîne).

**Ordre d'écriture**, qui découle du dossier `comments/<idMessage>/album` :

1. téléverser les images par `uploadDocument` sur le dossier `comments` ;
2. poster le message avec `mediaImg.images = [<docIds>]` ;
3. `Comment::insert` rattache les documents au message qu'il vient de créer.

⚠️ Le point 1 précède le point 2, alors que le dossier nomme le message : **les documents sont
donc d'abord orphelins**, et c'est `updateDocumentsData` qui les rattache. Un message jamais
envoyé laisse des documents orphelins — le legacy en a laissé, la base en porte.

### 13.4 L'interface, et le piège de l'édition (24/09)

**Livré.** Bouton d'image, collage et glisser-déposer dans le composer ; aperçus avec retrait
avant envoi ; rendu dans le fil avec visionneuse ; envoi d'un message qui ne porte QUE des
images (`Comment::insert` l'accepte explicitement).

**Où vit quoi**, et pourquoi c'est découpé ainsi :

| Pièce | Rôle |
|---|---|
| `lib/commentImages.ts` | Les règles PURES : types admis, plafond, lecture de `mediaImg`, charge utile |
| `hooks/useCommentImages.ts` | Le téléversement et l'état des pièces jointes |
| `components/ComposerImages.tsx` | Les aperçus, purement présentationnels |
| `components/CommentImages.tsx` | Le rendu dans le fil et la visionneuse |
| `CommentComposer` | **Ne sait rien du téléversement** : il reçoit des aperçus et deux rappels |

Ce découpage répondait à une contrainte connue : le composer devait être remplacé par un vrai
éditeur. C'est fait (§18), et seule la dernière ligne du tableau a changé : la coquille du composer
garde les aperçus et les deux rappels, l'éditeur lui remet les images collées ou déposées.

**Le client est plus étroit que le serveur, et c'est lui qui refuse.** `BaseEntity._validateImage`
n'admet que `image/jpeg`, `image/jpg` et `image/png`, là où le backend accepte aussi gif et webp.
La saisie le dit donc à l'ajout plutôt que de laisser partir un envoi voué à l'échec. Élargir
`_validateImage` toucherait une primitive partagée par tout le SDK : hors de ce lot.

⚠️ **Le piège de l'édition — un effacement silencieux.** `Comment::update` porte une branche
`else { $unset["mediaImg"] = ""; }` : **toute mise à jour qui n'envoie pas `mediaImg` efface les
images du message**. Corriger une faute de frappe suffisait donc à les perdre. Trois pièces le
corrigent, et il faut les trois :

1. `UPDATE_COMMENTS.request.params.mediaImg` déclaré au schéma ;
2. `Comment._update` déplace `mediaImg` dans `params` — et surtout le **réduit à des
   identifiants** par `_mediaImgForWrite`. C'est indispensable : le brouillon porte la forme
   **hydratée** (des documents complets), et la renvoyer telle quelle écrirait ces documents
   dans le commentaire à la place des identifiants ;
3. le front repose explicitement les images à chaque édition, sans compter sur ce que le
   brouillon a retenu de la lecture.

La contre-épreuve est écrite : le test d'anti-régression rougit quand on retire le point 3.

**Vérifié** : 40 tests ajoutés (369 dans le module), gates verts, et `_mediaImgForWrite` exercé
sur ses quatre formes d'entrée réelles (documents hydratés, identifiants bruts, entrée
inexploitable, champ absent).

**Hors lot, assumé** : retirer une image d'un message DÉJÀ publié. Le geste n'existe pas dans
l'interface ; le contrat, lui, le permettrait (envoyer un `mediaImg` amputé).

### 13.5 Vérification au navigateur (07/10)

L'upload ne s'exerce pas en Node (§13.2) : le chemin des images n'avait jamais tourné ailleurs
que dans les tests. Il a été rejoué dans Chrome, sur un fil d'organisation, avec un compte sans
privilège.

**Prérequis d'installation, et le seul défaut du chemin nominal.** Le premier essai a rendu une
erreur : `upload-save` répondait **500**, une page HTML titrée `League\Flysystem\Exception`. Le
journal du backend donne la cause — `Impossible to create the root directory
"upload/communecter/comments/<idUtilisateur>/album". mkdir(): Permission denied`. Le dossier
`upload/communecter/comments` doit être **inscriptible par l'utilisateur du serveur web**, comme
ses voisins (`news`, `organizations`…) : c'est lui qui y crée un sous-dossier par auteur, puis
par message. Sur le poste de test il ne l'était pas ; rien à corriger dans le code.

**Chemin nominal, vérifié de bout en bout** :

| Geste | Constat |
|---|---|
| Joindre par le bouton (PNG, JPEG) | `upload-save` en 200, aperçu sans erreur |
| Coller une image dans le champ | même téléversement — collage SIMULÉ : un événement `paste` portant un vrai fichier, sans passer par le presse-papiers du système |
| Envoyer | `comment/save` reçoit `mediaImg[countImages]` et `mediaImg[images][]` ; le backend range les fichiers sous `comments/<idMessage>/album` |
| Rouvrir le fil | les images viennent du backend (plus aucune URL `blob:`) et se chargent |
| Modifier le TEXTE | `comment/update` reçoit `params[mediaImg]` : **les images survivent** — le piège du §13.4 est tenu |
| Agrandir, parcourir, fermer | visionneuse, flèches à l'écran et au clavier, Échap, croix |
| Supprimer le message | il disparaît du fil |

**Trois défauts autour d'une image qui ne part pas, corrigés.** Quand le téléversement
échouait, l'aperçu passait au rouge sans un mot ; et qu'il ait échoué ou qu'il soit encore en
route, rien ne retenait vraiment l'envoi :

1. **le message partait quand même, sans son image** — l'aperçu en échec était effacé par
   l'envoi, rien ne disait que l'image n'avait jamais été jointe ;
2. **Entrée envoyait pendant le téléversement** : seul le bouton était retenu par `imagesBusy`,
   pas `submit()`, que la touche appelle aussi — le message partait avant son image ;
3. une image en échec étant comptée comme un contenu, elle autorisait l'envoi d'un **message vide**.

L'envoi est désormais **retenu dans `submit()`** tant qu'une image jointe ne partirait pas — en
route ou en échec —, au bouton comme à Entrée, et le texte reste dans le champ. La retenue se
lit dans le **statut des images**, pas dans le seul `imagesBusy` : elle ne dépend pas de la
cohérence de l'hôte. Deux phrases l'accompagnent, pour que le bouton grisé et la touche muette
aient une raison :

| Situation | Ce que le composer dit |
|---|---|
| Image en échec | `role="alert"`, aussitôt : « *photo.jpg n'a pas pu être jointe. Retirez-la pour envoyer le message.* » — le nombre d'images au pluriel |
| Tentative d'envoi pendant un téléversement | `role="status"`, après la tentative seulement : « *L'image est encore en cours d'envoi. Le message pourra partir dès qu'elle sera jointe.* » — elle tombe d'elle-même quand l'image arrive |

Retirer l'image en échec suffit à rendre l'envoi. L'échec est annoncé **une fois** : l'aperçu
en échec portait son propre `role="status"`, retiré. Et la retenue sur un échec ne joue que si
l'hôte offre le retrait (`onRemoveImage`) — sans lui les aperçus ne sont pas montrés, et la
phrase demanderait un geste impossible. Le chemin se rejoue au navigateur **sans rien écrire** :
la requête de téléversement est interceptée et refusée par la sonde.

**Vignettes : l'image d'origine, pas la miniature du backend.** À plusieurs images, le fil
servait `imageThumbPath`. Or cette miniature est un carré de 200 px où une image en paysage
arrive **déformée et flanquée d'une bande noire**. Le fil sert désormais `imagePath` dans tous
les cas — l'ordre que suit déjà `NewsImageGrid`. Le poids n'en souffre pas : `OptimizedImage`
demande l'image à la largeur utile (192 px en vignette, 480 px seule), et c'est le serveur du
site qui la réduit.

La miniature reste le **repli**, image par image, dans deux cas : l'original manque, ou il ne se
charge pas (`onError` — l'optimiseur répond 502 quand l'amont échoue ou met plus de dix
secondes). Rejoué au navigateur en coupant les originaux : les vignettes et la visionneuse
passent à la miniature. Limite connue : l'optimiseur réduit en LARGEUR, sans recadrer ; un
panoramique plus large que 2:1 arrive donc avec moins de 96 px de haut, et sa vignette est
agrandie.

**Visionneuse : deux plafonds hérités du dialogue de base**, mesurés sur une image de 1 200 px
dans une fenêtre de 1 440 px :

| Cause | Largeur rendue |
|---|---|
| `sm:max-w-lg` du `DialogContent` de base — une largeur maximale SANS variante `sm:` ne l'écrase pas, tailwind-merge ne fusionnant que des classes de même variante | 512 px |
| `left-[50%]` : une boîte `w-fit` posée à mi-écran ne dispose que de la moitié de la fenêtre, et la flèche « suivante » était poussée hors du cadre | 720 px |
| centrage par les marges (`left-0 right-0 mx-auto`), largeur maximale répétée en `sm:`, image rétrécissable (`min-w-0`) | **1 064 px**, flèches dans le cadre |

La croix du dialogue de base, sombre sur le voile sombre et nommée « Close », est remplacée par
celle de la visionneuse, sur le même fond que les flèches (`images.close`). Elle tient le coin
du cadre, les flèches son milieu : une **hauteur minimale** (`min-h-36`) les sépare quand la
rangée est basse — panoramique sur téléphone, image pas encore arrivée —, sans quoi toucher
« suivante » fermait la visionneuse. Vérifié en ne servant plus aucune image : cadre de 144 px
de haut, et c'est bien la flèche qu'on touche en son centre.

jsdom ne mesure rien de tout cela. Les tests tiennent donc les **classes**, dans les deux sens :
celles du dialogue de base ne figurent plus dans la fusion, et chacune de celles qui les
remplacent y figure — une relecture a montré qu'en retirer une seule (`mx-auto`, `right-0`,
`min-w-0`) défaisait la mise en page sans qu'aucun test ne tombe.

**Ce qui reste hors de cette vérification** : le glisser-déposer (même rappel que le collage,
tenu par les tests) ; un collage depuis le presse-papiers réel ; les deux phrases du composer,
jamais écoutées avec un lecteur d'écran ; un appareil tactile réel ; un vrai panoramique dans la
visionneuse.

Et une mesure sans cause établie : sur le poste de test, `comment/save` a répondu en moins de
4 s avec une image et en **12 s environ avec deux** — le message reste « en cours d'envoi »
pendant ce temps. L'insertion et le rangement des fichiers ont lieu dans la première seconde ;
ce qui suit côté backend reste à mesurer.

## 14. Demande à l'équipe SDK — la liste complète (02/10)

> **Le SDK n'est jamais commité** : cette section est la demande à transmettre à l'équipe SDK. Elle
> réunit **tout** ce que le module attend de `@communecter/cocolight-api-client`, implémenté et
> vérifié en local — sur la base **1.0.195**, puis reposé le 07/10 sur la **1.0.196**. Le détail de
> chaque point vit dans la section citée ; les trois points ajoutés le 02/10 sont spécifiés ici
> (§14.2 à §14.4) ; l'espace d'un commun, ajouté le 07/10, l'est au §14.6 ; le §14.7 dit comment un
> refus arrive à l'appelant ; la création d'une discussion, ajoutée le 12/10, est au §14.8. Tant que le SDK n'est pas publié, `site-json` ne compile que par le lien
> local : un `npm install` propre casse le `typecheck` du module. Ordre de livraison : le SDK
> d'abord, la MR du module ensuite (§2.5).

### 14.1 Récapitulatif

| # | Demande | Nature | Détail | Sans elle |
|---|---|---|---|---|
| 1 | Élargir `GET_COMMENTS.pathParams.type` et `ADD_COMMENTS.request.contextType` aux dix types commentables, et **supprimer** leurs `"default": "news"` | schéma | §2.1, §2.2 | les autres types sont refusés, et un appel sans type écrit sur `news` (défaut injecté par AJV) |
| 2 | `BaseEntity.getComments({ path? })` et `BaseEntity.comment()`, remonté de `News` et `Comment` | méthodes | §2.1, §14.2 | `getComments` n'existe que sur `News` |
| 3 | **`GET_COMMENTS_BY_PATH`** — nouveau | endpoint | §14.2 | le fil d'une question montre les messages de toutes les questions du formulaire |
| 4 | `EntityRegistry` : rendre `Comment` aux dépendances de `poi` | registre | §2.1 | `api.poi({ id }).comment()` lève un `TypeError` |
| 5 | **`GET_DISCUSSIONS`** — nouveau —, sa façade `Api.getDiscussions()` écrite à la main, et **`includeEmpty`** déclaré | endpoint + façade | §9, §14.3 | pas de panneau ; `includeEmpty` refusé par le schéma fermé |
| 6 | **`MARK_COMMENTS_SEEN`** — nouveau — et sa façade `Api.markCommentsSeen()` | endpoint + façade | §11.6 | les non-lus ne s'éteignent jamais |
| 7 | Export `helper.createFromCollection` | export | §2 | lien profond vers une actualité ou une action : troisième colonne vide |
| 8 | `mediaImg` sur `ADD_COMMENTS` et `UPDATE_COMMENTS.params`, `uploadDocument` permis sur `comments` | schéma + méthode | §13.2 à §13.4 | pas d'images, et une édition efface les images d'un message |
| 9 | **`Comment._update` en liste blanche**, mentions normalisées | méthode | §14.4 | éditer un message à mention ou à `path` échoue, et le serveur efface ses mentions |
| 10 | **`GET_DISCUSSION_SPACE`** — nouveau, `auth: "none"` — et sa façade `Api.getDiscussionSpace()` | endpoint + façade | §15, §14.6 | pas d'espace de discussion sur la fiche d'un commun |
| 11 | **`CREATE_DISCUSSION`** — nouveau, `auth: "bearer"` — et sa façade `Api.createDiscussion()` | endpoint + façade | §16, §14.8 | pas de bouton « + » : on ne crée de discussion supplémentaire que depuis le legacy |

Régénération, dans cet ordre : `generate:module:publish` → `generate:methodeapi` → `typecheck` →
`lint` → `build:esm:rollup` → `build:node` → `build:browser` → `build:types`. Les pièges qui
invalident une vérification naïve sont au §2.2 : le runtime lit le module **généré**, jamais le JSON.

**Rien à demander pour le lot du 13/10 (§9.10).** `GET_DISCUSSIONS` rend un champ de plus,
`indexed` (booléen) : le schéma de réponse est ouvert, il passe tel quel, et l'écran ne le lit pas.
L'action `carrierindex` (la reprise) est une opération d'administration : elle ne se déclare pas au
SDK.

### 14.2 `GET_COMMENTS_BY_PATH` — lire UN fil d'un élément

Un formulaire porte **un fil par question** : c'est le `path` du message. `GET_COMMENTS` ne connaît
que `type` et `id` : il rend les messages de **tous** les fils de l'élément, mêlés. Le backend sait
pourtant filtrer — `IndexAction::run($type, $id, $path, $json)` passe le `path` à
`Comment::buildCommentsTree`.

Mesuré sur le backend local le 02/10, sur un formulaire à trois messages répartis sur deux fils :

| Appel | Messages rendus |
|---|---|
| `POST …/comment/index/type/forms/id/<id>/json/true` | 3, des deux fils |
| `POST …/comment/index/type/forms/id/<id>/path/<path>/json/true` | **2, du seul fil demandé** |
| le premier, avec `path` dans le **corps** | 3 — le champ est **ignoré** : Yii lie les paramètres d'action à l'URL, jamais au corps |

D'où un **endpoint distinct**, plutôt qu'un champ de corps :

```json
{
  "name": "Récupérer les commentaires d'un fil désigné par son path",
  "path": "/co2/comment/index/type/{type}/id/{id}/path/{path}/json/true",
  "constant": "GET_COMMENTS_BY_PATH",
  "constantCocolight": "GET_COMMENTS_BY_PATH",
  "functionCocolight": "getCommentsByPath",
  "method": "POST",
  "auth": "none",
  "contentType": "application/x-www-form-urlencoded",
  "pathParams": {
    "type": "object",
    "properties": {
      "type": { "…": "identique à GET_COMMENTS : dix types, aucun défaut" },
      "id":   { "type": "string", "pattern": "^[a-f0-9]{24}$" },
      "path": { "type": "string", "pattern": "^[A-Za-z0-9_-]+(\\.[A-Za-z0-9_-]+)*$", "maxLength": 256 }
    },
    "required": ["type", "id", "path"],
    "additionalProperties": false
  },
  "responses": { "200": "identique à GET_COMMENTS" }
}
```

La règle du `path` est celle du front (`lib/filKey.ts`, `isValidPath`) : des segments
`[A-Za-z0-9_-]` séparés par des points, 256 caractères au plus. Les plus longs mesurés en base en
font 191.

Méthode d'entité, sur `BaseEntity` :

```ts
async getComments(options: { path?: string | null } = {}): Promise<Comment[]>
// path présent → endpointApi.getCommentsByPath({ pathParams: { type, id, path } })
// sinon        → endpointApi.getComments({ pathParams: { type, id } })
```

Vérifié par le SDK reconstruit (`sonde-lotR-backend.ts`) : sans `path`, deux messages de deux fils ;
avec, le seul message du fil demandé.

### 14.3 `GET_DISCUSSIONS` — déclarer `includeEmpty`

Le backend lit `includeEmpty` (§9.9) ; le schéma de requête, **fermé**
(`additionalProperties: false`), ne le déclarait pas. Tout appel qui l'envoyait échouait donc à la
validation, avant même de partir.

```json
"includeEmpty": { "type": "string", "enum": ["0", "1"] }
```

**Aucun `default`** — même piège qu'au §2.2 : AJV l'injecterait. Absent, le serveur vaut `1`.

### 14.4 `Comment._update` — la charge en liste blanche

Le brouillon d'un message relu porte tous les champs de la lecture : `path`, `mentions`,
`contextId`… `_update` ne remontait que `text` et `mediaImg` dans `params` et laissait le reste à la
**racine** ; or `UPDATE_COMMENTS` est fermé — `{ id, params }` seulement. Éditer un message à
mention ou à `path` levait donc `ApiValidationError`. Et retirer ces champs ne suffit pas :
`Comment::update` fait `$unset mentions` dès que `params.mentions` manque.

```ts
const params = { text };                               // « " " » si vide, comme avant
if (mentions.length > 0) params.mentions = mentions;   // normalisées, voir ci-dessous
const media = Comment._mediaImgForWrite(payload.mediaImg);
if (media) params.mediaImg = media;
await this.endpointApi.updateComments({ id, params });
```

Chaque mention est ramenée aux **six champs du contrat** : une mention relue porte en plus
`avatar`, et un `count` en chaîne (`"1"`), que le schéma refuse —
`{ id, name, slug, type, value, count: Number(count) || 1 }`.

Côté appelant, le front pose la liste **recalculée** sur le texte édité — les mentions encore
présentes, avec leur type stocké (une organisation reste une organisation) ; vide, rien n'est
envoyé, et le serveur retire les mentions.

Vérifié par `sonde-edition-mentions.ts`, qui bloque l'envoi par un intercepteur — **zéro
écriture** : message à mention, message à `path` et témoin passent désormais la validation.

⚠️ **À trancher avec l'équipe backend** : `Comment::update` fait aussi `$unset media` faute de
`params.media` — l'aperçu de lien d'un commentaire legacy —, et ni le SDK ni le front ne le
renvoient. Aucun commentaire concerné en base de dev. Renvoyer le `media` relu n'est pas anodin :
l'écriture retraite l'aperçu côté serveur — c'est à l'équipe backend de dire ce qu'elle attend.

### 14.5 Ce que le module appelle

| Appel | Fichier |
|---|---|
| `entity.getComments({ path })` | `hooks/useCommentsQuery.tsx` |
| `helper.createFromCollection(type, client, { id })` | `hooks/useCommentsQuery.tsx` |
| `entity.comment(data)` puis `save()` ; `comment.save()` (édition), `delete()`, `addVote()`, `addReportAbuse()` | `hooks/useCommentMutations.tsx` |
| `comment.getVotes()` | `hooks/useCommentVoters.ts` |
| `entity.uploadDocument(…)` | `hooks/useCommentImages.ts` |
| `api.getDiscussions(payload)` | `hooks/useDiscussionsQuery.ts` |
| `api.markCommentsSeen(…)` | `hooks/useMarkThreadSeen.ts` |
| `api.getDiscussionSpace({ contextType, contextId })` | `hooks/useDiscussionSpaceQuery.ts` |
| `api.createDiscussion({ contextType, contextId, name, audience })` | `hooks/useCreateDiscussion.ts` |

### 14.6 `GET_DISCUSSION_SPACE` — l'espace de discussion d'un commun (07/10)

`POST /co2/comment/space`, corps `application/x-www-form-urlencoded`, schéma de requête **fermé** :

```json
{
  "contextType":  { "type": "string", "enum": ["answers"] },
  "contextId":    { "type": "string", "pattern": "^[a-f0-9]{24}$" },
  "includeEmpty": { "type": "string", "enum": ["0", "1"] }
}
```

`contextType` et `contextId` requis ; **aucun `default`** (AJV l'injecterait, §2.2).

**`auth: "none"`, et c'est voulu.** Dans le client, `bearer` lève avant tout appel quand il n'y a
pas de jeton ; `none` **joint le jeton quand il existe** et ne l'exige pas. C'est le mode « session
facultative » : l'espace se lit sans être connecté (§15.2), et ses compteurs comme ses audiences se
calculent pour la session quand il y en a une.

Façade écrite à la main, à côté de `getDiscussions` et `markCommentsSeen` et pour la même raison —
l'appelant ne tient qu'un couple (type, id) :

```ts
async getDiscussionSpace(options: GetDiscussionSpaceData): Promise<unknown> {
  return this.endpointApi.getDiscussionSpace(options);
}
```

La réponse est décrite au §15.3. Un refus quitte le serveur en **HTTP 200** avec
`{ result: false, code, msg }`, et la façade le rend en **exception** (§14.7).

**Ajout du 12/10 (§17)** — chaque fil porte un quinzième champ, `line` (`string | null`) : pour
une ligne de dépense, la clé de la ligne dans la liste des dépenses du commun ; `null` ailleurs. Et
`includeEmpty` fabrique aussi un fil par ligne de dépense qui n'en a aucun. Le schéma de réponse
n'étant pas fermé, un client plus ancien n'en est pas gêné ; le fil rendu par `CREATE_DISCUSSION`
(§14.8) a la même forme, `line: null`.

**Ajout du 13/10** — rien à changer au schéma. `truncated` vaut aussi `true` quand le commun porte
plus de 200 lignes de dépense à proposer (§17.2). Et le serveur refuse (`bad-request`) un
`includeEmpty` posté sous une autre forme qu'une chaîne ; le schéma du client ne l'admet déjà
qu'en `"0"` ou `"1"`.

### 14.7 Un refus arrive en exception (mesuré le 09/10)

Rien à demander ici : un fait du client, commun aux quatre façades de ce module (`getDiscussions`,
`markCommentsSeen`, `getDiscussionSpace`, `createDiscussion`), que leur JSDoc doit dire (`@throws`)
et non « tester `result` » :

- le serveur refuse en HTTP 200 avec `{ result: false, code, msg }` ; la façade ne **rend pas** ce
  corps : `EndpointApi.call()` lève `ApiResponseError` (statut 200), le corps rangé dans
  `error.responseData`. `code` vaut `login`, `bad-request` ou `hidden` selon l'action (§9.4, §11.3,
  §15.3) ; les schémas de réponse de `GET_DISCUSSIONS` et de `MARK_COMMENTS_SEEN` gagnent à le
  déclarer dans leur branche de refus, comme le fait celui de `GET_DISCUSSION_SPACE` — sans
  urgence, ces schémas n'étant pas fermés ;
- sur un endpoint `auth: "bearer"`, sans jeton, elle lève `ApiAuthenticationError` **avant tout
  appel** : le refus `login` du serveur n'est jamais reçu ;
- une requête que le schéma refuse lève `ApiValidationError`, avant tout appel aussi.

Le module reprend donc le refus dans l'exception : `rawOrRefusal` (`lib/discussions.ts`) rend
`responseData` quand c'est un refus, `{ result: false, code: "login" }` pour l'absence de session,
et relance tout le reste ; la suite le lit comme une réponse (`refusalOf`). Par la **forme** de
l'erreur (`responseData`, `name`) et non par sa classe : ce fichier se lit et se teste sans charger
le SDK.

Conséquence pour les tests : une doublure qui **résout** `{ result: false }` valide un contrat que
le client ne tient pas. Celles du module lèvent les classes d'erreur que le SDK exporte
(`cocolightApiClient.error.*`).

### 14.8 `CREATE_DISCUSSION` — créer une discussion supplémentaire (12/10)

`POST /co2/comment/creatediscussion`, corps `application/x-www-form-urlencoded`, **`auth: "bearer"`**
(sans jeton, la façade lève avant tout appel), schéma de requête **fermé** :

```json
{
  "contextType": { "type": "string", "enum": ["answers"] },
  "contextId":   { "type": "string", "pattern": "^[a-f0-9]{24}$" },
  "name":        { "type": "string", "minLength": 1, "maxLength": 120 },
  "audience":    { "type": "string", "enum": ["authorAll", "authorAdmin", "private"] }
}
```

Les quatre sont requis ; **aucun `default`** (AJV l'injecterait, §2.2). La borne de `name` porte sur
la saisie brute ; le serveur juge, lui, le texte une fois nettoyé (§16.2).

Réponse, en HTTP 200 :

```json
{ "result": true,
  "thread": { "key": "forms:<appel>:<chemin>", "contextType": "forms", "contextId": "<appel>",
              "path": "<appel>.moreDiscussions_<…>.<commun>.discu_<…>.comment",
              "total": 0, "unread": 0, "last": null, "mine": false,
              "title": "Budget 2026", "carrier": null, "virtual": true,
              "kind": "discussion", "group": null, "audience": "authorAdmin", "line": null } }
```

`thread` a la forme d'un fil de `GET_DISCUSSION_SPACE` (§15.3) : c'est le fil créé, vide, avec le
`path` à passer à `getComments({ path })`. Un refus rend `{ result: false, code, msg }` — codes
`login`, `bad-request`, `hidden`, `forbidden`, `bad-name`, `too-many`, `failed` (§16.2) — que la
façade rend en **exception** (§14.7).

`GET_DISCUSSION_SPACE` gagne un champ de réponse, **`creatableAudiences`** : la liste des audiences
que ce lecteur peut donner à une discussion qu'il crée — `[]` quand il n'en crée pas. Additif : un
client qui l'ignore ne change pas.

Façade écrite à la main, à côté des trois autres :

```ts
async createDiscussion(options: CreateDiscussionData): Promise<unknown> {
  return this.endpointApi.createDiscussion(options);
}
```

Mesuré contre le SDK local (12/10) : une audience hors liste, un nom vide ou de plus de 120
caractères, une clé de trop lèvent `ApiValidationError` avant tout appel ; `forbidden` et `bad-name`
arrivent en `ApiResponseError` (statut 200, corps dans `responseData`).

## 15. Espace de discussion d'un commun (07/10, repris le 09/10)

> **État au 09/10** : backend, SDK local et écran sont écrits, testés, et vérifiés par les preuves
> du §15.6 ; ce qui ne l'est pas est dit au §15.7. Une relecture indépendante, puis trois arbitrages
> (§15.2), ont resserré le lot le 09/10 : ce chapitre décrit l'état qui en résulte.

Sur la fiche d'un commun, le legacy ouvre par son bouton « Commentaires » non pas un fil mais un
**espace** : tous les fils de ce commun. Le module ne savait ouvrir qu'un fil, ou le panneau de
tout un utilisateur ; la fiche React d'un commun n'en proposait aucun.

### 15.1 Ce qu'est un espace

Un commun est une **réponse** à un appel. Ses fils tiennent en deux contextes :

| Fil | Contexte | `path` |
|---|---|---|
| général | `answers:<commun>` | aucun |
| question | `forms:<appel>` | `<appel>.<étape>.<commun>.<question>.question_<question>.comment` |
| ligne de dépense | `forms:<appel>` | le chemin de la question qui la porte, suivi de `.financement.depensekey.<étape>-<champ>.depenseindex.<clé de la ligne>` (§17) |
| discussion supplémentaire | `forms:<appel>` | `<appel>.moreDiscussions_<x>.<commun>.discu_<n>.<suffixe>` |

`<appel>` est le formulaire où la réponse a été **déposée** (`answer.form`) — la fiche legacy ouvre
l'espace sans en préciser d'autre. `<étape>` est l'`_id` du document `inputs` de l'étape pour un
formulaire `aap`. **Le troisième segment est toujours l'identifiant du commun** : c'est lui, et lui
seul, qui range un fil de formulaire dans un espace.

L'**ordre des étapes** d'un appel `aap` est celui des clés de sa configuration (`subForms` du
formulaire de configuration), comme dans le legacy : la liste `subForms` de l'appel lui-même manque
sur 71 des 197 appels `aap` de la base de développement (mesuré le 09/10) — elle ne sert que de
repli.

Une discussion supplémentaire est déclarée sur la réponse (`moreDiscussions.<discu>` :
`name`, `privilege`, `path`, `stepId`). Son deuxième segment n'est pas une étape de l'appel mais
son propre `stepId` (`moreDiscussions_<x>`), et son suffixe suit son audience : `commentPublic`,
`comment`, `privateComment`.

### 15.2 Sept arbitrages (07/10 et 09/10)

| Question | Décision |
|---|---|
| Le déposant voit-il les fils de l'étape d'évaluation ? | **Oui**, et il y répond — comme le legacy, qui ne filtre aucune étape |
| Lecture sans être connecté ? | **Oui**, comme le legacy ; écrire exige une session |
| Discussions supplémentaires | **Lire et écrire dans celles qui existent**, chacune réservée à son audience ; en créer passe par une action à part, gardée (§16) |
| Notifications | **Celles du legacy**, inchangées : elles s'appliquent déjà à un message posté d'ici (§3) |
| Qui est « admin » d'un commun ? (09/10) | L'admin de l'**appel**, par son lien direct avec l'élément qui le porte (§15.4) |
| Quels fils de question sont listés ? (09/10) | **Comme l'écran legacy** : ceux des questions que l'appel connaît et ouvre aux commentaires ; une ligne de dépense, dès qu'il connaît sa question (§15.3) |
| Que fait « retour » après une fermeture ? (09/10) | **Fermer défait l'ouverture** : « retour » ramène à la page d'avant la fiche (§15.5) |

### 15.3 L'endpoint `space`

`POST /co2/comment/space` — `DiscussionSpaceAction`, dans `citizenToolKit/controllers/comment/`,
route `space` de `CommentController` (co2). Le modèle est `Discussion::spaceOf()`.

**Un endpoint à part de `discussions`, pour une raison de garde** : le panneau général exige une
session et la garde ; cet espace-ci se lit sans. Deux gardes distinctes valent mieux qu'une
exception dans la première.

```json
{
  "result": true,
  "space": { "type": "answers", "id": "…", "title": "…", "formId": "…" },
  "canComment": false,
  "creatableAudiences": [],
  "truncated": false,
  "threads": [
    { "key": "answers:…", "contextType": "answers", "contextId": "…", "path": null,
      "total": 2, "unread": 0, "last": 1790000000, "mine": false,
      "title": null, "carrier": null, "virtual": false,
      "kind": "general", "group": null, "audience": null, "line": null }
  ]
}
```

- `kind` : `general`, `discussion`, `question`, `expense`. `group` : le nom de l'étape, pour une
  question ou une ligne de dépense. `audience` : `authorAll`, `authorAdmin` ou `private`, pour une
  discussion. `line` : la clé de la ligne, pour une ligne de dépense (§17.2). L'écran garde une
  étiquette de repli pour une nature qu'il ne connaîtrait pas — celle d'un serveur plus récent que
  lui.
- **L'appel fait foi.** Un chemin ne suffit pas à faire un fil : un fil de question ou de ligne de
  dépense n'entre dans la liste que si l'appel **connaît** cette question, à cette étape — la règle
  du legacy (`Form::getCommentedQuestionParams`). Un chemin posé sur la réponse elle-même, ou sur
  une question retirée de l'appel, n'est donc pas listé ; ses messages restent en base.
- **Et l'appel décide de ce qu'il ouvre.** Un fil de **question** exige en plus que l'appel ouvre
  cette question aux commentaires (`activeComments`) : c'est le tri que fait l'écran legacy
  (`buildCommentedQuestionList`), qui ne montre plus le fil d'une question dont les commentaires
  ont été coupés — ses messages, là aussi, restent en base. Une **ligne de dépense** se liste dès
  que l'appel connaît sa question, ouverte aux commentaires ou non : le legacy la montre toujours.
  La règle ne regarde pas l'étape : une question d'évaluation se liste comme une autre.
- `title` : le libellé de la question, le poste de la ligne de dépense — à défaut de poste, le
  libellé de sa question, comme dans le legacy —, le nom de la discussion. Toujours en **texte
  nu**, borné à 120 caractères : balises retirées, puis entités HTML décodées (le legacy enregistre
  `R&amp;D`, et l'écran affiche du texte, pas du HTML). `null` pour le fil général, et pour une
  question sans libellé ou une discussion sans nom : **c'est l'écran qui nomme alors, dans sa
  langue**. Le poste d'une ligne ne se lit que dans un champ que l'appel déclare
  (`answers.<étape>.<question>`). Les titres de fil et les noms de porteur du panneau général (§9)
  sont rendus en texte nu eux aussi.
- L'ordre est celui du serveur, et il ne dépend pas de l'activité : général, discussions (par
  titre), questions dans **l'ordre de l'appel** (étape, puis `positions.<appel>`), lignes de
  dépense (par titre) ; à égalité, le chemin départage. Un tri par titre ignore la casse et les
  accents : « État des lieux » se range à E, pas après « Zoo ».
- `canComment` dit seulement s'il y a une session, et l'écran ne promet pas plus.
- `creatableAudiences` : les audiences que ce lecteur peut donner à une discussion qu'il crée
  (§16) ; vide, il n'en crée pas — sans session, toujours.
- `truncated` : la liste est partielle — plus de fils que le budget de lecture n'en rend, ou plus
  de 200 lignes de dépense à proposer (§17.2). L'écran le dit d'une phrase sous la liste.
- Fils **fabriqués** (`virtual`, sauf `includeEmpty=0`) : le fil général, les discussions déclarées
  encore vides, les questions que le formulaire ouvre aux commentaires (`activeComments`) — appel
  ou formulaire général, sous l'`_id` de l'étape, la forme qu'écrit le legacy (§20.2) — et, pour un
  appel `aap`, un fil par ligne de dépense qui n'en a aucun (§17.2).
- Refus, en HTTP 200 : `bad-request` (type hors liste blanche, identifiant mal formé, ou
  `includeEmpty` posté sous une autre forme qu'une chaîne — lu comme absent, il ferait rendre les
  fils à lancer à qui demandait de ne pas les avoir) ; `hidden` (commun ou appel introuvable). Le serveur accepte l'identifiant en majuscules et le ramène en
  minuscules ; le schéma du SDK, lui, n'admet que des minuscules.
- Comme `discussions`, **aucun texte de message** : le fil se lit par `getComments({ path })`.

**Plan de requête.** On part de la réponse, jamais du parc : un `$or` à deux branches, chacune avec
son `contextType`, donc servies par l'index `ctx_created` (§9.6). Le motif du `path` est **ancré** et
ne porte que deux identifiants déjà validés. Mesuré sur un espace de 6 fils : l'agrégation des
messages ne balaie pas la collection, 13 documents examinés ; 15 à 21 ms par appel, HTTP compris.

Les **étapes** de l'appel, elles, ne se lisent pas par index : `inputs` se cherche par `formParent`,
et la collection n'en porte aucun hors `_id_` — un balayage de ses 1 120 documents en développement
pour en rendre 4, comme le fait le legacy à chaque ouverture (mesuré le 12/10 ; moins d'une
milliseconde ici). Pour un formulaire qui n'est pas `aap`, c'est `forms` qui se cherche par `id`,
sans index non plus. Le reste se lit par `_id` : la réponse, l'appel, sa configuration, l'élément
qui le porte.

**Ce coût suivait l'appel, pas le commun** : l'index menait aux messages de l'**appel**, et le motif
du chemin ne triait qu'après lecture — sur un appel dont des centaines de communs sont commentés,
chaque ouverture d'espace relisait tous leurs messages pour n'en garder qu'une poignée. **Réglé le
13/10** (§9.10) : un message d'un fil d'espace porte son commun (`spaceId`, écrit à l'insertion et
par la reprise). Dès que ses index existent, l'espace lit trois branches dans **une** agrégation :
le fil général (`answers`, inchangé), les messages qui portent ce commun (index `space`), et les
messages de l'appel pas encore repris, filtrés par le motif comme avant (index `carrier_ctx`, vide
une fois la reprise finie). `spaceId` ne fait que **choisir** des messages : chaque fil rendu reste
rejugé sur son chemin (`parseSpacePath`, audience). Mesuré sur un appel de 40 000 messages :
**74 ms et 40 020 messages lus avant, 1 ms et 20 après**, pour les mêmes fils.

### 15.4 Ce que la liste rend, et à qui

Trois rôles : **admin** de l'appel, **déposant** de la réponse, **référent** nommé dans la réponse.

« Admin » se lit sur le **lien direct** du lecteur avec l'élément qui porte l'appel (`form.parent`) :
son lien d'appartenance y porte `isAdmin`, sans rien en attente — `links.members` pour une
organisation, `links.contributors` pour un projet, `links.attendees` pour un événement
(`Discussion::isDirectAdmin`, une lecture par `_id`). La règle ne dépend que du commun et de son
appel (arbitré le 09/10) ; elle est plus étroite que celle du legacy (`Authorisation::isElementAdmin`).

| Fil | Listé pour |
|---|---|
| général, question, ligne de dépense | tous, sans session aussi |
| discussion `authorAll` | tous |
| discussion `authorAdmin` | admin, déposant, référent |
| discussion `private` | admin |
| audience inconnue, discussion absente de la réponse, `path` différent de celui déclaré | personne |
| tout chemin marqué `.privateComment` | admin, quoi que dise l'audience |

**La liste fait autorité pour l'écran** : il ne monte un fil que si `space` le lui a rendu. Une
adresse qui en désigne un autre — discussion réservée, fil disparu — n'affiche rien de son contenu :
« introuvable, ou dont l'accès est réservé », avec, sans session, l'invitation à se connecter.

La règle est une fonction pure, `Discussion::isSpaceThreadReadable`, que la liste et le fil désigné
partagent. Elle revient ainsi dans `isThreadHiddenFrom` (§9.7) : une discussion réservée était
refusée à **tous** par la seule forme de son chemin, admins compris, qui ne pouvaient ni l'ouvrir
(`fil`) ni la marquer lue (`seen`). Quand plus rien ne permet de juger — commun supprimé,
discussion qui n'y est plus déclarée —, la forme du chemin reprend la main : une discussion
publique reste ouverte, une marque `.privateComment` reste fermée. Le **rail** général, lui, reste
fermé à tous pour ces fils : il ne connaît pas le commun, et juger chaque ligne y coûterait une
lecture par fil.

### 15.5 L'écran

- **`SpacePanel`** — deux colonnes, les fils puis le fil choisi : c'est le panneau cadré sur un
  élément, donc sans rail. Il réemploie `ThreadColumn`, `CommentThread` et la grammaire de colonnes
  de `styles.css` (mêmes `data-panel-column` et `data-step`) : sous 48 rem de panneau il se replie
  en une colonne. La croix de fermeture est posée dans l'en-tête des deux colonnes ; celle de la
  liste ne se montre qu'en mode une colonne.
- **La bande 48–64 rem lui est permanente** : sa modale plafonne à 64 rem, elle n'en sort jamais
  dès que deux colonnes s'affichent. Cette bande a été écrite pour trois colonnes, rail plié ; deux
  de ses règles ont dû être bornées au rail. L'une est dite au §10.14 — la pastille de non-lus
  posée en coin ; l'autre l'est ici : la colonne des fils n'y tombe à 15 rem que derrière un rail,
  sans quoi le libellé de ses étiquettes (« Question », « Publique »…) passait sous le seuil où il
  s'efface. Le panneau ne se déclare pas « sans recherche » (`data-search`) : il n'a ni recherche
  ni rail.
- **Il est contrôlé** (`target`, `onSelect`) : l'adresse appartient à l'hôte. `useSpaceLauncher`
  lit `?discussion=…` et ne retient que les fils **de cet espace** — le paramètre appartient à tout
  le site, le fil d'un autre commun ne doit pas ouvrir cette fiche.
- **`ThreadColumn`** gagne cinq propriétés facultatives, sans effet sur le panneau général :
  `chip` (l'étiquette d'une rangée, quand le type du contexte ne dit pas ce qu'est le fil),
  `titleFallback`, `groupLabel` (un intertitre à chaque changement, la liste gardant l'ordre reçu),
  `pinned` (le fil général, même vide, ne rejoint pas « Sans discussion ») et `startLabel`. Un
  groupe se reconnaît à son intertitre et à son rang parmi les groupes de ce nom — ni à son rang
  dans la liste, ni à son premier fil : qu'un groupe apparaisse au-dessus, ou qu'un fil prenne la
  tête du sien (la première question d'une étape reçoit son premier message), les rangées voisines
  ne sont pas remontées, et celle qu'on tenait garde le focus. Le pli « Sans discussion » suit les
  mêmes intertitres : les questions vierges s'y rangent sous leur étape, chaque liste nommée.
- **Le fil ouvert ne disparaît pas dans le pli** (arbitré le 12/10, vaut aussi pour le panneau
  général). On arrive sur un fil où personne n'a écrit par un lien, par le bouton d'un palier
  (§17), ou en venant de le créer (§16) : le pli est replié, et sa rangée y serait cachée. Elle
  reste donc **sous l'en-tête du pli**, surlignée, dans une liste à elle (« Fil ouvert ») — comme
  le salon actif d'une catégorie repliée. Sous l'en-tête et non parmi les fils écrits : quand on
  la quitte, aucune rangée ne remonte sous le pointeur. Et jamais deux fois : repliée, elle sort
  de la liste du pli, qui garde son compte ; dépliée, elle y reprend sa place.
- **L'historique** : ouvrir **empile** une entrée, changer de fil la **remplace**, et **fermer
  défait l'ouverture** — la croix et Échap font « retour » (arbitré le 09/10). « Retour » ferme
  donc la modale sans quitter la fiche ; et après une fermeture, il ramène à la page d'avant la
  fiche, comme si l'on n'avait rien ouvert. Arrivé par un lien, il n'y a rien à défaire : l'adresse
  est **remplacée**. C'est un écart voulu à la règle du panneau général (§10.1), où fermer empile :
  celui-ci n'a pas de point d'entrée dans une page. Trois précisions, payées au navigateur puis à
  la relecture :
  - **aucun état React.** Ce que l'adresse ne dit pas — la modale ouverte sur la *liste* des fils,
    l'entrée empilée par l'ouverture — vit dans l'entrée d'historique elle-même (`location.state`,
    sous une clé propre au lanceur, bornée à l'espace) et arrive donc **au même rendu** que
    l'adresse. Tenu dans un état local, il arrivait avant elle, l'adresse atteignant React dans une
    transition : la modale s'ouvrait sans son fil, se rouvrait seule si on la fermait dans
    l'intervalle, et « retour » ne la fermait pas. « Suivant » rouvre ainsi la modale là où on
    l'avait laissée, liste comprise ;
  - **un ordre par entrée.** Tant que l'adresse n'est pas arrivée, un second toucher sur le bouton
    empilerait une entrée jumelle, et un second Échap ferait un second « retour » — qui quitte la
    fiche. Le lanceur n'écoute qu'une ouverture ou une fermeture par entrée d'historique ;
  - un fil ne s'écrit dans l'adresse que si elle **saura le relire**, à l'identique, et s'il est de
    cet espace : sinon le paramètre ne désignerait plus rien, et la modale se fermerait dessus ;
  - **ouvert, l'espace reste où l'adresse le dit.** `openAt()` sans fil nommé ne fait rien sur un
    espace déjà ouvert, et `select` ne fait rien sur un espace fermé. Le bouton d'une fiche reste
    cliquable le temps que le code de la modale arrive : arrivé par le lien d'un fil, y cliquer
    remplaçait ce fil par le fil général — il n'était plus nulle part, pas même dans l'historique.
- **La requête attend de savoir qui lit** : l'identité du lecteur n'est connue qu'au second rendu
  de chaque montage. Lancée avant, la requête partait deux fois pour un connecté, la première sous
  une clé qui n'était pas la sienne. Ce rendu d'attente compte comme un chargement : l'écran ne dit
  ni « aucun fil » ni « introuvable » entre-temps.
- **Un refus n'est pas une panne**, et la règle se tient dans `useDiscussionSpaceQuery`, pour le
  bouton comme pour le panneau. Un **refus** — le serveur a répondu `result: false` : `hidden`,
  `bad-request`, ou un code que l'écran ne connaît pas — vide l'écran et retire les compteurs, même
  si une liste avait déjà été servie ; il n'est ni réessayé, ni relu à intervalle. Une **panne** —
  un échec, ou une réponse **illisible** (une page d'erreur servie en HTTP 200, un avertissement
  écrit devant le JSON) : personne n'a dit non — est réessayée deux fois, relue à intervalle, et
  laisse à l'écran la liste, le fil ouvert et le brouillon en cours. Sans rien à montrer, elle
  s'affiche avec un bouton « Réessayer » — dans la colonne des fils, et dans celle du fil quand
  elle est seule à l'écran (sous 48 rem, un fil ouvert) : le bouton resté dans la liste, la panne
  s'y lisait sans issue. Le panneau général suit la même règle pour le fil ouvert.
- **Une première lecture mise en pause** (réseau perdu) reste un chargement : tant que rien n'a été
  rendu, l'écran ne dit ni « aucun fil » ni « introuvable ».
- **Ce qui arrive à l'espace se dit aussi à qui ne le voit pas** : une région `role="status"`,
  toujours présente, porte le refus, la panne ou le fil introuvable. Une seule, parce que les deux
  colonnes affichent la même phrase et que l'une des deux est hors écran en mode une colonne.
- **À l'ouverture, le focus va au dialogue lui-même** (`initialFocus="dialog"` de la coquille) : au
  rendu d'ouverture la liste n'est pas encore là, et le premier élément atteignable serait la croix
  — on ouvrait, au clavier, sur « Fermer ».
- **Le focus revient au bouton** à la fermeture (croix, Échap, « retour ») : la modale n'a pas de
  `DialogTrigger` — elle s'ouvre aussi par une adresse — et Radix laissait le focus sur `<body>`
  (§12.5).
- **Sans session** : les emplacements vides ne sont pas proposés — sauf le fil général —, et le fil
  invite à se connecter à la place du composer. Un visiteur arrivé par un lien sur un emplacement
  vide le lit quand même : ce qu'on **propose** est de l'affichage, ce qu'on **monte** suit la
  liste du serveur. Devant un fil qu'elle ne lui rend pas, l'écran ajoute qu'il peut se connecter
  pour le lire — le lien d'une discussion réservée, transmis à son déposant, s'arrêtait sinon sur
  un constat sans suite.
- **`SpaceModal`** partage la coquille de `DiscussionModal` (`DiscussionModalShell` : cadre, croix,
  arbitrage d'Échap), en moins large : `md:max-w-[min(64rem,…)]`, en `md:` pour la raison du §10.7.
  La coquille vit dans **son propre fichier** : logée à côté de `DiscussionModal`, elle faisait
  entrer le panneau général — rail et recherche compris — dans le morceau de l'espace, qui ne le
  rend jamais.
- **Le point d'entrée** : `CommunDiscussionControl`, sur la fiche d'un commun (`modules/aac`) — un
  bouton « Discussion » avec le nombre de messages et de non-lus, visible de tous, qui s'annonce
  comme ouvrant un dialogue (`aria-haspopup`). Il importe
  `@/modules/comment/launch`, **entrée légère** (compteur et lanceur), et charge la modale en
  différé par le `lazy` de `vite-preload`, préchauffée dès que le bouton est survolé ou atteint au
  clavier. Arrivant sans l'entrée du module, la modale enregistre elle-même ses libellés. Le
  compteur ne sonde pas (`live: false`) : relire toutes les trente secondes un espace que personne
  ne regarde serait une requête par fiche ouverte. Tant que la modale est attendue — ouverte, son
  code pas encore arrivé —, le bouton se dit occupé (`aria-busy`). La fiche le monte avec une `key`
  par commun : la même route sert deux communs, et sans elle le bouton gardait de la fiche d'avant
  le focus à rendre après une modale.
- **Les devoirs de l'hôte** — un second point d'entrée devra les reprendre :
  - rendre le focus à ce qui a ouvert, et poser une `key` par élément (ci-dessus) ;
  - ne pas réécrire l'entrée d'historique sans recopier `location.state` : la marque du lanceur y
    vit. Un `setSearchParams(…, { replace: true })` voisin fermerait la modale ouverte sur la
    liste, ou ferait oublier que l'entrée a été empilée — la croix remplacerait au lieu de revenir ;
  - ne pas rendre le lanceur côté serveur : la marque « sur la liste » n'existe que dans le
    navigateur, la page rechargée sur la liste rendrait une modale que le serveur n'a pas rendue.
    Sans effet aujourd'hui, la fiche n'étant pas dans le HTML du serveur ;
  - une seule MODALE par espace et par page — celle que monte le bouton de la fiche. D'autres
    boutons peuvent l'ouvrir par l'adresse, chacun avec son lanceur : c'est ce que font ceux des
    paliers (§17.3). La garde « un ordre par entrée d'historique » est tenue par CHAQUE lanceur :
    deux boutons différents activés dans le même instant, avant que l'adresse n'arrive,
    empileraient deux entrées — non observé, et non couvert par un test.
- **L'écho d'un double clic** (relecture du 13/10). Un clic qui fait apparaître ou disparaître la
  modale change ce qu'il y a sous le curseur ; qui double-clique par habitude envoyait son second
  appui ailleurs. Mesuré au navigateur : douze doubles clics sur douze, sur « Discussion »,
  refermaient la modale aussitôt (le second tombait sur son voile) ; sur un téléphone, celui de la
  croix ouvrait un bouton de la page que la modale couvrait. La coquille des modales
  (`DiscussionModalShell`) avale désormais cet écho (`lib/echoClick.ts`), 400 ms durant : à son
  ouverture — les événements de souris que le navigateur compte comme la suite d'un clic
  (`detail > 1`) et ceux de pointeur —, et quand un clic la ferme, à l'endroit de ce clic, à
  12 px près. Un premier clic, ou une activation au clavier, passe toujours. Le « + » de la
  colonne ignore de même le second clic d'un double clic.
- **Une relecture ratée ne remplace pas la fiche.** `AacCommunDetailPage` n'affiche sa carte
  d'erreur que s'il n'y a rien à montrer. Auparavant, une relecture de la réponse qui échouait —
  il suffit de revenir sur l'onglet quand le réseau flanche — démontait la fiche déjà affichée, la
  modale ouverte, et le message qu'on y écrivait.
- La clé de cache vit sous le préfixe du panneau (`comment-discussions`) : poster un message ou
  marquer un fil lu rafraîchit déjà les compteurs de l'espace.

### 15.6 Preuves

Rejouées le 12/10, sur le code décrit ici — sauf les lignes « Navigateur », mesurées le 09/10,
avant les corrections de la seconde relecture (§15.5) ; la dernière, elle, porte sur ces
corrections et date de la nuit du 12 au 13/10.

| Quoi | Résultat |
|---|---|
| Règles, hors base — doublures de `PHDB`, qui lèvent comme le pilote sur un identifiant invalide ou une projection en collision | 100 vérifications : lecture d'un chemin, rôles par lien direct, audiences, espace entier (dont la forme exacte d'un fil : quatorze champs à cette date, quinze depuis le §17), texte nu et ordre des libellés, fil désigné, entrées de travers |
| Contre-épreuve par mutation de `Discussion.php`, sur une copie | 98 mutations tuées sur 98 |
| Sonde contre le vrai backend, trois identités (visiteur, compte non membre, admin de l'appel) | 69 vérifications ; refus, espace vierge et semé, question que l'appel n'ouvre pas aux commentaires, étape d'évaluation ouverte (sur le seul appel de la base qui en a une), audiences `private` et `authorAdmin`, questions que l'appel ne connaît pas, modes `fil` et `seen`, plan de requête |
| Sonde des actions `discussions` et `seen`, vrai backend | 30 vérifications : chaque paramètre posté en tableau est refusé en JSON (`bad-request`), jamais converti ni lu comme absent ; refus codés de `seen` ; rien n'est marqué lu |
| Sondes des lots précédents (panneau, éléments vierges, lot R) | rejouées, vertes : 21, 17 et 25 vérifications |
| Appel réel au SDK, avec et sans session | un refus arrive en `ApiResponseError` (statut 200, corps dans `responseData`) ; sans session, `ApiAuthenticationError` avant tout appel (§14.7) |
| Tests unitaires de l'écran | 399 tests dans treize fichiers, dont 243 dans les neuf fichiers nouveaux : lecture de la réponse, refus repris de l'exception, réponse illisible, lanceur et historique, requêtes, colonne des fils, panneau, modale, bouton, composition de la fiche |
| … dont un **parcours** assemblé | 17 tests (21 au 13/10, et 7 pour celui d'un palier) : le bouton, la modale chargée en différé, le panneau, la colonne, le lanceur, l'adresse et l'historique sont les vrais — seuls le serveur, le temps réel et le fil de messages sont remplacés |
| … le **coût** du bouton | le fichier de la modale n'est importé qu'au survol ou à l'ouverture ; et le graphe des imports statiques de l'entrée légère, lu dans les sources : onze fichiers, aucun composant, ni libellés ni styles (celui de la modale en compte cinquante-huit, sans le panneau général) — remesuré le 13/10, après les lots suivants : douze et soixante-cinq |
| … l'**attente** de la modale | son import retenu par une porte : le bouton se dit occupé, et y cliquer ne remplace pas le fil du lien |
| Contre-épreuve par mutation de l'écran, sur des copies | 341 mutations tuées sur 341 — dont 32 défauts de la chaîne passés contre le seul test de parcours |
| Navigateur, visiteur — 1440 et 375 px | 22 et 26 vérifications : liste, intertitres, fil, invitation à se connecter, liens profonds |
| Navigateur, compte connecté non membre | 21 vérifications : discussions à lancer repliées, composer présent |
| Navigateur, déposant qui écrit sur son commun | 27 vérifications : message rangé sur l'appel au chemin du legacy, puis supprimé ; aucun document créé dans une autre collection |
| Navigateur, historique et clavier — 1440 et 375 px | 21 et 27 vérifications : « retour », « suivant », croix et Échap qui défont l'ouverture, double clic, double Échap, focus rendu au bouton, « suivant » qui rouvre sur la liste, lien d'un visiteur vers un emplacement vide |
| Navigateur, processeur ralenti vingt fois — 375 et 1440 px | 9 vérifications chacune : deux Entrée puis deux Échap, double clic sur le bouton puis sur la croix — une seule entrée empilée, un seul « retour » |
| Navigateur, mesure de la bande 48–64 rem, compte connecté | 27 vérifications : pastille de non-lus d'un fil dans le flux et libellé d'étiquette visible, dans l'espace (panneau de 63,9 rem, colonne des fils de 18 rem) comme dans le panneau général, rail plié d'office puis à la main — **avec contre-épreuve**, l'ancienne règle réinjectée dans la page ; une seule requête `space` par fiche pour un connecté ; connexion depuis la modale ; `/discussions` sans session |
| Navigateur, corrections de la seconde relecture, sans session — 1440 et 375 px | 35 vérifications à chaque largeur : le bouton de la fiche se dit occupé (`aria-busy`, curseur d'attente) tant que le code de la modale n'est pas arrivé ; le focus d'ouverture est sur le dialogue lui-même ; une panne de l'espace se lit avec **un** bouton « Réessayer » à l'écran, quelle que soit la largeur, et l'appel repart au clic. C'est ce passage qui a montré le bouton hors écran à 375 px ; corrigé, puis tenu par 3 tests et 6 mutations de plus (les huit lots du panneau rejoués : 115 tuées sur 115) |

### 15.7 Limites

- **Non vérifié de bout en bout** : une discussion `authorAll`, et le déposant ou le référent qui
  n'est pas admin — la base de développement n'en offre pas le cas ; ils sont jugés par la règle
  (§15.6, première ligne). La notification d'un tiers relève du backend existant, que ce lot ne
  touche pas, et n'a pas été rejouée.
- **Renommer** et **supprimer** une discussion supplémentaire ne sont pas portés : ils restent au
  legacy. La créer l'est (§16).
- Les **référents** se lisent au chemin que le legacy emploie pour sa décision
  (`answers.aapStep1.finderaapStep1m0w402djpsq3i44017`), et le **titre** du commun à
  `answers.aapStep1.titre`. La fiche, elle, passe à la modale le titre qu'elle a résolu.
- Le commun **n'entre pas dans le rail** du panneau général — le legacy ne l'y met pas non plus.
- Un commun **partagé entre deux appels** n'a qu'un espace, celui de l'appel où il a été déposé
  (§15.1), d'où qu'on ouvre sa fiche — comme la **fiche** legacy, qui ouvre l'espace sans préciser
  d'appel. L'action legacy accepte, elle, qu'on lui en désigne un autre (`formId`), ce que font des
  blocs CMS de costum : ce cas-là n'est pas porté.
- **Rien de versionné ne couvre les règles du backend** : `citizenToolKit` n'a pas d'outillage de
  test. Le banc de règles et ses mutations (§15.6) vivent hors dépôt, et se rejouent à la main.
- Formulaires qui ne sont pas `aap` : depuis le 14/10, leurs questions ouvertes aux commentaires
  se proposent comme celles d'un appel (§20.2) ; on n'y crée pas de discussion supplémentaire.
- Le fil d'une question **retirée de l'appel**, ou dont l'appel a **coupé les commentaires**, n'est
  plus listé (§15.3) : ses messages restent en base, mais l'espace ne les propose plus. La base de
  développement ne porte qu'une étape d'évaluation ouverte aux commentaires, sur un seul appel :
  c'est sur lui que la lecture d'un fil d'évaluation est prouvée (§15.6).
- Un chemin de plus de 256 caractères ne se relit ni par l'adresse (§5.3) ni par le SDK (§14.2) :
  le lanceur ne l'écrit pas, et un clic sur un tel fil ne fait rien. Le plus long chemin mesuré en
  base de développement en fait 191 ; le plus long que ses 197 appels `aap` puissent produire —
  une ligne de dépense — en fait 245 (calculé le 09/10 sur leurs clés d'étape et de question).
  Il en va de même d'un chemin dont un segment sortirait du jeu de caractères de l'adresse
  (lettres sans accent, chiffres, `_`, `-`) : le serveur le liste s'il porte des messages, l'écran
  ne sait pas l'ouvrir. Aucune des 4 379 clés de question de la base de développement n'en sort
  (mesuré le 12/10).
- **Écrire sur un fil d'appel écrit aussi ailleurs** — c'est le backend existant, que ces lots ne
  touchent pas. Le message posté ajoute une entrée et un compteur sur le document de l'appel (sous
  `comment.<chemin>`), date ce document, et fait recalculer les points du compte qui écrit ;
  supprimer le message ne défait rien, et décrémente le compteur racine de l'appel au lieu de
  celui du fil. Mesuré le 12/10 : un essai d'écriture se relève donc par le **contenu** des
  documents, pas par leur nombre (§17.5).
- **« Réessayer » ne peut rien pendant la minute où le SDK a coupé les appels.** Son client porte
  un disjoncteur : cinq échecs de suite — réseau, ou réponse 5xx — et il refuse tout appel du site
  pendant une minute, sans rien envoyer. Les nouvelles tentatives d'une lecture en panne (trois en
  tout) y mènent vite ; le bouton relance alors une demande que le SDK refuse aussitôt, et l'écran
  redit la panne. Antérieur à ces lots, et vrai de tout appel du site. Lu au navigateur le 12/10 :
  `space` coupé au réseau, cinq échecs, puis plus aucune requête jusqu'à la minute écoulée.
- ~~Le coût d'un espace suit l'appel, pas le commun~~ — réglé le 13/10 (§15.3, §9.10), une fois la
  reprise lancée en production.
- **Se connecter depuis la modale la referme un instant** : la connexion change les clés de la
  fiche, qui repasse par son écran de chargement et remonte le bouton. L'adresse rouvre la modale
  sur le même fil ; le pli « Sans discussion » et la position de lecture ne sont pas gardés.
- **Le chargement différé de la modale ne sort pas encore le fil du démarrage.** Le bouton ne tire
  ni le fil ni le composer ; mais l'entrée complète du module est déjà dans le graphe de démarrage
  de toute page, par une chaîne d'imports antérieure à ce lot (`profil/routes` →
  `@/modules/news` → `NewsItem` → `@/modules/comment`). Lu sur le serveur de développement, pas sur
  un build de production.
- **La compilation ne voit pas un SDK sans ces endpoints.** Les appels aux façades passent par un
  transtypage, comme dans tout le module : installé depuis le registre sans `getDiscussionSpace`,
  le SDK ferait échouer l'appel à l'exécution — une « panne », bouton sans compteur — sans que
  `tsc` ni un test ne le disent. L'ordre de livraison du §2.5 (le SDK d'abord) en est le seul filet.
- **Si le code de la modale ne peut pas être téléchargé** — hors ligne, ou le site remplacé par une
  version plus récente pendant qu'on lit —, l'erreur remonte à l'écran d'erreur du site, comme pour
  tout morceau chargé en différé : ce bouton n'a pas de repli à lui.
- **Non vérifié** : un lecteur d'écran réel, un appareil tactile réel, le temps réel (pas de hub en
  développement).

## 16. Créer une discussion supplémentaire (12/10)

Le bouton « + » de l'espace legacy : une discussion de plus sur un commun, nommée, et réservée à une
audience. Demandée le 09/10, une fois l'espace livré.

### 16.1 Ce que fait le legacy

Une discussion s'enregistre sous une clé, une étape et un chemin. Le module passe par une action
à lui (arbitré le 07/10), où c'est le serveur qui fabrique ces trois valeurs. Ce qui est enregistré,
en revanche, est repris à l'identique, parce que le legacy le relit :

| Où | Quoi |
|---|---|
| `answers.<commun>.moreDiscussions.<clé>` | `name`, `privilege`, `path`, `stepId`, `created`, `updated`, `creator`, `status: "active"` |
| `<clé>` | `discu_` suivi d'une date en chiffres |
| `stepId` | `moreDiscussions_` suivi d'une heure et de lettres |
| `path` | `<appel>.<stepId>.<commun>.<clé>.<suffixe>` — `commentPublic`, `comment` ou `privateComment` selon l'audience |
| `created`, `updated` | des secondes, en **chaînes** (mesuré en base : ce sont des valeurs postées) |

Trois audiences, que son écran nomme « Publique » (`authorAll`), « Privée » (`authorAdmin` —
choisie d'office) et « Admins seulement » (`private`, proposée aux admins). Le bouton s'affiche à
qui administre l'élément porteur de l'appel, au déposant du commun et à ses référents
(`canEditDiscussion`).

### 16.2 L'action `creatediscussion`

`POST /co2/comment/creatediscussion` — `DiscussionCreateAction`, à côté de `DiscussionSpaceAction` ;
le modèle est `Discussion::createSpaceDiscussion()`. Session **exigée**.

**La requête ne porte que quatre valeurs, et aucune n'est un chemin** : `contextType` (`answers`),
`contextId`, `name`, `audience`. La clé, l'étape et le chemin sont fabriqués par le serveur, dans le
seul jeu de caractères `[A-Za-z0-9_]`. La clé et l'étape gardent l'allure de celles du legacy,
suivies d'un tirage : deux créations dans la même seconde ne visent pas la même clé.

| Qui | Ce qu'il peut créer |
|---|---|
| admin de l'appel — par lien direct, comme au §15.4 | les trois audiences |
| déposant du commun, référent | `authorAll`, `authorAdmin` |
| tout autre lecteur, et sans session | rien |

C'est `Discussion::creatableAudiences`, la même fonction qui alimente le champ
`creatableAudiences` de `space` : **l'écran ne propose que ce que l'action acceptera**.

**Le nom** est ramené à du texte nu (balises retirées, entités décodées), ses espaces réduits ; vide,
de plus de 120 caractères, ou sans aucun caractère qui se voie (des espaces sans chasse, des marques
de formatage seules), il est refusé — pas tronqué. Il s'enregistre en HTML, guillemets compris :
c'est la convention de la base (§15.3).

**L'écriture ne remplace jamais.** Son filtre exige que la clé n'existe pas
(`moreDiscussions.<clé>: {$exists: false}`), et le nombre de documents touchés est relu : deux
créations simultanées donnent deux discussions, ou un échec — pas une discussion écrasée. Un commun
porte au plus 50 discussions.

**Elle ne pose que la discussion.** La réponse n'est pas redatée (`updated`) — un écart voulu au
legacy, qui la date parce que son écriture générique date tout ce qu'elle touche. Créer une
discussion ne change rien à ce que le commun dit : redatée, la réponse remonterait dans les listes
triées par date, et le brouillon d'une édition en cours du commun serait tenu pour périmé — l'écran
d'édition le juge sur cette date (relecture du 13/10).

Une écriture que la base refuse laisse une trace au journal du serveur (niveau `error`, catégorie
`comment.discussion`) : sans elle, rien ne dirait pourquoi un commun ne reçoit pas de discussion.

| Code | Quand |
|---|---|
| `login` | pas de session |
| `bad-request` | un paramètre manque, n'est pas une chaîne, ou sort de sa liste |
| `hidden` | commun ou appel introuvable |
| `forbidden` | pas le droit de créer, ou pas avec cette audience |
| `bad-name` | nom vide, trop long, ou sans caractère visible, une fois nettoyé |
| `too-many` | le commun porte déjà 50 discussions |
| `failed` | l'écriture n'a pas abouti — rien n'est créé |

Aucune notification n'est émise à la création, comme dans le legacy ; elles viennent avec le
premier message (§3).

### 16.3 L'écran

- **Le « + »** vit dans l'en-tête de la colonne des fils de `SpacePanel`, et n'existe que si
  `creatableAudiences` n'est pas vide. Un visiteur, un lecteur sans rôle sur le commun ne le voient
  pas ; un espace refusé n'en annonce aucune. Il porte la couleur **primaire** depuis le 13/10
  (§10.15) : en `ghost`, il ne se trouvait pas.
- **`NewDiscussionForm`** s'ouvre **en ligne**, en tête de la colonne — pas un dialogue dans le
  dialogue : un nom (120 caractères), et les audiences annoncées, chacune avec ce qu'elle veut
  dire. « Privée » est cochée d'office quand elle est offerte, comme dans le legacy : ouvrir une
  discussion à tous doit être un geste, pas un oubli.
- **Créée, la discussion est ouverte aussitôt.** `useCreateDiscussion` la pose dans la liste en
  cache **avant** de la rendre — le panneau ne monte un fil que si la liste le porte (§15.4), et
  l'ouvrir avant la relecture aurait dit « introuvable » le temps d'un aller-retour. Elle y est
  rangée où le serveur la rangera (`withDiscussion` : par titre, sans la casse ni les accents) ; la
  liste est relue ensuite, dans tous les cas.
- **Un envoi à la fois**, et la garde est synchrone : l'état « en cours » de la mutation n'arrive
  qu'au rendu suivant, deux Entrée coup sur coup seraient parties avant lui — deux discussions du
  même nom. La mutation n'est jamais rejouée d'elle-même.
- **Une erreur se dit par son code**, dans la langue de l'écran. Deux pannes ont leur phrase, parce
  qu'on n'y sait pas si la discussion existe : une réponse illisible (`unreadable`), et l'absence
  de réponse — coupure du réseau, erreur du serveur à partir de 500 (`uncertain`). Dans les deux
  cas la liste est relue, et il est dit de la vérifier avant de recommencer : « Réessayez » en
  ferait créer une seconde, du même nom.
- **Le formulaire se réduit et défile** dans une colonne trop basse (un téléphone à l'horizontale,
  clavier ouvert) : ses boutons restent atteignables.
- **Le clavier** : le champ du nom a le focus à l'ouverture ; Échap referme le formulaire, pas la
  modale (`data-comment-escape`, §10.7) ; « Annuler » rend le focus au « + » ; une fois la
  discussion créée, c'est son titre qui le reçoit — le formulaire qui le tenait a disparu.
- Créer, c'est **changer de fil** : l'entrée d'historique de l'ouverture est remplacée, et fermer
  la défait toujours (§15.5).

### 16.4 Preuves

Du 12/10, sur le code décrit ici ; les lignes « Navigateur », de la nuit du 12 au 13/10.

| Quoi | Résultat |
|---|---|
| Règles, hors base (§15.6), section « créer une discussion » | 30 vérifications de plus, 130 en tout : qui crée, quelle audience, le nom, la forme écrite, le fil rendu, la clé déjà prise, l'écriture refusée par la base, le plafond |
| Contre-épreuve par mutation de `Discussion.php` | 143 mutations tuées sur 143, dont 45 sur la création |
| Sonde contre le vrai backend, trois identités | 51 vérifications : refus (rien n'est écrit — empreinte de la réponse relue), audiences annoncées par `space`, création par le déposant et par l'admin de l'appel, forme enregistrée, audiences tenues en liste et en fil désigné ; **la réponse d'essai revient à l'identique** une fois nettoyée |
| Appel réel au SDK | refus du schéma et refus du serveur, sans rien créer (§14.8) |
| Tests unitaires de l'écran | 90 tests de plus dans six fichiers, dont deux nouveaux : lecture de la réponse, insertion dans la liste, mutation, formulaire, panneau — et le **parcours** assemblé, du « + » à la discussion ouverte |
| Contre-épreuve par mutation de l'écran | 95 mutations tuées sur 95 |
| Navigateur, déposant connecté, 1 440 puis 375 px, sans écriture | 44 et 46 vérifications : le pli « Sans discussion » rangé sous les étapes de l'appel ; le « + » ; le formulaire en tête de la colonne, sans débordement (287 px dans une colonne de 288, 375 dans 375), focus sur le nom ; « Privée » choisie d'office ; Échap et « Annuler » referment le formulaire — pas la modale — et rendent le focus au « + » ; une création qui échoue se dit dans le formulaire, qui garde le nom tapé |
| Navigateur, création réelle par le déposant, 1 440 puis 375 px | 56 vérifications à chaque largeur : la discussion s'ouvre aussitôt, son titre reçoit le focus, sa rangée se lit sous l'en-tête du pli replié ; elle est rangée sur le commun sous son nom et son audience ; aucun message, aucun courriel ; rechargée par son lien, elle s'ouvre pour son auteur — et pas pour un visiteur, à qui rien de son nom n'est servi. Le commun d'essai, relevé par son contenu (§15.7), est remis à son état d'avant après chaque essai |

### 16.5 Limites

- **Renommer** et **supprimer** restent au legacy. Une discussion renommée ou supprimée là-bas
  l'est ici à la relecture suivante.
- Le plafond de 50 discussions se juge sur la réponse lue avant l'écriture : deux créations
  simultanées, à la limite, peuvent le dépasser d'une.
- Le legacy prévient les autres écrans ouverts par son canal temps réel ; ici la discussion apparaît
  aux autres lecteurs à leur relecture suivante (§11.4).
- Un nom dont l'écriture en HTML dépasse 120 caractères reste accepté s'il en compte 120 au plus en
  texte : c'est le texte qui est borné.
- Un appel porté par une **personne** n'a pas d'admin au sens de la règle (un lien direct sur
  l'élément porteur, §15.4) : une discussion « Admins seulement » n'y est ni créable, ni lisible.
- La discussion créée ne redate pas le commun (§16.2) : une liste triée par date de modification
  ne le fait pas remonter. Une discussion créée depuis le legacy, elle, le redate toujours.

## 17. Un fil par ligne de dépense — les paliers de la fiche (12/10)

Dans le legacy, chaque carte de la liste des dépenses porte « Commenter » : **un fil par ligne**.
L'espace d'un commun listait déjà ces fils quand ils avaient des messages (§15.3) ; rien, côté
React, ne permettait d'en lancer un, ni d'y entrer depuis le palier qu'il concerne. Demandé le
12/10.

### 17.1 Ce que fait le legacy

La liste des dépenses est une question de type `…newDepenseList`. Un appel la porte **deux fois**
— mesuré en base de développement le 12/10, sur les 21 appels qui l'utilisent, tous bâtis ainsi :

| Étape | Question | `subType` | Sur l'appel de test |
|---|---|---|---|
| dépôt (`aapStep1`) | `depense` | `depense` | « Les étapes du projet et leur besoin financier » |
| financement (`aapStep3`) | `financer` | `finance` | « Financement » |

Les deux affichent les mêmes lignes — `answers.aapStep1.depense`, une constante de son gabarit — et
chaque carte y porte « Commenter », sans condition de rôle. Le fil qu'elle ouvre est posé sur
l'appel, comme un fil de question :

```
<appel>.<étape>.<commun>.<question>.question_<question>.comment
       .financement.depensekey.aapStep1-depense.depenseindex.<clé de la ligne>
```

`<étape>` et `<question>` sont ceux de la liste **d'où l'on clique** : une même ligne peut donc
avoir **deux fils**, un par liste. L'espace (« Commentaires ») montre une ligne dès qu'elle a un
message, titrée par son poste ; il ne propose pas celles où personne n'a écrit — on y vient par la
carte.

Aucun message de ce genre n'existe en base de développement (mesuré le 12/10) : la règle se lit
dans le code du legacy, et se prouve sur des données fabriquées (§17.5).

### 17.2 Ce que rend `space`

- **`line`** — sur un fil `expense`, la clé de sa ligne dans `answers.aapStep1.depense` (le rang
  d'un tableau, la clé d'un objet). `null` sur tout autre fil, sur une ligne d'une autre liste, et
  sur une ligne que le commun n'a pas ou plus. C'est ce qui permet à la fiche de retrouver le fil
  d'un palier qu'elle affiche.
- **Le fil d'une ligne se reconnaît à la forme EXACTE de son chemin** — celle que le legacy écrit,
  onze segments, chacun à sa place, rien après la clé de la ligne :
  `<appel>.<étape>.<commun>.<question>.question_<question>.comment.financement.depensekey.<étape-champ>.depenseindex.<clé>`.
  Un chemin plus long, ou rangé autrement, reste un fil de sa question : listé, titré par elle, il
  ne désigne aucune ligne et n'empêche pas de lancer le fil de la ligne (relecture du 13/10).
- **Un fil à lancer par ligne.** Avec `includeEmpty`, chaque ligne du commun qui n'a **aucun** fil
  en reçoit un, `virtual`, titré par son poste — à défaut, par le libellé de la liste — et rangé
  sous l'étape de cette liste. Une ligne retirée (un trou dans la liste) ou vide n'en reçoit pas.
- **Sur quelle liste il se pose** — `Discussion::expenseHome` : la liste de financement de l'appel
  (`subType: finance`) s'il en a une ; sinon sa première liste de dépenses, dans l'ordre de l'appel
  (étape, puis position de la question ; l'identifiant de l'étape départage). Une seule question,
  fixe, pour qu'une conversation ne se scinde pas selon l'écran d'où l'on vient.
- **Une ligne déjà commentée garde son fil**, quelle que soit la liste où il a été posé : elle n'en
  reçoit pas un second. C'est dans celui-là qu'on entre.
- **Conditions** : un appel `aap` (§15.3), qui **déclare** la liste des dépenses (`depense` à
  l'étape `aapStep1`) et porte au moins une question `…newDepenseList` ; au plus 200 lignes — au-delà
  on ne fabrique plus, et la liste se dit partielle (`truncated`). Ailleurs, rien n'est fabriqué,
  et `line` reste nul.
- **Coût** : la lecture de la réponse qui titrait déjà les lignes commentées — une, par `_id`, sur
  le champ des dépenses. Elle a lieu désormais à chaque appel pour un commun dont l'appel porte une
  liste de dépenses, commentée ou non.

Ces fils sont rendus à tous, comme les autres fils à lancer : ce que l'écran en **propose** est une
autre question (§17.3).

### 17.3 L'écran

- **`CommunMilestoneDiscussionButton`** — « Discuter », sur chaque palier de « Besoins financiers »
  (`CommunFinancingSection`) : dans l'en-tête de la carte, **à côté** du bouton qui la déplie,
  jamais dedans. Son compteur additionne les fils de la ligne ; une pastille dit les non-lus.
  **Sous 80 rem de fenêtre il se réduit à son icône et à son compteur** : le mot « Discuter »
  prenait au nom du palier la place qui lui restait — 42 px entre 640 et 767 px de fenêtre, mesuré
  le 13/10 ; 122 px depuis, et 250 au lieu de 170 de 768 à 1 279 px. Son nom accessible, lui, dit
  tout à toutes les largeurs.
- **Seulement si la fiche lit ses dépenses à `aapStep1`** — la liste que l'espace connaît (§17.2).
  Une fiche réglée sur une autre étape (`roles.depenseStepKey`) n'a pas de fil à apparier : par la
  clé seule, elle ouvrirait celui d'une autre ligne. Elle n'affiche donc aucun bouton de palier.
- **Quand il s'affiche** : l'espace propose un fil pour la ligne, et il y a de quoi lire ou écrire.
  Connecté, sur chaque palier ; sans session, seulement là où quelqu'un a écrit.
- **Où il entre** — `lineDiscussion` : dans le fil écrit le plus récemment ; faute de message, dans
  celui que le serveur propose de lancer. La liste de l'espace fait autorité, ici comme ailleurs.
- **La clé de la ligne se lit dans le document** (`resolveDepenseKey`), pas à la position du palier
  à l'écran : les deux ne coïncident que si les dépenses sont un vrai tableau.
- **Une modale, une requête.** Le bouton ne monte rien : il ouvre par l'adresse la modale que
  monte le bouton de la fiche (§15.5), sur le fil de sa ligne. Tous lisent la même entrée de cache
  — un bouton par palier ne coûte aucune requête, et aucun ne sonde.
- **Dans la colonne des fils**, une ligne où personne n'a écrit se propose à qui peut écrire, comme
  une question ouverte aux commentaires : dans le pli « Sans discussion », sous l'intertitre des
  dépenses. On y vient donc par le palier **ou** par la colonne. Sans session, pas de rangée — il
  n'y aurait rien à y lire. Le legacy, lui, ne liste que les lignes commentées (§17.4).
- **Ouverte depuis son palier**, la ligne vide se lit dans la colonne sous l'en-tête du pli
  replié, surlignée (§15.5) : on voit où l'on est sans rien déplier.
- **Le focus revient au palier.** La modale n'a pas de déclencheur (§15.5) : le bouton d'où l'on
  ouvre se **nomme**, le lanceur range ce nom dans l'entrée d'historique avec le reste
  (`useSpaceLauncher`, `opener`), et la fiche le retrouve à la fermeture — rechargement compris. Si
  le palier a disparu entre-temps, le focus revient au bouton de la fiche.
- **Son nom accessible commence par ce qu'on lit** : « Discuter du palier « … », 2 messages,
  1 non lu ».
- **Les jauges restent alignées.** Un palier sans bouton efface son emplacement ; dès qu'un autre
  palier de la liste en montre un, tous gardent la même largeur d'emplacement — 5 rem tant que le
  bouton se réduit à son icône, 10 rem à partir de 80 rem de fenêtre.
- L'import différé de la modale est partagé par les boutons de la fiche (`communDiscussion.ts`), et
  préchauffé au survol comme au focus.
- **Dans le formulaire d'édition aussi** (13/10) — `CommunFormLineDiscussions` : chaque ligne du
  champ « liste de dépenses » (`MilestoneListField`) porte le même bouton, réduit à son icône et à
  son compteur, à côté du bouton qui déplie la ligne. C'est « Commenter » sur la liste des
  dépenses du formulaire legacy. Le champ, lui, ne sait rien des discussions : il offre un
  emplacement par ligne (`MilestoneLineSlotContext`, lu par `useMilestoneLineSlot`), que la fiche
  remplit autour du formulaire qu'elle ouvre. Il dit à l'hôte la réponse qu'il édite, la clé de
  son input, sa liste et la position de la ligne ; l'hôte ne répond que pour les dépenses de SON
  commun.
- **Seule une ligne ENREGISTRÉE y a un bouton, et c'est celui de SA clé.** Le formulaire édite sa
  liste avant de l'enregistrer : une ligne ajoutée n'existe pas encore au document, une ligne
  retirée décale les suivantes. `resolveSavedDepenseKey` retrouve la ligne par son identifiant de
  palier (`milestone`), où qu'elle soit dans les deux listes ; sans identifiant, par sa position,
  et seulement tant que la liste n'a pas changé de forme — et que le document range ses dépenses
  dans l'ordre où le formulaire les liste. Dans le doute, pas de bouton : se tromper ouvrirait le
  fil d'une autre dépense. Les dépenses enregistrées sont celles de la réponse que la fiche a
  lue — c'est d'elles que le formulaire part ; cela tient tant que le formulaire n'enregistre qu'à
  sa soumission finale, ce qu'il fait ici.
- **La modale s'ouvre par-dessus le formulaire**, qui reste ouvert dessous, saisie comprise :
  c'est la modale de la fiche, pas une seconde. Le bouton du formulaire se nomme autrement que le
  palier de la fiche (`formMilestoneOpener`) — les deux sont à l'écran en même temps —, et le
  focus revient à celui d'où l'on a ouvert. Il porte `type="button"` : dans un formulaire, un
  bouton sans type le soumet, et celui-ci passait le formulaire à l'étape suivante en ouvrant la
  discussion (vu le 13/10).

### 17.4 Arbitrages

Tranchés le 12/10. Tous restent réversibles : aucun ne change un fil déjà écrit.

| Sujet | Arbitrage | L'autre lecture |
|---|---|---|
| Sur quelle liste se lance le fil d'une ligne | la liste de **financement** — le bloc « Besoins financiers » de la fiche est le pendant de cette étape, et le legacy titre ces fils « (Financement) » | la liste du dépôt ; c'est une règle du serveur (`expenseHome`) |
| Une ligne sans message dans la colonne des fils | **proposée à qui peut écrire**, dans le pli « Sans discussion » — c'est la règle de tout fil à lancer (`visibleSpaceThreads`) | la taire, comme le legacy : on n'y viendrait que par le palier |
| Retirer un palier fait glisser les fils des suivants (§17.6) | **laissé tel quel** : les chemins restent ceux du legacy | prévenir à la suppression ; ou rattacher le fil à un identifiant propre au palier, au prix de la lecture croisée avec le legacy |
| Un fil à lancer, ouvert alors que le pli est replié | **montré sous l'en-tête du pli**, surligné (§15.5) | le laisser replié avec les autres : seul le titre du fil disait où l'on est |

### 17.5 Preuves

Du 12/10, sur le code décrit ici ; les lignes « Navigateur » ont été rejouées sur l'état final,
dans la nuit du 12 au 13/10.

| Quoi | Résultat |
|---|---|
| Règles, hors base (§15.6), section « un fil par ligne de dépense » | 31 vérifications de plus, 161 en tout : la liste où le fil se lance, les lignes qui en reçoivent un, la clé rendue, la forme de la liste dans la réponse, le plafond, l'appel qui ne déclare pas la liste, le formulaire qui n'est pas `aap`. Une notice ou un avertissement PHP y compte désormais pour un échec |
| Contre-épreuve par mutation de `Discussion.php` | 61 mutations du lot tuées sur 61 ; les 143 d'avant, rejouées, tuées sur 143 |
| Appel au vrai backend, sans session, trois communs de l'appel de test | deux et cinq fils à lancer pour deux et cinq lignes, aucun pour un commun sans ligne ; quinze champs par fil ; le chemin est celui du legacy, à la lettre |
| Tests unitaires de l'écran | 95 tests de plus qu'avant ce lot (6 626 en tout, avec les trois de la correction du §15.6) : lecture de la ligne, règle d'affichage, discussion d'un palier, nom du bouton retenu par le lanceur, bouton, carte, fiche, fil ouvert sous le pli replié — et un **parcours** assemblé, du palier au fil ouvert puis au focus rendu |
| Contre-épreuve par mutation de l'écran | Le banc complet de l'écran, sur l'état final du lot : 559 mutations tuées sur 559, en 43 lots — dont, pour les deux arbitrages de la colonne, 68 (ligne vide proposée) et 49 (fil ouvert sous le pli) |
| Navigateur, sans session, 1 440 puis 375 px | 40 vérifications à chaque largeur : bouton sur le seul palier commenté, compteur des deux fils d'une ligne, modale ouverte sur le plus récent, focus rendu au palier, lien vers le fil d'une ligne vide, jauges alignées d'un palier à l'autre (à 1 440 px), aucune écriture. Et la **lecture croisée** : l'écran « Commentaires » du legacy, lu sans session, liste les mêmes fils aux mêmes chemins, titrés « … (Financement) » |
| Navigateur, compte de test connecté (ni membre ni déposant), 1 440 puis 375 px | 54 et 43 vérifications : un bouton sur chaque palier ; la ligne vide proposée dans le pli « Sans discussion », lisible une fois déplié, ouvrable de là ; ouverte depuis son palier, sa rangée reste à l'écran sous l'en-tête du pli replié, surlignée, rendue une seule fois ; Échap rend le focus au palier |
| Navigateur, écriture réelle par le déposant sur son commun, 1 440 px | 56 vérifications : le premier message posté depuis un palier vide est rangé sur l'appel, au chemin de la ligne sur la liste de financement ; le legacy le liste « … (Financement) » ; aucun courriel mis en file ; refermée, le palier compte son message. Le document de l'appel, **relevé par son contenu** avant et après (§15.7), est remis à son état d'avant |
| Écran étroit | La fiche ne défile plus horizontalement (mesuré : 128 px de trop à 375 px, 0 après) — un défaut antérieur à ce lot, corrigé à part : une adresse web insécable dans un texte élargissait toute la colonne, paliers compris |

### 17.6 Limites

- **Le fil suit la clé de la ligne, pas la ligne.** Retirer une dépense resserre la liste — dans
  le legacy comme ici (`pull`) : les fils des lignes qui la suivaient désignent alors la ligne
  d'après, et celui de la dernière ne désigne plus rien (il reste listé, titré par sa question).
  C'est le comportement du legacy, repris tel quel pour que les deux écrans lisent les mêmes fils.
- **Les deux fils d'une même ligne** (un par liste, écrits depuis le legacy) restent deux fils :
  la colonne les liste l'un et l'autre, sous le même titre ; le palier additionne leurs compteurs
  et ouvre le plus récent.
- **Un appel sans `…newDepenseList`** — les autres gabarits de budget du legacy — n'a pas de fil
  à lancer : leurs cartes désignent la dépense autrement dans le chemin, et ce cas n'a pas été
  étudié ici. Un fil déjà écrit sur une de leurs lignes reste listé (§15.3).
- **La question qui héberge le fil d'une ligne peut être n'importe quelle question de l'appel** :
  le legacy écrit celle d'où l'on a cliqué, et d'autres gabarits de budget que `…newDepenseList`
  portent des fils légitimes. `line` se décide donc sur la forme du chemin et sur l'existence de
  la ligne, pas sur le type de la question.
- **Dans le formulaire, une ligne n'a son bouton qu'une fois enregistrée** (§17.3) — et une fois
  l'espace relu : il ne propose un fil que pour une ligne qu'il a vue. Un commun qu'on dépose n'en
  a donc aucun tant qu'il n'est pas enregistré. Le bouton n'est posé que dans le formulaire ouvert
  depuis la fiche, qui monte la modale ; ailleurs, le champ n'affiche rien de plus.
- Le bloc « Suivi des actions » liste les mêmes paliers sans le bouton : une entrée par palier.

## 18. L'éditeur du composer (13/10)

> Le blocage B11 est levé : on voit la mise en forme en l'écrivant. Ce qui s'enregistre ne change
> pas — du markdown, le texte que le fil rend et que le legacy stocke. Les propriétés de
> `CommentComposer` sont les mêmes : aucun hôte n'a été touché.

### 18.1 Ce qui change pour qui écrit

- **La mise en forme se voit.** Gras, italique, barré, code, lien, citation, liste à puces, liste
  numérotée, bloc de code : neuf boutons, qui disent leur état (`aria-pressed`) et suivent le
  curseur. Les raccourcis du clavier (Ctrl+B, Ctrl+I…) et ceux qu'on tape (`**gras**`,
  `*italique*`, `~~barré~~`, `` `code` ``, `- `, `1. `, `> `, trois accents graves) marchent aussi.
  Une marque tapée prend en début de ligne — la seconde comprise —, derrière une espace, une
  apostrophe, un guillemet ou une parenthèse ; pas au milieu d'un mot, ni dans une adresse qu'on
  est en train de taper.
- **Ctrl+Entrée envoie ; Entrée va à la ligne** (arbitré le 13/10 — jusque-là, Entrée envoyait).
  Entrée garde partout son sens d'éditeur : un nouveau paragraphe, l'élément suivant d'une liste,
  une ligne de code ; Maj+Entrée passe à la ligne sans changer de paragraphe. Ctrl+Entrée —
  Cmd+Entrée sur un Mac — envoie d'où que ce soit, liste et bloc de code compris, et ne se sert pas
  de la liste des personnes pour en choisir une : c'est Entrée, ou Tab, qui choisit. Tant que
  cette liste est en route, Entrée l'attend au lieu de couper le paragraphe. Le bouton d'envoi dit
  son raccourci en infobulle ; sur un écran tactile, où il n'existe pas, le message part par son
  bouton.
- **Le texte part tel qu'on l'a tapé.** `[urgent] réunion ~10h, 2 * 3 = 6` s'enregistre sans une
  barre oblique inverse : un message se lit aussi là où le markdown n'est pas rendu — l'écran
  legacy, une notification, la citation d'une réponse. Seul ce qui, relu, deviendrait autre chose
  est neutralisé (`a *x* b` tapé en toutes lettres).
- **Après un Maj+Entrée, une ligne tapée comme une liste, une citation ou un filet en devient une**
  dans le fil (`- pain`, `1. d'abord`, `> cité`, `---`) — ce que faisait déjà l'ancien champ. En
  tête de paragraphe, l'éditeur fait lui-même la liste ; qui la défait garde le signe.
- **Une mention est un objet du texte.** `@` et deux lettres ouvrent la liste des personnes ; la
  mention choisie s'affiche par son NOM, comme le fil l'affichera, et se retire d'un bloc. Elle
  part en `@slug`, avec la personne — et seulement si elle est encore dans le texte à l'envoi.
- **Un lien se pose par une adresse.** Le bouton ouvre un champ, pas un dialogue de plus ; le
  protocole qu'on n'écrit jamais est complété (`exemple.org` → `https://exemple.org`, un courriel
  → `mailto:`) ; seuls `http`, `https` et `mailto` passent. Dans un lien, le champ reprend son
  adresse et offre de le retirer.
- **Une adresse tapée ou collée devient un lien d'elle-même, et mène où on la LIT.** Complétée ou
  corrigée après coup, sa cible suit son texte ; collée par-dessus une autre adresse, elle la
  remplace. Un lien posé par le bouton, lui, garde la cible qu'on lui a donnée, quel que soit son
  texte.
- **Coller du texte, c'est le relire comme le fil le lira** : une liste collée reste une liste.
  Des cellules de tableur se collent par leur texte, séparations gardées. Un lien collé ne garde
  que sa cible. Coller ou déposer une image en fait une pièce jointe, jamais du texte.
- **Un bloc vide n'est pas un message** : une liste, une citation ou un bloc de code sans rien
  dedans ne s'envoient pas.
- **Corriger un message** l'ouvre tel que le fil le rend, mentions comprises. Renvoyé sans y
  toucher, il se REND pareil ; son texte, lui, est réécrit dans la forme de l'éditeur s'il n'y
  était pas déjà (§18.7).

### 18.2 Les pièces

| Pièce | Rôle |
|---|---|
| `components/CommentComposer.tsx` | La **coquille** : bandeau « réponse à », barre d'outils, images, phrases d'état, envoi. Elle n'importe rien de l'éditeur |
| `components/editor/EditorSurface.tsx` | L'**éditeur** (Tiptap) : la zone où l'on écrit, la liste des mentions, le clavier, le collage |
| `components/editor/editorStore.ts` | Le **chargement** de l'éditeur, une fois pour l'onglet, côté client seulement |
| `components/editor/editorTypes.ts` | Ce que la coquille et l'éditeur se disent : la liste des mises en forme, l'état, la poignée |
| `lib/richText/extensions.ts` | Le **schéma** d'un message : ce que le markdown du fil sait écrire, rien de plus. Sa marque de code est la nôtre (celle du kit chasse toute autre marque : un code dans un lien ou dans un gras ne se relisait pas), et la marque de lien y porte un drapeau, `explicit`, pour un lien ÉCRIT |
| `lib/richText/markdownBridge.ts` | Le **pont** : le texte d'un message → le document de l'éditeur, et retour |
| `lib/richText/linkAddress.ts` | L'adresse tapée dans le champ « lien » → celle qu'on enregistre |
| `lib/markdownEngine.ts` | **Le** réglage de `markdown-it`, pour le fil qui rend et pour l'éditeur qui relit |
| `lib/commentProse.ts` | Les classes de mise en forme d'un message, pour le fil et pour l'éditeur |

**La coquille et l'éditeur ne se parlent que par une poignée** (`EditorSurfaceHandle` : basculer
une mise en forme, poser un lien, insérer un émoji, lire ce qui partirait, vider) et un rappel
d'état (vide ou non, marques actives). L'envoi et ses retenues — message vide, téléversement en
cours, image en échec — restent dans la coquille, d'où qu'il vienne : le bouton, ou Ctrl+Entrée.

**L'éditeur n'entre ni dans le rendu serveur ni dans le démarrage d'une page.** Son code est
demandé au montage du premier composer de l'onglet, puis gardé. Un magasin de module lu par
`useSyncExternalStore`, plutôt qu'un chargement différé sous `Suspense` : au serveur il vaut
toujours « pas encore là » — même balisage des deux côtés —, et tout composer monté ensuite le
trouve tout de suite. D'ici là la coquille montre un champ inerte de même allure, barre et envoi
fermés ; si le code n'arrive pas, elle le dit et offre de le redemander.

**Dépendances ajoutées** (versions épinglées dans `package.json`) : `@tiptap/core`,
`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-mention`,
`@tiptap/extensions`, `@tiptap/suggestion` en 3.31.4, et `prosemirror-markdown` en 1.13.8. La
feuille de style de l'éditeur n'est pas injectée dans la page : ses quelques règles vivent dans
`styles.css`, avec le reste du module.

### 18.3 Le pont markdown

Deux règles, que les tests rejouent cas par cas avec le moteur du fil pour juge :

1. **ce que rend le texte sorti est ce que montrait l'éditeur** ;
2. **le texte sort tel qu'on l'a tapé chaque fois que le fil le rendrait pareil** (§18.1).

- **Relire** : `markdown-it` réglé comme le fil (`createCommentMarkdown`), plus une règle qui fait
  un nœud de chaque `@slug` que porte le message — la même que le fil : le plus long slug d'abord,
  ni lettre ni tiret derrière, jamais dans du code. La règle des tableaux est coupée dans
  l'éditeur seulement : il n'a pas de nœud pour eux, leur source reste du texte. Un lien relu
  d'un `[texte](adresse)` est marqué *écrit* ; une adresse que le fil lie de lui-même, ou qu'on a
  mise entre chevrons, ne l'est pas.
- **Écrire** : chaque bloc de premier niveau est écrit deux fois — tout échappé, puis **nu**, tel
  qu'on l'a tapé — et le fil départage : s'il rend les deux à l'identique (mentions liées
  comprises), c'est le nu qui sort. L'échappement large couvre les signes qui ouvriraient une
  marque, un code ou un lien, les marqueurs de bloc en tête de paragraphe (tiret, `+`, chevron,
  croisillon, « 1. », « 1) » — seuls sur leur ligne aussi), les entités (`&amp;` tapé reste cinq
  caractères), les chevrons d'un lien automatique, et les espaces de tête qui feraient un bloc de
  code — en tête de bloc, et derrière une ligne vide. La bibliothèque de sérialisation n'y
  suffisait pas : sa règle laissait `__init__` sortir en italique, et « 1. » seul ouvrir une liste
  vide. La vérification se fait par bloc : dans une liste, un seul élément qui a besoin d'être
  échappé fait échapper la liste entière.
- **L'exception assumée** à la première règle : derrière un saut de ligne, un marqueur de bloc
  n'est pas échappé (§18.1). Une clôture de code, elle, reste neutralisée : ouverte, elle
  avalerait la suite du message.
- **Une adresse tapée sans être un lien** — on envoie avant que l'éditeur l'ait liée — sort
  telle quelle. À protocole (`https://…`), le fil la lit dans la source, signe pour signe : une
  barre oblique inverse posée devant un `~` ou un `_` partirait dans le lien ; suivie sans espace
  d'un signe échappé, d'un gras qui s'ouvre ou d'une mention, elle s'écrit entre chevrons, où
  elle s'arrête où elle doit. Sans protocole (`www.…`, un domaine, un courriel), le fil la lie
  après coup : elle reste nue si, prise seule, elle se relit entière, et sinon elle est échappée
  comme un texte.
- **Les adresses sans protocole d'un bloc sont vérifiées ensemble.** Le fil les lie APRÈS avoir lu
  les marques : chacune se relit seule, mais le souligné ouvrant de l'une et le souligné fermant
  d'une autre feraient un italique de l'une à l'autre — deux liens coupés, deux signes perdus
  (`www.exemple.org/_a` puis `fr.wikipedia.org/wiki/P_(h)`). Le bloc écrit est donc rendu, et
  chaque adresse laissée nue doit en ressortir liée, entière, autant de fois qu'elle y est. Sinon
  il est réécrit sans en laisser aucune nue : une adresse liée par l'éditeur prend la forme
  `[texte](adresse)`, une adresse tapée en texte est échappée (§18.7). Avec son protocole, une
  adresse se lit dans la source, avant les marques : elle n'est pas concernée.
  Dans le texte d'un lien écrit, une adresse est un texte comme un autre.
- **Un lien** s'écrit par son texte seul quand le fil le referait de lui-même (une adresse,
  `www.…`, un courriel) — y compris suivi d'un point ou pris entre parenthèses, où le fil s'arrête
  de lui-même où il faut ; entre chevrons quand, sans eux, il lirait autre chose (une lettre collée
  devant, un gras collé derrière) ; sinon `[texte](adresse)`. C'est le rendu du fil qui en juge,
  pas une règle tenue à côté.
- **La cible d'un lien dont le texte est une adresse est cette adresse** — sauf lien écrit.
  L'éditeur lie de lui-même une adresse, puis laisse corriger son texte sans toucher à sa cible :
  on lisait une adresse, on allait à une autre. Et l'adresse est ce qu'on lit d'un trait : du
  texte tapé tout contre elle la prolonge, tant que l'ensemble en est une — selon le navigateur,
  une lettre tapée en fin de lien y entre ou reste dehors (sous Chrome elle reste dehors, mesuré
  le 13/10). Une adresse relue entre chevrons, elle, s'arrête où son auteur l'a dit.
- **Une mention ne tient pas dans un lien** : le fil en fait elle-même un lien, et deux liens ne
  s'emboîtent pas. Le lien s'arrête devant elle et reprend derrière.
- **Deux listes de même nature posées l'une contre l'autre restent deux listes** : une sur deux
  change de signe — `+` après `-`, `1)` après `1.`. Des lignes vides ne suffisent pas à les
  séparer : le markdown n'en ferait qu'une, espacée, et la seconde liste numérotée prendrait la
  suite de la première. L'éditeur les laisse naître — la ligne vide supprimée entre deux listes,
  « 1. » tapé juste derrière une liste numérotée.

### 18.4 Le clavier, et Échap dans une modale

- Le clavier de l'éditeur passe **après** la suggestion de mention — qui capte Entrée, Tab et les
  flèches tant que sa liste est ouverte — et **avant** les raccourcis du kit, qui font de
  Ctrl+Entrée un saut de ligne, ou la sortie d'un bloc de code. La liste des personnes ne retient
  ni Ctrl+Entrée ni Cmd+Entrée : ce sont des envois, pas des choix.
- **Échap se traite hors de l'éditeur**, en capture, sur son conteneur : renoncer à la mention en
  cours, sinon annuler l'édition, sinon rien. Dans la modale des discussions, pour ne pas se
  fermer, la modale neutralise la touche (§10) — or l'éditeur ignore une touche déjà neutralisée :
  ni la liste ni l'édition ne se refermaient (vu au navigateur le 13/10). Traitée, la touche ne
  descend pas plus bas. La revendication tient dès qu'une mention est en cours, liste affichée ou
  non : entre « @mar » et l'arrivée des personnes, Échap y renonce sans rien fermer d'autre.
  Pendant une composition (accent mort, saisie asiatique), Échap appartient à la saisie.
- **Les marques tapées suivent le markdown du fil**, pas le kit : le texte marqué ne commence ni ne
  finit par une espace — le kit mettait en italique le « 3 » de « 2 * 3 * 4 ». Elles s'ouvrent
  derrière ce qui OUVRE (une espace, une apostrophe, un guillemet, une parenthèse), pas derrière
  toute ponctuation : derrière une barre oblique, le `_notes_` d'une adresse prenait, et l'adresse
  partait amputée de ses soulignés (vu au navigateur le 13/10). Dans une adresse en cours de
  frappe, rien ne prend. Les règles de collage du kit sont coupées : ce qu'on colle est déjà relu
  comme du markdown.
- **Jamais sur un éditeur détruit.** La bibliothèque crée l'éditeur au rendu et le défait une
  milliseconde plus tard si le montage tarde. Demander ses commandes à un éditeur mort lève (seule
  une chaîne de commandes y est tolérée) ; dans un effet — le focus donné au montage, ou à
  « Répondre » —, cette levée démontait l'arbre. Les effets et la poignée s'en gardent, et le
  composer retrouve un éditeur vivant au rendu suivant.

### 18.5 Accessibilité

Le champ est une zone éditable : son rôle `textbox` est posé explicitement, avec
`aria-multiline`, un nom (ce qu'on y fait : écrire, répondre à quelqu'un, corriger), une
description de la mise en forme et du clavier (Ctrl+Entrée envoie, Entrée ouvre un paragraphe) —
qui suit le pointeur : au doigt, elle ne promet aucun raccourci —, et les attributs de la liste de
mentions (§12.3) —
`aria-controls` et `aria-activedescendant` seulement quand elle est ouverte. Le texte d'attente
est une décoration, jamais du texte du message. La barre d'outils est un groupe nommé ; ses
boutons sont des bascules, et cliquer l'un d'eux ne prend pas le focus au champ ; dans un bloc de
code, où rien ne se met en forme, ceux des marques et du lien sont inertes. Refermé, le champ
d'adresse d'un lien rend le focus au texte. Le bouton d'envoi porte son raccourci
(`aria-keyshortcuts`, et une infobulle hors écran tactile). Le conteneur de l'éditeur est en
`aria-live="off"` :
le composer d'une édition vit dans le journal du fil, et ce qu'on y tape n'est pas une annonce.

### 18.6 Preuves

Du 13/10, sur le code décrit ici — corrections de la relecture (§19) et suites du même jour
(§19.5) comprises.

| Quoi | Résultat |
|---|---|
| Tests unitaires | 404 tests dans les six fichiers de l'éditeur, dont cinq nouveaux ; ils en remplacent 63 (l'ancien champ et ses manipulations de texte). Le pont : 172 — allers-retours et documents « tapés », jugés par le rendu du fil ; le composer avec le vrai éditeur : 164 ; la coquille seule, l'éditeur remplacé par un témoin : 31 ; l'adresse d'un lien : 23 ; le chargement : 7 ; le graphe des imports : 7 |
| … ce que **coûte** l'éditeur | le graphe des imports statiques de l'entrée du module, lu dans les sources : ni Tiptap ni ProseMirror, une seule porte — l'import différé du magasin ; et au rendu serveur le composer écrit son champ d'attente, rien de l'éditeur, même quand son code est déjà chargé |
| … **Échap dans une modale** | la modale est rejouée par ce qu'elle fait à la touche : un écouteur en capture qui la neutralise. L'édition s'annule et la liste de mentions se referme quand même |
| Le pont, essayé sur près de deux cents textes tapés | signes du markdown, marqueurs de liste, entités, adresses suivies ou entourées de signes : les écarts trouvés — souligné doublé, « 1. » seul, adresse à tilde ou à souligné — sont corrigés et devenus des tests |
| Le pont, sur 8 000 documents tirés au hasard | aucune levée — 4 000 documents quelconques, que l'éditeur ne produit pas tous, et 4 000 « comme on en tape ». Parmi ces derniers, 45 se rendent autrement une fois relus puis réécrits, comme le fait une correction (66 avant les deux corrections du §19.5). Les causes, retirées du tirage l'une après l'autre : un « @nom » tapé en texte dans un message qui mentionne la même personne — le fil le lie, la relecture en fait une mention (il en reste 14) ; un saut de ligne en bord de paragraphe, §18.7 (il en reste 4) ; une adresse sans protocole collée à une autre adresse, sans espace (il en reste un : une ligne tapée « + 1. … » derrière un saut de ligne, dans un élément de liste) |
| Contre-épreuve par mutation, sur des copies | 266 mutations en treize lots, toutes tuées — 175 en onze lots avant la relecture, 242 après elle. Aux suites du §19.5, les sept lots touchés ont été rejoués (238 mutations) : deux survivantes sur le pont — la vérification par bloc rendait deux gardes plus fines invisibles aux tests — ont donné un test, puis le lot est repassé (98 sur 98) |
| Navigateur, compte connecté sans rôle sur le commun, 1 440 puis 375 px, aucune écriture | 60 vérifications à chaque largeur : le champ et sa boîte, la frappe, Maj+Entrée, la barre et son état, « - » qui ouvre une liste, le champ d'adresse d'un lien, un collage relu comme du markdown, la liste des mentions sur une vraie recherche, Échap qui la referme sans fermer la modale, le markdown qui partirait (l'envoi reçoit un refus de la sonde avant le serveur) et le brouillon rendu, un message rouvert en correction puis renvoyé à la lettre, Échap qui annule l'édition. Sept points de la relecture : des signes qui ne font rien partent tels quels, une marque tapée prend en tête d'une seconde ligne et derrière une apostrophe, une adresse liée puis complétée mène où on la lit, une ligne à tiret derrière Maj+Entrée part telle quelle, des cellules de tableur collées gardent leurs séparations, une liste ou une citation vides ne s'envoient pas. Et neuf des suites : Entrée seule ouvre un paragraphe sans rien envoyer ; Ctrl+Entrée envoie — d'un paragraphe, d'une liste, d'un bloc de code ; le bouton dit son raccourci ; « 1. » tapé derrière une liste numérotée montre deux listes, qui partent comme deux ; deux adresses sans protocole tapées sont liées par l'éditeur et partent entières, sans italique. Aucune feuille de style ajoutée à la page |
| Navigateur, écriture réelle par le déposant sur son commun, 1 440 px | 44 vérifications, rejouées avec Ctrl+Entrée : un message mis en forme est posté depuis un palier — en base, c'est du markdown au chemin de la ligne ; le fil le rend comme on l'a écrit ; corrigé par l'interface, seul le mot ajouté change en base. Aucun courriel mis en file. Le document de l'appel, relevé par son contenu (§15.7), est remis à son état d'avant |
| Navigateur, sondes des lots précédents | passages sans écriture aux mêmes comptes qu'aux §15.6, §16.4 et §17.5 (35 et 35 · 44 et 46 · 40 et 40 · 54 et 43) et création réelle d'une discussion à 1 440 px (56) : rejoués à la relecture, avant les suites — aucun n'envoie de message. L'écriture depuis un palier (56), elle, est rejouée avec Ctrl+Entrée |

### 18.7 Limites

- **Un message corrigé est réécrit dans la forme de l'éditeur.** Il se rend pareil, mais son texte
  change s'il a été écrit autrement — depuis le legacy, ou à la main : `_x_` devient `*x*`,
  `* un` devient `- un`, `1)` devient `1.`, une liste espacée est resserrée, le titre d'un lien
  (`[texte](adresse "titre")`) est perdu, et un bloc de code ou une citation placés en tête d'un
  élément de liste en sortent.
- **Un tableau tapé devient un tableau.** L'éditeur n'en a pas le nœud : les lignes d'un tableau y
  restent du texte, et le fil, lui, les rend en tableau. C'est aussi ce qui garde lisible un
  message legacy qui en porte un — sauf si l'une de ses cellules contient une barre verticale
  échappée (`\|`), qui ne survit pas à une correction.
- **Une marque bordée d'une ponctuation et collée à une lettre ne se relit pas**
  (`**gras.**suite`, un gras collé à un mot) : c'est la règle du markdown lui-même. Avec une
  espace, ou la ponctuation hors de la marque, elle se relit.
- **Deux sauts de ligne de suite** deviennent un changement de paragraphe à la relecture ; un saut
  de ligne posé en tête ou en fin de paragraphe ne se voit pas dans le fil ; les espaces de tête
  d'une ligne ne sont pas gardées, et plusieurs espaces de suite, visibles dans l'éditeur, n'en
  font qu'une dans le fil — comme avec l'ancien champ.
- **Là où le markdown n'est pas rendu, une liste posée contre une autre se lit sous son second
  signe** (`+ …`, `1) …`) : c'est ce qui les garde distinctes dans le fil (§18.3).
- **Pas de titre souligné** : le fil ne le rend pas (§5.5), l'éditeur ne le propose pas. Les titres
  à croisillons, si, depuis le 14/10 (§18.9), comme l'image dans le texte (§21).
- **`__nom__` tapé ou collé passe en gras**, comme le markdown le lirait — un collage se relit
  comme du markdown. Écrit puis annulé d'un Ctrl+Z, il reste du texte.
- **`[texte](adresse)` tapé reste du texte** : un lien nommé se pose par le bouton.
- **Une adresse sans protocole où une marque se lirait vraiment** (`www.exemple.org/_a_`) garde
  son texte, mais le fil n'en lie que le début : il lit les marques avant de chercher les adresses.
  Il en va de même de deux adresses sans protocole dont les signes se répondent (§18.3), quand
  elles sont restées du texte — collées sans mise en forme, envoyées avant que l'éditeur les ait
  liées, ou relues d'un message écrit ailleurs : leur texte est gardé, signes compris, mais le
  fil n'en lie que le début. Liées par l'éditeur, elles sont écrites en entier.
- **Une mention suivie, sans espace, d'une lettre ou d'un tiret** est notifiée mais non liée dans
  le fil, qui lit alors un nom plus long. Passé en bloc de code, un paragraphe garde ses mentions
  en texte : elles n'y sont plus des mentions.
- **La barre d'outils compte jusqu'à douze arrêts de tabulation** : pas de navigation aux flèches.
  Ctrl+Entrée envoie depuis le champ, Échap annule une édition — on n'a pas à la traverser.
- **Un envoi dont l'issue est incertaine** (réseau coupé) ne rend pas le brouillon — règle
  antérieure du fil (§10) : le serveur a peut-être écrit. Seul un refus net le rend.
- **L'éditeur indisponible, on ne peut pas écrire** : la coquille le dit, offre de le redemander
  et conseille de recharger la page, mais il n'y a pas de champ de secours.
- **Non mesuré** : le poids du morceau de l'éditeur sur un build de production — la preuve du
  §18.6 est son absence du graphe de démarrage, pas une taille.
- **Non vérifié** : un lecteur d'écran réel, un appareil tactile réel (seules l'aide du champ et
  l'infobulle du bouton y dépendent du pointeur, et leurs tests le rejouent), la saisie par composition sur un vrai clavier (accents morts, claviers
  asiatiques), un autre navigateur que Chrome ; l'ordre d'événements qui détruit l'éditeur avant
  ses effets (§18.4) n'a pas été observé — la garde est tenue par un test qui le détruit ; et une
  mention **envoyée** pour de vrai — elle notifierait la personne — n'a été rejouée qu'en test :
  au navigateur, la mention est posée dans le texte, pas postée.

### 18.8 L'italique se voit (14/10)

Signalé à l'usage : « Italique » sur une sélection ne faisait rien. L'éditeur, lui, posait bien la
marque (`<em>`, bouton enfoncé) ; c'est le **dessin** qui manquait. Deux causes, toutes deux hors
du module :

- le chargeur de polices du moteur ne demande à Google Fonts que des graisses droites
  (`wght@400;500;600;700`, `GoogleFontsLoader`, `extractCriticalResources`) — aucune face italique ;
- la plupart des feuilles de thème posent `font-synthesis: none` sur `:root` (repris du gabarit
  Vite) : le navigateur n'a pas le droit de fabriquer l'italique qu'il n'a pas.

Mesuré au navigateur : le mot marqué était dessiné **pixel pour pixel** comme le texte droit. Le
correctif est dans la feuille du module : `.comment-thread em, .comment-thread i { font-synthesis:
style; }` — l'italique se synthétise, dans le champ comme dans le fil ; le gras, qui a ses vraies
graisses, n'est pas touché. Preuve : `sonde-italique.cjs` (hors dépôt), sans écriture — même
capture avant, mot incliné après.

**Hors du module, la même cause rend l'italique invisible partout** sur ces thèmes (une prose,
un article). Deux corrections possibles, à arbitrer : permettre la synthèse de l'italique dans les
feuilles de thème, ou demander les vraies faces italiques — en sachant que toutes les familles n'en
ont pas (Roboto Slab), et que l'API de Google Fonts refuse alors toute la demande.

### 18.9 Les titres (14/10)

Demandé à l'usage : « il manque les formats de titre », avec pour modèle la barre de l'éditeur du
legacy — gras, italique, barré, **un bouton de titre à six niveaux**, code, bloc de code, citation,
listes, filet, lien, image, surligneur.

**Dans l'éditeur.**

- Un bouton « Titre », après « Barré » comme dans le legacy, ouvre un menu : « Texte normal », puis
  « Titre 1 » à « Titre 6 ». Le niveau du bloc au curseur y est coché, et le bouton se dit actif
  dans un titre. Refermé, le menu rend le focus au texte, pas à son bouton. Il est **non modal**
  (`modal={false}`) : le composer vit souvent dans un dialogue, et un menu Radix modal ouvert sous
  un dialogue monté laisse la page figée.
- `# ` à `###### ` tapés en tête de ligne ouvrent un titre, et l'aide du champ le dit. Les
  raccourcis de la bibliothèque, Ctrl+Alt+1 à 6, s'y ajoutent — sauf sous Windows, où elle ignore
  Ctrl+Alt : c'est AltGr, qui tape « # » et « @ » sur un clavier AZERTY.
- Le bouton est inerte sur la première ligne d'un élément de liste : le schéma de l'éditeur y veut
  un paragraphe.
- **Un titre tient sur une ligne**, parce que le markdown n'en connaît pas d'autres : `# un` puis
  `deux` à la ligne font un titre et un paragraphe. Un saut de ligne posé dans un titre — Maj+Entrée,
  un paragraphe de plusieurs lignes ou un bloc de code changés en titre, un collage — le coupe donc
  à son premier saut : la suite devient **un** paragraphe, ses autres sauts compris. En tête de
  titre, le saut ne le vide pas : la ligne vide passe au-dessus, comme avec Entrée. Ctrl+Z défait le
  saut et la coupe d'un seul geste — sans quoi la coupe se referait aussitôt.

**Ce qui part** est le markdown du legacy — `#` à `######`, une espace, le texte —, qui se relit
dans les deux sens. Un `#` tapé comme du texte reste du texte : en tête de ligne, derrière
Maj+Entrée ou dans une citation compris, il est échappé (`\#`) s'il ouvrirait un titre ; `#mot` et
sept croisillons n'en ouvriraient pas et restent nus. Des croisillons en fin de titre, derrière une
espace, seraient lus comme sa clôture : ils sont échappés (`# Langage C \#`). Le fil, lui, rend les
titres à croisillons ; le titre souligné (`===`, `---`) reste coupé (§5.5).

**Dans le fil**, un titre est à l'échelle d'un **message**, jamais d'une page : 20, 18, 16, 14, 12
et 12 px, en demi-gras, le titre 6 atténué — l'échelle de GitHub, ramenée au texte d'un message.
Elle vit dans `styles.css`, pas en classes Tailwind : la plupart des thèmes posent `.prose hN`
**hors couche** — la couleur ; et sur parent62 et rezo-sante-reunion, qui ne chargent pas le plugin
typography, la taille, la police et les marges d'un titre de page —, et une règle hors couche bat
tout utilitaire, quelle que soit sa spécificité. `.comment-thread .prose hN` passe devant
`.prose hN`. Le champ est sous les mêmes règles : ce qu'on y tape est ce que le fil montrera. La
police du thème, elle, est gardée.

| Quoi | Résultat |
|---|---|
| Tests unitaires | le rendu (six niveaux ; sept croisillons, `#mot`, le titre souligné restent du texte ; un titre n'ouvre aucune porte au HTML) ; le pont (allers-retours, relecture d'un message du legacy, marques, liens et mentions dans un titre, clôture, citation, échappement en tête de ligne — six croisillons, un seul, derrière un saut — et échappement minimal ailleurs) ; le composer avec le vrai éditeur (14 cas : frappe, Maj+Entrée au bout, au milieu, en tête et dans une citation, trois lignes changées en titre, collage, bloc de code, Ctrl+Z, menu, liste) ; la coquille (menu, ordre de la barre, bouton inerte, menu non modal, focus jamais rendu à son bouton). Les quatre fichiers : 21, 185, 178 et 37 tests |
| Contre-épreuve par mutation, sur des copies | 35 mutations sur les cinq fichiers des titres. Premier passage : 26 tuées, 9 survivantes — six règles sans test (un titre dans une citation, le menu non modal, le focus jamais rendu à son bouton, six croisillons, un croisillon seul, l'échappement minimal d'un bloc qu'il faut échapper), un défaut redondant retiré (`?? false`, que la barre inerte couvrait déjà), et une mutation **meilleure que le code**, adoptée : la clôture d'un titre s'échappe aussi dans un bloc écrit nu, ce qui épargne les barres obliques du reste. Second passage : 34 sur 34. Chaque passage est borné en durée et en mémoire, et une copie qui lève dès son chargement prouve d'abord que le test charge bien la copie |
| Navigateur, compte connecté sans rôle, aucune écriture | 24 vérifications : `# ` tapé, Maj+Entrée, le menu — niveaux, coche, focus rendu —, le markdown qui partirait (l'envoi reçoit un refus de la sonde avant le serveur) ; dans le fil, un message aux six titres — la réponse de lecture d'un fil est réécrite au vol, rien n'est écrit — : balises, ordre, tailles, graisse, couleur du titre 6. Contre-épreuve : les règles hors couche de parent62 injectées dans la page n'y changent rien ; la règle du module retirée de sa feuille, le titre 1 prend leur taille de page (30,4 px) |

**Limites.**

- Ni filet ni surligneur dans la barre, que le legacy a : le filet existe dans l'éditeur (`---`
  tapé) sans bouton ; le surligneur — `==texte==`, que le legacy écrit — n'est lu ni par le fil ni
  par l'éditeur.
- Un titre en tête d'élément de liste (`- # titre`, écrit à la main ou par le legacy) se lit dans
  le fil ; corrigé dans l'éditeur, il est réécrit sous sa puce, et le fil le sort alors de la liste.
- Non vérifié : Ctrl+Alt+1 à 6 sur un vrai clavier, sous Windows comme ailleurs — lu dans la source
  de la bibliothèque.

## 19. Relecture indépendante du 13/10

Avant d'être proposés au commit, les lots des §15 (corrections), §16, §17 et §18 ont été relus
d'un bloc par quatre relecteurs indépendants — backend, écran de l'espace, éditeur, tests et
documentation. Chaque constat a été vérifié dans le code, et au navigateur quand il s'y prêtait,
avant d'être traité. Les chapitres ci-dessus décrivent l'état qui en résulte ; celui-ci dit ce qui
a changé, où le lire, ce qui le prouve (§19.4), et ce qui a suivi le même jour (§19.5).

### 19.1 Backend

| Constat | Ce qui a changé | Où |
|---|---|---|
| Le fil d'une ligne de dépense se décidait sur des mots trouvés n'importe où dans le chemin | Forme **exacte** du chemin (onze segments) ; `line` seulement pour une ligne que le commun a | §17.2 |
| Au-delà de 200 lignes, la liste s'arrêtait sans le dire | `truncated` | §15.3, §17.2 |
| `includeEmpty` posté en tableau était lu comme absent | Refusé (`bad-request`), comme sur `discussions` | §15.3 |
| Un nom de discussion fait de signes sans chasse était accepté | Refusé (`bad-name`) ; un nom qui n'est pas de l'UTF-8 aussi | §16.2 |
| Créer une discussion redatait le commun | Elle ne pose plus que la discussion | §16.2 |
| Une écriture refusée par la base ne laissait aucune trace | Trace au journal du serveur | §16.2 |

### 19.2 L'écran de l'espace et la fiche

| Constat | Ce qui a changé | Où |
|---|---|---|
| Un double clic sur « Discussion » ouvrait la modale et la refermait ; sur la croix, il atteignait la page | L'écho d'un double clic est avalé, à l'ouverture comme à la fermeture | §15.5 |
| Le brouillon d'une édition du commun était tenu pour périmé après la création d'une discussion | Corrigé au backend : la réponse n'est plus redatée | §16.2 |
| Le bouton d'un palier écrasait le nom du palier entre 640 et 1 279 px | Réduit à son icône sous 80 rem | §17.3 |
| Une relecture ratée de la fiche démontait la modale et le message en cours | La fiche déjà affichée reste | §15.5 |
| Une panne à la création disait « Réessayez » alors que la discussion existait peut-être | Phrase propre à ce cas | §16.3 |
| Par la clé seule, le palier d'une fiche réglée sur une autre étape ouvrait le fil d'une autre ligne | Pas de bouton de palier hors de `aapStep1` | §17.3 |
| Le formulaire de création sortait du cadre sur un écran bas | Il se réduit et défile | §16.3 |
| Libellés anglais faux ou incohérents | Corrigés (`submitted`, `sign in`, `Current thread`) | — |

### 19.3 L'éditeur

| Constat | Ce qui a changé | Où |
|---|---|---|
| Le texte d'une adresse liée changeait, sa cible restait l'ancienne | Le texte fait foi, sauf lien écrit | §18.1, §18.3 |
| Des barres obliques inverses « de précaution » se voyaient partout où le markdown n'est pas rendu | Échappements au strict nécessaire, vérifiés bloc par bloc par le rendu du fil | §18.1, §18.3 |
| Les marques tapées ne prenaient qu'en début de message ou derrière une espace | Seconde ligne, apostrophe, guillemet, parenthèse | §18.1, §18.4 |
| Relu, un code dans un lien ou dans un gras faisait tomber le lien ou le gras | Marque de code qui cohabite avec les autres | §18.2 |
| Une adresse sans protocole tapée en texte sortait coupée par ses propres signes | Laissée nue quand elle se relit entière | §18.3 |
| Un lien posé sur une sélection contenant une mention sortait illisible | Le lien s'arrête devant la mention et reprend derrière | §18.3 |
| Des cellules de tableur collées se soudaient | Collées par leur texte | §18.1 |
| Le focus demandé à un éditeur détruit levait, dans un effet | Gardes | §18.4 |
| Une liste, une citation ou un bloc de code vides s'envoyaient sous la forme de leur signe | Ils ne s'envoient pas | §18.1 |
| Entrée, pendant que la liste des personnes arrivait, envoyait « @mar » | Elle attend la liste | §18.1 |
| Échap pendant une composition annulait l'édition | La touche reste à la saisie | §18.4 |
| L'aide du champ promettait « Entrée envoie » au doigt ; la barre n'était pas un groupe ; ses marques restaient actives dans un bloc de code ; le champ parlait dans le journal du fil | Corrigés | §18.5 |

Une régression introduite par la première de ces corrections a été vue au navigateur, et corrigée
avant d'aller plus loin : élargie à « toute ponctuation », la règle des marques tapées mettait en
italique le `_notes_` d'une adresse en cours de frappe (§18.4).

### 19.4 Preuves, sur l'état final

Du 13/10, une fois toutes les corrections posées. Les tableaux des §15.6, §16.4 et §17.5 gardent
leurs chiffres, datés ; celui du §18.6 et celui-ci portent sur le code tel qu'il est proposé.

| Quoi | Résultat |
|---|---|
| Règles du backend, hors base (§15.6) | 174 vérifications (161 avant la relecture), sans notice ni avertissement PHP |
| Contre-épreuve par mutation de `Discussion.php` | 235 mutations tuées sur 235 : 74 sur les lignes de dépense, 161 sur le reste (204 avant la relecture) |
| Sondes contre le vrai backend | 70 vérifications pour l'espace (§15.6), 30 pour les actions `discussions` et `seen`, 51 pour la création d'une discussion (§16.4) — qui vérifie désormais que le commun n'est pas redaté |
| Tests unitaires | 6 981 réussis dans 510 fichiers, aucun échec (7 tests et 1 fichier ignorés) |
| Contre-épreuve par mutation de l'écran | 600 mutations en 44 lots, toutes tuées (559 en 43 lots au §17.5) ; le lot de plus est celui de l'écho d'un double clic |
| Contre-épreuve par mutation de l'éditeur | 242 mutations en treize lots, toutes tuées (§18.6) |
| Navigateur — l'écho d'un double clic, avant et après | avant : douze doubles clics sur douze refermaient la modale à 1 440 px ; après : elle reste ouverte neuf fois sur neuf (six sur six à 375 px), le double clic sur la croix n'atteint plus la page, et celui d'un palier ouvre deux fois sur deux le fil du palier |
| Navigateur — la place laissée au nom d'un palier | à côté du bouton, le nom gardait 42 px dans une fenêtre de 640 à 767 px : 122 px ; 170 px de 768 à 1 279 px : 250 px ; au-delà, 362 px, bouton entier |
| Navigateur, sondes de tous les lots rejouées | sans écriture, à 1 440 puis 375 px : 35 et 35 · 44 et 46 · 40 et 40 · 54 et 43 · 51 et 51 ; écritures réelles à 1 440 px : création d'une discussion (56), message posté depuis un palier (56), message mis en forme puis corrigé (44). Après chacune, les documents porteurs sont remis à leur relevé (§15.7) ; aucun courriel mis en file, aucune notification |
| Typage, lint, préflight | sans erreur ; 797 vérifications de préflight |

Deux écarts ont été vus après coup, en rejouant sur le code final les tirages aléatoires du pont
(§18.6) : deux adresses sans protocole dont les signes se répondent, et deux listes de même nature
posées l'une contre l'autre. Ils sont corrigés depuis (§19.5).

### 19.5 Suites, le même jour

Quatre changements arbitrés le 13/10, une fois la relecture commitée.

| Quoi | Ce qui a changé | Où |
|---|---|---|
| Entrée envoyait le message | **Ctrl+Entrée envoie** (Cmd+Entrée sur un Mac), de partout — liste et bloc de code compris ; **Entrée va à la ligne** : un paragraphe, l'élément suivant d'une liste, une ligne de code. La liste des personnes ne retient pas Ctrl+Entrée, et Entrée l'attend toujours quand elle est en route. Le bouton d'envoi dit le raccourci. Trois accents graves suivis d'Entrée ouvrent désormais un bloc de code | §18.1, §18.4, §18.5 |
| Deux adresses sans protocole dont les signes se répondent sortaient en italique, liens coupés | Les adresses nues d'un bloc sont vérifiées ensemble, dans son rendu ; le bloc est réécrit quand l'une n'en ressort pas entière | §18.3, §18.7 |
| Deux listes de même nature posées l'une contre l'autre n'en faisaient qu'une dans le fil | Une sur deux change de signe | §18.3 |
| Le formulaire d'édition n'avait pas le bouton « Discuter » de ses lignes de dépense | Posé sur chaque ligne enregistrée, à la clé de sa ligne ; la modale de la fiche s'ouvre par-dessus le formulaire | §17.3, §17.6 |

Le formulaire « nouvelle discussion » (§16.3) garde Entrée pour créer : c'est un champ d'une
ligne, pas un message.

Preuves des trois premiers : les lignes du §18.6, mesurées sur cet état — 404 tests de l'éditeur,
266 mutations, 60 vérifications au navigateur à chaque largeur, deux écritures réelles (44 et 56).

Preuves du bouton du formulaire :

| Quoi | Résultat |
|---|---|
| Tests unitaires | 125 tests dans six fichiers, dont deux nouveaux : la clé enregistrée d'une ligne du formulaire (19), le champ de dépenses et son emplacement (19), ce que la fiche donne au formulaire (37), le bouton (29), le bouton dans un formulaire témoin — vrai lanceur, vraie requête, la modale seule est remplacée (16) — et le **vrai champ dans le vrai fournisseur**, avec les gestes de l'écran : retirer une ligne, en ajouter une, déplier les archivées (5) |
| Contre-épreuve par mutation | 55 mutations en huit lots nouveaux, toutes tuées — dont neuf passées contre le seul test du vrai champ ; et les cinq lots de la fiche et du bouton que ce code touche, rejoués (57 mutations, aucune survivante) |
| Relecture du champ contre les normes du module `coform` | rien de bloquant ; deux points corrigés (le contexte se lit par un hook, comme les deux autres du module ; un test traverse la chaîne réelle) et les mineurs retenus : la clé de l'input sans son préfixe de type, la réponse dite à l'hôte, une garde sur l'ordre des clés du document |
| Navigateur, déposant connecté, 1 440 puis 375 px, sans écriture | 23 vérifications à chaque largeur : un bouton sur chaque ligne affichée du formulaire, à la clé de sa ligne (la ligne clôturée, repliée, reçoit le sien une fois dépliée) ; l'espace s'ouvre par-dessus le formulaire, qui ne change pas d'étape ; on y écrit ; Échap referme l'espace seul et rend le focus au bouton de la ligne ; une ligne ajoutée n'a pas de bouton. Le formulaire n'est pas enregistré ; le commun et les collections ne bougent pas |

Pour le dépôt entier, sur cet état : typage et lint sans erreur, 7 058 tests unitaires réussis
dans 512 fichiers, 797 vérifications de préflight.

## 20. Le bouton de discussion des questions (14/10)

Demandé à l'usage : « dans le formulaire aussi, on devrait afficher le bouton commentaire sur les
questions qui ont activé la config » — puis : « que ce soit un formulaire de commun ou un formulaire
général ». Le panneau de l'espace d'un commun listait déjà ces questions ; le formulaire, lui, ne
montrait pas leur bouton.

### 20.1 Ce que fait le legacy

- **Le drapeau** est `activeComments`, posé sur la DÉFINITION de la question (`inputs.<clé>`) — dans
  le document `inputs` de l'étape pour un appel à projets, dans le document `forms` de l'étape pour
  un formulaire général —, par l'éditeur du formulaire (« Activer les commentaires »).
- **Le bouton** — des bulles et une pastille du nombre de messages — suit le libellé de la question,
  en écriture (`survey/views/tpls/forms/step.php`, `step_v2.php`) et aussi en lecture
  (`Form.php`, `Formv2.php`).
- **Le fil** : contexte `forms:<formulaire>`, chemin
  `<formulaire>.<_id de l'étape>.<réponse>.<question>.question_<question>.comment`. Pour un
  formulaire général, le formulaire parent est posé sur l'étape au rendu (`formParent`,
  `Formv2.php`) : le deuxième segment est l'`_id` du document de l'étape, comme pour un appel.
  Mesuré en base : les trois fils de question d'un formulaire général portent cet `_id`.

### 20.2 Ce que rend `space`

- Les fils de question à LANCER se fabriquent désormais pour tout formulaire, appel ou formulaire
  général, sous l'`_id` de l'étape. Une étape de `forms` reste lue sous ses deux identifiants (son
  `id` et son `_id`) : un fil écrit sous l'`id` est listé et compté, et sa question ne reçoit pas de
  second fil à lancer. Deux étapes peuvent avoir une question de même clé : chacune a le sien.
- Chaque fil de question porte **`step`**, la clé de son étape (`aapStep1`, l'`id` d'une étape de
  formulaire) — c'est par elle qu'un formulaire retrouve le fil d'une question qu'il affiche. Le
  contrat d'un fil passe de quinze à seize champs (additif : un écran plus ancien l'ignore).
- **Les discussions supplémentaires restent une fonction de l'appel** : sur la réponse à un
  formulaire général, `creatableAudiences` est vide, et une création demandée quand même est
  refusée (`forbidden`, rien d'écrit). Le legacy ne les connaît que sur l'espace d'un commun ; aucune
  réponse générale n'en porte en base.

### 20.3 L'écran

- **Où est le bouton.** `FieldLabel` — le libellé de toutes les questions en écriture — et
  `ReadOnlyLabel` — en lecture — le posent À CÔTÉ du libellé, hors du `<label>` (un clic dans le
  `<label>` donnerait le focus au champ), en `type="button"` (dans un formulaire, un bouton sans type
  le soumet). Pour une question fermée, ou sans hôte, le libellé est rendu tel qu'avant. En lecture,
  la liste de dépenses ne répète plus son libellé sous celui de la ligne (`hideLabel`, comme ses
  voisines) : elle aurait porté un second bouton — et elle affichait déjà son libellé deux fois.
- **Qui l'active.** `SmartCoForm` entoure TOUJOURS le formulaire de `FormQuestionDiscussions` — toutes
  les surfaces qui montent un formulaire passent par lui (quatorze) —, et la page d'une réponse en
  lecture (`CoFormAnswerPage`) pose le même hôte. C'est l'hôte qui décide, d'après la réponse, les
  étapes parsées et le formulaire : rien sans réponse enregistrée (un dépôt neuf n'a pas de fil — le
  legacy n'y montre pas non plus le bouton), sans question ouverte, ni hors d'un site complet
  (`SmartCoForm` sait vivre sans session Cocolight ni routeur, le bouton non). L'arbre ne change jamais
  de forme — le fournisseur toujours là, la modale à côté des enfants : une réponse qui reçoit son
  identifiant pendant la saisie ne fait pas remonter le formulaire, saisie et étape comprises.
- **Quelle discussion.** Le bouton lit la liste de l'espace de la réponse — une requête pour toutes
  ses questions — et y cherche le fil de la sienne (`questionDiscussion`) : 4ᵉ segment du chemin,
  et clé de l'étape (`useFormStepKey`) — posée par les rendus qui montrent plusieurs étapes à la
  fois (`DynamicCoForm`, `CoFormReadOnly`), sinon l'étape courante du formulaire par étapes
  (`CoFormContext`). Mesuré en base : une même
  clé de question revient dans deux étapes sur 3 appels à projets de 214, et sur 3 formulaires
  généraux de 316. La clé d'origine se lit sous le préfixe qu'ajoute le formulaire
  (`multiRadio…`, `finder…`). Sans fil proposé par le serveur, pas de bouton ; pour qui ne peut pas
  écrire, seulement s'il y a à lire.
- **Une modale par espace et par page.** La modale de l'espace est montée par un hôte,
  `SpaceModalHost` (entrée légère du module, code de la modale toujours différé), qui se déclare
  dans un registre à rangs (`lib/spaceHosts`) : la page — la fiche d'un commun, rang « page » — passe
  devant un formulaire posé sur elle (rang « formulaire »), quel que soit l'ordre de montage. Sur la
  fiche, le formulaire d'édition ouvre donc la modale de la fiche, par-dessus lui, et la fermeture
  rend le focus au bouton de la question. Ailleurs, le formulaire monte la sienne.
- **Son nom.** Pour un appel, l'espace est celui d'un commun ; pour un formulaire général, celui
  de « la réponse » (`subject`) — titre, description et nom du panneau, titrés du nom du formulaire.

### 20.4 Arbitrages

| Question | Décision | Écartée |
|---|---|---|
| Où vit le bouton | dans le module `coform`, avec ses libellés, sur l'entrée légère du module comment — à l'inverse de l'emplacement des lignes de dépense (`MilestoneLineSlotContext`), parce que la discussion d'une question appartient au formulaire lui-même | un emplacement que chaque page remplirait : quatorze surfaces montent un formulaire, une oubliée n'aurait rien |
| Qui monte la modale | un hôte à rangs, déclaré par chaque écran qui ouvre l'espace | une modale par écran — deux modales du même espace s'ouvriraient l'une sur l'autre — ou un contexte que chaque page devrait déclarer |
| Fils de question d'un formulaire général | sous l'`_id` de l'étape, comme l'écrit le legacy | ne rien fabriquer (l'état d'avant) : seules les questions déjà commentées auraient eu un bouton |
| Discussions supplémentaires d'une réponse générale | refusées | les ouvrir : le legacy ne les montrerait pas |
| Le bouton en lecture | oui, comme le legacy | l'écriture seule |

### 20.5 Preuves

| Quoi | Résultat |
|---|---|
| Règles du serveur, hors base (§15.6) | douze règles de plus : formulaire général — fabrication sous l'`_id`, jamais sous l'`id`, une fois par question ; un fil écrit sous l'`id` compte ; même clé dans deux étapes, vierge ou commentée dans l'une ; ordre du formulaire —, étape portée par chaque fil de question et par eux seuls, contrat de seize champs, création réservée aux appels. Contre le modèle d'avant, quatorze tombent. Le banc avait deux échecs à lui : sa doublure ne savait pas lister les index que le modèle lit depuis le lot P (§9.10) — comblée |
| Contre-épreuve du serveur | 13 mutations, 13 tuées |
| Vrai backend, lecture sans session | l'espace de deux réponses à des formulaires généraux : 33 et 10 questions à lancer, toutes sous l'`_id` de leur étape et dans l'espace de leur réponse, chacune avec la clé de son étape ; seize champs par fil ; aucune création proposée |
| Tests unitaires | registre des hôtes (rangs, arrivée, retrait, deux racines React qui se préviennent) ; lecture de l'étape d'un fil, `questionDiscussion` ; le bouton dans de vrais libellés sous le vrai hôte — commentée, à lancer, même clé dans deux étapes, fermée, hors du `<label>`, sans soumission, focus rendu, visiteur, dépôt neuf, sans hôte, une seule requête, clé préfixée, long libellé, préchauffage, commun, lecture ; l'hôte — aucune question ouverte, hors session, hors routeur, arbre constant (le même nœud, la saisie gardée) — ; une liste de dépenses en lecture (un libellé, un bouton) ; `SmartCoForm` (arbre constant), `DynamicCoForm`, `MultiStepCoForm` (clé d'étape), parseur ; la modale et le panneau « de la réponse » ; la fiche d'un commun — une seule modale quel que soit l'ordre de montage, focus rendu au bouton de la question |
| Contre-épreuve du front | 73 mutations sur treize fichiers, toutes tuées. Premier passage : 62 sur 66 — les quatre survivantes ont donné deux tests : la notification du registre (deux racines React, que rien ne fait rendre ensemble) et le nom du bouton d'origine (le focus du test ne quittait jamais le bouton : la doublure de la modale le prend désormais, comme le vrai dialogue). Après la relecture ci-dessous, les lots des fichiers retouchés rejoués et complétés : 37 sur 37 |
| Relecture `module-review` (normes du module coform) | rien de bloquant ; cinq défauts corrigés avant le commit, chacun tenu par un test : le formulaire remonté quand l'arbre changeait de forme (désormais constant), un second bouton — et un second libellé — sur une liste de dépenses en lecture (`hideLabel`), l'hôte monté sans question ouverte sur la page d'une réponse, la règle « commun » écrite à deux endroits (centralisée dans l'hôte), un plantage hors session Cocolight ou hors routeur (l'hôte n'ouvre alors rien) |
| Navigateur, aucune écriture | fiche du commun du compte simple : « Modifier », 7 boutons dans le formulaire d'édition, hors du `<label>` ; l'espace s'ouvre sur le fil de la question, dans UNE modale — celle de la fiche —, le formulaire reste ouvert dessous, Échap referme l'espace et rend le focus au bouton (9 vérifications). Réponse à un formulaire général — le compte admin de test, sur sa propre réponse —, en lecture puis en édition : 10 boutons, le fil de la question sous l'`_id` de l'étape, une modale qui ne parle pas de « commun » et ne propose pas de créer de discussion, focus rendu (21 vérifications) |

### 20.6 Limites

- Un dépôt n'a de bouton qu'une fois enregistré.
- Un formulaire monté hors de `SmartCoForm` et de `CoFormAnswerPage` n'aurait pas de bouton — il
  n'y en a aucun aujourd'hui.
- Un fil de question écrit sous l'`id` texte de l'étape est lu et compté ; un nouveau fil se lance
  sous l'`_id`, la forme du legacy.

## 21. L'image dans le texte (14/10)

Demande de l'user : « un autre bouton image pour ajouter de l'image dans la syntaxe markdown, en plus
de l'image en pièce jointe ». Le legacy le fait (`markdown-editor.js`, `wrapImage`) : une fenêtre,
une description, et deux onglets — une adresse quelconque, ou un fichier importé.

### 21.1 La décision : importée affichée, tierce au clic

Arbitré par l'user le 14/10, entre quatre options (import seul ; comme le legacy ; import + adresse
au clic ; adresse copiée sur le serveur à l'envoi) : **import + adresse au clic**.

Afficher d'office une image d'un autre site, c'est faire contacter ce site par le navigateur de
CHAQUE lecteur — adresse IP, heure, navigateur. Un visiteur choisit les sites qu'il visite ; ici,
c'est l'auteur du message qui choisirait pour tous ses lecteurs : le principe du « pixel espion ».
L'hébergeur peut aussi remplacer l'image après coup. Les grandes messageries ne laissent pas le
navigateur du lecteur aller la chercher (Gmail, GitHub, Discord la font passer par leurs serveurs ;
Discourse la copie chez lui). Au clic, c'est le lecteur qui décide, au moment où ça compte.

### 21.2 Écrire

- **Le bouton « Insérer une image dans le texte »** ouvre une fenêtre (`ComposerInlineImage`) :
  « Importer » ou « Adresse », puis une **description exigée**, comme dans le legacy — un fichier
  importé la propose d'office (son nom, sans extension). Entrée insère. L'image se pose au curseur,
  dans la ligne : un nœud Tiptap `image`, en ligne et insécable (`lib/richText/extensions.ts`).
  Les images JOINTES gardent leur bouton, désormais un trombone, pour qu'on ne confonde pas les deux.
- **L'onglet « Adresse »** n'accepte qu'une adresse complète en `http(s)`, et prévient l'auteur
  quand elle vient d'un autre site : « les lecteurs l'afficheront d'un clic ».
- **L'import** (`useInlineImageUpload`) passe par le même `uploadDocument` du SDK que les pièces
  jointes — dossier `comments`, sous l'auteur, avec la clé du legacy pour ces images (`mdImage`) —,
  mais le document n'est **pas joint au message** : joint, `Comment::insert` le déplacerait dans le
  dossier du message (`Document::moveDoc`) et l'adresse écrite dans le texte casserait. Le legacy
  fait de même (dossier `communecter`, que le SDK refuse ; d'où `comments`).
- **Ce qui s'écrit est le chemin relatif** (`/upload/…`), comme le legacy, servi par le serveur. Le
  SDK rend `docPath` ABSOLU (sa normalisation de lecture) : `writtenImageAddress` lui retire
  l'origine du serveur. Une adresse d'un autre site s'écrit entière.
- **L'éditeur affiche l'adresse résolue contre le serveur** (servi par le site, il chercherait
  sinon `/upload/…` chez lui) et garde l'adresse écrite dans `data-src` : ProseMirror relit le DOM
  pendant la frappe, et relue depuis `src`, l'image serait repartie en adresse absolue.
- **Un `<img>` collé** depuis une page entre dans le texte si son adresse est une image en ligne ;
  `data:`, `blob:` ou fichier local, non. Une image seule est un message.
- **Le pont markdown** lit la description comme le fil l'affiche (`renderInlineAsText`) et
  l'écrit échappée là où, relue, elle deviendrait autre chose — nue sinon ; l'adresse s'écrit comme
  celle d'un lien (espaces et chevrons encodés, parenthèses échappées) ; un titre, sur une ligne.

### 21.3 Lire

`classifyImageSource` (`lib/inlineImages.ts`) classe l'adresse par son **origine**, contre
`VITE_BASE_URL_BACKEND` — un chemin relatif se lit contre le serveur, comme dans le legacy :

| Adresse | Le fil |
|---|---|
| Même origine que le serveur (un fichier importé) | l'image, chargée sans attendre le défilement |
| Autre site, en `http(s)` | un bouton « Afficher l'image de exemple.org », l'adresse entière en infobulle ; au clic, l'image, **sans `Referer`**, et le focus passe sur elle |
| Prise dans un lien `[![…](…)](…)` | sa description, ou le nom du site — un bouton dans un lien n'est pas du HTML valide, et le clic y suit le lien |
| `data:`, `javascript:`, vide, illisible | sa description seule, en texte |

**Le bouton est posé APRÈS le nettoyage.** `sanitizeProse` retire boutons et attributs `data-*`.
Le rendu `markdown-it` laisse donc, à la place d'une image tierce, une marque : deux caractères
d'usage privé autour d'un **jeton tiré au hasard à chaque rendu** et d'un rang. Après
`sanitizeProse`, `placeRemoteImages` remplace les marques de CE rendu par le bouton (ou l'image
ouverte), en échappant tout ce qui vient du texte, puis retire les signes qui restent. Le jeton
compte : `markdown-it` décode les entités numériques même sans HTML (`&#xE000;`), dans le texte, le
titre d'un lien ou la description d'une image ; une marque écrite par l'auteur n'a pas le jeton du
rendu, et ne reçoit donc rien.

**La citation d'un message** (« en réponse à… ») montre la description d'une image, pas son adresse.

### 21.4 Deux défauts que seul le navigateur a montrés

- **L'adresse absolue** — voir §21.2 : le SDK et la relecture du DOM par ProseMirror. jsdom ne fait
  ni l'un ni l'autre ; les tests unitaires passaient.
- **Le premier clic perdu.** React 19 compare `dangerouslySetInnerHTML` **par identité d'objet** :
  `{ __html }` recréé à chaque rendu réécrivait le message entier à chaque rendu. Or une ligne se
  redessine quand on la touche (elle devient active) : le bouton pressé était remplacé entre
  l'appui et le relâchement, et le clic n'arrivait jamais. **Le défaut était antérieur à ce lot et
  touchait les LIENS** : mesuré au navigateur, le premier clic sur un lien d'un message était perdu
  3 fois sur 3. L'objet est désormais mémorisé tant que le HTML ne change pas : 3 sur 3 suivis.

Et un défaut de `markdown-it` : un signe échappé dans la description d'une image (`![a \] b](…)`)
reste un jeton `text_special`, que `renderInlineAsText` ignore — la description perdait ses
crochets, ses étoiles. Le moteur commun les rend au texte (`createCommentMarkdown`, règle
`comment_image_alt`).

### 21.5 Preuves

| Quoi | Résultat |
|---|---|
| Tests unitaires | classement des adresses, marques et jeton, échappement, chemin écrit ; rendu (importée, tierce, ouverture, focus, deux images, autre texte, dans un lien, refusées, marques écrites en clair ou par entité, description piégée, rendu sans réécriture) ; pont (allers-retours, descriptions piégées, adresses, titre, image seule) ; fenêtre d'insertion (import, attente, refus avant envoi, refus du serveur, réponse dépassée, fermeture, adresse, adresse du serveur, refusées, sans import) ; composer réel (au curseur, importée, relue depuis le DOM, Échap, image seule, collage, correction) ; le fil branche l'import sur ses deux champs ; extrait de citation |
| Contre-épreuve | 91 mutations sur douze fichiers, toutes tuées. Premier passage : deux survivantes — l'adresse d'une image ouverte non échappée, l'ouverture d'une seconde image qui fermait la première — devenues deux tests |
| Relecture indépendante | une correction avant commit (le jeton du rendu, §21.3), et deux mineures (titre d'image, parenthèses d'adresse dans la citation) |
| Navigateur, aucune écriture (24 vérifications) | compte simple : le vrai SDK émet le téléversement (intercepté — `comments`, `mdImage`, sous l'auteur), l'éditeur montre l'image lue contre le serveur, le message part avec le chemin relatif ; dans le fil, l'image importée s'affiche, l'image tierce attend : **aucune requête vers le site tiers avant le clic**, une après, sans `Referer`, focus sur l'image ; une marque écrite par entité dans un titre de lien ne reçoit rien |

### 21.6 Limites

- **Une image importée puis retirée avant l'envoi reste sur le serveur**, comme une pièce jointe
  retirée. Le legacy supprimait le document dès que l'image quittait le texte — ce qui cassait
  l'annulation (Ctrl+Z) ; une suppression à l'envoi, des documents de la saisie absents du texte,
  reste à faire.
- **Une image ouverte ne se referme pas** : la requête au site tiers est déjà partie.
- **L'auteur qui corrige son message voit ses images tierces dans l'éditeur** : c'est lui qui les a
  choisies.
- Les notifications et courriels (serveur) montrent le markdown brut, comme avant.

## Voir aussi

- [Module Actualités](09-module-news.md) — l'implémentation d'origine, rebranchée au J8
- [Permissions](10-permissions.md) — le registre de calculateurs utilisé par le module
- [API & authentification](11-api-authentification.md)
- [Tests](15-tests.md) — conventions des tests unitaires colocalisés
