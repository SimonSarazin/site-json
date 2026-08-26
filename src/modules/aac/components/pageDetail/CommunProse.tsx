import { ProseContent } from "@/components/shared/ProseContent";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

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
            {paragraphs.map((p, i) =>
                p ? <ProseContent key={i} text={p} forceMarkdown={forceMarkdown} /> : null
            )}
        </div>
    );
}