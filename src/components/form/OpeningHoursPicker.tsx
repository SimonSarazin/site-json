import { format, setDay, startOfWeek } from "date-fns";
import getDateFnsLocale from "@/dateFns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DAYS } from "@/constants/DAYS";
import { TimePicker } from "../ui/datetime-picker";

interface OpeningHoursEntry {
  dayOfWeek: string;
  hours: Array<{ opens: string; closes: string }>;
}

interface OpeningHoursPickerProps {
  value?: OpeningHoursEntry[];
  onChange: (value: OpeningHoursEntry[]) => void;
  className?: string;
  t: (key: string) => string;
  /** Préfixe de traduction (défaut: "ProfileEdit.schedule.openingHours") */
  translationPrefix?: string;
}

const getDayName = (dayKey: string) => {
  const idx = DAYS.indexOf(dayKey as typeof DAYS[number]) + 1;
  const locale = getDateFnsLocale();
  // Créer une date pour le jour de la semaine spécifié
  const baseDate = startOfWeek(new Date(), { locale });
  const d = setDay(baseDate, idx % 7, { locale });
  return {
    full: format(d, "EEEE", { locale }), // Jour complet (ex: "Monday")
    abbr: format(d, "EEEEEE", { locale }) // Jour abrégé (ex: "Mo")
  };
};

/**
 * Composant pour éditer les horaires d'ouverture
 *
 * Permet de :
 * - Sélectionner les jours actifs
 * - Définir les heures d'ouverture et de fermeture pour chaque jour
 *
 * @param value - Liste des jours avec horaires [{ dayOfWeek, hours:[{opens,closes}] }]
 * @param onChange - Callback appelé lors du changement
 * @param className - Classes CSS additionnelles
 * @param t - Fonction de traduction
 */
export function OpeningHoursPicker({
  value = [],
  onChange,
  className,
  t,
  translationPrefix = "ProfileEdit.schedule.openingHours",
}: OpeningHoursPickerProps) {
  // Extraire les jours actifs avec leurs horaires
  const active = value
    .map((entry, idx) => ({
      day: entry.dayOfWeek,
      opens: entry?.hours?.[0]?.opens || "",
      closes: entry?.hours?.[0]?.closes || "",
      _idx: idx,
    }))
    .filter((d) => d.day !== undefined && d.day !== null);

  // Basculer un jour actif/inactif
  const toggleDay = (day: string) => {
    const exists = active.some((d) => d.day === day);
    let next;

    if (exists) {
      // Retirer le jour
      next = active.filter((d) => d.day !== day);
    } else {
      // Ajouter le jour avec horaires par défaut
      next = [...active, { day, opens: "08:00", closes: "19:00" }];
    }

    // Convertir au format original
    onChange(
      next.map((d) => ({
        dayOfWeek: d.day,
        hours: [{ opens: d.opens, closes: d.closes }],
      }))
    );
  };

  // Mettre à jour une heure (opens ou closes)
  const setTime = (day: string, field: "opens" | "closes", hhmm: string) => {
    const next = active.map((d) =>
      d.day === day ? { ...d, [field]: hhmm } : d
    );

    onChange(
      next.map((d) => ({
        dayOfWeek: d.day,
        hours: [{ opens: d.opens, closes: d.closes }],
      }))
    );
  };

  return (
    <Card className={cn("p-4 space-y-4", className)}>
      <CardHeader>
        <CardTitle>{t(`${translationPrefix}.title`)}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Sélecteur de jours */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
          {DAYS.map((day) => {
            const sel = active.some((d) => d.day === day);
            return (
              <Button
                type="button"
                key={`day-btn-${day}`}
                variant={sel ? "secondary" : "outline"}
                size="sm"
                onClick={() => toggleDay(day)}
                aria-label={getDayName(day).full}
                className="justify-center"
              >
                {getDayName(day).abbr}
              </Button>
            );
          })}
        </div>

        {/* Liste des jours actifs avec leurs horaires */}
        <div className="space-y-4">
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t(`${translationPrefix}.noDaysSelected`)}
            </p>
          )}

          {active.map(({ day, opens, closes, _idx }) => (
            <Card key={`day-card-${day}-${_idx}`} className="border">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <CalendarDays className="w-5 h-5" />
                  <span className="font-medium">{getDayName(day).full}</span>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Heure d'ouverture */}
                <div>
                  <Label className="flex justify-center pb-2">
                    {t(`${translationPrefix}.opens`)}
                  </Label>
                  <TimePicker
                    date={
                      opens
                        ? new Date(0, 0, 0, ...opens.split(":").map(Number))
                        : undefined
                    }
                    onChange={(d) => {
                      const hh = String(d.getHours()).padStart(2, "0");
                      const mm = String(d.getMinutes()).padStart(2, "0");
                      setTime(day, "opens", `${hh}:${mm}`);
                    }}
                    hourCycle={24}
                    granularity="minute"
                  />
                </div>

                {/* Heure de fermeture */}
                <div>
                  <Label className="flex justify-center pb-2">
                    {t(`${translationPrefix}.closes`)}
                  </Label>
                  <TimePicker
                    date={
                      closes
                        ? new Date(0, 0, 0, ...closes.split(":").map(Number))
                        : undefined
                    }
                    onChange={(d) => {
                      const hh = String(d.getHours()).padStart(2, "0");
                      const mm = String(d.getMinutes()).padStart(2, "0");
                      setTime(day, "closes", `${hh}:${mm}`);
                    }}
                    hourCycle={24}
                    granularity="minute"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
