import { useState, type ReactNode } from "react";
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
import { resolveDepenseKey } from "@/modules/cagnotte/utils/depenseKey";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";
import type { CagnottePermissions } from "@/modules/cagnotte/permissions/types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";
import { MilestoneCardsSkeleton } from "./CommunSkeletons";
import { readFinancerPaymentState } from "@/modules/cagnotte/utils/financerPayment";
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
    /**
     * Le bouton de discussion d'un palier, rendu par la page (c'est elle qui tient l'espace de
     * discussion du commun). `lineKey` est la CLÉ de la ligne de dépense dans le document, celle
     * que porte le fil — pas la position du palier dans la liste.
     */
    renderMilestoneDiscussion?: (milestone: { lineKey: string; name: string }) => ReactNode;
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
    discussion,
}: {
    index: number;
    item: CagnotteFundableItem;
    /** Le bouton de discussion du palier, à droite de l'en-tête — hors du bouton qui déplie la carte. */
    discussion?: ReactNode;
    openEditMilestoneModal: (milestone: Milestone) => void;
    onMilestoneClose: (itemId: string, milestone: Milestone) => void;
    onMilestoneRestore: (itemId: string, milestone: Milestone) => void;
    onMilestoneDelete: (itemId: string, milestone: Milestone) => void;
    permissions: MilestoneCardPermissions & Pick<CagnottePermissions, "canRestoreMilestone">;
    loadingIds: { deletingItemId: string; closingItemId: string; restoringItemId: string };
}) {
    const [open, setOpen] = useState(false);
    const panelId = `palier-financement-${index}-panel`;

    useLoadNamespace("modules/aac");
    const c = useT("modules/aac");

    const milestoneStatus = toMilestoneStatus(item.status);
    const canEditThisMilestone = permissions.canEditMilestone({ status: milestoneStatus });
    const canDeleteThisMilestone = permissions.canDeleteMilestone({
        status: milestoneStatus,
        hasTransactions: toSafeInt(item.currentFunding) > 0,
    });
    /**
     * « Restaurer » a SA règle (`isAdmin && status === "close"`), distincte de l'édition
     * (refusée sur un palier clos) et de la suppression (refusée sur un palier financé).
     * Un palier clos ET financé n'a donc ni l'une ni l'autre : gater la barre sur ces
     * deux seuls droits la faisait disparaître entièrement, et le palier ne pouvait
     * plus jamais être rouvert — alors que le droit existe et que tous les autres
     * appelants de `MilestoneManageActions` le passent en `canRestore`.
     */
    const canRestoreThisMilestone = permissions.canRestoreMilestone({ status: milestoneStatus });

    const pct = toSafeInt(item.price) > 0
        ? Math.min(Math.round((toSafeInt(item.currentFunding) / toSafeInt(item.price)) * 100), 100)
        : 0;
    const done = pct >= 100;
    // Un palier clos reste listé — c'est ici qu'on le restaure — mais la carte et
    // la table des cofinanceurs l'excluent de leurs totaux : sans marqueur, le
    // lecteur additionnait des montants absents du total annoncé juste au-dessus.
    const isClosed = item.status === "close";
    const description = item.description?.trim();

    return (
        <div className={`bg-surface border rounded-lg overflow-hidden group ${isClosed ? "border-dashed border-border" : "border-border"}`}>
            {/* Le survol éclaire toute la ligne d'en-tête, bouton de discussion compris. */}
            <div className="flex items-stretch hover:bg-surface-2/40 transition-colors">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="min-w-0 flex-1 text-left p-5 sm:p-6 flex items-center gap-4 sm:gap-8 cursor-pointer"
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
                        {/* Aperçu replié, deux lignes : purement visuel (`aria-hidden`), sinon le
                            texte entier devenait le nom accessible du bouton. Le texte complet
                            vit dans le panneau, où il est lu et sélectionnable. */}
                        {description && !open ? (
                            <p aria-hidden="true" className="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words line-clamp-2">
                                {description}
                            </p>
                        ) : null}
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
                            indicatorClassName="bg-primary"
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
                {/* Un bouton ne s'imbrique pas dans un autre : celui de la discussion vit À CÔTÉ de
                    celui qui déplie. `empty:hidden` — sans bouton à montrer (rien à lire pour ce
                    lecteur), l'emplacement s'efface et l'en-tête reprend toute la largeur. Sauf si
                    un AUTRE palier de la liste en montre un : tous gardent alors la même largeur
                    d'emplacement, pour que les jauges restent alignées d'une carte à l'autre. */}
                <div
                    className="flex shrink-0 items-center justify-end pe-3 sm:pe-4 empty:hidden sm:group-has-[[data-milestone-discussion-slot]:not(:empty)]/paliers:flex! sm:group-has-[[data-milestone-discussion-slot]:not(:empty)]/paliers:min-w-40"
                    data-milestone-discussion-slot
                >
                    {discussion}
                </div>
            </div>

            {open && (
                <div id={panelId} className="p-5 sm:p-6 pt-4 bg-background/30 border-t border-border">
                    {description ? (
                        <p className="mb-4 text-sm text-muted-foreground whitespace-pre-line break-words">
                            {description}
                        </p>
                    ) : null}

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
                        {(item?.allFunding || []).map((fund: CagnotteFundableItem["allFunding"][number], i: number) => {
                            // Trois états : un versement partiel validé n'est ni « payé »
                            // ni une simple promesse.
                            const { status } = readFinancerPaymentState(fund);
                            const label =
                                status === "payed" ? c("detail.objectives.paid")
                                : status === "partial" ? c("detail.objectives.partiallyPaid")
                                : c("detail.objectives.pledged");

                            return (
                                <li key={i} className="flex p-3 rounded-md border text-sm">
                                    <span className="w-[35%]">{fund.financerName}</span>
                                    <span className="w-[25%]">{formatCurrency(toSafeInt(fund.amount))}</span>
                                    <span className="w-[25%]">{fund?.date ? new Date(fund.date).toLocaleDateString("fr-FR") : ""}</span>
                                    <span className={
                                        status === "payed" ? "w-[15%] text-success"
                                        : status === "partial" ? "w-[15%] text-primary"
                                        : "w-[15%]"
                                    }>
                                        {String(label)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {canEditThisMilestone || canDeleteThisMilestone || canRestoreThisMilestone ? (
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
                                canEdit={canEditThisMilestone}
                                canClose={canEditThisMilestone && permissions.canCloseMilestone({ status: milestoneStatus })}
                                canDelete={canDeleteThisMilestone}
                                canRestore={canRestoreThisMilestone}
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

export function CommunFinancingSection({ aacConfig, funding, ctrl, renderMilestoneDiscussion }: CommunFinancingSectionProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    // Les dépenses brutes se resynchronisent seules : les mutations de palier
    // déclarent `extraInvalidate` sur cette entrée de cache (cf. `milestoneCtx` dans
    // `useCommunObjectivesController`). L'effet qui surveillait `loadingIds` a été
    // retiré — il ne voyait que les mutations de SA propre instance du contrôleur.
    //
    // L'étape est celle que la page a RÉSOLUE (`config.roles.depenseStepKey`) :
    // `aapStep1` en dur vidait la liste sur tout appel dont `depense` vit ailleurs.
    const { data: depenses, isLoading: isDepensesLoading } = useCommunRawDepenses(
        ctrl.resolvedAnswerId,
        aacConfig?.roles?.depenseStepKey ?? undefined,
    );

    const items = buildItemsFromRawDepenses(depenses ?? [], funding?.items ?? []);

    // Les paliers viennent des dépenses OU de l'enveloppe : tant que l'une des deux est en
    // vol et qu'aucun palier n'est là, une grille vide se lirait « aucun besoin financier ».
    const isLoading = (isDepensesLoading || ctrl.isLoadingData) && items.length === 0;

    return (
        <div className="group/paliers grid gap-4">
            {ctrl.cagnottePerms.canCreateMilestone ? (
                <div className="flex justify-end">
                    <Button size="sm" className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90" onClick={ctrl.openCreateMilestoneModal}>
                        <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
                    </Button>
                </div>
            ) : null}
            {isLoading ? <MilestoneCardsSkeleton /> : null}
            {items.map((o: CagnotteFundableItem, i: number) => (
                <FinancingMilestoneCard
                    // Clé sur l'identité du palier : sur l'index, l'état déplié d'une
                    // carte passait à sa voisine après une suppression.
                    key={o.itemId}
                    index={i}
                    item={o}
                    openEditMilestoneModal={ctrl.openEditMilestoneModal}
                    onMilestoneClose={ctrl.handleCloseMilestone}
                    onMilestoneRestore={ctrl.handleRestoreMilestone}
                    onMilestoneDelete={ctrl.handleDeleteMilestone}
                    permissions={ctrl.cagnottePerms}
                    loadingIds={ctrl.loadingIds}
                    discussion={renderMilestoneDiscussion?.({
                        // La clé se lit dans le document : la liste affichée l'a perdue, et une
                        // position ne la vaut que si les dépenses sont un vrai tableau.
                        lineKey: resolveDepenseKey(ctrl.depensesDocument, o.depenseIndex) ?? String(o.depenseIndex),
                        name: o.name,
                    })}
                />
            ))}
        </div>
    );
}
