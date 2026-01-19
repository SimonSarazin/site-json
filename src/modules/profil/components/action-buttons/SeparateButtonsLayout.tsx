import { Button } from "@/components/ui/button";
import type { EntityAction } from "../../types";

interface SeparateButtonsLayoutProps {
  actions: EntityAction[];
}

/**
 * Layout horizontal avec boutons séparés
 * Utilisé pour les profils utilisateurs (citoyens)
 */
export function SeparateButtonsLayout({ actions }: SeparateButtonsLayoutProps) {
  if (actions.length === 0) return null;

  const isLoading = actions.some((action) => action.isPending);

  return (
    <>
      {actions
        .filter((action) => action.show)
        .map((action) => (
          <Button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled || isLoading}
            variant={action.variant}
            className="px-5 py-2.5 h-auto border border-border rounded-lg text-foreground bg-card text-sm font-medium hover:bg-muted flex items-center gap-2 shadow-sm"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
    </>
  );
}
