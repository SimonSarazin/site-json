// @vitest-environment jsdom
/**
 * Le tableau MONTÉ, repris de co-kanban (`tests/unit/kanbanBoard.test.tsx`, constats #31, #38,
 * #52, #64) : fenêtre de cartes et « Afficher N de plus », focus après un archivage, annonces de
 * la région vivante, composeur d'un tableau relié. Ce que les helpers purs ne peuvent pas garder
 * seuls : l'enchaînement rendu -> DOM -> focus.
 *
 * Le masquage des colonnes est porté par la vue (`ActionsView.test.tsx`).
 */
import "@/modules/kanban/i18n";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
// Chaque montage passe par un routeur : le titre d'une carte est le lien de sa fiche.
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, onTestFinished, test, vi } from "vitest";
import { KanbanBoard } from "@/modules/kanban/components/board/KanbanBoard";
import { installRadixDom, openMenu } from "@/modules/kanban/__fixtures__/radixDom";
import { CAPABILITIES, LINK_CAPABILITIES, makeAction, makeColumn, makeLinkColumns, makeSnapshot } from "@/modules/kanban/__fixtures__/snapshot";
import type { BoardSnapshot, Card } from "@/modules/kanban/types";

beforeAll(() => {
  installRadixDom();
  // jsdom n'implémente pas `matchMedia`, que le tableau lit pour le mouvement réduit.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

afterEach(cleanup);

function cards(columnId: string, count: number, prefix = "c"): Card[] {
  return Array.from({ length: count }, (_, index) => makeAction(`${prefix}${index}`, columnId, { title: `Carte ${prefix}${index}`, rank: index + 1 }));
}

function kanbanSnapshot(columnCards: Card[], overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return makeSnapshot({
    columns: [makeColumn("todo", 1000, { title: "À faire" }), makeColumn("done", 2000, { title: "Fini", isDoneColumn: true })],
    cards: columnCards,
    capabilities: CAPABILITIES,
    ...overrides,
  });
}

function Harness({ snapshot, onArchiveCard }: { snapshot: BoardSnapshot; onArchiveCard?: (cardId: string) => void }) {
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <KanbanBoard
      snapshot={snapshot}
      hiddenColumnIds={hidden}
      onHideColumn={(columnId) => setHidden((current) => [...current, columnId])}
      onMoveCard={() => {}}
      onMoveColumn={() => {}}
      onCreateCard={async (input) => makeAction("nouvelle", input.columnId, { title: input.title })}
      onArchiveCard={onArchiveCard}
    />
  );
}

const renderedCards = (columnName: string) => within(screen.getByRole("list", { name: `Cartes de la colonne ${columnName}` })).queryAllByRole("article");

const status = () => document.querySelector('p[role="status"]:not([id])')?.textContent ?? "";

describe("fenêtre de cartes (constat #52)", () => {
  // Délais généreux : jsdom rend 120 cartes lentement quand toute la suite tourne en parallèle.
  test("une colonne de 120 cartes en rend 50, puis 50 de plus, puis le reste", { timeout: 20_000 }, async () => {
    render(<Harness snapshot={kanbanSnapshot(cards("todo", 120))} />, { wrapper: MemoryRouter });
    expect(renderedCards("À faire")).toHaveLength(50);
    // Le compteur, lui, compte TOUTES les cartes de la colonne.
    expect(screen.getByText("120 cartes")).toBeTruthy();

    const more = screen.getByRole("button", { name: /Afficher 50 de plus dans À faire/ });
    expect(more.textContent).toContain("70 non affichées");
    fireEvent.click(more);
    await waitFor(() => expect(renderedCards("À faire")).toHaveLength(100), { timeout: 8000 });
    expect(status()).toContain("50 cartes de plus affichées dans À faire : 100 sur 120");

    // Dernière tranche : le bouton disparaît, le focus va à la première carte révélée.
    fireEvent.click(screen.getByRole("button", { name: /Afficher 20 de plus dans À faire/ }));
    await waitFor(() => expect(renderedCards("À faire")).toHaveLength(120), { timeout: 8000 });
    expect(screen.queryByRole("button", { name: /Afficher .* de plus/ })).toBeNull();
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Carte c100"), { timeout: 8000 });
  });

  /*
   * Lecture seule : la carte n'a pas de poignée. Le focus va au LIEN du titre de la première carte
   * révélée ; sans ce repli, il repartait au menu de la colonne, tout en haut, et il fallait
   * retraverser toutes les cartes pour atteindre celles affichées.
   */
  test("lecture seule : après la dernière tranche, le focus va au titre de la première carte révélée", { timeout: 20_000 }, async () => {
    render(<Harness snapshot={kanbanSnapshot(cards("todo", 60), { capabilities: { ...CAPABILITIES, role: "viewer", canEditCards: false } })} />, { wrapper: MemoryRouter });
    expect(screen.queryByRole("button", { name: /Ajouter une tâche/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Afficher 10 de plus dans À faire/ }));
    await waitFor(() => expect(renderedCards("À faire")).toHaveLength(60), { timeout: 8000 });
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Carte c50"), { timeout: 8000 });
    expect(document.activeElement?.tagName).toBe("A");
  });

  test("une colonne qui tient dans la fenêtre n’a pas de bouton", () => {
    render(<Harness snapshot={kanbanSnapshot(cards("todo", 12))} />, { wrapper: MemoryRouter });
    expect(renderedCards("À faire")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Afficher .* de plus/ })).toBeNull();
  });
});

describe("focus après un retrait (constat #38)", () => {
  test("archiver une carte de la colonne de fin rend le focus à la carte SUIVANTE", async () => {
    const done = cards("done", 3, "d").map((card) => ({ ...card, status: "complete" as const, completedAt: 1 }));
    const onArchive = vi.fn();
    const { rerender } = render(<Harness snapshot={kanbanSnapshot(done)} onArchiveCard={onArchive} />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByRole("button", { name: "Archiver la carte Carte d1" }));
    const confirmation = await screen.findByRole("dialog", { name: "Archiver la carte Carte d1" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Archiver" }));
    expect(onArchive).toHaveBeenCalledWith("d1");

    // La mutation optimiste retire la carte au rendu suivant.
    rerender(<Harness snapshot={kanbanSnapshot(done.filter((card) => card._id !== "d1"))} onArchiveCard={onArchive} />);
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Carte d2"));
  });

  test("« Masquer la colonne » du menu la retire du tableau", async () => {
    render(<Harness snapshot={kanbanSnapshot(cards("todo", 2))} />, { wrapper: MemoryRouter });
    openMenu(screen.getByRole("button", { name: "Actions de la colonne À faire" }));
    const menu = await screen.findByRole("menu");
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Masquer la colonne" }));
    });
    await waitFor(() => expect(screen.queryByRole("list", { name: "Cartes de la colonne À faire" })).toBeNull());
    expect(screen.getByRole("list", { name: "Cartes de la colonne Fini" })).toBeTruthy();
  });
});

describe("tableau relié (ordre canonique)", () => {
  test("poignée clavier et lien de la fiche sur chaque carte, instructions qui disent l’ordre automatique", () => {
    render(<Harness snapshot={makeSnapshot({ columns: makeLinkColumns(), cards: cards("todo", 2), capabilities: LINK_CAPABILITIES })} />, { wrapper: MemoryRouter });
    const handle = screen.getAllByRole("button", { name: "Carte c0" })[0];
    expect(handle.getAttribute("aria-roledescription")).toBe("carte déplaçable");
    const describedBy = handle.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)?.textContent).toMatch(/l’ordre d’une colonne est automatique/);
    // L'alternative au clic : Entrée sur le titre, le lien de la fiche.
    expect(document.getElementById(describedBy)?.textContent).toMatch(/Entrée sur le titre ouvre la carte/);
    expect(screen.getAllByRole("link", { name: "Carte c0" })[0].getAttribute("href")).toBe("/kanban/actions/carte/c0");
  });

  test("le pied de la colonne de fin montre le total des montants", () => {
    const done = [makeAction("d0", "done", { title: "Close", credits: 3 }), makeAction("d1", "done", { title: "Close 2", credits: 4 })];
    render(<Harness snapshot={makeSnapshot({ columns: makeLinkColumns(), cards: done, capabilities: LINK_CAPABILITIES })} />, { wrapper: MemoryRouter });
    const column = screen.getByRole("list", { name: "Cartes de la colonne Terminé" }).closest("section");
    expect(column?.textContent).toMatch(/Montant total de la colonne : 7/);
  });
});

/*
 * CONSTAT #64 — tableau relié : la carte créée naît à son rang CANONIQUE, pas au pied où se
 * trouve le composeur. La colonne annonce où elle est arrivée.
 */
function CreatingHarness({ initial, rank }: { initial: BoardSnapshot; rank: number }) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <KanbanBoard
      snapshot={snapshot}
      hiddenColumnIds={[]}
      onHideColumn={() => {}}
      onMoveCard={() => {}}
      onMoveColumn={() => {}}
      onCreateCard={async (input) => {
        const card = makeAction("neuve", input.columnId, { title: input.title, rank });
        setSnapshot((current) => ({ ...current, cards: [...current.cards, card] }));
        return card;
      }}
    />
  );
}

test("tableau relié : la carte créée depuis le pied est annoncée à son rang", async () => {
  // Rang canonique « fabriqué » : entre les deux cartes existantes.
  render(<CreatingHarness rank={1.5} initial={makeSnapshot({ columns: makeLinkColumns(), cards: cards("todo", 2), capabilities: LINK_CAPABILITIES })} />, { wrapper: MemoryRouter });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une tâche à À faire" }));
  fireEvent.change(screen.getByPlaceholderText("Titre de la tâche"), { target: { value: "Neuve" } });
  fireEvent.keyDown(screen.getByPlaceholderText("Titre de la tâche"), { key: "Enter" });
  await waitFor(() => expect(status()).toContain("« Neuve » ajoutée en position 2 sur 3 dans À faire"));
  // Le composeur reste ouvert et garde le focus pour enchaîner.
  expect(document.activeElement).toBe(screen.getByPlaceholderText("Titre de la tâche"));
});

test("la carte créée au pied d’une colonne de 60 cartes est rendue et annoncée, le composeur garde le focus", { timeout: 20_000 }, async () => {
  /*
   * Un espion remplace `scrollIntoView`, pour vérifier que le PIED (qui garde le focus) est
   * ramené dans la vue une fois les cartes supplémentaires rendues — au téléphone, c'est la page
   * qui défile, et elles le poussaient hors de l'écran.
   */
  // Sur `HTMLElement` : c'est là que `installRadixDom` pose son bouchon, qui masquerait un
  // espion posé sur `Element`.
  const original = HTMLElement.prototype.scrollIntoView;
  const scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  onTestFinished(() => {
    HTMLElement.prototype.scrollIntoView = original;
  });
  render(<CreatingHarness rank={10_000} initial={kanbanSnapshot(cards("todo", 60))} />, { wrapper: MemoryRouter });
  expect(renderedCards("À faire")).toHaveLength(50);

  fireEvent.click(screen.getByRole("button", { name: "Ajouter une tâche à À faire" }));
  const field = screen.getByPlaceholderText("Titre de la tâche");
  fireEvent.change(field, { target: { value: "Neuve au pied" } });
  fireEvent.keyDown(field, { key: "Enter" });

  await waitFor(() => expect(status()).toBe("« Neuve au pied » ajoutée en position 61 sur 61 dans À faire."), { timeout: 8000 });
  const list = screen.getByRole("list", { name: "Cartes de la colonne À faire" });
  expect(within(list).getByRole("article", { name: "Neuve au pied" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Afficher .* de plus/ })).toBeNull();
  const composerField = screen.getByPlaceholderText("Titre de la tâche");
  expect(document.activeElement).toBe(composerField);
  expect(scrollIntoView.mock.contexts).toContain(composerField.closest("footer"));
});

/*
 * Constat du portage : « Déplacer vers… » vers une autre colonne démonte la carte, son menu et
 * le retour de focus de la boîte avec eux. Le focus tombait sur <body> ; il suit maintenant la
 * carte dans sa nouvelle colonne, comme après un dépôt au clavier.
 */
function MovingHarness({ initial }: { initial: BoardSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  return (
    <KanbanBoard
      snapshot={snapshot}
      hiddenColumnIds={[]}
      onHideColumn={() => {}}
      onMoveCard={(intent) =>
        // La mutation optimiste écrit le cache après un tour de boucle (`onMutate` asynchrone).
        void Promise.resolve().then(() =>
          setSnapshot((current) => ({ ...current, cards: current.cards.map((card) => (card._id === intent.cardId ? { ...card, columnId: intent.columnId } : card)) })),
        )
      }
      onMoveColumn={() => {}}
    />
  );
}

test("« Déplacer vers… » une autre colonne : le focus suit la carte", async () => {
  render(<MovingHarness initial={makeSnapshot({ columns: makeLinkColumns(), cards: cards("todo", 2), capabilities: LINK_CAPABILITIES })} />, { wrapper: MemoryRouter });
  await act(async () => {
    openMenu(screen.getByRole("button", { name: "Actions de la carte Carte c0" }));
  });
  await act(async () => {
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: /vers…/ }));
  });
  const dialog = await screen.findByRole("dialog", { name: "Déplacer la carte" });
  fireEvent.change(within(dialog).getByLabelText("Colonne"), { target: { value: "tracking" } });
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Déplacer" }));
  });

  await waitFor(() => expect(renderedCards("En cours").map((card) => card.getAttribute("data-card-id"))).toEqual(["c0"]));
  await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Carte c0"));
  expect(screen.getByRole("list", { name: "Cartes de la colonne En cours" }).contains(document.activeElement)).toBe(true);
});
