import { describe, it, expect } from "vitest";
import { AdminColumnsSchema, AdminSectionSchema } from "./schema";

/**
 * `sortable` gouverne un tri SERVEUR : une colonne fabriquée après la requête (champs
 * aplatis par un hook costum, jointures) trierait sur une clé absente de la base, dans un
 * ordre arbitraire, tout en écrasant `defaultSortBy`. Le risque n'est pas qu'elle soit mal
 * lue mais qu'elle DISPARAISSE du schéma : Zod strippe les clés inconnues sans erreur, et
 * les tris morts reviendraient en silence — d'où ce test de contrat.
 */
describe("AdminColumnsSchema — sortable", () => {
  it("conserve `sortable: false` (clé déclarée, non strippée)", () => {
    const r = AdminColumnsSchema.safeParse([{ path: "structure.name", sortable: false }]);
    expect(r.success).toBe(true);
    expect(r.data?.[0]).toEqual({ path: "structure.name", sortable: false });
  });

  it("absent par défaut : le tri reste actif (comportement historique)", () => {
    const r = AdminColumnsSchema.safeParse([{ path: "created" }]);
    expect((r.data?.[0] as { sortable?: boolean })?.sortable).toBeUndefined();
  });

  it("accepte toujours la forme chaîne brute", () => {
    expect(AdminColumnsSchema.safeParse(["name"]).success).toBe(true);
  });

  it("rejette un `sortable` non booléen", () => {
    expect(AdminColumnsSchema.safeParse([{ path: "name", sortable: "non" }]).success).toBe(false);
  });
});

/**
 * `answerCopy` : deux forms et une empreinte. Le refine source ≠ cible est la seule règle qui
 * n'apparaît pas dans les types — une config qui copierait un form dans lui-même serait acceptée
 * par Zod sans lui, et le serveur répondrait « la réponse appartient déjà au form cible » à
 * chaque clic. Le test verrouille aussi le rejet par le schéma builtin (pas de repli silencieux
 * vers la section costum permissive).
 */
describe("AdminSectionSchema — resource : create.coform et preview", () => {
  const FORM = "6a85af345d898a57cb49f029";
  const base = { type: "resource", entityType: "answers", source: { defaultFilters: { form: FORM } } };

  it("accepte create:{coform} (ObjectId) et conserve le bloc preview", () => {
    // Deux opt-in de la modération des réponses CoForm : sans eux, aucune création (les answers
    // n'ont pas de modale d'entité) et aucune réaction au clic sur une ligne. Zod strippant les
    // clés inconnues, leur disparition du schéma serait silencieuse — d'où ce contrat.
    const r = AdminSectionSchema.safeParse({
      ...base,
      create: { coform: FORM },
      preview: { type: "coform-answer", editButton: true },
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ create: { coform: FORM }, preview: { type: "coform-answer", editButton: true } });
  });

  it("refuse un coform qui n'est pas un ObjectId (24 hex)", () => {
    expect(AdminSectionSchema.safeParse({ ...base, create: { coform: "add-creneau" } }).success).toBe(false);
  });

  it("les formes historiques de create restent acceptées (false / inherit / add-<key>)", () => {
    for (const create of [false, "inherit", "add-structure"]) {
      expect(AdminSectionSchema.safeParse({ ...base, create }).success, String(create)).toBe(true);
    }
  });
});

describe("AdminSectionSchema — answerCopy", () => {
  const SRC = "6928096adf5caf0d230e7f26";
  const DST = "6a85af345d898a57cb49f029";

  it("accepte la forme minimale et conserve source/columns/duplicateKeys", () => {
    const r = AdminSectionSchema.safeParse({
      type: "answerCopy",
      sourceForm: SRC,
      targetForm: DST,
      source: { defaultFilters: { "address.postalCode": { $in: ["97430"] } }, indexStepList: 30 },
      columns: ["name", { path: "structure.name", label: { fr: "Structure" } }],
      duplicateKeys: ["name", "address.postalCode"],
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ type: "answerCopy", sourceForm: SRC, duplicateKeys: ["name", "address.postalCode"] });
    expect((r.data as { source?: { indexStepList?: number } }).source?.indexStepList).toBe(30);
  });

  it("conserve le bloc preview (détail d'une candidate au clic)", () => {
    const r = AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: SRC, targetForm: DST, preview: { type: "coform-answer" } });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ preview: { type: "coform-answer" } });
  });

  it("refuse source === cible", () => {
    expect(AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: SRC, targetForm: SRC }).success).toBe(false);
  });

  it("refuse un id de form qui n'est pas un ObjectId (24 hex)", () => {
    expect(AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: "sportSanteBienetre0", targetForm: DST }).success).toBe(false);
  });

  it("refuse une section sans targetForm — sans repli vers la section costum permissive", () => {
    expect(AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: SRC }).success).toBe(false);
  });
});
