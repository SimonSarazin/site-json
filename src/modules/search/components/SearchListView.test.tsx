// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import SearchListView from "./SearchListView";
import { renderWithProviders } from "../../../../tests/test-utils-ui";

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
// Typé EXPLICITEMENT : sans signature, TS infère `() => { data: null }` —
// zéro paramètre et `data` littéralement `null`, ce qui rejette aussi bien
// l'appel à deux arguments que `mockReturnValue({ data: <entité> })`.
const entityByIdMock = vi.fn(
  (_kind?: string, _id?: string): { data: SearchEntity | null } => ({ data: null }),
);
vi.mock("../hooks/useEntityByIdQuery", () => ({
  useEntityByIdQuery: (kind?: string, id?: string) => entityByIdMock(kind, id),
}));
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
// Stub de la vue timeline (chargée en lazy par le dispatch `list.layout`) : expose un bouton
// par item qui remonte `onItemClick(item, itemLists[i])` — même contrat que la vraie vue.
vi.mock("./TimelineListView", () => ({
  default: ({
    results: tlResults,
    itemLists,
    onItemClick,
  }: {
    results: SearchEntity[];
    itemLists: unknown[];
    onItemClick: (it: SearchEntity, itemList?: unknown) => void;
  }) => (
    <div data-testid="timeline-view">
      {tlResults.map((it, i) => (
        <button key={i} onClick={() => onItemClick(it, itemLists[i])}>
          TL-{String((it.serverData as { name?: string }).name)}
        </button>
      ))}
    </div>
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

/**
 * Dispatch `list.layout: "timeline"` : la vue timeline remplace la grille (chargement lazy),
 * la vue détaillée et le mode split gardent la priorité, et le détail s'ouvre depuis la
 * timeline par le MÊME flux que depuis la grille.
 */
describe("SearchListView (list.layout: timeline)", () => {
  it("layout timeline → la vue timeline remplace la grille", async () => {
    renderInRouter(<SearchListView results={results} list={{ layout: "timeline" }} />);
    expect(await screen.findByTestId("timeline-view")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).toBeNull(); // la grille (stub SearchCard) n'est pas rendue
  });

  it("NON-RÉGRESSION : sans `layout`, la grille est rendue", () => {
    renderInRouter(<SearchListView results={results} list={{}} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-view")).toBeNull();
  });

  it("mode split (`onFocusItem`) : la grille garde la priorité sur la timeline", () => {
    renderInRouter(
      <SearchListView results={results} list={{ layout: "timeline" }} onFocusItem={vi.fn()} />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-view")).toBeNull();
  });

  it("vue détaillée : prioritaire sur la timeline", () => {
    renderInRouter(
      <SearchListView results={results} list={{ layout: "timeline" }} isDetailedView />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument(); // stub SearchCardDetailed
    expect(screen.queryByTestId("timeline-view")).toBeNull();
  });

  it("clic dans la timeline → le détail s'ouvre avec la conf de l'item", async () => {
    renderInRouter(<SearchListView results={results} list={{ layout: "timeline" }} />);
    fireEvent.click(await screen.findByText("TL-Bravo"));
    expect(screen.getByTestId("details-modal").getAttribute("data-item")).toBe("Bravo");
  });
});

/**
 * Dispatch `list.layout: "grouped"` : la grille découpée en blocs titrés par `groupBy.field`.
 * La logique de regroupement est testée à part (`groupResults.test.ts`) ; ici, le CÂBLAGE.
 */
describe("SearchListView (list.layout: grouped)", () => {
  const numero = (id: string, name: string, annee?: number) =>
    ({ serverData: { id, name, ...(annee ? { annee } : {}) } } as unknown as SearchEntity);
  const numeros = [
    numero("1", "INFORESO n°74", 2022),
    numero("2", "INFORESO n°70", 2021),
    numero("3", "INFORESO n°73", 2022),
    numero("4", "Fiche sans année"),
  ];
  const grouped = { layout: "grouped" as const, groupBy: { field: "annee", order: "desc" as const } };
  // Le titre d'un bloc traduit son libellé : fournisseur de localisation en plus du routeur.
  const renderGrouped = (ui: ReactElement) => renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);

  it("titre chaque bloc par sa valeur, du plus récent au plus ancien, fiches sans valeur en dernier", () => {
    renderGrouped(<SearchListView results={numeros} list={grouped} />);
    const titres = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titres).toEqual(["2022", "2021", "Non classé"]);
  });

  it("range chaque item sous son bloc, dans l'ordre du serveur", () => {
    renderGrouped(<SearchListView results={numeros} list={grouped} />);
    const bloc2022 = screen.getByRole("region", { name: "2022" });
    const cartes = Array.from(bloc2022.querySelectorAll("button")).map((b) => b.textContent);
    expect(cartes).toEqual(["INFORESO n°74", "INFORESO n°73"]);
  });

  it("`groupBy.itemsSortBy` retrie les items de chaque bloc — le serveur ne lit qu'une clé de tri", () => {
    const tries = { ...grouped, groupBy: { ...grouped.groupBy, itemsSortBy: { field: "name", order: "asc" as const } } };
    renderGrouped(<SearchListView results={numeros} list={tries} />);
    const bloc2022 = screen.getByRole("region", { name: "2022" });
    const cartes = Array.from(bloc2022.querySelectorAll("button")).map((b) => b.textContent);
    expect(cartes).toEqual(["INFORESO n°73", "INFORESO n°74"]);
  });

  it("clic sur une carte retriée → le détail s'ouvre sur CET item, pas sur celui de sa position d'origine", () => {
    const tries = { ...grouped, groupBy: { ...grouped.groupBy, itemsSortBy: { field: "name", order: "asc" as const } } };
    renderGrouped(<SearchListView results={numeros} list={tries} />);
    fireEvent.click(screen.getByText("INFORESO n°73"));
    expect(screen.getByTestId("details-modal").getAttribute("data-item")).toBe("INFORESO n°73");
  });

  it("nomme chaque bloc par sa valeur même avec des espaces, sans id en double entre deux listes", () => {
    // Un id construit sur la valeur (« groupe-Entre Mer et Terres ») serait lu par `aria-labelledby`
    // comme TROIS ids — le bloc perdrait son nom accessible.
    const territoires = [
      { serverData: { id: "a", name: "Fiche A", territoire: "Entre Mer et Terres" } },
      { serverData: { id: "b", name: "Fiche B", territoire: "Artois" } },
    ] as unknown as SearchEntity[];
    const parTerritoire = { layout: "grouped" as const, groupBy: { field: "territoire" } };
    const { container } = renderGrouped(
      <>
        <SearchListView results={territoires} list={parTerritoire} />
        <SearchListView results={territoires} list={parTerritoire} />
      </>,
    );
    expect(screen.getAllByRole("region", { name: "Entre Mer et Terres" })).toHaveLength(2);
    const ids = [...container.querySelectorAll("h3[id]")].map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("utilise `emptyLabel` pour le bloc des fiches sans valeur", () => {
    renderGrouped(
      <SearchListView results={numeros} list={{ ...grouped, groupBy: { ...grouped.groupBy, emptyLabel: { fr: "Année inconnue", en: "Unknown year" } } }} />,
    );
    expect(screen.getByRole("heading", { name: "Année inconnue" })).toBeInTheDocument();
  });

  it("clic sur une carte d'un bloc → le détail s'ouvre sur CET item", () => {
    renderGrouped(<SearchListView results={numeros} list={grouped} />);
    fireEvent.click(screen.getByText("INFORESO n°70"));
    expect(screen.getByTestId("details-modal").getAttribute("data-item")).toBe("INFORESO n°70");
  });

  it("sans `groupBy.field`, retombe sur la grille", () => {
    renderGrouped(<SearchListView results={numeros} list={{ layout: "grouped" }} />);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.getByText("INFORESO n°74")).toBeInTheDocument();
  });

  it("mode split (`onFocusItem`) : la grille garde la priorité", () => {
    renderGrouped(<SearchListView results={numeros} list={grouped} onFocusItem={vi.fn()} />);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });
});

/**
 * Ouverture d'une fiche par IDENTIFIANT (`list.previewFetch`) : `?preview=<id>`
 * vise un item ABSENT de la tranche chargée — le cas de tout lien venu d'une
 * autre page (fiche équipement ↔ fiche du club usager).
 */
describe("SearchListView (ouverture par identifiant, list.previewFetch)", () => {
  const renderAt = (ui: ReactElement, url: string) =>
    render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);

  beforeEach(() => {
    entityByIdMock.mockReset();
    entityByIdMock.mockReturnValue({ data: null });
  });

  it("charge par id et ouvre la fiche quand l'item n'est pas dans les résultats", () => {
    const absent = item("42", "Club absent de la page");
    entityByIdMock.mockReturnValue({ data: absent });
    renderAt(
      <SearchListView results={results} list={{ previewFetch: "organizations" }} />,
      "/?preview=42",
    );
    expect(entityByIdMock).toHaveBeenCalledWith("organizations", "42");
    expect(screen.getByTestId("details-modal")).toHaveAttribute(
      "data-item",
      "Club absent de la page",
    );
  });

  it("n'interroge PAS quand l'item est déjà dans les résultats", () => {
    renderAt(<SearchListView results={results} list={{ previewFetch: "poi" }} />, "/?preview=2");
    expect(entityByIdMock).toHaveBeenCalledWith("poi", undefined);
    expect(screen.getByTestId("details-modal")).toHaveAttribute("data-item", "Bravo");
  });

  it("sans previewFetch, un id inconnu n'ouvre rien (comportement historique)", () => {
    renderAt(<SearchListView results={results} />, "/?preview=42");
    expect(entityByIdMock).toHaveBeenCalledWith(undefined, "42");
    expect(screen.queryByTestId("details-modal")).toBeNull();
  });
});
