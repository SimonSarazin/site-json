import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/news/i18n";
import { NewsFeed } from "@/modules/news/components/NewsFeed";
import { useCommunProjectEntityQuery } from "@/modules/aac/hooks/useCommunProjectEntity";

interface CommunNewsSectionProps {
    /** Le projet du commun. Absent = la section n'a pas lieu d'être affichée. */
    projectId?: string | null;
}

/**
 * Le fil d'actualités du projet d'un commun. Les droits de publication sont
 * ceux du visiteur sur le projet (entité résolue via `me.project()`).
 */
export function CommunNewsSection({ projectId }: CommunNewsSectionProps) {
    useLoadNamespace("modules/aac");
    useLoadNamespace("modules/news");
    const t = useT("modules/aac");
    const { project, isLoading } = useCommunProjectEntityQuery(projectId);

    if (!projectId) return null;

    if (!isLoading && !project) {
        return (
            <div className="p-4 rounded-lg border border-border bg-surface/60">
                <p className="text-sm text-muted-foreground leading-relaxed">{String(t("detail.newsSection.error"))}</p>
            </div>
        );
    }

    return <NewsFeed entity={project} entityType="projects" isEntityLoading={isLoading} />;
}
