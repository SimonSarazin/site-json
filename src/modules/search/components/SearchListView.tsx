import { useState } from "react";
import SearchCard from "./SearchCard";
import { SearchListViewProps, type SearchEntity } from "../schema";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import SearchCardDetailed from "./SearchCardDetailed";

export default function SearchListView({
  results,
  columns,
  card,
  preview,
  isDetailedView = false,
}: SearchListViewProps) {
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<SearchEntity | null>(null);

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
            />
          );
        })}
      </div>

      {/* faire switch sur card?.detailsMode */}
      {item && <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} card={card} preview={preview} />}
    </>
  );
}