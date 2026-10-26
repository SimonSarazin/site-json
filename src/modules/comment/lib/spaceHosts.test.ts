// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { cleanup, render } from "@testing-library/react";
import { declareSpaceHost, spaceHostOf, useSpaceHost } from "./spaceHosts";

/**
 * Une modale par espace et par page : plusieurs écrans se déclarent hôtes du même espace — la fiche
 * d'un commun, le formulaire qu'elle ouvre par-dessus —, un seul la monte.
 */

const ESPACE = "answers:65c3000000000000000000c1";
const AUTRE = "answers:65c3000000000000000000c2";
const retraits: (() => void)[] = [];
const declarer = (space: string, id: string, rank: "page" | "form") => {
  const retirer = declareSpaceHost(space, id, rank);
  retraits.push(retirer);
  return retirer;
};

afterEach(() => {
  while (retraits.length > 0) retraits.pop()!();
  cleanup();
});

describe("spaceHostOf", () => {
  it("sans hôte, personne ; un seul hôte, lui", () => {
    expect(spaceHostOf(ESPACE)).toBeNull();
    declarer(ESPACE, "a", "form");
    expect(spaceHostOf(ESPACE)).toBe("a");
  });

  it("la page passe devant un formulaire posé sur elle, arrivée avant ou après lui", () => {
    declarer(ESPACE, "formulaire", "form");
    declarer(ESPACE, "fiche", "page");
    expect(spaceHostOf(ESPACE)).toBe("fiche");
  });

  it("à rang égal, le premier arrivé", () => {
    declarer(ESPACE, "premier", "form");
    declarer(ESPACE, "second", "form");
    expect(spaceHostOf(ESPACE)).toBe("premier");
  });

  it("l'élu retiré, le suivant prend la main ; tous retirés, personne", () => {
    const retirerFiche = declarer(ESPACE, "fiche", "page");
    declarer(ESPACE, "formulaire", "form");
    retirerFiche();
    expect(spaceHostOf(ESPACE)).toBe("formulaire");
    retraits.pop()!();
    expect(spaceHostOf(ESPACE)).toBeNull();
  });

  it("chaque espace a les siens", () => {
    declarer(ESPACE, "fiche", "page");
    declarer(AUTRE, "formulaire", "form");
    expect(spaceHostOf(ESPACE)).toBe("fiche");
    expect(spaceHostOf(AUTRE)).toBe("formulaire");
  });

  it("un retrait répété ne retire pas un autre hôte", () => {
    const retirer = declarer(ESPACE, "a", "form");
    declarer(ESPACE, "b", "form");
    retirer();
    retirer();
    expect(spaceHostOf(ESPACE)).toBe("b");
  });
});

describe("useSpaceHost", () => {
  function Hote({ id, rank, space = ESPACE }: { id: string; rank: "page" | "form"; space?: string }) {
    return createElement("span", { "data-hote": id }, useSpaceHost(space, rank) ? "élu" : "non");
  }
  const etat = (container: HTMLElement, id: string) => container.querySelector(`[data-hote="${id}"]`)?.textContent;

  it("au serveur, personne n'est hôte : la modale ne s'y rend jamais", () => {
    expect(renderToString(createElement(Hote, { id: "seul", rank: "page" }))).toContain("non");
  });

  it("monté, un hôte seul est élu ; avec la page, le formulaire s'efface — quel que soit l'ordre de montage", () => {
    const { container, rerender } = render(createElement("div", null, createElement(Hote, { id: "formulaire", rank: "form" })));
    expect(etat(container, "formulaire")).toBe("élu");
    rerender(createElement("div", null, createElement(Hote, { key: "f", id: "formulaire", rank: "form" }), createElement(Hote, { key: "p", id: "fiche", rank: "page" })));
    expect(etat(container, "fiche")).toBe("élu");
    expect(etat(container, "formulaire")).toBe("non");
  });

  it("la page démontée, le formulaire reprend la modale", () => {
    const { container, rerender } = render(createElement("div", null,
      createElement(Hote, { key: "f", id: "formulaire", rank: "form" }), createElement(Hote, { key: "p", id: "fiche", rank: "page" })));
    expect(etat(container, "formulaire")).toBe("non");
    rerender(createElement("div", null, createElement(Hote, { key: "f", id: "formulaire", rank: "form" })));
    expect(etat(container, "formulaire")).toBe("élu");
  });

  // La fiche et le formulaire posé sur elle ne se rendent pas ensemble : l'arrivée de l'un ne fait pas
  // rendre l'autre. Le registre doit le PRÉVENIR — deux racines React le montrent sans tricher.
  it("un hôte arrivé ailleurs prévient celui qui était élu ; parti, il le prévient encore", () => {
    const formulaire = render(createElement(Hote, { id: "formulaire", rank: "form" }));
    expect(etat(formulaire.container, "formulaire")).toBe("élu");
    const fiche = render(createElement(Hote, { id: "fiche", rank: "page" }));
    expect(etat(fiche.container, "fiche")).toBe("élu");
    expect(etat(formulaire.container, "formulaire")).toBe("non");
    fiche.unmount();
    expect(etat(formulaire.container, "formulaire")).toBe("élu");
  });
});

