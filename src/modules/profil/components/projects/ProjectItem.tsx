import { Calendar, MapPin } from "lucide-react";
import type { Project } from "@communecter/cocolight-api-client";
import { formatDate } from "@/helpers/formatDate";
import { useT } from "@/hooks/useT";
import { Link } from "react-router";

interface ProjectItemProps {
  item: Project;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLAnchorElement) => void;
}

export function ProjectItem({ item, isLastItem, lastItemRef }: ProjectItemProps) {
  const t = useT("modules/profil");

  const projectName = (item.serverData?.name as string) || t("ProjectsTab.anonymousProject");
  const description = (item.serverData?.shortDescription as string) || (item.serverData?.description as string);
  const startDate = item.serverData?.startDate as Date | undefined;
  const endDate = item.serverData?.endDate as Date | undefined;
  const address = item.serverData?.address as { addressLocality?: string; postalCode?: string } | undefined;
  const thumbUrl = item.serverData?.profilThumbImageUrl as string | undefined;
  const slug = item.serverData?.slug as string | undefined;

  return (
    <Link
      ref={isLastItem ? lastItemRef : undefined}
      to={slug ? `/profil/${slug}` : "#"}
      className="group bg-background rounded-lg border border-border shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col h-full"
    >
      {thumbUrl && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={thumbUrl}
            alt={projectName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col">
        <div className="mb-2">
          <h3 className="text-lg font-semibold text-foreground mb-1 line-clamp-2 group-hover:text-teal-600 transition-colors">
            {projectName}
          </h3>

          {address?.addressLocality && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {address.addressLocality}
                {address.postalCode && `, ${address.postalCode}`}
              </span>
            </div>
          )}
        </div>

        {description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3 flex-1">
            {description}
          </p>
        )}

        <div className="mt-auto pt-3 border-t border-border space-y-2">
          {(startDate || endDate) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>
                {startDate && formatDate(startDate)}
                {startDate && endDate && " - "}
                {endDate && formatDate(endDate)}
              </span>
            </div>
          )}

          {item.serverData?.tags && Array.isArray(item.serverData.tags) && item.serverData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(item.serverData.tags as string[]).slice(0, 2).map((tag: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                >
                  {tag}
                </span>
              ))}
              {(item.serverData.tags as string[]).length > 2 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{String((item.serverData.tags as string[]).length - 2)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
