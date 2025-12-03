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
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { EditEventDatesTab } from "../profile-edit/EditEventDatesTab";
import { EditLocationTab } from "../profile-edit/EditLocationTab";

interface AddEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

/**
 * Modal pour créer un nouvel événement
 *
 * @param parent - L'entité parente (organisation, projet) pour définir l'organisateur
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
      openingHours: undefined,
      organizer: parent?.id
        ? {
            [parent.id]: {
              type: parent.getEntityType?.() || "organizations",
              name: parent.serverData?.name,
            },
          }
        : undefined,
      addressCountry: "",
      addressLocality: "",
      localityId: "",
      postalCode: "",
      streetAddress: "",
    },
  });

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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.event.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.event.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">{t("AddEntity.tabs.info")}</TabsTrigger>
                <TabsTrigger value="dates">{t("AddEntity.tabs.dates")}</TabsTrigger>
                <TabsTrigger value="location">{t("AddEntity.tabs.location")}</TabsTrigger>
              </TabsList>

              {/* Tab Informations */}
              <TabsContent value="info" className="space-y-4 mt-4">
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

                {/* Type d'événement */}
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
                          {t("AddEntity.modal.event.public")}
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Organisateur affiché en lecture seule si fourni */}
                {parent && (
                  <div className="text-sm text-muted-foreground">
                    {t("ProfileEdit.fields.organizer.label")}: <strong>{parent.serverData?.name}</strong>
                  </div>
                )}
              </TabsContent>

              {/* Tab Dates */}
              <TabsContent value="dates" className="mt-4">
                <EditEventDatesTab form={form} />
              </TabsContent>

              {/* Tab Localisation */}
              <TabsContent value="location" className="mt-4">
                <EditLocationTab form={form} />
              </TabsContent>
            </Tabs>

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
