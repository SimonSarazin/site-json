import { describe, it, expect, vi } from "vitest";
import { withExtraCitizenFields, writeExtraCitizenFields } from "./editProfileExtraCitizenFields";
import type { FormDescriptor } from "@/modules/formEngine";

/** Fixture minimale, même forme que `MERGED_EDIT_DESCRIPTORS.citoyens` : `territoires` et
 *  `structureRegister` déjà présents en `widget:"hidden"`, `readOnly:true` (posés par
 *  `mergeRenderPipeline` faute de pendant de rendu — cf. le composant et `editProfilePayload.ts`). */
function fixture(): FormDescriptor {
  return {
    id: "edit-citoyens", collection: "citoyens", layout: { kind: "tabs" },
    sections: [
      { id: "basic", groups: [{ columns: 1, fields: ["name", "slug"] }] },
      { id: "contact", groups: [{ columns: 1, fields: ["email", "mobile", "fixe", "url"] }] },
      { id: "location", groups: [{ columns: 1, fields: ["_location"] }] },
    ],
    fields: {
      name: { name: "name", type: "string", widget: "text", label: "name" },
      territoires: { name: "territoires", type: "string", widget: "hidden", label: "territoires", read: "coerce:orEmpty", readOnly: true },
      structureRegister: { name: "structureRegister", type: "string", widget: "hidden", label: "structureRegister", read: "coerce:orEmpty", readOnly: true },
    },
  };
}

describe("withExtraCitizenFields", () => {
  it("rend territoires sélectionnable (widget select, 9 options) si demandé", () => {
    const out = withExtraCitizenFields(fixture(), ["territoires", "structureRegister"]);
    expect(out.fields.territoires.widget).toBe("select");
    expect(out.fields.territoires.enum).toHaveLength(9);
    expect(out.fields.territoires.enum?.map((o) => o.value)).toContain("Arrageois");
  });

  it("rend structureRegister éditable (widget text) si demandé", () => {
    const out = withExtraCitizenFields(fixture(), ["territoires", "structureRegister"]);
    expect(out.fields.structureRegister.widget).toBe("text");
    expect(out.fields.structureRegister.enum).toBeUndefined();
  });

  it("garde le pipeline read/readOnly des deux champs INCHANGÉ (seule la vue change)", () => {
    const out = withExtraCitizenFields(fixture(), ["territoires", "structureRegister"]);
    expect(out.fields.territoires.read).toBe("coerce:orEmpty");
    expect(out.fields.territoires.readOnly).toBe(true);
    expect(out.fields.structureRegister.read).toBe("coerce:orEmpty");
    expect(out.fields.structureRegister.readOnly).toBe(true);
  });

  it("insère les champs demandés dans le 1er groupe de l'onglet contact, sans toucher les autres onglets", () => {
    const out = withExtraCitizenFields(fixture(), ["territoires", "structureRegister"]);
    const contact = out.sections.find((s) => s.id === "contact")!;
    expect(contact.groups![0].fields).toEqual(["email", "mobile", "fixe", "url", "territoires", "structureRegister"]);
    const basic = out.sections.find((s) => s.id === "basic")!;
    expect(basic.groups![0].fields).toEqual(["name", "slug"]);
  });

  it("ne modifie pas les autres champs du descripteur", () => {
    const out = withExtraCitizenFields(fixture(), ["territoires"]);
    expect(out.fields.name).toEqual({ name: "name", type: "string", widget: "text", label: "name" });
  });

  it("garde le descripteur TEL QUEL si la liste de champs est vide (défaut : aucun site)", () => {
    const base = fixture();
    expect(withExtraCitizenFields(base, [])).toBe(base);
  });

  it("garde le descripteur TEL QUEL si aucun des champs demandés n'existe dans le pipeline (garde-fou)", () => {
    const base = fixture();
    delete (base.fields as Record<string, unknown>).territoires;
    delete (base.fields as Record<string, unknown>).structureRegister;
    expect(withExtraCitizenFields(base, ["territoires", "structureRegister"])).toBe(base);
  });

  it("n'active qu'un seul champ si un seul est demandé", () => {
    const out = withExtraCitizenFields(fixture(), ["territoires"]);
    expect(out.fields.territoires.widget).toBe("select");
    expect(out.fields.structureRegister.widget).toBe("hidden");
    const contact = out.sections.find((s) => s.id === "contact")!;
    expect(contact.groups![0].fields).toEqual(["email", "mobile", "fixe", "url", "territoires"]);
  });
});

describe("writeExtraCitizenFields", () => {
  it("écrit les champs demandés via updateField, valeurs recadrées (trim)", async () => {
    const updateField = vi.fn().mockResolvedValue(undefined);
    await writeExtraCitizenFields(
      { updateField },
      { territoires: "  Arrageois  ", structureRegister: " Centre Social ", name: "Jean" },
      ["territoires", "structureRegister"],
    );
    expect(updateField).toHaveBeenCalledTimes(2);
    expect(updateField).toHaveBeenCalledWith("territoires", "Arrageois");
    expect(updateField).toHaveBeenCalledWith("structureRegister", "Centre Social");
  });

  it("n'écrit que les champs listés (liste restreinte à un site)", async () => {
    const updateField = vi.fn().mockResolvedValue(undefined);
    await writeExtraCitizenFields({ updateField }, { territoires: "Arrageois", structureRegister: "Centre Social" }, ["territoires"]);
    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField).toHaveBeenCalledWith("territoires", "Arrageois");
  });

  it("une valeur vide efface le champ (null → $unset côté SDK)", async () => {
    const updateField = vi.fn().mockResolvedValue(undefined);
    await writeExtraCitizenFields({ updateField }, { territoires: "   ", structureRegister: "" }, ["territoires", "structureRegister"]);
    expect(updateField).toHaveBeenCalledWith("territoires", null);
    expect(updateField).toHaveBeenCalledWith("structureRegister", null);
  });

  it("ignore un champ absent du formulaire (non-string) sans appeler updateField pour lui", async () => {
    const updateField = vi.fn().mockResolvedValue(undefined);
    await writeExtraCitizenFields({ updateField }, { territoires: "Arrageois" }, ["territoires", "structureRegister"]);
    expect(updateField).toHaveBeenCalledTimes(1);
    expect(updateField).toHaveBeenCalledWith("territoires", "Arrageois");
  });

  it("n'appelle rien si l'entité n'expose pas updateField (garde-fou)", async () => {
    await expect(writeExtraCitizenFields(null, { territoires: "Arrageois" }, ["territoires"])).resolves.toBeUndefined();
    await expect(writeExtraCitizenFields({}, { territoires: "Arrageois" }, ["territoires"])).resolves.toBeUndefined();
  });

  it("tente chaque champ même si l'un échoue (best-effort), puis rejette (échec agrégé remonté)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const updateField = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    await expect(
      writeExtraCitizenFields({ updateField }, { territoires: "Arrageois", structureRegister: "Centre Social" }, ["territoires", "structureRegister"]),
    ).rejects.toThrow(/territoires/);
    expect(updateField).toHaveBeenCalledTimes(2); // l'échec du 1er n'empêche pas la tentative du 2e
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
