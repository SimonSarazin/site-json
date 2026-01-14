import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

interface TextareaFormFieldProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ
   */
  name: FieldPath<T>;
  /**
   * Label du champ
   */
  label: string;
  /**
   * Placeholder
   */
  placeholder?: string;
  /**
   * Description d'aide
   */
  description?: string;
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
}

/**
 * Champ textarea de formulaire
 * Utilise les composants shadcn Form
 *
 * @example
 * <TextareaFormField
 *   control={form.control}
 *   name="description"
 *   label={t("ProfileEdit.fields.description.label")}
 *   placeholder={t("ProfileEdit.fields.description.placeholder")}
 *   rows={5}
 *   maxLength={500}
 * />
 */
export function TextareaFormField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  rows = 4,
  maxLength,
  disabled,
}: TextareaFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder={placeholder}
              rows={rows}
              maxLength={maxLength}
              disabled={disabled}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
