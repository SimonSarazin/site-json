import { useMemo } from "react";
import { usagerIdsOf, type UsageConf } from "@/modules/observatoire/usage";
import type { Reservation } from "../lib/reservations";
import { useUsagerTypesQuery } from "./useUsagerTypesQuery";

/**
 * Types des fiches usagères d'une mesure d'usage (`reservations.usage`). C'est ici que se tient, une seule
 * fois pour l'observatoire, la fiche équipement et le filtre de statut du bandeau, la règle « jamais de
 * classement sans les types des fiches » : sans eux, une réservation sans type d'usager serait « non
 * précisée », et un équipement de club passerait « non ouvert ».
 *
 *  - `reservations` absentes (`undefined`) : pas encore lues — `loading` jusqu'à leur arrivée, PUIS jusqu'à
 *    celle des types. Chaque consommateur ajoute l'échec de SES réservations, qu'il lit à sa façon ;
 *  - `failed` : les types n'ont pas pu être lus (`refetch` pour un nouvel essai) ;
 *  - sans `usageConf` (site sans mesure) ou avec `enabled: false` (filtre sans statut demandé) : ni lecture
 *    des types, ni attente, ni échec.
 */
export function useUsageMeasure(
  reservations: readonly Reservation[] | undefined,
  usageConf: UsageConf | undefined,
  enabled = true,
) {
  const usagerIds = useMemo(() => (usageConf ? usagerIdsOf(reservations) : []), [usageConf, reservations]);
  const { types, isLoading, failed, refetch } = useUsagerTypesQuery(
    usagerIds,
    enabled && Boolean(usageConf?.schoolOrgTypes),
  );
  const active = Boolean(usageConf) && enabled;
  return {
    types,
    loading: active && !failed && (reservations === undefined || isLoading),
    failed: active && failed,
    refetch,
  };
}
