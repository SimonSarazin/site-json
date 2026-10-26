import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useT } from "@/hooks/useT";
import { SEARCH_QUERY_KEYS } from "../constants/queryKeys";
import { bookingIssueMessage, isSameSlot, slotHoursIssue } from "../lib/reservationBooking";
import { withSlotHours } from "../lib/reservationPrefill";
import { rawSlotAt, type Reservation, type ReservationSlot } from "../lib/reservations";
import type { ReservationsConf } from "../schema";
import { resourcesReservations } from "./useReservationsQuery";

/** Une modification d'horaire : le créneau affiché (index BRUT compris) et ses nouvelles heures. */
export interface SlotHoursEdit {
  reservation: Reservation;
  slot: ReservationSlot;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Modification de l'HORAIRE d'un créneau existant (`reservations.booking.editHours`) — seules les heures
 * changent (NB de Peterson du 23/10).
 *  - le contrôle (`check`) juge les réservations de CHAQUE équipement de la réservation et rend le motif d'un refus
 *    (`slotHoursIssue`), ou `null`. RELUES par défaut, celles de l'enregistrement : aucun contrôle serveur
 *    n'existe, celui-ci se fait sur du frais. `fresh: false` les prend en cache, pour l'avertissement EN
 *    DIRECT de la fenêtre pendant la saisie (demande de Peterson du 26/10) ;
 *  - l'écriture relit la RÉPONSE, vérifie que le créneau visé est toujours celui affiché (`isSameSlot`), puis
 *    réécrit ce seul élément du tableau `timeSlots` (`answers.<étape>.<étape><créneaux>.<index>`) par
 *    `updateField` — l'idiome de `useSaveSelectionNote` (coform). Côté plateforme, `updatepathvalue`
 *    applique `Answer::canEdit` : l'auteur, les admins du contexte de la réponse, le super-admin.
 * Les réservations en cache (fiches, filtre créneau, KPI d'heures) sont invalidées par préfixe : on ne sait
 * pas quelles fiches les portent.
 *
 * Le hook porte aussi la fenêtre « Modifier l'horaire », commune aux fiches équipement et organisation :
 * le créneau visé (`editing`, `open` / `close`), `submit` (contrôle sur réservations relues, puis écriture ; rend
 * le motif d'un refus) et `checkLive` (même contrôle sur les réservations en cache, pendant la saisie).
 */
export function useUpdateSlotHours(conf: ReservationsConf) {
  const { entity, api } = useCocolight();
  const queryClient = useQueryClient();
  const t = useT("modules/search");
  const [editing, setEditing] = useState<{ reservation: Reservation; slot: ReservationSlot } | null>(null);

  const { mutateAsync, isPending } = useMutationWithToast<void, SlotHoursEdit>({
    mutationFn: async ({ reservation, slot, startMinutes, endMinutes }) => {
      if (!api || slot.index === undefined) throw new Error(t("PreviewReservations.issue.stale"));
      const form = await api.form({ id: conf.form });
      const answer = await form.answer({ id: reservation.id });
      const brut = rawSlotAt(answer.serverData as Record<string, unknown> | undefined, conf, slot.index);
      if (!brut || !isSameSlot(brut, slot)) throw new Error(t("PreviewReservations.issue.stale"));
      await answer.updateField(
        `answers.${conf.step}.${conf.step}${conf.fields.slots}.${slot.index}`,
        withSlotHours(brut, startMinutes, endMinutes),
      );
    },
    namespace: "modules/search",
    successKey: "PreviewReservations.editHours.saved",
    errorKey: "PreviewReservations.editHours.error",
    invalidateQueries: [
      SEARCH_QUERY_KEYS.RESERVATIONS_PREFIX(conf.form),
      SEARCH_QUERY_KEYS.ORGA_RESERVATIONS_PREFIX(conf.form),
      SEARCH_QUERY_KEYS.RESERVATION_SLOTS_PREFIX(conf.form),
    ],
  });

  const check = useCallback(
    async (
      { reservation, slot, startMinutes, endMinutes }: SlotHoursEdit,
      fresh = true,
    ): Promise<string | null> => {
      if (!entity || slot.index === undefined) return t("PreviewReservations.issue.stale");
      const existing = await resourcesReservations(queryClient, entity, conf, reservation.resourceIds, fresh);
      const issue = slotHoursIssue(
        { reservationId: reservation.id, slotIndex: slot.index, day: slot.day },
        startMinutes,
        endMinutes,
        existing,
      );
      return issue ? bookingIssueMessage(issue, t) : null;
    },
    [conf, entity, queryClient, t],
  );

  // Stables : `checkLive` est une dépendance de l'effet d'avertissement de `SlotHoursDialog`.
  const checkLive = useCallback(
    (startMinutes: number, endMinutes: number) =>
      editing ? check({ ...editing, startMinutes, endMinutes }, false) : Promise.resolve(null),
    [check, editing],
  );
  const submit = useCallback(
    async (startMinutes: number, endMinutes: number) => {
      if (!editing) return null;
      const edit = { ...editing, startMinutes, endMinutes };
      const refus = await check(edit);
      if (refus) return refus;
      try {
        await mutateAsync(edit);
        return null;
      } catch (error) {
        // Le toast d'erreur est déjà parti (`useMutationWithToast`) ; la fenêtre reste ouverte sur le motif.
        return error instanceof Error ? error.message : t("PreviewReservations.editHours.error");
      }
    },
    [check, editing, mutateAsync, t],
  );

  return {
    editing,
    open: (reservation: Reservation, slot: ReservationSlot) => setEditing({ reservation, slot }),
    close: () => setEditing(null),
    submit,
    checkLive,
    saving: isPending,
  };
}
