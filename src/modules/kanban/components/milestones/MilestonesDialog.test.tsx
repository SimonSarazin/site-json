// @vitest-environment jsdom
/**
 * Boîte des jalons du projet, reprise de co-kanban (`tests/unit/milestonesDialog.test.tsx`) sur le
 * faux pont du SDK. Ce qu'aucun test pur ne voit : le parcours, et ce qui part au serveur.
 *  - la liste est RELUE à l'ouverture (`milestone/list`) : un jalon créé dans gestion n'est pas
 *    journalisé par le module, l'instantané l'ignore ;
 *  - ouverts et clos sont séparés, chacun avec ses cartes rattachées ;
 *  - créer valide le nom puis envoie le corps attendu ;
 *  - renommer se fait en place, Échap annule sans rien envoyer ;
 *  - clore et rouvrir envoient le statut et déplacent le jalon de section ;
 *  - un contributeur (sans `canManageMilestones`) lit la même liste, sans commandes.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { hookWrapper, ok, resetHarness, signIn, stubKanbanFetch, testQueryClient } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom } from "@/modules/kanban/__fixtures__/radixDom";
import { LINK_CAPABILITIES, MILESTONES, makeAction, makeLinkSnapshot } from "@/modules/kanban/__fixtures__/snapshot";
import { fromDateInputValue } from "@/modules/kanban/lib/dates";
import type { Capabilities, Milestone } from "@/modules/kanban/types";
import MilestonesDialog from "./MilestonesDialog";

const [CLOSED, OPEN] = MILESTONES;

/** Créé dans Kanban gestion : absent de l'instantané, présent dans `milestone/list`. */
const FROM_GESTION: Milestone = { milestoneId: "gG7hJ9kL2mN4pQ6rS", name: "Créé dans gestion", description: "", startDate: null, endDate: null, status: "open" };

let sent: Record<string, Array<Record<string, unknown>>> = {};
let milestones: Milestone[] = [];
let capabilities: Capabilities = LINK_CAPABILITIES;

const record = (route: string, body: Record<string, unknown>) => {
  sent[route] = [...(sent[route] ?? []), body];
};

beforeAll(installRadixDom);

beforeEach(() => {
  sent = {};
  milestones = [CLOSED, OPEN, FROM_GESTION];
  capabilities = LINK_CAPABILITIES;
  signIn("u1");
  stubKanbanFetch({
    "board/get": () =>
      ok(
        makeLinkSnapshot({
          capabilities,
          milestones: [CLOSED, OPEN],
          cards: [
            makeAction("a1", "todo", { milestone: { milestoneId: OPEN.milestoneId, name: OPEN.name, status: "open" } }),
            makeAction("a2", "done", { milestone: { milestoneId: OPEN.milestoneId, name: OPEN.name, status: "open" } }),
            makeAction("a3", "done", { milestone: { milestoneId: CLOSED.milestoneId, name: CLOSED.name, status: "close" } }),
          ],
        }),
      ),
    "milestone/list": (body) => {
      record("milestone/list", body);
      return ok({ milestones });
    },
    "milestone/create": (body) => {
      record("milestone/create", body);
      const created: Milestone = {
        milestoneId: "nW5xY7zA9bC2dE4fG",
        name: String(body.name),
        description: typeof body.description === "string" ? body.description : "",
        startDate: typeof body.startDate === "number" ? body.startDate : null,
        endDate: typeof body.endDate === "number" ? body.endDate : null,
        status: "open",
      };
      milestones = [...milestones, created];
      return ok({ milestone: created, rev: 7 });
    },
    "milestone/update": (body) => {
      record("milestone/update", body);
      milestones = milestones.map((milestone) =>
        milestone.milestoneId === body.milestoneId
          ? { ...milestone, ...(typeof body.name === "string" ? { name: body.name } : {}), ...(body.status === "open" || body.status === "close" ? { status: body.status } : {}) }
          : milestone,
      );
      return ok({ milestone: milestones.find((milestone) => milestone.milestoneId === body.milestoneId), rev: 8 });
    },
  });
});

afterEach(resetHarness);

function mount() {
  const onClose = vi.fn();
  const Wrapper = hookWrapper(testQueryClient());
  render(
    <Wrapper>
      <MilestonesDialog boardId="board1" onClose={onClose} />
    </Wrapper>,
  );
  return { onClose };
}

test("liste RELUE à l’ouverture : ouverts et clos, cartes rattachées", async () => {
  mount();
  const dialog = await screen.findByRole("dialog", { name: "Jalons du projet" });
  expect(await within(dialog).findByText("Créé dans gestion")).toBeTruthy();
  expect(sent["milestone/list"]).toEqual([{ boardId: "board1" }]);
  expect(within(dialog).getByRole("heading", { name: "Ouverts (2)" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "Clos (1)" })).toBeTruthy();
  await waitFor(() => expect(within(dialog).getByText(OPEN.name).closest("li")?.textContent).toMatch(/2 cartes/));
  expect(within(dialog).getByText(CLOSED.name).closest("li")?.textContent).toMatch(/1 carte/);
  // La boîte vit dans un portail : elle porte la racine du module, sans quoi ses `--ck-*` manquent.
  expect(dialog.classList.contains("kanban-module")).toBe(true);
});

test("créer : le nom est exigé, puis le corps attendu part et le jalon rejoint la liste", async () => {
  mount();
  const dialog = await screen.findByRole("dialog", { name: "Jalons du projet" });
  await within(dialog).findByText("Créé dans gestion");
  const form = within(dialog).getByRole("heading", { name: "Nouveau jalon" }).closest("form");
  if (!form) throw new Error("formulaire de création introuvable");
  const name = within(form).getByRole("textbox", { name: /Nom du jalon/ });

  // Un nom fait d'espaces passe la validation native (`required`) : c'est la nôtre qui le refuse,
  // sans appel au serveur, et le focus va au champ.
  fireEvent.change(name, { target: { value: "   " } });
  fireEvent.click(within(form).getByRole("button", { name: "Créer le jalon" }));
  expect(await within(form).findByText("Donnez un nom au jalon.")).toBeTruthy();
  expect(document.activeElement).toBe(name);
  expect(sent["milestone/create"]).toBeUndefined();

  fireEvent.change(name, { target: { value: "Sprint 12" } });
  fireEvent.change(within(form).getByLabelText("Date de début"), { target: { value: "2026-11-02" } });
  fireEvent.change(within(form).getByLabelText("Date de fin"), { target: { value: "2026-11-20" } });
  fireEvent.click(within(form).getByRole("button", { name: "Créer le jalon" }));

  await waitFor(() => expect(sent["milestone/create"]).toHaveLength(1));
  expect(sent["milestone/create"]?.[0]).toEqual({
    boardId: "board1",
    name: "Sprint 12",
    // Jalon d'un tableau relié : jours du fuseau du navigateur, début en DÉBUT de jour et fin en
    // FIN de jour (comme les dates d'action).
    startDate: fromDateInputValue("2026-11-02", "local", "start"),
    endDate: fromDateInputValue("2026-11-20", "local", "end"),
  });
  expect(await within(dialog).findByText("Sprint 12")).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "Ouverts (3)" })).toBeTruthy();
  // Le champ se vide pour enchaîner une autre création.
  expect(name).toHaveProperty("value", "");
});

test("renommer en place : Échap annule sans rien envoyer, Enregistrer envoie le nom seul", async () => {
  mount();
  const dialog = await screen.findByRole("dialog", { name: "Jalons du projet" });
  await within(dialog).findByText("Créé dans gestion");

  fireEvent.click(within(dialog).getByRole("button", { name: `Renommer le jalon ${OPEN.name}` }));
  const field = within(dialog).getByDisplayValue(OPEN.name);
  fireEvent.change(field, { target: { value: "Abandonné" } });
  fireEvent.keyDown(field, { key: "Escape" });
  // La boîte reste ouverte : Échap n'a annulé que l'édition.
  expect(screen.getByRole("dialog", { name: "Jalons du projet" })).toBeTruthy();
  expect(within(dialog).queryByDisplayValue("Abandonné")).toBeNull();
  expect(sent["milestone/update"]).toBeUndefined();
  // Le focus revient sur « Renommer », pas sur le corps de la page.
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: `Renommer le jalon ${OPEN.name}` })));

  fireEvent.click(within(dialog).getByRole("button", { name: `Renommer le jalon ${OPEN.name}` }));
  fireEvent.change(within(dialog).getByDisplayValue(OPEN.name), { target: { value: "V1.2 — Agenda" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(sent["milestone/update"]).toHaveLength(1));
  expect(sent["milestone/update"]?.[0]).toEqual({ boardId: "board1", milestoneId: OPEN.milestoneId, name: "V1.2 — Agenda" });
  expect(await within(dialog).findByText("V1.2 — Agenda")).toBeTruthy();
});

test("clore puis rouvrir : le statut part, le jalon change de section", async () => {
  mount();
  const dialog = await screen.findByRole("dialog", { name: "Jalons du projet" });
  await within(dialog).findByText("Créé dans gestion");

  fireEvent.click(within(dialog).getByRole("button", { name: `Clore le jalon ${OPEN.name}` }));
  await waitFor(() => expect(sent["milestone/update"]).toHaveLength(1));
  expect(sent["milestone/update"]?.[0]).toEqual({ boardId: "board1", milestoneId: OPEN.milestoneId, status: "close" });
  expect(await within(dialog).findByRole("heading", { name: "Clos (2)" })).toBeTruthy();
  expect(within(dialog).getByRole("heading", { name: "Ouverts (1)" })).toBeTruthy();

  fireEvent.click(within(dialog).getByRole("button", { name: `Rouvrir le jalon ${CLOSED.name}` }));
  await waitFor(() => expect(sent["milestone/update"]).toHaveLength(2));
  expect(sent["milestone/update"]?.[1]).toEqual({ boardId: "board1", milestoneId: CLOSED.milestoneId, status: "open" });
  expect(await within(dialog).findByRole("heading", { name: "Ouverts (2)" })).toBeTruthy();
});

test("contributeur : la même liste, en lecture seule", async () => {
  capabilities = { ...LINK_CAPABILITIES, role: "editor", canManageMilestones: false, canEditCredits: false };
  mount();
  const dialog = await screen.findByRole("dialog", { name: "Jalons du projet" });
  expect(await within(dialog).findByText("Seul un administrateur du projet crée et modifie les jalons.")).toBeTruthy();
  expect(await within(dialog).findByText("Créé dans gestion")).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "Créer le jalon" })).toBeNull();
  expect(within(dialog).queryByRole("button", { name: /Renommer le jalon/ })).toBeNull();
  expect(within(dialog).queryByRole("button", { name: /Clore le jalon/ })).toBeNull();
});

test("« Fermer » ferme la boîte", async () => {
  const { onClose } = mount();
  const dialog = await screen.findByRole("dialog", { name: "Jalons du projet" });
  // Deux « Fermer » : la croix de la boîte et le bouton du pied ; c'est celui du pied qu'on vise.
  const buttons = within(dialog).getAllByRole("button", { name: "Fermer" });
  fireEvent.click(buttons[buttons.length - 1]);
  expect(onClose).toHaveBeenCalled();
});
