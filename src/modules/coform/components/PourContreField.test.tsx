// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FormFieldMapping } from "../types";

/**
 * Comme `SelectionField`, ce champ n'a ni `value` RHF ni entrée au schéma : ce
 * qui compte est *ce qui part au serveur*, et à quel chemin.
 *
 * S'y ajoute la restitution des comptes, où le legacy se trompe (parts
 * multipliées, vote personnel écrasé) — d'où des assertions sur l'affichage.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
      base
    );
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const meMock = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolightOptional: () => ({ api: {}, entity: null, me: meMock() }),
}));

const voteMutate = vi.fn();
vi.mock("../actions/mutations/selection", () => ({
  useSaveVote: () => ({ mutate: voteMutate }),
}));

const { PourContreField } = await import("./PourContreField");

const champ = (): FormFieldMapping =>
  ({
    name: "pourContre",
    label: "Votez",
    type: "tpls.forms.ocecoform.pourContre",
    componentType: "pourContre",
    isRequired: false,
  }) as unknown as FormFieldMapping;

function poser(over: Partial<Parameters<typeof PourContreField>[0]> = {}) {
  return render(
    <PourContreField
      field={champ()}
      subFormId="aapStep2"
      formId="form-1"
      value={{ moi: "1", autre1: "1", autre2: "-1" }}
      answerId="answer-1"
      {...over}
    />
  );
}

// Second argument : les options `mutate` — c'est là que ces champs branchent
// leur écho local (cf. `useEcrituresLocales`). L'assertion porte sur le PAYLOAD ;
// figer l'arité ferait échouer le test pour une raison qui n'est pas la sienne.
describe("PourContreField", () => {
  beforeEach(() => {
    voteMutate.mockClear();
    meMock.mockReturnValue({ id: "moi" });
  });

  it("ne rend RIEN sans réponse enregistrée", () => {
    const { container } = poser({ answerId: undefined });
    expect(container.firstChild).toBeNull();
  });

  it("un vote part immédiatement, au chemin de l'évaluateur courant", () => {
    poser({ value: {} });
    // « Contre » apparaît deux fois : le bouton et l'étiquette du décompte.
    fireEvent.click(screen.getByRole("radio", { name: "Contre" }));
    expect(voteMutate).toHaveBeenCalledWith(
      { subFormId: "aapStep2", userId: "moi", vote: "-1" },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it("affiche des parts RÉELLES — le legacy afficherait 600 %", () => {
    // 2 pour sur 3 votants. Le legacy calcule `pour × total × 100`.
    poser();
    expect(screen.getByText("(67%)")).toBeTruthy();
    expect(screen.getByText("(33%)")).toBeTruthy();
    expect(screen.queryByText(/600/)).toBeNull();
  });

  it("retrouve mon vote même quand d'autres suivent dans l'objet", () => {
    // Le legacy écrase son `$myVote` à chaque entrée d'un autre évaluateur :
    // mon vote ne s'affichait que s'il était le dernier parcouru.
    poser();
    expect(screen.getByText(/Merci pour votre vote : Pour/)).toBeTruthy();
  });

  /** Valeur du `<dd>` qui suit l'étiquette `label` dans la grille des comptes. */
  const compte = (label: string) =>
    screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent;

  /**
   * Régression (M27) : `tallyVotes(value)` lisait l'instantané du formulaire,
   * jamais resynchronisé, alors que seul le vote du contrôle était rattrapé.
   * Deux votes en base (1 pour, 1 contre), le juré clique « Pour » : le bouton
   * passait en surbrillance et « Merci pour votre vote » s'affichait, mais la
   * ligne juste en dessous restait sur « Votants 2 · Pour 1 (50 %) » et la
   * barre ne bougeait pas de toute la session.
   *
   * `value` reste délibérément sur son état d'origine : c'est ce que le
   * formulaire continue de fournir après l'enregistrement.
   */
  it("après un vote enregistré, décompte et parts suivent — pas seulement le bouton", () => {
    voteMutate.mockImplementation((vars, opts) => opts?.onSuccess?.(undefined, vars));
    poser({ value: { autre1: "1", autre2: "-1" } });
    expect(compte("Votants")).toBe("2");
    expect(compte("Pour")).toBe("1 (50%)");

    fireEvent.click(screen.getByRole("radio", { name: "Pour" }));

    expect(screen.getByRole("radio", { name: "Pour" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/Merci pour votre vote : Pour/)).toBeTruthy();
    expect(compte("Votants")).toBe("3");
    expect(compte("Pour")).toBe("2 (67%)");
    expect(compte("Contre")).toBe("1 (33%)");
  });

  it("changer son vote déplace le compte, sans compter deux fois", () => {
    voteMutate.mockImplementation((vars, opts) => opts?.onSuccess?.(undefined, vars));
    poser({ value: { moi: "1", autre1: "-1" } });
    fireEvent.click(screen.getByRole("radio", { name: "Contre" }));
    expect(compte("Votants")).toBe("2");
    expect(compte("Pour")).toBe("0 (0%)");
    expect(compte("Contre")).toBe("2 (100%)");
  });

  it("un enregistrement en ÉCHEC laisse le décompte réel", () => {
    voteMutate.mockImplementation(() => {}); // le serveur refuse : pas d'onSuccess
    poser({ value: { autre1: "1", autre2: "-1" } });
    fireEvent.click(screen.getByRole("radio", { name: "Pour" }));
    expect(compte("Votants")).toBe("2");
    expect(screen.queryByText(/Merci pour votre vote/)).toBeNull();
  });

  it("n'annonce pas de vote quand je n'ai pas voté", () => {
    poser({ value: { autre1: "1" } });
    expect(screen.queryByText(/Merci pour votre vote/)).toBeNull();
  });

  it("n'affiche PAS de seuil quand aucun n'est configuré", () => {
    // Le « 50% » du legacy est le repli d'une lecture qui échoue toujours
    // (coquille `$amswer`) : l'afficher inventerait un réglage.
    poser();
    expect(screen.queryByText(/Seuil attendu/)).toBeNull();
  });

  it("affiche le seuil quand il est réellement configuré", () => {
    poser({ inputConfig: { pourContre: { minimumVotes: "70" } } });
    expect(screen.getByText(/Seuil attendu : 70%/)).toBeTruthy();
  });

  it("en lecture seule : les comptes restent, les boutons disparaissent", () => {
    poser({ readOnly: true });
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("(67%)")).toBeTruthy();
  });
});
