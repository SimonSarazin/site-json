import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EVENT_TYPES, type EntityTypes } from "@communecter/cocolight-api-client";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addEventSchema, type AddEventFormData } from "../../schemaForm";
import { useAddEvent } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/TranslatedFormMessage";

interface AddEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

/**
 * Modal pour cr&eacute;er un nouvel &eacute;v&eacute;nement
 *
 * @param parent - L'entit&eacute; parente (organisation, projet) pour d&eacute;finir l'organisateur
 */
export function AddEventModal({ open, onOpenChange, parent }: AddEventModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddEvent(parent);

  const form = useForm<AddEventFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addEventSchema) as any,
    defaultValues: {
      name: "",
      type: "meeting",
      shortDescription: "",
      public: true,
      recurrency: false,
      startDate: undefined,
      endDate: undefined,
      organizer: parent?.id
        ? {
            [parent.id]: {
              type: parent.getEntityType?.() || "organizations",
              name: parent.serverData?.name,
            },
          }
        : undefined,
    },
  });

  const recurrency = form.watch("recurrency");

  const onSubmit = async (data: AddEventFormData) => {
    try {
      await addMutation.mutateAsync(data);
      form.reset();
      onOpenChange(false);
    } catch {
      // Error handling is done in the mutation
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.event.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.event.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nom */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ProfileEdit.fields.name.label")} *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("ProfileEdit.fields.name.placeholder")}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

            {/* Type d'&eacute;v&eacute;nement */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ProfileEdit.fields.eventType.label")} *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("ProfileEdit.fields.eventType.placeholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`ProfileEdit.fields.eventType.options.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

            {/* Description courte */}
            <FormField
              control={form.control}
              name="shortDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ProfileEdit.fields.shortDescription.label")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("ProfileEdit.fields.shortDescription.placeholder")}
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

            {/* R&eacute;currence */}
            <FormField
              control={form.control}
              name="recurrency"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      {t("ProfileEdit.fields.recurrency.label")}
                    </FormLabel>
                    <FormDescription>
                      {t("ProfileEdit.fields.recurrency.description")}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Dates (uniquement si non récurrent) */}
            {!recurrency && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("ProfileEdit.fields.startDate.label")} *</FormLabel>
                      <FormControl>
                        <DateTimePicker
                          value={field.value ? new Date(field.value) : undefined}
                          onChange={(date) => field.onChange(date?.toISOString())}
                          placeholder={t("ProfileEdit.fields.startDate.placeholder")}
                          granularity="minute"
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t("ProfileEdit.fields.endDate.label")} *</FormLabel>
                      <FormControl>
                        <DateTimePicker
                          value={field.value ? new Date(field.value) : undefined}
                          onChange={(date) => field.onChange(date?.toISOString())}
                          placeholder={t("ProfileEdit.fields.endDate.placeholder")}
                          granularity="minute"
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Note pour &eacute;v&eacute;nements r&eacute;currents */}
            {recurrency && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                {t("ProfileEdit.schedule.openingHours.description")}
              </div>
            )}

            {/* Public */}
            <FormField
              control={form.control}
              name="public"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Public
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Organisateur affich&eacute; en lecture seule si fourni */}
            {parent && (
              <div className="text-sm text-muted-foreground">
                {t("ProfileEdit.fields.organizer.label")}: <strong>{parent.serverData?.name}</strong>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={addMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("ProfileEdit.saving")}
                  </>
                ) : (
                  t("AddEntity.create")
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
