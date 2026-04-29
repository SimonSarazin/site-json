import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCocolight } from '@/hooks/useCocolight';
import { useToast } from '@/hooks/use-toast';
import { appendAnswerDepense, appendProjectMilestone } from '@/modules/cagnotte/lib/actionMilestonePathUpdates';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

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

function generateMilestoneId(existingIds: string[]): string {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const timestampPart = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0').slice(-8);
    const randomPart = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const candidate = `${timestampPart}${randomPart}`.slice(0, 24);
    if (!existing.has(candidate)) return candidate;
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, 24).padEnd(24, '0');
}

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
  const { apiClient } = useCocolight();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneTargetAmount, setMilestoneTargetAmount] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setMilestoneName('');
    setMilestoneDescription('');
    setMilestoneTargetAmount('0');
  }, [open]);

  const handleCreateMilestone = async () => {
    const cleanName = milestoneName.trim();
    const cleanDescription = milestoneDescription.trim();
    const targetAmount = Number(milestoneTargetAmount.replace(',', '.'));

    if (!isConnected) {
      setSubmitError('Vous devez être connecté pour ajouter un jalon.');
      return;
    }
    if (!apiClient) {
      setSubmitError('Client API indisponible.');
      return;
    }
    if (!selectedProjectId) {
      setSubmitError('Projet introuvable.');
      return;
    }
    if (!answerId) {
      setSubmitError('Answer introuvable pour ce projet.');
      return;
    }
    if (!cleanName) {
      setSubmitError('Le nom du jalon est obligatoire.');
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount < 0) {
      setSubmitError('Le montant a financer doit être un nombre supérieure à 0.');
      return;
    }
    if (!currentUserId) {
      setSubmitError('Utilisateur introuvable.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const milestoneId = generateMilestoneId(existingMilestoneIds);

      await appendProjectMilestone({
        source: apiClient,
        projectId: selectedProjectId,
        milestone: {
          milestoneId,
          name: cleanName,
          description: cleanDescription,
          status: 'open',
        },
      });

      await appendAnswerDepense({
        source: apiClient,
        answerId,
        depense: {
          poste: cleanName,
          price: targetAmount,
          date: new Date().toISOString(),
          user: currentUserId,
          milestone: milestoneId,
          financer: [],
        },
      });

      if (onCreated) {
        await onCreated({ milestoneId, name: cleanName, targetAmount });
      }

      toast({
        title: 'Jalon ajoute',
        description: `Le jalon "${cleanName}" a été ajouté`,
      });

      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ['funding-envelope'] });
      if (onRefetch) await onRefetch();
    } catch (createError) {
      const apiMessage =
        (createError as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ||
        (createError as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;
      const message = apiMessage || (createError instanceof Error ? createError.message : 'Erreur lors de la creation du jalon.');
      console.error('❌ Erreur creation jalon:', createError);
      setSubmitError(message);
      toast({
        title: 'Impossible d ajouter le jalon',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border border-primary/20 bg-card p-0 overflow-hidden">
        <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-display">Ajouter un jalon</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor={`${inputIdPrefix}-name`}>Nom du jalon</Label>
            <Input
              id={`${inputIdPrefix}-name`}
              value={milestoneName}
              onChange={(event) => setMilestoneName(event.target.value)}
              placeholder=""
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${inputIdPrefix}-target`}>Montant a financer (€)</Label>
            <Input
              id={`${inputIdPrefix}-target`}
              type="number"
              min={0}
              step="0"
              value={milestoneTargetAmount}
              onChange={(event) => setMilestoneTargetAmount(event.target.value)}
              disabled={isSubmitting}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${inputIdPrefix}-description`}>Description</Label>
            <Textarea
              id={`${inputIdPrefix}-description`}
              value={milestoneDescription}
              onChange={(event) => setMilestoneDescription(event.target.value)}
              placeholder=""
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2" role="status" aria-live="polite">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {isSubmitting && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary flex items-center gap-2" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Enregistrement...</span>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            onClick={handleCreateMilestone}
            disabled={isSubmitting || milestoneName.trim().length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isSubmitting ? 'Ajout...' : 'Ajouter le jalon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

