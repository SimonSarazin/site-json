// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinderElementCard } from "./FinderElementCard";

/**
 * Mode sélection (modale de recherche d'un finder) : la case ET la carte sélectionnent.
 *
 * Défaut corrigé le 30/09 : la case appelait `onSelect` (`onCheckedChange`) puis son clic remontait
 * au `onClick` de la carte — deux bascules d'une mise à jour fonctionnelle, donc rien de
 * sélectionné. Au clavier, Espace produit ce même clic, et la carte n'est pas focalisable : aucune
 * sélection n'était possible. Constaté au navigateur (« Valider » restait grisé).
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string, params?: Record<string, unknown>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const EL = { id: "63771a2a2129551c8f4fd9c3", name: "Dora", type: "citoyens" as const };

function carte(onSelect: () => void, isSelected = false) {
  return render(<FinderElementCard element={EL} selectionMode isSelected={isSelected} onSelect={onSelect} />);
}

describe("FinderElementCard — mode sélection", () => {
  it("un clic sur la CASE sélectionne, une seule fois", async () => {
    const onSelect = vi.fn();
    carte(onSelect);
    await userEvent.setup().click(screen.getByRole("checkbox"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("au clavier, Espace sur la case sélectionne, une seule fois", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    carte(onSelect);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox"));
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("un clic sur la carte (le nom) sélectionne, une seule fois", async () => {
    const onSelect = vi.fn();
    carte(onSelect);
    await userEvent.setup().click(screen.getByText("Dora"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("la case porte un libellé traduit, avec le nom, qui suit l'état", () => {
    const { rerender } = carte(vi.fn());
    expect(screen.getByRole("checkbox").getAttribute("aria-label"))
      .toBe('coform.finder.elementCard.selectAria {"name":"Dora"}');
    rerender(<FinderElementCard element={EL} selectionMode isSelected onSelect={vi.fn()} />);
    expect(screen.getByRole("checkbox").getAttribute("aria-label"))
      .toBe('coform.finder.elementCard.deselectAria {"name":"Dora"}');
  });
});
