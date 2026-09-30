# Module Observatoire (dashboard de données déclaratif)

Section **`data-observatory`** : un tableau de bord (filtres, KPI, graphes,
table) **entièrement piloté par la config** — le code ne connaît AUCUN
dataset. Introduit par la MR !6 (peter-dev, observatoire des équipements
sportifs 974), généralisé sur `peter-dev-adapt`
(cf. `commentaire/REVIEW-MR6-observatoire-2026-06-12.md` pour le cheminement).

## Principe : tout est dimension

Une **dimension** décrit COMMENT lire une grandeur sur un item brut
(`serverData`) : `{paths: [chaîne de priorité], kind, label}`. Les kinds :
`value` (1ʳᵉ chaîne/nombre/Date affichable), `list` (CSV/tableau aplati puis
**dédupliqué** — un item pèse 1 par valeur distincte, pas de sur-comptage dans
les graphes/cellules même s'il a plusieurs sources/réponses),
`anyTrue` (au moins un champ affirmatif — "Oui"/1/true…), `number`,
`contains` (booléen : un chemin-liste contient `value`).
Filtres, KPI, graphes et colonnes **référencent des dimensions** ; le moteur
(`dimensions.ts`) les résout avec des coercions tolérantes (y compris les
dates EJSON désérialisées en `Date` par le SDK).

**Décomposer un champ fourre-tout** : `list` + `values` (allowlist) restreint
ET ordonne la sortie à des valeurs déclarées — un même champ multivalué qui
mêle plusieurs axes (ex. `tags` = typologie + statut juridique + surface +
label) devient autant de dimensions ORTHOGONALES. Ex. :
`typologie {paths:["tags"], kind:"list", values:["Coworking","Fablab",…]}`,
`surface {paths:["tags"], kind:"list", values:["Plus de 200m²",…]}`,
`compagnon {paths:["tags"], kind:"contains", value:"Compagnon France Tiers-Lieux"}`
(→ KPI `percentTrue`). L'ordre de `values` = ordre stable des parts/barres.

**Normaliser des valeurs sales** : `valueMap` (raw → canonique, AVANT
l'allowlist) fusionne les variantes saisies à la main du backend. Deux usages
typiques : nettoyer un champ libre (`pays {paths:["address.addressCountry"],
valueMap:{"FR":"France","RE":"Réunion",…}}` — on lit le CODE ISO propre et on
mappe vers le nom, comme le filtre `scopeList` de la liste s'appuie sur le
référentiel de zones plutôt que sur le `level1Name` libre) ; ou fusionner des
orthographes (`surface valueMap:{"Plus de 200m2":"Plus de 200m²","Entre 60m² et
200m²":"Entre 60 et 200m²"}`). Sur un `list`, les variantes d'un même item
dédoublonnent vers la canonique.

**Regrouper sur une clé propre, libellé dérivé** (`keyPaths`, kind `value`) :
quand le libellé affiché (`paths`, ex. `address.level4Name`) est du texte libre
SALE — variantes de casse/accents pour un même item (`NORD`/`Nord`,
`ISERE`/`Isère`/`ISèRE`), voire une valeur d'un autre niveau qui s'y glisse —
`keyPaths` désigne une clé propre et stable (ex. `address.level4`, l'id de zone).
Le moteur regroupe les items par cette clé et, **comme TOUT le dataset est
chargé**, DÉRIVE un libellé canonique par groupe : il préfère une variante déjà
proprement casée (la plus accentuée), sinon Title-Case fr la plus riche
(particules en minuscule : `Corse-du-Sud`, `Côtes-d'Armor`). Filtre/KPI/graphe/
table voient alors UNE valeur par groupe — fini les doublons (sur les tiers-lieux
FR : `address.level4Name` brut = 225 valeurs → regroupé par `address.level4` =
104 départements propres). La map clé→libellé est construite une fois sur le
dataset complet (`buildLabelMaps`, libellés stables indépendants du filtrage) ;
sans `keyPaths` : comportement normal (la valeur affichée EST la clé).
Ex. : `departement {paths:["address.level4Name"], keyPaths:["address.level4"]}`.

**Réponses CoForm comme dimensions** (chemin array-aware) : avec un variant qui
embarque les réponses (`serverData.answers`, ex. `navigator-tl`), une dimension
les lit par un **simple `paths`** — aucun accesseur métier dédié. `paths`
résout segment par segment et, quand un segment tombe sur un TABLEAU sans index
numérique, mappe le reste du chemin sur chaque élément puis aplatit ; comme
`answers.<form>` est un tableau d'entités Answer, le chemin
`answers.<form>.serverData.answers.<section>.<field>` ramène la (les) valeur(s)
de ce champ — `{paths:["answers.<form>.serverData.answers.<section>.<field>"],
kind:"list"}`. La valeur (chaîne ou liste) est ensuite traitée par `kind` comme
une source normale — `values`, `valueMap`, `contains` compris ; un index
explicite (`…answers.<form>.0.serverData…`) cible une entité précise.
`fieldsFromDimensions` ramène la racine `answers` à la projection. Débloque les
axes « équipements / services / activités » que les filtres `filtersByAnswers`
exposent. ⚠️ Couverture = part des items ayant RÉPONDU au CoForm (souvent faible
au départ, croît avec les saisies) ; les champs `table` (array-of-arrays, ex.
salles/tarifs) ne sont pas encore lus.

## Format de la section (tout vient de la config)

```jsonc
{
  "type": "data-observatory",
  "props": {
    "headline": { "fr": "…" },                  // optionnel
    "baseParams": {                              // PÉRIMÈTRE — requis
      "defaultTypes": ["poi"],
      "defaultFilters": { "$or": { "source.key": "monDataset" } },
      "notSourceKey": true,                      // cherche tout le réseau (cf. /lieux)
      "variant": "navigator-tl",                 // variant SDK — ALIGNER sur les sections search du costum
      "maxResults": 5000                         // plafond (défaut 5000)
    },
    "dimensions": {                              // REQUIS — le modèle du dataset
      "ville":   { "paths": ["address.addressLocality"], "label": { "fr": "Ville" } },
      "type":    { "paths": ["type_name", "type"], "label": { "fr": "Type" } },
      "sports":  { "paths": ["aps_name"], "kind": "list", "label": { "fr": "Sports" } },
      "access":  { "paths": ["acc_a", "acc_b"], "kind": "anyTrue", "label": { "fr": "Accessible" } },
      "surface": { "paths": ["surf"], "kind": "number", "label": { "fr": "Surface" } }
    },
    "filters": [                                 // ordre d'affichage ; sync URL ?id=valeur (multi : v1,v2)
      "access",                                  // forme courte → Select simple
      { "dimension": "type", "multiple": true },              // DropdownMenu + checkboxes (pattern equipements)
      { "dimension": "ville", "searchable": true },           // recherche, sélection unique (remplace)
      { "dimension": "sports", "multiple": true, "searchable": true }  // recherche + badges (MultipleSelector)
    ],                                           // (les anyTrue restent toujours en Select simple oui/non)
    "search": {                                   // recherche TEXTE optionnelle (présence = activée)
      "dimensions": ["ville", "type"],            // défaut : toutes les dimensions value/list
      "placeholder": { "fr": "Rechercher…" }      // sync URL ?q=…
    },
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
      { "kind": "bars", "dimension": "ville",
        "colors": { "Saint-Denis": "chart-1" } } // `colors` vaut AUSSI pour bars/barsHorizontal
    ],
    "maxWidth": "8xl",                           // largeur du conteneur (4xl…8xl, full) — défaut 8xl
    "kpiLayout": "inline",                       // "cards" (défaut) ou "inline" (chiffres tabulaires)
    "export": { "filename": "mon-export" },     // opt-in : bouton CSV (filtré/trié)
    "drilldown": true,                           // opt-in : clic part/barre = filtre
    "table": {
      "columns": [
        { "dimension": "ville", "kind": "title", "subtitleDimension": "type" },
        { "dimension": "type", "kind": "badge", "colors": { "Salle": "chart-1" } },
        { "dimension": "access", "kind": "boolBadge" },
        { "dimension": "surface", "kind": "number", "unit": "m²" }
      ],
      "defaultSort": "ville"
    },
    "rowAction": { "kind": "preview", "detailsMode": "dialog",
                   "preview": { "type": "poi-amenities" } },    // ou {"kind": "profil"} — LISTE ; la table lit table.rowAction
    "layout": "split",                           // "stacked" (défaut) ou "split"
    "list": {                                    // requis par "split"
      "titleDimension": "ville",                 // libellé d'une ligne
      "subtitleDimensions": ["type"],            // sous-titre, joint par « · »
      "selectDimensions": ["ville", "type"],     // fouillées par le clic (défaut : titleDimension)
      "label": { "fr": "Équipements" },          // titre du panneau
      "splitRatio": "40-60",                     // 40-60 (défaut) · 50-50 · 60-40
      "pageSize": 50                             // lignes avant « Voir plus »
    }
  }
}
```

**Features opt-in** (absentes de la config = désactivées) :
`search` (recherche texte) · `export: {filename?}` (bouton CSV du résultat
filtré/trié, BOM Excel) · `drilldown: true` (clic sur une part/barre de
graphe = applique le filtre de la dimension, si elle est filtrable) ·
`table.rowAction` (clic sur une ligne) — **choix déclaratif** :
`{kind: "profil"}` → navigation `/profil/<slug>` · `{kind: "preview",
detailsMode: "drawer"|"dialog", preview: {type: "poi-amenities"…}}` →
ouvre le détail du module search (le comportement de la liste
`/equipements-sportifs` au clic sur une carte — `SwitchDetailsMode` réutilisé).

Formes — KPI : `count`, `distinct`, `percentTrue`, `valueSplit`, `top`,
`sum`, `avg` (+ `unit`) ·
graphes : `donut`, `pie`, `bars`, `barsHorizontal`, `booleanGroups` ·
colonnes : `text`, `title`, `badge`, `boolBadge`, `number`. Couleurs en
**jetons de thème** uniquement (`chart-1..5`, `primary`, `accent`, `muted`)
— jamais d'hex : le dashboard suit le thème light/dark du site. Icônes KPI :
noms lucide kebab-case (DynamicIcon).

**`colors` s'applique à TOUS les types de graphes**, `bars`/`barsHorizontal`
compris (ils l'ignoraient en silence jusqu'au correctif). Sans `colors`, une
série reste monochrome (`--chart-1`) : c'est le défaut, et il est presque
toujours le bon — pour une série unique, la longueur des barres encode déjà la
valeur. **Toujours nommer les valeurs** plutôt que compter sur le repli
automatique : celui-ci colore par RANG dans la liste triée, si bien qu'une
valeur change de couleur dès que les comptes bougent.

## Split view : la liste à gauche, les graphes à droite

`layout: "split"` (+ `list`) réorganise la section en trois étages : les
filtres, puis les KPI en **bandeau pleine largeur**, puis deux colonnes — la
liste des items à gauche, les graphes à droite. `splitRatio` reprend le
vocabulaire du split liste+carte de `searchProStatic` et de l'agenda. Une
`table` déclarée vient ensuite SOUS les deux colonnes, en pleine largeur
(cf. « Sans page `/data`, la table reste » plus bas).

**Pourquoi les KPI sortent des colonnes** (arbitrage Peterson du 2026-09-16) :
ce sont les chiffres de synthèse du résultat filtré, ils se lisent avant
d'entrer dans le détail. Logés dans la colonne de droite, ils se tassaient sur
plusieurs lignes ; en bandeau, la grille `auto-fit` les aligne sur une seule.

**Ce sont les graphes qui commandent la hauteur.** La colonne de droite se
déroule ENTIÈREMENT, sans scroll propre : on doit pouvoir lire tous les graphes
d'une traite. La liste s'adapte à cette hauteur et devient, elle, l'unique zone
défilante de la section (arbitrage Peterson du 2026-09-10 sur capture).

Mécanique, non devinable : la colonne de gauche est `relative` et son contenu
est posé en `absolute inset-0 overflow-y-auto`. `items-stretch` (défaut flex)
étire la colonne à la hauteur des graphes, et le panneau absolu en
épouse les bornes — ce qui lui donne enfin une hauteur DÉFINIE. Sans ce
détour, un enfant flex étiré grandit avec son contenu et `overflow-y` reste
lettre morte : la liste pousserait la page au lieu de défiler. Un
`min-h-[60vh]` sur le conteneur sert de filet quand la colonne droite est
courte (une section sans graphe la réduirait à rien).

**Desktop seulement.** Sous 768 px (`useIsMobile`), deux colonnes sont
illisibles : tout s'empile — filtres, KPI, graphes, puis la liste, avant la
table éventuelle. Elle n'est jamais escamotée.

**Deux gestes par ligne, volontairement distincts** : le libellé applique le
filtre de SÉLECTION, le bouton fiche ouvre le détail (`rowAction` résolu, même
`SwitchDetailsMode` que la table — réservations et tableau de bord
d'installation compris).

**Sélection ≠ recherche texte.** La recherche (`?q=`) cherche la saisie
ENTIÈRE en sous-chaîne : c'est son comportement historique, inchangé. La
sélection (`?selection=`, `applySelection`) découpe le libellé en MOTS et
exige chaque mot dans la réunion des `selectDimensions` — ET entre les mots,
OU entre les dimensions. Les deux filtres se cumulent et s'effacent
séparément.

Ce découpage n'est pas un confort : le libellé d'un équipement et celui de son
installation ne coïncident jamais mot pour mot. Mesuré sur `saintpaulSport1`
(207 équipements), un clic sur « base Nautique » ramène **2** équipements avec
`selectDimensions: ["equipName", "name"]`, là où la recherche texte de la même
chaîne n'en ramène **1** — élargir les dimensions élargit le résultat, jamais
l'inverse. Deux propriétés en découlent, couvertes par `dashboard.test.ts` :
l'item cliqué est TOUJOURS dans le résultat, et aucun clic ne peut vider la
liste.

**`rowAction` vit au niveau de la section** pour la liste et le deep-link
`?installation=`. Déclarée sous `table.rowAction` dans les configs antérieures,
elle y est toujours lue en repli : une page qui remplace sa table par une liste
déplace simplement le bloc d'un cran, sans rien dupliquer. **La table, elle, ne
lit QUE `table.rowAction`** (`ObservatoryTable`) : une page qui GARDE sa table
y laisse le bloc — hissé au niveau de la section, il priverait la table de son
clic, sans le moindre signal.

**Retirer la table d'une page ne perd rien** si le site expose déjà une page
`/data` sur le même périmètre : tri par colonne, pagination et export CSV y
restent entiers. C'est le choix fait le 2026-09-10 pour les trois sites
d'équipements sportifs — `/observatoire` en split, `/data` inchangée.

**Sans page `/data`, la table reste** — cas de tiers-lieux (2026-09-30), où
elle porte seule l'export CSV, le tri par colonne, la pagination et les badges.
Elle est alors rendue SOUS les deux colonnes, en pleine largeur : dans la
colonne droite, elle allongerait la liste de toute sa hauteur (seuls les
graphes doivent la commander) et ses colonnes s'y serreraient. Le bouton CSV
reste le sien : celui de la liste n'apparaît qu'avec `export.fields`, et
déclarer `fields` changerait AUSSI le CSV de la table (export des données
détail au lieu de ses colonnes).

**`maxWidth`** aligne le tableau de bord sur les autres sections de la page.
Le défaut `8xl` (1440 px) convient à une page dédiée ; sur une page qui mêle
plusieurs sections, reprendre la largeur des voisines (souvent `5xl` ou `6xl`)
— deux largeurs différentes sur une même page se voient immédiatement.
**`kpiLayout: "inline"`** rend les KPI en ligne de chiffres tabulaires au lieu
de grandes cartes : préférable pour un résumé posé en accueil, où trois cartes
pleine largeur écrasent le reste de la page.

L'exemple complet en production : la page `/observatoire` de
`config.prod.equipements-Sportifs.json` (dataset RES — 12 dimensions,
7 filtres multi, recherche, 7 KPI, 5 graphes avec drill-down, table 8 colonnes
avec export CSV et détail au clic).

## Architecture

| Pièce | Rôle |
|---|---|
| `dimensions.ts` | moteur : résolution des dimensions (chemins pointés via le `getValueByPath` du repo), coercions (`isTrue`, `toNumber`, `toStringList`, `asDisplayString` — gère les `Date` SDK), `fieldsFromDimensions` (projection API DÉRIVÉE des déclarations : on ne demande au backend que ce que le dashboard consomme), maps jetons→classes/var(--…) |
| `hooks/useObservatoryItemsQuery` | délègue à **`useSearchAllResults`** (module search — « charger tout » : pages séquentielles auto-régulées, plafond, progress, **cache 30 min/1 h** : revenir sur la page ne re-chaîne pas les appels) ; retourne `items` = `serverData` BRUT (seuls les champs déclarés sont lus) + `entities` SDK **alignées** (rowAction preview) |
| `hooks/useObservatoryFilters` | filtrage CLIENT par kind (égalité / appartenance / booléen, multi par virgule), ET strict, **sync URL** `?<id>=<valeur>`, `?q=…` et `?selection=…` (permaliens) — la saisie immédiate et son debounce (250 ms) vivent dans `<Filters>` (isolation d'état : la frappe ne re-rend que l'input) ; `resetAll` efface filtres + recherche + sélection (l'état « aucun résultat » doit pouvoir se déverrouiller quelle qu'en soit la cause) |
| `prefetch.ts` | prefetch **SSR de la 1ʳᵉ page** (loader `buildRoutes`) — même queryKey que le client via `buildObservatoryBaseParams` (fonction partagée) |
| `dashboard.ts` | logique PURE (filtrage, recherche texte insensible casse/accents, **sélection mot à mot** `applySelection`, formes de KPI, décomptes/couleurs/agencement graphes, lignes/tri table, `buildCsv`) — testée sans rendu (`dashboard.test.ts`) |
| `components/` | rendus déclaratifs : `Filters` (matrice Select/dropdown-checkbox/MultipleSelector, options dérivées des données, recherche texte, badge filtres actifs, badge « données partielles » ; **mobile : bouton « Filtres » + compteur → Sheet bas**, pattern du searchHeader), `KpiCards` (7 formes de calcul, icônes DynamicIcon), `Charts` (5 formes via `ui/chart.tsx`, composition full/half, drill-down ; **client-only** : recharts ne s'hydrate pas — Skeleton SSR identique au 1er rendu, animations coupées pendant le chargement progressif), `ObservatoryTable` (colonnes/tri/badges déclarés, export CSV, rowAction), `ObservatoryList` (mode `split` : une ligne = libellé + sous-titre + bouton fiche, tri alphabétique, « Voir plus » par tranches faute de virtualisation dans le parc, badge de sélection active) |

| `components/ObservatoryPanel` | le tableau de bord **sans sa page** : KPI puis graphes, calculés sur des résultats que l'APPELANT a déjà chargés — cf. [§Panneau réutilisable](#panneau-réutilisable--lobservatoire-dans-une-autre-section) |
| `dashboardSchema.ts` | primitives déclaratives (dimensions, KPI, graphes) + `ObservatoryPanelConfSchema`. Sorties de `schema.ts` pour rester importables par le module search : `schema.ts` importe search (PreviewConfSchema), l'inverse fermerait le cycle et Zod y lirait des `undefined`. `schema.ts` les ré-exporte — `from "../schema"` reste la voie normale |

Le filtrage est côté client **par design** : le dashboard agrège tout le
dataset en mémoire — le module search reste l'outil des listes paginées
filtrées serveur.

## Panneau réutilisable — l'observatoire dans une autre section

`ObservatoryPanel` est le tableau de bord détaché de sa page : il reçoit
`results` (des entités du module search) et une conf `{dimensions, kpis,
charts}`, applique la convention `serverData` (`toItems`, partagée avec le
hook de la section) et rend KPI puis graphes. **Ni requête, ni état, ni
filtres** — c'est ce qui le rend appelable ailleurs.

Premier appelant : `searchProStatic.observatory` (cf.
[doc/07](./07-module-search.md#vue-observatoire--le-tableau-de-bord-dans-la-section)),
où la page Équipements de Saint-Paul propose une troisième vue à côté de la
liste et de la carte. Les chiffres y portent sur les résultats COURANTS de la
section : la recherche et les filtres de l'hôte les traversent sans qu'aucun
câblage ne soit nécessaire.

`part` (`all` par défaut, `kpis`, `charts`) découpe le rendu : en deux colonnes,
les KPI se lisent en bandeau pleine largeur au-dessus et les graphes occupent la
colonne de droite. L'hôte monte alors le panneau deux fois — le recalcul est
négligeable (une projection des résultats ; `buildLabelMaps` ne travaille que
pour les dimensions à `keyPaths`) et l'agencement reste sa décision.

`DataObservatorySection` n'utilise PAS le panneau : en mode `split`, les KPI
vont en bandeau pleine largeur et les graphes dans la colonne de droite — deux
emplacements distincts, qu'un bloc unique ne saurait occuper. Ce sont les
briques du dessous (`KpiCards`, `ObservatoryCharts`, `buildLabelMaps`) qui
sont partagées, et le partage se fait à ce niveau-là.

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
- Les graphes sont **client-only** (hydratation recharts impossible : ids
  clipPath à compteur global, mesure de texte serveur impossible) — le HTML
  SSR porte KPI/filtres/table + skeletons de graphes ; les animations ne
  jouent qu'une fois le dataset complet (sinon re-animation à chaque page).

## États UX

- **Pendant le chargement** : filtres/recherche restent UTILISABLES (page 1
  SSR dès le 1er paint) — badge « données partielles : X / Y » sur la barre
  de filtres + barre de progression.
- **Vide filtré** : des données existent mais filtres/recherche excluent
  tout → message dédié + bouton réinitialiser (au lieu de KPI à 0 muets).
- **Plafond atteint** (`maxResults`) : bannière « données incomplètes ».
- **Drill-down** : les selects se resynchronisent (le filtre appliqué par un
  clic de graphe est visible et retirable) ; compteur de filtres actifs
  visible desktop ET mobile.

## Limites connues / backlog

- Chaque rendu SSR de la page paie le fetch backend de la 1ʳᵉ page
  (QueryClient par requête) — cache serveur partagé si le TTFB devient un sujet.
- v2 éventuelle : tranches parallèles à concurrence bornée après la page 1
  (`indexMin`/`indexMax` directs), à mesurer avant.
- Facettes en cascade (options restreintes par les filtres actifs) : choix
  actuel = options sur le dataset complet (stables sous la souris).
- Features candidates (brainstorm 2026-06-12, à activer par config le jour
  venu) : carte leaflet des items filtrés, kind `date` + graphes de séries
  temporelles, filtres range pour les `number` (slider), tableau pivot 2D,
  heatmap, annotations/seuils sur graphes.
- Optimisations différées : options de filtres calculées incrémentalement
  par page, rows de table incrémentaux.
