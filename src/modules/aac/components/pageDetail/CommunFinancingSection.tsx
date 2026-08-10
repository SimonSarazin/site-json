import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { CoFormData, CoFormAnswer } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { FundingMilestone as Milestone } from "@/modules/cagnotte/types";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { MilestoneManageActions } from "@/modules/cagnotte/components/sections/MilestoneManageActions";
import { MilestoneEditDialog } from "@/modules/cagnotte/components/sections/parts/MilestoneEditDialog";
import CreateMilestoneDialog from "@/modules/cagnotte/components/sections/CreateMilestoneDialog";
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";
import { useCommunObjectivesController } from "@/modules/aac/hooks/useCommunObjectivesController";
import type { MilestoneCardPermissions } from "@/modules/aac/lib/objectiveHelpers";

interface CommunFinancingSectionProps {
    formData: CoFormData;
    answerQuery: CoFormAnswer | null;
    aacConfig: AacResolvedConfig | null;
    funding?: any;
}

function FinancingMilestoneCard({
    index,
    item,
    openEditMilestoneModal,
    onMilestoneClose,
    onMilestoneDelete,
    permissions,
    loadingIds,
    canManageActions,
}: {
    index: number;
    item: any;
    openEditMilestoneModal: (milestone: Milestone) => void;
    onMilestoneClose: (milestone: Milestone) => void;
    onMilestoneDelete: (milestone: Milestone) => void;
    permissions: MilestoneCardPermissions;
    loadingIds: { deletingMilestoneId: string; closingMilestoneId: string };
    canManageActions: boolean;
}) {
    const [open, setOpen] = useState(false);
    const panelId = `palier-financement-${index}-panel`;

    useLoadNamespace("modules/aac");
    const c = useT("modules/aac");

    const canDeleteThisMilestone = permissions.canDeleteMilestone({
        status: item.status,
        hasTransactions: toSafeInt(item.currentFunding) > 0,
    });

    const pct = toSafeInt(item.price) > 0
        ? Math.min(Math.round((toSafeInt(item.currentFunding) / toSafeInt(item.price)) * 100), 100)
        : 0;
    const done = pct >= 100;

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
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        {String(c("detail.objectives.milestone", undefined, { number: index + 1 }))}
                    </div>
                    <h4 className="font-display font-bold truncate">{item.name}</h4>
                </div>

                <div className="hidden sm:block w-64 shrink-0 ml-auto">
                    <div className="flex justify-between items-baseline text-xs mb-2 tabular-nums">
                        <span className={done ? "text-success font-bold" : "text-foreground font-bold"}>
                        {formatCurrency(toSafeInt(item.currentFunding))}
                        </span>
                        <span className="text-muted-foreground">
                            / {formatCurrency(toSafeInt(item.price))}
                        </span>
                    </div>
                    <Progress
                        value={pct}
                        className="h-1.5 bg-background border border-border"
                        indicatorClassName={done ? "bg-success" : "bg-primary"}
                    />
                    <div className="mt-1 text-right text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                        {String(c("detail.objectives.collectedPercent", undefined, { percent: pct }))}
                    </div>
                </div>

                <ChevronDown
                    className={`size-5 shrink-0 text-muted-foreground transition-transform ${
                        open ? "rotate-180" : ""
                    }`}
                />
            </button>

            {open && (
                <div id={panelId} className="p-5 sm:p-6 pt-4 bg-background/30 border-t border-border">
                    <div className="sm:hidden space-y-2 mb-4">
                        <div className="flex justify-between text-xs tabular-nums">
                            <span className={done ? "text-success font-bold" : "text-foreground font-bold"}>
                            {formatCurrency(toSafeInt(item.currentFunding))}
                            </span>
                            <span className="text-muted-foreground">
                            / {formatCurrency(toSafeInt(item.price))} — {pct}%
                            </span>
                        </div>
                        <Progress
                            value={pct}
                            className="h-1.5 bg-background border border-border"
                            indicatorClassName={done ? "bg-success" : "bg-primary"}
                        />
                    </div>

                    <ul className="grid gap-2">
                        {(item?.allFunding || []).map((fund: any, i: number) => (
                            <li key={i} className="flex p-3 rounded-md border text-sm">
                                <span className="w-[35%]">{fund.financerName}</span>
                                <span className="w-[25%]">{formatCurrency(toSafeInt(fund.amount))}</span>
                                <span className="w-[25%]">{fund?.date ? new Date(fund.date).toLocaleDateString("fr-FR") : ""}</span>
                                <span className={fund.fundingType === "prepaid" ? "w-[15%] text-success" : "w-[15%]"}>
                                    {fund.fundingType === "prepaid" ? String(c("detail.objectives.paid")) : String(c("detail.objectives.pledged"))}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {permissions.canEditMilestone({ status: item.status }) || canDeleteThisMilestone ? (
                <div className="grid grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 focus-within:grid-rows-[1fr] focus-within:opacity-100 transition-all duration-300 ease-in-out">
                    <div className="overflow-hidden">
                        <div className="mb-3">
                            <MilestoneManageActions
                                onEdit={() => openEditMilestoneModal({
                                    id: item.milestoneId,
                                    title: item.name,
                                    description: item.description ?? "",
                                    status: item.status ?? "open",
                                    date_start: undefined,
                                    date_end: undefined,
                                    targetAmount: Number(item.price ?? 0),
                                    transactions: [],
                                    actions: item.actions ?? [],
                                } as Milestone)}
                                onClose={() => onMilestoneClose({
                                    id: item.milestoneId,
                                    title: item.name,
                                } as Milestone)}
                                onDelete={() => onMilestoneDelete({
                                    id: item.milestoneId,
                                    title: item.name,
                                } as Milestone)}
                                isDeleting={loadingIds.deletingMilestoneId === item.milestoneId}
                                isClosing={loadingIds.closingMilestoneId === item.milestoneId}
                                closeDisabled={
                                    item.status === "close" ||
                                    !(item.actions ?? []).every((action: any) => action.status === "done")
                                }
                                canEdit={permissions.canEditMilestone({ status: item.status })}
                                canClose={canManageActions && permissions.canCloseMilestone({ status: item.status })}
                                canDelete={canDeleteThisMilestone}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function CommunFinancingSection({ answerQuery, funding }: CommunFinancingSectionProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const ctrl = useCommunObjectivesController({ answerQuery, funding });

    return (
        <div className="grid gap-4">
            {ctrl.cagnottePerms.canCreateMilestone ? (
                <div className="flex justify-end">
                    <Button size="sm" className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90" onClick={ctrl.openCreateMilestoneModal}>
                        <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
                    </Button>
                </div>
            ) : null}
            {funding?.items?.map((o: any, i: number) => (
                <FinancingMilestoneCard
                    key={i}
                    index={i}
                    item={o}
                    openEditMilestoneModal={ctrl.openEditMilestoneModal}
                    onMilestoneClose={ctrl.handleCloseMilestone}
                    onMilestoneDelete={ctrl.handleDeleteMilestone}
                    permissions={ctrl.cagnottePerms as unknown as MilestoneCardPermissions}
                    loadingIds={ctrl.loadingIds}
                    canManageActions={ctrl.canManageActions}
                />
            ))}
            {ctrl.selectedMilestone && ctrl.milestoneEditInitialValues ? (
                <MilestoneEditDialog
                    open={ctrl.isEditMilestoneOpen}
                    onOpenChange={(open) => {
                        ctrl.setIsEditMilestoneOpen(open);
                        if (!open) ctrl.setSelectedMilestone(null);
                    }}
                    initialValues={ctrl.milestoneEditInitialValues}
                    milestoneId={ctrl.selectedMilestone.id}
                    mutation={ctrl.activeEditMilestoneMutation as unknown as import("@tanstack/react-query").UseMutationResult<void, Error, import("@/modules/cagnotte/actions/mutations/milestone").EditMilestoneParams>}
                    apiErrorFallbackKey="ActionsSection.errors.milestoneEditFailed"
                    onSuccess={ctrl.handleMilestoneEditSuccess}
                />
            ) : null}
            <CreateMilestoneDialog
                open={ctrl.isCreateMilestoneOpen}
                onOpenChange={ctrl.setIsCreateMilestoneOpen}
                selectedProjectId={ctrl.resolvedProjectId}
                answerId={ctrl.resolvedAnswerId}
                currentUserId={ctrl.currentUserId || ""}
                existingMilestoneIds={ctrl.existingMilestoneIds}
                isConnected={ctrl.isConnected}
                inputIdPrefix="aac-milestone"
                onCreated={async () => {
                    await ctrl.refetchFundingEnvelope();
                }}
                onRefetch={async () => {
                    await ctrl.refetchFundingEnvelope();
                }}
            />
        </div>
    );
}
