/**
 * Hook d'abstraction qui transforme les données sources (projets/milestones ou propositions/dépenses)
 * en un modèle de données agnostique et unifié.
 */
import { useMemo } from "react";
import {
    CagnotteResource,
    CagnotteTypeConfig,
    FundingAction,
    FundingEnvelopeNormalizedData,
    FundingTransaction,
    Pledge
} from "../types";
import { OrgProject } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers.ts";
import {useUserAdminOrganizations} from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { isUser } from "@/lib/getTypedEntity";
import type { User } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import {toSafeInt} from "@/modules/cagnotte/utils/dataTransform.ts";

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

interface RawProposition {
    id: string;
    projectId?: string;
    titre?: string;
    totalFinancement?: number | string;
    totalCouts?: number | string;
    depenses?: RawDepense[];
}

// Typage sécurisé pour étendre les jalons de l'API
interface ExtendedProjectMilestone {
    milestoneId: string | number;
    name?: string;
    description?: string;
    price?: number | string;
    status?: string;
    currentFunding?: number;
    transactions?: FundingTransaction[];
}

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

export const getUserFunding = (
    transactions: Array<any>,
    orgsId: string[],
    userId?: string
): FundingTransaction[] => {
    if (!Array.isArray(transactions)){
        return [];
    }
    return transactions.map((fund, index) => {
        fund["fundingIndex"] = index;
        fund["financerName"] = fund.name;
        fund["financerId"] = fund.id;
        return fund;
    }).filter(fund => orgsId.indexOf(fund.id) > -1 || fund.id === userId);
};

export function useCagnotteAdapter(
    fundingEnvelope: FundingEnvelopeNormalizedData | null | undefined,
    allProjects: OrgProject[],
    config: CagnotteTypeConfig,
    selectedId: string,
) {
    const {me} = useCocolight();
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const userAdminOrganizations = useUserAdminOrganizations(currentUserEntity, {});

    return useMemo(() => {
        const rawEnvelopeTypeAssertion = fundingEnvelope?.rawEnvelope as { projects?: RawProposition[] } | undefined;
        const rawProjects = rawEnvelopeTypeAssertion?.projects || [];
        const orgsIds =  userAdminOrganizations?.map(user => user.id);

        let resources: CagnotteResource[] = [];

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
                    const milestoneExtended = m as ExtendedProjectMilestone;
                    const { currentFunding, unpaidFunding, userPledge } = calculateFundingStatus(
                        milestoneExtended.transactions as Array<FundingTransaction & { method?: string }>,
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
                        actions: matchedDepense?.depense?.actions ?? [],
                        currentFunding,
                        unpaidFunding,
                        userPledge,
                        funding: getUserFunding((matchedDepense?.depense?.financer || []),orgsIds,me?.serverData?.id)
                    };
                });

                return {
                    fromType: config.selectorType,
                    id: projectIdStr,
                    name: projet.name ?? "",
                    projectId: projectIdStr,
                    answerId: projet.answerId ?? "",
                    resourceTotalAmount: Number(projet.cagnotteTargetAmount) || 0,
                    resourceFinancedAmount: Number(projet.cagnotteTotalAmount) || 0,
                    items,
                };
            });
        }
        else if (config.selectorType === "proposition") {
            resources = rawProjects.map((proposition: RawProposition) => {
                const items = (proposition?.depenses || []).map((d: RawDepense, index: number) => {

                    const { currentFunding, unpaidFunding, userPledge  } = calculateFundingStatus(
                        d.financer as Array<FundingTransaction & { method?: string }> | [],
                        0,
                        orgsIds,
                        me?.serverData?.id
                    );

                    return {
                        fromType: "depense" as const,
                        itemId: d.id ? String(d.id) : String(index),
                        milestoneId: d.milestone ?? "",
                        depenseIndex: index,
                        name: d.poste ?? "",
                        description: d.description ?? "",
                        price: Number(d.priceInt) || 0,
                        status: d.include !== false ? "open" : "close",
                        actions: d.actions ?? [],
                        currentFunding,
                        unpaidFunding,
                        userPledge,
                        funding: getUserFunding((d?.financer || []),orgsIds,me?.serverData?.id)
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
        return { resources, savedSelectedResource };
    }, [fundingEnvelope, allProjects, config.selectorType, selectedId, me?.serverData?.id, userAdminOrganizations]);
}

export function computePledgesFromResources(resources: CagnotteResource[]): Pledge[] {

    return resources.flatMap((resource) =>
        (resource.items ?? [])
            .filter((item) => item.userPledge > 0)
            .flatMap((item) =>
                item.funding
                    .filter((fund) => fund?.fundingType !== "prepaid")
                    .map((fund) => ({
                        id: `${resource.id}-${item.itemId}-${fund.fundingIndex}`,
                        resourceId: resource.answerId,
                        resourceName: resource.name,
                        depenseIndex: item.depenseIndex,
                        depenseName: item.name,
                        fundingIndex: fund.fundingIndex,
                        fundingAmount: toSafeInt(fund.amount),
                        financerId: fund.financerId || "unknown_id",
                        financerName: fund.financerName,
                        userPledge: item.userPledge,
                        userfundingPledge: item.funding,
                    }))
            )
    );
}