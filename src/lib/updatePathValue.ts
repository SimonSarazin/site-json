export type UpdatePathValuePayload = {
  id: string;
  collection: string;
  path: string;
  pull?: string;
  value: unknown;
  arrayForm?: boolean;
  setType?:
    | string
    | Array<{
        path: string;
        type: string;
      }>;
};

type DirectUpdater = {
  updatePathValue?: (payload: UpdatePathValuePayload) => Promise<unknown>;
};

type EndpointApiContainer = {
  endpointApi?: DirectUpdater;
};

type EndpointCaller = {
  callEndpoint?: (endpointName: string, payload: UpdatePathValuePayload) => Promise<unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getDirectUpdater(source: unknown): ((payload: UpdatePathValuePayload) => Promise<unknown>) | null {
  if (!isObject(source)) return null;

  const asDirect = source as DirectUpdater;
  if (typeof asDirect.updatePathValue === "function") {
    return asDirect.updatePathValue.bind(source);
  }

  const asContainer = source as EndpointApiContainer;
  if (isObject(asContainer.endpointApi) && typeof asContainer.endpointApi.updatePathValue === "function") {
    return asContainer.endpointApi.updatePathValue.bind(asContainer.endpointApi);
  }

  return null;
}

function getEndpointCaller(source: unknown): ((endpointName: string, payload: UpdatePathValuePayload) => Promise<unknown>) | null {
  if (!isObject(source)) return null;

  const asCaller = source as EndpointCaller;
  if (typeof asCaller.callEndpoint === "function") {
    return asCaller.callEndpoint.bind(source);
  }

  return null;
}

function normalizeUpdatePathValuePayload(payload: UpdatePathValuePayload): UpdatePathValuePayload {
  const isIsoDateSetTypeArray =
    Array.isArray(payload.setType) &&
    payload.setType.length > 0 &&
    payload.setType.every((item) => item?.type === "isoDate");

  if (typeof payload.value === "string" && isIsoDateSetTypeArray) {
    return {
      ...payload,
      setType: "isoDate",
    };
  }

  if (payload.pull && (payload.value === "" || payload.value === null || payload.value === undefined)) {
    return {
      ...payload,
      value: "",
    };
  }
  return payload;
}

/**
 * Wrapper unique pour les updates atomiques via updatePathValue.
 * Accepte: entity.endpointApi, endpointApi direct, apiClient (callEndpoint), etc.
 */
export async function updatePathValue(source: unknown, payload: UpdatePathValuePayload): Promise<unknown> {
  if (!payload.id || !payload.collection || !payload.path) {
    throw new Error("updatePathValue: payload invalide (id/collection/path requis)");
  }

  const normalizedPayload = normalizeUpdatePathValuePayload(payload);
  console.log("Anatolelog 6", payload , normalizeUpdatePathValuePayload(payload));
  const directUpdater = getDirectUpdater(source);
  if (directUpdater) {
    return directUpdater(normalizedPayload);
  }

  const endpointCaller = getEndpointCaller(source);
  if (endpointCaller) {
    return endpointCaller("UPDATE_PATH_VALUE", normalizedPayload);
  }

  throw new Error("updatePathValue indisponible: aucune methode compatible trouvee (endpointApi.updatePathValue ou callEndpoint)");
}
