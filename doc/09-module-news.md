[← Retour à l'index](README.md)

# Module News

**Sommaire**

- [Module News](#module-news)
  - [Architecture interne](#architecture-interne)
  - [Schéma de configuration (`schema.ts`)](#schéma-de-configuration-schemats)
  - [Hooks principaux](#hooks-principaux)
  - [Exemple de configuration JSON](#exemple-de-configuration-json)
  - [Préchargement SSR](#préchargement-ssr)
  - [Récapitulatif](#récapitulatif)
  - [Voir aussi](#voir-aussi)

---

Le module News gère l'affichage des actualités avec système de commentaires, réactions et partage.

> **Note importante** : Ce module ne définit **pas de routes** propres, il expose uniquement une section `news` utilisable dans les pages JSON.

## Architecture interne

```
src/modules/news/
├── schema.ts                 # NewsSectionSchema, NewsConfigSchema
├── types.ts                  # Types TypeScript dérivés
├── i18n.ts                   # Pont vers react-i18next
├── index.ts                  # Exports centralisés
├── components/
│   ├── index.ts              # Exports centralisés des composants
│   ├── sections/
│   │   └── NewsSection.tsx   # Section principale (exportée dans SectionRenderer)
│   ├── forms/
│   │   ├── AddNewsModal.tsx  # Modal d'ajout de news
│   │   ├── EditNewsModal.tsx # Modal d'édition
│   │   ├── NewsFormImageUpload.tsx
│   │   ├── NewsFormDocumentUpload.tsx
│   │   ├── FileUploadProgress.tsx
│   │   └── ImageCropDialog.tsx
│   ├── comment/
│   │   ├── NewsComments.tsx  # Liste des commentaires
│   │   ├── CommentInput.tsx  # Saisie de commentaire
│   │   ├── CommentItem.tsx   # Affichage d'un commentaire
│   │   └── DeleteCommentDialog.tsx
│   ├── interactions/
│   │   ├── NewsReactionPicker.tsx  # Sélecteur de réactions
│   │   ├── NewsReactionsModal.tsx  # Modal des réactions
│   │   └── NewsVoteDisplay.tsx     # Affichage des votes
│   ├── media/
│   │   ├── NewsImageGrid.tsx  # Grille d'images
│   │   └── NewsFileList.tsx   # Liste de fichiers joints
│   ├── mention/
│   │   ├── MentionInput.tsx       # Input avec mentions @user
│   │   └── MentionSuggestions.tsx # Suggestions de mentions
│   ├── NewsItem.tsx           # Élément de news individuel
│   ├── NewsContent.tsx        # Contenu d'une news
│   ├── NewsDetailPage.tsx     # Vue détaillée d'une news
│   ├── DeleteNewsDialog.tsx   # Dialog de suppression
│   ├── ReportDialog.tsx       # Dialog de signalement
│   └── ShareNewsDialog.tsx    # Dialog de partage
├── hooks/
│   ├── useNewsQuery.tsx       # Query pour liste de news
│   ├── useNewsByIdQuery.tsx   # Query pour une news par ID
│   ├── useNewsMutations.tsx   # Mutations CRUD news
│   ├── useNewsVotes.tsx       # Gestion des votes/réactions
│   ├── useNewsCommentsQuery.tsx   # Query pour commentaires
│   ├── useCommentMutations.tsx    # Mutations CRUD commentaires
│   ├── useFormatNews.tsx      # Formatage des données news
│   ├── useFormatComment.tsx   # Formatage des commentaires
│   ├── useNewsEntity.tsx      # Accès à l'entité news
│   ├── useNewsContext.tsx     # Accès au contexte news
│   └── useNewsPermissions.ts  # Hook local pour permissions news (voir 7.5)
├── permissions/              # Système de permissions modulaire (voir 7.5)
│   ├── types.ts              # NewsPermissions (6 champs)
│   ├── defaults.ts           # DEFAULT_NEWS_PERMISSIONS
│   ├── calculators/
│   │   └── news.ts           # calculateNewsPermissions
│   ├── register.ts           # Enregistrement namespace "news"
│   └── index.ts              # Exports
├── contexts/
│   ├── NewsContext.tsx        # Contexte React
│   ├── NewsProvider.tsx       # Provider du contexte
│   └── index.ts
├── prefetch/
│   ├── prefetchNews.ts        # Préchargement SSR des news
│   └── index.ts
├── constants/
│   ├── queryKeys.ts           # Clés React Query
│   ├── voteTypes.ts           # Types de votes/réactions
│   ├── reportReasons.ts       # Raisons de signalement
│   ├── supportedTypes.ts      # Types d'entités supportés
│   └── index.ts
└── utils/
    ├── commentCacheUtils.ts   # Utilitaires cache commentaires
    └── index.ts
```

## Schéma de configuration (`schema.ts`)

```ts
// Section News pour affichage dans les pages
export const NewsSectionSchema = z.object({
  type: z.literal("news"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    entitySlug: z.string().optional(),        // Filtrer par entité
    maxItems: z.number().positive().optional().default(10),
    showAddButton: z.boolean().optional().default(true),
    showFilters: z.boolean().optional().default(false),
    showComments: z.boolean().optional().default(true),
    showReactions: z.boolean().optional().default(true),
  }),
});

// Configuration globale du module
export const NewsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxFileSize: z.number().positive().default(10 * 1024 * 1024), // 10MB
  allowedFileTypes: z.array(z.string()).default(["image/jpeg", "image/png", "image/webp"]),
  maxImages: z.number().positive().default(5),
  maxTextLength: z.number().positive().default(2000),
  enableReactions: z.boolean().default(true),
  enableComments: z.boolean().default(true),
  enableSharing: z.boolean().default(true),
  moderationEnabled: z.boolean().default(false),
});
```

## Hooks principaux

```ts
// Liste des news avec pagination infinie (timestamp-based)
const {
  news,              // News[] transformées en instances Proxy
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  lastItemRef,       // Ref pour infinite scroll
  error,
  refetch
} = useNewsQuery({
  entity,            // EntityTypes - l'entité parente
  entityType,        // string - "organizations" | "projects" | "citoyens"
  enabled: true,     // boolean - activer/désactiver la query
  indexStep: 12      // number - items par page
});

// News par ID
const { data: news, isLoading } = useNewsByIdQuery(newsId);

// Accès à l'entité depuis le contexte
const entity = useNewsEntity(); // EntityTypes

// Mutations CRUD
const { createNews, updateNews, deleteNews } = useNewsMutations();

// Votes et réactions
const { addVote, removeVote, hasVoted } = useNewsVotes(newsId);

// Commentaires
const { data: comments } = useNewsCommentsQuery(newsId);
const { addComment, deleteComment } = useCommentMutations();

// Context
const { entity, entityType } = useNewsContext();
const contextOrNull = useOptionalNewsContext(); // Version optionnelle
```

**Types d'entités supportés** (définies dans `constants/supportedTypes.ts`):
```ts
const NEWS_SUPPORTED_TYPES = new Set(["organizations", "projects", "citoyens"]);
```

## Exemple de configuration JSON

```json
{
  "type": "news",
  "id": "actualites",
  "props": {
    "title": { "fr": "Actualités", "en": "News" },
    "entitySlug": "my-organization",
    "maxItems": 15,
    "showAddButton": true,
    "showFilters": true,
    "showComments": true,
    "showReactions": true
  }
}
```

## Préchargement SSR

Le module supporte le préchargement SSR via `prefetchNewsQuery`:

```ts
import { prefetchNewsQuery } from "@/modules/news";

/**
 * Pré-charge les news d'une entité dans React Query
 * @param queryClient - Instance QueryClient
 * @param entity - Entité parente (EntityTypes)
 * @param indexStep - Nombre d'items par page (défaut: 12)
 */
export async function prefetchNewsQuery(
  queryClient: QueryClient,
  entity: EntityTypes,
  indexStep = 12
): Promise<void> {
  await queryClient.prefetchInfiniteQuery({
    queryKey: NEWS_QUERY_KEYS.NEWS(entity.id ?? null),
    queryFn: async () => entity.getNews({ indexStep }),
    initialPageParam: undefined,
  });
}
```

**Usage dans le loader du module profil** (routes.tsx):

```ts
// Le module profil pré-charge automatiquement les news si le tab actif contient une section news
if (tabConfig?.sections?.some(s => s.type === 'news') && NEWS_SUPPORTED_TYPES.has(entityType)) {
  await prefetchNewsQuery(queryClient, entity);
}
```

---

## Récapitulatif

| Module | Type | Routes | Usage |
|--------|------|--------|-------|
| **news** | — | Non | Section `news` avec commentaires et réactions |

---

## Voir aussi

- [Module Search](07-module-search.md)
- [Module Profil](08-module-profil.md)
- [Permissions](10-permissions.md)
