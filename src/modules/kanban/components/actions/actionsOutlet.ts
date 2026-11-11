import type { RefObject } from "react";
import { useOutletContext } from "react-router";
import type { BoardSearch } from "@/modules/kanban/components/board/boardSearch";
import type { ActionsViewId } from "@/modules/kanban/lib/kanbanPaths";
import type { BoardSnapshot } from "@/modules/kanban/types";

/**
 * Ce que la mise en page du tableau des actions (`ActionsLayout`) passe à la vue de sa route
 * fille, par le contexte d'`<Outlet>` du routeur : une vue ne charge ni ne synchronise rien
 * elle-même, et passer d'une vue à l'autre garde l'instantané, la recherche et les filtres.
 */
export interface ActionsOutletContext {
  /** Le tableau relié à l'élément porteur. */
  boardId: string;
  /** `undefined` tant que l'instantané charge ; son échec, la mise en page le montre à la place de la vue. */
  snapshot: BoardSnapshot | undefined;
  /** Recherche, filtres, regroupement et tri de la barre d'outils. */
  search: BoardSearch;
  /** Vue courante, lue sur l'adresse : la vue Jalons ouvre ses cartes sous `jalons/carte/:id`. */
  view: ActionsViewId;
  /** Titre de la page : il reprend le focus quand la commande qui l'avait disparaît. */
  titleRef: RefObject<HTMLHeadingElement | null>;
  /** Colonnes masquées sur ce poste, élaguées des colonnes disparues (Tableau seulement). */
  hiddenColumnIds: readonly string[];
  /** Masque une colonne : la mise en page annonce et déplace le focus. Stable. */
  hideColumn: (columnId: string) => void;
  /** Archive une carte (optimiste, réussite notifiée), depuis le tableau comme depuis la fiche. Stable. */
  archiveCard: (cardId: string) => void;
  /** Ouvre la gestion des jalons ; absent là où il n'y a pas de jalons (organisation). */
  openMilestones: (() => void) | undefined;
}

export function useActionsOutlet(): ActionsOutletContext {
  return useOutletContext<ActionsOutletContext>();
}
