import { useEffect, useMemo, useRef } from "react";
import "@schedule-x/theme-shadcn/dist/index.css";
import "./agenda-calendar-theme.css"; // remap des --sx-color-* sur nos tokens (après le thème du paquet)
import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewMonthGrid, createViewWeek, createViewDay, createViewMonthAgenda } from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import type { Event } from "@communecter/cocolight-api-client";
import { mapEventsToCalendar } from "../lib/mapEventToCalendar";
import { EVENT_CALENDARS } from "../constants/eventTypeColors";

export interface AgendaCalendarProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  /** Plage visible (mois affiché) → le parent refetch `searchEventsCostum` sur cette plage. */
  onRangeChange?: (start: Date, end: Date) => void;
  locale?: string;
}

/**
 * GRILLE calendrier (schedule-x v4, thème shadcn) — ISOLE schedule-x ici (abstraction swappable). On lui passe
 * les occurrences déjà dépliées par `searchEventsCostum` ; clic event → `onEventClick(Event)` (→ détail réutilisé).
 * Composant CLIENT-ONLY (rendu lazy par le conteneur) : schedule-x (preact/DOM/Temporal) ne tourne pas en SSR.
 */
export default function AgendaCalendar({ events, onEventClick, onRangeChange, locale = "fr-FR" }: AgendaCalendarProps) {
  const eventsService = useMemo(() => createEventsServicePlugin(), []);
  const { calendarEvents, entityMap } = useMemo(() => mapEventsToCalendar(events), [events]);

  // Refs : les callbacks de useCalendarApp sont figés à l'init ; on lit toujours la dernière version.
  const entityMapRef = useRef(entityMap);
  entityMapRef.current = entityMap;
  const onClickRef = useRef(onEventClick);
  onClickRef.current = onEventClick;
  const onRangeRef = useRef(onRangeChange);
  onRangeRef.current = onRangeChange;

  const calendar = useCalendarApp(
    {
      views: [createViewMonthGrid(), createViewWeek(), createViewDay(), createViewMonthAgenda()],
      locale,
      calendars: EVENT_CALENDARS,
      events: calendarEvents,
      callbacks: {
        onEventClick: (e) => {
          const ent = entityMapRef.current.get(String(e.id));
          if (ent) onClickRef.current(ent);
        },
        // Fire à l'init + à chaque navigation (mois/semaine) → le parent refetch la plage visible.
        onRangeUpdate: (range) => {
          onRangeRef.current?.(new Date(range.start.epochMilliseconds), new Date(range.end.epochMilliseconds));
        },
      },
    },
    [eventsService],
  );

  // Mise à jour dynamique des events (refetch plage/filtre) sans recréer le calendrier.
  useEffect(() => {
    eventsService.set(calendarEvents);
  }, [calendarEvents, eventsService]);

  if (!calendar) return null;
  return (
    <div className="sx-react-calendar-wrapper h-[70vh]">
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
