import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import SearchCard from "./SearchCard";
import { SearchListViewProps } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import SearchCardDetailed from "./SearchCardDetailed";
import { PreviewNavContext } from "../contexts/previewNav";
import { cn } from "@/lib/utils";

export default function SearchListView({
  results,
  columns,
  card,
  preview,
  isDetailedView = false,
  focusedItemId,
  onFocusItem,
  previewParam = "preview",
}: SearchListViewProps) {
  const [openDetails, setOpenDetails] = useState(false);
  const [item, setItem] = useState<SearchEntity | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // Mémorise le dernier id traité pour éviter de rouvrir si l'URL ne change pas.
  const lastHandledPreviewId = useRef<string | null>(null);

  // Sync bidirectionnelle URL ↔ preview :
  //  - param présent (nouveau) → ouvre le preview de l'item correspondant ;
  //  - param absent alors qu'un preview est ouvert → ferme (back/forward, nav
  //    depuis une section sœur) pour que l'état suive toujours l'URL.
  // setState dans l'effet = LE pattern sanctionné « s'abonner à un système
  // externe » (ici l'URL/`searchParams`) → désactivation ciblée de la règle
  // react-compiler qui sur-déclenche sur ce cas légitime.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const previewId = searchParams.get(previewParam);
    if (!previewId) {
      if (openDetails) {
        lastHandledPreviewId.current = null;
        setOpenDetails(false);
      }
      return;
    }
    if (previewId === lastHandledPreviewId.current) return;
    const found = results.find(
      (r) => String(r.serverData?.id ?? r.id) === previewId,
    );
    if (found) {
      lastHandledPreviewId.current = previewId;
      setItem(found);
      setOpenDetails(true);
    }
  }, [results, searchParams, previewParam, openDetails]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleOpenDetails = (it: SearchEntity) => {
    const id = String(it.serverData?.id ?? it.id);
    lastHandledPreviewId.current = id;
    setItem(it);
    setOpenDetails(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(previewParam, id);
        return next;
      },
      { replace: true },
    );
  };

  // Wrapper pour setOpenDetails : retire le param URL à la fermeture
  const handleSetOpenDetails = (open: boolean) => {
    setOpenDetails(open);
    if (!open) {
      lastHandledPreviewId.current = null;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(previewParam);
          return next;
        },
        { replace: true },
      );
    }
  };

  // Ferme le preview SANS retoucher l'URL : la navigation par facette
  // (useDropdownFilterNav) supprime le param dans sa mutation atomique unique —
  // un 2e setSearchParams ici l'écraserait (même `prev`, cf. React Router).
  const closeRaw = useCallback(() => {
    lastHandledPreviewId.current = null;
    setOpenDetails(false);
  }, []);
  const previewNavValue = useMemo(() => ({ previewParam, closeRaw }), [previewParam, closeRaw]);

  // Mode split (onFocusItem fourni) : un clic sur une carte FOCALISE la carte
  // (flyTo + popup) au lieu d'ouvrir le détail ; sinon comportement historique.
  const handleCardClick = (it: SearchEntity) =>
    onFocusItem ? onFocusItem(String(it.serverData.id)) : handleOpenDetails(it);

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
    const id = String(it?.serverData?.id);
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

        {item && (
          <PreviewNavContext.Provider value={previewNavValue}>
            <SwitchDetailsMode openDetails={openDetails} setOpenDetails={handleSetOpenDetails} item={item} card={card} preview={preview} />
          </PreviewNavContext.Provider>
        )}
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
      {item && (
        <PreviewNavContext.Provider value={previewNavValue}>
          <SwitchDetailsMode openDetails={openDetails} setOpenDetails={handleSetOpenDetails} item={item} card={card} preview={preview} />
        </PreviewNavContext.Provider>
      )}
    </>
  );
}
