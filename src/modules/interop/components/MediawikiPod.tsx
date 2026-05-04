import { BookOpen, ExternalLink, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { useInteropConfig } from "../hooks/useInteropConfigQuery";
import { useInteropUserLinks } from "../hooks/useUserInteropLinks";
import { useMediawikiContribsQuery, type WikiContrib } from "../hooks/useMediawikiContribs";
import { useMediawikiUnlink } from "../hooks/useInteropMutation";
import "../i18n";

function asContribList(contribs: unknown): WikiContrib[] {
  if (Array.isArray(contribs)) return contribs as WikiContrib[];
  return [];
}

const MediawikiPod = () => {
  const t = useT("modules/interop");
  const { wikiBaseUrl } = useInteropConfig();
  const { wikiUsername } = useInteropUserLinks();
  const { data, isLoading } = useMediawikiContribsQuery(10);
  const unlinkMutation = useMediawikiUnlink();

  const contribs = asContribList(data?.contribs);

  const userPageUrl =
    wikiBaseUrl && wikiUsername
      ? `${wikiBaseUrl}/wiki/User:${encodeURIComponent(wikiUsername)}`
      : null;

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 shrink-0" />
          <span className="font-bold uppercase tracking-wide text-sm">
            {t("wiki.title")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground h-7 text-xs"
            onClick={() => unlinkMutation.mutate()}
            disabled={unlinkMutation.isPending}
          >
            <Unlink className="h-3 w-3 mr-1" />
            {t("wiki.unlink")}
          </Button>
          {userPageUrl && (
            <a
              href={userPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-semibold text-primary-foreground hover:underline whitespace-nowrap"
            >
              {t("wiki.see_full_profile")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-card p-4 space-y-4">
        {/* Section contributions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t("wiki.latest_contributions")}
            </h3>
            {userPageUrl && (
              <a
                href={`${wikiBaseUrl}/wiki/Special:Contributions/${encodeURIComponent(wikiUsername!)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline whitespace-nowrap"
              >
                {t("wiki.see_all_contributions")}
              </a>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : contribs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("wiki.no_page_found", undefined, { username: wikiUsername ?? "" })}
            </p>
          ) : (
            <ul className="space-y-0">
              {contribs.slice(0, 10).map((c, i) => (
                <li
                  key={c.revid ?? i}
                  className="flex items-start gap-2 text-sm py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {c.title ?? "—"}
                    </p>
                    {c.comment && (
                      <p className="text-xs text-muted-foreground truncate">
                        {c.comment}
                      </p>
                    )}
                  </div>
                  {c.timestamp && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(c.timestamp as string).toLocaleDateString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediawikiPod;
