import { useState } from "react";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type { Header } from "@/types/site-schema";

const variantStyles: Record<string, string> = {
  info: "bg-info text-info-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  error: "bg-destructive text-destructive-foreground",
};
const variantIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  info: Info,
  success: CheckCircle,
  warning: AlertCircle,
  error: XCircle,
};

export type AnnouncementBannerProps = NonNullable<Header['announcement']>;

export function AnnouncementBanner({ text, href, dismissible, variant }: AnnouncementBannerProps) {
  const { t } = useLocalization();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const Icon = variantIcons[variant || "info"];
  return (
    <div
      className={cn(
        "text-sm flex items-center justify-center gap-2 px-3 py-2",
        variantStyles[variant || "info"],
      )}
    >
      <Icon className="h-4 w-4" />
      {href ? (
        <a href={href} className="underline font-medium">
          {t(text)}
        </a>
      ) : (
        <span>{t(text)}</span>
      )}
      {dismissible && (
        <button
          className="ml-2 opacity-70 hover:opacity-100"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      )}
    </div>
  );
}
