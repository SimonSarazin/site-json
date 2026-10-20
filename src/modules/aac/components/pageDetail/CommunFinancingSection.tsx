import { useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { CoFormData } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
  CagnotteResource,
  CagnotteFundableItem,
} from "@/modules/cagnotte/types";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { MilestoneManageActions } from "@/modules/cagnotte/components/sections/MilestoneManageActions";
import { DEFAULT_AAC_STEP, toSafeInt, buildItemsFromRawDepenses } from "@/modules/cagnotte/utils/dataTransform";
import { resolveDepenseKey } from "@/modules/cagnotte/utils/depenseKey";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";
import type { CagnottePermissions } from "@/modules/cagnotte/permissions/types";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";
import { ListRowsSkeleton, MilestoneCardsSkeleton } from "./CommunSkeletons";
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
     * `cards` (défaut) : une carte dépliable par palier, jauge comprise. `list` : lignes
     * sobres libellé / montant, historique des financements au clic, total en pied.
     */
    layout?: "cards" | "list";
    /**
     * Le bouton de discussion d'un palier, rendu par l'interface (c'est la page qui tient l'espace
     * de discussion du commun). `lineKey` est la CLÉ de la ligne de dépense dans le document, celle
     * que porte le fil — pas la position du palier dans la liste.
     */
    renderMilestoneDiscussion?: (milestone: { lineKey: string; name: string }) => ReactNode;
}

interface FinancingMilestoneProps {
    index: number;
    item: CagnotteFundableItem;
    openEditMilestoneModal: (milestone: Milestone) => void;
    onMilestoneClose: (itemId: string, milestone: Milestone) => void;
    onMilestoneRestore: (itemId: string, milestone: Milestone) => void;
    onMilestoneDelete: (itemId: string, milestone: Milestone) => void;
    permissions: MilestoneCardPermissions & Pick<CagnottePermissions, "canRestoreMilestone">;
    loadingIds: { deletingItemId: string; closingItemId: string; restoringItemId: string };
    /** Le bouton de discussion du palier, à droite de l'en-tête — hors du bouton qui déplie. */
    discussion?: ReactNode;
}

type FundingLine = CagnotteFundableItem["allFunding"][number];

const collectedPercent = (item: CagnotteFundableItem): number =>
    toSafeInt(item.price) > 0
        ? Math.min(Math.round((toSafeInt(item.currentFunding) / toSafeInt(item.price)) * 100), 100)
        : 0;

/** Trois états : un versement partiel validé n'est ni « payé » ni une simple promesse. */
function fundingStatus(fund: FundingLine): { labelKey: string; className: string } {
    const { status } = readFinancerPaymentState(fund);
    if (status === "payed") return { labelKey: "detail.objectives.paid", className: "text-success" };
    if (status === "partial") return { labelKey: "detail.objectives.partiallyPaid", className: "text-primary" };
    return { labelKey: "detail.objectives.pledged", className: "" };
}

/** Modifier, clore, supprimer, restaurer : la barre révélée au survol d'un palier (parent `group`). */
function FinancingMilestoneActions({
    item,
    openEditMilestoneModal,
    onMilestoneClose,
    onMilestoneRestore,
    onMilestoneDelete,
    permissions,
    loadingIds,
}: Omit<FinancingMilestoneProps, "index">) {
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

    if (!canEditThisMilestone && !canDeleteThisMilestone && !canRestoreThisMilestone) return null;

    return (
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
    );
}

function FinancingMilestoneCard(props: FinancingMilestoneProps) {
    const { index, item } = props;
    const [open, setOpen] = useState(false);
    const panelId = `palier-financement-${index}-panel`;

    useLoadNamespace("modules/aac");
    const c = useT("modules/aac");

    const pct = collectedPercent(item);
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
                    d'emplacement, pour que les jauges restent alignées d'une carte à l'autre.
                    Cette largeur suit le bouton : étroite tant qu'il se réduit à son icône et à
                    son compteur, large à partir de 80 rem, où il porte son libellé. */}
                <div
                    className="flex shrink-0 items-center justify-end pe-3 sm:pe-4 empty:hidden sm:group-has-[[data-milestone-discussion-slot]:not(:empty)]/paliers:flex! sm:group-has-[[data-milestone-discussion-slot]:not(:empty)]/paliers:min-w-20 xl:group-has-[[data-milestone-discussion-slot]:not(:empty)]/paliers:min-w-40"
                    data-milestone-discussion-slot
                >
                    {props.discussion}
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
                        {(item?.allFunding || []).map((fund: FundingLine, i: number) => {
                            const status = fundingStatus(fund);
                            return (
                                <li key={i} className="flex p-3 rounded-md border text-sm">
                                    <span className="w-[35%]">{fund.financerName}</span>
                                    <span className="w-[25%]">{formatCurrency(toSafeInt(fund.amount))}</span>
                                    <span className="w-[25%]">{fund?.date ? new Date(fund.date).toLocaleDateString("fr-FR") : ""}</span>
                                    <span className={cn("w-[15%]", status.className)}>
                                        {String(c(status.labelKey))}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <FinancingMilestoneActions {...props} />
        </div>
    );
}

/** Une dépense en ligne sobre (rendu `list`) : le clic déplie l'historique de ses financements. */
function FinancingExpenseRow(props: FinancingMilestoneProps) {
    const { index, item } = props;
    const [open, setOpen] = useState(false);
    const panelId = `depense-financements-${index}-panel`;

    useLoadNamespace("modules/aac");
    const c = useT("modules/aac");

    // Même marqueur que la carte : une dépense close reste listée, hors total.
    const isClosed = item.status === "close";
    const fundingLines = item.allFunding ?? [];

    return (
        <li className="group">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={panelId}
                className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
                <span className="min-w-0 text-sm">
                    <span className={isClosed ? "text-muted-foreground" : undefined}>{item.name}</span>
                    {isClosed ? (
                        <span
                            className="ml-2 rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            title={String(c("detail.objectives.closedBadgeHint"))}
                        >
                            {String(c("detail.objectives.closedBadge"))}
                        </span>
                    ) : (
                        <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                            {String(c("detail.objectives.collectedPercent", undefined, { percent: collectedPercent(item) }))}
                        </span>
                    )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium tabular-nums">{formatCurrency(toSafeInt(item.price))}</span>
                    <ChevronDown
                        className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                        aria-hidden="true"
                    />
                </span>
            </button>
            {/* Le bouton de discussion de la ligne, sous l'en-tête — un bouton ne s'imbrique pas dans un autre. */}
            {props.discussion ? (
                <div className="flex justify-end pb-2" data-milestone-discussion-slot>
                    {props.discussion}
                </div>
            ) : null}

            {open && (
                <div id={panelId} className="pb-3">
                    {fundingLines.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{String(c("detail.objectives.noFundingYet"))}</p>
                    ) : (
                        <ul className="space-y-1.5 border-l-2 border-border pl-3">
                            {fundingLines.map((fund: FundingLine, i: number) => {
                                const status = fundingStatus(fund);
                                return (
                                    <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                                        <span className="min-w-0 text-muted-foreground">
                                            <span className="text-foreground">{fund.financerName}</span>
                                            {fund.date ? ` · ${new Date(fund.date).toLocaleDateString("fr-FR")}` : ""}
                                        </span>
                                        <span className="shrink-0 tabular-nums">
                                            {formatCurrency(toSafeInt(fund.amount))}
                                            <span className={cn("ml-2", status.className || "text-muted-foreground")}>
                                                {String(c(status.labelKey))}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            <FinancingMilestoneActions {...props} />
        </li>
    );
}

export function CommunFinancingSection({ aacConfig, funding, ctrl, layout = "cards", renderMilestoneDiscussion }: CommunFinancingSectionProps) {
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

    // Le fil d'un palier est celui d'une ligne de `answers.aapStep1.depense` : la seule liste que
    // l'espace de discussion connaisse, celle du gabarit legacy. Une fiche qui lit ses dépenses à
    // une autre étape n'a pas de fil à apparier — par la clé seule, elle ouvrirait celui d'une
    // AUTRE ligne.
    const milestoneThreads = (aacConfig?.roles?.depenseStepKey ?? DEFAULT_AAC_STEP) === DEFAULT_AAC_STEP;

    // Les paliers viennent des dépenses OU de l'enveloppe : tant que l'une des deux est en
    // vol et qu'aucun palier n'est là, une grille vide se lirait « aucun besoin financier ».
    const isLoading = (isDepensesLoading || ctrl.isLoadingData) && items.length === 0;

    const milestoneProps = (item: CagnotteFundableItem, index: number): FinancingMilestoneProps => ({
        index,
        item,
        openEditMilestoneModal: ctrl.openEditMilestoneModal,
        onMilestoneClose: ctrl.handleCloseMilestone,
        onMilestoneRestore: ctrl.handleRestoreMilestone,
        onMilestoneDelete: ctrl.handleDeleteMilestone,
        permissions: ctrl.cagnottePerms,
        loadingIds: ctrl.loadingIds,
        // La clé se lit dans le document : la liste affichée l'a perdue, et une position ne la vaut
        // que si les dépenses sont un vrai tableau. Introuvable, pas de bouton : retomber sur la
        // position inventait la clé que `depenseKey.ts` interdit, et un palier pouvait ouvrir le fil
        // d'une AUTRE dépense (revue du 16/10).
        discussion: (() => {
            const lineKey = milestoneThreads ? resolveDepenseKey(ctrl.depensesDocument, item.depenseIndex) : null;
            return lineKey !== null ? renderMilestoneDiscussion?.({ lineKey, name: item.name }) : undefined;
        })(),
    });

    const addMilestone = ctrl.cagnottePerms.canCreateMilestone ? (
        <div className="flex justify-end">
            <Button size="sm" className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90" onClick={ctrl.openCreateMilestoneModal}>
                <Plus className="h-3 w-3" /> {String(t("detail.objectives.addMilestone"))}
            </Button>
        </div>
    ) : null;

    if (layout === "list") {
        // Les dépenses closes sont hors total, comme dans la carte de financement.
        const total = items
            .filter((item) => item.status !== "close")
            .reduce((sum, item) => sum + toSafeInt(item.price), 0);

        return (
            <div className="group/paliers grid gap-4">
                {addMilestone}
                {isLoading ? <ListRowsSkeleton count={2} /> : null}
                {items.length > 0 ? (
                    <div>
                        <ul className="divide-y divide-border">
                            {items.map((o: CagnotteFundableItem, i: number) => (
                                <FinancingExpenseRow key={o.itemId} {...milestoneProps(o, i)} />
                            ))}
                        </ul>
                        <p className="mt-4 text-sm text-muted-foreground">
                            {String(t("detail.financing.expensesTotal"))}{" "}
                            <strong className="text-foreground tabular-nums">{formatCurrency(total)}</strong>
                        </p>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className="group/paliers grid gap-4">
            {addMilestone}
            {isLoading ? <MilestoneCardsSkeleton /> : null}
            {items.map((o: CagnotteFundableItem, i: number) => (
                // Clé sur l'identité du palier : l'état déplié suit son palier.
                <FinancingMilestoneCard key={o.itemId} {...milestoneProps(o, i)} />
            ))}
        </div>
    );
}
