// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacResolvedConfig } from "../../types";
import type { CoFormAnswer } from "@/modules/coform/types";

/**
 * La table des cofinanceurs de la fiche d'un commun (review MR 53, lot 2).
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: { id: "host" } }),
}));

let depenses: Array<Record<string, unknown>> = [];
const useCommunRawDepenses = vi.fn(() => ({ data: depenses }));
vi.mock("@/modules/aac/hooks/useCommunRawDepenses", () => ({
  useCommunRawDepenses: (...args: unknown[]) => useCommunRawDepenses(...(args as [])),
}));

const { CommunCofinancersTable } = await import("./CommunCofinancersTable");

function makeConfig(depenseStepKey: string | null): AacResolvedConfig {
  return {
    formId: "f1",
    configId: null,
    aapType: "aac",
    steps: [],
    roles: { depenseStepKey, evalStepKey: null, financementStepKey: null, suiviStepKey: null },
    criteria: [],
    criteriaSource: "none",
    gates: {
      active: true,
      onlyMemberAccess: false,
      oneAnswerPerPers: false,
      canReadOtherAnswers: false,
      showAnswers: false,
      coremu: true,
      anyOnewithLinkCanAnswer: false,
    },
    campaigns: [],
    typeCoFinancer: null,
  };
}

const ANSWER = { _id: { $id: "a1" }, answers: {} } as unknown as CoFormAnswer;

function renderTable(over: Partial<Parameters<typeof CommunCofinancersTable>[0]> = {}) {
  return render(
    <LocalizationProvider>
      <CommunCofinancersTable
        formData={{ id: "f1", name: "Appel", inputs: {} } as never}
        answerQuery={ANSWER}
        aacConfig={makeConfig("etapeA")}
        funding={null}
        {...over}
      />
    </LocalizationProvider>,
  );
}

beforeEach(() => {
  depenses = [];
  useCommunRawDepenses.mockClear();
});

describe("CommunCofinancersTable — l'étape des dépenses est celle que la page a résolue (M13)", () => {
  it("passe `roles.depenseStepKey` à `useCommunRawDepenses`, jamais `aapStep1` en dur", () => {
    renderTable({ aacConfig: makeConfig("etapeA") });
    expect(useCommunRawDepenses).toHaveBeenCalledWith("a1", "etapeA");
  });
});
