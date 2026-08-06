import type { ToolCatalogItem } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { ToolImage } from "./ToolImage";

interface ToolListRowProps {
  tool: ToolCatalogItem;
  onOpen: (tool: ToolCatalogItem) => void;
}

/** Ligne d'un outil (mode liste). Un clic ouvre la modale détail. */
export function ToolListRow({ tool, onOpen }: ToolListRowProps) {
  const t = useT("modules/toolsCatalog");
  const usages = tool.usagesList.join(", ");

  return (
    <button
      type="button"
      onClick={() => onOpen(tool)}
      className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-3 text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
        <ToolImage
          src={tool.image}
          alt={tool.title}
          width={96}
          className="h-full w-full object-contain p-1"
          iconClassName="h-5 w-5 text-muted-foreground"
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-bold uppercase text-foreground">{tool.title}</h3>
        {usages && (
          <p className="line-clamp-1 text-sm text-muted-foreground" title={usages}>
            {usages}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {tool.isOpenSource && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">
            {t("openSourceBadge")}
          </span>
        )}
        {tool.usagesCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            <span aria-hidden="true">•</span>
            {t("usagesCount", undefined, { count: tool.usagesCount })}
          </span>
        )}
      </div>
    </button>
  );
}
