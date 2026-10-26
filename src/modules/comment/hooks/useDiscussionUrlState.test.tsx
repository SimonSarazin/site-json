// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { useDiscussionUrlState, type DiscussionUrlState } from "./useDiscussionUrlState";

/**
 * L'URL est la source de vérité du panneau.
 *
 * Ce que cette suite garantit, et qui ne se voit pas à la lecture du composant :
 *   - la sélection est DÉRIVÉE de l'URL à chaque rendu, donc un retour arrière du navigateur
 *     la met à jour sans qu'aucun effet n'ait à la recopier ;
 *   - ouvrir et fermer EMPILENT une entrée d'historique, les changements internes la
 *     REMPLACENT — c'est ce qui donne la navigation à trois niveaux au bouton retour ;
 *   - deux écritures rapprochées ne s'écrasent pas (fonction de mise à jour, pas instantané).
 *
 * Deux précautions de banc d'essai, apprises en écrivant ces tests :
 *   - `MemoryRouter` tient son historique EN INTERNE. `window.history.back()` ne l'atteint pas :
 *     un test qui l'emploierait passerait sans rien prouver. On recule par `useNavigate(-1)`,
 *     qui parle bien à CET historique ;
 *   - on ne recopie rien dans une variable externe depuis le rendu (c'est un effet de bord, que
 *     `react-hooks/globals` refuse à juste titre) : `renderHook` rend d'un coup l'état, la
 *     navigation et l'URL courante.
 */

const ORG = "65a1000000000000000000a1";
const PROJ = "65a1000000000000000000a2";

interface Banc {
  readonly etat: () => DiscussionUrlState;
  readonly url: () => string;
  readonly reculer: () => Promise<void>;
}

function monter(url = "/discussions", param?: string): Banc {
  const { result } = renderHook(
    () => ({
      etat: useDiscussionUrlState({ param }),
      naviguer: useNavigate(),
      location: useLocation(),
    }),
    { wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter> },
  );
  return {
    etat: () => result.current.etat,
    url: () => result.current.location.search + result.current.location.hash,
    reculer: async () => { await act(async () => { result.current.naviguer(-1); }); },
  };
}

describe("lecture de l'URL", () => {
  it("rend « none » quand le paramètre est absent", () => {
    const b = monter();
    expect(b.etat().selection.kind).toBe("none");
    expect(b.etat().isOpen).toBe(false);
  });

  it("lit un porteur", () => {
    const b = monter(`/discussions?discussion=@organizations:${ORG}`);
    expect(b.etat().selection).toEqual({ kind: "holder", type: "organizations", id: ORG });
    expect(b.etat().isOpen).toBe(true);
  });

  it("lit un fil, avec son `path`", () => {
    const b = monter(`/discussions?discussion=forms:${ORG}:etape.question_a.comment`);
    expect(b.etat().selection).toEqual({
      kind: "thread", target: { type: "forms", id: ORG, path: "etape.question_a.comment" },
    });
  });

  it("lit le message visé dans le FRAGMENT, pas dans la requête", () => {
    const b = monter(`/discussions?discussion=organizations:${ORG}#m-${PROJ}`);
    expect(b.etat().messageId).toBe(PROJ);
  });

  it("ignore un fragment qui n'est pas un message", () => {
    const b = monter(`/discussions?discussion=organizations:${ORG}#section-2`);
    expect(b.etat().messageId).toBeNull();
  });

  it("retombe sur « none » devant une valeur hostile, au lieu de lever", () => {
    for (const valeur of ["../../etc", "organizations:pas-un-id", "%00", "organizations", "@news:" + ORG]) {
      const b = monter(`/discussions?discussion=${encodeURIComponent(valeur)}`);
      expect(b.etat().selection.kind).toBe("none");
    }
  });

  it("honore un nom de paramètre différent, configurable par site", () => {
    const b = monter(`/discussions?fil=@projects:${PROJ}`, "fil");
    expect(b.etat().selection).toEqual({ kind: "holder", type: "projects", id: PROJ });
  });

  it("ignore le paramètre par défaut quand un autre nom est configuré", () => {
    const b = monter(`/discussions?discussion=@projects:${PROJ}`, "fil");
    expect(b.etat().selection.kind).toBe("none");
  });
});

describe("écriture dans l'URL", () => {
  it("`open` écrit la sélection", () => {
    const b = monter();
    act(() => b.etat().open({ kind: "holder", type: "organizations", id: ORG }));
    expect(b.url()).toContain(`discussion=%40organizations%3A${ORG}`);
    expect(b.etat().selection).toEqual({ kind: "holder", type: "organizations", id: ORG });
  });

  it("`close` retire le paramètre au lieu de le vider", () => {
    const b = monter(`/discussions?discussion=@organizations:${ORG}`);
    act(() => b.etat().close());
    expect(b.url()).not.toContain("discussion");
    expect(b.etat().selection.kind).toBe("none");
  });

  it("conserve les AUTRES paramètres de l'URL", () => {
    const b = monter("/discussions?page=2&tri=recent");
    act(() => b.etat().select({ kind: "thread", target: { type: "news", id: ORG, path: null } }));
    expect(b.url()).toContain("page=2");
    expect(b.url()).toContain("tri=recent");
  });

  it("deux écritures rapprochées ne s'écrasent pas", () => {
    // Le piège : partir de l'objet `searchParams` capturé au rendu ferait perdre la première
    // écriture. C'est pour cela que le hook passe une FONCTION de mise à jour.
    const b = monter();
    act(() => {
      b.etat().select({ kind: "holder", type: "organizations", id: ORG });
      b.etat().select({ kind: "thread", target: { type: "news", id: PROJ, path: null } });
    });
    expect(b.etat().selection).toEqual({ kind: "thread", target: { type: "news", id: PROJ, path: null } });
  });

  it("le RETOUR arrière remet la sélection précédente — sans aucun effet pour la recopier", async () => {
    const b = monter();
    act(() => b.etat().open({ kind: "holder", type: "organizations", id: ORG }));
    expect(b.etat().selection.kind).toBe("holder");

    await b.reculer();
    expect(b.etat().selection.kind).toBe("none");
  });

  it("`select` REMPLACE l'entrée : un seul retour ramène avant l'ouverture", async () => {
    const b = monter();
    act(() => b.etat().open({ kind: "holder", type: "organizations", id: ORG }));   // empile
    act(() => b.etat().select({ kind: "holder", type: "projects", id: PROJ }));     // remplace
    expect(b.etat().selection).toEqual({ kind: "holder", type: "projects", id: PROJ });

    await b.reculer();
    // Si `select` avait empilé, on reviendrait sur l'organisation et non hors du panneau.
    expect(b.etat().selection.kind).toBe("none");
  });

  it("`close` empile, pour que « retour » ROUVRE le panneau", async () => {
    const b = monter();
    act(() => b.etat().open({ kind: "holder", type: "organizations", id: ORG }));
    act(() => b.etat().close());
    expect(b.etat().selection.kind).toBe("none");

    // C'est l'écart assumé sur l'historique : fermer empile, donc revenir en arrière ROUVRE.
    // Sur mobile, le bouton retour parcourt ainsi message → fil → fermeture.
    await b.reculer();
    expect(b.etat().selection).toEqual({ kind: "holder", type: "organizations", id: ORG });
  });
});
