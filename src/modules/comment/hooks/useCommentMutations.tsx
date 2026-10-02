import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Comment, EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import {
  addReply, removeNode, replaceNode, toggleReaction, updateNodeText,
} from "../lib/commentTree";
import { errorMessage, isMaybeWritten, makeOptimisticNode, settleOptimistic } from "../lib/optimistic";
import { toMentionPayload } from "../lib/linkifyMentions";
import { toMediaImgPayload } from "../lib/commentImages";
import type { CommentAuthor, CommentImage, CommentMention, CommentNode, CommentTarget } from "../types";
import type { CommentThreadData } from "./useCommentsQuery";

/**
 * Écritures du fil : poster, répondre, modifier, supprimer, réagir, signaler.
 *
 * Trois partis pris, chacun en réponse à un défaut mesuré de l'implémentation `news` :
 *
 * 1. **L'affichage optimiste est immuable.** `news/utils/commentCacheUtils.ts` écrivait dans
 *    `comment.serverData.replies` ; `onError` restaurait ensuite *la même référence*, déjà
 *    modifiée, et l'annulation n'annulait rien. Ici on ne remplace que `nodes`, un arbre de
 *    nœuds purs : restaurer l'instantané suffit, et un test le prouve.
 *
 * 2. **Un 500 ne veut pas dire « rien n'a été écrit ».** Le bug B8 insérait le commentaire puis
 *    échouait sur la notification. On ne conclut donc pas à l'échec au-delà de 500 : on relit
 *    le fil et on le dit à l'utilisateur (`isMaybeWritten`).
 *
 * 3. **Le module ne connaît pas le compteur de son hôte.** Plutôt que d'aller muter le cache
 *    des news comme le faisait l'ancien code, il notifie `onCountChange` et n'invalide que ses
 *    propres clés. C'est ce qui rend le fil réutilisable par n'importe quelle entité.
 *
 * Les instances du SDK nécessaires aux écritures (`comment.delete()`, `comment.addVote()`…)
 * viennent de l'`index` produit par `useCommentsQuery` : l'arbre rendu, lui, reste pur.
 */
export interface UseCommentMutationsOptions {
  /** La cible du fil — détermine les clés de cache à mettre à jour. */
  readonly target: CommentTarget | null;
  /** L'entité porteuse, indispensable pour poster un message **racine**. */
  readonly entity?: EntityTypes | null;
  /** Index des instances SDK, par identifiant de message (cf. `CommentThreadData`). */
  readonly index?: ReadonlyMap<string, Comment>;
  /**
   * Notifie l'hôte d'une variation du nombre de messages, pour qu'il tienne son propre
   * compteur (badge d'une actualité, par exemple). Appelé à la **confirmation** du serveur,
   * jamais sur l'affichage optimiste : un compteur qui recule après coup est pire qu'un
   * compteur en retard d'une seconde.
   */
  readonly onCountChange?: (delta: number) => void;
  /**
   * Un envoi REFUSÉ net (ni « peut-être écrit », ni incertain) : l'ajout est annulé — le message
   * quitte le fil — et son brouillon est rendu à l'appelant, qui le remet dans le composer. Le
   * texte tapé était perdu (revue du 29/09).
   */
  readonly onSendFailed?: (draft: SendDraft) => void;
}

/** Ce qu'un envoi refusé rend au composer. */
export interface SendDraft {
  readonly text: string;
  readonly mentions: readonly CommentMention[];
  /** Le message auquel on répondait — `null` pour un message racine. */
  readonly parentId: string | null;
}

/** Instantané de toutes les variantes de clé du fil (l'identifiant d'utilisateur en fait partie). */
type ThreadSnapshot = Array<[QueryKey, CommentThreadData | undefined]>;

interface RollbackContext {
  readonly snapshot: ThreadSnapshot;
}

/** Nature de l'écriture, qui choisit les libellés du toast. */
type WriteKind = "add" | "reply" | "edit" | "delete" | "react";

/** Ce qu'un composer fournit pour écrire un message. */
export interface WriteVariables {
  readonly text: string;
  readonly mentions?: readonly CommentMention[];
  /**
   * Les identifiants des documents déjà téléversés (cf. `useCommentImages`).
   *
   * Ils sont joints au message par `mediaImg` ; c'est ensuite `Comment::insert` qui déplace les
   * documents dans le dossier du message qu'il vient de créer.
   */
  readonly imageDocIds?: readonly string[];
  /** Les mêmes images, sous forme d'aperçus locaux, pour l'affichage pendant l'envoi. */
  readonly imagePreviews?: readonly CommentImage[];
}

/**
 * Construit la charge utile d'écriture.
 * `mentions` n'est posé que s'il y en a : le schéma refuse un tableau vide aussi mal qu'une
 * forme incomplète, et un champ absent vaut mieux qu'un champ vide.
 */
function buildPayload(
  { text, mentions, imageDocIds }: WriteVariables,
  path: string | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { text };
  if (path) payload.path = path;
  const list = toMentionPayload(mentions ?? []);
  if (list.length > 0) payload.mentions = list;
  const media = toMediaImgPayload(imageDocIds ?? []);
  if (media) payload.mediaImg = media;
  return payload;
}

export function useCommentMutations({
  target,
  entity = null,
  index,
  onCountChange,
  onSendFailed,
}: UseCommentMutationsOptions) {
  const queryClient = useQueryClient();
  const { me } = useCocolight();
  const t = useT("modules/comment");

  // Toujours le préfixe, jamais la clé complète : `useHydratedUserContextId` vaut `null` au
  // premier rendu, si bien qu'un fil peut vivre sous deux clés voisines dans le cache.
  const prefix = useMemo(
    () => (target ? COMMENT_QUERY_KEYS.THREAD_PREFIX(target) : null),
    [target],
  );

  /** L'auteur à afficher pendant l'envoi : soi-même. */
  const meAsAuthor = useMemo<CommentAuthor>(() => {
    const data = (me as unknown as { serverData?: Record<string, unknown> } | null)?.serverData ?? {};
    const avatar = data.profilThumbImageUrl ?? data.profilImageUrl;
    return {
      id: (me as unknown as { id?: string } | null)?.id ?? "",
      name: typeof data.name === "string" ? data.name : "",
      slug: typeof data.slug === "string" ? data.slug : null,
      avatarUrl: typeof avatar === "string" && avatar ? avatar : null,
    };
  }, [me]);

  /** Applique une transformation **pure** à l'arbre, dans toutes les variantes de clé. */
  const applyToThread = useCallback(
    (transform: (nodes: readonly CommentNode[]) => readonly CommentNode[]) => {
      if (!prefix) return;
      queryClient.setQueriesData<CommentThreadData>({ queryKey: prefix }, old => {
        if (!old) return old;
        const nodes = transform(old.nodes);
        // `mapNode` rend la même référence quand rien ne change : on évite alors un rendu.
        // `host` est reconduit tel quel : une mise à jour optimiste ne change que l'arbre.
        return nodes === old.nodes ? old : { nodes, index: old.index, host: old.host };
      });
    },
    [queryClient, prefix],
  );

  const snapshotThread = useCallback(async (): Promise<ThreadSnapshot> => {
    if (!prefix) return [];
    // Sans cette annulation, une lecture déjà partie écraserait la mise à jour optimiste.
    await queryClient.cancelQueries({ queryKey: prefix });
    return queryClient.getQueriesData<CommentThreadData>({ queryKey: prefix });
  }, [queryClient, prefix]);

  const restoreThread = useCallback(
    (snapshot: ThreadSnapshot | undefined) => {
      for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
    },
    [queryClient],
  );

  const refreshThread = useCallback(() => {
    if (prefix) void queryClient.invalidateQueries({ queryKey: prefix });
  }, [queryClient, prefix]);

  /**
   * Le PANNEAU, et non le fil.
   *
   * Les colonnes « espaces » et « fils » portent un nombre de messages, un nombre de non-lus et
   * une date de dernière activité — trois choses que cette écriture vient de changer, et qui
   * vivent sous d'autres clés de cache que le fil.
   *
   * Sans cette invalidation, elles ne l'apprenaient que du TEMPS RÉEL, ou à défaut au prochain
   * rafraîchissement automatique : jusqu'à 30 secondes d'attente en mode dégradé, qui est le
   * mode de tout déploiement sans hub — donc de tout le développement local. On voyait alors
   * son propre message apparaître dans le fil pendant que la colonne d'à côté continuait
   * d'annoncer l'ancien compte.
   *
   * ⚠️ Ce n'est pas un couplage vers l'hôte, que la règle du module interdit : `DISCUSSIONS` est
   * une clé de CE module. Le compteur de l'hôte, lui, passe toujours par `onCountChange`.
   *
   * Par PRÉFIXE, jamais par clé complète : `userContextId` vaut `null` au premier rendu, si bien
   * qu'une même vue peut vivre sous deux clés voisines.
   *
   * Le coût est nul quand le panneau n'est pas monté — et c'est le cas le plus fréquent, le fil
   * étant surtout rendu dans une fiche. Sans observateur, React Query marque la requête périmée
   * sans la relancer.
   */
  const refreshPanel = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
  }, [queryClient]);

  /**
   * Conduite commune en cas d'échec d'écriture.
   * Au-delà de 500 on ne tranche pas : l'instantané est restauré **et** le fil relu, parce que
   * le serveur a pu écrire avant de tomber.
   */
  const handleWriteError = useCallback(
    (kind: WriteKind, error: unknown, context: RollbackContext | undefined, draft?: SendDraft) => {
      restoreThread(context?.snapshot);

      if (isMaybeWritten(error)) {
        refreshThread();
        // Le serveur a PEUT-ÊTRE écrit : les compteurs du panneau ont donc peut-être bougé.
        refreshPanel();
        const uncertain = kind === "add" || kind === "reply" ? "toast.maybeSent" : "toast.maybeApplied";
        toast.warning(String(t(uncertain)));
        return;
      }

      // Un envoi refusé rend son brouillon : le dire vaut mieux que le détail technique du refus.
      const rendu = draft !== undefined && onSendFailed !== undefined;
      toast.error(String(t(`toast.${kind}Error`)), {
        description: rendu ? String(t("toast.draftRestored")) : errorMessage(error, ""),
      });
      if (rendu) onSendFailed(draft);
    },
    [restoreThread, refreshThread, refreshPanel, t, onSendFailed],
  );

  /** Récupère l'instance SDK d'un message, seule capable d'écrire sur lui. */
  const requireInstance = useCallback(
    (commentId: string): Comment => {
      const instance = index?.get(commentId);
      if (!instance) {
        throw new Error(`Message « ${commentId} » introuvable dans le fil chargé.`);
      }
      return instance;
    },
    [index],
  );

  // ─────────────────────────────── poster un message ───────────────────────────────

  const add = useMutation({
    mutationFn: async (variables: WriteVariables) => {
      if (!entity) {
        throw new Error("Impossible de poster : l'entité porteuse du fil n'est pas chargée.");
      }
      const draft = await (entity as unknown as {
        comment: (data: Record<string, unknown>) => Promise<Comment>;
      }).comment(buildPayload(variables, target?.path ?? null));
      await draft.save();
      return draft;
    },

    onMutate: async ({ text, mentions, imagePreviews }) => {
      const snapshot = await snapshotThread();
      const optimistic = makeOptimisticNode({
        text, author: meAsAuthor, path: target?.path ?? null, mentions, images: imagePreviews,
      });
      applyToThread(nodes => addReply(nodes, null, optimistic));
      return { snapshot, optimistic };
    },

    onSuccess: (created, _variables, context) => {
      // On ne pose que l'identifiant réel sur le message déjà affiché : le contenu définitif
      // (dates du serveur, auteur résolu) arrive avec la relecture qui suit.
      applyToThread(nodes =>
        replaceNode(nodes, context.optimistic.id, settleOptimistic(context.optimistic, created.id ?? null)),
      );
      onCountChange?.(1);
      refreshThread();
      refreshPanel();
      toast.success(String(t("toast.addSuccess")));
    },

    onError: (error, variables, context) => handleWriteError("add", error, context, {
      text: variables.text, mentions: variables.mentions ?? [], parentId: null,
    }),
  });

  // ─────────────────────────────── répondre ───────────────────────────────

  const reply = useMutation({
    mutationFn: async ({ parentId, ...variables }: WriteVariables & { parentId: string }) => {
      const parent = requireInstance(parentId);
      const draft = await (parent as unknown as {
        comment: (data: Record<string, unknown>) => Promise<Comment>;
      }).comment(buildPayload(variables, null));
      await draft.save();
      return draft;
    },

    onMutate: async ({ parentId, text, mentions, imagePreviews }) => {
      const snapshot = await snapshotThread();
      const optimistic = makeOptimisticNode({
        text, author: meAsAuthor, parentId, mentions, images: imagePreviews,
      });
      applyToThread(nodes => addReply(nodes, parentId, optimistic));
      return { snapshot, optimistic };
    },

    onSuccess: (created, _variables, context) => {
      applyToThread(nodes =>
        replaceNode(nodes, context.optimistic.id, settleOptimistic(context.optimistic, created.id ?? null)),
      );
      onCountChange?.(1);
      refreshThread();
      refreshPanel();
      toast.success(String(t("toast.replySuccess")));
    },

    onError: (error, variables, context) => handleWriteError("reply", error, context, {
      text: variables.text, mentions: variables.mentions ?? [], parentId: variables.parentId,
    }),
  });

  // ─────────────────────────────── modifier ───────────────────────────────

  const edit = useMutation({
    mutationFn: async (
      { commentId, text, mentions, imageDocIds }: {
        commentId: string; text: string; mentions?: readonly CommentMention[]; imageDocIds?: readonly string[];
      },
    ) => {
      const instance = requireInstance(commentId);
      instance.data.text = text;
      // Les mentions sont RECALCULÉES sur le texte édité (celles encore présentes), jamais reprises
      // de la lecture : le serveur efface `mentions` quand la requête les omet, et garderait des
      // mentions périmées si on renvoyait les anciennes. Vide : le SDK n'envoie rien, le serveur
      // les retire — exactement l'effet d'une édition qui les a toutes ôtées.
      (instance.data as Record<string, unknown>).mentions = toMentionPayload(mentions ?? []);
      // Les images sont REPOSÉES à chaque édition, même inchangées : `Comment::update` fait
      // `$unset mediaImg` dès que le champ manque à la requête, si bien qu'une correction de
      // texte effacerait les pièces jointes du message. Le SDK sait réduire cette valeur à des
      // identifiants ; on la lui donne ici explicitement plutôt que de compter sur ce que le
      // brouillon a retenu de la lecture.
      const media = toMediaImgPayload(imageDocIds ?? []);
      if (media) (instance.data as Record<string, unknown>).mediaImg = media;
      await instance.save();
      return instance;
    },

    onMutate: async ({ commentId, text }) => {
      const snapshot = await snapshotThread();
      applyToThread(nodes => updateNodeText(nodes, commentId, text, Math.floor(Date.now() / 1000)));
      return { snapshot };
    },

    onSuccess: () => {
      refreshThread();
      toast.success(String(t("toast.editSuccess")));
    },

    onError: (error, _variables, context) => handleWriteError("edit", error, context),
  });

  // ─────────────────────────────── supprimer ───────────────────────────────

  const remove = useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const instance = requireInstance(commentId);
      await instance.delete();
      return commentId;
    },

    onMutate: async ({ commentId }) => {
      const snapshot = await snapshotThread();
      applyToThread(nodes => removeNode(nodes, commentId));
      return { snapshot };
    },

    onSuccess: () => {
      // UN message, comme le serveur : `Comment::delete` n'efface que lui (pas de cascade) et
      // `Action::addAction` ne décompte qu'une unité. Ses réponses deviennent orphelines — elles
      // quittent l'affichage mais restent COMPTÉES côté serveur. Annoncer la branche entière
      // faisait sauter le compteur de l'hôte au rechargement (revue du 29/09).
      onCountChange?.(-1);
      refreshThread();
      refreshPanel();
      toast.success(String(t("toast.deleteSuccess")));
    },

    onError: (error, _variables, context) => handleWriteError("delete", error, context),
  });

  // ─────────────────────────────── réagir ───────────────────────────────

  // Le serveur BASCULE : reposer la même réaction la retire (mesuré sur le backend réel).
  // `toggleReaction` reproduit donc exactement ce que la relecture confirmera.
  const react = useMutation({
    mutationFn: async ({ commentId, reaction }: { commentId: string; reaction: string }) => {
      const instance = requireInstance(commentId);
      await instance.addVote(reaction);
      return { commentId, reaction };
    },

    onMutate: async ({ commentId, reaction }) => {
      const snapshot = await snapshotThread();
      applyToThread(nodes => toggleReaction(nodes, commentId, reaction));
      return { snapshot };
    },

    onSuccess: ({ commentId }) => {
      // Les votants sont une autre requête : leur liste est périmée dès qu'on a réagi.
      void queryClient.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.VOTERS_PREFIX(commentId) });
      refreshThread();
    },

    onError: (error, _variables, context) => handleWriteError("react", error, context),
  });

  // ─────────────────────────────── signaler ───────────────────────────────

  const report = useMutation({
    mutationFn: async ({ commentId, reason, details }: {
      commentId: string;
      reason: string;
      details?: string;
    }) => {
      const instance = requireInstance(commentId);
      await instance.addReportAbuse({ reason, comment: details });
      return commentId;
    },

    onSuccess: () => {
      toast.success(String(t("toast.reportSuccess")));
    },

    onError: (error: unknown) => {
      toast.error(String(t("toast.reportError")), { description: errorMessage(error, "") });
    },
  });

  return { add, reply, edit, remove, react, report };
}

export type CommentMutations = ReturnType<typeof useCommentMutations>;
