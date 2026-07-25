import { describe, it, expect } from "vitest";
import path from "node:path";
import { presenterMatrix, optionIndex } from "../../scripts/lib/presenter-options";
import { resolveBlockSchema, resolveJsonSchemaPath, dumpJsonSchema } from "../../scripts/lib/config-blocks";

/**
 * Matrice OPTION × PRESENTER (imprimée par `config:schema section:searchPro`).
 * Elle est dérivée par analyse statique des dispatcheurs et des composants : un
 * refactor (destructuration, renommage, délégation) peut la vider SANS RIEN
 * casser d'autre — l'assistant se remettrait alors à poser des options sur des
 * types qui les ignorent.
 */

const ROOT = path.resolve(__dirname, "../..");
const matrix = presenterMatrix(ROOT);

/**
 * Presenters qui lisent une option que le dispatcheur ne leur transmet PAS
 * (option morte). Sortir une entrée d'ici = le bug a été corrigé.
 * - coform-answer : `PreviewCoformAnswer` déclare et lit `preview?.fields`,
 *   mais Preview.tsx rend `<PreviewCoformAnswer item onClose />` sans `preview`.
 *   Impact réel nul aujourd'hui (aucune config du parc ne pose `fields`).
 */
const OPTIONS_MORTES_CONNUES = new Set(["coform-answer"]);

describe("matrice option × presenter (search)", () => {
  it("les deux dispatcheurs sont lus et couvrent les presenters", () => {
    expect(matrix.cards.length).toBeGreaterThanOrEqual(14);
    expect(matrix.previews.length).toBeGreaterThanOrEqual(7);
    for (const e of [...matrix.cards, ...matrix.previews]) {
      expect(e.component, `case "${e.type}" sans composant`).toMatch(/^(Card|Preview)/);
    }
  });

  it("les options SPÉCIFIQUES restent rattachées à leur presenter", () => {
    const idx = optionIndex(matrix.cards);
    // Repères mesurés : ces options n'ont d'effet QUE sur ces types. Si elles
    // s'élargissent, la table de la skill doit suivre.
    expect(idx.get("shareButton")).toEqual(["overlay"]);
    expect(idx.get("imageFit")).toEqual(["image-cover"]);
    expect(idx.get("showFunding")).toEqual(["funding"]);
    expect(idx.get("showDescription")?.length).toBeGreaterThan(1);
  });

  it("aucune option du schéma n'est morte (lue nulle part dans le module search)", () => {
    const schema = resolveBlockSchema("section:searchPro");
    expect(schema).toBeDefined();
    const json = dumpJsonSchema(schema!);
    const keys = new Set<string>();
    for (const n of resolveJsonSchemaPath(json, "props.list.card"))
      for (const k of Object.keys(n.properties ?? {})) keys.add(k);
    expect(keys.size).toBeGreaterThan(5);
    const dead = [...keys].filter((k) => !matrix.cardOptionsUsedAnywhere.has(k));
    expect(dead, "options de list.card déclarées au schéma mais lues nulle part").toEqual([]);
  });

  it("aucune NOUVELLE option morte (lue par le composant, non transmise par le dispatcheur)", () => {
    const morts = [...matrix.cards, ...matrix.previews]
      .filter((e) => !e.receivesConfig && e.options.length && !OPTIONS_MORTES_CONNUES.has(e.type))
      .map((e) => `${e.type} (${e.options.join(", ")})`);
    expect(morts, "presenter qui lit une config qu'il ne reçoit pas").toEqual([]);
  });
});
