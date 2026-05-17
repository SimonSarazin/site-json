/**
 * Index des mutations cagnotte (milestones + actions).
 * Re-exports pour permettre `import { useEditMilestone } from "@/modules/cagnotte/actions/mutations"`.
 */

export {
  createMilestoneMutation,
  useEditMilestone,
  useCloseMilestone,
  useRestoreMilestone,
  useDeleteMilestone,
  useCreateMilestone,
  MilestoneContextError,
} from "./milestone";
export type {
  MilestoneMutationContext,
  MilestoneMutationConfig,
  ResolvedMilestoneContext,
  EditMilestoneParams,
  SimpleMilestoneParams,
  CreateMilestoneParams,
} from "./milestone";

export {
  createActionMutation,
  useCandidateAction,
  useMarkActionDone,
  useDeleteAction,
  useEditAction,
  useCreateAction,
  ActionContextError,
} from "./action";
export type {
  ActionMutationContext,
  ActionMutationConfig,
  ResolvedActionContext,
  CandidateActionParams,
  MarkActionDoneParams,
  DeleteActionParams,
  EditActionParams,
  CreateActionParams,
  CreateActionResult,
} from "./action";
