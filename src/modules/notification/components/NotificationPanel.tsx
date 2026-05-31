import { useCallback, useMemo, useRef, type RefCallback } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { User, Notification } from "@communecter/cocolight-api-client";
import { NotificationRow } from "./NotificationRow";
import { useNotificationsList } from "../hooks/useNotificationsList";
import { useNotificationMutations } from "../hooks/useNotificationMutations";

interface NotificationPanelProps {
  me: User;
  /** Classe sur la racine flex-column (la hauteur vient du conteneur : popover, sheet, section). */
  className?: string;
  showMarkAllRead?: boolean;
  showClearAll?: boolean;
  /**
   * Classe(s) sur le `ScrollArea`. Par défaut `flex-1 min-h-0` (fonctionne quand
   * le conteneur a une hauteur définie : Sheet, section). Dans un Popover
   * (hauteur dictée par le contenu), `flex-1`/`height:100%` ne se résout pas →
   * il faut plafonner directement le **viewport** Radix (cf. tests navigateur),
   * ce que fait l'appelant via cette prop.
   */
  scrollClassName?: string;
  /** Classe(s) sur le header (ex. `pr-12` dans le Sheet mobile pour dégager le bouton X). */
  headerClassName?: string;
  /** Fermer le conteneur (popover/sheet) après navigation depuis une ligne. */
  onNavigate?: () => void;
}

/**
 * Filtre métier : on masque seulement les notifications sans libellé affichable
 * (`displayName === ""`). On NE filtre PAS `objectType === "cms"` : sur certains
 * sites (tiers-lieux) des notifs légitimes portent ce type et étaient masquées à
 * tort.
 */
function isDisplayable(n: Notification): boolean {
  return n.data?.notify?.displayName !== "";
}

/**
 * Panneau scrollable réutilisé par la cloche (Popover desktop / Sheet mobile) ET
 * la section JSON.
 *
 * Layout flex-column : header figé + `ScrollArea` (`flex-1 min-h-0`, pattern
 * AdminPanel) → ne déborde jamais le conteneur. Infinite scroll idiomatique via
 * une sentinelle `IntersectionObserver` en bas de liste (pattern
 * `useInfiniteQueryScroll`).
 */
export function NotificationPanel({
  me,
  className,
  showMarkAllRead = true,
  showClearAll = true,
  scrollClassName,
  headerClassName,
  onNavigate,
}: NotificationPanelProps) {
  const t = useT("modules/notification");
  const { items, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useNotificationsList(me);
  const { markAllRead, clearAll } = useNotificationMutations(me);

  const visibleItems = useMemo(() => items.filter(isDisplayable), [items]);

  // Sentinelle : observe le dernier élément et charge la page suivante quand il
  // entre dans le viewport (clipping du ScrollArea pris en compte par l'API).
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef: RefCallback<HTMLLIElement> = useCallback(
    (node) => {
      if (isLoading || isFetchingNextPage) return;
      observerRef.current?.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) void fetchNextPage();
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2",
          headerClassName,
        )}
      >
        <span className="text-sm font-semibold">{t("panel.title")}</span>
        <div className="flex items-center gap-1">
          {showMarkAllRead && visibleItems.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              aria-label={t("panel.markAllRead")}
              title={t("panel.markAllRead")}
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          )}
          {showClearAll && visibleItems.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
              aria-label={t("panel.clearAll")}
              title={t("panel.clearAll")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className={cn("min-h-0 flex-1", scrollClassName)}>
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">{t("panel.loading")}</p>
        ) : visibleItems.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("panel.empty")}</p>
        ) : (
          <ul className="divide-y">
            {visibleItems.map((item, index) => (
              <li
                key={item.id}
                ref={index === visibleItems.length - 1 ? lastItemRef : undefined}
              >
                <NotificationRow item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        )}

        {isFetchingNextPage && (
          <p className="p-3 text-center text-xs text-muted-foreground">{t("panel.loading")}</p>
        )}
      </ScrollArea>
    </div>
  );
}

export default NotificationPanel;
