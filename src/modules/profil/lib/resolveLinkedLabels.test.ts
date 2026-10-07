import { describe, it, expect } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { resolveLinkedLabels } from "./resolveLinkedLabels";

const item = (id: string, links: Record<string, unknown>): SearchEntity =>
  ({ id, serverData: { id, links } }) as unknown as SearchEntity;

describe("resolveLinkedLabels — carte Agenda/Projets « Mes lieux » : quel lieu a fait remonter cet item", () => {
  it("résout le nom du lieu membre trouvé dans le champ de lien demandé", () => {
    const orgs = new Map([["org-1", "La Plume à Loup"]]);
    const evt = item("evt-1", { organizer: { "org-1": true } });
    expect(resolveLinkedLabels([evt], ["organizer"], orgs)).toEqual({ "evt-1": "La Plume à Loup" });
  });

  it("plusieurs champs de lien (attendees OU organizer, cas agenda) — le premier match compte", () => {
    const orgs = new Map([["org-1", "La Plume à Loup"]]);
    const evt = item("evt-1", { attendees: { "org-1": true }, organizer: {} });
    expect(resolveLinkedLabels([evt], ["attendees", "organizer"], orgs)).toEqual({ "evt-1": "La Plume à Loup" });
  });

  it("plusieurs lieux membres liés au même item → noms joints, sans doublon", () => {
    const orgs = new Map([["org-1", "La Plume à Loup"], ["org-2", "Kiltir Lab"]]);
    const evt = item("evt-1", { organizer: { "org-1": true, "org-2": true } });
    expect(resolveLinkedLabels([evt], ["organizer"], orgs)).toEqual({ "evt-1": "La Plume à Loup, Kiltir Lab" });
  });

  it("un id lié qui n'est PAS un de mes lieux (autre organisateur) n'apparaît pas", () => {
    const orgs = new Map([["org-1", "La Plume à Loup"]]);
    const evt = item("evt-1", { organizer: { "org-inconnu": true } });
    expect(resolveLinkedLabels([evt], ["organizer"], orgs)).toEqual({});
  });

  it("un item sans le champ de lien du tout est simplement absent du résultat", () => {
    const orgs = new Map([["org-1", "La Plume à Loup"]]);
    const evt = item("evt-1", {});
    expect(resolveLinkedLabels([evt], ["organizer"], orgs)).toEqual({});
  });

  it("liste vide → map vide", () => {
    expect(resolveLinkedLabels([], ["organizer"], new Map())).toEqual({});
  });
});
