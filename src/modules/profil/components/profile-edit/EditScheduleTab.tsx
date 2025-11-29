import { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import { Clock } from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { OpeningHoursPicker } from "@/components/shared/OpeningHoursPicker";

interface EditScheduleTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

/**
 * Onglet pour éditer les horaires et dates spécifiques aux organisations
 *
 * Features:
 * - Date d'ouverture de l'organisation
 * - Lien d'inscription externe
 * - Horaires d'ouverture hebdomadaires
 */
export function EditScheduleTab({ form }: EditScheduleTabProps) {
  const t = useT("modules/profil");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Clock className="w-4 h-4" />
        <span>{t("ProfileEdit.tabs.schedule.description")}</span>
      </div>

      {/* Horaires d'ouverture */}
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
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
