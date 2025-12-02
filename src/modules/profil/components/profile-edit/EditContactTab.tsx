import type { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { Mail, Phone, Globe } from "lucide-react";
import { IconFormField } from "./fields";

interface EditContactTabProps {
  form: UseFormReturn<any>;
  entityType: string;
}

/**
 * Tab pour éditer les informations de contact
 *
 * Champs :
 * - email (tous)
 * - mobile (citoyens uniquement)
 * - fixe (citoyens uniquement)
 * - url (tous)
 */
export function EditContactTab({ form, entityType }: EditContactTabProps) {
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

      {entityType === "citoyens" && (
        <>
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
            name="fixe"
            icon={Phone}
            label={t("ProfileEdit.fields.fixe.label")}
            type="tel"
            placeholder={t("ProfileEdit.fields.fixe.placeholder")}
            description={t("ProfileEdit.fields.fixe.description")}
          />
        </>
      )}

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
