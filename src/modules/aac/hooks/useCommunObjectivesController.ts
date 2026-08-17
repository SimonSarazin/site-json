/**
 * Logique partagee entre CommunFinancingSection (besoins financiers) et
 * CommunActionsSection (objectifs/actions) : mutations paliers + actions,
 * permissions, resolution de l'entite Project, etats des dialogs.
 *
 * Chaque composant appelle ce hook independamment (sa propre instance d'etat) —
 * ce n'est pas un contexte partage entre les 2 blocs, juste la meme logique
 * pour eviter de la dupliquer.
 */
import { useCallback, useMemo, useState } from "react";
import type { Project } from "@communecter/cocolight-api-client";
import type { CoFormAnswer } from "@/modules/coform/types";
import { useCagnottePermissions } from "@/modules/cagnotte/hooks/useCagnottePermissions";
import { useActionGuards } from "@/modules/cagnotte/hooks/useActionGuards";
import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
} from "@/modules/cagnotte/types";
import { useCandidateAction, useDeleteAction, useMarkActionDone } from "@/modules/cagnotte/actions/mutations";
import { useDeleteMilestone, useEditMilestone, useCloseMilestone, useRestoreMilestone } from "@/modules/cagnotte/actions/mutations";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { getEntityId } from "@/modules/cagnotte/utils/dataTransform";
import { useCocolight } from "@/hooks/useCocolight";
import { isProject } from "@/lib/getTypedEntity";
import { useOptionalProfileEntity } from "@/modules/profil/hooks/useProfileEntity";
import type { MilestoneEditFormData } from "@/modules/cagnotte/schemaForm";
import { canManageObjectiveActions, getModalProjectEntityCandidate } from "@/modules/aac/lib/objectiveHelpers";

export function useCommunObjectivesController({
  answerQuery,
  funding,
}: {
  answerQuery: CoFormAnswer | null;
  funding?: any;
}) {
  const { api, apiClient, entity, me } = useCocolight();
  const profileEntity = useOptionalProfileEntity();
  const profileProjectEntity = useMemo(
    () => (profileEntity?.entity && isProject(profileEntity.entity) ? profileEntity.entity : null),
    [profileEntity],
  );
  const [projectEntity, setProjectEntity] = useState<Project | null>(null);
  const [isCreateActionOpen, setIsCreateActionOpen] = useState(false);
  const [isEditActionOpen, setIsEditActionOpen] = useState(false);
  const [isEditMilestoneOpen, setIsEditMilestoneOpen] = useState(false);
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>("");
  const [selectedMilestoneTitle, setSelectedMilestoneTitle] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<ProjectAction | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [pendingDeleteMilestone, setPendingDeleteMilestone] = useState<{ itemId: string; milestone: Milestone } | null>(null);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<{ milestoneId: string; action: ProjectAction } | null>(null);
  const [loadingIds, setLoadingIds] = useState({
    candidateActionId: "",
    doneActionId: "",
    deletingActionId: "",
    deletingItemId: "",
    closingItemId: "",
    restoringItemId: "",
  });

  const answerEntityId = answerQuery ? getEntityId(answerQuery) : "";
  const { data: fundingEnvelopeData, refetch: refetchFundingEnvelope } = useFundingEnvelope(answerEntityId);
  const cagnottePerms = useCagnottePermissions(entity, {
    hasActiveItems: (funding?.items || []).some((m: any) => m.status !== "close"),
    resourceId: answerEntityId,
  });

  const resolvedProjectId = funding?.projectId || "";
  const resolvedAnswerId = funding?.answerId || answerEntityId || "";
  const canManageActions = canManageObjectiveActions(resolvedProjectId);
  const isConnected = cagnottePerms.isConnected;
  const currentUserId = me?.serverData?.id ?? cagnottePerms.currentUserId;
  const { requireConnected, requireApiAacContext } = useActionGuards({
    isConnected,
    apiClient,
    projectId: resolvedProjectId,
    answerId: resolvedAnswerId,
  });

  const actionCtx = useMemo(() => ({ api, projectId: resolvedProjectId, project: projectEntity }), [api, resolvedProjectId, projectEntity]);
  const milestoneCtx = useMemo(() => ({ api, rawEnvelope: fundingEnvelopeData?.rawEnvelope ?? null, projectId: resolvedProjectId, answerId: resolvedAnswerId }), [api, fundingEnvelopeData?.rawEnvelope, resolvedProjectId, resolvedAnswerId]);

  const candidateActionMutation = useCandidateAction(actionCtx);
  const markActionDoneMutation = useMarkActionDone(actionCtx);
  const deleteActionMutation = useDeleteAction(actionCtx);

  const activeEditMilestoneMutation = useEditMilestone(milestoneCtx);
  const closeMilestoneMutation = useCloseMilestone(milestoneCtx);
  const deleteMilestoneMutation = useDeleteMilestone(milestoneCtx);
  const restoreMilestoneMutation = useRestoreMilestone(milestoneCtx);

  const handleCloseMilestone = (itemId: string, milestone: Milestone) => {
    if (!requireConnected("closeMilestone")) return;
    if (!requireApiAacContext("closeMilestone")) return;
    setLoadingIds((prev) => ({ ...prev, closingItemId: itemId }));
    closeMilestoneMutation.mutate({ milestoneId: milestone.id, name: milestone.title, answerDepenseIndex: typeof milestone.answerDepenseIndex === "number" ? milestone.answerDepenseIndex : undefined }, {
      onSuccess: async () => { await refetchFundingEnvelope(); },
      onSettled: () => setLoadingIds((prev) => ({ ...prev, closingItemId: "" })),
    });
  };

  const requestDeleteMilestone = (itemId: string, milestone: Milestone) => {
    if (!requireConnected("deleteMilestone")) return;
    if (!requireApiAacContext("deleteMilestone")) return;
    setPendingDeleteMilestone({ itemId, milestone });
  };

  const handleRestoreMilestone = (itemId: string, milestone: Milestone) => {
    if (!requireConnected("restoreMilestone")) return;
    if (!requireApiAacContext("restoreMilestone")) return;
    setLoadingIds((prev) => ({ ...prev, restoringItemId: itemId }));
    restoreMilestoneMutation.mutate(
      { milestoneId: milestone.id, name: milestone.title, answerDepenseIndex: typeof milestone.answerDepenseIndex === "number" ? milestone.answerDepenseIndex : undefined },
      {
        onSuccess: async () => { await refetchFundingEnvelope(); },
        onSettled: () => {
          setLoadingIds((prev) => ({ ...prev, restoringItemId: "" }));
        },
      },
    );
  };

  const cancelDeleteMilestone = () => setPendingDeleteMilestone(null);

  const confirmDeleteMilestone = () => {
    if (!pendingDeleteMilestone) return;
    const { itemId, milestone } = pendingDeleteMilestone;
    setLoadingIds((prev) => ({ ...prev, deletingItemId: itemId }));
    deleteMilestoneMutation.mutate({ milestoneId: milestone.id, name: milestone.title, answerDepenseIndex: typeof milestone.answerDepenseIndex === "number" ? milestone.answerDepenseIndex : undefined }, {
      onSuccess: async () => { await refetchFundingEnvelope(); },
      onSettled: () => {
        setLoadingIds((prev) => ({ ...prev, deletingItemId: "" }));
        setPendingDeleteMilestone(null);
      },
    });
  };

  const resolveProjectEntityForModal = useCallback(async (projectId?: string): Promise<Project | null> => {
    const effectiveProjectId = String(projectId ?? resolvedProjectId ?? "").trim();
    if (!effectiveProjectId) {
      return null;
    }

    const candidate = getModalProjectEntityCandidate(profileProjectEntity, projectEntity, effectiveProjectId);
    if (candidate) {
      if (projectEntity !== candidate) {
        setProjectEntity(candidate);
      }
      return candidate;
    }

    if (!me && !api) {
      return null;
    }

    try {
      const fetchedProjectEntity = (me
        ? await me.project({ id: effectiveProjectId })
        : await api!.project({ id: effectiveProjectId })) as Project;
      setProjectEntity(fetchedProjectEntity);
      return fetchedProjectEntity;
    } catch (error) {
      console.warn("Unable to resolve project entity for AAC modal", error);
      return null;
    }
  }, [api, me, profileProjectEntity, projectEntity, resolvedProjectId]);

  const openCreateActionModal = async (milestoneId: string, milestoneTitle: string) => {
    if (!canManageActions) return;
    if (!requireConnected("openCreateAction")) return;
    if (!requireApiAacContext("openCreateAction")) return;

    const resolvedEntity = await resolveProjectEntityForModal(resolvedProjectId);
    if (!resolvedEntity && resolvedProjectId) return;

    setSelectedMilestoneId(milestoneId);
    setSelectedMilestoneTitle(milestoneTitle);
    setIsCreateActionOpen(true);
  };

  const openCreateMilestoneModal = () => {
    if (!requireConnected("createMilestone")) return;
    if (!requireApiAacContext("createMilestone")) return;
    setIsCreateMilestoneOpen(true);
  };

  const openEditMilestoneModal = (milestone: Milestone) => {
    if (!requireConnected("editMilestone")) return;
    if (!requireApiAacContext("editMilestone")) return;
    setSelectedMilestone(milestone);
    setIsEditMilestoneOpen(true);
  };

  const handleCreateAction = (milestoneId: string, milestoneTitle: string) => {
    openCreateActionModal(milestoneId, milestoneTitle);
  };

  const handleActionCandidate = (_milestoneId: string, action: ProjectAction) => {
    if (!requireConnected("candidate")) return;
    if (!requireApiAacContext("candidate")) return;
    setLoadingIds((prev) => ({ ...prev, candidateActionId: action.id }));
    candidateActionMutation.mutate({ actionId: action.id }, {
      onSuccess: async () => {
        await refetchFundingEnvelope();
      },
      onSettled: () => setLoadingIds((prev) => ({ ...prev, candidateActionId: "" })),
    });
  };

  const handleActionDone = (_milestoneId: string, action: ProjectAction) => {
    if (!requireConnected("complete")) return;
    if (!requireApiAacContext("complete")) return;
    setLoadingIds((prev) => ({ ...prev, doneActionId: action.id }));
    markActionDoneMutation.mutate({ actionId: action.id, name: action.name }, {
      onSuccess: async () => {
        await refetchFundingEnvelope();
      },
      onSettled: () => setLoadingIds((prev) => ({ ...prev, doneActionId: "" })),
    });
  };

  const requestDeleteAction = (milestoneId: string, action: ProjectAction) => {
    if (!requireConnected("delete")) return;
    if (!requireApiAacContext("delete")) return;
    setPendingDeleteAction({ milestoneId, action });
  };

  const cancelDeleteAction = () => setPendingDeleteAction(null);

  const confirmDeleteAction = () => {
    if (!pendingDeleteAction) return;
    const { action } = pendingDeleteAction;
    setLoadingIds((prev) => ({ ...prev, deletingActionId: action.id }));
    deleteActionMutation.mutate({ actionId: action.id, name: action.name }, {
      onSuccess: async () => {
        await refetchFundingEnvelope();
      },
      onSettled: () => {
        setLoadingIds((prev) => ({ ...prev, deletingActionId: "" }));
        setPendingDeleteAction(null);
      },
    });
  };

  const handleActionEdit = async (milestoneId: string, milestoneTitle: string, action: ProjectAction) => {
    if (!canManageActions) return;
    if (!requireConnected("editAction")) return;
    if (!requireApiAacContext("editAction")) return;

    const resolvedEntity = await resolveProjectEntityForModal(resolvedProjectId);
    if (!resolvedEntity && resolvedProjectId) return;

    setSelectedAction(action);
    setSelectedMilestoneId(milestoneId);
    setSelectedMilestoneTitle(milestoneTitle);
    setIsEditActionOpen(true);
  };

  const handleMilestoneEditSuccess = async () => {
    await refetchFundingEnvelope();
  };

  const milestoneEditInitialValues = useMemo<MilestoneEditFormData | null>(() => {
    if (!selectedMilestone) return null;
    return {
      name: selectedMilestone.title,
      description: selectedMilestone.description ?? "",
      status: selectedMilestone.status,
      targetAmount: selectedMilestone.targetAmount ?? 0,
    };
  }, [selectedMilestone]);

  const existingMilestoneIds = useMemo(() => (funding?.items ?? []).map((item: any) => String(item.milestoneId ?? item.itemId ?? "")), [funding?.items]);

  return {
    // Permissions / contexte
    cagnottePerms,
    canManageActions,
    isConnected,
    currentUserId,
    resolvedProjectId,
    resolvedAnswerId,
    projectEntity,
    actionCtx,

    // Etats de chargement (spinners par id)
    loadingIds,

    // Dialogs : etat d'ouverture
    isCreateActionOpen,
    setIsCreateActionOpen,
    isEditActionOpen,
    setIsEditActionOpen,
    isEditMilestoneOpen,
    setIsEditMilestoneOpen,
    isCreateMilestoneOpen,
    setIsCreateMilestoneOpen,
    selectedMilestoneId,
    selectedMilestoneTitle,
    selectedAction,
    selectedMilestone,
    setSelectedMilestone,
    milestoneEditInitialValues,
    existingMilestoneIds,
    activeEditMilestoneMutation,

    // Confirmation de suppression (palier / action) en attente
    pendingDeleteMilestone,
    cancelDeleteMilestone,
    confirmDeleteMilestone,
    pendingDeleteAction,
    cancelDeleteAction,
    confirmDeleteAction,

    // Handlers paliers
    openCreateMilestoneModal,
    openEditMilestoneModal,
    handleCloseMilestone,
    handleDeleteMilestone: requestDeleteMilestone,
    handleMilestoneEditSuccess,
    handleRestoreMilestone,

    // Handlers actions
    handleCreateAction,
    handleActionCandidate,
    handleActionDone,
    handleActionDelete: requestDeleteAction,
    handleActionEdit,

    // Divers
    refetchFundingEnvelope,
  };
}
