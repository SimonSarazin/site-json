import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMounted } from "@/hooks/useIsMounted";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import { useCommandPaletteOptional } from "../hooks/useCommandPalette";
import "../i18n";

/**
 * Bouton de header ouvrant la palette. Rendu conditionnellement par les headers
 * derrière `header.utilities.search`, et s'auto-masque si la fonctionnalité
 * n'est pas activée en config ou si le provider est absent.
 *
 * Largeur configurable via `commandPalette.triggerVariant` :
 * `full` (icône + libellé + raccourci) · `compact` (icône + raccourci) ·
 * `icon` (icône seule, le plus étroit).
 */
export function CommandTriggerButton() {
  const { config } = useSite();
  const palette = useCommandPaletteOptional();
  useLoadNamespace("modules/commandPalette");
  const t = useT("modules/commandPalette");
  const mounted = useIsMounted();

  if (!config.commandPalette?.enabled || !palette) return null;

  const variant = config.commandPalette.triggerVariant ?? "full";
  const iconOnly = variant === "icon";
  const showLabel = variant === "full";
  const showKbd = variant !== "icon";

  // `navigator.platform` n'existe pas au SSR → on n'affiche le kbd qu'après mount.
  const isMac =
    mounted && typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <Button
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      onClick={palette.openPalette}
      className={cn("text-muted-foreground", !iconOnly && "gap-2")}
      aria-label={t("triggerLabel")}
      title={t("triggerLabel")}
    >
      <SearchIcon className="h-4 w-4" />
      {showLabel && <span className="hidden md:inline">{t("triggerLabel")}</span>}
      {showKbd && mounted && (
        <kbd className="bg-muted hidden rounded px-1.5 py-0.5 text-xs md:inline">
          {isMac ? "⌘" : "Ctrl"}+K
        </kbd>
      )}
    </Button>
  );
}

export default CommandTriggerButton;
