import "@/modules/search/i18n"; // Required: registers i18n resources — la LISTE/cards est montée hors
// section search (agenda, split map…) ; import explicite (indépendant de la chaîne SwitchDetailsMode).
import { useState, useRef, useEffect, useCallback, useMemo, useId, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { lazy } from "vite-preload";
import SearchCard from "./SearchCard";
import SearchCardSkeleton from "./SearchCardSkeleton";
import SearchListSkeleton from "./SearchListSkeleton";
import { DEFAULT_PREVIEW_PARAM, SearchListViewProps, type ListConf } from "../schema";
import { useEntityByIdQuery } from "../hooks/useEntityByIdQuery";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "./SwitchDetailsMode";
import SearchCardDetailed from "./SearchCardDetailed";
import { PreviewNavContext } from "../contexts/previewNav";
import { cn } from "@/lib/utils";
import { getEntryId } from "../lib/searchMapSelection";
import { resolveListItemConf, resolveListItemConfs } from "../lib/resolveListItemConf";
import { resolveItemClick } from "../lib/itemAction";
import { grouperParChamp } from "../lib/groupResults";
import GroupHeading from "./GroupHeading";

// Vue timeline en `lazy()` (même convention que les variants de SearchCard) : le chunk
// n'est téléchargé que par les pages qui posent `list.layout: "timeline"`.
const TimelineListView = lazy(() => import("./TimelineListView"));

export default function SearchListView({
  results,
  columns: columnsProp,
  card: cardProp,
  preview: previewProp,
  list,
  isDetailedView = false,
  focusedItemId,
  onFocusItem,
  onSelectItem,
  previewParam: previewParamProp,
}: SearchListViewProps) {
  // Config EFFECTIVE : prop explicite (agenda/observatoire/profil… passent card/preview/columns
  // sans objet `list`) OU dérivée de `list` (call-sites search, qui ne passent plus que `list`).
  const columns = columnsProp ?? list?.columns;
  const card = cardProp ?? list?.card;
  const preview = previewProp ?? list?.preview;
  const previewParam = previewParamProp ?? list?.previewParam ?? DEFAULT_PREVIEW_PARAM;
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
  // Groupes de `layout: "grouped"` — on regroupe des PAIRES {item, index} pour garder, après
  // découpage, la conf résolue de chaque item (`itemLists[i]`), indexée sur la liste d'origine.
  const groupBy = list?.layout === "grouped" ? list.groupBy : undefined;
  const groupes = useMemo(
    () => (groupBy?.field
      ? grouperParChamp(
        results.map((it, i) => ({ serverData: it.serverData, it, i })),
        groupBy.field,
        groupBy.order,
        groupBy.itemsSortBy && { champ: groupBy.itemsSortBy.field, ordre: groupBy.itemsSortBy.order },
      )
      : null),
    [results, groupBy],
  );
  // Préfixe des ids de titre de bloc : un id construit sur la VALEUR (« groupe-2022 ») casse dès qu'elle
  // contient une espace — `aria-labelledby` lit une LISTE d'ids séparés par des espaces — et se répète
  // si deux listes groupées partagent la page. `useId` est stable entre le rendu serveur et le client.
  const idListe = useId();
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

  // Repli par IDENTIFIANT (opt-in `list.previewFetch`) : l'effet ci-dessus ne
  // trouve l'item que dans `results`, c'est-à-dire dans la tranche chargée (10
  // par défaut). Un lien venu d'une AUTRE page vise presque toujours en dehors
  // — on charge alors la fiche par son id plutôt que de n'ouvrir rien.
  const urlPreviewId = searchParams.get(previewParam);
  const missingPreviewId =
    urlPreviewId && !results.some((r) => getEntryId(r) === urlPreviewId)
      ? urlPreviewId
      : undefined;
  const { data: fetchedEntity } = useEntityByIdQuery(list?.previewFetch, missingPreviewId);

  useEffect(() => {
    if (!fetchedEntity) return;
    const id = getEntryId(fetchedEntity);
    // Même garde que l'effet URL : ne pas rouvrir ce que l'utilisateur vient de
    // fermer (la fermeture retire le param, mais la réponse reste en cache).
    if (!id || id !== searchParams.get(previewParam) || id === lastHandledPreviewId.current) return;
    lastHandledPreviewId.current = id;
    setSelected({ item: fetchedEntity, list: resolveListItemConf(fetchedEntity, list) });
    setOpenDetails(true);
  }, [fetchedEntity, searchParams, previewParam, list]);
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
    // Tableau de bord embarqué : le clic SÉLECTIONNE. L'ouverture de la fiche
    // passe alors par le bouton dédié de la carte (`onOpenSheet` ci-dessous) —
    // sans quoi elle deviendrait inaccessible.
    if (onSelectItem) {
      onSelectItem(it);
      return;
    }
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

  // Vue timeline (`list.layout: "timeline"`) — la vue détaillée (ci-dessus) reste prioritaire,
  // et le mode split (`onFocusItem`) garde la grille : l'alternance gauche/droite n'a pas de
  // sens dans une colonne de liste étroite. Défaut CÔTÉ CODE = grille (la config n'est jamais
  // parsée par Zod au runtime → pas de `.default()` applicable).
  if (list?.layout === "timeline" && !onFocusItem) {
    return (
      <>
        <Suspense fallback={<SearchListSkeleton />}>
          <TimelineListView
            results={results}
            itemLists={itemLists}
            list={list}
            onItemClick={handleCardClick}
            focusedItemId={focusedItemId}
            containerRef={containerRef}
          />
        </Suspense>

        {/* Conteneur (dialog/drawer) choisi par `card.detailsMode` de la conf RÉSOLUE de l'item ouvert. */}
        {selected && (
          <PreviewNavContext.Provider value={previewNavValue}>
            <SwitchDetailsMode openDetails={openDetails} setOpenDetails={handleSetOpenDetails} item={selected.item} card={selected.list?.card ?? card} preview={selected.list?.preview ?? preview} list={selected.list ?? list} />
          </PreviewNavContext.Provider>
        )}
      </>
    );
  }

  // Vue groupée (`list.layout: "grouped"`) — même grille, même carte, même `wrap` que la vue grille,
  // simplement découpée en blocs titrés. Même règle de priorité que la timeline : vue détaillée et
  // mode split gardent leur rendu.
  if (groupes && !onFocusItem) {
    return (
      <>
        <div ref={containerRef} className="space-y-8">
          {groupes.map((groupe, rang) => (
            <section key={groupe.cle ?? "__sans-valeur__"} aria-labelledby={`${idListe}-groupe-${rang}`}>
              <GroupHeading id={`${idListe}-groupe-${rang}`} cle={groupe.cle} emptyLabel={groupBy?.emptyLabel} />
              <div className={gridClasses}>
                {groupe.items.map(({ it, i }) =>
                  wrap(it, <SearchCard item={it} onClick={() => handleCardClick(it, itemLists[i])} card={itemLists[i]?.card ?? card} list={itemLists[i] ?? list} />),
                )}
              </div>
            </section>
          ))}
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
          wrap(
            it,
            <SearchCard
              item={it}
              onClick={() => handleCardClick(it, itemLists[i])}
              // Bouton « Fiche » : uniquement quand le clic a été détourné vers la
              // sélection. Ailleurs, il ferait double emploi avec le clic.
              onOpenSheet={onSelectItem ? () => handleOpenDetails(it, itemLists[i]) : undefined}
              card={itemLists[i]?.card ?? card}
              list={itemLists[i] ?? list}
            />,
          ),
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
