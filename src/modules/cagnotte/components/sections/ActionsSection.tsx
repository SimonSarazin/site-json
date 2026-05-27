import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionsSectionProps } from '@/modules/cagnotte/schema';
import { useFundingEnvelope } from '@/modules/cagnotte/hooks/useFundingEnvelope';
import { useCocolight } from '@/hooks/useCocolight';
import { useT } from '@/hooks/useT';
import { useLoadNamespace } from '@/hooks/useLoadNamespace';
import { showErrorToast } from '@/lib/toastUtils';
import { resolveMilestoneSyncContext } from '@/modules/cagnotte/lib/milestoneSyncContext';
import {
  useEditMilestone,
  useCloseMilestone,
  useDeleteMilestone,
  useRestoreMilestone,
  useCandidateAction,
  useMarkActionDone,
  useDeleteAction,
} from '@/modules/cagnotte/actions/mutations';
import { useCagnottePermissions } from '@/modules/cagnotte/hooks/useCagnottePermissions';
import { useCagnotteContext } from '@/modules/cagnotte/hooks/useCagnotteContext';
import { useActionGuards } from '@/modules/cagnotte/hooks/useActionGuards';
import { useOptionalProfileEntity } from '@/modules/profil/hooks/useProfileEntity';
import { isProject } from '@/lib/getTypedEntity';
import type { Project } from '@communecter/cocolight-api-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MilestoneEditDialog } from './parts/MilestoneEditDialog';
import { ActionEditDialog } from './parts/ActionEditDialog';
import { ActionCreateDialog } from './parts/ActionCreateDialog';
import { MilestoneCard } from './parts/MilestoneCard';
import { ClosedMilestonesSection } from './parts/ClosedMilestonesSection';
import { getSelectedProjectIdByProfileSlug } from '@/lib/fundingProjectUtils';

import type {
  FundingMilestone as Milestone,
  FundingAction as ProjectAction,
  EditActionContext,
  PendingDeleteActionContext,
} from '@/modules/cagnotte/types';
import {
  isValidEntityId,
  resolveActionEntityId,
} from '@/modules/cagnotte/lib/actionIdResolvers';

type ScrollTarget =
  | { type: 'milestone'; milestoneId: string }
  | { type: 'action'; milestoneId: string; actionId: string; section: 'active' | 'done' };

/**
 * Highlight visuel temporaire (anneau + scrollIntoView) sur un milestone ou une action
 * fraîchement créée/éditée. Utilisé par l'effet de `pendingScrollTarget`.
 */
function highlightAndScroll(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
  window.setTimeout(() => {
    element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
  }, 1600);
}

export default function ActionsSection({ id, props }: { id?: string; props: ActionsSectionProps }) {
  useLoadNamespace('modules/cagnotte');
  const t = useT('modules/cagnotte');
  const fmtDate = (ts: number) => format(new Date(ts), 'dd MMM yyyy', { locale: fr });


  // Charger d'abord tous les projets pour trouver le sélectionné par slug
  const { data: fundingData, isLoading, error, refetch: refetchFundingEnvelope } = useFundingEnvelope(id);
  
  // Déterminer le selectedProjectId via recherche par slug de profil
  const selectedProjectId = getSelectedProjectIdByProfileSlug(fundingData?.projects || []) || fundingData?.selectedProject?.id || '';

  const { apiClient, api, entity } = useCocolight();
  // Création d'action : seuls subsistent l'open/close + l'identifiant du milestone ciblé.
  // Le form (name, credits, status, tags, contributors, dates) vit maintenant dans
  // `ActionCreateDialog` via `useForm<ActionCreateFormData>` + zodResolver.
  const [isCreateActionOpen, setIsCreateActionOpen] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  // Édition d'action : seuls subsistent l'open/close + le contexte de l'action ciblée.
  // Le form (name, credits, status, tags, contributors, dates) vit dans `ActionEditDialog`
  // via `useForm<ActionEditFormData>` + zodResolver + `calculateActionDiff`.
  const [isEditActionOpen, setIsEditActionOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<EditActionContext | null>(null);
  const [isEditMilestoneOpen, setIsEditMilestoneOpen] = useState(false);
  const [milestoneEditTarget, setMilestoneEditTarget] = useState<{
    milestoneId: string;
    initialValues: import('@/modules/cagnotte/schemaForm').MilestoneEditFormData;
  } | null>(null);
  const [candidateActionId, setCandidateActionId] = useState<string>('');
  const [doneActionId, setDoneActionId] = useState<string>('');
  const [deletingActionId, setDeletingActionId] = useState<string>('');
  const [pendingDeleteAction, setPendingDeleteAction] = useState<PendingDeleteActionContext | null>(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string>('');
  const [closingMilestoneId, setClosingMilestoneId] = useState<string>('');
  const [pendingDeleteMilestone, setPendingDeleteMilestone] = useState<Milestone | null>(null);
  const [expandedActiveMilestoneIds, setExpandedActiveMilestoneIds] = useState<string[]>([]);
  const [expandedDoneMilestoneIds, setExpandedDoneMilestoneIds] = useState<string[]>([]);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<ScrollTarget | null>(null);
  const [restoringMilestoneId, setRestoringMilestoneId] = useState('');
  const [showClosedMilestones, setShowClosedMilestones] = useState(false);
  const milestoneCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const actionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Sur une page profil, l'entité de référence pour les permissions est CELLE
  // DU PROFIL (le projet visité), pas l'entité globale Cocolight (l'orga du site).
  const profileCtx = useOptionalProfileEntity();
  const permissionEntity = profileCtx?.entity ?? entity;
  // Project Entity pour le picker de contributeurs (`SelectMember`) dans les dialogs
  // d'action. Sur une page profil project, c'est directement l'entité du profil.
  // Sinon `null` → le picker est désactivé (cas marginal, cagnotte est toujours
  // dans un tab profil project).
  const projectEntity: Project | null =
    profileCtx?.entity && isProject(profileCtx.entity) ? profileCtx.entity : null;
  const cagnottePerms = useCagnottePermissions(permissionEntity, {
    hasActiveMilestones: (fundingData?.milestones ?? []).some((m) => (m as { status?: string }).status !== 'close'),
    projectId: String(fundingData?.selectedProject?.id || id || '').trim(),
  });
  const cagnotteCtx = useCagnotteContext();
  const isConnected = cagnottePerms.isConnected;
  const currentUserId = cagnottePerms.currentUserId;
  // `currentUserName` n'est plus nécessaire depuis la migration `useCandidateAction` vers
  // `action.joinContributor()` du SDK (qui self-join le user connecté côté serveur).

  // Contextes pour les mutations factory.
  // Le projectId / answerId effectifs sont calculés en flux (selectedProjectId est dérivé plus haut).
  const resolvedProjectId = fundingData?.selectedProject?.id || selectedProjectId || id || '';
  const resolvedAnswerId = fundingData?.selectedProject?.answerId || '';
  const { requireConnected, requireApiContext } = useActionGuards({
    isConnected,
    apiClient,
    projectId: resolvedProjectId,
    answerId: resolvedAnswerId,
  });
  const milestoneCtx = {
    api,
    rawEnvelope: fundingData?.rawEnvelope,
    projectId: resolvedProjectId,
    answerId: resolvedAnswerId,
  };
  const actionCtx = {
    api,
    projectId: resolvedProjectId,
    // Entité Project SDK Cocolight requise par toutes les mutations action (API
    // entity-oriented : `project.action()` — cf. mutations/action.ts).
    project: projectEntity,
  };

  const editMilestoneMutation = useEditMilestone(milestoneCtx);
  const deleteMilestoneMutation = useDeleteMilestone(milestoneCtx);
  const closeMilestoneMutation = useCloseMilestone(milestoneCtx);
  const restoreMilestoneMutation = useRestoreMilestone(milestoneCtx);
  const candidateActionMutation = useCandidateAction(actionCtx);
  const markActionDoneMutation = useMarkActionDone(actionCtx);
  const deleteActionMutation = useDeleteAction(actionCtx);

  const data = useMemo<{ milestones: Milestone[] }>(() => {
    const maxItems = props?.maxItems ?? 10;
    return {
      milestones: (fundingData?.milestones ?? []).slice(0, maxItems) as Milestone[],
    };
  }, [fundingData?.milestones, props?.maxItems]);
  const openMilestones = useMemo(
      () => data.milestones.filter((milestone) => milestone.status !== 'close'),
      [data.milestones]
    );
  const closedMilestones = useMemo(
    () => data.milestones.filter((milestone) => milestone.status === 'close'),
    [data.milestones]
  );

  const handleRestoreMilestone = (milestone: Milestone) => {
    if (!requireConnected('restore')) return;
    if (!requireApiContext('restoreImpossible')) return;

    setRestoringMilestoneId(milestone.id);
    restoreMilestoneMutation.mutate(
      { milestoneId: milestone.id, name: milestone.title },
      {
        onSuccess: () => {
          void refetchFundingEnvelope();
        },
        onSettled: () => {
          setRestoringMilestoneId('');
        },
      },
    );
  };

  useEffect(() => {
    const selectedProjectId = String(fundingData?.selectedProject?.id ?? '').trim();
    const offEdit = cagnotteCtx.onEditMilestoneRequest((detail) => {
      const milestoneId = String(detail?.milestoneId ?? '').trim();
      const eventProjectId = String(detail?.projectId ?? '').trim();
      if (!milestoneId) return;
      if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
      const target = data.milestones.find((milestone) => milestone.id === milestoneId);
      if (target) openEditMilestoneModal(target);
    });
    const offDelete = cagnotteCtx.onDeleteMilestoneRequest((detail) => {
      const milestoneId = String(detail?.milestoneId ?? '').trim();
      const eventProjectId = String(detail?.projectId ?? '').trim();
      if (!milestoneId) return;
      if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
      const target = data.milestones.find((milestone) => milestone.id === milestoneId);
      if (target) setPendingDeleteMilestone(target);
    });
    return () => {
      offEdit();
      offDelete();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.milestones, fundingData?.selectedProject?.id, cagnotteCtx]);

  useEffect(() => {
    return cagnotteCtx.onScrollToMilestone((detail) => {
      const milestoneId = String(detail?.milestoneId ?? '').trim();
      const eventProjectId = String(detail?.projectId ?? '').trim();
      const selectedProjectId = String(fundingData?.selectedProject?.id ?? '').trim();
      if (!milestoneId) return;
      if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
      setPendingScrollTarget({ type: 'milestone', milestoneId });
    });
  }, [fundingData?.selectedProject?.id, cagnotteCtx]);

  useEffect(() => {
    if (!pendingScrollTarget) return;

    if (pendingScrollTarget.type === 'action') {
      const currentExpanded =
        pendingScrollTarget.section === 'active' ? expandedActiveMilestoneIds : expandedDoneMilestoneIds;
      if (!currentExpanded.includes(pendingScrollTarget.milestoneId)) {
        if (pendingScrollTarget.section === 'active') {
          setExpandedActiveMilestoneIds((prev) => (prev.includes(pendingScrollTarget.milestoneId) ? prev : [...prev, pendingScrollTarget.milestoneId]));
        } else {
          setExpandedDoneMilestoneIds((prev) => (prev.includes(pendingScrollTarget.milestoneId) ? prev : [...prev, pendingScrollTarget.milestoneId]));
        }
        return;
      }

      const actionElement = actionCardRefs.current[pendingScrollTarget.actionId];
      if (!actionElement) return;

      const timer = window.setTimeout(() => {
        highlightAndScroll(actionElement);
        setPendingScrollTarget(null);
      }, 80);

      return () => window.clearTimeout(timer);
    }

    const milestoneElement = milestoneCardRefs.current[pendingScrollTarget.milestoneId];
    if (!milestoneElement) return;

    const timer = window.setTimeout(() => {
      highlightAndScroll(milestoneElement);
      setPendingScrollTarget(null);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [expandedActiveMilestoneIds, expandedDoneMilestoneIds, pendingScrollTarget, data.milestones]);

  const selectedMilestone = data.milestones.find((milestone) => milestone.id === selectedMilestoneId);

  const openCreateActionModal = (milestoneId: string) => {
    if (!requireConnected('openCreateAction')) return;

    // Le form (name, credits, status, tags, contributors, dates) est reset par
    // `ActionCreateDialog` via son `useEffect` à l'ouverture. Le parent ne pousse
    // que le `milestoneId` cible et l'état `open`.
    setSelectedMilestoneId(milestoneId);
    setIsCreateActionOpen(true);
  };

  const openEditMilestoneModal = (milestone: Milestone) => {
    if (!requireConnected('edit')) return;

    const projectId = fundingData?.selectedProject?.id || selectedProjectId || '';
    const answerId = fundingData?.selectedProject?.answerId || '';
    const syncContext = resolveMilestoneSyncContext({
      rawEnvelope: fundingData?.rawEnvelope,
      projectId,
      answerId,
      milestoneId: milestone.id,
    });

    setMilestoneEditTarget({
      milestoneId: milestone.id,
      initialValues: {
        name: milestone.title,
        description: syncContext?.description || '',
        targetAmount: milestone.targetAmount || 0,
        status: milestone.status,
      },
    });
    setIsEditMilestoneOpen(true);
  };

  const handleDeleteMilestone = (milestone: Milestone) => {
    if (!requireConnected('delete')) return;
    if (!requireApiContext('deleteImpossible')) return;

    setDeletingMilestoneId(milestone.id);
    deleteMilestoneMutation.mutate(
      { milestoneId: milestone.id, name: milestone.title },
      {
        onSuccess: () => {
          void refetchFundingEnvelope();
        },
        onSettled: () => {
          setDeletingMilestoneId('');
          setPendingDeleteMilestone(null);
        },
      },
    );
  };

  const handleCloseMilestone = (milestone: Milestone) => {
    if (!requireConnected('close')) return;

    const hasActions = milestone.actions.length > 0;
    const allActionsDone = hasActions && milestone.actions.every((action) => action.status === 'done');
    if (!(allActionsDone || !hasActions)) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.closeImpossible.descriptionActionsNotDone'))),
        'ActionsSection.toasts.closeImpossible.title',
        t,
      );
      return;
    }

    if (!apiClient || !resolvedProjectId || !resolvedAnswerId) {
      // Variation locale : description spécifique au cas closeImpossible/Context (vs guard générique).
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.closeImpossible.descriptionContext'))),
        'ActionsSection.toasts.closeImpossible.title',
        t,
      );
      return;
    }

    setClosingMilestoneId(milestone.id);
    closeMilestoneMutation.mutate(
      { milestoneId: milestone.id, name: milestone.title },
      {
        onSuccess: () => {
          void refetchFundingEnvelope();
        },
        onSettled: () => {
          setClosingMilestoneId('');
        },
      },
    );
  };

  const handleCandidateAction = (milestoneId: string, action: ProjectAction) => {
    if (!requireConnected('candidate')) return;

    if (!apiClient) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.apiClientUnavailable.descriptionContributors'))),
        'ActionsSection.toasts.apiClientUnavailable.title',
        t,
      );
      return;
    }

    if (!currentUserId) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.userNotFound.description'))),
        'ActionsSection.toasts.userNotFound.title',
        t,
      );
      return;
    }

    const actionId = resolveActionEntityId({
      action,
      milestoneId,
      projectId: resolvedProjectId,
      rawEnvelope: fundingData?.rawEnvelope,
    });

    if (!isValidEntityId(actionId)) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.actionNotFound.descriptionUpdate'))),
        'ActionsSection.toasts.actionNotFound.title',
        t,
      );
      return;
    }

    const alreadyContributor = action.contributors.some((contributor) => contributor.id === currentUserId);
    if (alreadyContributor) return;

    setCandidateActionId(actionId);
    candidateActionMutation.mutate(
      { actionId },
      {
        onSuccess: () => {
          void refetchFundingEnvelope();
        },
        onSettled: () => {
          setCandidateActionId('');
        },
      },
    );
  };

  const handleMarkActionDone = (milestoneId: string, action: ProjectAction) => {
    if (!requireConnected('completeAction')) return;

    if (!apiClient) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.apiClientUnavailable.descriptionStatus'))),
        'ActionsSection.toasts.apiClientUnavailable.title',
        t,
      );
      return;
    }

    const actionId = resolveActionEntityId({
      action,
      milestoneId,
      projectId: resolvedProjectId,
      rawEnvelope: fundingData?.rawEnvelope,
    });

    if (!isValidEntityId(actionId)) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.actionNotFound.descriptionComplete'))),
        'ActionsSection.toasts.actionNotFound.title',
        t,
      );
      return;
    }

    if (action.status === 'done') return;

    setDoneActionId(actionId);
    markActionDoneMutation.mutate(
      { actionId, name: action.name },
      {
        onSuccess: () => {
          void refetchFundingEnvelope();
        },
        onSettled: () => {
          setDoneActionId('');
        },
      },
    );
  };

  const handleDeleteAction = (milestoneId: string, action: ProjectAction) => {
    if (!requireConnected('deleteAction')) return;

    if (!apiClient) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.apiClientUnavailable.descriptionDeleteAction'))),
        'ActionsSection.toasts.apiClientUnavailable.title',
        t,
      );
      return;
    }

    const actionId = resolveActionEntityId({
      action,
      milestoneId,
      projectId: resolvedProjectId,
      rawEnvelope: fundingData?.rawEnvelope,
    });

    if (!isValidEntityId(actionId)) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.actionNotFound.descriptionDelete'))),
        'ActionsSection.toasts.actionNotFound.title',
        t,
      );
      return;
    }

    setDeletingActionId(actionId);
    deleteActionMutation.mutate(
      { actionId, name: action.name },
      {
        onSuccess: () => {
          void refetchFundingEnvelope();
        },
        onSettled: () => {
          setDeletingActionId('');
        },
      },
    );
  };

  const confirmDeletePendingAction = () => {
    if (!pendingDeleteAction) return;
    handleDeleteAction(pendingDeleteAction.milestoneId, pendingDeleteAction.action);
    setPendingDeleteAction(null);
  };

  // Note : la logique de création d'action (endpoint + fallback HTTP + résolution ID + metadata)
  // a été déplacée dans `useCreateAction` (src/modules/cagnotte/actions/mutations/action.ts).
  // Le `ActionCreateDialog` autonome consomme directement cette mutation et notifie le parent
  // via `onSuccess({ actionId, status })` pour le scroll target.

  const openEditActionModal = (milestoneId: string, action: ProjectAction) => {
    if (!requireConnected('editAction')) return;

    const parentId = fundingData?.selectedProject?.id || selectedProjectId || '';
    const resolvedActionId = resolveActionEntityId({
      action,
      milestoneId,
      projectId: parentId,
      rawEnvelope: fundingData?.rawEnvelope,
    });

    if (!isValidEntityId(resolvedActionId)) {
      showErrorToast(
        new Error(String(t('ActionsSection.toasts.editImpossible.description'))),
        'ActionsSection.toasts.editImpossible.title',
        t,
      );
      return;
    }

    // Le form (name, credits, status, tags, contributors, dates) est initialisé par
    // `ActionEditDialog` via son `useMemo(defaultValues)` à chaque ouverture. Le parent
    // ne pousse que le contexte de l'action ciblée.
    setEditingAction({ milestoneId, action, actionEntityId: resolvedActionId });
    setIsEditActionOpen(true);
  };

  // Note : la logique d'édition d'action (validation + diff + mutation) a été déplacée
  // dans `ActionEditDialog` autonome (RHF + zodResolver + `calculateActionDiff`).

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <Card key={index} className="border border-primary/10">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-6 w-24" />
              </div>
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{String(t('ActionsSection.error'))}</p>;
  }

  if (data.milestones.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{String(t('ActionsSection.emptyActions'))}</p>;
  }

  return (
    <>
      <ConfirmDialog
        open={!!pendingDeleteMilestone}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMilestone(null);
        }}
        title={String(t('ActionsSection.deleteMilestoneConfirm.title'))}
        description={
          pendingDeleteMilestone
            ? String(t('ActionsSection.deleteMilestoneConfirm.description', undefined, { name: pendingDeleteMilestone.title }))
            : ''
        }
        confirmLabel={String(t('ActionsSection.deleteMilestoneConfirm.confirm'))}
        cancelLabel={String(t('ActionsSection.deleteMilestoneConfirm.cancel'))}
        isDestructive
        isPending={
          !!pendingDeleteMilestone && deletingMilestoneId === pendingDeleteMilestone.id
        }
        onConfirm={() => {
          if (!pendingDeleteMilestone) return;
          void handleDeleteMilestone(pendingDeleteMilestone);
        }}
      />

      <ConfirmDialog
        open={!!pendingDeleteAction}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteAction(null);
        }}
        title={String(t('ActionsSection.deleteActionConfirm.title'))}
        description={
          pendingDeleteAction
            ? String(t('ActionsSection.deleteActionConfirm.description', undefined, { name: pendingDeleteAction.action.name }))
            : ''
        }
        confirmLabel={String(t('ActionsSection.deleteActionConfirm.confirm'))}
        cancelLabel={String(t('ActionsSection.deleteActionConfirm.cancel'))}
        isDestructive
        isPending={!!pendingDeleteAction && deletingActionId === pendingDeleteAction.action.id}
        onConfirm={() => {
          void confirmDeletePendingAction();
        }}
      />

      <ActionCreateDialog
        open={isCreateActionOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen && !isConnected) {
            showErrorToast(
              new Error(String(t('ActionsSection.toasts.loginRequired.openCreateAction'))),
              'ActionsSection.toasts.loginRequired.title',
              t,
            );
            return;
          }
          setIsCreateActionOpen(nextOpen);
        }}
        actionCtx={actionCtx}
        milestoneId={selectedMilestoneId}
        milestoneTitle={selectedMilestone?.title ?? ''}
        projectEntity={projectEntity}
        onSuccess={({ actionId, status }) => {
          // Le dialog ferme tout seul + le toast est géré par la factory `useCreateAction`.
          // Le parent ne reste responsable que du scroll target (positionne le highlight
          // sur la nouvelle action une fois le DOM updaté par le refetch).
          if (actionId) {
            setPendingScrollTarget({
              type: 'action',
              milestoneId: selectedMilestoneId,
              actionId,
              section: status === 'done' ? 'done' : 'active',
            });
          }
        }}
      />

      {editingAction ? (
        <ActionEditDialog
          open={isEditActionOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen && !isConnected) {
              showErrorToast(
                new Error(String(t('ActionsSection.toasts.loginRequired.editAction'))),
                'ActionsSection.toasts.loginRequired.title',
                t,
              );
              return;
            }
            setIsEditActionOpen(nextOpen);
          }}
          actionCtx={actionCtx}
          editingAction={editingAction}
          milestoneTitle={
            data.milestones.find((milestone) => milestone.id === editingAction.milestoneId)?.title || ''
          }
          projectEntity={projectEntity}
        />
      ) : null}

      {milestoneEditTarget ? (
        <MilestoneEditDialog
          open={isEditMilestoneOpen}
          onOpenChange={setIsEditMilestoneOpen}
          milestoneId={milestoneEditTarget.milestoneId}
          initialValues={milestoneEditTarget.initialValues}
          mutation={editMilestoneMutation}
          apiErrorFallbackKey="ActionsSection.errors.milestoneUpdateFailed"
          onSuccess={() => void refetchFundingEnvelope()}
        />
      ) : null}

      <div className="space-y-4">
      {openMilestones.map((milestone) => (
        <MilestoneCard
          key={milestone.id}
          milestone={milestone}
          t={t}
          permissions={cagnottePerms}
          fmtDate={fmtDate}
          loadingIds={{
            candidateActionId,
            doneActionId,
            deletingActionId,
            deletingMilestoneId,
            closingMilestoneId,
          }}
          expandedActiveMilestoneIds={expandedActiveMilestoneIds}
          setExpandedActiveMilestoneIds={setExpandedActiveMilestoneIds}
          expandedDoneMilestoneIds={expandedDoneMilestoneIds}
          setExpandedDoneMilestoneIds={setExpandedDoneMilestoneIds}
          milestoneCardRef={(node) => {
            milestoneCardRefs.current[milestone.id] = node;
          }}
          actionCardRefs={actionCardRefs}
          onCreateAction={openCreateActionModal}
          onEditMilestone={openEditMilestoneModal}
          onCloseMilestone={(m) => void handleCloseMilestone(m)}
          onDeleteMilestone={(m) => setPendingDeleteMilestone(m)}
          onCandidateAction={handleCandidateAction}
          onMarkActionDone={handleMarkActionDone}
          onEditAction={openEditActionModal}
          onDeleteAction={(milestoneId, action) =>
            setPendingDeleteAction({ milestoneId, action })
          }
        />
      ))}

      <ClosedMilestonesSection
        closedMilestones={closedMilestones}
        t={t}
        showClosedMilestones={showClosedMilestones}
        setShowClosedMilestones={setShowClosedMilestones}
        restoringMilestoneId={restoringMilestoneId}
        canRestoreMilestone={cagnottePerms.canRestoreMilestone}
        onRestoreMilestone={(m) => void handleRestoreMilestone(m)}
      />
      </div>
    </>
  );
}
