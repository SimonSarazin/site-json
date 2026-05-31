# Module Notification

Le module `notification` ajoute une **cloche de notifications** dans le header (badge non-vus + panneau liste) et une **section JSON** `notifications` plaçable sur une page. Il s'appuie sur l'API de notifications de `@communecter/cocolight-api-client` (≥ 1.0.142) et sur React Query.

Activation : `header.utilities.notifications: true` dans la config du site (le flag existe déjà dans le schéma). La cloche est **auth-gated** : rien n'est rendu si l'utilisateur n'est pas connecté (ni au SSR).

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

`item.markRead()` est **optimiste** (flip synchrone de l'état réactif interne `_state.isUnread`, rollback côté lib). React n'observe pas cette mutation interne → on force un re-render au clic (et au rollback via `.catch`). Comme l'instance **reste en cache**, l'état **persiste** à la réouverture.

> Ne PAS utiliser `useReactiveProperty(item, "isUnread")` : une instance `Notification` n'est pas un proxy réactif (l'état vit dans `_state`, privé), donc `isReactive(item)` est faux et le hook ne s'abonne jamais.

### Badge

`useUnseenBadge` lit `me.fetchNotificationsCount()` (total non-vus), `refetchInterval: 30s`, `refetchIntervalInBackground: false`. **Source de vérité du badge** — ne jamais lire `me.notifications.unseenTotal` (le manager ne connaît que la dernière page). React Query déduplique les fetches : un poll lent n'est jamais relancé tant que le précédent n'est pas résolu (pas de flood).

### Mutations

- `markAllRead` / `clearAll` : `useMutationWithToast` (toast i18n + invalidation `LIST`/`BADGE`).
- `markAllSeen` : silencieux, déclenché à l'ouverture du panneau (vide le badge), invalide seulement `BADGE`.

## UI responsive

`NotificationBellImpl` choisit via `useIsMobile()` (`src/hooks/use-mobile.ts`, pattern de `sidebar.tsx`) :
- **desktop** → `Popover`. Le contenu étant à hauteur dictée par le contenu, `flex-1`/`height:100%` ne se résout pas → on **plafonne le viewport Radix** : `scrollClassName="[&_[data-radix-scroll-area-viewport]]:max-h-[70vh]"`.
- **mobile** → `Sheet` latéral. Header avec `pr-12` pour dégager le bouton X. La cloche est ajoutée dans le **cluster mobile** (`md:hidden`) de chaque header, sinon elle reste invisible sur mobile.

Le scroll utilise `ScrollArea` (`flex-1 min-h-0`, pattern `AdminPanel.tsx`) et l'infinite scroll une **sentinelle `IntersectionObserver`** (pattern `useInfiniteQueryScroll`).

## Filtre d'affichage

`isDisplayable` masque seulement les notifs sans libellé (`notify.displayName === ""`). On **ne filtre PAS** `objectType === "cms"` (contrairement à certains projets de réf) : sur tiers-lieux des notifs légitimes portent ce type.

`displayName` est du **HTML backend** → rendu via `sanitize()` (`src/lib/sanitize.ts`) + `dangerouslySetInnerHTML`.

## Redirection au clic

Notre routing est par **slug** alors qu'une notif ne porte que `id`+`type`. Au clic :
1. `parseNotification(item)` → `{kind:"entity"|"news"|"invite", type, id, parent…}` (sinon `null` = non navigable).
2. Résolution id→slug via les méthodes API typées : `api.organization/project/event/poi/user({id})` (un `get()` est déclenché quand `id` est fourni).
3. Cible :
   - **news** → URL profonde tab-aware via `buildNewsDetailUrl(config, parent, newsId)` (réutilisé de `useNewsDetailUrlGenerator`), fallback profil parent.
   - **entité** → onglet selon le verbe (`notificationTabIntent`) : `post`→journal (onglet avec section `news`), `ask`/`add+asMember`→communauté (par id : `members`/`membership`/`contributors`…), avec **fallback racine** `/profil/:slug` si l'onglet n'existe pas.
   - **invitation** → racine.

## Lazy loading

`NotificationBell.tsx` est un **wrapper léger** (`lazy` de `vite-preload` + `Suspense`, gate `useHydrated`). Le code lourd (`NotificationBellImpl` + panel + hooks + i18n) n'est téléchargé **que** si la cloche est rendue, c.-à-d. uniquement sur les sites où le flag est activé. Sur les autres, le `&&` du header court-circuite → chunk jamais chargé, **zéro requête**.

## Section JSON

`type: "notifications"` (enregistrée dans `SectionRenderer.tsx` + l'union de `site-schema.ts`). Réutilise `NotificationPanel` dans un conteneur à hauteur bornée. Auto-gate auth comme la cloche.

```json
{ "type": "notifications", "props": { "title": { "fr": "Mes notifications" }, "showMarkAllRead": true, "showClearAll": true } }
```

## Tests

Unitaires (purs, sans backend) : `formatTimeAgo`, `parseNotification`, `notificationTabIntent` (`src/modules/notification/utils/*.test.ts`).
