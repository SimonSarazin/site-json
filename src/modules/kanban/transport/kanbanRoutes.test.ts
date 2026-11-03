import Cocolight, { KANBAN_ENDPOINT_CONSTANTS } from "@communecter/cocolight-api-client";
import { describe, expect, test } from "vitest";
import { KANBAN_ROUTES } from "./kanbanRoutes";

/**
 * La table locale constante → chemin est un MIROIR du registre du SDK installé : si le SDK
 * renomme, déplace ou retire une route kanban, c'est ici que ça casse, pas en production.
 */
describe("routes kanban du SDK", () => {
  const client = new Cocolight.ApiClient({ baseURL: "http://unit.invalid" });
  const registry = (client as unknown as { _endpointsByConstant: Map<string, Record<string, unknown>> })._endpointsByConstant;

  test("les 20 constantes du module sont celles que le SDK exporte, dans le même ordre", () => {
    expect(Object.keys(KANBAN_ROUTES)).toEqual([...KANBAN_ENDPOINT_CONSTANTS]);
  });

  test("chaque constante est dans le registre du SDK, avec SON chemin, en POST JSON sous jeton", () => {
    for (const [constant, path] of Object.entries(KANBAN_ROUTES)) {
      const entry = registry.get(constant);
      expect(entry, constant).toBeDefined();
      expect(entry).toMatchObject({ path, method: "POST", contentType: "application/json", auth: "bearer" });
    }
  });

  test("marqueurs `keepNulls` et `rawResponse` sur chaque route : les `null` d'effacement arrivent au serveur, la réponse n'est pas transformée", () => {
    for (const constant of Object.keys(KANBAN_ROUTES)) {
      const entry = registry.get(constant);
      expect(entry, constant).toMatchObject({ keepNulls: true, rawResponse: true });
      // Le schéma `request` du SDK déclare les champs effaçables nullables : `null` passe la validation.
      expect(entry?.request, constant).toBeDefined();
    }
    const update = (registry.get("KANBAN_CARD_UPDATE_URL")?.request as { properties: Record<string, { type: unknown }> }).properties;
    for (const field of ["priority", "dueDate", "startDate", "milestoneId"]) expect(update[field]?.type, field).toContain("null");
  });
});
