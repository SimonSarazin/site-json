import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

interface CagnotteMilestone {
  milestoneId: string;
  name: string;
  description?: string;
  price: number;
  currentFunding: number;
  status?: string;
}

interface CagnotteMilestoneListProps {
  /** Milestones à afficher (typiquement filtrés sur non-close + visibles selon le contexte). */
  milestones: CagnotteMilestone[];
  /** Set des milestones activés (cochés) pour la contribution. */
  activeMilestoneIds: Set<string>;
  /** Callback de toggle au click sur une carte. */
  onMilestoneClick: (milestoneId: string) => void;
}

/**
 * Liste de cartes milestones cliquables pour la sélection de contribution dans
 * `CagnotteDialog`. Affiche pour chaque milestone : checkbox custom, nom,
 * description, montants courant/cible, progress bar, badge status.
 */
export function CagnotteMilestoneList({
  milestones,
  activeMilestoneIds,
  onMilestoneClick,
}: CagnotteMilestoneListProps) {
  useLoadNamespace("modules/cagnotte");
  const t = useT("modules/cagnotte");

  if (milestones.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        {t("CagnotteDialog.labels.milestonesTitle")}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {milestones.map((milestone) => {
          const isActive = activeMilestoneIds.has(milestone.milestoneId);
          return (
            <div
              key={milestone.milestoneId}
              onClick={() => onMilestoneClick(milestone.milestoneId)}
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
                    {milestone.name}
                  </h4>
                  {milestone.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {milestone.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Financement et progression */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("CagnotteDialog.labels.fundingLabel")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {milestone.currentFunding}€ / {milestone.price}€
                  </span>
                </div>
                <Progress
                  value={
                    milestone.price > 0
                      ? (milestone.currentFunding / milestone.price) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              {/* Status badge */}
              {milestone.status && (
                <Badge variant="outline" className="text-xs">
                  {milestone.status}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
