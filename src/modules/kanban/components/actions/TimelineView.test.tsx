// @vitest-environment jsdom
/**
 * Vue Chronologie montée sous la mise en page : une piste par colonne (en-têtes de ligne), la
 * semaine d'une échéance, la semaine courante dite par un mot, la gouttière des non datées.
 */
import { screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { mountActions } from "@/modules/kanban/__fixtures__/actionsHarness";
import { ok, resetHarness, signIn, stubKanbanFetch } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom } from "@/modules/kanban/__fixtures__/radixDom";
import { makeAction, makeLinkSnapshot } from "@/modules/kanban/__fixtures__/snapshot";

const today = Math.floor(Date.now() / 1000);

beforeAll(() => {
  installRadixDom();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

beforeEach(() => {
  signIn("u1");
  const snapshot = makeLinkSnapshot({
    cards: [makeAction("a1", "todo", { title: "Banderole", dueDate: today }), makeAction("a2", "tracking", { title: "Affiche", dueDate: null })],
  });
  stubKanbanFetch({ "board/get": () => ok(snapshot), "board/sync": () => ok({ rev: snapshot.board.rev, full: false, activities: [] }) });
});

afterEach(resetHarness);

test("une piste par colonne, la carte datée dans sa semaine, marquée « Aujourd’hui »", async () => {
  mountActions("/kanban/actions/chronologie");
  const table = await screen.findByRole("table");
  expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent?.replace(/\d+$/, ""))).toEqual(["À faire", "Next", "En cours", "À tester", "À discuter", "Terminé"]);
  expect(await within(table).findByText("Aujourd’hui")).toBeTruthy();
  const card = within(table).getByRole("link", { name: /Banderole/ });
  expect(card.getAttribute("href")).toBe("/kanban/actions/chronologie/carte/a1");
});

test("une carte sans échéance a sa gouttière, étiquetée", async () => {
  mountActions("/kanban/actions/chronologie");
  const table = await screen.findByRole("table");
  expect(within(table).getByRole("columnheader", { name: /Non datées/ })).toBeTruthy();
  const row = within(table).getByRole("rowheader", { name: /En cours/ }).closest("tr") as HTMLElement;
  expect(within(row).getByRole("link", { name: /Affiche/ })).toBeTruthy();
});
