[← Retour à l'index](README.md)

# Module News

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Schéma de configuration (`schema.ts`)](#schéma-de-configuration-schemats)
- [Hooks principaux](#hooks-principaux)
  - [useNewsQuery](#usenewsquery)
  - [useNewsByIdQuery](#usenewsbyidquery)
  - [useNewsMutations / useDeleteNews](#usenewsmutations--usedeletenews)
  - [useNewsVotes](#usenewsvotes)
  - [useNewsCommentsQuery](#usenewscommentsquery)
  - [useCommentMutations](#usecommentmutations)
  - [useNewsPermissions](#usenewspermissions)
  - [useNewsEntity](#usenewsentity)
  - [useFormatNews / useFormatComment](#useformatnews--useformatcomment)
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
- Commentaires avec mise en forme et mentions @user
- Réactions emoji (likes/votes)
- Upload d'images (avec recadrage) et de documents
- Partage et signalement
- Intégration naturelle dans les onglets de profil

**Type de module** : pas de `module.config.ts` (pas de routes propres) — le module expose uniquement la section `news` utilisable dans les pages JSON.

**Entités supportées** : `organizations`, `projects`, `citoyens` (défini dans `constants/supportedTypes.ts`).

---

## Architecture interne

```
src/modules/news/
├── schema.ts                       # NewsSectionSchema + NewsConfigSchema (Zod)
├── types.ts                        # Types TypeScript dérivés
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
│   │   ├── CommentItem.tsx         # Rendu d'un commentaire (texte + réactions + actions)
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
│   ├── NewsContent.tsx             # Rendu du contenu (texte + médias)
│   ├── NewsDetailPage.tsx          # Page/modale de détail d'une news
│   ├── DeleteNewsDialog.tsx        # Dialog confirmation suppression news
│   ├── ReportDialog.tsx            # Dialog de signalement (avec raisons)
│   └── ShareNewsDialog.tsx         # Dialog de partage (lien + social)
│
├── hooks/
│   ├── useNewsQuery.tsx            # Liste infinie news (timestamp-based)
│   ├── useNewsByIdQuery.tsx        # News par ID (pour DetailPage)
│   ├── useNewsMutations.tsx        # Mutations CRUD : useDeleteNews, useCreateNews, useUpdateNews
│   ├── useNewsVotes.tsx            # Query détail des votes (qui a voté quoi)
│   ├── useNewsCommentsQuery.tsx    # Query commentaires d'une news
│   ├── useCommentMutations.tsx     # Mutations CRUD commentaires
│   ├── useFormatNews.tsx           # Normalisation news → format d'affichage
│   ├── useFormatComment.tsx        # Normalisation commentaire → format d'affichage
│   ├── useNewsEntity.tsx           # Résolution de l'entité (par entitySlug ou contexte)
│   ├── useNewsContext.tsx          # Accès au contexte News (safe + optionnel)
│   └── useNewsPermissions.ts      # Hook local wrapper sur usePermissions(["news"])
│
├── permissions/
│   ├── types.ts                    # NewsPermissions (6 champs)
│   ├── defaults.ts                 # DEFAULT_NEWS_PERMISSIONS
│   ├── calculators/
│   │   └── news.ts                 # calculateNewsPermissions
│   ├── register.ts                 # registerPermissions(namespace: "news")
│   └── index.ts                    # Exports
│
├── contexts/
│   ├── NewsContext.tsx             # Définition du contexte React
│   ├── NewsProvider.tsx            # Provider (entity, entityType)
│   └── index.ts
│
├── prefetch/
│   ├── prefetchNews.ts             # prefetchNewsQuery (SSR)
│   └── index.ts
│
├── constants/
│   ├── queryKeys.ts                # NEWS_QUERY_KEYS (4 clés avec userContextId)
│   ├── voteTypes.ts                # Types de votes/réactions (like, love, …)
│   ├── reportReasons.ts            # Raisons de signalement
│   ├── supportedTypes.ts           # Set des types supportés
│   └── index.ts
│
└── utils/
    ├── commentCacheUtils.ts        # Helpers de mise à jour optimiste du cache commentaires
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

**`entitySlug`** : si absent, la section utilise l'entité du profil courant (via `useNewsEntity`). Si présent, elle charge l'entité correspondant au slug.

---

## Hooks principaux

### useNewsQuery

```ts
const {
  news,               // News[] — instances transformées via useFormatNews
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

**Pagination** : timestamp-based (API Cocolight utilise `date` décroissant). `userContextId` est inclus dans la queryKey via `useHydratedUserContextId()` pour forcer un refetch quand le contexte d'utilisateur change (connexion/déconnexion).

**Restriction** : uniquement pour les types `organizations`, `projects`, `citoyens` (vérifié en interne). Les autres types retournent une liste vide.

### useNewsByIdQuery

```ts
const { data: news, isLoading } = useNewsByIdQuery(newsId: string | null);
```

Charge une news par son ID pour la page de détail. `enabled` quand `newsId` est non-null.

### useNewsMutations / useDeleteNews

```ts
const deleteNewsMutation = useDeleteNews(entity, { optimistic: true });
// deleteNewsMutation.mutate({ news })
```

Avec `optimistic: true`, la news est retirée du cache immédiatement avant la confirmation serveur (avec rollback en cas d'erreur). Invalide `NEWS_PREFIX(entityId)` après succès.

Les hooks `useCreateNews` et `useUpdateNews` (non exportés publiquement depuis `index.ts`) sont utilisés directement dans `AddNewsModal` et `EditNewsModal` respectivement.

### useNewsVotes

```ts
const { data: voteData, isLoading } = useNewsVotes(newsId: string | null);
```

Charge le détail des votes d'une news (`showVote` API endpoint). Utilisé par `NewsReactionsModal` pour afficher "qui a voté quoi".

### useNewsCommentsQuery

```ts
const { data: comments, isLoading, refetch } = useNewsCommentsQuery(newsId: string | null);
```

Charge les commentaires d'une news. `userContextId` dans la queryKey — refetch auto après changement de session.

### useCommentMutations

```ts
const { addComment, deleteComment } = useCommentMutations();
// addComment.mutate({ newsId, text, parentId? })
// deleteComment.mutate({ newsId, commentId })
```

`addComment` utilise une mise à jour optimiste du cache via `commentCacheUtils.ts` (ajoute le commentaire localement avant confirmation serveur). `deleteComment` invalide `NEWS_COMMENTS_PREFIX(newsId)`.

### useNewsPermissions

Wrapper typé sur `usePermissions(["news"], entity)` :

```ts
const permissions = useNewsPermissions(entity);
// permissions.canAddNews — booléen
// permissions.canEditNews — booléen
// permissions.canDeleteNews — booléen
// permissions.canModerateNews — booléen
// permissions.canEditComment — booléen
// permissions.canDeleteComment — booléen
```

### useNewsEntity

Résout l'entité pour la section news. Si `entitySlug` est fourni, charge l'entité correspondante via l'API. Sinon, utilise l'entité du contexte `NewsContext` (injecté par `NewsProvider`).

### useFormatNews / useFormatComment

Normalisent les données brutes des réponses API en format d'affichage enrichi (dates formatées, auteur, médias).

---

## Composants

### NewsSection (section JSON)

`components/sections/NewsSection.tsx` — Orchestre l'ensemble : chargement des news, permissions, état des modaux. Intègre :
1. `useNewsEntity()` pour résoudre l'entité
2. `useNewsPermissions()` pour les gates UI
3. `useLazyTab("news")` — charge uniquement quand le tab news est actif (optimisation)
4. `useNewsQuery()` pour la liste infinie
5. Rend des `<NewsItem>` avec les handlers d'action (edit, delete, share, report)

Le composant est enveloppé dans `<NewsProvider>` en interne pour que les sous-composants accèdent à l'entité via contexte.

### NewsItem

`components/NewsItem.tsx` — Rendu d'une news individuelle. Composition :
- En-tête : avatar auteur, nom, date relative, scope badge
- Corps : `<NewsContent>` (texte + médias)
- Footer : `<NewsVoteDisplay>` (réactions), `<NewsComments>` si déplié, boutons d'action

Props : `news`, `onEdit`, `onDelete`, `onShare`, `onReport`, permissions.

### NewsContent

`components/NewsContent.tsx` — Rendu du contenu textuel (avec support Markdown léger via `sanitize.ts`) + `<NewsImageGrid>` + `<NewsFileList>`.

### NewsDetailPage

`components/NewsDetailPage.tsx` — Page de détail d'une news (accessible via sous-route `/profil/:slug/news/:newsId`). Charge la news via `useNewsByIdQuery` et affiche l'intégralité du contenu avec les commentaires.

### Formulaires (AddNewsModal, EditNewsModal)

Modales React Hook Form + Zod. Champs :
- Texte de l'actualité (avec `MentionInput` pour @mentions)
- Images (jusqu'à 5 via `NewsFormImageUpload`)
- Documents (via `NewsFormDocumentUpload`)
- Portée : public, privée, restreinte

`AddNewsModal` utilise `useCreateNews` en interne. `EditNewsModal` utilise `useUpdateNews`.

### Upload de médias

`forms/NewsFormImageUpload.tsx` — Sélection + prévisualisation d'images. Déclenche `ImageCropDialog` pour le recadrage avant upload.

`forms/NewsFormDocumentUpload.tsx` — Sélection de fichiers (PDF, Word, etc.). Affiche la progression via `FileUploadProgress`.

`forms/FileUploadProgress.tsx` — Barre de progression visuelle pour les uploads en cours.

`forms/ImageCropDialog.tsx` — Dialog de recadrage basé sur `react-easy-crop`. Génère un canvas crop et retourne le blob de l'image recadrée.

### Commentaires

`comment/NewsComments.tsx` — Conteneur qui charge et affiche les commentaires via `useNewsCommentsQuery`.

`comment/CommentInput.tsx` — Champ de saisie avec `MentionInput` pour auto-complétion @user. Soumet via `useCommentMutations().addComment`.

`comment/CommentItem.tsx` — Rendu d'un commentaire : texte (avec @mentions linkifiées), date, réactions sur commentaires, boutons supprimer/éditer (conditionné aux permissions), réponses (commentaires imbriqués).

`comment/DeleteCommentDialog.tsx` — Dialog de confirmation avant suppression.

### Interactions (réactions + votes)

`interactions/NewsReactionPicker.tsx` — Selecteur emoji (like, love, etc.) affiché au survol/tap d'une news. Appelle le vote via l'API.

`interactions/NewsReactionsModal.tsx` — Modale listant tous les votes : qui a voté quoi. Utilise `useNewsVotes(newsId)`.

`interactions/NewsVoteDisplay.tsx` — Affichage agrégé des réactions : bulles emoji avec compteur, cliquable pour ouvrir `NewsReactionsModal`.

### Autres dialogues

`DeleteNewsDialog.tsx` — Dialog de confirmation de suppression d'une news.

`ReportDialog.tsx` — Dialog de signalement avec liste déroulante de raisons (depuis `constants/reportReasons.ts`) + champ commentaire optionnel.

`ShareNewsDialog.tsx` — Dialog de partage : copie du lien, partage sur réseaux sociaux.

### Mentions @user

`mention/MentionInput.tsx` — Textarea qui détecte la frappe de `@` et déclenche la recherche d'utilisateurs. Insère la mention formatée.

`mention/MentionSuggestions.tsx` — Dropdown de suggestions (avatar + nom) affiché sous le curseur lors de la saisie d'une mention.

---

## Permissions

Le module enregistre un namespace `news` (via `permissions/register.ts`). 6 permissions calculées dans `calculators/news.ts` :

| Permission | Règle |
|-----------|-------|
| `canAddNews` | Connecté + entité accessible |
| `canEditNews` | Auteur de la news OU modérateur/admin de l'entité |
| `canDeleteNews` | Auteur OU admin OU modérateur |
| `canModerateNews` | Admin ou rôle modérateur sur l'entité |
| `canEditComment` | Auteur du commentaire |
| `canDeleteComment` | Auteur OU admin/modérateur |

```ts
const permissions = useNewsPermissions(entity);
if (permissions.canAddNews) { /* afficher bouton Ajouter */ }
```

---

## Contexte NewsContext

`NewsProvider` injecte `entity` et `entityType` dans `NewsContext`. Utilisé par les sous-composants qui n'ont pas accès directement à l'entité (ex : `CommentInput` qui a besoin de l'`entityId` pour l'auto-complétion des mentions).

```tsx
<NewsProvider entity={entity} entityType={entityType}>
  <NewsItem news={news} />
</NewsProvider>
```

Accès via `useNewsContext()` (throw si hors Provider) ou `useOptionalNewsContext()` (null safe).

---

## React Query — clés et invalidations

```ts
NEWS_QUERY_KEYS.NEWS(entityId, userContextId)        // ["news", entityId, userContextId]
NEWS_QUERY_KEYS.NEWS_PREFIX(entityId)                // ["news", entityId] — pour invalidations larges
NEWS_QUERY_KEYS.NEWS_BY_ID(entityId, newsId, uid)    // ["news-by-id", ...]
NEWS_QUERY_KEYS.NEWS_COMMENTS(newsId, uid)           // ["news-comments", newsId, uid]
NEWS_QUERY_KEYS.NEWS_VOTES(newsId, uid)              // ["news-votes", newsId, uid]
```

**Pourquoi `userContextId` dans les clés ?** La liste des news visible dépend de la session (news privées uniquement pour les membres). Un changement de contexte utilisateur (connexion/déconnexion) doit déclencher un refetch. `useHydratedUserContextId()` retourne `null` côté SSR (évite le mismatch d'hydratation), puis la vraie valeur après montage côté client.

**Invalidations** :
- Après création/édition/suppression d'une news → `NEWS_PREFIX(entityId)` (invalide toutes les pages)
- Après action sur commentaire → `NEWS_COMMENTS_PREFIX(newsId)`

---

## Préchargement SSR

```ts
import { prefetchNewsQuery } from "@/modules/news";

await prefetchNewsQuery(queryClient, entity, indexStep = 12);
```

Appelle `entity.getNews({ indexStep })` et hydrate le cache React Query avec la queryKey `NEWS(entity.id, null)` (sans `userContextId` côté serveur, `null` est la valeur correct pour le SSR).

**Usage dans le loader profil** : le module profil appelle `prefetchNewsQuery` si le tab actif contient une section `news` et que le type d'entité est supporté.

---

## i18n

Namespace : **`modules/news`**. Enregistré en side-effect par `i18n.ts`.

Groupes de clés dans `fr.json` / `en.json` :
- `NewsSection.*` — labels de la section (titre, "aucune actualité", etc.)
- `NewsItem.*` — labels des actions (éditer, supprimer, partager, signaler)
- `AddNewsModal.*`, `EditNewsModal.*` — champs formulaire
- `comment.*` — interface commentaires
- `reactions.*` — labels des réactions
- `permissions.*` — messages d'erreur de permission
- `report.*` — raisons de signalement

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
