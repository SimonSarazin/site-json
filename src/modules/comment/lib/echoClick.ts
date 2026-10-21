/**
 * L'ÉCHO d'un double clic.
 *
 * Un clic qui fait apparaître ou disparaître une surface — une modale qui s'ouvre, qui se ferme —
 * change ce qu'il y a SOUS le curseur. Qui double-clique par habitude envoie alors son second
 * appui à autre chose que ce qu'il visait : le voile de la modale tout juste ouverte (elle se
 * referme aussitôt), une rangée venue sous le curseur, un bouton de la page que la modale
 * couvrait. Mesuré au navigateur le 13/10 : douze doubles clics sur douze refermaient la modale.
 *
 * `swallowEchoClick` avale ce second appui pendant une courte fenêtre. Il écoute en CAPTURE sur le
 * document : avant React, et avant les couches de Radix, qui ne voient rien passer.
 *
 *   - avec un POINT (là où l'on vient de cliquer) : tout appui à cet endroit, à quelques pixels près ;
 *   - sans point (on ne sait pas d'où la surface a été ouverte) : les événements de souris que le
 *     navigateur compte lui-même comme la suite d'un clic (`detail > 1`), et ceux de pointeur, qui
 *     ne portent pas ce compte. Un premier clic (`detail` à 1) passe donc toujours.
 *
 * Une activation au clavier a un `detail` nul et n'est jamais un écho. Rend de quoi désarmer avant
 * terme ; sinon la fenêtre se referme seule.
 */
export const ECHO_WINDOW_MS = 400;
export const ECHO_RADIUS_PX = 12;

const TYPES = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"] as const;

export interface EchoPoint {
  readonly clientX: number;
  readonly clientY: number;
}

export function swallowEchoClick(point?: EchoPoint | null): () => void {
  if (typeof document === "undefined") return () => undefined;

  const estUnEcho = (event: MouseEvent): boolean => {
    if (point) return Math.hypot(event.clientX - point.clientX, event.clientY - point.clientY) <= ECHO_RADIUS_PX;
    return event.type.startsWith("pointer") || event.detail > 1;
  };
  const avaler = (event: Event) => {
    if (!estUnEcho(event as MouseEvent)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  TYPES.forEach(type => document.addEventListener(type, avaler, true));
  const retirer = () => TYPES.forEach(type => document.removeEventListener(type, avaler, true));
  const terme = setTimeout(retirer, ECHO_WINDOW_MS);
  return () => {
    clearTimeout(terme);
    retirer();
  };
}
