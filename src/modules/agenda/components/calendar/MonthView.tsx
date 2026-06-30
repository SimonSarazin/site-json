import { useMemo } from "react";
import type { Locale } from "date-fns";
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import type { Event } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { eventTypeColor } from "../../constants/eventTypeColors";
import { eventsOnDay, type DayEvent } from "../../lib/calendarLayout";

const WEEK_OPTS = { weekStartsOn: 1 } as const;
const MAX_PER_DAY = 3;

export interface MonthViewProps {
  cursor: Date;
  dayEvents: DayEvent[];
  dfLocale: Locale;
  onEventClick: (event: Event) => void;
  onDayClick: (day: Date) => void;
}

/** Grille mois (7×5/6) — tokens shadcn, aujourd'hui en primary, pastilles couleur/type, « +N ». */
export default function MonthView({ cursor, dayEvents, dfLocale, onEventClick, onDayClick }: MonthViewProps) {
  const gridStart = useMemo(() => startOfWeek(startOfMonth(cursor), WEEK_OPTS), [cursor]);
  const gridEnd = useMemo(() => endOfWeek(endOfMonth(cursor), WEEK_OPTS), [cursor]);
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(gridStart, i), "EEE", { locale: dfLocale })),
    [gridStart, dfLocale],
  );

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {weekdays.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const list = eventsOnDay(dayEvents, day);
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "flex min-h-[92px] flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-accent/40 sm:min-h-[124px]",
                !inMonth && "bg-muted/20",
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums",
                  !inMonth && "text-muted-foreground",
                  today && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>

              <div className="flex flex-col gap-0.5">
                {list.slice(0, MAX_PER_DAY).map((d, i) => (
                  <span
                    key={`${d.event.serverData?.id ?? i}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(d.event);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        onEventClick(d.event);
                      }
                    }}
                    title={d.title}
                    className="flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: eventTypeColor(d.type) }} />
                    <span className="truncate text-foreground">{d.title}</span>
                  </span>
                ))}
                {list.length > MAX_PER_DAY && (
                  <span className="px-1 text-[11px] font-medium text-muted-foreground">+{list.length - MAX_PER_DAY}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
