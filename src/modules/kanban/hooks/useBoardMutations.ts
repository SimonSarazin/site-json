/**
 * Mutations d'un tableau, toutes OPTIMISTES.
 *
 * Le schema est le meme pour toutes : `onMutate` prend une photo du cache et
 * applique le changement immediatement, `onError` restaure la photo et
 * previent l'utilisateur, `onSuccess` remplace l'etat optimiste par la verite
 * du serveur (y compris une renumerotation de rangs).
 *
 * Il n'y a volontairement AUCUNE invalidation systematique dans `onSettled` :
 * invalider `board/get` apres chaque carte deplacee ferait recharger tout le
 * tableau a chaque glisser-deposer. La reconciliation avec les autres
 * utilisateurs est le travail du polling delta (`useBoardSync`).
 *
 * Deux garde-fous encadrent cet optimisme, parce que le cache est ECRIT PAR
 * PLUSIEURS SOURCES (ces mutations, les jalons et le polling delta) :
 *  - les mutations d'un MEME tableau sont SERIALISEES (`scope`) — pour leur
 *    EXECUTION seulement : TanStack Query joue `onMutate` AVANT de consulter la
 *    file, donc deux `onMutate` peuvent bien photographier le meme instantane ;
 *    c'est le second garde-fou qui rend ce cas inoffensif ;
 *  - le rollback est CONDITIONNEL : il ne restaure la photo d'avant que si le
 *    cache est reste exactement celui qu'on avait ecrit. Sinon on invalide.
 *    Restaurer aveuglement une photo perimee ressusciterait les entites
 *    provisoires (`tmp-N`) deja remplacees et annulerait la renumerotation
 *    decidee par le serveur entre-temps.
 *
 * Les deux SOURCES de tableau (§11) passent par les memes mutations : les
 * routes de carte recoivent toutes `boardId`, et les regles propres a un
 * board-lien (ordre canonique, statut derive de la colonne, tags) vivent dans
 * l'algebre pure de `lib/boardSync`.
 *
 * Le triplet « photo / application / restauration » se repetant a chaque mutation, il
 * est factorise dans `buildOptions` — une fabrique typee, pas un copier-coller.
 * La file, le rollback et la notification d'echec sont ceux de
 * `mutationFeedback`, partages avec les autres hooks qui ecrivent le tableau.
 */
import { useMutation, useQueryClient, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  archiveCard as requestArchiveCard,
  createCard as requestCreateCard,
  moveCard as requestMoveCard,
  updateCard as requestUpdateCard,
  type CreateCardInput,
  type UpdateCardInput,
} from '@/modules/kanban/api/cards';
import { moveColumn as requestMoveColumn } from '@/modules/kanban/api/columns';
import { useCurrentUserId, useKanbanClient } from '@/modules/kanban/hooks/useKanbanSession';
import { useInterfaceLanguage } from '@/modules/kanban/hooks/useInterfaceLanguage';
import {
  boardMutationScope,
  rollbackBoardSnapshot,
  useMutationFailureToast,
  writeOptimisticSnapshot,
} from '@/modules/kanban/hooks/mutationFeedback';
import { snapshotSource } from '@/modules/kanban/lib/boardSource';
import { canonicalRank } from '@/modules/kanban/lib/canonicalOrder';
import { KANBAN_QUERY_KEYS } from '@/modules/kanban/constants/queryKeys';
import { nowTimestamp } from '@/modules/kanban/lib/dates';
import { placeAt, placeRelativeTo, type RankPlacement } from '@/modules/kanban/lib/rank';
import {
  applyRankUpdates,
  buildOptimisticCard,
  cardPatchFromUpdate,
  moveCardInSnapshot,
  moveColumnInSnapshot,
  patchCard,
  removeCard,
  replaceCard,
  upsertCard,
  upsertColumn,
} from '@/modules/kanban/lib/boardSync';
import type {
  BoardSnapshot,
  BoardSource,
  Card,
  CardArchiveResult,
  ColumnMoveResult,
  CardMoveResult,
} from '@/modules/kanban/types';

/* -------------------------------------------------------------------------- */
/*  Variables des mutations                                                   */
/* -------------------------------------------------------------------------- */

export type CreateCardVariables = Omit<CreateCardInput, 'boardId'>;
export type UpdateCardVariables = Omit<UpdateCardInput, 'boardId'>;

export interface MoveCardVariables {
  cardId: string;
  columnId: string;
  /**
   * Position visee PARMI LES AUTRES cartes de la colonne d'arrivee (la carte
   * deplacee etant retiree de la liste) — c'est ce que donne un depot dnd-kit.
   * Les ancres explicites priment si elles sont fournies. Ignorees sur un
   * board-lien, dont l'ordre est canonique (D16).
   */
  index?: number;
  beforeCardId?: string;
  afterCardId?: string;
}

export interface ArchiveCardVariables {
  cardId: string;
}

export interface MoveColumnVariables {
  columnId: string;
  index?: number;
  beforeColumnId?: string;
  afterColumnId?: string;
}

export interface BoardMutations {
  createCard: UseMutationResult<Card, Error, CreateCardVariables, SnapshotMutationContext>;
  updateCard: UseMutationResult<Card, Error, UpdateCardVariables, SnapshotMutationContext>;
  moveCard: UseMutationResult<CardMoveResult, Error, MoveCardVariables, SnapshotMutationContext>;
  archiveCard: UseMutationResult<CardArchiveResult, Error, ArchiveCardVariables, SnapshotMutationContext>;
  moveColumn: UseMutationResult<ColumnMoveResult, Error, MoveColumnVariables, SnapshotMutationContext>;
}

export interface SnapshotMutationContext {
  /** Photo d'avant-mutation, restauree telle quelle en cas d'echec. */
  previous?: BoardSnapshot;
  /**
   * Instantane REELLEMENT ecrit dans le cache par `onMutate`.
   *
   * Sert de temoin au rollback : si le cache ne porte plus cette reference
   * exacte, c'est qu'une autre ecriture est passee depuis, et la photo
   * `previous` est devenue fausse.
   */
  optimistic?: BoardSnapshot;
  /** Identifiant provisoire d'une entite creee, remplace a la reponse. */
  temporaryId: string;
}

/*
 * Compteur de module : les identifiants provisoires n'ont besoin d'etre
 * uniques que dans l'onglet courant, le temps d'un aller-retour serveur. Il
 * n'est jamais atteint au rendu serveur (aucune mutation n'y est declenchee).
 */
let temporaryCounter = 0;
function nextTemporaryId(): string {
  temporaryCounter += 1;
  return `tmp-${temporaryCounter}`;
}

/* -------------------------------------------------------------------------- */
/*  Corps et placements : meme calcul pour l'optimiste et pour l'envoi         */
/* -------------------------------------------------------------------------- */

/**
 * Corps de `card/create` selon la source.
 *
 * Un board-lien n'a ni position (ordre canonique, D16), ni statut choisi
 * (derive de la colonne), ni etiquettes de tableau (ce sont ses tags), ni liens
 * (§11.4) : ces champs ne partent pas, plutot que d'etre ignores en silence
 * par le serveur — un champ envoye se lit comme un champ pris en compte.
 */
export function createCardBody(
  source: BoardSource,
  boardId: string,
  variables: CreateCardVariables,
): CreateCardInput {
  if (source !== 'communecter') return { boardId, ...variables };
  const { position: _position, status: _status, labelIds: _labelIds, links: _links, ...rest } = variables;
  return { boardId, ...rest };
}

function resolveCardPlacement(snapshot: BoardSnapshot, variables: MoveCardVariables): RankPlacement {
  // La carte deplacee est retiree de la liste de reference : le calcul est
  // alors identique avant et apres l'application optimiste.
  const siblings = snapshot.cards.filter(
    (card) => card.columnId === variables.columnId && card._id !== variables.cardId,
  );
  if (variables.beforeCardId) return placeRelativeTo(siblings, variables.beforeCardId, 'before');
  if (variables.afterCardId) return placeRelativeTo(siblings, variables.afterCardId, 'after');
  return placeAt(siblings, variables.index ?? siblings.length);
}

function resolveColumnPlacement(snapshot: BoardSnapshot, variables: MoveColumnVariables): RankPlacement {
  const siblings = snapshot.columns.filter((column) => column._id !== variables.columnId);
  if (variables.beforeColumnId) return placeRelativeTo(siblings, variables.beforeColumnId, 'before');
  if (variables.afterColumnId) return placeRelativeTo(siblings, variables.afterColumnId, 'after');
  return placeAt(siblings, variables.index ?? siblings.length);
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

export function useBoardMutations(boardId: string): BoardMutations {
  const client = useKanbanClient();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const { t } = useTranslation('modules/kanban');
  const lang = useInterfaceLanguage();
  const reportFailure = useMutationFailureToast();

  const queryKey = KANBAN_QUERY_KEYS.BOARD(userId, boardId);
  const readSnapshot = () => queryClient.getQueryData<BoardSnapshot>(queryKey);
  /** Source du tableau en cache ; `kanban` tant qu'il n'est pas charge (aucun geste possible alors). */
  const readSource = (): BoardSource => {
    const snapshot = readSnapshot();
    return snapshot ? snapshotSource(snapshot) : 'kanban';
  };

  interface SnapshotMutationConfig<TData, TVariables> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    /** Applique le changement AVANT la reponse du serveur. */
    optimistic?: (snapshot: BoardSnapshot, variables: TVariables, temporaryId: string) => BoardSnapshot;
    /** Remplace l'etat optimiste par la verite du serveur. */
    reconcile?: (
      snapshot: BoardSnapshot,
      data: TData,
      variables: TVariables,
      temporaryId: string,
    ) => BoardSnapshot;
    /** Effets de bord non caches (avertissement WIP, par exemple). */
    afterSuccess?: (data: TData) => void;
  }

  function buildOptions<TData, TVariables>(
    config: SnapshotMutationConfig<TData, TVariables>,
  ): UseMutationOptions<TData, Error, TVariables, SnapshotMutationContext> {
    return {
      mutationFn: config.mutationFn,

      // Une file PAR TABLEAU, partagee avec l'administration et les jalons
      // (cf. `boardMutationScope`).
      scope: boardMutationScope(boardId),

      onMutate: async (variables) => {
        // Une requete `board/get` en vol ecraserait l'etat optimiste des
        // qu'elle repondrait : on l'annule avant de toucher au cache.
        await queryClient.cancelQueries({ queryKey });
        const previous = readSnapshot();
        const temporaryId = nextTemporaryId();
        if (!previous || !config.optimistic) return { previous, temporaryId };

        // Le temoin du rollback est la reference STOCKEE (partage structurel).
        const optimistic = writeOptimisticSnapshot(
          queryClient,
          queryKey,
          config.optimistic(previous, variables, temporaryId),
        );
        return { previous, optimistic, temporaryId };
      },

      onSuccess: (data, variables, onMutateResult) => {
        if (config.reconcile) {
          queryClient.setQueryData<BoardSnapshot>(queryKey, (current) =>
            current ? config.reconcile?.(current, data, variables, onMutateResult.temporaryId) : current,
          );
        }
        config.afterSuccess?.(data);
      },

      onError: (error, _variables, onMutateResult) => {
        // Restauration integrale (jamais champ par champ : les compteurs
        // derives — cardCount, counts.done — resteraient desynchronises), et
        // seulement si le cache n'a pas bouge depuis (`rollbackBoardSnapshot`) :
        // reposer une photo perimee ressusciterait une carte provisoire `tmp-N`
        // deja remplacee, ou annulerait une renumerotation du serveur.
        rollbackBoardSnapshot(queryClient, queryKey, onMutateResult);
        reportFailure(error);
      },
    };
  }

  const createCard = useMutation(
    buildOptions<Card, CreateCardVariables>({
      mutationFn: (variables) => {
        // La MEME colonne que la carte optimiste : sans colonne demandee, la
        // premiere du tableau. Un board-lien l'exige (sa colonne EST le statut
        // de l'action : 422 sans elle), un board kanban ferait le meme choix.
        const columnId = variables.columnId ?? readSnapshot()?.columns[0]?._id;
        return requestCreateCard(client, createCardBody(readSource(), boardId, { ...variables, columnId }));
      },
      optimistic: (snapshot, variables, temporaryId) => {
        const card = buildOptimisticCard(snapshot, variables, {
          temporaryId,
          userId,
          now: nowTimestamp(),
        });
        return card ? upsertCard(snapshot, card) : snapshot;
      },
      reconcile: (snapshot, card, _variables, temporaryId) => replaceCard(snapshot, temporaryId, card),
    }),
  );

  const updateCard = useMutation(
    buildOptions<Card, UpdateCardVariables>({
      mutationFn: (variables) => requestUpdateCard(client, { boardId, ...variables }),
      optimistic: (snapshot, variables) => {
        const { cardId, ...fields } = variables;
        // La carte du cache sert de valeur ACTUELLE a la fusion des listes
        // envoyees avec leur base (board-lien) : l'optimiste montre deja ce que
        // le serveur va repondre.
        const current = snapshot.cards.find((card) => card._id === cardId);
        return patchCard(snapshot, cardId, cardPatchFromUpdate(snapshot, fields, current));
      },
      reconcile: (snapshot, card) => upsertCard(snapshot, card),
    }),
  );

  const moveCard = useMutation(
    buildOptions<CardMoveResult, MoveCardVariables>({
      mutationFn: (variables) => {
        const snapshot = readSnapshot();
        if (snapshot && snapshotSource(snapshot) === 'communecter') {
          // D16 : l'ordre d'un board-lien est canonique, une intention
          // avant/apres serait ignoree — elle ne part donc pas. Un depot dans
          // la meme colonne n'arrive pas jusqu'ici : KanbanBoard compare les
          // intentions et « Deplacer vers… » ne part que si la colonne change.
          // Ce hook ne filtre pas : un appel « meme colonne » partirait, et le
          // serveur n'ecrirait rien (§11.9, E1).
          return requestMoveCard(client, { boardId, cardId: variables.cardId, columnId: variables.columnId });
        }
        const placement = snapshot ? resolveCardPlacement(snapshot, variables) : null;
        return requestMoveCard(client, {
          boardId,
          cardId: variables.cardId,
          columnId: variables.columnId,
          // Le client envoie une INTENTION ; c'est le serveur qui calcule le
          // rang definitif et arbitre entre deux deplacements concurrents.
          beforeCardId: placement?.beforeId ?? variables.beforeCardId,
          afterCardId: placement?.afterId ?? variables.afterCardId,
        });
      },
      optimistic: (snapshot, variables) => {
        if (snapshotSource(snapshot) === 'communecter') {
          // Placement au rang CANONIQUE, le meme calcul que le serveur : la
          // carte tombe d'emblee a sa place definitive (et revient a la sienne
          // si on l'a deposee ailleurs dans sa propre colonne). Le rang ne
          // depend que de la carte, pas de ses voisines (§11.9).
          const card = snapshot.cards.find((entry) => entry._id === variables.cardId);
          if (!card) return snapshot;
          return moveCardInSnapshot(snapshot, {
            cardId: variables.cardId,
            columnId: variables.columnId,
            rank: canonicalRank(card),
          });
        }
        const placement = resolveCardPlacement(snapshot, variables);
        return moveCardInSnapshot(snapshot, {
          cardId: variables.cardId,
          columnId: variables.columnId,
          rank: placement.rank,
        });
      },
      reconcile: (snapshot, data) => {
        const next = upsertCard(snapshot, data.card);
        // La renumerotation du serveur fait autorite : les rangs calcules
        // localement ne veulent plus rien dire apres son passage.
        return data.renumbered ? applyRankUpdates(next, 'cards', data.renumbered) : next;
      },
      afterSuccess: (data) => {
        if (!data.wipWarning) return;
        // La limite WIP avertit, elle ne bloque pas : c'est un signal
        // d'animation d'equipe, pas une erreur.
        toast.warning(t('toast.wipExceeded', { defaultValue: 'Limite de cartes depassee' }), {
          description: t('toast.wipExceededDetail', {
            cards: data.wipWarning.count,
            limit: data.wipWarning.limit,
            defaultValue: '{{cards}} cartes dans cette colonne pour une limite de {{limit}}.',
          }),
        });
      },
    }),
  );

  /*
   * Archiver retire la carte du tableau comme une suppression — c'est le meme
   * effet a l'ecran — sans rien detruire : `archived: true` sur un board
   * kanban, `status: "disabled"` sur une action Communecter (§11.6).
   */
  const archiveCard = useMutation(
    buildOptions<CardArchiveResult, ArchiveCardVariables>({
      mutationFn: (variables) => requestArchiveCard(client, { boardId, cardId: variables.cardId }),
      optimistic: (snapshot, variables) => removeCard(snapshot, variables.cardId),
    }),
  );

  const moveColumn = useMutation(
    buildOptions<ColumnMoveResult, MoveColumnVariables>({
      mutationFn: (variables) => {
        const snapshot = readSnapshot();
        const placement = snapshot ? resolveColumnPlacement(snapshot, variables) : null;
        return requestMoveColumn(client, {
          // `boardId` designe la source : sur un board-lien, le deplacement
          // reecrit l'ordre des colonnes du projet (§11.6).
          boardId,
          columnId: variables.columnId,
          beforeColumnId: placement?.beforeId ?? variables.beforeColumnId,
          afterColumnId: placement?.afterId ?? variables.afterColumnId,
          // Les colonnes renvoyees portent le libelle personnalise de CETTE langue.
          lang,
        });
      },
      optimistic: (snapshot, variables) => {
        const placement = resolveColumnPlacement(snapshot, variables);
        return moveColumnInSnapshot(snapshot, variables.columnId, placement.rank);
      },
      reconcile: (snapshot, data) => {
        const next = upsertColumn(snapshot, data.column);
        // Board-lien : le rang est une POSITION, toutes les colonnes bougent et
        // le serveur les renvoie toutes (§11.9).
        return data.renumbered ? applyRankUpdates(next, 'columns', data.renumbered) : next;
      },
    }),
  );

  return { createCard, updateCard, moveCard, archiveCard, moveColumn };
}
