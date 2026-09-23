// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../tests/test-utils-ui";
import type { AmpliModel } from "../types";

/**
 * Suppression d'un ampli — l'action est irréversible côté Co : rien ne part
 * sans confirmation, et ce que le legacy NE supprime PAS est annoncé.
 */

const mutate = vi.fn();
let isPending: boolean;
vi.mock("../hooks/useAmpliAdmin", () => ({
  useRemoveAmpli: () => ({ mutate, isPending }),
}));

const { AmpliDeleteButton } = await import("./AmpliDeleteButton");

const AMPLI: AmpliModel = {
  slug: "sinistre",
  name: "Sinistre",
  tags: [],
  path: { name: "step.name", address: "step.address" },
  coform: "6927e9f0db22da724360303c",
};

const render = () => renderWithProviders(<AmpliDeleteButton ampli={AMPLI} />);
const openConfirm = () => userEvent.click(screen.getByRole("button", { name: "Supprimer l'ampli Sinistre" }));

describe("AmpliDeleteButton", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    mutate.mockReset();
    isPending = false;
  });

  it("ne supprime rien avant confirmation", async () => {
    render();

    await openConfirm();

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Supprimer « Sinistre » ?");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("dit ce qui survit à la suppression", async () => {
    render();

    await openConfirm();

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Le formulaire de dépôt et les propositions déjà déposées, eux, sont conservés.",
    );
  });

  it("renonce sans rien envoyer", async () => {
    render();

    await openConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("envoie la suppression de CET ampli une fois confirmée", async () => {
    render();

    await openConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(mutate).toHaveBeenCalledWith(AMPLI, expect.anything());
  });

  // La confirmation reste ouverte tant que le serveur n'a pas répondu : la
  // refermer laisserait croire que c'est fait.
  it("verrouille la confirmation pendant l'appel", async () => {
    isPending = true;
    render();

    await openConfirm();

    expect(screen.getByRole("button", { name: /Supprimer$/ })).toBeDisabled();
  });
});
