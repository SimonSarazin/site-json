import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Event } from "@communecter/cocolight-api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { eventOccurrence } from "../lib/eventDates";
import { eventTypeColor } from "../constants/eventTypeColors";

export interface AgendaCalendarProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  /** Plage visible (grille du mois) → le parent refetch `searchEventsCostum` sur cette plage. */
  onRangeChange?: (start: Date, end: Date) => void;
  locale?: string;
}

const MAX_PER_DAY = 3; // au-delà : « +N ».
const WEEK_OPTS = { weekStartsOn: 1 } as const; // lundi.

/**
 * GRILLE calendrier MOIS — implémentation maison (Tailwind + date-fns + tokens shadcn), dans l'esprit
 * des « big calendar » shadcn. Remplace schedule-x (qui inline sa propre copie de temporal-polyfill →
 * nos events `Temporal` étaient rejetés par `instanceof`). Avantages : thème NATIF (nos tokens, clair/
 * sombre par costum), pas de souci Temporal, events = nos `Date` directes (occurrences déjà dépliées
 * par `searchEventsCostum`). Même interface props (events / onEventClick / onRangeChange).
 */
export default function AgendaCalendar({ events, onEventClick, onRangeChange, locale = "fr-FR" }: AgendaCalendarProps) {
  const dfLocale = locale.startsWith("en") ? enUS : fr;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const gridStart = useMemo(() => startOfWeek(startOfMonth(viewMonth), WEEK_OPTS), [viewMonth]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(viewMonth), WEEK_OPTS), [viewMonth]);
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  // Refetch de la plage visible à la navigation (callback figée via ref → pas de boucle).
  const onRangeRef = useRef(onRangeChange);
  onRangeRef.current = onRangeChange;
  useEffect(() => {
    onRangeRef.current?.(gridStart, gridEnd);
  }, [gridStart, gridEnd]);

  // Occurrences regroupées par jour (yyyy-MM-dd), triées par heure.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, { event: Event; start: Date }[]>();
    for (const ev of events) {
      const { start } = eventOccurrence(ev);
      if (!start) continue;
      const key = format(start, "yyyy-MM-dd");
      const arr = map.get(key);
      if (arr) arr.push({ event: ev, start });
      else map.set(key, [{ event: ev, start }]);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    return map;
  }, [events]);

  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(gridStart, i), "EEE", { locale: dfLocale })),
    [gridStart, dfLocale],
  );

  const title = (() => {
    const s = format(viewMonth, "MMMM yyyy", { locale: dfLocale });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      {/* Barre de navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-lg font-semibold capitalize">{title}</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setViewMonth(startOfMonth(new Date()))}>
            {locale.startsWith("en") ? "Today" : "Aujourd'hui"}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Mois précédent" onClick={() => setViewMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Mois suivant" onClick={() => setViewMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* En-têtes jours */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
            {w}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const dayEvents = eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[88px] border-b border-r border-border p-1.5 last:border-r-0 sm:min-h-[120px]",
                !inMonth && "bg-muted/20",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-sm",
                  !inMonth && "text-muted-foreground",
                  today && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>

              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, MAX_PER_DAY).map(({ event }, i) => {
                  const sd = (event.serverData ?? {}) as Record<string, unknown>;
                  const name = typeof sd.name === "string" && sd.name ? sd.name : "(sans titre)";
                  return (
                    <button
                      key={`${String(sd.id ?? sd._id ?? i)}-${i}`}
                      type="button"
                      onClick={() => onEventClick(event)}
                      title={name}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-muted"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: eventTypeColor(typeof sd.type === "string" ? sd.type : undefined) }} />
                      <span className="truncate text-foreground">{name}</span>
                    </button>
                  );
                })}
                {dayEvents.length > MAX_PER_DAY && (
                  <span className="px-1 text-xs text-muted-foreground">+{dayEvents.length - MAX_PER_DAY}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
