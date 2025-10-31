import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchEntity } from "@/modules/search/schema";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt();

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
  const renderMarkdown = (text: string) => {
    if (section.markdownEnabled !== false) {
      const html = md.render(text);
      return DOMPurify.sanitize(html);
    }
    return text;
  };

  const hasContent =
    (section.showShortDescription !== false && "shortDescription" in entity && entity.shortDescription) ||
    (section.showDescription !== false && "description" in entity && entity.description);

  if (!hasContent) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>À propos</CardTitle>
      </CardHeader>
      <CardContent>
        {section.showShortDescription !== false && "shortDescription" in entity && entity.shortDescription && (
          <div className="mb-4">
            <p className="text-lg font-medium text-gray-900">{entity.shortDescription as string}</p>
          </div>
        )}

        {section.showDescription !== false && "description" in entity && entity.description && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(entity.description as string),
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
