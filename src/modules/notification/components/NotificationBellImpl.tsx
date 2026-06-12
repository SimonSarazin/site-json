import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHydrated } from "@/hooks/useHydrated";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useUnseenBadge } from "../hooks/useUnseenBadge";
import { useNotificationMutations } from "../hooks/useNotificationMutations";
import { NotificationPanel } from "./NotificationPanel";
import "../i18n";

/**
 * Implémentation de la cloche de notifications (chargée en lazy via
 * `NotificationBell.tsx`, donc uniquement quand le flag est activé).
 *
 * - Auto-gate SSR (`useHydrated`) + auth (`me.isConnected`) → rend `null` sinon
 *   (markup identique serveur / 1er rendu client, cf. gotcha #10).
 * - Responsive : `Popover` (desktop) / `Sheet` latéral (mobile), via
 *   `useIsMobile` — même pattern que `sidebar.tsx`. Le `NotificationPanel`
 *   (flex-column + ScrollArea) est borné en hauteur par son conteneur.
 */
export default function NotificationBellImpl() {
  useLoadNamespace("modules/notification");
  const t = useT("modules/notification");
  const hydrated = useHydrated();
  const isMobile = useIsMobile();
  const { me } = useCocolight();
  const { count } = useUnseenBadge(me);
  const { markAllSeen } = useNotificationMutations(me);
  const [open, setOpen] = useState(false);

  if (!hydrated || !me?.isConnected) return null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && count > 0) markAllSeen.mutate();
  };
  const close = () => setOpen(false);

  const trigger = (
    <Button variant="ghost" size="sm" className="relative text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted" aria-label={t("bell.ariaLabel")}>
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>{t("panel.title")}</SheetTitle>
          </SheetHeader>
          {/* pr-12 : dégage le bouton X (close) du Sheet, en haut à droite. */}
          <NotificationPanel
            me={me}
            className="flex-1"
            headerClassName="pr-12"
            onNavigate={close}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[80vh] w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:w-96"
      >
        {/* Popover = hauteur dictée par le contenu → on plafonne le viewport
            Radix lui-même (flex-1/height:100% ne se résout pas ici). */}
        <NotificationPanel
          me={me}
          className="flex-1"
          scrollClassName="[&_[data-radix-scroll-area-viewport]]:max-h-[70vh]"
          onNavigate={close}
        />
      </PopoverContent>
    </Popover>
  );
}
