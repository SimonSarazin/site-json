import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Loader2, AlertCircle } from "lucide-react";
import type { FieldErrors } from "react-hook-form";
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
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addEventSchema, type AddEventFormData } from "../../schemaForm";
import { useAddEvent } from "../../hooks/useAddMutations";
import { EditEventDatesTab } from "../profile-edit/EditEventDatesTab";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import {
  FormFieldName,
  FormFieldShortDescription,
  FormFieldPublic,
  FormFieldType,
  FormFieldTags,
  FormFieldUrl,
  SelectParent,
  ParentInfoReadonly,
} from "../profile-edit/fields";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";

// Mapping des champs par onglet pour détecter les erreurs
const TAB_FIELDS = {
  info: ['name', 'type', 'shortDescription', 'public', 'tags', 'url', 'organizer', 'parent'],
  dates: ['startDate', 'endDate', 'recurrency', 'openingHours'],
  location: ['addressCountry', 'addressLocality', 'postalCode', 'streetAddress', 'localityId'],
} as const;

type TabName = keyof typeof TAB_FIELDS;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasTabErrors(tabName: TabName, errors: FieldErrors<any>): boolean {
  return TAB_FIELDS[tabName].some(field => !!errors[field]);
}

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
      url: "",
      tags: [],
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
      parent: undefined,
    },
  });

  // Filtre pour ne montrer que les événements de l'organisateur (parent)
  const parentEventFilter = useMemo(() => {
    if (!parent?.id) return undefined;
    return { filters: {
      [`organizer.${parent.id}`]: { $exists: true },
    }};
  }, [parent?.id]);

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
                <TabsTrigger value="info" className="gap-1">
                  {t("AddEntity.tabs.info")}
                  {hasTabErrors('info', form.formState.errors) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="dates" className="gap-1">
                  {t("AddEntity.tabs.dates")}
                  {hasTabErrors('dates', form.formState.errors) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="location" className="gap-1">
                  {t("AddEntity.tabs.location")}
                  {hasTabErrors('location', form.formState.errors) && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Tab Informations */}
              <TabsContent value="info" className="space-y-4 mt-4">
                {/* Nom */}
                <FormFieldName control={form.control} required />

                {/* Type d'événement */}
                <FormFieldType control={form.control} variant="event" required />

                {/* Organisateur affiché en lecture seule */}
                <ParentInfoReadonly parent={parent} labelKey="ProfileEdit.fields.organizer.label" />

                {/* Événement parent (sous-événement) */}
                <FormField
                  control={form.control}
                  name="parent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ProfileEdit.fields.parentEvent.label")}</FormLabel>
                      <FormControl>
                        <SelectParent
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t("ProfileEdit.fields.parentEvent.placeholder")}
                          searchTypes={["events"]}
                          filters={parentEventFilter}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Description courte */}
                <FormFieldShortDescription control={form.control} />

                {/* URL (optionnel) */}
                <FormFieldUrl control={form.control} />

                {/* Public */}
                <FormFieldPublic
                  control={form.control}
                  labelKey="AddEntity.modal.event.public"
                />

                {/* Tags */}
                <FormFieldTags control={form.control} />

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
