// @vitest-environment jsdom
/**
 * Le menu d'actions rend-il vraiment la suppression, et la fait-il CONFIRMER ? Les autres tests
 * couvrent qui a le droit de la voir ; celui-ci couvre le geste : tant que l'utilisateur n'a pas
 * confirmé, rien ne part — une suppression déclenchée au premier clic serait irrattrapable.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2 } from "lucide-react";

import { StatusDropdownLayout } from "./StatusDropdownLayout";
import type { EntityAction } from "../../types";

const actionSuppression = (onClick: () => void): EntityAction => ({
  id: "delete",
  type: "delete",
  label: "Supprimer cette fiche",
  icon: <Trash2 className="w-4 h-4 mr-2" />,
  variant: "destructive",
  onClick,
  requiresConfirmation: true,
  confirmationTitle: "Supprimer définitivement cette fiche ?",
  confirmationDescription: "La fiche sera supprimée de Communecter, pas seulement de ce site.",
  confirmationConfirm: "Supprimer définitivement",
  confirmationCancel: "Annuler",
  isDestructive: true,
  show: true,
});

const monter = (onClick: () => void) =>
  render(
    <StatusDropdownLayout
      actions={[actionSuppression(onClick)]}
      statusLabel="Administrateur"
      statusIcon={null}
      statusVariant="default"
    />,
  );

describe("StatusDropdownLayout — suppression de la fiche", () => {
  it("affiche l'entrée dans le menu", async () => {
    monter(vi.fn());
    await userEvent.click(screen.getByRole("button", { name: /Administrateur/ }));
    expect(await screen.findByText("Supprimer cette fiche")).toBeDefined();
  });

  it("un clic NE supprime PAS : il demande d'abord confirmation", async () => {
    const onClick = vi.fn();
    monter(onClick);
    await userEvent.click(screen.getByRole("button", { name: /Administrateur/ }));
    await userEvent.click(await screen.findByText("Supprimer cette fiche"));

    expect(await screen.findByText("Supprimer définitivement cette fiche ?")).toBeDefined();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("la suppression ne part qu'après confirmation explicite", async () => {
    const onClick = vi.fn();
    monter(onClick);
    await userEvent.click(screen.getByRole("button", { name: /Administrateur/ }));
    await userEvent.click(await screen.findByText("Supprimer cette fiche"));
    await userEvent.click(await screen.findByRole("button", { name: "Supprimer définitivement" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
