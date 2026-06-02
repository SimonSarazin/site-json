/**
 * Dialog de création d'une action dans un milestone — **composant autonome RHF**.
 *
 * Embarque son propre `useForm<ActionCreateFormData>` + `zodResolver(actionCreateFormSchema)`
 * et la mutation `useCreateAction` (factory) injectée via le contexte. Le parent
 * fournit `actionCtx`, `milestoneId`, `milestoneTitle`, `projectEntity`, et un
 * callback `onSuccess(actionId)` pour orchestrer le scroll/highlight après création.
 *
 * Toast succès/erreur géré automatiquement par `useMutationWithToast` (via factory).
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Plus } from "lucide-react";
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
import {
  useCreateAction,
  type ActionMutationContext,
} from "@/modules/cagnotte/actions/mutations";
import {
  actionCreateFormSchema,
  type ActionCreateFormData,
} from "@/modules/cagnotte/schemaForm";
import {
  frenchDateToPickerValue,
  pickerValueToFrenchDate,
} from "@/modules/cagnotte/utils/actionDateHelpers";
import { getApiErrorMessage } from "@/modules/cagnotte/lib/milestoneMutationHandlers";

export interface ActionCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contexte de mutation (apiClient + projectId) — passé à `useCreateAction`. */
  actionCtx: ActionMutationContext;
  /** Identifiant du milestone parent — pré-rempli dans le form. */
  milestoneId: string;
  /** Titre du milestone affiché dans le header (UX). */
  milestoneTitle: string;
  /**
   * Entité Project parente — passée à `<SelectMember>` qui appelle
   * `project.getContributors({ search })` pour alimenter l'autocomplete.
   * Si `null`, le picker reste désactivé.
   */
  projectEntity: Project | null;
  /**
   * Callback appelé après création réussie. Reçoit l'`actionId` (peut être vide si la
   * résolution a échoué) et le `status` validé du form (permet au parent de positionner
   * un scroll target dans la bonne section "active" / "done").
   */
  onSuccess?: (result: { actionId: string; status: "todo" | "done" }) => void;
}

const DEFAULT_VALUES: ActionCreateFormData = {
  name: "",
  credits: 0,
  status: "todo",
  milestoneId: "",
  tags: [],
  contributors: [],
  startDate: "",
  endDate: "",
};

export function ActionCreateDialog({
  open,
  onOpenChange,
  actionCtx,
  milestoneId,
  milestoneTitle,
  projectEntity,
  onSuccess,
}: ActionCreateDialogProps) {
  const t = useT("modules/cagnotte");
  const mutation = useCreateAction(actionCtx);

  const form = useForm<ActionCreateFormData>({
    resolver: zodResolver(actionCreateFormSchema),
    defaultValues: { ...DEFAULT_VALUES, milestoneId },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ ...DEFAULT_VALUES, milestoneId });
    form.clearErrors();
  }, [open, milestoneId, form]);

  const isPending = mutation.isPending;

  const onValid = (data: ActionCreateFormData) => {
    // Extraction des usernames des contributeurs sélectionnés (type "citoyens"
    // uniquement — les Organizations n'ont pas d'username). Le backend résout
    // `mentions: usernames[]` en `links.contributors.{userId}` automatiquement.
    const contributorUsernames = data.contributors
      .filter((c) => c.type === "citoyens" && typeof c.username === "string")
      .map((c) => c.username as string)
      .filter((u) => u.length > 0);

    form.clearErrors("root");
    mutation.mutate(
      {
        name: data.name,
        credits: data.credits,
        status: data.status,
        milestoneId: data.milestoneId,
        tags: data.tags,
        contributorUsernames,
        startDate: data.startDate,
        endDate: data.endDate,
      },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          onSuccess?.({ actionId: result.actionId, status: data.status });
        },
        onError: (error) => {
          const message = getApiErrorMessage(
            error,
            String(t("ActionsSection.errors.actionCreateFailed")),
          );
          form.setError("root", { type: "server", message });
        },
      },
    );
  };

  // Champs watch (pour DatePickerInput / TagsInput / Select qui ne supportent pas `register`)
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
            {String(t("ActionsSection.createActionDialog.title"))}
          </DialogTitle>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
            <span className="font-semibold">
              {String(t("ActionsSection.createActionDialog.milestoneLabel"))}
            </span>
            <span className="text-foreground">
              {milestoneTitle || String(t("ActionsSection.createActionDialog.noMilestoneSelected"))}
            </span>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onValid)} className="contents">
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="new-action-name">
                {String(t("ActionsSection.createActionDialog.nameLabel"))}
              </Label>
              <Input
                id="new-action-name"
                {...form.register("name")}
                disabled={isPending}
                aria-invalid={!!nameError}
              />
              {nameError ? (
                <p className="text-xs text-destructive">{String(t(nameError))}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>{String(t("ActionsSection.createActionDialog.contributorsLabel"))}</Label>
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
                  t("ActionsSection.createActionDialog.contributorsPlaceholder"),
                )}
                searchPlaceholder={String(
                  t("ActionsSection.createActionDialog.contributorsPlaceholder"),
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{String(t("ActionsSection.createActionDialog.tagsLabel"))}</Label>
              <TagsInput
                tags={tags}
                onTagsChange={(value) => form.setValue("tags", value)}
                maxTags={10}
                texts={{
                  placeholder: String(t("ActionsSection.createActionDialog.tagsPlaceholder")),
                  maxReached: String(t("ActionsSection.createActionDialog.tagsMaxReached")),
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-action-start-date">
                  {String(t("ActionsSection.createActionDialog.startDateLabel"))}
                </Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(startDate)}
                  onChange={(value) => form.setValue("startDate", pickerValueToFrenchDate(value))}
                  placeholder={String(t("ActionsSection.createActionDialog.startDatePlaceholder"))}
                  disabled={isPending}
                  endYear={2100}
                />
                {startDateError ? (
                  <p className="text-xs text-destructive">{String(t(startDateError))}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-action-end-date">
                  {String(t("ActionsSection.createActionDialog.endDateLabel"))}
                </Label>
                <DatePickerInput
                  value={frenchDateToPickerValue(endDate)}
                  onChange={(value) => form.setValue("endDate", pickerValueToFrenchDate(value))}
                  placeholder={String(t("ActionsSection.createActionDialog.endDatePlaceholder"))}
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
                <Label htmlFor="new-action-credits">
                  {String(t("ActionsSection.createActionDialog.creditsLabel"))}
                </Label>
                <Input
                  id="new-action-credits"
                  type="number"
                  min={0}
                  step="1"
                  {...form.register("credits", { valueAsNumber: true })}
                  disabled={isPending}
                  aria-invalid={!!creditsError}
                />
                {creditsError ? (
                  <p className="text-xs text-destructive">{String(t(creditsError))}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{String(t("ActionsSection.createActionDialog.statusLabel"))}</Label>
                <Select
                  value={status}
                  onValueChange={(value) => form.setValue("status", value as "todo" | "done")}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={String(t("ActionsSection.createActionDialog.statusPlaceholder"))}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">
                      {String(t("ActionsSection.createActionDialog.statusOptionTodo"))}
                    </SelectItem>
                    <SelectItem value="done">
                      {String(t("ActionsSection.createActionDialog.statusOptionDone"))}
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
                  {String(t("ActionsSection.createActionDialog.savingState"))}
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
              {String(t("ActionsSection.createActionDialog.cancel"))}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isPending
                ? String(t("ActionsSection.createActionDialog.submitting"))
                : String(t("ActionsSection.createActionDialog.submit"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Re-export pour permettre aux callers d'inférer le type sans dépendre directement
// de SelectMember (ex. tests, parents qui dérivent des helpers).
export type { SelectMemberValue };
