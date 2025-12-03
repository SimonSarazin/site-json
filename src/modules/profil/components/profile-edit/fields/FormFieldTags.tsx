import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { TagsInput } from "@/components/form/TagsInput";
import { useT } from "@/hooks/useT";
import { TranslatedFormMessage } from "./TranslatedFormMessage";

interface FormFieldTagsProps<T extends FieldValues> {
  /**
   * Contrôle du formulaire react-hook-form
   */
  control: Control<T>;
  /**
   * Nom du champ (par défaut "tags")
   */
  name?: FieldPath<T>;
  /**
   * Nombre maximum de tags
   */
  maxTags?: number;
  /**
   * Utiliser tous les textes de traduction (pour EditBasicInfoTab)
   */
  extendedTexts?: boolean;
}

/**
 * Champ de formulaire pour les tags
 * Utilise automatiquement les traductions ProfileEdit.fields.tags
 */
export function FormFieldTags<T extends FieldValues>({
  control,
  name = "tags" as FieldPath<T>,
  maxTags = 10,
  extendedTexts = false,
}: FormFieldTagsProps<T>) {
  const t = useT("modules/profil");

  const texts = extendedTexts
    ? {
        placeholder: t("ProfileEdit.fields.tags.placeholder"),
        maxReached: t("ProfileEdit.fields.tags.maxReached"),
        searching: t("ProfileEdit.fields.tags.searching"),
        noResults: t("ProfileEdit.fields.tags.noResults"),
        typeToSearch: t("ProfileEdit.fields.tags.typeToSearch"),
      }
    : {
        placeholder: t("ProfileEdit.fields.tags.placeholder"),
      };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("ProfileEdit.fields.tags.label")}</FormLabel>
          <FormControl>
            <TagsInput
              tags={Array.isArray(field.value) ? field.value : []}
              onTagsChange={field.onChange}
              maxTags={maxTags}
              texts={texts}
            />
          </FormControl>
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
