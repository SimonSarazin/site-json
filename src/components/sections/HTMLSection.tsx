import { sanitize } from '@/lib/sanitize';

interface HTMLSectionProps {
  id?: string;
  props: {
    html: string;
  };
}

export function HTMLSection({ id, props }: HTMLSectionProps) {
  const { html } = props;
  const safeHtml = sanitize(html);

  return (
    <section id={id}>
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </section>
  );
}