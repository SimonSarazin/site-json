import { useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";

/**
 * Champs masqués par l'appelant (`hiddenFields`) — sauf ceux qui ont été en ERREUR : réaffichés pour
 * être corrigés (sinon l'erreur listée resterait inatteignable), ils RESTENT visibles ensuite. Les
 * remasquer dès que l'erreur se lève les démonterait sous les doigts de l'utilisateur, à la première
 * frappe valide (revalidation au changement). Partagé par `DynamicCoForm` et `MultiStepCoForm`.
 *
 * Renvoie le prédicat « ce champ est-il masqué ? » sur `field.name`.
 */
export function useHiddenFields(hiddenFields: readonly string[] | undefined, errors: FieldErrors): (name: string) => boolean {
  const masques = useMemo(() => new Set(hiddenFields ?? []), [hiddenFields]);
  const [reveles, setReveles] = useState<ReadonlySet<string>>(() => new Set());
  // Ajustement pendant le rendu (patron du dépôt) : un champ masqué passé en erreur est révélé pour
  // de bon. Converge en un passage — la condition est fausse une fois le champ ajouté.
  const nouveaux = [...masques].filter((name) => errors[name] && !reveles.has(name));
  if (nouveaux.length > 0) setReveles(new Set([...reveles, ...nouveaux]));
  return (name) => masques.has(name) && !errors[name] && !reveles.has(name);
}
