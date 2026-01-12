import { useState } from "react";
import { BookUser, AtSign, Globe, Phone, Smartphone, Tag, LayoutList, Cake, Pencil } from "lucide-react";
import { useT } from "@/hooks/useT";
import { formatDate } from "@/helpers/formatDate";
import type { ProfileEntity } from "@/modules/profil/types";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { EditInfoGeneralModal } from "./edit/EditInfoGeneralModal";

interface InfoGeneralSectionProps {
  entity: ProfileEntity;
  entityType: string;
}

export function InfoGeneralSection({ entity, entityType }: InfoGeneralSectionProps) {
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const serverData = entity.serverData as Record<string, unknown> | undefined;
  const entityName = "name" in entity ? (entity as { name?: string }).name : undefined;
  const name = (serverData?.name as string) || entityName;
  const email = serverData?.email as string | undefined;
  const url = serverData?.url as string | undefined;
  const urls = serverData?.urls as string[] | undefined;
  const tags = serverData?.tags as string[] | undefined;
  const type = serverData?.type as string | undefined;
  const birthDate = serverData?.birthDate as string | undefined;
  const telephone = serverData?.telephone as Record<string, string[]> | undefined;
  const fixe = telephone?.fixe?.[0] || (serverData?.fixe as string | undefined);
  const mobile = (serverData?.mobile as string) || telephone?.mobile?.[0];
  const properties = serverData?.properties as Record<string, string> | undefined;
  const avancement = properties?.avancement;

  const renderInfoItem = (
    icon: React.ReactNode,
    label: unknown,
    value: string | undefined | null,
    formatValue?: (v: string) => string
  ) => {
    if (!value) return null;
    const displayValue = formatValue ? formatValue(value) : value;
    return (
      <p className="mb-2 text-sm font-medium truncate flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="text-muted-foreground">{String(label)}:</span>
        <span className="text-foreground">{displayValue}</span>
      </p>
    );
  };

  return (
    <li className={`ms-6 w-full mb-4 group ${canEdit ? "hover:bg-muted/50 hover:rounded-lg p-2 -ml-3 pl-8 transition-colors" : ""}`}>
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-primary text-primary-foreground">
        <BookUser className="w-3 h-3" />
      </span>
      <div className="flex justify-between items-center">
        <h2 className="flex items-center mb-1 text-base font-semibold text-foreground uppercase">
          {t("AboutTab.generalInfo")}
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
      <div className="text-sm">
        {renderInfoItem(<AtSign className="w-4 h-4" />, t("AboutTab.name"), name as string)}

        {entityType === "projects" && avancement && (
          renderInfoItem(<LayoutList className="w-4 h-4" />, t("AboutTab.progress"), avancement as string)
        )}

        {entityType !== "poi" && email && typeof email === "string" && (
          renderInfoItem(<AtSign className="w-4 h-4" />, t("AboutTab.email"), email)
        )}

        {entityType === "citoyens" && birthDate && (
          renderInfoItem(
            <Cake className="w-4 h-4" />,
            t("AboutTab.birthDate"),
            birthDate as string,
            (v) => formatDate(v)
          )
        )}

        <p className="mb-2 text-sm font-medium flex items-start gap-2">
          <Globe className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <span className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground mr-1">
              {entityType !== "poi" ? t("AboutTab.link") : t("AboutTab.freeInfo")}:
            </span>
            {entityType !== "poi" ? (
              url && typeof url === "string" ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 break-all"
                >
                  {url}
                </a>
              ) : (
                <span className="text-muted-foreground">{t("AboutTab.notSpecified")}</span>
              )
            ) : urls && Array.isArray(urls) && urls.length > 0 ? (
              urls.map((urlItem, index) => (
                <span
                  key={index}
                  className="text-foreground bg-muted text-xs font-medium px-2.5 py-0.5 rounded"
                >
                  {urlItem}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{t("AboutTab.notSpecified")}</span>
            )}
          </span>
        </p>

        {(entityType === "organizations" || entityType === "citoyens") && (
          <>
            {fixe && renderInfoItem(<Phone className="w-4 h-4" />, t("AboutTab.fixedPhone"), fixe as string)}
            {mobile && renderInfoItem(<Smartphone className="w-4 h-4" />, t("AboutTab.mobilePhone"), mobile as string)}
          </>
        )}

        {(entityType === "organizations" || entityType === "poi") && type && typeof type === "string" && (
          renderInfoItem(<LayoutList className="w-4 h-4" />, t("AboutTab.type"), type)
        )}

        <div className="mb-4 text-base font-normal flex items-start gap-2">
          <Tag className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground mr-1 text-sm">{t("AboutTab.tags")}:</span>
            {tags && Array.isArray(tags) && tags.length > 0 ? (
              tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-primary-foreground bg-primary text-xs font-medium px-2.5 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{t("AboutTab.notSpecified")}</span>
            )}
          </div>
        </div>
      </div>

      {canEdit && (
        <EditInfoGeneralModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          entityType={entityType}
          initialData={{
            name: name as string,
            email: email as string,
            url: url as string,
            fixe: fixe as string,
            mobile: mobile as string,
            birthDate: birthDate as string,
            type: type as string,
            avancement: avancement as string,
            tags: tags as string[],
          }}
        />
      )}
    </li>
  );
}
