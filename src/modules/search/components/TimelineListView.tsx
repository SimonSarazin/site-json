import { Suspense } from "react";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import getDateFnsLocale from "@/dateFns";
import { toValidDate } from "@/helpers/formatDate";
import SearchCardSkeleton from "./SearchCardSkeleton";
import CardEventTimeline from "./card/CardEventTimeline";
import { getEntryId } from "../lib/searchMapSelection";
import type { ListConf, SearchListEntity } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";

interface TimelineListViewProps {
  results: SearchListEntity[];
  /** Conf de liste EFFECTIVE par item (résolue par `resolveListItemConfs` dans SearchListView). */
  itemLists: (ListConf | undefined)[];
  list?: ListConf;
  onItemClick: (it: SearchEntity, itemList?: ListConf) => void;
  focusedItemId?: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Bulle-date PLEINE posée sur la ligne : jour / mois abrégé / année sur 3 lignes. */
function DateBubble({ date }: { date: Date | null }) {
  const locale = getDateFnsLocale();
  return (
    <div
      className={cn(
        "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full",
        "border-4 border-background shadow-md",
        date ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {date ? (
        <>
          <span className="text-lg font-bold leading-none tabular-nums">
            {format(date, "d", { locale })}
          </span>
          <span className="text-[10px] font-semibold uppercase leading-tight">
            {format(date, "LLL", { locale })}
          </span>
          <span className="text-[10px] leading-tight tabular-nums">
            {format(date, "yyyy", { locale })}
          </span>
        </>
      ) : (
        // Repli : item sans date de début — la bulle reste le repère visuel de la ligne.
        <Calendar className="h-5 w-5" />
      )}
    </div>
  );
}

/**
 * Vue « timeline » d'une liste de résultats (`list.layout: "timeline"`) : frise verticale —
 * ligne pointillée (à gauche en mobile, centrée dès md), bulle-date posée sur la ligne,
 * cartes alternées gauche/droite en desktop (idiome responsive de `TimelineSection`).
 *
 * L'alternance est PAR INDEX (pur, sans horloge ni aléa) : stable en scroll infini et
 * identique SSR/client. La date vient de `serverData.startDate` (lecture directe +
 * `toValidDate` — pas de hook dans la boucle) : le layout est pensé pour des événements
 * triés par `baseParams.defaultSortBy: {"startDate": -1}`.
 */
export default function TimelineListView({
  results,
  itemLists,
  list,
  onItemClick,
  focusedItemId,
  containerRef,
}: TimelineListViewProps) {
  return (
    <div ref={containerRef} className="relative">
      {/* Ligne pointillée : à gauche en mobile (alignée sur le centre des bulles), centrée dès md. */}
      <div
        aria-hidden
        className="absolute left-8 top-0 h-full -translate-x-1/2 border-l-2 border-dashed border-primary/40 md:left-1/2"
      />

      {results.map((it, i) => {
        const id = getEntryId(it as SearchEntity);
        const startDate = toValidDate((it.serverData as { startDate?: unknown } | undefined)?.startDate);
        const onLeft = i % 2 === 0;
        return (
          <div
            key={id ?? i}
            className={cn(
              "relative mb-10 flex items-start last:mb-0",
              onLeft ? "md:flex-row" : "md:flex-row-reverse",
            )}
          >
            {/* Bulle sur la ligne — absolue, comme le dot de TimelineSection. */}
            <div className="absolute left-8 -translate-x-1/2 md:left-1/2">
              <DateBubble date={startDate} />
            </div>

            {/* Carte : pleine largeur décalée après la ligne en mobile, 5/12 alternée dès md. */}
            <div
              data-item-id={id}
              className={cn(
                "ml-20 w-[calc(100%-5rem)] rounded-xl transition md:ml-0 md:w-5/12",
                onLeft ? "md:mr-auto" : "md:ml-auto",
                focusedItemId != null &&
                  id === String(focusedItemId) &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              <Suspense fallback={<SearchCardSkeleton />}>
                <CardEventTimeline
                  item={it as SearchEntity}
                  onClick={() => onItemClick(it as SearchEntity, itemLists[i])}
                  card={itemLists[i]?.card ?? list?.card}
                  list={itemLists[i] ?? list}
                />
              </Suspense>
            </div>
          </div>
        );
      })}
    </div>
  );
}
