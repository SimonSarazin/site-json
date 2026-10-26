import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { daySeparatorLabel } from "../lib/formatWhen";

/**
 * Séparateur de jour : un filet, et la date posée dessus.
 * `aria-hidden` sur le trait, pas sur le texte — la date est une information de lecture.
 */
export function DateSeparator({ at }: { readonly at: number }) {
  const t = useT("modules/comment");
  const { currentLocale } = useLocalization();
  const label = daySeparatorLabel(at, { locale: currentLocale });
  const text = label.key ? String(t(`dates.${label.key}`)) : label.text;

  return (
    <div className="relative my-3 flex items-center" data-comment-separator="date">
      <span className="h-px grow bg-border" aria-hidden />
      <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {text}
      </span>
      <span className="h-px grow bg-border" aria-hidden />
    </div>
  );
}

/**
 * Frontière « nouveaux messages » : posée une seule fois, avant le premier non-lu.
 *
 * Elle emprunte au repère de Discord, mais en jetons de thème : `--primary` et non un rouge
 * en dur, pour tenir sur les dix-huit thèmes du parc, en clair comme en sombre.
 */
export function UnreadSeparator({ count }: { readonly count: number }) {
  const t = useT("modules/comment");

  return (
    <div
      className="relative my-3 flex items-center"
      data-comment-separator="unread"
      role="separator"
      aria-label={String(t("a11y.unreadSeparator"))}
    >
      <span className="h-px grow bg-primary/60" aria-hidden />
      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
        {/* `count` déclenche la forme plurielle d'i18next (`thread.newMessages_other`). */}
        {String(t("thread.newMessages", undefined, { count }))}
      </span>
    </div>
  );
}
