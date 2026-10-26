import { useSyncExternalStore, type ComponentType } from "react";
import type { EditorSurfaceProps } from "./EditorSurface";

/**
 * Le chargement de la zone éditable — UNE fois pour l'onglet, côté client seulement.
 *
 * L'éditeur pèse lourd et ne sert qu'à qui écrit : il n'entre ni dans le rendu serveur ni dans le
 * démarrage d'une page. Un magasin de module plutôt qu'un `lazy` sous `Suspense` : au serveur et au
 * premier rendu du client il vaut « pas encore là » — même balisage des deux côtés —, et une fois
 * le code arrivé tout composer monté ensuite le trouve tout de suite, sans repasser par un écran
 * d'attente.
 */

type Surface = ComponentType<EditorSurfaceProps>;

export interface EditorSurfaceSlot {
  readonly surface: Surface | null;
  /** Le code n'a pas pu être chargé : la coquille propose de réessayer. */
  readonly failed: boolean;
}

const VIDE: EditorSurfaceSlot = { surface: null, failed: false };
let courant: EditorSurfaceSlot = VIDE;
let chargement: Promise<void> | null = null;
const abonnes = new Set<() => void>();

function publier(suivant: EditorSurfaceSlot): void {
  courant = suivant;
  abonnes.forEach(rappel => rappel());
}

/** Demande le code de l'éditeur. Sans effet s'il est là ou en route ; après un échec, retente. */
export function loadEditorSurface(): Promise<void> {
  if (courant.surface) return Promise.resolve();
  if (!chargement) {
    if (courant.failed) publier(VIDE);
    chargement = import("./EditorSurface").then(
      module => { publier({ surface: module.EditorSurface, failed: false }); },
      () => { chargement = null; publier({ surface: null, failed: true }); },
    );
  }
  return chargement;
}

const abonner = (rappel: () => void) => {
  abonnes.add(rappel);
  return () => { abonnes.delete(rappel); };
};
const lire = () => courant;
const lireAuServeur = () => VIDE;

/** L'éditeur s'il est chargé. `null` au serveur, et tant que son code n'est pas arrivé. */
export function useEditorSurface(): EditorSurfaceSlot {
  return useSyncExternalStore(abonner, lire, lireAuServeur);
}
