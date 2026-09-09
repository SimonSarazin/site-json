// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { CoFormData } from "../types";

/**
 * `DynamicCoForm` — câblage du brouillon.
 *
 * Bloquant 1.2 de la relecture de la MR 53 : le formulaire simple (le chemin
 * de « Ajouter une salle » en modale) appelait `useCoFormDraft` sans l'élément,
 * d'où une clé `…:new` partagée entre deux lieux. On vérifie ici que ce que
 * `SmartCoForm` transmet arrive bien jusqu'au hook — le hook lui-même est
 * couvert par `useCoFormDraft.test.tsx`.
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

import { DynamicCoForm } from "./DynamicCoForm";

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

describe("DynamicCoForm — clé du brouillon", () => {
  beforeEach(() => {
    mockUseCoFormDraft.mockReset();
    mockUseCoFormDraft.mockReturnValue(draftInerte());
  });

  it("transmet l'élément au brouillon, avec le reste de la clé", () => {
    render(
      <DynamicCoForm
        formData={FORM_DATA}
        onSubmit={vi.fn()}
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
    render(<DynamicCoForm formData={FORM_DATA} onSubmit={vi.fn()} formId="form-1" userId="user-1" />);
    const opts = mockUseCoFormDraft.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.elementId).toBeUndefined();
    expect(opts.elementType).toBeUndefined();
  });

  /** M34 : « Abandonner les modifications » de `CoFormModal` passe par cette ref. */
  it("expose le `discardDraft` du hook via `discardDraftRef`", async () => {
    const draft = draftInerte();
    mockUseCoFormDraft.mockReturnValue(draft);
    const discardDraftRef = { current: null as (() => void) | null };
    const { unmount } = render(
      <DynamicCoForm formData={FORM_DATA} onSubmit={vi.fn()} formId="form-1" userId="user-1" discardDraftRef={discardDraftRef} />,
    );
    await waitFor(() => expect(discardDraftRef.current).not.toBeNull());
    discardDraftRef.current!();
    expect(draft.discardDraft).toHaveBeenCalledTimes(1);
    unmount();
    expect(discardDraftRef.current).toBeNull();
  });
});

/**
 * H15 (rapport MR 53) : `handleFormSubmit` purgeait le brouillon dès que
 * `onSubmit` avait RÉSOLU — or celui que fournit `SmartCoForm` avale l'erreur
 * (`onError`, sans throw) et résout aussi en cas d'échec. Après une erreur
 * réseau, la clé ET le payload en attente disparaissaient : fermer la modale
 * perdait toute la saisie, le cas exact que le brouillon doit couvrir. Le
 * contrat est désormais : `false` résolu = échec avéré, brouillon conservé.
 */
describe("DynamicCoForm — purge du brouillon seulement sur succès avéré (H15)", () => {
  let draft: ReturnType<typeof draftInerte>;

  beforeEach(() => {
    mockUseCoFormDraft.mockReset();
    draft = draftInerte();
    mockUseCoFormDraft.mockReturnValue(draft);
  });

  async function soumettre(onSubmit: ComponentProps<typeof DynamicCoForm>["onSubmit"]) {
    const { container } = render(
      <DynamicCoForm formData={FORM_DATA} onSubmit={onSubmit} formId="form-1" userId="user-1" />,
    );
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  }

  it("`false` résolu (échec traité par l'appelant) : le brouillon est CONSERVÉ", async () => {
    await soumettre(vi.fn().mockResolvedValue(false));
    expect(draft.purgeDraft).not.toHaveBeenCalled();
  });

  it("`void` résolu : purge (contrat historique des appelants qui ne renvoient rien)", async () => {
    await soumettre(vi.fn().mockResolvedValue(undefined));
    await waitFor(() => expect(draft.purgeDraft).toHaveBeenCalledTimes(1));
  });

  it("`true` résolu : purge", async () => {
    await soumettre(vi.fn().mockResolvedValue(true));
    await waitFor(() => expect(draft.purgeDraft).toHaveBeenCalledTimes(1));
  });

  it("un throw conserve aussi le brouillon", async () => {
    // RHF relance l'erreur du `onValid` : on soumet par `submitRef`, dont la
    // promesse est capturable — un `fireEvent.submit` laisserait un rejet non
    // géré au niveau du `<form>`.
    const onSubmit = vi.fn().mockRejectedValue(new Error("réseau"));
    const submitRef = { current: null as (() => void) | null };
    render(
      <DynamicCoForm formData={FORM_DATA} onSubmit={onSubmit} formId="form-1" userId="user-1" submitRef={submitRef} />,
    );
    await waitFor(() => expect(submitRef.current).not.toBeNull());
    const soumission = (submitRef.current as unknown as () => Promise<void>)();
    await expect(soumission).rejects.toThrow("réseau");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(draft.purgeDraft).not.toHaveBeenCalled();
  });
});
