import { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { Mail, Phone, Globe } from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface EditContactTabProps {
  form: UseFormReturn<any>;
}

/**
 * Tab pour éditer les informations de contact
 *
 * Champs :
 * - email
 * - mobile (téléphone)
 * - url (site web)
 */
export function EditContactTab({ form }: EditContactTabProps) {
  const t = useT("modules/profil");

  return (
    <div className="space-y-6">
      {/* Email */}
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {t("ProfileEdit.fields.email.label")}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                type="email"
                placeholder={t("ProfileEdit.fields.email.placeholder")}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.email.description")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Téléphone */}
      <FormField
        control={form.control}
        name="mobile"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {t("ProfileEdit.fields.mobile.label")}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                type="tel"
                placeholder={t("ProfileEdit.fields.mobile.placeholder")}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.mobile.description")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Site web */}
      <FormField
        control={form.control}
        name="url"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t("ProfileEdit.fields.url.label")}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                type="url"
                placeholder={t("ProfileEdit.fields.url.placeholder")}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.url.description")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
