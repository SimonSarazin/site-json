# Module Notification

Le module `notification` ajoute une **cloche de notifications** dans le header (badge non-vus + panneau liste) et une **section JSON** `notifications` plaçable sur une page. Il s'appuie sur l'API de notifications de `@communecter/cocolight-api-client` (≥ 1.0.142) et sur React Query.

Activation : `header.utilities.notifications: true` dans la config du site (le flag existe déjà dans le schéma). La cloche est **auth-gated** : rien n'est rendu si l'utilisateur n'est pas connecté (ni au SSR).

Le module n'a pas de `module.config.ts` : il est donc traité comme `core` (chargement synchrone) par `discoverModules()`.

## Arborescence

```
src/modules/notification/
├── i18n.ts                       # addResourceBundle("modules/notification")
├── i18n/{fr,en}.json
├── index.ts                      # barrel
├── schema.ts                     # NotificationsSectionSchema (type: "notifications")
├── constants/queryKeys.ts        # NOTIFICATION_QUERY_KEYS (LIST/BADGE + _PREFIX)
├── hooks/
│   ├── useNotificationsList.tsx  # useInfiniteQuery — cache des INSTANCES (pas de select)
│   ├── useUnseenBadge.tsx        # useQuery — compteur non-vus, polling 30s
│   ├── useNotificationMutations.tsx  # markAllRead / clearAll / markAllSeen
│   └── useNotificationNavigation.tsx # clic → résolution id→slug → navigate
├── components/
│   ├── NotificationBell.tsx      # wrapper LAZY (vite-preload) — drop-in des headers
│   ├── NotificationBellImpl.tsx  # impl : Popover (desktop) / Sheet (mobile)
│   ├── NotificationPanel.tsx     # header + ScrollArea + infinite scroll
│   ├── NotificationRow.tsx       # une ligne (lu/non-lu, HTML sanitizé, redirection)
│   └── sections/NotificationsSection.tsx  # section JSON plein-format
└── utils/
    ├── formatTimeAgo.ts          # date → "il y a 5 min" (i18n)
    ├── parseNotification.ts      # notif → élément cible {kind,type,id,parent…}
    └── notificationTabIntent.ts  # verbe → onglet {journal|community|root}
```

## React Query : on cache les **instances** (pas `select`)

Point clé, différent de la première intuition « cache plat + `select` ». Le cache plat + `select` recrée des instances `Notification` **à chaque render** → la mutation optimiste de `item.markRead()` est perdue (et réapparaît non-lue à la réouverture). On fait donc comme les BaseEntity ailleurs : **on cache l'objet vivant**.

```ts
// useNotificationsList — PAS de select
queryFn: async ({ pageParam }) => {
  const flat = await me.fetchNotifications({ indexMin: pageParam });
  return me.notifications.toItems(flat);   // instances mises en cache telles quelles
}
// structuralSharing: false  (RQ ne doit pas fusionner les instances)
```

La cloche étant client-only (jamais rendue au SSR), mettre des instances non-sérialisables dans le cache ne pose pas de problème de déhydratation.

### Lu / non-lu par item

`item.markRead()` est **optimiste** (flip synchrone de l'état réactif interne `_state.isUnread`, rollback côté lib). React n'observe pas cette mutation interne → on force un re-render au clic (et au rollback via `.catch`) via un `useReducer` compteur. Comme l'instance **reste en cache**, l'état **persiste** à la réouverture.

> Ne PAS utiliser `useReactiveProperty(item, "isUnread")` : une instance `Notification` n'est pas un proxy réactif (l'état vit dans `_state`, privé), donc `isReactive(item)` est faux et le hook ne s'abonne jamais.

### Badge

`useUnseenBadge` lit `me.fetchNotificationsCount()` (total non-vus), `refetchInterval: 30s`, `refetchIntervalInBackground: false`, `staleTime: 20s`. **Source de vérité du badge** — ne jamais lire `me.notifications.unseenTotal` (le manager ne connaît que la dernière page). React Query déduplique les fetches : un poll lent n'est jamais relancé tant que le précédent n'est pas résolu (pas de flood).

Retourne `{ count: number, isLoading: boolean }`.

### Mutations

- `markAllRead` / `clearAll` : `useMutationWithToast` (toast i18n + invalidation par **préfixes** `LIST_PREFIX`/`BADGE_PREFIX`, qui matchent toutes les variantes `userContextId`).
- `markAllSeen` : silencieux (`useMutation` brut), déclenché à l'ouverture du panneau (vide le badge), invalide seulement `BADGE_PREFIX`.

La distinction `LIST_PREFIX` vs `LIST` (et `BADGE_PREFIX` vs `BADGE`) est intentionnelle : l'invalidation par préfixe matche toutes les variantes de clé quel que soit le `userContextId`, ce qui couvre correctement les basculements login/logout.

## Hooks — signatures

### `useNotificationsList(me: User | null)`

`useInfiniteQuery` avec :
- `queryKey`: `NOTIFICATION_QUERY_KEYS.LIST(userId, userContextId)` (via `useHydratedUserContextId`)
- `enabled`: `!!me?.isConnected`
- `initialPageParam: 0` ; `PAGE_SIZE = 15`
- `staleTime: 30s`, `gcTime: 5min`
- `structuralSharing: false`
- Pagination par curseur : `getNextPageParam` = total d'items déjà chargés (`allPages.reduce`) ; `undefined` si `lastPage.length < PAGE_SIZE`

Retourne `{ items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, error }`.

### `useUnseenBadge(me: User | null)`

`useQuery` avec `refetchInterval: 30s`, `staleTime: 20s`. Retourne `{ count: number, isLoading: boolean }`.

### `useNotificationMutations(me: User | null)`

Retourne `{ markAllRead, clearAll, markAllSeen }` (objets mutation React Query).

### `useNotificationNavigation()`

Hook sans argument. Retourne une callback async `(item: Notification) => Promise<boolean>`. La résolution id→slug se fait via les méthodes API typées de `useCocolight().api`. Imports de `buildNewsDetailUrl` et `buildProfileTabUrl` depuis `@/modules/profil/hooks/useNewsDetailUrlGenerator`.

## UI responsive

`NotificationBellImpl` choisit via `useIsMobile()` (`src/hooks/use-mobile.ts`, pattern de `sidebar.tsx`) :

- **desktop** → `Popover` avec `PopoverContent` borné à `max-h-[80vh] w-[calc(100vw-2rem)] sm:w-96`. Le contenu étant à hauteur dictée par le contenu, `flex-1`/`height:100%` ne se résout pas → on **plafonne le viewport Radix** : `scrollClassName="[&_[data-radix-scroll-area-viewport]]:max-h-[70vh]"`.
- **mobile** → `Sheet` latéral (`side="right"`, `w-full sm:max-w-sm`). Un `SheetHeader className="sr-only"` avec `SheetTitle` assure l'accessibilité (label du dialog masqué visuellement). Le panel reçoit `headerClassName="pr-12"` pour dégager le bouton X natif du Sheet. La cloche est ajoutée dans le **cluster mobile** (`md:hidden`) de chaque header, sinon elle reste invisible sur mobile.

Les deux variantes appellent `useHydrated` + `me.isConnected` comme double-check (le wrapper `NotificationBell.tsx` court-circuite déjà au SSR, mais `NotificationBellImpl` ne suppose pas être appelé dans ce contexte).

Le scroll utilise `ScrollArea` (`flex-1 min-h-0`, pattern `AdminPanel.tsx`) et l'infinite scroll une **sentinelle `IntersectionObserver`** implémentée directement dans `NotificationPanel` via un `RefCallback<HTMLLIElement>` attaché au dernier élément de liste (même pattern que `useInfiniteQueryScroll`).

## Filtre d'affichage

`isDisplayable` masque seulement les notifs dont `n.data?.notify?.displayName` est une chaîne vide (`""`). On **ne filtre PAS** `objectType === "cms"` (contrairement à certains projets de réf) : sur tiers-lieux des notifs légitimes portent ce type.

`displayName` est du **HTML backend** → rendu via `sanitize()` (`src/lib/sanitize.ts`) + `dangerouslySetInnerHTML`. Fallback quand `displayName` est absent/falsy : le champ `verb` brut, sinon `item.author?.name`.

## Redirection au clic

Notre routing est par **slug** alors qu'une notif ne porte que `id`+`type`. Au clic :
1. `parseNotification(item)` → `{kind:"entity"|"news"|"invite", type, id, parent…}` (sinon `null` = non navigable).
2. Résolution id→slug via les méthodes API typées : `api.organization/project/event/poi/user({id})` (un `get()` est déclenché quand `id` est fourni).
3. Cible :
   - **news** → URL profonde tab-aware via `buildNewsDetailUrl(config, parent, newsId)` (réutilisé de `useNewsDetailUrlGenerator`), fallback profil parent.
   - **entité** → onglet selon le verbe (`notificationTabIntent`) : `post`→journal (onglet avec section `news`), `ask`/`add+asMember`→communauté (par id : `members`/`membership`/`contributors`…), avec **fallback racine** `/profil/:slug` si l'onglet n'existe pas.
   - **invitation** → racine.

Pendant la résolution async, `NotificationRow` affiche un spinner (`Loader2`), désactive le bouton (`disabled={navigating}`) et applique `cursor-default` si la notif est non navigable (`target === null`). Les notifs non navigables restent cliquables pour le seul mark-as-read.

## Lazy loading

`NotificationBell.tsx` est un **wrapper léger** (`lazy` de `vite-preload` + `Suspense`, gate `useHydrated`). Le code lourd (`NotificationBellImpl` + panel + hooks + i18n) n'est téléchargé **que** si la cloche est rendue, c.-à-d. uniquement sur les sites où le flag est activé. Sur les autres, le `&&` du header court-circuite → chunk jamais chargé, **zéro requête**.

## Section JSON

`type: "notifications"` (enregistrée dans `SectionRenderer.tsx` + l'union de `site-schema.ts`). Réutilise `NotificationPanel` dans un conteneur `h-[70vh] max-h-[640px] overflow-hidden rounded-lg border`. Auto-gate SSR + auth comme la cloche : si non hydraté ou non connecté, affiche la clé i18n `section.loginRequired`.

La prop `maxItems` est définie dans le schéma (défaut `15`) mais n'est pas encore transmise à `NotificationPanel` (non implémentée côté composant).

```json
{ "type": "notifications", "props": { "title": { "fr": "Mes notifications" }, "showMarkAllRead": true, "showClearAll": true } }
```

## Exports barrel (`index.ts`)

```ts
// Schemas + types
export * from "./schema";                        // NotificationsSectionSchema, NotificationsSection, NotificationsSectionProps

// Constantes
export * from "./constants/queryKeys";           // NOTIFICATION_QUERY_KEYS, NotificationQueryKeyType

// Hooks
export { useNotificationsList }
export { useUnseenBadge }
export { useNotificationMutations }
export { useNotificationNavigation }

// Utils (partiels — formatTimeAgo n'est PAS exporté)
export { parseNotification }
export type { NotificationTarget, EntityCollection }
export { notificationTabIntent }
export type { TabIntent }

// Composants
export { default as NotificationBell }          // wrapper lazy — drop-in headers
export { NotificationPanel }                    // panneau réutilisable
export { NotificationRow }                      // ligne individuelle
```

`formatTimeAgo` est intentionnellement non exporté du barrel (usage interne uniquement).

## Schéma Zod (`schema.ts`)

```ts
NotificationsSectionSchema = z.object({
  type: z.literal("notifications"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    maxItems: z.number().positive().optional().default(15),  // déclaré, non encore utilisé
    showMarkAllRead: z.boolean().optional().default(true),
    showClearAll: z.boolean().optional().default(true),
  }),
})
```

## Query Keys (`constants/queryKeys.ts`)

```ts
NOTIFICATION_QUERY_KEYS = {
  LIST:         (userId, userContextId?) => ["notifications", userId, userContextId]
  LIST_PREFIX:  (userId)                 => ["notifications", userId]
  BADGE:        (userId, userContextId?) => ["notifications-badge", userId, userContextId]
  BADGE_PREFIX: (userId)                 => ["notifications-badge", userId]
}
```

`userContextId` (via `useHydratedUserContextId`) permet un refetch automatique au login/logout. Les invalidations utilisent toujours les `_PREFIX` pour couvrir toutes les variantes.

## Clés i18n (`modules/notification`)

| Clé | Usage |
|-----|-------|
| `bell.ariaLabel` | `aria-label` du bouton cloche |
| `panel.title` | En-tête du panneau (Sheet title accessible + header panel) |
| `panel.empty` | Liste vide |
| `panel.loading` | Chargement initial + page suivante |
| `panel.markAllRead` | Tooltip/aria bouton `CheckCheck` |
| `panel.clearAll` | Tooltip/aria bouton `Trash2` |
| `panel.loadMore` | Déclaré dans les JSON, non utilisé (scroll auto) |
| `section.loginRequired` | Message non-connecté dans `NotificationsSection` |
| `toast.markAllReadSuccess` | Toast succès markAllRead |
| `toast.clearAllSuccess` | Toast succès clearAll |
| `toast.error` | Toast erreur mutations |
| `time.now` | `< 1 min` |
| `time.minutesAgo` | `count` minutes |
| `time.hoursAgo` | `count` heures |
| `time.daysAgo` | `count` jours |

## `parseNotification` — types de cibles

```ts
// Collections navigables (route /profil/:slug)
ENTITY_TYPES = ["citoyens", "projects", "organizations", "poi", "events"]

// Parents valides d'une news (events EXCLU)
NEWS_PARENT_TYPES = ["citoyens", "projects", "organizations", "poi"]
```

Cas traités :
- `target.type in ENTITY_TYPES` → `{ kind: "entity", type, id }`
- `target.type === "citoyens"` + `verb === "invite"` → `{ kind: "invite", type: author.type, id: author.id }` (on vise l'auteur)
- `target.type === "news"` + parent dans `NEWS_PARENT_TYPES` → `{ kind: "news", id, parentType, parentId }`
- Tout autre cas → `null`

## `notificationTabIntent` — verbe → onglet

```ts
verb === "post"                                    → "journal"
verb === "ask" && (projects | organizations)       → "community"
verb === "add" && notify.objectType === "asMember" → "community"
sinon                                              → "root"
```

La résolution de l'onglet réel (id de tab, fallback racine si inexistant) est faite dans `useNotificationNavigation` via `buildProfileTabUrl`.

`COMMUNITY_TAB_IDS` (dans `useNotificationNavigation`) : `members`, `membership`, `community`, `communaute`, `contributors`, `contributeurs`.

## Tests

Unitaires (purs, sans backend) : `formatTimeAgo`, `parseNotification`, `notificationTabIntent` dans `src/modules/notification/utils/*.test.ts`.

`formatTimeAgo` accepte un troisième argument `now: number` injectable pour les tests (pas de dépendance à `Date.now()` en test).
