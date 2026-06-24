import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "../../components/FormMessage";

interface TextareaFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  /** Label déjà traduit. */
  label: string;
  /** Champ requis (affiche « * »). */
  required?: boolean;
  placeholder?: string;
  description?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  /** Traduit les clés d'erreur `validation.*` (injecté par le registre = `p.t`). */
  errorTranslate?: (key: string) => string;
}

/** Champ textarea GÉNÉRIQUE (formEngine, LEAF). Composants shadcn Form ; message via FormMessage injecté. */
export function TextareaFormField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  placeholder,
  description,
  rows = 4,
  maxLength,
  disabled,
  errorTranslate,
}: TextareaFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && (
            <FormLabel>
              {label}
              {required && " *"}
            </FormLabel>
          )}
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
          <FormMessage errorTranslate={errorTranslate} />
        </FormItem>
      )}
    />
  );
}
