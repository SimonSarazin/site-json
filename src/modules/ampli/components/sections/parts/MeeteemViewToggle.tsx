import { Columns2Icon, MapPinIcon } from "lucide-react";
import { TextAlignJustifyIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { MeeteemViewMode } from "../../../types";

interface MeeteemViewToggleProps {
  value: MeeteemViewMode;
  onChange: (mode: MeeteemViewMode) => void;
}

const VIEW_BUTTONS: Array<{ mode: MeeteemViewMode; icon: typeof TextAlignJustifyIcon; labelKey: string }> = [
  { mode: "answers", icon: TextAlignJustifyIcon, labelKey: "MeeteemSection.viewToggle.answers" },
  { mode: "map", icon: MapPinIcon, labelKey: "MeeteemSection.viewToggle.map" },
  { mode: "split", icon: Columns2Icon, labelKey: "MeeteemSection.viewToggle.split" },
];

/**
 * Toggle de basculement entre les 3 vues (Annuaire / Carte / Split) de MeeteemSection.
 * Utilise `<Button>` shadcn (avant : `<button>` HTML brut) avec tokens sémantiques
 * `bg-primary` / `text-primary-foreground` pour le mode sombre fonctionnel.
 */
export function MeeteemViewToggle({ value, onChange }: MeeteemViewToggleProps) {
  const t = useT("modules/ampli");

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg border border-border">
      {VIEW_BUTTONS.map(({ mode, icon: Icon, labelKey }) => {
        const active = value === mode;
        return (
          <Button
            key={mode}
            variant={active ? "default" : "ghost"}
            size="sm"
            onClick={() => onChange(mode)}
            className={cn(
              "gap-2 transition-all",
              active && "shadow-sm",
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{String(t(labelKey))}</span>
          </Button>
        );
      })}
    </div>
  );
}
