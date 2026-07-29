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

// `useNavigate` est espionné (action `itemAction.kind: "link"`) ; le reste de react-router — dont
// `useSearchParams`, indispensable au wrapper — reste RÉEL sous le MemoryRouter.
const navigateMock = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigateMock,
}));

// Stubs : on isole la logique du wrapper (les variants réels sont lazy + lourds). Ils exposent la
// conf REÇUE (card.type / preview.type) pour vérifier la résolution par item.
vi.mock("./SearchCard", () => ({
  default: ({ item, onClick, card }: { item: SearchEntity; onClick?: () => void; card?: { type?: string } }) => (
    <button onClick={onClick} data-card-type={card?.type}>
      {String((item.serverData as { name?: string }).name)}
    </button>
  ),
}));
vi.mock("./SearchCardDetailed", () => ({
  default: ({ item, onClick, card }: { item: SearchEntity; onClick?: () => void; card?: { type?: string } }) => (
    <button onClick={onClick} data-card-type={card?.type}>
      {String((item.serverData as { name?: string }).name)}
    </button>
  ),
}));
vi.mock("./SwitchDetailsMode", () => ({
  SwitchDetailsMode: ({ item, card, preview }: { item: SearchEntity; card?: { detailsMode?: string }; preview?: { type?: string } }) => (
    <div
      data-testid="details-modal"
      data-item={String((item.serverData as { name?: string }).name)}
      data-details-mode={card?.detailsMode}
      data-preview-type={preview?.type}
    />
  ),
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

/**
 * Liste HÉTÉROGÈNE : la carte, le conteneur du détail et l'action au clic se décident PAR ITEM
 * (`list.itemRules`), le `SwitchDetailsMode` restant monté une seule fois hors de la boucle.
 */
const typed = (id: string, name: string, type: string) =>
  ({ serverData: { id, name, collection: "poi", type }, slug: `slug-${id}` }) as unknown as SearchEntity;
const mixed = [typed("1", "Article", "article"), typed("2", "Parole", "affiche")];

const eq = (field: string, value: string) => ({ field, op: "eq", value });
const LIST_WITH_RULES = {
  card: { type: "default", detailsMode: "drawer" },
  itemRules: [
    {
      id: "poi-article",
      when: { and: [eq("collection", "poi"), eq("type", "article")] },
      card: { type: "resource" },
      itemAction: { kind: "link", to: "/blog/:slug", toById: "/blog/id/:id" },
    },
    {
      id: "poi-parole",
      when: { and: [eq("collection", "poi"), eq("type", "affiche")] },
      card: { type: "testimonial", detailsMode: "dialog" },
      preview: { type: "testimonial" },
    },
  ],
} as React.ComponentProps<typeof SearchListView>["list"];

describe("SearchListView (rendu par item, list.itemRules)", () => {
  beforeEach(() => navigateMock.mockClear());

  it("chaque carte reçoit la conf de SA famille", () => {
    const { container } = renderInRouter(<SearchListView results={mixed} list={LIST_WITH_RULES} />);
    expect(container.querySelector('[data-item-id="1"] button')?.getAttribute("data-card-type")).toBe("resource");
    expect(container.querySelector('[data-item-id="2"] button')?.getAttribute("data-card-type")).toBe("testimonial");
  });

  it("le détail unique hors boucle reçoit la conf de l'item ouvert", () => {
    renderInRouter(<SearchListView results={mixed} list={LIST_WITH_RULES} />);
    fireEvent.click(screen.getByText("Parole"));
    const modal = screen.getByTestId("details-modal");
    expect(modal.getAttribute("data-item")).toBe("Parole");
    expect(modal.getAttribute("data-details-mode")).toBe("dialog"); // règle, pas la liste
    expect(modal.getAttribute("data-preview-type")).toBe("testimonial");
  });

  it("`itemAction.kind: \"link\"` navigue vers le gabarit au lieu d'ouvrir un détail", () => {
    renderInRouter(<SearchListView results={mixed} list={LIST_WITH_RULES} />);
    fireEvent.click(screen.getByText("Article"));
    expect(navigateMock).toHaveBeenCalledWith("/blog/slug-1");
    expect(screen.queryByTestId("details-modal")).toBeNull();
  });

  it("sans slug, l'action `link` retombe sur le gabarit par id", () => {
    const sansSlug = [{ serverData: { id: "9", name: "Sans slug", collection: "poi", type: "article" } } as unknown as SearchEntity];
    renderInRouter(<SearchListView results={sansSlug} list={LIST_WITH_RULES} />);
    fireEvent.click(screen.getByText("Sans slug"));
    expect(navigateMock).toHaveBeenCalledWith("/blog/id/9");
  });

  it("le mode split garde la priorité absolue sur `itemAction`", () => {
    const onFocusItem = vi.fn();
    renderInRouter(<SearchListView results={mixed} list={LIST_WITH_RULES} onFocusItem={onFocusItem} />);
    fireEvent.click(screen.getByText("Article"));
    expect(onFocusItem).toHaveBeenCalledWith("1");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("NON-RÉGRESSION : sans `itemRules`, toutes les cartes gardent la conf de la liste", () => {
    const { container } = renderInRouter(
      <SearchListView results={mixed} list={{ card: { type: "default", detailsMode: "drawer" } }} />,
    );
    const types = [...container.querySelectorAll("button")].map((b) => b.getAttribute("data-card-type"));
    expect(types).toEqual(["default", "default"]);
    fireEvent.click(screen.getByText("Article"));
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("details-modal")).toBeInTheDocument();
  });
});
