import { useMemo, useReducer, useState } from "react";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { sanitize } from "@/lib/sanitize";
import type { Notification } from "@communecter/cocolight-api-client";
import { formatTimeAgo } from "../utils/formatTimeAgo";
import { parseNotification } from "../utils/parseNotification";
import { useNotificationNavigation } from "../hooks/useNotificationNavigation";

interface NotificationRowProps {
  item: Notification;
  /** Fermer le panneau (popover/sheet) après navigation. */
  onNavigate?: () => void;
}

/**
 * Ligne de notification.
 *
 * L'instance `Notification` est **cachée vivante** par `useNotificationsList`
 * (pas de `select`), donc on lit son état directement (`item.isUnread`) et la
 * mutation persiste. `item.markRead()` est **optimiste** (flip synchrone de
 * l'état réactif interne + rollback côté lib). React n'observe pas cette
 * mutation, donc on force un re-render au clic (et au rollback via `.catch`).
 *
 * Au clic : marque lu + résout l'élément cible (id→slug via l'API) et navigue.
 * Les notifs non navigables (`parseNotification` → null) restent cliquables pour
 * le seul mark-as-read.
 */
export function NotificationRow({ item, onNavigate }: NotificationRowProps) {
  const t = useT("modules/notification");
  const navigateToNotification = useNotificationNavigation();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const [navigating, setNavigating] = useState(false);

  const isUnread = item.isUnread;
  const target = useMemo(() => parseNotification(item), [item]);
  // `notify.displayName` est du HTML backend (ex. "<b>X</b> a commenté…") → on le
  // sanitize avant rendu. Fallback : le verbe brut, sinon le nom de l'auteur.
  const displayName = item.data?.notify?.displayName?.trim();
  const verb = item.data?.verb;

  const handleClick = async () => {
    if (item.isUnread) {
      // markRead() flippe l'état de façon synchrone (optimiste) ; on re-render
      // pour le refléter, et on re-render aussi si la lib rollback (erreur).
      void item.markRead().catch(() => forceRender());
      forceRender();
    }
    if (!target || navigating) return;
    setNavigating(true);
    const ok = await navigateToNotification(item);
    setNavigating(false);
    if (ok) onNavigate?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={navigating}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted",
        isUnread && "bg-primary/5",
        target ? "cursor-pointer" : "cursor-default",
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {item.author?.profilThumbImageUrl ? (
          <AvatarImage src={item.author.profilThumbImageUrl} alt={item.author.name} />
        ) : null}
        <AvatarFallback>{item.author?.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        {displayName ? (
          <div
            className="line-clamp-3 text-sm [&_a]:font-medium [&_b]:font-semibold"
            dangerouslySetInnerHTML={{ __html: sanitize(displayName) }}
          />
        ) : (
          <p className="truncate text-sm font-medium">{verb || item.author?.name}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatTimeAgo(item.createdAt, t)}
        </p>
      </div>

      {navigating ? (
        <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        isUnread && (
          <span
            aria-hidden
            className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
          />
        )
      )}
    </button>
  );
}

export default NotificationRow;
