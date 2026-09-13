// Section utilisable hors du module ampli : `SectionRenderer` la charge en lazy via
// `type: "meeteem"` dans un config JSON, sans passer par le module. L'import du bundle
// i18n doit donc vivre ici aussi (même pattern que DataObservatorySection).
import "../../i18n";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { MeeteemSectionProps } from "@/types/site-schema";
import { getEntryId } from "@/modules/search/lib/searchMapSelection";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";
import { useFetchAnswerQuery } from "../../hooks/useFetchAnswerQuery";
import { useAmpliAllAnswers } from "../../hooks/useAmpliAllAnswers";
import { useMeeteemReactions } from "../../hooks/useMeeteemReactions";
import type { MeeteemCard, MeeteemViewMode } from "../../types";
import { collectAvailableTags, filterCards } from "../../utils/cardFilters";
import { buildMeeteemMapModel, isAnswerId, meeteemCardId } from "../../utils/meeteemGeo";
import { MeeteemViewToggle } from "./parts/MeeteemViewToggle";
import { MeeteemFilters } from "./parts/MeeteemFilters";
import { MeeteemCard as MeeteemCardComponent } from "./parts/MeeteemCard";
import { MeeteemMap } from "./parts/MeeteemMap";
import { MeeteemAnswerModal } from "./parts/MeeteemAnswerModal";

/** Taille de page de la vue annuaire (infinite scroll). */
const LIST_PAGE_SIZE = 6;
/** Taille de page des vues carte/split — pages enchaînées, cf. `useAmpliAllAnswers`. */
const MAP_PAGE_SIZE = 500;

/**
 * Section communauté Meeteem — affiche les réponses d'un coform sous 3 vues :
 * Annuaire (cartes), Carte, Split (liste + carte synchronisées).
 *
 * Deux régimes de chargement, un par usage :
 * - Annuaire : infinite scroll (`useFetchAnswerQuery`, pages de 6) — on ne
 *   charge que ce que l'utilisateur fait défiler ;
 * - Carte / Split : périmètre COMPLET chargé PROGRESSIVEMENT
 *   (`useAmpliAllAnswers`, pages de 500) — une carte n'a de sens que si TOUTES
 *   les réponses y figurent. Même stratégie que la carte de `SearchProStatic`.
 *
 * Composition :
 * - `MeeteemViewToggle` — toggle 3 vues
 * - `MeeteemFilters` — accordéon de filtres par tags
 * - `MeeteemCard` — carte d'une réponse (variant large/compact)
 * - `MeeteemMap` — carte MapLibre (réutilise le stack du module search)
 *
 * Animations : `cardSlideIn` keyframes (vue Annuaire uniquement) — voir bloc `<style>`.
 */
export default function MeeteemSection({ id, props }: { id?: string; props: MeeteemSectionProps }) {
  useLoadNamespace("modules/ampli");
  const t = useT("modules/ampli");

  const [viewMode, setViewMode] = useState<MeeteemViewMode>("answers");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  /** Synchro split : réponse focalisée (liste ↔ marqueur). */
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  /** Réponse ouverte en détail lecture seule (annuaire, split ET popup carte). */
  const [openedAnswer, setOpenedAnswer] = useState<{ id: string; title?: string } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const { coform, path: dataPath } = props;
  const usesMap = viewMode === "map" || viewMode === "split";

  // Mémoïsés : `baseParams` et `extractionConfig` entrent dans la queryKey et
  // dans les deps de la transformation des résultats — recréés à chaque rendu,
  // ils feraient retransformer tout le périmètre (jusqu'à 5000 réponses).
  const baseParams = useMemo(
    () => ({
      indexStepList: LIST_PAGE_SIZE,
      indexStepMap: MAP_PAGE_SIZE,
      defaultFilters: {
        form: coform,
        finderPath: dataPath.finder || "",
        ...(dataPath.name !== "" ? { [`answers.${dataPath.name}`]: { $exists: true } } : {}),
      },
      defaultFields: [
        ...Object.values(dataPath).map((value) => `answers.${value}`),
        "user",
        "vote",
        "voteCount",
      ],
      defaultSortBy: { created: -1 as const },
    }),
    [coform, dataPath],
  );
  const extractionConfig = useMemo(
    () => ({ dataPath, prefix: "answers", includeUserInfo: true }),
    [dataPath],
  );

  // Vue annuaire : infinite scroll. Désactivée en vue carte/split (le périmètre
  // complet suffit) — le cache reste chaud, le retour à l'annuaire est immédiat.
  // Destructuré au site d'appel : garder l'objet et lire ses champs pendant le
  // rendu ferait remonter `lastItemRef` à travers eux (react-hooks/refs).
  const {
    lastItemRef,
    transformedResults: listResults,
    isLoading: listLoading,
  } = useFetchAnswerQuery({
    coformId: coform,
    view: "answers",
    baseParams,
    extractionConfig,
    enabled: !usesMap,
  });

  // Vues carte/split : toutes les pages, enchaînées automatiquement.
  const {
    results: mapResults,
    loaded,
    total,
    isComplete: mapComplete,
    capped,
    isPartial,
    isLoading: mapLoading,
    isPending: mapPending,
  } = useAmpliAllAnswers({
    coformId: coform,
    baseParams,
    extractionConfig,
    enabled: usesMap,
  });

  // `useFetchAnswerQuery` retourne `unknown[]` — cast vers le type strict utilisé
  // par les sous-composants (validé par le shape de `extractionConfig.includeUserInfo: true`).
  const cards = useMemo(
    () => (usesMap ? mapResults : listResults ?? []) as MeeteemCard[],
    [usesMap, mapResults, listResults],
  );
  const isLoading = usesMap ? mapLoading : listLoading;

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  // Les tags ACTIFS restent toujours proposés, même absents du jeu de la vue
  // courante : l'annuaire n'a que 6 réponses en mémoire là où la carte a tout
  // le périmètre, et sans cette union un tag coché depuis la carte perdrait sa
  // puce en annuaire — donc filtrerait la liste sans plus pouvoir être retiré.
  const availableTags = useMemo(() => {
    const fromCards = isLoading ? [] : collectAvailableTags(cards);
    return [...fromCards, ...activeFilters.filter((tag) => !fromCards.includes(tag))];
  }, [cards, isLoading, activeFilters]);
  const filteredCards = useMemo(
    () => filterCards(cards, activeFilters, userFilter),
    [cards, activeFilters, userFilter],
  );

  // Modèle carto : les filtres s'appliquent AUSSI à la carte (un tag décoché
  // retire son marqueur), et la liste du split sait quelles réponses sont
  // pointables. Un seul parcours — cf. `buildMeeteemMapModel`.
  const { entities, locatedIds } = useMemo(
    () => (usesMap ? buildMeeteemMapModel(filteredCards) : { entities: [], locatedIds: new Set<string>() }),
    [usesMap, filteredCards],
  );

  // La carte n'est « complète » qu'une fois la 1ʳᵉ page revenue : sans le garde
  // `isPending`, la bascule vers la vue carte afficherait un flash « aucune
  // réponse localisée » avant même le premier appel.
  const mapIsComplete = mapComplete && !mapPending;

  // Synchro carte→liste (split) : amener la carte focalisée dans la vue.
  useEffect(() => {
    if (!focusedItemId || !listRef.current) return;
    listRef.current
      .querySelector(`[data-item-id="${CSS.escape(focusedItemId)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedItemId]);

  // Ouverture du détail — UNE seule porte pour les trois entrées (carte de
  // l'annuaire, carte du split, popup de la carte). `isAnswerId` écarte le repli
  // `meeteem-<index>` de `meeteemCardId` : sans vrai ObjectId, il n'y a rien à
  // charger et mieux vaut ne pas rendre la carte cliquable.
  const openDetails = useCallback((answerId: string, title?: string) => {
    if (!isAnswerId(answerId)) return;
    setOpenedAnswer({ id: answerId, title });
  }, []);

  // La popup de la carte remonte l'entité carto : son id EST l'answerId (cf.
  // `toMeeteemMapEntity`). `true` consomme le clic côté SearchMap.
  const openDetailsFromMap = useCallback(
    (item: SearchEntity) => {
      const id = getEntryId(item);
      if (!isAnswerId(id)) return false;
      const name = (item.serverData as { name?: string } | undefined)?.name;
      setOpenedAnswer({ id, title: name || undefined });
      return true;
    },
    [],
  );

  // Réactions (« amplifications ») — ajout ET retrait par la MÊME action, le
  // backend basculant selon l'état existant. Monté ici, pas dans la carte : les
  // deux vues à cartes partagent la bascule optimiste et une seule mutation.
  const { getReaction } = useMeeteemReactions();

  const showEmpty = !isLoading && filteredCards.length === 0;

  return (
    <div className="w-full mx-auto" id={id}>
      {/* Header — pill user filter + toggle vues */}
      <div
        className={`flex items-center ${
          userFilter ? "justify-between" : "justify-end"
        } gap-3 mb-4 flex-wrap md:flex-nowrap`}
      >
        {userFilter && (
          <div className="flex items-center gap-2 bg-primary border border-primary/40 rounded-full px-3 py-1 transition-all">
            <div className="w-6 h-6 rounded-full bg-background text-primary flex items-center justify-center text-xs font-semibold">
              {userFilter.charAt(0)}
            </div>
            <span className="text-xs font-semibold text-primary-foreground max-w-25 truncate">
              {userFilter}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setUserFilter(null)}
              className="w-5 h-5 p-0 text-primary-foreground hover:bg-primary/40 hover:text-primary-foreground rounded-full"
              aria-label={String(t("MeeteemSection.filters.clearUser"))}
            >
              <XIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        <MeeteemViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Filtres */}
      <MeeteemFilters
        availableTags={availableTags}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
      />

      {/* Vue Annuaire */}
      {viewMode === "answers" && (
        // `minmax(32%, …)` forçait 3 colonnes à toutes les tailles (y compris 360px) :
        // paliers explicites 1 / 2 / 3 colonnes à la place.
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
          {filteredCards.map((card, index) => {
            const cardId = meeteemCardId(card, index);
            const reaction = getReaction(card, cardId);
            return (
              <MeeteemCardComponent
                key={cardId}
                card={card}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onSelectUser={setUserFilter}
                variant="large"
                animationDelay={index * 50}
                onOpenDetails={
                  isAnswerId(cardId) ? () => openDetails(cardId, card.data.name) : undefined
                }
                reactionCount={reaction.count}
                hasReacted={reaction.reacted}
                reactionPending={reaction.pending}
                onToggleReaction={reaction.toggle}
              />
            );
          })}
        </div>
      )}

      {/* Vue Carte */}
      {viewMode === "map" && (
        <MeeteemMap
          entities={entities}
          loaded={loaded}
          total={total}
          isComplete={mapIsComplete}
          capped={capped}
          isPartial={isPartial}
          onItemAction={openDetailsFromMap}
          className="h-80 sm:h-105 md:h-150 mb-10"
        />
      )}

      {/* Vue Split : liste (gauche) + carte (droite) SYNCHRONISÉES, alimentées
          par le MÊME périmètre → ids alignés. Sous `lg`, la carte passe sous la
          liste : deux colonnes de ~180px côte à côte étaient inutilisables. */}
      {viewMode === "split" && (
        <div className="flex flex-col lg:flex-row gap-5 lg:h-150">
          <div
            ref={listRef}
            className="flex-1 min-w-0 max-h-[60vh] lg:max-h-none overflow-y-auto pr-2 space-y-3"
          >
            {filteredCards.map((card, index) => {
              const cardId = meeteemCardId(card, index);
              const located = locatedIds.has(cardId);
              const reaction = getReaction(card, cardId);
              return (
                <div
                  key={cardId}
                  data-item-id={cardId}
                  className={cn(
                    "rounded-xl transition",
                    focusedItemId === cardId &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <MeeteemCardComponent
                    card={card}
                    activeFilters={activeFilters}
                    onToggleFilter={toggleFilter}
                    onSelectUser={setUserFilter}
                    variant="compact"
                    onLocate={located ? () => setFocusedItemId(cardId) : undefined}
                    showNoLocation={!located}
                    onOpenDetails={
                      isAnswerId(cardId) ? () => openDetails(cardId, card.data.name) : undefined
                    }
                    reactionCount={reaction.count}
                    hasReacted={reaction.reacted}
                    reactionPending={reaction.pending}
                    onToggleReaction={reaction.toggle}
                  />
                </div>
              );
            })}
            {showEmpty && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {String(t("MeeteemSection.empty"))}
              </p>
            )}
          </div>
          <MeeteemMap
            entities={entities}
            loaded={loaded}
            total={total}
            isComplete={mapIsComplete}
            capped={capped}
          isPartial={isPartial}
          onItemAction={openDetailsFromMap}
            focusedItemId={focusedItemId}
            onMarkerFocus={setFocusedItemId}
            className="min-w-0 h-80 sm:h-105 lg:h-auto lg:flex-1"
          />
        </div>
      )}

      {viewMode === "answers" && showEmpty && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {String(t("MeeteemSection.empty"))}
        </p>
      )}

      {/* Sentinelle d'infinite scroll — vue annuaire uniquement (les vues carte
          et split chargent tout le périmètre sans scroll). */}
      {viewMode === "answers" && <div ref={lastItemRef} className="h-12" />}

      {/* Détail de la réponse en LECTURE SEULE — monté UNE fois pour les trois
          entrées (annuaire, split, popup carte), comme `SwitchDetailsMode` est
          monté hors de la boucle de cartes dans `SearchListView`. */}
      <MeeteemAnswerModal
        coformId={coform}
        answerId={openedAnswer?.id ?? null}
        title={openedAnswer?.title}
        onClose={() => setOpenedAnswer(null)}
      />

      {/* Styles personnalisés : animation cardSlideIn pour la vue Annuaire */}
      <style>
        {`
        @keyframes cardSlideIn {
          0% { opacity: 0; transform: translateY(40px) scale(0.85); }
          60% { opacity: 0.8; transform: translateY(-8px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        `}
      </style>
    </div>
  );
}
