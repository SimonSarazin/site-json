# Module Observatoire (équipements sportifs RES)

Tableau de bord d'observatoire des équipements sportifs basé sur les données
**RES** (Recensement des Équipements Sportifs — référentiel national : champs
`equip_*`, `inst_*`, `aps_name`). Introduit par la MR !6 (peter-dev), adapté
sur `peter-dev-adapt` (cf. `commentaire/REVIEW-MR6-observatoire-2026-06-12.md`).

## Surface

Une seule section JSON : **`equipment-observatory`** (lazy, chunk dédié).

```jsonc
{
  "type": "equipment-observatory",
  "props": {
    "headline": { "fr": "…" },          // LocalizedString, optionnel
    "description": { "fr": "…" },       // LocalizedString, optionnel
    "baseParams": {                      // sous-ensemble compatible useSearchQuery
      "defaultTypes": ["poi"],
      "defaultFilters": {                // périmètre des données = CONFIG
        "$or": { "source.key": "equipementsSportifs974", "source.keys": "equipementsSportifs974" },
        "type": "recoveryCenter"
      },
      "indexStepList": 500
    }
  }
}
```

Consommateur actuel : `config.prod.equipements-Sportifs.json`, page `/observatoire`.

## Modèle déclaratif (généricité)

Tout le dashboard consomme une seule notion : la **dimension**
(`{paths: [chaîne de priorité], kind: value|list|anyTrue|number, label}`).
Filtres, KPI, graphes et colonnes de table sont des **déclarations** qui
référencent des dimensions — défauts : presets RES (`dimensions.ts`),
surchargeables par la config (précédent `card.servicePricing`) :

```jsonc
"props": {
  "baseParams": { … },                      // périmètre (obligatoire)
  "dimensions": { "ville": { "paths": ["address.addressLocality"] } },
  "filters": ["ville", "type"],             // ids, ordre d'affichage (+ sync URL ?id=valeur)
  "kpis":   [{ "kind": "count" }, { "kind": "distinct", "dimension": "ville" }],
  "charts": [{ "kind": "donut", "dimension": "type", "layout": "full" }],
  "table":  { "columns": [{ "dimension": "ville" }], "defaultSort": "ville" }
}
```

Formes disponibles — KPI : `count`, `distinct`, `percentTrue`, `valueSplit`,
`top` · graphes : `donut`, `pie`, `bars`, `barsHorizontal`, `booleanGroups`
· colonnes : `text`, `title`, `badge`, `boolBadge`, `number`. Couleurs par
**jetons de thème** uniquement (`chart-1..5`, `primary`, `accent`, `muted`)
— jamais d'hex, le dashboard suit le thème light/dark du site. Un site peut
donc monter un observatoire d'un AUTRE dataset (lieux, événements…) par pure
config ; le config equipements-Sportifs actuel n'a pas changé (presets).

## Architecture

| Pièce | Rôle |
|---|---|
| `EquipmentObservatorySection` | composition : Filters → KpiCards → 5 charts → EquipmentTable |
| `hooks/useObservatoryEquipmentsQuery` | délègue à **`useSearchAllResults`** (module search — hook générique « charger tout » : pages séquentielles auto-régulées, plafond `maxResults` défaut 5000, `progress {loaded, total}`) ; parse chaque `item.serverData` via `EquipmentSchema` (Zod tolérant : `BoolLike`, `StringOrArray`, `DateLike`) |
| `prefetch.ts` | params de prefetch **SSR de la 1ʳᵉ page** (loader `buildRoutes`) — même queryKey que le client via `buildObservatoryBaseParams` (fonction partagée) → dashboard plein au premier paint, la suite s'enchaîne après hydratation (~118 Ko gzip pour 500×47 champs) |
| `hooks/useObservatoryFilters` | filtrage client 7 dimensions (commune, type, EPCI, nature, PMR, propriétaire, APS), état dérivé par `useMemo` |
| `utils.ts` | coercions (`isTrue`, `normalizeAps`, `toNumber`), agrégations (`countBy`, `uniqSorted`), accès dimensions (`getCommune`, `getEpci`…), **vocabulaire RES centralisé** (`NATURE_VALUES`, `isIndoor`) — testé (`utils.test.ts`) |
| `components/` | `KpiCards`, `Charts` (recharts via `ui/chart.tsx` : `ChartContainer`/`ChartTooltipContent`), `Filters` (Select Radix), `EquipmentTable` (Table + Badge + pagination Button) |

## Règles tenues (et pourquoi)

- **Noms de design** : le type est `equipment-observatory` — le territoire (974)
  vit dans `baseParams` (config), jamais dans le code. Réutilisable pour un
  autre territoire en changeant `defaultFilters` (ex. `equipementsSportifs75`).
- **Couleurs = thème** : palettes des charts en `var(--chart-1..5)` (+
  `--muted-foreground`, `--destructive`), tooltip thémé par `ui/chart.tsx` —
  aucune couleur hex : les graphes suivent `config.theme` light/dark du site.
- **SDK** : on parse `item.serverData` (entités typées) — jamais de merge
  `{...entity, ...entity.data}` (machinerie interne + proxy de brouillon).
- **Vocabulaire RES** : les valeurs de `nature` sont des valeurs de DONNÉES du
  référentiel (françaises) — centralisées dans `NATURE_VALUES`, pas traduites.
- Pas de `module.config.ts` : le module n'a **pas de routes** — la discovery
  l'ignore, la section se charge par `lazy()` dans `SectionRenderer` (le chunk
  recharts ne pèse que sur les pages qui utilisent la section).

## Prérequis backend

Des POI indexés portant les champs RES, ciblés par `defaultFilters`
(`source.key` + `type`). **`baseParams.defaultFilters` est obligatoire dans la
config** : sans périmètre configuré, le hook ne requête RIEN (pas de fallback
silencieux sur le sourceKey d'un autre site — warn en DEV). Périmètre configuré
mais sans données : section vide (pas d'erreur).

## Chargement (mesuré sur 3035 équipements réels)

- Le backend honore `indexStep` sans cap (500→500) ; le paginator SDK et
  `fetchNextPage` sont **séquentiels par contrat** (curseur dérivé de la page
  précédente) → pas de pages parallèles sans contourner le paginator
  (`indexMin`/`indexMax` directs — v2 possible, concurrence à borner à 2-3
  pour ne pas concentrer la charge backend).
- v1 retenue : séquentiel auto-régulé + **plafond `maxResults`** (défaut 5000,
  configurable par `baseParams.maxResults`) + **barre de progression**
  (`total` connu dès la 1ʳᵉ page) + **prefetch SSR de la page 1** + skeleton
  avant la 1ʳᵉ donnée. L'attente de fond devient invisible : l'utilisateur a
  500 équipements sous les yeux dès le premier paint.
- Le mode « map » (`indexStep: 0`, tout en 1 appel) a été écarté comme défaut :
  all-or-nothing (pas de progressif, réponse énorme, timeout = tout perdu).

## Limites connues / backlog

- Chaque rendu SSR de la page paie le fetch backend de la 1ʳᵉ page (QueryClient
  par requête) — un cache serveur partagé inter-requêtes est une piste si le
  TTFB devient un sujet.
- v2 éventuelle : tranches parallèles à concurrence bornée après la page 1
  (latence ~3×RTT au lieu de N×RTT) — seulement si mesuré nécessaire.
- `EquipmentSchema` en `.passthrough()` (champs RES additionnels tolérés).
- `defaultTypes: z.array(z.string())` (cast vers `SearchType[]` dans le hook).
