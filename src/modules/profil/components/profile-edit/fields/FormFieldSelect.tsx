import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TranslatedFormMessage } from "./TranslatedFormMessage";

interface SelectOption {
  value: string;
  label: string;
}

interface FormFieldSelectProps<T extends FieldValues> {
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
   * Options du select
   */
  options: SelectOption[];
  /**
   * Placeholder
   */
  placeholder?: string;
  /**
   * Champ obligatoire
   */
  required?: boolean;
  /**
   * Désactivé
   */
  disabled?: boolean;
}

/**
 * Champ de formulaire select générique
 */
export function FormFieldSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  required = false,
  disabled,
}: FormFieldSelectProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && " *"}
          </FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
