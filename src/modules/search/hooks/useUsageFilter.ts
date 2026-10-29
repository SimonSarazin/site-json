import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { UsageStatus } from "@/modules/observatoire/usage";
import { usagerIdsOf } from "@/modules/observatoire/usage";
import { usePageFiltersOptional } from "../contexts/pageFilters";
import type { UsageFilterConf } from "../schema";
import { activeSlotParam, localIsoDay, withSlotEntry } from "../lib/slotFilter";
import { statusFromParam, usageFilterClause } from "../lib/usageFilter";
import { useSlotReservationsQuery } from "./useSlotReservationsQuery";
import { useUsagerTypesQuery } from "./useUsagerTypesQuery";

/**
 * Filtre « Statut d'ouverture » du bandeau : entrée `PageFilters` + param d'URL, sur le modèle de
 * `useSlotFilter`. Le statut DEMANDÉ se lit dans l'URL ; il n'est PUBLIÉ dans l'état partagé — les
 * équipements retenus ou exclus — qu'une fois les réservations (et les types des fiches usagères) arrivés :
 * jamais de pastille pour un filtre qui ne filtre pas encore. Les mêmes réservations, en cache, que le
 * filtre créneau et l'observatoire.
 *
 * À monter UNE SEULE FOIS par bandeau.
 */
export function useUsageFilter(conf: UsageFilterConf | undefined) {
  const pageFilters = usePageFiltersOptional();
  const setSearchByFields = pageFilters?.setSearchByFields;
  const searchByFields = pageFilters?.searchByFields;
  const [searchParams, setSearchParams] = useSearchParams();
  const usageConf = conf?.reservations.usage;

  const requested = conf ? statusFromParam(searchParams.get(conf.id)) : null;
  const reservations = useSlotReservationsQuery(conf?.reservations, requested !== null);
  const data = reservations.data;
  const usagerIds = useMemo(() => usagerIdsOf(data), [data]);
  const {
    types,
    isLoading: typesLoading,
    failed: typesFailed,
    refetch: refetchTypes,
  } = useUsagerTypesQuery(usagerIds, requested !== null && Boolean(usageConf?.schoolOrgTypes));

  useEffect(() => {
    if (!conf || !usageConf || !setSearchByFields) return;
    if (requested === null) {
      setSearchByFields((prev) => withSlotEntry(prev, conf.id, null, []));
      return;
    }
    // Sans les types des fiches, une réservation sans type d'usager ne serait ni scolaire ni club : un
    // équipement de club passerait « non ouvert ». Rien n'est publié ; le sélecteur propose de réessayer.
    if (!data || typesLoading || typesFailed) return;
    const clause = usageFilterClause(data, requested, localIsoDay(new Date()), types, usageConf);
    setSearchByFields((prev) => withSlotEntry(prev, conf.id, requested, clause.ids, clause.type));
  }, [conf, usageConf, setSearchByFields, requested, data, types, typesLoading, typesFailed]);

  const { isError: reservationsError, refetch: refetchReservations } = reservations;
  // Nouvel essai de ce qui a échoué : les réservations, les types des fiches, ou les deux.
  const retry = useCallback(() => {
    if (reservationsError) void refetchReservations();
    if (typesFailed) void refetchTypes();
  }, [reservationsError, refetchReservations, typesFailed, refetchTypes]);

  const apply = useCallback(
    (next: UsageStatus | null) => {
      if (!conf) return;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next) params.set(conf.id, next);
          else params.delete(conf.id);
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [conf, setSearchParams],
  );

  const applied = useMemo(
    () => (conf ? statusFromParam(activeSlotParam(searchByFields ?? {}, conf.id)) : null),
    [conf, searchByFields],
  );

  return {
    enabled: Boolean(conf && usageConf && setSearchByFields),
    /** Statut affiché par le sélecteur : le demandé, même en attente des réservations. */
    status: requested,
    /** Statut EFFECTIVEMENT appliqué (pastille, compteur), lu dans l'état partagé. */
    applied,
    pending: requested !== null && requested !== applied && !reservationsError && !typesFailed,
    error: requested !== null && (reservationsError || typesFailed),
    retry,
    apply,
  };
}
