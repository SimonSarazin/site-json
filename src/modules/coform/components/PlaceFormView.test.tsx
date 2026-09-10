// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CoFormData, CoFormAccessInfo } from "../types";

/**
 * `PlaceFormView` — câblage de `SmartCoForm` pour la vue « par lieu ».
 *
 * Complément du bloquant 1.2 (B2) de la relecture de la MR 53 : la vue montait
 * `SmartCoForm` SANS l'élément, alors que `placeId` est sa raison d'être et que
 * le finder y est verrouillé (`lockedFields`) — exactement le scénario B2 :
 * saisir sur `/coform/:formId/place/A`, refermer, ouvrir `…/place/B` ⇒ bannière
 * « Brouillon trouvé », et « Reprendre » rattache la réponse à A via un champ
 * que l'utilisateur ne peut pas corriger. Même chose depuis `ToolsAnswerDialog`.
 *
 * `SmartCoForm` est mocké : on vérifie ce qu'il REÇOIT. Le hook lui-même est
 * couvert par `useCoFormDraft.test.tsx`, la chaîne aval par `SmartCoForm.test.tsx`.
 */

const smartCoFormProps = vi.fn();
vi.mock("./SmartCoForm", () => ({
  SmartCoForm: (props: Record<string, unknown>) => {
    smartCoFormProps(props);
    return <div data-testid="smart-coform" />;
  },
}));

// Résolution du nom du lieu : réseau, hors périmètre. Résolu d'emblée pour que
// la vue passe le spinner et monte le formulaire.
vi.mock("../hooks/useElementSummary", () => ({
  useElementSummary: () => ({ summary: { name: "Lieu A" }, isLoading: false }),
}));

const navigateMock = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateMock,
}));

// `Helmet` exige un `HelmetProvider` ; le titre de page n'est pas testé ici.
vi.mock("@dr.pogodin/react-helmet", () => ({
  Helmet: () => null,
}));

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));

import { PlaceFormView } from "./PlaceFormView";

/**
 * Formulaire « par lieu » minimal : un finder partagé (`sharedQuestionPath`)
 * dont la config vit dans `params.finder<kunik>` — sans elle,
 * `getSharedFinderInfo` retourne `null` et la vue affiche « non applicable ».
 */
const FORM_DATA = {
  _id: { _str: "form-salles" },
  id: "form-salles",
  name: "Salles",
  created: 0,
  creator: "creator1",
  type: "form",
  sharedQuestionPath: ["s1.finderlieu"],
  params: { finderlieu: { type: "organizations", multiple: false } },
  inputs: {
    s1: {
      id: "s1",
      name: "Salle",
      formParent: "form-salles",
      inputs: {
        lieu: { label: "Lieu", type: "tpls.forms.cplx.finder" },
        nom: { label: "Nom", type: "text" },
      },
    },
  },
} as unknown as CoFormData;

function accesEnEdition(answerId: string): CoFormAccessInfo {
  return {
    canAnswer: true,
    existingAnswerId: answerId,
    existingAnswer: { s1: { nom: "Salle du lieu A" } },
  } as unknown as CoFormAccessInfo;
}

function recu(): Record<string, unknown> {
  expect(smartCoFormProps).toHaveBeenCalledTimes(1);
  return smartCoFormProps.mock.calls[0][0] as Record<string, unknown>;
}

describe("PlaceFormView — élément transmis à SmartCoForm", () => {
  beforeEach(() => {
    smartCoFormProps.mockReset();
    navigateMock.mockReset();
  });

  it("le lieu est l'élément de la réponse — la clé du brouillon en dépend", () => {
    render(<PlaceFormView formData={FORM_DATA} access={null} formId="form-salles" placeId="lieu-A" />);
    expect(screen.getByTestId("smart-coform")).toBeInTheDocument();
    // `elementType` : celui de la requête d'accès (`CoFormPlacePage` /
    // `ToolsAnswerDialog` interrogent avec `"organizations"`), pour que le même
    // lieu donne la même clé quel que soit le point d'entrée.
    expect(recu()).toEqual(
      expect.objectContaining({
        formId: "form-salles",
        elementId: "lieu-A",
        elementType: "organizations",
        lockedFields: ["finderlieu"],
      }),
    );
  });

  it("en édition, l'élément accompagne `answerId`", () => {
    render(
      <PlaceFormView
        formData={FORM_DATA}
        access={accesEnEdition("ans-9")}
        formId="form-salles"
        placeId="lieu-A"
      />,
    );
    expect(recu()).toEqual(
      expect.objectContaining({ answerId: "ans-9", elementId: "lieu-A", elementType: "organizations" }),
    );
  });
});
