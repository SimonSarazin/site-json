// api-client.js
import Cocolight from "@communecter/cocolight-api-client";

import { getBaseUrl, getSlug } from "./constant/common";

let client = null;
let userApiInstance = null;
let api = null;
let initialized = false;
let initPromise = null;

/**
 * Initialise le client API une seule fois.
 * Utilisé en interne ou explicitement si tu veux forcer l'init.
 * @returns {Promise<{ client, userApiInstance }>}
 */
export async function initApiClient(options = {}) {
  if (initialized) return { client, userApiInstance, api };
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const isServer = typeof window === "undefined";

    const tokenStorageStrategy = isServer ? await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory") : await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("localStorage");

    client = new Cocolight.ApiClient({
      baseURL: options.baseURL ?? getBaseUrl(),
      debug: options.debug ?? false,
      ...options,
      tokenStorageStrategy,
    });

    userApiInstance = Cocolight.Api.userApi(client);
    initialized = true;
    let me = null;
    let organization = null;

    const slug = getSlug();
    if(userApiInstance.client.isConnected) {
      const loggedUser = await userApiInstance.meIsconnected();
      api = new Cocolight.Api(loggedUser, userApiInstance.client);
      me = await api.me();
      organization = await me.organization({ slug: slug });
    } else {
      api = new Cocolight.Api(null, userApiInstance.client);
      organization = await api.organization({ slug: slug });
    }

    return { client, userApiInstance, api, me, organization };
  })();

  return initPromise;
}

/**
 * Récupère le client API, en s'assurant qu'il est initialisé.
 * @returns {Promise<ApiClient>}
 */
export async function getApiClient() {
  if (!initialized) await initApiClient();
  return client;
}

/**
 * Récupère l'instance UserApi, en s'assurant qu'elle est initialisée.
 * @returns {Promise<UserApi>}
 */
export async function getUserApi() {
  if (!initialized) await initApiClient();
  return userApiInstance;
}

export async function getApi() {
  if (!initialized) await initApiClient();
  return api;
}