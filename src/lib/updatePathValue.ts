import type { UpdatePathValueData } from "@communecter/cocolight-api-client";

/**
 * Normalise le payload `updatePathValue` avant envoi au backend :
 *  - Collapse `setType: [{type: "isoDate"}, ...]` → `setType: "isoDate"` quand la
 *    `value` est une string (le backend préfère la forme scalaire dans ce cas).
 *  - Force `value: ""` quand un `pull` est combiné à une `value` vide/null/undefined
 *    (le backend attend une string vide pour interpréter le pull).
 *
 * Préférer appeler `api.endpointApi.updatePathValue(normalizeUpdatePathValuePayload(...))`
 * (typé, accessible via `useCocolight()`) plutôt que de passer par l'`ApiClient` brut.
 */
export function normalizeUpdatePathValuePayload(
  payload: UpdatePathValueData,
): UpdatePathValueData {
  const isIsoDateSetTypeArray =
    Array.isArray(payload.setType) &&
    payload.setType.length > 0 &&
    payload.setType.every((item) => item?.type === "isoDate");

  if (typeof payload.value === "string" && isIsoDateSetTypeArray) {
    return { ...payload, setType: "isoDate" };
  }

  if (payload.pull && (payload.value === "" || payload.value === null || payload.value === undefined)) {
    return { ...payload, value: "" };
  }

  return payload;
}
