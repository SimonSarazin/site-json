import { Suspense, type ReactNode } from "react";
import { lazy } from "vite-preload";
import type { StatDynamicSource } from "@/types/site-schema";
import { StatFigure, type StatFigureProps } from "./StatFigure";
import { STAT_PENDING, useMembersCountState, useSearchCountState } from "./statSourceState";

const AacCommunsStatValue = lazy(() => import("./AacCommunsStatValue"));

/** Ce que partagent `stats.props.items[]` et `cta-card-grid.props.stats[]`. */
interface StatLike {
  value?: string;
  source?: StatDynamicSource;
}

interface StatValueProps {
  stat: StatLike;
  skeletonClassName?: string;
  children: (value: string) => ReactNode;
}

type FigureProps = Omit<StatFigureProps, "state">;

const NO_SOURCE = { value: null, unavailable: true };

/**
 * Le chiffre d'une tuile de stat : ÉCRIT (`value`) ou COMPTÉ (`source`). Un composant par type
 * de source, aiguillé sur `source.type` (valeur figée de la config) : seule une tuile de recherche
 * lance une recherche, seule une tuile de communs charge le module AAC (chunk à part).
 *
 * Partagé par `stats` et `cta-card-grid` : le contrat d'affichage est celui de `StatFigure`.
 */
export function StatValue({ stat, skeletonClassName, children }: StatValueProps) {
  const figure: FigureProps = { written: stat.value, skeletonClassName, children };
  switch (stat.source?.type) {
    case "searchCount":
      return <SearchCountValue source={stat.source} {...figure} />;
    case "membersCount":
      return <MembersCountValue source={stat.source} {...figure} />;
    case "aacCommuns":
      return (
        <Suspense fallback={<StatFigure state={STAT_PENDING} {...figure} />}>
          <AacCommunsStatValue {...figure} />
        </Suspense>
      );
    default:
      // Sans source, seul le chiffre écrit compte : rien à attendre (une config qui n'a ni l'un ni
      // l'autre — le schéma l'interdit, mais il ne tourne pas au runtime — reçoit un tiret).
      return <StatFigure state={NO_SOURCE} {...figure} />;
  }
}

function SearchCountValue({
  source,
  ...figure
}: FigureProps & { source: Extract<StatDynamicSource, { type: "searchCount" }> }) {
  return <StatFigure state={useSearchCountState(source)} {...figure} />;
}

function MembersCountValue({
  source,
  ...figure
}: FigureProps & { source: Extract<StatDynamicSource, { type: "membersCount" }> }) {
  return <StatFigure state={useMembersCountState(source)} {...figure} />;
}
