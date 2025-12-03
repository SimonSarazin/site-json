import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EntityTypes } from "@communecter/cocolight-api-client";
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
import { TagsInput } from "@/components/form/TagsInput";
import { addProjectSchema, type AddProjectFormData } from "../../schemaForm";
import { useAddProject } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/TranslatedFormMessage";
import { EditLocationTab } from "../profile-edit/EditLocationTab";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addProjectSchema) as any,
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.project.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.project.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">{t("AddEntity.tabs.info")}</TabsTrigger>
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

                {/* URL (optionnel) */}
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ProfileEdit.fields.url.label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder={t("ProfileEdit.fields.url.placeholder")}
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
                          {t("AddEntity.modal.project.public")}
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Tags */}
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ProfileEdit.fields.tags.label")}</FormLabel>
                      <FormControl>
                        <TagsInput
                          tags={Array.isArray(field.value) ? field.value : []}
                          onTagsChange={field.onChange}
                          maxTags={10}
                          texts={{
                            placeholder: t("ProfileEdit.fields.tags.placeholder"),
                          }}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                {/* Parent affiché en lecture seule si fourni */}
                {parent && (
                  <div className="text-sm text-muted-foreground">
                    {t("ProfileEdit.fields.parent.label")}: <strong>{parent.serverData?.name}</strong>
                  </div>
                )}
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
