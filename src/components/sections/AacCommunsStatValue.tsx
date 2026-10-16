import { useAacCommunsCountState } from "@/modules/aac/hooks/useAacCommunsCountState";
import { StatFigure, type StatFigureProps } from "./StatFigure";

/**
 * Chiffre d'une tuile à source `aacCommuns` : le décompte du médaillon d'`aac-highlight`.
 * Chunk à part (chargé par `StatValue` en `lazy`) : les hooks AAC et leur transport ne sont
 * préchargés que sur les pages qui comptent des communs, pas sur toute page à tuiles.
 */
export default function AacCommunsStatValue(figure: Omit<StatFigureProps, "state">) {
  const { count, error, reachable } = useAacCommunsCountState(true);
  return <StatFigure state={{ value: count, unavailable: !reachable || (count == null && !!error) }} {...figure} />;
}
