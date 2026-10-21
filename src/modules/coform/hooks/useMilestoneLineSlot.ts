import { useContext } from "react";
import { MilestoneLineSlotContext, type MilestoneLineSlot } from "../contexts/MilestoneLineSlotContext";

/**
 * Ce que l'hôte du formulaire pose sur chaque ligne du champ « liste de dépenses »
 * (`MilestoneListField`), ou `null` s'il n'y pose rien — le cas de tout formulaire qu'aucun hôte
 * n'entoure de `MilestoneLineSlotContext`.
 */
export function useMilestoneLineSlot(): MilestoneLineSlot | null {
  return useContext(MilestoneLineSlotContext);
}
