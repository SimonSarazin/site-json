// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Ce qui est verrouillé ici : l'imbrication des deux triggers Radix (`TooltipTrigger asChild`
 * dans le `DialogTrigger asChild` de `CagnotteDialog`). Si la composition des `Slot` casse, le
 * survol marche mais le clic n'ouvre plus la cagnotte. Et, sur un site AAC, le formulaire que
 * lisent l'enveloppe et la modale.
 */

const state = vi.hoisted(() => ({
  siteConfig: {} as Record<string, unknown>,
  useFundingEnvelope: vi.fn(() => ({
    data: { projects: [{ id: "p1", totalFinancement: 1250 }], selectedProject: null },
    refetch: vi.fn(),
  })),
}));

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
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: state.siteConfig }) }));
vi.mock("../hooks/useFundingEnvelope", () => ({ useFundingEnvelope: state.useFundingEnvelope }));

/**
 * Stub de `CagnotteDialog` réduit à son câblage réel : `<Dialog><DialogTrigger asChild>`.
 * Les primitives Radix restent les vraies, sinon le test ne dit rien de la composition.
 */
function CagnotteDialogStub({ children, openContext }: { children: ReactNode; openContext?: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span data-testid="open-context" hidden>{JSON.stringify(openContext ?? null)}</span>
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

describe("PiggyBankHeaderButton — formulaire de l'enveloppe", () => {
  afterEach(() => {
    state.siteConfig = {};
    state.useFundingEnvelope.mockClear();
  });

  it("sans AAC : premier formulaire de l'hôte, modale sans formulaire imposé", () => {
    render(<PiggyBankHeaderButton />);

    expect(state.useFundingEnvelope).toHaveBeenLastCalledWith(undefined, { form: null });
    expect(screen.getByTestId("open-context").textContent).toBe("null");
  });

  it("site AAC : l'enveloppe et la modale lisent le formulaire de l'annuaire", () => {
    state.siteConfig = { cagnotteModuleConfig: { defaultType: "aac" }, aac: { formId: "form-aac" } };
    render(<PiggyBankHeaderButton />);

    expect(state.useFundingEnvelope).toHaveBeenLastCalledWith(undefined, { form: { id: "form-aac" } });
    expect(JSON.parse(screen.getByTestId("open-context").textContent ?? "")).toEqual({ envelopeForm: { id: "form-aac" } });
  });
});
