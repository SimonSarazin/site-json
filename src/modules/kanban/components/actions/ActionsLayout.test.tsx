// @vitest-environment jsdom
/**
 * Le tableau des actions MONTÉ sur le faux pont du SDK, sous ses vraies routes de vue : ce que la
 * mise en page ajoute aux vues (chargement par `board/get` et son échec, barre de filtres,
 * masquage local des colonnes, archivage notifié), le sélecteur de vues et le menu « ⋯ », et la
 * fiche d'une carte sur la route fille de la vue qui l'ouvre.
 */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { hiddenColumnsStorageKey } from "@/modules/kanban/components/board/hiddenColumns";
import { currentPath, mountActions } from "@/modules/kanban/__fixtures__/actionsHarness";
import { type FakeKanban, ok, refusal, resetHarness, signIn, stubKanbanFetch } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom, openMenu } from "@/modules/kanban/__fixtures__/radixDom";
import { makeAction, makeLinkSnapshot } from "@/modules/kanban/__fixtures__/snapshot";
import type { BoardSnapshot } from "@/modules/kanban/types";

const BOARD_ID = "b1";

function snapshot(): BoardSnapshot {
  const base = makeLinkSnapshot({
    cards: [
      makeAction("a1", "todo", { title: "Préparer l’atelier", priority: "high" }),
      makeAction("a2", "todo", { title: "Réserver la salle" }),
      makeAction("a3", "done", { title: "Envoyer l’invitation" }),
    ],
  });
  return { ...base, board: { ...base.board, _id: BOARD_ID } };
}

let backend: FakeKanban;

beforeAll(() => {
  installRadixDom();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
});

beforeEach(() => {
  signIn("u1");
  backend = stubKanbanFetch({
    "board/get": () => ok(snapshot()),
    "board/sync": () => ok({ rev: snapshot().board.rev, full: false, activities: [] }),
    "card/archive": () => ok({ archived: true }),
    "card/update": (body) => ok({ card: { ...snapshot().cards[0], title: String(body.title) } }),
    "comment/list": () => ok({ comments: [], total: 0 }),
  });
});

afterEach(resetHarness);

const columnList = (title: string) => screen.queryByRole("list", { name: `Cartes de la colonne ${title}` });
const viewStatus = () => Array.from(document.querySelectorAll('p[role="status"]:not([id])')).map((node) => node.textContent ?? "");
// `hidden` : une boîte Radix ouverte masque le reste de la page aux aides techniques.
const viewNav = () => screen.getByRole("navigation", { name: "Vues du tableau", hidden: true });

test("le tableau se charge : avancement, barre de filtres, colonnes de statut et leurs cartes", async () => {
  mountActions("/kanban/actions");
  expect(await screen.findByRole("list", { name: "Cartes de la colonne À faire" })).toBeTruthy();
  expect(within(columnList("À faire") as HTMLElement).getAllByRole("article")).toHaveLength(2);
  expect(screen.getByText("1/3 terminées · 33 %")).toBeTruthy();
  expect(screen.getByRole("search", { name: "Recherche et filtres du tableau" })).toBeTruthy();
  expect(backend.calls("board/get")).toBe(1);
});

test("la recherche de la barre filtre le tableau", async () => {
  mountActions("/kanban/actions");
  await screen.findByRole("list", { name: "Cartes de la colonne À faire" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher dans ce tableau" }), { target: { value: "salle" } });
  await waitFor(() => expect(within(columnList("À faire") as HTMLElement).getAllByRole("article")).toHaveLength(1));
  expect(within(columnList("Terminé") as HTMLElement).queryAllByRole("article")).toHaveLength(0);
  expect(within(columnList("Terminé") as HTMLElement).getByText("Aucune carte ne correspond au filtre.")).toBeTruthy();
});

test("masquer une colonne : focus sur « N colonnes masquées », masquage annoncé, préférence du poste", async () => {
  mountActions("/kanban/actions");
  await screen.findByRole("list", { name: "Cartes de la colonne À faire" });
  await act(async () => {
    openMenu(screen.getByRole("button", { name: "Actions de la colonne À faire" }));
  });
  await act(async () => {
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Masquer la colonne" }));
  });

  await waitFor(() => expect(columnList("À faire")).toBeNull());
  const notice = screen.getByRole("button", { name: /1 colonne masquée/ });
  await waitFor(() => expect(document.activeElement).toBe(notice));
  expect(viewStatus().join(" ")).toContain("Colonne « À faire » masquée");
  expect(window.localStorage.getItem(hiddenColumnsStorageKey(BOARD_ID))).toContain("todo");

  // « Tout afficher » : la colonne revient, l'indicateur disparaît, le focus passe au bouton
  // « Colonnes affichées ».
  fireEvent.click(notice);
  await waitFor(() => expect(columnList("À faire")).not.toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Colonnes affichées" })));
});

test("« Colonnes affichées » liste les colonnes avec leurs cartes", async () => {
  mountActions("/kanban/actions");
  await screen.findByRole("list", { name: "Cartes de la colonne À faire" });
  fireEvent.click(screen.getByRole("button", { name: "Colonnes affichées" }));
  const dialog = await screen.findByRole("dialog", { name: "Colonnes affichées" });
  expect(within(dialog).getByRole("checkbox", { name: /À faire/ })).toBeTruthy();
  expect(within(dialog).getByText("2 cartes")).toBeTruthy();
});

test("archiver depuis la colonne de fin : la carte part, la réussite est notifiée", async () => {
  mountActions("/kanban/actions");
  await screen.findByRole("list", { name: "Cartes de la colonne Terminé" });
  fireEvent.click(screen.getByRole("button", { name: "Archiver la carte Envoyer l’invitation" }));
  const confirmation = await screen.findByRole("dialog", { name: "Archiver la carte Envoyer l’invitation" });
  fireEvent.click(within(confirmation).getByRole("button", { name: "Archiver" }));

  await waitFor(() => expect(within(columnList("Terminé") as HTMLElement).queryAllByRole("article")).toHaveLength(0));
  await waitFor(() => expect(document.querySelector("[data-sonner-toast]")?.textContent).toContain("Carte archivée"));
  expect(backend.calls("card/archive")).toBe(1);
});

test("échec du chargement : la raison et « Réessayer », qui relance `board/get`", async () => {
  backend.on("board/get", () => refusal(500, "serverError"));
  mountActions("/kanban/actions");
  const alert = await screen.findByRole("alert", undefined, { timeout: 3000 });
  expect(alert).toBeTruthy();
  backend.on("board/get", () => ok(snapshot()));
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
  expect(await screen.findByRole("list", { name: "Cartes de la colonne À faire" })).toBeTruthy();
});

/* -------------------------------------------------------------------------- */
/*  Vues : sélecteur et menu « ⋯ »                                            */
/* -------------------------------------------------------------------------- */

test("le sélecteur passe à la Liste sans relire le tableau ; la recherche suit", async () => {
  mountActions("/kanban/actions");
  await screen.findByRole("list", { name: "Cartes de la colonne À faire" });
  expect(within(viewNav()).getByRole("link", { name: "Tableau" }).getAttribute("aria-current")).toBe("page");
  fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher dans ce tableau" }), { target: { value: "salle" } });

  fireEvent.click(within(viewNav()).getByRole("link", { name: "Liste" }));
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions/liste"));
  expect(within(viewNav()).getByRole("link", { name: "Liste" }).getAttribute("aria-current")).toBe("page");
  // La recherche est restée : seule la carte qui y répond est listée.
  expect(await screen.findByRole("link", { name: /Réserver la salle/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Préparer l’atelier/ })).toBeNull();
  expect((screen.getByRole("searchbox", { name: "Rechercher dans ce tableau" }) as HTMLInputElement).value).toBe("salle");
  expect(backend.calls("board/get")).toBe(1);
});

test("le menu « ⋯ » propose les autres vues ; la vue ouverte rejoint le sélecteur", async () => {
  mountActions("/kanban/actions");
  await screen.findByRole("list", { name: "Cartes de la colonne À faire" });
  await act(async () => {
    openMenu(screen.getByRole("button", { name: "Autres vues et options du tableau" }));
  });
  const menu = await screen.findByRole("menu");
  const views = within(menu).getByRole("group", { name: "Autres vues" });
  expect(within(views).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Vue d’ensemble", "Vue Jalons", "Table", "Chronologie"]);
  expect(within(menu).getByRole("menuitem", { name: "Gérer les jalons…" })).toBeTruthy();
  await act(async () => {
    fireEvent.click(within(views).getByRole("menuitem", { name: "Table" }));
  });
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions/table"));
  expect(within(viewNav()).getByRole("link", { name: "Table" }).getAttribute("aria-current")).toBe("page");
  expect(await screen.findByRole("table")).toBeTruthy();
});

test("tableau d’une organisation : ni vue Jalons ni gestion des jalons", async () => {
  const organization = snapshot();
  backend.on("board/get", () => ok({ ...organization, board: { ...organization.board, parentType: "organizations" } }));
  mountActions("/kanban/actions");
  await screen.findByRole("list", { name: "Cartes de la colonne À faire" });
  await act(async () => {
    openMenu(screen.getByRole("button", { name: "Autres vues et options du tableau" }));
  });
  const menu = await screen.findByRole("menu");
  expect(within(menu).queryByRole("menuitem", { name: "Vue Jalons" })).toBeNull();
  expect(within(menu).queryByRole("menuitem", { name: "Gérer les jalons…" })).toBeNull();
});

/* -------------------------------------------------------------------------- */
/*  Fiche d'une carte : route fille de la vue qui l'ouvre                     */
/* -------------------------------------------------------------------------- */

test("lien profond vers une carte : la fiche s’ouvre sur elle ; « Annuler » rend l’adresse du tableau", async () => {
  mountActions("/kanban/actions/carte/a1");
  const dialog = await screen.findByRole("dialog", { name: "Détail de la carte" });
  expect(within(dialog).getByDisplayValue("Préparer l’atelier")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // Le tableau est resté monté sous la fiche : aucune relecture.
  expect(backend.calls("board/get")).toBe(1);
});

test("cliquer une carte ouvre sa fiche ; enregistrer envoie le correctif et referme", async () => {
  mountActions("/kanban/actions");
  const title = await screen.findByRole("link", { name: "Réserver la salle" });
  fireEvent.click(title);
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions/carte/a2"));
  const dialog = await screen.findByRole("dialog", { name: "Détail de la carte" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: /Titre/ }), { target: { value: "Réserver la grande salle" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(backend.calls("card/update")).toBe(1));
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions"));
});

test("depuis la Liste, la fiche s’ouvre par-dessus elle et la fermer y ramène", async () => {
  mountActions("/kanban/actions/liste");
  fireEvent.click(await screen.findByRole("link", { name: /Préparer l’atelier/ }));
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions/liste/carte/a1"));
  const dialog = await screen.findByRole("dialog", { name: "Détail de la carte" });
  // La Liste reste la vue courante sous la fiche.
  expect(within(viewNav()).getByRole("link", { name: "Liste", hidden: true }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions/liste"));
});

test("lien vers une carte absente du tableau : la fiche le dit", async () => {
  mountActions("/kanban/actions/carte/inconnue");
  const dialog = await screen.findByRole("dialog", { name: "Détail de la carte" });
  await waitFor(() => expect(within(dialog).getByText(/n'est plus sur le tableau/)).toBeTruthy());
});

test("archiver depuis la fiche : elle se ferme aussitôt, la carte part, la réussite est notifiée", async () => {
  mountActions("/kanban/actions/carte/a3");
  const dialog = await screen.findByRole("dialog", { name: "Détail de la carte" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Archiver la carte" }));
  fireEvent.click(within(await within(dialog).findByRole("alert")).getByRole("button", { name: "Archiver" }));
  await waitFor(() => expect(currentPath()).toBe("/kanban/actions"));
  await waitFor(() => expect(within(columnList("Terminé") as HTMLElement).queryAllByRole("article")).toHaveLength(0));
  await waitFor(() => expect(document.querySelector("[data-sonner-toast]")?.textContent).toContain("Carte archivée"));
  expect(backend.calls("card/archive")).toBe(1);
});
