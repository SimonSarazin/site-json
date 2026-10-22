// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ECHO_RADIUS_PX, ECHO_WINDOW_MS, swallowEchoClick } from "./echoClick";

/**
 * L'écho d'un double clic : le second appui, qui suit de près un clic ayant changé ce qu'il y a
 * sous le curseur. Ce qu'on tient ici : CE qui est avalé (et seulement cela), pendant combien de
 * temps, et que rien ne reste accroché au document ensuite.
 */

/** Envoie un événement à `cible` et dit ce qu'il est devenu. */
function envoie(type: string, init: MouseEventInit = {}, cible: Element = document.body) {
  const recu = vi.fn();
  cible.addEventListener(type, recu);
  const Classe = type.startsWith("pointer") && typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent;
  const event = new Classe(type, { bubbles: true, cancelable: true, ...init });
  cible.dispatchEvent(event);
  cible.removeEventListener(type, recu);
  return { arrive: recu.mock.calls.length === 1, annule: event.defaultPrevented };
}
const AVALE = { arrive: false, annule: true };
const PASSE = { arrive: true, annule: false };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("swallowEchoClick — sans point (on ne sait pas d'où la surface a été ouverte)", () => {
  it("avale les événements de souris que le navigateur compte comme la SUITE d'un clic", () => {
    const desarmer = swallowEchoClick();
    for (const type of ["mousedown", "mouseup", "click", "dblclick"]) {
      expect(envoie(type, { detail: 2 })).toEqual(AVALE);
      expect(envoie(type, { detail: 3 })).toEqual(AVALE);
    }
    desarmer();
  });

  it("laisse passer un PREMIER clic, et une activation au clavier (`detail` nul)", () => {
    const desarmer = swallowEchoClick();
    for (const type of ["mousedown", "mouseup", "click"]) {
      expect(envoie(type, { detail: 1 })).toEqual(PASSE);
      expect(envoie(type, { detail: 0 })).toEqual(PASSE);
    }
    desarmer();
  });

  it("avale les événements de pointeur, qui ne portent pas ce compte", () => {
    const desarmer = swallowEchoClick();
    expect(envoie("pointerdown")).toEqual(AVALE);
    expect(envoie("pointerup")).toEqual(AVALE);
    desarmer();
  });

  it("ne touche à rien d'autre : ni le survol, ni le clavier", () => {
    const desarmer = swallowEchoClick();
    expect(envoie("pointermove")).toEqual(PASSE);
    expect(envoie("mousemove", { detail: 2 })).toEqual(PASSE);
    const touche = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    document.body.dispatchEvent(touche);
    expect(touche.defaultPrevented).toBe(false);
    desarmer();
  });

  it("l'événement avalé n'atteint ni sa cible ni ce qui écoute plus haut — il est arrêté au document, en capture", () => {
    const cible = document.createElement("button");
    document.body.append(cible);
    const plusHaut = vi.fn();
    document.body.addEventListener("click", plusHaut);
    const desarmer = swallowEchoClick();
    expect(envoie("click", { detail: 2 }, cible)).toEqual(AVALE);
    expect(plusHaut).not.toHaveBeenCalled();
    desarmer();
    document.body.removeEventListener("click", plusHaut);
    cible.remove();
  });
});

describe("swallowEchoClick — avec le point où l'on vient de cliquer", () => {
  const POINT = { clientX: 400, clientY: 120 };

  it("avale tout appui à cet endroit, quel que soit son compte", () => {
    const desarmer = swallowEchoClick(POINT);
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"]) {
      expect(envoie(type, { ...POINT, detail: 1 })).toEqual(AVALE);
      expect(envoie(type, { ...POINT, detail: 2 })).toEqual(AVALE);
    }
    desarmer();
  });

  it("à quelques pixels près : jusqu'au rayon, pas au-delà", () => {
    const desarmer = swallowEchoClick(POINT);
    expect(envoie("click", { clientX: POINT.clientX + ECHO_RADIUS_PX, clientY: POINT.clientY, detail: 2 })).toEqual(AVALE);
    expect(envoie("click", { clientX: POINT.clientX, clientY: POINT.clientY - ECHO_RADIUS_PX, detail: 2 })).toEqual(AVALE);
    expect(envoie("click", { clientX: POINT.clientX + ECHO_RADIUS_PX + 1, clientY: POINT.clientY, detail: 2 })).toEqual(PASSE);
    // En diagonale, c'est la DISTANCE qui compte : 9 et 9 font plus de 12.
    expect(envoie("click", { clientX: POINT.clientX + 9, clientY: POINT.clientY + 9, detail: 2 })).toEqual(PASSE);
    desarmer();
  });

  it("ailleurs, tout passe — même la suite d'un double clic, même un appui de pointeur", () => {
    const desarmer = swallowEchoClick(POINT);
    expect(envoie("click", { clientX: 40, clientY: 600, detail: 2 })).toEqual(PASSE);
    expect(envoie("pointerdown", { clientX: 40, clientY: 600 })).toEqual(PASSE);
    desarmer();
  });
});

describe("swallowEchoClick — la fenêtre", () => {
  it("se referme seule : juste avant son terme elle avale encore, à son terme plus rien", () => {
    swallowEchoClick();
    vi.advanceTimersByTime(ECHO_WINDOW_MS - 1);
    expect(envoie("click", { detail: 2 })).toEqual(AVALE);
    vi.advanceTimersByTime(1);
    expect(envoie("click", { detail: 2 })).toEqual(PASSE);
    expect(envoie("pointerdown")).toEqual(PASSE);
  });

  it("dure moins qu'un double clic lent ne sépare deux gestes voulus (400 ms)", () => {
    expect(ECHO_WINDOW_MS).toBe(400);
  });

  it("se désarme avant terme, et le terme n'y revient pas", () => {
    const desarmer = swallowEchoClick();
    desarmer();
    expect(envoie("click", { detail: 2 })).toEqual(PASSE);
    expect(vi.getTimerCount()).toBe(0);
    desarmer();
  });

  it("deux gardes armées ne se gênent pas : désarmer l'une laisse l'autre", () => {
    const premiere = swallowEchoClick();
    swallowEchoClick({ clientX: 10, clientY: 10 });
    premiere();
    expect(envoie("click", { clientX: 10, clientY: 10, detail: 1 })).toEqual(AVALE);
    expect(envoie("click", { clientX: 300, clientY: 300, detail: 2 })).toEqual(PASSE);
    vi.advanceTimersByTime(ECHO_WINDOW_MS);
    expect(envoie("click", { clientX: 10, clientY: 10, detail: 1 })).toEqual(PASSE);
  });

  it("ne laisse aucun écouteur sur le document", () => {
    const ajout = vi.spyOn(document, "addEventListener");
    const retrait = vi.spyOn(document, "removeEventListener");
    const desarmer = swallowEchoClick();
    const poses = ajout.mock.calls.map(([type, , capture]) => `${type}:${String(capture)}`).sort();
    expect(poses).toEqual(["click:true", "dblclick:true", "mousedown:true", "mouseup:true", "pointerdown:true", "pointerup:true"]);
    desarmer();
    expect(retrait.mock.calls.map(([type, , capture]) => `${type}:${String(capture)}`).sort()).toEqual(poses);
    ajout.mockRestore();
    retrait.mockRestore();
  });
});
