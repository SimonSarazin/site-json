import Cocolight, { KANBAN_ENDPOINT_CONSTANTS } from "@communecter/cocolight-api-client";
import { describe, expect, test } from "vitest";
import { kanbanRouteName, kanbanRoutePath } from "./kanbanRoutes";

/**
 * Le chemin d'une route est DÉRIVÉ de sa constante : si le SDK renomme, déplace ou retire une
 * route kanban, ou en ajoute une qui ne suit pas la forme `KANBAN_<ctrl>_<action>_URL`, c'est ici
 * que ça casse, pas en production.
 */
describe("routes kanban du SDK", () => {
  const client = new Cocolight.ApiClient({ baseURL: "http://unit.invalid" });
  const registry = (client as unknown as { _endpointsByConstant: Map<string, Record<string, unknown>> })._endpointsByConstant;

  test("le SDK exporte 20 constantes, et chacune donne son nom court", () => {
    expect(KANBAN_ENDPOINT_CONSTANTS).toHaveLength(20);
    expect(kanbanRouteName("KANBAN_BOARD_SYNC_URL")).toBe("board/sync");
    expect(kanbanRoutePath("KANBAN_CARD_MOVE_URL")).toBe("/costum/kanban-card/move");
  });

  test("chaque constante est dans le registre du SDK, avec le chemin dérivé, en POST JSON sous jeton", () => {
    for (const constant of KANBAN_ENDPOINT_CONSTANTS) {
      const entry = registry.get(constant);
      expect(entry, constant).toBeDefined();
      expect(entry).toMatchObject({ path: kanbanRoutePath(constant), method: "POST", contentType: "application/json", auth: "bearer" });
    }
  });

  test("marqueurs `keepNulls` et `rawResponse` sur chaque route : les `null` d'effacement arrivent au serveur, la réponse n'est pas transformée", () => {
    for (const constant of KANBAN_ENDPOINT_CONSTANTS) {
      const entry = registry.get(constant);
      expect(entry, constant).toMatchObject({ keepNulls: true, rawResponse: true });
      // Le schéma `request` du SDK déclare les champs effaçables nullables : `null` passe la validation.
      expect(entry?.request, constant).toBeDefined();
    }
    const update = (registry.get("KANBAN_CARD_UPDATE_URL")?.request as { properties: Record<string, { type: unknown }> }).properties;
    for (const field of ["priority", "dueDate", "startDate", "milestoneId"]) expect(update[field]?.type, field).toContain("null");
  });
});
