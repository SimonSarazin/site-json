import { useHydrated } from "@/hooks/useHydrated";
import { useCocolight } from "@/hooks/useCocolight";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { NotificationPanel } from "../NotificationPanel";
import type { NotificationsSectionProps } from "../../schema";
import "../../i18n";

/**
 * Section JSON `notifications` — liste plein-format placée sur une page via la
 * config. Réutilise `NotificationPanel`. Auto-gate SSR + auth, comme la cloche.
 */
export default function NotificationsSection({
  id,
  props,
}: {
  id?: string;
  props: NotificationsSectionProps;
}) {
  useLoadNamespace("modules/notification");
  const t = useT("modules/notification");
  const hydrated = useHydrated();
  const { me } = useCocolight();

  return (
    <section id={id} className="bg-background py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {props.title && (
            <h2 className="mb-6 text-2xl font-bold">{t(props.title)}</h2>
          )}

          {!hydrated || !me?.isConnected ? (
            <p className="text-sm text-muted-foreground">{t("section.loginRequired")}</p>
          ) : (
            <div className="h-[70vh] max-h-[640px] overflow-hidden rounded-lg border">
              <NotificationPanel
                me={me}
                className="h-full"
                showMarkAllRead={props.showMarkAllRead}
                showClearAll={props.showClearAll}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
