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
// Même séquence qu'`EntityFormModal` après une création : fermeture, PUIS `onCreated`.
const CREE = { slug: "nouvel-evenement", serverData: { slug: "nouvel-evenement" } } as unknown as EntityTypes;
vi.mock("../add/ModalRegistry", () => ({
  DynamicModal: (props: {
    modalName: string;
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onCreated?: (e: EntityTypes) => void;
  }) =>
    props.open ? (
      <div role="dialog" data-testid={props.modalName} data-redirige={props.onCreated ? "non" : "oui"}>
        <button type="button" onClick={() => props.onOpenChange(false)}>Fermer</button>
        <button
          type="button"
          onClick={() => {
            props.onOpenChange(false);
            props.onCreated?.(CREE);
          }}
        >
          Créer
        </button>
      </div>
    ) : null,
}));

import { AddEntityDropdown } from "./AddEntityDropdown";

const PAGE = { serverData: { slug: "le-lieu" } } as unknown as EntityTypes;
const AUTRE = { serverData: { slug: "autre" } } as unknown as EntityTypes;

function Url() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{pathname + search}</output>;
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
    expect(screen.getByTestId("url").textContent).toBe("/profil/le-lieu?ajouter=organization");
  });

  it("n'ouvre rien quand aucune permission d'ajout n'est accordée — et le menu lui-même n'est pas rendu", () => {
    state.permissions = { canAddEvent: false, canAddOrganization: false, canAddProject: false, canAddPoi: false };
    monter(PAGE, "?ajouter=event");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("n'ouvre rien pour une entité qui n'est pas celle de la page", () => {
    monter(AUTRE, "?ajouter=event");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Le paramètre part de l'URL du LIEU avant la redirection : la fiche créée n'hérite ni de
  // `ajouter`, ni des autres paramètres du lien (ex. `utm_source`).
  it("créer depuis le lien : ferme, retire le paramètre, puis va sur la fiche créée", async () => {
    monter(PAGE, "?utm_source=wp&ajouter=event");
    expect(screen.getByTestId("add-event").dataset.redirige).toBe("non");

    await userEvent.click(screen.getByRole("button", { name: "Créer" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("url").textContent).toBe("/profil/nouvel-evenement");
  });

  it("fermer la modale retire le paramètre : une seule ouverture", async () => {
    monter(PAGE, "?tab=agenda&ajouter=event");

    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("url").textContent).toBe("/profil/le-lieu?tab=agenda");
  });
});
