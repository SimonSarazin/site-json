import { useState } from "react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { cn } from "@/lib/utils";
import { useLocalization } from "@/hooks/useLocalization";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import type { LocalizedString } from "@/types/site-schema";
import { useVisibility, type VisibilityCondition } from "@/lib/visibility";

type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left";

interface FloatingActionButtonProps {
  modal: string;
  label: LocalizedString;
  icon?: string;
  position?: Position;
  condition?: VisibilityCondition;
}

const positionClasses: Record<Position, string> = {
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "top-right": "top-6 right-6",
  "top-left": "top-6 left-6",
};

export function FloatingActionButton({
  modal,
  label,
  icon = "plus",
  position = "bottom-right",
  condition,
}: FloatingActionButtonProps) {
  const { t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const visible = useVisibility(condition);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-50 flex items-center gap-2",
          "px-5 py-3 rounded-md",
          "bg-primary text-primary-foreground font-semibold text-sm",
          "shadow-lg hover:shadow-2xl",
          "hover:scale-105 active:scale-95",
          "transition-all duration-300 ease-out",
          "ring-1 ring-primary/20 hover:ring-4 hover:ring-primary/30",
          positionClasses[position]
        )}
        aria-label={t(label)}
      >
        <DynamicIcon name={icon as IconName} className="w-5 h-5 shrink-0" />
        <span className="whitespace-nowrap">{t(label)}</span>
      </button>

      <DynamicModal
        modalName={modal}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
