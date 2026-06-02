import { sanitize } from '@/lib/sanitize';
import { useLocalization } from '@/hooks/useLocalization';
import { HTMLSectionProps } from '@/types/site-schema';

export function HTMLSection({ id, props }: { id?: string; props: HTMLSectionProps }) {
  const { t } = useLocalization();
  const { html } = props;
  // `html` peut être string brute ou LocalizedString (`{ fr, en, ... }`) — on
  // résout via le helper i18n quand c'est un objet localisé.
  const rawHtml = typeof html === 'string' ? html : t(html);
  const safeHtml = sanitize(rawHtml);

  return (
    <section id={id}>
      <div dangerouslySetInnerHTML={{ __html: safeHtml }} suppressHydrationWarning />
    </section>
  );
}
export default HTMLSection;
