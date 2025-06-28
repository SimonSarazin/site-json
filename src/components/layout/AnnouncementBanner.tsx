import { useState } from "react";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";

const variantStyles: Record<string, string> = {
  info: "bg-blue-500 text-white",
  success: "bg-green-500 text-white",
  warning: "bg-yellow-500 text-black",
  error: "bg-red-500 text-white",
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

export function AnnouncementBanner() {
  const { config } = useSite();
  const { t } = useLocalization();
  const [dismissed, setDismissed] = useState(false);
  const announcement = config.header.announcement;
  if (!announcement || dismissed) return null;
  const Icon = variantIcons[announcement.variant || "info"];
  return (
    <div
      className={cn(
        "text-sm flex items-center justify-center gap-2 px-3 py-2",
        variantStyles[announcement.variant || "info"],
      )}
    >
      <Icon className="h-4 w-4" />
      {announcement.href ? (
        <a href={announcement.href} className="underline font-medium">
          {t(announcement.text)}
        </a>
      ) : (
        <span>{t(announcement.text)}</span>
      )}
      {announcement.dismissible && (
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
