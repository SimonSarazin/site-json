import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { CoFormData } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
  CagnotteResource,
  CagnotteFundableItem,
} from "@/modules/cagnotte/types";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { MilestoneManageActions } from "@/modules/cagnotte/components/sections/MilestoneManageActions";
import { toSafeInt, buildItemsFromRawDepenses } from "@/modules/cagnotte/utils/dataTransform";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";
import {
  toMilestoneStatus,
  fundableItemToMilestone,
  fundableItemToMilestoneRef,
  type MilestoneCardPermissions,
} from "@/modules/aac/lib/objectiveHelpers";

interface CommunFinancingSectionProps {
    formData: CoFormData;
    aacConfig: AacResolvedConfig | null;
    funding?: CagnotteResource | null;
    /**
     * Le contrôleur, monté UNE fois par la page. Le recevoir en prop plutôt que
     * l'appeler ici est ce qui garantit que les deux blocs de paliers partagent le
     * même état — sans quoi clore un palier d'un côté laissait l'autre périmé.
     */
    ctrl: CommunObjectivesController;
}

function FinancingMilestoneCard({
    index,
    item,
    openEditMilestoneModal,
    onMilestoneClose,
    onMilestoneRestore,
    onMilestoneDelete,
    permissions,
    loadingIds,
}: {
    index: number;
    item: CagnotteFundableItem;
    openEditMilestoneModal: (milestone: Milestone) => void;
    onMilestoneClose: (itemId: string, milestone: Milestone) => void;
    onMilestoneRestore: (itemId: string, milestone: Milestone) => void;
    onMilestoneDelete: (itemId: string, milestone: Milestone) => void;
    permissions: MilestoneCardPermissions;
    loadingIds: { deletingItemId: string; closingItemId: string; restoringItemId: string };
}) {
    const [open, setOpen] = useState(false);
    const panelId = `palier-financement-${index}-panel`;

    useLoadNamespace("modules/aac");
    const c = useT("modules/aac");

    const canDeleteThisMilestone = permissions.canDeleteMilestone({
        status: toMilestoneStatus(item.status),
        hasTransactions: toSafeInt(item.currentFunding) > 0,
    });

    const pct = toSafeInt(item.price) > 0
        ? Math.min(Math.round((toSafeInt(item.currentFunding) / toSafeInt(item.price)) * 100), 100)
        : 0;
    const done = pct >= 100;
    // Un palier clos reste listé — c'est ici qu'on le restaure — mais la carte et
    // la table des cofinanceurs l'excluent de leurs totaux : sans marqueur, le
    // lecteur additionnait des montants absents du total annoncé juste au-dessus.
    const isClosed = item.status === "close";

    return (
        <div className={`bg-surface border rounded-lg overflow-hidden group ${isClosed ? "border-dashed border-border" : "border-border"}`}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={panelId}
                className="w-full text-left p-5 sm:p-6 flex items-center gap-4 sm:gap-8 hover:bg-surface-2/40 transition-colors cursor-pointer"
            >
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span>{String(c("detail.objectives.milestone", undefined, { number: index + 1 }))}</span>
                        {isClosed ? (
                            <span
                                className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-[9px] normal-case tracking-normal"
                                title={String(c("detail.objectives.closedBadgeHint"))}
                            >
                                {String(c("detail.objectives.closedBadge"))}
                            </span>
                        ) : null}
                    </div>
                    <h4 className={`font-display font-bold truncate ${isClosed ? "text-muted-foreground" : ""}`}>{item.name}</h4>
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
                        {item?.allFunding?.length === 0 && (
                            <li className="text-sm text-muted-foreground">
                                {String(c("detail.objectives.noFundingYet"))}
                            </li>
                        )}
                        {(item?.allFunding || []).map((fund: CagnotteFundableItem["allFunding"][number], i: number) => (
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
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function CommunFinancingSection({ aacConfig, funding, ctrl }: CommunFinancingSectionProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    // Les dépenses brutes se resynchronisent seules : les mutations de palier
    // déclarent `extraInvalidate` sur cette entrée de cache (cf. `milestoneCtx` dans
    // `useCommunObjectivesController`). L'effet qui surveillait `loadingIds` a été
    // retiré — il ne voyait que les mutations de SA propre instance du contrôleur.
    //
    // L'étape est celle que la page a RÉSOLUE (`config.roles.depenseStepKey`) :
    // `aapStep1` en dur vidait la liste sur tout appel dont `depense` vit ailleurs.
    const { data: depenses } = useCommunRawDepenses(
        ctrl.resolvedAnswerId,
        aacConfig?.roles?.depenseStepKey ?? undefined,
    );

    const items = buildItemsFromRawDepenses(depenses ?? [], funding?.items ?? []);

    return (
        <div className="grid gap-4">
            {ctrl.cagnottePerms.canCreateMilestone ? (
                <div className="flex justify-end">
                    <Button size="sm" className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90" onClick={ctrl.openCreateMilestoneModal}>
                        <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
                    </Button>
                </div>
            ) : null}
            {items.map((o: CagnotteFundableItem, i: number) => (
                <FinancingMilestoneCard
                    key={i}
                    index={i}
                    item={o}
                    openEditMilestoneModal={ctrl.openEditMilestoneModal}
                    onMilestoneClose={ctrl.handleCloseMilestone}
                    onMilestoneRestore={ctrl.handleRestoreMilestone}
                    onMilestoneDelete={ctrl.handleDeleteMilestone}
                    permissions={ctrl.cagnottePerms}
                    loadingIds={ctrl.loadingIds}
                />
            ))}
        </div>
    );
}
