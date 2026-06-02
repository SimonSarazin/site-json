/**
 * Dialog d'édition d'une action — **composant autonome RHF**.
 *
 * Embarque son propre `useForm<ActionEditFormData>` + `zodResolver(actionEditFormSchema)`
 * et la mutation `useEditAction` (factory). Le parent fournit `actionCtx`, `editingAction`
 * (avec le baseline pour calcul du diff), `milestoneTitle`, `projectEntity` et un callback
 * `onSuccess` optionnel.
 *
 * Calcule le delta avant→après via `calculateActionDiff` et n'appelle la mutation que si
 * au moins un champ a changé (sinon toast « aucune modification »).
 */
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import type { Project } from "@communecter/cocolight-api-client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagsInput } from "@/components/form/TagsInput";
import { SelectMember, type SelectMemberValue } from "@/components/form/SelectMember";
import { DatePickerInput } from "@/components/form/DatePickerInput";
import { useT } from "@/hooks/useT";
import { showSuccessToast } from "@/lib/toastUtils";
import {
  useEditAction,
  type ActionMutationContext,
} from "@/modules/cagnotte/actions/mutations";
import {
  actionEditFormSchema,
  type ActionEditFormData,
} from "@/modules/cagnotte/schemaForm";
import {
  frenchDateToPickerValue,
  pickerValueToFrenchDate,
  timestampToFrenchDate,
} from "@/modules/cagnotte/utils/actionDateHelpers";
import { calculateActionDiff } from "@/modules/cagnotte/lib/actionDiffCalculator";
import { getApiErrorMessage } from "@/modules/cagnotte/lib/milestoneMutationHandlers";

/**
 * Action telle qu'elle est représentée côté UI (récupérée depuis `fundingData.milestones`).
 * Sert de baseline pour le diff calculator.
 */
export interface EditingActionContext {
  milestoneId: string;
  /** ID MongoDB de l'action (envoyé à la mutation `useEditAction`). */
  actionEntityId: string;
  action: {
    name: string;
    credits: number;
    status: "todo" | "done";
    tags: string[];
    contributors: Array<{ id: string; name?: string }>;
    date_start?: number;
    date_end?: number;
  };
}

export interface ActionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionCtx: ActionMutationContext;
  editingAction: EditingActionContext;
  milestoneTitle: string;
  /**
   * Entité Project parente — passée à `<SelectMember>` pour le picker de contributeurs.
   * Si `null`, le picker reste désactivé (les contribs déjà liés restent affichés).
   */
  projectEntity: Project | null;
  onSuccess?: () => void;
}

export function ActionEditDialog({
  open,
  onOpenChange,
  actionCtx,
  editingAction,
  milestoneTitle,
  projectEntity,
  onSuccess,
}: ActionEditDialogProps) {
  const t = useT("modules/cagnotte");
  const mutation = useEditAction(actionCtx);

  // Pré-remplissage des contributeurs déjà liés. On suppose `type: "citoyens"` car
  // historiquement les contributeurs d'action sont des Users — si un jour le backend
  // accepte des Organizations, il faudra étendre `EditingActionContext.contributors`.
  const initialContributors = useMemo<SelectMemberValue[]>(
    () =>
      editingAction.action.contributors.map((c) => ({
        id: c.id,
        type: "citoyens",
        name: c.name ?? c.id,
      })),
    [editingAction],
  );

  const defaultValues = useMemo<ActionEditFormData>(
    () => ({
      id: editingAction.actionEntityId,
      name: editingAction.action.name,
      credits: editingAction.action.credits,
      status: editingAction.action.status,
      tags: editingAction.action.tags,
      contributors: initialContributors,
      startDate: timestampToFrenchDate(editingAction.action.date_start),
      endDate: timestampToFrenchDate(editingAction.action.date_end),
    }),
    [editingAction, initialContributors],
  );

  const form = useForm<ActionEditFormData>({
    resolver: zodResolver(actionEditFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
    form.clearErrors();
  }, [open, defaultValues, form]);

  const isPending = mutation.isPending;

  const onValid = (data: ActionEditFormData) => {
    const updates = calculateActionDiff({
      previous: editingAction.action,
      next: {
        name: data.name,
        credits: data.credits,
        status: data.status,
        tags: data.tags,
        contributors: data.contributors,
        startDate: data.startDate,
        endDate: data.endDate,
      },
      formatTimestampToFrenchDate: timestampToFrenchDate,
    });

    if (Object.keys(updates).length === 0) {
      // Aucun champ modifié — pas la peine d'appeler la mutation. On notifie l'utilisateur
      // et on ferme. Pas de toast d'erreur ici, c'est un cas "neutre" (UX gentle).
      showSuccessToast("ActionsSection.toasts.noModification.title", t);
      onOpenChange(false);
      return;
    }

    form.clearErrors("root");
    mutation.mutate(
      {
        actionId: editingAction.actionEntityId,
        updates,
        name: data.name,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error) => {
          const message = getApiErrorMessage(
            error,
            String(t("ActionsSection.errors.actionEditFailed")),
          );
          form.setError("root", { type: "server", message });
        },
      },
    );
  };

  const status = form.watch("status");
  const tags = form.watch("tags");
  const contributors = form.watch("contributors");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  const nameError = form.formState.errors.name?.message;
  const creditsError = form.formState.errors.credits?.message;
  const startDateError = form.formState.errors.startDate?.message;
  const endDateError = form.formState.errors.endDate?.message;
  const rootError = form.formState.errors.root?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border border-primary/20 bg-card p-0 overflow-hidden">
        <DialogHeader className="space-y-2 px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-display">
            {String(t("ActionsSection.editActionDialog.title"))}
          </DialogTitle>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
            <span className="font-semibold">
              {String(t("ActionsSection.editActionDialog.milestoneLabel"))}
            </span>
            <span className="text-foreground">
              {milestoneTitle ||
                String(t("ActionsSection.editActionDialog.noMilestoneSelected"))}
            </span>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onValid)} className="contents">
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-action-name">
                {String(t("ActionsSection.editActionDialog.nameLabel"))}
              </Label>
              <Input
                id="edit-action-name"
                {...form.register("name")}
                placeholder={String(t("ActionsSection.editActionDialog.namePlaceholder"))}
                disabled={isPending}
                aria-invalid={!!nameError}
              />
              {nameError ? (
                <p className="text-xs text-destructive">{String(t(nameError))}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>{String(t("ActionsSection.editActionDialog.contributorsLabel"))}</Label>
              <SelectMember
                entity={projectEntity}
                value={contributors}
                onChange={(next) =>
                  form.setValue(
                    "contributors",
                    Array.isArray(next) ? next : next ? [next] : [],
                  )
                }
                multiple
                searchType="citoyens"
                disabled={isPending}
                placeholder={String(
                  t("ActionsSection.editActionDialog.contributorsPlaceholder"),
                )}
                searchPlaceholder={String(
                  t("ActionsSection.editActionDialog.contributorsPlaceholder"),
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{String(t("ActionsSection.editActionDialog.tagsLabel"))}</Label>
              <TagsInput
                tags={tags}
                onTagsChange={(value) => form.setValue("tags", value)}
                maxTags={10}
                texts={{
                  placeholder: String(t("ActionsSection.editActionDialog.tagsPlaceholder")),
                  maxReached: String(t("ActionsSection.editActionDialog.tagsMaxReached")),
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-action-start-date">
                  {String(t("ActionsSection.editActionDialog.startDateLabel"))}
                </Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(startDate)}
                  onChange={(value) =>
                    form.setValue("startDate", pickerValueToFrenchDate(value))
                  }
                  placeholder={String(t("ActionsSection.editActionDialog.startDatePlaceholder"))}
                  disabled={isPending}
                  endYear={2100}
                />
                {startDateError ? (
                  <p className="text-xs text-destructive">{String(t(startDateError))}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-action-end-date">
                  {String(t("ActionsSection.editActionDialog.endDateLabel"))}
                </Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(endDate)}
                  onChange={(value) => form.setValue("endDate", pickerValueToFrenchDate(value))}
                  placeholder={String(t("ActionsSection.editActionDialog.endDatePlaceholder"))}
                  disabled={isPending}
                  endYear={2100}
                />
                {endDateError ? (
                  <p className="text-xs text-destructive">{String(t(endDateError))}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-action-credits">
                  {String(t("ActionsSection.editActionDialog.creditsLabel"))}
                </Label>
                <Input
                  id="edit-action-credits"
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("credits", { valueAsNumber: true })}
                  disabled={isPending}
                  aria-invalid={!!creditsError}
                />
                {creditsError ? (
                  <p className="text-xs text-destructive">{String(t(creditsError))}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{String(t("ActionsSection.editActionDialog.statusLabel"))}</Label>
                <Select
                  value={status}
                  onValueChange={(value) => form.setValue("status", value as "todo" | "done")}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={String(t("ActionsSection.editActionDialog.statusPlaceholder"))}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">
                      {String(t("ActionsSection.editActionDialog.statusOptionTodo"))}
                    </SelectItem>
                    <SelectItem value="done">
                      {String(t("ActionsSection.editActionDialog.statusOptionDone"))}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  {String(t("ActionsSection.editActionDialog.updatingState"))}
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
              {String(t("ActionsSection.editActionDialog.cancel"))}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              {isPending
                ? String(t("ActionsSection.editActionDialog.submitting"))
                : String(t("ActionsSection.editActionDialog.submit"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
