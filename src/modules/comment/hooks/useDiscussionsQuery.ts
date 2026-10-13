import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { COMMENT_QUERY_KEYS } from "../constants/queryKeys";
import { carrierKey, errorCodeOf, isRefusalCode, parseDiscussions, rawOrRefusal } from "../lib/discussions";
import { threadValue } from "../lib/filKey";
import { useDiscussionsRealtime } from "./useDiscussionsRealtime";
import type { CarrierRef, CommentTarget, DiscussionsResult } from "../types";

/**
 * Le périmètre demandé au panneau. C'est LUI qui décide du travail fait côté serveur :
 * l'endpoint déduit son mode de ce qu'il reçoit, et ne charge jamais plus que ça.
 */
export type DiscussionScope =
  | { readonly kind: "rail" }
  | { readonly kind: "carrier"; readonly carrier: CarrierRef }
  | { readonly kind: "thread"; readonly target: CommentTarget }
  | { readonly kind: "all" };

/**
 * Traduit le périmètre en charge utile.
 *
 * On ne passe **jamais** `depth` pour les modes déduits : la déduction du serveur est le
 * comportement voulu, et l'y forcer rouvrirait le piège du J0 — un paramètre envoyé « pour
 * être explicite » qui finit par décider à la place du serveur. Seul `all`, qui ne peut pas
 * se déduire puisqu'il n'a pas de périmètre, est demandé nommément.
 */
function payloadOf(scope: DiscussionScope): Record<string, unknown> {
  switch (scope.kind) {
    case "rail":
      return {};
    case "all":
      return { depth: "all" };
    case "carrier":
      return { carrier: `${scope.carrier.type}:${scope.carrier.id}` };
    case "thread":
      return {
        contextType: scope.target.type,
        contextId: scope.target.id,
        ...(scope.target.path ? { path: scope.target.path } : {}),
      };
  }
}

/** Segment de cache : ce qui distingue deux périmètres. */
function scopeSegment(scope: DiscussionScope): string | null {
  switch (scope.kind) {
    case "rail": return null;
    case "all": return "all";
    case "carrier": return carrierKey(scope.carrier);
    case "thread": return threadValue(scope.target);
  }
}

/** Temps réel en place : on garde un filet très lent plutôt que de couper l'interrogation. */
const POLL_TEMPS_REEL_MS = 1000 * 60 * 5;
/** Sans temps réel — le cas de tout déploiement sans hub : c'est LUI la latence perçue. */
const POLL_DEGRADE_MS = 1000 * 30;

/**
 * L'intervalle de relecture du panneau. Jamais sur un REFUS : le serveur a dit non (pas connecté,
 * pas le droit), et le redemander à chaque intervalle ne changera rien — c'était une requête
 * inutile toutes les 30 s (revue du 29/09). Une connexion change la clé (`userContextId`), et
 * relance donc d'elle-même. Une PANNE, elle, se relit — réponse illisible comprise.
 */
export function intervalleDeSondage(erreur: unknown, tempsReel: string): number | false {
  if (estUnRefus(erreur)) return false;
  return tempsReel === "connecte" ? POLL_TEMPS_REEL_MS : POLL_DEGRADE_MS;
}

/** L'erreur d'une requête du panneau est-elle un refus du serveur — définitif — ou une panne ? */
export function estUnRefus(erreur: unknown): boolean {
  return isRefusalCode(errorCodeOf(erreur));
}

/** Un REFUS ne se réessaie pas ; une panne a droit à deux nouvelles tentatives. */
export function reessayer(tentatives: number, erreur: unknown): boolean {
  return !estUnRefus(erreur) && tentatives < 2;
}

const VIDE: DiscussionsResult = {
  depth: "rail", carriers: [], threads: [], truncated: false,
  scanTruncated: false, carriersTruncated: false, canComment: null,
};

export interface UseDiscussionsQueryOptions {
  readonly enabled?: boolean;
}

/**
 * Charge un périmètre du panneau « Discussions ».
 *
 * Aucun texte de message ne transite par cet appel : titres, compteurs et dates seulement.
 * Le fil lui-même reste chargé par `useCommentsQuery`, qui a déjà son cache à deux vues et
 * ses mutations — les deux ne se marchent pas dessus.
 *
 * Un refus arrive en **HTTP 200** avec `{result:false}` — que le SDK rend en exception, et faute
 * de session il refuse lui-même : `rawOrRefusal` en retrouve le corps, `parseDiscussions` en fait
 * un refus MARQUÉ, que React Query présente comme une erreur. Un panneau vide et muet serait pire.
 */
export function useDiscussionsQuery(
  scope: DiscussionScope,
  { enabled = true }: UseDiscussionsQueryOptions = {},
) {
  const { api } = useCocolight();
  // `null` au premier rendu, puis la vraie valeur : toute invalidation passe donc par
  // `DISCUSSIONS_PREFIX`, jamais par la clé complète.
  const userContextId = useHydratedUserContextId();
  // Et la requête attend ce second rendu : partie dès le premier, elle était écrite sous la clé
  // « sans session » puis rejouée sous la bonne — deux requêtes par montage (cf.
  // `useDiscussionSpaceQuery`).
  const hydrate = useHydrated();

  const payload = useMemo(() => payloadOf(scope), [scope]);
  const segment = scopeSegment(scope);

  // S'abonne au flux PARTAGÉ de l'onglet et rend son état. Aucune connexion n'est ouverte ici.
  const tempsReel = useDiscussionsRealtime(enabled);

  const query = useQuery({
    queryKey: COMMENT_QUERY_KEYS.DISCUSSIONS(scope.kind, segment, userContextId),
    enabled: enabled && hydrate,
    staleTime: 30_000,
    // `connecte` SEULEMENT. Sur `degrade` le flux est ouvert mais le bus ne porte plus rien :
    // garder l'intervalle long rendrait le panneau MOINS réactif qu'avant le temps réel.
    refetchInterval: requete => intervalleDeSondage(requete.state.error, tempsReel),
    refetchIntervalInBackground: false,
    /**
     * Un REFUS ne se réessaie pas.
     *
     * `parseDiscussions` marque les réponses où le serveur a répondu et dit non — pas connecté,
     * pas le droit. Les retenter ne peut rien changer, et le défaut d'origine de React Query
     * (trois tentatives à délai croissant) faisait attendre douze secondes devant des
     * squelettes avant d'afficher la raison. Une panne de réseau, elle, mérite ses tentatives.
     */
    retry: reessayer,
    queryFn: async (): Promise<DiscussionsResult> => {
      const raw = await rawOrRefusal(() => (api as unknown as {
        getDiscussions: (o: Record<string, unknown>) => Promise<unknown>;
      }).getDiscussions(payload));
      return parseDiscussions(raw);
    },
  });

  const data = query.data ?? VIDE;
  return {
    ...query,
    // Le rendu d'attente compte comme un chargement — même si le cache porte déjà une réponse sous
    // sa clé, on ne sait pas encore à qui elle est —, et une première lecture en PAUSE (réseau
    // perdu) aussi : l'écran n'a pas à dire « vide » tant que rien n'a été rendu.
    isLoading: enabled && (!hydrate || query.isPending),
    tempsReel,
    carriers: data.carriers,
    threads: data.threads,
    truncated: data.truncated,
    /**
     * Les deux troncatures FINES, distinctes de `truncated`.
     *
     * Elles étaient lues par `parseDiscussions` puis jetées ici, ce qui rendait leur
     * information inatteignable : une recherche menée sur un parc tronqué aurait tu les fils
     * manquants au lieu de le dire. `scanTruncated` = le balayage serveur a atteint son
     * budget ; `carriersTruncated` = la liste des porteurs vierges a été coupée.
     */
    scanTruncated: data.scanTruncated,
    carriersTruncated: data.carriersTruncated,
    canComment: data.canComment,
  };
}
