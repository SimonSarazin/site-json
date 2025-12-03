import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "../profile-edit/fields";

interface AddOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal pour creer une nouvelle organisation
 */
export function AddOrganizationModal({ open, onOpenChange }: AddOrganizationModalProps) {
  const t = useT("modules/profil");
  const addMutation = useAddOrganization();

  const form = useForm<AddOrganizationFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addOrganizationSchema) as any,
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.organization.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.organization.description")}
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
                <FormFieldName control={form.control} required />

                {/* Type d'organisation */}
                <FormFieldType control={form.control} variant="organization" required />

                {/* Role dans l'organisation */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("InviteMemberDialog.role")} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
                <FormFieldShortDescription control={form.control} />

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
                <FormFieldUrl control={form.control} />

                {/* Tags */}
                <FormFieldTags control={form.control} />
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
