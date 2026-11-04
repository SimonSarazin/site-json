import { createContext } from "react";
import type { AllStepsData } from "../types";

/**
 * Contrôle EN DIRECT des créneaux des champs `timeSlots`, posé par l'APPELANT du formulaire (`slotCheck` de
 * `CoFormModal` / `SmartCoForm`) — typiquement « ce créneau est-il libre ? », que seul l'appelant sait juger.
 * Reçoit la saisie de l'étape, `{ [étape]: valeurs }`, et rend le motif à afficher sous chaque créneau, par nom
 * de champ puis par index (`null` : rien à signaler). Un AVERTISSEMENT seulement : ce qui doit bloquer
 * l'enregistrement passe par `beforeSubmit`. Défaut : aucun contrôle — le cas de tout formulaire qui ne le
 * demande pas (SSBE, Le Tampon…), dont le champ reste inchangé.
 */
export type TimeSlotCheck = (stepData: AllStepsData) => Promise<Record<string, ReadonlyArray<string | null>>>;

export const TimeSlotCheckContext = createContext<TimeSlotCheck | null>(null);
