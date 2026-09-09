import { describe, it, expect } from "vitest";
import {
  isCoformAnswerManager,
  getAnswerRef,
  getAnswerStructureId,
  normalizeStatus,
  normalizeTypeLabel,
  parseCoformAnswer,
} from "./coformAnswer";

describe("getAnswerRef", () => {
  const FORM_ID = "6928096adf5caf0d230e7f26";

  it("extrait id + formId d'une instance SDK (getter id)", () => {
    const item = { id: "abc123", serverData: { form: FORM_ID } };
    expect(getAnswerRef(item)).toEqual({ answerId: "abc123", formId: FORM_ID });
  });

  it("replie sur l'EJSON brut serverData._id.$oid quand le getter id est absent", () => {
    const item = { serverData: { _id: { $oid: "def456" }, form: FORM_ID } };
    expect(getAnswerRef(item)).toEqual({ answerId: "def456", formId: FORM_ID });
  });

  it("préfère le getter id de l'instance au $oid brut", () => {
    const item = { id: "abc123", serverData: { _id: { $oid: "def456" }, form: FORM_ID } };
    expect(getAnswerRef(item)?.answerId).toBe("abc123");
  });

  it("renvoie null sans formId (item non-answer : org, projet…)", () => {
    expect(getAnswerRef({ id: "abc123", serverData: { name: "Une orga" } })).toBeNull();
  });

  it("renvoie null si formId n'est pas une string non vide", () => {
    expect(getAnswerRef({ id: "abc123", serverData: { form: "" } })).toBeNull();
    expect(getAnswerRef({ id: "abc123", serverData: { form: 42 } })).toBeNull();
  });

  it("renvoie null sans answerId ni serverData", () => {
    expect(getAnswerRef({ serverData: { form: FORM_ID } })).toBeNull();
    expect(getAnswerRef({ id: "abc123" })).toBeNull();
    expect(getAnswerRef(null)).toBeNull();
    expect(getAnswerRef(undefined)).toBeNull();
  });

  it("tolère un id null (instance SDK sans id posé)", () => {
    expect(getAnswerRef({ id: null, serverData: { form: FORM_ID } })).toBeNull();
  });
});

describe("getAnswerStructureId", () => {
  const ORG_ID = "69281757564b0621d52ebb67";

  it("accepte les encodages d'_id rencontrés selon le chemin de sérialisation", () => {
    // `_str` = payload SSR observé sur /creneaux ; `$oid` = EJSON ; `$id` = dump PHP.
    expect(getAnswerStructureId({ structure: { _id: { _str: ORG_ID } } })).toBe(ORG_ID);
    expect(getAnswerStructureId({ structure: { _id: { $oid: ORG_ID } } })).toBe(ORG_ID);
    expect(getAnswerStructureId({ structure: { _id: { $id: ORG_ID } } })).toBe(ORG_ID);
    expect(getAnswerStructureId({ structure: { _id: ORG_ID } })).toBe(ORG_ID);
  });

  it("renvoie null sans structure exploitable", () => {
    expect(getAnswerStructureId({ structure: { name: "ADAPTETONSPORT" } })).toBeNull();
    expect(getAnswerStructureId({ structure: { _id: "" } })).toBeNull();
    expect(getAnswerStructureId({})).toBeNull();
    expect(getAnswerStructureId(undefined)).toBeNull();
  });
});

describe("isCoformAnswerManager", () => {
  const ORG_ID = "69281757564b0621d52ebb67";
  const answer = { structure: { _id: { _str: ORG_ID } } };
  const lambda = { isSuperAdmin: () => false, isAdminPlatform: () => false };
  const notCostumAdmin = { isAdmin: () => false };

  it("autorise le super-admin plateforme, même sans lien avec la structure", () => {
    const superAdmin = { isSuperAdmin: () => true, isAdminPlatform: () => false };
    expect(isCoformAnswerManager(answer, { me: superAdmin, entity: notCostumAdmin })).toBe(true);
    const platformAdmin = { isSuperAdmin: () => false, isAdminPlatform: () => true };
    expect(isCoformAnswerManager(answer, { me: platformAdmin, entity: notCostumAdmin })).toBe(true);
  });

  it("autorise l'admin du costum (entité porteuse du site)", () => {
    expect(isCoformAnswerManager(answer, { me: lambda, entity: { isAdmin: () => true } })).toBe(true);
  });

  it("autorise l'admin de la structure organisatrice du créneau", () => {
    const orgAdmin = { ...lambda, serverData: { links: { memberOf: { [ORG_ID]: { isAdmin: true } } } } };
    expect(isCoformAnswerManager(answer, { me: orgAdmin, entity: notCostumAdmin })).toBe(true);
  });

  it("refuse un admin d'une AUTRE structure", () => {
    const otherOrgAdmin = {
      ...lambda,
      serverData: { links: { memberOf: { "111111111111111111111111": { isAdmin: true } } } },
    };
    expect(isCoformAnswerManager(answer, { me: otherOrgAdmin, entity: notCostumAdmin })).toBe(false);
  });

  it("refuse un droit d'admin non validé (pending / invitation / à valider)", () => {
    const link = (extra: Record<string, boolean>) => ({
      ...lambda,
      serverData: { links: { memberOf: { [ORG_ID]: { isAdmin: true, ...extra } } } },
    });
    expect(isCoformAnswerManager(answer, { me: link({ isAdminPending: true }), entity: notCostumAdmin })).toBe(false);
    expect(isCoformAnswerManager(answer, { me: link({ toBeValidated: true }), entity: notCostumAdmin })).toBe(false);
    expect(isCoformAnswerManager(answer, { me: link({ isInviting: true }), entity: notCostumAdmin })).toBe(false);
  });

  it("refuse un simple membre, un visiteur non connecté, et une answer sans structure", () => {
    const member = { ...lambda, serverData: { links: { memberOf: { [ORG_ID]: { isAdmin: false } } } } };
    expect(isCoformAnswerManager(answer, { me: member, entity: notCostumAdmin })).toBe(false);
    expect(isCoformAnswerManager(answer, { me: null, entity: notCostumAdmin })).toBe(false);
    expect(isCoformAnswerManager({}, { me: lambda, entity: notCostumAdmin })).toBe(false);
  });
});

describe("normalizeStatus", () => {
  it("préserve les statuts intermédiaires et normalise le reste", () => {
    expect(normalizeStatus("En attente")).toBe("En attente");
    expect(normalizeStatus("En cours")).toBe("En cours");
    expect(normalizeStatus("Réfusé")).toBe("Refuse");
    expect(normalizeStatus("Refuse")).toBe("Refuse");
    expect(normalizeStatus("")).toBe("Valide");
    expect(normalizeStatus("n'importe quoi")).toBe("Valide");
  });
});

describe("normalizeTypeLabel", () => {
  it("abrège les types connus, renvoie la valeur brute sinon", () => {
    expect(normalizeTypeLabel("Sport santé sur ordonnance - SSsO")).toBe("SSsO");
    expect(normalizeTypeLabel("Sport santé pour tous - SSpT")).toBe("SSpT");
    expect(normalizeTypeLabel("Autre")).toBe("Autre");
  });
});

describe("parseCoformAnswer — résolution des clés par SUFFIXE stable (inter-forms)", () => {
  // Les deux sections réelles : le form SSBE historique et le form dédié Ekilib.re
  // (6a85af345d898a57cb49f029). Mêmes ids d'inputs, sections différentes — le
  // mapping DEFAULT_COFORM_FIELDS doit résoudre les deux sans configuration.
  const SSBE = "sportSanteBienetre2172025_854_0";
  const EKILIBRE = "associationEkilibre19082026_1327_0";

  const flatRow = (section: string) => ({
    name: "Basket",
    [`${section}mdegc9sgox76p87n27`]: "Basket",
    [`${section}mdn1cs8on3yru1p80lq`]: "Sport santé sur ordonnance - SSsO",
    [`${section}mdn1jcq445i0mb9bap7`]: "En attente",
    [`${section}mdeggo91owe8t9ovl4p`]: "Séance douce",
    [`finder${section}mocno9muqzznoo0gyx`]: { abc: { id: "abc", name: "Gymnase du Tampon" } },
  });

  it("résout les clés préfixées SSBE (comportement historique)", () => {
    const a = parseCoformAnswer(flatRow(SSBE));
    expect(a.title).toBe("Basket");
    expect(a.typeLabel).toBe("SSsO");
    expect(a.status).toBe("En attente");
    expect(a.description).toBe("Séance douce");
    expect(a.installations).toEqual([{ id: "abc", name: "Gymnase du Tampon" }]);
  });

  it("résout les clés du form dédié Ekilib.re avec le MÊME mapping par défaut", () => {
    const a = parseCoformAnswer(flatRow(EKILIBRE));
    expect(a.title).toBe("Basket");
    expect(a.typeLabel).toBe("SSsO");
    expect(a.status).toBe("En attente");
  });

  it("un override `fields` historique portant la clé complète reste valide (match par suffixe)", () => {
    const a = parseCoformAnswer(flatRow(SSBE), {
      fields: { title: `${SSBE}mdegc9sgox76p87n27` },
    });
    expect(a.title).toBe("Basket");
  });

  it("champ absent des données → replis habituels (pas de crash)", () => {
    const a = parseCoformAnswer({ name: "Sans champs coform" });
    expect(a.title).toBe("Sans champs coform");
    expect(a.status).toBe("Valide");
    expect(a.installations).toEqual([]);
    expect(a.schedules).toEqual([]);
  });
});
