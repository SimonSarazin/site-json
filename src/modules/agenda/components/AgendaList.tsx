import { useMemo, useState } from "react";
import { addMonths } from "date-fns";
import { Loader2 } from "lucide-react";
import type { Event, SearchEntity } from "@communecter/cocolight-api-client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import SearchListView from "@/modules/search/components/SearchListView";
import type { ListConf } from "@/modules/search/schema";
import { useAgendaCalendar } from "../hooks/useAgendaCalendar";
import { useAgendaList } from "../hooks/useAgendaList";
import { partitionByTime } from "../lib/partitionByTime";
import { eventOccurrence } from "../lib/eventDates";
import type { AgendaTab } from "../schema";

const TAB_LABEL: Record<AgendaTab, string> = { ongoing: "En cours", upcoming: "À venir", past: "Passés" };

export interface AgendaListProps {
  tabs: AgendaTab[];
  defaultTab: AgendaTab;
  upcomingWindowMonths: number;
  type?: string;
  name?: string;
  detailsMode: "drawer" | "dialog";
  columns?: ListConf["columns"];
}

/**
 * Liste agenda à onglets temporels (En cours / À venir / Passés) sur `searchEventsCostum`.
 * - En cours / À venir : mode CALENDRIER now→fenêtre (récurrence dépliée) + partition client.
 * - Passés : mode LISTE paginé (« charger plus »), filtré aux occurrences passées.
 * Chaque onglet réutilise `SearchListView` (cartes event + détail PreviewEvent au clic).
 */
export function AgendaList({ tabs, defaultTab, upcomingWindowMonths, type, name, detailsMode, columns }: AgendaListProps) {
  const initial = tabs.includes(defaultTab) ? defaultTab : tabs[0];
  const [tab, setTab] = useState<AgendaTab>(initial);
  const now = useMemo(() => new Date(), []);
  const rangeEnd = useMemo(() => addMonths(now, upcomingWindowMonths), [now, upcomingWindowMonths]);

  const futureNeeded = tab === "upcoming" || tab === "ongoing";
  const cal = useAgendaCalendar({ rangeStart: now, rangeEnd, type, name, enabled: futureNeeded });
  const list = useAgendaList({ type, name, enabled: tab === "past" });

  const { ongoing, upcoming } = useMemo(() => partitionByTime(cal.events, now), [cal.events, now]);
  const past = useMemo(
    () =>
      list.events.filter((e) => {
        const { start, end } = eventOccurrence(e);
        const eff = end ?? start;
        return eff != null && eff.getTime() < now.getTime();
      }),
    [list.events, now],
  );

  const card = useMemo<ListConf["card"]>(() => ({ type: "event", detailsMode }), [detailsMode]);
  const preview = useMemo<ListConf["preview"]>(() => ({ type: "event" }), []);

  const buckets: Record<AgendaTab, Event[]> = { ongoing, upcoming, past };
  const loadingActive = futureNeeded ? cal.isLoading : list.isLoading;

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as AgendaTab)} className="w-full">
      <TabsList>
        {tabs.map((tb) => (
          <TabsTrigger key={tb} value={tb}>{TAB_LABEL[tb]}</TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tb) => (
        <TabsContent key={tb} value={tb} className="mt-6">
          {loadingActive && tab === tb ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : buckets[tb].length > 0 ? (
            <>
              <SearchListView results={buckets[tb] as unknown as SearchEntity[]} columns={columns} card={card} preview={preview} />
              {tb === "past" && list.hasNextPage && (
                <div className="flex justify-center mt-6">
                  <Button variant="outline" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                    {list.isFetchingNextPage ? "Chargement…" : "Charger plus"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Aucun événement</div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default AgendaList;
