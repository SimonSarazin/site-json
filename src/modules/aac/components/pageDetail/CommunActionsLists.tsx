/**
 * Paliers et actions en deux listes (onglet « Passage à l'action » de l'interface editorial), sur le
 * contrôleur et les droits de `CommunActionsSection` ; les dialogues sont montés par la page.
 */
import { useId, useState } from "react";
import { CheckCircle2, CircleDashed, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import type { CagnotteFundableItem, FundingAction as ProjectAction } from "@/modules/cagnotte/types";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";
import {
    actionCreatedLabel,
    actionRights,
    normalizeActionForEdit,
    uniqueActionRows,
} from "@/modules/aac/lib/objectiveHelpers";
import type { CommunObjectivesController } from "./CommunMilestoneDialogs";
import { ListRowsSkeleton } from "./CommunSkeletons";
import {
    ActionRowButtons,
    AddMilestoneButton,
    MilestoneManageBar,
    type CommunActionsSectionProps,
} from "./CommunActionsSection";

type ActionsListProps = Pick<CommunActionsSectionProps, "funding" | "ctrl">;

/**
 * Les paliers en frise : état, description, avancement des tâches ; gestion au survol.
 * Avec `onSelectMilestone`, un clic sur un palier le sélectionne (`itemId`), un second le désélectionne.
 */
export function CommunMilestonesList({
    funding,
    ctrl,
    selectedMilestoneId = null,
    onSelectMilestone,
}: ActionsListProps & {
    selectedMilestoneId?: string | null;
    onSelectMilestone?: (itemId: string | null) => void;
}) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");

    if (!ctrl.canManageActions) return null;

    const items = funding?.items ?? [];

    return (
        <div className="grid gap-4">
            <AddMilestoneButton ctrl={ctrl} />
            {items.length === 0 ? (
                ctrl.isLoadingData ? (
                    <ListRowsSkeleton count={2} />
                ) : (
                    <p className="text-sm text-muted-foreground">{String(t("editorial.detail.noMilestones"))}</p>
                )
            ) : (
                <ol className="space-y-4">
                    {items.map((item, i) => (
                        <MilestoneRow
                            key={item.itemId || i}
                            item={item}
                            ctrl={ctrl}
                            isSelected={item.itemId === selectedMilestoneId}
                            onSelect={
                                onSelectMilestone
                                    ? () => onSelectMilestone(item.itemId === selectedMilestoneId ? null : item.itemId)
                                    : undefined
                            }
                        />
                    ))}
                </ol>
            )}
        </div>
    );
}

function MilestoneRow({
    item,
    ctrl,
    isSelected,
    onSelect,
}: {
    item: CagnotteFundableItem;
    ctrl: CommunObjectivesController;
    isSelected: boolean;
    onSelect?: () => void;
}) {
    const t = useT("modules/aac");
    const isClosed = item.status === "close" || item.status === "done";
    const tasksDone = item.actions.filter((action) => action.status === "done").length;

    return (
        <li
            className={cn(
                "group relative border-l-2 pl-4 transition-colors",
                isSelected ? "border-primary" : "border-border",
                onSelect && "hover:border-primary/50",
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                {isClosed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                    <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <h3 className={cn("font-medium", isSelected && "text-primary")}>
                    {onSelect ? (
                        // Toute la ligne est cliquable ; la barre de gestion passe au-dessus (`z-10`).
                        <button
                            type="button"
                            onClick={onSelect}
                            aria-pressed={isSelected}
                            title={String(t("editorial.detail.filterByMilestone"))}
                            className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        >
                            {item.name}
                        </button>
                    ) : (
                        item.name
                    )}
                </h3>
                <Badge variant="secondary">
                    {String(t(isClosed ? "detail.objectives.closedBadge" : "detail.objectives.inProgress"))}
                </Badge>
            </div>
            {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
                {tasksDone}/{item.actions.length} {String(t("detail.objectives.tasksLabel"))}
            </p>
            <MilestoneManageBar
                item={item}
                permissions={ctrl.cagnottePerms}
                loadingIds={ctrl.loadingIds}
                openEditMilestoneModal={ctrl.openEditMilestoneModal}
                onMilestoneClose={ctrl.handleCloseMilestone}
                onMilestoneDelete={ctrl.handleDeleteMilestone}
                onMilestoneRestore={ctrl.handleRestoreMilestone}
                onActionCreate={ctrl.handleCreateAction}
                className="relative z-10 pt-3"
            />
        </li>
    );
}

/**
 * Les actions de tous les paliers, à plat : nom, palier, contributeurs, date, état ; gestion en ligne.
 * `milestoneFilter` (un `itemId`) ne garde que celles de ce palier ; un palier disparu ne filtre rien.
 * Les actions terminées sont masquées par défaut ; un interrupteur les réaffiche.
 */
export function CommunActionsFeed({
    funding,
    ctrl,
    milestoneFilter = null,
    onClearMilestoneFilter,
}: ActionsListProps & {
    milestoneFilter?: string | null;
    onClearMilestoneFilter?: () => void;
}) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const hideDoneId = useId();
    const [hideDone, setHideDone] = useState(true);

    if (!ctrl.canManageActions) return null;

    const items = funding?.items ?? [];
    if (items.length === 0 && ctrl.isLoadingData) return <ListRowsSkeleton count={2} />;

    const filterItem = milestoneFilter ? items.find((item) => item.itemId === milestoneFilter) : undefined;
    const scopeRows = uniqueActionRows(filterItem ? [filterItem] : items);
    const doneCount = scopeRows.filter(({ action }) => action.status === "done").length;
    const rows = hideDone ? scopeRows.filter(({ action }) => action.status !== "done") : scopeRows;

    const emptyKey =
        scopeRows.length > 0
            ? "editorial.detail.allActionsDone"
            : filterItem
              ? "editorial.detail.noMilestoneActions"
              : "detail.objectives.noTasksYet";

    return (
        <div className="grid gap-3">
            {filterItem || scopeRows.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {filterItem ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                                {String(t("editorial.detail.milestoneFilter", undefined, { name: filterItem.name }))}
                            </Badge>
                            {onClearMilestoneFilter ? (
                                <Button type="button" variant="ghost" size="sm" onClick={onClearMilestoneFilter}>
                                    <X className="size-4" aria-hidden="true" />
                                    {String(t("editorial.detail.showAllActions"))}
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                    {scopeRows.length > 0 ? (
                        <div className="ml-auto flex items-center gap-2">
                            <Switch id={hideDoneId} checked={hideDone} onCheckedChange={setHideDone} />
                            <Label htmlFor={hideDoneId} className="text-sm font-normal text-muted-foreground">
                                {String(t("editorial.detail.hideDoneActions", undefined, { count: doneCount }))}
                            </Label>
                        </div>
                    ) : null}
                </div>
            ) : null}
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{String(t(emptyKey))}</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map(({ item, action }, i) => (
                        <ActionFeedRow key={action.id || i} item={item} rawAction={action} ctrl={ctrl} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function ActionFeedRow({
    item,
    rawAction,
    ctrl,
}: {
    item: CagnotteFundableItem;
    rawAction: ProjectAction;
    ctrl: CommunObjectivesController;
}) {
    const t = useT("modules/aac");
    const action = normalizeActionForEdit(rawAction);
    const isDone = action.status === "done";
    const rights = actionRights(ctrl.cagnottePerms, action);
    const credits = toSafeInt(action.credits);
    const meta = [
        item.name,
        action.contributors.map((contributor) => contributor.name).join(", "),
        actionCreatedLabel(rawAction),
        credits > 0 ? formatCurrency(credits) : "",
        String(t(isDone ? "detail.objectives.done" : "detail.objectives.inProgress")),
    ].filter(Boolean);

    return (
        <li className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
            <input
                type="checkbox"
                checked={isDone}
                onChange={() => {
                    if (rights.canMarkDone) ctrl.handleActionDone(item.milestoneId, action);
                }}
                aria-label={action.name}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                disabled={ctrl.loadingIds.doneActionId === action.id || !rights.canMarkDone}
            />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{action.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{meta.join(" · ")}</p>
                {action.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {action.tags.map((tag) => (
                            <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                    </div>
                ) : null}
            </div>
            <span className="flex shrink-0 items-center gap-0.5">
                <ActionRowButtons
                    action={action}
                    rights={rights}
                    loadingIds={ctrl.loadingIds}
                    onCandidate={() => ctrl.handleActionCandidate(item.milestoneId, action)}
                    onEdit={() => ctrl.handleActionEdit(item.milestoneId, item.name, action)}
                    onDelete={() => ctrl.handleActionDelete(item.milestoneId, action)}
                />
            </span>
        </li>
    );
}
