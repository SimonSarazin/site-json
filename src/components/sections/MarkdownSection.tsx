import { sanitize } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { MarkdownSectionProps } from "@/types/site-schema";

export function MarkdownSection({ id, props }: { id?: string; props: MarkdownSectionProps }) {
  const { md, sourceType = "inline", animation } = props;
  const safeHtml = sanitize(md);

  return (
    <section
      id={id}
      className={cn(
        "py-16 bg-background text-foreground",
        animation && `animate-in ${animation}`,
      )}
      data-animation={animation}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto prose prose-gray dark:prose-invert">
          {sourceType === "inline" ? (
            <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
          ) : (
            <div>Content from: {md}</div>
          )}
        </div>
      </div>
    </section>
  );
}
