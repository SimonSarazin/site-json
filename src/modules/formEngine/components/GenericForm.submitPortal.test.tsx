// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GenericForm } from "./GenericForm";
import { registerLayout } from "../layouts";
import type { FormDescriptor } from "../types";

/**
 * Un `GenericForm` rendu dans son dialogue, sous un autre formulaire, ne soumet pas ce dernier.
 *
 * En React, un `submit` remonte l'arbre des COMPOSANTS, portails compris : la modale de création d'un
 * finder coform (rendue sous sa question) soumettait AUSSI le formulaire de dépôt — sa validation
 * partait, ses erreurs s'affichaient derrière. Vu au navigateur le 01/10.
 *
 * Le garde vit sur le CONTENU du dialogue (`stopSubmitAtPortal`), pas dans `GenericForm` : ce test
 * monte donc le formulaire comme `EntityFormModal` le monte, dans un `DialogContent`.
 */

registerLayout("sonde-submit", () => <button type="submit">soumettre</button>);
const descriptor = {
  id: "sonde",
  collection: "organizations",
  layout: { kind: "sonde-submit" },
  sections: [],
  fields: {},
} as unknown as FormDescriptor;

describe("GenericForm — soumission dans un dialogue", () => {
  it("soumet son propre formulaire, jamais le formulaire hôte", async () => {
    const hote = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const cree = vi.fn();
    render(
      <form onSubmit={hote}>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Créer</DialogTitle>
            <DialogDescription>Un élément</DialogDescription>
            <GenericForm descriptor={descriptor} defaultValues={{}} onSubmit={cree} t={(k) => String(k)} submitLabel="ok" />
          </DialogContent>
        </Dialog>
      </form>
    );

    await userEvent.setup().click(await screen.findByRole("button", { name: "soumettre" }));
    await waitFor(() => expect(cree).toHaveBeenCalled());
    expect(hote).not.toHaveBeenCalled();
  });
});
