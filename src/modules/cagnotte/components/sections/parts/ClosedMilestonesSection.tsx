/**
 * Section repliable affichant les milestones clôturés.
 *
 * Présentationnel : pas de mutation interne, le parent gère `onRestoreMilestone`.
 * Affiche un toggle global "Voir les milestones clôturés" puis la liste avec un
 * `MilestoneManageActions` réduit (seul le bouton "restaurer" est exposé).
 */
import type { Dispatch, SetStateAction } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MilestoneManageActions } from "../MilestoneManageActions";
import { MilestoneStatusBadge, type TFunc } from "./badges";
import type { FundingMilestone as Milestone } from "@/modules/cagnotte/types";

export interface ClosedMilestonesSectionProps {
  closedMilestones: Milestone[];
  t: TFunc;
  showClosedMilestones: boolean;
  setShowClosedMilestones: Dispatch<SetStateAction<boolean>>;
  /** ID du milestone en cours de restauration (pour spinner) ; vide sinon. */
  restoringMilestoneId: string;
  canRestoreMilestone: (input: { status: Milestone["status"] }) => boolean;
  onRestoreMilestone: (milestone: Milestone) => void;
}

export function ClosedMilestonesSection({
  closedMilestones,
  t,
  showClosedMilestones,
  setShowClosedMilestones,
  restoringMilestoneId,
  canRestoreMilestone,
  onRestoreMilestone,
}: ClosedMilestonesSectionProps) {
  if (closedMilestones.length === 0) return null;

  return (
    <Card className="border border-border bg-muted/30">
      <CardContent className="pt-4 space-y-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowClosedMilestones((prev) => !prev)}
          className="w-full flex items-center gap-2 text-sm font-medium text-muted-foreground justify-start h-auto py-1 px-2 hover:bg-transparent"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {String(
              t("ActionsSection.milestoneCard.closedMilestones", undefined, {
                count: closedMilestones.length,
              }),
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 ml-auto transition-transform ${showClosedMilestones ? "rotate-180" : ""}`}
          />
        </Button>

        {showClosedMilestones ? (
          <div className="space-y-3">
            {closedMilestones.map((milestone) => (
              <Card key={milestone.id} className="border border-border">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm">{milestone.title}</h4>
                    <MilestoneStatusBadge status={milestone.status} t={t} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {String(t("ActionsSection.milestoneCard.closedHelp"))}
                  </p>
                  <MilestoneManageActions
                    onEdit={() => undefined}
                    onClose={() => undefined}
                    onDelete={() => undefined}
                    onRestore={() => onRestoreMilestone(milestone)}
                    isClosed
                    showEdit={false}
                    showDelete={false}
                    canRestore={canRestoreMilestone({ status: milestone.status })}
                    isRestoring={restoringMilestoneId === milestone.id}
                    disabled={
                      restoringMilestoneId.length > 0 && restoringMilestoneId !== milestone.id
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
