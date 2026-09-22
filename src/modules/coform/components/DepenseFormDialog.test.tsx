// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { DepenseFormDialog, type DepenseFormValues } from "./DepenseFormDialog";

/**
 * Le dialogue ne persiste rien : il valide et rend les valeurs au champ. Ce qui
 * se teste ici, c'est la VIE de la saisie face aux rendus du parent — et le
 * resemage à la réouverture, que le correctif ne doit pas casser.
 *
 * Sans mock de `useT` : le dialogue apporte lui-même son bundle « modules/coform ».
 */

const LIGNE: DepenseFormValues = { name: "Développement", description: "", targetAmount: 5000 };

function poser(props: Partial<Parameters<typeof DepenseFormDialog>[0]> = {}) {
  const onSubmit = vi.fn();
  const arbre = (p: Partial<Parameters<typeof DepenseFormDialog>[0]>) => (
    <LocalizationProvider>
      <DepenseFormDialog open onOpenChange={() => {}} initial={LIGNE} onSubmit={onSubmit} {...p} />
    </LocalizationProvider>
  );
  const vue = render(arbre(props));
  return { onSubmit, rerender: (p: Partial<Parameters<typeof DepenseFormDialog>[0]> = {}) => vue.rerender(arbre(p)) };
}

describe("DepenseFormDialog", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("part des valeurs de la ligne en modification", () => {
    poser();
    expect((screen.getByLabelText("Intitulé") as HTMLInputElement).value).toBe("Développement");
    expect((screen.getByLabelText("Montant cible") as HTMLInputElement).value).toBe("5000");
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
  });

  /**
   * Régression (M28) : l'effet de resemage dépendait de l'OBJET `initial`, que
   * `MilestoneListField` reconstruit en littéral à chaque rendu — et ce champ se
   * rerend hors de tout geste de l'utilisateur (react-query, `useWatch`).
   * L'utilisateur saisit 6000 ; un refetch arrive ; `form.reset({ … 5000 })`
   * rejoue et le montant repasse à 5000 sous ses doigts, sans message.
   *
   * On rejoue exactement ça : même contenu, AUTRE identité, dialogue ouvert.
   */
  it("un rendu du parent avec un `initial` de même contenu ne touche PAS à la saisie en cours", async () => {
    const { onSubmit, rerender } = poser();
    const montant = screen.getByLabelText("Montant cible") as HTMLInputElement;
    fireEvent.change(montant, { target: { value: "6000" } });
    fireEvent.change(screen.getByLabelText("Intitulé"), { target: { value: "Développement v2" } });

    rerender({ initial: { ...LIGNE } });
    rerender({ initial: { ...LIGNE } });

    expect(montant.value).toBe("6000");
    expect((screen.getByLabelText("Intitulé") as HTMLInputElement).value).toBe("Développement v2");

    // Et c'est bien la saisie qui est rendue au champ, pas la ligne d'origine.
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Développement v2",
      description: "",
      targetAmount: 6000,
    });
  });

  it("rouvert sans démontage sur une AUTRE ligne, repart des valeurs de celle-ci", () => {
    const { rerender } = poser({ open: false });
    expect(screen.queryByLabelText("Intitulé")).toBeNull();

    rerender({ open: true, initial: { name: "Hébergement", description: "Serveur", targetAmount: 300 } });
    expect((screen.getByLabelText("Intitulé") as HTMLInputElement).value).toBe("Hébergement");
    expect((screen.getByLabelText("Montant cible") as HTMLInputElement).value).toBe("300");

    // Fermé puis rouvert en AJOUT : les champs sont vides, pas ceux d'avant.
    rerender({ open: false, initial: undefined });
    rerender({ open: true, initial: undefined });
    expect((screen.getByLabelText("Intitulé") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeTruthy();
  });
});
