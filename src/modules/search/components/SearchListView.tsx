import "@/modules/search/i18n"; // Required: registers i18n resources — la LISTE/cards est montée hors
// section search (agenda, split map…) ; import explicite (indépendant de la chaîne SwitchDetailsMode).
import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router";
import SearchCard from "./SearchCard";
import SearchCardSkeleton from "./SearchCardSkeleton";
import { SearchListViewProps, type ListConf } from "../schema";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import SearchCardDetailed from "./SearchCardDetailed";
import { PreviewNavContext } from "../contexts/previewNav";
import { cn } from "@/lib/utils";
import { getEntryId } from "../lib/searchMapSelection";
import { resolveListItemConf, resolveListItemConfs } from "../lib/resolveListItemConf";
import { resolveItemClick } from "../lib/itemAction";

export default function SearchListView({
  results,
  columns: columnsProp,
  card: cardProp,
  preview: previewProp,
  list,
  isDetailedView = false,
  focusedItemId,
  onFocusItem,
  previewParam: previewParamProp,
}: SearchListViewProps) {
  // Config EFFECTIVE : prop explicite (agenda/observatoire/profil… passent card/preview/columns
  // sans objet `list`) OU dérivée de `list` (call-sites search, qui ne passent plus que `list`).
  const columns = columnsProp ?? list?.columns;
  const card = cardProp ?? list?.card;
  const preview = previewProp ?? list?.preview;
  const previewParam = previewParamProp ?? list?.previewParam ?? "preview";
  const [openDetails, setOpenDetails] = useState(false);
  // L'item ouvert transporte SA conf résolue : le `SwitchDetailsMode` est monté HORS de la boucle,
  // il n'a donc aucun moyen de la recalculer. Même pattern que `EntityPreviewState` de la palette
  // (`commandPalette/components/CommandPalette.tsx`).
  const [selected, setSelected] = useState<{ item: SearchEntity; list?: ListConf } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Conf de liste EFFECTIVE par item : sans `list.itemRules`, chaque entrée vaut `list` lui-même
  // (identité référentielle → comportement mono-carte historique strictement inchangé).
  const itemLists = useMemo(() => resolveListItemConfs(results, list), [results, list]);
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
    // `getEntryId` (id RACINE prioritaire) — MÊME formule qu'à l'écriture du param et que
    // `data-item-id` : `serverData.id` n'est pas toujours peuplé sur un résultat de recherche
    // (cf. searchMapSelection.ts), les deux formules divergeaient donc parfois.
    const found = results.find((r) => getEntryId(r) === previewId);
    if (found) {
      lastHandledPreviewId.current = previewId;
      // Résolution PURE (pas un hook) → utilisable dans l'effet.
      setSelected({ item: found, list: resolveListItemConf(found, list) });
      setOpenDetails(true);
    }
  }, [results, searchParams, previewParam, openDetails, list]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleOpenDetails = (it: SearchEntity, itemList?: ListConf) => {
    const id = getEntryId(it) ?? "";
    lastHandledPreviewId.current = id;
    setSelected({ item: it, list: itemList });
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
  // (flyTo + popup) au lieu d'ouvrir le détail ; sinon `itemAction` de la conf résolue décide —
  // absente, on retombe sur l'ouverture du détail (comportement historique).
  const handleCardClick = (it: SearchEntity, itemList?: ListConf) => {
    const id = getEntryId(it);
    if (onFocusItem && id) {
      onFocusItem(id);
      return;
    }
    const decision = resolveItemClick(it, itemList?.itemAction);
    if (decision.kind === "link") {
      if (decision.newTab) window.open(decision.href, "_blank", "noopener");
      else navigate(decision.href);
      return;
    }
    if (decision.kind === "profil") {
      navigate(decision.href);
      return;
    }
    handleOpenDetails(it, itemList);
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
  // Suspense PAR CARTE : les variants sont `lazy()`, et la seule frontière au-dessus de la grille est
  // celle de la SECTION (SectionRenderer) — sans ce Suspense, une liste hétérogène ferait clignoter
  // toute la section (header + filtres compris) dès qu'une page d'infinite scroll amène un type dont
  // le chunk n'est pas encore chargé.
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
        <Suspense fallback={<SearchCardSkeleton />}>{child}</Suspense>
      </div>
    );
  };

  if (isDetailedView) {
    return (
      <>
        <div ref={containerRef} className="space-y-4">
          {results.map((it, i) =>
            wrap(
              it,
              <SearchCardDetailed
                item={it}
                onClick={() => handleCardClick(it, itemLists[i])}
                card={itemLists[i]?.card ?? card}
                list={itemLists[i] ?? list}
              />,
            ),
          )}
        </div>

        {selected && (
          <PreviewNavContext.Provider value={previewNavValue}>
            <SwitchDetailsMode openDetails={openDetails} setOpenDetails={handleSetOpenDetails} item={selected.item} card={selected.list?.card ?? card} preview={selected.list?.preview ?? preview} list={selected.list ?? list} />
          </PreviewNavContext.Provider>
        )}
      </>
    );
  }

  // Vue grille normale
  return (
    <>
      <div ref={containerRef} className={gridClasses}>
        {results.map((it, i) =>
          wrap(it, <SearchCard item={it} onClick={() => handleCardClick(it, itemLists[i])} card={itemLists[i]?.card ?? card} list={itemLists[i] ?? list} />),
        )}
      </div>

      {/* Conteneur (dialog/drawer) choisi par `card.detailsMode` de la conf RÉSOLUE de l'item ouvert. */}
      {selected && (
        <PreviewNavContext.Provider value={previewNavValue}>
          <SwitchDetailsMode openDetails={openDetails} setOpenDetails={handleSetOpenDetails} item={selected.item} card={selected.list?.card ?? card} preview={selected.list?.preview ?? preview} list={selected.list ?? list} />
        </PreviewNavContext.Provider>
      )}
    </>
  );
}
