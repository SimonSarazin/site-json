import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useT } from "@/hooks/useT";
import { showErrorToast } from "@/lib/toastUtils";
import { useAuthModal } from "@/modules/auth/hooks/useAuthModal";
import type { MeeteemCard } from "../types";

/**
 * Statut posté par Meeteem. Le backend accepte n'importe quelle chaîne, mais
 * tout l'ampli compte les `like` (cf. `getSummaryData` → « Idées amplifiées ») :
 * en poster un autre rendrait le cœur incohérent avec le compteur du bandeau.
 */
export const MEETEEM_REACTION_STATUS = "like";

/** État d'affichage de la réaction d'UNE carte. */
export interface MeeteemReactionState {
  /** Nombre de réactions à afficher (serveur + bascule optimiste). */
  count: number;
  /** L'utilisateur courant a-t-il réagi ? */
  reacted: boolean;
  /** Un aller-retour serveur est en cours pour cette réponse. */
  pending: boolean;
  /** Bascule ajout/retrait. `undefined` = réaction non actionnable. */
  toggle?: () => void;
}

/** Ce que le hook exige de `card.answer` : l'instance `Answer` du SDK. */
type VotableAnswer = NonNullable<MeeteemCard["answer"]["addVote"]>;

/** Réaction optimiste locale. On ne mémorise QUE l'état de l'utilisateur
 *  courant : le compte, lui, reste dérivé des données serveur. */
interface ReactionOverride {
  reacted: boolean;
  pending: boolean;
}

/**
 * Réactions (« amplifications ») des réponses Meeteem — ajout ET retrait.
 *
 * **Une seule action pour les deux sens** : le backend BASCULE (re-poster le
 * même statut retire la réaction, cf. `Answer.addVote`). Il n'y a donc pas
 * d'appel « supprimer » distinct, et c'est la réponse — `removedVoteStatus` —
 * qui dit dans quel sens la bascule est réellement partie.
 *
 * **Pourquoi un état local et pas un patch du cache React Query :** les vues
 * carte/split gardent jusqu'à 5000 réponses en cache, et le `useMemo` qui les
 * transforme en entités dépend de l'objet `data` entier — le repatcher ferait
 * retransformer TOUT le périmètre à chaque clic sur un cœur. On ne mémorise
 * donc que la bascule de l'utilisateur courant, et le compte se recalcule à
 * partir du serveur : les réactions des AUTRES continuent d'arriver
 * normalement, et un refetch ne peut pas double-compter la nôtre.
 */
export function useMeeteemReactions() {
  const t = useT("modules/ampli");
  const { me } = useCocolight();
  const { openLogin } = useAuthModal();
  const hydrated = useHydrated();

  // `me` est toujours null au SSR : le lire avant l'hydratation ferait diverger
  // le 1er rendu client du HTML serveur (cœur plein contre cœur vide).
  const userId = hydrated ? me?.serverData?.id ?? null : null;

  const [overrides, setOverrides] = useState<Record<string, ReactionOverride>>({});
  /** Dernier état serveur VU par `getReaction`, par réponse. */
  const serveurVu = useRef<Map<string, boolean>>(new Map());

  /**
   * Une bascule optimiste ne sert qu'à tenir l'affichage jusqu'à ce que la
   * donnée serveur rattrape l'écriture. Dès qu'elle l'a rattrapée, on l'ABANDONNE :
   * sans ça elle survivait à tous les refetchs, et une réaction retirée depuis un
   * autre onglet laissait un cœur plein que plus rien ne vidait (le clic suivant
   * partait alors à l'envers).
   */
  // Pas de liste de dépendances À DESSEIN : la réconciliation doit être tentée
  // après CHAQUE rendu, puisque la donnée serveur arrive par les cartes et non
  // par le hook. L'updater rend `prev` tel quel quand il n'y a rien à retirer —
  // pas de nouvel état, donc pas de boucle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setOverrides((prev) => {
      let change = false;
      const next: Record<string, ReactionOverride> = {};
      for (const [id, override] of Object.entries(prev)) {
        if (!override.pending && serveurVu.current.get(id) === override.reacted) {
          change = true;
          continue;
        }
        next[id] = override;
      }
      return change ? next : prev;
    });
  });

  const mutation = useMutation({
    mutationFn: ({ answer }: { answerId: string; answer: VotableAnswer }) =>
      answer(MEETEEM_REACTION_STATUS),

    onSuccess: (result, { answerId }) => {
      // Le serveur fait autorité sur le SENS de la bascule : notre prévision
      // pouvait être fausse (réaction posée depuis un autre onglet, cache
      // chargé avant la connexion…). `removedVoteStatus` n'est présent qu'au
      // retrait — `msg` ne discrimine rien, il est vide dans ce cas-là.
      const removed = result?.removedVoteStatus !== undefined;
      setOverrides((prev) => ({ ...prev, [answerId]: { reacted: !removed, pending: false } }));
    },

    onError: (error, { answerId }) => {
      // On RETIRE la bascule optimiste au lieu de l'inverser : l'affichage
      // repart des données serveur, seule vérité disponible après un échec.
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[answerId];
        return next;
      });
      showErrorToast(error, "toast.reactionError", t);
    },
  });

  const { mutate } = mutation;

  /**
   * État de réaction d'une carte + sa bascule.
   * @param card - La carte (ses données serveur portent `vote`).
   * @param answerId - Id de la réponse, clé de la bascule optimiste.
   */
  const getReaction = useCallback(
    (card: MeeteemCard, answerId: string): MeeteemReactionState => {
      const vote = card.answer.serverData.vote;
      const serverCount = vote ? Object.keys(vote).length : 0;
      const serverReacted = Boolean(userId && vote && userId in vote);

      // Ce que le serveur dit de cette carte MAINTENANT : l'effet de
      // réconciliation s'en sert pour abandonner les bascules rattrapées.
      serveurVu.current.set(answerId, serverReacted);

      const override = overrides[answerId];
      const reacted = override?.reacted ?? serverReacted;
      const pending = override?.pending ?? false;
      // Le compte reste ANCRÉ sur le serveur : on ne corrige que notre propre
      // contribution. Sans ça, un `+1` local ferait doubler la réaction dès que
      // le serveur la renvoie à son tour.
      const count = serverCount - (serverReacted ? 1 : 0) + (reacted ? 1 : 0);

      // Fixtures de test / JSON non revivifié : pas d'entité SDK, donc pas
      // d'action possible — la carte retombe sur son compteur figé.
      const addVote = card.answer.addVote;
      const toggle = addVote
        ? () => {
            if (!userId) {
              openLogin();
              return;
            }
            if (pending) return;
            setOverrides((prev) => ({ ...prev, [answerId]: { reacted: !reacted, pending: true } }));
            mutate({ answerId, answer: addVote.bind(card.answer) });
          }
        : undefined;

      return { count, reacted, pending, toggle };
    },
    [userId, overrides, openLogin, mutate],
  );

  return { getReaction, canReact: Boolean(userId) };
}
