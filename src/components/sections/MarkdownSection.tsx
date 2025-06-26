import { useLocalization } from "@/hooks/useLocalization";

interface MarkdownSectionProps {
  id?: string;
  props: {
    md: string;
    sourceType?: 'file' | 'inline';
    animation?: string;
  };
}

export function MarkdownSection({ id, props }: MarkdownSectionProps) {
  const { t } = useLocalization();
  const { md, sourceType = 'inline', animation } = props;

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto prose prose-gray dark:prose-invert">
          {sourceType === 'inline' ? (
            <div dangerouslySetInnerHTML={{ __html: md }} />
          ) : (
            <div>Content from: {md}</div>
          )}
        </div>
      </div>
    </section>
  );
}