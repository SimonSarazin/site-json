# SiteForge — conventions d'usage

## Enveloppe obligatoire

Enveloppe l'application une fois, à la racine, dans `DsProvider` (export du bundle). Il fournit le routeur (les liens des sections), la localisation (fr) et la config de site minimale. Sans lui, toute section qui affiche du texte localisé ou un lien plante au rendu.

```jsx
import { DsProvider, HeroSection, CardsSection, Button } from "site-forge";

export default function App() {
  return (
    <DsProvider>
      <HeroSection props={{
        headline: { fr: "Le réseau qui accompagne les parents" },
        subhead: { fr: "Écoute, entraide et actions près de chez vous." },
        align: "center", overlay: false,
        cta: [{ label: { fr: "Découvrir" }, href: "/reseau", variant: "default" }],
      }} />
    </DsProvider>
  );
}
```

## Trois familles de composants

- **Sections** (groupe `sections`) : blocs de page pleine largeur. Signature unique : `<XSection props={{...}} />`. Tout texte visible est un objet localisé `{ fr: "…" }` — jamais une chaîne nue. Les props exacts sont dans `components/sections/<Name>/<Name>.d.ts`, des compositions réalistes dans `<Name>.prompt.md`.
- **Composants de modules** (groupes `module-blog`, `module-search`, `module-profil`, `module-news`, `module-cagnotte`, `module-ampli`) : pièces présentationnelles des fonctionnalités produit — cartes d'article, marqueurs de carte, cartes d'entité, jauges de financement… Props-driven : tu fournis les données (objets article/entité mockés ou réels) ; ils ne fetchent rien.
- **Primitives** (groupe `general`, shadcn/Radix) : props/children React classiques (`<Button variant="outline">`, `<Card><CardHeader>…`). Tous les sous-composants (CardHeader, SelectTrigger, FormField…) sont des exports du bundle. Les notifications s'émettent via l'export `toast(...)` avec `<Toaster />` monté.

## Style : tokens d'abord, jamais de couleurs en dur

Le principe du produit : **le thème varie par configuration**. Les composants lisent des variables CSS ; re-thémer = surcharger ces variables sur `:root`. Un design ne code JAMAIS une couleur/typo en dur — il utilise :

`--background --foreground --card --card-foreground --primary --primary-foreground --secondary --secondary-foreground --muted --muted-foreground --accent --accent-foreground --border --input --ring --radius --chart-1 … --chart-5 --info --success --warning --error --font-sans --font-serif`

Pour ta propre glue de mise en page : styles inline ou `style={{ background: "var(--muted)", borderRadius: "var(--radius)" }}`. **Attention** : la feuille livrée est un CSS Tailwind PRÉCOMPILÉ (sous-ensemble utilisé par l'app) — une classe utilitaire absente de `styles.css` ne produit rien ; en cas de doute, styles inline + `var(--*)`.

## Images

Pas de service d'optimisation ici : `OptimizedImage` ne fonctionne qu'avec des `src` en `data:` ou `.svg` (sinon utilise un `<img>` nu avec une URL https réelle). Pour des placeholders : SVG en data-URI.

## Où est la vérité

- `styles.css` (tokens en tête de fichier) et son import `_ds_bundle.css` — lis-les avant de styler.
- `components/<groupe>/<Name>/<Name>.d.ts` = le contrat d'API ; `<Name>.prompt.md` = l'usage recommandé avec exemples.
