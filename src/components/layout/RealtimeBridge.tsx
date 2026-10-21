import { useEffect, useSyncExternalStore } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useRealtimeTopics } from "@/hooks/useRealtimeTopics";
import {
  diffuserResync, diffuserSujet, lireCompteur, lireCompteurServeur, poserEtat, souscrireCompteur,
} from "@/lib/realtimeBus";

/**
 * PONT entre le transport SSE et le bus d'abonnement — le seul appelant légitime de
 * `useRealtimeTopics`.
 *
 * Monté une fois dans `RootLayout`, il tient **l'unique** connexion de l'onglet et redistribue
 * les sujets reçus à tous les abonnés (`useRealtimeTopic`). Avant lui, chaque module ouvrait
 * la sienne : deux consommateurs, deux flux, et donc quatre connexions en comptant le saut
 * relais → hub.
 *
 * ── Pourquoi un frère qui ne rend rien, et pas un fournisseur englobant ─────────────────────
 * Un fournisseur de contexte re-rendrait TOUT l'arbre à chaque changement d'état du flux —
 * une connexion qui se rétablit repeindrait la page entière. Ici l'état vit dans le bus, et
 * seuls les composants qui l'observent par `useRealtimeEtat` se re-rendent.
 *
 * ── Pourquoi `nbAbonnes > 0` ────────────────────────────────────────────────────────────────
 * Sans cette condition, monter ce pont à la racine ouvrirait un flux permanent sur TOUS les
 * sites, y compris ceux qui n'ont ni cloche ni panneau — une régression nette par rapport à
 * l'état antérieur, où seule la cloche déclenchait la connexion. Zéro abonné, zéro connexion :
 * le coût reste proportionnel à l'usage réel, pas au déploiement.
 */
export function RealtimeBridge() {
  const { me } = useCocolight();
  const nbAbonnes = useSyncExternalStore(souscrireCompteur, lireCompteur, lireCompteurServeur);

  const { etat } = useRealtimeTopics({
    jeton: me?.isConnected ? (me.apiClient?.getToken?.() ?? null) : null,
    actif: !!me?.isConnected && nbAbonnes > 0,
    // Stables par construction (fonctions de module) : l'abonnement ne se relance pas.
    surTopic: diffuserSujet,
    surResync: diffuserResync,
  });

  // Écriture dans un store EXTERNE, pas un `setState` — `react-hooks/set-state-in-effect`
  // ne s'y applique pas, et les abonnés se re-rendent par `useSyncExternalStore`.
  useEffect(() => { poserEtat(etat); }, [etat]);

  return null;
}
