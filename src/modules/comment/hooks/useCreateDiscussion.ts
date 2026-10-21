import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { rawOrRefusal } from "../lib/discussions";
import { parseCreatedDiscussion, spaceKey, withDiscussion } from "../lib/space";
import type { DiscussionSpace, DiscussionThread, SpaceAudience, SpaceRef } from "../types";

/** Ce qu'on donne pour créer une discussion : un nom, et qui la lira. */
export interface NewDiscussion {
  readonly name: string;
  readonly audience: SpaceAudience;
}

/**
 * CRÉE une discussion supplémentaire sur un commun — le bouton « + » de l'espace legacy.
 *
 * La requête ne porte que le nom et l'audience : la clé de la discussion et son chemin sont
 * fabriqués par le serveur, qui juge aussi qui crée (`creatableAudiences`, rendu avec l'espace).
 *
 * **La discussion créée est posée dans la liste AVANT d'être rendue à l'appelant.** Le panneau ne
 * monte un fil que si la liste le porte : sélectionné avant la relecture, il aurait dit
 * « introuvable » le temps d'un aller-retour. La liste est relue ensuite, dans tous les cas — une
 * réponse illisible ne dit pas si la création a eu lieu.
 *
 * Une erreur porte un CODE (`creationErrorCodeOf`), jamais le texte du serveur : l'écran traduit.
 */
export function useCreateDiscussion(space: SpaceRef) {
  const { api } = useCocolight();
  const queryClient = useQueryClient();
  const userContextId = useHydratedUserContextId();

  return useMutation<DiscussionThread, unknown, NewDiscussion>({
    mutationFn: async ({ name, audience }) => {
      if (!api) throw new Error("SDK indisponible");
      // `api.discussions.create` (SDK 1.0.202) ; le fil rendu est relu par `parseCreatedDiscussion`.
      const raw = await rawOrRefusal(() => api.discussions.create({ contextType: space.type, contextId: space.id, name, audience }));
      return parseCreatedDiscussion(raw);
    },
    onSuccess: thread => {
      queryClient.setQueryData<DiscussionSpace>(
        COMMENT_QUERY_KEYS.DISCUSSIONS("space", spaceKey(space), userContextId),
        courant => (courant ? withDiscussion(courant, thread) : courant),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS_PREFIX() });
    },
  });
}
