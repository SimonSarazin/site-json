// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../tests/test-utils-ui";

/**
 * Création d'un ampli — la garde CLIENT contre la collision de slug est l'enjeu :
 * le legacy écraserait l'ampli existant sans prévenir. L'appel SDK, lui, est
 * testé dans `hooks/useAmpliAdmin.test.tsx`.
 */

const mutate = vi.fn();
vi.mock("../hooks/useAmpliAdmin", () => ({
  useCreateAmpli: () => ({ mutate, isPending: false }),
}));

const { AmpliCreateDialog } = await import("./AmpliCreateDialog");

/**
 * Les identifiants PRIS, tels que `costumAmpliSlugs` les lit : la clé de chaque
 * entrée et son champ `slug`. `vieil-ampli` est la clé d'une entrée incomplète,
 * que la liste affichable ne contient pas — c'est tout l'enjeu de la garde.
 */
const PRIS = ["idees-d-ete", "vieil-ampli"];

const onCreated = vi.fn();

/** Le parent porte l'ouverture : c'est lui qui la referme au succès. */
function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        rouvrir
      </button>
      <AmpliCreateDialog takenSlugs={PRIS} open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  );
}

const render = () => renderWithProviders(<Harness />);
const nameInput = () => screen.getByLabelText("Nom de l'ampli");
const submit = () => screen.getByRole("button", { name: "Créer l'ampli" });

describe("AmpliCreateDialog", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    mutate.mockReset();
    onCreated.mockReset();
  });

  it("montre l'identifiant que le serveur dérivera du nom", async () => {
    render();

    await userEvent.type(nameInput(), "Idées pour la ville");

    expect(screen.getByText("Identifiant : idees-pour-la-ville")).toBeInTheDocument();
  });

  it("refuse un nom dont l'identifiant est déjà pris", async () => {
    render();

    await userEvent.type(nameInput(), "idées d'été");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Un ampli porte déjà l'identifiant « idees-d-ete »",
    );
    expect(submit()).toBeDisabled();

    await userEvent.click(submit());
    expect(mutate).not.toHaveBeenCalled();
  });

  // Le serveur écrase une entrée de même clé SANS PRÉVENIR, y compris une entrée
  // que le site ne sait pas afficher (ni `coform` ni `path`) : la garde porte sur
  // les identifiants en base, pas sur la liste affichée.
  it("refuse aussi l'identifiant d'une entrée que la liste n'affiche pas", async () => {
    render();

    await userEvent.type(nameInput(), "Vieil Ampli");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Un ampli porte déjà l'identifiant « vieil-ampli »",
    );
    expect(submit()).toBeDisabled();
  });

  it("refuse un nom qui ne donne aucun identifiant", async () => {
    render();

    await userEvent.type(nameInput(), "!!!");

    expect(screen.getByRole("alert")).toHaveTextContent("aucun identifiant utilisable");
    expect(submit()).toBeDisabled();
  });

  it("n'envoie rien tant que le nom est vide", () => {
    render();

    expect(submit()).toBeDisabled();
  });

  it("envoie le brouillon, mots-clés découpés sur les virgules", async () => {
    mutate.mockImplementation((_draft, { onSuccess }) => onSuccess({ slug: "idees-du-quartier" }));
    render();

    await userEvent.type(nameInput(), "Idées du quartier");
    await userEvent.type(screen.getByLabelText("Description"), "Ce qu'on veut changer");
    await userEvent.type(screen.getByLabelText("Mots-clés"), " urbanisme , , mobilité ");
    await userEvent.click(submit());

    expect(mutate).toHaveBeenCalledWith(
      {
        name: "Idées du quartier",
        description: "Ce qu'on veut changer",
        tags: ["urbanisme", "mobilité"],
      },
      expect.anything(),
    );
    expect(onCreated).toHaveBeenCalledWith("idees-du-quartier");
  });

  it("oublie la saisie quand on referme sans créer", async () => {
    render();

    await userEvent.type(nameInput(), "Idées du quartier");
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    await userEvent.click(screen.getByRole("button", { name: "rouvrir" }));

    expect(nameInput()).toHaveValue("");
  });
});
