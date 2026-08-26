import { describe, it, expect } from "vitest";
import { platformKanbanUrl } from "./platformKanbanUrl";

describe("platformKanbanUrl — lien kanban actions de la plateforme", () => {
  it("compose <serverUrl>/#@<slug>.view.actions", () => {
    expect(platformKanbanUrl("https://www.communecter.org", "sportSanteBienetre")).toBe(
      "https://www.communecter.org/#@sportSanteBienetre.view.actions",
    );
  });

  it("normalise les slashs finaux de la base (jamais de // avant le hash)", () => {
    expect(platformKanbanUrl("https://www.communecter.org/", "monCostum")).toBe(
      "https://www.communecter.org/#@monCostum.view.actions",
    );
    expect(platformKanbanUrl("http://localhost:3000//", "monCostum")).toBe(
      "http://localhost:3000/#@monCostum.view.actions",
    );
  });
});
