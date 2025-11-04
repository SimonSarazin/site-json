/*
 * api-client.ts (TypeScript)
 * --------------------------------------------------
 * Wrapper typé autour du SDK JavaScript @communecter/cocolight-api-client.
 * Il utilise les déclarations situées dans
 *   src/@types/communecter__cocolight-api-client.d.ts
 * que nous avons ajoutées précédemment.  Toute nouvelle méthode que tu
 * appelles pourra être renseignée petit à petit dans ce fichier .d.ts.
 */

import Cocolight, { type Api, type ApiClient, type Organization, type User, type UserApi } from "@communecter/cocolight-api-client";
import { getBaseUrl, getSlug } from "./constant/common";

// ————————————————————————————————————————————————————————————
// Types utilitaires — dérivés automatiquement depuis la lib JS
// ————————————————————————————————————————————————————————————

export interface InitApiOptions {
  baseURL?: string;
  debug?: boolean;
  /** Toute option supplémentaire fournie par le SDK */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface InitApiResult {
  client: ApiClient;
  userApiInstance: UserApi;
  api: Api;
  me: User | null;
  organization: Organization | null;
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
let cachedOrganization: Organization | null = null;
let cachedContextType: string | undefined = undefined;
let cachedContextId: string | undefined = undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedEntity: any                    = null;
let initialized = false;
let initPromise: Promise<InitApiResult> | null = null;

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
      organization: cachedOrganization,
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
      debug: options.debug ?? false,
      ...options,
      tokenStorageStrategy,
    });

      // Facade UserApi
    userApiInstance = Cocolight.Api.userApi(client);
    initialized = true;

    cachedMe = null;
    cachedOrganization = null;
    cachedContextType = undefined;
    cachedContextId = undefined;
    cachedEntity = null;
    const slug = getSlug();

    try {
      if (userApiInstance.client.isConnected) {
        const loggedUser = await userApiInstance.meIsconnected();
        api = new Cocolight.Api(loggedUser, userApiInstance.client);
        cachedMe = await api.me();
      } else {
        api = new Cocolight.Api(null, userApiInstance.client);
      }

      if (slug) {
        try {
          const baseURL = options.baseURL ?? getBaseUrl();
          const slugInfoUrl = `${baseURL}/co2/slug/getinfo/key/${slug}`;
          const slugResponse = await fetch(slugInfoUrl);

          if (slugResponse.ok) {
            const slugInfo = await slugResponse.json();
            cachedContextType = slugInfo.contextType;
            cachedContextId = slugInfo.contextId;

            if (cachedContextType && cachedContextId) {
              const entityUrl = `${baseURL}/co2/element/about/type/${cachedContextType}/id/${cachedContextId}/json/true`;
              const entityResponse = await fetch(entityUrl);

              if (entityResponse.ok) {
                const rawEntity = await entityResponse.json();

                if (cachedContextType === "organizations") {
                  cachedOrganization = cachedMe
                    ? await cachedMe.organization({ slug })
                    : await api.organization({ slug });
                }

                try {
                  if (cachedOrganization) {
                    cachedEntity = Cocolight.helper.fromEntityJSON(rawEntity, cachedOrganization);
                  } else {
                    cachedEntity = Cocolight.helper.fromEntityJSON(rawEntity, null);
                  }
                } catch (conversionError) {
                  console.warn("[Api.init] Impossible de convertir l'entité, utilisation des données brutes:", conversionError);
                  cachedEntity = rawEntity;
                }
              }
            }
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
      organization: cachedOrganization,
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