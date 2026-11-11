import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Priority } from "@/modules/kanban/types";
import { PRIORITY_DOT_CLASS, PRIORITY_DOT_SHAPE, type PriorityDotShape } from "./priorityTone";

export interface PriorityDotProps {
  /** `null` = aucune priorité (cas courant d'une action Communecter) : rien n'est rendu. */
  priority: Priority | null;
  className?: string;
}

/*
 * Les quatre silhouettes, dans une boîte de 12 px (`PRIORITY_DOT_SHAPE` dit laquelle va à quel
 * niveau). Tracées en SVG avec `currentColor` : en mode couleurs forcées, le navigateur retire
 * fonds et ombres, mais garde le tracé, recoloré dans la couleur système du texte.
 */
function Shape({ shape }: { shape: PriorityDotShape }) {
  switch (shape) {
    case "ring":
      return <circle cx="6" cy="6" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />;
    case "dot":
      return <circle cx="6" cy="6" r="4" fill="currentColor" />;
    case "target":
      return (
        <>
          <circle cx="6" cy="6" r="3" fill="currentColor" />
          <circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      );
    case "diamond":
      return <path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" fill="currentColor" />;
  }
}

/**
 * Point de priorité de la carte (DESIGN §6.4 de co-kanban), DOUBLÉ d'un libellé accessible : la
 * priorité s'entend au lecteur d'écran (« Priorité : Haute ») et se lit à la souris
 * (infobulle) ; la FORME, elle, la dit sans la couleur.
 */
export function PriorityDot({ priority, className }: PriorityDotProps) {
  const { t } = useTranslation("modules/kanban");
  if (priority === null) return null;
  const label = t("priority.dotLabel", { priority: t(`priority.long.${priority}`) });
  const shape = PRIORITY_DOT_SHAPE[priority];

  return (
    <span role="img" aria-label={label} title={label} data-shape={shape} className={cn("inline-flex shrink-0 items-center", PRIORITY_DOT_CLASS[priority], className)}>
      <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" className="block shrink-0" focusable="false">
        <Shape shape={shape} />
      </svg>
    </span>
  );
}
