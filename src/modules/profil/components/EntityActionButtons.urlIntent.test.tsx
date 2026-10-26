// @vitest-environment jsdom
/**
 * `?participer` vise la participation à l'ÉVÉNEMENT de la page — pas n'importe quelle action de
 * type `join` (adhésion à une organisation, promotion admin), et pas l'aperçu d'un autre
 * événement déplié dans un onglet. Le paramètre disparaît de l'URL à la fermeture.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { ProfileEntityContext, type ProfileEntityContextType } from "../contexts/ProfileEntityContext";
import type { EntityAction, EntityActionsResult } from "../types";

const state = vi.hoisted(() => ({ actions: [] as unknown[] }));

vi.mock("../actions", () => ({
  useEntityActions: (): EntityActionsResult => ({
    actions: state.actions as EntityAction[],
    layout: "status-dropdown",
    statusLabel: "Suivre",
    statusIcon: <span />,
    statusVariant: "outline",
  }),
}));

import { EntityActionButtons } from "./EntityActionButtons";

const action = (id: string, titre: string, onClick = vi.fn()): EntityAction => ({
  id,
  type: "join",
  label: titre,
  icon: null,
  variant: "default",
  onClick,
  requiresConfirmation: true,
  confirmationTitle: titre,
  confirmationDescription: "",
  confirmationConfirm: "Confirmer",
  confirmationCancel: "Annuler",
  show: true,
});

const PAGE = { serverData: { slug: "fete-du-lieu" } } as unknown as EntityTypes;
const APERCU = { serverData: { slug: "autre" } } as unknown as EntityTypes;

function Url() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function monter(entity: EntityTypes, search = "?participer") {
  const value = { entity: PAGE, config: {}, entityType: "event" } as unknown as ProfileEntityContextType;
  return render(
    <MemoryRouter initialEntries={[`/profil/fete-du-lieu${search}`]}>
      <ProfileEntityContext.Provider value={value}>
        <EntityActionButtons entity={entity} />
        <Url />
      </ProfileEntityContext.Provider>
    </MemoryRouter>,
  );
}

describe("EntityActionButtons — ?participer", () => {
  beforeEach(() => {
    state.actions = [];
  });

  it("ouvre la participation, pas la première action `join` venue", () => {
    state.actions = [action("join", "Demander à devenir membre"), action("participate", "Participer à cet événement")];
    monter(PAGE);

    expect(screen.getByText("Participer à cet événement")).toBeDefined();
    expect(screen.queryByText("Demander à devenir membre")).toBeNull();
  });

  // Sur une organisation, il n'y a pas de `participate` : le lien ne doit RIEN ouvrir, et surtout
  // pas une demande d'adhésion ou de promotion.
  it("n'ouvre rien sans action `participate` (organisation, projet)", () => {
    state.actions = [action("join", "Demander à devenir membre"), action("requestPromotion", "Devenir administrateur")];
    monter(PAGE);

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("search").textContent).toBe("?participer");
  });

  it("n'ouvre rien pour un aperçu qui n'est pas l'entité de la page", () => {
    state.actions = [action("participate", "Participer à cet événement")];
    monter(APERCU);

    expect(screen.queryByText("Participer à cet événement")).toBeNull();
  });

  it("n'ouvre rien quand `participate` n'est pas dans la liste — c'est en amont (`useEntityActions`) que déconnecté ou déjà participant la retirent", () => {
    state.actions = [action("follow", "Suivre")];
    monter(PAGE);

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("confirmer inscrit et retire le paramètre de l'URL", async () => {
    const onClick = vi.fn();
    state.actions = [action("participate", "Participer à cet événement", onClick)];
    monter(PAGE, "?tab=infos&participer");

    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("search").textContent).toBe("?tab=infos");
    expect(screen.queryByText("Participer à cet événement")).toBeNull();
  });

  it("annuler retire aussi le paramètre : une seule ouverture", async () => {
    const onClick = vi.fn();
    state.actions = [action("participate", "Participer à cet événement", onClick)];
    monter(PAGE);

    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("search").textContent).toBe("");
    expect(screen.queryByText("Participer à cet événement")).toBeNull();
  });
});
