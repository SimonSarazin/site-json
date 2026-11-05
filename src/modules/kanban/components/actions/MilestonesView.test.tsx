// @vitest-environment jsdom
/**
 * Vue Jalons montée sous la mise en page : colonnes « Sans jalon » puis jalons ouverts, cartes en
 * cours seulement, « Déplacer vers… » qui écrit le JALON (`card/update`), « Clore le jalon » depuis
 * le menu d'une colonne, « Ajouter un jalon », et la vue refusée sur une organisation.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { mountActions } from "@/modules/kanban/__fixtures__/actionsHarness";
import { ok, resetHarness, signIn, stubKanbanFetch } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom, openMenu } from "@/modules/kanban/__fixtures__/radixDom";
import { MILESTONES, makeAction, makeLinkSnapshot } from "@/modules/kanban/__fixtures__/snapshot";
import type { BoardSnapshot, Card } from "@/modules/kanban/types";

const [CLOSED, OPEN] = MILESTONES;
const openCopy = { milestoneId: OPEN.milestoneId, name: OPEN.name, status: OPEN.status };

function snapshot(): BoardSnapshot {
  return makeLinkSnapshot({
    cards: [
      makeAction("a1", "todo", { title: "Banderole", milestone: openCopy }),
      makeAction("a2", "tracking", { title: "Affiche" }),
      makeAction("a3", "done", { title: "Devis", milestone: openCopy }),
      makeAction("a4", "todo", { title: "Ancienne", milestone: { milestoneId: CLOSED.milestoneId, name: CLOSED.name, status: CLOSED.status } }),
    ],
  });
}

let sent: Record<string, Array<Record<string, unknown>>> = {};
let board: BoardSnapshot;

beforeAll(() => {
  installRadixDom();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

beforeEach(() => {
  signIn("u1");
  sent = {};
  board = snapshot();
  const record = (route: string, body: Record<string, unknown>) => (sent[route] = [...(sent[route] ?? []), body]);
  stubKanbanFetch({
    "board/get": () => ok(board),
    "board/sync": () => ok({ rev: board.board.rev, full: false, activities: [] }),
    "card/update": (body) => {
      record("card/update", body);
      const card = board.cards.find((entry) => entry._id === body.cardId) as Card;
      return ok({ card: { ...card, milestone: body.milestoneId === OPEN.milestoneId ? openCopy : null } });
    },
    "milestone/update": (body) => {
      record("milestone/update", body);
      return ok({ milestone: { ...OPEN, status: body.status }, rev: board.board.rev + 1 });
    },
    "milestone/list": () => ok({ milestones: MILESTONES }),
  });
});

afterEach(resetHarness);

const columnList = (title: string) => screen.queryByRole("list", { name: `Cartes de la colonne ${title}` });

test("« Sans jalon » puis les jalons ouverts ; les cartes en cours seulement ; les clos signalés", async () => {
  mountActions("/kanban/actions/jalons");
  const noMilestone = await screen.findByRole("list", { name: "Cartes de la colonne Sans jalon" });
  expect(within(noMilestone).getAllByRole("article").map((card) => card.getAttribute("data-card-id"))).toEqual(["a2"]);
  expect(within(columnList(OPEN.name) as HTMLElement).getAllByRole("article").map((card) => card.getAttribute("data-card-id"))).toEqual(["a1"]);
  // La terminée est comptée dans l'en-tête de son jalon, pas affichée.
  expect(screen.getByText(/1 terminée/)).toBeTruthy();
  expect(screen.getByText(/1 carte rattachée à un jalon clos n’apparaît pas ici/)).toBeTruthy();
  // Le titre d'une carte ouvre sa fiche par-dessus la vue Jalons.
  expect(screen.getByRole("link", { name: "Banderole" }).getAttribute("href")).toBe("/kanban/actions/jalons/carte/a1");
});

test("« Déplacer vers… » parle de jalon et n’écrit que le jalon", async () => {
  mountActions("/kanban/actions/jalons");
  await screen.findByRole("list", { name: "Cartes de la colonne Sans jalon" });
  await act(async () => {
    openMenu(screen.getByRole("button", { name: "Actions de la carte Affiche" }));
  });
  await act(async () => {
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Déplacer Affiche vers…" }));
  });
  const dialog = await screen.findByRole("dialog", { name: "Déplacer la carte" });
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Jalon" }), { target: { value: `milestone:${OPEN.milestoneId}` } });
  expect(within(dialog).getByText(/La carte garde son statut/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Déplacer" }));
  await waitFor(() => expect(sent["card/update"]).toHaveLength(1));
  expect(sent["card/update"]?.[0]).toMatchObject({ cardId: "a2", milestoneId: OPEN.milestoneId });
  expect(sent["card/update"]?.[0]).not.toHaveProperty("columnId");
});

test("« Clore le jalon » depuis le menu de sa colonne : le statut part, la réussite est dite", async () => {
  mountActions("/kanban/actions/jalons");
  await screen.findByRole("list", { name: `Cartes de la colonne ${OPEN.name}` });
  await act(async () => {
    openMenu(screen.getByRole("button", { name: `Actions de la colonne ${OPEN.name}` }));
  });
  const menu = await screen.findByRole("menu");
  // Pas de masquage dans la vue Jalons : ses colonnes sont des jalons.
  expect(within(menu).queryByRole("menuitem", { name: "Masquer la colonne" })).toBeNull();
  await act(async () => {
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Clore le jalon" }));
  });
  await waitFor(() => expect(sent["milestone/update"]?.[0]).toMatchObject({ milestoneId: OPEN.milestoneId, status: "close" }));
  await waitFor(() => expect(document.querySelector("[data-sonner-toast]")?.textContent).toContain(`Jalon « ${OPEN.name} » clos`));
});

test("« Ajouter un jalon » ouvre la gestion des jalons", async () => {
  mountActions("/kanban/actions/jalons");
  await screen.findByRole("list", { name: "Cartes de la colonne Sans jalon" });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un jalon" }));
  expect(await screen.findByRole("dialog", { name: "Jalons du projet" })).toBeTruthy();
});

test("adresse tapée sur le tableau d’une organisation : la vue le dit et ramène au Tableau", async () => {
  board = { ...board, board: { ...board.board, parentType: "organizations" } };
  mountActions("/kanban/actions/jalons");
  expect(await screen.findByText("Vue réservée aux projets Communecter")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Revenir au tableau" }).getAttribute("href")).toBe("/kanban/actions");
});
