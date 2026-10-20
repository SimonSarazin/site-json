import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router';

import { sanitize } from '@/lib/sanitize';
import { useLocalization } from '@/hooks/useLocalization';
import { HTMLSectionProps } from '@/types/site-schema';
import { destinationSpa } from './htmlSectionLinks';

export function HTMLSection({ id, props }: { id?: string; props: HTMLSectionProps }) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const { html } = props;
  // `html` peut être string brute ou LocalizedString (`{ fr, en, ... }`) — on
  // résout via le helper i18n quand c'est un objet localisé.
  const rawHtml = typeof html === 'string' ? html : t(html);
  const safeHtml = sanitize(rawHtml);

  // Les liens de ce HTML sont des `<a href>` bruts venus de la config : sans délégation, un lien
  // interne RECHARGE la page là où le même lien dans le menu navigue en SPA. On intercepte donc le
  // clic ici — un seul handler pour tout le bloc, le HTML restant du texte. `destinationSpa` décide
  // (et laisse au navigateur ancres, `mailto:`, externes, nouvel onglet…).
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const ancre = (event.target as Element | null)?.closest?.('a') ?? null;
      const to = destinationSpa({
        href: ancre?.getAttribute('href'),
        target: ancre?.getAttribute('target'),
        download: ancre?.hasAttribute('download') ?? false,
        boutonPrincipal: event.button === 0,
        avecModificateur: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        dejaTraite: event.defaultPrevented,
      });
      if (!to) return;
      event.preventDefault();
      navigate(to);
    },
    [navigate],
  );

  return (
    <section id={id}>
      {/* Délégation sur des <a> RÉELS : ils gardent focus et activation clavier (Entrée déclenche un
          click, donc ce handler). Rien d'interactif n'est ajouté au <div> lui-même. */}
      <div onClick={handleClick} dangerouslySetInnerHTML={{ __html: safeHtml }} suppressHydrationWarning />
    </section>
  );
}
export default HTMLSection;
