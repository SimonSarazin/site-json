// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { FormEvent, ReactNode, SyntheticEvent } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Modal, ModalContent, ModalDescription, ModalTitle } from "./modal";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

/**
 * Un formulaire dans un dialogue (`Dialog`, `Sheet`, `Modal` — les trois contenus bâtis sur le dialogue
 * Radix) ouvert depuis un AUTRE formulaire ne soumet pas ce dernier.
 *
 * En React, un `submit` remonte l'arbre des COMPOSANTS, portails compris : la modale de création d'un
 * finder coform (rendue sous sa question) soumettait AUSSI le formulaire de dépôt — sa validation
 * partait, ses erreurs s'affichaient derrière. Vu au navigateur le 01/10. Le garde est posé sur le
 * contenu du portail : il vaut pour tout formulaire qu'on y met, pas pour un formulaire en particulier.
 */

const sansRecharger = (e: FormEvent) => e.preventDefault();

const CONTENEURS: ReadonlyArray<readonly [string, (enfant: ReactNode, onSubmit?: (e: SyntheticEvent) => void) => ReactNode]> = [
  ["Dialog", (enfant, onSubmit) => (
    <Dialog open>
      <DialogContent onSubmit={onSubmit}>
        <DialogTitle>Créer</DialogTitle>
        <DialogDescription>Un élément</DialogDescription>
        {enfant}
      </DialogContent>
    </Dialog>
  )],
  ["Sheet", (enfant, onSubmit) => (
    <Sheet open>
      <SheetContent onSubmit={onSubmit}>
        <SheetTitle>Créer</SheetTitle>
        <SheetDescription>Un élément</SheetDescription>
        {enfant}
      </SheetContent>
    </Sheet>
  )],
  ["Modal", (enfant, onSubmit) => (
    <Modal open>
      <ModalContent onSubmit={onSubmit}>
        <ModalTitle>Créer</ModalTitle>
        <ModalDescription>Un élément</ModalDescription>
        {enfant}
      </ModalContent>
    </Modal>
  )],
];

describe.each(CONTENEURS)("%s — soumission d'un formulaire du portail", (_nom, conteneur) => {
  it("soumet le formulaire du portail, jamais celui qui l'a ouvert", async () => {
    const hote = vi.fn(sansRecharger);
    const interne = vi.fn(sansRecharger);
    render(
      <form onSubmit={hote}>
        {conteneur(
          <form onSubmit={interne}>
            <button type="submit">enregistrer</button>
          </form>
        )}
      </form>
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "enregistrer" }));
    expect(interne).toHaveBeenCalledTimes(1);
    expect(hote).not.toHaveBeenCalled();
  });

  it("un bouton `form=\"<id>\"` posé dans le portail soumet toujours le formulaire qu'il désigne", async () => {
    // Le `submit` naît alors sur le formulaire désigné, HORS du portail : le garde n'est pas sur son chemin.
    const hote = vi.fn(sansRecharger);
    render(
      <form id="etape" onSubmit={hote}>
        {conteneur(<button type="submit" form="etape">valider l'étape</button>)}
      </form>
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "valider l'étape" }));
    expect(hote).toHaveBeenCalledTimes(1);
  });

  it("le `onSubmit` posé sur le contenu par l'appelant passe encore — APRÈS l'arrêt de la remontée", async () => {
    const hote = vi.fn(sansRecharger);
    // Arrêt d'abord : une exception dans le gestionnaire de l'appelant ne rouvrirait pas la remontée.
    const surLeContenu = vi.fn((e: SyntheticEvent) => e.isPropagationStopped());
    render(
      <form onSubmit={hote}>
        {conteneur(
          <form onSubmit={sansRecharger}>
            <button type="submit">enregistrer</button>
          </form>,
          surLeContenu
        )}
      </form>
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "enregistrer" }));
    expect(surLeContenu).toHaveBeenCalledTimes(1);
    expect(surLeContenu).toHaveReturnedWith(true);
    expect(hote).not.toHaveBeenCalled();
  });
});
