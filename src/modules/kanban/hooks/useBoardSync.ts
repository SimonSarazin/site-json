/**
 * Synchronisation multi-utilisateurs par POLLING DELTA (blueprint D8).
 *
 * Il n'existe aucune infrastructure websocket cote PHP : la convergence passe
 * par `board/sync`, qui ne renvoie que les activites posterieures au `rev`
 * connu du client. Trois regles gouvernent le rythme :
 *
 *  - une passe toutes les 10 s quand l'onglet est visible ;
 *  - AUCUN minuteur quand l'onglet est cache (un tableau ouvert dans un onglet
 *    oublie ne doit pas marteler le serveur toute la journee) ;
 *  - une passe IMMEDIATE au retour de l'onglet, parce que c'est precisement le
 *    moment ou l'utilisateur regarde un etat perime.
 *
 * Aucun minuteur n'est arme au rendu serveur : tout vit dans un effet, qui ne
 * s'execute jamais pendant le SSR.
 *
 * Le changement de LANGUE n'est plus gere ici : l'instantane retient la langue
 * de ses libelles et `useBoard` le recharge, y compris quand la langue a change
 * pendant que le tableau etait ferme.
 *
 * Les gardes de ce hook (reponse perimee, fils de commentaires relus, roles
 * relus sur `role.updated` d'une revision que la liste n'a pas encore et sur
 * rechargement, boucle suspendue puis reprise sur perte d'acces) sont
 * verrouillees par `tests/unit/useBoardSync.test.tsx`, qui le monte avec un
 * `fetch` simule.
 */
import { useEffect } from 'react';
import { hashKey, useQueryClient } from '@tanstack/react-query';
import { syncBoard } from '@/modules/kanban/api/boards';
import { applyActivities, commentThreadsTouched, decideSync, rolesRereadNeeded } from '@/modules/kanban/lib/boardSync';
import { nowTimestamp } from '@/modules/kanban/lib/dates';
import { KanbanAuthError, isAccessLostFailure } from '@/modules/kanban/lib/kanbanErrors';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import { useCurrentUserId, useKanbanClient } from '@/modules/kanban/hooks/useKanbanSession';
import type { BoardSnapshot, RoleListResult } from '@/modules/kanban/types';

export const BOARD_SYNC_INTERVAL_MS = 10_000;

function isTabHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export function useBoardSync(boardId: string): void {
  const client = useKanbanClient();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();

  useEffect(() => {
    // Pas de session (rendu serveur, premier rendu, visiteur anonyme) ou pas
    // de tableau : rien a synchroniser.
    if (!boardId || userId === null) return;

    const queryKey = KANBAN_QUERY_KEYS.BOARD(userId, boardId);
    const boardHash = hashKey(queryKey);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Effet demonte : plus rien ne part, plus rien ne s'ecrit. */
    let disposed = false;
    /**
     * Acces perdu (403, 404 de `board/sync`) : la boucle est SUSPENDUE, pas
     * arretee pour de bon — elle repart des que `board/get` reussit de nouveau
     * (cf. l'abonnement au cache, plus bas).
     */
    let suspended = false;
    let inFlight = false;

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const schedule = () => {
      clearTimer();
      if (disposed || suspended || isTabHidden()) return;
      timer = setTimeout(() => {
        void poll();
      }, BOARD_SYNC_INTERVAL_MS);
    };

    const poll = async (): Promise<void> => {
      if (disposed || suspended || inFlight || isTabHidden()) {
        schedule();
        return;
      }

      const snapshot = queryClient.getQueryData<BoardSnapshot>(queryKey);
      // Tableau pas encore charge (ou en erreur) : `board/get` reste maitre du
      // premier chargement, le delta n'a rien sur quoi s'appliquer.
      if (!snapshot) {
        schedule();
        return;
      }

      const startRev = snapshot.board.rev;
      inFlight = true;
      try {
        const result = await syncBoard(client, { boardId, sinceRev: startRev }, { signal: controller.signal });
        if (disposed) return;

        /*
         * Reponse PERIMEE : un `board/get` plus recent a remplace l'instantane
         * pendant l'aller-retour (rechargement apres un echec, langue…). Ce
         * delta a ete calcule depuis l'ancienne revision : l'appliquer
         * reecrirait des cartes plus anciennes que celles du cache, et la
         * revision, qui ne redescend pas, empecherait de jamais les corriger.
         * Un rechargement qu'il demanderait serait tout aussi inutile. On
         * l'abandonne ; la passe suivante repart de la revision courante.
         */
        const current = queryClient.getQueryData<BoardSnapshot>(queryKey);
        if (current?.board.rev !== startRev) return;

        // La DECISION est pure et testee (`decideSync`) ; ce hook n'en execute
        // que l'effet sur le cache.
        const decision = decideSync(startRev, result);
        if (decision.kind === 'reload') {
          // Trop de retard, activite non rejouable (membres, labels, droits),
          // ou ecriture faite dans Kanban gestion sur un board-lien (D17) :
          // seul `board/get` sait encore quoi afficher. Les fils de
          // commentaires aussi : un message ecrit dans gestion n'a pas de ligne
          // de journal, il n'arrive que par ce chemin.
          await queryClient.invalidateQueries({ queryKey });
          void queryClient.invalidateQueries({ queryKey: KANBAN_QUERY_KEYS.CARD_COMMENTS_OF_BOARD(userId, boardId) });
          // Les roles aussi (D30) : un role ecrit dans Communecter change
          // l'empreinte, pas le journal ; seul ce rechargement le revele.
          void queryClient.invalidateQueries({ queryKey: KANBAN_QUERY_KEYS.ROLES(userId, boardId) });
        } else if (decision.kind === 'apply') {
          // `current` EST l'entree du cache : rien d'asynchrone ne separe la
          // garde ci-dessus de cette ecriture, aucune autre source n'a pu ecrire
          // entre les deux. `userId` : les commentaires des AUTRES s'ajoutent a
          // mes non-lus.
          queryClient.setQueryData<BoardSnapshot>(
            queryKey,
            applyActivities(current, decision.activities, nowTimestamp(), userId),
          );
          // Un fil monte se RELIT (et se marque vu cote serveur) ; un fil ferme
          // est seulement marque perime, relu a sa prochaine ouverture.
          for (const cardId of commentThreadsTouched(decision.activities)) {
            void queryClient.invalidateQueries({ queryKey: KANBAN_QUERY_KEYS.CARD_COMMENTS(userId, boardId, cardId) });
          }
          // `role.updated` (D30) : pas de rejeu fin, la liste des roles se relit
          // — montee, tout de suite ; fermee, a sa prochaine ouverture. Sauf si
          // la liste en cache est deja a cette revision : le polling rapporte
          // aussi MES ecritures, que `useRoleMutations` a deja posees et relues.
          const rolesKey = KANBAN_QUERY_KEYS.ROLES(userId, boardId);
          if (rolesRereadNeeded(decision.activities, queryClient.getQueryData<RoleListResult>(rolesKey)?.rev)) {
            void queryClient.invalidateQueries({ queryKey: rolesKey });
          }
        }
      } catch (error) {
        if (isAccessLostFailure(error) || error instanceof KanbanAuthError) {
          // Acces perdu (contributeur retire du projet, lien supprime, route
          // absente) ou session morte (jeton refuse, rafraichissement rate :
          // le SDK a remis la session du site a zero) : ce n'est pas une
          // coupure reseau, reessayer toutes les 10 s n'y changera rien — sur
          // une session morte, chaque passe couterait en plus un `refreshtoken`
          // voue a l'echec. On SUSPEND la boucle et l'on recharge l'instantane :
          // `board/get` repond le meme refus, que l'ecran d'erreur explique.
          suspended = true;
          void queryClient.invalidateQueries({ queryKey });
          return;
        }
        // Sinon, le polling est SILENCIEUX : une coupure reseau ne doit pas
        // empiler les notifications d'erreur par-dessus un tableau
        // parfaitement utilisable. La passe suivante retentera.
      } finally {
        inFlight = false;
        schedule();
      }
    };

    /*
     * REPRISE apres une perte d'acces. Les dependances de l'effet ne changent
     * pas quand le tableau se recharge : sans cet abonnement, la suspension
     * durait tant que la mise en page du tableau restait montee — acces rendu,
     * « Reessayer » clique, tableau reaffiche, mais plus aucune mise a jour des
     * collegues. Seule une LECTURE reussie de `board/get` prouve que le tableau
     * est de nouveau lisible ; une ecriture locale du cache (`setQueryData`,
     * action `manual`), comme le fil qui marque ses messages vus, ne prouve rien.
     */
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!suspended || event.type !== 'updated' || event.query.queryHash !== boardHash) return;
      if (event.action.type !== 'success' || event.action.manual === true) return;
      suspended = false;
      schedule();
    });

    const handleWake = () => {
      if (isTabHidden()) {
        clearTimer();
        return;
      }
      void poll();
    };

    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('focus', handleWake);
    schedule();

    return () => {
      disposed = true;
      unsubscribe();
      clearTimer();
      controller.abort();
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('focus', handleWake);
    };
  }, [boardId, userId, client, queryClient]);
}
