import { useQuery } from '@tanstack/react-query';
import { useCocolight } from '@/hooks/useCocolight';

type UnknownRecord = Record<string, unknown>;

export type FundingActionStatus = 'todo' | 'done';
export type FundingPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type FundingContributor = {
  id: string;
  name: string;
  avatar?: string;
};

export type FundingTransaction = {
  id: string;
  financerName: string;
  financerId?: string;
  financerType?: string;
  financerAvatar?: string;
  amount: number;
  date: number;
  paymentStatus: FundingPaymentStatus;
  transactionId: string;
};

export type FundingAction = {
  id: string;
  name: string;
  credits: number;
  status: FundingActionStatus;
  sourceIndex?: number;
  date_start?: number;
  date_end?: number;
  tags: string[];
  contributors: FundingContributor[];
};

export type FundingMilestone = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'done' | 'close';
  date_start?: number;
  date_end?: number;
  targetAmount: number;
  transactions: FundingTransaction[];
  actions: FundingAction[];
  projectMilestoneIndex?: number;
  answerDepenseIndex?: number;
};

export type FundingPaymentMethods = {
  stripePublicKey?: string;
  helloassoPublicKey?: string;
  helloAssoPublicKey?: string;
  helloassoClientId?: string;
  helloAssoClientId?: string;
  [key: string]: string | undefined;
};

export type FundingProject = {
  id: string;
  answerId?: string;
  name: string;
  description: string;
  tags: string[];
  totalCouts: number;
  totalFinancement: number;
  userFinancement: number;
  milestones: FundingMilestone[];
  paymentMethods?: FundingPaymentMethods;
};

export type FundingEnvelopeNormalizedData = {
  projects: FundingProject[];
  selectedProject: FundingProject | null;
  paymentMethods: FundingPaymentMethods | null;
  milestones: FundingMilestone[];
  contributors: FundingContributor[];
  funders: Array<{ id: string; name: string; amount: number; avatar?: string }>;
  finance: {
    totalCost: number;
    totalFunding: number;
    userFunding: number;
    remaining: number;
    totalSpent: number;
  };
  rawEnvelope: unknown;
};

const EMPTY_RESULT: FundingEnvelopeNormalizedData = {
  projects: [],
  selectedProject: null,
  milestones: [],
  contributors: [],
  funders: [],
  finance: {
    totalCost: 0,
    totalFunding: 0,
    userFunding: 0,
    remaining: 0,
    totalSpent: 0,
  },
  rawEnvelope: null,
  paymentMethods: null,
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function getNonEmptyRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as UnknownRecord;
  return Object.keys(record).length > 0 ? record : null;
}

function toArrayOrValues<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') return Object.values(value as Record<string, T>);
  return [];
}

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null) return [];
  return [value as T];
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeEntityType(type: string | undefined): string {
  const lowered = (type || '').toLowerCase();
  if (lowered.includes('organization')) return 'organizations';
  if (lowered.includes('project')) return 'projects';
  if (lowered.includes('citoyen') || lowered.includes('user')) return 'citoyens';
  return lowered;
}

function getEntityId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const record = value as UnknownRecord;
  const direct = record.id;
  if (typeof direct === 'string' && direct) return direct;

  const mongoId = asRecord(record._id);
  const dollarId = mongoId.$id;
  if (typeof dollarId === 'string' && dollarId) return dollarId;

  const mongoStr = mongoId._str;
  if (typeof mongoStr === 'string' && mongoStr) return mongoStr;

  const str = record.$id;
  if (typeof str === 'string' && str) return str;

  return '';
}

function getServerData(value: unknown): UnknownRecord {
  const record = asRecord(value);

  return (
    getNonEmptyRecord(record._serverData) ||
    getNonEmptyRecord(record.serverData) ||
    getNonEmptyRecord(record) ||
    {}
  );
}

function extractPaymentMethods(...sources: unknown[]): FundingPaymentMethods | null {
  const merged: Record<string, string> = {};

  sources.forEach((source) => {
    const record = getNonEmptyRecord(source);
    if (!record) return;

    Object.entries(record).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        merged[key] = value.trim();
      }
    });
  });

  return Object.keys(merged).length > 0 ? (merged as FundingPaymentMethods) : null;
}

function getTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }

  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }

  const record = asRecord(value);
  if (typeof record.sec === 'number') {
    return record.sec * 1000 + Math.floor(toNumber(record.usec) / 1000);
  }
  if (typeof record.$date === 'number') {
    return record.$date;
  }

  return undefined;
}

function normalizeActionStatus(value: unknown): FundingActionStatus {
  const status = toString(value).toLowerCase();
  if (status === 'done') return 'done';
  if (status === 'todo' || status === 'disabled') return 'todo';
  return 'todo';
}

function normalizePaymentStatus(value: unknown): FundingPaymentStatus {
  const status = toString(value).toLowerCase();
  if (status === 'pending' || status === 'paid' || status === 'failed' || status === 'refunded') {
    return status;
  }
  return 'paid';
}

function getNameFromLinks(links: UnknownRecord, id: string, type?: string): string {
  if (!id) return '';

  const citoyens = asRecord(links.citoyens);
  const organizations = asRecord(links.organizations);

  if (type === 'organizations') {
    return toString(asRecord(organizations[id]).name);
  }
  if (type === 'citoyens') {
    return toString(asRecord(citoyens[id]).name);
  }

  return toString(asRecord(citoyens[id]).name) || toString(asRecord(organizations[id]).name);
}

function getAvatarFromLinks(links: UnknownRecord, id: string, type?: string): string {
  if (!id) return '';

  const citoyens = asRecord(links.citoyens);
  const organizations = asRecord(links.organizations);

  if (type === 'organizations') {
    const organization = asRecord(organizations[id]);
    return toString(organization.profilThumbImageUrl) || toString(organization.profilImageUrl);
  }
  if (type === 'citoyens') {
    const citoyen = asRecord(citoyens[id]);
    return toString(citoyen.profilThumbImageUrl) || toString(citoyen.profilImageUrl);
  }

  const citoyen = asRecord(citoyens[id]);
  const organization = asRecord(organizations[id]);
  return (
    toString(citoyen.profilThumbImageUrl) ||
    toString(organization.profilThumbImageUrl) ||
    toString(citoyen.profilImageUrl) ||
    toString(organization.profilImageUrl)
  );
}

function extractActionContributors(action: UnknownRecord, links: UnknownRecord): FundingContributor[] {
  const contributors = asRecord(asRecord(action.links).contributors);
  return Object.entries(contributors).map(([contributorId, rawContributor]) => {
    const contributor = asRecord(rawContributor);
    const type = toString(contributor.type) || 'citoyens';
    const name = toString(contributor.name) || getNameFromLinks(links, contributorId, type) || contributorId;
    return {
      id: contributorId,
      name,
      avatar:
        toString(contributor.profilThumbImageUrl) ||
        toString(contributor.profilImageUrl) ||
        getAvatarFromLinks(links, contributorId, type) ||
        undefined,
    };
  });
}

function normalizeFundingEnvelope(rawEnvelope: unknown, _contextEntityId?: string, _contextType?: string, forcedProjectId?: string): FundingEnvelopeNormalizedData {
  const envelope = asRecord(rawEnvelope);
  const links = asRecord(envelope.links);
  //const contextData = getServerData(envelope.contextData);
  //const preferences = asRecord(contextData.preferences);
  const preferredProjectId =
    toString(forcedProjectId) // ||
    //toString(preferences.projectModalId) ||
    //toString(contextData.projectModalId) ||
    //toString(envelope.projectModalId);
  console.log("normalizeFundingEnvelope 1/2" , envelope );
  const projects = toArrayOrValues<UnknownRecord>(envelope.projects).map((rawProject) => {
    const projectRow = asRecord(rawProject);
    const projectData = getServerData(projectRow);
    const projectRecord = asRecord(projectData.project);
    const answerDepenses = toArray<UnknownRecord>(asRecord(asRecord(projectData.answers).aapStep1).depense);
    const depenses = answerDepenses.length > 0 ? answerDepenses : toArray<UnknownRecord>(projectData.depenses);
    const actions = toArray<UnknownRecord>(projectData.actions);
    const actionsWithIndex = actions.map((action, sourceIndex) => ({ action, sourceIndex }));
    const projectMilestones = toArray<UnknownRecord>(asRecord(projectRecord.oceco).milestones);
    console.log("normalizeFundingEnvelope 1/3" , projectData , getEntityId(projectData));
    const projectMilestoneOrder = projectMilestones
      .map((milestone) => toString(milestone.milestoneId))
      .filter((id) => id.length > 0);
    const answerMilestoneOrder = depenses
      .map((depense) => toString(depense.milestone))
      .filter((id) => id.length > 0);
    const fallbackMilestoneIds = actions
      .map((action) => toString(asRecord(action.milestone).milestoneId))
      .filter((id) => id.length > 0);

    const milestoneOrder = Array.from(
      new Set<string>([
        ...projectMilestoneOrder,
        ...answerMilestoneOrder,
        ...fallbackMilestoneIds,
      ])
    );

    const milestones: FundingMilestone[] = milestoneOrder.map((milestoneId, index) => {
      const projectMilestoneIndex = projectMilestoneOrder.indexOf(milestoneId);
      const answerDepenseIndex = answerMilestoneOrder.indexOf(milestoneId);
      const metadata = projectMilestones[projectMilestoneIndex] || {};
      const depensesForMilestone = depenses.filter((depense) => toString(depense.milestone) === milestoneId);
      const actionsForMilestone = actionsWithIndex.filter(({ action }) => toString(asRecord(action.milestone).milestoneId) === milestoneId);

      const transactions: FundingTransaction[] = depensesForMilestone.flatMap((depense, depenseIndex) => {
        const financerList = toArray<UnknownRecord>(depense.financer);

        return financerList.map((financer, financerIndex) => {
          const financerId = getEntityId(financer.id) || getEntityId(financer.user);
          const financerType = toString(financer.type) || 'citoyens';
          const financerName =
            toString(financer.name) ||
            getNameFromLinks(links, financerId, financerType) ||
            'Financeur inconnu';
          const financerAvatar =
            toString(financer.profilThumbImageUrl) ||
            toString(financer.profilImageUrl) ||
            getAvatarFromLinks(links, financerId, financerType) ||
            undefined;

          return {
            id: `${milestoneId}-${depenseIndex}-${financerIndex}`,
            financerName,
            financerId,
            financerType,
            financerAvatar,
            amount: toNumber(financer.amount),
            date: getTimestamp(financer.date) || getTimestamp(depense.date) || Date.now(),
            paymentStatus: normalizePaymentStatus(financer.paymentStatus || financer.status),
            transactionId: toString(financer.transactionId) || financerId || `TX-${milestoneId}-${depenseIndex}-${financerIndex}`,
          };
        });
      });

      const mappedActions: FundingAction[] = actionsForMilestone.map(({ action, sourceIndex }, actionIndex): FundingAction => {
        const actionId = getEntityId(action.id) || getEntityId(action._id) || `${milestoneId}-action-${actionIndex}`;
        return {
          id: actionId,
          sourceIndex,
          name: toString(action.name) || `Action ${actionIndex + 1}`,
          credits: toNumber(action.credits),
          status: normalizeActionStatus(action.status),
          date_start: Number(getTimestamp(action.startDate as unknown) ?? 0) || undefined,
          date_end: Number(getTimestamp(action.endDate as unknown) ?? 0) || undefined,
          tags: toArray<string>(action.tags).filter((tag) => tag.length > 0),
          contributors: extractActionContributors(action, links),
        };
      });

      const targetAmount = depensesForMilestone.reduce((sum, depense) => {
        return sum + toNumber(depense.priceInt || depense.price);
      }, 0);

      const title =
        toString(metadata.name) ||
        toString(depensesForMilestone[0]?.poste) ||
        `Jalon ${index + 1}`;

      const milestoneStatus = toString(metadata.status).toLowerCase();
      const normalizedMilestoneStatus: FundingMilestone['status'] =
        milestoneStatus === 'close' ? 'close' : milestoneStatus === 'done' ? 'done' : 'open';

      return {
        id: milestoneId,
        title,
        description: toString(metadata.description) || '',
        status: normalizedMilestoneStatus,
        date_start: undefined,
        date_end: undefined,
        targetAmount,
        transactions,
        actions: mappedActions,
        ...(projectMilestoneIndex >= 0 ? { projectMilestoneIndex } : {}),
        ...(answerDepenseIndex >= 0 ? { answerDepenseIndex } : {}),
      };
    });

    const totalFundingFromMilestones = milestones.reduce((sum, milestone) => {
      return sum + milestone.transactions.reduce((localSum, transaction) => localSum + transaction.amount, 0);
    }, 0);

    const totalCostFromMilestones = milestones.reduce((sum, milestone) => sum + milestone.targetAmount, 0);

    const projectId =
      toString(projectRecord.id) ||
      getEntityId(projectRow.projectIdObj) ||
      '';

    const paymentMethods = extractPaymentMethods(
      projectData.paymentMethods,
      projectRecord.paymentMethods,
      projectRow.paymentMethods,
      envelope.paymentMethods,
      asRecord(getNonEmptyRecord(envelope.contextData)?.paymentMethods)
    );

    return {
      id: projectId,
      slug: toString(projectRecord.slug),
      answerId: getEntityId(projectData) || toString(projectData.answer) || undefined,
      name: toString(projectData.name) || toString(projectData.titre) || 'Projet sans nom',
      description: toString(projectData.shortDescription) || toString(projectData.description) || toString(projectData.description),
      tags: toArray<string>(projectData.tags || projectRow.tags).filter((tag) => tag.length > 0),
      totalCouts: toNumber(projectData.totalCouts) || totalCostFromMilestones,
      totalFinancement: toNumber(projectData.totalFinancement) || totalFundingFromMilestones,
      userFinancement: toNumber(projectData.userFinancement),
      milestones,
      ...(paymentMethods ? { paymentMethods } : {}),
    };
  });

  const selectedProject =
    projects.find((project) => project.id === preferredProjectId || project.slug == window.location.pathname.split('/')[window.location.pathname.split('/').indexOf('profil') + 1]) ?? null;
  const milestones = selectedProject?.milestones ?? [];
  const financialMilestones = milestones.filter((milestone) => milestone.status !== 'close');
  const paymentMethods = selectedProject?.paymentMethods ?? extractPaymentMethods(envelope.paymentMethods, asRecord(getNonEmptyRecord(envelope.contextData)?.paymentMethods));

  const contributorsMap = new Map<string, FundingContributor>();
  milestones.forEach((milestone) => {
    milestone.actions.forEach((action) => {
      action.contributors.forEach((contributor) => {
        contributorsMap.set(contributor.id, contributor);
      });
    });
  });

  const fundersMap = new Map<string, { id: string; name: string; amount: number; avatar?: string }>();
  financialMilestones.forEach((milestone) => {
    milestone.transactions.forEach((transaction) => {
      const key = transaction.financerId || transaction.financerName;
      const current = fundersMap.get(key);
      if (current) {
        current.amount += transaction.amount;
          if (!current.avatar && transaction.financerAvatar) {
            current.avatar = transaction.financerAvatar;
          }
      } else {
        fundersMap.set(key, {
          id: transaction.financerId || key,
          name: transaction.financerName,
          amount: transaction.amount,
            avatar: transaction.financerAvatar,
        });
      }
    });
  });

  const totalCost = financialMilestones.reduce((sum, milestone) => sum + milestone.targetAmount, 0);
  const totalFunding = financialMilestones.reduce((sum, milestone) => {
    return sum + milestone.transactions.reduce((local, transaction) => local + transaction.amount, 0);
  }, 0);
  const totalSpent = financialMilestones.reduce((sum, milestone) => {
    return sum + milestone.actions.reduce((local, action) => local + action.credits, 0);
  }, 0);

  return {
    projects,
    selectedProject: selectedProject ?? null,
    paymentMethods,
    milestones,
    contributors: Array.from(contributorsMap.values()),
    funders: Array.from(fundersMap.values()).sort((a, b) => b.amount - a.amount),
    finance: {
      totalCost,
      totalFunding,
      userFunding: selectedProject?.userFinancement || 0,
      remaining: Math.max(totalCost - totalFunding, 0),
      totalSpent,
    },
    rawEnvelope,
  };
}

function extractFormIdFromEnvelope(rawEnvelope: unknown): string {
  const envelope = asRecord(rawEnvelope);
  const context = asRecord(envelope.context);
  const form = asRecord(envelope.form);

  const directFormId =
    toString(envelope.formId) ||
    toString(context.formId) ||
    toString(context.form) ||
    toString(envelope.form);

  if (directFormId) {
    return directFormId;
  }

  const formIds = Object.keys(form);
  return formIds[0] || '';
}

function mergeEnvelopePayloads(envelopeData: unknown, formData: unknown): unknown {
  const envelopeRecord = asRecord(envelopeData);
  const formRecord = asRecord(formData);

  return {
    ...envelopeRecord,
    ...formRecord,
    projects: formRecord.projects ?? envelopeRecord.projects,
    links: formRecord.links ?? envelopeRecord.links,
    contextData: formRecord.contextData ?? envelopeRecord.contextData,
    nopropProject: formRecord.nopropProject ?? envelopeRecord.nopropProject,
  };
}

export function useFundingEnvelope(idProjet?: string) {
  const { entity, contextId, contextType, me } = useCocolight();

  const entityId = contextId || entity?.id || '';
  const effectiveContextType = normalizeEntityType(contextType || entity?.getEntityType?.());

  const normalizedProjectId = toString(idProjet);

  console.log(normalizedProjectId,'normalizedProjectId');

  return useQuery<FundingEnvelopeNormalizedData>({
    queryKey: ['funding-envelope', entityId, effectiveContextType, normalizedProjectId],
    queryFn: async () => {
      const entityRecord = entity as unknown as UnknownRecord;

      if (!entity || !entityId || !effectiveContextType || typeof entityRecord.fundingEnvelope !== 'function') {
        return EMPTY_RESULT;
      }

      try {
        const fundingEnvelope = entityRecord.fundingEnvelope as (payload: UnknownRecord) => Promise<unknown>;
        const rawEnvelope = await fundingEnvelope.call(entity, {
          contextId: entityId,
          contextType: effectiveContextType,
          action: 'getEnvelopeData',
        });

        const formId = extractFormIdFromEnvelope(rawEnvelope);
        let mergedEnvelope = rawEnvelope;

        if (formId) {
          try {
            const rawFormData = await fundingEnvelope.call(entity, {
              contextId: entityId,
              contextType: effectiveContextType,
              formId,
              financerId: me?.id,
              financerType: me?.id ? 'citoyens' : undefined,
              action: 'getFormData',
              params: {
                project: 'all',
              },
            });

            mergedEnvelope = mergeEnvelopePayloads(rawEnvelope, rawFormData);
          } catch (formError) {
            console.warn('[useFundingEnvelope] getFormData indisponible, fallback getEnvelopeData', formError);
          }
        }

        return normalizeFundingEnvelope(mergedEnvelope, entityId, effectiveContextType, normalizedProjectId);
      } catch (error) {
        console.error('[useFundingEnvelope] Erreur fundingEnvelope:', error);
        return {
          ...EMPTY_RESULT,
          rawEnvelope: { error: String(error) },
        };
      }
    },
    enabled: Boolean(entity && entityId && effectiveContextType),
    staleTime: 2 * 60 * 1000,
  });
}



