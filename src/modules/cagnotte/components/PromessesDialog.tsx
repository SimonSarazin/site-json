import {useState, useMemo, useCallback, Suspense} from "react";
import {lazy} from "vite-preload";
import {CreditCard, Layers, UserCheck, ChevronDown, ChevronRight, Trash2} from "lucide-react";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Pledge} from "@/modules/cagnotte/types";
import {useT} from "@/hooks/useT";
import {useLoadNamespace} from "@/hooks/useLoadNamespace";
import {cn} from "@/lib/utils";
import { cleDepense, montantARegler, totalARegler } from "@/modules/cagnotte/utils/commande";
import { CagnottePaymentsPanel } from "./parts/CagnottePaymentsPanel";
import { RetractPledgeDialog, type RetractPledgeRequest } from "./parts/RetractPledgeDialog";
import { usePledgeRetractionEnabled } from "@/modules/cagnotte/hooks/usePledgeRetractionEnabled";
import { usePledgeSelectionHold, type PledgeHoldRefusal } from "@/modules/cagnotte/hooks/usePledgeSelectionHold";
import { usePledgesInProgress } from "@/modules/cagnotte/hooks/usePledgesInProgress";
import { readPledgesLockedForSelection } from "@/modules/cagnotte/utils/pledgeRetraction";

// Lazy-load : PledgePaymentPage tire @stripe/stripe-js + @stripe/react-stripe-js
// par import statique. En lazy, Stripe n'est téléchargé qu'au passage réel
// à l'étape paiement (clic sur "Payer ma sélection"), pas à l'ouverture de la modale.
const PledgePaymentPage = lazy(() => import("./PledgePaymentPage"));

interface PromessesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenCagnotte?: () => void;
    pledges: Pledge[];
    /** Après le retrait d'une promesse : l'hôte relit ce que les caches du financement ne couvrent pas. */
    onRetracted?: () => void;
}

type GroupMode = "resource" | "financer";
type DialogStep = "list" | "payment";
type ListTab = "pledges" | "payments";

/** Pastille d'une promesse verrouillée, par raison : libellé et infobulle. */
const LOCK_BADGES: Record<PledgeHoldRefusal, { label: string; hint?: string }> = {
    heldByOther: { label: "PledgeRetract.inProgress", hint: "PledgeRetract.inProgressHint" },
    paymentInProgress: { label: "PledgeRetract.inProgress", hint: "PledgeRetract.inProgressHint" },
    retracted: { label: "PledgeRetract.retracted" },
    notAllowed: { label: "PledgeRetract.notAllowed", hint: "PledgeRetract.notAllowedHint" },
};

export function PromessesDialog({
                                    open,
                                    onOpenChange,
                                    onOpenCagnotte,
                                    pledges: allPledges,
                                    onRetracted,
                                }: PromessesDialogProps) {
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");                               
    const retractionEnabled = usePledgeRetractionEnabled();
    // Promesses retirées depuis l'ouverture : l'hôte peut garder une liste figée.
    const [retractedIds, setRetractedIds] = useState<Set<string>>(new Set());
    const [retractRequest, setRetractRequest] = useState<(RetractPledgeRequest & { pledgeId: string }) | null>(null);
    const pledges = useMemo(() => allPledges.filter((p) => !retractedIds.has(p.id)), [allPledges, retractedIds]);
    const [step, setStep] = useState<DialogStep>("list");
    // Sans promesse à régler, la modale s'ouvre sur les paiements.
    const [listTab, setListTab] = useState<ListTab>(() => (pledges.length > 0 ? "pledges" : "payments"));
    const [groupMode, setGroupMode] = useState<GroupMode>("resource");
    const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
    // Promesses dont la réservation a été refusée (paiement d'un autre, promesse retirée), par `finkey`.
    const [refusedFinkeys, setRefusedFinkeys] = useState<Map<string, PledgeHoldRefusal>>(new Map());
    // Paiements en cours relus pendant que la modale est ouverte ; sans réponse, ceux que l'hôte a lus.
    const pledgeAnswerIds = useMemo(() => pledges.map((p) => p.resourceId ?? ""), [pledges]);
    const liveInProgress = usePledgesInProgress(pledgeAnswerIds, { enabled: open });
    const isLockedLive = useMemo(() => (liveInProgress ? readPledgesLockedForSelection(liveInProgress) : null), [liveInProgress]);
    /** Ce qui empêche de cocher une promesse, ou `null`. */
    const lockOf = useCallback((pledge: Pledge): PledgeHoldRefusal | null => {
        if (!retractionEnabled) return null;
        const inProgress = isLockedLive
            ? !!pledge.resourceId && isLockedLive(pledge.resourceId, pledge.finkey ?? "")
            : !!pledge.paymentInProgress;
        return refusedFinkeys.get(pledge.finkey ?? "") ?? (inProgress ? "paymentInProgress" : null);
    }, [retractionEnabled, isLockedLive, refusedFinkeys]);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const groupedData = useMemo(() => {
        return pledges.reduce((acc, pledge) => {
            const keyId = groupMode === "resource" ? pledge.resourceId : pledge.financerId;
            const keyName = groupMode === "resource" ? pledge.resourceName : pledge.financerName;

            // On vérifie que les clés sont valides avant de faire quoi que ce soit
            if (keyId && keyName) {
                // 1. Si le groupe n'existe pas encore pour cet ID, on le crée
                if (!acc[keyId]) {
                    acc[keyId] = { name: keyName, items: [] };
                }
                
                // 2. On ajoute systématiquement le pledge dans le groupe
                acc[keyId].items.push(pledge);
            }

            return acc;
        }, {} as Record<string, { name: string; items: Pledge[] }>);
    }, [pledges, groupMode]);

    const selectedPledgesList = useMemo(
        () => pledges.filter((p) => localSelectedIds.has(p.id) && !lockOf(p)),
        [pledges, localSelectedIds, lockOf],
    );

    const handleRefused = useCallback((refusals: Map<string, PledgeHoldRefusal>) => {
        setRefusedFinkeys((prev) => new Map([...prev, ...refusals]));
    }, []);
    const { flush: flushSelection } = usePledgeSelectionHold({ enabled: retractionEnabled, open, selected: selectedPledgesList, onRefused: handleRefused });

    const totalSelectedAmount = useMemo(() => totalARegler(selectedPledgesList), [selectedPledgesList]);

    const handleToggleItem = (id: string) => {
        setLocalSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleGroup = (groupItems: Pledge[]) => {
        setLocalSelectedIds((prev) => {
            const next = new Set(prev);
            const allGroupIds = groupItems.filter((i) => !lockOf(i)).map((i) => i.id);
            const isAllGroupChecked = allGroupIds.length > 0 && allGroupIds.every((id) => next.has(id));

            if (isAllGroupChecked) {
                allGroupIds.forEach((id) => next.delete(id)); // Tout décocher
            } else {
                allGroupIds.forEach((id) => next.add(id)); // Tout cocher
            }
            return next;
        });
    };

    // Une décoche encore en attente est d'abord envoyée : la confirmation relit l'état de la promesse.
    const requestRetract = async (pledge: Pledge) => {
        if (!pledge.resourceId || !pledge.finkey) return;
        await flushSelection();
        setRetractRequest({
            pledgeId: pledge.id,
            answerId: pledge.resourceId,
            depenseKey: cleDepense(pledge),
            financerId: pledge.financerId,
            finkey: pledge.finkey,
            financerName: pledge.financerName ?? "",
            amount: pledge.fundingAmount,
            depenseName: pledge.depenseName,
        });
    };

    const handleRetracted = (pledgeId: string) => {
        setRetractedIds((prev) => new Set(prev).add(pledgeId));
        setLocalSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(pledgeId);
            return next;
        });
        onRetracted?.();
    };

    const handleToggleExpand = (groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId); // Ferme le groupe
            } else {
                next.add(groupId); // Ouvre le groupe
            }
            return next;
        });
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) {
                setStep("list");
                setRefusedFinkeys(new Map());
            }
        }}>
            <DialogContent
                aria-describedby={undefined}
                className={cn(
                    "bg-card border-border max-h-[90vh] overflow-hidden flex flex-col p-0",
                    step === "list" && listTab === "payments" ? "sm:max-w-4xl" : "sm:max-w-2xl",
                )}>

                {step === "list" ? (
                    <Tabs value={listTab} onValueChange={(v) => setListTab(v === "payments" ? "payments" : "pledges")}
                          className="flex-1 min-h-0 gap-0">
                        <DialogHeader
                            className="border-b px-6 py-4 flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                                <CreditCard className="w-6 h-6 text-primary"/>
                                {String(t("CagnotteDialog.pledges.list.title"))}
                            </DialogTitle>

                            <Tabs value={groupMode} onValueChange={(v) => {
                                setGroupMode(v as GroupMode);
                                setExpandedGroups(new Set());
                            }}
                                  className={cn("w-[280px]", listTab === "payments" && "hidden")}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="resource" className="
                                    flex items-center gap-1.5 text-xs
                                    bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground

                                    dark:data-[state=active]:bg-primary 
                                    dark:data-[state=active]:text-primary-foreground 
                                    dark:data-[state=active]:shadow-md
                                    data-[state=active]:bg-primary 
                                    data-[state=active]:text-primary-foreground 
                                    data-[state=active]:shadow-md
                                    ">
                                        <Layers className="w-3.5 h-3.5"/> {String(t("CagnotteDialog.pledges.list.triggerResource"))}
                                    </TabsTrigger>
                                    <TabsTrigger value="financer" className="
                                    flex items-center gap-1.5 text-xs
                                    bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground
            
                                    dark:data-[state=active]:bg-primary 
                                    dark:data-[state=active]:text-primary-foreground 
                                    dark:data-[state=active]:shadow-md
                                    data-[state=active]:bg-primary 
                                    data-[state=active]:text-primary-foreground 
                                    data-[state=active]:shadow-md
                                    ">
                                        <UserCheck className="w-3.5 h-3.5"/> {String(t("CagnotteDialog.pledges.list.triggerFunder"))}
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </DialogHeader>

                        <div className="border-b px-6 py-2">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="pledges">{String(t("CagnotteDialog.pledges.list.tabs.pledges"))}</TabsTrigger>
                                <TabsTrigger value="payments">{String(t("CagnotteDialog.pledges.list.tabs.payments"))}</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="pledges" className="flex min-h-0 flex-col">
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                                {Object.keys(groupedData).length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">
                                        {String(t("CagnotteDialog.pledges.list.noPledges"))}
                                    </p>
                                ) : (
                                    Object.entries(groupedData).map(([groupId, group]) => {
                                        const selectableItems = group.items.filter((i) => !lockOf(i));
                                        const isAllGroupChecked = selectableItems.length > 0 && selectableItems.every((i) => localSelectedIds.has(i.id));
                                        const isExpanded = expandedGroups.has(groupId);

                                        return (
                                            <div key={groupId}
                                                 className="rounded-xl border border-border/60 bg-secondary/10 overflow-hidden transition-all">
                                                <div
                                                    className="flex items-center justify-between bg-secondary/30 px-4 py-3 border-b border-border/40 hover:bg-secondary/40 transition-colors">
                                                    
                                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={isAllGroupChecked}
                                                            onChange={() => handleToggleGroup(group.items)}
                                                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer"
                                                        />
                                                        <span className="font-semibold text-sm text-foreground">
                                                            {group.name}
                                                        </span>
                                                    </label>

                                                    {/* Clic sur la zone de droite pour plier/replier */}
                                                    <div 
                                                        className="flex items-center gap-3 cursor-pointer select-none group"
                                                        onClick={() => handleToggleExpand(groupId)}
                                                    >
                                                        <span
                                                            className="text-xs text-muted-foreground bg-background px-2.5 py-1 rounded-full border border-border/50 group-hover:border-primary/50 transition-colors">
                                                            {group.items.length} {group.items.length > 1 ? String(t("CagnotteDialog.pledges.list.engagements")) : String(t("CagnotteDialog.pledges.list.engagement"))}
                                                        </span>
                                                        <div className="text-muted-foreground group-hover:text-primary transition-colors">
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-5 h-5" />
                                                            ) : (
                                                                <ChevronRight className="w-5 h-5" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="divide-y divide-border/30">
                                                        {group.items.map((pledge) => {
                                                            const lock = lockOf(pledge);
                                                            const badge = lock ? LOCK_BADGES[lock] : null;
                                                            return (
                                                            <div key={pledge.id}
                                                                 className="flex items-center justify-between p-3 pl-8 hover:bg-secondary/20 transition-colors">
                                                                <label
                                                                    className={cn("flex items-center gap-3 flex-1", lock ? "cursor-not-allowed" : "cursor-pointer")}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!lock && localSelectedIds.has(pledge.id)}
                                                                        disabled={lock !== null}
                                                                        onChange={() => handleToggleItem(pledge.id)}
                                                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer disabled:cursor-not-allowed"
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <span
                                                                            className="text-sm font-medium text-foreground">{pledge.depenseName}</span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {groupMode === "resource"
                                                                                ? `${String(t("CagnotteDialog.pledges.list.by"))} : ${pledge.financerName}`
                                                                                : `${String(t("CagnotteDialog.pledges.list.for"))} : ${pledge.resourceName}`}
                                                                        </span>
                                                                    </div>
                                                                </label>
                                                                <span className="font-mono text-sm font-semibold pr-2">
                                                                    {montantARegler(pledge).toLocaleString("fr-FR")} €
                                                                </span>
                                                                {badge ? (
                                                                    <span
                                                                        title={badge.hint ? String(t(badge.hint)) : undefined}
                                                                        className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                                                                    >
                                                                        {String(t(badge.label))}
                                                                    </span>
                                                                ) : retractionEnabled && !localSelectedIds.has(pledge.id) && pledge.retractable && pledge.finkey && pledge.resourceId ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void requestRetract(pledge)}
                                                                        aria-label={String(t("PledgeRetract.aria", undefined, { financer: pledge.financerName ?? "" }))}
                                                                        title={String(t("PledgeRetract.action"))}
                                                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" aria-hidden="true"/>
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="border-t border-border bg-secondary/5 px-6 py-4">
                                <div className="flex justify-between items-center mb-4 text-base font-bold">
                                    <span>{String(t("CagnotteDialog.pledges.list.totalSelectedLabel"))}</span>
                                    <span
                                        className="text-primary font-mono text-xl">{totalSelectedAmount.toLocaleString("fr-FR")} €</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        disabled={totalSelectedAmount === 0}
                                        onClick={() => setStep("payment")}
                                        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {String(t("CagnotteDialog.pledges.list.PaySelected"))} ({totalSelectedAmount.toLocaleString("fr-FR")} €)
                                    </button>
                                    {onOpenCagnotte && ( 
                                        <button onClick={onOpenCagnotte}
                                                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                            {String(t("CagnotteDialog.pledges.list.return"))}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="payments" className="min-h-0 overflow-y-auto px-6 py-4">
                            <CagnottePaymentsPanel/>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="p-6 overflow-y-auto">
                        <DialogTitle className="mb-4">
                            {String(t("CagnotteDialog.pledges.payment.title"))}
                        </DialogTitle>
                        <Suspense fallback={null}>
                            <PledgePaymentPage
                                pledges={selectedPledgesList}
                                onBack={() => setStep("list")}
                                onClose={() => {
                                    setStep("list");
                                    setRefusedFinkeys(new Map());
                                    onOpenChange(false);
                                }}
                            />
                        </Suspense>
                    </div>
                )}
                <RetractPledgeDialog
                    request={retractRequest}
                    onClose={() => setRetractRequest(null)}
                    onRetracted={() => {
                        if (retractRequest) handleRetracted(retractRequest.pledgeId);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

export default PromessesDialog;