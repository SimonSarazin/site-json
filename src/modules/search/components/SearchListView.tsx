import { useState, useRef, useEffect } from "react";
import SearchCard from "./SearchCard";
import { SearchListViewProps } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import SearchCardDetailed from "./SearchCardDetailed";
import { cn } from "@/lib/utils";
import { getEntryId } from "../lib/searchMapSelection";

export default function SearchListView({
  results,
  columns,
  card,
  preview,
  isDetailedView = false,
  focusedItemId,
  onFocusItem,
}: SearchListViewProps) {
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<SearchEntity | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleOpenDetails = (item: SearchEntity) => {
    setItem(item);
    setOpenDetails(true);
  };

  // Mode split (onFocusItem fourni) : un clic sur une carte FOCALISE la carte
  // (flyTo + popup) au lieu d'ouvrir le détail ; sinon comportement historique.
  const handleCardClick = (it: SearchEntity) => {
    const id = getEntryId(it);
    if (onFocusItem && id) onFocusItem(id);
    else handleOpenDetails(it);
  };

  // Synchro carte→liste : quand un marqueur est cliqué, amener sa carte dans la vue.
  useEffect(() => {
    if (!focusedItemId || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-item-id="${CSS.escape(String(focusedItemId))}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedItemId]);

  const gridClasses = [
    "grid",
    "gap-4",
    // Base mobile (<sm) : 1 colonne contrainte (minmax(0,1fr)). Sans elle, la grille
    // n'a aucun grid-template-columns sous 640px → colonne implicite auto = max-content
    // de la carte → débordement horizontal (la carte sort de sa cellule, contenu coupé).
    "grid-cols-1",
    columns?.sm ? `sm:grid-cols-${columns.sm}` : null,
    columns?.md ? `md:grid-cols-${columns.md}` : null,
    columns?.lg ? `lg:grid-cols-${columns.lg}` : null,
    columns?.xl ? `xl:grid-cols-${columns.xl}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Enveloppe une carte : highlight (ring) quand focalisée + data-item-id (scroll).
  const wrap = (it: SearchEntity, child: React.ReactNode) => {
    const id = getEntryId(it);
    return (
      <div
        key={id}
        data-item-id={id}
        className={cn(
          "rounded-xl transition",
          focusedItemId != null &&
            id === String(focusedItemId) &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        {child}
      </div>
    );
  };

  if (isDetailedView) {
    return (
      <>
        <div ref={containerRef} className="space-y-4">
          {results.map((item) =>
            wrap(
              item,
              <SearchCardDetailed item={item} onClick={() => handleCardClick(item)} card={card} />,
            ),
          )}
        </div>

        {item && <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} card={card} preview={preview} />}
      </>
    );
  }

  // Vue grille normale
  return (
    <>
      <div ref={containerRef} className={gridClasses}>
        {results.map((item) =>
          wrap(item, <SearchCard item={item} onClick={() => handleCardClick(item)} card={card} />),
        )}
      </div>

      {/* faire switch sur card?.detailsMode */}
      {item && <SwitchDetailsMode openDetails={openDetails} setOpenDetails={setOpenDetails} item={item} card={card} preview={preview} />}
    </>
  );
}
