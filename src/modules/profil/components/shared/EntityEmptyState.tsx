import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EntityEmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
}

export function EntityEmptyState({
  icon,
  title,
  description,
  action,
}: EntityEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="text-gray-400 mb-4">{icon}</div>
      <p className="text-foreground font-medium mb-2">{title}</p>
      {description && (
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
      )}
      {action && (
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}
