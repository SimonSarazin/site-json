import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  hiddenColumnsStorageKey,
  parseHiddenColumns,
  pruneHiddenColumns,
  serializeHiddenColumns,
  toggleHiddenColumn,
  type HiddenColumnsScope,
} from '@/modules/kanban/components/board/hiddenColumns';
import { boardPrefsContextFor, type BoardPrefsValue } from './boardPrefs';

export interface BoardPrefsProviderProps {
  boardId: string;
  /**
   * Portee de la preference (DESIGN §6.3, §6.6) : les colonnes du Tableau par
   * defaut, les colonnes de role de la vue Roles (`roles`, D34). Une cle de
   * stockage et un contexte par portee ; constante pour un fournisseur donne.
   */
  scope?: HiddenColumnsScope;
  /**
   * Colonnes de l'instantane DE CE TABLEAU (ou roles de sa liste), `undefined`
   * tant qu'elles ne sont pas chargees : la preference est alors elaguee des
   * colonnes disparues, et « Tout masquer » les masque toutes.
   */
  columnIds?: readonly string[];
  /** Ouvre la boite « Colonnes affichées » de cette portee ; absent, `openColumnVisibility` est sans effet. */
  onOpenColumnVisibility?: () => void;
  children: ReactNode;
}

/**
 * Fournit les colonnes masquees du tableau, lues dans le `localStorage`.
 *
 * Etat initial VIDE au rendu serveur COMME au premier rendu client : le
 * stockage n'est lu qu'apres l'hydratation, dans un effet. Lire pendant le
 * rendu ferait masquer des colonnes cote client que le HTML serveur affichait —
 * l'erreur d'hydratation type. Un changement de tableau relit la cle du
 * nouveau (`boardId` en dependance).
 */
export function BoardPrefsProvider({
  boardId,
  scope = 'kanban',
  columnIds,
  onOpenColumnVisibility,
  children,
}: BoardPrefsProviderProps) {
  const [hidden, setHidden] = useState<string[]>([]);
  /** Tableau dont `hidden` decrit l'etat : evite d'ecrire celui d'avant sous la cle du suivant. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(hiddenColumnsStorageKey(boardId, scope));
    } catch {
      // Navigation privee ou stockage bloque : tout reste affiche.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(parseHiddenColumns(stored));
    setLoadedFor(boardId);
  }, [boardId, scope]);

  const persist = useCallback(
    (next: string[]) => {
      try {
        const key = hiddenColumnsStorageKey(boardId, scope);
        if (next.length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, serializeHiddenColumns(next));
      } catch {
        // Preference non memorisee : elle vaut pour la session en cours.
      }
    },
    [boardId, scope],
  );

  /*
   * Elagage PERSISTE (#77, #118) : le stockage garde l'id d'une colonne qu'un
   * autre membre a supprimee depuis ; « Colonnes affichées » proposait alors
   * « Tout afficher » sans rien a reafficher. Une fois la preference relue ET
   * l'instantane du meme tableau charge, seules les colonnes qui existent sont
   * gardees — et l'on n'ecrit que si la liste change.
   */
  useEffect(() => {
    if (loadedFor !== boardId || columnIds === undefined) return;
    const pruned = pruneHiddenColumns(hidden, columnIds);
    if (pruned.length === hidden.length) return;
    // Reconciliation d'un etat derive d'une donnee externe (l'instantane), qui
    // converge en un cycle : la liste elaguee ne change plus au tour suivant.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(pruned);
    persist(pruned);
  }, [boardId, columnIds, hidden, loadedFor, persist]);

  /*
   * L'ecriture du stockage reste HORS de la fonction de mise a jour d'etat :
   * React peut rejouer celle-ci (mode strict), et un effet de bord n'a rien a
   * y faire. `hidden` en dependance : la valeur du contexte change de toute
   * facon a chaque bascule.
   */
  const toggleColumn = useCallback(
    (columnId: string) => {
      const next = toggleHiddenColumn(hidden, columnId);
      setHidden(next);
      persist(next);
    },
    [hidden, persist],
  );

  const showAllColumns = useCallback(() => {
    setHidden([]);
    persist([]);
  }, [persist]);

  /*
   * « Tout masquer » (D34) : toutes les colonnes CONNUES, pas un marqueur
   * « tout » — une colonne qui apparaitrait ensuite (role cree par un autre
   * membre) doit naître visible, comme dans le kanban des roles de Communecter.
   * Tant que les colonnes ne sont pas chargees, il n'y a rien a masquer.
   */
  const hideAllColumns = useCallback(() => {
    if (columnIds === undefined) return;
    const next = [...columnIds];
    setHidden(next);
    persist(next);
  }, [columnIds, persist]);

  /*
   * L'ouverture de la boite est lue dans une ref : la mise en page passe une
   * lambda recreee a chaque rendu, et la mettre dans la valeur ferait rerendre
   * tous les lecteurs du contexte (le Kanban et ses colonnes memoisees) a
   * chaque rendu de l'en-tete.
   */
  const openRef = useRef(onOpenColumnVisibility);
  useEffect(() => {
    openRef.current = onOpenColumnVisibility;
  });
  const openColumnVisibility = useCallback(() => {
    openRef.current?.();
  }, []);

  /*
   * Memoise : le Kanban et ses colonnes memoisees lisent ce contexte, une
   * valeur recreee a chaque rendu de la mise en page les rerendrait toutes.
   * Tant que le tableau courant n'est pas relu, on n'expose RIEN de masque :
   * les colonnes du tableau precedent ne doivent pas en cacher dans celui-ci.
   */
  const value = useMemo<BoardPrefsValue>(
    () => ({
      hiddenColumnIds: loadedFor === boardId ? hidden : [],
      toggleColumn,
      showAllColumns,
      hideAllColumns,
      openColumnVisibility,
    }),
    [boardId, hidden, loadedFor, showAllColumns, hideAllColumns, openColumnVisibility, toggleColumn],
  );

  // Un contexte par portee (cf. `boardPrefs`) : la portee d'un fournisseur ne change pas.
  const Context = boardPrefsContextFor(scope);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
