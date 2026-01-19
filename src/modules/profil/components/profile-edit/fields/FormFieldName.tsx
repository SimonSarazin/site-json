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

interface FormFieldNameProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "name")
   */
  name?: FieldPath<T>;
  /**
   * Champ obligatoire
   */
  required?: boolean;
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
 * Champ de formulaire pour le nom
 * Utilise automatiquement les traductions ProfileEdit.fields.name
 */
export function FormFieldName<T extends FieldValues>({
  control,
  name = "name" as FieldPath<T>,
  required = false,
  disabled,
  showDescription = false,
}: FormFieldNameProps<T>) {
  const t = useT("modules/profil");

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {t("ProfileEdit.fields.name.label")}
            {required && " *"}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder={t("ProfileEdit.fields.name.placeholder")}
              disabled={disabled}
            />
          </FormControl>
          {showDescription && (
            <FormDescription>
              {t("ProfileEdit.fields.name.description")}
            </FormDescription>
          )}
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
