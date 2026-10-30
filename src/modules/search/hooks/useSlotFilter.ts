import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { usePageFiltersOptional } from "../contexts/pageFilters";
import type { SlotFilterConf } from "../schema";
import {
  activeSlotParam,
  busyResourceIds,
  localIsoDay,
  resolveSlotRange,
  slotFromParam,
  slotToParam,
  withSlotEntry,
  type SlotWindow,
} from "../lib/slotFilter";
import { useSlotReservationsQuery } from "./useSlotReservationsQuery";

/**
 * Filtre « créneau » du bandeau : entrée `PageFilters` + param d'URL, comme `useInstallationFilter`.
 *
 * Particularité : la valeur publiée — les ressources occupées — dépend des RÉSERVATIONS, chargées à
 * la demande. Le créneau DEMANDÉ se lit donc dans l'URL (choix, lien partagé, retour arrière, ou
 * réinitialisation du bandeau qui retire le param) et n'est PUBLIÉ dans l'état partagé qu'une fois
 * les réservations arrivées : jamais de pastille pour un filtre qui ne filtre pas encore, et le bouton
 * signale l'attente. Un créneau incohérent dans l'URL (heures ou période inversées, saisies à la main)
 * est ignoré, comme un lien abîmé. « Aujourd'hui » — début d'une période non saisie — est lu à chaque
 * calcul, jamais écrit dans l'URL.
 *
 * À monter UNE SEULE FOIS par bandeau.
 */
export function useSlotFilter(conf: SlotFilterConf | undefined) {
  const pageFilters = usePageFiltersOptional();
  const setSearchByFields = pageFilters?.setSearchByFields;
  const searchByFields = pageFilters?.searchByFields;
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = conf ? searchParams.get(conf.id) : null;
  const requested = useMemo(() => {
    const slot = conf ? slotFromParam(raw) : null;
    return conf && slot && resolveSlotRange(slot, localIsoDay(new Date()), conf.amplitude) ? slotToParam(slot) : null;
  }, [conf, raw]);

  // Ouverture du filtre : les réservations se chargent pendant la saisie du créneau.
  const [wanted, setWanted] = useState(false);
  const reservations = useSlotReservationsQuery(conf?.reservations, wanted || requested !== null);

  // Publication : créneau demandé → ressources occupées dans `searchByFields`, recalculée à l'arrivée
  // et au rafraîchissement des réservations ; `withSlotEntry` rend l'état intact si rien ne change.
  const data = reservations.data;
  useEffect(() => {
    if (!conf || !setSearchByFields) return;
    if (requested === null) {
      setSearchByFields((prev) => withSlotEntry(prev, conf.id, null, []));
      return;
    }
    if (!data) return;
    const slot = slotFromParam(requested);
    const range = slot ? resolveSlotRange(slot, localIsoDay(new Date()), conf.amplitude) : null;
    setSearchByFields((prev) =>
      withSlotEntry(prev, conf.id, range ? requested : null, range ? busyResourceIds(data, range) : []),
    );
  }, [conf, setSearchByFields, requested, data]);

  const apply = useCallback(
    (next: SlotWindow | null) => {
      if (!conf) return;
      const param = next ? slotToParam(next) : null;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (param) params.set(conf.id, param);
          else params.delete(conf.id);
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [conf, setSearchParams],
  );
  const prepare = useCallback(() => setWanted(true), []);

  const applied = useMemo(
    () => (conf ? activeSlotParam(searchByFields ?? {}, conf.id) : null),
    [conf, searchByFields],
  );

  return {
    enabled: Boolean(conf && setSearchByFields),
    /** Créneau affiché par le bouton : le demandé, même en attente des réservations. */
    slot: useMemo(() => slotFromParam(requested), [requested]),
    /** Créneau EFFECTIVEMENT appliqué (pastille, compteur), lu dans l'état partagé. */
    applied: useMemo(() => slotFromParam(applied), [applied]),
    pending: requested !== null && requested !== applied && !reservations.isError,
    error: requested !== null && reservations.isError,
    retry: reservations.refetch,
    prepare,
    apply,
  };
}
