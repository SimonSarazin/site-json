import { useEffect, useMemo, useRef } from "react";
import type { Locale } from "date-fns";
import { format, isToday } from "date-fns";
import type { Event } from "@communecter/cocolight-api-client";
import { cn } from "@/lib/utils";
import { eventTypeColor } from "../../constants/eventTypeColors";
import { layoutDay, type DayEvent } from "../../lib/calendarLayout";

const HOUR_H = 48; // px par heure
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const AXIS_W = "3.5rem"; // largeur de l'axe horaire (w-14)

export interface TimeGridViewProps {
  days: Date[]; // 7 (semaine) ou 1 (jour)
  dayEvents: DayEvent[];
  dfLocale: Locale;
  onEventClick: (event: Event) => void;
  onDayClick: (day: Date) => void;
}

/** Grille horaire (semaine/jour) : axe heures + colonnes-jours, blocs positionnés (packing des
 *  chevauchements), ligne « maintenant », scroll vertical (auto à ~7h) + horizontal en mobile. */
export default function TimeGridView({ days, dayEvents, dfLocale, onEventClick, onDayClick }: TimeGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H; // démarre vers 7h
  }, []);

  const now = useMemo(() => new Date(), []);
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_H;
  const isWeek = days.length > 1;

  return (
    <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
      <div className={cn("relative", isWeek && "min-w-[680px]")}>
        {/* En-tête jours (sticky top) */}
        <div className="sticky top-0 z-20 flex border-b border-border bg-card">
          <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: AXIS_W }} />
          {days.map((day) => {
            const today = isToday(day);
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => onDayClick(day)}
                className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2 transition-colors hover:bg-accent/40"
                style={{ minWidth: isWeek ? 88 : undefined }}
              >
                <span className="text-[11px] font-medium uppercase text-muted-foreground">{format(day, "EEE", { locale: dfLocale })}</span>
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums", today && "bg-primary font-semibold text-primary-foreground")}>
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Corps : axe + colonnes */}
        <div className="flex">
          {/* Axe horaire (sticky left) */}
          <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: AXIS_W }}>
            {HOURS.map((h) => (
              <div key={h} className="relative text-right" style={{ height: HOUR_H }}>
                {h > 0 && <span className="absolute -top-2 right-1.5 text-[11px] tabular-nums text-muted-foreground">{String(h).padStart(2, "0")}:00</span>}
              </div>
            ))}
          </div>

          {/* Colonnes jours */}
          {days.map((day) => {
            const positioned = layoutDay(dayEvents, day);
            const today = isToday(day);
            return (
              <div key={day.toISOString()} className="relative flex-1 border-l border-border" style={{ minWidth: isWeek ? 88 : undefined }}>
                {/* lignes horaires */}
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-border/60" style={{ height: HOUR_H }} />
                ))}

                {/* ligne « maintenant » */}
                {today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="h-px flex-1 bg-destructive" />
                  </div>
                )}

                {/* blocs events */}
                {positioned.map((e, i) => {
                  const color = eventTypeColor(e.type);
                  const top = (e.startMin / 60) * HOUR_H;
                  const height = Math.max(((e.endMin - e.startMin) / 60) * HOUR_H, 18);
                  const widthPct = 100 / e.cols;
                  return (
                    <button
                      type="button"
                      key={`${e.event.serverData?.id ?? i}-${i}`}
                      onClick={() => onEventClick(e.event)}
                      title={e.title}
                      className="absolute overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left text-xs shadow-sm transition-shadow hover:z-20 hover:shadow-md"
                      style={{
                        top,
                        height,
                        left: `calc(${e.col * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        borderLeftColor: color,
                        backgroundColor: `${color}2e`,
                      }}
                    >
                      <span className="block truncate font-medium text-foreground">{e.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{format(e.start, "HH:mm")}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
