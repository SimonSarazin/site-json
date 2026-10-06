// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

/**
 * « Contributeurs à l'édition » (parité `campDetail.php`, bouton `.aac-tl-canEdit-form`) :
 *  - rien sans le droit au bouton (`canManageEditors` : auteur ou admin) ;
 *  - le dialogue présente l'UNION de `links.canEdit` et de la question déclarée ;
 *  - « Enregistrer » ne s'ouvre que s'il y a quelque chose à écrire — y compris quand les deux
 *    sources divergeaient sans que rien ne change à l'écran.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    return params ? `${base} ${JSON.stringify(params)}` : base;
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const saveMutate = vi.fn();
let enCours = false;
vi.mock("../../hooks/useSaveCommunEditors", () => ({
  useSaveCommunEditors: () => ({ mutate: saveMutate, isPending: enCours }),
}));

// Les avatars se résolvent par le SDK : hors du périmètre de ce composant.
vi.mock("@/modules/coform/hooks/useFinderElementImages", () => ({
  useFinderElementImages: () => ({}),
  mergeResolvedFinderImages: (value: Record<string, unknown> | null) => Object.values(value ?? {}),
}));

// La recherche a ses propres dépendances (debounce, React Query) : on simule une validation.
vi.mock("@/modules/coform/components/FinderSearchModal", () => ({
  FinderSearchModal: (props: {
    config: { type: string; multiple: boolean; notSourceKey: boolean };
    selectedElements: Record<string, unknown>;
    onValidate: (elements: Array<{ id: string; name: string; type: string }>) => void;
    onClose: () => void;
  }) => (
    <div
      data-testid="finder-search-modal"
      data-type={props.config.type}
      data-multiple={String(props.config.multiple)}
      data-global={String(props.config.notSourceKey)}
      data-excluded={Object.keys(props.selectedElements).sort().join(",")}
    >
      <button
        type="button"
        onClick={() => {
          props.onValidate([{ id: D, name: "Dora", type: "citoyens" }]);
          props.onClose();
        }}
      >
        valider-simulé
      </button>
    </div>
  ),
}));

const { CommunEditorsControl } = await import("./CommunEditorsControl");

const A = "5dfa41886908648d3b8b46f6";
const B = "57618d6640bb4ece776308aa";
const C = "64785065919b8815ad72cf94";
const D = "63771a2a2129551c8f4fd9c3";
const FIELD = "finderaapStep1m0w402djpsq3i44017";
const QUESTION = { stepKey: "aapStep1", label: "Référent du commun", fieldName: FIELD, path: `answers.aapStep1.${FIELD}` };

const answer = (canEdit: Record<string, unknown>, referents: Record<string, unknown> | null) => ({
  links: { canEdit },
  answers: { aapStep1: { [FIELD]: referents } },
});
const person = (id: string, name: string) => ({ id, name, type: "citoyens" });

function poser(props: Partial<Parameters<typeof CommunEditorsControl>[0]> = {}) {
  return render(
    <CommunEditorsControl
      api={null}
      canManage
      answerId="6a3e8d99d571dc339040e6bf"
      answer={answer({ [A]: { name: "Alice", type: "citoyens" } }, { [A]: person(A, "Alice") })}
      question={QUESTION}
      {...props}
    />
  );
}

const ouvrir = () => fireEvent.click(screen.getByRole("button", { name: /detail\.editors\.cta/ }));
const liste = () => document.querySelector("[data-commun-editors-list]") as HTMLElement;
const enregistrer = () => screen.getByRole("button", { name: "detail.editors.save" });

beforeEach(() => {
  saveMutate.mockReset();
  enCours = false;
});

describe("CommunEditorsControl", () => {
  it("ne rend rien sans le droit au bouton (auteur ou admin)", () => {
    const { container } = poser({ canManage: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("le bouton affiche le nombre de contributeurs à l'édition", () => {
    poser({ answer: answer({ [A]: { name: "Alice" }, [B]: { name: "Bob" } }, null) });
    expect(screen.getByRole("button", { name: /detail\.editors\.cta/ })).toHaveTextContent("2");
  });

  it("présente l'union des deux sources, et nomme la question liée", () => {
    poser({ answer: answer({ [A]: { name: "Alice", type: "citoyens" } }, { [C]: person(C, "Chloé") }) });
    ouvrir();
    expect(within(liste()).getByText("Alice")).toBeInTheDocument();
    expect(within(liste()).getByText("Chloé")).toBeInTheDocument();
    expect(screen.getByText(/Référent du commun/)).toBeInTheDocument();
  });

  it("sources alignées et liste inchangée : rien à enregistrer", () => {
    poser();
    ouvrir();
    expect(enregistrer()).toBeDisabled();
  });

  /** Le cas réel de la base : les deux listes divergeaient. Enregistrer les réaligne. */
  it("sources divergentes : « Enregistrer » est ouvert sans rien toucher", () => {
    poser({ answer: answer({ [A]: { name: "Alice" } }, { [C]: person(C, "Chloé") }) });
    ouvrir();
    expect(enregistrer()).toBeEnabled();
  });

  it("retirer une personne puis enregistrer envoie la liste sans elle", () => {
    poser({ answer: answer({ [A]: { name: "Alice" }, [B]: { name: "Bob" } }, { [A]: person(A, "Alice"), [B]: person(B, "Bob") }) });
    ouvrir();
    const retraits = within(liste()).getAllByRole("button", { name: "coform.finder.elementCard.removeAria" });
    fireEvent.click(retraits[0]);
    fireEvent.click(enregistrer());
    expect(saveMutate).toHaveBeenCalledTimes(1);
    const { editors } = saveMutate.mock.calls[0][0] as { editors: Record<string, unknown> };
    expect(Object.keys(editors)).toHaveLength(1);
  });

  /** Le succès ferme le dialogue : une retouche faite pendant l'envoi serait perdue sans être écrite. */
  it("pendant l'enregistrement, la liste est figée", () => {
    enCours = true;
    poser({ answer: answer({ [A]: { name: "Alice" }, [B]: { name: "Bob" } }, null) });
    ouvrir();
    expect(screen.getByRole("button", { name: /detail\.editors\.addCta/ })).toBeDisabled();
    // Pas de croix offerte pour rien : le retrait n'est pas proposé tant que l'envoi dure.
    expect(within(liste()).queryAllByRole("button", { name: "coform.finder.elementCard.removeAria" })).toHaveLength(0);
    expect(within(liste()).getByText("Alice")).toBeInTheDocument();
    expect(within(liste()).getByText("Bob")).toBeInTheDocument();
  });

  it("ajouter par le finder : citoyens, recherche globale, déjà listés exclus", () => {
    poser();
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "detail.editors.addCta" }));
    const finder = screen.getByTestId("finder-search-modal");
    expect(finder).toHaveAttribute("data-type", "citoyens");
    expect(finder).toHaveAttribute("data-multiple", "true");
    expect(finder).toHaveAttribute("data-global", "true");
    expect(finder).toHaveAttribute("data-excluded", A);

    fireEvent.click(screen.getByRole("button", { name: "valider-simulé" }));
    expect(within(liste()).getByText("Dora")).toBeInTheDocument();
    fireEvent.click(enregistrer());
    const { editors } = saveMutate.mock.calls[0][0] as { editors: Record<string, { type: string }> };
    expect(Object.keys(editors).sort()).toEqual([A, D].sort());
    expect(editors[D].type).toBe("citoyens");
  });

  it("sans question déclarée, la liste ne vient que de `links.canEdit`", () => {
    poser({ question: null, answer: answer({ [A]: { name: "Alice" } }, { [C]: person(C, "Chloé") }) });
    ouvrir();
    expect(within(liste()).getByText("Alice")).toBeInTheDocument();
    expect(within(liste()).queryByText("Chloé")).not.toBeInTheDocument();
  });
});
