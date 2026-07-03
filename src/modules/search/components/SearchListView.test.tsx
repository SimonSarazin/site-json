// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import SearchListView from "./SearchListView";

// SearchListView appelle useSearchParams() → il DOIT être rendu sous un Router.
const renderInRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/**
 * Mode split : SearchListView devient contrôlé via `focusedItemId`/`onFocusItem`.
 * On vérifie le contrat de synchro liste↔carte (sans dépendre des variants de
 * carte lazy) : ring sur la carte focalisée, `scrollIntoView` au changement de
 * focus, et clic = `onFocusItem` (PAS l'ouverture du détail) quand fourni.
 */

// Stubs : on isole la logique du wrapper (les variants réels sont lazy + lourds).
vi.mock("./SearchCard", () => ({
  default: ({ item, onClick }: { item: SearchEntity; onClick?: () => void }) => (
    <button onClick={onClick}>{String((item.serverData as { name?: string }).name)}</button>
  ),
}));
vi.mock("./SearchCardDetailed", () => ({
  default: ({ item, onClick }: { item: SearchEntity; onClick?: () => void }) => (
    <button onClick={onClick}>{String((item.serverData as { name?: string }).name)}</button>
  ),
}));
vi.mock("./SwitchDetailsMode", () => ({
  SwitchDetailsMode: () => <div data-testid="details-modal" />,
}));

const item = (id: string, name: string) =>
  ({ serverData: { id, name } } as unknown as SearchEntity);
const results = [item("1", "Alpha"), item("2", "Bravo")];

beforeEach(() => {
  // jsdom n'implémente pas scrollIntoView → on l'espionne.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("SearchListView (mode split / focus)", () => {
  it("applique le ring sur la carte dont l'id == focusedItemId", () => {
    const { container } = renderInRouter(
      <SearchListView results={results} focusedItemId="2" onFocusItem={vi.fn()} />,
    );
    const focused = container.querySelector('[data-item-id="2"]');
    const other = container.querySelector('[data-item-id="1"]');
    expect(focused?.className).toContain("ring-2");
    expect(other?.className).not.toContain("ring-2");
  });

  it("clic sur une carte → onFocusItem(id), sans ouvrir le détail", () => {
    const onFocusItem = vi.fn();
    renderInRouter(<SearchListView results={results} onFocusItem={onFocusItem} />);
    fireEvent.click(screen.getByText("Bravo"));
    expect(onFocusItem).toHaveBeenCalledWith("2");
    expect(screen.queryByTestId("details-modal")).toBeNull();
  });

  it("scrollIntoView appelé quand un focus est présent", () => {
    renderInRouter(<SearchListView results={results} focusedItemId="1" onFocusItem={vi.fn()} />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("mode liste classique (ni focusedItemId ni onFocusItem) : aucun ring, clic ouvre le détail", () => {
    const { container } = renderInRouter(<SearchListView results={results} />);
    expect(container.querySelector('[data-item-id="2"]')?.className).not.toContain("ring-2");
    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.getByTestId("details-modal")).toBeInTheDocument();
  });
});
