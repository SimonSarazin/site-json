// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { useRailCollapse } from "./useRailCollapse";

/**
 * Les trois zones de largeur du panneau, et ce que chacune autorise.
 *
 * Ce hook n'avait aucun test, et c'est ce qui a laissé passer un défaut complet : la préférence
 * de pli vivant dans `localStorage`, un rail replié sur un écran de bureau suivait l'utilisateur
 * sur son téléphone — où le rail est pourtant la SEULE colonne affichée. Mesuré au navigateur
 * avant correction : 56 px de contenu sur un écran de 390 px, titre de colonne masqué, et le
 * bouton qui aurait déplié rendu `disabled`. Aucune issue.
 *
 * jsdom rend `width: 0` pour tout élément : on fournit donc la largeur nous-mêmes, ce qui est
 * exactement ce que le hook lit. `getComputedStyle(documentElement).fontSize` y étant vide,
 * `parseFloat` rend `NaN` et le repli `|| 16` s'applique — 1 rem vaut donc 16 px ici.
 */
const REM = 16;
const panneauDe = (px: number) =>
  ({ getBoundingClientRect: () => ({ width: px }) }) as unknown as HTMLElement;

/** Monte le hook et le place à une largeur donnée, comme le ferait la callback ref. */
function aLaLargeur(px: number) {
  const rendu = renderHook(() => useRailCollapse());
  act(() => { rendu.result.current.measureRef(panneauDe(px)); });
  return rendu;
}

beforeEach(() => {
  localStorage.clear();
});

describe("useRailCollapse — les trois zones", () => {
  it("sous 48 rem, une seule colonne : jamais plié, et aucun bouton à proposer", () => {
    const { result } = aLaLargeur(40 * REM);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.canToggle).toBe(false);
  });

  it("entre 48 et 64 rem, le pli est imposé et le bouton serait sans effet", () => {
    const { result } = aLaLargeur(56 * REM);
    expect(result.current.collapsed).toBe(true);
    expect(result.current.canToggle).toBe(false);
  });

  it("au-delà de 64 rem, le pli est libre et c'est la préférence qui décide", () => {
    const { result } = aLaLargeur(80 * REM);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.canToggle).toBe(true);
  });
});

describe("useRailCollapse — la préférence", () => {
  it("replie au-delà de 64 rem", () => {
    localStorage.setItem("comment.panel.rail", "collapsed");
    const { result } = aLaLargeur(80 * REM);
    expect(result.current.collapsed).toBe(true);
    expect(result.current.attribute).toBe("collapsed");
  });

  /**
   * Le cas qui a mordu : la préférence posée sur un grand écran, retrouvée sur un téléphone.
   * Elle ne doit plus replier — mais elle reste INTACTE, et `attribute` continue de la dire :
   * c'est le CSS qui la borne par largeur, parce qu'il est juste dès le premier octet là où la
   * mesure JS n'existe ni au rendu serveur ni au premier rendu client.
   */
  it("ne replie PAS sous 48 rem, tout en gardant la préférence intacte", () => {
    localStorage.setItem("comment.panel.rail", "collapsed");
    const { result } = aLaLargeur(24 * REM);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.canToggle).toBe(false);
    expect(result.current.attribute).toBe("collapsed");
    expect(localStorage.getItem("comment.panel.rail")).toBe("collapsed");
  });

  it("une préférence « déplié » ne défait pas le pli imposé par la largeur", () => {
    localStorage.setItem("comment.panel.rail", "expanded");
    const { result } = aLaLargeur(56 * REM);
    expect(result.current.collapsed).toBe(true);
  });

  it("la bascule écrit la préférence et se reflète aussitôt", () => {
    const { result } = aLaLargeur(80 * REM);
    act(() => { result.current.toggle(); });
    expect(localStorage.getItem("comment.panel.rail")).toBe("collapsed");
    expect(result.current.collapsed).toBe(true);
    act(() => { result.current.toggle(); });
    expect(result.current.collapsed).toBe(false);
  });
});

describe("useRailCollapse — la mesure", () => {
  it("ne conclut rien d'un panneau pas encore disposé", () => {
    localStorage.setItem("comment.panel.rail", "collapsed");
    const rendu = renderHook(() => useRailCollapse());
    // Avant toute mesure utile, la zone par défaut est « libre » : la préférence s'applique.
    act(() => { rendu.result.current.measureRef(panneauDe(0)); });
    expect(rendu.result.current.collapsed).toBe(true);
    // Puis la vraie largeur arrive, et elle seule décide.
    act(() => { rendu.result.current.measureRef(panneauDe(30 * REM)); });
    expect(rendu.result.current.collapsed).toBe(false);
  });
});
