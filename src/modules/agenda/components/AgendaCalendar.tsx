import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Event } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { toDayEvents } from "../lib/calendarLayout";
import MonthView from "./calendar/MonthView";
import TimeGridView from "./calendar/TimeGridView";

type CalView = "month" | "week" | "day";
const WEEK_OPTS = { weekStartsOn: 1 } as const;

export interface AgendaCalendarProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  /** Plage visible → le parent refetch `searchEventsCostum` sur cette plage. */
  onRangeChange?: (start: Date, end: Date) => void;
  locale?: string;
}

/**
 * GRILLE calendrier MAISON (Tailwind + date-fns + tokens shadcn) — 3 vues : Mois (grille), Semaine/Jour
 * (grille horaire). Thème NATIF (clair/sombre par costum), events = nos `Date` (pas de Temporal/schedule-x).
 * Reporte la plage visible (onRangeChange → refetch). Clic event → même détail réutilisé. Responsive mobile.
 */
export default function AgendaCalendar({ events, onEventClick, onRangeChange, locale = "fr-FR" }: AgendaCalendarProps) {
  const t = useT("modules/agenda");
  const dfLocale = locale.startsWith("en") ? enUS : fr;
  const [view, setView] = useState<CalView>("month");
  const [cursor, setCursor] = useState(() => new Date());

  const range = useMemo(() => {
    if (view === "month") return { start: startOfWeek(startOfMonth(cursor), WEEK_OPTS), end: endOfWeek(endOfMonth(cursor), WEEK_OPTS) };
    if (view === "week") return { start: startOfWeek(cursor, WEEK_OPTS), end: endOfWeek(cursor, WEEK_OPTS) };
    return { start: startOfDay(cursor), end: endOfDay(cursor) };
  }, [view, cursor]);

  // Refetch de la plage visible (callback figée via ref → pas de boucle).
  const onRangeRef = useRef(onRangeChange);
  onRangeRef.current = onRangeChange;
  const rangeKey = `${range.start.toISOString()}|${range.end.toISOString()}`;
  useEffect(() => {
    onRangeRef.current?.(range.start, range.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const dayEvents = useMemo(() => toDayEvents(events), [events]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(cursor, WEEK_OPTS), end: endOfWeek(cursor, WEEK_OPTS) }), [cursor]);

  const title = useMemo(() => {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    if (view === "month") return cap(format(cursor, "MMMM yyyy", { locale: dfLocale }));
    if (view === "day") return cap(format(cursor, "EEEE d MMMM yyyy", { locale: dfLocale }));
    const ws = startOfWeek(cursor, WEEK_OPTS);
    const we = endOfWeek(cursor, WEEK_OPTS);
    return `${format(ws, "d MMM", { locale: dfLocale })} – ${format(we, "d MMM yyyy", { locale: dfLocale })}`;
  }, [view, cursor, dfLocale]);

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));
  const openDay = (day: Date) => {
    setCursor(day);
    setView("day");
  };

  const VIEWS: { id: CalView; label: string }[] = [
    { id: "month", label: t("calendar.month") },
    { id: "week", label: t("calendar.week") },
    { id: "day", label: t("calendar.day") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      {/* Barre : titre + navigation + sélecteur de vue (responsive : wrap en mobile) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold capitalize sm:text-lg">{title}</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>{t("calendar.today")}</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Précédent" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Suivant" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex w-full items-center gap-1 rounded-lg bg-muted p-0.5 sm:w-auto">
          {VIEWS.map((v) => (
            <Button
              key={v.id}
              variant={view === v.id ? "default" : "ghost"}
              size="sm"
              className="h-7 flex-1 px-3 sm:flex-none"
              onClick={() => setView(v.id)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <MonthView cursor={cursor} dayEvents={dayEvents} dfLocale={dfLocale} onEventClick={onEventClick} onDayClick={openDay} />
      ) : (
        <TimeGridView
          days={view === "week" ? weekDays : [startOfDay(cursor)]}
          dayEvents={dayEvents}
          dfLocale={dfLocale}
          onEventClick={onEventClick}
          onDayClick={openDay}
        />
      )}
    </div>
  );
}
