import { useEffect, useState } from 'react';
import { nextDayClock } from './boardClock';

/** Une minute : le changement de jour est vu au plus une minute apres minuit. */
const TICK_MS = 60_000;

/**
 * Instant courant, en secondes, qui ne change qu'au CHANGEMENT DE JOUR.
 *
 * `0` au rendu serveur et au premier rendu client : `Date.now()` lu pendant le
 * rendu donnerait un HTML different des deux cotes (une carte « en retard »
 * d'un cote seulement). La vraie valeur arrive apres l'hydratation, puis ne
 * bouge plus de la journee (cf. `nextDayClock`) : les cartes memoisees ne se
 * rendent pas de nouveau chaque minute.
 */
export function useDayClock(): number {
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const tick = () => setClock((previous) => nextDayClock(previous, Math.floor(Date.now() / 1000)));
    tick();
    const interval = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(interval);
  }, []);

  return clock;
}
