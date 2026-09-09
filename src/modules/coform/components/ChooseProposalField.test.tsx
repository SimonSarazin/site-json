// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FormFieldMapping } from "../types";

/**
 * Ce champ décide de la publication d'une candidature dans l'annuaire, et son
 * scope est le CONTEXTE (l'organisation porteuse de l'appel — le parent du
 * formulaire, reçu en prop), pas l'évaluateur. Les tests portent donc surtout
 * sur l'isolation : ce qui est écrit ne doit toucher qu'un contexte, et le bon.
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

const ctxMock = vi.fn();
vi.mock("@/hooks/useCocolight", () => ({
  useCocolightOptional: () => ctxMock(),
}));

const saveMutate = vi.fn();
vi.mock("../actions/mutations/selection", () => ({
  useSaveChooseProposal: () => ({ mutate: saveMutate }),
}));

const { ChooseProposalField } = await import("./ChooseProposalField");

const champ = (): FormFieldMapping =>
  ({
    name: "choose",
    label: "Sélectionné pour l'afficher dans le 'directory'",
    type: "tpls.forms.aap.chooseProposal",
    componentType: "chooseProposal",
    isRequired: false,
  }) as unknown as FormFieldMapping;

/** Cas réel : trois contextes, deux retenus. */
const TROIS = {
  ctxA: { value: "selected", type: "organizations", name: "Costum A" },
  ctxB: { value: "notselected", type: "organizations", name: "Costum B" },
  ctxC: { value: "selected", type: "projects", name: "Costum C" },
};

/** Le parent du formulaire de l'appel — ce que `resolveChooseContext` rend. */
const CONTEXTE_A = { id: "ctxA", type: "organizations", name: "Costum A" };
const CONTEXTE_B = { id: "ctxB", type: "organizations", name: "Costum B" };

function poser(over: Partial<Parameters<typeof ChooseProposalField>[0]> = {}) {
  return render(
    <ChooseProposalField
      field={champ()}
      subFormId="aapStep2"
      formId="form-1"
      value={TROIS}
      context={CONTEXTE_A}
      answerId="answer-1"
      {...over}
    />
  );
}

// Second argument : les options `mutate` — c'est là que ces champs branchent
// leur écho local (cf. `useEcrituresLocales`). L'assertion porte sur le PAYLOAD ;
// figer l'arité ferait échouer le test pour une raison qui n'est pas la sienne.
describe("ChooseProposalField", () => {
  beforeEach(() => {
    saveMutate.mockReset();
    // Le costum du site : son `contextId` ne doit JAMAIS servir de clé.
    ctxMock.mockReturnValue({
      api: {},
      entity: { name: "Costum du site" },
      contextId: "ctxSite",
      contextType: "organizations",
    });
  });

  it("ne rend RIEN sans réponse enregistrée", () => {
    const { container } = poser({ answerId: undefined });
    expect(container.firstChild).toBeNull();
  });

  it("ne rend RIEN sans contexte explicite — même si le costum en a un", () => {
    // On ne saurait pas sous quelle clé écrire ; se tromper publierait la
    // candidature dans le mauvais annuaire. Le `contextId` du costum n'est PAS
    // un repli acceptable : ce n'est pas la clé que l'annuaire lit.
    const { container } = poser({ context: null });
    expect(container.firstChild).toBeNull();
  });

  it("reflète l'état DU CONTEXTE COURANT, pas celui des autres", () => {
    poser();
    const [oui, non] = screen.getAllByRole("radio");
    expect(oui.getAttribute("aria-checked")).toBe("true");
    expect(non.getAttribute("aria-checked")).toBe("false");
  });

  it("un contexte non retenu s'affiche bien comme non retenu", () => {
    poser({ context: CONTEXTE_B });
    const [oui] = screen.getAllByRole("radio");
    expect(oui.getAttribute("aria-checked")).toBe("false");
  });

  it("écrit au chemin du SEUL contexte courant", () => {
    poser({ context: CONTEXTE_B });
    fireEvent.click(screen.getAllByRole("radio")[0]); // « Oui »
    expect(saveMutate).toHaveBeenCalledWith(
      {
        subFormId: "aapStep2",
        contextId: "ctxB",
        entry: { value: "selected", type: "organizations", name: "Costum B" },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  /**
   * Régression (M31) : le champ écrivait sous `cocolight.contextId` — l'entité
   * résolue depuis le slug du site — alors que l'annuaire AAC filtre sur
   * `choose.<1re clé de form.parent>`. Sur un formulaire porté par un autre
   * parent que l'entité du site, le toast annonçait l'enregistrement, la base
   * recevait `choose.<site>`, et le commun restait « En attente » dans
   * l'annuaire, indéfiniment. Même règle que `CommunSelectionControl`.
   */
  it("écrit sous le contexte du FORMULAIRE, jamais sous celui du costum du site", () => {
    poser({ context: CONTEXTE_B });
    fireEvent.click(screen.getAllByRole("radio")[0]); // « Oui »
    const [vars] = saveMutate.mock.calls[0] as [{ contextId: string; entry: { name: string } }];
    expect(vars.contextId).toBe("ctxB");
    expect(vars.contextId).not.toBe("ctxSite");
    // Le nom vient de la même entrée que la clé, pas de l'entité du site.
    expect(vars.entry.name).toBe("Costum B");
  });

  it("un parent sans nom (legacy `moveFormToParent`) reprend le nom du dernier choix", () => {
    poser({ context: { id: "ctxA", type: "organizations", name: null } });
    expect(screen.getByText(/Contexte : Costum A/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("radio")[1]); // « Non »
    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        contextId: "ctxA",
        entry: { value: "notselected", type: "organizations", name: "Costum A" },
      }),
      expect.anything()
    );
  });

  /**
   * Régression : le champ affichait encore l'ANCIEN choix après un
   * enregistrement réussi.
   *
   * Sa valeur vient de l'instantané du formulaire — `stepState.stepsData` du
   * wizard, initialisé une seule fois — qui n'est jamais resynchronisé. Le clic
   * partait bien au serveur et le toast annonçait le succès, mais le bouton ne
   * bougeait pas : « j'ai cliqué, rien ne change ».
   *
   * Le test rejoue la vraie séquence — mutation qui réussit, puis lecture de
   * l'affichage — et laisse délibérément `value` sur son état d'origine : c'est
   * exactement ce que le formulaire continue de fournir.
   */
  it("affiche le nouveau choix une fois l'enregistrement RÉUSSI", () => {
    // Le serveur répond OK : on déclenche le `onSuccess` que le champ a branché.
    saveMutate.mockImplementation((vars, opts) => opts?.onSuccess?.(undefined, vars));

    poser({ context: CONTEXTE_B });
    const [oui, non] = screen.getAllByRole("radio");
    expect(oui.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(oui);
    expect(oui.getAttribute("aria-checked")).toBe("true");
    expect(non.getAttribute("aria-checked")).toBe("false");
  });

  it("un enregistrement en ÉCHEC laisse le choix réel affiché", () => {
    // Le serveur refuse : `onSuccess` ne tire pas. Le bouton ne doit pas mentir.
    saveMutate.mockImplementation(() => {});

    poser({ context: CONTEXTE_B });
    const [oui] = screen.getAllByRole("radio");
    fireEvent.click(oui);
    expect(oui.getAttribute("aria-checked")).toBe("false");
  });

  it("retirer le choix écrit `notselected`, ne supprime pas la clé", () => {
    poser();
    fireEvent.click(screen.getAllByRole("radio")[1]); // « Non »
    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ entry: expect.objectContaining({ value: "notselected" }) }),
      expect.anything()
    );
  });

  it("n'écrit rien si on reclique sur le choix déjà en place", () => {
    poser();
    fireEvent.click(screen.getAllByRole("radio")[0]); // déjà « Oui »
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("signale les AUTRES costums qui ont retenu la candidature", () => {
    // Le legacy ne le dit pas : on croit décider pour tout le monde.
    poser();
    expect(screen.getByText(/Également retenu par : Costum C/)).toBeTruthy();
    expect(screen.queryByText(/Costum B/)).toBeNull(); // non retenu → pas listé
  });

  it("affiche le contexte quand la candidature est retenue", () => {
    poser();
    expect(screen.getByText(/Contexte : Costum A/)).toBeTruthy();
  });

  it("masque le contexte quand elle ne l'est pas — comme le legacy", () => {
    // Sur « Non » il n'y a pas de publication à rattacher : le legacy masque
    // la ligne (`$(".contextName").hide()`). Cas séparé du précédent : deux
    // `render()` dans un même `it` laisseraient les deux arbres dans le DOM.
    poser({ context: CONTEXTE_B });
    expect(screen.queryByText(/Contexte :/)).toBeNull();
  });

  it("en lecture seule : aucune écriture", () => {
    poser({ readOnly: true });
    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(saveMutate).not.toHaveBeenCalled();
  });
});
