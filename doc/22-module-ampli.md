[← Retour à l'index](README.md)

# Module Ampli

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Activation et source des amplis (`costum.ampli`)](#activation-et-source-des-amplis-costumampli)
- [Routes](#routes)
- [Page liste `/ampli`](#page-liste-ampli)
  - [Créer et supprimer un ampli](#créer-et-supprimer-un-ampli)
- [Rendu et sections](#rendu-et-sections)
  - [AmpliPage](#amplipage)
  - [AmpliRenderer](#amplirenderer)
  - [AmpliSectionRenderer — tabs et sections](#amplisectionrenderer--tabs-et-sections)
  - [Section `meeteem` (section JSON publique)](#section-meeteem-section-json-publique)
- [Barre d'onglets (`AmpliTabs`)](#barre-donglets-amplitabs)
- [Contexte `AmpliProvider`](#contexte-ampliprovider)
- [Hook `useFetchAnswerQuery`](#hook-usefetchanswerquery)
- [Réactions Meeteem (`useMeeteemReactions`)](#réactions-meeteem-usemeeteemreactions)
- [Carte des contributeurs (tab community)](#carte-des-contributeurs-tab-community)
- [Helper `getSummaryData`](#helper-getsummarydata)
- [Utilitaires client-side (`cardFilters.ts`)](#utilitaires-client-side-cardfiltersts)
- [Composants de sections](#composants-de-sections)
  - [AmpliHeader](#ampliheader)
  - [AmpliIntro](#ampliintro)
  - [AmpliFeatures](#amplifeatures)
  - [AmpliIdeaForm — le formulaire en ligne](#amplideaform--le-formulaire-en-ligne)
  - [AmpliMessages](#amplimessages)
  - [AmpliCommunity](#amplicommunity)
  - [AmpliDashboard](#amplidashboard)
  - [MeeteemSection](#meeteemsection)
  - [MeeteemCard, MeeteemFilters, MeeteemViewToggle, MeeteemMap](#sous-composants-meeteem)
  - [Modifier sa propre réponse](#modifier-sa-propre-réponse)
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

**Particularité centrale** : contrairement aux modules profil/search, Ampli repose entièrement sur des **réponses CoForm** (via `entity.coformAnswersSearch()`) et non sur des entités directes. Les données affichées sont extraites via un mapping de chemins (`path.*`).

**Les amplis sont déclarés dans Co, pas dans la config du site** : `costum.ampli.<slug>` du porteur est la source de vérité, la config ne fait que les activer (`"ampli": true`). Cf. [Activation et source des amplis](#activation-et-source-des-amplis-costumampli).

---

## Architecture interne

```
src/modules/ampli/
├── module.config.ts                # name: "ampli", type: "core", enabled: true
├── index.ts                        # API publique
├── schema.ts                       # CostumAmpliEntrySchema (costum.ampli) + AmpliPathSchema
├── types.ts                        # Types canoniques : AmpliModel, ConfiguredAmpli, MeeteemCard, AmpliSummaryData, …
├── routes.tsx                      # /ampli (liste) + /ampli/:slug et ses onglets — gatés sur config.ampli
│
├── AmpliRenderer.tsx               # Wrapper Suspense + dispatch vers AmpliSectionRenderer
├── AmpliSectionRenderer.tsx        # Switch entre tabs (home, community, stats, news)
├── AmpliSeo.tsx                    # SEO dynamique (@dr.pogodin/react-helmet)
│
├── contexts/
│   ├── AmpliContext.tsx            # Définition du Context React
│   └── AmpliProvider.tsx          # Provider minimal (injecte l'ampli configuré)
│
├── lib/
│   ├── costumAmpli.ts             # Lecture de costum.ampli / forme historique → AmpliModel, filtres de la liste (purs, testés)
│   └── answersQuery.ts            # Filtres et champs des réponses — PARTAGÉS par la page et les compteurs de la liste
│
├── hooks/
│   ├── useAmplis.ts               # useAmplis() / useAmpli(slug) — lecture de costum.ampli
│   ├── useAmpliAdmin.ts           # Gate admin + création/suppression d'un ampli (SDK : createAmpli / removeAmpli)
│   ├── useAmpliAnswerCounts.ts    # « N propositions » de chaque carte de /ampli
│   ├── useAmpliContext.tsx         # useAmpliContext() — throw si hors Provider
│   ├── useFetchAnswerQuery.ts     # Hook principal : coformAnswersSearch + infinite scroll + extraction
│   ├── useAmpliAllAnswers.ts      # Périmètre COMPLET page par page (vues carte/split de Meeteem)
│   ├── useContributorCities.ts    # Communes → coordonnées (contributeurs sans geo)
│   └── useMeeteemReactions.ts     # Réactions des réponses : ajout ET retrait (bascule serveur)
│
├── helpers/
│   └── summary.ts                 # getSummaryData() : aggrégation totalAnswers/Users/Likes/Comments
│                                  # (définit AmpliDataResponse et UserWithContributions localement —
│                                  #  dupliqué indépendamment dans types.ts, dette technique potentielle)
│
├── utils/
│   ├── cardFilters.ts             # collectAvailableTags(), filterCards() — purs, testés
│   ├── meeteemGeo.ts              # Réponses CoForm → entités carto (purs, testés)
│   ├── ampliUsersGeo.ts           # Contributeurs → entités carto (purs, testés)
│   └── scrollToSection.ts         # Défilement + focus vers une section (CTA du hero)
│
├── components/
│   ├── AmpliUserCard.tsx          # Card d'un contributeur (avatar + compteur)
│   ├── AmpliCreateDialog.tsx      # Création d'un ampli depuis /ampli (admins du costum)
│   ├── AmpliDeleteButton.tsx      # Suppression d'un ampli depuis sa carte (confirmation)
│   └── sections/
│       ├── AmpliHeader.tsx        # Section hero de la page Ampli (tab home)
│       ├── AmpliIntro.tsx         # Section introduction (tab home) — délègue à <CardsSection>
│       ├── AmpliFeatures.tsx      # Section bicolonne : formulaire de proposition + stats live (tab home)
│       ├── AmpliMessages.tsx      # Section messages (tab home) — wrapper fin autour de MeeteemSection
│       ├── AmpliCommunity.tsx     # Tab community : liste des contributeurs + vue carte (toggle inline)
│       ├── AmpliDashboard.tsx     # Tab stats : KPI, tops likes/commentaires, graphe des tags
│       ├── MeeteemSection.tsx     # Section JSON publique (type "meeteem")
│       └── parts/
│           ├── MeeteemCard.tsx           # Carte d'une réponse (variant large/compact)
│           ├── MeeteemFilters.tsx        # Accordéon de filtres par tags (expanded par défaut)
│           ├── MeeteemViewToggle.tsx     # Toggle 3 vues (Annuaire/Carte/Split)
│           ├── MeeteemMap.tsx            # Carte MapLibre partagée (réponses ET contributeurs)
│           ├── MeeteemAnswerModal.tsx    # Détail d'une réponse en lecture seule
│           ├── AmpliContributorsMap.tsx  # Carte des contributeurs du tab community
│           ├── AmpliIdeaForm.tsx         # Formulaire de proposition EN LIGNE (colonne gauche d'AmpliFeatures)
│           └── AmpliJoinButton.tsx       # CTA « Rejoindre » du hero → demande d'adhésion réelle
│
├── constants/
│   ├── queryKeys.ts               # AMPLI_QUERY_KEYS — FETCH_ANSWERS(+_PREFIX), ANSWERS_COUNT, CITY_GEO
│   │                              # (préfixe figé "ampli-meeteem", utilisé par useFetchAnswerQuery)
│   ├── sectionIds.ts              # AMPLI_SECTION_IDS — ancres DOM visées par les CTA du hero
│   └── tabs.ts                    # AMPLI_TABS + ampliTabPath
│
├── pages/
│   ├── AmpliListPage.tsx          # /ampli — liste des amplis du costum (mode `ampli: true`)
│   └── AmpliPage.tsx              # /ampli/:slug — page d'un ampli (RR v7 route handler)
│
└── i18n/
    ├── fr.json
    └── en.json
```

---

## Activation et source des amplis (`costum.ampli`)

### Côté config du site : un interrupteur

```json
{ "ampli": true }
```

La config n'**active** que la fonctionnalité. Trois valeurs, lues **brutes** (la config n'est jamais parsée par Zod au runtime — `ampliSourceMode` dans `lib/costumAmpli.ts`) :

| `config.ampli` | Source des amplis | Routes montées |
|---|---|---|
| `true` | `costum.ampli` du porteur du site | `/ampli` (liste) + `/ampli/:slug` |
| absent / `false` / autre | aucun | aucune (catch-all du site) |

`true` STRICT : la config n'étant jamais parsée par Zod au runtime, `"true"` en chaîne — ou un reste de la forme tableau historique — n'active rien.

### Côté Co : `costum.ampli.<slug>`

Les amplis vivent dans le costum du porteur, là où l'outil legacy de Co les écrit. `element/about` — l'appel de `entity.get()` pour l'entité porteuse — renvoie le champ tel quel : il est **déjà** dans `useCocolight().entity.serverData.costum`, au SSR comme au client, **aucune requête** n'est ajoutée.

```json
"ampli": {
  "sinistre": {
    "slug": "sinistre",
    "name": "Sinistre",
    "description": "Sinistre config",
    "tags": ["Sinistre", "Ampli", "Francki"],
    "coform": "6927e9f0db22da724360303c",
    "path": {
      "name": "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7khz08pr",
      "description": "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7k7nhhzl",
      "address": "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7kk0of9s",
      "tags": "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7kmkg9ow",
      "image": "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7k23mgbw"
    },
    "pages": ["#sinistre-welcome", "…"],
    "home": "#sinistre-welcome"
  }
}
```

Lecture par `CostumAmpliEntrySchema` (`safeParse`, donnée backend) puis `listCostumAmplis` → `AmpliModel` :

| Champ | Rôle | Si absent ou invalide |
|---|---|---|
| `slug` | segment d'URL (`/ampli/<slug>`) — **fait foi** | la clé de l'entrée |
| `name` | titre du hero, carte de la liste, titre SEO | titre générique (`AmpliHero.headline`) ; la liste montre le slug |
| `description`, `tags` | carte de la liste, recherche, puces de filtre | ignorés (des tags sérialisés en objet PHP à trous sont acceptés) |
| **`coform`** | formulaire des propositions (ObjectId) | ampli **listé** mais « non configuré » : sa page le dit, aucune section n'est rendue |
| `path.name` + `path.address` | mapping des réponses (requis) | entrée **ignorée** (avertissement en DEV) |
| `pages`, `home` | hashes des pages legacy | non lus : les onglets sont ceux de `constants/tabs.ts` |

⚠ **`coform` n'est pas écrit par l'outil legacy de Co** : il ne connaît le formulaire qu'à travers les blocs CMS des pages de l'ampli (`costum.app[<page>].cms…` → `tpls.blockCms.coform.*`). Choix délibéré : **aucun repli** sur ces blocs — le champ est posé dans la config de l'ampli en base. Un ampli créé par l'outil legacy reste « non configuré » tant qu'on ne l'a pas ajouté. Un ampli créé **depuis `/ampli`**, lui, a toujours son `coform` : le serveur fabrique le formulaire et l'écrit dans l'entrée (cf. [Créer et supprimer un ampli](#créer-et-supprimer-un-ampli)).

Doublon de slug : la première entrée gagne (avertissement en DEV).

### Ce qui a disparu de la config

La forme tableau (`ampli: [{ slug, layout?, props: { coform, path } }]`), qui recopiait à la main dans le fichier de site ce que Co détient déjà, a été retirée : une config restée dessus n'active plus aucun ampli. Les anciennes surcharges de textes (`hero`, `intro`, `features`, `message`, `community`, `dashboard`, `news`, `seo`) avaient disparu avec elle — aucune config ne les employait, les sections n'ont plus que leurs libellés i18n.

**Migrer un site resté sur l'ancienne forme** : déclarer ses amplis dans `costum.ampli` (avec `slug`, `coform` et `path`), PUIS passer la config à `"ampli": true`. Dans l'autre ordre, l'annuaire est vide et `/ampli/<slug>` répond « ampli introuvable ».

**Section JSON publique `meeteem`** : en plus de la page `/ampli/:slug`, le module expose une section de type `"meeteem"` utilisable dans n'importe quelle page JSON — elle porte ses propres `coform`/`path`, indépendamment de `config.ampli`. Voir [`MeeteemSectionProps`](#section-meeteem-section-json-publique).

---

## Routes

```
/ampli                 → AmpliListPage — liste des amplis (seulement avec "ampli": true)
/ampli/:slug           → AmpliPage (index) — tab "home"
/ampli/:slug/community → AmpliPage — tab "community"
/ampli/:slug/stats     → AmpliPage — tab "stats" (Vision Globale)
/ampli/:slug/news      → AmpliPage — tab "news" (coming soon)
```

**Gate sur `config.ampli`** (même patron que `aac/routes.tsx`) : le module est `core`, donc découvert sur TOUS les sites. Sans gate, `/ampli/:slug` était servi partout avec une page « ampli introuvable » ; désormais, sans `config.ampli`, la factory rend `[]` et l'URL tombe sur le catch-all du site. `/ampli` et `/ampli/:slug` sont montées ensemble : il n'existe plus de mode qui n'offrirait que la page d'un ampli.

Le loader (`ampliLoader`) extrait `slug` depuis les paramètres d'URL et dérive `activeTab` depuis les segments du pathname (`pathSegments[2]` si présent, sinon `'home'`). Le composant `AmpliPage` combine `loaderData.activeTab` (SSR) avec un fallback `useLocation()` pour la navigation client-side.

Les sous-routes (`community`, `stats`, `news`) ont toutes `element: null` — le rendu est entièrement géré par `AmpliSectionRenderer` via le switch sur `activeTab`.

---

## Page liste `/ampli`

`pages/AmpliListPage.tsx` — tous les amplis de `costum.ampli`, en **deux colonnes** (maquette de référence) : la liste filtrable à gauche, le panneau de marque et l'accès direct à droite. Sur mobile, une colonne : panneau d'abord (il porte le `<h1>`), liste ensuite. Couleurs en tokens de thème uniquement.

| Zone | Contenu |
|---|---|
| Recherche | filtre client sur le titre affiché (nom, sinon slug) et la description — casse et accents neutralisés (`filterAmplis`) |
| Puces de tags | union des `tags` (`collectAmpliTags`), sélection multiple en **OU** (même sémantique que `MeeteemFilters`), `aria-pressed` |
| Carte | tuile à l'initiale (les entrées n'ont pas d'image), nom en lien étiré vers `/ampli/:slug` (toute la carte est cliquable, mais le nom accessible du lien reste le titre), description sur une ligne, « N propositions », 3 tags puis « +N » |
| Panneau de marque | tuile mégaphone + `AmpliHero.headline` / `AmpliHero.subhead` |
| Accès direct | saisie d'un slug (espaces et casse tolérés, `resolveAmpliInput`) → navigation ; slug inconnu → **erreur en ligne** (`role="alert"`), la liste étant déjà en mémoire |

- **Compteurs** (`useAmpliAnswerCounts`) : une requête par ampli, `indexStep: 1` (le backend compte tout, ne renvoie qu'une réponse). Les filtres viennent de `ampliAnswerFilters` — la **même** fonction qu'`AmpliSectionRenderer` —, donc le chiffre de la carte est celui du compteur « Idées soumises » de la page. Le SDK retire `spam` du `count` et en fait la somme dans `total`. Clé `AMPLI_QUERY_KEYS.ANSWERS_COUNT`, sous le préfixe `FETCH_ANSWERS_PREFIX` : l'invalidation posée par `AmpliIdeaForm` après une soumission rafraîchit aussi la carte. Non préchargés au SSR ; squelette tant que le chiffre n'est pas connu (serveur et 1er rendu client identiques), rien pour un ampli sans formulaire ou en erreur.
- **Créer / supprimer** : réservé aux admins du costum, cf. ci-dessous.
- États : aucun ampli → message explicite (ni recherche ni puces) ; filtres sans résultat → message + « Effacer les filtres ».

### Créer et supprimer un ampli

Deux actions legacy du module costum, exposées par le SDK sur l'élément porteur —
`BaseEntity.createAmpli()` / `BaseEntity.removeAmpli()` (`POST /costum/costumize/{createampli,removeampli}`,
Bearer + gate serveur `isInterfaceAdmin`). Elles écrivent dans `costum.ampli` **sans passer par l'interface Co**.

| | Création | Suppression |
|---|---|---|
| Déclencheur | bouton « Créer un ampli » du panneau de droite (`AmpliCreateDialog`) | icône corbeille sur la carte (`AmpliDeleteButton`), avec confirmation |
| Envoi | `name`, `description`, `tags` | le **slug** (la clé de l'entrée), pas un ObjectId |
| Effet serveur | entrée `costum.ampli.<slug>` **et** le formulaire de dépôt avec ses 5 questions (titre, description, adresse, mots-clés, image) — l'ampli est utilisable tout de suite | retire l'entrée, ses pages CMS et son bouton de menu |
| Retour | `slug` + l'entrée complète → redirection vers `/ampli/<slug>` | — |

**Le gate d'affichage** (`useCanManageAmplis`) : `siteAdmin` au sens du back-office — admin du porteur ou
super-admin de la plateforme (`resolveAdminAccessLevel`) —, amplis **activés** seulement, et jamais avant l'hydratation (`me` et les
liens de l'entité sont vides au SSR). Le serveur revérifie le droit : ce gate n'est qu'un confort d'affichage.

**Collision de slug — garde CLIENT obligatoire.** Le serveur dérive la clé du `name` et **écrase sans
prévenir** une entrée de même clé ; aucune garde n'existe côté legacy. Le dialogue calcule donc le slug à la
saisie avec `ampliSlug` (SDK, miroir exact du calcul serveur), l'affiche, et bloque l'envoi quand il est déjà
pris — la liste est déjà en mémoire, la vérification ne coûte rien.

**Rafraîchissement.** `costum` arrive AVEC l'entité porteuse (`element/about`), et cette entité est du *state*
dans `CocolightProvider` : aucune invalidation React Query ne la remettrait à jour. Les deux mutations
appellent donc `refreshEntity()` (nouveau, sur le contexte Cocolight) juste après l'écriture — il résout à
nouveau l'entité par son slug et en pose une **nouvelle instance**, là où `entity.get()` mettrait `serverData`
à jour en place, sans rendu. Le serveur ayant déjà réinitialisé son cache costum, la relecture voit l'écriture.
C'est aussi ce qui garantit que la page vers laquelle on redirige trouve le nouvel ampli.

**Ce que la suppression NE supprime PAS** : le formulaire de dépôt et les propositions déjà déposées
survivent (le legacy ne les touche pas). Le dialogue de confirmation le dit. Autre effet de bord legacy,
documenté côté SDK : la suppression réécrit `costum.app` et le `buttonList` du menu à partir du costum
résolu en cache.

---

## Rendu et sections

### AmpliPage

`src/modules/ampli/pages/AmpliPage.tsx` — point d'entrée de la route. Rôles :

1. Lit `slug` et `activeTab` depuis `useLoaderData()` + fallback `useLocation()`
2. Résout l'ampli avec `useAmpli(slug)` (costum ou forme historique, selon `config.ampli`)
3. Slug absent ou inconnu → `<AmpliNotFound>` ; en mode `costum`, il propose aussi « Voir tous les amplis » (`/ampli` n'existe pas en forme historique : pas de lien mort)
4. Rend `<AmpliSeo name={ampli.name} …/>`, `<SiteHeader />`, `<AmpliTabs />`, `<SiteFooter />` — toujours en pleine largeur
5. Ampli **sans formulaire** (`coform: null`) → état « Ampli en préparation » dans le cadre de la page, onglets compris ; les sections ne sont PAS rendues (elles interrogeraient le backend avec un id vide)
6. Sinon `<AmpliProvider ampli={ampli}>` (type `ConfiguredAmpli` : `coform` garanti) → `<AmpliRenderer activeTab={activeTab} />`

### AmpliRenderer

`src/modules/ampli/AmpliRenderer.tsx` — lit l'ampli du contexte et enveloppe `<AmpliSectionRenderer ampli={ampli} activeTab={activeTab}>` dans un `<Suspense>` avec un spinner de fallback (`<Spinner label={t("a11y.loading")}>`).

### AmpliSectionRenderer — tabs et sections

`src/modules/ampli/AmpliSectionRenderer.tsx` — dispatch central entre tabs :

| Tab actif | Rendu |
|-----------|-------|
| `home` | `<AmpliHeader>` + `<AmpliIntro>` + `<AmpliFeatures>` + `<AmpliMessages>` |
| `community` | `<AmpliCommunity>` (liste des contributeurs) |
| `stats` | `<AmpliDashboard>` (compteurs, tops, répartition des tags) |
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
- `map` : `MeeteemMap` (carte MapLibre du module search, alimentée par `meeteemGeo`)
- `split` : colonne gauche scrollable (cartes compact) + colonne droite (`MeeteemMap` synchronisée)

Le `lastItemRef` est **uniquement** attaché en vue `answers` — les vues `map` et `split` ne déclenchent pas de pagination supplémentaire.

---

## Barre d'onglets (`AmpliTabs`)

`components/AmpliTabs.tsx` — barre de navigation rendue par `AmpliPage` **entre `SiteHeader` et `<main>`** (hors du conteneur, elle court sur toute la largeur).

Les onglets sont déclarés une seule fois dans `constants/tabs.ts` (`AMPLI_TABS` + `ampliTabPath`) : quatre entrées — `home` (Accueil), `community` (Réseau), `stats` (Statistiques), `news` (Actualités). **Pas d'entrée « Messages »** : les messages sont une section de la page d'accueil, pas une route.

`Link` + `aria-current="page"` plutôt que `NavLink` : l'onglet actif est déjà résolu par le loader SSR d'`AmpliPage`, ce qui garantit un premier rendu client identique au HTML serveur (`NavLink` ferait clignoter le soulignement à l'hydratation).

## Contexte `AmpliProvider`

`src/modules/ampli/contexts/AmpliProvider.tsx` — Provider React minimal qui injecte `ampli: ConfiguredAmpli` (un `AmpliModel` dont le `coform` est garanti) dans `AmpliContext`. Valeur mémoïsée.

```tsx
<AmpliProvider ampli={ampli}>
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

## Réactions Meeteem (`useMeeteemReactions`)

`src/modules/ampli/hooks/useMeeteemReactions.ts` — ajout **et** retrait d'une
réaction (« amplification ») sur une réponse CoForm.

### Une seule action pour les deux sens

Il n'existe **pas** d'appel « supprimer une réaction ». Le backend
(`co2/action/addaction`, `collection: "answers"`) **bascule** :

| Situation | Effet | Réponse |
|-----------|-------|---------|
| Statut pas encore posé | ajout | `inc: 1`, `msg: "Reaction succesfully saved"` |
| **Même** statut re-posté | **retrait** | `inc: -1`, `msg: ""`, `removedVoteStatus: "<statut>"` |
| Statut différent | remplacement | `inc: 1` |

C'est `removedVoteStatus` — et non `msg`, vide au retrait — qui dit sans
ambiguïté dans quel sens la bascule est partie. Côté SDK, la méthode est
`Answer.addVote(status)` (et `Answer.getVotes()` pour relire), transposées de
`News`/`Comment` ; `AnswerVoteResult` type le retour.

Le statut posé est `MEETEEM_REACTION_STATUS = "like"` : tout l'ampli compte les
`like` (`getSummaryData` → « Idées amplifiées »), en poster un autre rendrait le
cœur incohérent avec le compteur du bandeau.

### État optimiste, sans patch du cache

Le hook mémorise **uniquement la bascule de l'utilisateur courant**
(`answerId → { reacted, pending }`) ; le compte, lui, reste dérivé des données
serveur :

```ts
count = compteServeur - (jAvaisRéagiCôtéServeur ? 1 : 0) + (jeRéagis ? 1 : 0)
```

Deux raisons de ne PAS repatcher le cache React Query à la `useAddVoteNews` :

- les vues carte/split gardent jusqu'à 5000 réponses, et le `useMemo` qui les
  transforme en entités dépend de l'objet `data` entier — le repatcher ferait
  retransformer tout le périmètre à chaque clic sur un cœur ;
- ancrer le compte sur le serveur laisse arriver les réactions des **autres** et
  rend un refetch inoffensif (pas de double comptage de la nôtre).

`onSuccess` réaligne l'état sur la réponse du serveur, qui fait autorité : notre
prévision peut être fausse (réaction posée depuis un autre onglet, cache chargé
avant la connexion). `onError` **retire** la bascule au lieu de l'inverser —
l'affichage repart des données serveur — et lève un toast (`toast.reactionError`).

### Connexion et SSR

- Utilisateur non connecté → `openLogin()` (modale globale d'`AuthModalProvider`),
  **aucun appel réseau**.
- `me` n'est lu qu'après `useHydrated()` : au SSR il vaut toujours `null`, le lire
  avant l'hydratation ferait diverger le 1er rendu client du HTML serveur
  (cœur plein contre cœur vide).

Le hook est monté **une fois dans `MeeteemSection`**, pas dans la carte : les
vues Annuaire et Split partagent ainsi la même bascule optimiste et la même
mutation.

---

## Carte des contributeurs (tab community)

`components/sections/parts/AmpliContributorsMap.tsx` + `utils/ampliUsersGeo.ts` —
la vue Carte du tab community place les **contributeurs**, pas leurs réponses.

### Pourquoi pas `meeteemGeo`

La différence est de NATURE : `meeteemGeo` géolocalise une RÉPONSE via l'adresse
saisie dans le formulaire (`card.data.address`). Le réutiliser ici donnerait
plusieurs marqueurs pour un même contributeur (un par réponse) et aucun pour
ceux dont la réponse n'a pas d'adresse alors qu'eux en ont une.

### Coordonnées : le profil d'abord, la commune ensuite

`coformAnswersSearch` projette déjà l'auteur avec `geo` / `geoPosition` /
`address` **à la racine** de son `serverData` — exactement la forme que lit
`getEntryCoords`. La carte convertit donc ce que la page a déjà chargé.

Mais beaucoup de profils Communecter portent une adresse **sans aucun
géocodage** (`addressLocality` + `localityId`, pas de `geo` — vérifié sur le
document complet, ce n'est pas un artefact de projection). Les écarter donnerait
moins de points sur la carte que de fiches dans l'annuaire, ce qui se lit comme
un bug. `useContributorCities` les résout donc au **centre de leur commune** :

- `collectMissingCities` liste les communes manquantes, **dédupliquées par
  `localityId`** — une requête par ville, pas par contributeur ;
- chacune passe par `cityAutocompleteByCountry` (le même endpoint que
  `AddressEditor`), avec sa propre entrée de cache et un `staleTime` de 24 h ;
- la correspondance se fait sur l'**ID**, jamais sur le nom : l'autocomplétion
  est floue et peut rendre des homonymes.

⚠ La position obtenue est le CENTRE de la commune : deux contributeurs d'une
même ville se superposent exactement (le clustering les regroupe). Compromis
assumé — mieux vaut une position approchée qu'une absence inexpliquée.

`isResolving` entre dans `isComplete` : sans lui, la carte annoncerait « aucun
contributeur localisé » le temps que les communes reviennent.

Elle consomme la prop `data` du renderer et **ne remonte pas de hook** : la
queryKey inclut `JSON.stringify(baseParams)`, et `indexStepMap` y diffère (0 côté
renderer, 500 côté `MeeteemSection`) — un second hook créerait donc une entrée de
cache distincte, donc un second appel réseau.

### Pas de chargement progressif ici

La requête du renderer pose `indexStep: 0`, qui désactive la pagination côté SDK
(une seule requête, `hasNextPage` toujours faux) : le périmètre est complet dès
la première réponse. `MeeteemMap` reçoit donc `total={null}` / `capped={false}`,
et `MapProgress` ne rend rien. **Ne pas y brancher `useAmpliAllAnswers`** : sa
chaîne de pages ne se termine pas quand le `count.total` du backend dépasse le
nombre de documents réellement rendus.

### Gardes encodés dans `ampliUsersGeo`

| Garde | Pourquoi |
|-------|----------|
| id via `serverData.id`, repli `_id._str` / `_id.$id` | `String(_id)` rend `ObjectID("<hex>")`, pas le hex nu — un id inexploitable casse la clé React et la synchro, sans erreur |
| Rejet de `[0, 0]` **pendant** la sélection | `Number("")` vaut 0 et `getEntryCoords` accepte `[0,0]` : un `geoPosition` vide placerait le contributeur au large du Ghana. Rejeter APRÈS la sélection est un bug — le placeholder vide l'emporterait sur un `geo` valide |
| Coercition des coordonnées en string | L'API renvoie indifféremment `"−21.82"` ou `-21.82` |
| `name` vide OMIS (clé absente) | `useItem` fusionne ses défauts par spread : `name: undefined` écrase le repli « Nom inconnu » et rend un titre de popup VIDE |
| Déduplication par id | Deux marqueurs empilés = deux `key` React identiques |
| `located` / `total` | Un contributeur reste non plaçable s'il n'a ni coordonnées ni commune identifiée ; sans compteur, la carte mentirait par omission |

### Rendu

- Avatars ronds via `map={{ marker: { useItemImage: true } }}` — constante de
  MODULE, pas un littéral inline (`SearchMap` mémoïse ses marqueurs sur
  l'identité de cet objet). Cohérent avec la vue liste, qui montre déjà ces
  avatars ; un contributeur sans photo retombe sur la goutte, et une URL **morte**
  sur une silhouette aux couleurs de marque (cf. `MapMarkerAvatar` et
  `.search-map-avatar.is-fallback`). La popup applique le même garde sur son
  image d'en-tête.
- La popup n'a qu'un champ de texte libre (`shortDescription`) : on y met le
  nombre de contributions — sujet même du tab — via un formateur injecté, ce qui
  garde `ampliUsersGeo` pur.
- Sous la carte, « X contributeurs ne sont pas localisés (N sur M affichés) ».

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

**Important** : `AmpliDataResponse` et `UserWithContributions` sont définies localement dans `summary.ts` (`export interface`) sans aucun import depuis `types.ts`. Ces mêmes interfaces sont redéfinies indépendamment dans `types.ts` : il s'agit d'une **duplication de types** entre les deux fichiers, et non d'un ré-export. C'est une dette technique potentielle à unifier si les définitions venaient à diverger.

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

`components/sections/AmpliHeader.tsx` — Héro de la page Ampli. Une seule prop, `name` (`costum.ampli.<slug>.name`) : **c'est le titre du hero** — avec plusieurs amplis par site, un titre générique identique partout ne dirait pas où l'on est. Sans nom (forme de config historique), `AmpliHero.headline` reprend sa place. Sous-titre `AmpliHero.subhead`, icône mégaphone et fond `/images/ampli/background.jpg` fixes.

**Trois boutons CTA fixes** (non configurables), tous actifs :

| Bouton | Clé | Action |
|--------|-----|--------|
| Proposer une idée | `AmpliHero.proposal` | défile vers `AMPLI_SECTION_IDS.FEATURES` **et pose le focus sur le premier champ** du formulaire en ligne |
| Voir les propositions | `AmpliHero.browse` | défile vers `AMPLI_SECTION_IDS.MESSAGES` (l'annuaire Meeteem) |
| Rejoindre la communauté | `AmpliHero.join` | `<AmpliJoinButton>` — demande d'adhésion réelle (cf. ci-dessous) |

« Proposer une idée » mène **au** formulaire de la page, pas à une seconde copie en modale : deux surfaces pour un même formulaire, ce serait deux brouillons et deux états à réconcilier.

Les ancres viennent de `constants/sectionIds.ts`, partagées entre la section qui les **pose** (`AmpliFeatures`, `AmpliMessages`) et le hero qui les **vise** — en littéraux dupliqués, renommer une section casserait le bouton en silence. Les deux sections portent `scroll-mt-24` : les en-têtes de site peuvent être `sticky`, sans marge le titre finirait dessous. `utils/scrollToSection.ts` respecte `prefers-reduced-motion` (le `scroll-behavior: smooth` global d'`index.css`, lui, ne le consulte pas).

#### AmpliJoinButton

`components/sections/parts/AmpliJoinButton.tsx` — envoie une **vraie** demande d'adhésion à l'entité qui porte le site (`useCocolight().entity`, une organisation **ou** un projet), via `useRequestToJoin` du module profil.

- **Organisation vs projet** : une organisation a des *membres* (`canRequestMembership` / `isMember`), un projet des *contributeurs* (`canRequestContributor` / `isContributor`). `requestToJoin` couvre les deux, le bouton lit donc les deux permissions — sinon il resterait inerte sur un site porté par un projet.
- **Anonyme** : le clic ouvre la connexion (`openLogin`) au lieu de laisser partir un appel voué à l'échec. Pas de demande automatique au retour : l'utilisateur reprend la main sur un bouton qui affiche enfin son vrai état.
- **Hydratation** : `me` et les liens de l'entité sont toujours vides au SSR. Le libellé n'est arbitré qu'après `useHydrated()` — avant, le bouton rend l'appel à l'action nu, qui est de toute façon le bon pour un visiteur anonyme.
- **États sans action** : membre/contributeur/admin → « Vous êtes membre » (`AmpliHero.joined`, désactivé) ; demande en attente → « Demande envoyée » (`AmpliHero.joinPending`, désactivé). L'état « en attente » est aussi posé **localement** au succès de la mutation : les liens de l'entité ne se rafraîchissent pas dans la foulée, et l'utilisateur ne doit pas pouvoir redemander.
- Le bundle i18n du module profil est importé explicitement : le toast de la mutation parle avec ses clés (`toast.relationship.*`) alors qu'il est déclenché hors profil.

### AmpliIntro

`components/sections/AmpliIntro.tsx` — Section introduction, sans props : titre et sous-titre `AmpliIntro.*`, 6 cartes fixes.

Le rendu des cartes est **délégué** au composant partagé `<CardsSection>` (layout `grid`, 3 colonnes, variant `default`).

### AmpliFeatures

`components/sections/AmpliFeatures.tsx` — Section bicolonne :
- Colonne gauche : **le formulaire de proposition, rendu en ligne** — `<AmpliIdeaForm>` chargé en `lazy()` (le moteur coform est lourd, il ne doit pas peser sur le chunk de l'onglet home)
- Colonne droite : carte "Comment ça marche" (3 étapes, icône `Lightbulb`) + carte "Statistiques live" (4 compteurs : soumissions, membres, amplifiées `totalLikes`, discussions `totalComments`)

La carte summary utilise `AmpliFeatures.summary.amplified` pour le compteur de likes, et `AmpliFeatures.summary.comments` pour les commentaires.

Les statistiques sont calculées en direct depuis `transformedResults` via `getSummaryData()`. **La section ne retourne plus `null` pendant le chargement** : le formulaire ne dépend pas des réponses, seuls les 4 compteurs passent en squelette — sinon la colonne gauche restait vide le temps du fetch.

`AmpliFeatures.button` (« Soumettre à la communauté ») est le libellé du **bouton d'envoi du formulaire** (passé en `submitButtonText` à `SmartCoForm`). La section reçoit `coform` (l'id du formulaire) depuis `AmpliSectionRenderer`.

### AmpliIdeaForm — le formulaire en ligne

`components/sections/parts/AmpliIdeaForm.tsx` — proposition d'idée **sans modale** : la section décrit déjà le geste attendu ("Proposez votre idée" + "Comment ça marche ?"), le formulaire doit donc être remplissable immédiatement.

Réutilise TELLE QUELLE la chaîne du module coform :

| Brique | Rôle ici |
|--------|----------|
| `useCoFormQuery(formId)` | structure du formulaire **et** droits (`access`) |
| `CoFormAccessGuard` | refus lisibles : non connecté (bouton de connexion → `openLogin`, `onSuccess: refetch`), form fermé/pas encore ouvert, déjà répondu |
| `SmartCoForm` | rendu + soumission (single-step ou wizard selon le nombre de `subForms`) |
| `CoFormThankYou` | accusé de réception, à la place du formulaire |

Ce que le composant ajoute, et **pourquoi** :

- **`hideBanner`** — sans lui, le nom du formulaire s'afficherait en `<h1>` 4xl au milieu de la colonne, en doublon du `<h2>` de la section. Prop ajoutée à `SmartCoForm` (et à `MultiStepCoForm`, qui rendait sa bannière sans condition).
- **`submitButtonText`** — le libellé est celui de l'ampli (`AmpliFeatures.button`, « Soumettre à la communauté »), pas le générique `coform.navigation.submit`.
- **Invalidation du cache ampli** (`AMPLI_QUERY_KEYS.FETCH_ANSWERS_PREFIX`) après soumission : `useCoFormFinalMutation` n'invalide que **ses** caches (`FORM` / `FORM_ANSWERS`). Sans ça, l'idée tout juste soumise n'apparaîtrait ni dans les compteurs à droite ni dans l'annuaire Meeteem plus bas, jusqu'au prochain rechargement de page.
- **`formId` ET `formData` passés à `SmartCoForm`** : `formData` évite une seconde souscription à la structure (même entrée de cache → le garde et le formulaire ne peuvent pas diverger), mais `formId` reste indispensable — la mutation interne de `SmartCoForm` part sinon sur un id vide.
- **Après l'envoi** : une seule réponse autorisée (`access.isOneAnswerPerPers`) → on propose de la **modifier** (le garde est court-circuité par `access={null}`, sinon il refuserait sur `already_answered`) ; sinon → d'en **proposer une autre** (le formulaire est remonté, donc vierge ; le brouillon local a été purgé au succès).

### AmpliMessages

`components/sections/AmpliMessages.tsx` — Section affichant les contributions récentes. Accepte `path` et `coform`.

**C'est un wrapper fin** autour de `<MeeteemSection>` : rend un en-tête (`AmpliMessage.headline` / `AmpliMessage.subhead`), puis passe `coform` et `path` à `MeeteemSection` qui gère son propre état et chargement.

**Ne gère pas** de données ou d'état propre — toute la logique est dans `MeeteemSection`.

### AmpliCommunity

`components/sections/AmpliCommunity.tsx` — Tab "community". Accepte `data` (résultats bruts de `useFetchAnswerQuery`) et `isLoading` / `isPending` / `isError` ; titres `AmpliCommunity.*`. Affiche :
- Un toggle **deux vues** (liste / carte) : deux `<Button>` inline (pas `MeeteemViewToggle`)
- Vue liste (`viewMode === "list"`) : grille de `AmpliUserCard` (un par contributeur unique, avec compteur de contributions)
- Vue carte (`viewMode === "map"`) : `AmpliContributorsMap`, chargé en `lazy()` — cf. [Carte des contributeurs](#carte-des-contributeurs-tab-community)

Données : agrégées via `getSummaryData(data).users`, mémoïsées (`data` est un tableau recréé à chaque rendu par le renderer).

**`isLoading` ET `isPending`** : `isLoading` seul ne suffit pas — tant que `entity` n'est pas initialisée la query est désactivée, donc `isPending` est vrai alors qu'`isLoading` est faux. Sans les deux, la carte annoncerait « aucun contributeur localisé » avant le premier appel.

### AmpliDashboard

`components/sections/AmpliDashboard.tsx` — Tab "stats" (« Vision Globale »). Accepte `data` (mêmes résultats que les autres tabs) et `isLoading` ; titres `AmpliDashboard.*`. Affiche :
- **Quatre KPI** : participants, commentaires, likes, tags utilisés
- **Deux classements** : réponses les plus aimées / les plus commentées (rang, titre, auteur, décompte)
- **Répartition des tags** : `BarChart` recharts, palette `--chart-1..5` du thème du site

Agrégations dans `utils/dashboardStats.ts` (`getDashboardStats`, mémoïsé) — **aucun appel réseau supplémentaire** : le tab consomme le périmètre déjà chargé par `AmpliSectionRenderer`.

⚠ Nuance assumée avec `getSummaryData` : le tableau de bord annonce « appréciations reçues » / « discussions générées », donc il totalise les likes et les commentaires, là où `getSummaryData` compte les RÉPONSES concernées (« idées amplifiées »). Les participants, eux, viennent de `getSummaryData` — une seule définition de l'identité d'un contributeur.

Le graphe est sous `ClientOnly` (+ `Skeleton`) : recharts ne s'hydrate pas (ids `clipPath` d'un compteur global serveur≠client, mesure de texte impossible côté serveur) — même parti pris que le module observatoire.

### MeeteemSection

`components/sections/MeeteemSection.tsx` — Section JSON publique de type `"meeteem"`. Voir [Section `meeteem`](#section-meeteem-section-json-publique).

**Animations** : en vue `answers`, les cartes utilisent une keyframe CSS inline `cardSlideIn` (fade-in + slide depuis le bas + léger scale) avec délai progressif (`animationDelay={index * 50}ms`). Ce keyframe est injecté via un bloc `<style>` inline dans le composant.

### Sous-composants Meeteem

| Composant | Rôle |
|-----------|------|
| `MeeteemCard` | Carte d'une réponse CoForm. Props : `card: MeeteemCard`, `activeFilters`, `onToggleFilter`, `onSelectUser`, `variant: "large" \| "compact"`, `animationDelay?`, plus les props de réaction `reactionCount?` / `hasReacted?` / `reactionPending?` / `onToggleReaction?`. Affiche nom, description, tags (cliquables), avatar utilisateur (cliquable → filtre). Stats : réaction (bouton bascule, cf. [Réactions Meeteem](#réactions-meeteem-usemeeteemreactions)) + `comments` (Object.keys). Sans `onToggleReaction`, le compteur reste un simple affichage figé lu dans `serverData.vote`. |
| `MeeteemFilters` | Accordéon de filtres par tags. Props : `availableTags`, `activeFilters`, `onToggleFilter`. **Expanded par défaut** (`collapsed: false`). Retourne `null` si `availableTags.length === 0`. |
| `MeeteemViewToggle` | Boutons toggle 3 vues (Annuaire/Carte/Split). Props : `value: MeeteemViewMode`, `onChange`. Utilise `VIEW_BUTTONS` constant avec icônes `TextAlignJustifyIcon` (Radix), `MapPinIcon`, `Columns2Icon` (Lucide). |
| `MeeteemMap` | Carte MapLibre PARTAGÉE du module (réponses Meeteem ET contributeurs du tab community). Encapsule les gardes obligatoires du stack search : import du bundle i18n `modules/search`, `lazy(vite-preload)`, `ClientOnly` + `Suspense`, conteneur `relative` que le PARENT doit dimensionner (sans hauteur, la carte fait 0px sans aucune erreur). Props notables : `entities`, `isComplete`, `map` (conf marqueur relayée), `emptyMessage`, `onItemAction`. |
| `AmpliContributorsMap` | Carte des contributeurs (tab community) — cf. [section dédiée](#carte-des-contributeurs-tab-community). |
| `MeeteemAnswerModal` | Détail d'une réponse — en lecture seule, et **en édition quand c'est la sienne** (cf. [section dédiée](#modifier-sa-propre-réponse)). La projection des cartes est partielle : le contenu complet est re-fetché (`useCoFormAnswerQuery`) et la modale coform n'est montée qu'avec sa donnée — sinon elle s'ouvrirait vide, sans erreur. Ouvre avec `hideBanner` + un titre en `text-2xl` : la bannière peint le nom du **formulaire** (ex. « Sinistre ») en `<h1>` 4xl, qui écrasait le titre de la **réponse** laissé en `text-lg`. |

### Modifier sa propre réponse

Le bouton « Modifier » vit dans le header de `MeeteemAnswerModal` (`CoFormModal headerActions`), donc à un seul endroit pour **tous** les points d'entrée : carte de l'annuaire, colonne du mode split, et popup de la carte.

- **Le droit vient du backend.** `useCoFormAnswerQuery` renvoie `answer.canEdit` / `editDeniedReason`, calculés serveur sur la réponse (propriété, formulaire encore ouvert, utilisateur connecté — vérifié en live : anonyme ⇒ `canEdit: false`, `editDeniedReason: "not_logged_in"`). Un test local « l'auteur est-ce moi ? » raterait la fermeture du formulaire et afficherait un bouton qui échoue à la sauvegarde. Ce n'est **pas** la règle de `canEditCoformAnswer` (module search), qui vise les admins éditant la réponse d'autrui.
- **Rien n'est affiché quand la réponse est celle d'un autre** — ni bouton désactivé ni message : ce serait du bruit sur le cas majoritaire.
- **Le pré-remplissage est sûr par construction** : la modale part de la réponse COMPLÈTE re-fetchée. La sauvegarde coform envoie le payload entier — partir de la projection partielle de la carte effacerait tous les champs absents (même piège que `PreviewCoformAnswer`).
- **État dérivé de l'id** (`editedAnswerId === answerId`), pas un booléen : la modale n'est pas démontée entre deux réponses, un booléen laisserait la suivante s'ouvrir directement en édition.
- **Après enregistrement**, deux invalidations : le préfixe ampli (sinon la carte de l'annuaire garde l'ancien texte) et `COFORM_QUERY_KEYS.FORM_ANSWER_PREFIX` (sinon rouvrir le détail sert la version d'avant — cache de 2 min). `useCoFormFinalMutation` n'invalide que `FORM` et `FORM_ANSWERS`, dont la clé (`"answers"`) est distincte de celle du détail (`"answer"`).

---

**Filtre utilisateur** : cliquer sur l'avatar d'un `MeeteemCard` active le `userFilter` (nom de l'utilisateur). Un badge apparaît dans le header de `MeeteemSection` pour le visualiser et le supprimer. Le filtre combine logiquement les tags actifs (OR entre tags) ET le filtre utilisateur (AND avec les tags).

---

## Types canoniques (`types.ts`)

```ts
// Un ampli prêt à l'emploi — construit par lib/costumAmpli.ts, quelle que soit la source
interface AmpliModel {
  slug: string;            // segment d'URL
  name?: string;           // absent en forme de config historique
  description?: string;
  tags: string[];
  path: AmpliPath;         // mapping des réponses (z.infer<typeof AmpliPathSchema>)
  coform: string | null;   // null = formulaire non configuré
}

// Seul type que reçoivent le contexte et les sections (isConfiguredAmpli)
type ConfiguredAmpli = AmpliModel & { coform: string };

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
- `AmpliTemplateDefault.tabs.*` — labels des tabs (home, message, network, stats, dashboard, news) — utilisés par `AmpliTabs` et `AmpliSeo`
- `AmpliTemplateDefault.comingSoon.*` — message placeholder du tab news
- `AmpliTabs.label` — libellé accessible de la barre d'onglets
- `AmpliDashboard.*` — titres, libellés des KPI (`kpi.*`), des classements et du graphe des tags
- `AmpliHero.*` — hero (headline — titre générique quand l'ampli n'a pas de nom —, subhead, proposal, browse, join, joinPending, joined, …) ; headline/subhead servent aussi au panneau de marque de `/ampli`
- `AmpliIntro.*` — intro (headline, subhead)
- `AmpliFeatures.*` — section « Proposez votre idée » (headline, subhead, button = libellé d'envoi du formulaire)
- `AmpliFeatures.form.error` — échec de chargement du formulaire de proposition
- `AmpliFeatures.summary.*` — labels stats (headline, submitted, members, amplified, comments)
- `AmpliFeatures.howItWork.*` — étapes (headline, stepOne, stepTwo, stepThree)
- `AmpliMessage.*` — section messages (headline, subhead)
- `AmpliCommunity.*` — section communauté
- `AmpliPage.*` — page d'un ampli : introuvable (notFoundTitle, notFoundDescription, backHome, backToList) et non configuré (notConfiguredTitle, notConfiguredDescription)
- `AmpliList.*` — page `/ampli` : titre, recherche, puces (filterByTags, clearFilters), états (noResults, empty), compteur (proposals_one, proposals_other), `moreTags`, accès direct (`join.*`), `welcome`
- `AmpliUserCard.*` — carte contributeur (noLocation, contributions_one, contributions_other)
- `MeeteemSection.viewToggle.*` — labels des boutons de vue (answers/map/split)
- `MeeteemSection.filters.*` — titre de l'accordéon de filtres
- `MeeteemSection.empty` — « aucune réponse à afficher »
- `MeeteemSection.map.*` — états de la carte des réponses (`empty`, `error`)
- `MeeteemSection.card.*` — carte d'une réponse : fallbacks (`noDate`, `noUser`), actions (`locate`, `noLocation`, `open`, `react`, `unreact`) et détail (`details`, `detailsLoading`, `detailsError`)
- `AmpliCommunity.map.*` — états de la carte des contributeurs (`empty`, `error`, `missing_one`, `missing_other`)
- `toast.*` — erreurs de mutation (`reactionError`, `error.generic`)
- `a11y.*` — labels d'accessibilité (toggleFilters, toggleTag, selectUser, loading)

**Attention** : les composants `AmpliHeader` et `AmpliMessages` utilisent respectivement les namespaces `AmpliHero.*` et `AmpliMessage.*` (singulier), pas `AmpliHeader.*` ni `AmpliMessages.*`.

---

## Tests unitaires

| Fichier | Ce qui est testé |
|---------|-----------------|
| `helpers/summary.test.ts` | `getSummaryData` — totalAnswers, totalUsers, totalLikes (voteCount.like), totalComments (Object.keys), agrégation par user (_id), items sans user groupés ensemble |
| `utils/cardFilters.test.ts` | `collectAvailableTags` (déduplication, ordre), `filterCards` — OR tags, filtre user, combinaison AND tags+user |
| `hooks/useMeeteemReactions.test.tsx` | Réactions — compte et « j'ai réagi » dérivés du serveur, ajout et retrait optimistes, arbitrage par `removedVoteStatus` (y compris quand le serveur bascule à l'inverse de la prévision), rollback + toast sur échec, `openLogin` sans appel réseau si déconnecté, second clic ignoré pendant l'aller-retour |
| `components/sections/parts/MeeteemCard.test.tsx` | Rendu variants large/compact, tags cliquables (toggle + aria-pressed), stats vote/comments via Object.keys, clic auteur → onSelectUser, fallbacks Anonyme/N/A, réaction (bouton vs compteur figé, `aria-pressed`, libellé bascule, désactivation pendant l'appel, clic qui n'ouvre pas le détail) |
| `components/sections/parts/MeeteemFilters.test.tsx` | Affichage filtres, toggle actif/inactif |
| `utils/ampliUsersGeo.test.ts` | Conversion contributeurs → entités carto : id hexadécimal (rejet de la forme `ObjectID("…")`), coordonnées en string, préférence geoPosition/geo, garde Null Island, auteur non résolu, `name` vide OMIS, libellé de contributions, déduplication, compteurs localisés/total |
| `components/sections/parts/MeeteemViewToggle.test.tsx` | Toggle vues, état actif |
| `components/sections/AmpliFeatures.test.tsx` | Formulaire rendu dans la colonne gauche avec le bon coform et le libellé d'envoi ; section qui reste montée pendant le chargement (régression du `return null`) ; compteurs en squelette puis chiffrés |
| `utils/scrollToSection.test.ts` | Défilement vers une ancre : cible absente (pas de throw), `prefers-reduced-motion`, focus sur le premier élément interactif, section réduite à un squelette |
| `components/sections/AmpliHeader.test.tsx` | Les 3 CTA du hero, nom de l'ampli en titre (repli sur le titre générique), et les ancres visées par « Proposer une idée » (avec focus) et « Voir les propositions » |
| `lib/costumAmpli.test.ts` | Fixture RÉELLE (`costum.ampli.sinistre`) : `ampliSourceMode` (`"true"` en chaîne et forme tableau → désactivé), slug du champ ou de la clé, entrée sans `path` ignorée, doublon de slug, `coform` absent ou mal formé → ampli listé non configuré, tags en objet PHP, nom vide ; `resolveAmpliInput` ; `filterAmplis` (casse, accents, OU des tags, slug comme titre) ; `collectAmpliTags` |
| `lib/answersQuery.test.ts` | Filtres partagés (formulaire, existence du nom, finder) et champs projetés sans `answers.undefined` |
| `hooks/useAmplis.test.tsx` | Lecture du costum, config absente ou restée en forme tableau → aucun ampli, liste stable d'un rendu à l'autre, `useAmpli` par slug |
| `routes.test.tsx` | Gate : aucune route sans `config.ampli` ni avec une config restée en forme tableau ; `true` → `/ampli` + `/ampli/:slug` et ses onglets |
| `pages/AmpliListPage.test.tsx` | Cartes (lien, description, 3 tags + « +N », « N propositions » au singulier/pluriel, squelette, rien sans formulaire), navigation au clic, recherche, puces `aria-pressed`, « Effacer les filtres », accès direct (slug connu → page ; inconnu → alerte en ligne, effacée à la saisie), état vide ; gestion : rien pour un visiteur, création → page du nouvel ampli, suppression après confirmation |
| `hooks/useAmpliAdmin.test.tsx` | Gate de gestion (admin du porteur, super-admin, anonyme, amplis non activés, avant hydratation) ; création puis rechargement de l'entité DANS CET ORDRE, échec sans entité porteuse ; suppression par le slug |
| `components/AmpliCreateDialog.test.tsx` | Identifiant dérivé du nom, refus d'un slug déjà pris et d'un nom sans identifiant, envoi vide bloqué, brouillon envoyé (mots-clés découpés) + redirection, saisie oubliée à la fermeture |
| `components/AmpliDeleteButton.test.tsx` | Rien sans confirmation, ce qui survit annoncé, renoncement, suppression de CET ampli, confirmation verrouillée pendant l'appel |
| `pages/AmpliPage.test.tsx` | Rendu normal (onglets, sections, SEO au nom), slug inconnu avec lien vers la liste (pas en forme historique), ampli sans formulaire → « en préparation » sans sections |
| `utils/dashboardStats.test.ts` | `getDashboardStats` — participants uniques, TOTAUX likes/commentaires (vs réponses concernées de `getSummaryData`), repli `vote` sans `voteCount.like`, agrégation/tri des tags (valeur unique, espaces), classements bornés et zéros exclus, auteur depuis l'entité User, `_id` non exploitable |
| `components/AmpliTabs.test.tsx` | Barre d'onglets : quatre entrées (sans « Messages »), URLs de chaque tab, `aria-current` sur l'onglet courant |
| `components/sections/parts/AmpliJoinButton.test.tsx` | Demande d'adhésion envoyée + retour local immédiat, cas projet (`canRequestContributor`), anonyme → connexion sans appel, états membre / contributeur / demande en attente, entité non résolue |
| `components/sections/parts/MeeteemAnswerModal.test.tsx` | Rien monté sans réponse ouverte, squelette / erreur, contrat passé à `CoFormModal` (lecture seule, réponse re-fetchée), bannière masquée et titre mis en avant, titre générique par défaut ; édition : rien sur la réponse d'autrui, bascule lecture → édition, pré-remplissage complet, double invalidation après enregistrement, réouverture en lecture sur une autre réponse |
| `components/sections/parts/AmpliIdeaForm.test.tsx` | Squelette / erreur / absence de données, `hideBanner` et `formId`+`formData` transmis, carte de refus + `openLogin` (avec `refetch` au succès), invalidation du cache ampli à la soumission, accusé de réception (enregistré vs mis à jour), « soumettre une autre » qui rend un formulaire vierge, passage en édition avec `answerId`/`defaultValues` |

---

## Exemple de configuration JSON

Config du site — c'est tout :

```json
{
  "ampli": true,
  "header": {
    "nav": [
      { "label": { "fr": "Amplis", "en": "Amplis" }, "path": "/ampli", "icon": "megaphone" }
    ]
  }
}
```

Les amplis eux-mêmes sont déclarés dans Co, sous `costum.ampli` du porteur (forme complète : [Côté Co](#côté-co--costumamplislug)). Accès : `https://monsite.fr/ampli` (liste), `https://monsite.fr/ampli/<slug>` (un ampli).

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

### 1. Tab `news` non implémenté

La route `/ampli/:slug/news` est déclarée dans `routes.tsx` mais affiche encore un écran "coming soon" ; elle reste exposée dans la barre d'onglets. Le tab `stats` est implémenté (`AmpliDashboard`).

Pas d'onglet « Messages » dans `AMPLI_TABS` : les messages sont une SECTION de la page d'accueil (`AmpliMessages`), pas une route.

### 2. Les cartes du module réutilisent le stack search (MapLibre, pas Leaflet)

Il n'y a plus de placeholder : `MeeteemMap` monte `SearchMapWrapper` (MapLibre + supercluster + MapTiler). Toute nouvelle carte du module doit passer par lui plutôt que de remonter la chaîne à la main — il porte les quatre gardes non négociables (i18n `modules/search`, `lazy()` de `vite-preload`, `ClientOnly`, `Suspense`) et le parent doit lui donner une hauteur explicite.

⚠ Une entité sans coordonnées valides est écartée **silencieusement** par `SearchMap` : toute carte du module doit compter ce qu'elle n'affiche pas (cf. `located` / `total` d'`ampliUsersGeo`).

### 3. `useFetchAnswerQuery` requiert un `entity` initialisé

Le hook est `enabled: !!entity`. Tant que le `CocolightProvider` n'a pas initialisé l'API (`initApi`), aucun chargement n'est déclenché. Sur SSR, `entity` est disponible côté serveur via `initApi()`.

### 4. Extraction de données via `path.*`

Le mapping `costum.ampli.<slug>.path.*` doit correspondre exactement aux noms des champs dans `answers.*` du CoForm. Une erreur de typo résulte en champs `undefined` dans les cartes. Seule la présence de `path.name` et `path.address` est vérifiée, pas l'existence des chemins dans le formulaire.

### 4 bis. `coform` absent de `costum.ampli` = ampli « en préparation »

L'outil legacy de Co n'écrit pas `coform` dans l'entrée (il le range dans les blocs CMS des pages de l'ampli). Sans repli volontaire, un ampli créé par cet outil apparaît dans la liste mais sa page affiche « Ampli en préparation » tant que le champ n'est pas posé en base.

### 4 ter. Le costum de prod doit porter `slug`, `coform` et `path`

`config.prod.tiers-lieux.json` est passée à `"ampli": true`, mais l'entrée du costum de prod
(`costum.ampli.amplifiions`) ne porte encore ni `slug`, ni `coform`, ni `path` : tant que ces trois champs
ne sont pas posés en base, l'annuaire du site est vide et `/ampli/amplifions` répond « ampli introuvable ».
Le champ `slug` suffit à garder l'URL publique (`"slug": "amplifions"`), la clé `amplifiions` n'a pas à être
renommée — et les pages Co (`#amplifiions-*`) restent en place.

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
