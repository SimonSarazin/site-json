import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Loader2 } from "lucide-react";
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
import { useT } from "@/hooks/useT";
import { useToast } from "@/hooks/use-toast";

const dateTimeSchema = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return new Date(data.startDate) < new Date(data.endDate);
  },
  {
    message: "La date de début doit être avant la date de fin",
    path: ["endDate"],
  }
);

type DateTimeFormData = z.infer<typeof dateTimeSchema>;

interface EditDateTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: {
    startDate?: string | Date | null;
    endDate?: string | Date | null;
  };
}

const formatDateForInput = (date: string | Date | null | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function EditDateTimeModal({
  open,
  onOpenChange,
  initialData,
}: EditDateTimeModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<DateTimeFormData>({
    resolver: zodResolver(dateTimeSchema),
    defaultValues: {
      startDate: formatDateForInput(initialData.startDate),
      endDate: formatDateForInput(initialData.endDate),
    },
  });

  const onSubmit = async () => {
    setIsPending(true);
    try {
      toast({
        title: String(t("EditAbout.error")),
        description: "La sauvegarde des dates n'est pas encore disponible",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error updating date/time:", error);
      toast({
        title: String(t("EditAbout.error")),
        description: String(t("EditAbout.updateFailed")),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {String(t("EditAbout.editDateTime"))}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">{String(t("EditAbout.startDate"))}</Label>
            <Input
              id="startDate"
              type="datetime-local"
              {...register("startDate")}
            />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">{String(t("EditAbout.endDate"))}</Label>
            <Input
              id="endDate"
              type="datetime-local"
              {...register("endDate")}
            />
            {errors.endDate && (
              <p className="text-sm text-destructive">{errors.endDate.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {String(t("EditAbout.cancel"))}
            </Button>
            <Button
              type="submit"
              disabled={isPending || !isDirty}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {String(t("EditAbout.saving"))}
                </>
              ) : (
                String(t("EditAbout.save"))
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
