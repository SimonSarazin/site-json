/*
 * api-client.ts (TypeScript)
 * --------------------------------------------------
 * Wrapper typé autour du SDK JavaScript @communecter/cocolight-api-client.
 * Il utilise les déclarations situées dans
 *   src/@types/communecter__cocolight-api-client.d.ts
 * que nous avons ajoutées précédemment.  Toute nouvelle méthode que tu
 * appelles pourra être renseignée petit à petit dans ce fichier .d.ts.
 */

import Cocolight from "@communecter/cocolight-api-client";
import { getBaseUrl, getSlug } from "./constant/common";

// ————————————————————————————————————————————————————————————
// Types utilitaires — dérivés automatiquement depuis la lib JS
// ————————————————————————————————————————————————————————————

type ApiClient = InstanceType<typeof Cocolight.ApiClient>;
type UserApi   = ReturnType<typeof Cocolight.Api.userApi>;
type Api       = InstanceType<typeof Cocolight.Api>;

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
  me: unknown | null;
  organization: unknown | null;
}

// ————————————————————————————————————————————————————————————
// Variables d’état internes
// ————————————————————————————————————————————————————————————

let client: ApiClient | null             = null;
let userApiInstance: UserApi | null      = null;
let api: Api | null                      = null;
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
      me: null,
      organization: null,
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

    let me: unknown | null           = null;
    let organization: unknown | null = null;
    const slug = getSlug();

    try {
      if (userApiInstance.client.isConnected) {
        const loggedUser = await userApiInstance.meIsconnected();
        api = new Cocolight.Api(loggedUser, userApiInstance.client);

        me = await api.me();
        // Certaines versions renvoient une fonction, d’autres une propriété :
        // on caste en any pour ne pas bloquer.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        organization = await (me as any).organization({ slug });
      } else {
        api = new Cocolight.Api(null, userApiInstance.client);
        organization = await api.organization({ slug });
      }
    } catch (err) {
      console.error("Error initializing API:", err);
      api = new Cocolight.Api(null, userApiInstance.client);
    }

    return { client, userApiInstance, api, me, organization } as InitApiResult;
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
