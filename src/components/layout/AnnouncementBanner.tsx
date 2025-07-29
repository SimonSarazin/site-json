import { useState } from "react";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import type { Header } from "@/types/site-schema";

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
