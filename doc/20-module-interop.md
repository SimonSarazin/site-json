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
- [Factory `createInteropMutation`](#factory-createinteropmutation)
- [Intégration dans les profils](#intégration-dans-les-profils)
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
│   ├── DiscourseGlobalModal.tsx     # Modale globale de gestion du lien Discourse
│   ├── DiscourseLink.tsx            # Bouton/lien d'action de liaison Discourse
│   ├── DiscoursePod.tsx             # Pod profil Discourse (avatar + stats)
│   ├── MediawikiLink.tsx            # Bouton/lien d'action Mediawiki
│   └── MediawikiPod.tsx             # Pod profil Mediawiki (contributions)
├── hooks/
│   ├── _interopEntity.ts            # Helper interne : accès aux méthodes d'entité interop
│   ├── useDiscourseAutoDetect.ts    # Détection auto email → compte Discourse
│   ├── useDiscourseGlobalStatus.ts  # Statut global du lien Discourse pour le user courant
│   ├── useDiscourseProfil.tsx       # Query profil Discourse d'un utilisateur
│   ├── useInteropConfigQuery.tsx    # Config interop depuis entity.serverData.costum.interop
│   ├── useInteropMutation.ts        # Factory mutations (link/unlink/dismiss/checkEmail)
│   ├── useMediawikiContribs.tsx     # Query contributions Mediawiki d'un utilisateur
│   └── useUserInteropLinks.tsx      # Status du lien interop du user (discourse/wiki)
├── DiscourseSection.tsx             # Section profil : onglet Discourse complet
├── MediawikiSection.tsx             # Section profil : onglet Mediawiki complet
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
    discourseUrl,     // string | null  — URL du forum Discourse
    wikiBaseUrl,      // string | null  — URL base du wiki
    wikiApiUrl,       // string | null  — URL de l'API Mediawiki
    costumSlug,       // string | null  — slug du costum courant
    hasDiscourse,     // boolean
    hasWiki,          // boolean
  } = useInteropConfig();
}
```

Les valeurs sont lues depuis `entity.serverData.costum.interop` (objet de la config costum). Si la clé n'existe pas, `hasDiscourse` et `hasWiki` sont `false`.

---

## Discourse

### Composants Discourse

| Composant | Description |
|---|---|
| `DiscoursePod` | Affiche l'avatar Discourse, le nombre de posts, la date d'inscription. Conditionnel : visible uniquement si le user a lié son compte. |
| `DiscourseLink` | Bouton permettant à un utilisateur de lier/délier son compte Discourse. Affiche le statut du lien courant. |
| `DiscourseGlobalModal` | Modale complète de gestion du lien Discourse : formulaire de liaison, confirmation, gestion d'erreurs. Lazy-montée dans `RootLayout`. |
| `DiscourseAutoLinkModal` | Modale légère déclenchée automatiquement si `useDiscourseAutoDetect` trouve un match email. Propose de lier le compte en un clic. |

### Hooks Discourse

| Hook | Signature | Description |
|---|---|---|
| `useInteropConfig` | `() => InteropConfig` | Config interop du costum courant |
| `useDiscourseProfilQuery` | `(username: string) => UseQueryResult<DiscourseProfilResult>` | Profil Discourse d'un utilisateur (avatar, stats) |
| `useInteropUserLinks` | `() => { discourseLinked, wikiLinked, ... }` | Statut des liens interop du user connecté |
| `useDiscourseLink` | `(ctx) => MutationResult` | Lie le compte Discourse de l'user |
| `useDiscourseUnlink` | `(ctx) => MutationResult` | Délie le compte Discourse |
| `useDiscourseCheckEmail` | `(ctx) => MutationResult` | Vérifie si l'email du user correspond à un compte Discourse |
| `useDiscourseDismiss` | `(ctx) => MutationResult` | Dismiss la suggestion de liaison Discourse |

### Auto-détection Discourse (`useDiscourseAutoDetect`)

Ce hook vérifie automatiquement si l'email de l'utilisateur connecté correspond à un compte Discourse existant. Il s'exécute une seule fois au montage, uniquement si :
- L'utilisateur est connecté
- Une entité (costum) est chargée
- Le site a une URL Discourse configurée
- Le compte n'est pas déjà lié
- Le user n'a pas dismissed la suggestion précédemment

```ts
import { useDiscourseAutoDetect } from "@/modules/interop/hooks/useDiscourseAutoDetect";

function ProfilePage() {
  const { autoUser, open, setOpen } = useDiscourseAutoDetect();

  return (
    <>
      {/* ... contenu de la page ... */}
      {open && autoUser && (
        <DiscourseAutoLinkModal
          user={autoUser}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
```

Le statut du lien est stocké dans `me.serverData.interop.discourse[costumSlug]` :
- `string` (username) → déjà lié
- `false` → dismissed
- `undefined` → non encore décidé → l'auto-détection s'exécute

### Modale globale (`DiscourseGlobalModal`)

`DiscourseGlobalModal` est montée dans `RootLayout` comme composant global lazy. Elle est ouverte/fermée via un event bus ou un état global (non lié à une page spécifique).

---

## Mediawiki

### Composants Mediawiki

| Composant | Description |
|---|---|
| `MediawikiPod` | Affiche les contributions récentes de l'utilisateur sur le wiki (nombre d'éditions, pages modifiées) |
| `MediawikiLink` | Bouton permettant de lier/délier le compte Mediawiki |

### Hooks Mediawiki

| Hook | Signature | Description |
|---|---|---|
| `useMediawikiContribs` | `(username: string) => UseQueryResult<MediawikiContribs>` | Contributions Mediawiki d'un utilisateur (pages éditées, nombre d'éditions) |

---

## Augmentation SDK (`_interopEntity.ts`)

Le SDK `@communecter/cocolight-api-client` ne type pas encore les méthodes interop runtime ajoutées par le backend Cocolight. `src/modules/interop/hooks/_interopEntity.ts` centralise tous les casts SDK interop en un seul endroit.

**Types de retour exposés :**

| Type | Champs clés |
|---|---|
| `DiscourseLinkResult` | `{ result: boolean; username?: string; profileUrl?: string; error?: string }` |
| `DiscourseCheckEmailResult` | `{ found: boolean; user?: Record<string, unknown> }` |
| `DiscourseSimpleResult` | `{ result: boolean; error?: string }` |
| `DiscourseProfilResult` | `{ summary?: object; profileUrl?: string; error?: string; [k]: unknown }` |
| `MediawikiResult` | `{ result: boolean; username?: string; msg?: string; error?: string }` |
| `MediawikiContribsResult` | `{ result: boolean; contribs?: WikiContrib[]; [k]: unknown }` |
| `WikiContrib` | `{ title?: string; timestamp?: string; comment?: string; revid?: number }` |

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

Lit `entity.serverData.costum.interop` pour la config interop du costum courant.

```ts
const {
  discourseUrl,  // string | null — DISCOURSE_URL
  wikiBaseUrl,   // string | null — WIKI_BASE_URL
  wikiApiUrl,    // string | null — WIKI_API_URL
  costumSlug,    // string | null — slug de l'entity courante
  hasDiscourse,  // boolean
  hasWiki,       // boolean
} = useInteropConfig();
```

### `useInteropUserLinks()`

Résout le statut de liaison interop pour l'utilisateur courant par rapport à l'entité de profil.

```ts
const {
  discourseUsername,   // string | undefined — username Discourse lié
  isDiscourseLinked,   // boolean
  isDiscourseDismissed,// boolean — user a refusé la suggestion
  wikiUsername,        // string | undefined — username MediaWiki lié
  isWikiLinked,        // boolean
  isOwnProfile,        // boolean — me.slug === entity.slug
} = useInteropUserLinks();
```

La valeur est lue depuis `entity.serverData.interop.discourse[costumSlug]` :
- `string` (username) → lié
- `false` → dismissed
- `undefined` → non décidé

### `useDiscourseGlobalStatus()`

Version sans `ProfileEntityContext` pour usage depuis `RootLayout` ou contextes globaux. Retourne `{ shouldShowModal: boolean }`.

**Statut**: `@unused` au 2026-05-17 — conservé pour usage futur (potentiellement à intégrer dans `DiscourseGlobalModal`).

### `useDiscourseProfilQuery()`

```ts
useDiscourseProfilQuery(): UseQueryResult<DiscourseProfilResult>
// queryKey: ["discourse-profil", entity.id, discourseUsername]
// enabled: entity && hasDiscourse && isDiscourseLinked && discourseUsername
// staleTime: 5 minutes
```

### `useMediawikiContribsQuery(limit = 10)`

```ts
useMediawikiContribsQuery(limit?: number): UseQueryResult<MediawikiContribsResult>
// queryKey: ["mediawiki-contribs", entity.id, wikiUsername]
// enabled: entity && hasWiki && isWikiLinked && wikiUsername
// staleTime: 5 minutes
```

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
- Invalidation React Query configurables

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

---

## Sections de profil : logique de rendu

Les deux sections (`DiscourseSection`, `MediawikiSection`) suivent le même pattern :

```ts
// DiscourseSection.tsx
const { isDiscourseLinked, isOwnProfile } = useInteropUserLinks();
if (!isDiscourseLinked && !isOwnProfile) return null;
return isDiscourseLinked ? <DiscoursePod /> : <DiscourseLink />;
```

Règles d'affichage :
- Si le user n'est **pas** propriétaire du profil ET le compte n'est **pas** lié → rien n'est affiché (section invisible pour les visiteurs)
- Si le user est propriétaire ET le compte n'est pas lié → `DiscourseLink` / `MediawikiLink` (invitation à lier)
- Si le compte est lié → `DiscoursePod` / `MediawikiPod` (stats publiques)

---

## i18n

**Namespace** : `modules/interop`

**Clés disponibles** :

| Groupe | Clés exemples |
|---|---|
| `toasts.discourse.*` | `linkSuccess`, `linkError`, `unlinkSuccess`, `unlinkError`, `dismissSuccess`, `dismissError`, `checkEmailError` |
| `toasts.mediawiki.*` | `linkSuccess`, `linkError`, `unlinkSuccess`, `unlinkError` |
| `discourse.*` | `title`, `link_account`, `unlink`, `link_description`, `username_placeholder`, `username_hint`, `activity`, `posts_created`, `account_found_title`, `confirm_link`, `decline_link` |
| `wiki.*` | `title`, `link_account`, `unlink`, `link_description`, `username_placeholder`, `username_hint`, `latest_contributions`, `see_all_contributions` |

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

`DiscourseSection` et `MediawikiSection` sont des sections profil lazy-loadées qui affichent le pod + les boutons de liaison de compte.

---

## Statut des exports

Le fichier `src/modules/interop/index.ts` documente précisément le statut de chaque export :

- **`useInteropConfig`** : consommé en externe par `ProfileAbout.tsx`
- Tous les autres exports sont marqués `@unused` au 2026-05-17 (conservés pour usage futur prévu)
- Les consommateurs internes (`RootLayout.tsx`, `DiscourseSection.tsx`) importent par chemin profond et ne dépendent pas du barrel

---

## Voir aussi

- [Architecture](03-architecture.md)
- [Module Profil](08-module-profil.md)
- [Permissions](10-permissions.md)
