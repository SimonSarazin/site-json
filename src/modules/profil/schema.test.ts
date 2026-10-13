import { describe, it, expect } from "vitest";

import { ProfileTabSchema, StructuresTabPropsSchema } from "./schema";

/**
 * L'onglet « Structures » lit ses identifiants dans `props`, un record libre au niveau de l'onglet :
 * sans la passe de validation (`superRefine`), un formulaire ou un chemin de finder MAL FORMÉ ne se
 * verrait qu'à l'écran — onglet vide, sans message. Les erreurs doivent porter le chemin exact. (Un
 * id bien formé mais faux échappe forcément au schéma.)
 */
describe("ProfileTabSchema — onglet StructuresTab", () => {
  const ONGLET = {
    id: "structures",
    label: { fr: "Structures" },
    condition: { entityTypes: ["citoyens"], userContext: "own" },
    component: "StructuresTab",
  };
  const ANSWERS = {
    formId: "6928096adf5caf0d230e7f26",
    structureFinderPath: "answers.sportSanteBienetre2172025_854_0.findersportSanteBienetre2172025_854_0mdn1fzoewyjg66n85p",
  };
  const chemins = (r: { error?: { issues: { path: PropertyKey[] }[] } }) =>
    r.error?.issues.map((i) => i.path.map(String).join(".")) ?? [];

  it("accepte les props complètes", () => {
    const r = ProfileTabSchema.safeParse({
      ...ONGLET,
      props: { answers: ANSWERS, scope: "costum", emptyAction: { label: { fr: "Voir" }, href: "/structure" } },
    });
    expect(r.success).toBe(true);
  });

  it("refuse un onglet sans props, et un objet props sans `answers` — erreur au bon niveau", () => {
    const sansProps = ProfileTabSchema.safeParse(ONGLET);
    expect(sansProps.success).toBe(false);
    expect(chemins(sansProps)).toEqual(["props"]);
    expect(chemins(ProfileTabSchema.safeParse({ ...ONGLET, props: { scope: "costum" } }))).toEqual(["props.answers"]);
  });

  it("refuse un chemin de finder qui n'en est pas un (préfixe answers. ou finder manquant)", () => {
    for (const structureFinderPath of ["sportSanteBienetre2172025_854_0.finderX", "answers.etape.champ"]) {
      const r = ProfileTabSchema.safeParse({ ...ONGLET, props: { answers: { ...ANSWERS, structureFinderPath } } });
      expect(r.success, structureFinderPath).toBe(false);
      expect(chemins(r)).toEqual(["props.answers.structureFinderPath"]);
    }
  });

  it("refuse un id de formulaire qui n'est pas un ObjectId", () => {
    const r = ProfileTabSchema.safeParse({ ...ONGLET, props: { answers: { ...ANSWERS, formId: "sportSanteBienetre0" } } });
    expect(chemins(r)).toEqual(["props.answers.formId"]);
  });

  it("accepte les options : « Modifier », créneaux déposés, champ de modération des structures", () => {
    const r = ProfileTabSchema.safeParse({
      ...ONGLET,
      props: { answers: { ...ANSWERS, editButton: true, submittedSlots: true }, scope: "costum", structureStatusField: "statusActor" },
    });
    expect(r.success).toBe(true);
  });

  it("les props revalidées à l'exécution ressortent INTACTES : une option oubliée du schéma serait retirée sans bruit", () => {
    // `ProfileTemplateDynamic` rend l'onglet avec `parsed.data` : Zod retire toute clé non déclarée.
    const props = {
      answers: { ...ANSWERS, editButton: true, submittedSlots: true },
      scope: "costum",
      structureStatusField: "statusActor",
      emptyAction: { label: { fr: "Voir" }, href: "/structure" },
    };
    expect(StructuresTabPropsSchema.parse(props)).toEqual(props);
  });

  it("refuse un champ de modération qui n'est pas un chemin pointé", () => {
    const r = ProfileTabSchema.safeParse({ ...ONGLET, props: { answers: ANSWERS, structureStatusField: "status actor" } });
    expect(chemins(r)).toEqual(["props.structureStatusField"]);
  });

  it("refuse le champ de modération en `scope: network` : hors du site porteur, le champ peut dire autre chose", () => {
    const r = ProfileTabSchema.safeParse({
      ...ONGLET,
      props: { answers: ANSWERS, scope: "network", structureStatusField: "statusActor" },
    });
    expect(chemins(r)).toEqual(["props.structureStatusField"]);
  });

  it("les autres composants d'onglet gardent leurs props libres", () => {
    expect(ProfileTabSchema.safeParse({ ...ONGLET, component: "MembershipTab", props: { types: ["organizations"] } }).success).toBe(true);
  });
});
