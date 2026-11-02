/**
 * Routes `milestone/*` de l'API kanban (blueprint §11.6).
 *
 * Les jalons sont ceux du projet Communecter (`projects.oceco.milestones`),
 * partages avec Kanban gestion. Lecture : contributeur ; ecriture : owner
 * (`canManageMilestones`). Le serveur ecrit par `milestoneId` (operateur
 * positionnel), jamais par index — deux personnes qui editent deux jalons ne
 * s'ecrasent pas.
 */
import type { KanbanClient, KanbanRequestOptions } from '@/modules/kanban/transport/kanbanClient';
import {
  isMilestoneEnvelope,
  isMilestoneListResult,
  type Milestone,
  type MilestoneStatus,
} from '@/modules/kanban/types';

export async function listMilestones(
  client: KanbanClient,
  boardId: string,
  options?: KanbanRequestOptions,
): Promise<Milestone[]> {
  const { milestones } = await client.post(
    'KANBAN_MILESTONE_LIST_URL',
    { boardId },
    isMilestoneListResult,
    options,
  );
  return milestones;
}

export interface CreateMilestoneInput {
  boardId: string;
  name: string;
  description?: string;
  startDate?: number | null;
  endDate?: number | null;
}

export async function createMilestone(
  client: KanbanClient,
  input: CreateMilestoneInput,
  options?: KanbanRequestOptions,
): Promise<Milestone> {
  const { milestone } = await client.post('KANBAN_MILESTONE_CREATE_URL', input, isMilestoneEnvelope, options);
  return milestone;
}

export interface UpdateMilestoneInput {
  boardId: string;
  milestoneId: string;
  name?: string;
  description?: string;
  startDate?: number | null;
  endDate?: number | null;
  /** Clore (`close`) ou rouvrir (`open`) le jalon. */
  status?: MilestoneStatus;
}

export async function updateMilestone(
  client: KanbanClient,
  input: UpdateMilestoneInput,
  options?: KanbanRequestOptions,
): Promise<Milestone> {
  const { milestone } = await client.post('KANBAN_MILESTONE_UPDATE_URL', input, isMilestoneEnvelope, options);
  return milestone;
}
