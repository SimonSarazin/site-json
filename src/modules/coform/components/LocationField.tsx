import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AddressPicker } from "@/lib/location/AddressPicker";
import { parseStoredToEntries, entriesToStored } from "../utils/coformLocality";
import type { FormFieldMapping } from "../types";
import { HintText, FieldError } from "./FormFields";

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
      {field.label && (
        <Label className="text-sm font-medium text-foreground">
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {field.info && <HintText text={field.info} />}

      <AddressPicker value={entries} onChange={(next) => onChange(entriesToStored(next))} multiple />

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
