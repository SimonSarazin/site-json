import { useState } from "react";
import { XIcon } from "lucide-react";
import { MeeteemSectionProps } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useFetchAnswerQuery } from "../../hooks/useFetchAnswerQuery";
import type { MeeteemCard, MeeteemViewMode } from "../../types";
import { collectAvailableTags, filterCards } from "../../utils/cardFilters";
import { MeeteemViewToggle } from "./parts/MeeteemViewToggle";
import { MeeteemFilters } from "./parts/MeeteemFilters";
import { MeeteemCard as MeeteemCardComponent } from "./parts/MeeteemCard";
import { MeeteemMapPlaceholder } from "./parts/MeeteemMapPlaceholder";

/**
 * Section communauté Meeteem — affiche les réponses d'un coform sous 3 vues :
 * Annuaire (cartes), Carte (placeholder), Split (cartes + carte).
 *
 * Composition :
 * - `MeeteemViewToggle` — toggle 3 vues
 * - `MeeteemFilters` — accordéon de filtres par tags
 * - `MeeteemCard` — carte d'une réponse (variant large/compact)
 * - `MeeteemMapPlaceholder` — placeholder vue Carte
 *
 * Animations : `cardSlideIn` keyframes (vue Annuaire uniquement) — voir bloc `<style>`.
 */
export default function MeeteemSection({ id, props }: { id?: string; props: MeeteemSectionProps }) {
  useLoadNamespace("modules/ampli");
  const t = useT("modules/ampli");

  const [viewMode, setViewMode] = useState<MeeteemViewMode>("answers");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string | null>(null);

  const { coform, path: dataPath } = props;

  const { lastItemRef, transformedResults: rawResults, isLoading } = useFetchAnswerQuery({
    coformId: coform,
    view: viewMode,
    baseParams: {
      indexStepList: 6,
      indexStepMap: 0,
      defaultFilters: {
        form: coform,
        finderPath: dataPath.finder || "",
        ...(dataPath.name !== ""
          ? { [`answers.${dataPath.name}`]: { $exists: true } }
          : {}),
      },
      defaultFields: [
        ...Object.values(dataPath).map((value) => `answers.${value}`),
        "user",
        "vote",
        "voteCount",
      ],
      defaultSortBy: { created: -1 },
    },
    extractionConfig: { dataPath, prefix: "answers", includeUserInfo: true },
  });

  // `useFetchAnswerQuery` retourne `unknown[]` — cast vers le type strict utilisé
  // par les sous-composants (validé par le shape de `extractionConfig.includeUserInfo: true`).
  const cards = (rawResults ?? []) as MeeteemCard[];

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const availableTags = isLoading ? [] : collectAvailableTags(cards);
  const filteredCards = filterCards(cards, activeFilters, userFilter);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-5 py-8" id={id}>
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
            <span className="text-xs font-semibold text-primary-foreground max-w-[100px] truncate">
              {userFilter}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setUserFilter(null)}
              className="w-5 h-5 p-0 text-primary-foreground hover:bg-primary/40 hover:text-primary-foreground rounded-full"
              aria-label={String(t("MeeteemSection.viewToggle.answers"))}
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(32%,1fr))] gap-3 w-full">
          {filteredCards.map((card, index) => (
            <MeeteemCardComponent
              key={card.answer.serverData.id ?? `card-${index}`}
              card={card}
              activeFilters={activeFilters}
              onToggleFilter={toggleFilter}
              onSelectUser={setUserFilter}
              variant="large"
              animationDelay={index * 50}
            />
          ))}
        </div>
      )}

      {/* Vue Carte */}
      {viewMode === "map" && <MeeteemMapPlaceholder variant="large" />}

      {/* Vue Split */}
      {viewMode === "split" && (
        <div className="flex gap-5 h-[600px]">
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {filteredCards.map((card, index) => (
              <MeeteemCardComponent
                key={card.answer.serverData.id ?? `card-compact-${index}`}
                card={card}
                activeFilters={activeFilters}
                onToggleFilter={toggleFilter}
                onSelectUser={setUserFilter}
                variant="compact"
              />
            ))}
          </div>
          <MeeteemMapPlaceholder variant="compact" />
        </div>
      )}

      {viewMode === "answers" && <div ref={lastItemRef} className="h-12" />}

      {/* Styles personnalisés : animation cardSlideIn pour la vue Annuaire */}
      <style>
        {`
        @keyframes cardSlideIn {
          0% { opacity: 0; transform: translateY(40px) scale(0.85); }
          60% { opacity: 0.8; transform: translateY(-8px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        `}
      </style>
    </div>
  );
}
