import { describe, it, expect } from "vitest";
import { Section } from "@/types/site-schema";
import { AacDirectoryFieldsSchema } from "./schema";

/**
 * La section `aac` (`AacConfigStub`) — un aperçu de debug de la config résolue —
 * était livrée comme section de premier rang, et sa liste (`AacCommunList`)
 * naviguait vers `/commun/:id`, route qui n'a jamais existé (review MR 53 :
 * H11/H13/M25). Les deux ont été retirées : `config:validate` doit refuser
 * `{type:"aac"}` plutôt que rendre un échafaudage, et les deux sections réelles
 * du module doivent rester acceptées.
 *
 * (La parité union ⇄ SECTION_META ⇄ SectionRenderer est tenue par
 * tests/preflight/section-meta.test.ts ; ici on fige seulement la décision.)
 */
describe("sections du module aac", () => {
  it("`aac` (ex-AacConfigStub) n'est plus une section du site", () => {
    const r = Section.safeParse({ type: "aac", id: "aac", props: { title: { fr: "AAC" } } });
    expect(r.success).toBe(false);
  });

  it("`aac-directory` reste acceptée, avec ses défauts", () => {
    const r = Section.safeParse({ type: "aac-directory", props: {} });
    expect(r.success).toBe(true);
    if (r.success && r.data.type === "aac-directory") {
      expect(r.data.props.variant).toBe("full");
      expect(r.data.props.display).toBe("grid");
    }
  });

  it("`aac-highlight` reste acceptée", () => {
    const r = Section.safeParse({ type: "aac-highlight", props: { title: { fr: "Bande" } } });
    expect(r.success).toBe(true);
  });
});

/**
 * `choose` est la seule clé de `aac.directory.fields` dont la FORME est contrainte : un chemin sans
 * `answers.` était ignoré en silence au runtime — l'annuaire d'un AAC publiait alors tout.
 */
describe("aac.directory.fields.choose", () => {
  it("accepte une réponse `answers.<étape>.<id>`", () => {
    expect(AacDirectoryFieldsSchema.safeParse({ choose: "answers.aapStep2.choose" }).success).toBe(true);
    expect(AacDirectoryFieldsSchema.safeParse({}).success).toBe(true);
  });

  it("refuse un chemin sans `answers.` ou incomplet", () => {
    for (const choose of ["aapStep2.choose", "answers.aapStep2", "answers..choose", "answers.aap Step2.choose"]) {
      expect(AacDirectoryFieldsSchema.safeParse({ choose }).success).toBe(false);
    }
  });
});
