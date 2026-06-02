// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RenderedGroup } from "../lib/commandFilter";

const h = vi.hoisted(() => ({
  groups: [] as RenderedGroup[],
  loading: false,
  open: true,
}));

vi.mock("../hooks/useCommands", () => ({
  useCommands: () => ({ groups: h.groups, loading: h.loading }),
}));
vi.mock("../hooks/useCommandRunContext", () => ({ useCommandRunContext: () => ({}) }));
vi.mock("../hooks/useCommandPalette", () => ({
  useCommandPalette: () => ({ open: h.open, setOpen: vi.fn(), closePalette: vi.fn() }),
}));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/hooks/useLocalization", () => ({ useLocalization: () => ({ currentLocale: "fr" }) }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
// Évite l'enregistrement réel des sources (et la dépendance au module profil).
vi.mock("../sources/bootstrap", () => ({}));

// jsdom ne fournit pas ResizeObserver / scrollIntoView dont `cmdk` a besoin.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

import { CommandPalette } from "../components/CommandPalette";

const navGroup: RenderedGroup = {
  group: { id: "nav", heading: "Navigation" },
  commands: [{ id: "nav:/", label: "Accueil", group: "nav", perform: vi.fn() }],
};

describe("CommandPalette", () => {
  beforeEach(() => {
    h.groups = [];
    h.loading = false;
    h.open = true;
  });

  it("affiche les groupes et leurs commandes quand ouverte", () => {
    h.groups = [navGroup];
    render(<CommandPalette />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Accueil")).toBeInTheDocument();
  });

  it("ouvre le dialog mais n'affiche aucune commande sans résultat", () => {
    h.groups = [];
    render(<CommandPalette />);
    // Le dialog est ouvert (l'input avec le placeholder est présent)…
    expect(screen.getByPlaceholderText("placeholder")).toBeInTheDocument();
    // …mais aucune commande n'est rendue.
    expect(screen.queryByText("Accueil")).not.toBeInTheDocument();
  });

  it("ne rend rien de visible quand fermée", () => {
    h.open = false;
    h.groups = [navGroup];
    render(<CommandPalette />);
    expect(screen.queryByText("Accueil")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("placeholder")).not.toBeInTheDocument();
  });
});
