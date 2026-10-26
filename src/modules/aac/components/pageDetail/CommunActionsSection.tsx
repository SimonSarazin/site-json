import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, Pencil, Trash2, UserPlus, Loader2 } from "lucide-react";
import type { CoFormData } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
  CagnotteResource,
  CagnotteFundableItem,
} from "@/modules/cagnotte/types";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { ContributorsAvatars } from "@/modules/cagnotte/components/sections/parts/badges";
import { MilestoneManageActions } from "@/modules/cagnotte/components/sections/MilestoneManageActions";
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";
import type { CagnottePermissions } from "@/modules/cagnotte/permissions/types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";
import { MilestoneCardsSkeleton } from "./CommunSkeletons";
import {
  normalizeActionForEdit,
  toMilestoneStatus,
  fundableItemToMilestone,
  fundableItemToMilestoneRef,
  actionRights,
  actionCreatedLabel,
  type MilestoneCardPermissions,
} from "@/modules/aac/lib/objectiveHelpers";

export interface CommunActionsSectionProps {
    formData: CoFormData;
    aacConfig: AacResolvedConfig | null;
    funding?: CagnotteResource | null;
    /** Le contrôleur, monté UNE fois par la page — cf. `CommunMilestoneDialogs`. */
    ctrl: CommunObjectivesController;
}

type ActionLoadingIds = CommunObjectivesController["loadingIds"];

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

/** Candidater, modifier, supprimer : les boutons d'une ligne d'action, selon ses droits. */
export function ActionRowButtons({
    action,
    rights,
    loadingIds,
    onCandidate,
    onEdit,
    onDelete,
}: {
    action: ProjectAction;
    rights: ReturnType<typeof actionRights>;
    loadingIds: Pick<ActionLoadingIds, "candidateActionId" | "deletingActionId">;
    onCandidate: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const c = useT("modules/aac");
    return (
        <>
            {rights.canCandidate ? (
                <ActionRowButton
                    label={String(c("detail.objectives.actionsButtons.candidate"))}
                    icon={<UserPlus className="size-3.5" />}
                    onClick={onCandidate}
                    isPending={loadingIds.candidateActionId === action.id}
                />
            ) : null}
            {rights.canEdit ? (
                <ActionRowButton
                    label={String(c("detail.objectives.actionsButtons.edit"))}
                    icon={<Pencil className="size-3.5" />}
                    onClick={onEdit}
                    // Pas d'édition pendant la suppression de la ligne.
                    disabled={loadingIds.deletingActionId === action.id}
                />
            ) : null}
            {rights.canDelete ? (
                <ActionRowButton
                    label={String(c("detail.objectives.actionsButtons.delete"))}
                    icon={<Trash2 className="size-3.5" />}
                    onClick={onDelete}
                    isPending={loadingIds.deletingActionId === action.id}
                    tone="destructive"
                />
            ) : null}
        </>
    );
}

/** « Ajouter un palier », pour qui a le droit d'en créer. */
export function AddMilestoneButton({ ctrl }: { ctrl: CommunObjectivesController }) {
    const t = useT("modules/aac");
    if (!ctrl.cagnottePerms.canCreateMilestone) return null;
    return (
        <div className="flex justify-end">
            <Button size="sm" className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90" onClick={ctrl.openCreateMilestoneModal}>
                <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
            </Button>
        </div>
    );
}

/**
 * Barre de gestion d'un palier, dépliée au survol ou au focus du parent `group` :
 * modifier / clore / supprimer / restaurer, puis « Ajouter une action ».
 */
export function MilestoneManageBar({
    item,
    permissions,
    loadingIds,
    openEditMilestoneModal,
    onMilestoneClose,
    onMilestoneDelete,
    onMilestoneRestore,
    onActionCreate,
    className = "mb-3",
}: {
    item: CagnotteFundableItem;
    permissions: MilestoneCardPermissions & Pick<CagnottePermissions, "canRestoreMilestone">;
    loadingIds: Pick<ActionLoadingIds, "deletingItemId" | "closingItemId" | "restoringItemId">;
    openEditMilestoneModal: (milestone: Milestone) => void;
    onMilestoneClose: (itemId: string, milestone: Milestone) => void;
    onMilestoneDelete: (itemId: string, milestone: Milestone) => void;
    onMilestoneRestore: (itemId: string, milestone: Milestone) => void;
    onActionCreate: (milestoneId: string, milestoneTitle: string) => void;
    /** Marges du contenu déplié. */
    className?: string;
}) {
    const c = useT("modules/aac");

    const milestoneStatus = toMilestoneStatus(item.status);
    const canEditThisMilestone = permissions.canEditMilestone({ status: milestoneStatus });
    const canDeleteThisMilestone = permissions.canDeleteMilestone({
        status: milestoneStatus,
        hasTransactions: toSafeInt(item.currentFunding) > 0,
    });
    // « Restaurer » a sa propre règle : un palier clos et financé reste restaurable.
    const canRestoreThisMilestone = permissions.canRestoreMilestone({ status: milestoneStatus });

    if (!canEditThisMilestone && !canDeleteThisMilestone && !canRestoreThisMilestone) return null;

    return (
        <div className="grid grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 focus-within:grid-rows-[1fr] focus-within:opacity-100 transition-all duration-300 ease-in-out">
            <div className="overflow-hidden">
                <div className={className}>
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
                        canEdit={canEditThisMilestone}
                        canClose={canEditThisMilestone && permissions.canCloseMilestone({ status: milestoneStatus })}
                        canDelete={canDeleteThisMilestone}
                        canRestore={canRestoreThisMilestone}
                        isClosed={item.status === "close"}
                        onRestore={() => onMilestoneRestore(item.itemId, fundableItemToMilestoneRef(item))}
                        isRestoring={loadingIds.restoringItemId === item.itemId}
                    />
                    {permissions.canCreateAction({ status: milestoneStatus }) ? (
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
    permissions: MilestoneCardPermissions & Pick<CagnottePermissions, "canRestoreMilestone">;
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
                                    const rights = actionRights(permissions, action);
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
                                                        if (rights.canMarkDone) onActionDone(item.milestoneId, action);
                                                    }}
                                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer"
                                                    disabled={loadingIds.doneActionId === action.id || !rights.canMarkDone}
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
                                            <span className="w-[15%]">{actionCreatedLabel(rawAction)}</span>
                                            <span className={isDone ? "w-[15%] text-success flex justify-center" : "w-[15%] flex justify-center"}>
                                                {isDone ? String(c("detail.objectives.done")) : String(c("detail.objectives.inProgress"))}
                                            </span>
                                            <span className="w-[15%] flex items-center justify-end gap-0.5">
                                                <ActionRowButtons
                                                    action={action}
                                                    rights={rights}
                                                    loadingIds={loadingIds}
                                                    onCandidate={() => onActionCandidate(item.milestoneId, action)}
                                                    onEdit={() => onActionEdit(item.milestoneId, item.name, action)}
                                                    onDelete={() => onActionDelete(item.milestoneId, action)}
                                                />
                                            </span>
                                        </li>
                                    );
                                })
                            )
                        }
                    </ul>
                </div>
            )}

            <MilestoneManageBar
                item={item}
                permissions={permissions}
                loadingIds={loadingIds}
                openEditMilestoneModal={openEditMilestoneModal}
                onMilestoneClose={onMilestoneClose}
                onMilestoneDelete={onMilestoneDelete}
                onMilestoneRestore={onMilestoneRestore}
                onActionCreate={onActionCreate}
            />
        </div>
    );
}

export function CommunActionsSection({ funding, ctrl }: CommunActionsSectionProps) {
    useLoadNamespace("modules/aac");

    // Pas d'actions tant que la proposition n'est pas promue en projet.
    if (!ctrl.canManageActions) {
        return null;
    }

    return (
        <div className="grid gap-4">
            <AddMilestoneButton ctrl={ctrl} />
            {ctrl.isLoadingData && !funding?.items?.length ? <MilestoneCardsSkeleton /> : null}
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
        </div>
    );
}
