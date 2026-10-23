// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));

import { CoFormReadOnly } from "./CoFormReadOnly";
import type { AllStepsData, CoFormData } from "../types";

/**
 * Rendu lecture seule des `dynamicFields`.
 *
 * `CoFormReadOnly` passe par `normalizeAnswerData`, qui complète le champ à ses
 * `minRows` lignes pour donner à REMPLIR en saisie. Ces lignes n'ont rien à
 * dire en lecture : sans filtre, une réponse enregistrée sans aucune ligne — le
 * cas nominal, puisque les lignes vides ne sont jamais persistées — afficherait
 * des cartes grises vides au lieu du « — ».
 */
const FORM: CoFormData = {
  id: "form1",
  _id: { _str: "form1" },
  name: "Test",
  inputs: {
    step1: {
      inputs: {
        partenaires: { type: "tpls.forms.cplx.dynamicFields", label: "Partenaires", position: 0 },
      },
    },
  },
  params: {
    dynamicFieldspartenaires: {
      enableMultipleRows: true,
      minRows: 2,
      maxRows: 5,
      fieldsConfig: [
        { key: "partnerName", label: "Nom du partenaire", type: "text" },
        { key: "postalCode", label: "Code postal", type: "text" },
      ],
    },
  },
} as unknown as CoFormData;

function rendre(answer: AllStepsData) {
  return render(
    <CoFormReadOnly formData={FORM} answerData={answer} hideBanner hideMetadata />,
  );
}

describe("CoFormReadOnly — dynamicFields", () => {
  it("affiche « — » pour une réponse sans aucune ligne remplie", () => {
    const { container } = rendre({ step1: { partenaires: [] } } as unknown as AllStepsData);
    expect(container.textContent).toContain("—");
    // Aucune carte de ligne : ce sont elles qui apparaissaient vides.
    expect(container.querySelectorAll(".bg-muted\\/30")).toHaveLength(0);
  });

  it("n'affiche que les lignes réellement remplies", () => {
    const { container } = rendre({
      step1: {
        partenaires: [
          { partnerName: "ADAPTETONSPORT", postalCode: "97430" },
          { partnerName: "", postalCode: "" },
        ],
      },
    } as unknown as AllStepsData);
    expect(container.textContent).toContain("ADAPTETONSPORT");
    expect(container.querySelectorAll(".bg-muted\\/30")).toHaveLength(1);
  });
});

describe("CoFormReadOnly — timeSlots", () => {
  const FORM_CRENEAUX = {
    id: "form2",
    _id: { _str: "form2" },
    name: "Créneaux",
    inputs: {
      step1: {
        inputs: { creneaux: { type: "tpls.forms.cplx.timeSlots", label: "Horaire de réservation", position: 0 } },
      },
    },
  } as unknown as CoFormData;
  const SLOT = { day: "Monday", startHour: "08", startMinute: "00", endHour: "10", endMinute: "00" };

  it("affiche la période propre d'un créneau à côté de lui, et rien de plus sans période", () => {
    const { container } = render(
      <CoFormReadOnly
        formData={FORM_CRENEAUX}
        answerData={{
          step1: { creneaux: [{ ...SLOT, periodStart: "2026-08-19", periodEnd: "2026-10-10" }, SLOT] },
        } as unknown as AllStepsData}
        hideBanner
        hideMetadata
      />,
    );
    const badges = [...container.querySelectorAll("dd span, dd div > *")].map((b) => b.textContent ?? "");
    expect(badges.some((b) => b.includes("08:00 – 10:00 · coform.timeSlots.period"))).toBe(true);
    expect(badges.filter((b) => b.includes("coform.timeSlots.period"))).toHaveLength(1);
  });
});
