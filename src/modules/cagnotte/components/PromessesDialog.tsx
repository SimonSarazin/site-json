import {useState, useMemo, Suspense} from "react";
import {lazy} from "vite-preload";
import {CreditCard, Layers, UserCheck, ChevronDown, ChevronRight} from "lucide-react";
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Pledge} from "@/modules/cagnotte/types";
import {useT} from "@/hooks/useT";
import {useLoadNamespace} from "@/hooks/useLoadNamespace";
import {toNumber} from "@/modules/cagnotte/utils/dataTransform.ts";

// Lazy-load : PledgePaymentPage tire @stripe/stripe-js + @stripe/react-stripe-js
// par import statique. En lazy, Stripe n'est téléchargé qu'au passage réel
// à l'étape paiement (clic sur "Payer ma sélection"), pas à l'ouverture de la modale.
const PledgePaymentPage = lazy(() => import("./PledgePaymentPage"));

interface PromessesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenCagnotte?: () => void;
    pledges: Pledge[];
}

type GroupMode = "resource" | "financer";
type DialogStep = "list" | "payment";

export function PromessesDialog({
                                    open,
                                    onOpenChange,
                                    onOpenCagnotte,
                                    pledges,
                                }: PromessesDialogProps) {
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");                               
    const [step, setStep] = useState<DialogStep>("list");
    const [groupMode, setGroupMode] = useState<GroupMode>("resource");
    const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
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

    const selectedPledgesList = useMemo(() => {
        return pledges.filter((p) => localSelectedIds.has(p.id));
    }, [pledges, localSelectedIds]);

    const totalSelectedAmount = useMemo(() => {
        return selectedPledgesList.reduce((sum, p) => sum + toNumber(p.fundingAmount), 0);
    }, [selectedPledgesList]);

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
            const allGroupIds = groupItems.map((i) => i.id);
            const isAllGroupChecked = allGroupIds.length > 0 && allGroupIds.every((id) => next.has(id));

            if (isAllGroupChecked) {
                allGroupIds.forEach((id) => next.delete(id)); // Tout décocher
            } else {
                allGroupIds.forEach((id) => next.add(id)); // Tout cocher
            }
            return next;
        });
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
            if (!val) setStep("list");
        }}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-hidden flex flex-col p-0">

                {step === "list" ? (
                    <>
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
                                  className="w-[280px]">
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

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                            {Object.keys(groupedData).length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    {String(t("CagnotteDialog.pledges.list.noPledges"))}
                                </p>
                            ) : (
                                Object.entries(groupedData).map(([groupId, group]) => {
                                    const isAllGroupChecked = group.items.length > 0 && group.items.every((i) => localSelectedIds.has(i.id));
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
                                                    {group.items.map((pledge) => (
                                                        <div key={pledge.id}
                                                             className="flex items-center justify-between p-3 pl-8 hover:bg-secondary/20 transition-colors">
                                                            <label
                                                                className="flex items-center gap-3 cursor-pointer flex-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={localSelectedIds.has(pledge.id)}
                                                                    onChange={() => handleToggleItem(pledge.id)}
                                                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer"
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
                                                                {pledge.fundingAmount.toLocaleString("fr-FR")} €
                                                            </span>
                                                        </div>
                                                    ))}
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
                    </>
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
                                    onOpenChange(false);
                                }}
                            />
                        </Suspense>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default PromessesDialog;