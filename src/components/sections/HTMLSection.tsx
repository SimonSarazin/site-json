import { sanitize } from '@/lib/sanitize';
import { HTMLSectionProps } from '@/types/site-schema';

export function HTMLSection({ id, props }: { id?: string; props: HTMLSectionProps }) {
  const { html } = props;
  const safeHtml = sanitize(html);

  return (
    <section id={id}>
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </section>
  );
}