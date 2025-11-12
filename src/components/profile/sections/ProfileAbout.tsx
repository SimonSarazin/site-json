import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchEntity } from "@/modules/search/schema";
import { useEntityProfile } from "../hooks/useEntityProfile";
import { renderMarkdown } from "@/helpers/renderMarkdown";
import { useT } from "@/hooks/useT";
import "@/components/profile/i18n";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

interface ProfileAboutProps {
  section: {
    type: "profile-about";
    showDescription?: boolean;
    showShortDescription?: boolean;
    markdownEnabled?: boolean;
  };
  entity: SearchEntity;
}

export default function ProfileAbout({ section, entity }: ProfileAboutProps) {
  useLoadNamespace("components/profile");
  const t = useT("components/profile");

  const { shortDescription, description } = useEntityProfile(entity);

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
            <p className="text-lg font-medium text-gray-900">{shortDescription}</p>
          </div>
        )}

        {section.showDescription !== false && description && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(description, section),
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
