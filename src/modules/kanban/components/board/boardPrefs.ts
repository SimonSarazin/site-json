/**
 * Preferences LOCALES du tableau ouvert : les colonnes masquees (DESIGN §6.3),
 * par PORTEE — celles du Tableau, et depuis le §12.8 (D34) les colonnes de role
 * de la vue Roles (DESIGN §6.6).
 *
 * POURQUOI un contexte : le choix se fait dans l'en-tete (menu « ⋯ » >
 * « Colonnes affichées », ou le menu d'une colonne) et s'applique deux etages
 * plus bas, dans la vue rendue par l'`<Outlet />`. Le fournisseur vit dans la
 * mise en page du tableau (`BoardLayout`), qui connait le tableau courant.
 *
 * POURQUOI un contexte PAR PORTEE : les deux portees vivent en meme temps sous
 * la mise en page (l'indicateur de la vue Roles et la boite du Tableau lisent
 * chacun la leur), et un fournisseur unique recouvrirait l'autre. Le meme
 * fournisseur (`BoardPrefsProvider`) et le meme hook servent les deux : seule
 * la portee change, et avec elle la cle de stockage.
 *
 * Valeur de repli NEUTRE (rien de masque, setters sans effet) plutot qu'une
 * exception : un composant de tableau monte hors de la mise en page (un test,
 * un futur ecran) doit tout afficher, pas planter.
 */
import { createContext, useContext, type Context } from 'react';
import type { HiddenColumnsScope } from '@/modules/kanban/components/board/hiddenColumns';

export interface BoardPrefsValue {
  /** Identifiants des colonnes masquees sur ce poste, pour ce tableau et cette portee. */
  hiddenColumnIds: readonly string[];
  toggleColumn: (columnId: string) => void;
  showAllColumns: () => void;
  /** « Tout masquer » : toutes les colonnes que le fournisseur connait (`columnIds`). */
  hideAllColumns: () => void;
  /**
   * Ouvre la boite « Colonnes affichées » de cette portee — l'editeur de la
   * preference, que la mise en page heberge. Sans effet hors d'elle.
   */
  openColumnVisibility: () => void;
}

function noop() {}

const FALLBACK: BoardPrefsValue = {
  hiddenColumnIds: [],
  toggleColumn: noop,
  showAllColumns: noop,
  hideAllColumns: noop,
  openColumnVisibility: noop,
};

const CONTEXTS: Record<HiddenColumnsScope, Context<BoardPrefsValue>> = {
  kanban: createContext<BoardPrefsValue>(FALLBACK),
  roles: createContext<BoardPrefsValue>(FALLBACK),
};

/** Le contexte du Tableau, la portee d'origine : les harnais qui fournissent une valeur a la main passent par lui. */
export const BoardPrefsContext = CONTEXTS.kanban;

/** Contexte d'une portee ; le fournisseur l'emploie, les ecrans passent par `useBoardPrefs`. */
export function boardPrefsContextFor(scope: HiddenColumnsScope): Context<BoardPrefsValue> {
  return CONTEXTS[scope];
}

/** Preferences d'une portee (le Tableau par defaut) : la portee est une constante du composant appelant. */
export function useBoardPrefs(scope: HiddenColumnsScope = 'kanban'): BoardPrefsValue {
  return useContext(CONTEXTS[scope]);
}
