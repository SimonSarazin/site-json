import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addOrganizationSchema, type AddOrganizationFormData } from "../../schemaForm";
import { useAddOrganization } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/fields/TranslatedFormMessage";
import { EditLocationTab } from "../profile-edit/EditLocationTab";
import {
  FormFieldName,
  FormFieldTags,
  FormFieldShortDescription,
  FormFieldUrl,
  FormFieldType,
  ParentInfoReadonly,
} from "../profile-edit/fields";
import { EntityTypes } from "@communecter/cocolight-api-client";

// Mapping des champs par onglet pour détecter les erreurs
const TAB_FIELDS = {
  info: ['name', 'type', 'role', 'shortDescription', 'email', 'url', 'tags'],
  location: ['addressCountry', 'addressLocality', 'postalCode', 'streetAddress', 'localityId'],
} as const;

type TabName = keyof typeof TAB_FIELDS;

function hasTabErrors(tabName: TabName, errors: FieldErrors<FieldValues>): boolean {
  return TAB_FIELDS[tabName].some(field => !!errors[field]);
}

interface AddOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

/**
 * Modal pour creer une nouvelle organisation
 */
export function AddOrganizationModal({ open, onOpenChange, parent }: AddOrganizationModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddOrganization();

  const form = useForm<AddOrganizationFormData>({
    resolver: zodResolver(addOrganizationSchema) as Resolver<AddOrganizationFormData>,
    defaultValues: {
      name: "",
      type: "NGO",
      role: "admin",
      shortDescription: "",
      email: undefined,
      url: "",
      tags: [],
      addressCountry: "",
      addressLocality: "",
      localityId: "",
      postalCode: "",
      streetAddress: "",
    },
  });

  const onSubmit = async (data: AddOrganizationFormData) => {
    try {
      await addMutation.mutateAsync(data);
      form.reset();
      onOpenChange(false);
   } catch (error) {
      console.error("Error updating profile:", error);
      if (error && typeof error === "object") {
        console.error("Error details:", {
          message: (error as Record<string, unknown>).message,
          validationErrors: (error as Record<string, unknown>).validationErrors,
          details: (error as Record<string, unknown>).details,
          response: (error as Record<string, unknown>).response,
          data: (error as Record<string, unknown>).data,
        });
      }
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
          <DialogTitle>{t("AddEntity.modal.organization.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.organization.description")}
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

                {/* Type d'organisation */}
                <FormFieldType control={form.control} variant="organization" required showDescription />

                {/* Role dans l'organisation */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("InviteMemberDialog.role")} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("InviteMemberDialog.selectRole")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">{t("InviteMemberDialog.badges.admin")}</SelectItem>
                          <SelectItem value="member">{t("InviteMemberDialog.badges.member")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                {/* Description courte */}
                <FormFieldShortDescription control={form.control} showDescription />

                {/* Email (optionnel) */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ProfileEdit.fields.email.label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("ProfileEdit.fields.email.placeholder")}
                          {...field}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />

                {/* URL (optionnel) */}
                <FormFieldUrl control={form.control} showDescription />

                {/* Tags */}
                <FormFieldTags control={form.control} extendedTexts />
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
