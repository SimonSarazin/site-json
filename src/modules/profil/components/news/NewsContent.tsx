import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface NewsContentProps {
  text: string;
  maxLength?: number;
}

export function NewsContent({ text, maxLength = 300 }: NewsContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const shouldTruncate = text.length > maxLength;
  const displayText = !isExpanded && shouldTruncate
    ? text.substring(0, maxLength) + "..."
    : text;

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
          {isExpanded ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </div>
  );
}
