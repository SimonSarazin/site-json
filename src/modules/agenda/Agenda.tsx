import { Suspense, lazy, useMemo, useState } from "react";
import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { CalendarDays, List, Loader2, Search } from "lucide-react";
import { EVENT_TYPES, type SearchEntity } from "@communecter/cocolight-api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import type { ListConf } from "@/modules/search/schema";
import AgendaList from "./components/AgendaList";
import { useAgendaCalendar } from "./hooks/useAgendaCalendar";
import { useAgendaList } from "./hooks/useAgendaList";
import { partitionByTime } from "./lib/partitionByTime";
import { eventOccurrence } from "./lib/eventDates";
import { distinctTags, filterByTags } from "./lib/eventTags";
import type { AgendaSectionProps, AgendaTab } from "./schema";

const AgendaCalendar = lazy(() => import("./components/AgendaCalendar"));

/**
 * Conteneur agenda (event-centré) — SOURCE UNIQUE de données : bascule Liste/Calendrier, filtres
 * (texte + type → backend `searchEventsCostum` ; tags → client), détail au clic. La liste est
 * présentationnelle (AgendaList) ; tout le fetch + filtrage vit ici.
 */
export function Agenda({ props }: { props: AgendaSectionProps }) {
  const { t: tl } = useLocalization();
  const t = useT("modules/agenda");
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
  const [tab, setTab] = useState<AgendaTab>(tabs.includes(defaultTab) ? defaultTab : tabs[0]);
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const debouncedText = useDebounce(text, 500);
  const typeParam = type || undefined;
  const nameParam = debouncedText || undefined;

  const showText = filters?.text !== false;
  const showType = filters?.type !== false;
  const showTags = filters?.tags === true;

  const now = useMemo(() => new Date(), []);
  const upcomingRangeEnd = useMemo(() => addMonths(now, upcomingWindowMonths), [now, upcomingWindowMonths]);

  // ── Fetch (gaté par le mode) — backend searchEventsCostum ──────────────────
  // Liste : À venir/En cours = mode CALENDRIER now→fenêtre ; Passés = mode LISTE paginé.
  const upcomingFetch = useAgendaCalendar({
    rangeStart: now,
    rangeEnd: upcomingRangeEnd,
    type: typeParam,
    name: nameParam,
    enabled: mode === "list",
  });
  const pastFetch = useAgendaList({ type: typeParam, name: nameParam, enabled: mode === "list" });
  // Calendrier : plage = mois visible (refetch à la navigation via onRangeChange).
  const [calRange, setCalRange] = useState(() => ({ start: startOfMonth(now), end: endOfMonth(now) }));
  const gridFetch = useAgendaCalendar({
    rangeStart: calRange.start,
    rangeEnd: calRange.end,
    type: typeParam,
    name: nameParam,
    enabled: mode === "calendar",
  });

  // ── Tags disponibles (selon le mode) + filtrage client ─────────────────────
  const availableTags = useMemo(
    () => (mode === "calendar" ? distinctTags(gridFetch.events) : distinctTags([...upcomingFetch.events, ...pastFetch.events])),
    [mode, gridFetch.events, upcomingFetch.events, pastFetch.events],
  );

  const { ongoing, upcoming } = useMemo(
    () => partitionByTime(filterByTags(upcomingFetch.events, selectedTags), now),
    [upcomingFetch.events, selectedTags, now],
  );
  const past = useMemo(
    () =>
      filterByTags(
        pastFetch.events.filter((e) => {
          const { start, end } = eventOccurrence(e);
          const eff = end ?? start;
          return eff != null && eff.getTime() < now.getTime();
        }),
        selectedTags,
      ),
    [pastFetch.events, selectedTags, now],
  );
  const calendarEvents = useMemo(() => filterByTags(gridFetch.events, selectedTags), [gridFetch.events, selectedTags]);

  const buckets: Record<AgendaTab, typeof past> = { ongoing, upcoming, past };
  const listLoading = tab === "past" ? pastFetch.isLoading : upcomingFetch.isLoading;

  // ── Détail au clic (partagé liste/calendrier) ──────────────────────────────
  const [openDetails, setOpenDetails] = useState(false);
  const [selected, setSelected] = useState<SearchEntity | null>(null);
  const card = useMemo<ListConf["card"]>(() => ({ type: "event", detailsMode }), [detailsMode]);
  const preview = useMemo<ListConf["preview"]>(() => ({ type: "event" }), []);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          {title && <h2 className="text-2xl font-bold text-foreground">{tl(title)}</h2>}
          {description && <p className="text-muted-foreground mt-1">{tl(description)}</p>}
        </div>
        <div className="flex gap-1">
          <Button variant={mode === "list" ? "default" : "outline"} size="sm" onClick={() => setMode("list")}>
            <List className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t("view.list")}</span>
          </Button>
          <Button variant={mode === "calendar" ? "default" : "outline"} size="sm" onClick={() => setMode("calendar")}>
            <CalendarDays className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t("view.calendar")}</span>
          </Button>
        </div>
      </div>

      {(showText || showType) && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {showText && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("filters.searchPlaceholder")} className="pl-9" />
            </div>
          )}
          {showType && (
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              aria-label={t("filters.typeAria")}
            >
              <option value="">{t("filters.allTypes")}</option>
              {EVENT_TYPES.map((evType) => (
                <option key={evType} value={evType}>{t(`eventType.${evType}`)}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {showTags && availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {availableTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className={cn("cursor-pointer select-none")}
              onClick={() => toggleTag(tag)}
            >
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {mode === "calendar" ? (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <AgendaCalendar
            events={calendarEvents}
            onEventClick={(ev) => {
              setSelected(ev as unknown as SearchEntity);
              setOpenDetails(true);
            }}
            onRangeChange={(s, e) => setCalRange({ start: s, end: e })}
          />
        </Suspense>
      ) : (
        <AgendaList
          tab={tab}
          onTabChange={setTab}
          tabs={tabs}
          buckets={buckets}
          loading={listLoading}
          card={card}
          preview={preview}
          columns={columns}
          hasMorePast={pastFetch.hasNextPage}
          onLoadMorePast={() => pastFetch.fetchNextPage()}
          loadingMorePast={pastFetch.isFetchingNextPage}
        />
      )}

      {selected && (
        <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={selected} card={card} preview={preview} />
      )}
    </div>
  );
}

export default Agenda;
