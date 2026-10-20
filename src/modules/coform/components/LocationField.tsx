import { cn } from "@/lib/utils";
import { AddressPicker } from "@/lib/location/AddressPicker";
import { parseStoredToEntries, entriesToStored } from "../utils/coformLocality";
import type { FormFieldMapping } from "../types";
import { HintText, FieldLabel, FieldError } from "./FormFields";

interface LocationFieldProps {
  field: FormFieldMapping;
  value: unknown;
  onChange: (value: unknown) => void;
  errors: Record<string, { message?: unknown } | undefined>;
}

/**
 * Champ adresse géolocalisée d'un coform — parité dynForm `formLocality`.
 *
 * La valeur stockée sous `answers[formId][key]` est l'objet composite
 * `{ formLocality, address, geo, geoPosition, addresses }` (miroir `addressInDynform.php`).
 * On l'édite via `AddressPicker` (tableau d'entrées), avec conversion aux frontières :
 *  - READ  : `parseStoredToEntries(value)` → entrées (tolère l'ancienne chaîne texte)
 *  - WRITE : `entriesToStored(next)` → objet stocké (ou `undefined` si vidé)
 */
export function LocationField({ field, value, onChange, errors }: LocationFieldProps) {
  const entries = parseStoredToEntries(value);

  return (
    <div className={cn("space-y-3", field.width)}>
      <FieldLabel field={field} />
      {field.info && <HintText text={field.info} />}

      {/* Ancienne réponse texte libre (champ historiquement rendu en `text`) : non convertible en
          entrée géolocalisée (pas de localityId) mais elle SURVIT au resave tant qu'on ne touche pas
          au widget (les defaults passent tels quels dans le form state). On l'affiche pour que
          l'utilisateur sache ce qu'elle contenait avant de la remplacer par une vraie adresse. */}
      {typeof value === "string" && value && (
        <p className="text-xs text-muted-foreground">
          Ancienne valeur (texte libre) : « {value} » — sélectionner une ville la remplacera par une adresse géolocalisée.
        </p>
      )}

      <AddressPicker value={entries} onChange={(next) => onChange(entriesToStored(next))} multiple />

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
