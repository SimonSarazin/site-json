import { useQueries } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import { optionsFicheParSlug } from "@/hooks/useEntityBySlugQuery";
import { memeTerritoire } from "../lib/teamDirectory";
import { vueMembre } from "../lib/ficheMembre";

/** Membre tel que renvoyé par la liste : seule `serverData` nous intéresse ici. */
interface MembreListe {
  serverData?: Record<string, unknown>;
}

/**
 * Restreint une liste de membres à ceux rattachés à UN territoire.
 *
 * Pourquoi côté client : `getMembers` reconstruit ses propres `filters` et écrase ceux de
 * l'appelant, et sa projection ne ramène de toute façon pas `territoires`. Le territoire ne
 * s'obtient donc qu'en lisant la fiche COMPLÈTE de chaque membre.
 *
 * Les requêtes sortent de `optionsFicheParSlug`, la MÊME fabrique que `useEntityBySlugQuery` : le
 * cache React Query est donc le même que celui des cartes, et une fiche déjà chargée par une carte
 * n'est pas redemandée — ni l'inverse. Recopier la clé et la fonction ici suffirait à créer une
 * seconde entrée de cache pour la même fiche, donc une requête de plus par membre.
 */
export function useMembresDuTerritoire<T extends MembreListe>(
  membres: T[],
  territoire?: string,
): { membres: T[]; enCours: boolean; actif: boolean } {
  const { entity, loading, me } = useCocolight();
  const userContextId = useHydratedUserContextId();
  const actif = typeof territoire === "string" && territoire.trim() !== "";

  const fiches = useQueries({
    queries: (actif ? membres : []).map((membre) =>
      optionsFicheParSlug({
        slug: membre.serverData?.slug as string | undefined,
        entity,
        me,
        userContextId,
        loading,
      }),
    ),
  });

  if (!actif) return { membres, enCours: false, actif };

  // Tant qu'une fiche manque, on ne sait pas encore si son membre appartient au territoire :
  // afficher « aucun résultat » à ce moment-là ferait clignoter la section.
  const enCours = fiches.some((f) => f.isLoading);

  // Même lecture que la carte (`vueMembre`) : la fiche prime, la liste sert de repli, et le champ
  // n'est retenu que s'il est exploitable. Deux lectures divergentes ici et là feraient qu'une
  // carte s'afficherait sans que le filtre l'ait retenue — ou l'inverse.
  const retenus = membres.filter((membre, i) => {
    const fiche = fiches[i]?.data as { serverData?: Record<string, unknown> } | undefined;
    const { rattachement } = vueMembre(membre.serverData, fiche?.serverData);
    return memeTerritoire(rattachement, territoire);
  });

  return { membres: retenus, enCours, actif };
}
