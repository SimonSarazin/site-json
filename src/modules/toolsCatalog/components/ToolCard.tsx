import type { ToolCatalogItem } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { ToolImage } from "./ToolImage";

interface ToolCardProps {
  tool: ToolCatalogItem;
  onOpen: (tool: ToolCatalogItem) => void;
}

/** Vignette centrée d'un outil (mode grille), inspirée du legacy. Clic → modale détail. */
export function ToolCard({ tool, onOpen }: ToolCardProps) {
  const t = useT("modules/toolsCatalog");
  const usages = tool.usagesList.join(", ");

  return (
    <button
      type="button"
      onClick={() => onOpen(tool)}
      className="group relative flex h-full flex-col items-center overflow-hidden rounded-xl border border-border bg-card p-5 text-center transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {tool.isOpenSource && (
        <span className="absolute right-0 top-0 rounded-bl-lg bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
          {t("openSourceBadge")}
        </span>
      )}

      <div className="mb-3 grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
        <ToolImage src={tool.image} alt={tool.title} width={128} />
      </div>

      <h3 className="mb-2 line-clamp-2 font-bold uppercase leading-tight text-foreground">
        {tool.title}
      </h3>

      {tool.usagesCount > 0 && (
        <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
          <span aria-hidden="true">•</span>
          {t("usagesCount", undefined, { count: tool.usagesCount })}
        </span>
      )}

      {usages && (
        <p className="line-clamp-1 w-full text-sm text-muted-foreground" title={usages}>
          {usages}
        </p>
      )}
    </button>
  );
}
