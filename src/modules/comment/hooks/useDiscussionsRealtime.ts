import { useCallback, useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
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
 * ── « connecte » ne suffit pas : il faut avoir ENTENDU le sujet ──────────────────────────────
 * Le flux de l'onglet est ouvert par la cloche des notifications, sur toute page : il est
 * `connecte` sans jamais porter ce sujet. Le panneau en concluait qu'il était en temps réel, et ne
 * relisait plus ses compteurs que toutes les 5 min (revue du 16/10). L'état rendu ici est donc
 * celui du flux POUR CE SUJET : `degrade` — flux ouvert, rien ne vient — tant qu'aucun signal
 * n'a été reçu dans l'onglet, `connecte` ensuite.
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

/**
 * Une resynchronisation parvient à TOUS les abonnés dans le même tour : la première l'exécute,
 * les suivantes trouvent un rafraîchissement d'il y a moins d'une seconde et s'en tiennent là.
 */
const DEDOUBLONNAGE_MS = 1_000;

/**
 * L'amortisseur est COMMUN à tous les abonnés d'un onglet — un par client de requêtes, donc un
 * par onglet (et un par test). Chaque abonné tenait le sien : le panneau en monte quatre
 * (`useDiscussionsQuery` ×4), si bien qu'un signal ou une resynchronisation invalidait quatre fois
 * le même préfixe — chaque invalidation annulant la relecture lancée par la précédente (revue du
 * 16/10).
 */
interface Amortisseur {
  /** Horodatage du dernier rafraîchissement effectif. */
  dernier: number;
  /** Un signal est arrivé hors de vue ou dans la fenêtre : un rattrapage est dû. */
  enRetard: boolean;
  /** Le rattrapage de FIN de fenêtre, s'il est programmé. */
  relance: ReturnType<typeof setTimeout> | null;
  /** Le sujet a été reçu au moins une fois dans l'onglet (cf. l'en-tête). */
  entendu: boolean;
  /** Une diffusion du sujet est en cours de distribution aux abonnés (cf. `demander`). */
  enDiffusion: boolean;
}

const amortisseurs = new WeakMap<QueryClient, Amortisseur>();

function amortisseurDe(client: QueryClient): Amortisseur {
  let amortisseur = amortisseurs.get(client);
  if (!amortisseur) {
    amortisseur = { dernier: 0, enRetard: false, relance: null, entendu: false, enDiffusion: false };
    amortisseurs.set(client, amortisseur);
  }
  return amortisseur;
}

export function useDiscussionsRealtime(actif = true): EtatTempsReel {
  const queryClient = useQueryClient();
  const cache = useDocumentHidden();
  const etat = useRealtimeEtat();

  const invalider = useCallback(() => {
    const amortisseur = amortisseurDe(queryClient);
    amortisseur.dernier = Date.now();
    amortisseur.enRetard = false;
    if (amortisseur.relance !== null) {
      clearTimeout(amortisseur.relance);
      amortisseur.relance = null;
    }
    void queryClient.invalidateQueries({
      queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX(),
      refetchType: "active",
    });
  }, [queryClient]);

  /** Le point d'entrée de tout ce qui vient du hub : filtre la visibilité, puis la fenêtre. */
  const demander = useCallback(() => {
    const amortisseur = amortisseurDe(queryClient);
    amortisseur.entendu = true;
    // Un signal parvient à TOUS les abonnés dans le même tour (`diffuserSujet`) : le premier le
    // traite, les suivants n'en sont que l'écho. Sans cette garde, le deuxième trouvait la fenêtre
    // que le premier venait d'ouvrir et programmait un rattrapage — une seconde relecture du
    // panneau 5 s plus tard, sans signal nouveau (relecture du lot, 16/10). Un vrai second signal
    // arrive dans un autre message du flux, donc après la fin de ce tour.
    if (amortisseur.enDiffusion) return;
    amortisseur.enDiffusion = true;
    queueMicrotask(() => { amortisseur.enDiffusion = false; });
    if (document.hidden) { amortisseur.enRetard = true; return; }
    const ecoule = Date.now() - amortisseur.dernier;
    if (ecoule >= FENETRE_MS) { invalider(); return; }
    amortisseur.enRetard = true;
    // Rattrapé en FIN de fenêtre : le dernier signal d'une rafale ne l'était sinon qu'au signal
    // suivant — ou au sondage, 5 min plus tard (revue du 16/10). Onglet passé en arrière-plan
    // entre-temps : c'est le retour au premier plan qui rattrapera.
    if (amortisseur.relance === null) {
      amortisseur.relance = setTimeout(() => {
        amortisseur.relance = null;
        if (amortisseur.enRetard && !document.hidden) invalider();
      }, FENETRE_MS - ecoule);
    }
  }, [queryClient, invalider]);

  /**
   * Resynchronisation : le hub ne dit plus quoi rafraîchir. On passe outre la fenêtre — c'est un
   * ordre, pas un événement de plus —, mais une fois pour tout l'onglet.
   */
  const resynchroniser = useCallback(() => {
    if (Date.now() - amortisseurDe(queryClient).dernier < DEDOUBLONNAGE_MS) return;
    invalider();
  }, [queryClient, invalider]);

  useRealtimeTopic(TOPIC_COMMENTS, demander, actif);
  useRealtimeResync(resynchroniser, actif);

  // Retour au premier plan avec du retard en attente : on rattrape une fois, sans attendre
  // la fin de la fenêtre. Le retard n'est PAS un compteur — dix messages manqués valent un
  // rafraîchissement, pas dix. Partagé : le premier abonné rattrape, les autres n'ont plus rien.
  useEffect(() => {
    if (cache || !actif || !amortisseurDe(queryClient).enRetard) return;
    invalider();
  }, [cache, actif, invalider, queryClient]);

  // Lu au rendu, sans abonnement : le premier signal invalide le panneau, sa relecture le rend
  // — et c'est elle qui recalcule l'intervalle de sondage.
  return etat === "connecte" && !amortisseurDe(queryClient).entendu ? "degrade" : etat;
}
