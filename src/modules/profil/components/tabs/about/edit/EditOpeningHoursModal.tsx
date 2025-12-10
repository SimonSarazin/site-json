import { useState } from "react";
import { Pencil, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { useToast } from "@/hooks/use-toast";

const DAYS_OF_WEEK = [
  { value: "Mo", label: "Lundi" },
  { value: "Tu", label: "Mardi" },
  { value: "We", label: "Mercredi" },
  { value: "Th", label: "Jeudi" },
  { value: "Fr", label: "Vendredi" },
  { value: "Sa", label: "Samedi" },
  { value: "Su", label: "Dimanche" },
];

interface OpeningHour {
  dayOfWeek: string;
  hours?: Array<{ opens: string; closes: string }>;
}

interface EditOpeningHoursModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: OpeningHour[];
}

export function EditOpeningHoursModal({
  open,
  onOpenChange,
  initialData,
}: EditOpeningHoursModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateOpeningHours } = useProfileMutations();

  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(
    initialData.length > 0 ? initialData : []
  );

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

  const handleSubmit = async () => {
    try {
      const validHours = openingHours.filter(
        (oh) => oh.hours && oh.hours.length > 0 && oh.hours[0].opens && oh.hours[0].closes
      );

      await updateOpeningHours.mutateAsync(validHours);

      toast({
        title: String(t("EditAbout.success")),
        description: String(t("EditAbout.openingHoursUpdated")),
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error updating opening hours:", error);
      toast({
        title: String(t("EditAbout.error")),
        description: String(t("EditAbout.updateFailed")),
        variant: "destructive",
      });
    }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {String(t("EditAbout.editOpeningHours"))}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

        <DialogFooter className="gap-2 space-x-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {String(t("EditAbout.cancel"))}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={updateOpeningHours.isPending}
          >
            {updateOpeningHours.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {String(t("EditAbout.saving"))}
              </>
            ) : (
              String(t("EditAbout.save"))
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
