import { useEffect, useState } from "react";
import { Heart, ArrowRight, Check, X, Loader2 } from "lucide-react";
import type { CoFormData, CoFormAnswer } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { Progress } from "@/components/ui/progress";
import CagnotteDialog from "@/modules/cagnotte/components/CagnotteDialog";
import { toSafeInt, buildItemsFromRawDepenses, getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import {
    useCommunReactions,
    getCommunReactionState,
    type CommunReactionType,
} from "@/modules/aac/hooks/useCommunReactions";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";

interface StatProps {
    value: string | number;
    label: string;
    cta: string;
    activeLabel?: string;
    active: boolean;
    pending: boolean;
    onToggle: () => void;
}

function Stat({ value, label, cta, activeLabel, active, pending, onToggle }: StatProps) {
    return (
        <div className="min-w-0">
            <div className="text-2xl font-display font-bold tabular-nums sm:text-3xl">
                {value}
            </div>
            <div className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                {label}
            </div>
            <ClientOnly>
                {() => (
                    <button
                        type="button"
                        disabled={pending}
                        onClick={onToggle}
                        className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {active && activeLabel ? activeLabel : cta}
                        <ArrowRight className="size-3" />
                    </button>
                )}
            </ClientOnly>
        </div>
    );
}

interface CommunFinancingCardProps {
    formData: CoFormData;
    answerQuery: CoFormAnswer | null;
    aacConfig: AacResolvedConfig | null;
    funding?: any;
    onFunded?: () => void;
}

export function CommunFinancingCard({
    formData: _formData,
    answerQuery,
    aacConfig: _aacConfig,
    funding,
    onFunded,
}: CommunFinancingCardProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { me, entity } = useCocolight();
    const { toggleReaction } = useCommunReactions();
    const answerId = answerQuery ? getEntityId(answerQuery) : undefined;
    const [reactions, setReactions] = useState(() => getCommunReactionState(answerQuery, me?.serverData?.id));
    const [pending, setPending] = useState<CommunReactionType | null>(null);

    const [localStats, setLocalStats] = useState({
        utilise: Object.values(answerQuery?.links?.contributors || {}).length,
        love: Object.values(answerQuery?.vote || {}).length,
        interesse: Object.values(answerQuery?.links?.tls || {}).length,
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [orgs, setOrgs] = useState<any[]>([]);
    const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
    // Ids des organisations marquées "intéressées" (links.tls) — affiché dans la
    // liste du modal. State (et non simple useMemo) pour pouvoir être mis à jour
    // localement juste après chaque réaction, sans attendre un refetch de answerQuery.
    const [interestedOrgIds, setInterestedOrgIds] = useState<Set<string>>(
        () => new Set(Object.keys(answerQuery?.links?.tls || {})),
    );

    useEffect(() => {
        setReactions(getCommunReactionState(answerQuery, me?.serverData?.id));
        setLocalStats({
            utilise: Object.values(answerQuery?.links?.contributors || {}).length,
            love: Object.values(answerQuery?.vote || {}).length,
            interesse: Object.values(answerQuery?.links?.tls || {}).length,
        });
        setInterestedOrgIds(new Set(Object.keys(answerQuery?.links?.tls || {})));
    }, [answerId, answerQuery, me?.serverData?.id]);

    const loadOrganizations = async () => {
        if (!entity) {
            console.error(String(t("toasts.errors.noApiClient")));
            return;
        }
        setIsLoadingOrgs(true);
        try {
            const typeCoFinancer = _aacConfig?.typeCoFinancer ?? "tiersLieux";
            let orgParam = {};
            
            if (typeCoFinancer === "tiersLieux") {
                orgParam = {
                    searchType: ["organizations"],
                    filters: {
                        "$or": {
                            'source.keys': 'franceTierslieux',
                            'reference.costum': 'franceTierslieux',
                            'mainTag': 'TiersLieux'
                        }
                    },
                    notSourceKey: true
                };
            } else if (typeCoFinancer === "cae") {
                orgParam = {
                    searchType: ["organizations"],
                    filters: {
                        "tags": { "$in": ["CAE", "cae", "Cae"] }
                    },
                    notSourceKey: true
                };
            }
            
            const result = await entity.searchCostum(orgParam as any);
            setOrgs(result && result?.results ? Object.values(result?.results).map(res => res?.serverData || {}) : []);
        } catch (error) {
            console.error("Erreur lors du chargement des organisations:", error);
        } finally {
            setIsLoadingOrgs(false);
        }
    };

    const executeToggle = async (
        type: CommunReactionType,
        selectedOrg?: { id: string; name: string },
        forcedIsActivating?: boolean,
    ) => {
        if (pending || !answerId) return;
        setPending(type);

        // Pour "interesse", chaque organisation de la liste bascule indépendamment
        // (cf. handleOrgClick) : l'état vient de l'appelant, pas du booléen global
        // `reactions.interesse` qui n'a de sens que pour "utilise"/"love".
        const isActivating = forcedIsActivating ?? !reactions[type];

        setReactions((prev) => ({ ...prev, [type]: isActivating }));
        setLocalStats((prev) => ({ ...prev, [type]: prev[type] + (isActivating ? 1 : -1) }));

        let finalReactorId = me?.serverData?.id || me?.id;
        let finalReactorName = me?.serverData?.name;

        if (type === "interesse" && selectedOrg) {
            // L'organisation cliquée dans le modal est toujours la clé écrite/retirée
            // côté links.tls, que ce soit pour sélectionner ou désélectionner.
            finalReactorId = selectedOrg.id;
            finalReactorName = selectedOrg.name;

            // Mise à jour optimiste du modal : le check de cette organisation reflète
            // la réaction immédiatement, sans attendre un refetch de answerQuery.
            setInterestedOrgIds((prev) => {
                const next = new Set(prev);
                if (isActivating) next.add(selectedOrg.id);
                else next.delete(selectedOrg.id);
                return next;
            });
        }

        const result = await toggleReaction(answerId, type, finalReactorId as string, finalReactorName as string);

        if (result === null) {
            setReactions((prev) => ({ ...prev, [type]: !isActivating }));
            setLocalStats((prev) => ({ ...prev, [type]: prev[type] + (isActivating ? -1 : 1) }));
            if (type === "interesse" && selectedOrg) {
                // Rollback : l'écriture a échoué, on annule le check optimiste.
                setInterestedOrgIds((prev) => {
                    const next = new Set(prev);
                    if (isActivating) next.delete(selectedOrg.id);
                    else next.add(selectedOrg.id);
                    return next;
                });
            }
        }

        setPending(null);
        if (type !== "interesse") {
            setIsModalOpen(false);
        }
    };

    const handleToggleClick = (type: CommunReactionType) => {
        if (type === "interesse") {
            // Le bouton se contente d'ouvrir le modal — la sélection/désélection se
            // fait organisation par organisation dans la liste (cf. handleOrgClick).
            setIsModalOpen(true);
            loadOrganizations();
            return;
        }
        executeToggle(type);
    };

    const handleOrgClick = (org: any) => {
        const orgId = org._id?.$id || org.id;
        const isAlreadyInterested = interestedOrgIds.has(orgId);
        executeToggle("interesse", { id: orgId, name: org?.name || "" }, !isAlreadyInterested);
    };

    const { data: depenses } = useCommunRawDepenses(answerId);
    const items = buildItemsFromRawDepenses(depenses ?? [], funding?.items ?? []);
    const openItems = items.filter((item) => item?.status !== "close");

    const resourceFinancedAmount = toSafeInt(funding?.resourceFinancedAmount) || openItems.reduce((sum, item) => sum + toSafeInt(item.currentFunding), 0);
    const resourceTotalAmount = toSafeInt(funding?.resourceTotalAmount) || openItems.reduce((sum, item) => sum + toSafeInt(item.price), 0);
    const resourceRemainingAmount = Math.max(resourceTotalAmount - resourceFinancedAmount, 0);
    const resourceAmountPerc = resourceTotalAmount > 0 ? Math.min(toSafeInt((resourceFinancedAmount / resourceTotalAmount) * 100), 100) : 0;

    const cofinancers = openItems.flatMap((item) => item?.allFunding ?? []);
    const cofinancerCount = new Set(cofinancers.map((cont: any) => cont?.financerId)).size;

    return (
        <div className="lg:col-span-5 relative">
            <div className="lg:col-span-5 mb-6">
                <div className="grid grid-cols-3 gap-4 border-border">
                    <Stat
                        value={localStats.utilise}
                        label={t("detail.contributors")}
                        cta={t("detail.contribute")}
                        activeLabel={t("detail.alreadyContributor")}
                        active={reactions.utilise}
                        pending={pending === "utilise"}
                        onToggle={() => handleToggleClick("utilise")}
                    />
                    <Stat
                        value={localStats.love}
                        label={t("detail.votes")}
                        cta={t("detail.vote")}
                        activeLabel={t("detail.alreadyInterested")}
                        active={reactions.love}
                        pending={pending === "love"}
                        onToggle={() => handleToggleClick("love")}
                    />
                    <Stat
                        value={localStats.interesse}
                        label={t("detail.tls")}
                        cta={t("detail.use")}
                        active={reactions.interesse}
                        pending={pending === "interesse"}
                        onToggle={() => handleToggleClick("interesse")}
                    />
                </div>
            </div>

            <div className="bg-surface p-6 sm:p-8 rounded-xl border border-border ring-1 ring-inset ring-white/5">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display font-bold text-lg">{String(t("detail.financing.title"))}</h3>
                </div>

                <div className="space-y-6">
                    <div className="flex items-end justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-3xl sm:text-4xl font-display font-bold tabular-nums">
                                {formatCurrency(resourceFinancedAmount)}
                            </div>
                            <div className="text-muted-foreground text-sm mt-1">
                                {String(t("detail.financing.outOf", undefined, { amount: formatCurrency(resourceTotalAmount) }))}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-2xl font-display font-bold text-primary tabular-nums">
                                {resourceAmountPerc}%
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {String(t("detail.financing.collected"))}
                            </div>
                        </div>
                    </div>

                    <Progress value={resourceAmountPerc} className="h-2 bg-background border border-border" />

                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div className="p-3 rounded-md bg-background/50 border border-border">
                            <div className="font-display font-bold text-foreground text-base">{cofinancerCount}</div>
                            {String(t("detail.financing.cofinancers"))}
                        </div>
                        <div className="p-3 rounded-md bg-background/50 border border-border">
                            <div className="font-display font-bold text-foreground text-base">
                                {formatCurrency(resourceRemainingAmount)}
                            </div>
                            {String(t("detail.financing.remaining"))}
                        </div>
                    </div>

                    <CagnotteDialog
                        totalAmount={resourceFinancedAmount}
                        defaultResourceId={answerId}
                        onRefresh={onFunded}
                        openContext={{ resourceId: answerId, hideResourceSelect: true }}
                    >
                        <button
                            type="button"
                            disabled={resourceRemainingAmount <= 0}
                            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md transition-all shadow-[0_0_30px_-8px] shadow-primary/60 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <Heart className="size-4" />
                            {resourceRemainingAmount > 0 ? String(t("detail.financing.cta")) : String(t("detail.financing.goalReached"))}
                            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </CagnotteDialog>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md p-6 bg-surface border border-border rounded-xl shadow-lg relative">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-5" />
                        </button>
                        <h3 className="text-lg font-bold mb-4 font-display">{String(t("detail.financing.selectOrganization"))}</h3>
                        
                        {isLoadingOrgs ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="size-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                                {orgs.length > 0 ? (
                                    orgs.map((org: any) => {
                                        const orgId = org._id?.$id || org.id;
                                        const isAlreadyInterested = interestedOrgIds.has(orgId);
                                        return (
                                            <button
                                                key={orgId}
                                                onClick={() => handleOrgClick(org)}
                                                disabled={pending === "interesse"}
                                                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/10 transition-colors flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="font-medium text-sm block">{org?.name || ""}</span>
                                                {isAlreadyInterested && <Check className="size-4 text-primary shrink-0" />}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">{String(t("detail.financing.noOrganizationFound"))}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}