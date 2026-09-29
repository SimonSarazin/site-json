// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Bouton de modale d'ajout : porte admin (`requiresAdmin`) et transmission de
 * `createDefaults` à la modale.
 */

const state = vi.hoisted(() => ({
  me: { id: "u1" } as unknown,
  isAdmin: false,
  modalProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/modules/profil/i18n", () => ({}));
vi.mock("@/hooks/useT", () => ({
  useT: () => (v: unknown) => (typeof v === "string" ? v : (v as { fr: string })?.fr ?? ""),
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => undefined }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ me: state.me, entity: null }),
}));
vi.mock("@/modules/auth", () => ({
  useAuthModal: () => ({ openLogin: vi.fn() }),
}));
vi.mock("../hooks/useProfilPermissions", () => ({
  useProfilPermissions: () => ({ isAdmin: state.isAdmin }),
}));
vi.mock("../actions/hooks/useOrgEntityActions", () => ({ useOrgEntityActions: () => null }));
vi.mock("./add/ModalRegistry", () => ({
  DynamicModal: (props: Record<string, unknown>) => {
    if (props.open) state.modalProps.push(props);
    return props.open ? <div data-testid="add-modal" /> : null;
  },
}));
vi.mock("lucide-react/dynamic", () => ({ DynamicIcon: () => <span /> }));
vi.mock("react-router", () => ({
  Link: ({ children, ...p }: React.ComponentProps<"a">) => <a {...p}>{children}</a>,
}));

import { ActionButtonGroup } from "./ActionButtonGroup";

const BOUTON = {
  label: { fr: "Ajouter une organisation" },
  action: "add-organization" as const,
  createDefaults: { type: "Cooperative" },
};

describe("ActionButtonGroup — bouton de modale d'ajout", () => {
  beforeEach(() => {
    state.me = { id: "u1" };
    state.isAdmin = false;
    state.modalProps = [];
  });

  it("transmet createDefaults à la modale", () => {
    render(<ActionButtonGroup buttons={[{ ...BOUTON, requiresAdmin: false }]} />);
    fireEvent.click(screen.getByText("Ajouter une organisation"));

    expect(screen.getByTestId("add-modal")).toBeInTheDocument();
    expect(state.modalProps[state.modalProps.length - 1]).toMatchObject({
      modalName: "add-organization",
      createDefaults: { type: "Cooperative" },
    });
  });

  it("sans requiresAdmin: false, le bouton est masqué pour un non-admin", () => {
    render(<ActionButtonGroup buttons={[BOUTON]} />);
    expect(screen.queryByText("Ajouter une organisation")).not.toBeInTheDocument();
  });
});
