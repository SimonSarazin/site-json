import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CoFormAnswer } from "@/modules/coform/types";
import type { AacResolvedConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { useAuthModal } from "@/modules/auth";
import { ClientOnly } from "@/components/layout/ClientOnly";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import {
    useCommunReactions,
    getCommunReactionState,
    type CommunReactionType,
} from "@/modules/aac/hooks/useCommunReactions";
import { useReactorNames } from "@/modules/aac/hooks/useReactorNames";
import { useShowSection } from "@/modules/aac/hooks/useCommunSectionNav";
import { useAacPlaceSourceKeys, useAacUsageFormId } from "@/modules/aac/hooks/useAacDetailSections";
import { AAC_QUERY_KEYS } from "@/modules/aac/constants/queryKeys";
import { useCoFormQuery } from "@/modules/coform/hooks/useCoFormQuery";
import { getSharedFinderInfo } from "@/modules/coform/utils/formParser";
import { buildFinderSearchParams } from "@/modules/coform/utils/finderFilters";
import type { PostLoginIntent } from "./CommunFinancingCard.tsx";

/** Organisation issue de `searchCostum` (`res.serverData`), réduite aux champs lus. */
interface OrganisationCofinanceuse {
    _id?: { $id?: string };
    id?: string;
    name?: string;
}

/** Sans form d'usage exploitable : des organisations, filtrées par le seul périmètre des lieux. */
const SANS_FINDER = { type: "organizations" as const, filters: [], excludeFilters: [], notSourceKey: false };

const AUCUNE_ORGANISATION: OrganisationCofinanceuse[] = [];

interface StatProps {
    value: string | number;
    label: string;
    cta?: string;
    activeLabel?: string;
    active?: boolean;
    pending?: boolean;
    onToggle?: () => void;
    /** Clic sur la valeur (pas le CTA) : mène à une autre section. */
    onValueClick?: () => void;
    /** Tooltip au survol de la valeur ; absent ⇒ pas de tooltip. */
    namesTooltip?: ReactNode;
    /** Ouverture du tooltip : déclenche le chargement des noms. */
    onTooltipOpen?: () => void;
    /** Chiffre plus petit, libellé sans capitales. */
    compact?: boolean;
}

function Stat({ value, label, cta, activeLabel, active, pending, onToggle, onValueClick, namesTooltip, onTooltipOpen, compact }: StatProps) {
    const valueBlock = (
        <div
            className={onValueClick ? "-m-1 cursor-pointer rounded-md p-1 transition-colors hover:bg-surface-2/50" : undefined}
            onClick={onValueClick}
            role={onValueClick ? "button" : undefined}
            tabIndex={onValueClick ? 0 : undefined}
            onKeyDown={
                onValueClick
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onValueClick();
                          }
                      }
                    : undefined
            }
        >
            <div
                className={
                    compact
                        ? "text-xl font-display font-semibold tabular-nums"
                        : "text-2xl font-display font-bold tabular-nums sm:text-3xl"
                }
            >
                {value}
            </div>
            <div
                className={
                    compact
                        ? "truncate text-xs text-muted-foreground"
                        : "mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground"
                }
            >
                {label}
            </div>
        </div>
    );

    return (
        <div className="min-w-0">
            {namesTooltip ? (
                <Tooltip onOpenChange={(open) => { if (open) onTooltipOpen?.(); }}>
                    <TooltipTrigger asChild>{valueBlock}</TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px]">
                        {namesTooltip}
                    </TooltipContent>
                </Tooltip>
            ) : (
                valueBlock
            )}
            {cta && onToggle && (
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
            )}
        </div>
    );
}

/** Liste (plafonnée) des noms de réacteurs affichée dans le tooltip d'une stat. */
function namesTooltipContent(names: string[], isLoading: boolean, loadingLabel: string, emptyLabel: string): ReactNode {
    if (names.length === 0 && isLoading) return <span>{loadingLabel}</span>;
    if (names.length === 0) return <span>{emptyLabel}</span>;
    const visible = names.slice(0, 8);
    const overflow = names.length - visible.length;
    return (
        <div className="space-y-0.5">
            {visible.map((name, i) => (
                <div key={`${name}-${i}`}>{name}</div>
            ))}
            {overflow > 0 && <div className="opacity-70">+{overflow}</div>}
        </div>
    );
}

interface CommunReactionStatsProps {
    answerQuery: CoFormAnswer | null;
    aacConfig: AacResolvedConfig | null;
    /** Intention portée par la page ; seules les réactions sont rejouées ici. */
    postLoginIntent: PostLoginIntent | null;
    onPostLoginIntent: (intent: PostLoginIntent | null) => void;
    /** Stats resserrées (héros d'une interface). */
    compact?: boolean;
    /** Classes du conteneur des trois stats. */
    className?: string;
}

/** Les trois réactions d'un commun (contribuer, s'intéresser, utiliser), leurs compteurs et leurs CTA. */
export function CommunReactionStats({
    answerQuery,
    aacConfig,
    postLoginIntent,
    onPostLoginIntent,
    compact,
    className = "grid grid-cols-3 gap-4",
}: CommunReactionStatsProps) {
    useLoadNamespace("modules/aac");
    const t = useT("modules/aac");
    const { me, entity } = useCocolight();
    const { openLogin } = useAuthModal();
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
    const usageFormId = useAacUsageFormId();
    const placeSourceKeys = useAacPlaceSourceKeys(aacConfig?.typeCoFinancer);
    const { formData: usageForm, error: usageFormError } = useCoFormQuery({
        formId: usageFormId ?? "",
        enabled: !!usageFormId && isModalOpen,
    });
    const usageFinder = useMemo(() => (usageForm ? getSharedFinderInfo(usageForm) : null), [usageForm]);
    const usageFormPending = !!usageFormId && !usageForm && !usageFormError;
    // Organisations « intéressées » (links.tls), mises à jour localement après chaque réaction.
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

    const orgSearchParams = useMemo<Partial<GlobalAutocompleteCostumData>>(() => {
        const params = buildFinderSearchParams({
            ...(usageFinder ?? SANS_FINDER),
            sourceKey: placeSourceKeys,
        });
        return { ...params, searchType: params.searchType as GlobalAutocompleteCostumData["searchType"] };
    }, [usageFinder, placeSourceKeys]);

    // Liste relue à chaque ouverture, une fois le form d'usage résolu.
    const orgsQuery = useQuery({
        queryKey: AAC_QUERY_KEYS.COFINANCER_ORGS(entity?.id ?? null, orgSearchParams),
        enabled: isModalOpen && !!entity && !usageFormPending,
        staleTime: 0,
        queryFn: async (): Promise<OrganisationCofinanceuse[]> => {
            if (!entity) return [];
            if (usageFormId && !usageFinder) {
                console.warn(
                    `[CommunReactionStats] form d'usage ${usageFormId} illisible ou sans finder partagé — périmètre ${placeSourceKeys.join(", ")} seul.`,
                );
            }
            const result = await entity.searchCostum(orgSearchParams);
            return result?.results ? Object.values(result.results).map((res) => res?.serverData || {}) : [];
        },
    });
    const orgs = orgsQuery.data ?? AUCUNE_ORGANISATION;
    const isLoadingOrgs = usageFormPending || (!!entity && orgsQuery.isPending);

    const executeToggle = async (
        type: CommunReactionType,
        selectedOrg?: { id: string; name: string },
        forcedIsActivating?: boolean,
    ) => {
        if (pending || !answerId) return;
        setPending(type);

        // « interesse » bascule par organisation : le sens vient de l'appelant.
        const isActivating = forcedIsActivating ?? !reactions[type];

        setReactions((prev) => ({ ...prev, [type]: isActivating }));
        setLocalStats((prev) => ({ ...prev, [type]: prev[type] + (isActivating ? 1 : -1) }));

        let finalReactorId = me?.serverData?.id || me?.id;
        let finalReactorName = me?.serverData?.name;

        if (type === "interesse" && selectedOrg) {
            // L'organisation cliquée est la clé écrite ou retirée dans links.tls.
            finalReactorId = selectedOrg.id;
            finalReactorName = selectedOrg.name;

            // Coche optimiste dans la modale.
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
                // Échec : annule la coche optimiste.
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

    /** Hors connexion : ouvre la connexion et confie l'intention à la page. */
    const requireConnected = (intent: PostLoginIntent): boolean => {
        if (me?.isConnected) return true;
        openLogin({ onSuccess: () => onPostLoginIntent(intent) });
        return false;
    };

    const handleToggleClick = (type: CommunReactionType) => {
        if (!requireConnected({ kind: "reaction", type })) return;
        if (type === "interesse") {
            // Ouvre la modale ; la bascule se fait par organisation (`handleOrgClick`).
            setIsModalOpen(true);
            return;
        }
        executeToggle(type);
    };

    const handleOrgClick = (org: OrganisationCofinanceuse) => {
        const orgId = org._id?.$id || org.id || "";
        const isAlreadyInterested = interestedOrgIds.has(orgId);
        executeToggle("interesse", { id: orgId, name: org?.name || "" }, !isAlreadyInterested);
    };

    /** Rejoue une réaction demandée hors connexion ; le sens est relu dans la réponse. */
    useEffect(() => {
        if (postLoginIntent?.kind !== "reaction" || !me?.isConnected) return;
        onPostLoginIntent(null);
        if (postLoginIntent.type === "interesse") {
            handleToggleClick("interesse");
            return;
        }
        const alreadyActive = getCommunReactionState(answerQuery, me?.serverData?.id)[postLoginIntent.type];
        void executeToggle(postLoginIntent.type, undefined, !alreadyActive);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ne rejoue qu'à l'arrivée de la session ou d'une intention
    }, [postLoginIntent, me?.isConnected]);

    // Noms des réacteurs pour les tooltips, résolus au survol (`hoveredStat`).
    const [hoveredStat, setHoveredStat] = useState<CommunReactionType | null>(null);
    // `answerQuery` n'est pas relu après une bascule : le réacteur courant suit `reactions` (optimiste).
    const myReactorId = me?.serverData?.id || me?.id;
    const contributorIds = useMemo(() => {
        const ids = new Set(Object.keys(answerQuery?.links?.contributors || {}));
        if (myReactorId) {
            if (reactions.utilise) ids.add(myReactorId);
            else ids.delete(myReactorId);
        }
        return Array.from(ids);
    }, [answerQuery, reactions.utilise, myReactorId]);
    const voteIds = useMemo(() => {
        const ids = new Set(Object.keys(answerQuery?.vote || {}));
        if (myReactorId) {
            if (reactions.love) ids.add(myReactorId);
            else ids.delete(myReactorId);
        }
        return Array.from(ids);
    }, [answerQuery, reactions.love, myReactorId]);
    // « interesse » : noms lus dans links.tls ou dans la liste de la modale, selon `interestedOrgIds`.
    const tlsNames = useMemo(() => {
        const answerTls = (answerQuery?.links?.tls || {}) as Record<string, { name?: string }>;
        return Array.from(interestedOrgIds)
            .map((id) => {
                const name = answerTls[id]?.name;
                if (typeof name === "string" && name.trim() !== "") return name;
                const org = orgs.find((o) => (o?._id?.$id || o?.id) === id);
                return typeof org?.name === "string" ? org.name : undefined;
            })
            .filter((name): name is string => typeof name === "string" && name.trim() !== "");
    }, [answerQuery, interestedOrgIds, orgs]);
    const { names: contributorNames, isLoading: contributorNamesLoading } = useReactorNames(
        contributorIds,
        hoveredStat === "utilise",
    );
    const { names: voteNames, isLoading: voteNamesLoading } = useReactorNames(voteIds, hoveredStat === "love");

    const namesLoadingLabel = String(t("detail.namesLoading"));
    const namesUnavailableLabel = String(t("detail.namesUnavailable"));

    const showSection = useShowSection();

    // Les trois réactions, dans l'ordre d'affichage.
    const reactionStats: Array<StatProps & { key: CommunReactionType }> = [
        {
            key: "utilise",
            value: localStats.utilise,
            label: t("detail.contributors"),
            cta: t("detail.contribute"),
            activeLabel: t("detail.alreadyContributor"),
            active: reactions.utilise,
            pending: pending === "utilise",
            onToggle: () => handleToggleClick("utilise"),
            onValueClick: () => showSection("cofinanceurs"),
            onTooltipOpen: () => setHoveredStat("utilise"),
            namesTooltip:
                localStats.utilise > 0
                    ? namesTooltipContent(contributorNames, contributorNamesLoading, namesLoadingLabel, namesUnavailableLabel)
                    : undefined,
        },
        {
            key: "love",
            value: localStats.love,
            label: t("detail.votes"),
            cta: t("detail.vote"),
            activeLabel: t("detail.alreadyInterested"),
            active: reactions.love,
            pending: pending === "love",
            onToggle: () => handleToggleClick("love"),
            onTooltipOpen: () => setHoveredStat("love"),
            namesTooltip:
                localStats.love > 0
                    ? namesTooltipContent(voteNames, voteNamesLoading, namesLoadingLabel, namesUnavailableLabel)
                    : undefined,
        },
        {
            key: "interesse",
            value: localStats.interesse,
            label: t("detail.tls"),
            cta: t("detail.use"),
            active: reactions.interesse,
            pending: pending === "interesse",
            onToggle: () => handleToggleClick("interesse"),
            namesTooltip:
                localStats.interesse > 0
                    ? namesTooltipContent(tlsNames, false, namesLoadingLabel, namesUnavailableLabel)
                    : undefined,
        },
    ];

    const orgModal = isModalOpen && (
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
                            orgs.map((org: OrganisationCofinanceuse) => {
                                const orgId = org._id?.$id || org.id || "";
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
    );

    return (
        <>
            <div className={className}>
                {reactionStats.map(({ key, ...stat }) => (
                    <Stat key={key} {...stat} compact={compact} />
                ))}
            </div>
            {orgModal}
        </>
    );
}
