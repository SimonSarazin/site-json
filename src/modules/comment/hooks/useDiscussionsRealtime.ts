import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDocumentHidden } from "@/hooks/useReducedMotion";
import { useRealtimeEtat, useRealtimeResync, useRealtimeTopic } from "@/hooks/useRealtimeSubscription";
import type { EtatTempsReel } from "@/hooks/useRealtimeTopics";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";

/**
 * TEMPS RÉEL DU PANNEAU « DISCUSSIONS » — invalidation amortie, jamais d'écriture de cache.
 *
 * ── ⚠️ Le sujet n'est émis par PERSONNE, et c'est vérifié ────────────────────────────────────
 * Le hub vit hors de ce dépôt : `cocolight-backend`, `src/hub.ts`. Son manifeste ne porte qu'une
 * règle — `notification.changed`, sur `activityStreamReference`. **Aucune règle n'observe la
 * collection `comments`** (relevé le 28/09/2026, manifestes du hub ET du backend complet).
 *
 * Ce n'est donc pas une attente sur un sujet inconnu, mais une règle qui reste à écrire côté hub.
 * Le code est écrit pour que les deux issues soient correctes : s'abonner à un sujet que personne
 * n'émet ne coûte rien (une entrée de `Map`, aucun réseau), et l'interrogation périodique reste le
 * filet. Le jour où la règle existera, le panneau deviendra réactif sans qu'une ligne change ici.
 * Cf. `doc/38-module-comment.md` §11.5 pour la demande, et ses six questions préalables.
 *
 * ── Les deux amortisseurs, et ce qu'ils ne règlent pas ──────────────────────────────────────
 * 1. FENÊTRE : un sujet reçu n'invalide qu'une fois par fenêtre. Sans elle, un fil animé —
 *    dix messages en quelques secondes — déclencherait dix rafraîchissements par client.
 * 2. VISIBILITÉ : un onglet en arrière-plan ne rafraîchit pas, il note qu'il a du retard et
 *    se met à jour en revenant. C'est le pendant de `refetchIntervalInBackground: false`,
 *    qui ne couvre que l'interrogation périodique, pas l'invalidation poussée.
 *
 * Aucun des deux ne règle le VRAI point de passage à l'échelle : une écriture réveille tous
 * les clients abonnés, puisqu'un sujet sans porteur ne permet à personne de se sentir non
 * concerné. Cela se corrige en amont, dans le hub — voir la doc citée plus haut.
 */

/** Sujet attendu du hub pour la collection `comments`. À confirmer — voir l'en-tête. */
export const TOPIC_COMMENTS = "comment.changed";

/** Au plus un rafraîchissement par fenêtre, par client. */
const FENETRE_MS = 5_000;

export function useDiscussionsRealtime(actif = true): EtatTempsReel {
  const queryClient = useQueryClient();
  const cache = useDocumentHidden();

  /** Horodatage du dernier rafraîchissement effectif, et retard accumulé pendant l'absence. */
  const dernier = useRef(0);
  const enRetard = useRef(false);

  const invalider = useCallback(() => {
    dernier.current = Date.now();
    enRetard.current = false;
    void queryClient.invalidateQueries({
      queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX(),
      refetchType: "active",
    });
  }, [queryClient]);

  /** Le point d'entrée de tout ce qui vient du hub : filtre la visibilité, puis la fenêtre. */
  const demander = useCallback(() => {
    if (document.hidden) { enRetard.current = true; return; }
    if (Date.now() - dernier.current < FENETRE_MS) { enRetard.current = true; return; }
    invalider();
  }, [invalider]);

  useRealtimeTopic(TOPIC_COMMENTS, demander, actif);
  // Resynchronisation : le hub ne dit plus quoi rafraîchir. On passe outre la fenêtre —
  // c'est un ordre, pas un événement de plus.
  useRealtimeResync(invalider, actif);

  // Retour au premier plan avec du retard en attente : on rattrape une fois, sans attendre
  // la fin de la fenêtre. Le retard n'est PAS un compteur — dix messages manqués valent un
  // rafraîchissement, pas dix.
  useEffect(() => {
    if (cache || !enRetard.current || !actif) return;
    invalider();
  }, [cache, actif, invalider]);

  return useRealtimeEtat();
}
