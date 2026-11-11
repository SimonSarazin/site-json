// @vitest-environment jsdom
/**
 * GARDE DE LA FICHE DE CARTE SUR UN TABLEAU RELIÉ (§11.4-11.5), reprise de co-kanban
 * (`tests/unit/cardDialogCommunecter.test.tsx`).
 *
 * Une action Communecter n'est pas une carte kanban : ce fichier verrouille ce que la fiche doit
 * montrer, et ce qui part au serveur.
 *  - priorité « Aucune » proposée ; statut de carte, liens et suppression ABSENTS ;
 *  - étiquettes libres (tags) au lieu des étiquettes du tableau ;
 *  - jalons : ouverts + « Aucun », plus le jalon actuel s'il est clos ;
 *  - montant et temps passé modifiables par l'owner, LISIBLES par les autres ;
 *  - « Archiver » avec confirmation ; une modification non enregistrée ne se perd pas d'un geste ;
 *  - le correctif envoyé ne porte que les champs du §11.4 modifiés, listes avec leur BASE.
 */
import "@/modules/kanban/i18n";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { hookWrapper, ok, resetHarness, signIn, stubKanbanFetch, testQueryClient } from "@/modules/kanban/__fixtures__/hookHarness";
import { installRadixDom } from "@/modules/kanban/__fixtures__/radixDom";
import { LINK_CAPABILITIES, MILESTONES, makeAction, makeLinkSnapshot, makeMember } from "@/modules/kanban/__fixtures__/snapshot";
import { KanbanApiError } from "@/modules/kanban/lib/kanbanErrors";
import type { Capabilities, Card } from "@/modules/kanban/types";
import CardDialog from "./CardDialog";

const CARD = makeAction("66aa00070000000000000007", "todo", {
  title: "Agenda : état vide",
  tags: ["Agenda"],
  labelIds: ["tag:Agenda"],
  // Rattachée au jalon CLOS : il doit rester proposé.
  milestone: { milestoneId: MILESTONES[0].milestoneId, name: "V1.1", status: "close" },
  credits: 2,
  timeSpent: 90,
  assignees: ["u2"],
});

const SNAPSHOT = makeLinkSnapshot({
  board: { ...makeLinkSnapshot().board, labels: [{ id: "tag:Agenda", name: "Agenda", color: "#dc2626" }] },
  cards: [CARD],
  members: [makeMember("u1", "owner", "Camille"), makeMember("u2", "editor", "Tom")],
});

beforeAll(installRadixDom);

beforeEach(() => {
  signIn("u1");
  stubKanbanFetch({ "comment/list": () => ok({ comments: [], total: 0 }) });
});

afterEach(resetHarness);

function mount(capabilities: Capabilities = LINK_CAPABILITIES, card: Card | null = CARD, save: () => Promise<unknown> = async () => undefined, isLoading = false) {
  const onSave = vi.fn(save);
  const onArchive = vi.fn(async () => undefined);
  const onClose = vi.fn();
  render(
    <CardDialog
      card={card}
      board={SNAPSHOT.board}
      columns={SNAPSHOT.columns}
      members={SNAPSHOT.members}
      capabilities={capabilities}
      milestones={SNAPSHOT.milestones}
      currentUserId="u1"
      isLoading={isLoading}
      onClose={onClose}
      onSave={onSave}
      onArchive={capabilities.canArchiveCards ? onArchive : undefined}
    />,
    { wrapper: hookWrapper(testQueryClient(), { router: true }) },
  );
  return { onSave, onArchive, onClose };
}

/** Valeur d'une liste déroulante ; la garde nomme l'élément trouvé à sa place. */
function selectedValue(element: HTMLElement): string {
  if (!(element instanceof HTMLSelectElement)) throw new Error(`liste déroulante attendue, trouvé <${element.tagName.toLowerCase()}>`);
  return element.value;
}

test("priorité « Aucune », jalons ouverts + actuel clos ; ni statut, ni liens, ni suppression", async () => {
  mount();
  const dialog = await screen.findByRole("dialog");
  const priority = within(dialog).getByRole("combobox", { name: "Priorité" });
  expect(within(priority).getByRole("option", { name: "Aucune" })).toBeTruthy();
  expect(selectedValue(priority)).toBe("");

  const milestone = within(dialog).getByRole("combobox", { name: "Jalon" });
  expect(within(milestone).getAllByRole("option").map((option) => option.textContent)).toEqual(["Aucun jalon", "V1.1 (clos)", "V1.2"]);
  expect(selectedValue(milestone)).toBe(MILESTONES[0].milestoneId);

  // Statut dérivé de la colonne, liens absents d'une action (§11.4).
  expect(within(dialog).queryByText("Statut")).toBeNull();
  expect(within(dialog).queryByRole("heading", { name: /Liens/ })).toBeNull();
  expect(within(dialog).queryByRole("button", { name: /Supprimer la carte/ })).toBeNull();
  // Le contexte : la colonne et le tableau.
  expect(within(dialog).getByText(/^À faire · /)).toBeTruthy();
  // Rendue dans un PORTAIL : la boîte porte elle-même la racine des variables du module.
  expect(dialog.closest('.kanban-module')).not.toBeNull();
});

test("le correctif ne porte que les champs du §11.4 modifiés", async () => {
  const { onSave, onClose } = mount();
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Priorité" }), { target: { value: "urgent" } });
  const tagInput = within(dialog).getByRole("textbox", { name: "Nouvelle étiquette" });
  fireEvent.change(tagInput, { target: { value: "#UX" } });
  fireEvent.keyDown(tagInput, { key: "Enter" });
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Jalon" }), { target: { value: MILESTONES[1].milestoneId } });
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: "Montant" }), { target: { value: "5" } });

  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave).toHaveBeenCalledWith({
    priority: "urgent",
    tags: ["Agenda", "UX"],
    // Protocole card/update : la liste vue à l'ouverture, pour la fusion.
    tagsBase: ["Agenda"],
    milestoneId: MILESTONES[1].milestoneId,
    credits: 5,
  });
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

test("cocher une sous-tâche envoie la checklist ET sa base (fusion à trois côté serveur)", async () => {
  const card = { ...CARD, checklist: [{ id: "t1", label: "Maquette", done: false }], checklistTotal: 1, checklistDone: 0 };
  const { onSave } = mount(LINK_CAPABILITIES, card);
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /Maquette/ }));
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave).toHaveBeenCalledWith({
    checklist: [{ id: "t1", label: "Maquette", done: true }],
    checklistBase: [{ id: "t1", label: "Maquette", done: false }],
  });
});

test("action héritée : un assigné parti du projet ne bloque pas un changement de titre", async () => {
  const { onSave } = mount(LINK_CAPABILITIES, { ...CARD, assignees: ["u2", "parti0parti0parti0parti0"] });
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: /Titre/ }), { target: { value: "Agenda : état vide (v2)" } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave).toHaveBeenCalledWith({ title: "Agenda : état vide (v2)" });
});

test("action héritée : un montant négatif ne bloque pas une priorité (validation native coupée)", async () => {
  const { onSave } = mount(LINK_CAPABILITIES, { ...CARD, credits: -2 });
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Priorité" }), { target: { value: "high" } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave).toHaveBeenCalledWith({ priority: "high" });
});

test("refus « contributorsLimit » : le message cite la borne, SOUS les assignés, qui prennent le focus", async () => {
  const refused = new KanbanApiError("validation", { status: 422, code: "validation", detail: { field: "assignees", reason: "contributorsLimit", min: null, max: 1, count: 2 } });
  mount(LINK_CAPABILITIES, CARD, async () => {
    throw refused;
  });
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("checkbox", { name: /Camille/ }));
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  const message = await within(dialog).findByText(/n'accepte qu'un seul participant \(2 demandés\)/);
  expect(message.closest('[data-card-field="assignees"]')).not.toBeNull();
  await waitFor(() => expect(document.activeElement?.closest('[data-card-field="assignees"]')).not.toBeNull());
});

test("titre vide : le focus va au champ et le refus est résumé", async () => {
  const { onSave } = mount();
  const dialog = await screen.findByRole("dialog");
  const title = within(dialog).getByRole("textbox", { name: /Titre/ });
  fireEvent.change(title, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(await within(dialog).findByText("Rien n'est enregistré : un champ est à corriger.")).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(title));
  expect(onSave).not.toHaveBeenCalled();
});

test("un pseudo-tag de statut est refusé à la saisie", async () => {
  mount();
  const dialog = await screen.findByRole("dialog");
  const tagInput = within(dialog).getByRole("textbox", { name: "Nouvelle étiquette" });
  fireEvent.change(tagInput, { target: { value: "totest" } });
  fireEvent.keyDown(tagInput, { key: "Enter" });
  expect((await within(dialog).findByRole("alert")).textContent).toMatch(/range la carte dans une colonne/);
});

test("contributeur : montant et temps passé en lecture, pas d’archivage", async () => {
  mount({ ...LINK_CAPABILITIES, role: "editor", canEditCredits: false, canArchiveCards: false, canManageMilestones: false, canReorderColumns: false, canArchiveBoard: false, canDeleteBoard: false });
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByRole("spinbutton", { name: "Montant" })).toBeNull();
  expect(within(dialog).getByText("1 h 30 min")).toBeTruthy();
  expect(within(dialog).getByText(/Seul un administrateur du projet/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Archiver la carte" })).toBeNull();
});

test("lecteur assigné : il coche la checklist, rien d’autre", async () => {
  const card = { ...CARD, assignees: ["u1"], checklist: [{ id: "t1", label: "Maquette", done: false }], checklistTotal: 1, checklistDone: 0 };
  mount({ ...LINK_CAPABILITIES, role: "viewer", canEditCards: false, canEditCredits: false, canArchiveCards: false }, card);
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByRole("textbox", { name: /Titre/ })).toBeNull();
  expect(within(dialog).getByText("Agenda : état vide")).toBeTruthy();
  expect(within(dialog).getByRole("checkbox", { name: /Maquette/ })).toHaveProperty("disabled", false);
  expect(within(dialog).getByText(/vous permet de cocher la checklist/)).toBeTruthy();
});

test("« Archiver » demande confirmation puis archive", async () => {
  const { onArchive, onClose } = mount();
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Archiver la carte" }));
  const confirm = await screen.findByRole("alert");
  expect(confirm.textContent).toMatch(/quittera le tableau, sans être supprimée/);
  fireEvent.click(within(confirm).getByRole("button", { name: "Archiver" }));
  await waitFor(() => expect(onArchive).toHaveBeenCalled());
  expect(onClose).toHaveBeenCalled();
});

test("fermer une fiche modifiée demande confirmation : « Annuler » garde la saisie, « Fermer sans enregistrer » ferme", async () => {
  const { onClose } = mount();
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox", { name: /Titre/ }), { target: { value: "Nouveau titre" } });
  fireEvent.keyDown(dialog, { key: "Escape" });
  const confirm = await screen.findByRole("alert");
  expect(confirm.textContent).toMatch(/ne sont pas enregistrées/);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByRole("button", { name: "Annuler" }));
  expect(within(dialog).getByDisplayValue("Nouveau titre")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();

  // Une seconde fois, « Fermer sans enregistrer » ferme, sans rien envoyer.
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Fermer sans enregistrer" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("lien vers une carte qui n’est plus sur le tableau : le dire, et seulement « Fermer »", async () => {
  mount(LINK_CAPABILITIES, null);
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/n'est plus sur le tableau/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  expect(screen.getByRole("button", { name: "Fermer" })).toBeTruthy();
});

test("tableau encore en chargement : un squelette, pas « introuvable »", async () => {
  mount(LINK_CAPABILITIES, null, async () => undefined, true);
  const dialog = await screen.findByRole("dialog");
  expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(within(dialog).queryByText(/n'est plus sur le tableau/)).toBeNull();
});
