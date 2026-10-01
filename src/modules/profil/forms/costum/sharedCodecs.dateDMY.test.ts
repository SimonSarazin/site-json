/**
 * Codec `dateDMY` (sharedCodecs) : widget date (« AAAA-MM-JJ ») ↔ date serveur « JJ/MM/AAAA », le format
 * du dynform legacy — mesuré sur les CAE de la base : `openingDate` = « 18/06/2019 ».
 */
import { describe, it, expect } from "vitest";
import "./sharedRegistrations"; // side-effect : enregistre dateDMY:read / dateDMY:write
import { applyTransform } from "@/modules/formEngine/engine/transforms";

const lire = (v: unknown) => applyTransform("dateDMY:read", v, {} as never);
const ecrire = (v: unknown) => applyTransform("dateDMY:write", v, {} as never);

describe("dateDMY:read", () => {
  it("« JJ/MM/AAAA » du legacy → valeur du widget", () => {
    expect(lire("18/06/2019")).toBe("2019-06-18");
  });
  it("jour et mois sans zéro initial", () => {
    expect(lire("1/6/2019")).toBe("2019-06-01");
  });
  it("une date déjà ISO passe", () => {
    expect(lire("2019-06-18")).toBe("2019-06-18");
    expect(lire("2019-06-18T00:00:00.000Z")).toBe("2019-06-18");
  });
  it("vide ou illisible → vide (jamais une date inventée)", () => {
    expect(lire(undefined)).toBe("");
    expect(lire("")).toBe("");
    expect(lire("juin 2019")).toBe("");
  });
});

describe("dateDMY:write", () => {
  it("valeur du widget → « JJ/MM/AAAA », le format du parc", () => {
    expect(ecrire("2019-06-18")).toBe("18/06/2019");
  });
  it("vide → chaîne vide, pour que le serveur efface la date", () => {
    expect(ecrire("")).toBe("");
    expect(ecrire(undefined)).toBe("");
  });
  it("aller-retour sans perte", () => {
    expect(ecrire(lire("06/12/2007"))).toBe("06/12/2007");
  });
});
