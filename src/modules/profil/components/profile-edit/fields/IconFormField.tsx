import type { LucideIcon } from "lucide-react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import { TranslatedFormMessage } from "./TranslatedFormMessage";
import { Input } from "@/components/ui/input";

interface IconFormFieldProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ
   */
  name: FieldPath<T>;
  /**
   * Icône à afficher dans le label
   */
  icon: LucideIcon;
  /**
   * Label du champ
   */
  label: string;
  /**
   * Type d'input
   */
  type?: "text" | "email" | "tel" | "url";
  /**
   * Placeholder
   */
  placeholder?: string;
  /**
   * Description d'aide
   */
  description?: string;
  /**
   * Désactivé
   */
  disabled?: boolean;
}

/**
 * Champ de formulaire avec icône
 * Utilise les composants shadcn Form
 *
 * @example
 * <IconFormField
 *   control={form.control}
 *   name="email"
 *   icon={Mail}
 *   label={t("ProfileEdit.fields.email.label")}
 *   type="email"
 *   placeholder={t("ProfileEdit.fields.email.placeholder")}
 *   description={t("ProfileEdit.fields.email.description")}
 * />
 */
export function IconFormField<T extends FieldValues>({
  control,
  name,
  icon: Icon,
  label,
  type = "text",
  placeholder,
  description,
  disabled,
}: IconFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
