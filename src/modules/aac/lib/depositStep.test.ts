import { describe, expect, it } from "vitest";
import { resolveAacDepositStepKey } from "./depositStep";
import { EMPTY_AAC_CARD_FIELDS, type AacCardFields } from "./resolveAacCardFields";
import type { AacResolvedConfig, AacStep } from "../types";

const fields = (stepKey: string | null): AacCardFields => ({
  ...EMPTY_AAC_CARD_FIELDS,
  title: { stepKey, id: "titre", path: "titre", label: "Nom du commun", options: [] },
});

const step = (key: string): AacStep => ({ key, canEdit: [], canRead: [] });

const config = (...keys: string[]) =>
  ({ steps: keys.map(step) }) as unknown as AacResolvedConfig;

describe("resolveAacDepositStepKey", () => {
  it("prend l'étape qui porte le TITRE, même si ce n'est pas la première", () => {
    expect(resolveAacDepositStepKey(fields("aapStep2"), config("aapStep1", "aapStep2"))).toBe(
      "aapStep2"
    );
  });

  it("retombe sur la PREMIÈRE étape déclarée quand le titre n'est pas résolu", () => {
    expect(resolveAacDepositStepKey(EMPTY_AAC_CARD_FIELDS, config("aapStep1", "aapStep2"))).toBe(
      "aapStep1"
    );
  });

  it("un titre pointant un champ RACINE ne désigne aucune étape → première étape", () => {
    // `name` pré-calculé par le backend : `stepKey: null`, pas une réponse.
    expect(resolveAacDepositStepKey(fields(null), config("aapStep1"))).toBe("aapStep1");
  });

  it("rend null quand rien n'est résolvable — le formulaire complet s'affichera", () => {
    expect(resolveAacDepositStepKey(null, null)).toBeNull();
    expect(resolveAacDepositStepKey(EMPTY_AAC_CARD_FIELDS, config())).toBeNull();
  });
});
