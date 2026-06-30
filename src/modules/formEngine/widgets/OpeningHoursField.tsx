/**
 * Widget `openingHours` du moteur générique : horaires d'ouverture par jour
 * (`${name}.${jour}.{enabled,start,end}`). Composite contrôlé (lit/écrit le form),
 * sur le modèle du bloc horaires de `TiersLieuxForm`. Jours + libellés i18n configurables
 * via `widgetProps` (`days`, `dayLabelPrefix`).
 */
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";

const DEFAULT_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export interface OpeningHoursFieldProps {
  form: UseFormReturn<FieldValues>;
  name: string;
  label?: string;
  t: (key: string) => string;
  /** Liste des jours (clés) ; défaut = lundi→dimanche. */
  days?: readonly string[];
  /** Préfixe i18n des libellés de jour : `t(`${prefix}.${day}`)`. Sinon la clé brute. */
  dayLabelPrefix?: string;
}

export function OpeningHoursField({ form, name, label, t, days = DEFAULT_DAYS, dayLabelPrefix }: OpeningHoursFieldProps) {
  const path = (day: string, sub: string) => `${name}.${day}.${sub}` as FieldPath<FieldValues>;
  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4" /> {label}
        </div>
      )}
      {days.map((day) => {
        const enabled = Boolean(form.watch(path(day, "enabled")));
        const dayLabel = dayLabelPrefix ? t(`${dayLabelPrefix}.${day}`) : day;
        return (
          <div key={day} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" className="accent-primary" checked={enabled}
              onChange={(e) => form.setValue(path(day, "enabled"), e.target.checked)} />
            <span className="w-24 shrink-0 font-medium">{dayLabel}</span>
            <Input type="time" className="w-32" disabled={!enabled}
              value={(form.watch(path(day, "start")) as string) ?? ""}
              onChange={(e) => form.setValue(path(day, "start"), e.target.value)} />
            <span className="text-muted-foreground">→</span>
            <Input type="time" className="w-32" disabled={!enabled}
              value={(form.watch(path(day, "end")) as string) ?? ""}
              onChange={(e) => form.setValue(path(day, "end"), e.target.value)} />
          </div>
        );
      })}
    </div>
  );
}

export default OpeningHoursField;
