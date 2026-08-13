/**
 * Helpers purs partages entre CommunFinancingSection et CommunActionsSection
 * (paliers/actions d'un commun AAC) — extraits de l'ancien CommunObjectivesSection
 * lors de sa scission en 2 composants distincts (financement vs actions).
 */
import type { Project } from "@communecter/cocolight-api-client";
import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
} from "@/modules/cagnotte/types";
import { getEntityId } from "@/modules/cagnotte/utils/dataTransform";

export function resolveActionEntityId(actionLike: { id?: string; _id?: string; entityId?: string } | null | undefined): string {
  return String(actionLike?.id ?? actionLike?._id ?? actionLike?.entityId ?? "").trim();
}

export function getAnswerOwnerId(answerLike: { user?: string | { _id?: string; [key: string]: unknown } } | null | undefined): string {
  const user = answerLike?.user;
  if (typeof user === "string") return user;
  if (user && typeof user === "object") return String(user._id ?? "");
  return "";
}

export function normalizeActionForEdit(actionLike: Record<string, unknown>): ProjectAction {
  const rawContributors = Array.isArray(actionLike.contributors)
    ? actionLike.contributors
    : Array.isArray((actionLike.links as { contributors?: unknown })?.contributors)
      ? (actionLike.links as { contributors?: unknown }).contributors as unknown[]
      : [];

  const contributors = rawContributors
    .map((contrib) => {
      if (typeof contrib === "string") {
        return { id: contrib, name: contrib };
      }
      if (contrib && typeof contrib === "object") {
        const candidate = contrib as Record<string, unknown>;
        return {
          id: String(candidate.id ?? candidate._id ?? candidate.entityId ?? ""),
          name: String(candidate.name ?? candidate.title ?? candidate.id ?? ""),
        };
      }
      return null;
    })
    .filter((entry): entry is { id: string; name: string } => !!entry && !!entry.id);

  const rawLinksContributors = (actionLike.links as { contributors?: Record<string, unknown> } | undefined)?.contributors;
  const linkedContributors = rawLinksContributors
    ? Object.entries(rawLinksContributors).map(([id, payload]) => {
        const data = payload as Record<string, unknown>;
        return { id, name: String(data.name ?? data.title ?? id) };
      })
    : [];

  const mergedContributors = [...contributors, ...linkedContributors].filter(
    (entry, index, items) => items.findIndex((candidate) => candidate.id === entry.id) === index,
  );

  return {
    id: resolveActionEntityId(actionLike as { id?: string; _id?: string; entityId?: string }),
    name: String(actionLike.name ?? ""),
    credits: Number(actionLike.credits ?? 0),
    status: (String(actionLike.status ?? "todo") as ProjectAction["status"]),
    tags: Array.isArray(actionLike.tags) ? actionLike.tags.filter((tag): tag is string => typeof tag === "string") : [],
    contributors: mergedContributors,
    date_start: typeof actionLike.date_start === "number" ? actionLike.date_start : undefined,
    date_end: typeof actionLike.date_end === "number" ? actionLike.date_end : undefined,
  };
}

/** Un projet (ecrit dans oceco.milestones) doit exister pour gerer des actions —
 *  cote answer-only (proposition non promue), les actions n'existent pas. */
export function canManageObjectiveActions(projectId: string | null | undefined): boolean {
  return String(projectId ?? "").trim().length > 0;
}

export function getModalProjectEntityCandidate(
  profileProjectEntity: Project | null | undefined,
  currentProjectEntity: Project | null | undefined,
  projectId: string | null | undefined,
): Project | null {
  const normalizedProjectId = String(projectId ?? "").trim();
  if (!normalizedProjectId) {
    return currentProjectEntity ?? null;
  }

  const currentProjectEntityId = currentProjectEntity ? getEntityId(currentProjectEntity) : "";
  if (currentProjectEntityId && currentProjectEntityId === normalizedProjectId) {
    return currentProjectEntity ?? null;
  }

  const profileProjectEntityId = profileProjectEntity ? getEntityId(profileProjectEntity) : "";
  if (profileProjectEntityId && profileProjectEntityId === normalizedProjectId) {
    return profileProjectEntity ?? null;
  }

  return null;
}

export interface MilestoneCardPermissions {
  canCreateAction: (input: { status: Milestone["status"] }) => boolean;
  canEditMilestone: (input: { status: Milestone["status"] }) => boolean;
  canCloseMilestone: (input: { status: Milestone["status"] }) => boolean;
  canDeleteMilestone: (input: { status: Milestone["status"]; hasTransactions: boolean }) => boolean;
  canCandidateAction: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
  canMarkActionDone: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
  canEditAction: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
  canDeleteAction: (input: { status: ProjectAction["status"]; contributorIds: string[] }) => boolean;
}
