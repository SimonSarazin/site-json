// @vitest-environment jsdom
/**
 * Une action portée par l'URL (`?participer`) ouvre la confirmation dès l'arrivée, sans clic, et le
 * paramètre n'est consommé qu'à la FERMETURE — confirmée ou non — pour qu'il n'y ait qu'une seule
 * ouverture. Rien ne part sans confirmation : le lien n'inscrit personne tout seul.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";

import { StatusDropdownLayout } from "./StatusDropdownLayout";
import type { EntityAction } from "../../types";

const participer = (onClick: () => void): EntityAction => ({
  id: "participate",
  type: "join",
  label: "Participer",
  icon: <Users className="w-4 h-4 mr-2" />,
  variant: "default",
  onClick,
  requiresConfirmation: true,
  confirmationTitle: "Participer à cet événement",
  confirmationDescription: "L'organisateur sera notifié.",
  confirmationConfirm: "Participer",
  confirmationCancel: "Annuler",
  show: true,
});

function monter(action: EntityAction, onUrlActionDone: () => void) {
  return render(
    <StatusDropdownLayout
      actions={[action]}
      statusLabel="Suivre"
      statusIcon={null}
      statusVariant="outline"
      urlAction={action}
      onUrlActionDone={onUrlActionDone}
    />,
  );
}

describe("StatusDropdownLayout — action portée par l'URL", () => {
  it("ouvre la confirmation sans clic, et ne lance rien", () => {
    const onClick = vi.fn();
    monter(participer(onClick), vi.fn());

    expect(screen.getByText("Participer à cet événement")).toBeDefined();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("annuler consomme le paramètre sans inscrire", async () => {
    const onClick = vi.fn();
    const done = vi.fn();
    monter(participer(onClick), done);

    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onClick).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("confirmer inscrit PUIS consomme le paramètre", async () => {
    const onClick = vi.fn();
    const done = vi.fn();
    monter(participer(onClick), done);

    await userEvent.click(screen.getByRole("button", { name: "Participer" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("sans action portée par l'URL, rien ne s'ouvre", () => {
    render(
      <StatusDropdownLayout actions={[participer(vi.fn())]} statusLabel="Suivre" statusIcon={null} statusVariant="outline" />,
    );
    expect(screen.queryByText("Participer à cet événement")).toBeNull();
  });
});
