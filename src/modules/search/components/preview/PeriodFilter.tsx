import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

type Translate = ReturnType<typeof useT>;

/**
 * Filtre « du … au … » des créneaux (`reservations.periods`), partagé par la fiche équipement
 * (`PreviewReservations`) et la fiche organisation (`PreviewBookedResources`). Dates vides : les créneaux
 * en cours ou à venir (`resolvePeriodFilter`) — l'aide le dit, et une fin avant le début est signalée à
 * sa place.
 */
export function PeriodFilter({
  from,
  to,
  today,
  invalid,
  onFrom,
  onTo,
  onReset,
  t,
}: {
  from: string;
  to: string;
  today: string;
  invalid: boolean;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onReset: () => void;
  t: Translate;
}) {
  const id = useId();
  return (
    <fieldset className="mt-4 rounded-lg border border-border/60 bg-background/60 p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">
        {t("PreviewReservations.filterLabel")}
      </legend>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">
            {t("PreviewReservations.filterFrom")}
          </Label>
          <Input
            id={`${id}-from`}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            className="h-8 w-36 border border-input"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
            {t("PreviewReservations.filterTo")}
          </Label>
          {/* `min` : sans début, la période part d'aujourd'hui — une fin antérieure serait incohérente. */}
          <Input
            id={`${id}-to`}
            type="date"
            value={to}
            min={from || today}
            onChange={(e) => onTo(e.target.value)}
            aria-invalid={invalid || undefined}
            className={cn("h-8 w-36 border border-input", invalid && "border-destructive")}
          />
        </div>
        {(from || to) && (
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onReset}>
            {t("PreviewReservations.filterReset")}
          </Button>
        )}
      </div>
      {invalid ? (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {t("PreviewReservations.filterInvalid")}
        </p>
      ) : (
        !from && !to && <p className="mt-2 text-xs text-muted-foreground">{t("PreviewReservations.filterHint")}</p>
      )}
    </fieldset>
  );
}
