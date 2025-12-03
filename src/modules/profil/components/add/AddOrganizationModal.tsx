import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ORGANIZATION_TYPES } from "@communecter/cocolight-api-client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addOrganizationSchema, type AddOrganizationFormData } from "../../schemaForm";
import { useAddOrganization } from "../../hooks/useAddMutations";
import { TranslatedFormMessage } from "../profile-edit/TranslatedFormMessage";

interface AddOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal pour cr&eacute;er une nouvelle organisation
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
    },
  });

  const onSubmit = async (data: AddOrganizationFormData) => {
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("AddEntity.modal.organization.title")}</DialogTitle>
          <DialogDescription>
            {t("AddEntity.modal.organization.description")}
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

            {/* Type d'organisation */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ProfileEdit.fields.type.label")} *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("ProfileEdit.fields.type.placeholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ORGANIZATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`ProfileEdit.fields.type.options.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TranslatedFormMessage />
                </FormItem>
              )}
            />

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
