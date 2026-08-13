/**
 * Hook d'abstraction qui transforme les données sources (projets/milestones ou propositions/dépenses)
 * en un modèle de données agnostique et unifié.
 */
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    CagnotteResource,
    CagnotteTypeConfig,
    FundingAction,
    FundingEnvelopeNormalizedData,
    FundingTransaction,
    Pledge
} from "../types";
import { OrgProject } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers.ts";
import { useUserAdminOrganizations } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { isUser } from "@/lib/getTypedEntity";
import type { User } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { asRecord, getServerData, toArray, toNumber } from "@/modules/cagnotte/utils/dataTransform.ts";
import { generateMilestoneId } from "@/modules/cagnotte/utils/idGeneration";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { appendProjectMilestone, updateAnswerDepenseFields } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";

interface RawDepense {
    id?: string | number;
    milestone?: string;
    poste?: string;
    description?: string;
    priceInt?: number | string;
    include?: boolean;
    actions?: FundingAction[];
    financer?: Array<FundingTransaction & { method?: string }>;
}

interface RawAction {
    id?: string;
    milestone?: { milestoneId?: string } | null;
    links?: { contributors?: Record<string, unknown> };
    [key: string]: unknown;
}

interface RawProposition {
    id: string;
    projectId?: string;
    titre?: string;
    totalFinancement?: number | string;
    totalCouts?: number | string;
    depenses?: RawDepense[];
    actions?: RawAction[];
}

export const findMetadataById = (id?: string, links?: any) => {
    if (!links || !id) return null;

    for (const typeKey in links) {
        if (links[typeKey] && links[typeKey][id]) {
            return links[typeKey][id];
        }
    }
    return null;
};

export const calculateFundingStatus = (
    transactions: FundingTransaction[],
    fallbackCurrent: number,
    orgsId: string[],
    userId?: string
): { currentFunding: number; unpaidFunding: number; userPledge: number } => {
    if (!transactions || !transactions.length) {
        return { currentFunding: fallbackCurrent, unpaidFunding: 0, userPledge: 0 };
    }
    return transactions.reduce((acc, t) => {
        const amount = Number(t.amount) || 0;

        const isUnpaid = t.fundingType !== "prepaid" || (t.paymentStatus as string) === "unpaid";

        if (isUnpaid) {
            acc.unpaidFunding += amount;
            if(t.id === userId || orgsId.indexOf(t.id) > -1 ){
                acc.userPledge += amount;
            }
        }
        acc.currentFunding += amount;
        return acc;
    }, { currentFunding: 0, unpaidFunding: 0, userPledge: 0});
}

function enrichActionContributors(action: any, globalLinks: any) {
    const contributorsLinks = action.links?.contributors || {};

    const contributorsRecord = Object.fromEntries(
        Object.entries(contributorsLinks).map(([contribId, contribData]: [string, any]) => {
            const collectionType = contribData.type;
            const metadata = globalLinks?.[collectionType]?.[contribId] ?? null;

            return [
                contribId,
                {
                    profilThumbImageUrl: metadata?.profilThumbImageUrl || "",
                    name: metadata?.name || "",
                    ...contribData
                }
            ];
        })
    );

    return {
        ...action,
        links: {
            ...action.links,
            contributors: contributorsRecord
        }
    };
}

/**
 * Financeur tel qu'il arrive de l'API, avant l'enrichissement fait ci-dessous :
 * il porte `name` là où une FundingTransaction porte `financerName`, et les
 * champs dérivés (`financerName`, `financerId`, `fundingIndex`) n'existent pas
 * encore. D'où leur caractère optionnel ici.
 */
type RawFinancer = Omit<FundingTransaction, "financerName"> & {
    name?: string;
    financerName?: string;
    method?: string;
};

export const getUserFunding = (
    transactions: RawFinancer[],
    orgsId: string[],
    userId?: string
): FundingTransaction[] => {
    if (!Array.isArray(transactions)){
        return [];
    }
    // Enrichissement en place, volontairement conservé : les objets renvoyés
    // sont ceux de l'enveloppe brute, et d'autres lectures s'appuient dessus.
    return transactions.map((fund, index) => {
        fund.fundingIndex = index;
        fund.financerName = fund.name;
        fund.financerId = fund.id;
        return fund;
    }).filter(fund => orgsId.indexOf(fund.id) > -1 || fund.id === userId) as FundingTransaction[];
};

function buildDepenseFundingData(
    depense: RawDepense | undefined,
    globalLinks: any,
    fallbackCurrentFunding: number,
    orgsIds: string[],
    userId?: string
) {
    const rawFinancers = (depense?.financer || []) as Array<FundingTransaction & { method?: string }>;
    const enrichedFinancers = rawFinancers.map(fund => ({
        ...fund,
        metadata: findMetadataById(fund.id, globalLinks)
    }));

    const rawActions = depense?.actions ?? [];
    const enrichedActions = rawActions.map((action: any) => enrichActionContributors(action, globalLinks));

    const { currentFunding, unpaidFunding, userPledge } = calculateFundingStatus(
        enrichedFinancers,
        fallbackCurrentFunding,
        orgsIds,
        userId
    );

    return { enrichedFinancers, enrichedActions, currentFunding, unpaidFunding, userPledge };
}

/** Dépense côté projet sans milestone rattaché */
interface PendingMilestoneRepair {
    projectId: string;
    answerId: string;
    milestoneId: string;
    name: string;
    description: string;
    depenseIndex: number;
}

const inFlightMilestoneRepairs = new Set<string>();

function resolveOrGenerateMilestoneId(
    milestoneIdStr: string,
    projectMilestoneIds: Set<string>,
    generatedMilestoneIds: string[]
): { isOrphan: boolean; resolvedId: string } {
    if (milestoneIdStr && projectMilestoneIds.has(milestoneIdStr)) {
        return { isOrphan: false, resolvedId: milestoneIdStr };
    }
    const resolvedId = milestoneIdStr || generateMilestoneId([...projectMilestoneIds, ...generatedMilestoneIds]);
    generatedMilestoneIds.push(resolvedId);
    return { isOrphan: true, resolvedId };
}

export function useCagnotteAdapter(
    fundingEnvelope: FundingEnvelopeNormalizedData | null | undefined,
    allProjects: OrgProject[],
    config: CagnotteTypeConfig,
    selectedId: string,
) {
    const {me, api} = useCocolight();
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const userAdminOrganizations = useUserAdminOrganizations(currentUserEntity, {});
    const queryClient = useQueryClient();

    const {resources, savedSelectedResource, pendingMilestoneRepairs} = useMemo(() => {
        const rawEnvelopeTypeAssertion = fundingEnvelope?.rawEnvelope as { projects?: RawProposition[], links?: any } | undefined;
        const rawProjects = rawEnvelopeTypeAssertion?.projects || [];
        const globalLinks = rawEnvelopeTypeAssertion?.links || {};

        const orgsIds = userAdminOrganizations?.map(user => user.id);

        let resources: CagnotteResource[] = [];
        const pendingMilestoneRepairs: PendingMilestoneRepair[] = [];

        if (config.selectorType === "project") {
            const rawProjectsMap = rawProjects.reduce<Record<string, RawProposition>>((acc, p) => {
                if (p.projectId) acc[p.projectId] = p;
                return acc;
            }, {});

            resources = (allProjects || []).map((projet: OrgProject) => {
                const projectIdStr = String(projet.id);
                const propositionMatch = rawProjectsMap[projectIdStr];
                const depenses = propositionMatch?.depenses || [];

                const depensesByMilestone = depenses.reduce<Record<string, { depense: RawDepense; index: number }>>((acc, d, idx) => {
                    if (d.milestone) acc[d.milestone] = { depense: d, index: idx };
                    return acc;
                }, {});

                const items = (projet?.milestones || []).map(m => {
                    const milestoneIdStr = String(m.milestoneId);
                    const matchedDepense = depensesByMilestone[milestoneIdStr];

                    const { enrichedFinancers, enrichedActions, currentFunding, unpaidFunding, userPledge } = buildDepenseFundingData(
                        matchedDepense?.depense,
                        globalLinks,
                        typeof m.currentFunding === "number" ? m.currentFunding : 0,
                        orgsIds,
                        me?.serverData?.id
                    );

                    return {
                        fromType: "milestone" as const,
                        itemId: milestoneIdStr,
                        milestoneId: milestoneIdStr,
                        depenseIndex: matchedDepense?.index ?? -1,
                        name: m.name ?? "",
                        description: m.description ?? "",
                        price: Number(m.price) || 0,
                        status: m?.status ?? "open",
                        actions: enrichedActions,
                        currentFunding,
                        unpaidFunding,
                        userPledge,
                        funding: getUserFunding(enrichedFinancers, orgsIds, me?.serverData?.id),
                        allFunding: enrichedFinancers
                    };
                });

                const projectMilestoneIds = new Set((projet?.milestones || []).map(m => String(m.milestoneId)));
                const generatedMilestoneIds: string[] = [];

                const orphanItems = depenses.reduce<typeof items>((acc, d, idx) => {
                    const milestoneIdStr = d.milestone ? String(d.milestone) : "";
                    const { isOrphan, resolvedId: generatedMilestoneId } = resolveOrGenerateMilestoneId(
                        milestoneIdStr,
                        projectMilestoneIds,
                        generatedMilestoneIds
                    );
                    if (!isOrphan) return acc;

                    const { enrichedFinancers, enrichedActions, currentFunding, unpaidFunding, userPledge } = buildDepenseFundingData(
                        d,
                        globalLinks,
                        0,
                        orgsIds,
                        me?.serverData?.id
                    );

                    acc.push({
                        fromType: "milestone" as const,
                        itemId: generatedMilestoneId,
                        milestoneId: generatedMilestoneId,
                        depenseIndex: idx,
                        name: d.poste ?? "",
                        description: d.description ?? "",
                        price: Number(d.priceInt) || 0,
                        status: d.include !== false ? "open" : "close",
                        actions: enrichedActions,
                        currentFunding,
                        unpaidFunding,
                        userPledge,
                        funding: getUserFunding(enrichedFinancers, orgsIds, me?.serverData?.id),
                        allFunding: enrichedFinancers
                    });

                    if (projet.answerId) {
                        pendingMilestoneRepairs.push({
                            projectId: projectIdStr,
                            answerId: projet.answerId,
                            milestoneId: generatedMilestoneId,
                            name: d.poste ?? "",
                            description: d.description ?? "",
                            depenseIndex: idx,
                        });
                    }

                    return acc;
                }, []);

                return {
                    fromType: config.selectorType,
                    id: projectIdStr,
                    name: projet.name ?? "",
                    projectId: projectIdStr,
                    answerId: projet.answerId ?? "",
                    resourceTotalAmount: Number(projet.cagnotteTargetAmount) || 0,
                    resourceFinancedAmount: Number(projet.cagnotteTotalAmount) || 0,
                    items: [...items, ...orphanItems],
                };
            });
        }
        else if (config.selectorType === "proposition") {
            resources = rawProjects.map((proposition: RawProposition) => {
                const projectData = getServerData(proposition);
                const projectRecord = getServerData(projectData.project);
                const hasLinkedProject = Object.keys(projectRecord).length > 0;
                const projectMilestonesRaw = toArray<{ milestoneId?: string }>(asRecord(projectRecord.oceco).milestones);
                const projectMilestoneIds = new Set(
                    projectMilestonesRaw.map(m => String(m.milestoneId ?? "")).filter(id => id !== "")
                );
                const generatedMilestoneIds: string[] = [];

                const items = (proposition?.depenses || []).map((d: RawDepense, index: number) => {

                    const rawFinancers = (d.financer || []) as Array<FundingTransaction & { method?: string }>;
                    const enrichedFinancers = rawFinancers.map(fund => ({
                        ...fund,
                        metadata: findMetadataById(fund.id, globalLinks)
                    }));

                    const { currentFunding, unpaidFunding, userPledge  } = calculateFundingStatus(
                        enrichedFinancers,
                        0,
                        orgsIds,
                        me?.serverData?.id
                    );

                    const filteredActions = proposition.projectId && typeof d?.milestone === "string" && d?.milestone !== ""
                        ? (proposition.actions || []).filter(action => action?.milestone?.milestoneId === d.milestone )
                        : [];

                    const enrichedActions = filteredActions.map((action: any) => enrichActionContributors(action, globalLinks));

                    let resolvedMilestoneId = d.milestone ?? "";
                    if (proposition.projectId && hasLinkedProject) {
                        const milestoneIdStr = d.milestone ? String(d.milestone) : "";
                        const { isOrphan, resolvedId } = resolveOrGenerateMilestoneId(
                            milestoneIdStr,
                            projectMilestoneIds,
                            generatedMilestoneIds
                        );
                        resolvedMilestoneId = resolvedId;

                        if (isOrphan) {
                            pendingMilestoneRepairs.push({
                                projectId: proposition.projectId,
                                answerId: String(proposition.id),
                                milestoneId: resolvedId,
                                name: d.poste ?? "",
                                description: d.description ?? "",
                                depenseIndex: index,
                            });
                        }
                    }

                    return {
                        fromType: "depense" as const,
                        itemId: d.id ? String(d.id) : String(index),
                        milestoneId: resolvedMilestoneId,
                        depenseIndex: index,
                        name: d.poste ?? "",
                        description: d.description ?? "",
                        price: Number(d.priceInt) || 0,
                        status: d.include !== false ? "open" : "close",
                        actions: enrichedActions,
                        currentFunding,
                        unpaidFunding,
                        userPledge,
                        funding: getUserFunding(enrichedFinancers, orgsIds, me?.serverData?.id),
                        allFunding: enrichedFinancers
                    };
                });

                return {
                    fromType: config.selectorType,
                    id: String(proposition.id),
                    name: proposition.titre ?? "",
                    projectId: proposition.projectId ?? "",
                    answerId: String(proposition.id),
                    resourceTotalAmount: Number(proposition.totalCouts) || 0,
                    resourceFinancedAmount: Number(proposition.totalFinancement) || 0,
                    items,
                };
            });
        }

        const savedSelectedResource = resources.find(t => t.id === selectedId);
        resources = resources.filter(re => re.name !== "");
        return { resources, savedSelectedResource, pendingMilestoneRepairs };
    }, [fundingEnvelope, allProjects, config.selectorType, selectedId, me?.serverData?.id, userAdminOrganizations]);

    useEffect(() => {
        if (!api || pendingMilestoneRepairs.length === 0) return;

        pendingMilestoneRepairs.forEach((repair) => {
            const repairKey = `${repair.answerId}:${repair.depenseIndex}:${repair.milestoneId}`;
            if (inFlightMilestoneRepairs.has(repairKey)) return;
            inFlightMilestoneRepairs.add(repairKey);

            (async () => {
                try {
                    const [project, answer] = await Promise.all([
                        api.project({id: repair.projectId}),
                        api.answer({id: repair.answerId}),
                    ]);

                    await appendProjectMilestone({
                        project,
                        milestone: {
                            milestoneId: repair.milestoneId,
                            name: repair.name,
                            description: repair.description,
                            status: "open",
                        },
                    });
                    await updateAnswerDepenseFields({
                        answer,
                        index: repair.depenseIndex,
                        fields: {milestone: repair.milestoneId},
                    });

                    void queryClient.invalidateQueries({queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE_PREFIX()});
                } catch (error) {
                    inFlightMilestoneRepairs.delete(repairKey);
                    console.error("useCagnotteAdapter: échec de la génération auto du milestone projet pour une dépense orpheline", error);
                }
            })();
        });
    }, [pendingMilestoneRepairs, api, queryClient]);

    return {resources, savedSelectedResource};
}

export function computePledgesFromResources(resources: CagnotteResource[], userId?: string, orgsIds: string[] = []): Pledge[] {

    return resources.flatMap((resource) =>
        (resource.items ?? [])
            .flatMap((item) =>
                item.funding
                    .filter((fund) => fund?.fundingType !== "prepaid" && (fund.financerId === userId || orgsIds.includes(fund.financerId || "")))
                    .map((fund) => ({
                        id: `${resource.id}-${item.itemId}-${fund.fundingIndex}`,
                        resourceId: resource.answerId,
                        resourceName: resource.name,
                        depenseIndex: item.depenseIndex,
                        depenseName: item.name,
                        fundingIndex: fund.fundingIndex,
                        fundingAmount: toNumber(fund.amount),
                        financerId: fund.financerId || "unknown_id",
                        financerName: fund.financerName,
                        userPledge: item.userPledge,
                        userfundingPledge: item.funding,
                    }))
            )
    );
}