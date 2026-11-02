import { createContext } from "react";

/**
 * Saisie d'une période (« du … au … ») sur chaque créneau des champs `timeSlots`. Posée par l'APPELANT du
 * formulaire (`slotPeriods` de `CoFormModal` / `SmartCoForm`), jamais par le formulaire lui-même : le même
 * champ sert à d'autres sites (SSBE, Le Tampon) qui ne datent pas leurs créneaux. Défaut : non — le champ
 * n'affiche alors la période d'un créneau que s'il en porte une, en lecture.
 */
export const TimeSlotPeriodsContext = createContext(false);
