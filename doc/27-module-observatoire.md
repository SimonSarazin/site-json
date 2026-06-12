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

## Architecture

| Pièce | Rôle |
|---|---|
| `EquipmentObservatorySection` | composition : Filters → KpiCards → 5 charts → EquipmentTable |
| `hooks/useObservatoryEquipmentsQuery` | délègue à `useSearchQuery` (module search) et **enchaîne toutes les pages** (`hasNextPage → fetchNextPage`) — dashboard = dataset complet ; parse chaque `item.serverData` via `EquipmentSchema` (Zod tolérant : `BoolLike`, `StringOrArray`) |
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
(`source.key` + `type`). Sans données : section vide (pas d'erreur).

## Limites connues / backlog

- **Auto-pagination sans plafond** : tout le dataset est chargé (500/page).
  OK pour ~10³ équipements ; prévoir un cap configurable avant réutilisation
  sur un gros `sourceKey` (alternative long terme : agrégations serveur).
- `EquipmentSchema` en `.passthrough()` (champs RES additionnels tolérés).
- `defaultTypes: z.array(z.string())` (cast vers `SearchType[]` dans le hook).
