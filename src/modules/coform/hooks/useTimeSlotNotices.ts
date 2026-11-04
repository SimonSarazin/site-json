import { useContext, useEffect, useState } from "react";
import { useWatch, type Control, type FieldValues } from "react-hook-form";
import { useDebounce } from "@/hooks/useDebounce";
import { TimeSlotCheckContext } from "../contexts/TimeSlotCheckContext";
import type { SubFormData } from "../types";

/** Délai après la dernière frappe : l'avertissement suit la saisie sans clignoter à chaque touche. */
const DELAI_MS = 300;

type Notices = Record<string, ReadonlyArray<string | null>>;
const AUCUN: Notices = {};

/**
 * Avertissements de l'appelant sous les créneaux (`TimeSlotCheckContext`), recalculés après chaque saisie de
 * l'étape `stepKey` — par nom de champ, puis par index de créneau. Partagé par `DynamicCoForm` et
 * `MultiStepCoForm`. Sans contrôle posé, ou sans étape : aucun abonnement aux valeurs, aucun calcul. Un résultat
 * dépassé par une saisie plus récente est ignoré ; un contrôle en échec n'affiche rien — l'enregistrement garde
 * son propre contrôle (`beforeSubmit`).
 */
export function useTimeSlotNotices<T extends FieldValues>(control: Control<T>, stepKey: string | null): Notices {
  const check = useContext(TimeSlotCheckContext);
  const actif = Boolean(check && stepKey);
  const values = useWatch({ control, disabled: !actif });
  const saisie = useDebounce(values, DELAI_MS);
  const [notices, setNotices] = useState<{ json: string; value: Notices }>({ json: "{}", value: AUCUN });

  useEffect(() => {
    if (!check || !stepKey) return;
    let courant = true;
    check({ [stepKey]: saisie as SubFormData })
      .catch(() => AUCUN)
      .then((value) => {
        if (!courant) return;
        // Résultat inchangé : pas de nouveau rendu, l'effet ne repart qu'à la prochaine saisie.
        const json = JSON.stringify(value);
        setNotices((prev) => (prev.json === json ? prev : { json, value }));
      });
    return () => {
      courant = false;
    };
  }, [check, saisie, stepKey]);

  return actif ? notices.value : AUCUN;
}
