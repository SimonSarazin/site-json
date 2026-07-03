/**
 * Hook d'abstraction qui transforme les données sources (projets/milestones ou propositions/dépenses)
 * en un modèle de données agnostique et unifié.
 */
import { useMemo } from "react";
import {
    CagnotteResource,
    CagnotteTypeConfig, FundingAction,
    FundingEnvelopeNormalizedData,
    FundingTransaction
} from "../types";
import {OrgProject} from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers.ts";

interface RawDepense {
    id?: string | number;
    milestone?: string;
    poste?: string;
    description?: string;
    priceInt?: number | string;
    visible?: boolean;
    actions?: FundingAction[];
    financer?: FundingTransaction[];
}

interface RawProposition {
    id: string;
    projectId?: string;
    titre?: string;
    totalFinancement?: number | string;
    totalCouts?: number | string;
    depenses?: RawDepense[];
}

export function useCagnotteAdapter(
    fundingEnvelope: FundingEnvelopeNormalizedData | null | undefined,
    allProjects: OrgProject[],
    config: CagnotteTypeConfig,
    selectedId: string,
) {
    return useMemo(() => {
        let resources: CagnotteResource[] = [];
        let savedSelectedResource: CagnotteResource | undefined = undefined;

        const rawEnvelopeTypeAssertion = fundingEnvelope?.rawEnvelope as { projects?: RawProposition[] } | undefined;
        const rawProjects = rawEnvelopeTypeAssertion?.projects || [];

        if (config.selectorType === "project") {
            resources = (allProjects || []).map((projet: OrgProject) => {

                const propositionMatch = rawProjects.find(
                    (p: RawProposition) => p.projectId === String(projet.id)
                );
                const depenses = propositionMatch?.depenses || [];

                const items = (projet?.milestones || []).map(m => {
                    const depenseIndex = depenses.findIndex(
                        (depense: RawDepense) => depense.milestone === String(m.milestoneId)
                    );
                    const depense = depenseIndex >= 0 ? depenses[depenseIndex] : null;

                    return {
                        fromType: "milestone" as const,
                        itemId: String(m.milestoneId),
                        milestoneId: String(m.milestoneId),
                        depenseIndex,
                        name: m.name ?? "",
                        description: m.description ?? "",
                        price: typeof m.price === "number" ? m.price : Number(m.price) || 0,
                        status: m?.status ?? "open",
                        actions: depense?.actions ?? [],
                        currentFunding: m.currentFunding || 0
                    };
                });

                return {
                    fromType: config.selectorType,
                    id: String(projet.id),
                    name: projet.name ?? "",
                    projectId: String(projet.id),
                    answerId: projet.answerId ?? "",
                    resourceTotalAmount: Number(projet.cagnotteTargetAmount) || 0,
                    resourceFinancedAmount: Number(projet.cagnotteTotalAmount) || 0,
                    items: items || [],
                };
            });
        }
        else if (config.selectorType === "proposition") {
            resources = rawProjects.map((proposition: RawProposition) => {

                const items = (proposition?.depenses || []).map((d: RawDepense, index: number) => ({
                    fromType: "depense" as const,
                    itemId: d.id ? String(d.id) : String(index),
                    milestoneId: d.milestone ?? "",
                    depenseIndex: index,
                    name: d.poste ?? "",
                    description: d.description ?? "",
                    price: typeof d.priceInt === "number" ? d.priceInt : Number(d.priceInt) || 0,
                    status: d.visible !== false ? "open" : "close",
                    actions: d.actions ?? [],
                    currentFunding: d.financer && Array.isArray(d.financer) ? d.financer.reduce((sum, f) => sum + (typeof f.amount === "number" ? f.amount : Number(f.amount) || 0), 0) : 0
                }));

                return {
                    fromType: config.selectorType,
                    id: String(proposition.id),
                    name: proposition.titre ?? "",
                    projectId: proposition.projectId ?? "",
                    answerId: String(proposition.id),
                    resourceTotalAmount: Number(proposition.totalCouts) || 0,
                    resourceFinancedAmount: Number(proposition.totalFinancement) || 0,
                    items: items,
                };
            });
        }

        savedSelectedResource = resources.find(t => t.id === selectedId);

        return { resources, savedSelectedResource };
    }, [fundingEnvelope, allProjects, config.selectorType, selectedId]);
}