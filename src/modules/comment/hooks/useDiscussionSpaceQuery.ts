import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { rawOrRefusal } from "../lib/discussions";
import { parseSpace, spaceKey, spaceTotals } from "../lib/space";
import { estUnRefus, intervalleDeSondage, reessayer } from "./useDiscussionsQuery";
import { useDiscussionsRealtime } from "./useDiscussionsRealtime";
import type { DiscussionSpace, DiscussionThread, SpaceAudience, SpaceRef } from "../types";

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
const AUCUNE_AUDIENCE: readonly SpaceAudience[] = [];

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
 * **Un refus n'est pas une panne**, et c'est ici que la règle se tient, pour tout consommateur —
 * le bouton d'une fiche comme le panneau. React Query garde la dernière liste servie à travers une
 * erreur de relecture : une PANNE la laisse (`data`, `threads`, compteurs), fil ouvert et brouillon
 * compris ; un REFUS la retire — le serveur a répondu, et il ne montre plus cet espace.
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
    retry: reessayer,
    queryFn: async (): Promise<DiscussionSpace> => {
      if (!space) throw new Error("Aucun espace de discussion");
      if (!api) throw new Error("SDK indisponible");
      // `api.discussions.space` (SDK 1.0.202) ; la réponse est relue par `parseSpace`, qui fait foi.
      const raw = await rawOrRefusal(() => api.discussions.space({ contextType: space.type, contextId: space.id }));
      return parseSpace(raw);
    },
  });

  const data = query.isError && estUnRefus(query.error) ? undefined : query.data;
  const threads = data?.threads ?? AUCUN_FIL;
  return {
    ...query,
    data,
    // « En attente », pas « en train de lire » : une première lecture mise en PAUSE (réseau perdu)
    // n'est plus en vol, mais n'a toujours rien rendu — l'écran n'a pas à en conclure qu'il n'y a
    // aucun fil, ni que celui de l'adresse est introuvable. De même le rendu d'attente du montage,
    // même si le cache porte déjà une liste sous sa clé : on ne sait pas encore à qui elle est.
    isLoading: actif && (!hydrate || query.isPending),
    threads,
    /** Le titre que le serveur connaît au commun — l'hôte a souvent mieux, résolu par sa fiche. */
    title: data?.space.title ?? null,
    canComment: data?.canComment ?? false,
    /** Les audiences que ce lecteur peut donner à une discussion qu'il crée — vide : il n'en crée pas. */
    creatableAudiences: data?.creatableAudiences ?? AUCUNE_AUDIENCE,
    truncated: data?.truncated ?? false,
    ...spaceTotals(threads),
  };
}
