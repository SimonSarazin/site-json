/**
 * Fil de discussion d'une carte (`comment/*`).
 *
 * Deux caches sont touches a chaque ecriture, et c'est tout l'interet du hook :
 *  - la LISTE des messages, entree dediee (`CARD_COMMENTS`) ;
 *  - le COMPTEUR porte par la carte dans l'instantane du tableau, que la ligne
 *    meta affiche (« 5 commentaires ») sans jamais charger le fil.
 * Oublier le second, c'est une modale qui dit « 6 » au-dessus d'un board resté
 * a « 5 » jusqu'au prochain rechargement.
 *
 * Le compteur est ajuste de facon RELATIVE (+1 / -1) pendant l'aller-retour,
 * puis pose a la valeur d'AUTORITE renvoyee par le serveur. Relatif d'abord,
 * parce que l'instantane est aussi ecrit par le polling delta : reposer une
 * valeur absolue photographiee avant l'appel ecraserait un message arrive
 * entre-temps depuis un autre onglet.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient, type UseMutationResult } from '@tanstack/react-query';
import { addComment as requestAddComment, deleteComment as requestDeleteComment, listComments } from '@/modules/kanban/api/comments';
import { adjustCardCommentCount, markCardCommentsSeen, setCardCommentCount } from '@/modules/kanban/lib/boardSync';
import { nowTimestamp } from '@/modules/kanban/lib/dates';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import { useCurrentUserId, useKanbanClient, useSessionProfile } from '@/modules/kanban/hooks/useKanbanSession';
import { useMutationFailureToast } from '@/modules/kanban/hooks/mutationFeedback';
import type {
  BoardSnapshot,
  CardComment,
  CommentAddResult,
  CommentDeleteResult,
  CommentListResult,
  UserProfile,
} from '@/modules/kanban/types';
import { shouldRetryKanbanQuery } from '@/modules/kanban/lib/kanbanErrors';

/**
 * Un fil de carte se lit d'un bloc : on demande la premiere page au plafond du
 * serveur plutot que de paginer. `total` reste la verite si un fil devait
 * depasser ce plafond, et l'interface peut le dire.
 */
export const CARD_COMMENTS_PAGE_SIZE = 100;

const EMPTY_THREAD: CommentListResult = { comments: [], total: 0 };

/* Identifiants provisoires : uniques dans l'onglet, le temps d'un aller-retour. */
let temporaryCounter = 0;
function nextTemporaryId(): string {
  temporaryCounter += 1;
  return `tmp-comment-${temporaryCounter}`;
}

/** Instantane de tableau (en cache) qui porte cette carte, s'il y en a un. */
function findSnapshotWithCard(queryClient: QueryClient, cardId: string): BoardSnapshot | undefined {
  const entries = queryClient.getQueriesData<BoardSnapshot>({
    queryKey: KANBAN_QUERY_KEYS.BOARD_PREFIX(),
  });
  for (const [, snapshot] of entries) {
    if (snapshot?.cards.some((card) => card._id === cardId)) return snapshot;
  }
  return undefined;
}

export interface AddCommentVariables {
  text: string;
}

export interface DeleteCommentVariables {
  commentId: string;
}

interface CommentMutationContext {
  /** Fil d'avant-mutation, restaure tel quel en cas d'echec. */
  previous?: CommentListResult;
  /** `true` si le compteur du tableau a bien ete decale : il faut le defaire. */
  adjusted: boolean;
  temporaryId: string;
}

export interface UseCardCommentsResult {
  comments: CardComment[];
  /** Total SERVEUR : peut depasser `comments.length` sur un fil tres long. */
  total: number;
  isLoading: boolean;
  error: Error | null;
  addComment: UseMutationResult<CommentAddResult, Error, AddCommentVariables, CommentMutationContext>;
  deleteComment: UseMutationResult<CommentDeleteResult, Error, DeleteCommentVariables, CommentMutationContext>;
}

/**
 * @param boardId tableau de la carte : il designe la SOURCE du fil (§11.6) —
 *   `kanbanCardComments` pour un board kanban, `comments` de Communecter pour
 *   un board-lien. `null` tant que la carte n'est pas connue.
 * @param cardId `null` = aucune carte ouverte : la query reste desactivee.
 *
 * Les compteurs, eux, sont retrouves dans le cache a partir de la carte : la
 * modale s'ouvre depuis le board comme depuis « mes cartes », ou le board n'est
 * pas forcement charge — et dans ce cas il n'y a simplement aucun compteur a
 * tenir a jour.
 */
export function useCardComments(boardId: string | null, cardId: string | null): UseCardCommentsResult {
  const client = useKanbanClient();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const sessionUser = useSessionProfile();
  // Le fil n'ecrit pas l'instantane du tableau par un `onMutate` a temoin : son
  // rollback lui est propre (compteur relatif), seule la notification est
  // partagee avec les autres mutations.
  const reportFailure = useMutationFailureToast();

  const id = cardId ?? '';
  const board = boardId ?? '';
  const queryKey = KANBAN_QUERY_KEYS.CARD_COMMENTS(userId, board, id);

  const query = useQuery({
    queryKey,
    retry: shouldRetryKanbanQuery,
    queryFn: async ({ signal }) => {
      const thread = await listComments(
        client,
        { boardId: board, cardId: id, limit: CARD_COMMENTS_PAGE_SIZE },
        { signal },
      );
      // Lire le fil le marque VU cote serveur (`views.<userId>`, §11.6) : la
      // pastille « non lus » de la carte tombe au meme instant, ici, plutot
      // qu'au prochain rechargement du tableau.
      updateBoards((snapshot) => markCardCommentsSeen(snapshot, id));
      return thread;
    },
    enabled: userId !== null && id.length > 0 && board.length > 0,
  });

  /** Ecrit le compteur sur TOUS les instantanes en cache qui portent la carte. */
  function updateBoards(apply: (snapshot: BoardSnapshot) => BoardSnapshot): void {
    queryClient.setQueriesData<BoardSnapshot>(
      { queryKey: KANBAN_QUERY_KEYS.BOARD_PREFIX() },
      // `apply` renvoie l'instantane INCHANGE (meme reference) quand la carte
      // n'y est pas : les autres tableaux en cache ne se rerendent donc pas.
      (current) => (current ? apply(current) : current),
    );
  }

  /** Profil d'auteur pour l'affichage optimiste, sans rien inventer de faux. */
  function optimisticAuthor(): UserProfile | null {
    // D'abord le profil PROJETE par le serveur, deja present dans la liste des
    // membres : c'est le meme objet que celui que renverra `comment/add`.
    const fromBoard = findSnapshotWithCard(queryClient, id)?.members.find(
      (member) => member.userId === userId,
    )?.profile;
    if (fromBoard) return fromBoard;

    // Repli : le profil de la session du site (cf. `sessionProfile`), remplace par la
    // reponse du serveur dans la seconde qui suit.
    return sessionUser;
  }

  const addComment = useMutation<CommentAddResult, Error, AddCommentVariables, CommentMutationContext>({
    // Les ecritures d'un meme fil sont SERIALISEES : deux `onMutate` en vol
    // prendraient leur photo sur la meme liste et la seconde ecraserait la premiere.
    scope: { id: `card-comments-${id}` },
    mutationFn: (variables) => requestAddComment(client, { boardId: board, cardId: id, text: variables.text }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentListResult>(queryKey);
      const temporaryId = nextTemporaryId();
      const now = nowTimestamp();
      const optimistic: CardComment = {
        _id: temporaryId,
        boardId: board,
        cardId: id,
        authorId: userId ?? '',
        text: variables.text,
        created: now,
        updated: now,
        author: optimisticAuthor(),
      };
      const base = previous ?? EMPTY_THREAD;
      queryClient.setQueryData<CommentListResult>(queryKey, {
        comments: [...base.comments, optimistic],
        total: base.total + 1,
      });
      updateBoards((snapshot) => adjustCardCommentCount(snapshot, id, 1));
      return { previous, adjusted: true, temporaryId };
    },
    onSuccess: (data, _variables, context) => {
      queryClient.setQueryData<CommentListResult>(queryKey, (current) => {
        const base = current ?? EMPTY_THREAD;
        const comments = base.comments.map((comment) =>
          comment._id === context.temporaryId ? data.comment : comment,
        );
        // Le message n'etait pas dans la liste (fil recharge entre-temps) : on
        // l'ajoute plutot que de le perdre.
        if (!comments.some((comment) => comment._id === data.comment._id)) comments.push(data.comment);
        return { comments, total: data.commentCount };
      });
      // Valeur d'autorite : elle integre les messages des autres onglets.
      updateBoards((snapshot) => setCardCommentCount(snapshot, id, data.commentCount));
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData<CommentListResult>(queryKey, context.previous);
      if (context?.adjusted) updateBoards((snapshot) => adjustCardCommentCount(snapshot, id, -1));
      reportFailure(error);
    },
  });

  const deleteComment = useMutation<CommentDeleteResult, Error, DeleteCommentVariables, CommentMutationContext>({
    scope: { id: `card-comments-${id}` },
    mutationFn: (variables) =>
      requestDeleteComment(client, { boardId: board, cardId: id, commentId: variables.commentId }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentListResult>(queryKey);
      const temporaryId = nextTemporaryId();
      const existed = previous?.comments.some((comment) => comment._id === variables.commentId) ?? false;
      if (previous) {
        queryClient.setQueryData<CommentListResult>(queryKey, {
          comments: previous.comments.filter((comment) => comment._id !== variables.commentId),
          total: Math.max(0, previous.total - (existed ? 1 : 0)),
        });
      }
      // Pas de decalage du compteur si le message n'etait deja plus la : le
      // decrementer deux fois afficherait « 4 commentaires » sur un fil de 5.
      if (existed) updateBoards((snapshot) => adjustCardCommentCount(snapshot, id, -1));
      return { previous, adjusted: existed, temporaryId };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CommentListResult>(queryKey, (current) =>
        current ? { ...current, total: data.commentCount } : current,
      );
      updateBoards((snapshot) => setCardCommentCount(snapshot, id, data.commentCount));
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData<CommentListResult>(queryKey, context.previous);
      if (context?.adjusted) updateBoards((snapshot) => adjustCardCommentCount(snapshot, id, 1));
      reportFailure(error);
    },
  });

  return {
    comments: query.data?.comments ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    addComment,
    deleteComment,
  };
}
