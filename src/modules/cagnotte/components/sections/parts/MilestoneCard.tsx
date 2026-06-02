/**
 * Composant de rendu d'une carte milestone "ouverte" dans `ActionsSection`.
 *
 * Présentationnel : ne gère aucun state propre, ne fait aucun appel API. Toutes les
 * actions sont remontées au parent via les callbacks `on*`. Le parent reste maître
 * des mutations React Query, des refs, et des states UI partagés (expanded ids,
 * loading ids).
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { MilestoneManageActions } from "../MilestoneManageActions";
import {
  ActionStatusBadge,
  ContributorsAvatars,
  MilestoneStatusBadge,
  type TFunc,
} from "./badges";
import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
} from "@/modules/cagnotte/types";

/**
 * Permissions exposées par `useCagnottePermissions` — typage local minimal pour éviter
 * un import circulaire (le hook lui-même importe le module cagnotte).
 */
export interface MilestoneCardPermissions {
  canCreateAction: (input: { status: Milestone["status"] }) => boolean;
  canEditMilestone: (input: { status: Milestone["status"] }) => boolean;
  canCloseMilestone: (input: { status: Milestone["status"] }) => boolean;
  canDeleteMilestone: (input: { status: Milestone["status"]; hasTransactions: boolean }) => boolean;
  canCandidateAction: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
  canMarkActionDone: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
  canEditAction: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
  canDeleteAction: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
}

export interface MilestoneCardProps {
  milestone: Milestone;
  t: TFunc;
  permissions: MilestoneCardPermissions;
  fmtDate: (ts: number) => string;

  /** IDs d'action en cours d'opération (pour afficher les spinners). */
  loadingIds: {
    candidateActionId: string;
    doneActionId: string;
    deletingActionId: string;
    deletingMilestoneId: string;
    closingMilestoneId: string;
  };

  /** State UI partagé entre toutes les cartes (un milestone peut être expanded indépendamment). */
  expandedActiveMilestoneIds: string[];
  setExpandedActiveMilestoneIds: Dispatch<SetStateAction<string[]>>;
  expandedDoneMilestoneIds: string[];
  setExpandedDoneMilestoneIds: Dispatch<SetStateAction<string[]>>;

  /** Refs pour scroll target / highlight (partagés au parent). */
  milestoneCardRef: (node: HTMLDivElement | null) => void;
  actionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;

  /** Handlers — pas de mutation interne, le parent oriente. */
  onCreateAction: (milestoneId: string) => void;
  onEditMilestone: (milestone: Milestone) => void;
  onCloseMilestone: (milestone: Milestone) => void;
  onDeleteMilestone: (milestone: Milestone) => void;
  onCandidateAction: (milestoneId: string, action: ProjectAction) => void;
  onMarkActionDone: (milestoneId: string, action: ProjectAction) => void;
  onEditAction: (milestoneId: string, action: ProjectAction) => void;
  onDeleteAction: (milestoneId: string, action: ProjectAction) => void;
}

export function MilestoneCard({
  milestone,
  t,
  permissions,
  fmtDate,
  loadingIds,
  expandedActiveMilestoneIds,
  setExpandedActiveMilestoneIds,
  expandedDoneMilestoneIds,
  setExpandedDoneMilestoneIds,
  milestoneCardRef,
  actionCardRefs,
  onCreateAction,
  onEditMilestone,
  onCloseMilestone,
  onDeleteMilestone,
  onCandidateAction,
  onMarkActionDone,
  onEditAction,
  onDeleteAction,
}: MilestoneCardProps) {
  const actions = milestone.actions;
  const activeActions = actions.filter((action) => action.status !== "done");
  const doneActions = actions.filter((action) => action.status === "done");
  const milestoneCredits = actions.reduce((sum, action) => sum + action.credits, 0);

  return (
    <Card
      ref={milestoneCardRef}
      className="border border-primary/10 shadow-sm overflow-hidden"
    >
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-display font-semibold capitalize text-base">{milestone.title}</h3>
            {milestone.date_start || milestone.date_end ? (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {milestone.date_start ? fmtDate(milestone.date_start) : null}
                {milestone.date_start && milestone.date_end ? " -> " : null}
                {milestone.date_end ? fmtDate(milestone.date_end) : null}
              </p>
            ) : null}
          </div>
          <MilestoneStatusBadge status={milestone.status} t={t} />
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-lg border border-primary/10 bg-primary/5 p-2.5 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">
              {String(t("ActionsSection.milestoneCard.actions"))}
            </span>
            <p className="font-semibold text-primary">{actions.length}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">
              {String(t("ActionsSection.milestoneCard.amount"))}
            </span>
            <p className="font-semibold text-primary">{formatCurrency(milestone.targetAmount)}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">
              {String(t("ActionsSection.milestoneCard.totalCredits"))}
            </span>
            <p className="font-semibold text-primary">{formatCurrency(milestoneCredits)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {permissions.canCreateAction({ status: milestone.status }) ? (
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90"
              onClick={() => onCreateAction(milestone.id)}
            >
              <Plus className="h-3 w-3" /> {String(t("ActionsSection.milestoneCard.addAction"))}
            </Button>
          ) : null}
          <MilestoneManageActions
            onEdit={() => onEditMilestone(milestone)}
            onClose={() => onCloseMilestone(milestone)}
            onDelete={() => onDeleteMilestone(milestone)}
            isDeleting={loadingIds.deletingMilestoneId === milestone.id}
            isClosing={loadingIds.closingMilestoneId === milestone.id}
            closeDisabled={
              milestone.status === "close" ||
              !milestone.actions.every((action) => action.status === "done")
            }
            canEdit={permissions.canEditMilestone({ status: milestone.status })}
            canClose={permissions.canCloseMilestone({ status: milestone.status })}
            canDelete={permissions.canDeleteMilestone({
              status: milestone.status,
              hasTransactions: (milestone.transactions?.length ?? 0) > 0,
            })}
          />
        </div>

        {activeActions.length > 0 ? (
          <Collapsible
            open={expandedActiveMilestoneIds.includes(milestone.id)}
            onOpenChange={(open) => {
              setExpandedActiveMilestoneIds((prev) =>
                open
                  ? prev.includes(milestone.id)
                    ? prev
                    : [...prev, milestone.id]
                  : prev.filter((value) => value !== milestone.id),
              );
            }}
          >
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full">
              <Zap className="h-3.5 w-3.5" />
              <span>
                {String(
                  t("ActionsSection.milestoneCard.activeActions", undefined, {
                    count: activeActions.length,
                  }),
                )}
              </span>
              <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {activeActions.map((action) => {
                const actionLike = {
                  status: action.status,
                  contributorIds: action.contributors.map((c) => c.id),
                };
                const showCandidate = permissions.canCandidateAction(actionLike);
                const showMarkDone = permissions.canMarkActionDone(actionLike);
                const showEdit = permissions.canEditAction(actionLike);
                const showDelete = permissions.canDeleteAction(actionLike);
                const hasAnyButton = showCandidate || showMarkDone || showEdit || showDelete;

                return (
                  <div
                    key={action.id}
                    ref={(node) => {
                      actionCardRefs.current[action.id] = node;
                    }}
                    className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{action.name}</span>
                      <div className="flex items-center gap-2">
                        <ActionStatusBadge status={action.status} t={t} />
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(action.credits)}
                        </span>
                      </div>
                    </div>

                    {action.date_start || action.date_end ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {action.date_start ? fmtDate(action.date_start) : null}
                        {action.date_start && action.date_end ? " -> " : null}
                        {action.date_end ? fmtDate(action.date_end) : null}
                      </p>
                    ) : null}

                    {action.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {action.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 gap-1"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <ContributorsAvatars contributors={action.contributors} t={t} />

                    {hasAnyButton ? (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
                        {showCandidate ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2"
                            disabled={loadingIds.candidateActionId === action.id}
                            onClick={() => onCandidateAction(milestone.id, action)}
                          >
                            {loadingIds.candidateActionId === action.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <UserPlus className="h-3 w-3" />
                            )}
                            {String(t("ActionsSection.actionsButtons.candidate"))}
                          </Button>
                        ) : null}
                        {showMarkDone ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2 text-success"
                            disabled={loadingIds.doneActionId === action.id}
                            onClick={() => onMarkActionDone(milestone.id, action)}
                          >
                            {loadingIds.doneActionId === action.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {String(t("ActionsSection.actionsButtons.complete"))}
                          </Button>
                        ) : null}
                        {showEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2"
                            onClick={() => onEditAction(milestone.id, action)}
                          >
                            <Pencil className="h-3 w-3" />{" "}
                            {String(t("ActionsSection.actionsButtons.edit"))}
                          </Button>
                        ) : null}
                        {showDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-destructive"
                            disabled={loadingIds.deletingActionId === action.id}
                            onClick={() => onDeleteAction(milestone.id, action)}
                          >
                            {loadingIds.deletingActionId === action.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            {String(t("ActionsSection.actionsButtons.delete"))}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {doneActions.length > 0 ? (
          <Collapsible
            open={expandedDoneMilestoneIds.includes(milestone.id)}
            onOpenChange={(open) => {
              setExpandedDoneMilestoneIds((prev) =>
                open
                  ? prev.includes(milestone.id)
                    ? prev
                    : [...prev, milestone.id]
                  : prev.filter((value) => value !== milestone.id),
              );
            }}
          >
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-success transition-colors group w-full">
              <ArchiveRestore className="h-3.5 w-3.5" />
              <span>
                {String(
                  t("ActionsSection.milestoneCard.doneActions", undefined, {
                    count: doneActions.length,
                  }),
                )}
              </span>
              <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {doneActions.map((action) => (
                <div
                  key={action.id}
                  ref={(node) => {
                    actionCardRefs.current[action.id] = node;
                  }}
                  className="rounded-xl border border-success/30 bg-success/10 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="font-medium text-sm line-through text-success/80">
                          {action.name}
                        </span>
                      </div>
                      {action.date_end ? (
                        <p className="text-xs text-success/70 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {String(t("ActionsSection.milestoneCard.endLabel"))}{" "}
                          {fmtDate(action.date_end)}
                        </p>
                      ) : null}
                      {action.contributors.length > 0 ? (
                        <div className="pt-1">
                          <ContributorsAvatars contributors={action.contributors} t={t} />
                        </div>
                      ) : null}
                    </div>
                    <span className="text-sm font-bold text-success">
                      {formatCurrency(action.credits)}
                    </span>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {String(t("ActionsSection.emptyActionsInline"))}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
