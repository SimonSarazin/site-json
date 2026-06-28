import { Suspense, lazy, useMemo, useState } from "react";
import { addMonths, subMonths } from "date-fns";
import { CalendarDays, List, Loader2, Search } from "lucide-react";
import { EVENT_TYPES, type SearchEntity } from "@communecter/cocolight-api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { useLocalization } from "@/hooks/useLocalization";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import type { ListConf } from "@/modules/search/schema";
import AgendaList from "./components/AgendaList";
import { useAgendaCalendar } from "./hooks/useAgendaCalendar";
import type { AgendaSectionProps } from "./schema";

const AgendaCalendar = lazy(() => import("./components/AgendaCalendar"));

/**
 * Conteneur agenda (event-centré) : bascule Liste/Calendrier + filtres (texte + type) + détail au clic.
 * - Liste : onglets temporels (En cours / À venir / Passés) via AgendaList.
 * - Calendrier : grille schedule-x (client-only, lazy), fenêtre large now-3m→now+12m (pas de refetch nav, v1).
 * Les deux sur `searchEventsCostum` ; même détail PreviewEvent au clic (lié event ↔ agenda).
 */
export function Agenda({ props }: { props: AgendaSectionProps }) {
  const { t } = useLocalization();
  const {
    title,
    description,
    defaultMode = "list",
    tabs = ["upcoming", "ongoing", "past"],
    defaultTab = "upcoming",
    upcomingWindowMonths = 12,
    filters,
    detailsMode = "drawer",
    columns,
  } = props;

  const [mode, setMode] = useState<"list" | "calendar">(defaultMode);
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const debouncedText = useDebounce(text, 500);
  const typeParam = type || undefined;
  const nameParam = debouncedText || undefined;

  const showText = filters?.text !== false;
  const showType = filters?.type !== false;

  // Détail au clic (partagé liste/calendrier).
  const [openDetails, setOpenDetails] = useState(false);
  const [selected, setSelected] = useState<SearchEntity | null>(null);
  const card = useMemo<ListConf["card"]>(() => ({ type: "event", detailsMode }), [detailsMode]);
  const preview = useMemo<ListConf["preview"]>(() => ({ type: "event" }), []);

  // Grille calendrier : fenêtre large (fetch unique), active uniquement en mode calendrier.
  const now = useMemo(() => new Date(), []);
  const calRange = useMemo(() => ({ start: subMonths(now, 3), end: addMonths(now, 12) }), [now]);
  const calGrid = useAgendaCalendar({
    rangeStart: calRange.start,
    rangeEnd: calRange.end,
    type: typeParam,
    name: nameParam,
    enabled: mode === "calendar",
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          {title && <h2 className="text-2xl font-bold text-foreground">{t(title)}</h2>}
          {description && <p className="text-muted-foreground mt-1">{t(description)}</p>}
        </div>
        <div className="flex gap-1">
          <Button variant={mode === "list" ? "default" : "outline"} size="sm" onClick={() => setMode("list")}>
            <List className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Liste</span>
          </Button>
          <Button variant={mode === "calendar" ? "default" : "outline"} size="sm" onClick={() => setMode("calendar")}>
            <CalendarDays className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Calendrier</span>
          </Button>
        </div>
      </div>

      {(showText || showType) && (
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          {showText && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Rechercher un événement…" className="pl-9" />
            </div>
          )}
          {showType && (
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              aria-label="Type d'événement"
            >
              <option value="">Tous les types</option>
              {EVENT_TYPES.map((evType) => (
                <option key={evType} value={evType}>{evType}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === "calendar" ? (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <AgendaCalendar
            events={calGrid.events}
            onEventClick={(ev) => {
              setSelected(ev as unknown as SearchEntity);
              setOpenDetails(true);
            }}
          />
        </Suspense>
      ) : (
        <AgendaList
          tabs={tabs}
          defaultTab={defaultTab}
          upcomingWindowMonths={upcomingWindowMonths}
          type={typeParam}
          name={nameParam}
          detailsMode={detailsMode}
          columns={columns}
        />
      )}

      {selected && (
        <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={selected} card={card} preview={preview} />
      )}
    </div>
  );
}

export default Agenda;
