# Concevoir un thème (recette)

Chargé quand la tâche touche `config.theme`. Forme exacte : `npm run config:schema theme`.
Exemple complet et vivant : `npm run config:example -- theme` (parent62).

## Qui fait quoi (le maillon qu'on oublie)

1. **`config.theme.colors.{light,dark}` est la source de vérité.** `SiteTheme.tsx`
   injecte au runtime (SSR compris) un `<style id="site-theme">` avec un
   `--<clé-kebab>` par entrée. C'est là qu'on décide une palette, jamais dans le CSS.
2. **`src/index-<theme>.css` expose ces tokens à Tailwind** via
   `@theme inline { --color-primary: var(--primary); … }`, plus des valeurs de
   repli `:root`/`.dark` et les utilitaires bespoke du site.
3. **Le maillon manquant** : un token déclaré en config mais **non mappé** dans le
   CSS est injecté… et inatteignable — `bg-warning` ne résout pas. C'est le
   constat `theme-token-non-mappe` de `audit:config` (cas réels : parent62 et
   tiers-lieux écrivent `warning`/`success`/`info` que leurs CSS ne mappent pas).
   Correctif : deux lignes dans le `@theme inline` du CSS du site.
4. `SiteTheme` n'valide RIEN : une faute de frappe dans une clé produit une
   variable morte, en silence. Écrire les clés en se calquant sur un thème existant.

⚠ Plusieurs sites peuvent PARTAGER un `index-<theme>.css` et diverger par leur
`config.theme` — ne pas dupliquer un CSS pour changer des couleurs.

## Méthode

1. **Choisir `primary`** (la teinte de marque) et s'y tenir : tout le reste en découle.
2. **Dériver** : `background`/`foreground` (le contraste porteur), `muted` (fonds
   secondaires), `border`/`input`/`ring`, `card`/`popover`, `secondary`, `accent`.
3. **Faire le mode sombre en même temps**, pas après : en pratique on remonte la
   clarté de `primary` (~0.48 → ~0.64 en oklch) et on inverse background/foreground.
   Le préflight vérifie la PARITÉ des tokens light ⇄ dark.
4. **Vérifier 4 paires** : background/foreground, card/cardForeground,
   primary/primaryForeground, muted/mutedForeground. Si une seule manque de
   contraste, tout le site en souffre.
5. **Tokens de statut** (`success`/`warning`/`info`/`error`) : ne les déclarer que
   si le CSS du site les mappe (cf. §3) — sinon c'est de l'encre perdue.

## Sémantique des tokens qui se trompent le plus

| token | à quoi il sert | piège |
|---|---|---|
| `accent` | sélections PERSISTANTES et marque (onglet actif, filtre appliqué) | **jamais** un hover/focus — pour ça, `muted`. Un accent saturé rend les hovers criards |
| `muted` | fonds secondaires, zones inertes, hovers d'interface | à distinguer de `secondary` (élément d'UI, pas un fond) |
| `ring` | anneau de focus visible | l'omettre casse l'accessibilité clavier |
| `sidebar*` | panneaux d'admin et sidebars de filtres | invisible sur le site public — ne pas y passer du temps pour une vitrine |
| `chart1..5` | série catégorielle des `chart` et `data-observatory` | doivent se distinguer ENTRE ELLES, pas seulement du fond |

## Directions de départ (palettes réelles du parc)

| direction | primary (light → dark) | fond | caractère |
|---|---|---|---|
| indigo institutionnel — parent62 | `oklch(0.48 0.15 264)` → `oklch(0.64 0.15 264)` | crème `oklch(0.976 0.007 85)` | portail public, sérieux et chaleureux |
| vert territoire — saint-paul-sport | `oklch(0.520 0.118 166)` → `oklch(0.760 0.150 168)` | blanc verdi | cartographie, nature, lisibilité |
| bleu franc — eXtremeDefiAdeme | `oklch(0.50 0.19 264)` → `oklch(0.64 0.18 262)` | blanc pur | vitrine de campagne, contrasté |
| cyan réseau — tiers-lieux | `hsl(182, 56%, 40%)` → `hsl(182, 56%, 50%)` | blanc | réseau, technique (seul thème en hsl) |

oklch et hsl sont tous deux acceptés ; oklch est préférable (clarté perceptuelle
uniforme → dériver le mode sombre revient à bouger le premier nombre).

## Au-delà des couleurs

`typography` (`fontFamily.sans/serif/mono`, `letterSpacing`), `spacing`,
`borderRadius`, `shadows`, `defaultMode`, `customCSS`. Les effets génériques
(ombres, glow, `--header-bar`, `--hero-tint`, `--gradient-section`) viennent de
`src/styles/shared.css` : un thème les SURCHARGE en `:root`/`.dark`, on ne
recopie jamais une classe.
