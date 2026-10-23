import { useMemo } from "react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ActionCreateDialog } from "@/modules/cagnotte/components/sections/parts/ActionCreateDialog";
import { ActionEditDialog, type EditingActionContext } from "@/modules/cagnotte/components/sections/parts/ActionEditDialog";
import { resolveAacActionEntityId } from "@/modules/aac/lib/objectiveHelpers";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";

/**
 * Les dialogues d'action de la fiche (suppression, création, édition), montés une fois par la page
 * comme `CommunMilestoneDialogs`.
 */
export function CommunActionDialogs({ ctrl }: { ctrl: CommunObjectivesController }) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    // Mémoïsé sur l'état du contrôleur : `ActionEditDialog` fait `form.reset()` à chaque nouvelle identité.
    const editingAction = useMemo<EditingActionContext | null>(() => {
        const action = ctrl.selectedAction;
        if (!action) return null;
        return {
            milestoneId: ctrl.selectedMilestoneId,
            actionEntityId: resolveAacActionEntityId(action),
            action: {
                name: action.name ?? "",
                credits: Number(action.credits ?? 0),
                status: action.status ?? "todo",
                tags: action.tags ?? [],
                contributors: action.contributors ?? [],
                date_start: action.date_start,
                date_end: action.date_end,
            },
        };
    }, [ctrl.selectedMilestoneId, ctrl.selectedAction]);

    if (!ctrl.canManageActions) return null;

    return (
        <>
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
            {editingAction ? (
                <ActionEditDialog
                    open={ctrl.isEditActionOpen}
                    onOpenChange={ctrl.setIsEditActionOpen}
                    actionCtx={ctrl.actionCtx}
                    editingAction={editingAction}
                    milestoneTitle={ctrl.selectedMilestoneTitle}
                    projectEntity={ctrl.projectEntity}
                    onSuccess={async () => {
                        await ctrl.refetchFundingEnvelope();
                    }}
                />
            ) : null}
        </>
    );
}
