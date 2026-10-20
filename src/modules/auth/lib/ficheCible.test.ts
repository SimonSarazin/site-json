import { describe, it, expect, vi } from "vitest";
import type { Api } from "@communecter/cocolight-api-client";
import { chargeurDeFiche, cheminFicheCible } from "./ficheCible";

describe("chargeurDeFiche", () => {
  it("un chargeur par type de fiche, null sinon", () => {
    expect(chargeurDeFiche("organizations")).toBe("organization");
    expect(chargeurDeFiche("projects")).toBe("project");
    expect(chargeurDeFiche("events")).toBe("event");
    expect(chargeurDeFiche("citoyens")).toBeNull();
    expect(chargeurDeFiche(undefined)).toBeNull();
  });
});

describe("cheminFicheCible", () => {
  it("relit le slug de la cible et rend `/profil/<slug>`", async () => {
    const organization = vi.fn().mockResolvedValue({ slug: "laPlumeALoup" });
    const api = { organization } as unknown as Api;
    expect(await cheminFicheCible(api, "organizations", "abc")).toBe("/profil/laPlumeALoup");
    expect(organization).toHaveBeenCalledWith({ id: "abc" });
  });

  it("type sans fiche ou fiche sans slug → null", async () => {
    const api = { organization: vi.fn().mockResolvedValue({ slug: null }) } as unknown as Api;
    expect(await cheminFicheCible(api, "citoyens", "x")).toBeNull();
    expect(await cheminFicheCible(api, "organizations", "x")).toBeNull();
  });
});
