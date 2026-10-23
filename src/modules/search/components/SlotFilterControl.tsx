import { useId, useState, type ChangeEvent } from "react";
import { CalendarClock, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useHydrated } from "@/hooks/useHydrated";
import { useT } from "@/hooks/useT";
import type { BookingAmplitude } from "../lib/reservations";
import { DAY_KEYS, normalizeDayKey } from "../lib/schedules";
import {
  amplitudeLabels,
  describeSlot,
  formatSlotDays,
  localIsoDay,
  shortDayLabel,
  slotIssue,
  type SlotIssue,
  type SlotWindow,
} from "../lib/slotFilter";

/** Message du formulaire pour chaque saisie incohérente. */
const ISSUE_MESSAGES: Record<SlotIssue, string> = {
  hours: "SlotFilter.invalidRange",
  period: "SlotFilter.invalidPeriod",
  days: "SlotFilter.noDayInPeriod",
};

export interface SlotFilterControlProps {
  /** Libellé du filtre, déjà traduit — affiché tant qu'aucun créneau n'est choisi. */
  label: string;
  /** Créneau affiché (le demandé, même en attente des réservations). */
  slot: SlotWindow | null;
  amplitude?: BookingAmplitude;
  pending: boolean;
  error: boolean;
  /** Ouverture : précharge les réservations pendant la saisie. */
  onOpen: () => void;
  onApply: (slot: SlotWindow | null) => void;
  onRetry: () => void;
  /** Classes du bouton, celles des dropdowns du bandeau : les filtres forment une seule rangée. */
  triggerClassName: string;
}

/**
 * Filtre « créneau » du bandeau : une plage horaire, des jours de la semaine et une période
 * facultative — la forme d'une réservation. Les heures viennent d'abord : c'est le critère
 * principal, jours et période le précisent. Heures et dates passent par des champs natifs (même
 * choix que le filtre de dates de la barre latérale et que les créneaux CoForm : sélecteur du
 * système, clavier, mobile), les jours par une rangée de bascules. Le créneau ne part qu'au clic sur
 * « Appliquer » — un champ heure change à chaque segment saisi, appliquer à chaque frappe lancerait
 * autant de recherches.
 */
export function SlotFilterControl({
  label,
  slot,
  amplitude,
  pending,
  error,
  onOpen,
  onApply,
  onRetry,
  triggerClassName,
}: SlotFilterControlProps) {
  const t = useT("modules/search");
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SlotWindow>({});

  // Le bouton affiche le créneau RÉSOLU : un début seul se lit « 14:00–22:00 », la règle est visible.
  // Après hydratation seulement : une période courte sans début se résout depuis « aujourd'hui », qui
  // peut différer entre le serveur et le navigateur — le SSR et le 1er rendu client montrent le libellé.
  // La période n'y figure pas (la pastille la donne) : le bouton resterait illisible.
  const hydrated = useHydrated();
  const today = localIsoDay(new Date());
  const summary = hydrated && slot ? describeSlot(slot, today, amplitude) : null;
  const { open: ouverture, close: fermeture } = amplitudeLabels(amplitude);
  const issue = slotIssue(draft, today, amplitude);
  const empty = !draft.days?.length && !draft.start && !draft.end && !draft.periodStart && !draft.periodEnd;

  const set = (key: "start" | "end" | "periodStart" | "periodEnd") => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value || undefined }));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(slot ?? {});
          onOpen();
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className={triggerClassName} aria-busy={pending || undefined}>
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">
              {summary
                ? t("SlotFilter.summary", undefined, {
                    days: formatSlotDays(summary.days, t),
                    start: summary.start,
                    end: summary.end,
                  })
                : label}
            </span>
          </span>
          {pending ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" aria-label={t("SlotFilter.loading")} />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 shrink-0" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-start`} className="text-xs font-medium text-muted-foreground">
              {t("SlotFilter.from")}
            </Label>
            <Input id={`${ids}-start`} type="time" value={draft.start ?? ""} onChange={set("start")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-end`} className="text-xs font-medium text-muted-foreground">
              {t("SlotFilter.to")}
            </Label>
            <Input id={`${ids}-end`} type="time" value={draft.end ?? ""} onChange={set("end")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <p id={`${ids}-days`} className="text-xs font-medium text-muted-foreground">
            {t("SlotFilter.days")}
          </p>
          <ToggleGroup
            type="multiple"
            variant="outline"
            size="sm"
            aria-labelledby={`${ids}-days`}
            value={draft.days ?? []}
            onValueChange={(value) => setDraft((d) => ({ ...d, days: value.flatMap((v) => normalizeDayKey(v) ?? []) }))}
            className="w-full"
          >
            {DAY_KEYS.map((day) => (
              <ToggleGroupItem
                key={day}
                value={day}
                aria-label={t(`days.${day}`)}
                className="px-0 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"
              >
                {shortDayLabel(day, t)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-muted-foreground">{t("SlotFilter.period")}</legend>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${ids}-period-start`} className="text-xs text-muted-foreground">
                {t("SlotFilter.periodStart")}
              </Label>
              <Input
                id={`${ids}-period-start`}
                type="date"
                value={draft.periodStart ?? ""}
                onChange={set("periodStart")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${ids}-period-end`} className="text-xs text-muted-foreground">
                {t("SlotFilter.periodEnd")}
              </Label>
              <Input
                id={`${ids}-period-end`}
                type="date"
                // Guide le sélecteur : une fin ne précède ni le début, ni aujourd'hui sans début.
                min={draft.periodStart ?? today}
                value={draft.periodEnd ?? ""}
                onChange={set("periodEnd")}
              />
            </div>
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">
          {t("SlotFilter.hint", undefined, { open: ouverture, close: fermeture })}
        </p>
        {issue && (
          <p role="alert" className="text-xs text-destructive">
            {t(ISSUE_MESSAGES[issue])}
          </p>
        )}
        {error && (
          <p role="alert" className="flex flex-wrap items-center gap-x-2 text-xs text-destructive">
            {t("SlotFilter.error")}
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>
              {t("SlotFilter.retry")}
            </Button>
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft({});
              onApply(null);
              setOpen(false);
            }}
          >
            {t("SlotFilter.clear")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={issue !== null}
            onClick={() => {
              onApply(empty ? null : draft);
              setOpen(false);
            }}
          >
            {t("SlotFilter.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
