/**
 * Hook d'abstraction qui transforme les données sources (projets/milestones ou propositions/dépenses)
 * en un modèle de données agnostique et unifié.
 *
 * PUR : il ne fait aucune écriture. Les dépenses orphelines qu'il détecte (dépense
 * sans palier projet) sont RENDUES (`pendingMilestoneRepairs`) ; les écrire est
 * l'affaire de `useOrphanDepenseRepair`, monté par les seules surfaces d'édition,
 * avec un droit — jamais par un simple appelant de l'adaptateur (M40).
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
import { asRecord, getServerData, normalizeTags, toArrayOrValues, toNumber, toSafeInt } from "@/modules/cagnotte/utils/dataTransform.ts";
import { generateMilestoneId } from "@/modules/cagnotte/utils/idGeneration";
import { CAGNOTTE_QUERY_KEYS } from "@/modules/cagnotte/constants/queryKeys";
import { appendProjectMilestone, updateAnswerDepenseFields } from "@/modules/cagnotte/lib/actionMilestonePathUpdates";

/** Financeur d'une dépense tel que l'enveloppe le sert, avant enrichissement. */
type RawDepenseFinancer = FundingTransaction & { method?: string };

/**
 * Montant d'une dépense : `priceInt` si l'enveloppe l'a calculé, sinon `price` tel
 * que le document le porte. `||` et non `??` : un `priceInt` à 0 est aussi ce que
 * `$convert` rend d'une chaîne non numérique (« 1 500 »), que `toSafeInt` sait lire.
 */
function readDepensePrice(depense: Pick<RawDepense, "priceInt" | "price">): number {
    return toSafeInt(depense.priceInt || depense.price);
}

interface RawDepense {
    id?: string | number;
    milestone?: string;
    poste?: string;
    description?: string;
    /**
     * Entier calculé par les pipelines de l'enveloppe (`$convert` → int) — jamais
     * stocké. Une ligne lue hors enveloppe ne porte que `price`, parfois en chaîne
     * (« 1 500 ») : lire via `readDepensePrice`, jamais `priceInt` seul (§9.1).
     */
    priceInt?: number | string;
    price?: number | string | boolean | null;
    include?: boolean;
    actions?: FundingAction[];
    /**
     * Tableau depuis l'enveloppe, mais un document brut peut le porter en objet
     * keyé par id de financeur (forme Mongo). À lire via `toArrayOrValues`, jamais
     * par un `.map` direct — celui-ci plantait tout l'adaptateur.
     */
    financer?: RawDepenseFinancer[] | Record<string, RawDepenseFinancer>;
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

/**
 * Bloc `links` de l'enveloppe brute : type de collection (`citoyens`,
 * `organizations`, …) → id de l'entité → métadonnées. Le backend n'en garantit pas
 * la forme, d'où `unknown` — les lectures narrowent au cas par cas.
 */
type GlobalLinks = Record<string, Record<string, unknown> | undefined>;

/** Les seuls champs de métadonnées que cet adaptateur lit réellement. */
interface EntityMetadata {
    profilThumbImageUrl?: string;
    name?: string;
}

export const findMetadataById = (id?: string, links?: GlobalLinks): EntityMetadata | null => {
    if (!links || !id) return null;

    for (const typeKey in links) {
        const parType = links[typeKey];
        if (parType && parType[id]) {
            return parType[id] as EntityMetadata;
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

/** Bloc `links` d'une action, seule partie que la normalisation réécrit. */
interface ActionLinks {
    contributors?: Record<string, unknown>;
}

/**
 * Ce que `normalizeRawAction` lit vraiment d'une action — volontairement plus étroit
 * que `RawAction` ou `FundingAction`, pour que la fonction serve les deux chemins
 * (dépense côté projet, action côté proposition) sans les confondre.
 */
interface ActionNormalizable {
    tags?: unknown;
    links?: ActionLinks;
}

/**
 * Générique, et non `(action: any)` : le type d'entrée doit RESSORTIR intact. Le
 * `...action` conserve les champs du domaine (`name`, `credits`, `status`,
 * `contributors`) qu'un paramètre élargi aurait effacés — c'est ce que masquait
 * l'`any` d'origine.
 */
function normalizeRawAction<T extends ActionNormalizable>(action: T, globalLinks: GlobalLinks) {
    const contributorsLinks = action.links?.contributors || {};

    const contributorsRecord = Object.fromEntries(
        Object.entries(contributorsLinks).map(([contribId, contribData]) => {
            const contrib = contribData as { type?: string };
            const collectionType = contrib.type ?? "";
            const metadata = (globalLinks?.[collectionType]?.[contribId] ?? null) as EntityMetadata | null;

            return [
                contribId,
                {
                    profilThumbImageUrl: metadata?.profilThumbImageUrl || "",
                    name: metadata?.name || "",
                    ...contrib
                }
            ];
        })
    );

    return {
        ...action,
        tags: normalizeTags(action.tags),
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
    globalLinks: GlobalLinks,
    fallbackCurrentFunding: number,
    orgsIds: string[],
    userId?: string
) {
    const rawFinancers = toArrayOrValues<RawDepenseFinancer>(depense?.financer);
    const enrichedFinancers = rawFinancers.map(fund => ({
        ...fund,
        metadata: findMetadataById(fund.id, globalLinks)
    }));

    const rawActions = depense?.actions ?? [];
    const enrichedActions = rawActions.map((action) => normalizeRawAction(action, globalLinks));

    const { currentFunding, unpaidFunding, userPledge } = calculateFundingStatus(
        enrichedFinancers,
        fallbackCurrentFunding,
        orgsIds,
        userId
    );

    return { enrichedFinancers, enrichedActions, currentFunding, unpaidFunding, userPledge };
}

/**
 * Dépense d'une réponse sans palier projet correspondant, et le palier à lui
 * fabriquer. Rendue par `useCagnotteAdapter`, consommée par `useOrphanDepenseRepair`.
 */
export interface PendingMilestoneRepair {
    projectId: string;
    answerId: string;
    milestoneId: string;
    name: string;
    description: string;
    depenseIndex: number;
}

const inFlightMilestoneRepairs = new Set<string>();

/**
 * Identité STABLE de la dépense à réparer — jamais l'identifiant généré.
 *
 * Le piège : quand une dépense n'a aucun milestone, `resolveOrGenerateMilestoneId`
 * en fabrique un via `generateMilestoneId`, qui repose sur `Date.now()` et
 * `Math.random()`. Une clé de garde contenant cette valeur est neuve à chaque
 * recalcul du memo : elle ne matche jamais, la réparation repart, écrit
 * (`updatepathvalue`), invalide l'enveloppe, ce qui relance le memo — boucle
 * infinie qui, à chaque tour, crée en plus un milestone de rebut sur le projet.
 *
 * Ce qu'on répare, c'est « la dépense n° i de la réponse X », pas un identifiant :
 * c'est cela que la clé doit désigner.
 */
export function milestoneRepairKey(repair: { answerId: string; depenseIndex: number }): string {
  return `${repair.answerId}:${repair.depenseIndex}`;
}

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
    const {me} = useCocolight();
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const userAdminOrganizations = useUserAdminOrganizations(currentUserEntity, {});

    return useMemo(() => {
        const rawEnvelopeTypeAssertion = fundingEnvelope?.rawEnvelope as { projects?: RawProposition[], links?: GlobalLinks } | undefined;
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

                    // Montant du palier : la dépense appariée d'abord — c'est là que
                    // l'enveloppe pose le `priceInt` converti (§9.1) —, sinon le `price`
                    // du palier. Ce dernier est le `price` BRUT du document réponse
                    // (`enrichMilestones` recopie `depense.price ?? 0`), hors de tout
                    // pipeline `$convert` : `Number("1 500")` rendait NaN → 0, quand la
                    // MÊME dépense restée orpheline s'affichait, elle, à 1 500 €.
                    const price = (matchedDepense ? readDepensePrice(matchedDepense.depense) : 0) || toSafeInt(m.price);

                    return {
                        fromType: "milestone" as const,
                        itemId: milestoneIdStr,
                        milestoneId: milestoneIdStr,
                        depenseIndex: matchedDepense?.index ?? -1,
                        name: m.name ?? "",
                        description: m.description ?? "",
                        price,
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
                        price: readDepensePrice(d),
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
                    // Mêmes valeurs brutes, sommées en amont : `cagnotteTargetAmount`
                    // additionne les `price` recopiés tels quels par `enrichMilestones`.
                    // `toSafeInt`, comme le repli qu'en fait `computeResourceFundingTotals`
                    // — sinon un « 1 500 » en chaîne rendait NaN → 0 ici aussi.
                    resourceTotalAmount: toSafeInt(projet.cagnotteTargetAmount),
                    resourceFinancedAmount: toSafeInt(projet.cagnotteTotalAmount),
                    items: [...items, ...orphanItems],
                };
            });
        }
        else if (config.selectorType === "proposition") {
            resources = rawProjects.map((proposition: RawProposition) => {
                const projectData = getServerData(proposition);
                const projectRecord = getServerData(projectData.project);
                const hasLinkedProject = Object.keys(projectRecord).length > 0;
                const projectMilestonesRaw = toArrayOrValues<{ milestoneId?: string }>(asRecord(projectRecord.oceco).milestones);
                const projectMilestoneIds = new Set(
                    projectMilestonesRaw.map(m => String(m.milestoneId ?? "")).filter(id => id !== "")
                );
                const generatedMilestoneIds: string[] = [];

                const items = (proposition?.depenses || []).map((d: RawDepense, index: number) => {

                    const rawFinancers = toArrayOrValues<RawDepenseFinancer>(d.financer);
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

                    // Frontière brut → domaine. Le backend renvoie bien `name`,
                    // `credits`, `status` et `contributors` sur une action, mais
                    // `RawAction` ne décrit que ce que l'adaptateur lit. L'assertion
                    // est posée ICI, une fois et commentée, plutôt que par un `any`
                    // qui l'aurait tue sur toute la chaîne.
                    const enrichedActions = filteredActions.map(
                        (action) => normalizeRawAction(action, globalLinks) as unknown as FundingAction);

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
                        price: readDepensePrice(d),
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
}

/**
 * Écrit les réparations d'UNE ressource : pour chaque dépense orpheline, le palier
 * fabriqué est ajouté à `project.oceco.milestones[]` et son id posé sur
 * `depense[i].milestone`, puis les deux caches sont invalidés.
 *
 * Opt-in des surfaces d'édition (fiche commun, section finance d'un projet) —
 * PAS de l'adaptateur. Avant, l'adaptateur portait cet effet : tout appelant
 * écrivait, `PledgeHeaderButton` compris, monté dans le header de chaque page avec
 * tous les projets de l'organisation. Un visiteur connecté sans droit déclenchait
 * N × (`api.project` + `api.answer` + `updatepathvalue`) rejetés à chaque
 * chargement ; un admin voyait ses documents modifiés sans l'avoir demandé (M40).
 *
 * `enabled` porte le droit d'écrire sur le projet ET la réponse — le même que
 * créer un palier, qui fait exactement ces deux écritures : `canCreateMilestone`
 * du calculateur cagnotte (admin du projet lié, ou déposant du commun).
 */
export function useOrphanDepenseRepair(params: {
    /** La ressource affichée — seules SES dépenses orphelines sont réparées. */
    resource: Pick<CagnotteResource, "answerId" | "projectId"> | null | undefined;
    /** `pendingMilestoneRepairs` rendu par `useCagnotteAdapter`. */
    repairs: readonly PendingMilestoneRepair[];
    /** Droit d'écriture de l'appelant sur cette ressource. */
    enabled: boolean;
}): void {
    const { resource, repairs, enabled } = params;
    const { api } = useCocolight();
    const queryClient = useQueryClient();

    const answerId = resource?.answerId ?? "";
    const projectId = resource?.projectId ?? "";
    const targetedRepairs = useMemo(
        () =>
            answerId && projectId
                ? repairs.filter((repair) => repair.answerId === answerId && repair.projectId === projectId)
                : [],
        [repairs, answerId, projectId],
    );

    useEffect(() => {
        if (!enabled || !api || targetedRepairs.length === 0) return;

        targetedRepairs.forEach((repair) => {
            const repairKey = milestoneRepairKey(repair);
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
                    // La fiche commun relit `depense[]` par une SECONDE entrée de cache
                    // (`useCommunRawDepenses`, staleTime 60 s) — la même que `docs.depenses`
                    // des mutations. Sans cette invalidation, elle servait encore la ligne
                    // SANS `milestone` : l'item fusionné par `buildItemsFromRawDepenses`
                    // restait sans id, et les quatre boutons de « Besoins financiers »
                    // échouaient. Même préfixe `[clé, answerId]` que `useGenerateAacProject`.
                    void queryClient.invalidateQueries({queryKey: CAGNOTTE_QUERY_KEYS.COMMUN_RAW_DEPENSES_PREFIX(repair.answerId)});
                } catch (error) {
                    inFlightMilestoneRepairs.delete(repairKey);
                    console.error("useOrphanDepenseRepair: échec de la génération auto du milestone projet pour une dépense orpheline", error);
                }
            })();
        });
    }, [enabled, targetedRepairs, api, queryClient]);
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