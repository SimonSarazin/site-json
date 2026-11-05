// @vitest-environment jsdom
/**
 * Vue Liste montée sous la mise en page : groupes (vides compris), regroupement et tri de la barre,
 * repli d'un groupe, ligne entière en lien vers la fiche, vide dû au filtre.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { mountActions } from "@/modules/kanban/__fixtures__/actionsHarness";
import { ok, resetHarness, signIn, stubKanbanFetch } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom } from "@/modules/kanban/__fixtures__/radixDom";
import { makeAction, makeLinkSnapshot } from "@/modules/kanban/__fixtures__/snapshot";

beforeAll(() => {
  installRadixDom();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

beforeEach(() => {
  signIn("u1");
  const snapshot = makeLinkSnapshot({
    cards: [
      makeAction("a1", "todo", { title: "Banderole", priority: "high", assignees: ["u1"] }),
      makeAction("a2", "todo", { title: "Affiche" }),
      makeAction("a3", "tracking", { title: "Courrier", checklistDone: 1, checklistTotal: 3 }),
      makeAction("a4", "done", { title: "Devis" }),
    ],
  });
  stubKanbanFetch({ "board/get": () => ok(snapshot), "board/sync": () => ok({ rev: snapshot.board.rev, full: false, activities: [] }) });
});

afterEach(resetHarness);

const groupButton = (name: RegExp) => screen.getByRole("button", { name });
const rowTitles = (section: HTMLElement) => within(section).queryAllByRole("link").map((link) => link.querySelector(".font-semibold")?.textContent);

test("par colonne : un groupe par colonne, vides compris, avec ses cartes et ses terminées", async () => {
  mountActions("/kanban/actions/liste");
  const todo = (await screen.findByRole("button", { name: /^À faire/ })).closest("section") as HTMLElement;
  expect(rowTitles(todo)).toEqual(["Banderole", "Affiche"]);
  expect(within(todo).getByText("0 / 2 terminées")).toBeTruthy();
  // Une colonne sans carte garde son groupe : « rien ici » se lit.
  const next = groupButton(/^Next/).closest("section") as HTMLElement;
  expect(within(next).getByText("Aucune carte dans ce groupe.")).toBeTruthy();
  // Toute la ligne ouvre la fiche, par-dessus la Liste.
  expect(within(todo).getAllByRole("link")[0].getAttribute("href")).toBe("/kanban/actions/liste/carte/a1");
});

test("replier un groupe : `aria-expanded` passe à faux et ses cartes disparaissent", async () => {
  mountActions("/kanban/actions/liste");
  const toggle = await screen.findByRole("button", { name: /^À faire/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: /Banderole/ })).toBeNull();
});

test("« Grouper par » Statut : les trois statuts d’une action, jamais « En recherche »", async () => {
  mountActions("/kanban/actions/liste");
  await screen.findByRole("button", { name: /^À faire/ });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Grouper par" }));
  });
  const panel = await screen.findByRole("dialog", { name: "Grouper par" });
  fireEvent.click(within(panel).getByRole("radio", { name: "Statut" }));
  await waitFor(() => expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent?.replace(/\d.*$/, "").trim())).toEqual(["Non démarré", "Sur les rails", "Terminé"]));
});

test("« Trier » par titre décroissant réordonne chaque groupe", async () => {
  mountActions("/kanban/actions/liste");
  await screen.findByRole("button", { name: /^À faire/ });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Trier" }));
  });
  const panel = await screen.findByRole("dialog", { name: "Trier" });
  fireEvent.click(within(panel).getByRole("radio", { name: "Titre" }));
  fireEvent.click(within(panel).getByRole("radio", { name: "Décroissant" }));
  const todo = groupButton(/^À faire/).closest("section") as HTMLElement;
  await waitFor(() => expect(rowTitles(todo)).toEqual(["Banderole", "Affiche"]));
  fireEvent.click(within(panel).getByRole("radio", { name: "Croissant" }));
  await waitFor(() => expect(rowTitles(todo)).toEqual(["Affiche", "Banderole"]));
});

test("filtre trop étroit : la vue le dit, plutôt qu’un tableau vide", async () => {
  mountActions("/kanban/actions/liste");
  await screen.findByRole("button", { name: /^À faire/ });
  fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher dans ce tableau" }), { target: { value: "zzz" } });
  expect(await screen.findByText("Aucune carte ne correspond")).toBeTruthy();
});
