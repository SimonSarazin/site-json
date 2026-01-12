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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { useToast } from "@/hooks/use-toast";

const descriptionSchema = z.object({
  shortDescription: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
});

type DescriptionFormData = z.infer<typeof descriptionSchema>;

interface EditDescriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: {
    shortDescription?: string;
    description?: string;
  };
}

export function EditDescriptionModal({
  open,
  onOpenChange,
  initialData,
}: EditDescriptionModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateDescription } = useProfileMutations();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<DescriptionFormData>({
    resolver: zodResolver(descriptionSchema),
    defaultValues: {
      shortDescription: initialData.shortDescription || "",
      description: initialData.description || "",
    },
  });

  const onSubmit = async (data: DescriptionFormData) => {
    try {
      const apiData = {
        shortDescription: data.shortDescription !== (initialData.shortDescription || "")
          ? data.shortDescription
          : null,
        description: data.description !== (initialData.description || "")
          ? data.description
          : null,
      };

      const hasChanges = apiData.shortDescription !== null || apiData.description !== null;
      if (!hasChanges) {
        onOpenChange(false);
        return;
      }

      await updateDescription.mutateAsync(apiData);

      toast({
        title: String(t("EditAbout.success")),
        description: String(t("EditAbout.descriptionUpdated")),
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: String(t("EditAbout.error")),
        description: String(t("EditAbout.updateFailed")),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {String(t("EditAbout.editDescription"))}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shortDescription">
              {String(t("EditAbout.shortDescription"))}
            </Label>
            <Input
              id="shortDescription"
              {...register("shortDescription")}
              placeholder={String(t("EditAbout.shortDescriptionPlaceholder"))}
            />
            {errors.shortDescription && (
              <p className="text-sm text-destructive">
                {errors.shortDescription.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {String(t("EditAbout.description"))}
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder={String(t("EditAbout.descriptionPlaceholder"))}
              rows={6}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
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
              disabled={updateDescription.isPending || !isDirty}
            >
              {updateDescription.isPending ? (
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
