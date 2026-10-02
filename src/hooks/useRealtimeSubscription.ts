import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  abonnerResync, abonnerSujet, lireEtat, lireEtatServeur, souscrireEtat,
} from "@/lib/realtimeBus";
import type { EtatTempsReel } from "./useRealtimeTopics";

/**
 * L'API des CONSOMMATEURS du temps réel. C'est celle-ci qu'un module appelle — jamais
 * `useRealtimeTopics`, qui est le transport et n'a qu'un seul client légitime :
 * `RealtimeBridge`.
 *
 * La différence n'est pas cosmétique : `useRealtimeTopics` **ouvre une connexion**, ces
 * hooks-ci s'abonnent à celle qui existe déjà. Deux modules appelant le transport en
 * ouvriraient deux (cf. `lib/realtimeBus.ts`).
 *
 * ⚠️ Les rappels passent par une ref, et ce n'est PAS un détail de confort. Un rappel recréé
 * à chaque rendu — le cas normal en React — relancerait l'abonnement à chaque tour ; or un
 * désabonnement qui fait tomber le compteur à zéro **ferme le flux**, que le réabonnement
 * rouvrirait aussitôt. Sans cette garde, une fonction inline suffirait à faire battre la
 * connexion SSE à chaque rendu.
 *
 * La ref est mise à jour dans un effet, pas au rendu : `react-hooks/refs` classe l'écriture
 * au rendu en ERROR dans ce dépôt. L'effet de synchronisation est déclaré AVANT celui qui
 * s'abonne, donc `garde.current` est toujours à jour quand le bus appelle.
 */

/**
 * S'abonne à UN sujet. Le rappel n'a pas à être stable.
 *
 * `actif` coupe l'abonnement sans démonter le composant — et comme le flux ne s'ouvre que
 * s'il reste au moins un abonné, un `actif: false` généralisé referme réellement la connexion.
 */
export function useRealtimeTopic(
  topic: string | null,
  rappel: (topic: string) => void,
  actif = true,
): void {
  const garde = useRef(rappel);
  useEffect(() => { garde.current = rappel; }, [rappel]);

  useEffect(() => {
    if (!topic || !actif) return;
    return abonnerSujet(topic, (t) => garde.current(t));
  }, [topic, actif]);
}

/** S'abonne aux resynchronisations (le hub demande de tout refaire : disjoncteur, bus rétabli). */
export function useRealtimeResync(rappel: (motif: string) => void, actif = true): void {
  const garde = useRef(rappel);
  useEffect(() => { garde.current = rappel; }, [rappel]);

  useEffect(() => {
    if (!actif) return;
    return abonnerResync((m) => garde.current(m));
  }, [actif]);
}

/**
 * L'état du flux partagé.
 *
 * À lire pour piloter un `refetchInterval` : `connecte` autorise un intervalle long, tout le
 * reste — `degrade` compris — impose de revenir à l'interrogation normale.
 */
export function useRealtimeEtat(): EtatTempsReel {
  return useSyncExternalStore(souscrireEtat, lireEtat, lireEtatServeur);
}
