import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/useT";
import { TranslatedFormMessage } from "./TranslatedFormMessage";

interface FormFieldDescriptionProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "description")
   */
  name?: FieldPath<T>;
  /**
   * Nombre de lignes
   */
  rows?: number;
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
 * Champ de formulaire pour la description longue
 * Utilise automatiquement les traductions ProfileEdit.fields.description
 */
export function FormFieldDescription<T extends FieldValues>({
  control,
  name = "description" as FieldPath<T>,
  rows = 6,
  disabled,
  showDescription = true,
}: FormFieldDescriptionProps<T>) {
  const t = useT("modules/profil");

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("ProfileEdit.fields.description.label")}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder={t("ProfileEdit.fields.description.placeholder")}
              rows={rows}
              disabled={disabled}
            />
          </FormControl>
          {showDescription && (
            <FormDescription>
              {t("ProfileEdit.fields.description.description")}
            </FormDescription>
          )}
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
