// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { CoFormData } from "../types";

/**
 * `MultiStepCoForm` — câblage du brouillon.
 *
 * Complément du bloquant 1.2 (B2) de la relecture de la MR 53 : le wizard
 * relaie l'élément à `CoFormProvider`, qui appelle `useCoFormDraft`. Ce maillon
 * n'était couvert par aucun test — `SmartCoForm.test.tsx` mocke le wizard, et
 * `CoFormProvider.test.tsx` monte le provider seul. On rend ici le VRAI wizard
 * et on vérifie ce qui arrive au hook, comme `DynamicCoForm.test.tsx` pour le
 * formulaire simple. Le hook lui-même est couvert par `useCoFormDraft.test.tsx`.
 */

const mockUseCoFormDraft = vi.fn();
vi.mock("../hooks/useCoFormDraft", () => ({
  useCoFormDraft: (opts: unknown) => mockUseCoFormDraft(opts),
}));

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));

vi.mock("@/hooks/useLoadNamespace", () => ({
  useLoadNamespace: () => ({ loaded: true }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Espion sur les props reçues par le champ `chooseProposal` (M31, plus bas).
const chooseProposalSpy = vi.fn();
vi.mock("./ChooseProposalField", () => ({
  ChooseProposalField: (props: unknown) => {
    chooseProposalSpy(props);
    return null;
  },
}));

import { MultiStepCoForm } from "./MultiStepCoForm";

/** Deux étapes : le cas nominal du wizard (une seule tomberait en mode simple). */
const FORM_DATA = {
  _id: { _str: "form-1" },
  id: "form-1",
  name: "Salles",
  created: 0,
  creator: "creator1",
  type: "form",
  inputs: {
    s1: {
      step: 1,
      name: "Salle",
      inputs: { nom: { type: "text", label: "Nom" } },
    },
    s2: {
      step: 2,
      name: "Équipements",
      inputs: { description: { type: "text", label: "Description" } },
    },
  },
} as unknown as CoFormData;

function draftInerte() {
  return {
    restorableDraft: null,
    staleDraftInfo: null,
    saveDraft: vi.fn(),
    discardDraft: vi.fn(),
    purgeDraft: vi.fn(),
    acknowledgeStale: vi.fn(),
    acknowledgeRestored: vi.fn(),
  };
}

describe("MultiStepCoForm — clé du brouillon", () => {
  beforeEach(() => {
    mockUseCoFormDraft.mockReset();
    mockUseCoFormDraft.mockReturnValue(draftInerte());
    // Le wizard remonte son conteneur au montage de l'étape ; jsdom n'implémente
    // pas `scrollIntoView` (même stub que `SearchListView.test.tsx`).
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("transmet l'élément au brouillon, avec le reste de la clé", () => {
    render(
      <MultiStepCoForm
        formData={FORM_DATA}
        formId="form-1"
        userId="user-1"
        draftScope="s1"
        elementId="lieu-A"
        elementType="organizations"
      />,
    );
    expect(mockUseCoFormDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: "form-1",
        userId: "user-1",
        scope: "s1",
        elementId: "lieu-A",
        elementType: "organizations",
        disabled: false,
      }),
    );
  });

  it("sans élément, n'en invente pas — la clé reste celle d'avant", () => {
    render(<MultiStepCoForm formData={FORM_DATA} formId="form-1" userId="user-1" />);
    const opts = mockUseCoFormDraft.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.elementId).toBeUndefined();
    expect(opts.elementType).toBeUndefined();
  });

  /** M34 : « Abandonner les modifications » de `CoFormModal` passe par cette ref. */
  it("expose le `discardDraft` du hook via `discardDraftRef` (porté par le provider)", async () => {
    const draft = draftInerte();
    mockUseCoFormDraft.mockReturnValue(draft);
    const discardDraftRef = { current: null as (() => void) | null };
    const { unmount } = render(
      <MultiStepCoForm formData={FORM_DATA} formId="form-1" userId="user-1" discardDraftRef={discardDraftRef} />,
    );
    await waitFor(() => expect(discardDraftRef.current).not.toBeNull());
    discardDraftRef.current!();
    expect(draft.discardDraft).toHaveBeenCalledTimes(1);
    unmount();
    expect(discardDraftRef.current).toBeNull();
  });
});

/**
 * M31 : le contexte de `chooseProposal` est le parent du FORMULAIRE — la clé
 * que lit l'annuaire AAC — et il descend en prop jusqu'au champ. C'est le cas
 * nominal de cet input (étape d'évaluation d'un wizard AAP). Le champ seul est
 * couvert par `ChooseProposalField.test.tsx` ; ici, le maillon qui le nourrit.
 */
describe("MultiStepCoForm — contexte de `chooseProposal`", () => {
  const FORM_AAP = {
    ...FORM_DATA,
    parent: { orgA: { type: "organizations", name: "Org A" } },
    inputs: {
      aapStep1: {
        step: 1,
        name: "Dépôt",
        inputs: { titre: { type: "text", label: "Titre" } },
      },
      aapStep2: {
        step: 2,
        name: "Jury",
        inputs: { choose: { type: "tpls.forms.aap.chooseProposal", label: "Sélectionné" } },
      },
    },
  } as unknown as CoFormData;

  beforeEach(() => {
    mockUseCoFormDraft.mockReset();
    mockUseCoFormDraft.mockReturnValue(draftInerte());
    chooseProposalSpy.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("transmet le parent du formulaire au champ, avec son type et son nom", () => {
    render(
      <MultiStepCoForm
        formData={FORM_AAP}
        formId="form-1"
        answerId="answer-1"
        initialStepKey="aapStep2"
      />,
    );
    expect(chooseProposalSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { id: "orgA", type: "organizations", name: "Org A" },
        answerId: "answer-1",
      }),
    );
  });
});
