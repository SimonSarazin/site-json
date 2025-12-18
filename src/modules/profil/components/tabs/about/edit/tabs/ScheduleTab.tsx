import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/useT";

const DAYS_OF_WEEK = [
  { value: "Mo", label: "Lundi" },
  { value: "Tu", label: "Mardi" },
  { value: "We", label: "Mercredi" },
  { value: "Th", label: "Jeudi" },
  { value: "Fr", label: "Vendredi" },
  { value: "Sa", label: "Samedi" },
  { value: "Su", label: "Dimanche" },
];

interface OpeningHourEntry {
  dayOfWeek: string;
  hours?: Array<{ opens: string; closes: string }>;
}

interface ScheduleTabProps {
  openingHours: OpeningHourEntry[];
  setOpeningHours: (hours: OpeningHourEntry[]) => void;
}

export function ScheduleTab({ openingHours, setOpeningHours }: ScheduleTabProps) {
  const t = useT("modules/profil");

  const addDay = () => {
    const usedDays = openingHours.map((oh) => oh.dayOfWeek);
    const availableDay = DAYS_OF_WEEK.find((d) => !usedDays.includes(d.value));

    if (availableDay) {
      setOpeningHours([
        ...openingHours,
        {
          dayOfWeek: availableDay.value,
          hours: [{ opens: "09:00", closes: "18:00" }],
        },
      ]);
    }
  };

  const removeDay = (index: number) => {
    setOpeningHours(openingHours.filter((_, i) => i !== index));
  };

  const updateDay = (index: number, dayOfWeek: string) => {
    const updated = [...openingHours];
    updated[index] = { ...updated[index], dayOfWeek };
    setOpeningHours(updated);
  };

  const updateHours = (
    dayIndex: number,
    field: "opens" | "closes",
    value: string
  ) => {
    const updated = [...openingHours];
    if (!updated[dayIndex].hours) {
      updated[dayIndex].hours = [{ opens: "", closes: "" }];
    }
    updated[dayIndex].hours![0][field] = value;
    setOpeningHours(updated);
  };

  const getDayLabel = (dayValue: string) => {
    return DAYS_OF_WEEK.find((d) => d.value === dayValue)?.label || dayValue;
  };

  const getAvailableDays = (currentDay: string) => {
    const usedDays = openingHours.map((oh) => oh.dayOfWeek);
    return DAYS_OF_WEEK.filter(
      (d) => d.value === currentDay || !usedDays.includes(d.value)
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {String(t("EditAbout.scheduleDescription"))}
      </p>

      {openingHours.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {String(t("EditAbout.noOpeningHours"))}
        </p>
      ) : (
        openingHours.map((oh, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-3 border border-border rounded-lg"
          >
            <div className="flex-1 space-y-2">
              <Select
                value={oh.dayOfWeek}
                onValueChange={(value) => updateDay(index, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{getDayLabel(oh.dayOfWeek)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {getAvailableDays(oh.dayOfWeek).map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">
                    {String(t("EditAbout.opens"))}
                  </Label>
                  <Input
                    type="time"
                    value={oh.hours?.[0]?.opens || ""}
                    onChange={(e) =>
                      updateHours(index, "opens", e.target.value)
                    }
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">
                    {String(t("EditAbout.closes"))}
                  </Label>
                  <Input
                    type="time"
                    value={oh.hours?.[0]?.closes || ""}
                    onChange={(e) =>
                      updateHours(index, "closes", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeDay(index)}
              className="shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))
      )}

      {openingHours.length < 7 && (
        <Button
          type="button"
          variant="outline"
          onClick={addDay}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          {String(t("EditAbout.addDay"))}
        </Button>
      )}
    </div>
  );
}
