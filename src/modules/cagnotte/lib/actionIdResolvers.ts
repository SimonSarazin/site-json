/**
 * @unused 2026-05-19 — workaround historique pour récupérer l'id d'une action créée.
 *
 * Devenu obsolète : `useCreateAction` (cf. `actions/mutations/action.ts`) utilise
 * désormais l'API entity-oriented du SDK (`project.action()` + `action.save()`),
 * qui peuple `action.id` automatiquement après la réponse serveur. Plus besoin de
 * refetcher l'envelope et de matcher l'action par `name`/`credits`/`status`.
 *
 * Conservé selon la politique projet (ne pas supprimer les exports non utilisés).
 * Toutes les mutations action passent désormais par l'API entity-oriented du
 * SDK (`project.action().save()` / `.delete()` / `.updateStatus()` / etc.).
 */
import { asRecord } from "@/modules/cagnotte/utils/dataTransform";
import type { FundingAction, FundingActionStatus } from "@/modules/cagnotte/types";

/**
 * Alias rétro-compat. Le type canonique est `FundingActionStatus` (sous-ensemble
 * explicite de `ActionStatus` SDK). Conservé en re-export car cet helper est
 * actuellement `@unused` (workaround remplacé par `action.id` peuplé par le SDK).
 */
export type ActionStatus = FundingActionStatus;

/**
 * Garde-fou : un id MongoDB est une chaîne non-vide après trim. On évite ici
 * la validation hexa stricte pour rester tolérant aux ids legacy.
 */
export function isValidEntityId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Résout l'ID d'une action récemment créée en parcourant l'envelope React Query refetchée.
 *
 * Stratégie :
 *  1. Si `fallbackId` est un id valide, on le retourne directement (court-circuit fiable
 *     quand le backend renvoie déjà l'id par une autre voie).
 *  2. Sinon, on cherche dans `rawEnvelope.projects[*].actions[]` une action qui matche
 *     **toutes** les caractéristiques de l'action créée (milestone parent, name, credits,
 *     status attendu).
 *
 * Retourne `''` si aucune action matche — l'appelant doit alors faire un metadata update
 * "best-effort" ou afficher un toast partiel.
 */
export function resolveCreatedActionId(params: {
  rawEnvelope: unknown;
  projectId: string;
  milestoneId: string;
  name: string;
  credits: number;
  expectedStatus: ActionStatus;
  fallbackId?: string;
}): string {
  const fallbackId = typeof params.fallbackId === "string" ? params.fallbackId.trim() : "";
  if (isValidEntityId(fallbackId)) {
    return fallbackId;
  }

  const rawEnvelope = asRecord(params.rawEnvelope);
  const rawProjects = Array.isArray(rawEnvelope.projects)
    ? rawEnvelope.projects
    : Object.values(asRecord(rawEnvelope.projects));

  for (const rawProject of rawProjects) {
    const projectRecord = asRecord(rawProject);
    const projectData = asRecord(projectRecord.serverData ?? projectRecord);

    const rawProjectId = String(
      projectData?.id ?? projectData?._id ?? projectRecord?.id ?? projectRecord?._id ?? "",
    ).trim();
    if (rawProjectId && params.projectId && rawProjectId !== params.projectId) {
      continue;
    }

    const rawActions = Array.isArray(projectData.actions)
      ? projectData.actions
      : Array.isArray(projectRecord.actions)
        ? projectRecord.actions
        : [];

    for (const rawAction of rawActions) {
      const actionRecord = asRecord(rawAction);
      const actionMilestoneId = String(asRecord(actionRecord.milestone).milestoneId ?? "").trim();
      if (actionMilestoneId !== params.milestoneId) continue;

      const sameName =
        String(actionRecord.name ?? "").trim().toLowerCase() === params.name.trim().toLowerCase();
      const sameCredits = Number(actionRecord.credits) === params.credits;
      const sameStatus = String(actionRecord.status ?? "").trim() === params.expectedStatus;
      const rawActionId = String(actionRecord.id ?? actionRecord._id ?? "").trim();

      if (sameName && sameCredits && sameStatus && isValidEntityId(rawActionId)) {
        return rawActionId;
      }
    }
  }

  return "";
}

/**
 * Résout l'identifiant MongoDB d'une action côté UI.
 *
 * Pattern récurrent dans `ActionsSection` : avant de muter une action existante (candidat,
 * marquer done, supprimer), on tente d'utiliser `action.id` ; si l'id est dégénéré
 * (legacy ou créé sans backend round-trip), on retombe sur la recherche dans le
 * `rawEnvelope` via `resolveCreatedActionId`.
 *
 * Retourne `""` si la résolution échoue — l'appelant doit alors afficher un toast
 * « action introuvable » et abandonner la mutation.
 */
export function resolveActionEntityId(params: {
  action: FundingAction;
  milestoneId: string;
  projectId: string;
  rawEnvelope: unknown;
}): string {
  const { action, milestoneId, projectId, rawEnvelope } = params;
  if (isValidEntityId(action.id)) return action.id;
  return resolveCreatedActionId({
    rawEnvelope,
    projectId,
    milestoneId,
    name: action.name,
    credits: Number(action.credits),
    expectedStatus: action.status,
    fallbackId: action.id,
  });
}
