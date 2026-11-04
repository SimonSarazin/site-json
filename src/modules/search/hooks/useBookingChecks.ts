import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import type { TimeSlotCheck } from "@/modules/coform/contexts/TimeSlotCheckContext";
import type { AllStepsData } from "@/modules/coform/types";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { bookingIssue, bookingIssueMessage, slotIssues } from "../lib/reservationBooking";
import { parseReservationAnswer } from "../lib/reservations";
import type { ReservationsConf } from "../schema";
import { resourcesReservations } from "./useReservationsQuery";

/**
 * Contrôles d'un AJOUT de créneaux (`reservations.periods`), communs à tous les formulaires d'ajout sur un
 * équipement : case libre et bouton par association de la fiche équipement, bouton par équipement de la fiche
 * organisation. Les deux contrôles se jugent sur les réservations de CHAQUE équipement saisi — aucun contrôle serveur
 * n'existe :
 *  - `slotCheck`, l'avertissement EN DIRECT sous chaque créneau (`slotIssues`), sur les réservations en cache —
 *    rien tant que les dates et l'horaire ne sont pas saisis (demande de Peterson du 26/10) ;
 *  - `beforeSubmit`, le refus d'ENREGISTRER (`bookingIssue`), sur les réservations RELUES : c'est lui qui bloque,
 *    avertissement ignoré ou non ;
 *  - `afterSave`, après l'enregistrement : `useCoFormFinalMutation` n'invalide que les caches coform, les fiches
 *    et le filtre créneau doivent se relire — par préfixe, on ne sait pas lesquelles sont en cache.
 * Les trois sont stables : ils ne changent qu'avec la config, l'entité ou la langue — `slotCheck` est la
 * dépendance de l'effet d'avertissement (`useTimeSlotNotices`), qui ne repart ainsi qu'à la saisie.
 */
export function useBookingChecks(conf: ReservationsConf) {
  const { entity } = useCocolight();
  const queryClient = useQueryClient();
  const t = useT("modules/search");
  const { i18n } = useTranslation();

  const beforeSubmit = useCallback(
    async (allData: AllStepsData) => {
      const submitted = parseReservationAnswer({ answers: allData }, conf);
      if (!submitted || !entity) return null;
      const existing = await resourcesReservations(queryClient, entity, conf, submitted.resourceIds, true);
      const issue = bookingIssue(submitted, existing);
      return issue ? bookingIssueMessage(issue, t) : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` est recréé à chaque rendu (cf. useT) : la langue suffit.
    [conf, entity, queryClient, i18n.language],
  );

  const slotCheck = useCallback<TimeSlotCheck>(
    async (stepData) => {
      const submitted = parseReservationAnswer({ answers: stepData }, conf);
      if (!submitted || !entity) return {};
      const existing = await resourcesReservations(queryClient, entity, conf, submitted.resourceIds, false);
      const issues = slotIssues(submitted, existing);
      // Un message par créneau du champ, à son index brut ; `null` sous les créneaux sans souci.
      const messages = Array.from({ length: Math.max(-1, ...issues.keys()) + 1 }, (_, index) => {
        const issue = issues.get(index);
        return issue ? bookingIssueMessage(issue, t) : null;
      });
      return { [`${conf.step}${conf.fields.slots}`]: messages };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` est recréé à chaque rendu (cf. useT) : la langue suffit.
    [conf, entity, queryClient, i18n.language],
  );

  const afterSave = useCallback(() => {
    for (const queryKey of [
      SEARCH_QUERY_KEYS.RESERVATIONS_PREFIX(conf.form),
      SEARCH_QUERY_KEYS.ORGA_RESERVATIONS_PREFIX(conf.form),
      SEARCH_QUERY_KEYS.RESERVATION_SLOTS_PREFIX(conf.form),
    ]) {
      queryClient.invalidateQueries({ queryKey });
    }
  }, [conf.form, queryClient]);

  return { beforeSubmit, slotCheck, afterSave };
}
