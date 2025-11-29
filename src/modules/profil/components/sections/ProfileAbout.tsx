import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useProfileSetup } from "../../hooks/useProfileSetup";

interface ProfileAboutProps {
  section: {
    type: "profile-about";
    showDescription?: boolean;
    showShortDescription?: boolean;
    markdownEnabled?: boolean;
  };
}

export default function ProfileAbout({ section }: ProfileAboutProps) {
  const { entity, t } = useProfileSetup();
  const { shortDescription, description } = useFormatProfileEntity(entity);

  const hasContent =
    (section.showShortDescription !== false && shortDescription) ||
    (section.showDescription !== false && description);

  if (!hasContent) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t("ProfileAbout.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {section.showShortDescription !== false && shortDescription && (
          <div className="mb-4">
            <p className="text-lg font-medium text-gray-900 dark:text-white">
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
  );
}
