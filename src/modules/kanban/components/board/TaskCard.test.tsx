// @vitest-environment jsdom
/**
 * GARDE DE L'ALTERNATIVE CLAVIER AU GLISSER-DÉPOSER, reprise de co-kanban
 * (`tests/unit/cardMoveAlternative.test.tsx`).
 *
 * Le menu « Déplacer vers… » vit dans le menu d'actions de la carte : il n'apparaît pas dans le
 * rendu serveur. Ici on l'ouvre pour de vrai. Une personne qui ne peut pas glisser à la souris
 * (clavier seul, lecteur d'écran, tremblements, tactile imprécis) doit pouvoir déplacer une carte.
 *
 * Et les GARDES DU CLIC qui ouvre la carte (sa route) : un clic pointeur n'importe où sur la fiche
 * l'ouvre, mais ni le clic synthétique d'Entrée sur la poignée, ni un clic sur une commande ou
 * dans le panneau du menu.
 */
import "@/modules/kanban/i18n";
import { DndContext } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { TaskCard } from "@/modules/kanban/components/board/TaskCard";
import { indexMembers } from "@/modules/kanban/components/board/kanbanDnd";
import { installRadixDom, openMenu } from "@/modules/kanban/__fixtures__/radixDom";
import { makeCard, makeColumn } from "@/modules/kanban/__fixtures__/snapshot";

const COLONNE_SOURCE = makeColumn("col1", 1000, { title: "À faire", titleKey: "todo" });
const COLONNE_CIBLE = makeColumn("col2", 2000, { title: "En cours", titleKey: "doing" });
const CARTE = makeCard("c1", "col1", { title: "Commander le plan de travail", priority: "urgent" });

beforeAll(installRadixDom);
afterEach(cleanup);

/**
 * Témoin de navigation : la fiche ouvre la carte par un `navigate` dans son gestionnaire de clic.
 * Sans lui, rien dans le DOM ne dirait si la navigation a eu lieu — et le test du garde-fou
 * `event.detail` passerait quoi qu'il arrive.
 */
function Temoin() {
  const { pathname } = useLocation();
  return <p data-testid="chemin">{pathname}</p>;
}

/** Routeur des montages : le titre de la carte est le lien de sa fiche. */
function Routeur({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <Temoin />
      {children}
    </MemoryRouter>
  );
}

const chemin = () => screen.getByTestId("chemin").textContent;
const CHEMIN_FICHE = "/kanban/actions/carte/c1";

/** Fiche de la carte, telle que le tableau la monte. */
function fiche(container: HTMLElement): HTMLElement {
  const element = container.querySelector("article");
  if (!(element instanceof HTMLElement)) throw new Error("fiche de carte introuvable");
  return element;
}

/** Poignée clavier de la carte (`data-card-handle`), `null` pour un lecteur. */
function poignee(container: HTMLElement): HTMLElement | null {
  const element = container.querySelector("[data-card-handle]");
  return element instanceof HTMLElement ? element : null;
}

interface Options {
  canonical?: boolean;
  onMove?: (intent: unknown) => void;
  inDoneColumn?: boolean;
  onArchive?: (cardId: string) => void;
}

function monter(canEdit: boolean, options: Options = {}) {
  return render(
    <DndContext>
      <ul>
        <TaskCard
          card={CARTE}
          columnId="col1"
          columns={[COLONNE_SOURCE, COLONNE_CIBLE]}
          getCard={(cardId) => (cardId === CARTE._id ? CARTE : undefined)}
          getCardOrder={() => ({ col1: [CARTE._id], col2: [] })}
          memberIndex={indexMembers([])}
          labelIndex={new Map()}
          nowSeconds={0}
          canEdit={canEdit}
          onMove={options.onMove ?? (() => {})}
          canonical={options.canonical}
          inDoneColumn={options.inDoneColumn}
          onArchive={options.onArchive}
        />
      </ul>
    </DndContext>,
    { wrapper: Routeur },
  );
}

const declencheurMenu = () => screen.getByRole("button", { name: "Actions de la carte Commander le plan de travail" });

/** Ouvre « Déplacer vers… » par le menu « ⋯ » et rend la boîte. */
async function ouvrirDeplacer(): Promise<HTMLElement> {
  await act(async () => {
    openMenu(declencheurMenu());
  });
  const menu = await screen.findByRole("menu");
  await act(async () => {
    fireEvent.click(within(menu).getByRole("menuitem", { name: /vers…/i }));
  });
  return screen.findByRole("dialog", { name: /déplacer/i });
}

test("le menu de la carte offre un déplacement sans glisser", async () => {
  monter(true);
  // Un <button> natif : focusable au clavier, actionnable par Entrée comme par Espace.
  expect(declencheurMenu().tagName).toBe("BUTTON");

  const boite = await ouvrirDeplacer();
  // La colonne d'arrivée est NOMMÉE — pas désignée par une pastille de couleur.
  expect(within(boite).getByRole("option", { name: "En cours" })).toBeTruthy();
});

test("un lecteur n’a aucune prise de déplacement, et le contenu reste entier", () => {
  const { container } = monter(false);
  expect(screen.queryByRole("button", { name: /déplacer/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /actions de la carte/i })).toBeNull();
  // Ni poignée, ni rôle de bouton, ni tabulation, ni description de rôle sur la fiche : un rôle
  // qui ne fait rien est pire que pas de rôle.
  expect(poignee(container)).toBeNull();
  expect(fiche(container).getAttribute("role")).toBeNull();
  expect(fiche(container).getAttribute("aria-roledescription")).toBeNull();
  expect(fiche(container).getAttribute("tabindex")).toBeNull();
  expect(screen.getByTitle("Commander le plan de travail")).toBeTruthy();
  // Et la carte reste consultable : un clic l'ouvre toujours.
  fireEvent.click(fiche(container), { detail: 1 });
  expect(chemin()).toBe(CHEMIN_FICHE);
});

/*
 * GARDE DU CLIC DE SURFACE ET DE LA POIGNÉE. La prise CLAVIER est la poignée, un vrai bouton :
 * Entrée y émet un clic SYNTHÉTIQUE en plus de la saisie de dnd-kit. S'il naviguait, Entrée
 * ouvrirait la fiche par-dessus une carte qu'on vient de prendre en main. `event.detail` est le
 * seul discriminant : 0 au clavier, >= 1 au pointeur, et au pointeur la poignée fait partie de
 * la fiche.
 */
test("un clic pointeur ouvre la carte, un clic clavier sur la poignée ne navigue pas", () => {
  const { container } = monter(true);
  expect(chemin()).toBe("/");
  const prise = poignee(container);
  if (prise === null) throw new Error("poignée introuvable pour un éditeur");
  fireEvent.click(prise, { detail: 0 });
  expect(chemin()).toBe("/");
  fireEvent.click(prise, { detail: 1 });
  expect(chemin()).toBe(CHEMIN_FICHE);
});

test("un clic pointeur sur la surface de la fiche ouvre la carte ; le titre en est le lien", () => {
  const { container } = monter(true);
  expect(screen.getByRole("link", { name: "Commander le plan de travail" }).getAttribute("href")).toBe(CHEMIN_FICHE);
  fireEvent.click(fiche(container), { detail: 1 });
  expect(chemin()).toBe(CHEMIN_FICHE);
});

test("un clic sur le menu « ⋯ » ou dans son panneau n’ouvre pas la carte par-dessus", async () => {
  monter(true);
  fireEvent.click(declencheurMenu(), { detail: 1 });
  expect(chemin()).toBe("/");
  await act(async () => {
    openMenu(declencheurMenu());
  });
  fireEvent.click(await screen.findByRole("menu"), { detail: 1 });
  expect(chemin()).toBe("/");
});

test("« Ouvrir la carte » du menu ouvre la fiche", async () => {
  monter(true);
  await act(async () => {
    openMenu(declencheurMenu());
  });
  await act(async () => {
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Ouvrir la carte" }));
  });
  expect(chemin()).toBe(CHEMIN_FICHE);
});

test("éditeur : la poignée est la prise clavier, la fiche n’est pas un bouton", () => {
  const { container } = monter(true);
  const prise = poignee(container);
  if (prise === null) throw new Error("poignée introuvable pour un éditeur");
  expect(prise.tagName).toBe("BUTTON");
  expect(prise.getAttribute("aria-roledescription")).toBe("carte déplaçable");
  expect(prise.getAttribute("aria-label")).toBe("Commander le plan de travail");
  expect(fiche(container).getAttribute("role")).toBeNull();
  expect(fiche(container).getAttribute("tabindex")).toBeNull();
});

/*
 * L'appui long qui saisit la carte est aussi le geste qui sélectionne le texte : sans ces
 * barrières, seule la poignée se saisissait au doigt. Un lecteur, lui, garde la sélection.
 */
test("éditeur : ni la sélection de texte ni le lien du titre ne prennent le geste de la carte ; lecteur : ils restent", () => {
  const { container, unmount } = monter(true);
  expect(fiche(container).className).toMatch(/(^|\s)select-none(\s|$)/);
  expect(fiche(container).className).toContain("[-webkit-touch-callout:none]");
  // iPadOS soulève un lien à l'appui long : sur une carte déplaçable, ce glisser natif prenait le geste.
  expect(screen.getByTitle("Commander le plan de travail").getAttribute("draggable")).toBe("false");
  unmount();
  const reader = monter(false);
  expect(fiche(reader.container).className).not.toMatch(/(^|\s)select-none(\s|$)/);
  expect(screen.getByTitle("Commander le plan de travail").hasAttribute("draggable")).toBe(false);
});

/*
 * CONSTAT #31 — BRANCHE CANONIQUE de « Déplacer vers… » (tableau relié, D16). Seule la colonne
 * se choisit : aucune position, aucune ancre envoyée, et rien ne part si la colonne ne change pas.
 */
test("tableau relié : « Déplacer vers… » ne propose que la colonne, et ne l’envoie que si elle change", async () => {
  const onMove = vi.fn();
  monter(true, { canonical: true, onMove });
  const boite = await ouvrirDeplacer();

  expect(within(boite).queryByLabelText("Position")).toBeNull();
  expect(within(boite).getByText(/seule la colonne se choisit/i)).toBeTruthy();

  fireEvent.change(within(boite).getByLabelText("Colonne"), { target: { value: "col2" } });
  fireEvent.click(within(boite).getByRole("button", { name: "Déplacer" }));
  await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
  // `toStrictEqual` : aucune clé `beforeCardId` / `afterCardId`, même indéfinie.
  expect(onMove.mock.calls[0][0]).toStrictEqual({ cardId: "c1", columnId: "col2" });
});

test("tableau relié : « Déplacer vers… » sur la même colonne ferme la boîte sans rien envoyer, et rend le focus au menu", async () => {
  const onMove = vi.fn();
  monter(true, { canonical: true, onMove });
  const boite = await ouvrirDeplacer();
  fireEvent.click(within(boite).getByRole("button", { name: "Déplacer" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /déplacer/i })).toBeNull());
  expect(onMove).not.toHaveBeenCalled();
  // La boîte s'ouvrait depuis un item de menu, retiré : sans retour explicite, le focus
  // tombait sur <body>.
  await waitFor(() => expect(document.activeElement).toBe(declencheurMenu()));
});

test("ordre manuel : la position se choisit, et l’intention porte son ancre", async () => {
  const onMove = vi.fn();
  monter(true, { onMove });
  const boite = await ouvrirDeplacer();
  expect(within(boite).getByLabelText("Position")).toBeTruthy();
  fireEvent.change(within(boite).getByLabelText("Colonne"), { target: { value: "col2" } });
  fireEvent.click(within(boite).getByRole("button", { name: "Déplacer" }));
  await waitFor(() => expect(onMove).toHaveBeenCalledWith({ cardId: "c1", columnId: "col2" }));
});

/*
 * CONSTAT #31 — ARCHIVER depuis la colonne de fin : jamais ailleurs, toujours avec confirmation
 * (aucun écran ne restaure une carte archivée).
 */
test("« Archiver » n’existe que dans la colonne de fin", () => {
  monter(true, { onArchive: vi.fn() });
  expect(screen.queryByRole("button", { name: /archiver la carte/i })).toBeNull();
});

test("« Archiver » demande confirmation : « Annuler » ne fait rien, « Archiver » archive une fois", async () => {
  const onArchive = vi.fn();
  monter(true, { inDoneColumn: true, onArchive });

  fireEvent.click(screen.getByRole("button", { name: "Archiver la carte Commander le plan de travail" }));
  let confirmation = await screen.findByRole("dialog");
  fireEvent.click(within(confirmation).getByRole("button", { name: "Annuler" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onArchive).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Archiver la carte Commander le plan de travail" }));
  confirmation = await screen.findByRole("dialog");
  fireEvent.click(within(confirmation).getByRole("button", { name: "Archiver" }));
  expect(onArchive).toHaveBeenCalledTimes(1);
  expect(onArchive).toHaveBeenCalledWith("c1");
});
