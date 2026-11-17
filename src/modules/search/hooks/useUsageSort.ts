import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_USAGE_SORT_PARAM, sortOrderFromParam, type UsageSortOrder } from "../lib/usageSort";
import type { ReservationsConf, UsageSortConf } from "../schema";
import { useSlotUsage } from "./useSlotUsage";

/**
 * Tri de la liste par taux d'occupation (`searchProStatic.usageSort`) : l'ordre se lit dans l'URL (`?tri=desc`), les
 * taux sur les réservations de la fiche (`reservations.usage` requis : la plage de référence du taux). Les
 * réservations ne sont lues que pour un tri demandé — la liste par nom n'en a pas besoin.
 */
export function useUsageSort(conf: UsageSortConf | undefined, reservations: ReservationsConf | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = conf?.id ?? DEFAULT_USAGE_SORT_PARAM;
  const enabled = Boolean(conf && reservations?.usage);
  if (import.meta.env.DEV && conf && !reservations?.usage) {
    console.warn("[search] usageSort sans list.preview.reservations.usage — aucun taux à trier, sélecteur masqué");
  }
  const order = enabled ? sortOrderFromParam(searchParams.get(param)) : null;
  const slots = useSlotUsage(reservations, order !== null);

  const setOrder = useCallback(
    (next: UsageSortOrder | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next) params.set(param, next);
          else params.delete(param);
          return params;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [param, setSearchParams],
  );

  return {
    enabled,
    /** Ordre demandé ; `null` = tri du serveur (par nom). */
    order,
    setOrder,
    /** Taux des équipements qui ont un planning — absents tant que les réservations ne sont pas lues. */
    rates: order !== null ? slots.usage?.rates : undefined,
    loading: order !== null && slots.loading,
    failed: order !== null && slots.failed,
    retry: slots.refetch,
  };
}
