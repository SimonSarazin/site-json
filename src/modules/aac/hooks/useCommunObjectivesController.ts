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
import { useDeleteMilestone, useEditMilestone, useCloseMilestone } from "@/modules/cagnotte/actions/mutations";
import {
  useEditMilestoneAnswerOnly,
  useDeleteMilestoneAnswerOnly,
} from "@/modules/cagnotte/actions/mutations/milestone";
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
  const [loadingIds, setLoadingIds] = useState({
    candidateActionId: "",
    doneActionId: "",
    deletingActionId: "",
    deletingMilestoneId: "",
    closingMilestoneId: "",
  });

  // getEntityId() gère les deux formes possibles de CoFormAnswer._id (string brute
  // ou { $id }) — String(answerQuery?._id) produirait "[object Object]" dans le
  // second cas.
  const answerEntityId = answerQuery ? getEntityId(answerQuery) : "";
  const { data: fundingEnvelopeData, refetch: refetchFundingEnvelope } = useFundingEnvelope(answerEntityId);
  const cagnottePerms = useCagnottePermissions(entity, {
    hasActiveItems: (funding?.items || []).some((m: any) => m.status !== "close"),
    resourceId: answerEntityId,
  });

  const resolvedProjectId = funding?.projectId || "";
  const resolvedAnswerId = funding?.answerId || "";
  const canManageActions = canManageObjectiveActions(resolvedProjectId);
  const isConnected = cagnottePerms.isConnected;
  const currentUserId = me?.serverData?.id ?? cagnottePerms.currentUserId;
  const { requireConnected, requireApiContext } = useActionGuards({
    isConnected,
    apiClient,
    projectId: resolvedProjectId,
    answerId: resolvedAnswerId,
  });

  const actionCtx = useMemo(() => ({ api, projectId: resolvedProjectId, project: projectEntity }), [api, resolvedProjectId, projectEntity]);
  const milestoneCtx = useMemo(() => ({ api, rawEnvelope: fundingEnvelopeData?.rawEnvelope ?? null, projectId: resolvedProjectId, answerId: resolvedAnswerId }), [api, fundingEnvelopeData?.rawEnvelope, resolvedProjectId, resolvedAnswerId]);
  const answerOnlyCtx = useMemo(() => ({ api, answerId: resolvedAnswerId }), [api, resolvedAnswerId]);

  const candidateActionMutation = useCandidateAction(actionCtx);
  const markActionDoneMutation = useMarkActionDone(actionCtx);
  const deleteActionMutation = useDeleteAction(actionCtx);

  // Deux jeux de mutations milestone, toujours instanciés (les hooks ne peuvent pas être
  // conditionnels) : celles qui synchronisent projet + answer, et celles answer-only. On
  // sélectionne laquelle utiliser à l'appel, selon canManageActions (= projectId présent).
  const editMilestoneMutation = useEditMilestone(milestoneCtx);
  const editMilestoneAnswerOnlyMutation = useEditMilestoneAnswerOnly(answerOnlyCtx);
  const activeEditMilestoneMutation = canManageActions ? editMilestoneMutation : editMilestoneAnswerOnlyMutation;

  const closeMilestoneMutation = useCloseMilestone(milestoneCtx);

  const deleteMilestoneMutation = useDeleteMilestone(milestoneCtx);
  const deleteMilestoneAnswerOnlyMutation = useDeleteMilestoneAnswerOnly(answerOnlyCtx);
  const activeDeleteMilestoneMutation = canManageActions ? deleteMilestoneMutation : deleteMilestoneAnswerOnlyMutation;

  const handleCloseMilestone = (milestone: Milestone) => {
    // Pas de fermeture answer-only : ni demandé, ni de sémantique "close" définie
    // côté answer pour l'instant (include:false existe pour l'edit, mais fermer un
    // palier est un concept différent d'un simple statut).
    if (!canManageActions) return;
    if (!requireConnected("closeMilestone")) return;
    if (!requireApiContext("closeMilestone")) return;
    setLoadingIds((prev) => ({ ...prev, closingMilestoneId: milestone.id }));
    closeMilestoneMutation.mutate({ milestoneId: milestone.id, name: milestone.title }, {
      onSuccess: async () => { await refetchFundingEnvelope(); },
      onSettled: () => setLoadingIds((prev) => ({ ...prev, closingMilestoneId: "" })),
    });
  };

  const handleDeleteMilestone = (milestone: Milestone) => {
    if (!requireConnected("deleteMilestone")) return;
    if (!requireApiContext("deleteMilestone")) return;
    setLoadingIds((prev) => ({ ...prev, deletingMilestoneId: milestone.id }));
    activeDeleteMilestoneMutation.mutate({ milestoneId: milestone.id, name: milestone.title }, {
      onSuccess: async () => { await refetchFundingEnvelope(); },
      onSettled: () => setLoadingIds((prev) => ({ ...prev, deletingMilestoneId: "" })),
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
      // me.project(...) plutôt que api.project(...) : le constructeur du SDK
      // parente la nouvelle entité Project par son 1er argument, et userContext
      // n'est posé à l'utilisateur connecté que si ce parent est un User.
      // api.project() parente par l'ApiClient brut -> userContext reste null ->
      // project.isAdmin() (utilisé par project.action() pour créer une action)
      // renvoie toujours false, même pour un admin réel du projet — c'est la
      // cause du "Vous n'avez pas les droits pour créer une action dans ce
      // projet" observé ici alors que ActionsSection (qui récupère son
      // projectEntity via le profil déjà chargé, donc déjà correctement
      // parenté) fonctionne.
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
    if (!requireApiContext("openCreateAction")) return;

    const resolvedEntity = await resolveProjectEntityForModal(resolvedProjectId);
    if (!resolvedEntity && resolvedProjectId) return;

    setSelectedMilestoneId(milestoneId);
    setSelectedMilestoneTitle(milestoneTitle);
    setIsCreateActionOpen(true);
  };

  const openCreateMilestoneModal = () => {
    if (!requireConnected("createMilestone")) return;
    if (!requireApiContext("createMilestone")) return;
    setIsCreateMilestoneOpen(true);
  };

  const openEditMilestoneModal = (milestone: Milestone) => {
    if (!requireConnected("editMilestone")) return;
    // requireApiContext a été construit avec resolvedProjectId — à vérifier qu'il ne
    // bloque pas aussi le cas answer-only (projectId vide) ; je n'ai pas useActionGuards
    // pour le confirmer. S'il bloque, il faut soit un requireApiContext plus permissif
    // ici, soit ne pas l'appeler du tout quand !canManageActions.
    if (!requireApiContext("editMilestone")) return;
    setSelectedMilestone(milestone);
    setIsEditMilestoneOpen(true);
  };

  const handleCreateAction = (milestoneId: string, milestoneTitle: string) => {
    openCreateActionModal(milestoneId, milestoneTitle);
  };

  const handleActionCandidate = (_milestoneId: string, action: ProjectAction) => {
    if (!requireConnected("candidate")) return;
    if (!requireApiContext("candidate")) return;
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
    if (!requireApiContext("complete")) return;
    setLoadingIds((prev) => ({ ...prev, doneActionId: action.id }));
    markActionDoneMutation.mutate({ actionId: action.id, name: action.name }, {
      onSuccess: async () => {
        await refetchFundingEnvelope();
      },
      onSettled: () => setLoadingIds((prev) => ({ ...prev, doneActionId: "" })),
    });
  };

  const handleActionDelete = (_milestoneId: string, action: ProjectAction) => {
    if (!requireConnected("delete")) return;
    if (!requireApiContext("delete")) return;
    setLoadingIds((prev) => ({ ...prev, deletingActionId: action.id }));
    deleteActionMutation.mutate({ actionId: action.id, name: action.name }, {
      onSuccess: async () => {
        await refetchFundingEnvelope();
      },
      onSettled: () => setLoadingIds((prev) => ({ ...prev, deletingActionId: "" })),
    });
  };

  const handleActionEdit = async (milestoneId: string, milestoneTitle: string, action: ProjectAction) => {
    if (!canManageActions) return;
    if (!requireConnected("editAction")) return;
    if (!requireApiContext("editAction")) return;

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

    // Handlers paliers
    openCreateMilestoneModal,
    openEditMilestoneModal,
    handleCloseMilestone,
    handleDeleteMilestone,
    handleMilestoneEditSuccess,

    // Handlers actions
    handleCreateAction,
    handleActionCandidate,
    handleActionDone,
    handleActionDelete,
    handleActionEdit,

    // Divers
    refetchFundingEnvelope,
  };
}
