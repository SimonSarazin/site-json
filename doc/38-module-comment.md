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
> vérifiées en local (version de base **1.0.194** ; l'arbre de travail local repose depuis sur
> **1.0.195**). Les modifications venues ensuite sont spécifiées plus loin : l'endpoint
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
| ~~Images~~ | ~~`uploadDocument` interdit explicitement `comments`~~ — **levé le 24/09** : le verrou était entièrement côté client | §13.2 à §13.4 | les images sont livrées (bouton, collage, glisser-déposer) |
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
en manquaient (§3) — `news` n'en faisait pas partie. Enfin, `main` reste sur la **1.0.195**, figée par
`package-lock.json`, tant que personne ne relève la version.

**C'est l'ordre inverse qui casse** : ce module a besoin de ces modifications (endpoints
`discussions` et `seen`, `createFromCollection`, `getComments()` sur les autres types,
`mediaImg`). Le SDK doit donc être publié **avant** la fusion, et la MR doit relever la dépendance
à la version publiée. `comment-dev`, recalée sur `main` le 02/10, épingle `^1.0.195` comme lui.

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

La collection `comments` n'avait **que** l'index `_id_`. Deux index couvrent les accès du module :

| Index | Sert à |
|---|---|
| `{ contextType: 1, contextId: 1, created: -1 }` | tout accès à un fil part de (type, id) et trie par date |
| `{ parentId: 1, created: 1 }` | charger les réponses d'un message précis |

Forme d'un document : `contextId`, `contextType`, `parentId` (**chaîne vide** à la racine, jamais
`null`), `text`, `created` (**secondes UNIX**), `author` (identifiant), `views.<userId>.date`
(support des non-lus), `vote.<userId>.status` + `voteCount.<statut>`, `mentions[]`, `path`.

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
│   ├── composerText.ts     marques, curseur, détection du `@`, touche Entrée
│   ├── linkifyMentions.ts  `@slug` → lien, et charge utile `mentions[]`
│   ├── formatWhen.ts       heure, séparateur de jour, « aujourd'hui » / « hier »
│   └── voters.ts           normalisation de `SHOW_VOTE`
├── hooks/           useCommentsQuery · useCommentMutations · useCommentVoters ·
│                    useCommentPermissions
├── components/      CommentThread · CommentRow · CommentMarkdown · CommentComposer ·
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
`html: false` échappe tout HTML écrit par l'auteur, et les règles `heading`, `lheading` et `image`
sont désactivées — un `# titre` ou une image distante **ne peuvent pas exister** dans la sortie.
`sanitizeProse` reste le filet. `breaks: true` est propre au fil : dans une discussion, un retour
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
| B1 | ~~Pas d'image dans un message~~ | **Levé — livré le 24/09** (§13.2 à §13.4) : bouton, collage, glisser-déposer, rendu et visionneuse | — |
| B2 | `markdownActive` non postable | `ADD_COMMENTS` en `additionalProperties: false` | Rendu markdown restreint, inconditionnel |
| B3 | Mentions limitées aux citoyens | `searchMembers` en `personOnly` | Citoyens seuls |
| B6 | Pas de filtre `path` **en lecture** | `GET_COMMENTS` n'a pas de bloc `request` | Filtrage côté client ; l'endpoint générique portera le filtre serveur |
| B10 | L'édition d'un message n'est pas tracée | Mesuré (voir §7) | Aucune marque « modifié » — mieux vaut ne rien dire qu'affirmer faux |
| B11 | La saisie montre la syntaxe markdown, elle ne l'interprète pas | Composer maison sur `<textarea>` (§5.5) | Assumé le 24/09 : un éditeur **WYSIWYG** est un lot à part, cadré au registre — la valeur stockée reste du markdown dans les deux cas |
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
préférable —, mais l'agrégation du rail groupe TOUTE la collection à chaque appel : en production,
il reste à mesurer. La sortie prévue est la dénormalisation du porteur à l'écriture (§9.8).

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
| `rail` | défaut **sans** paramètre | porteurs et compteurs, **aucun titre de fil** | 1 agrégation + ≤ 2 lectures par `_id` |
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

`key` est la clé qui transite dans l'URL du panneau : `type:id`, ou `type:id:path`.
`last` est en **secondes**, la base mêlant `MongoDate` et entiers.

Refus en **HTTP 200** avec `{result:false, msg}`, comme les actions voisines — jamais un code
d'erreur HTTP.

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
  `.discu_`, hors `.commentPublic`) : retirées de toutes les listes et refusées en mode `fil`, pour
  tous, en attendant le lot qui portera l'espace de discussion d'un commun avec ses propres règles
  d'accès — on refuse plus, jamais moins ;
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

**Passage à l'échelle.** Le coût est proportionnel à la collection `comments`, jamais à `news`.
L'agrégation est servie par un index, mais elle le parcourt en entier. La voie si `comments`
devenait très volumineuse est de **dénormaliser le porteur sur le commentaire** à l'insertion
(`carrierType`/`carrierId`, plus un index `{carrierId, created}`) : le rail deviendrait une
requête ponctuelle. Cela touche le chemin d'écriture, et n'a donc pas été fait ici.

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
coupés **avant** le cadrage. `scanTruncated` le dit ; la sortie est la dénormalisation du §9.8.

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
| Câblage ARIA du champ | `CommentComposer.test.tsx` — la liste fermée ne pointe aucun `aria-activedescendant`, et le rôle de remplacement ne revient pas |
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
| La barre de mise en forme n'appliquait qu'au `mouseDown` : morte au clavier, libellés anglais, exemples insérés en français | `onClick` applique (Entrée, Espace), `onMouseDown` ne fait que garder le focus ; libellés et exemples traduits (`composer.marks.*`) | `CommentComposer.test.tsx` |
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

Ce découpage répond à une contrainte connue : **le composer sera remplacé par un vrai éditeur**
(Tiptap ou Lexical, blocage B11). Seule la dernière ligne du tableau disparaîtra alors.

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

⚠️ **Reste à vérifier au navigateur** — l'upload ne s'exerce pas en Node (voir §13.2) : coller
une capture, l'envoyer, rouvrir le fil, puis **modifier le texte du message et vérifier que les
images sont toujours là**. C'est le chemin que le point 3 protège.

**Hors lot, assumé** : retirer une image d'un message DÉJÀ publié. Le geste n'existe pas dans
l'interface ; le contrat, lui, le permettrait (envoyer un `mediaImg` amputé).

## 14. Demande à l'équipe SDK — la liste complète (02/10)

> **Le SDK n'est jamais commité** : cette section est la demande à transmettre à l'équipe SDK. Elle
> réunit **tout** ce que le module attend de `@communecter/cocolight-api-client`, implémenté et
> vérifié en local sur la base **1.0.195**. Le détail de chaque point vit dans la section citée ;
> les trois points ajoutés le 02/10 sont spécifiés ici (§14.2 à §14.4). Tant que le SDK n'est pas
> publié, `site-json` ne compile que par le lien local : un `npm install` propre casse le
> `typecheck` du module. Ordre de livraison : le SDK d'abord, la MR du module ensuite (§2.5).

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

Régénération, dans cet ordre : `generate:module:publish` → `generate:methodeapi` → `typecheck` →
`lint` → `build:esm:rollup` → `build:node` → `build:browser` → `build:types`. Les pièges qui
invalident une vérification naïve sont au §2.2 : le runtime lit le module **généré**, jamais le JSON.

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

## Voir aussi

- [Module Actualités](09-module-news.md) — l'implémentation d'origine, rebranchée au J8
- [Permissions](10-permissions.md) — le registre de calculateurs utilisé par le module
- [API & authentification](11-api-authentification.md)
- [Tests](15-tests.md) — conventions des tests unitaires colocalisés
