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
import { TranslatedFormMessage } from "./TranslatedFormMessage";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagsInput, DatePickerInput } from "@/components/form";
import { SelectParent } from "./SelectParent";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORGANIZATION_TYPES, EVENT_TYPES } from "@communecter/cocolight-api-client";
import { useProfileEntity } from "../../hooks/useProfileEntity";

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
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.name.label")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t("ProfileEdit.fields.name.placeholder")}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.name.description")}
            </FormDescription>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

      {/* Slug */}
      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.slug.label")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t("ProfileEdit.fields.slug.placeholder")}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.slug.description")}
            </FormDescription>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

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
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ProfileEdit.fields.type.label")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("ProfileEdit.fields.type.placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ORGANIZATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`ProfileEdit.fields.type.options.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {t("ProfileEdit.fields.type.description")}
              </FormDescription>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Type d'événement */}
      {entityType === "events" && (
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ProfileEdit.fields.eventType.label")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("ProfileEdit.fields.eventType.placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`ProfileEdit.fields.eventType.options.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {t("ProfileEdit.fields.eventType.description")}
              </FormDescription>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
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
      <FormField
        control={form.control}
        name="shortDescription"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.shortDescription.label")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder={t("ProfileEdit.fields.shortDescription.placeholder")}
                rows={2}
                maxLength={200}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.shortDescription.description")}
            </FormDescription>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

      {/* Description longue */}
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.description.label")}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder={t("ProfileEdit.fields.description.placeholder")}
                rows={6}
              />
            </FormControl>
            <FormDescription>
              {t("ProfileEdit.fields.description.description")}
            </FormDescription>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

      {/* Tags */}
      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("ProfileEdit.fields.tags.label")}</FormLabel>
            <FormControl>
              <TagsInput
                tags={field.value || []}
                onTagsChange={field.onChange}
                maxTags={10}
                texts={{
                  placeholder: t("ProfileEdit.fields.tags.placeholder"),
                  maxReached: t("ProfileEdit.fields.tags.maxReached"),
                  searching: t("ProfileEdit.fields.tags.searching"),
                  noResults: t("ProfileEdit.fields.tags.noResults"),
                  typeToSearch: t("ProfileEdit.fields.tags.typeToSearch"),
                }}
              />
            </FormControl>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
