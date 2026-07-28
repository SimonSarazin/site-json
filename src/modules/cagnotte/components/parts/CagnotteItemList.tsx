import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { CagnotteFundableItem, CagnotteTypeConfig } from "../../types";

interface CagnotteMilestoneListProps {
  /** Milestones à afficher (typiquement filtrés sur non-close + visibles selon le contexte). */
  items: CagnotteFundableItem[] | undefined;
  /** Set des milestones activés (cochés) pour la contribution. */
  activeItemIds: Set<string>;
  /** Callback de toggle au click sur une carte. */
  onItemClick: (itemId: string) => void;
  /** Configuration de la cagnotte */
  cagnotteConfig: CagnotteTypeConfig;
  /** Pour personalisation des textes à afficher pour certain groupe d'organisation */
  context: string;
}

/**
 * Liste de cartes milestones cliquables pour la sélection de contribution dans
 * `CagnotteDialog`. Affiche pour chaque milestone : checkbox custom, nom,
 * description, montants courant/cible, progress bar, badge status.
 */
export function CagnotteItemList({
  items,
  activeItemIds,
  onItemClick,
  cagnotteConfig,
  context
}: CagnotteMilestoneListProps) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");

  if (items === undefined || items.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        {t("CagnotteDialog.labels.itemsTitle", undefined, { context: cagnotteConfig.selectorType+context })}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(items || [])
            .filter((item) => item?.status !== "close")
            .map((item) => {
          const isActive = activeItemIds.has(item.itemId);
          return (
            <div
              key={item.itemId}
              onClick={() => onItemClick(item.itemId)}
              className={`p-4 rounded-lg cursor-pointer transition-all space-y-2 ${
                isActive
                  ? "bg-primary/20 border-primary/50 border-2"
                  : "bg-muted/30 border border-border/50 hover:border-border/80"
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Checkbox custom pour activer/désactiver */}
                <div
                  className="flex items-center justify-center w-6 h-6 rounded border-2 mt-0.5 shrink-0 transition-colors"
                  style={{
                    borderColor: isActive ? "var(--primary)" : "var(--border)",
                    backgroundColor: isActive ? "var(--primary)" : "transparent",
                  }}
                >
                  {isActive && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                    {item.name}
                  </h4>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Financement et progression */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("CagnotteDialog.labels.fundingLabel", undefined, { context: cagnotteConfig.selectorType+context })}
                  </span>
                  <span className="font-semibold text-foreground">
                    {item.currentFunding.toLocaleString("fr-FR")} € / {item.price.toLocaleString("fr-FR")} €
                  </span>
                </div>
                <Progress
                  value={
                    item.price > 0
                      ? (item.currentFunding / item.price) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              {/* Status badge */}
              {item.status && (
                <Badge variant="outline" className="text-xs">
                  {item.status}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
