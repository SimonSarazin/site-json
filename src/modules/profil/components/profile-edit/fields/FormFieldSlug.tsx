import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/useT";
import { TranslatedFormMessage } from "./TranslatedFormMessage";

interface FormFieldSlugProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "slug")
   */
  name?: FieldPath<T>;
  /**
   * Désactivé
   */
  disabled?: boolean;
  /**
   * Afficher la description d'aide
   */
  showDescription?: boolean;
}

/**
 * Champ de formulaire pour le slug
 * Utilise automatiquement les traductions ProfileEdit.fields.slug
 */
export function FormFieldSlug<T extends FieldValues>({
  control,
  name = "slug" as FieldPath<T>,
  disabled,
  showDescription = true,
}: FormFieldSlugProps<T>) {
  const t = useT("modules/profil");

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("ProfileEdit.fields.slug.label")}</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder={t("ProfileEdit.fields.slug.placeholder")}
              disabled={disabled}
            />
          </FormControl>
          {showDescription && (
            <FormDescription>
              {t("ProfileEdit.fields.slug.description")}
            </FormDescription>
          )}
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
