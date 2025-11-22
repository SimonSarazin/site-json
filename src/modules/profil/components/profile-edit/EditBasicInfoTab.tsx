import { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditBasicInfoTabProps {
  form: UseFormReturn<any>;
  entityType: string;
}

/**
 * Tab pour éditer les informations de base d'un profil
 *
 * Champs communs à toutes les entités :
 * - name (nom)
 * - shortDescription (bio courte)
 * - description (bio longue)
 */
export function EditBasicInfoTab({ form }: EditBasicInfoTabProps) {
  const t = useT("modules/profil");

  return (
    <div className="space-y-6">
      {/* Nom */}
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.name.label")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t("ProfileEdit.fields.name.placeholder")}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.name.description")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Bio courte */}
      <FormField
        control={form.control}
        name="shortDescription"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.shortDescription.label")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder={t("ProfileEdit.fields.shortDescription.placeholder")}
                rows={2}
                maxLength={200}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.shortDescription.description")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Description longue */}
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.description.label")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder={t("ProfileEdit.fields.description.placeholder")}
                rows={6}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.description.description")}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
