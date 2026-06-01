[← Retour à l'index](README.md)

# Module News

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Schéma de configuration (`schema.ts`)](#schéma-de-configuration-schemats)
- [Hooks principaux](#hooks-principaux)
  - [useNewsQuery](#usenewsquery)
  - [useNewsByIdQuery](#usenewsbyidquery)
  - [Mutations news (useNewsMutations.tsx)](#mutations-news-usenewsmutationstsx)
  - [useNewsVotes](#usenewsvotes)
  - [useNewsCommentsQuery](#usenewscommentsquery)
  - [Mutations commentaires (useCommentMutations.tsx)](#mutations-commentaires-usecommentmutationstsx)
  - [useNewsPermissions](#usenewspermissions)
  - [useNewsEntity](#usenewsentity)
  - [useFormatNews](#useformatnews)
  - [useFormatComment](#useformatcomment)
- [Composants](#composants)
  - [NewsSection (section JSON)](#newssection-section-json)
  - [NewsItem](#newsitem)
  - [NewsContent](#newscontent)
  - [NewsDetailPage](#newsdetailpage)
  - [Formulaires (AddNewsModal, EditNewsModal)](#formulaires-addnewsmodal-editnewsmodal)
  - [Upload de médias](#upload-de-médias)
  - [Commentaires](#commentaires)
  - [Interactions (réactions + votes)](#interactions-réactions--votes)
  - [Autres dialogues](#autres-dialogues)
  - [Mentions @user](#mentions-user)
- [Permissions](#permissions)
- [Contexte NewsContext](#contexte-newscontext)
- [React Query — clés et invalidations](#react-query--clés-et-invalidations)
- [Préchargement SSR](#préchargement-ssr)
- [i18n](#i18n)
- [Exemple de configuration JSON](#exemple-de-configuration-json)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le module **News** (`src/modules/news/`) gère l'affichage et la gestion des actualités pour les entités Cocolight (organisations, projets, citoyens). Il inclut :
- Publication, édition, suppression d'actualités
- Commentaires hiérarchiques (réponses imbriquées) avec mentions @user
- Réactions emoji (8 types : love, like, enjoy, glad, bothered, sad, scared, support)
- Upload d'images (avec recadrage) et de documents
- Partage et signalement
- Intégration naturelle dans les onglets de profil

**Type de module** : `core` (pas de `module.config.ts` — module sans routes propres, expose uniquement la section `news` utilisable dans les pages JSON et les onglets profil).

**Entités supportées** : `organizations`, `projects`, `citoyens` (défini dans `constants/supportedTypes.ts`).

---

## Architecture interne

```
src/modules/news/
├── schema.ts                       # NewsSectionSchema + NewsConfigSchema (Zod)
├── types.ts                        # Types TypeScript : NewsContextType, NewsModuleConfig, NewsPermissions (côté context), NewsImageItem, NewsDocumentItem
├── i18n.ts                         # Enregistrement namespace "modules/news"
├── i18n/
│   ├── fr.json
│   └── en.json
├── index.ts                        # Exports centralisés
│
├── components/
│   ├── index.ts                    # Exports centralisés des composants
│   ├── sections/
│   │   └── NewsSection.tsx         # Section principale (enregistrée dans SectionRenderer)
│   ├── forms/
│   │   ├── AddNewsModal.tsx        # Modal d'ajout (texte + images + docs)
│   │   ├── EditNewsModal.tsx       # Modal d'édition
│   │   ├── NewsFormImageUpload.tsx # Upload d'image avec prévisualisation
│   │   ├── NewsFormDocumentUpload.tsx  # Upload de documents
│   │   ├── FileUploadProgress.tsx  # Barre de progression d'upload
│   │   └── ImageCropDialog.tsx     # Dialogue de recadrage d'image (react-easy-crop)
│   ├── comment/
│   │   ├── NewsComments.tsx        # Conteneur liste commentaires
│   │   ├── CommentInput.tsx        # Saisie de commentaire (avec MentionInput)
│   │   ├── CommentItem.tsx         # Rendu d'un commentaire (texte + réactions + actions + replies)
│   │   └── DeleteCommentDialog.tsx # Dialog confirmation suppression
│   ├── interactions/
│   │   ├── NewsReactionPicker.tsx  # Sélecteur de réaction emoji
│   │   ├── NewsReactionsModal.tsx  # Modal listant qui a voté quoi
│   │   └── NewsVoteDisplay.tsx     # Affichage agrégé des votes/réactions
│   ├── media/
│   │   ├── NewsImageGrid.tsx       # Grille d'images attachées (1-5 images)
│   │   └── NewsFileList.tsx        # Liste de fichiers/documents attachés
│   ├── mention/
│   │   ├── MentionInput.tsx        # Textarea avec auto-complétion @user
│   │   └── MentionSuggestions.tsx  # Dropdown de suggestions de mentions
│   ├── NewsItem.tsx                # Élément de news individuel (header + content + actions)
│   ├── NewsContent.tsx             # Rendu du contenu (react-markdown + remark-gfm)
│   ├── NewsDetailPage.tsx          # Page/modale de détail d'une news
│   ├── DeleteNewsDialog.tsx        # Dialog confirmation suppression news
│   ├── ReportDialog.tsx            # Dialog de signalement (avec raisons)
│   └── ShareNewsDialog.tsx         # Dialog de partage (lien + social)
│
├── hooks/
│   ├── useNewsQuery.tsx            # Liste infinie news (timestamp-based)
│   ├── useNewsByIdQuery.tsx        # News par ID (pour DetailPage)
│   ├── useNewsMutations.tsx        # Mutations CRUD + réactions : useDeleteNews, useEditNews, useAddNews, useAddNewsImage, useAddNewsMention, useShareNews, useAddVoteNews, useReportNews
│   ├── useNewsVotes.tsx            # Query détail des votes (qui a voté quoi)
│   ├── useNewsCommentsQuery.tsx    # Query commentaires d'une news (reçoit News | null)
│   ├── useCommentMutations.tsx     # Mutations CRUD commentaires + replies + vote + signalement
│   ├── useFormatNews.tsx           # Normalisation News → FormattedNews
│   ├── useFormatComment.tsx        # Normalisation Comment → FormattedComment (avec FormattedReply[])
│   ├── useNewsEntity.tsx           # Résolution de l'entité (par entitySlug ou useCocolight().entity)
│   ├── useNewsContext.tsx          # useNewsContext() (throw) + useOptionalNewsContext() (null safe)
│   └── useNewsPermissions.ts      # Hook wrapper sur usePermissions(["news"])
│
├── permissions/
│   ├── types.ts                    # NewsPermissions (6 champs booléens)
│   ├── defaults.ts                 # DEFAULT_NEWS_PERMISSIONS (tout false)
│   ├── calculators/
│   │   ├── news.ts                 # calculateNewsPermissions (5 cas : ownProfile, user, org, project, event)
│   │   └── news.test.ts            # Tests unitaires du calculateur
│   ├── register.ts                 # registerPermissions(namespace: "news")
│   └── index.ts                    # Exports
│
├── contexts/
│   ├── NewsContext.tsx             # Définition du contexte React (createContext)
│   ├── NewsProvider.tsx            # Provider — prop unique : value: NewsContextType
│   └── index.ts
│
├── prefetch/
│   ├── prefetchNews.ts             # prefetchNewsQuery (SSR, prefetchInfiniteQuery)
│   └── index.ts
│
├── constants/
│   ├── queryKeys.ts                # NEWS_QUERY_KEYS (clés + préfixes d'invalidation)
│   ├── voteTypes.ts                # voteTypes[] + voteTypeMap (8 réactions avec icônes Lucide + classes Tailwind)
│   ├── reportReasons.ts            # REPORT_REASONS (7 raisons avec labelKey i18n)
│   ├── supportedTypes.ts           # NEWS_SUPPORTED_TYPES (Set)
│   └── index.ts
│
└── utils/
    ├── commentCacheUtils.ts        # findAndRemoveComment, findAndUpdateComment, findAndAddReply, countAllComments, getMaxDepth
    └── index.ts
```

---

## Schéma de configuration (`schema.ts`)

```ts
export const NewsSectionSchema = z.object({
  type: z.literal("news"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    entitySlug: z.string().optional(),    // Filtrer sur une entité spécifique
    maxItems: z.number().positive().optional().default(10),
    showAddButton: z.boolean().optional().default(true),
    showFilters: z.boolean().optional().default(false),
    showComments: z.boolean().optional().default(true),
    showReactions: z.boolean().optional().default(true),
  }),
});
```

**`entitySlug`** : si absent, la section utilise l'entité courante via `useCocolight().entity`. Si présent, elle charge l'entité correspondant au slug via `useEntityBySlugQuery`.

Le fichier exporte également `NewsConfigSchema` (configuration du module : `maxFileSize`, `maxImages`, `enableReactions`, etc.) et leurs types dérivés `NewsSection`, `NewsConfig`.

---

## Hooks principaux

### useNewsQuery

```ts
const {
  news,               // News[] — instances Proxy transformées (dédoublonnées par id)
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  lastItemRef,        // Ref à attacher au dernier élément pour infinite scroll
  error,
  refetch,
} = useNewsQuery({
  entity,             // EntityTypes | null
  entityType,         // string | null — "organizations" | "projects" | "citoyens"
  enabled?: boolean,  // défaut: true
  indexStep?: number, // défaut: 12 — items par page
});
```

**Pagination** : timestamp-based (`dateLimit` décroissant). `userContextId` est inclus dans la queryKey via `useHydratedUserContextId()` pour forcer un refetch quand le contexte d'utilisateur change (connexion/déconnexion).

**Transformation SSR** : un `useEffect` transforme le cache plain-objects de l'hydratation SSR en instances Proxy réactives via `transformToEntityInstance`. Les instances déjà Proxy (`isReactive`) sont retournées telles quelles.

**Restriction** : uniquement pour les types `organizations`, `projects`, `citoyens` (vérifié en interne). Les autres types retournent une liste vide.

### useNewsByIdQuery

```ts
const { data: news, isLoading, isError, error } = useNewsByIdQuery({
  newsId: string,
  entity: EntityTypes,
  enabled?: boolean,  // défaut: true
});
```

Charge une news par son ID via `entity.news({ id: newsId })`. `enabled` quand `newsId` et `entity` sont non-null.

### Mutations news (useNewsMutations.tsx)

Tous ces hooks sont exportés publiquement (via `index.ts`) depuis `hooks/useNewsMutations.tsx` :

```ts
// Suppression (avec optimistic update optionnel)
const deleteNewsMutation = useDeleteNews(entity: EntityTypes | null, options?: { optimistic?: boolean });
// deleteNewsMutation.mutate({ news })

// Édition (avec optimistic update optionnel)
const editNewsMutation = useEditNews(entity: EntityTypes, options?: { optimistic?: boolean });
// editNewsMutation.mutate({ news, newsData?, images?, documents?, newText?, newScope?, newTags? })

// Création
const addNewsMutation = useAddNews(entity: EntityTypes);
// addNewsMutation.mutate({ newsData, images?, documents? })

// Ajout d'images à une news existante
const addNewsImageMutation = useAddNewsImage(entity: EntityTypes);
// addNewsImageMutation.mutate({ news, images })

// Ajout d'une mention
const addNewsMentionMutation = useAddNewsMention(entity: EntityTypes);
// addNewsMentionMutation.mutate({ news, slug })

// Partage d'une news
const shareNewsMutation = useShareNews(entity: EntityTypes);
// shareNewsMutation.mutate({ originalNews, text? })

// Vote/réaction (avec optimistic update optionnel)
const addVoteNewsMutation = useAddVoteNews(entity: EntityTypes | null | undefined, options?: { optimistic?: boolean });
// addVoteNewsMutation.mutate({ news, voteType })

// Signalement
const reportNewsMutation = useReportNews();
// reportNewsMutation.mutate({ news, reason, comment? })
```

Après succès, `useDeleteNews`, `useEditNews`, `useAddNews`, `useAddVoteNews` invalident `NEWS_PREFIX(entityId)`. Les mutations avec `optimistic: true` effectuent un rollback en cas d'erreur.

### useNewsVotes

```ts
const { data: voteData, isLoading } = useNewsVotes(newsId: string | null);
```

Charge le détail des votes d'une news (endpoint `showVote` : qui a voté quoi). Utilisé par `NewsReactionsModal` pour afficher le détail par personne.

### useNewsCommentsQuery

```ts
const { data: comments, isLoading, refetch } = useNewsCommentsQuery(news: News | null);
```

Charge les commentaires d'une news via `news.getComments()`. Accepte l'objet `News` complet (pas juste l'ID). `userContextId` dans la queryKey — refetch auto après changement de session. Comme `useNewsQuery`, un `useEffect` gère la transformation SSR → instances Proxy réactives.

### Mutations commentaires (useCommentMutations.tsx)

Chaque opération est un hook séparé (tous exportés publiquement) :

```ts
// Ajout d'un commentaire (avec optimistic update optionnel)
const addCommentMutation = useAddComment(newsId: string, entity: EntityTypes, options?: { optimistic?: boolean });
// addCommentMutation.mutate({ news, text })

// Édition d'un commentaire (avec optimistic update optionnel, récursif dans l'arbre)
const editCommentMutation = useEditComment(newsId: string, entity: EntityTypes, options?: { optimistic?: boolean });
// editCommentMutation.mutate({ comment, newText })

// Suppression d'un commentaire (avec optimistic update optionnel, récursif)
const deleteCommentMutation = useDeleteComment(newsId: string, entity: EntityTypes, options?: { optimistic?: boolean });
// deleteCommentMutation.mutate({ comment, parentCommentId? })

// Répondre à un commentaire (avec optimistic update optionnel)
const replyToCommentMutation = useReplyToComment(newsId: string, entity: EntityTypes, options?: { optimistic?: boolean });
// replyToCommentMutation.mutate({ comment, text })

// Vote sur un commentaire (avec optimistic update optionnel)
const addCommentVoteMutation = useAddCommentVote(newsId: string, options?: { optimistic?: boolean });
// addCommentVoteMutation.mutate({ comment, voteType? })  // voteType défaut: "like"

// Signalement d'un commentaire
const reportCommentMutation = useReportComment();
// reportCommentMutation.mutate({ comment, reason, commentText? })
```

Les mutations add/delete/reply mettent à jour `commentCount` directement dans le cache des news (mutation Proxy) et invalident `NEWS_COMMENTS_PREFIX(newsId)`. La mise à jour optimiste utilise les helpers récursifs de `commentCacheUtils.ts`.

### useNewsPermissions

Wrapper typé sur `usePermissions(["news"], entity, { news })` :

```ts
const permissions = useNewsPermissions(entity: EntityTypes | null, news?: News | null);
// permissions.canAddNews — booléen
// permissions.canEditNews — booléen
// permissions.canDeleteNews — booléen
// permissions.canModerateNews — booléen
// permissions.canEditComment — booléen
// permissions.canDeleteComment — booléen
```

Le deuxième paramètre `news` est optionnel et utilisé pour affiner `canEditNews`/`canDeleteNews` en fonction de l'auteur de la news.

### useNewsEntity

Résout l'entité pour la section news :

```ts
const { entity, entityType, isLoading, isError } = useNewsEntity({ entitySlug?: string });
```

1. Si `entitySlug` fourni → charge l'entité via `useEntityBySlugQuery`
2. Sinon → utilise `useCocolight().entity` (entité courante du contexte global)

`entityType` est dérivé de `entity.getEntityType()` (null si pas d'entité).

### useFormatNews

```ts
const formattedNews: FormattedNews | null = useFormatNews(newsItem: News | null, entity: EntityTypes | null);
```

Retourne un objet `FormattedNews` avec les champs calculés suivants (ou `null` si `newsItem` absent) :

| Champ | Type | Description |
|-------|------|-------------|
| `authorName`, `authorPhoto`, `isAuthor` | string / string\|null / boolean | Infos auteur |
| `targetId`, `targetName`, `isSharedPost` | string\|null / string\|null / boolean | Infos post partagé |
| `formattedDate` | string | Date relative (date-fns, locale courante) |
| `sharedBy`, `sharedByCount`, `firstSharer` | SharedByPerson[] / number / string\|null | Partages |
| `hasImages`, `images` | boolean / NewsImageItem[] | Images attachées |
| `hasFiles`, `mediaFiles` | boolean / NewsDocumentItem[] | Fichiers attachés |
| `hasVideo`, `videoEmbedUrl` | boolean / string\|null | Vidéo embarquée |
| `totalVotes` | number | Somme de toutes les réactions |
| `scope` | string | `"public"` \| `"private"` \| `"restricted"` |
| `mentions` | NewsMention[] \| undefined | Mentions @user |
| `canEdit`, `canDelete` | boolean | Permissions calculées (via `useNewsPermissions`) |
| `tags`, `commentCount`, `voteCount`, `text`, `date` | mixed | Champs serveur bruts |

### useFormatComment

```ts
const formattedComment: FormattedComment | null = useFormatComment(commentItem: Comment | null, entity: EntityTypes | null);
```

Retourne un objet `FormattedComment` (ou `null`) :

| Champ | Type | Description |
|-------|------|-------------|
| `authorName`, `authorPhoto`, `isAuthor` | string / string\|null / boolean | Infos auteur |
| `formattedDate` | string | Date relative |
| `totalVotes` | number | Total des réactions |
| `replies` | FormattedReply[] | Réponses formatées (récursif, 1 niveau) |
| `repliesCount` | number | Nombre de réponses |
| `canEdit` | boolean | Auteur du commentaire uniquement |
| `canDelete` | boolean | Auteur OU `canModerateNews` |
| `id`, `text` | string | Identifiant et texte |

Chaque `FormattedReply` contient les mêmes champs de base + `comment: Comment` (objet complet pour les mutations).

---

## Composants

### NewsSection (section JSON)

`components/sections/NewsSection.tsx` — Orchestre l'ensemble : chargement des news, permissions, état des modaux. Intègre :
1. `useNewsEntity()` pour résoudre l'entité
2. `useNewsPermissions()` pour les gates UI
3. `useLazyTab("news")` — charge uniquement quand le tab news est actif (optimisation)
4. `useNewsDetailUrlGenerator(entity)` (depuis `src/modules/profil/hooks/`) pour générer les URLs de détail
5. `useNewsQuery()` pour la liste infinie
6. Rend des `<NewsItem>` avec les handlers d'action (edit, delete, share, report)

Le composant enveloppe son output dans `<NewsProvider value={...}>` avec un `NewsContextType` complet (entity, entityId, entityType, permissions, detailUrlGenerator).

### NewsItem

`components/NewsItem.tsx` — Rendu d'une news individuelle. Reçoit le contexte via `useNewsContext()`. Composition :
- En-tête : avatar auteur, nom, date absolue + relative, badge scope
- Corps : `<NewsContent>` (texte Markdown + mentions), vidéo embarquée, `<NewsImageGrid>`, `<NewsFileList>`, tags
- Compteur de partages avec avatars
- Footer : bouton commentaires (avec compteur réactif via `useReactiveProperty`), picker de réaction (HoverCard), bouton partager
- Menu contextuel (DropdownMenu) : voir détail, éditer, signaler, supprimer
- `<NewsComments>` affiché si commentaires dépliés

Props : `item`, `entity?`, `isLastItem?`, `lastItemRef?`, `onEdit?`, `onDelete?`, `onShare?`, `onReport?`, `detailMode?` (booléen — masque le lien "voir détail" en mode page de détail).

### NewsContent

`components/NewsContent.tsx` — Rendu du contenu textuel avec :
- Parsing des mentions `@slug` → liens Markdown `[@name](/profil/slug)` via `parseMentionsToMarkdown()`
- Rendu Markdown via `react-markdown` + `remark-gfm` (liens externes dans nouvel onglet)
- Troncature à `maxLength` caractères (défaut 300) avec bouton "Lire plus / Lire moins"

Props : `text: string`, `mentions?: NewsMention[]`, `maxLength?: number`.

### NewsDetailPage

`components/NewsDetailPage.tsx` — Page de détail d'une news (rendu via sous-route dans le module profil). Charge la news via `useNewsByIdQuery`. Intègre les modaux d'édition, suppression, partage, signalement. En cas de suppression, navigue vers `/profil/:slug/news`.

Props : `params: Record<string, string | undefined>` (contient `newsId`), `entity: EntityTypes`, `sectionProps?: NewsSection["props"]`.

Enveloppe dans `<NewsProvider>` avec permissions calculées depuis `useNewsPermissions(entity)`.

### Formulaires (AddNewsModal, EditNewsModal)

Modales React Hook Form + Zod. Champs :
- Texte de l'actualité (avec `MentionInput` pour @mentions)
- Images (jusqu'à 5 via `NewsFormImageUpload`)
- Documents (via `NewsFormDocumentUpload`)
- Portée : public, privée, restreinte

`AddNewsModal` utilise `useAddNews` en interne. `EditNewsModal` utilise `useEditNews`.

### Upload de médias

`forms/NewsFormImageUpload.tsx` — Sélection + prévisualisation d'images. Déclenche `ImageCropDialog` pour le recadrage avant upload.

`forms/NewsFormDocumentUpload.tsx` — Sélection de fichiers (PDF, Word, etc.). Affiche la progression via `FileUploadProgress`.

`forms/FileUploadProgress.tsx` — Barre de progression visuelle pour les uploads en cours.

`forms/ImageCropDialog.tsx` — Dialog de recadrage basé sur `react-easy-crop`. Génère un canvas crop et retourne le blob de l'image recadrée.

### Commentaires

`comment/NewsComments.tsx` — Conteneur qui charge et affiche les commentaires via `useNewsCommentsQuery`.

`comment/CommentInput.tsx` — Champ de saisie avec `MentionInput` pour auto-complétion @user. Soumet via `useAddComment`.

`comment/CommentItem.tsx` — Rendu d'un commentaire : texte (avec @mentions linkifiées), date, réactions sur commentaires, boutons supprimer/éditer (conditionné aux permissions), fil de réponses imbriquées.

`comment/DeleteCommentDialog.tsx` — Dialog de confirmation avant suppression.

### Interactions (réactions + votes)

`interactions/NewsReactionPicker.tsx` — Sélecteur de 8 réactions emoji (love, like, enjoy, glad, bothered, sad, scared, support) affiché dans une `HoverCard` au survol du bouton "Aimer". Appelle `useAddVoteNews` via le handler passé en prop.

`interactions/NewsReactionsModal.tsx` — Modale listant tous les votes : qui a voté quoi. Utilise `useNewsVotes(newsId)`.

`interactions/NewsVoteDisplay.tsx` — Affichage agrégé des réactions : bulles emoji avec compteur, cliquable pour ouvrir `NewsReactionsModal`.

Les types de votes (`VoteType[]`) sont définis dans `constants/voteTypes.ts` avec leurs icônes Lucide et classes Tailwind. `voteTypeMap` (Record) permet un accès O(1) par type.

### Autres dialogues

`DeleteNewsDialog.tsx` — Dialog de confirmation de suppression d'une news.

`ReportDialog.tsx` — Dialog de signalement avec liste déroulante de raisons (depuis `constants/reportReasons.ts`, 7 raisons avec clés i18n) + champ commentaire optionnel. Fonctionne pour les news (`type="news"`) et les commentaires.

`ShareNewsDialog.tsx` — Dialog de partage : copie du lien, partage sur réseaux sociaux.

### Mentions @user

`mention/MentionInput.tsx` — Textarea qui détecte la frappe de `@` et déclenche la recherche d'utilisateurs. Insère la mention formatée.

`mention/MentionSuggestions.tsx` — Dropdown de suggestions (avatar + nom) affiché sous le curseur lors de la saisie d'une mention.

---

## Permissions

Le module enregistre un namespace `news` (via `permissions/register.ts`). 6 permissions calculées dans `calculators/news.ts` selon 5 cas :

| Cas | Condition |
|-----|-----------|
| Son propre profil (`isOwnProfile`) | Utilisateur connecté visualisant son propre profil |
| Autre utilisateur | Entité de type `citoyens` appartenant à quelqu'un d'autre |
| Organisation | `isAdmin()` ou `isMember()` |
| Projet | `isAdmin()` ou `isContributor()` |
| Événement | `isAdmin({ checkHierarchy: true })` ou `isAuthor()` |

| Permission | Règle |
|-----------|-------|
| `canAddNews` | Propre profil, ou admin/membre (org), ou admin/contributeur (projet), ou admin/auteur (event) |
| `canEditNews` | Auteur de la news (`news.isAuthor()`) OU admin de l'entité |
| `canDeleteNews` | Auteur de la news OU admin de l'entité |
| `canModerateNews` | Admin/auteur de l'entité (ou propre profil) |
| `canEditComment` | `true` pour les cas org/projet/event (tout membre peut éditer ses propres commentaires) |
| `canDeleteComment` | Combiné avec `isCommentAuthor` dans `useFormatComment` |

```ts
const permissions = useNewsPermissions(entity, news); // news optionnel
if (permissions.canAddNews) { /* afficher bouton Ajouter */ }
```

---

## Contexte NewsContext

`NewsContextType` (défini dans `types.ts`) :

```ts
interface NewsContextType {
  entity?: EntityTypes;
  entityId?: string;
  entityType?: string;
  config?: NewsModuleConfig;
  permissions?: NewsPermissions;        // Type depuis types.ts (canAdd, canEdit, canDelete, canModerate, canComment, canReact, canShare, canReport)
  detailUrlGenerator?: (newsId: string) => string | null;
}
```

`NewsProvider` accepte une unique prop `value: NewsContextType` (pas de props séparées `entity`/`entityType`) :

```tsx
<NewsProvider value={{
  entity,
  entityId: entity?.id,
  entityType: entity?.getEntityType(),
  permissions: newsPermissions,
  detailUrlGenerator,
}}>
  <NewsItem item={news} />
</NewsProvider>
```

Accès via `useNewsContext()` (throw si hors Provider) ou `useOptionalNewsContext()` (retourne `undefined`).

**Note** : `NewsPermissions` dans `types.ts` (champs `canAdd`, `canEdit`, `canDelete`, etc.) est distinct de `NewsPermissions` dans `permissions/types.ts` (champs `canAddNews`, `canEditNews`, etc.). Le contexte utilise la version de `types.ts` qui correspond aux gates UI passées via `newsPermissions` dans `NewsSection`.

---

## React Query — clés et invalidations

```ts
NEWS_QUERY_KEYS.NEWS(entityId, userContextId)               // ["news", entityId, userContextId]
NEWS_QUERY_KEYS.NEWS_PREFIX(entityId)                       // ["news", entityId] — invalidations larges
NEWS_QUERY_KEYS.NEWS_BY_ID(entityId, newsId, userContextId) // ["news-by-id", entityId, newsId, userContextId]
NEWS_QUERY_KEYS.NEWS_BY_ID_PREFIX(entityId, newsId)         // ["news-by-id", entityId, newsId]
NEWS_QUERY_KEYS.NEWS_COMMENTS(newsId, userContextId)        // ["news-comments", newsId, userContextId]
NEWS_QUERY_KEYS.NEWS_COMMENTS_PREFIX(newsId)                // ["news-comments", newsId]
NEWS_QUERY_KEYS.NEWS_VOTES(newsId, userContextId)           // ["news-votes", newsId, userContextId]
NEWS_QUERY_KEYS.NEWS_VOTES_PREFIX(newsId)                   // ["news-votes", newsId]
```

**Pourquoi `userContextId` dans les clés ?** La liste des news visible dépend de la session (news privées uniquement pour les membres). Un changement de contexte utilisateur (connexion/déconnexion) doit déclencher un refetch. `useHydratedUserContextId()` retourne `null` côté SSR (évite le mismatch d'hydratation), puis la vraie valeur après montage côté client.

**Invalidations** :
- Après création/édition/suppression/vote d'une news → `NEWS_PREFIX(entityId)` (invalide toutes les pages de la liste)
- Après action sur commentaire → `NEWS_COMMENTS_PREFIX(newsId)`
- `NEWS_BY_ID` n'est pas invalidé via `NEWS_PREFIX` (clé racine différente — invalider explicitement via `NEWS_BY_ID_PREFIX` si besoin après update/delete)

---

## Préchargement SSR

```ts
import { prefetchNewsQuery } from "@/modules/news";

await prefetchNewsQuery(queryClient, entity, indexStep = 12);
```

Utilise `queryClient.prefetchInfiniteQuery` avec la queryKey `NEWS(entity.id, null)` (sans `userContextId` — `null` est la valeur correcte côté serveur). Appelle `entity.getNews({ indexStep })` pour la première page.

**Usage dans le loader profil** : le module profil appelle `prefetchNewsQuery` si le tab actif contient une section `news` et que le type d'entité est supporté.

---

## i18n

Namespace : **`modules/news`**. Enregistré en side-effect par `i18n.ts`.

Groupes de clés dans `fr.json` / `en.json` :

| Groupe | Contenu |
|--------|---------|
| `NewsTab.*` | Labels actions news (comment, like, share, report, delete, edit, readMore, sharedBy…) |
| `NewsSection.*` | Labels section (noNews, createPost, loadingNews, upToDate, entityError, viewDetails…) |
| `comments.*` | Interface commentaires (writeComment, reply, expandThread, deleteDialog…) |
| `forms.*` | Champs formulaires (addNews, editNews, scope, imageUpload, documentUpload, imageCrop, tagsInput) |
| `reportDialog.*` | Dialog signalement (title, reasons.spam, reasons.harassment, etc.) |
| `deleteDialog.*` | Dialog suppression news |
| `shareDialog.*` | Dialog partage |
| `mentions.*` | Auto-complétion @user |
| `tags.*` | Recherche de tags |
| `reactions.*` | Labels agrégés des réactions (allReactions, noReactions…) |
| `reactionsTypes.*` | Labels par type (love, like, enjoy, glad, bothered, sad, scared, support) |
| `validation.*` | Messages d'erreur de validation (textRequired, textTooShort) |
| `NewsDetailPage.*` | Labels page de détail (back, newsNotFound…) |
| `toast.*` | Notifications de succès/erreur (add, edit, delete, vote, comment.*, reply.*, report.*) |
| `a11y.*` | Labels accessibilité (moreOptions) |

---

## Exemple de configuration JSON

```json
{
  "type": "news",
  "id": "actualites",
  "props": {
    "title": { "fr": "Actualités", "en": "News" },
    "maxItems": 15,
    "showAddButton": true,
    "showFilters": false,
    "showComments": true,
    "showReactions": true
  }
}
```

**Dans un onglet profil** (avec entitySlug explicite) :
```json
{
  "id": "news",
  "label": { "fr": "Actualités", "en": "News" },
  "sections": [
    {
      "type": "news",
      "props": {
        "maxItems": 20,
        "showAddButton": true,
        "showComments": true
      }
    }
  ],
  "subRoutes": [
    { "path": ":newsId", "component": "NewsDetailPage" }
  ],
  "condition": {
    "entityTypes": ["organizations", "projects", "citoyens"]
  }
}
```

---

## Voir aussi

- [Module Search](07-module-search.md)
- [Module Profil](08-module-profil.md) — intégration via onglet news + sous-routes
- [Permissions](10-permissions.md) — registre central, `usePermissions`
- [API & Authentification](11-api-authentification.md) — `cocolight-api-client`, `entity.getNews()`
- [Backend & SSR](14-backend-ssr.md) — `prefetchNewsQuery`, hydratation
