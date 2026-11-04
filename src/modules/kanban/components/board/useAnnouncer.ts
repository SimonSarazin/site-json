import { useCallback, useState } from 'react';
import { nextAnnouncement } from './liveRegion';

/**
 * Texte d'une region `role="status"` et la fonction qui l'ecrit.
 *
 * La region doit etre MONTEE des le premier rendu (serveur compris), vide :
 * une region qui apparait avec son texte n'est pas annoncee, les lecteurs
 * d'ecran n'observent que les noeuds deja presents. `announce` est stable
 * (`useCallback` sans dependance) : elle descend jusqu'aux colonnes memoisees.
 */
export function useAnnouncer(): [string, (message: string) => void] {
  const [text, setText] = useState('');
  const announce = useCallback((message: string) => {
    setText((previous) => nextAnnouncement(previous, message));
  }, []);
  return [text, announce];
}
