import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { CLASSIFIED_SECTIONS, CLASSIFIED_CATEGORIES, CLASSIFIED_SUBCATEGORIES } from "@communecter/cocolight-api-client";
import { Loader2, AlertCircle } from "lucide-react";
import type { FieldErrors, FieldValues, Resolver, UseFormReturn } from "react-hook-form";
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
import { addClassifiedSchema, type AddClassifiedFormData } from "../../schemaForm";
import { useAddClassified } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/fields/TranslatedFormMessage";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import {
  FormFieldName,
  FormFieldTags,
  ParentInfoReadonly,
} from "../profile-edit/fields";

const TAB_FIELDS = {
  infos: ["name", "section", "description", "tags"],
  categorie: ["category", "subtype"],
  location: ["addressCountry", "addressLocality", "postalCode", "streetAddress", "localityId"],
} as const;

type TabName = keyof typeof TAB_FIELDS;

function hasTabErrors(tabName: TabName, errors: FieldErrors<FieldValues>): boolean {
  return TAB_FIELDS[tabName].some((field) => !!errors[field]);
}

interface AddClassifiedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

export function AddClassifiedModal({ open, onOpenChange, parent }: AddClassifiedModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddClassified(parent);

  const form = useForm<AddClassifiedFormData>({
    resolver: zodResolver(addClassifiedSchema) as Resolver<AddClassifiedFormData>,
    defaultValues: {
      name: "",
      section: "offer",
      category: "service",
      subtype: "",
      description: "",
      tags: [],
      addressCountry: "",
      addressLocality: "",
      localityId: "",
      postalCode: "",
      streetAddress: "",
    },
  });

  const selectedCategory = form.watch("category");
  const subcatKeys = Object.keys(
    CLASSIFIED_SUBCATEGORIES[selectedCategory]?.subcat ?? {}
  );

  const onSubmit = async (data: AddClassifiedFormData) => {
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
          <DialogTitle>{t("AddEntity.modal.classified.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.classified.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <Tabs defaultValue="infos" className="w-full flex-1 flex flex-col min-h-0">
              <div className="overflow-x-auto scrollbar-hide -mx-6 px-6 shrink-0">
                <TabsList className="w-max min-w-full flex">
                  <TabsTrigger value="infos" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {t("AddEntity.tabs.info")}
                    {hasTabErrors("infos", form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="categorie" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {t("AddEntity.tabs.categorie")}
                    {hasTabErrors("categorie", form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="location" className="shrink-0 gap-1 px-2 sm:px-3 text-xs sm:text-sm">
                    {t("AddEntity.tabs.location")}
                    {hasTabErrors("location", form.formState.errors) && (
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto pr-4">
                {/* Tab Informations */}
                <TabsContent value="infos" className="space-y-4">
                  <ParentInfoReadonly parent={parent} />

                  {/* Section (besoin / offre) */}
                  <FormField
                    control={form.control}
                    name="section"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddEntity.classified.section.label")} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t("AddEntity.classified.section.placeholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CLASSIFIED_SECTIONS.map((section) => (
                              <SelectItem key={section} value={section}>
                                {t(`AddEntity.classified.section.${section}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Nom */}
                  <FormFieldName control={form.control} required showDescription />

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

                {/* Tab Catégorie */}
                <TabsContent value="categorie" className="space-y-4">
                  {/* Catégorie */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddEntity.classified.category.label")} *</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue("subtype", "");
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t("AddEntity.classified.category.placeholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CLASSIFIED_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {t(`AddEntity.classified.category.${cat}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Sous-catégorie (dynamique selon la catégorie) */}
                  <FormField
                    control={form.control}
                    name="subtype"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("AddEntity.classified.subtype.label")} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t("AddEntity.classified.subtype.placeholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subcatKeys.map((key) => (
                              <SelectItem key={key} value={key}>
                                {t(`AddEntity.classified.subtype.${key}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <TranslatedFormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Tab Localisation */}
                <TabsContent value="location">
                  <EditLocationTab form={form as unknown as UseFormReturn<FieldValues>} />
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
