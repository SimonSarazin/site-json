import { describe, it, expect } from "vitest";
import { rolesDuMembre } from "./memberRoles";

const ROLE = "Coordonnateur(trice) départemental du réseau à la Fédération des Centres Sociaux Nord Pas-de-Calais";

describe("rolesDuMembre", () => {
  it("lit les rôles portés par le membre (contexte de lien)", () => {
    const liensMembre = { organizations: {}, members: { org1: { roles: [ROLE] } } };
    expect(rolesDuMembre(liensMembre, "org1", null, "m1")).toEqual([ROLE]);
  });

  it("à défaut, lit les liens de l'entité parente — forme réelle observée sur parent62", () => {
    const liensEntite = { members: { m1: { type: "citoyens", roles: [ROLE] } } };
    expect(rolesDuMembre(null, "org1", liensEntite, "m1")).toEqual([ROLE]);
  });

  it("couvre les trois familles : members, contributors, attendees", () => {
    expect(rolesDuMembre(null, "x", { contributors: { m1: { roles: ["Dev"] } } }, "m1")).toEqual(["Dev"]);
    expect(rolesDuMembre(null, "x", { attendees: { m1: { roles: ["Invité"] } } }, "m1")).toEqual(["Invité"]);
  });

  it("aucun rôle renseigné : tableau vide — c'est le cas des 5 autres membres de parent62", () => {
    expect(rolesDuMembre(null, "org1", { members: { m1: { type: "citoyens" } } }, "m1")).toEqual([]);
    expect(rolesDuMembre(null, "org1", { members: {} }, "m1")).toEqual([]);
    expect(rolesDuMembre(null, null, null, null)).toEqual([]);
  });

  it("ignore ce qui n'est pas une chaîne plutôt que d'afficher [object Object]", () => {
    const liens = { members: { m1: { roles: ["Bon", 42, null, { x: 1 }, "  ", " Espacé "] } } };
    expect(rolesDuMembre(null, "x", liens, "m1")).toEqual(["Bon", "Espacé"]);
  });

  it("le membre prime sur l'entité quand les deux portent des rôles", () => {
    const liensMembre = { members: { org1: { roles: ["À jour"] } } };
    const liensEntite = { members: { m1: { roles: ["Périmé"] } } };
    expect(rolesDuMembre(liensMembre, "org1", liensEntite, "m1")).toEqual(["À jour"]);
  });
});
