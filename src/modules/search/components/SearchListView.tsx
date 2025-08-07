import { useState } from "react";
import SearchCard from "./SearchCard";
import { SearchListViewProps } from "../schema";
import { SwitchDetailsMode } from "./SwitchDetailsMode";

export default function SearchListView({
  results,
  columns,
  card,
  preview,
}: SearchListViewProps) {
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<any>(null);

  const handleOpenDetails = (item: any) => {
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
      <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} card={card} preview={preview} />
    </>
  );
}