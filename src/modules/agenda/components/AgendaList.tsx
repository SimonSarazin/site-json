import { Loader2 } from "lucide-react";
import type { Event, SearchEntity } from "@communecter/cocolight-api-client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import SearchListView from "@/modules/search/components/SearchListView";
import type { ListConf } from "@/modules/search/schema";
import type { AgendaTab } from "../schema";

export interface AgendaListProps {
  tab: AgendaTab;
  onTabChange: (t: AgendaTab) => void;
  tabs: AgendaTab[];
  /** Events déjà fetchés + filtrés (tags) par le conteneur Agenda (source unique). */
  buckets: Record<AgendaTab, Event[]>;
  loading: boolean;
  card: ListConf["card"];
  preview: ListConf["preview"];
  columns?: ListConf["columns"];
  hasMorePast?: boolean;
  onLoadMorePast?: () => void;
  loadingMorePast?: boolean;
  /** false = teaser : un seul bucket (= `tab`), sans barre d'onglets. */
  showTabs?: boolean;
}

/**
 * Vue LISTE présentationnelle : onglets temporels (ou bucket unique en teaser) + `SearchListView`
 * (cartes event + détail au clic). Aucune donnée propre — tout vient d'Agenda (fetch + filtres centralisés).
 */
export default function AgendaList({
  tab,
  onTabChange,
  tabs,
  buckets,
  loading,
  card,
  preview,
  columns,
  hasMorePast,
  onLoadMorePast,
  loadingMorePast,
  showTabs = true,
}: AgendaListProps) {
  const t = useT("modules/agenda");

  const renderBucket = (tb: AgendaTab) =>
    loading && tab === tb ? (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ) : buckets[tb].length > 0 ? (
      <>
        <SearchListView results={buckets[tb] as unknown as SearchEntity[]} columns={columns} card={card} preview={preview} />
        {tb === "past" && hasMorePast && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={onLoadMorePast} disabled={loadingMorePast}>
              {loadingMorePast ? t("loadingMore") : t("loadMore")}
            </Button>
          </div>
        )}
      </>
    ) : (
      <div className="py-12 text-center text-muted-foreground">{t("empty")}</div>
    );

  // Teaser : un seul bucket (= onglet par défaut), sans barre d'onglets.
  if (!showTabs) return <div className="mt-2">{renderBucket(tab)}</div>;

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as AgendaTab)} className="w-full">
      <TabsList>
        {tabs.map((tb) => (
          <TabsTrigger key={tb} value={tb}>{t(`tab.${tb}`)}</TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tb) => (
        <TabsContent key={tb} value={tb} className="mt-6">
          {renderBucket(tb)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
