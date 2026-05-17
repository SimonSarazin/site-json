import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { useCocolight } from '@/hooks/useCocolight';
import { useT } from '@/hooks/useT';
import { useLoadNamespace } from '@/hooks/useLoadNamespace';
import { useCreateMilestone } from '@/modules/cagnotte/actions/mutations';
import { getApiErrorMessage } from '@/modules/cagnotte/lib/milestoneMutationHandlers';
import { generateMilestoneId } from '@/modules/cagnotte/utils/idGeneration';
import {
  milestoneCreateFormSchema,
  type MilestoneCreateFormData,
} from '@/modules/cagnotte/schemaForm';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

type CreateMilestoneDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProjectId: string;
  answerId: string;
  currentUserId: string;
  existingMilestoneIds: string[];
  isConnected: boolean;
  inputIdPrefix?: string;
  onCreated?: (payload: { milestoneId: string; name: string; targetAmount: number }) => void | Promise<void>;
  onRefetch?: () => unknown | Promise<unknown>;
};

const DEFAULT_VALUES: MilestoneCreateFormData = {
  name: '',
  description: '',
  targetAmount: 0,
};

export default function CreateMilestoneDialog({
  open,
  onOpenChange,
  selectedProjectId,
  answerId,
  currentUserId,
  existingMilestoneIds,
  isConnected,
  inputIdPrefix = 'milestone',
  onCreated,
  onRefetch,
}: CreateMilestoneDialogProps) {
  const { api } = useCocolight();
  useLoadNamespace('modules/cagnotte');
  const t = useT('modules/cagnotte');

  const form = useForm<MilestoneCreateFormData>({
    resolver: zodResolver(milestoneCreateFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const createMilestoneMutation = useCreateMilestone({
    api,
    rawEnvelope: null,
    projectId: selectedProjectId,
    answerId,
  });
  const isSubmitting = createMilestoneMutation.isPending;

  useEffect(() => {
    if (!open) return;
    form.reset(DEFAULT_VALUES);
    form.clearErrors();
  }, [open, form]);

  const setRootError = (key: string) => {
    form.setError('root', { type: 'manual', message: String(t(key)) });
  };

  const onValid = (data: MilestoneCreateFormData) => {
    // Validations contextuelles non exprimables en Zod statique (dépendent de props).
    if (!isConnected) return setRootError('CreateMilestoneDialog.errors.notConnected');
    if (!api) return setRootError('CreateMilestoneDialog.errors.noApiClient');
    if (!selectedProjectId) return setRootError('CreateMilestoneDialog.errors.noProject');
    if (!answerId) return setRootError('CreateMilestoneDialog.errors.noAnswer');
    if (!currentUserId) return setRootError('CreateMilestoneDialog.errors.noUser');

    form.clearErrors('root');
    const milestoneId = generateMilestoneId(existingMilestoneIds);

    createMilestoneMutation.mutate(
      {
        milestoneId,
        name: data.name,
        description: data.description,
        status: 'open',
        targetAmount: data.targetAmount,
        userId: currentUserId,
      },
      {
        onSuccess: async () => {
          if (onCreated) {
            await onCreated({ milestoneId, name: data.name, targetAmount: data.targetAmount });
          }
          onOpenChange(false);
          if (onRefetch) await onRefetch();
        },
        onError: (createError) => {
          const message = getApiErrorMessage(
            createError,
            String(t('CreateMilestoneDialog.errors.createFailed')),
          );
          form.setError('root', { type: 'server', message });
        },
      },
    );
  };

  const submitError = form.formState.errors.root?.message;
  const nameError = form.formState.errors.name?.message;
  const amountError = form.formState.errors.targetAmount?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border border-primary/20 bg-card p-0 overflow-hidden">
        <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-display">{t('CreateMilestoneDialog.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onValid)} className="contents">
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor={`${inputIdPrefix}-name`}>{t('CreateMilestoneDialog.fields.name')}</Label>
              <Input
                id={`${inputIdPrefix}-name`}
                {...form.register('name')}
                disabled={isSubmitting}
                aria-invalid={!!nameError}
              />
              {nameError ? (
                <p className="text-xs text-destructive">{String(t(nameError))}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${inputIdPrefix}-target`}>{t('CreateMilestoneDialog.fields.targetAmount')}</Label>
              <Input
                id={`${inputIdPrefix}-target`}
                type="number"
                min={0}
                step="0.01"
                {...form.register('targetAmount', { valueAsNumber: true })}
                disabled={isSubmitting}
                aria-invalid={!!amountError}
                className="bg-background"
              />
              {amountError ? (
                <p className="text-xs text-destructive">{String(t(amountError))}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${inputIdPrefix}-description`}>{t('CreateMilestoneDialog.fields.description')}</Label>
              <Textarea
                id={`${inputIdPrefix}-description`}
                {...form.register('description')}
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {submitError ? (
              <Alert variant="destructive" aria-live="polite">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            {isSubmitting ? (
              <Alert aria-live="polite" className="border-primary/20 bg-primary/5 text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription className="text-primary">
                  {t('CreateMilestoneDialog.states.saving')}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('CreateMilestoneDialog.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSubmitting ? t('CreateMilestoneDialog.actions.submitting') : t('CreateMilestoneDialog.actions.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
