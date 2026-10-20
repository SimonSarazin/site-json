// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FileText } from "lucide-react";

import type { CoFormAnswer } from "@/modules/coform/types";
import type { AacDetailSection } from "./resolveAacDetailSections";
import { extractGalleryImages, iconFor, proseOf } from "./communDetailContent";

const section = (stepKey: string | null, id: string): AacDetailSection => ({
  id: "bloc",
  title: "Bloc",
  field: { stepKey, id, path: stepKey ? `answers.${stepKey}.${id}` : id, label: "Bloc", options: [] },
});

const answerWith = (answers: Record<string, unknown>, root: Record<string, unknown> = {}) =>
  ({ answers, ...root }) as unknown as CoFormAnswer;

describe("proseOf", () => {
  it("rend [] et non [\"\"] quand la réponse ne porte rien", () => {
    expect(proseOf(answerWith({ aapStep1: {} }), section("aapStep1", "modele"))).toEqual([]);
    expect(proseOf(answerWith({ aapStep1: { modele: "   " } }), section("aapStep1", "modele"))).toEqual([]);
    expect(proseOf(undefined, section("aapStep1", "modele"))).toEqual([]);
  });

  it("un tableau garde ses paragraphes non vides, dans l'ordre", () => {
    const answer = answerWith({ aapStep1: { modele: ["Un", "", "Deux"] } });
    expect(proseOf(answer, section("aapStep1", "modele"))).toEqual(["Un", "Deux"]);
  });

  it("un chemin RACINE se lit sur le document, pas dans `answers`", () => {
    expect(proseOf(answerWith({}, { resume: "Racine" }), section(null, "resume"))).toEqual(["Racine"]);
  });
});

describe("iconFor", () => {
  it("sans nom : FileText", () => {
    expect(iconFor(undefined)).toBe(FileText);
  });

  it("un nom inconnu rend FileText, pas rien", () => {
    const Icon = iconFor("icone-qui-n-existe-pas");
    const { container } = render(<Icon className="x" />);
    expect(container.querySelector("svg.lucide-file-text")).toBeTruthy();
  });
});

describe("extractGalleryImages", () => {
  const doc = { subKey: "aapStep1.image", name: "a.jpg", moduleId: "survey", folder: "answers/1" };

  it("sans subKey déclaré : aucune image", () => {
    expect(extractGalleryImages([doc] as unknown as CoFormAnswer["documents"], "http://b", null)).toEqual([]);
  });

  it("ne garde que le subKey déclaré — tableau ou objet indexé", () => {
    const autre = { ...doc, subKey: "autre", name: "b.jpg" };
    const attendu = [{ src: "http://b/upload/survey/answers/1/a.jpg", alt: "a.jpg" }];
    expect(extractGalleryImages([doc, autre] as unknown as CoFormAnswer["documents"], "http://b", "aapStep1.image")).toEqual(attendu);
    expect(extractGalleryImages({ x: doc, y: autre } as unknown as CoFormAnswer["documents"], "http://b", "aapStep1.image")).toEqual(attendu);
  });
});
