import { describe, it, expect, beforeAll } from "vitest";
import type { FormDescriptor } from "../types";
import { registerTransform } from "./transforms";
import { seedFromEntity, valuesToPayload, clearValue } from "./fieldPipeline";

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

  it("applique field.default si serveur vide (parité buildEditDefaults `toX(server) || defaults.X`)", () => {
    const Dd: FormDescriptor = { ...D, fields: {
      type: { name: "type", type: "string", widget: "text", label: "", default: "recoveryCenter" },
      name: { name: "name", type: "string", widget: "text", label: "" }, // pas de défaut
    } };
    expect(seedFromEntity(Dd, {})).toEqual({ type: "recoveryCenter", name: undefined }); // création → défaut
    expect(seedFromEntity(Dd, { type: "place", name: "N" })).toEqual({ type: "place", name: "N" }); // serveur prime
    expect(seedFromEntity(Dd, { type: "" })).toMatchObject({ type: "recoveryCenter" }); // "" serveur → défaut
  });
});

describe("fieldPipeline — valuesToPayload (WRITE)", () => {
  it("applique write + écrit à path ?? name ; vides typés émis, undefined OMIS", () => {
    const p = valuesToPayload(D, { name: "N", structureName: "kkk", code: "ABC", tags: [], addressLocality: "", codeInsee: "" });
    expect(p.holderOrganization).toBe("kkk");  // name form → path serveur
    expect(p.code).toBe("abc");                // write test:lower
    expect(p.tags).toEqual([]);                // vide typé [] émis
    expect("structureName" in p).toBe(false);  // jamais la clé form, seulement le path
    // champs NON fournis (undefined) → clés OMISES (pas posées undefined)
    const p2 = valuesToPayload(D, { name: "N" });
    expect(p2).toEqual({ name: "N" });
    expect("code" in p2).toBe(false);
    expect("holderOrganization" in p2).toBe(false);
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
});

// Flags writeOnly / readOnly / groupReadOnly (S1) — UN descripteur read+write par entité.
const DF: FormDescriptor = {
  id: "f", collection: "organizations", layout: { kind: "flat" }, sections: [],
  serializeGroups: { social: { serverKey: "socialNetwork", read: "test:socialRead", write: "test:socialWrite", groupReadOnly: true } },
  fields: {
    nm: { name: "nm", type: "string", widget: "text", label: "" },
    geo: { name: "geo", type: "object", widget: "hidden", label: "", writeOnly: true },
    computed: { name: "computed", type: "string", widget: "hidden", label: "", readOnly: true },
    github: { name: "github", type: "string", widget: "text", label: "", group: "social" },
    facebook: { name: "facebook", type: "string", widget: "text", label: "", group: "social" },
  },
};

describe("fieldPipeline — flags writeOnly / readOnly / groupReadOnly", () => {
  it("READ : writeOnly ignoré ; readOnly lu ; groupReadOnly décompose l'objet serveur en champs plats", () => {
    const v = seedFromEntity(DF, { nm: "N", geo: { x: 1 }, computed: "c", socialNetwork: { github: "g", facebook: "f" } });
    expect(v).toEqual({ nm: "N", computed: "c", github: "g", facebook: "f" }); // geo absent (writeOnly)
  });

  it("WRITE : writeOnly émis ; readOnly omis ; groupReadOnly → membres à plat (pas d'objet groupe)", () => {
    const p = valuesToPayload(DF, { nm: "N", geo: { x: 1 }, computed: "c", github: "g", facebook: "" });
    expect(p).toEqual({ nm: "N", geo: { x: 1 }, github: "g", facebook: "" }); // computed omis (readOnly), pas de socialNetwork (groupReadOnly)
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

describe("fieldPipeline — valuesToPayload emitEmpty (ÉDITION : payload COMPLET, vides typés)", () => {
  it("émet TOUS les champs éditables ; vides → clear typé ('' string, [] array)", () => {
    const p = valuesToPayload(D, { name: "N", structureName: "", code: "", tags: [] }, { emitEmpty: true });
    expect(p).toMatchObject({ name: "N", holderOrganization: "", code: "", tags: [] });
  });

  it("groupe : entièrement vide → clé serveur '' (vs OMISE en création)", () => {
    const create = valuesToPayload(DG, { name: "N", github: "", facebook: "" });
    expect("socialNetwork" in create).toBe(false);                                    // création : omis
    const edit = valuesToPayload(DG, { name: "N", github: "", facebook: "" }, { emitEmpty: true });
    expect(edit.socialNetwork).toBe("");                                              // édition : clear ""
  });

  it("flags : writeOnly vidé → clear ; readOnly TOUJOURS omis ; groupReadOnly → membres à plat", () => {
    const p = valuesToPayload(DF, { nm: "", geo: {}, computed: "c", github: "", facebook: "" }, { emitEmpty: true });
    expect(p.nm).toBe("");                     // string vide → ""
    expect(p.geo).toBe("");                    // writeOnly objet vidé → "" (clear typé)
    expect("computed" in p).toBe(false);       // readOnly jamais émis (même en édition)
    expect(p.github).toBe("");                 // groupReadOnly membre émis à plat
    expect("socialNetwork" in p).toBe(false);  // groupReadOnly : pas d'objet groupe
  });

  it("préserve false / 0 (NON vides — pas de clear)", () => {
    const Db: FormDescriptor = { ...D, fields: {
      flag: { name: "flag", type: "boolean", widget: "switch", label: "" },
      n: { name: "n", type: "number", widget: "text", label: "" },
    } };
    const p = valuesToPayload(Db, { flag: false, n: 0 }, { emitEmpty: true });
    expect(p.flag).toBe(false);
    expect(p.n).toBe(0);
  });
});
