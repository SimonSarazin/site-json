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
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addProjectSchema, type AddProjectFormData } from "../../schemaForm";
import { useAddProject } from "../../hooks/useAddMutations";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import {
  FormFieldName,
  FormFieldTags,
  FormFieldShortDescription,
  FormFieldUrl,
  FormFieldPublic,
  ParentInfoReadonly,
} from "../profile-edit/fields";

// Mapping des champs par onglet pour détecter les erreurs
const TAB_FIELDS = {
  info: ['name', 'shortDescription', 'url', 'public', 'tags'],
  location: ['addressCountry', 'addressLocality', 'postalCode', 'streetAddress', 'localityId'],
} as const;

type TabName = keyof typeof TAB_FIELDS;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasTabErrors(tabName: TabName, errors: FieldErrors<any>): boolean {
  return TAB_FIELDS[tabName].some(field => !!errors[field]);
}

interface AddProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

/**
 * Modal pour créer un nouveau projet
 *
 * @param parent - L'entité parente (organisation, utilisateur) pour lier le projet
 */
export function AddProjectModal({ open, onOpenChange, parent }: AddProjectModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddProject(parent);

  const form = useForm<AddProjectFormData>({
    resolver: zodResolver(addProjectSchema) as Resolver<AddProjectFormData>,
    defaultValues: {
      name: "",
      shortDescription: "",
      public: true,
      url: "",
      tags: [],
      preferences: {
        isOpenData: false,
        isOpenEdition: false,
        crowdfunding: true,
      },
      addressCountry: "",
      addressLocality: "",
      localityId: "",
      postalCode: "",
      streetAddress: "",
    },
  });

  const onSubmit = async (data: AddProjectFormData) => {
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.project.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.project.description")}
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

                {/* Description courte */}
                <FormFieldShortDescription control={form.control} showDescription />

                {/* URL (optionnel) */}
                <FormFieldUrl control={form.control} showDescription />

                {/* Public */}
                <FormFieldPublic control={form.control} />

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
