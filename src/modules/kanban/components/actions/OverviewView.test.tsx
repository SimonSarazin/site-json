// @vitest-environment jsdom
/**
 * Vue d'ensemble montée sous la mise en page : la barre de filtres remplacée par la phrase qui le
 * dit, les cartouches de synthèse, les répartitions (trois statuts pour une action Communecter),
 * la charge par contributeur et le fil d'activité lu par `board/sync` sur une fenêtre de révisions.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { mountActions } from "@/modules/kanban/__fixtures__/actionsHarness";
import { type FakeKanban, ok, resetHarness, signIn, stubKanbanFetch } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom } from "@/modules/kanban/__fixtures__/radixDom";
import { makeAction, makeLinkSnapshot } from "@/modules/kanban/__fixtures__/snapshot";
import type { Activity } from "@/modules/kanban/types";

const snapshot = makeLinkSnapshot({
  cards: [
    makeAction("a1", "todo", { title: "Banderole", assignees: ["u1"] }),
    makeAction("a2", "tracking", { title: "Affiche", assignees: ["u1", "u2"] }),
    makeAction("a3", "done", { title: "Devis" }),
  ],
});
const REV = snapshot.board.rev;

const activity = (id: string, rev: number, actorId: string, verb: Activity["verb"], payload: Record<string, unknown> = {}): Activity => ({ _id: id, boardId: snapshot.board._id, cardId: null, columnId: null, actorId, verb, payload, rev, at: 1_800_000_000 + rev });

let backend: FakeKanban;
let syncWindows: number[] = [];

beforeAll(() => {
  installRadixDom();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

beforeEach(() => {
  signIn("u1");
  syncWindows = [];
  backend = stubKanbanFetch({
    "board/get": () => ok(snapshot),
    "board/sync": (body) => {
      const sinceRev = Number(body.sinceRev);
      // Le polling demande ce qui suit l'instantané (rien ici) ; le fil, une fenêtre en arrière.
      if (sinceRev >= REV) return ok({ rev: REV, full: false, activities: [] });
      syncWindows.push(sinceRev);
      return ok({ rev: REV, full: false, activities: [activity("e1", REV - 2, "u2", "card.moved"), activity("e2", REV - 1, "communecter", "board.updated", { reason: "externalChange" })] });
    },
  });
});

afterEach(resetHarness);

test("la barre de filtres laisse la place à la phrase : la synthèse porte sur tout le tableau", async () => {
  mountActions("/kanban/actions/vue-ensemble");
  expect(await screen.findByText("La vue d’ensemble résume tout le tableau, sans filtre.")).toBeTruthy();
  expect(screen.queryByRole("search", { name: "Recherche et filtres du tableau" })).toBeNull();
});

test("cartouches et répartitions : trois statuts, la part de chaque colonne", async () => {
  mountActions("/kanban/actions/vue-ensemble");
  expect(await screen.findByText("33 %")).toBeTruthy();
  expect(screen.getByText("1 / 3 terminées (33 %)")).toBeTruthy();
  const byStatus = screen.getByRole("heading", { name: "Répartition par statut" }).closest("section") as HTMLElement;
  expect(within(byStatus).getAllByRole("progressbar").map((bar) => bar.getAttribute("aria-label"))).toEqual([
    "Part des cartes au statut Non démarré",
    "Part des cartes au statut Sur les rails",
    "Part des cartes au statut Terminé",
  ]);
  const byColumn = screen.getByRole("heading", { name: "Répartition par colonne" }).closest("section") as HTMLElement;
  expect(within(byColumn).getByRole("progressbar", { name: "Part des cartes dans la colonne À faire" })).toBeTruthy();
});

test("charge par contributeur : une carte à deux personnes compte pour chacune", async () => {
  mountActions("/kanban/actions/vue-ensemble");
  const panel = (await screen.findByRole("heading", { name: "Charge par contributeur" })).closest("section") as HTMLElement;
  const alice = within(panel).getByText("Alice").closest("li") as HTMLElement;
  expect(alice.textContent).toContain("0 terminée sur 2");
  const bob = within(panel).getByText("Bob").closest("li") as HTMLElement;
  expect(bob.textContent).toContain("0 terminée sur 1");
});

test("fil d’activité : une fenêtre de `board/sync`, les plus récentes d’abord, Communecter nommé", async () => {
  mountActions("/kanban/actions/vue-ensemble");
  const panel = (await screen.findByRole("heading", { name: "Activité récente" })).closest("section") as HTMLElement;
  await waitFor(() => expect(within(panel).getAllByRole("listitem")).toHaveLength(2));
  const items = within(panel).getAllByRole("listitem").map((item) => item.textContent);
  expect(items[0]).toContain("Modifié dans Communecter");
  expect(items[0]).toContain("par Communecter");
  expect(items[1]).toContain("Carte déplacée");
  expect(items[1]).toContain("par Bob");
  expect(syncWindows).toEqual([1]);
  expect(backend.calls("board/get")).toBe(1);
});
