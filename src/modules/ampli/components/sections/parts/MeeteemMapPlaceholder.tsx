import { MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";

interface MeeteemMapPlaceholderProps {
  /** `large` : pleine largeur (vue Carte seule) — `compact` : colonne droite (vue Split). */
  variant?: "large" | "compact";
}

/**
 * Placeholder propre pour la vue Carte de MeeteemSection.
 *
 * @todo Implémenter avec Leaflet via `useClientModule` (SSR-safe).
 * En attendant : message i18n explicite avec tokens sémantiques (mode sombre).
 */
export function MeeteemMapPlaceholder({ variant = "large" }: MeeteemMapPlaceholderProps) {
  const t = useT("modules/ampli");
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "rounded-xl border border-border overflow-hidden shadow-md bg-muted/30 flex items-center justify-center",
        isCompact ? "flex-1" : "w-full h-[600px] mb-10",
      )}
    >
      <div className="text-center">
        <MapIcon className={cn("mx-auto mb-4 text-primary", isCompact ? "w-16 h-16" : "w-24 h-24")} />
        <p className={cn("text-foreground", isCompact ? "" : "text-lg")}>
          {String(t("MeeteemSection.map.placeholderTitle"))}
        </p>
        <p className={cn("text-muted-foreground mt-2", isCompact ? "text-xs" : "text-sm")}>
          {String(t("MeeteemSection.map.placeholderSubtitle"))}
        </p>
      </div>
    </div>
  );
}
