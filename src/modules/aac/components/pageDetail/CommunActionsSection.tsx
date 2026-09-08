import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, Pencil, Trash2, UserPlus, Loader2 } from "lucide-react";
import type { CoFormData } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
  CagnotteResource,
  CagnotteFundableItem,
} from "@/modules/cagnotte/types";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { ContributorsAvatars } from "@/modules/cagnotte/components/sections/parts/badges";
import { ActionCreateDialog } from "@/modules/cagnotte/components/sections/parts/ActionCreateDialog";
import { ActionEditDialog } from "@/modules/cagnotte/components/sections/parts/ActionEditDialog";
import { MilestoneManageActions } from "@/modules/cagnotte/components/sections/MilestoneManageActions";
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";
import {
  normalizeActionForEdit,
  resolveAacActionEntityId,
  toMilestoneStatus,
  fundableItemToMilestone,
  fundableItemToMilestoneRef,
  type MilestoneCardPermissions,
} from "@/modules/aac/lib/objectiveHelpers";

interface CommunActionsSectionProps {
    formData: CoFormData;
    aacConfig: AacResolvedConfig | null;
    funding?: CagnotteResource | null;
    /** Le contrôleur, monté UNE fois par la page — cf. `CommunMilestoneDialogs`. */
    ctrl: CommunObjectivesController;
}

function ActionRowButton({
    label,
    icon,
    onClick,
    isPending = false,
    disabled = false,
    tone = "primary",
}: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    isPending?: boolean;
    disabled?: boolean;
    /** Couleur prise au survol : l'action destructrice se signale avant le clic. */
    tone?: "primary" | "destructive";
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled || isPending}
            className={`size-7 rounded-md text-muted-foreground ${
                tone === "destructive"
                    ? "hover:bg-destructive/10 hover:text-destructive"
                    : "hover:bg-primary/10 hover:text-primary"
            }`}
        >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : icon}
        </Button>
    );
}

function ActionsMilestoneCard({
    index,
    item,
    openEditMilestoneModal,
    onActionCreate,
    onActionEdit,
    onActionDelete,
    onActionCandidate,
    onActionDone,
    onMilestoneClose,
    onMilestoneDelete,
    onMilestoneRestore,
    permissions,
    loadingIds,
}: {
    index: number;
    item: CagnotteFundableItem;
    openEditMilestoneModal: (milestone: Milestone) => void;
    onActionCreate: (milestoneId: string, milestoneTitle: string) => void;
    onActionEdit: (milestoneId: string, milestoneTitle: string, action: ProjectAction) => void;
    onActionDelete: (milestoneId: string, action: ProjectAction) => void;
    onActionCandidate: (milestoneId: string, action: ProjectAction) => void;
    onActionDone: (milestoneId: string, action: ProjectAction) => void;
    onMilestoneClose: (itemId: string, milestone: Milestone) => void;
    onMilestoneDelete: (itemId: string, milestone: Milestone) => void;
    onMilestoneRestore: (itemId: string, milestone: Milestone) => void;
    permissions: MilestoneCardPermissions;
    loadingIds: {
        candidateActionId: string;
        doneActionId: string;
        deletingActionId: string;
        deletingItemId: string;
        closingItemId: string;
        restoringItemId: string;
    };
}) {
    const [open, setOpen] = useState(index === 0);
    const panelId = `palier-actions-${index}-panel`;

    useLoadNamespace("modules/aac");
    const c = useT("modules/aac");

    const canDeleteThisMilestone = permissions.canDeleteMilestone({
        status: toMilestoneStatus(item.status),
        hasTransactions: toSafeInt(item.currentFunding) > 0,
    });

    const tasksDone = (item?.actions ?? []).filter((action: ProjectAction) => action.status === "done").length;

    return (
        <div className="bg-surface border border-border rounded-lg overflow-hidden group">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={panelId}
                className="w-full text-left p-5 sm:p-6 flex items-center gap-4 sm:gap-8 hover:bg-surface-2/40 transition-colors cursor-pointer"
            >
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2">
                        {String(c("detail.objectives.milestone", undefined, { number: index + 1 }))}
                        <span className="text-muted-foreground/70 normal-case tracking-normal font-medium">
                            · {tasksDone}/{item.actions.length} {String(c("detail.objectives.tasksLabel"))}
                        </span>
                    </div>
                    <h4 className="font-display font-bold truncate">{item.name}</h4>
                </div>

                <ChevronDown
                    className={`size-5 shrink-0 text-muted-foreground transition-transform ml-auto ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>

            {open && (
                <div id={panelId} className="p-5 sm:p-6 pt-4 bg-background/30 border-t border-border">
                    <ul className="grid gap-2">
                        {
                            item.actions.length === 0 ? (
                                <li className="text-sm text-muted-foreground">
                                    {String(c("detail.objectives.noTasksYet"))}
                                </li>
                            ) : (
                                item.actions.map((rawAction: ProjectAction, i: number) => {
                                    const action = normalizeActionForEdit(rawAction);
                                    const isDone = action.status === "done";
                                    const actionLike = {
                                        status: action.status,
                                        contributorIds: action.contributors.map((contributor) => contributor.id),
                                        authorId: action.authorId,
                                    };
                                    const showCandidate = permissions.canCandidateAction(actionLike);
                                    const showMarkDone = permissions.canMarkActionDone(actionLike);
                                    const showEdit = permissions.canEditAction(actionLike);
                                    const showDelete = permissions.canDeleteAction(actionLike);
                                    const contributors = action.contributors;
                                    return (
                                        <li
                                            key={i}
                                            className={`flex items-start gap-2.5 p-3 rounded-md border text-sm ${
                                                isDone
                                                    ? "border-success/30 bg-success/5 text-foreground"
                                                    : "border-border bg-surface/50 text-muted-foreground"
                                            }`}
                                        >
                                            <span className="w-[25%]">
                                                <input
                                                    type="checkbox"
                                                    checked={isDone}
                                                    onChange={() => {
                                                        if (showMarkDone) onActionDone(item.milestoneId, action);
                                                    }}
                                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer"
                                                    disabled={loadingIds.doneActionId === action.id || !showMarkDone}
                                                />
                                                <span className="font-semibold text-sm text-foreground ml-1">
                                                    {action.name}
                                                </span>
                                            </span>
                                            <span className="w-[15%]">{formatCurrency(toSafeInt(action.credits))}</span>
                                            <span className="w-[15%]">
                                                {action.tags.map((tag: string) => (
                                                    <span
                                                        key={tag}
                                                        className="inline-flex items-center gap-1.5 px-1 py-0.5 rounded-full text-xs font-medium text-primary border border-primary shadow-sm"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </span>
                                            <span className="w-[15%]">
                                                {contributors && contributors.length > 0 && (
                                                    <ContributorsAvatars contributors={contributors || []} t={c} showLabel={false} />
                                                )}
                                            </span>
                                            <span className="w-[15%]">{rawAction?.created ? new Date(rawAction.created as string | number).toLocaleDateString("fr-FR") : ""}</span>
                                            <span className={isDone ? "w-[15%] text-success flex justify-center" : "w-[15%] flex justify-center"}>
                                                {isDone ? String(c("detail.objectives.done")) : String(c("detail.objectives.inProgress"))}
                                            </span>
                                            <span className="w-[15%] flex items-center justify-end gap-0.5">
                                                {showCandidate ? (
                                                    <ActionRowButton
                                                        label={String(c("detail.objectives.actionsButtons.candidate"))}
                                                        icon={<UserPlus className="size-3.5" />}
                                                        onClick={() => onActionCandidate(item.milestoneId, action)}
                                                        isPending={loadingIds.candidateActionId === action.id}
                                                    />
                                                ) : null}
                                                {showEdit ? (
                                                    <ActionRowButton
                                                        label={String(c("detail.objectives.actionsButtons.edit"))}
                                                        icon={<Pencil className="size-3.5" />}
                                                        onClick={() => onActionEdit(item.milestoneId, item.name, action)}
                                                        // Ouvrir la modale d'édition d'une ligne en cours de suppression
                                                        // n'a pas de sens : la cible peut disparaître pendant la saisie.
                                                        disabled={loadingIds.deletingActionId === action.id}
                                                    />
                                                ) : null}
                                                {showDelete ? (
                                                    <ActionRowButton
                                                        label={String(c("detail.objectives.actionsButtons.delete"))}
                                                        icon={<Trash2 className="size-3.5" />}
                                                        onClick={() => onActionDelete(item.milestoneId, action)}
                                                        isPending={loadingIds.deletingActionId === action.id}
                                                        tone="destructive"
                                                    />
                                                ) : null}
                                            </span>
                                        </li>
                                    );
                                })
                            )
                        }
                    </ul>
                </div>
            )}

            {permissions.canEditMilestone({ status: toMilestoneStatus(item.status) }) || canDeleteThisMilestone ? (
                <div className="grid grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 focus-within:grid-rows-[1fr] focus-within:opacity-100 transition-all duration-300 ease-in-out">
                    <div className="overflow-hidden">
                        <div className="mb-3">
                            <MilestoneManageActions
                                onEdit={() => openEditMilestoneModal(fundableItemToMilestone(item))}
                                onClose={() => onMilestoneClose(item.itemId, fundableItemToMilestoneRef(item))}
                                onDelete={() => onMilestoneDelete(item.itemId, fundableItemToMilestoneRef(item))}
                                isDeleting={loadingIds.deletingItemId === item.itemId}
                                isClosing={loadingIds.closingItemId === item.itemId}
                                closeDisabled={
                                    item.status === "close" ||
                                    !(item.actions ?? []).every((action: ProjectAction) => action.status === "done")
                                }
                                canEdit={permissions.canEditMilestone({ status: toMilestoneStatus(item.status) })}
                                canClose={permissions.canEditMilestone({ status: toMilestoneStatus(item.status) }) && permissions.canCloseMilestone({ status: toMilestoneStatus(item.status) })}
                                canDelete={canDeleteThisMilestone}
                                isClosed={item.status === "close"}
                                onRestore={() => onMilestoneRestore(item.itemId, fundableItemToMilestoneRef(item))}
                                isRestoring={loadingIds.restoringItemId === item.itemId}
                            />
                            {permissions.canCreateAction({ status: toMilestoneStatus(item.status) }) ? (
                                <Button
                                    size="sm"
                                    className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90 mb-2"
                                    onClick={() => onActionCreate(item.milestoneId, item.name)}
                                >
                                    <Plus className="h-3 w-3" /> {String(c("detail.addAction"))}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function CommunActionsSection({ funding, ctrl }: CommunActionsSectionProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    // Les actions n'existent pas côté answer-only (proposition non promue en projet) —
    // pas de bloc à rendre tant qu'il n'y a pas de projectId.
    if (!ctrl.canManageActions) {
        return null;
    }

    return (
        <div className="grid gap-4">
            <ConfirmDialog
                open={!!ctrl.pendingDeleteAction}
                onOpenChange={(open) => {
                    if (!open) ctrl.cancelDeleteAction();
                }}
                title={String(t("detail.objectives.deleteActionConfirm.title"))}
                description={
                    ctrl.pendingDeleteAction
                        ? String(t("detail.objectives.deleteActionConfirm.description", undefined, { name: ctrl.pendingDeleteAction.action.name }))
                        : ""
                }
                confirmLabel={String(t("detail.objectives.deleteActionConfirm.confirm"))}
                cancelLabel={String(t("detail.objectives.deleteActionConfirm.cancel"))}
                isDestructive
                isPending={
                    !!ctrl.pendingDeleteAction &&
                    ctrl.loadingIds.deletingActionId === ctrl.pendingDeleteAction.action.id
                }
                onConfirm={ctrl.confirmDeleteAction}
            />
            {ctrl.cagnottePerms.canCreateMilestone ? (
                <div className="flex justify-end">
                    <Button size="sm" className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90" onClick={ctrl.openCreateMilestoneModal}>
                        <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
                    </Button>
                </div>
            ) : null}
            {funding?.items?.map((o: CagnotteFundableItem, i: number) => (
                <ActionsMilestoneCard
                    key={i}
                    index={i}
                    item={o}
                    openEditMilestoneModal={ctrl.openEditMilestoneModal}
                    onMilestoneClose={ctrl.handleCloseMilestone}
                    onMilestoneRestore={ctrl.handleRestoreMilestone}
                    onMilestoneDelete={ctrl.handleDeleteMilestone}
                    onActionCreate={ctrl.handleCreateAction}
                    onActionEdit={ctrl.handleActionEdit}
                    onActionDelete={ctrl.handleActionDelete}
                    onActionCandidate={ctrl.handleActionCandidate}
                    onActionDone={ctrl.handleActionDone}
                    permissions={ctrl.cagnottePerms}
                    loadingIds={ctrl.loadingIds}
                />
            ))}
            <ActionCreateDialog
                open={ctrl.isCreateActionOpen}
                onOpenChange={ctrl.setIsCreateActionOpen}
                actionCtx={ctrl.actionCtx}
                milestoneId={ctrl.selectedMilestoneId}
                milestoneTitle={ctrl.selectedMilestoneTitle}
                projectEntity={ctrl.projectEntity}
                onSuccess={async () => {
                    await ctrl.refetchFundingEnvelope();
                }}
            />
            <ActionEditDialog
                open={ctrl.isEditActionOpen}
                onOpenChange={ctrl.setIsEditActionOpen}
                actionCtx={ctrl.actionCtx}
                editingAction={{
                    milestoneId: ctrl.selectedMilestoneId,
                    actionEntityId: resolveAacActionEntityId(ctrl.selectedAction as { id?: string; _id?: string; entityId?: string } | null | undefined),
                    action: {
                        name: ctrl.selectedAction?.name ?? "",
                        credits: Number(ctrl.selectedAction?.credits ?? 0),
                        status: (ctrl.selectedAction?.status as "todo" | "done") ?? "todo",
                        tags: ctrl.selectedAction?.tags ?? [],
                        contributors: ctrl.selectedAction?.contributors ?? [],
                        date_start: ctrl.selectedAction?.date_start,
                        date_end: ctrl.selectedAction?.date_end,
                    },
                }}
                milestoneTitle={ctrl.selectedMilestoneTitle}
                projectEntity={ctrl.projectEntity}
                onSuccess={async () => {
                    await ctrl.refetchFundingEnvelope();
                }}
            />
        </div>
    );
}
