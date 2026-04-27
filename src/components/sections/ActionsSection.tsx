import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionsSectionProps } from '@/types/site-schema';
import { useFundingEnvelope } from '@/hooks/useFundingEnvelope';
import { useCocolight } from '@/hooks/useCocolight';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { updatePathValue } from '@/lib/updatePathValue';
import {
  deleteActionById,
  updateProjectActionFields,
} from '@/modules/cagnotte/lib/actionMilestonePathUpdates';
import {
  closeMilestoneWithSync,
  deleteMilestoneWithSync,
  editMilestoneWithSync,
  getApiErrorMessage,
  restoreMilestoneWithSync,
} from '@/modules/cagnotte/lib/milestoneMutationHandlers';
import {
  asRecord,
  resolveMilestoneSyncContext,
} from '@/modules/cagnotte/lib/milestoneSyncContext';
import {
  DELETE_MILESTONE_REQUEST_EVENT,
  EDIT_MILESTONE_REQUEST_EVENT,
  SCROLL_TO_MILESTONE_EVENT,
} from './milestoneEvents';
import {
  ArchiveRestore,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { format, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { TagsInput } from '../form/TagsInput';
import { ContributorSearchSelect, type CitizenOption } from '../form/ContributorSearchSelect';
import { DatePickerInput } from '../form/DatePickerInput';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { MilestoneManageActions } from './MilestoneManageActions';
type Contributor = { id: string; name: string; avatar?: string };
type ActionStatus = 'todo' | 'done';
type ActionCreateStatus = 'todo' | 'done';
type ProjectAction = {
  id: string;
  name: string;
  credits: number;
  status: ActionStatus;
  sourceIndex?: number;
  date_start?: number;
  date_end?: number;
  tags: string[];
  contributors: Contributor[];
};
type Milestone = {
  id: string;
  title: string;
  status: 'open' | 'done' | 'close';
  targetAmount: number;
  date_start?: number;
  date_end?: number;
  actions: ProjectAction[];
};

type EditActionContext = {
  milestoneId: string;
  action: ProjectAction;
  actionEntityId: string;
};

type PendingDeleteActionContext = {
  milestoneId: string;
  action: ProjectAction;
};

type ScrollTarget =
  | { type: 'milestone'; milestoneId: string }
  | { type: 'action'; milestoneId: string; actionId: string; section: 'active' | 'done' };

function highlightAndScroll(element: HTMLElement) {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
  window.setTimeout(() => {
    element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
  }, 1600);
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function isValidEntityId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function MilestoneStatusBadge({ status }: { status: Milestone['status'] }) {
  const config: Record<Milestone['status'], { label: string; className: string }> = {
    open: { label: 'ouvert', className: 'bg-primary/15 text-primary' },
    done: { label: 'done', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    close: { label: 'clôturé', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  };
  const current = config[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${current.className}`}>{current.label}</span>;
}

function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const config: Record<ActionStatus, { icon: ReactNode; label: string; className: string }> = {
    todo: { icon: <CircleDot className="h-3 w-3" />, label: 'En cours', className: 'bg-primary/10 text-primary' },
    done: { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Terminée', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  };
  const current = config[status] ?? config['todo'];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${current.className}`}>
      {current.icon}
      {current.label}
    </span>
  );
}

function ContributorsAvatars({ contributors }: { contributors: Contributor[] }) {
  if (contributors.length === 0) return null;
  const visible = contributors.slice(0, 3);
  const overflow = contributors.slice(3);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Contributeurs:</span>
      <div className="flex -space-x-1">
        {visible.map((contributor) => (
          <Tooltip key={contributor.id}>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-[9px] bg-primary/20 text-primary-foreground">{initials(contributor.name)}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>{contributor.name}</TooltipContent>
          </Tooltip>
        ))}
        {overflow.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-semibold text-muted-foreground">
                +{overflow.length}
              </div>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>{contributors.map((contributor) => contributor.name).join(', ')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}


function resolveCreatedActionId(params: {
  rawEnvelope: unknown;
  projectId: string;
  milestoneId: string;
  name: string;
  credits: number;
  expectedStatus: ActionStatus;
  fallbackId?: string;
}): string {
  const fallbackId = typeof params.fallbackId === 'string' ? params.fallbackId.trim() : '';
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

    const rawProjectId =
      String(projectData?.id ?? projectData?._id ?? projectRecord?.id ?? projectRecord?._id ?? '').trim();
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
      const actionMilestoneId = String(asRecord(actionRecord.milestone).milestoneId ?? '').trim();
      if (actionMilestoneId !== params.milestoneId) continue;

      const sameName = String(actionRecord.name ?? '').trim().toLowerCase() === params.name.trim().toLowerCase();
      const sameCredits = Number(actionRecord.credits) === params.credits;
      const sameStatus = String(actionRecord.status ?? '').trim() === params.expectedStatus;
      const rawActionId = String(actionRecord.id ?? actionRecord._id ?? '').trim();

      if (sameName && sameCredits && sameStatus && isValidEntityId(rawActionId)) {
        return rawActionId;
      }
    }
  }

  return '';
}

export default function ActionsSection({ id, props }: { id?: string; props: ActionsSectionProps }) {
  const fmtDate = (ts: number) => format(new Date(ts), 'dd MMM yyyy', { locale: fr });
  const fmtInputDate = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return Number.isNaN(date.getTime()) ? '' : format(date, 'dd/MM/yyyy');
  };
  const { data: fundingData, isLoading, error, refetch: refetchFundingEnvelope } = useFundingEnvelope(id);
  const { apiClient, me, entity } = useCocolight();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateActionOpen, setIsCreateActionOpen] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');
  const [newActionName, setNewActionName] = useState('');
  const [newActionCredits, setNewActionCredits] = useState('0');
  const [newActionStatus, setNewActionStatus] = useState<ActionCreateStatus>('todo');
  const [newActionTags, setNewActionTags] = useState<string[]>([]);
  const [selectedContributorIds, setSelectedContributorIds] = useState<string[]>([]);
  const [selectedContributorOptions, setSelectedContributorOptions] = useState<CitizenOption[]>([]);
  const [newActionStartDate, setNewActionStartDate] = useState('');
  const [newActionEndDate, setNewActionEndDate] = useState('');
  const [isSubmittingCreateAction, setIsSubmittingCreateAction] = useState(false);
  const [createActionError, setCreateActionError] = useState<string | null>(null);
  const [isEditActionOpen, setIsEditActionOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<EditActionContext | null>(null);
  const [editActionName, setEditActionName] = useState('');
  const [editActionCredits, setEditActionCredits] = useState('0');
  const [editActionStatus, setEditActionStatus] = useState<ActionStatus>('todo');
  const [editActionTags, setEditActionTags] = useState<string[]>([]);
  const [editContributorIds, setEditContributorIds] = useState<string[]>([]);
  const [editContributorOptions, setEditContributorOptions] = useState<CitizenOption[]>([]);
  const [editActionStartDate, setEditActionStartDate] = useState('');
  const [editActionEndDate, setEditActionEndDate] = useState('');
  const [isSubmittingEditAction, setIsSubmittingEditAction] = useState(false);
  const [editActionError, setEditActionError] = useState<string | null>(null);
  const [isEditMilestoneOpen, setIsEditMilestoneOpen] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string>('');
  const [editMilestoneName, setEditMilestoneName] = useState('');
  const [editMilestoneDescription, setEditMilestoneDescription] = useState('');
  const [editMilestoneTargetAmount, setEditMilestoneTargetAmount] = useState('0');
  const [editMilestoneStatus, setEditMilestoneStatus] = useState<'open' | 'done' | 'close'>('open');
  const [isSubmittingEditMilestone, setIsSubmittingEditMilestone] = useState(false);
  const [editMilestoneError, setEditMilestoneError] = useState<string | null>(null);
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
  const isConnected = !!me?.isConnected;
  const currentUserId = me?.id?.trim() || '';
  const meRecord = me as unknown as Record<string, unknown> | null;
  const currentUserName =
    (meRecord?.serverData as Record<string, unknown> | undefined)?.name as string | undefined ||
    (meRecord?._serverData as Record<string, unknown> | undefined)?.name as string | undefined ||
    'Contributeur';

  const parseFrenchDateToIso = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parse(trimmed, 'dd/MM/yyyy', new Date());
    if (!isValid(parsed)) return null;
    if (format(parsed, 'dd/MM/yyyy') !== trimmed) return null;
    return parsed.toISOString();
  };

  const frenchDateToPickerValue = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parsed = parse(trimmed, 'dd/MM/yyyy', new Date());
    if (!isValid(parsed)) return '';
    return format(parsed, 'yyyy-MM-dd');
  };

  const pickerValueToFrenchDate = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parsed = parse(trimmed, 'yyyy-MM-dd', new Date());
    if (!isValid(parsed)) return '';
    return format(parsed, 'dd/MM/yyyy');
  };

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

  const handleRestoreMilestone = async (milestone: Milestone) => {
    if (!me?.isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour restaurer un jalon.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = String(fundingData?.selectedProject?.id || id || '').trim();
    const answerId = String(fundingData?.selectedProject?.answerId || '').trim();

    if (!apiClient || !projectId || !answerId) {
      toast({
        title: 'Restauration impossible',
        description: 'Contexte API incomplet (projet/answer).',
        variant: 'destructive',
      });
      return;
    }

    try {
      setRestoringMilestoneId(milestone.id);
      await restoreMilestoneWithSync({
        source: apiClient,
        rawEnvelope: fundingData?.rawEnvelope,
        projectId,
        answerId,
        milestoneId: milestone.id,
      });

      toast({
        title: 'Jalon restauré',
        description: `Le jalon "${milestone.title}" est de nouveau actif.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      await refetchFundingEnvelope();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Erreur lors de la restauration du jalon.');
      toast({
        title: 'Impossible de restaurer le jalon',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRestoringMilestoneId('');
    }
  };

  useEffect(() => {
    const onEditMilestoneRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ milestoneId?: string; projectId?: string }>).detail;
      const milestoneId = String(detail?.milestoneId ?? '').trim();
      const eventProjectId = String(detail?.projectId ?? '').trim();
      const selectedProjectId = String(fundingData?.selectedProject?.id ?? '').trim();
      if (!milestoneId) return;
      if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
      const target = data.milestones.find((milestone) => milestone.id === milestoneId);
      if (target) openEditMilestoneModal(target);
    };

    const onDeleteMilestoneRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ milestoneId?: string; projectId?: string }>).detail;
      const milestoneId = String(detail?.milestoneId ?? '').trim();
      const eventProjectId = String(detail?.projectId ?? '').trim();
      const selectedProjectId = String(fundingData?.selectedProject?.id ?? '').trim();
      if (!milestoneId) return;
      if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
      const target = data.milestones.find((milestone) => milestone.id === milestoneId);
      if (target) setPendingDeleteMilestone(target);
    };

    window.addEventListener(EDIT_MILESTONE_REQUEST_EVENT, onEditMilestoneRequest as EventListener);
    window.addEventListener(DELETE_MILESTONE_REQUEST_EVENT, onDeleteMilestoneRequest as EventListener);

    return () => {
      window.removeEventListener(EDIT_MILESTONE_REQUEST_EVENT, onEditMilestoneRequest as EventListener);
      window.removeEventListener(DELETE_MILESTONE_REQUEST_EVENT, onDeleteMilestoneRequest as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.milestones, fundingData?.selectedProject?.id]);

  useEffect(() => {
    const onScrollToMilestone = (event: Event) => {
      const detail = (event as CustomEvent<{ milestoneId?: string; projectId?: string }>).detail;
      const milestoneId = String(detail?.milestoneId ?? '').trim();
      const eventProjectId = String(detail?.projectId ?? '').trim();
      const selectedProjectId = String(fundingData?.selectedProject?.id ?? '').trim();
      if (!milestoneId) return;
      if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
      setPendingScrollTarget({ type: 'milestone', milestoneId });
    };

    window.addEventListener(SCROLL_TO_MILESTONE_EVENT, onScrollToMilestone as EventListener);
    return () => window.removeEventListener(SCROLL_TO_MILESTONE_EVENT, onScrollToMilestone as EventListener);
  }, [fundingData?.selectedProject?.id]);

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

  const getTags = (action: ProjectAction): string[] => action.tags;


  const selectedMilestone = data.milestones.find((milestone) => milestone.id === selectedMilestoneId);
  const editInitialContributors = useMemo(
    () => (editingAction?.action.contributors || []).map((contributor) => ({ id: contributor.id, name: contributor.name })),
    [editingAction]
  );
  const parsedStartDateIso = parseFrenchDateToIso(newActionStartDate);
  const parsedEndDateIso = parseFrenchDateToIso(newActionEndDate);
  const hasInvalidStartDate = newActionStartDate.trim().length > 0 && !parsedStartDateIso;
  const hasInvalidEndDate = newActionEndDate.trim().length > 0 && !parsedEndDateIso;
  const hasInvalidDateRange =
    Boolean(parsedStartDateIso && parsedEndDateIso) &&
    new Date(parsedEndDateIso as string).getTime() < new Date(parsedStartDateIso as string).getTime();

  const parsedEditStartDateIso = parseFrenchDateToIso(editActionStartDate);
  const parsedEditEndDateIso = parseFrenchDateToIso(editActionEndDate);
  const hasInvalidEditStartDate = editActionStartDate.trim().length > 0 && !parsedEditStartDateIso;
  const hasInvalidEditEndDate = editActionEndDate.trim().length > 0 && !parsedEditEndDateIso;
  const hasInvalidEditDateRange =
    Boolean(parsedEditStartDateIso && parsedEditEndDateIso) &&
    new Date(parsedEditEndDateIso as string).getTime() < new Date(parsedEditStartDateIso as string).getTime();

  const isCreateActionValid =
    newActionName.trim().length > 0 &&
    selectedMilestoneId.length > 0 &&
    Number.isFinite(Number(newActionCredits.replace(',', '.'))) &&
    Number(newActionCredits.replace(',', '.')) >= 0 &&
    !hasInvalidStartDate &&
    !hasInvalidEndDate &&
    !hasInvalidDateRange;

  const isEditActionValid =
    editActionName.trim().length > 0 &&
    Number.isFinite(Number(editActionCredits.replace(',', '.'))) &&
    Number(editActionCredits.replace(',', '.')) >= 0 &&
    !hasInvalidEditStartDate &&
    !hasInvalidEditEndDate &&
    !hasInvalidEditDateRange;

  const openCreateActionModal = (milestoneId: string) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour ouvrir la creation d action.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedMilestoneId(milestoneId);
    setNewActionName('');
    setNewActionCredits('0');
    setNewActionStatus('todo');
    setNewActionTags([]);
    setSelectedContributorIds([]);
    setSelectedContributorOptions([]);
    setNewActionStartDate('');
    setNewActionEndDate('');
    setCreateActionError(null);
    setIsCreateActionOpen(true);
  };

  const openEditMilestoneModal = (milestone: Milestone) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour modifier un jalon.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = fundingData?.selectedProject?.id || id || '';
    const answerId = fundingData?.selectedProject?.answerId || '';
    const syncContext = resolveMilestoneSyncContext({
      rawEnvelope: fundingData?.rawEnvelope,
      projectId,
      answerId,
      milestoneId: milestone.id,
    });

    setEditingMilestoneId(milestone.id);
    setEditMilestoneName(milestone.title);
    setEditMilestoneDescription(syncContext?.description || '');
    setEditMilestoneTargetAmount(String(milestone.targetAmount || 0));
    setEditMilestoneStatus(milestone.status);
    setEditMilestoneError(null);
    setIsEditMilestoneOpen(true);
  };

  const handleEditMilestone = async () => {
    const projectId = fundingData?.selectedProject?.id || id || '';
    const answerId = fundingData?.selectedProject?.answerId || '';
    const cleanName = editMilestoneName.trim();
    const cleanDescription = editMilestoneDescription.trim();
    const targetAmount = Number(editMilestoneTargetAmount.replace(',', '.'));

    if (!apiClient) {
      setEditMilestoneError('Client API indisponible.');
      return;
    }
    if (!projectId || !answerId || !editingMilestoneId) {
      setEditMilestoneError('Contexte jalon invalide.');
      return;
    }
    if (!cleanName) {
      setEditMilestoneError('Le nom du jalon est obligatoire.');
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount < 0) {
      setEditMilestoneError('Le montant a financer doit être un nombre >= 0.');
      return;
    }

    try {
      setIsSubmittingEditMilestone(true);
      setEditMilestoneError(null);

      await editMilestoneWithSync({
        source: apiClient,
        rawEnvelope: fundingData?.rawEnvelope,
        projectId,
        answerId,
        milestoneId: editingMilestoneId,
        name: cleanName,
        description: cleanDescription,
        status: editMilestoneStatus,
        targetAmount,
      });

      toast({
        title: 'Jalon modifie',
        description: `Le jalon "${cleanName}" a été mis a jour.`,
      });

      setIsEditMilestoneOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      await refetchFundingEnvelope();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Erreur lors de la mise a jour du jalon.');
      setEditMilestoneError(message);
      toast({
        title: 'Impossible de modifier le jalon',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingEditMilestone(false);
    }
  };

  const handleDeleteMilestone = async (milestone: Milestone) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour supprimer un jalon.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = fundingData?.selectedProject?.id || id || '';
    const answerId = fundingData?.selectedProject?.answerId || '';

    if (!apiClient || !projectId || !answerId) {
      toast({
        title: 'Suppression impossible',
        description: 'Contexte API incomplet (projet/answer).',
        variant: 'destructive',
      });
      return;
    }

    try {
      setDeletingMilestoneId(milestone.id);
      await deleteMilestoneWithSync({
        source: apiClient,
        rawEnvelope: fundingData?.rawEnvelope,
        projectId,
        answerId,
        milestoneId: milestone.id,
      });

      toast({
        title: 'Jalon supprime',
        description: `Le jalon "${milestone.title}" a été supprimé du projet et del'answer.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      await refetchFundingEnvelope();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Erreur lors de la suppression du jalon.');
      toast({
        title: 'Impossible de supprimer le jalon',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingMilestoneId('');
      setPendingDeleteMilestone(null);
    }
  };

  const handleCloseMilestone = async (milestone: Milestone) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour cloturer un jalon.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = fundingData?.selectedProject?.id || id || '';
    const answerId = fundingData?.selectedProject?.answerId || '';
    const hasActions = milestone.actions.length > 0;
    const allActionsDone = hasActions && milestone.actions.every((action) => action.status === 'done');
    const canCloture = allActionsDone || !hasActions;
    if (!canCloture) {
      toast({
        title: 'Clôture impossible',
        description: 'Toutes les actions du jalon doivent être terminées.',
        variant: 'destructive',
      });
      return;
    }

    if (!apiClient || !projectId || !answerId) {
      toast({
        title: 'Clôture impossible',
        description: 'Contexte API incomplet (projet/answer).',
        variant: 'destructive',
      });
      return;
    }

    try {
      setClosingMilestoneId(milestone.id);
      await closeMilestoneWithSync({
        source: apiClient,
        rawEnvelope: fundingData?.rawEnvelope,
        projectId,
        answerId,
        milestoneId: milestone.id,
      });

      toast({
        title: 'Jalon clôturé',
        description: `Le jalon "${milestone.title}" a été clôturé.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      await refetchFundingEnvelope();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Erreur lors de la cloture du jalon.');
      toast({
        title: 'Impossible de cloturer le jalon',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setClosingMilestoneId('');
    }
  };

  const handleCandidateAction = async (milestoneId: string, action: ProjectAction) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecté pour candidater.',
        variant: 'destructive',
      });
      return;
    }

    if (!apiClient) {
      toast({
        title: 'Client API indisponible',
        description: 'Impossible de mettre a jour les contributeurs pour le moment.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentUserId) {
      toast({
        title: 'Utilisateur introuvable',
        description: 'Impossible de determiner votre identité.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = fundingData?.selectedProject?.id || id || '';
    const actionId = isValidEntityId(action.id)
      ? action.id
      : resolveCreatedActionId({
          rawEnvelope: fundingData?.rawEnvelope,
          projectId,
          milestoneId,
          name: action.name,
          credits: Number(action.credits),
          expectedStatus: action.status,
          fallbackId: action.id,
        });

    if (!isValidEntityId(actionId)) {
      toast({
        title: 'Action introuvable',
        description: 'Impossible de retrouver l\'action a mettre a jour.',
        variant: 'destructive',
      });
      return;
    }

    const alreadyContributor = action.contributors.some((contributor) => contributor.id === currentUserId);
    if (alreadyContributor) return;

    try {
      setCandidateActionId(actionId);
      await updatePathValue(apiClient, {
        id: actionId,
        collection: 'actions',
        path: `links.contributors.${currentUserId}`,
        value: {
          type: 'citoyens',
          isAdmin: true,
          name: currentUserName,
        },
      });

      toast({
        title: 'Candidature enregistrée',
        description: 'Vous avez ete ajoute parmi les contributeurs de cette action.',
      });

      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      await refetchFundingEnvelope();
    } catch (error) {
      const apiMessage =
        (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
        (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;
      const message = apiMessage || (error instanceof Error ? error.message : 'Erreur lors de la candidature.');
      toast({
        title: 'Impossible de candidater',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCandidateActionId('');
    }
  };

  const handleMarkActionDone = async (milestoneId: string, action: ProjectAction) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour terminer une action.',
        variant: 'destructive',
      });
      return;
    }

    if (!apiClient) {
      toast({
        title: 'Client API indisponible',
        description: 'Impossible de mettre a jour le statut pour le moment.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = fundingData?.selectedProject?.id || id || '';
    const actionId = isValidEntityId(action.id)
      ? action.id
      : resolveCreatedActionId({
          rawEnvelope: fundingData?.rawEnvelope,
          projectId,
          milestoneId,
          name: action.name,
          credits: Number(action.credits),
          expectedStatus: action.status,
          fallbackId: action.id,
        });

    if (!isValidEntityId(actionId)) {
      toast({
        title: 'Action introuvable',
        description: 'Impossible de retrouver l\'action a terminer.',
        variant: 'destructive',
      });
      return;
    }

    if (action.status === 'done') return;

    try {
      setDoneActionId(actionId);
      await updateProjectActionFields({
        source: apiClient,
        projectId,
        index: actionId,
        fields: { status: 'done' },
      });

      toast({
        title: 'Action terminée',
        description: `L action "${action.name}" a été marquee comme terminée.`,
      });

      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      await refetchFundingEnvelope();
    } catch (error) {
      const apiMessage =
        (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
        (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;
      const message = apiMessage || (error instanceof Error ? error.message : 'Erreur lors de la mise a jour du statut.');
      toast({
        title: 'Impossible de terminer l\'action',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDoneActionId('');
    }
  };

  const handleDeleteAction = async (milestoneId: string, action: ProjectAction) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour supprimer une action.',
        variant: 'destructive',
      });
      return;
    }

    if (!apiClient) {
      toast({
        title: 'Client API indisponible',
        description: 'Impossible de supprimer cette action pour le moment.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = fundingData?.selectedProject?.id || id || '';
    const actionId = isValidEntityId(action.id)
      ? action.id
      : resolveCreatedActionId({
          rawEnvelope: fundingData?.rawEnvelope,
          projectId,
          milestoneId,
          name: action.name,
          credits: Number(action.credits),
          expectedStatus: action.status,
          fallbackId: action.id,
        });

    if (!isValidEntityId(actionId)) {
      toast({
        title: 'Action introuvable',
        description: 'Impossible de retrouver l identifiant de l\'action.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setDeletingActionId(actionId);
      await deleteActionById({ source: apiClient, actionId });
      toast({
        title: 'Action supprimee',
        description: `L action "${action.name}" a été supprimee.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      await refetchFundingEnvelope();
    } catch (error) {
      const apiMessage =
        (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
        (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;
      const message = apiMessage || (error instanceof Error ? error.message : 'Erreur lors de la suppression de l\'action.');
      toast({
        title: 'Impossible de supprimer l\'action',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingActionId('');
    }
  };

  const confirmDeletePendingAction = async () => {
    if (!pendingDeleteAction) return;
    await handleDeleteAction(pendingDeleteAction.milestoneId, pendingDeleteAction.action);
    setPendingDeleteAction(null);
  };

  const handleCreateAction = async () => {
    const parentId = fundingData?.selectedProject?.id || id || '';
    const name = newActionName.trim();
    const credits = Number(newActionCredits.replace(',', '.'));
    const expectedStatus: ActionStatus =
      newActionStatus === 'todo' ? 'todo' : 'done';

    if (!apiClient) {
      const message = 'Client API indisponible.';
      setCreateActionError(message);
      toast({ title: 'Impossible de creer l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!parentId) {
      const message = 'Projet introuvable pour la creation de l\'action.';
      setCreateActionError(message);
      toast({ title: 'Impossible de creer l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!selectedMilestoneId) {
      const message = 'Aucun jalon selectionne.';
      setCreateActionError(message);
      toast({ title: 'Impossible de creer l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!name) {
      const message = 'Le nom de l\'action est obligatoire.';
      setCreateActionError(message);
      toast({ title: 'Impossible de creer l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(credits) || credits < 0) {
      const message = 'Le montant des credits doit être supérieur ou égal a 0.';
      setCreateActionError(message);
      toast({ title: 'Impossible de créer l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (hasInvalidStartDate || hasInvalidEndDate || hasInvalidDateRange) {
      const message = 'Les dates doivent être au format dd/MM/aaaa et la date de fin doit être supérieure ou egale date de debut.';
      setCreateActionError(message);
      toast({ title: 'Impossible de créer l\'action', description: message, variant: 'destructive' });
      return;
    }

    try {
      setCreateActionError(null);
      setIsSubmittingCreateAction(true);

      const requestPayload = {
        name,
        status: newActionStatus,
        parentId,
        parentType: 'projects' as const,
        credits,
        milestone: {
          milestoneId: selectedMilestoneId,
        },
      };

      try {
        await apiClient.callEndpoint('COSTUM_PROJECT_ACTION_REQUEST_NEW', requestPayload);
      } catch (error) {
        const needsFallback = error instanceof Error && error.message.includes('Request validation failed');
        if (!needsFallback) return Promise.reject(error);

        const fallbackData = new URLSearchParams();
        fallbackData.set('name', name);
        fallbackData.set('status', newActionStatus);
        fallbackData.set('parentId', parentId);
        fallbackData.set('parentType', 'projects');
        fallbackData.set('credits', String(credits));
        fallbackData.set('milestone[milestoneId]', selectedMilestoneId);

        await (apiClient as unknown as { _client: { request: (config: { url: string; method: string; headers: Record<string, string>; data: URLSearchParams }) => Promise<unknown> } })._client.request({
          url: '/costum/project/action/request/new',
          method: 'post',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          data: fallbackData,
        });
      }

      let resolvedActionIndex = '';
      try {
        const refreshed = await refetchFundingEnvelope();
        const refreshedMilestone = refreshed.data?.milestones.find((milestone) => milestone.id === selectedMilestoneId);
        const candidates = (refreshedMilestone?.actions || []).filter((action) => {
          const sameName = action.name.trim().toLowerCase() === name.trim().toLowerCase();
          const sameCredits = Number(action.credits) === credits;
          const sameStatus = action.status === expectedStatus;
          return sameName && sameCredits && sameStatus;
        });

        if (candidates.length > 0) {
          resolvedActionIndex = resolveCreatedActionId({
            rawEnvelope: refreshed.data?.rawEnvelope,
            projectId: parentId,
            milestoneId: selectedMilestoneId,
            name,
            credits,
            expectedStatus,
            fallbackId: candidates[0].id,
          });
        }
      } catch (resolveIndexError) {
        console.warn('⚠️ Impossible de resoudre l index exact de la nouvelle action, fallback sur index calcule:', resolveIndexError);
      }

      const metadataUpdates: Record<string, unknown> = {};
      const contributorIds = Array.isArray(selectedContributorIds)
        ? selectedContributorIds.map((value) => value.trim()).filter((value) => value.length > 0)
        : [];
      const contributorNameById = new Map(selectedContributorOptions.map((option) => [option.id, option.name]));
      contributorIds.forEach((contributorId) => {
        metadataUpdates[`links.contributors.${contributorId}`] = {
          type: 'citoyens',
          isAdmin: true,
          name: contributorNameById.get(contributorId) || contributorId,
        };
      });
      if (newActionTags.length > 0) {
         metadataUpdates.tags = newActionTags;
       }
       if (newActionStartDate.trim()) {
         metadataUpdates.startDate = newActionStartDate;
       }
       if (newActionEndDate.trim()) {
         metadataUpdates.endDate = newActionEndDate;
       }

      if (Object.keys(metadataUpdates).length > 0) {
        try {
          if (!isValidEntityId(resolvedActionIndex)) {
            throw new Error(
              `Impossible de mettre à jour les métadonnées: id d'action invalide ou introuvable (${resolvedActionIndex || 'vide'})`
            );
          }

           await updateProjectActionFields({
             source: apiClient,
             projectId: parentId,
             index: resolvedActionIndex,
             fields: metadataUpdates,
             setType: [
               {
                 path: 'startDate',
                 type: 'isoDate',
               },
               {
                 path: 'endDate',
                 type: 'isoDate',
               },
             ],
           });
        } catch (metadataError) {
          console.warn('⚠️ Action creee mais metadonnees supplementaires non enregistrees:', metadataError);
          toast({
            title: 'Action creee partiellement',
            description: 'L action est creee mais certains champs supplementaires n ont pas pu être enregistres.',
            variant: 'destructive',
          });
        }
      }

      toast({
        title: 'Action ajoutee',
        description: `L action "${name}" a été creee avec succes.`,
      });

      if (resolvedActionIndex) {
        setPendingScrollTarget({
          type: 'action',
          milestoneId: selectedMilestoneId,
          actionId: resolvedActionIndex,
          section: expectedStatus === 'done' ? 'done' : 'active',
        });
      }

      setIsCreateActionOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
    } catch (submitError) {
      const apiMessage =
        (submitError as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
        (submitError as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;
      const message = apiMessage || (submitError instanceof Error ? submitError.message : 'Erreur lors de la creation de l\'action.');
      console.error('❌ Erreur ajout action:', submitError);
      setCreateActionError(message);
      toast({
        title: 'Impossible de creer l\'action',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingCreateAction(false);
    }
  };

  const openEditActionModal = (milestoneId: string, action: ProjectAction) => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour modifier une action.',
        variant: 'destructive',
      });
      return;
    }

    const parentId = fundingData?.selectedProject?.id || id || '';
    const resolvedActionId = isValidEntityId(action.id)
      ? action.id
      : resolveCreatedActionId({
          rawEnvelope: fundingData?.rawEnvelope,
          projectId: parentId,
          milestoneId,
          name: action.name,
          credits: Number(action.credits),
          expectedStatus: action.status,
          fallbackId: action.id,
        });

    if (!isValidEntityId(resolvedActionId)) {
      toast({
        title: 'Edition impossible',
        description: 'Identifiant de l\'action introuvable pour la mise a jour.',
        variant: 'destructive',
      });
      return;
    }

    setEditingAction({ milestoneId, action, actionEntityId: resolvedActionId });
    setEditActionName(action.name);
    setEditActionCredits(String(action.credits));
    setEditActionStatus(action.status);
    setEditActionTags(getTags(action));
    setEditContributorIds(action.contributors.map((contributor) => contributor.id));
    setEditContributorOptions(action.contributors.map((contributor) => ({ id: contributor.id, name: contributor.name })));
    setEditActionStartDate(fmtInputDate(action.date_start));
    setEditActionEndDate(fmtInputDate(action.date_end));
    setEditActionError(null);
    setIsEditActionOpen(true);
  };

  const handleEditAction = async () => {
    const parentId = fundingData?.selectedProject?.id || id || '';
    const credits = Number(editActionCredits.replace(',', '.'));

    if (!apiClient) {
      const message = 'Client API indisponible.';
      setEditActionError(message);
      toast({ title: 'Impossible de modifier l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!parentId) {
      const message = 'Projet introuvable pour la mise a jour de l\'action.';
      setEditActionError(message);
      toast({ title: 'Impossible de modifier l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!editingAction) {
      const message = 'Aucune action sélectionnée.';
      setEditActionError(message);
      toast({ title: 'Impossible de modifier l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!editActionName.trim()) {
      const message = 'Le nom de l\'action est obligatoire.';
      setEditActionError(message);
      toast({ title: 'Impossible de modifier l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(credits) || credits < 0) {
      const message = 'Le montant des credits doit être supérieur ou egal a 0.';
      setEditActionError(message);
      toast({ title: 'Impossible de modifier l\'action', description: message, variant: 'destructive' });
      return;
    }
    if (hasInvalidEditStartDate || hasInvalidEditEndDate || hasInvalidEditDateRange) {
      const message = 'Les dates doivent être au format dd/MM/aaaa et la date de fin doit être supérieur ou egal à la date de debut.';
      setEditActionError(message);
      toast({ title: 'Impossible de modifier l\'action', description: message, variant: 'destructive' });
      return;
    }

    try {
      setEditActionError(null);
      setIsSubmittingEditAction(true);

      const previous = editingAction.action;
      const updates: Record<string, unknown> = {};

      const nextName = editActionName.trim();
      if (nextName !== previous.name) updates.name = nextName;
      if (credits !== Number(previous.credits)) updates.credits = credits;
      if (editActionStatus !== previous.status) updates.status = editActionStatus;

      const prevTags = getTags(previous);
      if (JSON.stringify(editActionTags) !== JSON.stringify(prevTags)) {
        updates.tags = editActionTags;
      }

      const previousContributorIds = previous.contributors.map((contributor) => contributor.id).sort();
      const nextContributorIds = [...new Set(editContributorIds.map((value) => value.trim()).filter(Boolean))].sort();
      if (JSON.stringify(nextContributorIds) !== JSON.stringify(previousContributorIds)) {
        const contributorNameById = new Map<string, string>();
        previous.contributors.forEach((contributor) => {
          if (contributor.id && contributor.name) contributorNameById.set(contributor.id, contributor.name);
        });
        editContributorOptions.forEach((option) => {
          if (option.id && option.name) contributorNameById.set(option.id, option.name);
        });
        const contributorLinks = Object.fromEntries(
          nextContributorIds.map((contributorId) => [
            contributorId,
            {
              type: 'citoyens',
              isAdmin: true,
              name: contributorNameById.get(contributorId) || contributorId,
            },
          ])
        );
        updates['links.contributors'] = contributorLinks;
      }

       const previousStartDate = fmtInputDate(previous.date_start);
       const previousEndDate = fmtInputDate(previous.date_end);
       const nextStartDate = editActionStartDate.trim();
       const nextEndDate = editActionEndDate.trim();
       if (nextStartDate !== previousStartDate) {
         updates.startDate = nextStartDate || null;
       }
       if (nextEndDate !== previousEndDate) {
         updates.endDate = nextEndDate || null;
       }

      if (Object.keys(updates).length === 0) {
        toast({
          title: 'Aucune modification',
          description: 'Les informations de l\'action sont deja a jour.',
        });
        setIsEditActionOpen(false);
        return;
      }

       await updateProjectActionFields({
         source: apiClient,
         projectId: parentId,
         index: editingAction.actionEntityId,
         fields: updates,
         setType: [
           {
             path: 'startDate',
             type: 'isoDate',
           },
           {
             path: 'endDate',
             type: 'isoDate',
           },
         ],
       });

      toast({
        title: 'Action modifiee',
        description: `L action "${nextName}" a été mise a jour.`,
      });

      setIsEditActionOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
    } catch (submitError) {
      const apiMessage =
        (submitError as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
        (submitError as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;
      const message = apiMessage || (submitError instanceof Error ? submitError.message : 'Erreur lors de la mise a jour de l\'action.');
      console.error('❌ Erreur modification action:', submitError);
      setEditActionError(message);
      toast({
        title: 'Impossible de modifier l\'action',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingEditAction(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground italic">Chargement des actions...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Erreur lors du chargement des actions</p>;
  }

  if (data.milestones.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Aucune action disponible pour ce projet.</p>;
  }

  return (
    <>
      <ConfirmDialog
        open={!!pendingDeleteMilestone}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMilestone(null);
        }}
        title="Supprimer ce jalon ?"
        description={
          pendingDeleteMilestone
            ? `Le jalon "${pendingDeleteMilestone.title}" sera supprimé du projet et de l'answer associe.`
            : ''
        }
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
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
        title="Supprimer cette action ?"
        description={
          pendingDeleteAction
            ? `L action "${pendingDeleteAction.action.name}" sera supprimee definitivement.`
            : ''
        }
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
        isDestructive
        isPending={!!pendingDeleteAction && deletingActionId === pendingDeleteAction.action.id}
        onConfirm={() => {
          void confirmDeletePendingAction();
        }}
      />

      <Dialog
        open={isCreateActionOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen && !isConnected) {
            toast({
              title: 'Connexion requise',
              description: 'Vous devez être connecte pour ouvrir la creation d action.',
              variant: 'destructive',
            });
            return;
          }
          setIsCreateActionOpen(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-xl border border-primary/20 bg-card p-0 overflow-hidden">
          <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="text-xl font-display">Ajouter une action</DialogTitle>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
              <span className="font-semibold">Jalon :</span>
              <span className="text-foreground">{selectedMilestone?.title || 'Non selectionne'}</span>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="new-action-name">Nom de l\'action</Label>
              <Input
                id="new-action-name"
                value={newActionName}
                onChange={(event) => setNewActionName(event.target.value)}
                placeholder=""
                disabled={isSubmittingCreateAction}
              />
              <p className="text-xs text-muted-foreground"></p>
            </div>

            <ContributorSearchSelect
              values={selectedContributorIds}
              onChange={setSelectedContributorIds}
              onSelectedOptionsChange={setSelectedContributorOptions}
              entity={entity}
              disabled={isSubmittingCreateAction}
              placeholder="Rechercher puis cliquer pour ajouter..."
              label="Contributeurs"
              autoFocus
            />

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagsInput
                tags={newActionTags}
                onTagsChange={setNewActionTags}
                maxTags={10}
                texts={{
                  placeholder: 'Ajouter des tags',
                  maxReached: 'Maximum {{max}} tags autorises',
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-action-start-date">Date debut</Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(newActionStartDate)}
                  onChange={(value) => setNewActionStartDate(pickerValueToFrenchDate(value))}
                  placeholder="Selectionner une date de debut"
                  disabled={isSubmittingCreateAction}
                  endYear={2100}
                />
                {hasInvalidStartDate && (
                  <p className="text-xs text-destructive">Format invalide (attendu: dd/MM/aaaa).</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-action-end-date">Date fin</Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(newActionEndDate)}
                  onChange={(value) => setNewActionEndDate(pickerValueToFrenchDate(value))}
                  placeholder="Selectionner une date de fin"
                  disabled={isSubmittingCreateAction}
                  endYear={2100}
                />
                {hasInvalidEndDate && (
                  <p className="text-xs text-destructive">Format invalide (attendu: dd/MM/aaaa).</p>
                )}
              </div>
            </div>
            {hasInvalidDateRange && (
              <p className="text-xs text-destructive">La date de fin doit être superieure ou egale a la date de debut.</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-action-credits">Credits</Label>
                <Input
                  id="new-action-credits"
                  type="number"
                  min={0}
                  step="1"
                  value={newActionCredits}
                  onChange={(event) => setNewActionCredits(event.target.value)}
                  disabled={isSubmittingCreateAction}
                />
                <p className="text-xs text-muted-foreground"></p>
              </div>

              <div className="space-y-2">
                <Label>Statut initial</Label>
                <Select
                  value={newActionStatus}
                  onValueChange={(value) => setNewActionStatus(value as ActionCreateStatus)}
                  disabled={isSubmittingCreateAction}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">En cours</SelectItem>
                    <SelectItem value="done">Terminée</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground"></p>
              </div>
            </div>

            {createActionError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2" role="status" aria-live="polite">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{createActionError}</span>
              </div>
            )}

            {isSubmittingCreateAction && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary flex items-center gap-2" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Enregistrement...</span>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setIsCreateActionOpen(false)} disabled={isSubmittingCreateAction}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateAction}
              disabled={isSubmittingCreateAction || !isCreateActionValid}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmittingCreateAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSubmittingCreateAction ? 'Creation...' : 'Creer l\'action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditActionOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen && !isConnected) {
            toast({
              title: 'Connexion requise',
              description: 'Vous devez être connecte pour modifier une action.',
              variant: 'destructive',
            });
            return;
          }
          setIsEditActionOpen(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-xl border border-primary/20 bg-card p-0 overflow-hidden">
          <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="text-xl font-display">Modifier l\'action</DialogTitle>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
              <span className="font-semibold">Jalon :</span>
              <span className="text-foreground">
                {data.milestones.find((milestone) => milestone.id === editingAction?.milestoneId)?.title || 'Non selectionne'}
              </span>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-action-name">Nom de l\'action</Label>
              <Input
                id="edit-action-name"
                value={editActionName}
                onChange={(event) => setEditActionName(event.target.value)}
                placeholder="Ex: Organiser un atelier de sensibilisation"
                disabled={isSubmittingEditAction}
              />
            </div>

            <ContributorSearchSelect
              values={editContributorIds}
              onChange={setEditContributorIds}
              onSelectedOptionsChange={setEditContributorOptions}
              initialContributors={editInitialContributors}
              entity={entity}
              disabled={isSubmittingEditAction}
              placeholder="Rechercher puis cliquer pour ajouter..."
              label="Contributeurs (citoyens)"
            />

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagsInput
                tags={editActionTags}
                onTagsChange={setEditActionTags}
                maxTags={10}
                texts={{
                  placeholder: 'Ajouter des tags pour l\'action...',
                  maxReached: 'Maximum {{max}} tags autorises',
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-action-start-date">Date debut</Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(editActionStartDate)}
                  onChange={(value) => setEditActionStartDate(pickerValueToFrenchDate(value))}
                  placeholder="Selectionner une date de debut"
                  disabled={isSubmittingEditAction}
                  endYear={2100}
                />
                {hasInvalidEditStartDate && (
                  <p className="text-xs text-destructive">Format invalide (attendu: dd/MM/aaaa).</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-action-end-date">Date fin</Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(editActionEndDate)}
                  onChange={(value) => setEditActionEndDate(pickerValueToFrenchDate(value))}
                  placeholder="Selectionner une date de fin"
                  disabled={isSubmittingEditAction}
                  endYear={2100}
                />
                {hasInvalidEditEndDate && (
                  <p className="text-xs text-destructive">Format invalide (attendu: dd/MM/aaaa).</p>
                )}
              </div>
            </div>
            {hasInvalidEditDateRange && (
              <p className="text-xs text-destructive">La date de fin doit être superieure ou egale a la date de debut.</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-action-credits">Credits</Label>
                <Input
                  id="edit-action-credits"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editActionCredits}
                  onChange={(event) => setEditActionCredits(event.target.value)}
                  disabled={isSubmittingEditAction}
                />
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={editActionStatus}
                  onValueChange={(value) => setEditActionStatus(value as ActionStatus)}
                  disabled={isSubmittingEditAction}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">En cours</SelectItem>
                    <SelectItem value="done">Terminee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editActionError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2" role="status" aria-live="polite">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{editActionError}</span>
              </div>
            )}

            {isSubmittingEditAction && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary flex items-center gap-2" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Mise a jour...</span>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setIsEditActionOpen(false)} disabled={isSubmittingEditAction}>
              Annuler
            </Button>
            <Button
              onClick={handleEditAction}
              disabled={isSubmittingEditAction || !isEditActionValid}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmittingEditAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {isSubmittingEditAction ? 'Mise a jour...' : 'Mettre a jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditMilestoneOpen} onOpenChange={setIsEditMilestoneOpen}>
        <DialogContent className="sm:max-w-xl border border-primary/20 bg-card p-0 overflow-hidden">
          <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="text-xl font-display">Modifier le jalon</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-milestone-name">Nom du jalon</Label>
              <Input
                id="edit-milestone-name"
                value={editMilestoneName}
                onChange={(event) => setEditMilestoneName(event.target.value)}
                placeholder="Nom du jalon"
                disabled={isSubmittingEditMilestone}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-milestone-description">Description</Label>
              <Textarea
                id="edit-milestone-description"
                value={editMilestoneDescription}
                onChange={(event) => setEditMilestoneDescription(event.target.value)}
                placeholder="Description du jalon"
                rows={3}
                disabled={isSubmittingEditMilestone}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-milestone-target">Montant cible (€)</Label>
              <Input
                id="edit-milestone-target"
                type="number"
                min={0}
                step="0.01"
                value={editMilestoneTargetAmount}
                onChange={(event) => setEditMilestoneTargetAmount(event.target.value)}
                disabled={isSubmittingEditMilestone}
              />
            </div>

            {editMilestoneError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2" role="status" aria-live="polite">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{editMilestoneError}</span>
              </div>
            )}

            {isSubmittingEditMilestone && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary flex items-center gap-2" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Mise a jour...</span>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setIsEditMilestoneOpen(false)} disabled={isSubmittingEditMilestone}>
              Annuler
            </Button>
            <Button
              onClick={handleEditMilestone}
              disabled={isSubmittingEditMilestone || editMilestoneName.trim().length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmittingEditMilestone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {isSubmittingEditMilestone ? 'Mise a jour...' : 'Mettre a jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
      {openMilestones.map((milestone) => {
        const actions = milestone.actions;
        const activeActions = actions.filter((action) => action.status !== 'done');
        const doneActions = actions.filter((action) => action.status === 'done');
        const milestoneCredits = actions.reduce((sum, action) => sum + action.credits, 0);

        return (
          <Card
            key={milestone.id}
            ref={(node) => {
              milestoneCardRefs.current[milestone.id] = node;
            }}
            className="border border-primary/10 shadow-sm overflow-hidden"
          >
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-display font-semibold capitalize text-base">{milestone.title}</h3>
                  {(milestone.date_start || milestone.date_end) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {milestone.date_start && fmtDate(milestone.date_start)}
                      {milestone.date_start && milestone.date_end && ' -> '}
                      {milestone.date_end && fmtDate(milestone.date_end)}
                    </p>
                  )}
                </div>
                <MilestoneStatusBadge status={milestone.status} />
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg border border-primary/10 bg-primary/5 p-2.5 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Actions</span>
                  <p className="font-semibold text-primary">{actions.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Montant</span>
                  <p className="font-semibold text-primary">{milestone.targetAmount.toLocaleString('fr-FR')} €</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Total credits</span>
                  <p className="font-semibold text-primary">{milestoneCredits.toLocaleString('fr-FR')} €</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90"
                  onClick={() => openCreateActionModal(milestone.id)}
                >
                  <Plus className="h-3 w-3" /> Action
                </Button>
                <MilestoneManageActions
                  onEdit={() => openEditMilestoneModal(milestone)}
                  onClose={() => void handleCloseMilestone(milestone)}
                  onDelete={() => setPendingDeleteMilestone(milestone)}
                  isDeleting={deletingMilestoneId === milestone.id}
                  isClosing={closingMilestoneId === milestone.id}
                  closeDisabled={
                    milestone.status === 'close' ||
                    !milestone.actions.every((action) => action.status === 'done')
                  }
                />
              </div>

              {activeActions.length > 0 && (
                <Collapsible
                  open={expandedActiveMilestoneIds.includes(milestone.id)}
                  onOpenChange={(open) => {
                    setExpandedActiveMilestoneIds((prev) =>
                      open ? (prev.includes(milestone.id) ? prev : [...prev, milestone.id]) : prev.filter((value) => value !== milestone.id)
                    );
                  }}
                >
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full">
                    <Zap className="h-3.5 w-3.5" />
                    <span>Actions en cours ({activeActions.length})</span>
                    <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {activeActions.map((action) => {
                      const tags = getTags(action);
                      const isDone = action.status === 'done';
                      return (
                        <div
                          key={action.id}
                          ref={(node) => {
                            actionCardRefs.current[action.id] = node;
                          }}
                          className="rounded-xl border border-border/70 bg-muted/40 p-3 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm">{action.name}</span>
                            <div className="flex items-center gap-2">
                              <ActionStatusBadge status={action.status} />
                              <span className="text-sm font-bold text-primary">{action.credits.toLocaleString('fr-FR')} €</span>
                            </div>
                          </div>

                          {(action.date_start || action.date_end) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {action.date_start && fmtDate(action.date_start)}
                              {action.date_start && action.date_end && ' -> '}
                              {action.date_end && fmtDate(action.date_end)}
                            </p>
                          )}

                          {/* Tags */}
                          {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {tags.map((tag: string) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                                      {tag}
                                    </Badge>
                                ))}
                              </div>
                          )}

                          <ContributorsAvatars contributors={action.contributors} />

                          <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
                            {isConnected && currentUserId && !action.contributors.some((contributor) => contributor.id === currentUserId) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px] gap-1 px-2"
                                disabled={candidateActionId === action.id}
                                onClick={() => handleCandidateAction(milestone.id, action)}
                              >
                                {candidateActionId === action.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3 w-3" />
                                )}
                                Candidater
                              </Button>
                            )}
                            {!isDone && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px] gap-1 px-2 text-emerald-700 dark:text-emerald-300"
                                disabled={doneActionId === action.id}
                                onClick={() => handleMarkActionDone(milestone.id, action)}
                              >
                                {doneActionId === action.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                Terminer
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2"
                              onClick={() => openEditActionModal(milestone.id, action)}
                            >
                              <Pencil className="h-3 w-3" /> Modifier
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-destructive"
                              disabled={deletingActionId === action.id}
                              onClick={() => setPendingDeleteAction({ milestoneId: milestone.id, action })}
                            >
                              {deletingActionId === action.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {doneActions.length > 0 && (
                <Collapsible
                  open={expandedDoneMilestoneIds.includes(milestone.id)}
                  onOpenChange={(open) => {
                    setExpandedDoneMilestoneIds((prev) =>
                      open ? (prev.includes(milestone.id) ? prev : [...prev, milestone.id]) : prev.filter((value) => value !== milestone.id)
                    );
                  }}
                >
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300 transition-colors group w-full">
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    <span>Terminées ({doneActions.length})</span>
                    <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {doneActions.map((action) => (
                      <div
                        key={action.id}
                        ref={(node) => {
                          actionCardRefs.current[action.id] = node;
                        }}
                        className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <span className="font-medium text-sm line-through text-emerald-700/80 dark:text-emerald-300/80">{action.name}</span>
                            </div>
                            {action.date_end && (
                              <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70 flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                Fin : {fmtDate(action.date_end)}
                              </p>
                            )}
                            {action.contributors.length > 0 && (
                              <div className="pt-1">
                                <ContributorsAvatars contributors={action.contributors} />
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{action.credits.toLocaleString('fr-FR')} €</span>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {actions.length === 0 && <p className="text-sm text-muted-foreground italic">Aucune action definie</p>}

            </CardContent>
          </Card>
        );
      })}

      {closedMilestones.length > 0 && (
              <Card className="border border-slate-200/70 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/20">
                <CardContent className="pt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowClosedMilestones((prev) => !prev)}
                    className="w-full flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Jalons clôturés ({closedMilestones.length})</span>
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showClosedMilestones ? 'rotate-180' : ''}`} />
                  </button>
      
                  {showClosedMilestones ? (
                    <div className="space-y-3">
                      {closedMilestones.map((milestone) => (
                        <Card key={milestone.id} className="border border-slate-200 dark:border-slate-800">
                          <CardContent className="pt-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold text-sm">{milestone.title}</h4>
                              <MilestoneStatusBadge status={milestone.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Jalon cloture: financement, modification et suppression desactives.
                            </p>
                            <MilestoneManageActions
                              onEdit={() => undefined}
                              onClose={() => undefined}
                              onDelete={() => undefined}
                              onRestore={() => void handleRestoreMilestone(milestone)}
                              isClosed
                              showEdit={false}
                              showDelete={false}
                              isRestoring={restoringMilestoneId === milestone.id}
                              disabled={restoringMilestoneId.length > 0 && restoringMilestoneId !== milestone.id}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
      </div>
    </>
  );
}
