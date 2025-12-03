import type { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { Calendar, Clock, Repeat } from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import { TranslatedFormMessage } from "./TranslatedFormMessage";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { OpeningHoursPicker } from "@/components/form/OpeningHoursPicker";

interface EditEventDatesTabProps {
  form: UseFormReturn<any>;
}

/**
 * Onglet pour éditer les dates et horaires des événements
 *
 * Logique conditionnelle basée sur recurrency:
 * - recurrency = false → afficher startDate et endDate (DateTimePicker)
 * - recurrency = true → afficher openingHours (OpeningHoursPicker)
 */
export function EditEventDatesTab({ form }: EditEventDatesTabProps) {
  const t = useT("modules/profil");
  const recurrency = form.watch("recurrency");
  const startDateValue = form.watch("startDate");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Calendar className="w-4 h-4" />
        <span>{t("ProfileEdit.tabs.eventDates.description")}</span>
      </div>

      {/* Switch recurrency */}
      <FormField
        control={form.control}
        name="recurrency"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                {t("ProfileEdit.fields.recurrency.label")}
              </FormLabel>
              <FormDescription>
                {t("ProfileEdit.fields.recurrency.description")}
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Si pas récurrent: startDate + endDate avec DateTimePicker */}
      {!recurrency && (
        <>
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t("ProfileEdit.fields.startDate.label")}
                </FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value ? new Date(field.value) : undefined}
                    onChange={(date) => field.onChange(date?.toISOString() || "")}
                    min={new Date()}
                    granularity="minute"
                    placeholder={t("ProfileEdit.fields.startDate.placeholder")}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t("ProfileEdit.fields.endDate.label")}
                </FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value ? new Date(field.value) : undefined}
                    onChange={(date) => field.onChange(date?.toISOString() || "")}
                    min={startDateValue ? new Date(startDateValue) : new Date()}
                    granularity="minute"
                    placeholder={t("ProfileEdit.fields.endDate.placeholder")}
                  />
                </FormControl>
                <TranslatedFormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {/* Si récurrent: openingHours avec OpeningHoursPicker */}
      {recurrency && (
        <FormField
          control={form.control}
          name="openingHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("ProfileEdit.schedule.openingHours.label")}
              </FormLabel>
              <FormControl>
                <OpeningHoursPicker
                  value={field.value}
                  onChange={field.onChange}
                  t={t}
                />
              </FormControl>
              <FormDescription>
                {t("ProfileEdit.schedule.openingHours.description")}
              </FormDescription>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
