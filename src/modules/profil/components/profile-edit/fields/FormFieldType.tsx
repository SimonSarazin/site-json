import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/useT";
import { TranslatedFormMessage } from "./TranslatedFormMessage";
import { ORGANIZATION_TYPES, EVENT_TYPES } from "@communecter/cocolight-api-client";

type TypeVariant = "organization" | "event";

interface FormFieldTypeProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "type")
   */
  name?: FieldPath<T>;
  /**
   * Variante du type (organization ou event)
   */
  variant: TypeVariant;
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
 * Champ de formulaire pour le type (organization ou event)
 * Utilise automatiquement les traductions ProfileEdit.fields.type ou ProfileEdit.fields.eventType
 */
export function FormFieldType<T extends FieldValues>({
  control,
  name = "type" as FieldPath<T>,
  variant,
  required = false,
  disabled,
  showDescription = false,
}: FormFieldTypeProps<T>) {
  const t = useT("modules/profil");

  const isOrganization = variant === "organization";
  const types = isOrganization ? ORGANIZATION_TYPES : EVENT_TYPES;
  const labelKey = isOrganization ? "ProfileEdit.fields.type" : "ProfileEdit.fields.eventType";

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {t(`${labelKey}.label`)}
            {required && " *"}
          </FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t(`${labelKey}.placeholder`)} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {types.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`${labelKey}.options.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showDescription && (
            <FormDescription>
              {t(`${labelKey}.description`)}
            </FormDescription>
          )}
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
