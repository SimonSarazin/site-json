// @vitest-environment jsdom
/**
 * `?ajouter=<type>` ouvre la modale de création de ce type sur la fiche — avec les MÊMES gardes de
 * permission qu'un clic dans le menu : sans droit, rien ne s'ouvre. Le paramètre part à la
 * fermeture de la modale.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { ProfileEntityContext, type ProfileEntityContextType } from "../../contexts/ProfileEntityContext";

const state = vi.hoisted(() => ({
  permissions: { canAddEvent: true, canAddOrganization: false, canAddProject: false, canAddPoi: false },
}));

vi.mock("@/hooks/useT", () => ({
  useT: () => (v: unknown) => (typeof v === "string" ? v : (v as { fr: string })?.fr ?? ""),
}));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ entity: null }) }));
vi.mock("@/lib/visibility", () => ({ useVisibilityList: (c: unknown[]) => c.map(() => true) }));
vi.mock("../../hooks/useProfilPermissions", () => ({ useProfilPermissions: () => state.permissions }));
vi.mock("lucide-react/dynamic", () => ({ DynamicIcon: () => <span /> }));
vi.mock("../add/ModalRegistry", () => ({
  DynamicModal: (props: { modalName: string; open: boolean; onOpenChange: (o: boolean) => void }) =>
    props.open ? (
      <div role="dialog" data-testid={props.modalName}>
        <button type="button" onClick={() => props.onOpenChange(false)}>Fermer</button>
      </div>
    ) : null,
}));

import { AddEntityDropdown } from "./AddEntityDropdown";

const PAGE = { serverData: { slug: "le-lieu" } } as unknown as EntityTypes;
const AUTRE = { serverData: { slug: "autre" } } as unknown as EntityTypes;

function Url() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function monter(entity: EntityTypes, search: string) {
  const value = { entity: PAGE, config: {}, entityType: "organization" } as unknown as ProfileEntityContextType;
  return render(
    <MemoryRouter initialEntries={[`/profil/le-lieu${search}`]}>
      <ProfileEntityContext.Provider value={value}>
        <AddEntityDropdown entity={entity} />
        <Url />
      </ProfileEntityContext.Provider>
    </MemoryRouter>,
  );
}

describe("AddEntityDropdown — ?ajouter=<type>", () => {
  beforeEach(() => {
    state.permissions = { canAddEvent: true, canAddOrganization: false, canAddProject: false, canAddPoi: false };
  });

  it("ouvre la modale de création d'événement sans clic", () => {
    monter(PAGE, "?ajouter=event");
    expect(screen.getByTestId("add-event")).toBeDefined();
  });

  it("n'ouvre rien pour un type que l'utilisateur n'a pas le droit de créer", () => {
    monter(PAGE, "?ajouter=organization");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("search").textContent).toBe("?ajouter=organization");
  });

  it("n'ouvre rien sans droit du tout (déconnecté) — et le menu lui-même n'est pas rendu", () => {
    state.permissions = { canAddEvent: false, canAddOrganization: false, canAddProject: false, canAddPoi: false };
    monter(PAGE, "?ajouter=event");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("n'ouvre rien pour une entité qui n'est pas celle de la page", () => {
    monter(AUTRE, "?ajouter=event");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fermer la modale retire le paramètre : une seule ouverture", async () => {
    monter(PAGE, "?tab=agenda&ajouter=event");

    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("search").textContent).toBe("?tab=agenda");
  });
});
