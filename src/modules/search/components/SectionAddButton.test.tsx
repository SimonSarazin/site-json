// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SectionAddButton } from "./SectionAddButton";

/**
 * Bouton « Ajouter » de l'en-tête d'une liste : sous `sm`, son libellé est masqué (`hidden
 * sm:inline`) et il n'est plus qu'une icône. Son nom accessible doit donc venir de l'`aria-label` —
 * jsdom n'applique pas les classes, une requête par nom trouverait le texte : on vérifie l'attribut.
 */
describe("SectionAddButton", () => {
  it("porte son libellé en `aria-label` (seul nom accessible sous `sm`) et déclenche l'ajout", () => {
    const onClick = vi.fn();
    render(<SectionAddButton label="Ajouter un créneau" onClick={onClick} />);
    const bouton = screen.getByRole("button");
    expect(bouton.getAttribute("aria-label")).toBe("Ajouter un créneau");
    fireEvent.click(bouton);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
