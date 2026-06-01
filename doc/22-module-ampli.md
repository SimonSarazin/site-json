[← Retour à l'index](README.md)

# Module Ampli

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Configuration JSON (`schema.ts`)](#configuration-json-schemats)
- [Routes](#routes)
- [Rendu et sections](#rendu-et-sections)
  - [AmpliPage](#amplipage)
  - [AmpliRenderer](#amplirenderer)
  - [AmpliSectionRenderer — tabs et sections](#amplisectionrenderer--tabs-et-sections)
  - [Section `meeteem` (section JSON publique)](#section-meeteem-section-json-publique)
- [Contexte `AmpliProvider`](#contexte-ampliprovider)
- [Hook `useFetchAnswerQuery`](#hook-usefetchanswerquery)
- [Helper `getSummaryData`](#helper-getsummarydata)
- [Utilitaires client-side (`cardFilters.ts`)](#utilitaires-client-side-cardfiltersts)
- [Composants de sections](#composants-de-sections)
  - [AmpliHeader](#ampliheader)
  - [AmpliIntro](#ampliintro)
  - [AmpliFeatures](#amplifeatures)
  - [AmpliMessages](#amplimessages)
  - [AmpliCommunity](#amplicommunity)
  - [MeeteemSection](#meeteemsection)
  - [MeeteemCard, MeeteemFilters, MeeteemViewToggle, MeeteemMapPlaceholder](#sous-composants-meeteem)
- [Types canoniques (`types.ts`)](#types-canoniques-typests)
- [i18n](#i18n)
- [Tests unitaires](#tests-unitaires)
- [Exemple de configuration JSON](#exemple-de-configuration-json)
- [Pièges connus / À noter](#pièges-connus--à-noter)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le **module Ampli** (`src/modules/ampli/`) implémente des pages de type "amplification" : des plateformes communautaires qui agrègent des réponses CoForm (idées, projets, besoins, membres) et les affichent sous forme de cartes filtrables avec vues Annuaire, Carte et Split.

Le concept "Ampli" est directement lié au système **Meeteem** — une interface de type annuaire participatif où chaque entrée est une réponse à un formulaire CoForm. Les utilisateurs soumettent des réponses, qui apparaissent en temps réel dans la liste, filtrables par tags et par auteur.

**Type de module** : `core` — chargé en eager.

**Particularité centrale** : contrairement aux modules profil/search, Ampli repose entièrement sur des **réponses CoForm** (via `entity.coformAnswersSearch()`) et non sur des entités directes. Les données affichées sont extractées via un mapping de chemins (`path.*`) configurable en JSON.

---

## Architecture interne

```
src/modules/ampli/
├── module.config.ts                # name: "ampli", type: "core", enabled: true
├── index.ts                        # API publique
├── schema.ts                       # AmpliConfigSchema (Zod) + AmpliLayoutVariantSchema
├── types.ts                        # Types canoniques : MeeteemCard, MeeteemViewMode, AmpliSummaryData, …
├── routes.tsx                      # Route /ampli/:slug + sous-routes (community, stats, news)
│
├── AmpliRenderer.tsx               # Wrapper Suspense + dispatch vers AmpliSectionRenderer
├── AmpliSectionRenderer.tsx        # Switch entre tabs (home, community, stats, news)
├── AmpliSeo.tsx                    # SEO dynamique (@dr.pogodin/react-helmet)
│
├── contexts/
│   ├── AmpliContext.tsx            # Définition du Context React
│   └── AmpliProvider.tsx          # Provider minimal (injecte config)
│
├── hooks/
│   ├── useAmpliContext.tsx         # useAmpliContext() — throw si hors Provider
│   └── useFetchAnswerQuery.ts     # Hook principal : coformAnswersSearch + infinite scroll + extraction
│
├── helpers/
│   └── summary.ts                 # getSummaryData() : aggrégation totalAnswers/Users/Likes/Comments
│                                  # (ré-exporte aussi AmpliDataResponse et UserWithContributions)
│
├── utils/
│   └── cardFilters.ts             # collectAvailableTags(), filterCards() — purs, testés
│
├── components/
│   ├── AmpliUserCard.tsx          # Card d'un contributeur (avatar + compteur)
│   └── sections/
│       ├── AmpliHeader.tsx        # Section hero de la page Ampli (tab home)
│       ├── AmpliIntro.tsx         # Section introduction (tab home) — délègue à <CardsSection>
│       ├── AmpliFeatures.tsx      # Section bicolonne : formulaire placeholder + stats live (tab home)
│       ├── AmpliMessages.tsx      # Section messages (tab home) — wrapper fin autour de MeeteemSection
│       ├── AmpliCommunity.tsx     # Tab community : liste des contributeurs + vue carte (toggle inline)
│       ├── MeeteemSection.tsx     # Section JSON publique (type "meeteem")
│       └── parts/
│           ├── MeeteemCard.tsx           # Carte d'une réponse (variant large/compact)
│           ├── MeeteemFilters.tsx        # Accordéon de filtres par tags (expanded par défaut)
│           ├── MeeteemViewToggle.tsx     # Toggle 3 vues (Annuaire/Carte/Split)
│           └── MeeteemMapPlaceholder.tsx # Placeholder vue Carte (map non encore implémentée)
│
├── constants/
│   └── queryKeys.ts               # AMPLI_QUERY_KEYS — FETCH_ANSWERS + FETCH_ANSWERS_PREFIX
│                                  # (préfixe figé "ampli-meeteem", utilisé par useFetchAnswerQuery)
│
├── pages/
│   └── AmpliPage.tsx              # Page principale (RR v7 route handler)
│
└── i18n/
    ├── fr.json
    └── en.json
```

---

## Configuration JSON (`schema.ts`)

Un site peut déclarer plusieurs instances Ampli sous la clé `ampli` du JSON racine. Chaque instance est un objet `AmpliConfig` :

```ts
// schema.ts
export const AmpliConfigSchema = z.object({
  layout: AmpliLayoutVariantSchema.optional().default("default"),
  // "default" | "modern" | "compact" | "fullwidth"

  seo: z.object({
    titleTemplate: z.string().optional(),
    descriptionTemplate: z.string().optional(),
  }).optional(),

  slug: z.string().min(1),  // Identifiant de l'instance, visible dans l'URL

  props: z.object({
    coform: z.string().min(1),  // ID du CoForm source des réponses

    // Mapping des champs dans la réponse CoForm
    path: z.object({
      name: z.string().min(1),        // Champ "nom" dans answers.*
      description: z.string().optional(),
      address: z.string().min(1),     // Champ "adresse" dans answers.*
      image: z.string().optional(),
      finder: z.string().optional(),  // Chemin finder (pour le finderPath filter)
      tags: z.string().optional(),    // Champ tags dans answers.*
    }),

    // Contenu de chaque section (tous optionnels, avec fallback i18n)
    hero: z.object({ ... }).optional(),      // AmpliHeader
    intro: z.object({ ... }).optional(),     // AmpliIntro
    features: z.object({                     // AmpliFeatures
      headline, subhead, button,
      summary: { headline, submitted, members, amplified, comments },
      howItWork: { headline, stepOne, stepTwo, stepThree }
    }).optional(),
    message: z.object({ ... }).optional(),   // AmpliMessages
    community: z.object({ ... }).optional(), // AmpliCommunity
    dashboard: z.object({ ... }).optional(), // (réservé)
    news: z.object({ ... }).optional(),      // (réservé)
  }),
});
```

**Variantes de layout** : `default` (max-w-4xl), `modern` (max-w-6xl), `compact` (max-w-3xl), `fullwidth` (pleine largeur).

**Section JSON publique `meeteem`** : en plus de la page `/ampli/:slug`, le module expose une section de type `"meeteem"` utilisable dans n'importe quelle page JSON. Voir [`MeeteemSectionProps`](#section-meeteem-section-json-publique).

---

## Routes

```
/ampli/:slug           → AmpliPage (index) — tab "home"
/ampli/:slug/community → AmpliPage — tab "community"
/ampli/:slug/stats     → AmpliPage — tab "stats" (coming soon)
/ampli/:slug/news      → AmpliPage — tab "news" (coming soon)
```

Le loader (`ampliLoader`) extrait `slug` depuis les paramètres d'URL et dérive `activeTab` depuis les segments du pathname (`pathSegments[2]` si présent, sinon `'home'`). Le composant `AmpliPage` combine `loaderData.activeTab` (SSR) avec un fallback `useLocation()` pour la navigation client-side.

`AmpliPage` cherche la configuration via `siteConfig.ampli?.find(a => a.slug === slug)`.

Si le slug est introuvable, `<AmpliNotFound>` est rendu (avec le slug dans le message d'erreur).

Les sous-routes (`community`, `stats`, `news`) ont toutes `element: null` — le rendu est entièrement géré par `AmpliSectionRenderer` via le switch sur `activeTab`.

---

## Rendu et sections

### AmpliPage

`src/modules/ampli/pages/AmpliPage.tsx` — point d'entrée de la route. Rôles :

1. Lit `slug` et `activeTab` depuis `useLoaderData()` + fallback `useLocation()`
2. Cherche la config dans `siteConfig.ampli`
3. Rend `<AmpliSeo isLoading={false} activeTab={activeTab} />`, `<SiteHeader />`, `<SiteFooter />`
4. Applique un wrapper container/fullwidth selon `ampliConfig.layout` (`container mx-auto` sauf `fullwidth`)
5. Enveloppe dans `<AmpliProvider config={ampliConfig}>` pour injecter le contexte
6. Délègue le contenu à `<AmpliRenderer activeTab={activeTab} />`

### AmpliRenderer

`src/modules/ampli/AmpliRenderer.tsx` — applique la classe CSS du layout (selon `config.layout`) via `layoutClass` et enveloppe `<AmpliSectionRenderer config={config.props} activeTab={activeTab}>` dans un `<Suspense>` avec un spinner de fallback (`<Spinner label={t("a11y.loading")}>`) à l'intérieur d'un `<div className="ampli-container {layoutClass}">`.

### AmpliSectionRenderer — tabs et sections

`src/modules/ampli/AmpliSectionRenderer.tsx` — dispatch central entre tabs :

| Tab actif | Rendu |
|-----------|-------|
| `home` | `<AmpliHeader>` + `<AmpliIntro>` + `<AmpliFeatures>` + `<AmpliMessages>` |
| `community` | `<AmpliCommunity>` (liste des contributeurs) |
| `stats` | Placeholder "coming soon" (titre + description i18n) |
| `news` | Placeholder "coming soon" (titre + description i18n) |
| _(défaut)_ | `null` + `console.warn` |

`AmpliHeader`, `AmpliIntro`, `AmpliFeatures`, `AmpliMessages` sont chargés en **lazy** via `lazy()` de `vite-preload` (code-splitting automatique).

`AmpliCommunity` est importé **en eager** (import statique) — pas de lazy.

Le hook `useFetchAnswerQuery` est appelé **une seule fois** dans `AmpliSectionRenderer` avec `view: "map"` (ce qui charge toutes les données en une page, `indexStepMap: 0`). Les résultats sont passés aux sous-composants qui en ont besoin (`AmpliFeatures`, `AmpliMessages`, `AmpliCommunity`). `AmpliMessages` passe les données à `MeeteemSection` qui fait **son propre** appel `useFetchAnswerQuery` (voir ci-dessous).

### Section `meeteem` (section JSON publique)

`src/modules/ampli/components/sections/MeeteemSection.tsx` — section autonome registrée dans `SectionRenderer` sous le type `"meeteem"`. Elle peut être insérée dans n'importe quelle page JSON :

```json
{
  "type": "meeteem",
  "id": "annuaire",
  "props": {
    "coform": "5f1a2b3c4d5e6f7a8b9c0d1e",
    "path": {
      "name": "nom",
      "description": "description",
      "address": "adresse",
      "finder": "monFinder",
      "tags": "themes"
    }
  }
}
```

Elle gère son propre appel `useFetchAnswerQuery` et tout l'état local (viewMode, activeFilters, userFilter). **Ne dépend pas de `AmpliProvider`**, donc utilisable hors contexte Ampli.

**Trois vues** :
- `answers` : grille de `MeeteemCard` (variant large), avec infinite scroll (référence `lastItemRef` attachée à une div sentinelle sous la grille)
- `map` : `MeeteemMapPlaceholder` (carte non encore implémentée)
- `split` : colonne gauche scrollable (cartes compact) + colonne droite (`MeeteemMapPlaceholder variant="compact"`)

Le `lastItemRef` est **uniquement** attaché en vue `answers` — les vues `map` et `split` ne déclenchent pas de pagination supplémentaire.

---

## Contexte `AmpliProvider`

`src/modules/ampli/contexts/AmpliProvider.tsx` — Provider React minimal qui injecte `config: AmpliConfig` dans `AmpliContext`.

```tsx
<AmpliProvider config={ampliConfig}>
  <AmpliRenderer activeTab={activeTab} />
</AmpliProvider>
```

Accès dans les sous-composants via `useAmpliContext()` (`hooks/useAmpliContext.tsx`), qui throw si utilisé hors Provider.

---

## Hook `useFetchAnswerQuery`

`src/modules/ampli/hooks/useFetchAnswerQuery.ts` — hook **réutilisable** (partagé entre `AmpliSectionRenderer` et `MeeteemSection`). Orchestre :

1. Un appel infini `useInfiniteQueryScrollNext` sur `entity.coformAnswersSearch(params)`
2. Une transformation/extraction en mémoire (via `useMemo`) des pages en résultats plats

**Signature** :

```ts
function useFetchAnswerQuery({
  coformId,        // ID du CoForm — utilisé par AMPLI_QUERY_KEYS.FETCH_ANSWERS
  view,            // "answers" | "map" | "split" — détermine indexStepList vs indexStepMap
  baseParams?: {
    fediverse?: boolean;
    indexStepList?: number;    // Nombre d'items par page en vue "answers" (défaut: 30)
    indexStepMap?: number;     // Nombre d'items en vue "map"/"split" (défaut: 0 = pas de limite)
    defaultFilters?: Record<string, unknown>;
    defaultFields?: string[];
    defaultSortBy?: Record<string, 1 | -1>;
    notSourceKey?: boolean;
  };
  extractionConfig?: {
    dataPath: Record<string, string | undefined>;  // Mapping chemin → champ
    prefix?: string;                                // Préfixe dans serverData (défaut: "answers")
    includeUserInfo?: boolean;                     // Enrichit avec name/initial/exists
  };
})
```

**Retour** :

| Champ | Type | Description |
|-------|------|-------------|
| `transformedResults` | `unknown[]` | Résultats extraits et transformés (cast en `MeeteemCard[]` par le caller) |
| `isLoading` | `boolean` | Chargement en cours |
| `isPending` | `boolean` | État "pending" React Query (avant toute donnée) |
| `isFetchingNextPage` | `boolean` | Page suivante en cours de chargement |
| `lastItemRef` | `Ref` | Ref à attacher au dernier élément pour déclencher le chargement suivant |
| `totalCount` | `number \| undefined` | Total backend si disponible (`pages[0].count.total`) |
| `data` | Raw RQ data | Données brutes (rarement nécessaire) |
| `error` | `Error \| null` | Erreur éventuelle |
| `refetch` | `fn` | Forcer un rechargement |

**Extraction** : quand `extractionConfig` est fourni, chaque réponse est transformée en `{ answer, data: {…champs extraits}, user?: {name, initial, exists} }`. C'est ce format que les composants `MeeteemCard` et `AmpliFeatures` consomment.

**`enabled`** : `!!entity` — aucun chargement tant que le `CocolightProvider` n'a pas initialisé l'API. `staleTime`: 60 secondes.

---

## Helper `getSummaryData`

`src/modules/ampli/helpers/summary.ts` — fonction pure qui agrège les statistiques globales d'une liste de réponses :

```ts
function getSummaryData(data: AmpliDataResponse[]): {
  totalAnswers: number;    // Nombre total de réponses
  totalUsers: number;      // Nombre d'utilisateurs distincts
  totalLikes: number;      // Réponses ayant voteCount.like > 0
  totalComments: number;   // Réponses ayant au moins 1 commentaire (Object.keys(comments).length > 0)
  users: UserWithContributions[];  // Liste dédupliquée avec compteur par user
}
```

**Important** : `summary.ts` ré-exporte aussi `AmpliDataResponse` et `UserWithContributions` (définis initialement dans `types.ts`). Les imports existants depuis `helpers/summary` fonctionnent mais la source canonique est `types.ts`.

Utilisé par `AmpliFeatures` (affichage des statistiques dans la carte summary) et `AmpliCommunity` (liste des contributeurs).

---

## Utilitaires client-side (`cardFilters.ts`)

`src/modules/ampli/utils/cardFilters.ts` — deux fonctions pures extraites de `MeeteemSection` pour faciliter les tests :

```ts
// Collecte tous les tags uniques présents dans les cartes (ordre d'apparition, dédupliqués)
function collectAvailableTags(cards: MeeteemCard[]): string[]

// Filtre les cartes selon les tags actifs (OR entre tags) ET le filtre utilisateur (AND entre les deux)
// Retourne toutes les cartes si aucun filtre actif
function filterCards(
  cards: MeeteemCard[],
  activeFilters: string[],
  userFilter: string | null,
): MeeteemCard[]
```

---

## Composants de sections

### AmpliHeader

`components/sections/AmpliHeader.tsx` — Héro de la page Ampli. Accepte les props de `config.props.hero` :
- `headline`, `subhead` : textes (LocalizedString avec fallback sur les clés `AmpliHero.headline` / `AmpliHero.subhead`)
- `icon.show`, `icon.name`, `icon.size`, `icon.backdrop` : icône configurable via `DynamicIcon` de `lucide-react/dynamic` (fallback `"megaphone"`, taille 64)
- `backgroundImage`, `videoBg` : fond optionnel (fallback `/images/ampli/background.jpg`)
- `listContent.items[]` + `listContent.layout` : liste de points clés (layout `rows`/`columns`)
- **Deux boutons CTA fixes** (non configurables) : "Proposer une idée" (`AmpliHero.proposal`) et "Rejoindre la communauté" (`AmpliHero.join`)

### AmpliIntro

`components/sections/AmpliIntro.tsx` — Section introduction. Accepte les props de `config.props.intro` :
- `headline`, `subhead`
- `items[]` : tableau de `{ title, text, icon }` — si absent, un tableau de 6 cartes par défaut est utilisé

Le rendu des cartes est **délégué** au composant partagé `<CardsSection>` (layout `grid`, 3 colonnes, variant `default`).

### AmpliFeatures

`components/sections/AmpliFeatures.tsx` — Section bicolonne :
- Colonne gauche : zone formulaire (div vide `min-h-52` + bouton "Soumettre" — placeholder pour intégration future CoForm)
- Colonne droite : carte "Comment ça marche" (3 étapes, icône `Lightbulb`) + carte "Statistiques live" (4 compteurs : soumissions, membres, amplifiées `totalLikes`, discussions `totalComments`)

La carte summary utilise `summary.amplified` (et `AmpliFeatures.summary.amplified`) pour le compteur de likes, et `summary.comments` pour les commentaires.

Les statistiques sont calculées en direct depuis `transformedResults` via `getSummaryData()`. Retourne `null` pendant le chargement (`isLoading: true`).

### AmpliMessages

`components/sections/AmpliMessages.tsx` — Section affichant les contributions récentes. Accepte `props` (`headline`/`subhead`), `path` et `coform`.

**C'est un wrapper fin** autour de `<MeeteemSection>` : rend un en-tête avec titre/sous-titre (fallback `AmpliMessage.headline` / `AmpliMessage.subhead`), puis passe les `props.coform` et `props.path` à `MeeteemSection` qui gère son propre état et chargement.

**Ne gère pas** de données ou d'état propre — toute la logique est dans `MeeteemSection`.

### AmpliCommunity

`components/sections/AmpliCommunity.tsx` — Tab "community". Accepte `props` (`headline`/`subhead`) et `data` (résultats bruts de `useFetchAnswerQuery`). Affiche :
- Un toggle **deux vues** (liste / carte) : deux `<Button>` inline (pas `MeeteemViewToggle`)
- Vue liste (`viewMode === "list"`) : grille de `AmpliUserCard` (un par contributeur unique, avec compteur de contributions)
- Vue carte (`viewMode === "map"`) : `MeeteemMapPlaceholder variant="large"`

Données : agrégées via `getSummaryData(data).users`.

### MeeteemSection

`components/sections/MeeteemSection.tsx` — Section JSON publique de type `"meeteem"`. Voir [Section `meeteem`](#section-meeteem-section-json-publique).

**Animations** : en vue `answers`, les cartes utilisent une keyframe CSS inline `cardSlideIn` (fade-in + slide depuis le bas + léger scale) avec délai progressif (`animationDelay={index * 50}ms`). Ce keyframe est injecté via un bloc `<style>` inline dans le composant.

### Sous-composants Meeteem

| Composant | Rôle |
|-----------|------|
| `MeeteemCard` | Carte d'une réponse CoForm. Props : `card: MeeteemCard`, `activeFilters`, `onToggleFilter`, `onSelectUser`, `variant: "large" \| "compact"`, `animationDelay?`. Affiche nom, description, tags (cliquables), avatar utilisateur (cliquable → filtre). Stats : `vote` (Object.keys) + `comments` (Object.keys). |
| `MeeteemFilters` | Accordéon de filtres par tags. Props : `availableTags`, `activeFilters`, `onToggleFilter`. **Expanded par défaut** (`collapsed: false`). Retourne `null` si `availableTags.length === 0`. |
| `MeeteemViewToggle` | Boutons toggle 3 vues (Annuaire/Carte/Split). Props : `value: MeeteemViewMode`, `onChange`. Utilise `VIEW_BUTTONS` constant avec icônes `TextAlignJustifyIcon` (Radix), `MapPinIcon`, `Columns2Icon` (Lucide). |
| `MeeteemMapPlaceholder` | Placeholder "Carte interactive (nécessite Leaflet.js)". Props : `variant: "large" \| "compact"`. Utilise les clés i18n `MeeteemSection.map.placeholderTitle` / `placeholderSubtitle`. |

**Filtre utilisateur** : cliquer sur l'avatar d'un `MeeteemCard` active le `userFilter` (nom de l'utilisateur). Un badge apparaît dans le header de `MeeteemSection` pour le visualiser et le supprimer. Le filtre combine logiquement les tags actifs (OR entre tags) ET le filtre utilisateur (AND avec les tags).

---

## Types canoniques (`types.ts`)

```ts
// Modes d'affichage MeeteemSection
type MeeteemViewMode = "answers" | "map" | "split";

// Une réponse CoForm transformée par useFetchAnswerQuery (extractionConfig)
interface MeeteemCard {
  answer: {
    serverData: {
      id?: string;
      created?: Date;
      vote?: Record<string, unknown>;    // Compteur via Object.keys(vote).length
      comments?: Record<string, unknown>; // Compteur via Object.keys(comments).length
      [key: string]: unknown;
    };
  };
  data: MeeteemCardData;  // { name?, description?, tags?, ...champs extraits }
  user?: MeeteemUserInfo; // { name, initial, exists }
}

// Forme brute retournée par useFetchAnswerQuery avant extraction
interface AmpliDataResponse {
  answer: Answer;
  data: Record<string, unknown>;
  user?: User | Record<string, string> | null;
}

// Agrégation par getSummaryData (helpers/summary.ts)
interface AmpliSummaryData {
  totalAnswers: number;
  totalUsers: number;
  totalLikes: number;       // Réponses avec voteCount.like > 0
  totalComments: number;    // Réponses avec Object.keys(comments).length > 0
  users: UserWithContributions[];
}
```

---

## i18n

Namespace : **`modules/ampli`**. Enregistré en side-effect par `i18n.ts` (`i18n.addResourceBundle` avec `true, true` — deep merge, overwrite).

Groupes de clés dans `fr.json` / `en.json` :
- `AmpliTemplateDefault.tabs.*` — labels des tabs (home, message, network, dashboard, news) — utilisés par `AmpliSeo`
- `AmpliTemplateDefault.comingSoon.*` — message placeholder pour tabs stats/news
- `AmpliHero.*` — textes par défaut du hero (headline, subhead, proposal, join, …)
- `AmpliIntro.*` — textes par défaut de l'intro (headline, subhead)
- `AmpliFeatures.*` — textes par défaut des features
- `AmpliFeatures.summary.*` — labels stats (headline, submitted, members, amplified, comments)
- `AmpliFeatures.howItWork.*` — étapes (headline, stepOne, stepTwo, stepThree)
- `AmpliMessage.*` — textes par défaut de la section messages (headline, subhead)
- `AmpliCommunity.*` — textes par défaut de la section communauté
- `AmpliPage.*` — messages de la page (notFoundTitle, notFoundDescription, backHome)
- `AmpliUserCard.*` — carte contributeur (noLocation, contributions_one, contributions_other)
- `MeeteemSection.viewToggle.*` — labels des boutons de vue (answers/map/split)
- `MeeteemSection.filters.*` — titre de l'accordéon de filtres
- `MeeteemSection.map.*` — textes du placeholder carte (placeholderTitle, placeholderSubtitle)
- `MeeteemSection.card.*` — fallbacks carte (noDate, noUser)
- `a11y.*` — labels d'accessibilité (toggleFilters, toggleTag, selectUser, loading)

**Attention** : les composants `AmpliHeader` et `AmpliMessages` utilisent respectivement les namespaces `AmpliHero.*` et `AmpliMessage.*` (singulier), pas `AmpliHeader.*` ni `AmpliMessages.*`.

---

## Tests unitaires

| Fichier | Ce qui est testé |
|---------|-----------------|
| `helpers/summary.test.ts` | `getSummaryData` — totalAnswers, totalUsers, totalLikes (voteCount.like), totalComments (Object.keys), agrégation par user (_id), items sans user groupés ensemble |
| `utils/cardFilters.test.ts` | `collectAvailableTags` (déduplication, ordre), `filterCards` — OR tags, filtre user, combinaison AND tags+user |
| `components/sections/parts/MeeteemCard.test.tsx` | Rendu variants large/compact, tags cliquables (toggle + aria-pressed), stats vote/comments via Object.keys, clic auteur → onSelectUser, fallbacks Anonyme/N/A |
| `components/sections/parts/MeeteemFilters.test.tsx` | Affichage filtres, toggle actif/inactif |
| `components/sections/parts/MeeteemMapPlaceholder.test.tsx` | Rendu placeholder (variants large/compact) |
| `components/sections/parts/MeeteemViewToggle.test.tsx` | Toggle vues, état actif |

---

## Exemple de configuration JSON

```json
{
  "ampli": [
    {
      "slug": "ma-communaute",
      "layout": "modern",
      "seo": {
        "titleTemplate": "Ma Communauté - {headline}"
      },
      "props": {
        "coform": "6789abc123def456",
        "path": {
          "name": "nom",
          "description": "presentation",
          "address": "adresse",
          "finder": "monFinderPath",
          "tags": "themes"
        },
        "hero": {
          "headline": { "fr": "Rejoignez la communauté", "en": "Join the community" },
          "subhead": { "fr": "Soumettez votre projet", "en": "Submit your project" },
          "icon": { "show": true, "name": "Users", "size": 72, "backdrop": true }
        },
        "features": {
          "summary": {
            "headline": { "fr": "En chiffres", "en": "By the numbers" },
            "submitted": { "fr": "Soumissions", "en": "Submissions" },
            "members": { "fr": "Membres", "en": "Members" },
            "amplified": { "fr": "Amplifiées", "en": "Amplified" },
            "comments": { "fr": "Discussions", "en": "Discussions" }
          }
        },
        "community": {
          "headline": { "fr": "Notre communauté", "en": "Our community" }
        }
      }
    }
  ]
}
```

Accès à la page : `https://monsite.fr/ampli/ma-communaute`

**Section standalone** (dans n'importe quelle page) :

```json
{
  "pages": [
    {
      "path": "/annuaire",
      "sections": [
        {
          "type": "meeteem",
          "id": "annuaire-membres",
          "props": {
            "coform": "6789abc123def456",
            "path": {
              "name": "nom",
              "description": "presentation",
              "address": "adresse",
              "tags": "themes"
            }
          }
        }
      ]
    }
  ]
}
```

---

## Pièges connus / À noter

### 1. Tabs `stats` et `news` non implémentés

Les routes `/ampli/:slug/stats` et `/ampli/:slug/news` sont déclarées dans `routes.tsx` et affichent un écran "coming soon". Ne pas les exposer dans la navigation tant qu'elles ne sont pas implémentées.

### 2. Vue Carte non implémentée dans Meeteem

`MeeteemMapPlaceholder` est un placeholder — la vraie intégration Leaflet n'est pas encore faite. En attendant, les modes `map` et `split` affichent ce placeholder. Quand Leaflet sera intégré, utiliser `useClientModule()` (SSR-safe).

### 3. `useFetchAnswerQuery` requiert un `entity` initialisé

Le hook est `enabled: !!entity`. Tant que le `CocolightProvider` n'a pas initialisé l'API (`initApi`), aucun chargement n'est déclenché. Sur SSR, `entity` est disponible côté serveur via `initApi()`.

### 4. Extraction de données via `path.*`

Le mapping `config.props.path.*` doit correspondre exactement aux noms des champs dans `answers.*` du CoForm. Une erreur de typo résulte en champs `undefined` dans les cartes. Aucune validation runtime n'est faite sur ces chemins.

### 5. Cache des answers via `AMPLI_QUERY_KEYS.FETCH_ANSWERS`

Le préfixe de la queryKey est **figé** dans `AMPLI_QUERY_KEYS.FETCH_ANSWERS(coformId, view, baseParams)` → `["ampli-meeteem", coformId, view, JSON.stringify(baseParams)]`. Le paramètre `queryKeyPrefix` runtime a été supprimé du hook : les variations entre instances sont déjà couvertes par `coformId` + `view` + `baseParams`.

Pour invalider toutes les vues d'un coform donné, utiliser `AMPLI_QUERY_KEYS.FETCH_ANSWERS_PREFIX(coformId)` → `["ampli-meeteem", coformId]`.

### 6. Double appel `useFetchAnswerQuery` dans AmpliMessages

`AmpliSectionRenderer` appelle `useFetchAnswerQuery` avec `view: "map"` (chargement unique sans pagination). Mais `AmpliMessages` rend `MeeteemSection` qui fait **son propre** appel avec `view: "answers"` et `indexStepList: 6` (pagination à 6 items). Ce double chargement est intentionnel : l'appel de `AmpliSectionRenderer` alimente `AmpliFeatures` et `AmpliCommunity`, tandis que `MeeteemSection` gère sa propre pagination. Les queryKeys sont différentes (`view: "map"` vs `view: "answers"`), donc pas de conflit de cache.

### 7. `AmpliCommunity` n'utilise pas `MeeteemViewToggle`

Le composant `AmpliCommunity` a son propre toggle liste/carte à deux boutons inline (`TextAlignJustifyIcon` + `MapPinIcon`) — il n'utilise **pas** le composant `MeeteemViewToggle` (qui gère 3 vues). Utiliser `MeeteemViewToggle` si une troisième vue est ajoutée à Community.

---

## Voir aussi

- [Architecture](03-architecture.md) — système de modules, lazy loading avec vite-preload
- [Module CoForm](21-module-coform.md) — le moteur des réponses CoForm consommées par Ampli
- [Module Search](07-module-search.md) — patterns similaires de search/filter
- [API & Authentification](11-api-authentification.md) — `useCocolight`, `initApi`, `entity.coformAnswersSearch`
- [Internationalisation](13-i18n.md) — pattern `useT` + namespaces
