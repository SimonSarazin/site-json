# Module Agenda — Documentation

> Doc détaillée : [`doc/29-module-agenda.md`](../../../doc/29-module-agenda.md)

## Vue d'ensemble

Section config-driven `agenda` : expérience **événementielle** d'un costum, sur `entity.searchEventsCostum`
(**jamais** le `searchCostum` générique). Alignée sur les patterns du module **search**.

**4 vues** (toggle) :
- **Liste** à onglets temporels — *En cours / À venir / Passés*
- **Calendrier** — grille **Mois / Semaine / Jour** (maison Tailwind + date-fns, thème natif)
- **Carte** — marqueurs Leaflet (réutilise `SearchMap`)
- **Liste + carte (split)** — synchronisées (desktop ; mobile → carte plein écran)

Plus : filtres type/texte/tags (shadcn + sync URL), `baseParams` multi-sources, **teaser** (lien « voir tous » + `limit`),
détail + actions réutilisés (`PreviewEvent` + `EntityActionButtons`).

## Architecture

- `Agenda.tsx` — **conteneur, source unique** : fetch (hooks) + filtres + bascule de vue + détail au clic.
- `components/` — `AgendaList` (liste), `AgendaCalendar` + `calendar/{MonthView,TimeGridView}` (grille).
- `hooks/` — `useAgendaCalendar` (mode dates), `useAgendaList` (paginé), `useAgendaClock` (now stable).
- `lib/` — `buildAgendaParams` (source unique des params SDK + `baseParams`), `calendarLayout`, `eventDates`,
  `partitionByTime`, `eventTags`, `agendaUrlParams`, `agendaClock`.
- `schema.ts` — `AgendaSectionSchema` (zod). `module.config.ts` — **`type:"core"`** (obligatoire, cf. doc).

## Config minimale

```json
{ "type": "agenda", "props": {
  "filters": { "type": true, "text": true, "tags": true },
  "enableMap": true, "mapView": "split",
  "baseParams": { "sourceKey": ["monCostum"], "indexStepList": 20 } } }
```

## Pièges (détaillés dans la doc)

- Module **`type:"core"`** (un `optional` sans `routes.tsx` casse l'hydratation/navigation app-wide).
- Vue carte : **envelopper dans `SearchPropsProvider`** (`useMapContainerClass` lit `inSection`).
- Pas de littéral array/objet en **défaut de destructuration** s'il alimente un useMemo/effet (boucle de render).
- Île client : **pas de prefetch SSR** des données (`now`-relatif → mismatch d'hydratation).
- **schedule-x abandonné** (inline son `temporal-polyfill` → `instanceof` cross-instance KO) → grille maison.

Voir [`doc/29-module-agenda.md`](../../../doc/29-module-agenda.md) pour la référence complète (props, baseParams, i18n, réutilisations).
