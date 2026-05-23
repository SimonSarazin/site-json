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
├── AmpliSeo.tsx                    # SEO dynamique (react-helmet)
│
├── contexts/
│   ├── AmpliContext.tsx            # Définition du Context React
│   └── AmpliProvider.tsx          # Provider minimal (injecte config)
│
├── hooks/
│   └── useFetchAnswerQuery.ts     # Hook principal : coformAnswersSearch + infinite scroll + extraction
│
├── helpers/
│   └── summary.ts                 # getSummaryData() : aggrégation totalAnswers/Users/Likes/Comments
│
├── utils/
│   └── cardFilters.ts             # collectAvailableTags(), filterCards() — purs, testés
│
├── components/
│   ├── AmpliUserCard.tsx          # Card d'un contributeur (avatar + compteur)
│   └── sections/
│       ├── AmpliHeader.tsx        # Section hero de la page Ampli (tab home)
│       ├── AmpliIntro.tsx         # Section introduction (tab home)
│       ├── AmpliFeatures.tsx      # Section features + statistiques live (tab home)
│       ├── AmpliMessages.tsx      # Section messages/contributions (tab home)
│       ├── AmpliCommunity.tsx     # Tab community : liste des contributeurs + vue carte
│       ├── MeeteemSection.tsx     # Section JSON publique (type "meeteem")
│       └── parts/
│           ├── MeeteemCard.tsx           # Carte d'une réponse (variant large/compact)
│           ├── MeeteemFilters.tsx        # Accordéon de filtres par tags
│           ├── MeeteemViewToggle.tsx     # Toggle 3 vues (Annuaire/Carte/Split)
│           └── MeeteemMapPlaceholder.tsx # Placeholder vue Carte (map non encore implémentée)
│
├── constants/
│   └── queryKeys.ts               # AMPLI_QUERY_KEYS (si définis)
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
    features: z.object({ ... }).optional(),  // AmpliFeatures
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

Le loader (`ampliLoader`) extrait `slug` et `activeTab` depuis les paramètres d'URL. Le composant `AmpliPage` récupère ensuite la configuration correspondante via `siteConfig.ampli?.find(a => a.slug === slug)`.

Si le slug est introuvable, `<AmpliNotFound>` est rendu (avec le slug dans le message d'erreur).

---

## Rendu et sections

### AmpliPage

`src/modules/ampli/pages/AmpliPage.tsx` — point d'entrée de la route. Rôles :

1. Lit `slug` et `activeTab` depuis `useLoaderData()` + `useLocation()`
2. Cherche la config dans `siteConfig.ampli`
3. Rend `<AmpliSeo>`, `<SiteHeader>`, `<SiteFooter>`
4. Enveloppe dans `<AmpliProvider config={ampliConfig}>` pour injecter le contexte
5. Délègue le contenu à `<AmpliRenderer activeTab={activeTab} />`

### AmpliRenderer

`src/modules/ampli/AmpliRenderer.tsx` — applique la classe CSS du layout (selon `config.layout`) et enveloppe `<AmpliSectionRenderer>` dans un `<Suspense>` avec spinner de fallback.

### AmpliSectionRenderer — tabs et sections

`src/modules/ampli/AmpliSectionRenderer.tsx` — dispatch central entre tabs :

| Tab actif | Rendu |
|-----------|-------|
| `home` | `<AmpliHeader>` + `<AmpliIntro>` + `<AmpliFeatures>` + `<AmpliMessages>` |
| `community` | `<AmpliCommunity>` (liste des contributeurs) |
| `stats` | Placeholder "coming soon" |
| `news` | Placeholder "coming soon" |

`AmpliHeader`, `AmpliIntro`, `AmpliFeatures`, `AmpliMessages` sont chargés en **lazy** via `lazy()` de `vite-preload` (code-splitting automatique).

Le hook `useFetchAnswerQuery` est appelé **une seule fois** dans `AmpliSectionRenderer` et ses résultats passés aux sous-composants qui en ont besoin (`AmpliFeatures`, `AmpliMessages`, `AmpliCommunity`).

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
- `answers` : grille de `MeeteemCard` (variant large), avec infinite scroll (référence `lastItemRef`)
- `map` : `MeeteemMapPlaceholder` (carte non encore implémentée)
- `split` : colonne gauche (cartes compact) + colonne droite (placeholder carte)

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
  queryKeyPrefix,  // Préfixe pour la queryKey (évite les conflits entre instances)
  coformId,        // ID du CoForm
  view,            // "answers" | "map" | "split" — détermine indexStepList vs indexStepMap
  baseParams?: {
    fediverse?: boolean;
    indexStepList?: number;    // Nombre d'items par page en vue "answers" (défaut: 30)
    indexStepMap?: number;     // Nombre d'items en vue "map" (défaut: 0 = pas de limite)
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
| `isFetchingNextPage` | `boolean` | Page suivante en cours de chargement |
| `lastItemRef` | `Ref` | Ref à attacher au dernier élément pour déclencher le chargement suivant |
| `totalCount` | `number \| undefined` | Total backend si disponible |
| `data` | Raw RQ data | Données brutes (rarement nécessaire) |
| `error` | `Error \| null` | Erreur éventuelle |
| `refetch` | `fn` | Forcer un rechargement |

**Extraction** : quand `extractionConfig` est fourni, chaque réponse est transformée en `{ answer, data: {…champs extraits}, user?: {name, initial, exists} }`. C'est ce format que les composants `MeeteemCard` et `AmpliFeatures` consomment.

---

## Helper `getSummaryData`

`src/modules/ampli/helpers/summary.ts` — fonction pure qui agrège les statistiques globales d'une liste de réponses :

```ts
function getSummaryData(data: AmpliDataResponse[]): {
  totalAnswers: number;    // Nombre total de réponses
  totalUsers: number;      // Nombre d'utilisateurs distincts
  totalLikes: number;      // Réponses ayant au moins 1 "like"
  totalComments: number;   // Réponses ayant au moins 1 commentaire
  users: UserWithContributions[];  // Liste dédupliquée avec compteur par user
}
```

Utilisé par `AmpliFeatures` (affichage des statistiques dans la carte summary) et `AmpliCommunity` (liste des contributeurs).

---

## Utilitaires client-side (`cardFilters.ts`)

`src/modules/ampli/utils/cardFilters.ts` — deux fonctions pures extraites de `MeeteemSection` pour faciliter les tests :

```ts
// Collecte tous les tags uniques présents dans les cartes
function collectAvailableTags(cards: MeeteemCard[]): string[]

// Filtre les cartes selon les tags actifs ET le filtre utilisateur
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
- `headline`, `subhead` : textes (LocalizedString avec fallback i18n)
- `icon.show`, `icon.name`, `icon.size`, `icon.backdrop` : icône configurable
- `backgroundImage`, `videoBg` : fond optionnel
- `listContent.items[]` + `listContent.layout` : liste de points clés (layout `rows`/`columns`)

### AmpliIntro

`components/sections/AmpliIntro.tsx` — Section introduction avec une grille d'items iconiques. Accepte les props de `config.props.intro` :
- `headline`, `subhead`
- `items[]` : tableau de `{ title, text, icon }`

### AmpliFeatures

`components/sections/AmpliFeatures.tsx` — Section bicolonne :
- Colonne gauche : zone formulaire (placeholder pour intégration future CoForm)
- Colonne droite : carte "Comment ça marche" (3 étapes) + carte "Statistiques live" (totalAnswers, totalUsers, totalLikes, totalComments)

Les statistiques sont calculées en direct depuis `transformedResults` via `getSummaryData()`. Retourne `null` pendant le chargement (`isLoading: true`).

### AmpliMessages

`components/sections/AmpliMessages.tsx` — Section affichant les contributions récentes. Utilise les props de `config.props.message` pour les textes.

### AmpliCommunity

`components/sections/AmpliCommunity.tsx` — Tab "community". Affiche :
- Toggle vue liste / vue carte
- Grille de `AmpliUserCard` (un par contributeur unique, avec compteur de contributions)
- `MeeteemMapPlaceholder` en vue carte

Données : aggrégées via `getSummaryData(data).users`.

### MeeteemSection

`components/sections/MeeteemSection.tsx` — Section JSON publique de type `"meeteem"`. Voir [Section `meeteem`](#section-meeteem-section-json-publique).

**Animations** : en vue `answers`, les cartes utilisent une keyframe CSS inline `cardSlideIn` (fade-in + slide depuis le bas + léger scale) avec délai progressif (`animationDelay={index * 50}ms`).

### Sous-composants Meeteem

| Composant | Rôle |
|-----------|------|
| `MeeteemCard` | Carte d'une réponse CoForm. Props : `card: MeeteemCard`, `activeFilters`, `onToggleFilter`, `onSelectUser`, `variant: "large" \| "compact"`, `animationDelay?`. Affiche nom, description, tags (cliquables), avatar utilisateur (cliquable → filtre). |
| `MeeteemFilters` | Accordéon de filtres par tags. Props : `availableTags`, `activeFilters`, `onToggleFilter`. Réduit automatiquement si aucun tag disponible. |
| `MeeteemViewToggle` | Boutons toggle 3 vues (Annuaire/Carte/Split). Props : `value: MeeteemViewMode`, `onChange`. |
| `MeeteemMapPlaceholder` | Placeholder "Carte en cours d'implémentation". Props : `variant: "large" \| "compact"`. |

**Filtre utilisateur** : cliquer sur l'avatar d'un `MeeteemCard` active le `userFilter` (nom de l'utilisateur). Un badge apparaît dans le header de `MeeteemSection` pour le visualiser et le supprimer. Le filtre combine logiquement les tags actifs ET le filtre utilisateur (ET booléen).

---

## Types canoniques (`types.ts`)

```ts
// Modes d'affichage MeeteemSection
type MeeteemViewMode = "answers" | "map" | "split";

// Une réponse CoForm transformée par useFetchAnswerQuery (extractionConfig)
interface MeeteemCard {
  answer: { serverData: { id?, created?, vote?, comments?, ... } };
  data: MeeteemCardData;  // { name?, description?, tags?, ...champs extraits }
  user?: MeeteemUserInfo; // { name, initial, exists }
}

// Agrégation par useFetchAnswerQuery (helpers/summary.ts)
interface AmpliSummaryData {
  totalAnswers: number;
  totalUsers: number;
  totalLikes: number;
  totalComments: number;
  users: UserWithContributions[];
}
```

---

## i18n

Namespace : **`modules/ampli`**. Enregistré en side-effect par `i18n.ts`.

Groupes de clés dans `fr.json` / `en.json` :
- `AmpliPage.*` — messages de la page (notFoundTitle, notFoundDescription, backHome)
- `AmpliTemplateDefault.comingSoon.*` — message placeholder pour tabs stats/news
- `AmpliHeader.*`, `AmpliIntro.*`, `AmpliFeatures.*` — textes par défaut (overridables via config)
- `AmpliFeatures.summary.*`, `AmpliFeatures.howItWork.*`
- `AmpliCommunity.*`
- `MeeteemSection.viewToggle.*` — labels des boutons de vue (answers/map/split)

---

## Tests unitaires

| Fichier | Ce qui est testé |
|---------|-----------------|
| `helpers/summary.test.ts` | `getSummaryData` — totalAnswers, totalUsers, edge cases (votes/comments à 0) |
| `utils/cardFilters.test.ts` | `collectAvailableTags`, `filterCards` — cas nominal + filtres combinés |
| `components/sections/parts/MeeteemCard.test.tsx` | Rendu de la carte, interaction clic tag/user |
| `components/sections/parts/MeeteemFilters.test.tsx` | Affichage filtres, toggle actif/inactif |
| `components/sections/parts/MeeteemMapPlaceholder.test.tsx` | Rendu placeholder (variants) |
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
            "members": { "fr": "Membres", "en": "Members" }
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

`MeeteemMapPlaceholder` est un placeholder — la vraie intégration Leaflet n'est pas encore faite. En attendant, les modes `map` et `split` affichent ce placeholder.

### 3. `useFetchAnswerQuery` requiert un `entity` initialisé

Le hook est `enabled: !!entity`. Tant que le `CocolightProvider` n'a pas initialisé l'API (`initApi`), aucun chargement n'est déclenché. Sur SSR, `entity` est disponible côté serveur via `initApi()`.

### 4. Extraction de données via `path.*`

Le mapping `config.props.path.*` doit correspondre exactement aux noms des champs dans `answers.*` du CoForm. Une erreur de typo résulte en champs `undefined` dans les cartes. Aucune validation runtime n'est faite sur ces chemins.

### 5. Déduplication des answers par `queryKeyPrefix`

`useFetchAnswerQuery` est utilisé deux fois sur la même page (AmpliSectionRenderer + potentiellement MeeteemSection). Le préfixe `queryKeyPrefix` doit être différent pour éviter que les deux instances partagent le même cache React Query et s'interfèrent.

---

## Voir aussi

- [Architecture](03-architecture.md) — système de modules, lazy loading avec vite-preload
- [Module CoForm](21-module-coform.md) — le moteur des réponses CoForm consommées par Ampli
- [Module Search](07-module-search.md) — patterns similaires de search/filter
- [API & Authentification](11-api-authentification.md) — `useCocolight`, `initApi`, `entity.coformAnswersSearch`
- [Internationalisation](13-i18n.md) — pattern `useT` + namespaces
