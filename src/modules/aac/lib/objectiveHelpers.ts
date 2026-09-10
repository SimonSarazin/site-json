/**
 * Helpers purs partages entre CommunFinancingSection et CommunActionsSection
 * (paliers/actions d'un commun AAC) — extraits de l'ancien CommunObjectivesSection
 * lors de sa scission en 2 composants distincts (financement vs actions).
 */
import type { Project } from "@communecter/cocolight-api-client";
import type {
  FundingAction as ProjectAction,
  FundingMilestone as Milestone,
  CagnotteFundableItem,
} from "@/modules/cagnotte/types";
import type { CagnotteMilestoneStatus } from "@/modules/cagnotte/permissions/types";
import {
  getEntityId,
  normalizeActionStatus,
  normalizeTags,
  resolveActionAuthorId,
} from "@/modules/cagnotte/utils/dataTransform";
import { resolveAnswerAuthorId } from "./answerAuthor";

/**
 * `CagnotteFundableItem.status` est un `string` : l'adaptateur le recopie du backend
 * sans le contraindre. Les gardes de permission, elles, raisonnent sur les trois
 * valeurs du domaine. Tout statut inconnu est donc traité comme `open` — un palier
 * qu'on ne sait pas lire reste ouvert, jamais figé par erreur. C'est déjà
 * l'hypothèse du reste du module, qui teste partout `status !== "close"`.
 */
export function toMilestoneStatus(status: string | undefined): CagnotteMilestoneStatus {
  return status === "close" || status === "done" ? status : "open";
}

/**
 * L'index de la dépense dans la réponse, quand il y en a un.
 *
 * Requis pour cibler la dépense quand `milestoneId` est vide — cas d'un item
 * answer-only, cf. `editMilestoneWithSync`.
 *
 * ⚠️ Le garde `>= 0` n'est pas cosmétique. `useCagnotteAdapter` pose
 * `depenseIndex: matchedDepense?.index ?? -1`, où `-1` est la SENTINELLE « ce palier
 * projet n'a pas de dépense associée ». Un simple test `typeof === "number"` la
 * laisse passer : `resolveMilestoneSyncContext` donne alors la priorité à l'index
 * fourni par l'UI, et l'écriture atterrit littéralement dans
 * `answers.<step>.depense.-1` — clé parasite créée dans le document, avec un toast
 * de succès.
 */
function answerDepenseIndexOf(item: CagnotteFundableItem): number | undefined {
  return typeof item.depenseIndex === "number" && item.depenseIndex >= 0
    ? item.depenseIndex
    : undefined;
}

/**
 * La DÉSIGNATION d'un palier : de quoi l'identifier pour le clore, le supprimer ou
 * le restaurer. Les trois handlers n'ont besoin de rien d'autre.
 *
 * Cette forme et la suivante étaient recopiées en littéraux `as Milestone` — huit
 * fois entre les deux sections de la fiche commun, à l'identique.
 */
export function fundableItemToMilestoneRef(item: CagnotteFundableItem): Milestone {
  return {
    id: item.milestoneId,
    title: item.name,
    answerDepenseIndex: answerDepenseIndexOf(item),
  } as Milestone;
}

/**
 * Le palier COMPLET, tel que la modale d'édition l'attend : titre, description,
 * statut normalisé, montant cible et actions portées.
 */
export function fundableItemToMilestone(item: CagnotteFundableItem): Milestone {
  return {
    id: item.milestoneId,
    title: item.name,
    description: item.description ?? "",
    status: toMilestoneStatus(item.status) ?? "open",
    date_start: undefined,
    date_end: undefined,
    targetAmount: Number(item.price ?? 0),
    transactions: [],
    actions: item.actions ?? [],
    answerDepenseIndex: answerDepenseIndexOf(item),
  } as Milestone;
}

export function resolveAacActionEntityId(actionLike: { id?: string; _id?: string; entityId?: string } | null | undefined): string {
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
    id: resolveAacActionEntityId(actionLike as { id?: string; _id?: string; entityId?: string }),
    name: String(actionLike.name ?? ""),
    credits: Number(actionLike.credits ?? 0),
    // Même normalisation que l'enveloppe : les gardes (`canEditAction`,
    // `canMarkActionDone`…) testent des égalités strictes sur `todo` | `done`.
    status: normalizeActionStatus(actionLike.status),
    tags: normalizeTags(actionLike.tags),
    authorId: resolveActionAuthorId(actionLike),
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

/**
 * Qui fait autorité sur les PALIERS et ACTIONS d'un commun : son DÉPOSANT, et lui seul.
 *
 * Cet id part dans `CagnottePermissionData.ownerIds`, aux côtés de l'entité du projet
 * lié : le droit final est « admin du projet lié OU déposant du commun ».
 *
 * **L'admin de l'appel n'y est PAS**, et c'est délibéré. Porter l'appel donne le droit
 * de sélectionner, valider et promouvoir un commun — pas d'écrire dans son plan de
 * financement à la place de celui qui l'a déposé. Il l'obtient quand il administre le
 * projet lié (souvent le cas quand il l'a généré), par l'entité passée au calculateur,
 * jamais par sa qualité d'admin de l'appel.
 *
 * Le déposant, lui, passe par cette liste parce qu'il n'est admin de rien : ni du site,
 * ni forcément du projet lié — la génération peut avoir été faite par quelqu'un d'autre,
 * et `checkHierarchy` n'est pas appliqué (cf. doc/18 §Pièges n°5).
 *
 * @param answer - la réponse ; l'auteur est lu par `resolveAnswerAuthorId` (qui gère
 *   le piège du commun porté par une organisation).
 */
export function resolveCommunOwnerIds(
  answer: Parameters<typeof resolveAnswerAuthorId>[0],
): string[] {
  const authorId = resolveAnswerAuthorId(answer);
  return authorId ? [authorId] : [];
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

/**
 * Contrat de permissions des cartes de palier — défini par le module cagnotte, qui
 * possède le calculateur. Ré-exporté ici pour les call-sites AAC qui l'importaient
 * déjà depuis ce fichier.
 */
export type {
  ActionPermissionInput,
  MilestoneCardPermissions,
} from "@/modules/cagnotte/permissions/types";
