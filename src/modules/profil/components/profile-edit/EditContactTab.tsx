import type { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { Mail, Phone, Globe } from "lucide-react";
import { IconFormField } from "./fields";

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
      <IconFormField
        control={form.control}
        name="email"
        icon={Mail}
        label={t("ProfileEdit.fields.email.label")}
        type="email"
        placeholder={t("ProfileEdit.fields.email.placeholder")}
        description={t("ProfileEdit.fields.email.description")}
      />

      <IconFormField
        control={form.control}
        name="mobile"
        icon={Phone}
        label={t("ProfileEdit.fields.mobile.label")}
        type="tel"
        placeholder={t("ProfileEdit.fields.mobile.placeholder")}
        description={t("ProfileEdit.fields.mobile.description")}
      />

      <IconFormField
        control={form.control}
        name="url"
        icon={Globe}
        label={t("ProfileEdit.fields.url.label")}
        type="url"
        placeholder={t("ProfileEdit.fields.url.placeholder")}
        description={t("ProfileEdit.fields.url.description")}
      />
    </div>
  );
}
