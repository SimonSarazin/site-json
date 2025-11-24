import { Calendar, MapPin, ExternalLink } from "lucide-react";
import type { Project } from "@communecter/cocolight-api-client";
import { formatDate } from "@/helpers/formatDate";
import { useT } from "@/hooks/useT";
import { Link } from "react-router";

interface ProjectItemDetailedProps {
  item: Project;
  isLastItem?: boolean;
  lastItemRef?: (node: HTMLDivElement) => void;
}

export function ProjectItemDetailed({ item, isLastItem, lastItemRef }: ProjectItemDetailedProps) {
  const t = useT("modules/profil");

  const projectName = (item.serverData?.name as string) || t("ProjectsTab.anonymousProject");
  const description = (item.serverData?.shortDescription as string) || (item.serverData?.description as string);
  const startDate = item.serverData?.startDate as Date | undefined;
  const endDate = item.serverData?.endDate as Date | undefined;
  const address = item.serverData?.address as { addressLocality?: string; postalCode?: string } | undefined;
  const thumbUrl = item.serverData?.profilThumbImageUrl as string | undefined;
  const slug = item.serverData?.slug as string | undefined;

  return (
    <div
      ref={isLastItem ? lastItemRef : undefined}
      className="bg-background p-4 sm:p-6 rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {thumbUrl && (
          <div className="shrink-0">
            <img
              src={thumbUrl}
              alt={projectName}
              className="w-full sm:w-48 h-48 object-cover rounded-lg"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {projectName}
              </h3>

              {address?.addressLocality && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>
                    {address.addressLocality}
                    {address.postalCode && `, ${address.postalCode}`}
                  </span>
                </div>
              )}

              {(startDate || endDate) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>
                    {startDate && formatDate(startDate)}
                    {startDate && endDate && " - "}
                    {endDate && formatDate(endDate)}
                  </span>
                </div>
              )}
            </div>

            {slug && (
              <Link
                to={`/profil/${slug}`}
                className="ml-2 shrink-0 p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                aria-label={t("ProjectsTab.viewProject")}
              >
                <ExternalLink className="w-5 h-5" />
              </Link>
            )}
          </div>

          {description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
              {description}
            </p>
          )}

          {item.serverData?.tags && Array.isArray(item.serverData.tags) && item.serverData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(item.serverData.tags as string[]).slice(0, 5).map((tag: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium"
                >
                  {tag}
                </span>
              ))}
              {(item.serverData.tags as string[]).length > 5 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{String((item.serverData.tags as string[]).length - 5)} {t("ProjectsTab.moreTags")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
