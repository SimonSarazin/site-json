import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Heart, ArrowRight } from "lucide-react";
import type { CoFormData, CoFormAnswer } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { useAuthModal } from "@/modules/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import CagnotteDialog from "@/modules/cagnotte/components/CagnotteDialog";
import { toSafeInt, buildItemsFromRawDepenses, getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import type { CagnotteResource } from "@/modules/cagnotte/types";
import type { CommunReactionType } from "@/modules/aac/hooks/useCommunReactions";
import { useCommunRawDepenses } from "@/modules/aac/hooks/useCommunRawDepenses";
import { useCommunFundingContext } from "@/modules/aac/hooks/useCommunFundingContext";
import { useCommunFundingHost } from "@/modules/aac/hooks/useCommunFundingHost";
import { useShowSection } from "@/modules/aac/hooks/useCommunSectionNav";
import { canManageObjectiveActions, uniqueActionRows } from "@/modules/aac/lib/objectiveHelpers";
import { aggregateCofinancers } from "@/modules/aac/lib/cofinancers";
import { CommunReactionStats } from "./CommunReactionStats.tsx";

/**
 * Ce qu'un visiteur NON connecté a demandé, et qu'on rejoue quand sa session
 * arrive : réagir (« Je contribue », « Ça m'intéresse », « J'utilise ») ou
 * financer.
 *
 * Exporté parce que l'intention ne vit PAS ici : elle est portée par la page
 * (cf. `postLoginIntent` dans les props).
 */
export type PostLoginIntent = { kind: "reaction"; type: CommunReactionType } | { kind: "fund" };

interface CommunFinancingCardProps {
    formData: CoFormData;
    answerQuery: CoFormAnswer | null;
    aacConfig: AacResolvedConfig | null;
    funding?: CagnotteResource | null;
    /** Joué après une contribution enregistrée — la page y rafraîchit SES caches. */
    onFunded?: () => void | Promise<void>;
    /**
     * L'intention laissée par un visiteur non connecté, PORTÉE PAR LA PAGE.
     *
     * Elle ne peut pas vivre dans cette carte : le rendu où `me.isConnected`
     * passe à `true` est précisément celui où la page remonte sa branche de
     * chargement — ses trois requêtes sont user-scopées (`answerId`+`me.id`),
     * leurs clés changent, `isLoading` repasse à vrai et la carte est DÉMONTÉE.
     * Un `useState` local partait avec elle, et le rejeu n'arrivait jamais.
     */
    postLoginIntent: PostLoginIntent | null;
    /** Pose l'intention (au clic) ou la consomme (`null`, au rejeu). */
    onPostLoginIntent: (intent: PostLoginIntent | null) => void;
    /**
     * `full` (défaut) : réactions et carte « Financement participatif ».
     * `hero` : « Financement réuni » et colonne des boutons, sans réactions (placées par la vue).
     */
    layout?: "full" | "hero";
    /** `hero` : en tête de la colonne des boutons, au-dessus de « Soutenir ». */
    secondaryAction?: ReactNode;
}

export function CommunFinancingCard({
    formData: _formData,
    answerQuery,
    aacConfig,
    funding,
    onFunded,
    postLoginIntent,
    onPostLoginIntent,
    layout = "full",
    secondaryAction,
}: CommunFinancingCardProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { me } = useCocolight();
    const { openLogin } = useAuthModal();
    const answerId = answerQuery ? getEntityId(answerQuery) : undefined;

    const fundButtonRef = useRef<HTMLButtonElement>(null);

    // Hors connexion : ouvre la connexion et confie l'intention à la page, rejouée par l'effet ci-dessous.
    const requireConnected = (intent: PostLoginIntent): boolean => {
        if (me?.isConnected) return true;
        openLogin({ onSuccess: () => onPostLoginIntent(intent) });
        return false;
    };

    // Rejoue « financer » après connexion : clic sur le déclencheur (non contrôlé) de la cagnotte.
    useEffect(() => {
        if (postLoginIntent?.kind !== "fund" || !me?.isConnected) return;
        onPostLoginIntent(null);
        fundButtonRef.current?.click();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ne rejoue que sur l'arrivée de la session ou d'une intention
    }, [postLoginIntent, me?.isConnected]);

    const { context: fundingContext, formId: fundingFormId } = useCommunFundingContext(answerQuery);
    const { hostEntity: fundingHost } = useCommunFundingHost(fundingContext);

    // L'étape RÉSOLUE par la page (`config.roles.depenseStepKey`), jamais
    // `aapStep1` en dur : `useAacFundingResource` lit déjà cette étape pour
    // `funding`, et un appel dont `depense` vit ailleurs se contredisait — en-tête
    // à 30 %, mais zéro palier et zéro cofinanceur.
    const { data: depenses } = useCommunRawDepenses(answerId, aacConfig?.roles?.depenseStepKey ?? undefined);
    const items = buildItemsFromRawDepenses(depenses ?? [], funding?.items ?? []);
    const openItems = items.filter((item) => item?.status !== "close");

    const resourceFinancedAmount = toSafeInt(funding?.resourceFinancedAmount) || openItems.reduce((sum, item) => sum + toSafeInt(item.currentFunding), 0);
    const resourceTotalAmount = toSafeInt(funding?.resourceTotalAmount) || openItems.reduce((sum, item) => sum + toSafeInt(item.price), 0);
    const resourceRemainingAmount = Math.max(resourceTotalAmount - resourceFinancedAmount, 0);
    const resourceAmountPerc = resourceTotalAmount > 0 ? Math.min(toSafeInt((resourceFinancedAmount / resourceTotalAmount) * 100), 100) : 0;

    // Le MÊME ensemble que les lignes de `CommunCofinancersTable` : `new Set(financerId)`
    // comptait `undefined` pour une entrée quand la table, elle, écartait ces lignes.
    const cofinancerCount = aggregateCofinancers(items).length;

    // Stats d'actions — seulement pertinent une fois la proposition promue en
    // projet (cf. `canManageObjectiveActions`, même règle que CommunActionsSection).
    const isProjectPhase = canManageObjectiveActions(funding?.projectId);
    const allActions = uniqueActionRows(items).map(({ action }) => action);
    const doneActionsCount = allActions.filter((action) => action?.status === "done").length;
    const totalActionsCount = allActions.length;
    const actionsPerc = totalActionsCount > 0 ? Math.round((doneActionsCount / totalActionsCount) * 100) : 0;

    // Lien vers une section ; l'interface décide comment y mener (`useCommunSectionNav`).
    const showSection = useShowSection();
    const sectionLink = (sectionId: string) => ({
        onClick: () => showSection(sectionId),
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                showSection(sectionId);
            }
        },
    });

    // Non connecté : la connexion s'ouvre à la place de la cagnotte.
    // `preventDefault()` retient le handler du `DialogTrigger` — Radix ne joue
    // pas le sien sur un événement déjà traité.
    const handleFundClick = (e: MouseEvent<HTMLButtonElement>) => {
        if (!requireConnected({ kind: "fund" })) e.preventDefault();
    };
    const canFund = resourceRemainingAmount > 0;

    /** Déclencheur de la cagnotte du commun, propre à chaque mise en page. */
    const renderFundTrigger = (trigger: ReactNode) => (
        <CagnotteDialog
            totalAmount={resourceFinancedAmount}
            defaultResourceId={answerId}
            onRefresh={onFunded}
            openContext={{
                resourceId: answerId,
                hideResourceSelect: true,
                hostEntity: fundingHost,
                resource: funding ?? undefined,
                envelopeForm: fundingFormId ? { id: fundingFormId, answerId } : null,
            }}
        >
            {trigger}
        </CagnotteDialog>
    );

    if (layout === "hero") {
        return (
            <div className="grid gap-6 md:grid-cols-12">
                <div className="min-w-0 rounded-xl border border-border bg-card p-5 md:col-span-7">
                    {/* Montant et jauge mènent aux besoins financiers. */}
                    <div
                        className="-m-1 cursor-pointer rounded-md p-1 transition-colors hover:bg-muted/60"
                        {...sectionLink("besoins-financiers")}
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <span className="text-sm text-muted-foreground">{String(t("detail.financing.raised"))}</span>
                            <span className="font-display text-2xl font-semibold tabular-nums">
                                {formatCurrency(resourceFinancedAmount)}{" "}
                                <span className="text-sm font-normal text-muted-foreground">
                                    {String(t("detail.financing.outOf", undefined, { amount: formatCurrency(resourceTotalAmount) }))}
                                </span>
                            </span>
                        </div>
                        <Progress value={resourceAmountPerc} className="mt-3" />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        <button
                            type="button"
                            onClick={() => showSection("cofinanceurs")}
                            className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline"
                        >
                            {String(
                                t(
                                    cofinancerCount > 1
                                        ? "detail.financing.cofinancersCount_other"
                                        : "detail.financing.cofinancersCount_one",
                                    undefined,
                                    { count: cofinancerCount },
                                ),
                            )}
                        </button>
                        {" · "}
                        {String(t("detail.financing.remainingToFund", undefined, { amount: formatCurrency(resourceRemainingAmount) }))}
                    </p>
                </div>
                <div className="flex flex-col gap-2 md:col-span-5">
                    {secondaryAction}
                    {renderFundTrigger(
                        <Button ref={fundButtonRef} type="button" disabled={!canFund} onClick={handleFundClick}>
                            {canFund ? String(t("detail.financing.support")) : String(t("detail.financing.goalReached"))}
                        </Button>,
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="lg:col-span-5 relative">
            <div className="lg:col-span-5 mb-6">
                <CommunReactionStats
                    answerQuery={answerQuery}
                    aacConfig={aacConfig}
                    postLoginIntent={postLoginIntent}
                    onPostLoginIntent={onPostLoginIntent}
                    className="grid grid-cols-3 gap-4 border-border"
                />
            </div>

            <div className="bg-surface p-6 sm:p-8 rounded-xl border border-border ring-1 ring-inset ring-white/5">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display font-bold text-lg">{String(t("detail.financing.title"))}</h3>
                </div>

                <div className="space-y-6">
                    <div
                        className="-m-1 flex cursor-pointer items-end justify-between gap-4 rounded-md p-1 transition-colors hover:bg-surface-2/50"
                        {...sectionLink("besoins-financiers")}
                    >
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
                        <div
                            className="cursor-pointer rounded-md border border-border bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-surface-2/50"
                            {...sectionLink("cofinanceurs")}
                        >
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

                    {isProjectPhase && (
                        <div
                            className="group p-3 rounded-md bg-background/50 border border-border cursor-pointer transition-colors hover:border-primary/40 hover:bg-surface-2/50"
                            {...sectionLink("objectifs")}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-baseline gap-1.5 min-w-0">
                                    <span className="font-display font-bold text-foreground text-base tabular-nums">
                                        {doneActionsCount}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        / {totalActionsCount} {String(t("detail.actionsStat"))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-primary">
                                    <span className="text-xs font-display font-bold tabular-nums">{actionsPerc}%</span>
                                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </div>
                            <Progress value={actionsPerc} className="mt-2 h-1.5 bg-background border border-border" />
                        </div>
                    )}

                    {renderFundTrigger(
                        <button
                            ref={fundButtonRef}
                            type="button"
                            disabled={!canFund}
                            onClick={handleFundClick}
                            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md transition-all shadow-[0_0_30px_-8px] shadow-primary/60 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <Heart className="size-4" />
                            {canFund ? String(t("detail.financing.cta")) : String(t("detail.financing.goalReached"))}
                            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>,
                    )}
                </div>
            </div>
        </div>
    );
}
