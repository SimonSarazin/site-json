// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CoFormData } from "../types";

/**
 * Tests de `SmartCoForm` — focus sur la **décision de rendu** :
 *  - DynamicCoForm (single-step) vs MultiStepCoForm (multi-step) selon le nombre d'étapes
 *  - Mode standalone (stepKey / inputKey)
 *  - forceMultiStep / forceSingleStep / multiStepThreshold
 *  - readOnly → CoFormReadOnly
 *  - États : loading / error / empty
 *
 * Les composants enfants (DynamicCoForm, MultiStepCoForm, CoFormReadOnly) sont
 * mockés pour exposer leurs props critiques via des data-attributes — on ne
 * teste pas leur rendu interne (couvert par leurs propres tests / E2E).
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockUseCoFormQuery = vi.fn();
const mockUseCoFormFinalMutation = vi.fn();

vi.mock("../hooks/useCoFormQuery", () => ({
  useCoFormQuery: (args: unknown) => mockUseCoFormQuery(args),
  useCoFormFinalMutation: (args: unknown) => mockUseCoFormFinalMutation(args),
}));

// Hook de données réseau (catalogues commonTable) — mocké comme useCoFormQuery :
// il exige le CocolightProvider (api), hors périmètre de ces tests de rendu.
vi.mock("../hooks/useCoFormCatalogs", () => ({
  useCoFormCatalogs: () => ({ catalogs: {}, isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("./DynamicCoForm", () => ({
  DynamicCoForm: (props: { formData: CoFormData; hideBanner?: boolean; hideStepHeaders?: boolean; hideSubmitButton?: boolean; autoSubmitOnBlur?: boolean }) => (
    <div
      data-testid="dynamic-coform"
      data-step-count={Object.keys(props.formData.inputs ?? {}).length}
      data-hide-banner={String(!!props.hideBanner)}
      data-hide-step-headers={String(!!props.hideStepHeaders)}
      data-hide-submit-button={String(!!props.hideSubmitButton)}
      data-auto-submit={String(!!props.autoSubmitOnBlur)}
    >
      {/* Liste des subFormIds pour vérif standalone */}
      {Object.keys(props.formData.inputs ?? {}).join(",")}
    </div>
  ),
}));

vi.mock("./MultiStepCoForm", () => ({
  MultiStepCoForm: (props: { formData: CoFormData; submitMode?: string; initialStepKey?: string }) => (
    <div
      data-testid="multistep-coform"
      data-step-count={Object.keys(props.formData.inputs ?? {}).length}
      data-submit-mode={props.submitMode}
      data-initial-step={props.initialStepKey ?? ""}
    />
  ),
}));

vi.mock("./CoFormReadOnly", () => ({
  CoFormReadOnly: (props: { formData: CoFormData; hideBanner?: boolean; hideStepHeaders?: boolean }) => (
    <div
      data-testid="coform-readonly"
      data-step-count={Object.keys(props.formData.inputs ?? {}).length}
      data-hide-banner={String(!!props.hideBanner)}
      data-hide-step-headers={String(!!props.hideStepHeaders)}
    />
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));

vi.mock("@/hooks/useLoadNamespace", () => ({
  useLoadNamespace: () => ({ loaded: true }),
}));

import { SmartCoForm } from "./SmartCoForm";

// ─── Helpers ────────────────────────────────────────────────────────────────
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeFormData(subFormIds: string[], extraInputs?: Record<string, Record<string, { type: string; label: string }>>): CoFormData {
  const inputs: Record<string, { step: number; name: string; inputs: Record<string, { type: string; label: string }> }> = {};
  for (const id of subFormIds) {
    inputs[id] = {
      step: 1,
      name: `Step ${id}`,
      inputs: extraInputs?.[id] ?? { textField: { type: "text", label: "Field" } },
    };
  }
  return {
    _id: { _str: "form123" },
    id: "form123",
    name: "Test Form",
    created: 0,
    creator: "creator1",
    type: "form",
    inputs,
  } as unknown as CoFormData;
}

function defaultQueryResult(formData: CoFormData | null) {
  return {
    formData,
    access: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    stepsCount: formData?.inputs ? Object.keys(formData.inputs).length : 0,
    isMultiStep: false,
  };
}

function defaultMutation() {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    error: null,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("SmartCoForm", () => {
  describe("décision single vs multi-step", () => {
    it("1 step → DynamicCoForm", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1"]);
      render(<SmartCoForm formData={formData} />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("dynamic-coform")).toBeDefined();
      expect(screen.queryByTestId("multistep-coform")).toBeNull();
    });

    it("2 steps → MultiStepCoForm (default threshold)", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"]);
      render(<SmartCoForm formData={formData} />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("multistep-coform")).toBeDefined();
      expect(screen.queryByTestId("dynamic-coform")).toBeNull();
    });

    it("3 steps → MultiStepCoForm", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2", "s3"]);
      render(<SmartCoForm formData={formData} />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("multistep-coform")).toBeDefined();
    });

    it("multiStepThreshold=3 + 2 steps → DynamicCoForm (sous seuil)", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"]);
      render(<SmartCoForm formData={formData} multiStepThreshold={3} />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("dynamic-coform")).toBeDefined();
    });

    it("forceMultiStep → MultiStepCoForm même avec 1 step", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1"]);
      render(<SmartCoForm formData={formData} forceMultiStep />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("multistep-coform")).toBeDefined();
    });

    it("forceSingleStep → DynamicCoForm même avec 5 steps", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2", "s3", "s4", "s5"]);
      render(<SmartCoForm formData={formData} forceSingleStep />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("dynamic-coform")).toBeDefined();
    });

    it("forceSingleStep prend la priorité sur forceMultiStep", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2", "s3"]);
      render(<SmartCoForm formData={formData} forceSingleStep forceMultiStep />, {
        wrapper: makeWrapper(),
      });
      expect(screen.getByTestId("dynamic-coform")).toBeDefined();
    });
  });

  describe("mode standalone (stepKey)", () => {
    it("stepKey défini → DynamicCoForm avec 1 step filtré + hideBanner", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2", "s3"]);
      render(<SmartCoForm formData={formData} stepKey="s2" />, { wrapper: makeWrapper() });
      const dyn = screen.getByTestId("dynamic-coform");
      expect(dyn.dataset.stepCount).toBe("1");
      expect(dyn.dataset.hideBanner).toBe("true");
      expect(dyn.textContent).toBe("s2");
    });

    it("stepKey ignore le multistep même avec 5 steps", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2", "s3", "s4", "s5"]);
      render(<SmartCoForm formData={formData} stepKey="s3" />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("dynamic-coform")).toBeDefined();
      expect(screen.queryByTestId("multistep-coform")).toBeNull();
    });

    it("stepKey inexistant → tombe en mode normal", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"]);
      render(<SmartCoForm formData={formData} stepKey="ghost" />, { wrapper: makeWrapper() });
      // Pas de standalone résolu → mode normal (multi-step car 2 steps)
      expect(screen.getByTestId("multistep-coform")).toBeDefined();
    });
  });

  describe("mode input standalone (inputKey)", () => {
    it("inputKey auto-résout le stepKey contenant l'input", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"], {
        s1: { fieldA: { type: "text", label: "A" } },
        s2: { fieldB: { type: "text", label: "B" } },
      });
      render(<SmartCoForm formData={formData} inputKey="fieldB" />, { wrapper: makeWrapper() });
      const dyn = screen.getByTestId("dynamic-coform");
      expect(dyn.dataset.stepCount).toBe("1");
      expect(dyn.textContent).toBe("s2");
      expect(dyn.dataset.hideStepHeaders).toBe("true");
      expect(dyn.dataset.hideSubmitButton).toBe("true");
      expect(dyn.dataset.autoSubmit).toBe("true");
    });

    it("inputKey + stepKey explicite → stepKey override", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"], {
        s1: { fieldA: { type: "text", label: "A" } },
        s2: { fieldA: { type: "text", label: "A bis" } },
      });
      render(
        <SmartCoForm formData={formData} stepKey="s1" inputKey="fieldA" />,
        { wrapper: makeWrapper() }
      );
      const dyn = screen.getByTestId("dynamic-coform");
      expect(dyn.textContent).toBe("s1");
    });
  });

  describe("readOnly", () => {
    it("readOnly → CoFormReadOnly", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"]);
      render(<SmartCoForm formData={formData} readOnly />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("coform-readonly")).toBeDefined();
      expect(screen.queryByTestId("dynamic-coform")).toBeNull();
      expect(screen.queryByTestId("multistep-coform")).toBeNull();
    });

    it("readOnly + stepKey → CoFormReadOnly avec data filtré + hideBanner", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2", "s3"]);
      render(
        <SmartCoForm formData={formData} readOnly stepKey="s2" />,
        { wrapper: makeWrapper() }
      );
      const ro = screen.getByTestId("coform-readonly");
      expect(ro.dataset.stepCount).toBe("1");
      expect(ro.dataset.hideBanner).toBe("true");
    });
  });

  describe("états spéciaux", () => {
    it("pas de formData → EmptyState", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const { container } = render(<SmartCoForm />, { wrapper: makeWrapper() });
      expect(container.textContent).toContain("coform.smart.emptyMessage");
    });

    it("isLoading + formId → LoadingState", () => {
      mockUseCoFormQuery.mockReturnValue({
        ...defaultQueryResult(null),
        isLoading: true,
      });
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const { container } = render(<SmartCoForm formId="abc" />, { wrapper: makeWrapper() });
      expect(container.textContent).toContain("coform.smart.loading");
    });

    it("error + formId → ErrorState", () => {
      const err = new Error("Network down");
      mockUseCoFormQuery.mockReturnValue({
        ...defaultQueryResult(null),
        error: err,
      });
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const onError = vi.fn();
      const { container } = render(
        <SmartCoForm formId="abc" onError={onError} />,
        { wrapper: makeWrapper() }
      );
      expect(container.textContent).toContain("coform.smart.errorTitle");
      expect(container.textContent).toContain("Network down");
      expect(onError).toHaveBeenCalledWith(err);
    });

    it("externalFormData override l'API même avec formId fourni", () => {
      // Si formData externe fourni, useCoFormQuery est désactivé via enabled,
      // donc on simule un état "idle" du hook.
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const externalData = makeFormData(["s1"]);
      render(
        <SmartCoForm formId="ignored" formData={externalData} />,
        { wrapper: makeWrapper() }
      );
      expect(screen.getByTestId("dynamic-coform")).toBeDefined();
    });
  });

  describe("submitMode propagation", () => {
    it("submitMode par défaut = final, propagé à MultiStepCoForm", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"]);
      render(<SmartCoForm formData={formData} />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("multistep-coform").dataset.submitMode).toBe("final");
    });

    it("submitMode='both' propagé", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2"]);
      render(<SmartCoForm formData={formData} submitMode="both" />, { wrapper: makeWrapper() });
      expect(screen.getByTestId("multistep-coform").dataset.submitMode).toBe("both");
    });
  });

  describe("initialStepKey propagé au multi-step", () => {
    it("initialStepKey transmis à MultiStepCoForm", () => {
      mockUseCoFormQuery.mockReturnValue(defaultQueryResult(null));
      mockUseCoFormFinalMutation.mockReturnValue(defaultMutation());
      const formData = makeFormData(["s1", "s2", "s3"]);
      render(
        <SmartCoForm formData={formData} initialStepKey="s2" />,
        { wrapper: makeWrapper() }
      );
      expect(screen.getByTestId("multistep-coform").dataset.initialStep).toBe("s2");
    });
  });
});

/**
 * `hiddenStepKeys` retire une étape sur décision de l'APPELANT — typiquement
 * « l'étape d'évaluation d'un appel à communs n'est pas proposée à qui ne
 * l'administre pas ».
 *
 * Sa première version ne filtrait que le parse local de `SmartCoForm` : les
 * enfants recevaient le `formData` BRUT et le reparsaient sans options, si bien
 * que l'étape restait rendue, avec ses champs requis. Ces tests portent sur ce
 * que les enfants reçoivent VRAIMENT, pas sur un décompte interne.
 */
describe("SmartCoForm — hiddenStepKeys", () => {
  it("retire l'étape du formData transmis au wizard", () => {
    const formData = makeFormData(["aapStep1", "aapStep2", "aapStep3"]);
    render(<SmartCoForm formData={formData} hiddenStepKeys={["aapStep2"]} />, {
      wrapper: makeWrapper(),
    });
    const wizard = screen.getByTestId("multistep-coform");
    expect(wizard.getAttribute("data-step-count")).toBe("2");
  });

  it("retire l'étape du formData transmis au formulaire simple", () => {
    const formData = makeFormData(["aapStep1", "aapStep2"]);
    render(<SmartCoForm formData={formData} hiddenStepKeys={["aapStep2"]} />, {
      wrapper: makeWrapper(),
    });
    // 1 étape restante ⇒ bascule en mode simple, et ce mode ne doit PAS
    // aplatir les deux étapes du formData d'origine.
    const simple = screen.getByTestId("dynamic-coform");
    expect(simple.getAttribute("data-step-count")).toBe("1");
    expect(simple.textContent).toBe("aapStep1");
  });

  it("ne retire rien sans la prop", () => {
    const formData = makeFormData(["aapStep1", "aapStep2", "aapStep3"]);
    render(<SmartCoForm formData={formData} />, { wrapper: makeWrapper() });
    expect(screen.getByTestId("multistep-coform").getAttribute("data-step-count")).toBe("3");
  });

  it("une clé inconnue ne retire rien", () => {
    const formData = makeFormData(["aapStep1", "aapStep2"]);
    render(<SmartCoForm formData={formData} hiddenStepKeys={["etapeInexistante"]} />, {
      wrapper: makeWrapper(),
    });
    expect(screen.getByTestId("multistep-coform").getAttribute("data-step-count")).toBe("2");
  });

  it("une étape réclamée par `stepKey` l'emporte sur son masquage", () => {
    // Demande explicite de l'appelant : la masquer rendrait une page vide.
    const formData = makeFormData(["aapStep1", "aapStep2"]);
    render(
      <SmartCoForm formData={formData} stepKey="aapStep2" hiddenStepKeys={["aapStep2"]} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByTestId("dynamic-coform").textContent).toBe("aapStep2");
  });
});
