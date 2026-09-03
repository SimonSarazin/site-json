[⬅ Retour à l'index](README.md)

# Module Agenda

Expérience **événementielle** d'un costum, config-driven, alignée sur les patterns du [module Search](07-module-search.md). Une seule section JSON (`agenda`) offrant **4 vues** sur les events d'un (ou plusieurs) costum(s).

---

## Vue d'ensemble

- **Source de données** : `entity.searchEventsCostum` (lib `@communecter/cocolight-api-client`), **JAMAIS** le `searchCostum` générique. C'est l'endpoint `/co2/search/agenda`, event-centré et date-aware.
- **4 vues** basculables (toggle Liste/Calendrier/Carte) :
  - **Liste** à onglets temporels — *En cours / À venir / Passés*.
  - **Calendrier** — grille **Mois / Semaine / Jour** (maison, Tailwind + date-fns, PAS schedule-x — cf. [§ schedule-x abandonné](#schedule-x-abandonné)).
  - **Carte** — marqueurs Leaflet (réutilise `SearchMap` de search).
  - **Liste + carte (split)** — liste + carte synchronisées (variante desktop de la carte).
- **Filtres** : type (backend) + texte débouncé (backend) + tags (client), **sync URL** ; UI shadcn alignée sur search (`Select`, `MultiCombobox`, `ActiveFiltersBar`).
- **`baseParams`** : même convention que `searchProStatic` — `sourceKey` multi-sources, `indexStepList`, `fediverse`, `filters`, `locality`.
- **Détail + actions** : clic event → `PreviewEvent` (search) + `EntityActionButtons` (Participer / Suivre / Éditer).
- **Île client** : pas de prefetch SSR des données (l'agenda est `now`-relatif) — le serveur rend un squelette, le client charge après hydratation.

Branche d'origine : `feat/agenda-event`. Câblé en prod dans `config.prod.eXtremeDefiAdeme.json` (`/agenda`) et `config.prod.tiers-lieux.json` (home teaser + `/evenements`).

---

## Arborescence

```
src/modules/agenda/
├── module.config.ts            # { name:"agenda", type:"core", enabled:true } — voir § type "core"
├── schema.ts                   # AgendaSectionSchema (zod) + types ; AGENDA_TABS
├── i18n.ts · i18n/{fr,en}.json # namespace "modules/agenda"
├── Agenda.tsx                  # CONTENEUR : source unique de données (fetch + filtres + vues + détail)
├── sections/AgendaSection.tsx  # wrapper section (import "../i18n" + <Agenda>)
├── components/
│   ├── AgendaList.tsx          # vue LISTE présentationnelle (onglets / bucket unique en teaser)
│   ├── AgendaCalendar.tsx      # CONTENEUR calendrier (sélecteur Mois/Semaine/Jour + nav + plage)
│   └── calendar/
│       ├── MonthView.tsx       # grille mois
│       └── TimeGridView.tsx    # grille horaire semaine/jour (packing chevauchements + ligne « maintenant »)
├── hooks/
│   ├── useAgendaCalendar.ts    # mode CALENDRIER (plage de dates → 1 page, récurrents dépliés) — grille SEULEMENT
│   ├── useAgendaList.ts        # mode LISTE (sans dates → paginé, scroll infini) — sert les 3 onglets Liste
│   └── useAgendaClock.ts       # horloge STABLE (now + bornes) — anti-boucle de refetch
├── constants/
│   ├── queryKeys.ts            # AGENDA_QUERY_KEYS (CLOCK/CALENDAR/LIST)
│   └── eventTypeColors.ts      # palette couleur par type (pastilles calendrier/carte)
└── lib/
    ├── buildAgendaParams.ts    # SOURCE UNIQUE des params searchEventsCostum (+ baseParams)
    ├── agendaClock.ts          # computeAgendaClock (pur) — now + bornes À venir
    ├── calendarLayout.ts       # toDayEvents / eventsOnDay / layoutDay (packing horaire)
    ├── eventDates.ts           # eventOccurrence — start via resolveEventStartDate (@/helpers/formatDate,
    │                           #   partagé avec search/admin/profil) ; end = endDate, sinon (récurrent)
    │                           #   heure de fermeture du jour dans openingHours
    ├── eventTags.ts (+test)    # distinctTags / filterByTags (OR)
    ├── partitionByTime.ts (+test) # eventTimeBucket / partitionByTime (ongoing/upcoming/past)
    └── agendaUrlParams.ts (+test) # read/write filtres ↔ URL (vue/tab/q/type/tags) ; writeAgendaUrl(sp,s,d,manageText=true) — manageText=false saute l'écriture de `q` (délégué au searchHeader) ; Agenda.tsx passe `showText`
```

Libellé de récurrence (« Chaque vendredi », `search/lib/openingHoursDays.ts::formatRecurrenceLabel`) : affiché à la place d'une date isolée sur `CardEvent` (search), la page profil d'un event (`ProfileEventDates`) et la colonne « Début » de l'admin — un événement récurrent n'a pas une date fixe, une occurrence datée est trompeuse (change chaque semaine).

Câblage standard (comme tout module) :
1. `src/types/site-schema.ts` → import `AgendaSectionSchema` + ajout à la `discriminatedUnion("type")`.
2. `src/components/sections/SectionRenderer.tsx` → `agenda: lazy(() => import("@/modules/agenda/sections/AgendaSection"))`.

---

## Source de données : `searchEventsCostum` (2 modes)

`entity.searchEventsCostum(params)` → `PaginatorPage<EventEntity>`. Les résultats sont des **`Event` hydratés** (`instanceof Event`, `getAttendees`/`isAttendee`/`isFollowing`…) → directement consommables par `SearchListView`/`CardEvent`/`SwitchDetailsMode`.

| Mode | Déclencheur | Contenu | Tri | Pagination | Hook |
|---|---|---|---|---|---|
| **CALENDRIER** | `startDateUTC`/`endDateUTC` | ponctuels **+ récurrents DÉPLIÉS** par occurrence | par occurrence | **non** (1 page) | `useAgendaCalendar` — grille uniquement |
| **LISTE** | **sans** dates | ponctuels **+ récurrents** (une ligne chacun, leur **prochaine occurrence**) | `startDate`/occurrence DESC | **oui** (`next()`) | `useAgendaList` — les 3 onglets Liste |

**Mapping des onglets temporels** — un seul flux `useAgendaList` (`listFetch`), partitionné **côté client** (`partitionByTime`) en `ongoing`/`upcoming`/`past` :
- **À venir** = bucket `upcoming`, borné à `upcomingWindowMonths` (filtre client sur l'occurrence), **remis en ordre croissant** (le flux brut est trié décroissant, adapté à « Passés »).

#### Teaser : `limit` n'est PAS la taille du fetch

`limit` plafonne l'**affichage** d'un bucket, APRÈS que le flux a été chargé et partitionné côté
client. Le flux, lui, est trié **décroissant, les trois buckets mêlés**, et coupé par
`baseParams.indexStepList` côté backend (`array_slice`).

Conséquence contre-intuitive : `limit: 3` + `indexStepList: 3` ne ramène pas « les 3 prochains »,
mais les **3 events les plus lointains** — dont il ne reste, après partition et fenêtre
`upcomingWindowMonths`, que ceux qui tombent dans le bucket visé : souvent moins de 3, parfois zéro,
alors que la donnée existe — le teaser paraît vide ou incomplet sans qu'aucune erreur ne survienne.

**Règle** : garder `indexStepList` largement au-dessus de `limit` (≥ 3× ; en pratique 20, le défaut
`AGENDA_DEFAULT_INDEX_STEP`, convient à un teaser).
- **En cours** = bucket `ongoing` — nécessite un `end` résolu (cf. `eventDates.ts` : `endDate` pour un ponctuel multi-jours, sinon l'heure de fermeture du jour dans `openingHours` pour un récurrent).
- **Passés** = bucket `past`, non borné (pagine via « charger plus », partagé avec les 2 autres onglets — un seul curseur pour toute la vue Liste).

La grille **Calendrier** (`gridFetch`, `useAgendaCalendar`) reste **inchangée** — mode CALENDRIER sur le mois/la semaine affiché(e), toujours nécessaire pour une case par occurrence.

Pièges lib : ne **jamais** envoyer `recurrency:true` (interdit AJV) ; `type` est **scalaire** (mono-select) ; mode calendrier = single page. En mode LISTE, la présence de `costumSlug` (toujours injecté par le SDK en usage réel) filtre les événements en attente de modération (`preferences.toBeValidated`) — confirmé le 19/08, ce n'est pas un bug.

### `buildAgendaParams` — source unique des arguments

`lib/buildAgendaParams.ts` est le **pendant agenda de `buildSearchPayload`** : les hooks construisent le payload `searchEventsCostum` ICI (unité). Il fusionne le `baseParams` de la section (cf. [§ baseParams](#baseparams)). Le scope costum est injecté **automatiquement** par le SDK via `_withCostumContext` (`sourceKey=[slug]`) si aucun `sourceKey` n'est fourni.

---

## Les 4 vues

### Liste (`AgendaList`)
Onglets `En cours / À venir / Passés` (Radix `Tabs`) + `SearchListView` par bucket (cartes event + détail au clic). Présentationnel : tout le fetch/filtrage vient d'`Agenda`. En **teaser** (`showTabs:false`) : un seul bucket sans barre d'onglets ; `limit` plafonne, pas de « charger plus ».

### Calendrier (`AgendaCalendar` + `MonthView` / `TimeGridView`)
Grille **maison** (Tailwind + date-fns + tokens shadcn), sélecteur **Mois / Semaine / Jour**, navigation `Aujourd'hui / ‹ / ›`. La plage visible est reportée via `onRangeChange` → le parent refetch (mode CALENDRIER). Thème **natif** (clair/sombre par costum). Semaine/Jour = grille horaire avec **packing des chevauchements** (`layoutDay`, col/cols façon Google Agenda) + **ligne « maintenant »** + scroll auto vers ~7h. Pastilles couleur par type (`eventTypeColor`). Lazy/client-only.

### Carte (`SearchMapWrapper` de search)
Activée par `enableMap`. Réutilise `SearchMapWrapper` (Leaflet, lazy/client-only) à l'identique de `searchProStatic`. Même flux `listFetch` que la vue Liste (events géolocalisés uniquement, filtrés tags ; futurs bornés à `upcomingWindowMonths` comme le bucket « À venir », passés non bornés) — le mode LISTE ne renvoyant déjà qu'une ligne par récurrent, pas de dédoublonnage client nécessaire. Clic marqueur → même détail. ⚠ La branche carte DOIT être enveloppée dans `SearchPropsProvider` (cf. [§ pièges](#pièges-et-leçons)).

### Liste + carte (split)
`mapView: "split"` (défaut `"map"`) = variante **desktop** : liste (gauche) + carte (droite) **synchronisées** via `focusedItemId` — clic carte → `flyTo` marqueur, clic marqueur → highlight carte. Layout repris de `searchProStatic` (`SearchListView onFocusItem` + `SearchMapWrapper onMarkerFocus`). Mobile → carte plein écran (`useIsMobile`).

---

## Filtres (alignés shadcn / search)

| Filtre | Portée | Composant | Notes |
|---|---|---|---|
| Texte (`name`) | backend | `Input` shadcn (`h-11`) | débounce 500ms ; **délégable** au header (cf. bullet ci-dessous) |
| Type | backend | `Select` shadcn (`h-11!`) | mono-select (contrainte SDK) |
| Tags | **client** | `MultiCombobox` (ui/, `h-11!`) | multi ; masqué si aucun tag |
| Filtres actifs | — | `ActiveFiltersBar` (search) | chips removables (type + tags) |

- **Hauteur unifiée** : Input/Select/Tags = `h-11` (44px). Le `SelectTrigger` shadcn impose `data-[size=default]:h-9` (sélecteur d'attribut, spécificité > `.h-11`) → il faut `h-11!` (important) sur les triggers Select/Tags.
- **Responsive** : inline ≥ `lg`, repliés dans un `Sheet` bas en mobile (bouton « Filtres » + compteur).
- **Sync URL** (`agendaUrlParams`) : `vue` (mode), `tab`, `q` (texte), `type`, `tags` (CSV) — partageable/bookmarkable. `vue`/`tab` écrits seulement si ≠ défaut.
- **Recherche déléguée au header** : quand la prop `filters.text` vaut `false`, le terme de recherche ne vient plus de l'input débouncé propre à l'agenda mais du `searchHeader` sœur, via le store partagé `PageFilters` (`pageFilters.searchQuery`, déjà débouncé) — même patron que `SearchProStatic`. Dans ce cas l'agenda **n'écrit PAS** le paramètre d'URL `q` (délégué au header) : `writeAgendaUrl` est appelé avec `manageText=showText`, pour ne pas que deux écrivains se battent sur `q`. Quand `filters.text` vaut `true` (défaut), le comportement est inchangé (input débouncé propre → écrit `q`).

---

## Teaser sur une page d'accueil

L'agenda sert aussi de **bloc d'aperçu** parmi d'autres sections : vue figée,
un seul bucket, quelques éléments et un lien vers la page complète.

```jsonc
{
  "type": "agenda",
  "props": {
    "customHeader": { "title": {…}, "linkText": { "fr": "Tout l'agenda" },
                      "linkHref": "/agenda", "linkIcon": "arrow-right" },
    "showViewToggle": false,      // pas de bascule Liste/Calendrier
    "showTabs": false,            // un seul bucket, pas d'onglets
    "defaultTab": "upcoming",
    "limit": 3,                   // plafonne l'AFFICHAGE du bucket (pas de « charger plus »)
    "filters": { "type": false, "text": false, "tags": false },
    "maxWidth": "5xl",            // ALIGNEMENT — cf. ci-dessous
    "columns": { "sm": 1, "md": 2, "lg": 3, "xl": 3 },
    // ⚠ PAS `indexStepList: 3` : la page du flux doit être bien plus large que `limit` — cf. § ci-dessous
    "baseParams": { "sourceKey": ["monCostum"], "indexStepList": 20 }
  }
}
```

**`maxWidth` (4xl…8xl, full)** — à renseigner **dès que l'agenda partage sa page**.
Absent, la section retombe sur le `container` Tailwind, qui plafonne à **1536 px** :
une largeur qui ne correspond à aucun des échelons `max-w-*` employés par les
autres sections, si bien que le teaser déborde visiblement de ses voisines. Sur
une page agenda dédiée, où la section occupe seule la page, laisser absent.
Mêmes valeurs que `data-observatory.maxWidth`, même jeu de classes
(`src/lib/sectionMaxWidth.ts`).

Exemples en production : `config.prod.tiers-lieux.json` (`/` → `section-events`)
et `config.prod.institut-bleu.json` (`/` → `actualites-du-reseau`).

## `baseParams`

Même convention que `searchProStatic.baseParams`. Champs **repris** (= ceux que `searchEventsCostum` accepte) :

| Champ | Rôle |
|---|---|
| `sourceKey: string[]` | scope **multi-sources** (filtre `source.keys`). Vide → costum courant (auto SDK). |
| `indexStepList: number` | taille de page de la vue LISTE — sur un **teaser**, c'est elle (et non `limit`) qui décide de ce que le bucket peut contenir : cf. [§ teaser](#teaser--limit-nest-pas-la-taille-du-fetch) |
| `fediverse: boolean` | inclure les sources fédiverse |
| `filters`, `locality` | filtres backend bruts / localités |

**Ignorés** (tolérés en passthrough mais non supportés par `searchEventsCostum`) : `defaultFields`, `defaultSortBy` (tri par occurrence interne), `defaultTypes` (forcé à `["events"]`).

> Côté lib, `_withCostumContext` : `sourceKey = inSourceKey.length > 0 ? inSourceKey : [sd.slug]` → un `sourceKey` explicite (multi) est respecté tel quel ; sinon repli sur le costum porteur. Le contexte costum (`costumSlug`/`contextId`/`contextType`) reste posé dans les deux cas.

### `effectiveBaseParams` — fusion des facettes de page (runtime)

Avant de passer `baseParams` aux deux hooks de fetch (`listFetch`/`gridFetch`), `Agenda.tsx` y fusionne les **facettes de page** issues du store partagé `PageFilters` (écrites par un `searchHeader`/`filters` sœur de la même page). `searchByFieldsToQuery(pageFilters?.searchByFields)` renvoie `{ filters, locality, sourceKeys }` :

- les facettes `filters` (mongo brut `{ <field>: { $in:[…] } }`) sont **shallow-merged par-dessus** `baseParams.filters` ;
- la facette `locality` est shallow-merged par-dessus `baseParams.locality` ;
- les facettes `sourceKeys` **écrasent** `baseParams.sourceKey` quand elles sont non vides (parité avec `SearchProStatic`).

Le résultat (`effectiveBaseParams`) est appliqué **côté serveur** par `searchEventsCostum`. Hors provider `PageFilters` (page `["agenda"]` seule) → tout est vide → no-op (`effectiveBaseParams` = `baseParams`).

---

## Configuration (props de la section `agenda`)

| Prop | Type | Défaut | Description |
|---|---|---|---|
| `title` / `description` | LocalizedString | — | en-tête simple |
| `customHeader` | `{ title?, linkText?, linkHref?, linkIcon? }` | — | en-tête + lien « voir tous » (teaser → page) — **mirror de `searchProStatic.customHeader`** |
| `defaultMode` | `"list" \| "calendar"` | `"list"` | vue initiale |
| `tabs` | `("upcoming"\|"ongoing"\|"past")[]` | `["upcoming","ongoing","past"]` | onglets affichés |
| `defaultTab` | idem | `"upcoming"` | onglet initial |
| `upcomingWindowMonths` | number | `12` | borne haute (filtre client, now→futur) du bucket « À venir » — plus un fetch CALENDRIER dédié, le flux LISTE partagé est simplement filtré à cette fenêtre |
| `showViewToggle` | boolean | `true` | afficher le toggle Liste/Calendrier(/Carte) |
| `showTabs` | boolean | `true` | afficher les onglets (false = teaser : bucket unique) |
| `limit` | number | — | plafond d'events/bucket (teaser) |
| `filters` | `{ type?, text?, tags? }` | — | filtres activés (`tags` masqué si pas explicitement `true`) |
| `enableMap` | boolean | `false` | active la vue Carte |
| `mapView` | `"map" \| "split"` | `"map"` | rendu carte (split = liste+carte desktop) |
| `map` | `MapConf` | — | config marqueurs/popup (**même schéma que `searchProStatic.map`**) |
| `detailsMode` | `"drawer" \| "dialog"` | `"drawer"` | conteneur du détail |
| `columns` | `{ sm?, md?, lg?, xl? }` | — | colonnes de la grille de cartes |
| `baseParams` | cf. [§ baseParams](#baseparams) | — | scope/filtres backend |
| `bg` | enum | — | fond de section |

### Exemple — page complète + carte/split
```json
{ "type": "agenda", "id": "section-evenements", "props": {
  "customHeader": { "title": { "fr": "Les événements" } },
  "filters": { "type": true, "text": true, "tags": true },
  "detailsMode": "drawer", "columns": { "sm":1,"md":2,"lg":2,"xl":2 },
  "enableMap": true, "mapView": "split",
  "map": { "marker": { "useItemImage": true, "style": "pin", "color": "primary" } },
  "baseParams": { "sourceKey": ["franceTierslieux","tierslieuxbelgique","navigatorDesTierslieux"], "indexStepList": 20 } } }
```

### Exemple — teaser home (4 events + lien « voir tous »)
```json
{ "type": "agenda", "id": "section-events", "props": {
  "customHeader": { "title": { "fr": "Événements à venir" },
    "linkText": { "fr": "Voir tous les événements" }, "linkHref": "/evenements" },
  "showViewToggle": false, "showTabs": false, "defaultTab": "upcoming",
  "limit": 4, "filters": { "text": false, "type": false },
  "columns": { "sm":1,"md":2,"lg":4,"xl":4 },
  "baseParams": { "sourceKey": ["franceTierslieux","tierslieuxbelgique","navigatorDesTierslieux"], "indexStepList": 20 } } }
```

---

## Détail au clic + actions (réutilisation)

`searchEventsCostum` renvoie des `Event` hydratés → toute la surface event existante marche directement :
- **Détail** : `SwitchDetailsMode` (drawer/dialog) → `PreviewEvent` (`search/components/preview/`) : date/heure, lieu, organisateur, participants + `<EntityActionButtons entity={event}/>`.
- **Actions** : `useEntityActions` → `useEventEntityActions` (Participer/Je participe · Suivre/Suivi · Éditer · Quitter · Invitations), gaté par `calculateEventPermissions` (cohérence visiteur/connecté/auteur).

---

## i18n

Namespace **`modules/agenda`** (`i18n/{fr,en}.json`), chargé en side-effect par la section (`import "../i18n"`). Clés : `view.*` (list/calendar/map/mapSplit), `calendar.*` (month/week/day/today/noEvents), `filters.*` (searchPlaceholder/typeLabel/allTypes/tags/allTags/title/reset/apply), `tab.*`, `eventType.*` (20 types), `empty`/`loadMore`/`loadingMore`.

---

## Pièges et leçons

- <a id="schedule-x-abandonné"></a>**schedule-x abandonné** : schedule-x v4 **inline sa propre copie de `temporal-polyfill`** (ni exportée ni globale) et valide chaque event par `instanceof Temporal.ZonedDateTime` avec CETTE copie → tout `Temporal` créé depuis le package npm est rejeté → la grille plantait dès qu'il y avait des events. Remplacé par une grille **maison** (date-fns + `Date`). Leçon : éviter une lib qui inline une dépendance dont le type fait partie de son API publique.
- **`SearchPropsProvider` autour de la carte** : `SearchMap` → `useMapContainerClass` lit `inSection` via `useSearchProps` (qui **throw** sans provider). La vue carte/split doit être enveloppée dans `<SearchPropsProvider props inSection>`.
- **Boucle de render (`DEFAULT_TABS`)** : un défaut de **destructuration** `tabs = [...]` crée une nouvelle référence à chaque render → `urlDefaults` instable → effet de sync URL en boucle → `useHydrated` ne commitait jamais. Fix : constante **module** stable. Leçon : jamais de littéral array/objet en défaut de destructuration s'il alimente un `useMemo`/dep d'effet.
- **`useAgendaClock`** : `now`/bornes dérivées d'un `new Date()` ms-précis dans une queryKey → nouvelle requête à chaque render (double-invoke StrictMode) → spinner perpétuel. L'horloge react-query (`staleTime: Infinity`) fige la valeur.
- <a id="type-core"></a>**module `type: "core"`** : un module `optional` SANS `routes.tsx` (cas de l'agenda) suffit à rendre `hasOptional` vrai → bascule TOUTE la construction de routes client en async → header/sections dupliqués + navigation cassée. L'agenda est section-only → **`core`**.
- **Île client / pas de prefetch SSR** : la query datée « À venir » (`startDateUTC=now…`) n'est pas déterministe serveur↔client → mismatch d'hydratation. L'agenda gate fetch+contenu après hydratation (`useHydrated`) → serveur = 1ᵉʳ render client = même squelette.
- **`startDateSort` (récurrents) n'est PAS parsable directement** : c'est un objet PHP brut (`{date,timezone_type,timezone}`), jamais normalisé en `Date` par le SDK — seul `startDateSortFormat` (string ISO) l'est. `eventOccurrence`/`resolveEventStartDate` (`@/helpers/formatDate`, partagé avec `search`/`admin`/`profil`) tentent `startDate` → `startDateSort` (au cas où) → `startDateSortFormat`.
- **Mode LISTE côté admin (`/admin/agenda`, `AdminResourceTable`)** : utilise `searchCostum` (générique), **pas** `searchEventsCostum` — `searchCostum` ne calcule **jamais** `startDateSort`/`startDateSortFormat`, quels que soient les champs demandés (c'est une enrichissement propre à l'endpoint agenda). La colonne « Début » d'un récurrent n'a donc **aucune date exploitable** ; repli sur le libellé de récurrence (`formatColumnCell` dans `modules/admin/sections/resourceHelpers.ts`).
- **i18n cross-module** : le libellé de récurrence (`formatRecurrenceLabel`) utilise les clés `days.*`/`card.event.recurring*` du namespace `modules/search`, enregistrées en side-effect par `import "@/modules/search/i18n"`. Un composant hors de l'arbre `search` qui l'utilise (page profil, table admin) doit importer ce fichier explicitement, sinon les clés s'affichent brutes (non traduites).
- **Bugs backend connus (`AgendaAction.php`, hors monorepo)** : voir `Document de spécification — Agenda événements récurrents invisibles (AgendaAction.php).md` (matching par jour de semaine en mode CALENDRIER, corrigé) et `Document de spécification — Pagination des événements récurrents dans l'agenda (AgendaAction.php).md` (mode LISTE incluant les récurrents, implémenté ; « occurrence du jour en cours », corrigé le 19/08) à la racine du monorepo.

---

## Composants/patterns partagés avec Search (unité)

`MultiCombobox`, `Select`/`SelectField`, `SearchListView`/`SearchCard`/`CardEvent`, `SearchMapWrapper`/`SearchMap`, `SwitchDetailsMode`/`PreviewEvent`, `ActiveFiltersBar`, `EntityActionButtons`, `useInfiniteQueryScrollNextWithTransform`, `buildAgendaParams` (pendant de `buildSearchPayload`), `MapConfSchema`.

**Couplage `PageFilters`** : `Agenda.tsx` importe `usePageFiltersOptional` (`src/modules/search/contexts/pageFilters`) et `searchByFieldsToQuery` (`src/modules/search/lib/searchByFieldsToQuery`) pour lire la recherche déléguée (`searchQuery`) et fusionner les facettes de page (cf. [§ `effectiveBaseParams`](#effectivebaseparams--fusion-des-facettes-de-page-runtime)). Cela couple la section agenda au provider `PageFilters` du module search (monté par son `PageProvider`) ; la variante **Optional** garde le tout sûr (no-op) quand il est absent — ex. une page agenda seule.

Voir aussi : [Module Search](07-module-search.md) · [Schémas de sections](05-schemas-sections.md) · [README module](../src/modules/agenda/README.md).
