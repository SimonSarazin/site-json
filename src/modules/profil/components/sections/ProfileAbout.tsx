import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useProfileSetup } from "../../hooks/useProfileSetup";
import type { ProfileAboutSection } from "../../schema";
import { useInteropConfig } from "@/modules/interop";
import { lazy } from "vite-preload";

interface ProfileAboutProps {
  section: ProfileAboutSection;
}

const DiscourseSection = lazy(() => import("@/modules/interop/DiscourseSection"));
const MediawikiSection = lazy(() => import("@/modules/interop/MediawikiSection"));

export default function ProfileAbout({ section }: ProfileAboutProps) {
  const { entity, t } = useProfileSetup();
  const { shortDescription, description } = useFormatProfileEntity(entity);
  const { hasDiscourse, hasWiki } = useInteropConfig();

  const hasContent =
    (section.showShortDescription !== false && shortDescription) ||
    (section.showDescription !== false && description);

  if (!hasContent && !hasDiscourse && !hasWiki) {
    return null;
  }

  return (
    <>
      {hasContent && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("ProfileAbout.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {section.showShortDescription !== false && shortDescription && (
              <div className="mb-4">
                <p className="text-lg font-medium text-foreground">
                  {shortDescription}
                </p>
              </div>
            )}

            {section.showDescription !== false && description && (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(description, section),
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
      {(entity.getEntityType() === "citoyens") && (
        <>
          {hasWiki && (
            <div className="mb-6">
              <MediawikiSection />
            </div>
          )}
          {hasDiscourse && (
            <div className="mb-6">
              <DiscourseSection />
            </div>
          )}
        </>
      )}
    </>
  );
}
