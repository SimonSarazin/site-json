import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { rawOrRefusal } from "../lib/discussions";
import { parseSpace, spaceKey, spaceTotals } from "../lib/space";
import { intervalleDeSondage } from "./useDiscussionsQuery";
import { useDiscussionsRealtime } from "./useDiscussionsRealtime";
import type { DiscussionSpace, DiscussionThread, SpaceRef } from "../types";

export interface UseDiscussionSpaceQueryOptions {
  readonly enabled?: boolean;
  /**
   * `true` quand l'espace est OUVERT à l'écran : la liste se relit alors d'elle-même (temps réel,
   * sinon interrogation périodique). `false` — le défaut — pour le bouton d'une fiche, qui n'a
   * besoin que d'un compteur : relire toutes les trente secondes un espace que personne ne regarde
   * serait une requête par fiche ouverte dans un onglet.
   */
  readonly live?: boolean;
}

const AUCUN_FIL: readonly DiscussionThread[] = [];

/**
 * Charge l'ESPACE de discussion d'un commun : ses fils, titrés et comptés.
 *
 * **Sans session aussi** : l'endpoint se lit sans être connecté (arbitrage du 07/10, comme le
 * legacy), et la clé porte l'utilisateur — une connexion la change, et la liste se recharge avec
 * ses non-lus et les discussions que son audience lui ouvre.
 *
 * La clé vit sous `DISCUSSIONS_PREFIX` : poster un message ou marquer un fil lu invalide déjà ce
 * préfixe, les compteurs de l'espace suivent donc sans une ligne de plus.
 *
 * Aucun texte de message ne transite ici ; le fil lui-même reste chargé par `useCommentsQuery`.
 */
export function useDiscussionSpaceQuery(
  space: SpaceRef | null,
  { enabled = true, live = false }: UseDiscussionSpaceQueryOptions = {},
) {
  const { api } = useCocolight();
  const userContextId = useHydratedUserContextId();
  // `userContextId` vaut `null` au premier rendu de CHAQUE montage, connecté ou non, puis sa vraie
  // valeur. Lancée dès ce premier rendu, la requête d'un connecté partait deux fois par montage, la
  // première sous une clé qui n'était pas la sienne. On attend donc le rendu où la clé est la
  // bonne ; les deux valeurs se posent dans le même effet de montage.
  const hydrate = useHydrated();
  const actif = enabled && space !== null;
  // S'abonne au flux PARTAGÉ de l'onglet — aucune connexion n'est ouverte ici.
  const tempsReel = useDiscussionsRealtime(actif && live);

  const query = useQuery({
    queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS("space", space ? spaceKey(space) : null, userContextId),
    enabled: actif && hydrate,
    staleTime: 30_000,
    refetchInterval: requete => (live ? intervalleDeSondage(requete.state.error, tempsReel) : false),
    refetchIntervalInBackground: false,
    // Un REFUS ne se réessaie pas : le serveur a répondu, et il a dit non (cf. `useDiscussionsQuery`).
    retry: (tentatives, erreur) =>
      (erreur as { refus?: boolean } | null)?.refus ? false : tentatives < 2,
    queryFn: async (): Promise<DiscussionSpace> => {
      if (!space) throw new Error("Aucun espace de discussion");
      const raw = await rawOrRefusal(() => (api as unknown as {
        getDiscussionSpace: (o: Record<string, unknown>) => Promise<unknown>;
      }).getDiscussionSpace({ contextType: space.type, contextId: space.id }));
      return parseSpace(raw);
    },
  });

  const threads = query.data?.threads ?? AUCUN_FIL;
  return {
    ...query,
    // Le rendu d'attente n'est pas « rien à montrer » : sans cela l'écran dirait, le temps d'un
    // rendu, qu'il n'y a aucun fil — ou que celui de l'adresse est introuvable.
    isLoading: query.isLoading || (actif && !hydrate),
    threads,
    /** Le titre que le serveur connaît au commun — l'hôte a souvent mieux, résolu par sa fiche. */
    title: query.data?.space.title ?? null,
    canComment: query.data?.canComment ?? false,
    truncated: query.data?.truncated ?? false,
    ...spaceTotals(threads),
  };
}
