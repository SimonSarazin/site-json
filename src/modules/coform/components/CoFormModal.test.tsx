// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

/**
 * `CoFormModal` — le geste « Abandonner les modifications ».
 *
 * M34 (rapport MR 53) : `handleConfirmDiscard` ne faisait que remettre
 * `isDirty` à faux et fermer. Tant que le brouillon était coupé en modale,
 * c'était sans conséquence ; depuis qu'il y est actif, l'auto-save a déjà
 * écrit et le flush au démontage écrit le reste — un abandon explicite ne
 * défaisait donc rien, et la bannière « Brouillon trouvé » reproposait à la
 * réouverture précisément la saisie qu'on venait de déclarer abandonner.
 *
 * `SmartCoForm` est mocké : on capte `onDirtyChange` (pour rendre la modale
 * « modifiée ») et on renseigne `discardDraftRef` avec un espion, comme le
 * font `DynamicCoForm` et `CoFormProvider` avec le `discardDraft` du hook.
 */

const capte = vi.hoisted(() => ({
  onDirtyChange: null as ((dirty: boolean) => void) | null,
  rejeterBrouillon: vi.fn(),
}));

vi.mock("./SmartCoForm", async () => {
  const { useEffect } = await import("react");
  return {
    SmartCoForm: (props: {
      onDirtyChange?: (dirty: boolean) => void;
      discardDraftRef?: { current: (() => void) | null };
    }) => {
      capte.onDirtyChange = props.onDirtyChange ?? null;
      const ref = props.discardDraftRef;
      useEffect(() => {
        if (!ref) return;
        ref.current = capte.rejeterBrouillon;
        return () => {
          ref.current = null;
        };
      }, [ref]);
      return <div data-testid="smart-coform" />;
    },
  };
});

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));

vi.mock("@/hooks/useLoadNamespace", () => ({
  useLoadNamespace: () => ({ loaded: true }),
}));

import { CoFormModal } from "./CoFormModal";

describe("CoFormModal — « Abandonner les modifications »", () => {
  beforeEach(() => {
    capte.onDirtyChange = null;
    capte.rejeterBrouillon.mockReset();
  });

  function ouvrirModifiee() {
    const onOpenChange = vi.fn();
    render(<CoFormModal formId="form-1" open onOpenChange={onOpenChange} />);
    expect(screen.getByTestId("smart-coform")).toBeInTheDocument();
    act(() => capte.onDirtyChange?.(true));
    // Fermeture demandée (croix du Dialog) → boîte « Modifications non enregistrées ».
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    return onOpenChange;
  }

  it("rejette le brouillon AVANT de fermer", () => {
    const onOpenChange = ouvrirModifiee();
    const abandonner = screen.getByText("coform.modal.discardChanges");
    expect(capte.rejeterBrouillon).not.toHaveBeenCalled();

    fireEvent.click(abandonner);

    expect(capte.rejeterBrouillon).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Ordre : le rejet précède la fermeture (sinon le démontage flusherait avant).
    expect(capte.rejeterBrouillon.mock.invocationCallOrder[0]).toBeLessThan(
      onOpenChange.mock.invocationCallOrder[0],
    );
  });

  it("« Continuer la saisie » ne rejette rien et ne ferme pas", () => {
    const onOpenChange = ouvrirModifiee();
    fireEvent.click(screen.getByText("coform.modal.continueEditing"));
    expect(capte.rejeterBrouillon).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("« Enregistrer » ne rejette pas le brouillon (la purge viendra du succès)", () => {
    ouvrirModifiee();
    fireEvent.click(screen.getByText("coform.modal.save"));
    expect(capte.rejeterBrouillon).not.toHaveBeenCalled();
  });

  it("fermer SANS modification ne rejette pas le brouillon — le filet reste", () => {
    const onOpenChange = vi.fn();
    render(<CoFormModal formId="form-1" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(capte.rejeterBrouillon).not.toHaveBeenCalled();
  });
});
