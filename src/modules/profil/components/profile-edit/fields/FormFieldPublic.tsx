import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/hooks/useT";

interface FormFieldPublicProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "public")
   */
  name?: FieldPath<T>;
  /**
   * Clé de traduction pour le label (par défaut "AddEntity.modal.project.public")
   */
  labelKey?: string;
  /**
   * Désactivé
   */
  disabled?: boolean;
}

/**
 * Champ de formulaire checkbox pour la visibilité publique
 */
export function FormFieldPublic<T extends FieldValues>({
  control,
  name = "public" as FieldPath<T>,
  labelKey = "AddEntity.modal.project.public",
  disabled,
}: FormFieldPublicProps<T>) {
  const t = useT("modules/profil");

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>{t(labelKey)}</FormLabel>
          </div>
        </FormItem>
      )}
    />
  );
}
