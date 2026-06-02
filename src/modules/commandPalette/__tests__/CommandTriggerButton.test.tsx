// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const state = vi.hoisted(() => ({
  enabled: true as boolean,
  openPalette: vi.fn(),
}));

vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({ config: { commandPalette: state.enabled ? { enabled: true } : undefined } }),
}));
vi.mock("../hooks/useCommandPalette", () => ({
  useCommandPaletteOptional: () => ({
    open: false,
    setOpen: vi.fn(),
    openPalette: state.openPalette,
    closePalette: vi.fn(),
    enabled: true,
  }),
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useIsMounted", () => ({ useIsMounted: () => true }));

import CommandTriggerButton from "../components/CommandTriggerButton";

describe("CommandTriggerButton", () => {
  beforeEach(() => {
    state.enabled = true;
    state.openPalette.mockClear();
  });

  it("rend un bouton et ouvre la palette au clic quand activé", () => {
    render(<CommandTriggerButton />);
    const btn = screen.getByRole("button", { name: "triggerLabel" });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(state.openPalette).toHaveBeenCalledTimes(1);
  });

  it("ne rend rien quand la fonctionnalité est désactivée en config", () => {
    state.enabled = false;
    const { container } = render(<CommandTriggerButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
