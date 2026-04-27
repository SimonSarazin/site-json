/*
 * api-client.ts (TypeScript)
 * --------------------------------------------------
 * Wrapper typé autour du SDK JavaScript @communecter/cocolight-api-client.
 * Il utilise les déclarations situées dans
 *   src/@types/communecter__cocolight-api-client.d.ts
 * que nous avons ajoutées précédemment.  Toute nouvelle méthode que tu
 * appelles pourra être renseignée petit à petit dans ce fichier .d.ts.
 */

import Cocolight, { type Api, type ApiClient, type Organization, type Project, type User, type UserApi } from "@communecter/cocolight-api-client";
import { getBaseUrl, getSlug } from "./constant/common";

const COSTUM_PROJECT_ACTION_REQUEST_NEW_ENDPOINT = {
  auth: "none",
  constant: "COSTUM_PROJECT_ACTION_REQUEST_NEW",
  contentType: "application/x-www-form-urlencoded",
  functionCocostum: "costumProjectActionRequestNew",
  method: "POST",
  path: "/costum/project/action/request/new",
  request: {
    additionalProperties: true,
    properties: {
      name: { type: "string" },
      status: { type: "string", enum: ["todo", "done"], default: "todo" },
      parentId: { type: "string", pattern: "^[a-f0-9]{24}$" },
      parentType: { type: "string", const: "projects", default: "projects" },
      credits: { type: "number", minimum: 0 },
      milestone: {
        type: "object",
        additionalProperties: false,
        properties: {
          milestoneId: { type: "string", pattern: "^[a-f0-9]{24}$" },
        },
        required: ["milestoneId"],
      },
    },
    required: ["name", "status", "parentId", "parentType", "credits"],
    type: "object",
  },
};

const UPDATE_PATH_VALUE_ENDPOINT_OVERRIDE = {
  auth: "bearer",
  constant: "UPDATE_PATH_VALUE",
  contentType: "application/x-www-form-urlencoded",
  method: "POST",
  path: "/co2/element/updatepathvalue",
  request: {
    type: "object",
    additionalProperties: true,
    properties: {
      id: { type: "string", minLength: 1 },
      collection: { type: "string", minLength: 1 },
      path: { type: "string", minLength: 1 },
      pull: { type: "string", minLength: 1 },
      value: {},
      arrayForm: { type: "boolean" },
      setType: {
        anyOf: [
          { type: "string", minLength: 1 },
          {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                path: { type: "string" },
                type: { type: "string" },
              },
              required: ["path", "type"],
            },
          },
        ],
      },
    },
    required: ["id", "collection", "path", "value"],
  },
};

const DELETE_ACTION_BY_ID_ENDPOINT = {
  auth: "bearer",
  constant: "DELETE_ACTION_BY_ID",
  contentType: "application/x-www-form-urlencoded",
  method: "POST",
  path: "/co2/element/delete/type/actions/id/{id}",
  request: {
    type: "object",
    additionalProperties: true,
    properties: {
      id: { type: "string", minLength: 1 },
    },
    required: ["id"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function registerMissingCustomEndpoints(apiClient: ApiClient): void {
  const clientWithInternals = apiClient as unknown as { _endpoints?: Array<{ constant?: string }> };
  if (!Array.isArray(clientWithInternals._endpoints)) return;

  const overrideConstants = new Set([
    COSTUM_PROJECT_ACTION_REQUEST_NEW_ENDPOINT.constant,
    UPDATE_PATH_VALUE_ENDPOINT_OVERRIDE.constant,
    DELETE_ACTION_BY_ID_ENDPOINT.constant,
  ]);

  const filteredEndpoints = clientWithInternals._endpoints.filter(
    (endpoint) => !overrideConstants.has(endpoint?.constant || ""),
  );
  filteredEndpoints.push(COSTUM_PROJECT_ACTION_REQUEST_NEW_ENDPOINT);
  filteredEndpoints.push(UPDATE_PATH_VALUE_ENDPOINT_OVERRIDE);
  filteredEndpoints.push(DELETE_ACTION_BY_ID_ENDPOINT);
  clientWithInternals._endpoints = filteredEndpoints;
}

// ————————————————————————————————————————————————————————————
// Types utilitaires — dérivés automatiquement depuis la lib JS
// ————————————————————————————————————————————————————————————

export interface InitApiOptions {
  baseURL?: string;
  /** Toute option supplémentaire fournie par le SDK */
  [key: string]: unknown;
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
    const reactQueryState = window.__REACT_QUERY_STATE__;
    if (!reactQueryState?.queries) return null;

    // Chercher la query cocolight-data dans le state
    const cocolightDataQuery = reactQueryState.queries.find(
      (q) => q.queryKey?.[0] === "cocolight-data"
    );

    return (cocolightDataQuery?.state?.data as CocolightHydratedData | undefined) ?? null;
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
  entity: Organization | Project | null; // L'entité complète (organization, project, event, etc.)
}

// ————————————————————————————————————————————————————————————
// Logique d’init commune — purement fonctionnelle (pas de globals)
// ————————————————————————————————————————————————————————————

async function createApiInstances(
  options: InitApiOptions,
  storageType: "memory" | "localStorage",
): Promise<InitApiResult> {
  const tokenStorageStrategy =
    await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy(
      storageType,
    );

  const newClient = new Cocolight.ApiClient({
    baseURL: options.baseURL ?? getBaseUrl(),
    ...options,
    debug: typeof window !== "undefined" && (import.meta.env.DEV ?? false),
    tokenStorageStrategy,
  });

  const newUserApi = Cocolight.Api.userApi(newClient);

  let me: User | null = null;
  let contextType: string | undefined;
  let contextId: string | undefined;
  let entity: Organization | Project | null = null;
  let newApi: Api;

  const slug = getSlug();

  // Hydratation SSR côté client uniquement
  const hydratedData = getHydratedCocolightData();
  const isUserConnected = newUserApi.client.isConnected;

  if (hydratedData && !isUserConnected) {
    if (import.meta.env.DEV) {
      console.log("[Api.init] User non connecté - utilisation du cache SSR");
    }
    if (hydratedData.entity) {
      entity = Cocolight.helper.fromEntityJSON(hydratedData.entity, newClient) as Organization | Project;
      contextType = hydratedData.contextType;
      contextId = hydratedData.contextId;
    }
  }

  try {
    if (newUserApi.client.isConnected) {
      const loggedUser = await newUserApi.meIsconnected();
      newApi = new Cocolight.Api(loggedUser, newUserApi.client);
      me = await newApi.me();
    } else {
      newApi = new Cocolight.Api(null, newUserApi.client);
    }

    if (slug && !entity) {
      try {
        const resolved = me
          ? await me.entityBySlug(slug)
          : await newApi.entitySlug(slug);
        if (resolved) {
          entity = resolved;
          contextType = resolved.getEntityType();
          contextId = resolved.id || undefined;
        }
      } catch (slugErr) {
        console.error("[Api.init] Erreur lors de la résolution du slug:", slugErr);
      }
    }
  } catch (err) {
    console.error("[Api.init] Erreur lors de l’initialisation de l’API:", err);
    // @ts-expect-error newApi peut ne pas être assigné si l’erreur est dans la première branche
    if (!newApi) {
      newApi = new Cocolight.Api(null, newUserApi.client);
    }
  }

  return {
    client: newClient,
    userApiInstance: newUserApi,
    api: newApi,
    me,
    contextType,
    contextId,
    entity,
  };
}

// ————————————————————————————————————————————————————————————
// Variables d’état CLIENT uniquement (singleton navigateur)
// Côté serveur, ces variables ne sont jamais utilisées.
// ————————————————————————————————————————————————————————————

let client: ApiClient | null             = null;
let userApiInstance: UserApi | null      = null;
let api: Api | null                      = null;
let cachedMe: User | null                = null;
let cachedContextType: string | undefined = undefined;
let cachedContextId: string | undefined = undefined;
let cachedEntity: Organization | Project | null = null;
let initialized = false;
let initPromise: Promise<InitApiResult> | null = null;

// Reset pour SSR — conservé pour rétro-compatibilité mais plus nécessaire
// car le serveur ne touche plus aux globals
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
// Point d’entrée
// - Serveur : instances fraîches à chaque appel (pas de globals)
//   → le queryClient de chaque requête gère le cache
// - Client  : singleton via globals (un seul user, pas de concurrence)
// ————————————————————————————————————————————————————————————

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