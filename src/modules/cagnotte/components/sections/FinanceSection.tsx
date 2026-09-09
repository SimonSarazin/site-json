import type {ReactNode} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import type {FinanceSectionProps} from '@/modules/cagnotte/schema';
import {
    milestoneEditFormSchema,
    type MilestoneEditFormData,
} from '@/modules/cagnotte/schemaForm';
import {useFundingEnvelope} from '@/modules/cagnotte/hooks/useFundingEnvelope';
import {useCagnotteAdapter, useOrphanDepenseRepair} from '@/modules/cagnotte/hooks/useCagnotteAdapter';
import {useCocolight} from '@/hooks/useCocolight';
import {useT} from '@/hooks/useT';
import {useLoadNamespace} from '@/hooks/useLoadNamespace';
import {showErrorToast} from '@/lib/toastUtils';
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
import {Progress} from '@/components/ui/progress';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {formatCurrency as i18nFormatCurrency, formatDate as i18nFormatDate} from '@/modules/cagnotte/utils/format';
import {Alert, AlertDescription} from '@/components/ui/alert';
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/ui/collapsible';
import {ConfirmDialog} from '@/components/shared/ConfirmDialog';
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Textarea} from '@/components/ui/textarea';
import {MilestoneManageActions} from './MilestoneManageActions';
import CagnotteDialog from '@/modules/cagnotte/components/CagnotteDialog';
import {getApiErrorMessage} from '@/modules/cagnotte/lib/milestoneMutationHandlers';
import {
    useEditMilestone,
    useCloseMilestone,
    useDeleteMilestone,
    useRestoreMilestone,
} from '@/modules/cagnotte/actions/mutations';
import {useCagnottePermissions} from '@/modules/cagnotte/hooks/useCagnottePermissions';
import {useCagnotteContext} from '@/modules/cagnotte/hooks/useCagnotteContext';
import {useOptionalProfileEntity} from '@/modules/profil/hooks/useProfileEntity';
import {useSite} from "@/hooks/useSite.tsx";
import {useCagnotteType} from "@/modules/cagnotte/hooks/useCagnotteType.ts";
import {useOrganizationProjectsWithAnswers} from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers.ts";

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
    currentFunding?: number;
    transactions: TransactionHistoryItem[];
    actions: Array<{ status: 'todo' | 'done' }>;
    projectMilestoneIndex?: number;
    answerDepenseIndex?: number;
};

function MilestoneStatusBadge({status}: { status: Milestone['status'] }) {
    const config: Record<Milestone['status'], { label: string; className: string }> = {
        open: {label: 'ouvert', className: 'bg-primary/15 text-primary'},
        done: {label: 'done', className: 'bg-success/20 text-success'},
        close: {label: 'clôturé', className: 'bg-muted text-muted-foreground'},
    };
    // Fallback : un statut hors enum (donnée backend inattendue) ne doit pas
    // faire planter toute la section via un accès à `undefined.className`.
    const current = config[status] ?? config.open;
    return <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${current.className}`}>{current.label}</span>;
}

function PaymentStatusBadge({status}: { status: PaymentStatus }) {
    const config: Record<PaymentStatus, { icon: ReactNode; label: string; className: string }> = {
        pending: {icon: <Clock className="h-3 w-3"/>, label: 'En attente', className: 'bg-warning/20 text-warning'},
        paid: {icon: <CheckCircle2 className="h-3 w-3"/>, label: 'Payé', className: 'bg-success/20 text-success'},
        failed: {
            icon: <CircleDot className="h-3 w-3"/>,
            label: 'Échoué',
            className: 'bg-destructive/20 text-destructive'
        },
        refunded: {
            icon: <CircleDot className="h-3 w-3"/>,
            label: 'Remboursé',
            className: 'bg-muted text-muted-foreground'
        },
    };
    // Fallback : le backend peut renvoyer un paymentStatus hors des 4 clés connues
    // (le cast `as PaymentStatus` en amont le masque au type-check) → sans ce garde,
    // `undefined.className` planterait toute la section.
    const current = config[status] ?? config.pending;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${current.className}`}>
      {current.icon}
            {current.label}
    </span>
    );
}

export default function FinanceSection({id, props}: { id?: string; props: FinanceSectionProps }) {
    void id;
    const {api, entity} = useCocolight();
    useLoadNamespace('modules/cagnotte');
    const t = useT('modules/cagnotte');
    const formatCurrency = i18nFormatCurrency;
    const formatDate = i18nFormatDate;

    const {data: fundingData, isLoading, error, refetch: refetchFundingEnvelope} = useFundingEnvelope(id);
    const selectedProjectContextId = String(id || '').trim();

    // Configuration et transformation via useCagnotteAdapter
    const siteConfig = useSite();

    const {config: cagnotteConfig} = useCagnotteType({
        siteConfig: siteConfig?.config?.cagnotteModuleConfig?.defaultType,
    });

    const {
        projects: allProjects,
    } = useOrganizationProjectsWithAnswers({
        entity: entity || null,
        enabled: !!entity,
    });

    const {resources, savedSelectedResource, pendingMilestoneRepairs} = useCagnotteAdapter(
        fundingData,
        allProjects,
        cagnotteConfig,
        selectedProjectContextId
    );

    const targetResource = savedSelectedResource || resources[0];

    const [pendingScrollMilestoneId, setPendingScrollMilestoneId] = useState('');
    const milestoneCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [pendingDeleteMilestone, setPendingDeleteMilestone] = useState<Milestone | null>(null);
    const [deletingMilestoneId, setDeletingMilestoneId] = useState('');
    const [isEditMilestoneOpen, setIsEditMilestoneOpen] = useState(false);
    const [editingMilestoneId, setEditingMilestoneId] = useState('');
    const [closingMilestoneId, setClosingMilestoneId] = useState('');
    const [restoringMilestoneId, setRestoringMilestoneId] = useState('');
    const [showClosedMilestones, setShowClosedMilestones] = useState(false);

    // Resolution des IDs du contexte pour les mutations
    const projectId = String(targetResource?.projectId || fundingData?.selectedProject?.id || id || '').trim();
    const answerId = String(targetResource?.answerId || fundingData?.selectedProject?.answerId || '').trim();
    const milestoneCtx = {
        api,
        rawEnvelope: fundingData?.rawEnvelope,
        projectId,
        answerId,
    };

    const editMilestoneMutation = useEditMilestone(milestoneCtx);
    const deleteMilestoneMutation = useDeleteMilestone(milestoneCtx);
    const closeMilestoneMutation = useCloseMilestone(milestoneCtx);
    const restoreMilestoneMutation = useRestoreMilestone(milestoneCtx);

    const isSubmittingEditMilestone = editMilestoneMutation.isPending;

    const editForm = useForm<MilestoneEditFormData>({
        resolver: zodResolver(milestoneEditFormSchema),
        defaultValues: {name: '', description: '', targetAmount: 0, status: 'open'},
    });

    const highlightAndScroll = (element: HTMLElement) => {
        element.scrollIntoView({behavior: 'smooth', block: 'start'});
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
        window.setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
        }, 1600);
    };

    const data = useMemo<{ milestones: Milestone[] }>(() => {
        const maxItems = props?.maxItems ?? 10;
        const items = targetResource?.items ?? [];

        const mappedMilestones: Milestone[] = items.map((item, index) => {
            const transactions: TransactionHistoryItem[] = (item.funding || []).map((fund, fundIdx) => {
                const pStatus: PaymentStatus =
                    (fund.paymentStatus as PaymentStatus) ||
                    (fund.fundingType === 'prepaid' ? 'paid' : 'pending');

                return {
                    id: String(fund.id || fund.transactionId || `${item.itemId}-${fundIdx}`),
                    financerName: String(fund.financerName || 'Anonyme'),
                    amount: Number(fund.amount) || 0,
                    date: typeof fund.date === 'number' ? fund.date : fund.date ? new Date(fund.date).getTime() : Date.now(),
                    paymentStatus: pStatus,
                    transactionId: String(fund.transactionId ?? ""),
                };
            });

            return {
                id: item.itemId || item.milestoneId || String(index),
                title: item.name,
                description: item.description,
                status: (item.status as 'open' | 'done' | 'close') || 'open',
                targetAmount: item.price,
                currentFunding: item.currentFunding,
                transactions,
                actions: (item.actions || []).map((act) => ({
                    status: act.status === 'done' ? 'done' : 'todo',
                })),
                projectMilestoneIndex: item.depenseIndex >= 0 ? item.depenseIndex : index,
                answerDepenseIndex: item.depenseIndex >= 0 ? item.depenseIndex : index,
            };
        });

        return {
            milestones: mappedMilestones.slice(0, maxItems),
        };
    }, [targetResource?.items, props?.maxItems]);

    const openMilestones = useMemo(
        () => data.milestones.filter((milestone) => milestone.status !== 'close'),
        [data.milestones]
    );
    const closedMilestones = useMemo(
        () => data.milestones.filter((milestone) => milestone.status === 'close'),
        [data.milestones]
    );

    const profileCtx = useOptionalProfileEntity();
    const permissionEntity = profileCtx?.entity ?? entity;
    const cagnottePerms = useCagnottePermissions(permissionEntity, {
        hasActiveItems: openMilestones.length > 0,
        resourceId: projectId,
    });
    // Surface d'édition : les dépenses orphelines de la ressource affichée sont
    // réparées ici, par qui peut créer un palier — l'adaptateur n'écrit plus (M40).
    useOrphanDepenseRepair({
        resource: targetResource,
        repairs: pendingMilestoneRepairs,
        enabled: cagnottePerms.canCreateMilestone,
    });
    const cagnotteCtx = useCagnotteContext();

    const financeTotalFunding = targetResource?.resourceFinancedAmount ?? Number(fundingData?.finance?.totalFunding ?? 0);

    const openEditMilestoneModal = (milestone: Milestone) => {
        if (!cagnottePerms.isConnected) {
            showErrorToast(
                new Error(String(t('FinanceSection.toasts.loginRequired.edit'))),
                'FinanceSection.toasts.loginRequired.title',
                t,
            );
            return;
        }

        setEditingMilestoneId(milestone.id);
        editForm.reset({
            name: milestone.title,
            description: milestone.description || '',
            targetAmount: milestone.targetAmount || 0,
            status: milestone.status,
        });
        editForm.clearErrors();
        setIsEditMilestoneOpen(true);
    };

    const onValidEditMilestone = (data: MilestoneEditFormData) => {
        if (!api) {
            editForm.setError('root', {
                type: 'manual',
                message: String(t('FinanceSection.errors.noApiClient')),
            });
            return;
        }
        if (!projectId || !answerId || !editingMilestoneId) {
            editForm.setError('root', {
                type: 'manual',
                message: String(t('FinanceSection.errors.invalidContext')),
            });
            return;
        }

        editForm.clearErrors('root');
        editMilestoneMutation.mutate(
            {
                milestoneId: editingMilestoneId,
                name: data.name,
                description: data.description,
                status: data.status,
                targetAmount: data.targetAmount,
            },
            {
                onSuccess: () => {
                    setIsEditMilestoneOpen(false);
                    void refetchFundingEnvelope();
                },
                onError: (mutationError) => {
                    const message = getApiErrorMessage(
                        mutationError,
                        String(t('FinanceSection.errors.updateFailed')),
                    );
                    editForm.setError('root', {type: 'server', message});
                },
            },
        );
    };

    const handleDeleteMilestone = (milestone: Milestone) => {
        if (!cagnottePerms.isConnected) {
            showErrorToast(
                new Error(String(t('FinanceSection.toasts.loginRequired.delete'))),
                'FinanceSection.toasts.loginRequired.title',
                t,
            );
            return;
        }

        if (!api || !projectId || !answerId) {
            showErrorToast(
                new Error(String(t('FinanceSection.errors.apiContextIncomplete'))),
                'FinanceSection.toasts.deleteImpossible.title',
                t,
            );
            return;
        }

        setDeletingMilestoneId(milestone.id);
        deleteMilestoneMutation.mutate(
            {milestoneId: milestone.id, name: milestone.title},
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
        if (!cagnottePerms.isConnected) {
            showErrorToast(
                new Error(String(t('FinanceSection.toasts.loginRequired.close'))),
                'FinanceSection.toasts.loginRequired.title',
                t,
            );
            return;
        }

        const hasActions = milestone.actions.length > 0;
        const allActionsDone = hasActions && milestone.actions.every((action) => action.status === 'done');
        const canCloture = allActionsDone || !hasActions;
        if (!canCloture) {
            showErrorToast(
                new Error(String(t('FinanceSection.errors.actionsNotDone'))),
                'FinanceSection.toasts.closeImpossible.title',
                t,
            );
            return;
        }

        if (!api || !projectId || !answerId) {
            showErrorToast(
                new Error(String(t('FinanceSection.errors.apiContextIncomplete'))),
                'FinanceSection.toasts.closeImpossible.title',
                t,
            );
            return;
        }

        setClosingMilestoneId(milestone.id);
        closeMilestoneMutation.mutate(
            {milestoneId: milestone.id, name: milestone.title},
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

    const handleRestoreMilestone = (milestone: Milestone) => {
        if (!cagnottePerms.isConnected) {
            showErrorToast(
                new Error(String(t('FinanceSection.toasts.loginRequired.restore'))),
                'FinanceSection.toasts.loginRequired.title',
                t,
            );
            return;
        }

        if (!api || !projectId || !answerId) {
            showErrorToast(
                new Error(String(t('FinanceSection.errors.apiContextIncomplete'))),
                'FinanceSection.toasts.restoreImpossible.title',
                t,
            );
            return;
        }

        setRestoringMilestoneId(milestone.id);
        restoreMilestoneMutation.mutate(
            {milestoneId: milestone.id, name: milestone.title},
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
        return cagnotteCtx.onScrollToMilestone((detail) => {
            const milestoneId = String(detail?.milestoneId ?? '').trim();
            const eventProjectId = String(detail?.projectId ?? '').trim();
            const selectedProjectId = String(targetResource?.id ?? fundingData?.selectedProject?.id ?? '').trim();
            if (!milestoneId) return;
            if (eventProjectId && selectedProjectId && eventProjectId !== selectedProjectId) return;
            setPendingScrollMilestoneId(milestoneId);
        });
    }, [targetResource?.id, fundingData?.selectedProject?.id, cagnotteCtx]);

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
        return (
            <div className="space-y-4">
                {[0, 1, 2].map((index) => (
                    <Card key={index} className="border border-primary/10">
                        <CardHeader className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <Skeleton className="h-6 w-1/2"/>
                                <Skeleton className="h-6 w-20"/>
                            </div>
                            <Skeleton className="h-4 w-3/4"/>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Skeleton className="h-4 w-1/4"/>
                                    <Skeleton className="h-4 w-1/4"/>
                                </div>
                                <Skeleton className="h-3 w-full"/>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Skeleton className="h-12 w-full"/>
                                <Skeleton className="h-12 w-full"/>
                            </div>
                            <Skeleton className="h-10 w-full"/>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (error) {
        return <p className="text-sm text-destructive">{t('FinanceSection.error')}</p>;
    }

    if (data.milestones.length === 0) {
        return <p className="text-sm text-muted-foreground italic">{t('FinanceSection.noFunding')}</p>;
    }

    return (
        <>
            <ConfirmDialog
                open={!!pendingDeleteMilestone}
                onOpenChange={(open) => {
                    if (!open) setPendingDeleteMilestone(null);
                }}
                title={String(t('FinanceSection.deleteConfirm.title'))}
                description={pendingDeleteMilestone ? String(t('FinanceSection.deleteConfirm.description', undefined, {name: pendingDeleteMilestone.title})) : ''}
                confirmLabel={String(t('FinanceSection.deleteConfirm.confirm'))}
                cancelLabel={String(t('FinanceSection.deleteConfirm.cancel'))}
                isDestructive
                isPending={!!pendingDeleteMilestone && deletingMilestoneId === pendingDeleteMilestone.id}
                onConfirm={() => {
                    if (!pendingDeleteMilestone) return;
                    handleDeleteMilestone(pendingDeleteMilestone);
                }}
            />

            <Dialog open={isEditMilestoneOpen} onOpenChange={setIsEditMilestoneOpen}>
                <DialogContent className="sm:max-w-xl border border-primary/20 bg-card p-0 overflow-hidden">
                    <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
                        <DialogTitle
                            className="text-xl font-display">{t('FinanceSection.editDialog.title')}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={editForm.handleSubmit(onValidEditMilestone)} className="contents">
                        <div className="space-y-4 px-6 py-5">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-milestone-name">{t('FinanceSection.editDialog.fields.name')}</Label>
                                <Input
                                    id="edit-milestone-name"
                                    {...editForm.register('name')}
                                    placeholder={String(t('FinanceSection.editDialog.fields.namePlaceholder'))}
                                    disabled={isSubmittingEditMilestone}
                                    aria-invalid={!!editForm.formState.errors.name}
                                />
                                {editForm.formState.errors.name?.message ? (
                                    <p className="text-xs text-destructive">{String(t(editForm.formState.errors.name.message))}</p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-milestone-description">{t('FinanceSection.editDialog.fields.description')}</Label>
                                <Textarea
                                    id="edit-milestone-description"
                                    {...editForm.register('description')}
                                    placeholder={String(t('FinanceSection.editDialog.fields.descriptionPlaceholder'))}
                                    rows={3}
                                    disabled={isSubmittingEditMilestone}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="edit-milestone-target">{t('FinanceSection.editDialog.fields.targetAmount')}</Label>
                                    <Input
                                        id="edit-milestone-target"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        {...editForm.register('targetAmount', {valueAsNumber: true})}
                                        disabled={isSubmittingEditMilestone}
                                        aria-invalid={!!editForm.formState.errors.targetAmount}
                                    />
                                    {editForm.formState.errors.targetAmount?.message ? (
                                        <p className="text-xs text-destructive">{String(t(editForm.formState.errors.targetAmount.message))}</p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label>{t('FinanceSection.editDialog.fields.status')}</Label>
                                    <Select
                                        value={editForm.watch('status')}
                                        onValueChange={(value) => editForm.setValue('status', value as 'open' | 'done' | 'close')}
                                        disabled={isSubmittingEditMilestone}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue
                                                placeholder={String(t('FinanceSection.editDialog.fields.statusPlaceholder'))}/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                value="open">{t('FinanceSection.editDialog.statusOptions.open')}</SelectItem>
                                            <SelectItem
                                                value="done">{t('FinanceSection.editDialog.statusOptions.done')}</SelectItem>
                                            <SelectItem
                                                value="close">{t('FinanceSection.editDialog.statusOptions.close')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {editForm.formState.errors.root?.message ? (
                                <Alert variant="destructive" aria-live="polite">
                                    <Loader2 className="h-4 w-4 animate-spin"/>
                                    <AlertDescription>{editForm.formState.errors.root.message}</AlertDescription>
                                </Alert>
                            ) : null}

                            {isSubmittingEditMilestone ? (
                                <Alert aria-live="polite" className="border-primary/20 bg-primary/5 text-primary">
                                    <Loader2 className="h-4 w-4 animate-spin"/>
                                    <AlertDescription
                                        className="text-primary">{t('FinanceSection.editDialog.updatingState')}</AlertDescription>
                                </Alert>
                            ) : null}
                        </div>

                        <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditMilestoneOpen(false)}
                                disabled={isSubmittingEditMilestone}
                            >
                                {t('FinanceSection.editDialog.actions.cancel')}
                            </Button>
                            <Button type="submit" disabled={isSubmittingEditMilestone}
                                    className="bg-primary hover:bg-primary/90">
                                {isSubmittingEditMilestone ? <Loader2 className="h-4 w-4 animate-spin"/> :
                                    <Pencil className="h-4 w-4"/>}
                                {isSubmittingEditMilestone
                                    ? t('FinanceSection.editDialog.actions.submitting')
                                    : t('FinanceSection.editDialog.actions.submit')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="space-y-4">
                {openMilestones.map((milestone) => {
                    const transactions = milestone.transactions;
                    const funded = milestone.currentFunding ?? transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
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
                                    <MilestoneStatusBadge status={milestone.status}/>
                                </div>

                                <div
                                    className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm rounded-lg border border-primary/10 bg-primary/5 p-2.5">
                                    <div>
                                        <p className="text-muted-foreground text-xs">{t('FinanceSection.milestone.stats.transactions')}</p>
                                        <p className="font-semibold text-primary">{transactions.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">{t('FinanceSection.milestone.stats.objective')}</p>
                                        <p className="font-semibold text-primary">{formatCurrency(milestone.targetAmount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">{t('FinanceSection.milestone.stats.funding')}</p>
                                        <p className="font-semibold text-success">{formatCurrency(funded)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">{t('FinanceSection.milestone.stats.remaining')}</p>
                                        <p className="font-semibold text-warning">{formatCurrency(remaining)}</p>
                                    </div>
                                </div>

                                <Progress value={progress} className="h-2"/>

                                <div className="flex flex-wrap items-center gap-1">
                                    <CagnotteDialog
                                        totalAmount={financeTotalFunding}
                                        defaultResourceId={selectedProjectContextId || undefined}
                                        onRefresh={() => {
                                            void refetchFundingEnvelope();
                                        }}
                                        openContext={selectedProjectContextId ? {
                                            resourceId: selectedProjectContextId,
                                            itemId: milestone.id,
                                            hideResourceSelect: true,
                                            hideOtherItems: true,
                                        } : undefined}
                                    >
                                        <Button
                                            key={financeTotalFunding}
                                            size="sm"
                                            className="h-7 text-[11px] gap-1 px-2 bg-primary hover:bg-primary/90"
                                            disabled={milestone.status === 'close'}
                                        >
                                            <HandCoins className="h-3 w-3"/> {t('FinanceSection.milestone.fundButton')}
                                        </Button>
                                    </CagnotteDialog>
                                    <MilestoneManageActions
                                        onEdit={() => openEditMilestoneModal(milestone)}
                                        onClose={() => handleCloseMilestone(milestone)}
                                        onDelete={() => setPendingDeleteMilestone(milestone)}
                                        onRestore={() => handleRestoreMilestone(milestone)}
                                        isClosed={milestone.status === 'close'}
                                        isDeleting={deletingMilestoneId === milestone.id}
                                        isClosing={closingMilestoneId === milestone.id}
                                        isRestoring={restoringMilestoneId === milestone.id}
                                        closeDisabled={
                                            milestone.status === 'close' ||
                                            !milestone.actions.every((action) => action.status === 'done')
                                        }
                                        canEdit={cagnottePerms.canEditMilestone({status: milestone.status})}
                                        canClose={cagnottePerms.canCloseMilestone({status: milestone.status})}
                                        canRestore={cagnottePerms.canRestoreMilestone({status: milestone.status})}
                                        canDelete={cagnottePerms.canDeleteMilestone({
                                            status: milestone.status,
                                            hasTransactions: milestone.transactions.length > 0,
                                        })}
                                    />
                                </div>

                                <Collapsible>
                                    <CollapsibleTrigger
                                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full">
                                        <FileText className="h-3.5 w-3.5"/>
                                        <span>{t('FinanceSection.milestone.transactionsHistory', undefined, {count: transactions.length})}</span>
                                        <ChevronDown
                                            className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180"/>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-3 space-y-2.5">
                                        {transactions.length > 0 ? (
                                            transactions.map((transaction) => {
                                                const isPaid = transaction.paymentStatus === 'paid';
                                                return (
                                                    <div key={transaction.id}
                                                         className={`rounded-lg border px-3 py-2.5 text-sm ${isPaid ? 'border-success/30 bg-success/10' : 'border-border/70 bg-muted/40'}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    {isPaid && <CheckCircle2
                                                                        className="h-4 w-4 text-success"/>}
                                                                    <span
                                                                        className="font-medium">{transaction.financerName}</span>
                                                                </div>
                                                                <div
                                                                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                              <span className="inline-flex items-center gap-1">
                                                <Clock className="h-3 w-3"/>
                                                  {formatDate(transaction.date)}
                                              </span>
                                                                    {
                                                                        transaction.transactionId && (
                                                                            <span>ID: {transaction.transactionId}</span>
                                                                        )
                                                                    }
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                <PaymentStatusBadge status={transaction.paymentStatus}/>
                                                                <span
                                                                    className={`font-semibold ${isPaid ? 'text-success' : 'text-primary'}`}>{formatCurrency(transaction.amount)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">{t('FinanceSection.milestone.noTransactions')}</p>
                                        )}

                                        <div className="border-t pt-2 mt-2 text-xs text-muted-foreground">
                                            <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5"/> {t('FinanceSection.milestone.paidTransactions')}
                        </span>
                                                <span
                                                    className="font-semibold">{transactions.filter((transaction) => transaction.paymentStatus === 'paid').length}/{transactions.length}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5"/> {t('FinanceSection.milestone.accumulatedCredits')}
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
                    <Card className="border border-border bg-muted/30">
                        <CardContent className="pt-4 space-y-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowClosedMilestones((prev) => !prev)}
                                className="w-full flex items-center gap-2 text-sm font-medium text-muted-foreground justify-start h-auto py-1 px-2 hover:bg-transparent"
                            >
                                <CheckCircle2 className="h-4 w-4"/>
                                <span>{t('FinanceSection.closedMilestones.label', undefined, {count: closedMilestones.length})}</span>
                                <ChevronDown
                                    className={`h-4 w-4 ml-auto transition-transform ${showClosedMilestones ? 'rotate-180' : ''}`}/>
                            </Button>

                            {showClosedMilestones ? (
                                <div className="space-y-3">
                                    {closedMilestones.map((milestone) => (
                                        <Card key={milestone.id} className="border border-border">
                                            <CardContent className="pt-4 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h4 className="font-semibold text-sm">{milestone.title}</h4>
                                                    <MilestoneStatusBadge status={milestone.status}/>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {t('FinanceSection.closedMilestones.closedHelp')}
                                                </p>
                                                <MilestoneManageActions
                                                    onEdit={() => undefined}
                                                    onClose={() => undefined}
                                                    onDelete={() => undefined}
                                                    onRestore={() => handleRestoreMilestone(milestone)}
                                                    isClosed
                                                    showEdit={false}
                                                    showDelete={false}
                                                    canRestore={cagnottePerms.canRestoreMilestone({status: milestone.status})}
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