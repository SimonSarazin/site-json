import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { FieldErrors } from "react-hook-form";
import type { FormFieldMapping, TimeSlotValue } from "../types";
import {
  TIME_SLOT_DAYS,
  createEmptySlot,
  dayI18nKey,
  fromTimeString,
  isSlotOrdered,
  normalizeSlot,
  toTimeString,
} from "../utils/timeSlots";
import { HintText, FieldError, FieldLabel } from "./FormFields";

interface TimeSlotsFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: unknown;
  onChange?: (value: TimeSlotValue[]) => void;
}

/**
 * Champ « créneaux horaires » (`tpls.forms.cplx.timeSlots`) : répéteur de
 * lignes {jour, début, fin}. Inputs `type="time"` natifs (picker + clavier
 * mobile adaptés, valeur toujours "HH:MM" 24h quel que soit l'affichage
 * locale) — le `timeFormat` legacy ne pilote donc que l'affichage, jamais le
 * stockage, qui reste au format legacy (cf. `utils/timeSlots.ts`).
 */
export function TimeSlotsField({ field, errors, value, onChange }: TimeSlotsFieldProps) {
  const t = useT("modules/coform");
  const config = field.timeSlotsConfig ?? {};
  // Données legacy 12h (clés AmPm) résolues en 24h à l'affichage — le save
  // repart de ces slots normalisés.
  const slots: TimeSlotValue[] = (Array.isArray(value) ? (value as TimeSlotValue[]) : []).map(normalizeSlot);
  const hasError = !!errors[field.name];
  const labelId = `${field.name}-label`;
  // `errorId` suit le MESSAGE, pas `hasError` : une erreur zod imbriquée
  // (donnée legacy au mauvais type dans un sous-champ) met `hasError` à vrai
  // sans message top-level — `FieldError` ne rend alors rien, et un
  // `aria-describedby` dérivé de `hasError` pointerait un id inexistant.
  const errorMessage = errors[field.name]?.message as string | undefined;
  const errorId = errorMessage ? `${field.name}-error` : undefined;
  const multiple = config.enableMultipleSlots !== false;
  // `step` attend des secondes ; le picker natif ne l'impose pas partout,
  // c'est une aide de saisie (la validation bloquante reste le zod ordre/complet).
  const stepSeconds = (config.minuteStep ?? 15) * 60;

  const updateSlot = (index: number, patch: Partial<TimeSlotValue>) => {
    onChange?.(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const addSlot = () => {
    onChange?.([...slots, createEmptySlot(config.defaultStartTime, config.defaultEndTime)]);
  };

  const removeSlot = (index: number) => {
    onChange?.(slots.filter((_, i) => i !== index));
  };

  return (
    /* `role="group"` + `aria-labelledby` : le contrôle n'est pas un input ciblable
       (répéteur de créneaux), donc `FieldLabel` rend une `<div>` — sans rôle sur le
       conteneur, elle ne nommerait rien. Même montage que `CommonTableField`. */
    <div
      /* Pas de `role` sans libellé : un groupe anonyme n'ajoute rien à l'arbre
         d'accessibilité, il ne fait que l'encombrer. */
      role={field.label ? "group" : undefined}
      aria-labelledby={field.label ? labelId : undefined}
      /* `aria-invalid`/`aria-required` ne sont pas des propriétés supportées de
         `role="group"` : conservés pour l'alignement avec `CommonTableField`,
         l'information réelle passant par le `sr-only` de `FieldLabel` et le
         `role="alert"` de `FieldError`. */
      aria-invalid={hasError || undefined}
      aria-describedby={errorId}
      aria-required={field.isRequired || undefined}
      className={cn("space-y-2", field.width)}
    >
      <FieldLabel field={field} id={labelId} hasError={hasError} />
      {field.info && <HintText text={field.info} />}

      <div className="space-y-3">
        {slots.map((slot, index) => {
          const ordered = isSlotOrdered(slot);
          const dayId = `${field.name}-${index}-day`;
          const startId = `${field.name}-${index}-start`;
          const endId = `${field.name}-${index}-end`;
          return (
            <div
              key={index}
              className={cn(
                "rounded-md border bg-muted/30 p-3",
                ordered ? "border-border/60" : "border-destructive",
              )}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor={dayId} className="text-xs text-muted-foreground">
                    {t("coform.timeSlots.day")}
                  </Label>
                  <Select value={slot.day || undefined} onValueChange={(day) => updateSlot(index, { day })}>
                    <SelectTrigger id={dayId} className="w-full border border-input">
                      <SelectValue placeholder={String(t("coform.timeSlots.dayPlaceholder"))} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOT_DAYS.map((day) => (
                        <SelectItem key={day} value={day}>
                          {t(`coform.timeSlots.days.${dayI18nKey(day)}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={startId} className="text-xs text-muted-foreground">
                    {t("coform.timeSlots.startTime")}
                  </Label>
                  <Input
                    id={startId}
                    type="time"
                    step={stepSeconds}
                    value={toTimeString(slot.startHour, slot.startMinute)}
                    onChange={(e) => {
                      const { hour, minute } = fromTimeString(e.target.value);
                      updateSlot(index, { startHour: hour, startMinute: minute });
                    }}
                    className="border border-input sm:w-32"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={endId} className="text-xs text-muted-foreground">
                    {t("coform.timeSlots.endTime")}
                  </Label>
                  <Input
                    id={endId}
                    type="time"
                    step={stepSeconds}
                    value={toTimeString(slot.endHour, slot.endMinute)}
                    onChange={(e) => {
                      const { hour, minute } = fromTimeString(e.target.value);
                      updateSlot(index, { endHour: hour, endMinute: minute });
                    }}
                    aria-invalid={!ordered || undefined}
                    className={cn("border border-input sm:w-32", !ordered && "border-destructive")}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlot(index)}
                  aria-label={String(t("coform.timeSlots.removeSlot"))}
                  className="text-muted-foreground hover:text-destructive justify-self-end sm:justify-self-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Erreur d'ordre affichée SOUS le créneau fautif (pas seulement
                  au niveau du champ) — role="alert" pour l'annonce lecteur d'écran. */}
              {!ordered && (
                <p role="alert" className="mt-2 text-xs font-medium text-destructive">
                  {t("coform.validation.timeSlotOrder")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {(multiple || slots.length === 0) && (
        <Button type="button" variant="outline" size="sm" onClick={addSlot}>
          <Plus className="h-4 w-4 mr-1" />
          {t("coform.timeSlots.addSlot")}
        </Button>
      )}

      <FieldError name={field.name} message={errorMessage} />
    </div>
  );
}
