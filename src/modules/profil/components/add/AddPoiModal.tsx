import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Loader2, AlertCircle } from "lucide-react";
import type { FieldErrors, Resolver } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPoiSchema, type AddPoiFormData } from "../../schemaForm";
import { useAddPoi } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/fields/TranslatedFormMessage";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import {
  FormFieldName,
  FormFieldTags,
  ParentInfoReadonly,
} from "../profile-edit/fields";

// Mapping des champs par onglet pour détecter les erreurs
const TAB_FIELDS = {
  info: ['name', 'type', 'description', 'tags'],
  location: ['addressCountry', 'addressLocality', 'postalCode', 'streetAddress', 'localityId'],
} as const;

type TabName = keyof typeof TAB_FIELDS;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasTabErrors(tabName: TabName, errors: FieldErrors<any>): boolean {
  return TAB_FIELDS[tabName].some(field => !!errors[field]);
}

// Types de POI disponibles
const POI_TYPES = [
  "place",
  "link",
  "tool",
  "machine",
  "software",
  "rh",
  "video",
  "history",
  "something2See",
  "funPlace",
  "artPiece",
  "streetArts",
  "openScene",
  "stand",
  "parking",
  "other",
] as const;

interface AddPoiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

/**
 * Modal pour créer un nouveau POI (Point d'Intérêt)
 *
 * @param parent - L'entité parente (organisation, projet, événement)
 */
export function AddPoiModal({ open, onOpenChange, parent }: AddPoiModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddPoi(parent);

  const form = useForm<AddPoiFormData>({
    resolver: zodResolver(addPoiSchema) as Resolver<AddPoiFormData>,
    defaultValues: {
      name: "",
      type: "place",
      description: "",
      tags: [],
      addressCountry: "",
      addressLocality: "",
      localityId: "",
      postalCode: "",
      streetAddress: "",
    },
  });

  const onSubmit = async (data: AddPoiFormData) => {
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

  // Traductions des types de POI
  const getPoiTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      place: "Lieu",
      link: "Lien",
      tool: "Outil",
      machine: "Machine",
      software: "Logiciel",
      rh: "Ressource humaine",
      video: "Vidéo",
      history: "Histoire",
      something2See: "À voir",
      funPlace: "Lieu sympa",
      artPiece: "Oeuvre d'art",
      streetArts: "Art de rue",
      openScene: "Scène ouverte",
      stand: "Stand",
      parking: "Parking",
      other: "Autre",
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.poi.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.poi.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <Tabs defaultValue="info" className="w-full flex-1 flex flex-col min-h-0">
              <div className="overflow-x-auto scrollbar-hide -mx-6 px-6 shrink-0">
                <TabsList className="w-max min-w-full flex">
                  <TabsTrigger value="info" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {t("AddEntity.tabs.info")}
                    {hasTabErrors('info', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="location" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {t("AddEntity.tabs.location")}
                    {hasTabErrors('location', form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto pr-4">
              {/* Tab Informations */}
              <TabsContent value="info" className="space-y-4">

                {/* Parent affiché en lecture seule si fourni */}
                <ParentInfoReadonly parent={parent} />

                {/* Nom */}
                <FormFieldName control={form.control} required showDescription />

                {/* Type de POI */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {POI_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {getPoiTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ProfileEdit.fields.description.label")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("ProfileEdit.fields.description.placeholder")}
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                {/* Tags */}
                <FormFieldTags control={form.control} extendedTexts />

              </TabsContent>

              {/* Tab Localisation */}
              <TabsContent value="location">
                <EditLocationTab form={form} />
              </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t border-border">
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
