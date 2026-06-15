import { useQuery } from '@tanstack/react-query';
import type { Action, ActionItemNormalized } from '@communecter/cocolight-api-client';
import { useCocolight } from '@/hooks/useCocolight';
import { CAGNOTTE_QUERY_KEYS } from '@/modules/cagnotte/constants/queryKeys';
import { getProfileSlugFromLocation } from '@/lib/fundingProjectUtils';
import {
  asRecord,
  getEntityId,
  getNonEmptyRecord,
  getServerData,
  toArray,
  toArrayOrValues,
  toNumber,
  toString,
  type UnknownRecord,
} from '@/modules/cagnotte/utils/dataTransform';

// Re-export des types canoniques depuis le module `@/modules/cagnotte/types`.
// Conservé ici pour compat ascendante des call-sites qui importent encore depuis
// `useFundingEnvelope` (ex. prefetch, actions/mutations). À long terme, les call-sites
// devraient importer directement depuis `@/modules/cagnotte/types`.
export type {
  FundingActionStatus,
  FundingPaymentStatus,
  FundingMilestoneStatus,
  FundingContributor,
  FundingTransaction,
  FundingAction,
  FundingMilestone,
  FundingPaymentMethods,
  FundingProject,
  FundingEnvelopeNormalizedData,
} from '@/modules/cagnotte/types';
import type {
  FundingActionStatus,
  FundingPaymentStatus,
  FundingContributor,
  FundingTransaction,
  FundingAction,
  FundingMilestone,
  FundingPaymentMethods,
  FundingEnvelopeNormalizedData,
} from '@/modules/cagnotte/types';

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

function normalizeEntityType(type: string | undefined): string {
  const lowered = (type || '').toLowerCase();
  if (lowered.includes('organization')) return 'organizations';
  if (lowered.includes('project')) return 'projects';
  if (lowered.includes('citoyen') || lowered.includes('user')) return 'citoyens';
  return lowered;
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
  // Le SDK Cocolight normalise les champs de `_dateFields` (startDate, endDate, date, ...)
  // en vraies `Date` JS via `EJSON.fromJSONValue` (cf. ApiClient._normalizeJsonData).
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : undefined;
  }

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

function extractActionContributors(
  sd: ActionItemNormalized | UnknownRecord,
  links: UnknownRecord,
): FundingContributor[] {
  // `links.contributors` du SDK est `Record<string, LinkContributorsRef>` (typé) mais
  // ne contient PAS `name` ni `profilThumbImageUrl`. Les noms/avatars sont enrichis
  // côté backend dans certaines réponses, sinon fallback sur `envelope.links.{type}[id]`.
  const linksBlock = asRecord((sd as UnknownRecord).links);
  const contributors = asRecord(linksBlock.contributors);
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

/**
 * Normalise une enveloppe brute (réponse `FUNDING_ENVELOPE` du SDK) en données prêtes
 * pour les composants : projets, milestones, finance, contributors, transactions.
 *
 * API stable consommée par `useFundingEnvelope` (client) et `prefetchFundingEnvelope`
 * (SSR). Les changements de shape ici doivent être traités comme breaking.
 *
 * @param rawEnvelope - enveloppe brute renvoyée par le backend (`getEnvelopeData` ou merge avec `getFormData`)
 * @param _contextEntityId - non-utilisé actuellement (réservé pour scoping futur)
 * @param _contextType - non-utilisé actuellement
 * @param forcedProjectId - sélection explicite du `selectedProject` par ID
 * @param forcedProfileSlug - sélection du `selectedProject` par slug (URL profil)
 */
export function normalizeFundingEnvelope(rawEnvelope: unknown, _contextEntityId?: string, _contextType?: string, forcedProjectId?: string, forcedProfileSlug?: string): FundingEnvelopeNormalizedData {
  const envelope = asRecord(rawEnvelope);
  const links = asRecord(envelope.links);
  //const contextData = getServerData(envelope.contextData);
  //const preferences = asRecord(contextData.preferences);
  const preferredProjectId =
    toString(forcedProjectId) // ||
    //toString(preferences.projectModalId) ||
    //toString(contextData.projectModalId) ||
    //toString(envelope.projectModalId);
  const projects = toArrayOrValues<UnknownRecord>(envelope.projects).map((rawProject) => {
    const projectRow = asRecord(rawProject);
    const projectData = getServerData(projectRow);
    // `projectData.project` est une Entity Cocolight (cf. BaseEntity.fundingEnvelope →
    // `_linkEntity`). Les vraies données du document (`oceco`, etc.) sont sous
    // `serverData`, pas à la racine — `getServerData` retourne le sous-arbre adéquat.
    const projectRecord = getServerData(projectData.project);
    const answerDepenses = toArray<UnknownRecord>(asRecord(asRecord(projectData.answers).aapStep1).depense);
    const depenses = answerDepenses.length > 0 ? answerDepenses : toArray<UnknownRecord>(projectData.depenses);
    // Depuis SDK 1.0.130, `projectData.actions` peut être un `Action[]` (entités linkées par
    // `BaseEntity.fundingEnvelope`) — sinon raw JSON. On dérive `serverData` dans les 2 cas
    // via `getServerData`, et on garde une réf à l'entité quand elle est disponible.
    const rawActions = toArray<unknown>(projectData.actions);
    const actionsWithIndex = rawActions.map((rawAction, sourceIndex) => {
      const maybeEntity = rawAction as Partial<Action> | UnknownRecord;
      const isEntity =
        typeof (maybeEntity as Partial<Action>).getEntityType === "function" ||
        typeof (maybeEntity as { _serverData?: unknown })._serverData !== "undefined";
      const entity = isEntity ? (rawAction as Action) : undefined;
      const sd = (getServerData(rawAction) as Partial<ActionItemNormalized> & UnknownRecord) ?? {};
      return { rawAction, entity, sd, sourceIndex };
    });
    const projectMilestones = toArray<UnknownRecord>(asRecord(projectRecord.oceco).milestones);
    const projectMilestoneOrder = projectMilestones
      .map((milestone) => toString(milestone.milestoneId))
      .filter((id) => id.length > 0);
    const answerMilestoneOrder = depenses
      .map((depense) => toString(depense.milestone))
      .filter((id) => id.length > 0);
    const fallbackMilestoneIds = actionsWithIndex
      .map(({ sd }) => toString(asRecord(sd.milestone).milestoneId))
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
      const actionsForMilestone = actionsWithIndex.filter(
        ({ sd }) => toString(asRecord(sd.milestone).milestoneId) === milestoneId,
      );

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

      const mappedActions: FundingAction[] = actionsForMilestone.map(
        ({ entity, sd, sourceIndex }, actionIndex): FundingAction => {
          const actionId =
            entity?.id ||
            getEntityId(sd.id) ||
            getEntityId(asRecord(sd)._id) ||
            `${milestoneId}-action-${actionIndex}`;
          const startDate = sd.startDate as Date | number | string | undefined;
          const endDate = sd.endDate as Date | number | string | undefined;
          return {
            id: actionId,
            sourceIndex,
            name: toString(sd.name) || `Action ${actionIndex + 1}`,
            credits: toNumber(sd.credits),
            status: normalizeActionStatus(sd.status),
            date_start: getTimestamp(startDate),
            date_end: getTimestamp(endDate),
            // Dédup : bug backend connu (array_merge avec soi-même côté PHP) qui duplique les tags.
            tags: Array.from(new Set(toArray<string>(sd.tags).filter((tag) => tag.length > 0))),
            contributors: extractActionContributors(sd, links),
            ...(entity ? { entity } : {}),
          };
        },
      );

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
      // Dédup : bug backend connu (array_merge avec soi-même côté PHP) qui duplique les tags.
      tags: Array.from(new Set(toArray<string>(projectData.tags || projectRow.tags).filter((tag) => tag.length > 0))),
      totalCouts: toNumber(projectData.totalCouts) || totalCostFromMilestones,
      totalFinancement: toNumber(projectData.totalFinancement) || totalFundingFromMilestones,
      userFinancement: toNumber(projectData.userFinancement),
      milestones,
      ...(paymentMethods ? { paymentMethods } : {}),
    };
  });

  // Déduplication défensive : le backend (`getFormData`) renvoie parfois plusieurs
  // entrées pour le même projet (même `id`), dont certaines "fantômes" avec
  // `totalFinancement: 0` et `totalCouts: 0`. Sans dédup, `projects[0]` est
  // non-déterministe et le piggy-bank affiche tantôt 0 tantôt le vrai total.
  // Stratégie : pour chaque `id`, on garde l'entrée la plus "riche"
  // (max sur `totalFinancement + totalCouts + nb de milestones`).
  const dedupedProjectsMap = new Map<string, typeof projects[number]>();
  for (const project of projects) {
    if (!project.id) continue;
    const existing = dedupedProjectsMap.get(project.id);
    if (!existing) {
      dedupedProjectsMap.set(project.id, project);
      continue;
    }
    const richnessExisting = existing.totalFinancement + existing.totalCouts + existing.milestones.length;
    const richnessCurrent = project.totalFinancement + project.totalCouts + project.milestones.length;
    if (richnessCurrent > richnessExisting) {
      dedupedProjectsMap.set(project.id, project);
    }
  }
  const dedupedProjects = projects.length > 0 && dedupedProjectsMap.size > 0
    ? Array.from(dedupedProjectsMap.values())
    : projects;

  const profileSlugFromWindow =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/')[window.location.pathname.split('/').indexOf('profil') + 1]
      : undefined;
  const effectiveProfileSlug = forcedProfileSlug || profileSlugFromWindow;
  const selectedProject =
    dedupedProjects.find((project) => project.id === preferredProjectId || project.slug == effectiveProfileSlug) ?? null;
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
    projects: dedupedProjects,
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

/**
 * @internal Helper de traversée utilisé par `useFundingEnvelope` et `prefetchFundingEnvelope`
 * pour récupérer le `formId` depuis l'enveloppe `getEnvelopeData` avant l'appel
 * conditionnel à `getFormData`. Ne pas utiliser depuis les composants applicatifs.
 */
export function extractFormIdFromEnvelope(rawEnvelope: unknown): string {
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

/**
 * @internal Merge minimal des deux réponses `getEnvelopeData` + `getFormData` du backend.
 * Le second appel n'est fait que pour un utilisateur connecté et peut écraser certains
 * champs (cf. `useFundingEnvelope` interne). Ne pas utiliser depuis les composants
 * applicatifs — consommer `useFundingEnvelope().data` à la place.
 */
export function mergeEnvelopePayloads(envelopeData: unknown, formData: unknown): unknown {
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

export function useFundingEnvelope(idProjet?: string, opts?: { enabled?: boolean }) {
  const { entity, contextId, contextType, me } = useCocolight();

  const entityId = contextId || entity?.id || '';
  const effectiveContextType = normalizeEntityType(contextType || entity?.getEntityType?.());
  const profileSlug = getProfileSlugFromLocation();

  const normalizedProjectId = toString(idProjet);

  return useQuery<FundingEnvelopeNormalizedData>({
    queryKey: CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE(entityId, effectiveContextType, normalizedProjectId, profileSlug, me?.id ?? null),
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

        // `getFormData` enrichit avec projects/links/contextData/nopropProject,
        // mais nécessite `financerId` côté backend PHP
        // (cf. FundingEnvelopeAction.php → $_POST['financerId'] non isset-protégé).
        // On skip l'appel pour les utilisateurs anonymes : ils gardent les
        // données essentielles (milestones, actions, finance) de getEnvelopeData,
        // et ne peuvent de toute façon pas contribuer sans être connectés.
        if (formId && me?.id) {
          try {
            const rawFormData = await fundingEnvelope.call(entity, {
              contextId: entityId,
              contextType: effectiveContextType,
              formId,
              financerId: me.id,
              financerType: 'citoyens',
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
    // Client-only + utilisateur connecté requis :
    //  - `typeof window !== 'undefined'` : pas de fetch SSR (le serveur n'a pas
    //    de session, `me` y est toujours null → on récupérerait une enveloppe
    //    anonyme avec `totalFinancement: 0`).
    //  - `me?.id` : `getFormData` (qui enrichit `projects[].totalFinancement`)
    //    nécessite un `financerId`. Sans `me`, la requête tombe en fallback
    //    `getEnvelopeData` qui ne calcule pas les totaux.
    enabled: (opts?.enabled ?? true) && typeof window !== 'undefined' && Boolean(entity && entityId && effectiveContextType && me?.id),
    staleTime: 2 * 60 * 1000,
  });
}





