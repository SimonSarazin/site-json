/**
 * Dialog d'édition d'un milestone (nom, description, montant cible).
 *
 * Composant **autonome** : embarque son propre `useForm<MilestoneEditFormData>` +
 * `zodResolver(milestoneEditFormSchema)`. Le parent fournit seulement les valeurs
 * initiales, le `milestoneId` et la mutation à invoquer. Le dialog gère reset à
 * l'ouverture, validation Zod, état de submit, et propagation des erreurs API
 * via `form.setError('root', ...)`.
 *
 * L'UI n'expose pas le champ `status` (édition de status non offerte dans ce contexte
 * — réservé à `FinanceSection`), mais il est préservé via `initialValues.status` et
 * renvoyé tel quel à la mutation.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/useT";
import { getApiErrorMessage } from "@/modules/cagnotte/lib/milestoneMutationHandlers";
import {
  milestoneEditFormSchema,
  type MilestoneEditFormData,
} from "@/modules/cagnotte/schemaForm";
import type { EditMilestoneParams } from "@/modules/cagnotte/actions/mutations";

interface MilestoneEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Valeurs initiales injectées dans le form à chaque ouverture. */
  initialValues: MilestoneEditFormData;
  /** Identifiant du milestone à éditer (envoyé à la mutation). */
  milestoneId: string;
  /**
   * Index de la dépense dans `answer.answers.aapStep1.depense[]`, requis quand
   * `milestoneId` est vide
   */
  answerDepenseIndex?: number;
  /** Mutation pré-construite par le parent avec son contexte (apiClient, rawEnvelope, ids). */
  mutation: UseMutationResult<void, Error, EditMilestoneParams>;
  /** Clé i18n du message d'erreur générique si l'API ne renvoie rien d'utilisable. */
  apiErrorFallbackKey: string;
  /** Appelé après succès (typiquement pour refetcher l'envelope). */
  onSuccess?: () => void;
}

export function MilestoneEditDialog({
  open,
  onOpenChange,
  initialValues,
  milestoneId,
  answerDepenseIndex,
  mutation,
  apiErrorFallbackKey,
  onSuccess,
}: MilestoneEditDialogProps) {
  const t = useT("modules/cagnotte");

  const form = useForm<MilestoneEditFormData>({
    resolver: zodResolver(milestoneEditFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(initialValues);
    form.clearErrors();
  }, [open, initialValues, form]);

  const isPending = mutation.isPending;

  const onValid = (data: MilestoneEditFormData) => {
    if (!milestoneId && typeof answerDepenseIndex !== "number") {
      form.setError("root", {
        type: "manual",
        message: String(t("ActionsSection.errors.milestoneContextInvalid")),
      });
      return;
    }
    form.clearErrors("root");
    mutation.mutate(
      {
        milestoneId,
        name: data.name,
        description: data.description,
        status: data.status,
        targetAmount: data.targetAmount,
        answerDepenseIndex,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error) => {
          const message = getApiErrorMessage(error, String(t(apiErrorFallbackKey)));
          form.setError("root", { type: "server", message });
        },
      },
    );
  };

  const nameError = form.formState.errors.name?.message;
  const amountError = form.formState.errors.targetAmount?.message;
  const rootError = form.formState.errors.root?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border border-primary/20 bg-card p-0 overflow-hidden">
        <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-display">
            {String(t("ActionsSection.editMilestoneDialog.title"))}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onValid)} className="contents">
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-milestone-name">
                {String(t("ActionsSection.editMilestoneDialog.nameLabel"))}
              </Label>
              <Input
                id="edit-milestone-name"
                {...form.register("name")}
                placeholder={String(t("ActionsSection.editMilestoneDialog.namePlaceholder"))}
                disabled={isPending}
                aria-invalid={!!nameError}
              />
              {nameError ? (
                <p className="text-xs text-destructive">{String(t(nameError))}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-milestone-description">
                {String(t("ActionsSection.editMilestoneDialog.descriptionLabel"))}
              </Label>
              <Textarea
                id="edit-milestone-description"
                {...form.register("description")}
                placeholder={String(t("ActionsSection.editMilestoneDialog.descriptionPlaceholder"))}
                rows={3}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-milestone-target">
                {String(t("ActionsSection.editMilestoneDialog.targetAmountLabel"))}
              </Label>
              <Input
                id="edit-milestone-target"
                type="number"
                min={0}
                step="0.01"
                {...form.register("targetAmount", { valueAsNumber: true })}
                disabled={isPending}
                aria-invalid={!!amountError}
              />
              {amountError ? (
                <p className="text-xs text-destructive">{String(t(amountError))}</p>
              ) : null}
            </div>

            {rootError ? (
              <Alert variant="destructive" aria-live="polite">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{rootError}</AlertDescription>
              </Alert>
            ) : null}

            {isPending ? (
              <Alert aria-live="polite" className="border-primary/20 bg-primary/5 text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription className="text-primary">
                  {String(t("ActionsSection.editMilestoneDialog.updatingState"))}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {String(t("ActionsSection.editMilestoneDialog.cancel"))}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {isPending
                ? String(t("ActionsSection.editMilestoneDialog.submitting"))
                : String(t("ActionsSection.editMilestoneDialog.submit"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
