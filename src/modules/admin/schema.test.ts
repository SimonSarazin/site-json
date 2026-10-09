import { describe, it, expect } from "vitest";
import { AdminColumnsSchema, AdminSectionSchema } from "./schema";

/**
 * Chemins des erreurs au PREMIER niveau, sans déplier d'union : c'est ce qu'imprime
 * `config:validate`. Le message d'un refine builtin doit y figurer tel quel — s'il n'apparaît que
 * dans un `invalid_union`, l'auteur ne lit que « Invalid input » (cf. `abort` du repli costum).
 */
const topLevelPaths = (r: { error?: { issues: { path: PropertyKey[] }[] } }): string[] =>
  r.error?.issues.map((i) => i.path.map(String).join(".")) ?? [];

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
 * `resource` + réponses CoForm : `create: {coform}` et `preview` sont deux opt-in dont la
 * disparition du schéma serait silencieuse (Zod strippe les clés inconnues). `createDefaults` ne
 * se combine pas avec `create.coform` : le CoFormModal ignorerait ce semis sans le dire.
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

  it("refuse createDefaults avec create:{coform} — le CoFormModal s'ouvrirait vide sans le dire", () => {
    const r = AdminSectionSchema.safeParse({ ...base, create: { coform: FORM }, createDefaults: { type: "SSsL" } });
    expect(r.success).toBe(false);
    expect(topLevelPaths(r)).toEqual(["createDefaults"]);
  });

  it("createDefaults reste accepté avec une modale d'entité", () => {
    expect(AdminSectionSchema.safeParse({ ...base, create: "add-structure", createDefaults: { category: "x" } }).success).toBe(true);
  });

  it("n'admet que les détails qui n'écrivent rien ou qui signalent leurs éditions", () => {
    // `facets`, `structure`, `poi-amenities`, `news`, `event` écrivent depuis le détail sans
    // prévenir la table (pas d'`onEdited`) : elle resterait périmée après une édition.
    for (const type of ["facets", "structure", "poi-amenities", "news", "event"]) {
      const r = AdminSectionSchema.safeParse({ ...base, preview: { type } });
      expect(r.success, type).toBe(false);
      expect(topLevelPaths(r), type).toEqual(["preview.type"]);
    }
    for (const preview of [{ type: "coform-answer" }, { type: "default" }, { type: "testimonial" }, { width: "3xl" }]) {
      expect(AdminSectionSchema.safeParse({ ...base, preview }).success, JSON.stringify(preview)).toBe(true);
    }
  });

  it("une erreur bloquante du schéma builtin ne retombe pas sur la section costum permissive", () => {
    expect(AdminSectionSchema.safeParse({ ...base, rowActions: ["edite"] }).success).toBe(false);
  });
});

/**
 * `answerCopy` : deux forms et une empreinte. Le refine source ≠ cible est la seule règle qui
 * n'apparaît pas dans les types — une config qui copierait un form dans lui-même serait acceptée
 * par Zod sans lui, et le serveur répondrait « la réponse appartient déjà au form cible » à
 * chaque clic. Le test verrouille aussi le rejet par le schéma builtin (pas de repli silencieux
 * vers la section costum permissive).
 */
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

  it("refuse preview.editButton: la candidate appartient au form source d'un AUTRE site", () => {
    // Le bloc preview de l'onglet Modération ({type, editButton:true}) a la même forme : le recopier
    // ici ferait apparaître « Modifier » sur une candidate, et l'enregistrement écrirait dans la
    // réponse du costum voisin.
    const r = AdminSectionSchema.safeParse({
      type: "answerCopy", sourceForm: SRC, targetForm: DST, preview: { type: "coform-answer", editButton: true },
    });
    expect(r.success).toBe(false);
    expect(topLevelPaths(r)).toEqual(["preview.editButton"]);
  });

  it("refuse aussi un détail qui écrit : la candidate appartient à un autre site", () => {
    const r = AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: SRC, targetForm: DST, preview: { type: "facets" } });
    expect(r.success).toBe(false);
    expect(topLevelPaths(r)).toEqual(["preview.type"]);
  });

  it("refuse source === cible, message porté sur targetForm", () => {
    const r = AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: SRC, targetForm: SRC });
    expect(r.success).toBe(false);
    expect(topLevelPaths(r)).toEqual(["targetForm"]);
  });

  it("refuse un id de form qui n'est pas un ObjectId (24 hex)", () => {
    expect(AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: "sportSanteBienetre0", targetForm: DST }).success).toBe(false);
  });

  it("refuse une section sans targetForm — sans repli vers la section costum permissive", () => {
    expect(AdminSectionSchema.safeParse({ type: "answerCopy", sourceForm: SRC }).success).toBe(false);
  });
});
