import { FileText } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileEntity } from "@/modules/profil/types";

interface DescriptionSectionProps {
  entity: ProfileEntity;
  entityType: string;
}

export function DescriptionSection({ entity, entityType }: DescriptionSectionProps) {
  const t = useT("modules/profil");

  const shortDescription = entity.serverData?.shortDescription;
  const description = entity.serverData?.description;

  const hasContent = shortDescription || description;

  if (!hasContent && entityType === "poi") {
    return null;
  }

  return (
    <li className="ms-6 w-full mb-4">
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-teal-600 text-white">
        <FileText className="w-3 h-3" />
      </span>
      <div className="flex justify-between">
        <h2 className="flex items-center text-base font-semibold text-foreground uppercase">
          {t("AboutTab.description")}
        </h2>
      </div>
      <div className="text-sm mt-2">
        {shortDescription && typeof shortDescription === "string" ? (
          <p className="font-bold text-foreground mb-2">
            {shortDescription}
          </p>
        ) : null}
        {description && typeof description === "string" ? (
          <div className="font-medium text-foreground whitespace-pre-wrap break-words">
            {description}
          </div>
        ) : (
          !shortDescription && entityType !== "poi" && (
            <span className="text-muted-foreground">{String(t("AboutTab.notSpecified"))}</span>
          )
        )}
      </div>
    </li>
  );
}
