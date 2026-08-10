import MarkdownIt from "markdown-it";
import { sanitize } from "@/lib/sanitize";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

const markdownParser = new MarkdownIt({ html: true, linkify: true });

interface CommunProseProps {
    paragraphs?: string[] | null;
    forceMarkdown?: boolean;
}

export function CommunProse({ paragraphs, forceMarkdown = false }: CommunProseProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    if (!paragraphs || paragraphs.length === 0 || (paragraphs.length === 1 && paragraphs[0]=== "")) {
        return (
            <div className="p-5 rounded-lg border border-border bg-surface/60">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {String(t("detail.prose.empty"))}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 text-muted-foreground leading-relaxed max-w-[68ch]">
            {paragraphs.map((p, i) => {
                if (!p) return null;

                const isHtml = !forceMarkdown && /<[a-zA-Z][^>]*>/.test(p);
                const rawHtml = isHtml ? p : markdownParser.render(p);

                return (
                    <div
                        key={i}
                        dangerouslySetInnerHTML={{ __html: sanitize(rawHtml) }}
                        suppressHydrationWarning
                    />
                );
            })}
        </div>
    );
}