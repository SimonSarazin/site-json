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

interface FormFieldShortDescriptionProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "shortDescription")
   */
  name?: FieldPath<T>;
  /**
   * Nombre de lignes
   */
  rows?: number;
  /**
   * Longueur maximale
   */
  maxLength?: number;
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
 * Champ de formulaire pour la description courte
 * Utilise automatiquement les traductions ProfileEdit.fields.shortDescription
 */
export function FormFieldShortDescription<T extends FieldValues>({
  control,
  name = "shortDescription" as FieldPath<T>,
  rows = 3,
  maxLength,
  disabled,
  showDescription = false,
}: FormFieldShortDescriptionProps<T>) {
  const t = useT("modules/profil");

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("ProfileEdit.fields.shortDescription.label")}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder={t("ProfileEdit.fields.shortDescription.placeholder")}
              className="resize-none"
              rows={rows}
              maxLength={maxLength}
              disabled={disabled}
            />
          </FormControl>
          {showDescription && (
            <FormDescription>
              {t("ProfileEdit.fields.shortDescription.description")}
            </FormDescription>
          )}
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
