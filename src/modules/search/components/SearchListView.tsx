import { useMemo, useState } from "react";
import SearchCard from "./SearchCard";
import { SearchListViewProps } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import SearchCardDetailed from "./SearchCardDetailed";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";

export default function SearchListView({
  results,
  columns,
  card,
  preview,
  isDetailedView = false,
}: SearchListViewProps) {
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<SearchEntity | null>(null);
  const cardType = card?.variant || card?.type;
  const needsFundingMap = cardType === "rezo-la-mer";
  const { data: fundingEnvelope } = useFundingEnvelope();

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fundingByProjectId = useMemo(() => {
    if (!needsFundingMap || !fundingEnvelope?.projects) {
      return undefined;
    }

    const nextMap: Record<string, { goal: number; raised: number; percentage: number }> = {};

    fundingEnvelope.projects.forEach((project) => {
      const projectId = String(project?.id || "").trim();
      if (!projectId) return;

      const goal = Number(project?.totalCouts ?? 0);
      const raised = Number(project?.totalFinancement ?? 0);
      const percentage = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

      nextMap[projectId] = { goal, raised, percentage };
    });

    return nextMap;
  }, [needsFundingMap, fundingEnvelope?.projects]);

  const handleOpenDetails = (item: SearchEntity) => {
    setItem(item);
    setOpenDetails(true);
  };

  const gridClasses = [
    "grid",
    "gap-4",
    columns?.sm ? `sm:grid-cols-${columns.sm}` : null,
    columns?.md ? `md:grid-cols-${columns.md}` : null,
    columns?.lg ? `lg:grid-cols-${columns.lg}` : null,
    columns?.xl ? `xl:grid-cols-${columns.xl}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (isDetailedView) {
    return (
      <>
        <div className="space-y-4">
          {results.map((item) => {
            const serverDataSafe = item?.serverData;

            return (
              <SearchCardDetailed
                key={serverDataSafe.id}
                item={item}
                onClick={() => handleOpenDetails(item)}
                card={card}
              />
            );
          })}
        </div>

        {item && <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} card={card} preview={preview} />}
      </>
    );
  }

  // Vue grille normale
  return (
    <>
      <div className={gridClasses}>
        {results.map((item) => {
          const serverDataSafe = item?.serverData;

          return (
            <SearchCard
              key={serverDataSafe.id}
              item={item}
              onClick={() => handleOpenDetails(item)}
              card={card}
              fundingByProjectId={fundingByProjectId}
            />
          );
        })}
      </div>

      {/* faire switch sur card?.detailsMode */}
      {item && <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} card={card} preview={preview} />}
    </>
  );
}