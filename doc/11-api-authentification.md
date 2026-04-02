[← Retour à l'index](README.md)

# API Client, Authentification & Sécurité

**Sommaire**

- [API Client, Authentification \& Sécurité](#api-client-authentification--sécurité)
  - [Initialisation de l'API - Pattern Dual Server/Client (`apiClient.ts`)](#initialisation-de-lapi---pattern-dual-serverclient-apiclientts)
    - [Architecture server/client](#architecture-serverclient)
    - [Fonction pure : `createApiInstances()`](#fonction-pure--createapiinstances)
    - [Point d'entrée : `initApiClient()`](#point-dentrée--initapiclient)
    - [Hydratation SSR : `getHydratedCocolightData()`](#hydratation-ssr--gethydratedcocolightdata)
    - [Token Storage Strategy selon l'environnement](#token-storage-strategy-selon-lenvironnement)
    - [Helpers pour accéder aux singletons](#helpers-pour-accéder-aux-singletons)
    - [`resetApiState()`](#resetapistate)
    - [Types et interfaces](#types-et-interfaces)
    - [Gestion du slug contextuel](#gestion-du-slug-contextuel)
    - [Sécurité et gestion d'erreurs](#sécurité-et-gestion-derreurs)
    - [Usage dans les loaders SSR](#usage-dans-les-loaders-ssr)
    - [Limitations et considérations](#limitations-et-considérations)
  - [Stratégies de stockage des tokens](#stratégies-de-stockage-des-tokens)
    - [Choix selon l'environnement](#choix-selon-lenvironnement)
    - [MultiServerTokenStorageStrategy](#multiservertokenstoragestrategy)
    - [Sécurité des tokens](#sécurité-des-tokens)
    - [Refresh automatique des tokens](#refresh-automatique-des-tokens)
    - [Gestion des erreurs de refresh](#gestion-des-erreurs-de-refresh)
    - [Clear tokens (logout)](#clear-tokens-logout)
    - [Vérification de l'état de connexion](#vérification-de-létat-de-connexion)
  - [Contexte React (`CocolightContext`)](#contexte-react-cocolightcontext)
    - [CocolightContext](#cocolightcontext)
    - [CocolightProvider](#cocolightprovider)
  - [Hooks d'accès au client](#hooks-daccès-au-client)
    - [`useCocolight`](#usecocolight)
    - [`useCocolightInit`](#usecocolightinit)
  - [Flux d'authentification](#flux-dauthentification)
  - [Exemple d'intégration](#exemple-dintégration)
  - [Sécurité et validation](#sécurité-et-validation)
    - [Validation des schémas JSON (Zod)](#validation-des-schémas-json-zod)
    - [Sanitisation du contenu (DOMPurify)](#sanitisation-du-contenu-dompurify)
  - [Voir aussi](#voir-aussi)

---

Le client d'API et le système d'authentification de SiteForge reposent sur le package `@communecter/cocolight-api-client`, configuré et initialisé via un contexte React.

---

## Initialisation de l'API - Pattern Dual Server/Client (`apiClient.ts`)

Le fichier `src/lib/apiClient.ts` implémente un **pattern dual** pour l'API client :
- **Serveur** : instances fraîches et isolées par requête (pas de globals partagés)
- **Client** : singleton via globals (un seul utilisateur, pas de concurrence)

### Architecture server/client

L'architecture repose sur une **fonction pure `createApiInstances()`** qui encapsule toute la logique d'initialisation, et un **point d'entrée `initApiClient()`** qui choisit le mode selon l'environnement.

**Côté client uniquement**, des variables module-level servent de cache singleton :

```ts
// Variables d'état CLIENT uniquement (singleton navigateur)
// Côté serveur, ces variables ne sont jamais utilisées.
let client: ApiClient | null = null;
let userApiInstance: UserApi | null = null;
let api: Api | null = null;
let cachedMe: User | null = null;
let cachedContextType: string | undefined = undefined;
let cachedContextId: string | undefined = undefined;
let cachedEntity: Organization | Project | null = null;
let initialized = false;
let initPromise: Promise<InitApiResult> | null = null;
```

**Pourquoi cette architecture ?**
- **Isolation SSR** : chaque requête serveur crée ses propres instances, pas de contamination inter-requêtes
- **Performance client** : un seul init, tous les composants partagent la même instance
- **Race condition safe** : `initPromise` empêche les double initialisations côté client
- **Hydratation SSR** : les données pré-chargées par le serveur sont réutilisées côté client via `getHydratedCocolightData()`

### Fonction pure : `createApiInstances()`

La logique d'initialisation est encapsulée dans une **fonction pure** qui ne touche aucun global :

```ts
async function createApiInstances(
  options: InitApiOptions,
  storageType: "memory" | "localStorage",
): Promise<InitApiResult> {
  // 1. Créer la stratégie de stockage des tokens
  const tokenStorageStrategy =
    await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy(storageType);

  // 2. Créer le client API
  const newClient = new Cocolight.ApiClient({
    baseURL: options.baseURL ?? getBaseUrl(),
    ...options,
    debug: typeof window !== "undefined" && (import.meta.env.DEV ?? false),
    tokenStorageStrategy,
  });

  // 3. Créer l'instance UserApi
  const newUserApi = Cocolight.Api.userApi(newClient);

  // 4. Hydratation SSR (client uniquement, user non connecté)
  const hydratedData = getHydratedCocolightData();
  if (hydratedData && !newUserApi.client.isConnected) {
    // Réutiliser les données pré-chargées par le serveur
    if (hydratedData.entity) {
      entity = Cocolight.helper.fromEntityJSON(hydratedData.entity, newClient);
    }
  }

  // 5. Si connecté → meIsconnected() + me()
  // 6. Résolution du slug si entity pas déjà hydratée
  // ... (voir code complet dans apiClient.ts)

  return { client: newClient, userApiInstance: newUserApi, api: newApi,
           me, contextType, contextId, entity };
}
```

**Points clés** :
- Le `storageType` est un paramètre explicite (`"memory"` ou `"localStorage"`)
- Le `debug` utilise `import.meta.env.DEV` (plus d'option manuelle)
- L'hydratation SSR est tentée **avant** les appels réseau
- Aucune variable globale n'est modifiée — la fonction est **réutilisable et testable**

### Point d'entrée : `initApiClient()`

```ts
export async function initApiClient(
  options: InitApiOptions = {},
): Promise<InitApiResult> {
  const isServer = typeof window === "undefined";

  // SERVEUR : purement fonctionnel, pas de globals partagés
  if (isServer) {
    return createApiInstances(options, "memory");
  }

  // CLIENT : singleton — un seul user, pas de concurrence
  if (initialized) {
    return { client: client!, userApiInstance: userApiInstance!, api: api!,
             me: cachedMe, contextType: cachedContextType,
             contextId: cachedContextId, entity: cachedEntity };
  }
  if (initPromise) return initPromise;

  initPromise = createApiInstances(options, "localStorage").then((result) => {
    client = result.client;
    userApiInstance = result.userApiInstance;
    api = result.api;
    cachedMe = result.me;
    cachedContextType = result.contextType;
    cachedContextId = result.contextId;
    cachedEntity = result.entity;
    initialized = true;
    return result;
  });

  return initPromise;
}
```

**Flux selon l'environnement** :

| Étape | Serveur (SSR) | Client (Browser) |
|-------|---------------|------------------|
| 1. Détection | `typeof window === "undefined"` → `true` | → `false` |
| 2. Cache | — (pas de cache, chaque requête est isolée) | `initialized` → retour immédiat |
| 3. Concurrence | — (pas de singleton) | `initPromise` → attendre la promesse en cours |
| 4. Création | `createApiInstances(opts, "memory")` | `createApiInstances(opts, "localStorage")` |
| 5. Hydratation | — (pas de `window`) | `getHydratedCocolightData()` pour les données SSR |
| 6. Globals | — (retour direct, aucun global modifié) | `.then()` → remplit les globals du singleton |

### Hydratation SSR : `getHydratedCocolightData()`

Fonction d'optimisation qui évite des appels réseau redondants côté client :

```ts
interface CocolightHydratedData {
  me: Record<string, unknown> | null;
  entity: Record<string, unknown> | null;
  contextType?: string;
  contextId?: string;
}

function getHydratedCocolightData(): CocolightHydratedData | null {
  if (typeof window === "undefined") return null;

  const reactQueryState = window.__REACT_QUERY_STATE__;
  if (!reactQueryState?.queries) return null;

  const cocolightDataQuery = reactQueryState.queries.find(
    (q) => q.queryKey?.[0] === "cocolight-data"
  );

  return cocolightDataQuery?.state?.data ?? null;
}
```

**Fonctionnement** :
1. Le serveur SSR pré-charge les données `cocolight-data` via React Query
2. Ces données sont sérialisées dans `window.__REACT_QUERY_STATE__` (via `serialize-javascript`)
3. Côté client, si l'utilisateur n'est **pas connecté**, `createApiInstances()` réutilise ces données
4. L'entité est reconstituée via `Cocolight.helper.fromEntityJSON()` pour obtenir un objet SDK complet
5. Cela évite un appel réseau supplémentaire à `entityBySlug()` au premier render

**Condition d'activation** : `hydratedData && !isUserConnected` — si l'utilisateur est connecté, l'API est appelée normalement pour obtenir des données à jour.

### Token Storage Strategy selon l'environnement

Le choix du storage est passé en paramètre à `createApiInstances()` :

```ts
const isServer = typeof window === "undefined";

const tokenStorageStrategy = isServer
  ? await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory")
  : await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("localStorage");
```

- **Côté serveur** (`isServer = true`): Utilise `memory` (non persistant, évite les collisions entre requêtes)
- **Côté client** (`isServer = false`): Utilise `localStorage` (persistant entre sessions)

### Helpers pour accéder aux singletons

Le fichier expose des helpers pour accéder facilement aux instances **côté client** :

```ts
export async function getApiClient(): Promise<ApiClient> {
  if (!initialized) await initApiClient();
  return client!;
}

export async function getUserApi(): Promise<UserApi> {
  if (!initialized) await initApiClient();
  return userApiInstance!;
}

export async function getApi(): Promise<Api> {
  if (!initialized) await initApiClient();
  return api!;
}

// Alias simple pour initApiClient
export function initApi(options: InitApiOptions = {}) {
  return initApiClient(options);
}
```

**Usage recommandé** :
- `initApi()` : dans les loaders SSR et l'initialisation côté client (avec options)
- `getApiClient()`, `getApi()`, `getUserApi()` : accès lazy dans les composants client

### `resetApiState()`

Fonction de reset des globals du singleton, conservée pour la rétro-compatibilité :

```ts
export function resetApiState(): void {
  client = null;
  userApiInstance = null;
  api = null;
  cachedMe = null;
  cachedContextType = undefined;
  cachedContextId = undefined;
  cachedEntity = null;
  initialized = false;
  initPromise = null;
}
```

> **Note** : Cette fonction n'est plus nécessaire côté serveur car le serveur ne touche plus aux globals. Elle reste utile pour les tests unitaires ou un éventuel re-login côté client.

### Types et interfaces

```ts
export interface InitApiOptions {
  baseURL?: string;
  /** Toute option supplémentaire fournie par le SDK */
  [key: string]: unknown;
}

export interface InitApiResult {
  client: ApiClient;
  userApiInstance: UserApi;
  api: Api;
  me: User | null;
  contextType?: string;     // Type de l'entité contextuelle ("organizations", "events", etc.)
  contextId?: string;       // ID de l'entité contextuelle
  entity: Organization | Project | null; // L'entité complète (organization, project, event, etc.)
}
```

> **Changement** : le champ `organization: Organization | null` a été supprimé. L'entité contextuelle est désormais générique via `entity` (peut être une organization, un project, un event, etc.).

### Gestion du slug contextuel

Le slug contextuel provient de `getSlug()` (défini dans `src/lib/constant/common.ts`). Sa résolution tient compte de l'hydratation SSR :

```ts
const slug = getSlug();

// 1. Si données hydratées disponibles (et user non connecté) → utiliser directement
const hydratedData = getHydratedCocolightData();
if (hydratedData && !isUserConnected && hydratedData.entity) {
  entity = Cocolight.helper.fromEntityJSON(hydratedData.entity, newClient);
}

// 2. Sinon, résoudre via l'API
if (slug && !entity) {
  const resolved = me
    ? await me.entityBySlug(slug)    // Si connecté, via me.entityBySlug
    : await newApi.entitySlug(slug); // Sinon, via l'API publique
  if (resolved) {
    entity = resolved;
    contextType = resolved.getEntityType();
    contextId = resolved.id || undefined;
  }
}
```

**Optimisation** : l'appel réseau `entityBySlug()` est évité si les données sont déjà présentes dans l'hydratation SSR.

### Sécurité et gestion d'erreurs

L'initialisation dans `createApiInstances()` est entourée de try-catch pour garantir qu'une instance `Api` existe toujours :

```ts
try {
  if (newUserApi.client.isConnected) {
    const loggedUser = await newUserApi.meIsconnected();
    newApi = new Cocolight.Api(loggedUser, newUserApi.client);
    me = await newApi.me();
  } else {
    newApi = new Cocolight.Api(null, newUserApi.client);
  }
  // ... résolution slug
} catch (err) {
  console.error("[Api.init] Erreur lors de l'initialisation de l'API:", err);
  if (!newApi) {
    newApi = new Cocolight.Api(null, newUserApi.client); // Fallback: API non connectée
  }
}
```

**Garantie** : même en cas d'erreur réseau, l'application dispose d'une instance API fonctionnelle (non connectée).

### Usage dans les loaders SSR

Les loaders de routes utilisent `initApi()` pour créer des instances fraîches côté serveur :

```ts
// Dans routes.tsx du module profil
loader: async ({ params }) => {
  const { api, entity } = await initApi({
    baseURL: getBaseUrl(),
  });

  return await queryClient.ensureQueryData({
    queryKey: ["element-about", params.slug],
    queryFn: () => api.entitySlug(params.slug)
  });
}
```

**Avantage** : côté serveur, chaque requête SSR crée ses propres instances via `createApiInstances()`, aucun état global n'est partagé entre les requêtes concurrentes.

### Limitations et considérations

**Limitations restantes** :
- **Tests unitaires** : le singleton client nécessite un appel à `resetApiState()` entre tests
- **Re-login** : après logout côté client, il faut appeler `resetApiState()` pour forcer une ré-initialisation

**Problèmes résolus (par rapport à l'ancienne architecture)** :
- ~~SSR multi-requêtes~~ : le serveur crée désormais des instances fraîches par requête, plus aucune contamination inter-requêtes
- ~~Reset impossible~~ : `resetApiState()` est disponible pour les cas de re-login et les tests

---

## Stratégies de stockage des tokens

Le stockage des tokens d'authentification est géré par le SDK `@communecter/cocolight-api-client` via sa factory `createDefaultMultiServerTokenStorageStrategy()`. Cette stratégie permet de gérer l'authentification sur plusieurs serveurs simultanément (multi-tenant).

### Choix selon l'environnement

Le type de storage est passé en paramètre à `createApiInstances()` par `initApiClient()` :

```ts
// Serveur → "memory"
if (isServer) return createApiInstances(options, "memory");

// Client → "localStorage"
initPromise = createApiInstances(options, "localStorage").then(...);
```

**Deux modes de storage**:

| Mode           | Environnement | Backend           | Persistance | Usage                                      |
| -------------- | ------------- | ----------------- | ----------- | ------------------------------------------ |
| `"memory"`     | Server (SSR)  | Map en mémoire    | Non         | SSR, évite collisions entre requêtes       |
| `"localStorage"` | Client (Browser) | `window.localStorage` | Oui   | Client, tokens persistés entre sessions    |

### MultiServerTokenStorageStrategy

Cette stratégie (fournie par le SDK) gère l'authentification multi-serveurs :

**Fonctionnalités**:
- Stocke les tokens **par serveur** (indexés par `origin`)
- Permet l'authentification **simultanée** sur plusieurs instances Communecter
- Gère automatiquement les **access tokens** et **refresh tokens**
- Switch automatique entre storage backends selon l'environnement

**API** (exposée par le SDK):
```ts
interface TokenStorageStrategy {
  get(serverUrl: string): Promise<TokenPair | null>;
  set(serverUrl: string, tokens: TokenPair): Promise<void>;
  clear(serverUrl: string): Promise<void>;
  clearAll(): Promise<void>;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
```

**Exemple de structure en localStorage**:

```json
{
  "cocolight_tokens_https://api1.communecter.org": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "cocolight_tokens_https://api2.communecter.org": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Sécurité des tokens

**Côté client (localStorage)**:
- Les tokens sont stockés dans `localStorage` avec un préfixe `cocolight_tokens_`
- **Limitation**: `localStorage` est accessible par JavaScript, vulnérable aux attaques XSS
- **Recommandation**: Le SDK gère le refresh automatique des tokens expirés

**Côté serveur (memory)**:
- Les tokens sont stockés en mémoire (Map JavaScript) dans chaque instance créée par `createApiInstances()`
- Non persistant : les tokens sont perdus à chaque redémarrage du serveur
- **Isolation garantie** : chaque requête SSR crée ses propres instances, aucune contamination inter-requêtes

### Refresh automatique des tokens

Le SDK `@communecter/cocolight-api-client` gère automatiquement le refresh des tokens:

1. **Détection d'expiration**: Lors d'un appel API, si le `accessToken` est expiré (HTTP 401), le SDK déclenche automatiquement un refresh
2. **Refresh silencieux**: Utilise le `refreshToken` pour obtenir un nouveau `accessToken`
3. **Retry automatique**: Rejoue la requête initiale avec le nouveau token
4. **Mise à jour du storage**: Le nouveau `accessToken` est automatiquement stocké

**Avantage**: Les composants React n'ont pas besoin de gérer manuellement l'expiration des tokens.

### Gestion des erreurs de refresh

Si le `refreshToken` est également expiré:

1. Le SDK émet un événement `token-refresh-failed`
2. L'utilisateur est automatiquement déconnecté
3. Les tokens sont supprimés du storage
4. Redirection vers la page de login (si configurée)

**Gestion dans l'application**:

```ts
// Dans un provider React ou l'entrée de l'application
client.on('token-refresh-failed', () => {
  console.warn('Tokens expirés, déconnexion automatique');
  // Optionnel: Rediriger vers /login
  window.location.href = '/login';
});
```

### Clear tokens (logout)

Pour déconnecter un utilisateur et supprimer ses tokens:

```ts
import { getApiClient } from "@/lib/apiClient";

async function logout() {
  const client = await getApiClient();
  const baseURL = client.config.baseURL;

  // Supprimer les tokens du storage
  await client.tokenStorageStrategy.clear(baseURL);

  // Optionnel: Clear tous les tokens (multi-serveurs)
  await client.tokenStorageStrategy.clearAll();

  // Réinitialiser l'état de connexion
  window.location.href = '/';
}
```

### Vérification de l'état de connexion

Le SDK expose `client.isConnected` pour vérifier si l'utilisateur est authentifié:

```ts
const client = await getApiClient();

if (client.isConnected) {
  console.log('Utilisateur connecté');
  const me = await api.me();
} else {
  console.log('Utilisateur non connecté');
}
```

**Fonctionnement**:
- `isConnected` vérifie si un `accessToken` valide existe dans le storage
- Ne fait **pas** d'appel réseau (vérification locale uniquement)
- Peut être utilisé côté client pour afficher/masquer des éléments UI

---

## Contexte React (`CocolightContext`)

Le contexte `CocolightContext` et son provider `CocolightProvider` se trouvent dans `src/contexts/CocolightContext.tsx` et `CocolightProvider.tsx`.

### CocolightContext

Le contexte expose un type riche `CocolightContextType` (et non un simple `ApiClient`) :

```tsx
// src/contexts/CocolightContext.tsx
import Cocolight, { type Api, type ApiClient, type UserApi, type Organization, type User, Project, } from "@communecter/cocolight-api-client";
import { createContext, Dispatch, SetStateAction } from "react";

type CocolightHelper = typeof Cocolight.helper;

export interface CocolightContextType {
  /** Client HTTP bas niveau partagé par toutes les API */
  apiClient: ApiClient | null
  /** Facade utilisateur (login / logout / etc.) */
  userApi: UserApi | null
  /** Indique si l'initialisation est en cours */
  loading: boolean
  /** Utilisateur actuellement connecté (null si anonyme) */
  me: User | null
  /** API haut niveau REST, instanciée après login */
  api: Api | null
  /** Type de contexte résolu depuis le slug (organizations, projects, etc.) */
  contextType?: string
  /** ID du contexte résolu depuis le slug */
  contextId?: string
  /** Entité complète (organization, project, event, etc.) */
  entity: Organization | Project | null
  /** Helpers divers exposés par le SDK (pas encore typés) */
  helper: CocolightHelper
  /** Données temporaires transmises au profil */
  dataToProfile: unknown
  setDataToProfile: Dispatch<SetStateAction<unknown>>
}

export const CocolightContext = createContext<CocolightContextType | null>(null);
```

### CocolightProvider

Le provider utilise `useCocolightInit()` (qui s'appuie sur `useSuspenseQuery`) pour obtenir les données initiales, puis gère l'état mutable via des `useState` et des event listeners pour `userLoggedIn` / `sessionReset` :

```tsx
// src/contexts/CocolightProvider.tsx
import Cocolight, { type Api, type Organization, type User, type Project } from "@communecter/cocolight-api-client";
import { useEffect, useState, ReactNode, useMemo } from "react";
import { InitApiOptions } from "../lib/apiClient";
import { getSlug } from "../lib/constant/common";
import { CocolightContext } from "./CocolightContext";
import { useCocolightInit } from "@/hooks/useCocolightInit";

export interface CocolightProviderProps {
  children: ReactNode;
  clientOptions?: InitApiOptions;
}

const DEFAULT_CLIENT_OPTIONS: InitApiOptions = Object.freeze({});

export function CocolightProvider({
  children,
  clientOptions = DEFAULT_CLIENT_OPTIONS,
}: CocolightProviderProps) {

    /* 1 -- données initiales, déjà prêtes grâce à Suspense */
  const {
    client,
    userApiInstance,
    api: initialApi,
    me: initialMe,
    contextType: initialContextType,
    contextId: initialContextId,
    entity: initialEntity,
  } = useCocolightInit(clientOptions);

  // ----------------------------- state ------------------------------------
  const [api, setApi] = useState<Api | null>(initialApi);
  const [me, setMe] = useState<User | null>(initialMe as User | null);
  const [entity, setEntity] = useState<Organization | Project | null>(
    initialEntity as Organization | Project | null,
  );
  const [contextType, setContextType] = useState<string | undefined>(initialContextType);
  const [contextId, setContextId] = useState<string | undefined>(initialContextId);
  const [dataToProfile, setDataToProfile] = useState<unknown>(null);

  // ------------------- listeners (login / session) ------------------------
  useEffect(() => {
    if (!userApiInstance?.client) return;

    const handleUserLoggedIn = async () => {
      try {
        const loggedUser = await userApiInstance.meIsconnected();
        const refreshedApi = new Cocolight.Api(loggedUser, userApiInstance.client);
        const me = await refreshedApi.me();
        const slug = getSlug();

        if (slug) {
          try {
            const resolvedEntity = await me.entityBySlug(slug);
            if (resolvedEntity) {
              setEntity(resolvedEntity);
              setContextType(resolvedEntity.getEntityType());
              setContextId(resolvedEntity.id || undefined);
            }
          } catch (slugErr) {
            console.error("[CocolightProvider] Erreur lors de la résolution du slug:", slugErr);
          }
        }

        setMe(me);
        setApi(refreshedApi);
      } catch (error) {
        console.error("Erreur après login :", error);
      }
    };

    const handleSessionReset = async () => {
      setMe(null);
      if (userApiInstance?.client) {
        const apiReset = new Cocolight.Api(null, userApiInstance.client);
        setApi(apiReset);
        const slug = getSlug();
        const resolvedEntity = await apiReset.entitySlug(slug);
        setEntity(resolvedEntity as Organization | Project);
      }
    };

    const eventfulClient = userApiInstance.client;
    eventfulClient.on("userLoggedIn", handleUserLoggedIn);
    eventfulClient.on("sessionReset", handleSessionReset);

    return () => {
      eventfulClient.off("userLoggedIn", handleUserLoggedIn);
      eventfulClient.off("sessionReset", handleSessionReset);
    };
  }, [userApiInstance]);

  // ------------------------- Memo du contexte -----------------------------
  const contextValue = useMemo(
    () => ({
      apiClient: client,
      userApi: userApiInstance,
      api,
      me,
      contextType,
      contextId,
      entity,
      helper: Cocolight.helper,
      dataToProfile,
      setDataToProfile,
      loading: false,
    }),
    [client, userApiInstance, api, me, contextType, contextId, entity, dataToProfile],
  );

  return (
    <CocolightContext.Provider value={contextValue}>
      {children}
    </CocolightContext.Provider>
  );
}
```

**Points clés** :
* `useCocolightInit()` est appelé **dans** le provider (pas en dehors) -- il utilise `useSuspenseQuery` pour bloquer le rendu tant que l'API n'est pas prête
* L'état mutable (`me`, `api`, `entity`, etc.) est mis a jour via les event listeners `userLoggedIn` et `sessionReset`
* Le contexte est memoise via `useMemo` pour eviter les re-renders inutiles
* `loading` est toujours `false` car `useSuspenseQuery` garantit que les donnees sont pretes avant le rendu

---

## Hooks d'accès au client

### `useCocolight`

```ts
// src/hooks/useCocolight.tsx
import { useContext } from 'react';
import { CocolightContext } from '../contexts/CocolightContext';

export function useCocolight() {
  const context = useContext(CocolightContext);
  if (!context) {
    throw new Error('useCocolight must be used within a CocolightProvider');
  }
  return context;
}
```

* Retourne le `CocolightContextType` complet (pas un simple `ApiClient`) -- inclut `apiClient`, `userApi`, `api`, `me`, `entity`, `helper`, `contextType`, `contextId`, `dataToProfile`, `setDataToProfile`, `loading`.
* Lève une erreur si le provider n'est pas monté.

### `useCocolightInit`

```ts
// src/hooks/useCocolightInit.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { initApi, InitApiOptions, InitApiResult } from "@/lib/apiClient";

export function useCocolightInit(opts: InitApiOptions = {}) {
  const { data } = useSuspenseQuery<InitApiResult>({
    queryKey: ["cocolight-init"],
    queryFn : () => initApi(opts),
  });
  return data;
}
```

* Utilise `useSuspenseQuery` avec la queryKey `["cocolight-init"]` -- bloque le rendu (via Suspense) tant que l'API n'est pas initialisee.
* Retourne directement le `InitApiResult` (`client`, `userApiInstance`, `api`, `me`, `contextType`, `contextId`, `entity`).
* Appele **dans** `CocolightProvider`, pas en dehors.

---

## Flux d'authentification

1. **Login**

   * Le component `LoginForm` appelle `client.user().login({ email, password })`.
   * En cas de succès, les tokens sont stockés via la stratégie configurée.

2. **Requête API**

   * `ApiClient` injecte automatiquement le token d'accès dans l'en-tête `Authorization`.
   * En cas de 401, il tente un refresh via le token de rafraîchissement, puis retry.

3. **Logout**

   * Appel de `client.user().logout()`, puis `tokenStorage.clear()`.
   * Redirection ou mise à jour du state d'authentification.

---

## Exemple d'intégration

`useCocolightInit` est appele **dans** `CocolightProvider` (pas en dehors). Le `RootLayout` utilise simplement le provider :

```tsx
// RootLayout.tsx
import { CocolightProvider } from "@/contexts/CocolightProvider";

const Layout: FC = ({ children }) => {
  return (
    <CocolightProvider>
      {children}
    </CocolightProvider>
  );
};
```

Dans un composant :

```tsx
import { useCocolight } from "@/hooks/useCocolight";

export function Profile() {
  const { me, entity, api } = useCocolight();
  return <div>Bonjour, {me?.serverData?.name}</div>;
}
```

---

## Sécurité et validation

La robustesse de SiteForge repose sur plusieurs couches de validation et de protection pour éviter les vulnérabilités courantes (injections, XSS, CSRF...).

---

### Validation des schémas JSON (Zod)

Toutes les données provenant de la configuration JSON sont validées **au runtime** grâce à Zod. Cela permet :

* **Détecter les valeurs manquantes** ou hors-type avant le rendu.
* **Empêcher l'exécution** de sections mal configurées.
* **Générer** des types TypeScript fiables (`z.infer<...>`) pour l'autocomplétion et le refactoring.

```ts
import { SiteConfigSchema } from "@/types/site-schema";

try {
  const config = SiteConfigSchema.parse(window.__CONFIG__);
} catch (err) {
  console.error("Configuration invalide :", err.errors);
  // Arrêter l'exécution ou afficher un message d'erreur convivial
}
```

> **Bonnes pratiques**
>
> * Toujours `.parse()` (qui lance une exception) ou `.safeParse()` (qui renvoie un objet `{ success, error }`).
> * Ne jamais se fier à du simple `typeof` ou des assertions manuelles.

---

### Sanitisation du contenu (DOMPurify)

Certains champs (Markdown inline, HTML dans `html` ou `markdown` sections) peuvent contenir du code HTML. Pour prévenir le **Cross-Site Scripting (XSS)** :

* Utilisation de **DOMPurify** pour nettoyer tout HTML avant insertion dans le DOM.

```ts
import DOMPurify from "dompurify";

// Dans MarkdownSection.tsx
const cleanHtml = useMemo(() => DOMPurify.sanitize(props.md), [props.md]);
return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
```

> **Remarque** : ne jamais utiliser `dangerouslySetInnerHTML` sans cette étape de sanitisation.

---

## Voir aussi

- [Architecture](03-architecture.md)
- [Permissions](10-permissions.md)
- [Backend & SSR](14-backend-ssr.md)
