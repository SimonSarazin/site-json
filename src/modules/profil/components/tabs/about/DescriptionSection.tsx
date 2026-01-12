import { useState } from "react";
import { FileText, Pencil } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileEntity } from "@/modules/profil/types";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { EditDescriptionModal } from "./edit/EditDescriptionModal";

interface DescriptionSectionProps {
  entity: ProfileEntity;
  entityType: string;
}

export function DescriptionSection({ entity, entityType }: DescriptionSectionProps) {
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const shortDescription = entity.serverData?.shortDescription as string | undefined;
  const description = entity.serverData?.description as string | undefined;

  const hasContent = shortDescription || description;

  if (!hasContent && entityType === "poi") {
    return null;
  }

  return (
    <li className={`ms-6 w-full mb-4 group ${canEdit ? "hover:bg-muted/50 hover:rounded-lg p-2 -ml-3 pl-8 transition-colors" : ""}`}>
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-primary text-primary-foreground">
        <FileText className="w-3 h-3" />
      </span>
      <div className="flex justify-between items-center">
        <h2 className="flex items-center text-base font-semibold text-foreground uppercase">
          {t("AboutTab.description")}
        </h2>
        {canEdit && (
          <button
            onClick={() => setIsEditOpen(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
            aria-label={String(t("EditAbout.edit"))}
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="text-sm mt-2">
        {shortDescription && typeof shortDescription === "string" ? (
          <p className="font-bold text-foreground mb-2">
            {shortDescription}
          </p>
        ) : null}
        {description && typeof description === "string" ? (
          <div className="font-medium text-foreground whitespace-pre-wrap wrap-break-word">
            {description}
          </div>
        ) : (
          !shortDescription && entityType !== "poi" && (
            <span className="text-muted-foreground">{String(t("AboutTab.notSpecified"))}</span>
          )
        )}
      </div>

      {canEdit && (
        <EditDescriptionModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          initialData={{
            shortDescription: shortDescription || "",
            description: description || "",
          }}
        />
      )}
    </li>
  );
}
