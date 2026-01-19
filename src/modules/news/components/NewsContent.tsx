import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "@/hooks/useT";
import { NewsMention } from "@communecter/cocolight-api-client";


interface NewsContentProps {
  text: string;
  mentions?: NewsMention[];
  maxLength?: number;
}

/**
 * Parse le texte pour remplacer les mentions @slug par des liens [@name](/profil/slug)
 */
function parseMentionsToMarkdown(text: string, mentions?: NewsMention[]): string {
  if (!mentions || mentions.length === 0) {
    return text;
  }

  let result = text;
  mentions.forEach((mention) => {
    // Remplacer @slug par [@name](/profil/slug)
    const mentionRegex = new RegExp(`@${mention.slug}\\b`, 'g');
    result = result.replace(
      mentionRegex,
      `[@${mention.name}](/profil/${mention.slug})`
    );
  });

  return result;
}

export function NewsContent({ text, mentions, maxLength = 300 }: NewsContentProps) {
  const t = useT("modules/news");
  const [isExpanded, setIsExpanded] = useState(false);

  // Parser les mentions dans le texte
  const parsedText = useMemo(
    () => parseMentionsToMarkdown(text, mentions),
    [text, mentions]
  );

  const shouldTruncate = parsedText.length > maxLength;
  const displayText = !isExpanded && shouldTruncate
    ? parsedText.substring(0, maxLength) + "..."
    : parsedText;

  return (
    <div className="px-6 pb-4">
      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
          }}
        >
          {displayText}
        </ReactMarkdown>
      </div>

      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          {isExpanded ? t("NewsTab.readLess") : t("NewsTab.readMore")}
        </button>
      )}
    </div>
  );
}