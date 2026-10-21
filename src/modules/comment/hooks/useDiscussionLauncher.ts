import { useCallback, useState } from "react";
import { useDiscussionUrlState } from "./useDiscussionUrlState";
import { useDiscussionUnread } from "./useDiscussionUnread";
import type { DiscussionSelection } from "../lib/filKey";

export interface DiscussionLauncher {
  /** La modale doit-elle être ouverte ? */
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  /** Ouvre la modale SUR une sélection — ce qu'appelle un bouton contextuel. */
  readonly openAt: (selection: DiscussionSelection) => void;
  /** Non-lus, tous porteurs confondus. Ne coûte aucune requête de plus. */
  readonly unread: number;
}

/**
 * Ce qu'un hôte doit savoir pour ouvrir le panneau en modale.
 *
 * **`open` est DÉRIVÉ au rendu**, jamais posé dans un effet : c'est ce qui fait qu'un lien
 * profond ouvre la modale dès le premier rendu, sans le clignotement d'un effet qui
 * rattraperait l'URL après coup — et c'est aussi ce que la règle `set-state-in-effect` impose.
 *
 * `close()` est le verbe de l'HÔTE, et de lui seul : le panneau, lui, ne fait que changer de
 * sélection. Les câbler ensemble ferait fermer la modale sur un simple « retour aux espaces ».
 */
export function useDiscussionLauncher(options?: { readonly param?: string }): DiscussionLauncher {
  const { isOpen, select, close } = useDiscussionUrlState({ param: options?.param });
  // Ouverture SANS sélection — le cas du bouton « Discussions » qui montre le rail.
  const [forceOpen, setForceOpen] = useState(false);
  const { unread } = useDiscussionUnread();

  const setOpen = useCallback((next: boolean) => {
    setForceOpen(next);
    // Fermer efface le paramètre : sans cela, recharger la page rouvrirait la modale, et
    // l'adresse continuerait d'annoncer une vue qui n'est plus à l'écran.
    if (!next) close();
  }, [close]);

  const openAt = useCallback((selection: DiscussionSelection) => {
    setForceOpen(true);
    select(selection);
  }, [select]);

  return { open: forceOpen || isOpen, setOpen, openAt, unread };
}
