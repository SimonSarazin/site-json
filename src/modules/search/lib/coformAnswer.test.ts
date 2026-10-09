import { describe, it, expect } from "vitest";
import {
  canEditCoformAnswer,
  getAnswerCitedStructures,
  isCoformAnswerManager,
  isCoformAnswerOwner,
  getAnswerRef,
  getAnswerStructureId,
  normalizeStatus,
  normalizeTypeLabel,
  parseCoformAnswer,
  statusKey,
  getStatusStyle,
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

describe("isCoformAnswerOwner — l'auteur, tel que le juge le serveur (`answer.user`)", () => {
  const ME = "6448f244ecf6e50e4b539677";

  it("reconnaît l'auteur quand la recherche PROJETTE `user`", () => {
    expect(isCoformAnswerOwner({ user: ME }, { id: ME })).toBe(true);
  });

  it("refuse un autre compte, un visiteur, et un `user` non projeté ou vide", () => {
    expect(isCoformAnswerOwner({ user: ME }, { id: "5f0f0f0f0f0f0f0f0f0f0f0a" })).toBe(false);
    expect(isCoformAnswerOwner({ user: ME }, null)).toBe(false);
    expect(isCoformAnswerOwner({}, { id: ME })).toBe(false);
    // Créneaux importés : `user` absent ou null — un `me` sans id ne doit pas « matcher » le vide.
    expect(isCoformAnswerOwner({ user: null }, { id: null })).toBe(false);
    expect(isCoformAnswerOwner({ user: "" }, { id: "" })).toBe(false);
  });

  it("ignore `links.answered` (contributeurs d'une réponse partagée, que le serveur refuserait)", () => {
    expect(isCoformAnswerOwner({ links: { answered: [ME] } }, { id: ME })).toBe(false);
  });
});

describe("getAnswerCitedStructures — toutes les structures du finder aplati", () => {
  const CLE = "findersportSanteBienetre2172025_854_0mdn1fzoewyjg66n85p";
  const A = "5f0f0f0f0f0f0f0f0f0f0f0a";
  const B = "5f0f0f0f0f0f0f0f0f0f0f0b";

  it("TOUTES, quand la jointure `structure` ne garde que la dernière ; clé résolue par suffixe", () => {
    const data = {
      [CLE]: { [A]: { id: A, name: "Club A", type: "organizations" }, [B]: { id: B, name: "Club B" } },
      structure: { _id: B, name: "Club B" },
    };
    expect(getAnswerCitedStructures(data)).toEqual([
      { id: A, name: "Club A" },
      { id: B, name: "Club B" },
    ]);
  });

  it("clé fournie par l'appelant (config) ; autre formulaire = autre préfixe, même suffixe", () => {
    const autre = "finderassociationEkilibre19082026_1327_0mdn1fzoewyjg66n85p";
    expect(getAnswerCitedStructures({ [autre]: { [A]: { name: "Club A" } } }, { finderKey: autre })).toEqual([{ id: A, name: "Club A" }]);
    expect(getAnswerCitedStructures({ [autre]: { [A]: { name: "Club A" } } })).toEqual([{ id: A, name: "Club A" }]);
  });

  it("ignore les clés qui ne sont pas des ids ; nom absent = \"\" ; rien sans finder", () => {
    expect(getAnswerCitedStructures({ [CLE]: { [A]: {}, nope: { name: "x" } } })).toEqual([{ id: A, name: "" }]);
    expect(getAnswerCitedStructures({})).toEqual([]);
    expect(getAnswerCitedStructures({ [CLE]: "cassé" })).toEqual([]);
    expect(getAnswerCitedStructures(undefined)).toEqual([]);
  });
});

describe("canEditCoformAnswer — « Modifier » : gestionnaire OU auteur", () => {
  it("l'admin d'une co-structure NON jointe peut modifier (comme le serveur), sans gérer la fiche jointe", () => {
    const CO = "5f0f0f0f0f0f0f0f0f0f0f0a";
    const JOINTE = "5f0f0f0f0f0f0f0f0f0f0f0b";
    const answer = {
      findersportSanteBienetre2172025_854_0mdn1fzoewyjg66n85p: { [CO]: { name: "Co" }, [JOINTE]: { name: "Jointe" } },
      structure: { _id: JOINTE },
    };
    const adminCo = { isSuperAdmin: () => false, isAdminPlatform: () => false, serverData: { links: { memberOf: { [CO]: { isAdmin: true } } } } };
    expect(canEditCoformAnswer(answer, { me: adminCo, entity: { isAdmin: () => false } })).toBe(true);
    expect(isCoformAnswerManager(answer, { me: adminCo, entity: { isAdmin: () => false } })).toBe(false);
  });

  const ME = "6448f244ecf6e50e4b539677";
  const lambda = { id: ME, isSuperAdmin: () => false, isAdminPlatform: () => false };
  const notCostumAdmin = { isAdmin: () => false };

  it("l'auteur sans droit de gestion peut modifier — sans devenir gestionnaire (la « Fiche structure » reste fermée)", () => {
    const answer = { user: ME, structure: { _id: "69281757564b0621d52ebb67" } };
    expect(canEditCoformAnswer(answer, { me: lambda, entity: notCostumAdmin })).toBe(true);
    expect(isCoformAnswerManager(answer, { me: lambda, entity: notCostumAdmin })).toBe(false);
  });

  it("le gestionnaire peut modifier sans être l'auteur", () => {
    expect(canEditCoformAnswer({ user: "autre" }, { me: lambda, entity: { isAdmin: () => true } })).toBe(true);
  });

  it("ni gestionnaire ni auteur : refusé", () => {
    expect(canEditCoformAnswer({ user: "autre" }, { me: lambda, entity: notCostumAdmin })).toBe(false);
    expect(canEditCoformAnswer({}, { me: null, entity: notCostumAdmin })).toBe(false);
  });
});

describe("normalizeStatus", () => {
  it("reconnaît les statuts réels, orthographe legacy « Réfusé » comprise", () => {
    expect(normalizeStatus("Validé")).toBe("Valide");
    expect(normalizeStatus("En attente")).toBe("En attente");
    expect(normalizeStatus("En cours")).toBe("En cours");
    expect(normalizeStatus("Réfusé")).toBe("Refuse");
    expect(normalizeStatus(" Refusé ")).toBe("Refuse");
  });

  it("absent ou inconnu = en attente (règle serveur) — jamais « Validé » par défaut", () => {
    // Une réponse tout juste déposée n'a pas de statut : la montrer « Validé » dans une vue de
    // gestion ferait croire qu'elle est publiée.
    expect(normalizeStatus("")).toBe("En attente");
    expect(normalizeStatus("n'importe quoi")).toBe("En attente");
  });
});

describe("statusKey — clé stable d'un statut (libellés, compteurs)", () => {
  it("une clé par statut", () => {
    expect(["Valide", "En attente", "En cours", "Refuse"].map((s) => statusKey(s as never))).toEqual([
      "validated",
      "pending",
      "inProgress",
      "refused",
    ]);
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
    expect(a.status).toBe("En attente"); // pas de statut = pas encore publiée (cf. normalizeStatus)
    expect(a.installations).toEqual([]);
    expect(a.schedules).toEqual([]);
  });
});

describe("getStatusStyle — chaque fond avec SON encre", () => {
  it("« En attente » n'est plus écrit en encre primaire sur le jaune (1,85:1 en clair)", () => {
    expect(getStatusStyle("En attente")).toBe("bg-badge-waiting text-warning-foreground");
    expect(getStatusStyle("Valide")).toBe("bg-badge-valid text-success-foreground");
    expect(getStatusStyle("Refuse")).toBe("bg-badge-refused text-destructive-foreground");
    expect(getStatusStyle("En cours")).toBe("bg-badge-in-progress text-primary-foreground");
  });
});
