# Module Observatoire (dashboard de données déclaratif)

Section **`data-observatory`** : un tableau de bord (filtres, KPI, graphes,
table) **entièrement piloté par la config** — le code ne connaît AUCUN
dataset. Introduit par la MR !6 (peter-dev, observatoire des équipements
sportifs 974), généralisé sur `peter-dev-adapt`
(cf. `commentaire/REVIEW-MR6-observatoire-2026-06-12.md` pour le cheminement).

## Principe : tout est dimension

Une **dimension** décrit COMMENT lire une grandeur sur un item brut
(`serverData`) : `{paths: [chaîne de priorité], kind, label}`. Les kinds :
`value` (1ʳᵉ chaîne/nombre/Date affichable), `list` (CSV/tableau aplati),
`anyTrue` (au moins un champ affirmatif — "Oui"/1/true…), `number`.
Filtres, KPI, graphes et colonnes **référencent des dimensions** ; le moteur
(`dimensions.ts`) les résout avec des coercions tolérantes (y compris les
dates EJSON désérialisées en `Date` par le SDK).

## Format de la section (tout vient de la config)

```jsonc
{
  "type": "data-observatory",
  "props": {
    "headline": { "fr": "…" },                  // optionnel
    "baseParams": {                              // PÉRIMÈTRE — requis
      "defaultTypes": ["poi"],
      "defaultFilters": { "$or": { "source.key": "monDataset" } },
      "maxResults": 5000                         // plafond (défaut 5000)
    },
    "dimensions": {                              // REQUIS — le modèle du dataset
      "ville":   { "paths": ["address.addressLocality"], "label": { "fr": "Ville" } },
      "type":    { "paths": ["type_name", "type"], "label": { "fr": "Type" } },
      "sports":  { "paths": ["aps_name"], "kind": "list", "label": { "fr": "Sports" } },
      "access":  { "paths": ["acc_a", "acc_b"], "kind": "anyTrue", "label": { "fr": "Accessible" } },
      "surface": { "paths": ["surf"], "kind": "number", "label": { "fr": "Surface" } }
    },
    "filters": ["ville", "type", "access"],      // ids, ordre d'affichage ; sync URL ?id=valeur
    "kpis": [
      { "kind": "count", "label": { "fr": "Total" }, "icon": "activity", "accent": "primary" },
      { "kind": "distinct", "dimension": "ville", "icon": "map-pin" },
      { "kind": "percentTrue", "dimension": "access", "accent": "chart-2" },
      { "kind": "valueSplit", "dimension": "type", "value": "Salle" },
      { "kind": "top", "dimension": "type", "icon": "trophy" }
    ],
    "charts": [
      { "kind": "donut", "dimension": "type", "layout": "full" },
      { "kind": "pie", "dimension": "ville", "layout": "half",
        "colors": { "Cilaos": "chart-1" } },     // jetons de thème par VALEUR
      { "kind": "booleanGroups", "dimensions": ["access"], "layout": "half" },
      { "kind": "barsHorizontal", "dimension": "sports", "top": 10 },
      { "kind": "bars", "dimension": "ville" }
    ],
    "table": {
      "columns": [
        { "dimension": "ville", "kind": "title", "subtitleDimension": "type" },
        { "dimension": "type", "kind": "badge", "colors": { "Salle": "chart-1" } },
        { "dimension": "access", "kind": "boolBadge" },
        { "dimension": "surface", "kind": "number", "unit": "m²" }
      ],
      "defaultSort": "ville"
    }
  }
}
```

Formes — KPI : `count`, `distinct`, `percentTrue`, `valueSplit`, `top` ·
graphes : `donut`, `pie`, `bars`, `barsHorizontal`, `booleanGroups` ·
colonnes : `text`, `title`, `badge`, `boolBadge`, `number`. Couleurs en
**jetons de thème** uniquement (`chart-1..5`, `primary`, `accent`, `muted`)
— jamais d'hex : le dashboard suit le thème light/dark du site. Icônes KPI :
noms lucide kebab-case (DynamicIcon).

L'exemple complet en production : la page `/observatoire` de
`config.prod.equipements-Sportifs.json` (dataset RES — 12 dimensions,
7 filtres, 6 KPI, 5 graphes, table 8 colonnes).

## Architecture

| Pièce | Rôle |
|---|---|
| `dimensions.ts` | moteur : résolution des dimensions (chemins pointés via le `getValueByPath` du repo), coercions (`isTrue`, `toNumber`, `toStringList`, `asDisplayString` — gère les `Date` SDK), `fieldsFromDimensions` (projection API DÉRIVÉE des déclarations : on ne demande au backend que ce que le dashboard consomme), maps jetons→classes/var(--…) |
| `hooks/useObservatoryItemsQuery` | délègue à **`useSearchAllResults`** (module search — « charger tout » : pages séquentielles auto-régulées, plafond, progress) ; items = `serverData` BRUT (pas de schéma métier : seuls les champs déclarés sont lus) |
| `hooks/useObservatoryFilters` | filtrage CLIENT par kind (égalité / appartenance / booléen), ET strict, **sync URL** `?<id>=<valeur>` (permaliens) |
| `prefetch.ts` | prefetch **SSR de la 1ʳᵉ page** (loader `buildRoutes`) — même queryKey que le client via `buildObservatoryBaseParams` (fonction partagée) |
| `components/` | rendus déclaratifs : `Filters` (Select Radix, options dérivées des données), `KpiCards` (5 formes de calcul), `Charts` (5 formes via `ui/chart.tsx`, composition full/half), `ObservatoryTable` (colonnes/tri/badges déclarés) |

Le filtrage est côté client **par design** : le dashboard agrège tout le
dataset en mémoire — le module search reste l'outil des listes paginées
filtrées serveur.

## Règles tenues

- **Aucun métier en dur** : dataset, dimensions, libellés, couleurs, widgets
  — tout vient de la config. Le module est réutilisable pour n'importe quel
  périmètre searchCostum (POI, événements, organisations…).
- **Prérequis config** : sans `baseParams.defaultFilters` → aucune requête
  (pas de fallback silencieux sur un dataset) ; sans `dimensions` → rien à
  afficher (warn DEV dans les deux cas).
- **Couleurs = thème** : jetons uniquement, validés par le schéma Zod.
- **SDK** : on lit `item.serverData` (entités typées) — jamais de merge
  défensif `{...entity, ...entity.data}` (machinerie interne + brouillon).
- Pas de `module.config.ts` : pas de routes — la section se charge par
  `lazy()` dans `SectionRenderer` (chunk recharts payé uniquement par les
  pages qui l'utilisent).

## Chargement (mesuré sur 3035 items réels)

- Le backend honore `indexStep` sans cap (500→500) ; le paginator SDK et
  `fetchNextPage` sont **séquentiels par contrat** → v1 : séquentiel
  auto-régulé + plafond `maxResults` + **barre de progression** (total connu
  dès la 1ʳᵉ page) + **prefetch SSR page 1** + skeleton. ~118 Ko gzip pour
  500 items dans le HTML ; TTFB 13-43 ms (streaming).
- Le mode « map » (`indexStep: 0`, tout en 1 appel) écarté comme défaut :
  all-or-nothing (pas de progressif, timeout = tout perdu).

## Limites connues / backlog

- Chaque rendu SSR de la page paie le fetch backend de la 1ʳᵉ page
  (QueryClient par requête) — cache serveur partagé si le TTFB devient un sujet.
- v2 éventuelle : tranches parallèles à concurrence bornée après la page 1
  (`indexMin`/`indexMax` directs), à mesurer avant.
- Facettes en cascade (options restreintes par les filtres actifs) : choix
  actuel = options sur le dataset complet (stables sous la souris).
