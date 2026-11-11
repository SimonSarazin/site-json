// @vitest-environment jsdom
/**
 * Vue Table montée sous la mise en page : vrai tableau, en-têtes triables (`aria-sort`), tri
 * partagé avec « Trier » de la barre, tri local des colonnes propres à la table, « Grouper »
 * désactivé avec sa raison.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { mountActions } from "@/modules/kanban/__fixtures__/actionsHarness";
import { ok, resetHarness, signIn, stubKanbanFetch } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom } from "@/modules/kanban/__fixtures__/radixDom";
import { DAY, NOW, makeAction, makeLinkSnapshot } from "@/modules/kanban/__fixtures__/snapshot";

beforeAll(() => {
  installRadixDom();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

beforeEach(() => {
  signIn("u1");
  const snapshot = makeLinkSnapshot({
    cards: [
      makeAction("a1", "todo", { title: "Banderole", dueDate: NOW + 5 * DAY, commentCount: 1 }),
      makeAction("a2", "tracking", { title: "Affiche", dueDate: NOW + DAY, commentCount: 4 }),
      makeAction("a3", "todo", { title: "Courrier", dueDate: null, commentCount: 0 }),
    ],
  });
  stubKanbanFetch({ "board/get": () => ok(snapshot), "board/sync": () => ok({ rev: snapshot.board.rev, full: false, activities: [] }) });
});

afterEach(resetHarness);

const header = (name: string) => screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });
const titles = () => within(screen.getByRole("table")).getAllByRole("link").map((link) => link.textContent);

test("un vrai tableau, ordre du tableau par défaut, et le compte des cartes", async () => {
  mountActions("/kanban/actions/table");
  const table = await screen.findByRole("table");
  expect(within(table).getByText("Toutes les cartes du tableau, triables par colonne.")).toBeTruthy();
  expect(titles()).toEqual(["Banderole", "Courrier", "Affiche"]);
  expect(header("Colonne").getAttribute("aria-sort")).toBe("ascending");
  expect(screen.getByText("3 cartes")).toBeTruthy();
  expect(within(table).getAllByRole("link")[0].getAttribute("href")).toBe("/kanban/actions/table/carte/a1");
});

test("cliquer « Échéance » trie croissant (sans échéance en dernier), puis décroissant ; « Trier » suit", async () => {
  mountActions("/kanban/actions/table");
  await screen.findByRole("table");
  fireEvent.click(within(header("Échéance")).getByRole("button"));
  await waitFor(() => expect(titles()).toEqual(["Affiche", "Banderole", "Courrier"]));
  expect(header("Échéance").getAttribute("aria-sort")).toBe("ascending");
  expect(header("Colonne").getAttribute("aria-sort")).toBe("none");

  fireEvent.click(within(header("Échéance")).getByRole("button"));
  await waitFor(() => expect(titles()).toEqual(["Courrier", "Banderole", "Affiche"]));
  expect(header("Échéance").getAttribute("aria-sort")).toBe("descending");

  // Le même tri, vu de la barre : un seul état pour deux commandes.
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Trier" }));
  });
  const panel = await screen.findByRole("dialog", { name: "Trier" });
  expect((within(panel).getByRole("radio", { name: "Échéance" }) as HTMLInputElement).checked).toBe(true);
  expect((within(panel).getByRole("radio", { name: "Décroissant" }) as HTMLInputElement).checked).toBe(true);
});

test("une colonne propre à la table (commentaires) trie localement", async () => {
  mountActions("/kanban/actions/table");
  await screen.findByRole("table");
  fireEvent.click(within(header("Commentaires")).getByRole("button"));
  await waitFor(() => expect(titles()).toEqual(["Courrier", "Banderole", "Affiche"]));
  expect(header("Commentaires").getAttribute("aria-sort")).toBe("ascending");
});

test("« Grouper par » reste visible, désactivé : la table ne se groupe pas", async () => {
  mountActions("/kanban/actions/table");
  await screen.findByRole("table");
  const group = screen.getByRole("button", { name: "Grouper par" });
  expect(group.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(group);
  expect(screen.queryByRole("dialog", { name: "Grouper par" })).toBeNull();
});
