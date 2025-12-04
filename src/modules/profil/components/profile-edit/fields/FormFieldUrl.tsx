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

interface FormFieldUrlProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "url")
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
 * Champ de formulaire pour l'URL
 * Utilise automatiquement les traductions ProfileEdit.fields.url
 */
export function FormFieldUrl<T extends FieldValues>({
  control,
  name = "url" as FieldPath<T>,
  disabled,
  showDescription = false,
}: FormFieldUrlProps<T>) {
  const t = useT("modules/profil");

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("ProfileEdit.fields.url.label")}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="url"
              placeholder={t("ProfileEdit.fields.url.placeholder")}
              disabled={disabled}
            />
          </FormControl>
          {showDescription && (
            <FormDescription>
              {t("ProfileEdit.fields.url.description")}
            </FormDescription>
          )}
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
