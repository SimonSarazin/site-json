// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { createPortal } from "react-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenericForm } from "./GenericForm";
import { registerLayout } from "../layouts";
import type { FormDescriptor } from "../types";

/**
 * Un `GenericForm` rendu DANS un portail, sous un autre formulaire, ne soumet pas ce dernier.
 *
 * En React, un `submit` remonte l'arbre des COMPOSANTS, portails compris : la modale de création d'un
 * finder coform (rendue sous sa question) soumettait AUSSI le formulaire de dépôt — sa validation
 * partait, ses erreurs s'affichaient derrière. Vu au navigateur le 01/10.
 */

registerLayout("sonde-submit", () => <button type="submit">soumettre</button>);
const descriptor = {
  id: "sonde",
  collection: "organizations",
  layout: { kind: "sonde-submit" },
  sections: [],
  fields: {},
} as unknown as FormDescriptor;

describe("GenericForm — soumission dans un portail", () => {
  it("soumet son propre formulaire, jamais le formulaire hôte", async () => {
    const hote = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const cree = vi.fn();
    render(
      <form onSubmit={hote}>
        {createPortal(
          <GenericForm descriptor={descriptor} defaultValues={{}} onSubmit={cree} t={(k) => String(k)} submitLabel="ok" />,
          document.body
        )}
      </form>
    );

    await userEvent.setup().click(await screen.findByRole("button", { name: "soumettre" }));
    await waitFor(() => expect(cree).toHaveBeenCalled());
    expect(hote).not.toHaveBeenCalled();
  });
});
