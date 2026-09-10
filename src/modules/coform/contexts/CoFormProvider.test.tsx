// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { CoFormContext } from "./CoFormContext";
import { CoFormProvider } from "./CoFormProvider";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { useCoFormStep } from "../hooks/useCoFormStep";
import type { CoFormData, CoFormSubFormInputs } from "../types";

/**
 * Tests d'intégration pour `CoFormProvider`.
 *
 * Couvre :
 *  - Navigation entre étapes (goToNext/Previous/goToStep)
 *  - Calculs dérivés (currentSubFormId, isFirstStep, isLastStep, totalSteps)
 *  - saveStepData + stepsDataRef (pas de stale closure)
 *  - submitMode branches (step / final / both / inattendu)
 *  - submitStepData : navigation auto + completedSteps + errorSteps
 *  - submitAllData : passe les données + addedOptions + links + denormalize
 *  - saveAddedOptions
 *  - resetForm
 *  - initialStepKey
 */

// Helper pour faire un CoFormData minimal avec n sous-formulaires
function makeCoFormData(subFormIds: string[]): CoFormData {
  const inputs: Record<string, CoFormSubFormInputs> = {};
  for (const id of subFormIds) {
    inputs[id] = {
      id,
      name: `Step ${id}`,
      formParent: "form123",
      inputs: {
        textField: { type: "text", label: "Field", placeholder: "" },
      },
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
  };
}

function useCtx() {
  return useContext(CoFormContext);
}

describe("CoFormProvider", () => {
  describe("initial state", () => {
    it("expose les calculs dérivés pour 1 step", () => {
      const formData = makeCoFormData(["step1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.totalSteps).toBe(1);
      expect(result.current.currentSubFormId).toBe("step1");
      expect(result.current.isFirstStep).toBe(true);
      expect(result.current.isLastStep).toBe(true);
      expect(result.current.stepState.currentStepIndex).toBe(0);
    });

    it("expose les calculs dérivés pour 3 steps", () => {
      const formData = makeCoFormData(["s1", "s2", "s3"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.totalSteps).toBe(3);
      expect(result.current.currentSubFormId).toBe("s1");
      expect(result.current.isFirstStep).toBe(true);
      expect(result.current.isLastStep).toBe(false);
    });

    it("démarre sur initialStepKey si fourni", () => {
      const formData = makeCoFormData(["s1", "s2", "s3"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} initialStepKey="s2">{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.stepState.currentStepIndex).toBe(1);
      expect(result.current.currentSubFormId).toBe("s2");
      expect(result.current.isFirstStep).toBe(false);
      expect(result.current.isLastStep).toBe(false);
    });

    it("retombe à 0 si initialStepKey ne match aucun subForm", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} initialStepKey="ghost">{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.stepState.currentStepIndex).toBe(0);
    });

    it("hydrate stepsData depuis defaultValues", () => {
      const formData = makeCoFormData(["s1"]);
      const defaults = { s1: { textField: "hello" } };
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} defaultValues={defaults}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.stepState.stepsData).toEqual(defaults);
    });

    // En édition, l'en-tête d'étapes doit dire la vérité dès l'ouverture : une
    // réponse déjà saisie ne peut pas s'afficher « à faire » de bout en bout.
    // Le critère est la validation, pas la simple présence de données.
    it("marque complétées les étapes déjà valides des defaultValues", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      formData.inputs!.s1.inputs.textField.isRequired = true;
      formData.inputs!.s2.inputs.textField.isRequired = true;
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} defaultValues={{ s1: { textField: "rempli" }, s2: { textField: "" } }}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.stepState.completedSteps).toEqual(["s1"]);
    });

    it("ne marque rien en création (aucune defaultValues)", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.stepState.completedSteps).toEqual([]);
    });
  });

  describe("navigation", () => {
    it("goToNextStep avance d'un index, clamped au max", () => {
      const formData = makeCoFormData(["s1", "s2", "s3"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.goToNextStep());
      expect(result.current.stepState.currentStepIndex).toBe(1);
      act(() => result.current.goToNextStep());
      expect(result.current.stepState.currentStepIndex).toBe(2);
      // Clamp au dernier
      act(() => result.current.goToNextStep());
      expect(result.current.stepState.currentStepIndex).toBe(2);
    });

    it("goToPreviousStep recule, clamped à 0", () => {
      const formData = makeCoFormData(["s1", "s2", "s3"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} initialStepKey="s3">{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.stepState.currentStepIndex).toBe(2);
      act(() => result.current.goToPreviousStep());
      expect(result.current.stepState.currentStepIndex).toBe(1);
      act(() => result.current.goToPreviousStep());
      expect(result.current.stepState.currentStepIndex).toBe(0);
      // Clamp à 0
      act(() => result.current.goToPreviousStep());
      expect(result.current.stepState.currentStepIndex).toBe(0);
    });

    it("goToStep saute à l'index donné si valide", () => {
      const formData = makeCoFormData(["s1", "s2", "s3"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.goToStep(2));
      expect(result.current.stepState.currentStepIndex).toBe(2);
    });

    it("goToStep ignore index hors bornes (négatif et > total)", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.goToStep(-1));
      expect(result.current.stepState.currentStepIndex).toBe(0);
      act(() => result.current.goToStep(5));
      expect(result.current.stepState.currentStepIndex).toBe(0);
    });

    it("isFirstStep / isLastStep dérivent correctement", () => {
      const formData = makeCoFormData(["s1", "s2", "s3"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.isFirstStep).toBe(true);
      act(() => result.current.goToStep(1));
      expect(result.current.isFirstStep).toBe(false);
      expect(result.current.isLastStep).toBe(false);
      act(() => result.current.goToStep(2));
      expect(result.current.isLastStep).toBe(true);
    });
  });

  describe("saveStepData", () => {
    it("écrit la donnée d'un step dans stepsData", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "hello" }));
      expect(result.current.stepState.stepsData).toEqual({ s1: { textField: "hello" } });
    });

    it("préserve les autres steps quand on en sauve un nouveau", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "first" }));
      act(() => result.current.saveStepData("s2", { textField: "second" }));
      expect(result.current.stepState.stepsData).toEqual({
        s1: { textField: "first" },
        s2: { textField: "second" },
      });
    });

    it("écrase la donnée d'un step quand resauvegardé", () => {
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "v1" }));
      act(() => result.current.saveStepData("s1", { textField: "v2" }));
      expect(result.current.stepState.stepsData).toEqual({ s1: { textField: "v2" } });
    });
  });

  describe("saveAddedOptions", () => {
    it("écrit les options ajoutées par subFormId + fieldName", () => {
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveAddedOptions("s1", "multiCheckboxField", ["opt1", "opt2"]));
      expect(result.current.stepState.addedOptions).toEqual({
        s1: { multiCheckboxField: ["opt1", "opt2"] },
      });
    });

    it("préserve les options des autres champs / steps", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveAddedOptions("s1", "f1", ["a"]));
      act(() => result.current.saveAddedOptions("s1", "f2", ["b"]));
      act(() => result.current.saveAddedOptions("s2", "f1", ["c"]));
      expect(result.current.stepState.addedOptions).toEqual({
        s1: { f1: ["a"], f2: ["b"] },
        s2: { f1: ["c"] },
      });
    });
  });

  describe("submitMode — submitStepData", () => {
    it('appelle onStepSubmit en mode "step" + marque step completed + passe au suivant', async () => {
      const onStepSubmit = vi.fn().mockResolvedValue(undefined);
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="step" onStepSubmit={onStepSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      await act(async () => {
        await result.current.submitStepData("s1", { textField: "data" });
      });

      expect(onStepSubmit).toHaveBeenCalledWith("s1", { textField: "data" }, 0);
      expect(result.current.stepState.completedSteps).toEqual(["s1"]);
      expect(result.current.stepState.stepsData.s1).toEqual({ textField: "data" });
      // Navigation auto vers step suivant
      expect(result.current.stepState.currentStepIndex).toBe(1);
    });

    it('appelle onStepSubmit en mode "both"', async () => {
      const onStepSubmit = vi.fn().mockResolvedValue(undefined);
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="both" onStepSubmit={onStepSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      await act(async () => {
        await result.current.submitStepData("s1", { textField: "x" });
      });
      expect(onStepSubmit).toHaveBeenCalledTimes(1);
    });

    it('N\'appelle PAS onStepSubmit en mode "final" (mais sauve localement)', async () => {
      const onStepSubmit = vi.fn();
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="final" onStepSubmit={onStepSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      await act(async () => {
        await result.current.submitStepData("s1", { textField: "x" });
      });
      expect(onStepSubmit).not.toHaveBeenCalled();
      // Mais les données sont quand même sauvegardées localement
      expect(result.current.stepState.stepsData.s1).toEqual({ textField: "x" });
      expect(result.current.stepState.completedSteps).toEqual(["s1"]);
    });

    it("marque le step en erreur si onStepSubmit throw", async () => {
      const err = new Error("submit failed");
      const onStepSubmit = vi.fn().mockRejectedValue(err);
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="step" onStepSubmit={onStepSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      await act(async () => {
        try {
          await result.current.submitStepData("s1", { textField: "x" });
        } catch {
          // throw attendu, géré
        }
      });

      await waitFor(() => {
        expect(result.current.stepState.errorSteps).toContain("s1");
      });
      expect(result.current.error?.message).toBe("submit failed");
      // submittingStep cleared après l'erreur
      expect(result.current.stepState.submittingStep).toBeNull();
    });

    it("ne navigue PAS vers le suivant si dernier step", async () => {
      const onStepSubmit = vi.fn().mockResolvedValue(undefined);
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider
          formData={formData}
          submitMode="step"
          onStepSubmit={onStepSubmit}
          initialStepKey="s2"
        >
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      expect(result.current.stepState.currentStepIndex).toBe(1);

      await act(async () => {
        await result.current.submitStepData("s2", { textField: "x" });
      });
      // Reste sur step 1 (dernier)
      expect(result.current.stepState.currentStepIndex).toBe(1);
    });

    it("ne dupliquePAS le step dans completedSteps si déjà complété", async () => {
      const formData = makeCoFormData(["s1"]);
      const onStepSubmit = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="step" onStepSubmit={onStepSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      await act(async () => {
        await result.current.submitStepData("s1", { textField: "v1" });
      });
      await act(async () => {
        await result.current.submitStepData("s1", { textField: "v2" });
      });
      expect(result.current.stepState.completedSteps).toEqual(["s1"]);
    });
  });

  describe("submitMode — submitAllData", () => {
    it('appelle onFinalSubmit en mode "final" avec les données dénormalisées', async () => {
      const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="final" onFinalSubmit={onFinalSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "data" }));

      await act(async () => {
        await result.current.submitAllData();
      });
      expect(onFinalSubmit).toHaveBeenCalledWith(
        { s1: { textField: "data" } },
        undefined, // addedOptions vide
        undefined, // links vide
      );
    });

    it('appelle onFinalSubmit en mode "both"', async () => {
      const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="both" onFinalSubmit={onFinalSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "x" }));
      await act(async () => {
        await result.current.submitAllData();
      });
      expect(onFinalSubmit).toHaveBeenCalledTimes(1);
    });

    it('N\'appelle PAS onFinalSubmit en mode "step" (no-op silencieux)', async () => {
      const onFinalSubmit = vi.fn();
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="step" onFinalSubmit={onFinalSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "x" }));
      await act(async () => {
        await result.current.submitAllData();
      });
      expect(onFinalSubmit).not.toHaveBeenCalled();
    });

    it("passe addedOptions à onFinalSubmit si non vides", async () => {
      const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="final" onFinalSubmit={onFinalSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "x" }));
      act(() => result.current.saveAddedOptions("s1", "fieldA", ["custom1"]));
      await act(async () => {
        await result.current.submitAllData();
      });
      expect(onFinalSubmit).toHaveBeenCalledWith(
        expect.any(Object),
        { s1: { fieldA: ["custom1"] } },
        undefined,
      );
    });

    it("ne passe PAS addedOptions si toutes les listes sont vides", async () => {
      const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="final" onFinalSubmit={onFinalSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "x" }));
      act(() => result.current.saveAddedOptions("s1", "fieldA", []));
      await act(async () => {
        await result.current.submitAllData();
      });
      expect(onFinalSubmit).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
        undefined,
      );
    });

    it("propage les erreurs de onFinalSubmit", async () => {
      const err = new Error("final submit failed");
      const onFinalSubmit = vi.fn().mockRejectedValue(err);
      const formData = makeCoFormData(["s1"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} submitMode="final" onFinalSubmit={onFinalSubmit}>
          {children}
        </CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "x" }));

      await act(async () => {
        try {
          await result.current.submitAllData();
        } catch {
          // throw attendu
        }
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe("final submit failed");
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("resetForm", () => {
    it("remet le state à zéro (currentStep, stepsData, completedSteps, addedOptions)", () => {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData}>{children}</CoFormProvider>
      );
      const { result } = renderHook(() => useCtx(), { wrapper });

      // Faire évoluer le state
      act(() => result.current.saveStepData("s1", { textField: "data" }));
      act(() => result.current.saveAddedOptions("s1", "f", ["opt"]));
      act(() => result.current.goToStep(1));
      expect(result.current.stepState.currentStepIndex).toBe(1);

      // Reset
      act(() => result.current.resetForm());
      expect(result.current.stepState.currentStepIndex).toBe(0);
      expect(result.current.stepState.stepsData).toEqual({});
      expect(result.current.stepState.completedSteps).toEqual([]);
      expect(result.current.stepState.errorSteps).toEqual([]);
      expect(result.current.stepState.submittingStep).toBeNull();
      expect(result.current.stepState.addedOptions).toEqual({});
      expect(result.current.error).toBeNull();
    });
  });
  // ─── Persistance du brouillon ────────────────────────────────────────────────
  // Le brouillon est actif en modale depuis `9f063beb`, où ouvrir puis refermer
  // sans rien saisir est un geste courant : il ne doit alors RIEN écrire.
  describe("brouillon", () => {
    const FORM_ID = "form123";
    const USER_ID = "user42";
    const KEY = `coform-draft:v1:${FORM_ID}:${USER_ID}:new`;

    function monter() {
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider formData={formData} formId={FORM_ID} userId={USER_ID}>
          {children}
        </CoFormProvider>
      );
      return renderHook(() => useCtx(), { wrapper });
    }

    it("n'écrit RIEN quand le formulaire est ouvert puis refermé sans saisie", () => {
      window.localStorage.removeItem(KEY);
      const { unmount } = monter();
      unmount(); // démontage = fermeture de la modale → flush
      expect(window.localStorage.getItem(KEY)).toBeNull();
    });

    it("écrit dès qu'une donnée est saisie, et le flush au démontage la conserve", () => {
      window.localStorage.removeItem(KEY);
      const { result, unmount } = monter();
      act(() => result.current.saveStepData("s1", { textField: "saisie" }));
      unmount();
      const brut = window.localStorage.getItem(KEY);
      expect(brut).not.toBeNull();
      expect(JSON.parse(brut!).data).toEqual({ s1: { textField: "saisie" } });
      window.localStorage.removeItem(KEY);
    });

    it("écrit aussi sur une simple navigation — la position du wizard se restaure", () => {
      window.localStorage.removeItem(KEY);
      const { result, unmount } = monter();
      act(() => result.current.goToNextStep());
      unmount();
      const brut = window.localStorage.getItem(KEY);
      expect(brut).not.toBeNull();
      expect(JSON.parse(brut!).currentStepIndex).toBe(1);
      window.localStorage.removeItem(KEY);
    });

    /**
     * Bloquant 1.2 de la relecture de la MR 53 : le provider ne transmettait
     * pas l'élément au brouillon — la saisie faite depuis le lieu A atterrissait
     * dans la clé `…:new` partagée, et était proposée sur le lieu B.
     */
    it("scope la clé par ÉLÉMENT : la saisie faite depuis un lieu ne va pas dans la clé partagée", () => {
      const KEY_A = `${KEY}:organizations/lieu-A`;
      window.localStorage.removeItem(KEY);
      window.localStorage.removeItem(KEY_A);
      const formData = makeCoFormData(["s1", "s2"]);
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <CoFormProvider
          formData={formData}
          formId={FORM_ID}
          userId={USER_ID}
          elementId="lieu-A"
          elementType="organizations"
        >
          {children}
        </CoFormProvider>
      );
      const { result, unmount } = renderHook(() => useCtx(), { wrapper });
      act(() => result.current.saveStepData("s1", { textField: "salle du lieu A" }));
      unmount();
      expect(window.localStorage.getItem(KEY)).toBeNull();
      const brut = window.localStorage.getItem(KEY_A);
      expect(brut).not.toBeNull();
      expect(JSON.parse(brut!).data).toEqual({ s1: { textField: "salle du lieu A" } });
      window.localStorage.removeItem(KEY_A);
    });

    /**
     * H20 / H14 (rapport MR 53) : le chemin multi-étapes n'appelait JAMAIS
     * `purgeDraft`. Pire, l'ordre des opérations garantissait l'écriture :
     * `submitStep` → `setStepState` → auto-save armé (500 ms), qui se
     * déclenchait pendant l'attente réseau de `submitAll()` — ou, si la modale
     * se fermait avant, le flush au démontage l'écrivait quand même. Le
     * brouillon d'AVANT l'enregistrement restait donc proposé pendant 30 jours,
     * et « Reprendre » puis soumettre annulait l'enregistrement.
     */
    describe("purge après soumission finale (H20)", () => {
      function monterAvec(onFinalSubmit: (...args: unknown[]) => Promise<void>) {
        const formData = makeCoFormData(["s1", "s2"]);
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <CoFormProvider
            formData={formData}
            formId={FORM_ID}
            userId={USER_ID}
            submitMode="final"
            onFinalSubmit={onFinalSubmit}
          >
            {children}
          </CoFormProvider>
        );
        return renderHook(() => useCtx(), { wrapper });
      }

      it("une soumission réussie purge le brouillon — et le flush au démontage ne le ressuscite pas", async () => {
        window.localStorage.removeItem(KEY);
        const { result, unmount } = monterAvec(vi.fn().mockResolvedValue(undefined));
        // La saisie arme l'auto-save (debounce) : c'est ce payload en attente
        // que le démontage écrivait après coup.
        act(() => result.current.saveStepData("s1", { textField: "saisie" }));
        await act(async () => {
          await result.current.submitAllData();
        });
        unmount(); // fermeture de la modale sur le succès → flush
        expect(window.localStorage.getItem(KEY)).toBeNull();
      });

      it("un brouillon déjà écrit est aussi supprimé", async () => {
        window.localStorage.setItem(
          KEY,
          JSON.stringify({
            version: 1,
            data: { s1: { textField: "d'avant" } },
            currentStepIndex: 0,
            completedSteps: [],
            addedOptions: {},
            timestamp: Date.now() - 60_000,
            baseUpdatedAt: null,
          }),
        );
        const { result, unmount } = monterAvec(vi.fn().mockResolvedValue(undefined));
        await act(async () => {
          await result.current.submitAllData();
        });
        unmount();
        expect(window.localStorage.getItem(KEY)).toBeNull();
      });

      it("une soumission en ÉCHEC conserve le brouillon", async () => {
        window.localStorage.removeItem(KEY);
        const { result, unmount } = monterAvec(vi.fn().mockRejectedValue(new Error("500")));
        act(() => result.current.saveStepData("s1", { textField: "saisie" }));
        await act(async () => {
          await result.current.submitAllData().catch(() => undefined);
        });
        unmount();
        const brut = window.localStorage.getItem(KEY);
        expect(brut).not.toBeNull();
        expect(JSON.parse(brut!).data).toEqual({ s1: { textField: "saisie" } });
        window.localStorage.removeItem(KEY);
      });
    });

    /**
     * H16 (rapport MR 53) : `restoreDraft` ne faisait que `setStepState`. Le
     * formulaire réellement rendu est l'instance react-hook-form de
     * `useCoFormStep`, réinitialisée UNIQUEMENT sur changement d'index d'étape.
     * Un brouillon écrit sur l'étape 0, repris depuis l'étape 0 : rien ne
     * bougeait à l'écran, puis « Suivant » soumettait les valeurs jamais
     * restaurées — et l'auto-save persistait aussitôt ce brouillon amputé.
     */
    describe("reprise d'un brouillon : l'étape affichée se resynchronise (H16)", () => {
      function poserBrouillonAnterieur() {
        window.localStorage.setItem(
          KEY,
          JSON.stringify({
            version: 1,
            data: { s1: { textField: "repris" } },
            currentStepIndex: 0,
            completedSteps: [],
            addedOptions: {},
            timestamp: Date.now() - 60_000,
            baseUpdatedAt: null,
          }),
        );
      }

      function monterAvecEtape() {
        const formData = makeCoFormData(["s1", "s2"]);
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <LocalizationProvider>
            <CoFormProvider formData={formData} formId={FORM_ID} userId={USER_ID}>
              {children}
            </CoFormProvider>
          </LocalizationProvider>
        );
        return renderHook(() => ({ ctx: useCtx(), step: useCoFormStep() }), { wrapper });
      }

      it("« Reprendre » sur l'étape courante remplit SON formulaire, sans changement d'index", () => {
        poserBrouillonAnterieur();
        const { result, unmount } = monterAvecEtape();
        expect(result.current.ctx.restorableDraft).not.toBeNull();
        expect(result.current.step.form.getValues().textField).not.toBe("repris");

        act(() => result.current.ctx.restoreDraft());

        expect(result.current.ctx.stepState.currentStepIndex).toBe(0);
        expect(result.current.step.form.getValues().textField).toBe("repris");
        unmount();
        window.localStorage.removeItem(KEY);
      });

      it("puis « Suivant » soumet la valeur reprise — l'étape n'est pas réécrite vide", async () => {
        poserBrouillonAnterieur();
        const { result, unmount } = monterAvecEtape();
        act(() => result.current.ctx.restoreDraft());

        let ok = false;
        await act(async () => {
          ok = await result.current.step.submitStep();
        });
        expect(ok).toBe(true);
        expect(result.current.ctx.stepState.stepsData.s1).toEqual({ textField: "repris" });
        expect(result.current.ctx.stepState.currentStepIndex).toBe(1);
        unmount();
        window.localStorage.removeItem(KEY);
      });
    });
  });
});
