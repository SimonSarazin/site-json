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

const TYPE_ORGA_OPTIONS = [
  { value: "NGO", label: "Association" },
  { value: "LocalBusiness", label: "Entreprise locale" },
  { value: "Group", label: "Groupe" },
  { value: "GovernmentOrganization", label: "Organisation gouvernementale" },
  { value: "Cooperative", label: "Coopérative" },
];

const AVANCEMENT_OPTIONS = [
  { value: "idea", label: "Idée" },
  { value: "starting", label: "Démarrage" },
  { value: "development", label: "Développement" },
  { value: "mature", label: "Mature" },
  { value: "ending", label: "Fin" },
];

const infoSchema = z.object({
  name: z.string().min(2, "Le nom doit avoir au moins 2 caractères"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  url: z.string().url("URL invalide").optional().or(z.literal("")),
  fixe: z.string().optional(),
  mobile: z.string().optional(),
  birthDate: z.string().optional(),
  type: z.string().optional(),
  avancement: z.string().optional(),
  tags: z.string().optional(),
});

type InfoFormData = z.infer<typeof infoSchema>;

interface EditInfoGeneralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  initialData: {
    name?: string;
    email?: string;
    url?: string;
    fixe?: string;
    mobile?: string;
    birthDate?: string | Date;
    type?: string;
    avancement?: string;
    tags?: string[];
  };
}

export function EditInfoGeneralModal({
  open,
  onOpenChange,
  entityType,
  initialData,
}: EditInfoGeneralModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateInfo } = useProfileMutations();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<InfoFormData>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name: initialData.name || "",
      email: initialData.email || "",
      url: initialData.url || "",
      fixe: initialData.fixe || "",
      mobile: initialData.mobile || "",
      birthDate: initialData.birthDate
        ? (typeof initialData.birthDate === "string"
            ? initialData.birthDate.split("T")[0].split(" ")[0]
            : initialData.birthDate instanceof Date
              ? initialData.birthDate.toISOString().split("T")[0]
              : "")
        : "",
      type: initialData.type || "",
      avancement: initialData.avancement || "",
      tags: initialData.tags?.join(", ") || "",
    },
  });

  const watchedType = watch("type");
  const watchedAvancement = watch("avancement");

  const onSubmit = async (data: InfoFormData) => {
    try {
      const tagsArray = data.tags
        ? data.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : [];
      const initialTagsString = initialData.tags?.join(", ") || "";

      const apiData = {
        name: data.name !== initialData.name ? data.name : null,
        email: data.email !== (initialData.email || "") ? data.email : null,
        url: data.url !== (initialData.url || "") ? data.url : null,
        fixe: data.fixe !== (initialData.fixe || "") ? data.fixe : null,
        mobile: data.mobile !== (initialData.mobile || "") ? data.mobile : null,
        birthDate: data.birthDate || null,
        type: data.type !== (initialData.type || "") ? data.type : null,
        avancement: data.avancement !== (initialData.avancement || "") ? data.avancement : null,
        tags: data.tags !== initialTagsString ? (tagsArray.length > 0 ? tagsArray : null) : null,
      };

      const hasChanges = Object.values(apiData).some(v => v !== null);
      if (!hasChanges) {
        onOpenChange(false);
        return;
      }

      await updateInfo.mutateAsync(apiData);


      toast({
        title: String(t("EditAbout.success")),
        description: String(t("EditAbout.infoUpdated")),
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {String(t("EditAbout.editInfo"))}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{String(t("EditAbout.name"))} *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder={String(t("EditAbout.namePlaceholder"))}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {entityType === "organizations" && (
            <div className="space-y-2">
              <Label>{String(t("EditAbout.organizationType"))}</Label>
              <Select
                value={watchedType}
                onValueChange={(value) => setValue("type", value, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={String(t("EditAbout.selectType"))} />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORGA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entityType === "projects" && (
            <div className="space-y-2">
              <Label>{String(t("EditAbout.projectProgress"))}</Label>
              <Select
                value={watchedAvancement}
                onValueChange={(value) => setValue("avancement", value, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={String(t("EditAbout.selectProgress"))} />
                </SelectTrigger>
                <SelectContent>
                  {AVANCEMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entityType === "citoyens" && (
            <div className="space-y-2">
              <Label htmlFor="birthDate">{String(t("EditAbout.birthDate"))}</Label>
              <Input
                id="birthDate"
                type="date"
                {...register("birthDate")}
              />
            </div>
          )}

          {entityType !== "poi" && (
            <div className="space-y-2">
              <Label htmlFor="email">{String(t("EditAbout.email"))}</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          )}

          {(entityType === "organizations" || entityType === "citoyens") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fixe">{String(t("EditAbout.fixedPhone"))}</Label>
                <Input
                  id="fixe"
                  {...register("fixe")}
                  placeholder="+33 1 23 45 67 89"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">{String(t("EditAbout.mobilePhone"))}</Label>
                <Input
                  id="mobile"
                  {...register("mobile")}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="url">{String(t("EditAbout.mainUrl"))}</Label>
            <Input
              id="url"
              type="url"
              {...register("url")}
              placeholder="https://example.com"
            />
            {errors.url && (
              <p className="text-sm text-destructive">{errors.url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">{String(t("EditAbout.tags"))}</Label>
            <Input
              id="tags"
              {...register("tags")}
              placeholder={String(t("EditAbout.tagsPlaceholder"))}
            />
            <p className="text-xs text-muted-foreground">
              {String(t("EditAbout.tagsHelp"))}
            </p>
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
              disabled={updateInfo.isPending || !isDirty}
            >
              {updateInfo.isPending ? (
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
