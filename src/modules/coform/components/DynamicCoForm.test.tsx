// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
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
});
