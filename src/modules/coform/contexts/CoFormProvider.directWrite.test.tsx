// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { CoFormContext } from "./CoFormContext";
import { CoFormProvider } from "./CoFormProvider";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { useCoFormStep } from "../hooks/useCoFormStep";
import { parseCoFormFields, normalizeAnswerData, DIRECT_WRITE_RAW_KEYS } from "../utils/formParser";
import type { AllStepsData, CoFormData, CoFormSubFormInputs } from "../types";

/**
 * Non-régression du chemin WIZARD : un « Enregistrer » du jury ne doit jamais
 * ré-émettre les inputs de décision (`selection`, `admissibility`, `pourContre`,
 * `evaluation`, `choose`).
 *
 * Chaîne réelle reproduite (rapport MR 53, §1.1) :
 *   normalizeAnswerData recopie `answers.<étape>` en bloc
 *   → `defaultValues` du provider → `stepState.stepsData` (figé au montage)
 *   → `useCoFormStep` l'étale dans les défauts RHF de l'étape
 *   → `submitStep()` soumet `form.getValues()` BRUT (pas la sortie Zod)
 *   → `submitAllData()` envoie `stepsDataRef.current` entier
 *   → `denormalizeAnswerData` — c'est LÀ que le strip doit avoir lieu.
 *
 * Sans lui, le payload portait `selection = { userB: { c1: 4 } }` tel qu'à
 * l'ouverture : le backend remplaçant la clé en bloc, toute note posée entre-
 * temps par un autre juré (ou par l'user lui-même, en écriture ciblée) était
 * effacée.
 */

// Formulaire AAP 2 étapes : dépôt (aapStep1) + jury (aapStep2 avec un input `selection`).
function makeAapForm(): CoFormData {
  const inputs: Record<string, CoFormSubFormInputs> = {
    aapStep1: {
      id: "aapStep1",
      name: "Dépôt",
      formParent: "f1",
      inputs: { titre: { type: "text", label: "Titre", placeholder: "" } },
    },
    aapStep2: {
      id: "aapStep2",
      name: "Jury",
      formParent: "f1",
      inputs: {
        commentaire: { type: "text", label: "Commentaire", placeholder: "" },
        selection: { type: "tpls.forms.aap.selection", label: "Sélection" },
      },
    },
  };
  return { _id: { _str: "f1" }, id: "f1", name: "AAP", created: 0, creator: "c", type: "form", inputs };
}

// Ce qu'on lit en base à l'OUVERTURE du formulaire : userB a déjà noté.
const RAW = {
  aapStep1: { titre: "Mon commun" },
  aapStep2: {
    commentaire: "ok",
    selection: { userB: { c1: 4 } },
    admissibility: { userB: true },
  },
};

describe("CoFormProvider — clés d'écriture directe jamais soumises (chemin wizard)", () => {
  it("submitStep() puis submitAllData() n'émettent pas `selection` ni `admissibility`", async () => {
    const onFinalSubmit = vi.fn().mockResolvedValue(undefined);
    const formData = makeAapForm();
    const fields = parseCoFormFields(formData);
    // Même cast que `SmartCoForm` : les réponses normalisées sont passées telles
    // quelles en `defaultValues` du provider.
    const defaults = normalizeAnswerData(RAW, fields, "userA") as AllStepsData;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LocalizationProvider>
        <CoFormProvider
          formData={formData}
          defaultValues={defaults}
          submitMode="final"
          onFinalSubmit={onFinalSubmit}
          userId="userA"
          answerId="ans-1"
          initialStepKey="aapStep2"
        >
          {children}
        </CoFormProvider>
      </LocalizationProvider>
    );
    const { result } = renderHook(
      () => ({ ctx: useContext(CoFormContext), step: useCoFormStep({ stepIndex: 1 }) }),
      { wrapper },
    );

    // La valeur EST dans l'état du wizard : c'est ce que `SelectionField` lit
    // (`stepState.stepsData[aapStep2].selection`) pour afficher la grille. On
    // vérifie qu'elle reste lisible — le strip ne doit concerner que l'envoi.
    expect(result.current.ctx!.stepState.stepsData.aapStep2).toMatchObject({
      selection: { userB: { c1: 4 } },
    });
    // …et RHF la détient aussi (défauts de l'étape étalés depuis stepsData) :
    // c'est précisément la fuite que `denormalizeAnswerData` doit colmater.
    expect(result.current.step.form.getValues()).toHaveProperty("selection");

    // Entre-temps, userA a noté c1=5 par écriture ciblée (serveur = {userB:4, userA:5}) —
    // le wizard n'en sait rien. Il clique « Enregistrer » sur l'étape jury.
    let ok = false;
    await act(async () => {
      ok = await result.current.step.submitStep();
    });
    expect(ok).toBe(true);
    await act(async () => {
      await result.current.ctx!.submitAllData();
    });
    await waitFor(() => expect(onFinalSubmit).toHaveBeenCalledTimes(1));

    const payload = onFinalSubmit.mock.calls[0][0] as Record<string, Record<string, unknown>>;
    for (const cle of DIRECT_WRITE_RAW_KEYS) {
      expect(payload.aapStep2, `\`${cle}\` ne doit jamais repartir au serveur`).not.toHaveProperty(cle);
    }
    // Le reste de l'étape part normalement, l'étape de dépôt aussi.
    expect(payload.aapStep2).toEqual({ commentaire: "ok" });
    expect(payload.aapStep1).toEqual({ titre: "Mon commun" });

    // Après soumission, l'état local conserve la valeur lue : le champ
    // continue d'afficher les notes existantes.
    expect(result.current.ctx!.stepState.stepsData.aapStep2).toMatchObject({
      selection: { userB: { c1: 4 } },
    });
  });
});
