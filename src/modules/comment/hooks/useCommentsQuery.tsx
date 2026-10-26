import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import cocolightApiClient from "@communecter/cocolight-api-client";
import type { Comment, EntityTypes } from "@communecter/cocolight-api-client";
import { transformToEntityInstance } from "@/lib/entityTransform";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { toCommentTree } from "../lib/commentTree";
import { apiMethodForType } from "../lib/resolveTarget";
import { TargetNotFoundError, isMissingDocument } from "../lib/targetNotFound";
import type { CommentNode, CommentTarget } from "../types";

const { isReactive } = cocolightApiClient;
const { createFromCollection } = cocolightApiClient.helper as unknown as {
  createFromCollection: (collection: string, parent: unknown, data: object) => EntityTypes | null;
};

/**
 * Données d'un fil, telles qu'elles vivent dans le cache.
 *
 * Deux vues de la même chose, et c'est délibéré :
 *   - `nodes` est l'arbre **pur**, celui que rend l'interface et que les mises à jour
 *     optimistes remplacent de façon immuable ;
 *   - `index` garde les instances du SDK, dont les mutations ont besoin pour agir
 *     (`parent.comment()`, `comment.delete()`, `comment.addVote()`).
 *
 * L'index n'est reconstruit qu'au rechargement : une mise à jour optimiste ne fait que
 * remplacer `nodes`, si bien que restaurer un instantané annule réellement la modification.
 */
export interface CommentThreadData {
  readonly nodes: readonly CommentNode[];
  readonly index: ReadonlyMap<string, Comment>;
  /**
   * L'entité porteuse effectivement résolue.
   *
   * Elle est RENDUE à l'appelant, et pas seulement utilisée ici, parce que l'écriture d'un
   * message RACINE en dépend hors de cette requête — comme, à défaut d'un contexte fourni, le
   * périmètre de la recherche de mentions. Sans elle, un fil ouvert depuis le panneau, où l'on
   * ne passe qu'une cible, refusait toute contribution. Défaut vu au navigateur.
   */
  readonly host: EntityTypes | null;
}

/** Parcourt l'arbre d'instances et indexe chaque message par son identifiant. */
function indexEntities(list: readonly Comment[]): Map<string, Comment> {
  const index = new Map<string, Comment>();
  const walk = (items: readonly unknown[]) => {
    for (const item of items) {
      const entity = item as Comment & { serverData?: { replies?: unknown[] } };
      if (entity?.id) index.set(entity.id, entity);
      const replies = entity?.serverData?.replies;
      if (Array.isArray(replies)) walk(replies);
    }
  };
  walk(list);
  return index;
}

export interface UseCommentsQueryOptions {
  /**
   * L'entité porteuse, quand la page l'a déjà chargée — cas nominal : aucun appel
   * supplémentaire, et c'est la seule voie pour `news` et `actions` (voir `resolveTarget`).
   */
  readonly entity?: EntityTypes | null;
  /** La cible, quand on n'a qu'un couple (type, id) — cas du lien profond. */
  readonly target?: CommentTarget | null;
  readonly enabled?: boolean;
}

/**
 * Charge le fil d'une entité, quel que soit son type.
 *
 * Remplace `useNewsCommentsQuery`, qui n'était couplé à `news` que par deux endroits :
 * l'appel `news.getComments()` et le parent passé à `transformToEntityInstance`.
 */
export function useCommentsQuery({ entity, target, enabled = true }: UseCommentsQueryOptions) {
  const queryClient = useQueryClient();
  const { api, helper, me } = useCocolight();
  // Le client sert de parent au registre d'entités, faute d'entité porteuse connue.
  const client = (api as unknown as { client?: unknown }).client ?? null;
  // `null` au premier rendu, puis la vraie valeur après hydratation : c'est pourquoi toute
  // invalidation se fait par préfixe et jamais sur la clé complète.
  const userContextId = useHydratedUserContextId();

  // La cible effective : celle qu'on nous donne, sinon celle qu'on déduit de l'entité.
  const effectiveTarget = useMemo<CommentTarget | null>(() => {
    if (target) return target;
    if (!entity?.id) return null;
    const type = (entity as unknown as { getEntityType?: () => string }).getEntityType?.();
    return type ? ({ type, id: entity.id, path: null } as CommentTarget) : null;
  }, [target, entity]);

  const queryKey = effectiveTarget
    ? COMMENT_QUERY_KEYS.THREAD(effectiveTarget, userContextId)
    : COMMENT_QUERY_KEYS.THREAD_NONE();

  const query = useQuery({
    queryKey,
    enabled: enabled && !!effectiveTarget,
    staleTime: 30_000,
    /**
     * Un élément supprimé ne réapparaîtra pas, et une erreur de lecture de fil n'est presque
     * jamais transitoire. Les trois tentatives par défaut de React Query faisaient patienter
     * ~15 s sur « Chargement de la discussion… » avant un message pourtant juste — mesuré sur
     * un lien périmé vers un formulaire. Une seule reprise suffit à absorber un vrai hoquet.
     */
    retry: (failureCount, error) => !(error instanceof TargetNotFoundError) && failureCount < 1,
    queryFn: async (): Promise<CommentThreadData> => {
      if (!effectiveTarget) throw new Error("Aucune cible de discussion");

      // L'entité fournie par la page est préférée : elle évite un chargement et couvre
      // `news` et `actions`, que `api` ne sait pas résoudre seul.
      let host: EntityTypes | null = entity ?? null;
      if (!host) {
        const method = apiMethodForType(effectiveTarget.type);
        if (method) {
          // Huit types sur dix : la méthode racine rend une entité CHARGÉE.
          host = await (api as unknown as Record<string, (d: object) => Promise<EntityTypes>>)[method](
            { id: effectiveTarget.id },
          );
          if (host && isMissingDocument(host)) throw new TargetNotFoundError(effectiveTarget);
        } else {
          // `news` et `actions` n'ont pas de méthode racine (B9). Le registre d'entités du SDK,
          // lui, couvre les douze collections : il rend une coquille portant l'identifiant, ce
          // qui suffit à lire le fil — mesuré sur une action réelle. Sans ce repli, la 3ᵉ
          // colonne du panneau reste vide sur un lien profond vers une actualité ou une action.
          host = createFromCollection(effectiveTarget.type, client, { id: effectiveTarget.id });
        }
        if (!host) {
          throw new Error(`Le type « ${effectiveTarget.type} » n'a pas pu être résolu.`);
        }
      }

      // Le fil d'une QUESTION se lit par son `path` : sans lui, GET_COMMENTS rend les messages de
      // TOUS les fils de l'élément — sur un formulaire, ceux de toutes ses questions mêlés.
      const raw = await (host as unknown as { getComments: (o?: { path?: string }) => Promise<Comment[]> })
        .getComments(effectiveTarget.path ? { path: effectiveTarget.path } : undefined);
      const list = Array.isArray(raw) ? raw : [];
      const arbre = toCommentTree(list, { meId: me?.id ?? null });

      return {
        // Un fil RACINE ne garde que ses propres messages, ceux sans `path` : la lecture sans
        // `path` rend aussi ceux des autres fils de l'élément, qui ont chacun le leur.
        nodes: effectiveTarget.path ? arbre : arbre.filter(node => node.path === null),
        index: indexEntities(list),
        host,
      };
    },
  });

  // Après un rendu serveur, les entités arrivent en objets nus : il faut les retransformer
  // une fois, sans quoi les instances du cache n'ont plus leurs méthodes.
  useEffect(() => {
    if (!effectiveTarget) return;
    const current = queryClient.getQueryData<CommentThreadData>(queryKey);
    const first = current?.index.values().next().value as (Comment & { serverData?: unknown }) | undefined;
    if (!first?.serverData || isReactive(first.serverData)) return;

    const host = entity ?? null;
    const rebuilt = [...current!.index.values()].map(
      item => transformToEntityInstance<Comment>(item, helper, host as never),
    );
    queryClient.setQueryData<CommentThreadData>(queryKey, {
      nodes: current!.nodes,
      index: indexEntities(rebuilt),
      host: current!.host,
    });
    // Volontairement au montage seul : la retransformation ne concerne que l'hydratation SSR.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...query,
    nodes: query.data?.nodes ?? [],
    index: query.data?.index,
    /** L'entité fournie prime ; sinon celle que la requête a résolue. */
    host: entity ?? query.data?.host ?? null,
    target: effectiveTarget,
  };
}
