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
   * Label personnalisé (remplace la traduction par défaut)
   */
  label?: string;
  /**
   * Placeholder personnalisé
   */
  placeholder?: string;
  /**
   * Autocomplétion sur les tags existants. `false` → saisie libre (valeurs hors tags).
   */
  searchable?: boolean;
  /**
   * Suggestions LOCALES déjà chargées (ex. valeurs d'une liste de costum) : filtrage en mémoire,
   * propositions dès le focus. Prend le pas sur la recherche serveur de tags.
   */
  suggestions?: string[];
}

/**
 * Champ de formulaire pour les tags
 * Utilise automatiquement les traductions ProfileEdit.fields.tags
 */
export function FormFieldTags<T extends FieldValues>({
  control,
  name = "tags" as FieldPath<T>,
  maxTags = 10,
  label,
  placeholder,
  searchable = true,
  suggestions,
}: FormFieldTagsProps<T>) {
  const t = useT("modules/profil");

  // TOUS les textes sont traduits, toujours. Ils existent en FR et en EN ; l'ancien drapeau
  // `extendedTexts` n'en livrait que le placeholder par défaut, laissant `maxReached`, `searching`,
  // `noResults` et `typeToSearch` retomber sur les chaînes FRANÇAISES codées en dur de
  // `TagsInput.tsx:31` — visible sur tout site bilingue au 6e tag d'un champ plafonné.
  const texts = {
    placeholder: placeholder ?? t("ProfileEdit.fields.tags.placeholder"),
    maxReached: t("ProfileEdit.fields.tags.maxReached"),
    searching: t("ProfileEdit.fields.tags.searching"),
    noResults: t("ProfileEdit.fields.tags.noResults"),
    typeToSearch: t("ProfileEdit.fields.tags.typeToSearch"),
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label ?? t("ProfileEdit.fields.tags.label")}</FormLabel>
          <FormControl>
            <TagsInput
              tags={Array.isArray(field.value) ? field.value : []}
              onTagsChange={field.onChange}
              maxTags={maxTags}
              searchable={searchable}
              suggestions={suggestions}
              texts={texts}
            />
          </FormControl>
          <TranslatedFormMessage />
        </FormItem>
      )}
    />
  );
}
