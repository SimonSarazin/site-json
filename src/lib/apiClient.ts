/*
 * api-client.ts (TypeScript)
 * --------------------------------------------------
 * Wrapper typé autour du SDK JavaScript @communecter/cocolight-api-client.
 * Il utilise les déclarations situées dans
 *   src/@types/communecter__cocolight-api-client.d.ts
 * que nous avons ajoutées précédemment.  Toute nouvelle méthode que tu
 * appelles pourra être renseignée petit à petit dans ce fichier .d.ts.
 */

import Cocolight, { type Api, type ApiClient, type User, type UserApi } from "@communecter/cocolight-api-client";
import { getBaseUrl, getSlug } from "./constant/common";

// ————————————————————————————————————————————————————————————
// Types utilitaires — dérivés automatiquement depuis la lib JS
// ————————————————————————————————————————————————————————————

export interface InitApiOptions {
  baseURL?: string;
  /** Toute option supplémentaire fournie par le SDK */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Type pour les données hydratées SSR
interface CocolightHydratedData {
  me: Record<string, unknown> | null;
  entity: Record<string, unknown> | null;
  contextType?: string;
  contextId?: string;
}

/**
 * Récupère les données hydratées de cocolight-data depuis le state React Query
 */
function getHydratedCocolightData(): CocolightHydratedData | null {
  if (typeof window === "undefined") return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reactQueryState = (window as any).__REACT_QUERY_STATE__;
    if (!reactQueryState?.queries) return null;

    // Chercher la query cocolight-data dans le state
    const cocolightDataQuery = reactQueryState.queries.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) => q.queryKey?.[0] === "cocolight-data"
    );

    return cocolightDataQuery?.state?.data ?? null;
  } catch {
    return null;
  }
}

export interface InitApiResult {
  client: ApiClient;
  userApiInstance: UserApi;
  api: Api;
  me: User | null;
  contextType?: string;
  contextId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity?: any; // L'entité complète (organization, project, event, etc.)
}

// ————————————————————————————————————————————————————————————
// Variables d’état internes
// ————————————————————————————————————————————————————————————

let client: ApiClient | null             = null;
let userApiInstance: UserApi | null      = null;
let api: Api | null                      = null;
let cachedMe: User | null                = null;
let cachedContextType: string | undefined = undefined;
let cachedContextId: string | undefined = undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedEntity: any                    = null;
let initialized = false;
let initPromise: Promise<InitApiResult> | null = null;

// Reset pour SSR - à appeler au début de chaque requête
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

// ————————————————————————————————————————————————————————————
// Initialisation unique
// ————————————————————————————————————————————————————————————

export async function initApiClient(
  options: InitApiOptions = {},
): Promise<InitApiResult> {
  if (initialized) {
    // Non‑null assertion car, par définition, tout est prêt
    return {
      client: client!,
      userApiInstance: userApiInstance!,
      api: api!,
      me: cachedMe,
      contextType: cachedContextType,
      contextId: cachedContextId,
      entity: cachedEntity,
    };
  }
  if (initPromise) return initPromise;

  initPromise = (async (): Promise<InitApiResult> => {
    const isServer = typeof window === "undefined";

    // Choix du backend de stockage pour les tokens
    const tokenStorageStrategy = isServer
      ? await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy(
          "memory",
        )
      : await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy(
          "localStorage",
        );

    // Instanciation du client HTTP
    client = new Cocolight.ApiClient({
      baseURL: options.baseURL ?? getBaseUrl(),
      ...options,
      debug: import.meta.env.DEV ?? false,
      tokenStorageStrategy,
    });

      // Facade UserApi
    userApiInstance = Cocolight.Api.userApi(client);
    initialized = true;

    cachedMe = null;
    cachedContextType = undefined;
    cachedContextId = undefined;
    cachedEntity = null;
    const slug = getSlug();

    // Vérifier s'il y a des données hydratées du SSR
    // On utilise le cache SSR seulement si l'user n'est pas connecté
    // Car les données d'un user connecté peuvent être différentes (droits, données personnelles)
    const hydratedData = getHydratedCocolightData();
    const isUserConnected = userApiInstance.client.isConnected;

    if (hydratedData && !isUserConnected) {
      if (import.meta.env.DEV) {
        console.log("[Api.init] User non connecté - utilisation du cache SSR");
      }

      // Transformer les données JSON en instances avec le client
      if (hydratedData.entity) {
        cachedEntity = Cocolight.helper.fromEntityJSON(hydratedData.entity, client);
        cachedContextType = hydratedData.contextType;
        cachedContextId = hydratedData.contextId;
      }
    }

    try {
      if (userApiInstance.client.isConnected) {
        const loggedUser = await userApiInstance.meIsconnected();
        api = new Cocolight.Api(loggedUser, userApiInstance.client);
        cachedMe = await api.me();
      } else {
        api = new Cocolight.Api(null, userApiInstance.client);
      }

      // Seulement fetch le slug si on n'a pas déjà les données hydratées
      if (slug && !cachedEntity) {
        try {
          const entity = cachedMe ?  await cachedMe.entityBySlug(slug) : await api.entitySlug(slug);

          if (entity) {
            cachedEntity = entity;
            cachedContextType = entity.getEntityType();
            cachedContextId = entity.id || undefined;
          }
        } catch (slugErr) {
          console.error("[Api.init] Erreur lors de la résolution du slug:", slugErr);
        }
      }
    } catch (err) {
      console.error("[Api.init] Erreur lors de l'initialisation de l'API:", err);
      if (!api) {
        api = new Cocolight.Api(null, userApiInstance.client);
      }
    }

    return {
      client,
      userApiInstance,
      api,
      me: cachedMe,
      contextType: cachedContextType,
      contextId: cachedContextId,
      entity: cachedEntity,
    } as InitApiResult;
  })();

  return initPromise;
}

// ————————————————————————————————————————————————————————————
// Helpers retournant les singletons typés
// ————————————————————————————————————————————————————————————

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

export function initApi(options: InitApiOptions = {}) {
  // 👉 retourne directement la promesse, sans la cacher dans un singleton
  return initApiClient(options);
}