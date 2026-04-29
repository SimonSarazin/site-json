import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FinanceSectionProps } from '@/types/site-schema';
import { useFundingEnvelope } from '@/hooks/useFundingEnvelope';
import { useCocolight } from '@/hooks/useCocolight';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock,
  Coins,
  FileText,
  HandCoins,
  ListChecks,
  Loader2,
  Pencil,
} from 'lucide-react';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { SCROLL_TO_MILESTONE_EVENT } from './milestoneEvents';
import { MilestoneManageActions } from './MilestoneManageActions';
import CagnotteDialog from '@/components/cagnotte/CagnotteDialog';
import {
  closeMilestoneWithSync,
  deleteMilestoneWithSync,
  editMilestoneWithSync,
  getApiErrorMessage,
  restoreMilestoneWithSync,
} from '@/modules/cagnotte/lib/milestoneMutationHandlers';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
type TransactionHistoryItem = {
  id: string;
  financerName: string;
  amount: number;
  date: number;
  paymentStatus: PaymentStatus;
  transactionId: string;
};
type Milestone = {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'done' | 'close';
  targetAmount: number;
  transactions: TransactionHistoryItem[];
  actions: Array<{ status: 'todo' | 'done' }>;
  projectMilestoneIndex?: number;
  answerDepenseIndex?: number;
};

function MilestoneStatusBadge({ status }: { status: Milestone['status'] }) {
  const config: Record<Milestone['status'], { label: string; className: string }> = {
    open: { label: 'ouvert', className: 'bg-primary/15 text-primary' },
    done: { label: 'done', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    close: { label: 'clôturé', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  };
  const current = config[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${current.className}`}>{current.label}</span>;
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config: Record<PaymentStatus, { icon: ReactNode; label: string; className: string }> = {
    pending: { icon: <Clock className="h-3 w-3" />, label: 'En attente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    paid: { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Payé', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    failed: { icon: <CircleDot className="h-3 w-3" />, label: 'Échoué', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    refunded: { icon: <CircleDot className="h-3 w-3" />, label: 'Remboursé', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300' },
  };
  const current = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${current.className}`}>
      {current.icon}
      {current.label}
    </span>
  );
}


export default function FinanceSection({ id, props }: { id?: string; props: FinanceSectionProps }) {
  void id;
  const { apiClient, me } = useCocolight();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formatCurrency = (value: number): string => `${value.toLocaleString('fr-FR')} €`;
  const formatDate = (value: number): string => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const { data: fundingData, isLoading, error, refetch: refetchFundingEnvelope } = useFundingEnvelope(id);
  const [pendingScrollMilestoneId, setPendingScrollMilestoneId] = useState('');
  const milestoneCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingDeleteMilestone, setPendingDeleteMilestone] = useState<Milestone | null>(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState('');
  const [isEditMilestoneOpen, setIsEditMilestoneOpen] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState('');
  const [editMilestoneName, setEditMilestoneName] = useState('');
  const [editMilestoneDescription, setEditMilestoneDescription] = useState('');
  const [editMilestoneTargetAmount, setEditMilestoneTargetAmount] = useState('0');
  const [editMilestoneStatus, setEditMilestoneStatus] = useState<'open' | 'done' | 'close'>('open');
  const [editMilestoneError, setEditMilestoneError] = useState<string | null>(null);
  const [isSubmittingEditMilestone, setIsSubmittingEditMilestone] = useState(false);
  const [closingMilestoneId, setClosingMilestoneId] = useState('');
  const [restoringMilestoneId, setRestoringMilestoneId] = useState('');
  const [showClosedMilestones, setShowClosedMilestones] = useState(false);

  const highlightAndScroll = (element: HTMLElement) => {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
    window.setTimeout(() => {
      element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
    }, 1600);
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

  const selectedProjectContextId = String(fundingData?.selectedProject?.id || id || '').trim();
  const financeTotalFunding = Number(fundingData?.finance?.totalFunding ?? 0);

  const openEditMilestoneModal = (milestone: Milestone) => {
    if (!me?.isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour modifier un jalon.',
        variant: 'destructive',
      });
      return;
    }

    setEditingMilestoneId(milestone.id);
    setEditMilestoneName(milestone.title);
    setEditMilestoneDescription(milestone.description || '');
    setEditMilestoneTargetAmount(String(milestone.targetAmount || 0));
    setEditMilestoneStatus(milestone.status);
    setEditMilestoneError(null);
    setIsEditMilestoneOpen(true);
  };

  const handleEditMilestone = async () => {
    const projectId = String(fundingData?.selectedProject?.id || id || '').trim();
    const answerId = String(fundingData?.selectedProject?.answerId || '').trim();
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
    if (!me?.isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour supprimer un jalon.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = String(fundingData?.selectedProject?.id || id || '').trim();
    const answerId = String(fundingData?.selectedProject?.answerId || '').trim();

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
    if (!me?.isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour cloturer un jalon.',
        variant: 'destructive',
      });
      return;
    }

    const projectId = String(fundingData?.selectedProject?.id || id || '').trim();
    const answerId = String(fundingData?.selectedProject?.answerId || '').trim();
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
    const onScrollToMilestone = (event: Event) => {
      const detail = (event as CustomEvent<{ milestoneId?: string; projectId?: string }>).detail;
      const milestoneId = String(detail?.milestoneId ?? '').trim();
      const eventProjectId = String(detail?.projectId ?? '').trim();
      const selectedProjectId = String(fundingData?.selectedProject?.id ?? '').trim();
      if (!milestoneId) return;
      if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
      setPendingScrollMilestoneId(milestoneId);
    };

    window.addEventListener(SCROLL_TO_MILESTONE_EVENT, onScrollToMilestone as EventListener);
    return () => window.removeEventListener(SCROLL_TO_MILESTONE_EVENT, onScrollToMilestone as EventListener);
  }, [fundingData?.selectedProject?.id]);

  useEffect(() => {
    if (!pendingScrollMilestoneId) return;
    const milestoneElement = milestoneCardRefs.current[pendingScrollMilestoneId];
    if (!milestoneElement) return;

    const timer = window.setTimeout(() => {
      highlightAndScroll(milestoneElement);
      setPendingScrollMilestoneId('');
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pendingScrollMilestoneId, data.milestones]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground italic">Chargement des financements...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Erreur lors du chargement des financements</p>;
  }

  if (data.milestones.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Aucun financement disponible pour ce projet.</p>;
  }

  return (
    <>
      <ConfirmDialog
        open={!!pendingDeleteMilestone}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMilestone(null);
        }}
        title="Supprimer ce jalon ?"
        description={pendingDeleteMilestone ? `Le jalon "${pendingDeleteMilestone.title}" sera supprimé du projet et de l'answer associe.` : ''}
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
        isDestructive
        isPending={!!pendingDeleteMilestone && deletingMilestoneId === pendingDeleteMilestone.id}
        onConfirm={() => {
          if (!pendingDeleteMilestone) return;
          void handleDeleteMilestone(pendingDeleteMilestone);
        }}
      />

      <Dialog open={isEditMilestoneOpen} onOpenChange={setIsEditMilestoneOpen}>
        <DialogContent className="sm:max-w-xl border border-primary/20 bg-card p-0 overflow-hidden">
          <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="text-xl font-display">Modifier le jalon</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-milestone-name">Nom du jalon</Label>
              <Input id="edit-milestone-name" value={editMilestoneName} onChange={(event) => setEditMilestoneName(event.target.value)} placeholder="Nom du jalon" disabled={isSubmittingEditMilestone} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-milestone-description">Description</Label>
              <Textarea id="edit-milestone-description" value={editMilestoneDescription} onChange={(event) => setEditMilestoneDescription(event.target.value)} placeholder="Description du jalon" rows={3} disabled={isSubmittingEditMilestone} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-milestone-target">Montant cible (€)</Label>
                <Input id="edit-milestone-target" type="number" min={0} step="0.01" value={editMilestoneTargetAmount} onChange={(event) => setEditMilestoneTargetAmount(event.target.value)} disabled={isSubmittingEditMilestone} />
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={editMilestoneStatus} onValueChange={(value) => setEditMilestoneStatus(value as 'open' | 'done' | 'close')} disabled={isSubmittingEditMilestone}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Ouvert</SelectItem>
                    <SelectItem value="done">Termine</SelectItem>
                    <SelectItem value="close">Clôturé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editMilestoneError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2" role="status" aria-live="polite">
                <Loader2 className="h-4 w-4 mt-0.5 animate-spin" />
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
            <Button onClick={handleEditMilestone} disabled={isSubmittingEditMilestone || editMilestoneName.trim().length === 0} className="bg-primary hover:bg-primary/90">
              {isSubmittingEditMilestone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {isSubmittingEditMilestone ? 'Mise a jour...' : 'Mettre a jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
      {openMilestones.map((milestone) => {
        const transactions = milestone.transactions;
        const funded = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
        const remaining = Math.max(milestone.targetAmount - funded, 0);
        const progress = milestone.targetAmount > 0 ? (funded / milestone.targetAmount) * 100 : 0;

        return (
          <Card
            key={milestone.id}
            ref={(node) => {
              milestoneCardRefs.current[milestone.id] = node;
            }}
            className="border border-primary/10 shadow-sm overflow-hidden"
          >
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="font-display font-semibold capitalize">{milestone.title}</h3>
                <MilestoneStatusBadge status={milestone.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm rounded-lg border border-primary/10 bg-primary/5 p-2.5">
                <div>
                  <p className="text-muted-foreground text-xs">Transactions</p>
                  <p className="font-semibold text-primary">{transactions.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Objectif</p>
                  <p className="font-semibold text-primary">{formatCurrency(milestone.targetAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Financement</p>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(funded)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Reste</p>
                  <p className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(remaining)}</p>
                </div>
              </div>

              <Progress value={progress} className="h-2" />

              <div className="flex flex-wrap items-center gap-1">
                <CagnotteDialog
                  totalAmount={financeTotalFunding}
                  defaultProjectId={selectedProjectContextId || undefined}
                  onRefresh={() => {
                    void refetchFundingEnvelope();
                  }}
                  openContext={selectedProjectContextId ? {
                    projectId: selectedProjectContextId,
                    milestoneId: milestone.id,
                    hideProjectSelect: true,
                    hideOtherMilestones: true,
                  } : undefined}
                >
                  <Button
                    key={financeTotalFunding}
                    size="sm"
                    className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90"
                    disabled={milestone.status === 'close'}
                  >
                    <HandCoins className="h-3 w-3" /> Financer
                  </Button>
                </CagnotteDialog>
                <MilestoneManageActions
                  onEdit={() => openEditMilestoneModal(milestone)}
                  onClose={() => void handleCloseMilestone(milestone)}
                  onDelete={() => setPendingDeleteMilestone(milestone)}
                  onRestore={() => void handleRestoreMilestone(milestone)}
                  isClosed={milestone.status === 'close'}
                  isDeleting={deletingMilestoneId === milestone.id}
                  isClosing={closingMilestoneId === milestone.id}
                  isRestoring={restoringMilestoneId === milestone.id}
                  closeDisabled={
                    milestone.status === 'close' ||
                    !milestone.actions.every((action) => action.status === 'done')
                  }
                />
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Historique des transactions ({transactions.length})</span>
                  <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-2.5">
                  {transactions.length > 0 ? (
                    transactions.map((transaction) => {
                      const isPaid = transaction.paymentStatus === 'paid';
                      return (
                        <div key={transaction.id} className={`rounded-lg border px-3 py-2.5 text-sm ${isPaid ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-border/70 bg-muted/40'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                {isPaid && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                <span className="font-medium">{transaction.financerName}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(transaction.date)}
                                </span>
                                <span>ID: {transaction.transactionId}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <PaymentStatusBadge status={transaction.paymentStatus} />
                              <span className={`font-semibold ${isPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-primary'}`}>{formatCurrency(transaction.amount)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Aucune transaction enregistrée</p>
                  )}

                  <div className="border-t pt-2 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" /> Transactions payees
                      </span>
                      <span className="font-semibold">{transactions.filter((transaction) => transaction.paymentStatus === 'paid').length}/{transactions.length}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5" /> Credits cumules
                      </span>
                      <span className="font-semibold">{formatCurrency(funded)}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
                        Jalon clôturé: financement, modification et suppression desactives.
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
