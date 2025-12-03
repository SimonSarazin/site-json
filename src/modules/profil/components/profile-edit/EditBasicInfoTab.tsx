import { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import { TranslatedFormMessage } from "./fields/TranslatedFormMessage";
import { DatePickerInput } from "@/components/form";
import { SelectParent } from "./fields/SelectParent";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import {
  FormFieldName,
  FormFieldSlug,
  FormFieldShortDescription,
  FormFieldDescription,
  FormFieldTags,
  FormFieldType,
} from "./fields";

interface EditBasicInfoTabProps {
  form: UseFormReturn<any>;
  entityType: string;
}

/**
 * Tab pour éditer les informations de base d'un profil
 *
 * Champs communs à toutes les entités :
 * - name (nom)
 * - shortDescription (bio courte)
 * - description (bio longue)
 */
export function EditBasicInfoTab({ form, entityType }: EditBasicInfoTabProps) {
  const t = useT("modules/profil");
  const { entity } = useProfileEntity();

  // Filtre pour ne montrer que les événements du parent
  const parentEventFilter = useMemo(() => {
    if (!entity?.parent?.id) return undefined;
    return { filters : {
      [`organizer.${entity.parent.id}`]: { $exists: true },
    }};
  }, [entity?.parent?.id]);

  return (
    <div className="space-y-6">
      {/* Nom */}
      <FormFieldName control={form.control} showDescription />

      {/* Slug */}
      <FormFieldSlug control={form.control} />

      {/* Date de naissance (citoyens) */}
      {entityType === "citoyens" && (
        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ProfileEdit.fields.birthDate.label")}</FormLabel>
              <FormControl>
                <DatePickerInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("ProfileEdit.fields.birthDate.placeholder")}
                  clearable
                  endYear={new Date().getFullYear() - 13}
                />
              </FormControl>
              <FormDescription>
                {t("ProfileEdit.fields.birthDate.description")}
              </FormDescription>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Type d'organisation */}
      {entityType === "organizations" && (
        <FormFieldType control={form.control} variant="organization" showDescription />
      )}

      {/* Type d'événement */}
      {entityType === "events" && (
        <FormFieldType control={form.control} variant="event" showDescription />
      )}

      {/* Parent pour projets */}
      {entityType === "projects" && (
        <FormField
          control={form.control}
          name="parent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ProfileEdit.fields.parent.label")}</FormLabel>
              <FormControl>
                <SelectParent
                  multiple={true}
                  includeMe={true}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("ProfileEdit.fields.parent.placeholder")}
                  searchTypes={["organizations"]}
                />
              </FormControl>
              <FormDescription>
                {t("ProfileEdit.fields.parent.description")}
              </FormDescription>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Organisateur pour événements */}
      {entityType === "events" && (
        <FormField
          control={form.control}
          name="organizer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ProfileEdit.fields.organizer.label")}</FormLabel>
              <FormControl>
                <SelectParent
                  multiple={true}
                  includeMe={true}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("ProfileEdit.fields.organizer.placeholder")}
                  searchTypes={["organizations", "projects"]}
                />
              </FormControl>
              <FormDescription>
                {t("ProfileEdit.fields.organizer.description")}
              </FormDescription>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Parent pour événements */}
      {entityType === "events" && (
        <FormField
          control={form.control}
          name="parent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ProfileEdit.fields.parentEvent.label")}</FormLabel>
              <FormControl>
                <SelectParent
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("ProfileEdit.fields.parentEvent.placeholder")}
                  searchTypes={["events"]}
                  filters={parentEventFilter}
                />
              </FormControl>
              <FormDescription>
                {t("ProfileEdit.fields.parentEvent.description")}
              </FormDescription>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Bio courte */}
      <FormFieldShortDescription
        control={form.control}
        rows={2}
        maxLength={200}
        showDescription
      />

      {/* Description longue */}
      <FormFieldDescription control={form.control} />

      {/* Tags */}
      <FormFieldTags control={form.control} extendedTexts />
    </div>
  );
}
