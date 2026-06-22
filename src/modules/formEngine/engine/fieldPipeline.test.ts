import { describe, it, expect, beforeAll } from "vitest";
import type { FormDescriptor } from "../types";
import { registerTransform } from "./transforms";
import { seedFromEntity, valuesToPayload, diffForEdit, clearValue } from "./fieldPipeline";

beforeAll(() => {
  registerTransform("test:upper", (v) => (typeof v === "string" ? v.toUpperCase() : v));
  registerTransform("test:lower", (v) => (typeof v === "string" ? v.toLowerCase() : v));
  // Groupe "social" : objet serveur {github,facebook} ↔ champs plats github/facebook.
  registerTransform("test:socialRead", (obj) => {
    const o = (obj ?? {}) as Record<string, unknown>;
    return { github: String(o.github ?? ""), facebook: String(o.facebook ?? "") };
  });
  registerTransform("test:socialWrite", (all) => {
    const v = all as Record<string, unknown>;
    const out: Record<string, string> = {};
    if (v.github) out.github = String(v.github);
    if (v.facebook) out.facebook = String(v.facebook);
    return Object.keys(out).length ? out : undefined; // vide → clé omise
  });
});

// Descripteur minimal : un remap de nom (structureName↔holderOrganization via path), un champ avec read/write,
// un array, et un groupe atomique "address" (2 champs flat).
const D: FormDescriptor = {
  id: "t", collection: "organizations", layout: { kind: "flat" }, sections: [],
  fields: {
    name: { name: "name", type: "string", widget: "text", label: "" },
    structureName: { name: "structureName", path: "holderOrganization", type: "string", widget: "text", label: "" },
    code: { name: "code", type: "string", widget: "text", label: "", read: "test:upper", write: "test:lower" },
    tags: { name: "tags", type: "array", widget: "tags", label: "" },
    addressLocality: { name: "addressLocality", type: "string", widget: "text", label: "", atomicGroup: "address" },
    codeInsee: { name: "codeInsee", type: "string", widget: "text", label: "", atomicGroup: "address" },
  },
};

describe("fieldPipeline — seedFromEntity (READ)", () => {
  it("lit serverData[path ?? name] + applique read", () => {
    const v = seedFromEntity(D, { name: "N", holderOrganization: "kkk", code: "abc", tags: ["x"] });
    expect(v.name).toBe("N");
    expect(v.structureName).toBe("kkk");       // path → holderOrganization
    expect(v.code).toBe("ABC");                // read test:upper
    expect(v.tags).toEqual(["x"]);
  });
});

describe("fieldPipeline — valuesToPayload (WRITE)", () => {
  it("applique write + écrit à path ?? name, payload COMPLET (vides compris)", () => {
    const p = valuesToPayload(D, { name: "N", structureName: "kkk", code: "ABC", tags: [], addressLocality: "", codeInsee: "" });
    expect(p.holderOrganization).toBe("kkk");  // name form → path serveur
    expect(p.code).toBe("abc");                // write test:lower
    expect(p.tags).toEqual([]);                // émis même vide
    expect("structureName" in p).toBe(false);  // jamais la clé form, seulement le path
  });
});

describe("fieldPipeline — diffForEdit (diff baseline-aware + clear)", () => {
  it("inchangé → omis ; modifié → valeur", () => {
    const delta = diffForEdit(D, { name: "B", holderOrganization: "kkk" }, { name: "A", holderOrganization: "kkk" });
    expect(delta).toEqual({ name: "B" });
  });

  it("champ vidé → clear typé ('' pour string, [] pour array), JAMAIS {}", () => {
    const payload = { holderOrganization: "", tags: [] };
    const baseline = { holderOrganization: "kkk", tags: ["x"] };
    expect(diffForEdit(D, payload, baseline)).toEqual({ holderOrganization: "", tags: [] });
  });

  it("objet vidé → '' (pas {})", () => {
    const Dobj: FormDescriptor = { ...D, fields: { social: { name: "social", type: "object", widget: "editSocial", label: "" } } };
    const delta = diffForEdit(Dobj, { social: {} }, { social: { facebook: "u" } });
    expect(delta).toEqual({ social: "" });
  });

  it("clear explicite respecté (field.clear)", () => {
    const Dc: FormDescriptor = { ...D, fields: { x: { name: "x", type: "string", widget: "text", label: "", clear: null } } };
    expect(diffForEdit(Dc, { x: "" }, { x: "v" })).toEqual({ x: null });
  });

  it("groupe atomique : si UN membre change, TOUT le groupe est émis (même les membres inchangés)", () => {
    // addressLocality change (Paris→Lyon), codeInsee INCHANGÉ — mais tous deux dans atomicGroup "address".
    const delta = diffForEdit(D,
      { addressLocality: "Lyon", codeInsee: "75001" },
      { addressLocality: "Paris", codeInsee: "75001" });
    expect(delta).toEqual({ addressLocality: "Lyon", codeInsee: "75001" }); // codeInsee inchangé MAIS émis (atomique)
  });

  it("skip exclut des clés (ex. tags mergés à part)", () => {
    const delta = diffForEdit(D, { holderOrganization: "", tags: [] }, { holderOrganization: "k", tags: ["x"] }, { skip: ["tags"] });
    expect(delta).toEqual({ holderOrganization: "" });
  });
});

// Groupe de sérialisation : champs plats github/facebook ↔ objet serveur socialNetwork.
const DG: FormDescriptor = {
  id: "g", collection: "organizations", layout: { kind: "flat" }, sections: [],
  serializeGroups: { social: { serverKey: "socialNetwork", read: "test:socialRead", write: "test:socialWrite" } },
  fields: {
    name: { name: "name", type: "string", widget: "text", label: "" },
    github: { name: "github", type: "string", widget: "text", label: "", group: "social" },
    facebook: { name: "facebook", type: "string", widget: "text", label: "", group: "social" },
  },
};

describe("fieldPipeline — groupes de sérialisation (N plats ↔ 1 objet serveur)", () => {
  it("READ : objet serveur socialNetwork → champs plats github/facebook", () => {
    const v = seedFromEntity(DG, { name: "N", socialNetwork: { github: "g", facebook: "f" } });
    expect(v).toMatchObject({ name: "N", github: "g", facebook: "f" });
  });

  it("WRITE : champs plats → objet serveur socialNetwork ; membres jamais émis individuellement", () => {
    const p = valuesToPayload(DG, { name: "N", github: "g", facebook: "" });
    expect(p.socialNetwork).toEqual({ github: "g" }); // facebook vide → omis par le write du groupe
    expect("github" in p).toBe(false);
    expect("facebook" in p).toBe(false);
  });

  it("WRITE : groupe entièrement vide → clé serveur OMISE (undefined)", () => {
    const p = valuesToPayload(DG, { name: "N", github: "", facebook: "" });
    expect("socialNetwork" in p).toBe(false);
  });

  it("DIFF : groupe vidé (présent baseline, absent payload) → effacé ('')", () => {
    const payload = valuesToPayload(DG, { name: "N", github: "", facebook: "" });   // pas de socialNetwork
    const baseline = valuesToPayload(DG, { name: "N", github: "g", facebook: "f" }); // socialNetwork présent
    expect(diffForEdit(DG, payload, baseline)).toEqual({ socialNetwork: "" });
  });
});

describe("fieldPipeline — clearValue", () => {
  it("dérive du type, field.clear prioritaire", () => {
    expect(clearValue({ name: "a", type: "string", widget: "text", label: "" })).toBe("");
    expect(clearValue({ name: "a", type: "array", widget: "tags", label: "" })).toEqual([]);
    expect(clearValue({ name: "a", type: "object", widget: "editSocial", label: "" })).toBe(""); // objet → "" (pas {})
    expect(clearValue({ name: "a", type: "string", widget: "text", label: "", clear: null })).toBe(null);
  });
});
