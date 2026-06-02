[← Retour à l'index](README.md)

# Module Interop

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Architecture interne](#architecture-interne)
- [Configuration (`useInteropConfig`)](#configuration-useinteropconfig)
- [Discourse](#discourse)
  - [Composants](#composants-discourse)
  - [Hooks Discourse](#hooks-discourse)
  - [Auto-détection Discourse (`useDiscourseAutoDetect`)](#auto-détection-discourse-usediscourseautodetect)
  - [Modale globale (`DiscourseGlobalModal`)](#modale-globale-discourseglobalmodal)
- [Mediawiki](#mediawiki)
  - [Composants Mediawiki](#composants-mediawiki)
  - [Hooks Mediawiki](#hooks-mediawiki)
- [Query keys centralisées (`INTEROP_QUERY_KEYS`)](#query-keys-centralisées-interop_query_keys)
- [Factory `createInteropMutation`](#factory-createinteropmutation)
- [Augmentation SDK (`_interopEntity.ts`)](#augmentation-sdk-_interopentityts)
- [Intégration dans les profils](#intégration-dans-les-profils)
- [i18n](#i18n)
- [Statut des exports](#statut-des-exports)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le module **Interop** (`src/modules/interop/`) gère l'interopérabilité entre SiteForge et des services tiers :
- **Discourse** : forum/communauté (lien de compte, pod de profil, auto-détection email)
- **Mediawiki** : wiki collaboratif (lien de compte, pod de profil, contributions)

**Type de module** : `core` — chargé en eager.

L'interop est activé **par costum** : si la config du site (`entity.serverData.costum.interop`) contient `DISCOURSE_URL` et/ou `WIKI_BASE_URL`, les fonctionnalités correspondantes sont activées.

---

## Architecture interne

```
src/modules/interop/
├── components/
│   ├── DiscourseAutoLinkModal.tsx   # Modale proposant de lier le compte si email détecté
│   ├── DiscourseGlobalModal.tsx     # Wrapper global : délègue à useDiscourseAutoDetect + DiscourseAutoLinkModal
│   ├── DiscourseLink.tsx            # Formulaire de liaison Discourse (react-hook-form + Zod)
│   ├── DiscoursePod.tsx             # Pod profil Discourse (stats, badges, top replies/topics, catégories)
│   ├── MediawikiLink.tsx            # Formulaire de liaison Mediawiki (react-hook-form + Zod)
│   └── MediawikiPod.tsx             # Pod profil Mediawiki (contributions récentes)
├── constants/
│   └── queryKeys.ts                 # INTEROP_QUERY_KEYS — single source of truth des query keys
├── hooks/
│   ├── _interopEntity.ts            # Helper interne : augmentation SDK + types de retour interop
│   ├── useDiscourseAutoDetect.test.ts  # Tests Vitest (jsdom)
│   ├── useDiscourseAutoDetect.ts    # Détection auto email → compte Discourse
│   ├── useDiscourseGlobalStatus.ts  # Statut global du lien Discourse pour le user courant
│   ├── useDiscourseProfil.tsx       # Query profil Discourse d'un utilisateur
│   ├── useInteropConfigQuery.test.ts   # Tests Vitest (jsdom)
│   ├── useInteropConfigQuery.tsx    # Config interop depuis entity.serverData.costum.interop
│   ├── useInteropMutation.ts        # Factory createInteropMutation + mutations exposées
│   ├── useMediawikiContribs.tsx     # Query contributions Mediawiki d'un utilisateur
│   └── useUserInteropLinks.tsx      # Statut du lien interop du user (discourse/wiki)
├── DiscourseSection.tsx             # Section profil : lazy-charge DiscoursePod ou DiscourseLink
├── MediawikiSection.tsx             # Section profil : lazy-charge MediawikiPod ou MediawikiLink
├── i18n/
│   ├── en.json
│   └── fr.json
├── i18n.ts                          # Enregistrement namespace "modules/interop"
└── index.ts                         # Barrel export (voir §Statut des exports)
```

---

## Configuration (`useInteropConfig`)

```ts
import { useInteropConfig } from "@/modules/interop";

function MyComponent() {
  const {
    discourseUrl,     // string | null  — URL du forum Discourse (DISCOURSE_URL)
    wikiBaseUrl,      // string | null  — URL base du wiki (WIKI_BASE_URL)
    wikiApiUrl,       // string | null  — URL de l'API Mediawiki (WIKI_API_URL)
    costumSlug,       // string | null  — slug de l'entité courante (entity.serverData.slug)
    hasDiscourse,     // boolean — true si DISCOURSE_URL est défini et non vide
    hasWiki,          // boolean — true si WIKI_BASE_URL est défini et non vide
  } = useInteropConfig();
}
```

Les valeurs interop sont lues depuis `entity.serverData.costum.interop`. Le `costumSlug` est lu depuis `entity.serverData.slug` (pas depuis l'objet `interop`). Si l'entité est absente, toutes les valeurs sont `null`/`false`.

---

## Discourse

### Composants Discourse

| Composant | Description |
|---|---|
| `DiscoursePod` | Affiche les statistiques d'activité (posts, sujets, likes reçus), les badges, les meilleures réponses/sujets et les catégories actives. Conditionnel : visible uniquement si le user a lié son compte. Inclut un bouton "Délier" pour le propriétaire du profil. |
| `DiscourseLink` | Formulaire (react-hook-form + Zod) permettant à un utilisateur de lier son compte Discourse en saisissant son username. Affiche les erreurs inline et une aide contextuelle avec l'URL du forum. |
| `DiscourseGlobalModal` | Wrapper global lazy-monté dans `RootLayout`. Instancie `useDiscourseAutoDetect()` et passe le résultat à `DiscourseAutoLinkModal`. Aucun état ou event bus propre. |
| `DiscourseAutoLinkModal` | Modale `Dialog` (shadcn/ui) déclenchée automatiquement si `useDiscourseAutoDetect` trouve un match email. Affiche l'avatar et le username Discourse détecté, et propose de lier ou de décliner (dismiss). |

### Hooks Discourse

| Hook | Signature | Description |
|---|---|---|
| `useInteropConfig` | `() => InteropConfig` | Config interop du costum courant |
| `useDiscourseProfilQuery` | `() => UseQueryResult<DiscourseProfilResult>` | Profil Discourse de l'utilisateur lié (lit entity + username depuis les contextes) |
| `useInteropUserLinks` | `() => { discourseUsername, isDiscourseLinked, isDiscourseDismissed, wikiUsername, isWikiLinked, isOwnProfile }` | Statut des liens interop du user connecté par rapport à l'entité de profil |
| `useDiscourseLink` | `() => UseMutationResult<DiscourseLinkResult, Error, string>` | Lie le compte Discourse de l'user (paramètre : username) |
| `useDiscourseUnlink` | `() => UseMutationResult<DiscourseSimpleResult, Error, void>` | Délie le compte Discourse |
| `useDiscourseCheckEmail` | `() => UseMutationResult<DiscourseCheckEmailResult, Error, void>` | Vérifie si l'email du user correspond à un compte Discourse |
| `useDiscourseDismiss` | `() => UseMutationResult<DiscourseSimpleResult, Error, void>` | Dismiss la suggestion de liaison Discourse |

### Auto-détection Discourse (`useDiscourseAutoDetect`)

Ce hook vérifie automatiquement si l'email de l'utilisateur connecté correspond à un compte Discourse existant. Il s'exécute une seule fois au montage (sur changement de `shouldCheck`), uniquement si :
- L'utilisateur est connecté (`me` non null)
- Une entité (costum) est chargée (`entity` non null)
- Le site a une URL Discourse configurée (`hasDiscourse`)
- Le compte n'est pas déjà lié (`!isLinked`)
- Le user n'a pas dismissed la suggestion précédemment (`!isDismissed`)

```ts
import { useDiscourseAutoDetect } from "@/modules/interop/hooks/useDiscourseAutoDetect";

// Usage direct — normalement encapsulé dans DiscourseGlobalModal
function MyGlobalWrapper() {
  const { autoUser, open, setOpen } = useDiscourseAutoDetect();

  return (
    <DiscourseAutoLinkModal
      open={open}
      onOpenChange={setOpen}
      autoUser={autoUser}
    />
  );
}
```

**Retour :**

| Champ | Type | Description |
|---|---|---|
| `autoUser` | `Record<string, unknown> \| null` | Données du compte Discourse trouvé (username, name, avatar_template…) ou `null` |
| `open` | `boolean` | Contrôle l'ouverture de la modale |
| `setOpen` | `(open: boolean) => void` | Ferme/ouvre la modale depuis l'extérieur |

Le statut du lien est stocké dans `me.serverData.interop.discourse[costumSlug]` :
- `string` (username) → déjà lié → pas de vérification
- `false` → dismissed → pas de vérification
- `undefined` → non encore décidé → l'auto-détection s'exécute

### Modale globale (`DiscourseGlobalModal`)

`DiscourseGlobalModal` est lazy-montée une seule fois dans `RootLayout` (`src/RootLayout.tsx`) :

```ts
const DiscourseGlobalModal = lazy(
  () => import("@/modules/interop/components/DiscourseGlobalModal")
);
```

Elle instancie `useDiscourseAutoDetect()` en interne et passe directement le résultat à `DiscourseAutoLinkModal`. Il n'y a pas d'event bus ni d'état global séparé — la logique de déclenchement est entièrement dans `useDiscourseAutoDetect`.

---

## Mediawiki

### Composants Mediawiki

| Composant | Description |
|---|---|
| `MediawikiPod` | Affiche les contributions récentes de l'utilisateur sur le wiki (titre de la page, commentaire, date). Inclut un lien vers la page utilisateur, un lien "voir toutes les contributions" et un bouton "Délier" pour le propriétaire du profil. |
| `MediawikiLink` | Formulaire (react-hook-form + Zod) permettant de lier le compte Mediawiki en saisissant le username wiki. Affiche une aide contextuelle avec l'URL des contributions. |

### Hooks Mediawiki

| Hook | Signature | Description |
|---|---|---|
| `useMediawikiContribsQuery` | `(limit?: number) => UseQueryResult<MediawikiContribsResult>` | Contributions Mediawiki récentes de l'utilisateur lié. `limit` est 10 par défaut. Lit entity + wikiUsername depuis les contextes. |

---

## Query keys centralisées (`INTEROP_QUERY_KEYS`)

`src/modules/interop/constants/queryKeys.ts` est la **single source of truth** pour toutes les query keys du module. Exporté via le barrel `index.ts`.

```ts
import { INTEROP_QUERY_KEYS } from "@/modules/interop";

INTEROP_QUERY_KEYS.DISCOURSE_PROFIL(entityId, discourseUsername)
// → ["discourse-profil", entityId, discourseUsername]

INTEROP_QUERY_KEYS.DISCOURSE_PROFIL_PREFIX()
// → ["discourse-profil"]  — pour invalidation cross-entity/username

INTEROP_QUERY_KEYS.MEDIAWIKI_CONTRIBS(entityId, wikiUsername)
// → ["mediawiki-contribs", entityId, wikiUsername]

INTEROP_QUERY_KEYS.MEDIAWIKI_CONTRIBS_PREFIX()
// → ["mediawiki-contribs"]  — pour invalidation cross-entity/username
```

Les params acceptent `null` pour permettre les hooks `enabled: false`.

---

## Factory `createInteropMutation`

`src/modules/interop/hooks/useInteropMutation.ts` expose une factory alignée sur les patterns des modules cagnotte et coform.

**Signature de la factory :**

```ts
interface InteropMutationConfig<TParams, TData> {
  action: (entity: EntityWithInterop, params: TParams) => Promise<TData>;
  i18n: { successKey: string; errorKey: string };
  invalidate?: QueryKey[];
  refreshMeOnSuccess?: boolean; // default: true
}

function createInteropMutation<TParams, TData>(
  config: InteropMutationConfig<TParams, TData>
): () => UseMutationResult<TData, Error, TParams>
```

La factory encapsule :
- `useMutationWithToast` (toasts i18n namespace `modules/interop`)
- Validation entity non-null (throw si absente)
- `refreshMe()` après succès (sauf `refreshMeOnSuccess: false`)
- Invalidation React Query via `queryClient.invalidateQueries` + transmission à `useMutationWithToast`

**Mutations Discourse exposées :**

| Hook | Paramètre | Retour | Notes |
|---|---|---|---|
| `useDiscourseLink` | `username: string` | `DiscourseLinkResult` | Invalide `["discourse-profil"]` |
| `useDiscourseUnlink` | `void` | `DiscourseSimpleResult` | Invalide `["discourse-profil"]` |
| `useDiscourseCheckEmail` | `void` | `DiscourseCheckEmailResult` | `refreshMeOnSuccess: false` — pas de toast succès |
| `useDiscourseDismiss` | `void` | `DiscourseSimpleResult` | — |

**Mutations MediaWiki exposées :**

| Hook | Paramètre | Retour | Notes |
|---|---|---|---|
| `useMediawikiLink` | `username: string` | `MediawikiResult` | Invalide `["mediawiki-contribs"]` |
| `useMediawikiUnlink` | `void` | `MediawikiResult` | Invalide `["mediawiki-contribs"]` |

**Important** : `useDiscourseCheckEmail` ne déclenche pas de toast succès car la mutation retourne juste un booléen `found` — c'est l'UI consommatrice qui décide quoi afficher selon le résultat.

**Note** : `useMediawikiLink` et `useMediawikiUnlink` ne sont **pas** exportés via le barrel `index.ts` (consommés uniquement en interne par `MediawikiLink.tsx` et `MediawikiPod.tsx`).

---

## Augmentation SDK (`_interopEntity.ts`)

Le SDK `@communecter/cocolight-api-client` ne type pas encore les méthodes interop runtime ajoutées par le backend Cocolight. `src/modules/interop/hooks/_interopEntity.ts` centralise tous les casts SDK interop en un seul endroit.

**Types de retour exposés :**

| Type | Champs clés |
|---|---|
| `DiscourseLinkResult` | `{ result: boolean; username?: string; profileUrl?: string; error?: string }` |
| `DiscourseCheckEmailResult` | `{ found: boolean; user?: Record<string, unknown> }` |
| `DiscourseSimpleResult` | `{ result: boolean; error?: string }` |
| `DiscourseProfilResult` | `{ summary?: Record<string, unknown>; profileUrl?: string; error?: string; [k]: unknown }` |
| `MediawikiResult` | `{ result: boolean; username?: string; msg?: string; error?: string }` |
| `MediawikiContribsResult` | `{ result: boolean; contribs?: WikiContrib[] \| Record<string, unknown> \| null; [k]: unknown }` |
| `WikiContrib` | `{ title?: string; timestamp?: string; comment?: string; revid?: number; [k]: unknown }` |

**Interface augmentée :**

```ts
// EntityWithInterop = EntityTypes SDK + méthodes interop runtime
type EntityWithInterop = EntityTypes & {
  // Discourse
  linkDiscourseAccount(username: string): Promise<DiscourseLinkResult>;
  unlinkDiscourseAccount(): Promise<DiscourseSimpleResult>;
  checkDiscourseEmailMatch(): Promise<DiscourseCheckEmailResult>;
  dismissDiscourseLink(): Promise<DiscourseSimpleResult>;
  getDiscourseProfile(username: string): Promise<DiscourseProfilResult>;
  // MediaWiki
  linkMediaWikiAccount(username: string): Promise<MediawikiResult>;
  unlinkMediaWikiAccount(): Promise<MediawikiResult>;
  getMediaWikiContributions(username: string, limit?: number): Promise<MediawikiContribsResult>;
};

// Helper unique — évite 8+ casts dispersés
function asInteropEntity(entity: EntityTypes): EntityWithInterop;
```

Quand le SDK exposera ces méthodes nativement, supprimer `_interopEntity.ts` et utiliser directement `EntityTypes`.

---

## Hooks : signatures complètes

### `useInteropConfig()`

Lit `entity.serverData.costum.interop` pour les URLs, et `entity.serverData.slug` pour le `costumSlug`.

```ts
const {
  discourseUrl,  // string | null — DISCOURSE_URL
  wikiBaseUrl,   // string | null — WIKI_BASE_URL
  wikiApiUrl,    // string | null — WIKI_API_URL
  costumSlug,    // string | null — entity.serverData.slug
  hasDiscourse,  // boolean — !!DISCOURSE_URL
  hasWiki,       // boolean — !!WIKI_BASE_URL
} = useInteropConfig();
```

### `useInteropUserLinks()`

Résout le statut de liaison interop pour l'utilisateur courant par rapport à l'entité de profil. Si `entity` est présente, lit depuis `entity.serverData.interop` ; sinon lit depuis `me.serverData.interop`.

```ts
const {
  discourseUsername,    // string | undefined — username Discourse lié
  isDiscourseLinked,    // boolean
  isDiscourseDismissed, // boolean — user a refusé la suggestion
  wikiUsername,         // string | undefined — username MediaWiki lié
  isWikiLinked,         // boolean
  isOwnProfile,         // boolean — me.slug === entity.slug
} = useInteropUserLinks();
```

Stockage des valeurs dans `serverData.interop` :
- `interop.discourse[costumSlug]` : `string` (username) → lié / `false` → dismissed / `undefined` → non décidé
- `interop.mediawiki[costumSlug]` : `string` (username) → lié / `undefined` → non lié

### `useDiscourseGlobalStatus()`

Version sans `ProfileEntityContext` pour usage depuis `RootLayout` ou contextes globaux. Retourne `{ shouldShowModal: boolean }`.

**Statut**: `@unused` au 2026-05-17 — conservé pour usage futur (potentiellement à intégrer dans `DiscourseGlobalModal`). Duplique partiellement la logique de `useDiscourseAutoDetect` — à consolider si on l'active.

### `useDiscourseProfilQuery()`

```ts
useDiscourseProfilQuery(): UseQueryResult<DiscourseProfilResult>
// Lit entity, hasDiscourse, discourseUsername, isDiscourseLinked depuis les contextes (pas de paramètre)
// queryKey: INTEROP_QUERY_KEYS.DISCOURSE_PROFIL(entity?.id, discourseUsername)
//         = ["discourse-profil", entityId, discourseUsername]
// enabled: !!entity && hasDiscourse && isDiscourseLinked && !!discourseUsername
// staleTime: 5 minutes
```

### `useMediawikiContribsQuery(limit = 10)`

```ts
useMediawikiContribsQuery(limit?: number): UseQueryResult<MediawikiContribsResult>
// Lit entity, hasWiki, wikiUsername, isWikiLinked depuis les contextes (pas de paramètre username)
// queryKey: INTEROP_QUERY_KEYS.MEDIAWIKI_CONTRIBS(entity?.id, wikiUsername)
//         = ["mediawiki-contribs", entityId, wikiUsername]
// enabled: !!entity && hasWiki && isWikiLinked && !!wikiUsername
// staleTime: 5 minutes
```

---

## Sections de profil : logique de rendu

Les deux sections (`DiscourseSection`, `MediawikiSection`) lazy-chargent leurs sous-composants via `lazy()` de `vite-preload` et suivent le même pattern d'affichage conditionnel :

```ts
// DiscourseSection.tsx
const DiscoursePod = lazy(() => import("./components/DiscoursePod"));
const DiscourseLink = lazy(() => import("./components/DiscourseLink"));

const { isDiscourseLinked, isOwnProfile } = useInteropUserLinks();
if (!isDiscourseLinked && !isOwnProfile) return null;
return isDiscourseLinked ? <DiscoursePod /> : <DiscourseLink />;
```

Règles d'affichage :
- Si le user n'est **pas** propriétaire du profil ET le compte n'est **pas** lié → rien n'est affiché (section invisible pour les visiteurs)
- Si le user est propriétaire ET le compte n'est pas lié → `DiscourseLink` / `MediawikiLink` (invitation à lier)
- Si le compte est lié → `DiscoursePod` / `MediawikiPod` (stats publiques + bouton délier pour le propriétaire)

---

## i18n

**Namespace** : `modules/interop`

**Clés disponibles** :

| Groupe | Clés |
|---|---|
| `toasts.discourse.*` | `linkSuccess`, `linkError`, `unlinkSuccess`, `unlinkError`, `dismissSuccess`, `dismissError`, `checkEmailError` |
| `toasts.mediawiki.*` | `linkSuccess`, `linkError`, `unlinkSuccess`, `unlinkError` |
| `discourse.*` | `title`, `link_account`, `unlink`, `see_full_profile`, `username_placeholder`, `link_description`, `username_hint`, `link_error`, `activity`, `posts_created`, `topics_created`, `likes_received`, `badges`, `top_replies`, `top_topics`, `categories`, `account_found_title`, `account_found_description`, `account_found_question`, `see_forum_profile`, `confirm_link`, `decline_link` |
| `wiki.*` | `title`, `link_account`, `unlink`, `open_wiki`, `username_placeholder`, `link_description`, `username_hint`, `no_page_found`, `latest_contributions`, `see_all_contributions`, `see_full_profile` |

---

## Intégration dans les profils

Les sections Discourse et Mediawiki peuvent être ajoutées comme onglets de profil dans la config JSON :

```json
{
  "profiles": {
    "organizations": {
      "tabs": [
        { "id": "about", "label": { "fr": "À propos" } },
        {
          "id": "discourse",
          "label": { "fr": "Forum" },
          "component": "DiscourseSection"
        },
        {
          "id": "wiki",
          "label": { "fr": "Wiki" },
          "component": "MediawikiSection"
        }
      ]
    }
  }
}
```

`DiscourseSection` et `MediawikiSection` sont des sections profil qui lazy-chargent leurs sous-composants (pod + formulaire de liaison). Elles ne s'affichent que si la config interop du costum est active.

L'intégration dans `ProfileAbout.tsx` utilise également `useInteropConfig` pour conditionner l'affichage des onglets Discourse/Wiki :

```ts
// src/modules/profil/components/sections/ProfileAbout.tsx
import { useInteropConfig } from "@/modules/interop";
const { hasDiscourse, hasWiki } = useInteropConfig();
```

---

## Statut des exports

Le fichier `src/modules/interop/index.ts` documente précisément le statut de chaque export :

**Exportés (barrel public) :**

| Export | Statut |
|---|---|
| `INTEROP_QUERY_KEYS`, `InteropQueryKeyType` | Actif — single source of truth des query keys |
| `useInteropConfig` | Actif — consommé en externe par `ProfileAbout.tsx` et conditionnement de l'affichage des sections |
| `useInteropUserLinks` | Actif — hook central au rendu des pods/sections ; consommé par `DiscourseSection.tsx`, `MediawikiSection.tsx`, `DiscoursePod.tsx`, `MediawikiPod.tsx` |
| `useDiscourseProfilQuery`, `DiscourseProfilResult` | Actif — producteur des données du pod Discourse ; consommé par `DiscoursePod.tsx` |
| `useDiscourseLink`, `useDiscourseUnlink`, `useDiscourseCheckEmail`, `useDiscourseDismiss` | Partiellement actifs via chemin profond — `useDiscourseLink` (DiscourseLink.tsx, DiscourseAutoLinkModal.tsx), `useDiscourseUnlink` (DiscoursePod.tsx), `useDiscourseDismiss` (DiscourseAutoLinkModal.tsx) sont consommés ; seul `useDiscourseCheckEmail` est réellement non consommé |
| `DiscourseLink`, `DiscoursePod`, `DiscourseSection` | `@unused` via barrel — importés par chemin profond |
| `MediawikiLink`, `MediawikiPod`, `MediawikiSection` | `@unused` via barrel — importés par chemin profond |

**Non exportés via le barrel (internes uniquement) :**
- `useMediawikiLink`, `useMediawikiUnlink` — consommés uniquement par `MediawikiLink.tsx` et `MediawikiPod.tsx`
- `useDiscourseGlobalStatus` — `@unused`, conservé pour usage futur
- `createInteropMutation` — factory interne
- `asInteropEntity`, `EntityWithInterop` et types associés — helpers internes `_interopEntity.ts`

Les consommateurs internes (`RootLayout.tsx`, `DiscourseSection.tsx`, `DiscoursePod.tsx`, etc.) importent directement par chemin profond et ne dépendent pas du barrel.

---

## Voir aussi

- [Architecture](03-architecture.md)
- [Module Profil](08-module-profil.md)
- [Permissions](10-permissions.md)
