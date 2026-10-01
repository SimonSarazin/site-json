// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Ce qui est verrouillé ici : l'imbrication des deux triggers Radix (`TooltipTrigger asChild`
 * dans le `DialogTrigger asChild` de `CagnotteDialog`). Si la composition des `Slot` casse, le
 * survol marche mais le clic n'ouvre plus la cagnotte.
 */

// jsdom ne fournit pas ResizeObserver, dont le Popper de `TooltipContent` a besoin.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: { id: "u1" }, entity: { serverData: {} } }),
}));
vi.mock("@/hooks/useReactiveProperty", () => ({ useReactiveProperty: () => ({}) }));
vi.mock("../hooks/useFundingEnvelope", () => ({
  useFundingEnvelope: () => ({
    data: { projects: [{ id: "p1", totalFinancement: 1250 }], selectedProject: null },
    refetch: vi.fn(),
  }),
}));

/**
 * Stub de `CagnotteDialog` réduit à son câblage réel : `<Dialog><DialogTrigger asChild>`.
 * Les primitives Radix restent les vraies, sinon le test ne dit rien de la composition.
 */
function CagnotteDialogStub({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open && (
        <DialogContent>
          <DialogTitle>Cagnotte</DialogTitle>
          <div data-testid="cagnotte-open" />
        </DialogContent>
      )}
    </Dialog>
  );
}
vi.mock("./CagnotteDialog", () => ({ default: CagnotteDialogStub }));

const { PiggyBankHeaderButton } = await import("./PiggyBankHeaderButton");

describe("PiggyBankHeaderButton — tooltip", () => {
  it("affiche le tooltip au focus du bouton", async () => {
    render(<PiggyBankHeaderButton />);

    expect(screen.queryByText("Ouvrir la cagnotte participative")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: "Cagnotte participative" }));

    // Radix duplique le texte dans un `VisuallyHidden` role=tooltip → getAll.
    expect((await screen.findAllByText("Ouvrir la cagnotte participative")).length).toBeGreaterThan(0);
  });

  it("ouvre toujours la cagnotte au clic malgré le TooltipTrigger intercalé", () => {
    render(<PiggyBankHeaderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Cagnotte participative" }));

    expect(screen.getByTestId("cagnotte-open")).toBeInTheDocument();
  });
});
