import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/hooks/useT";
import { TYPE_ORGA_OPTIONS, AVANCEMENT_OPTIONS } from "@/modules/profil/components/news/constants";
import type { ProfileFormData } from "../EditProfileModal";

interface InfoTabProps {
  form: UseFormReturn<ProfileFormData>;
  entityType: string;
}

export function InfoTab({ form, entityType }: InfoTabProps) {
  const t = useT("modules/profil");
  const { register, formState: { errors }, setValue, watch } = form;

  const watchedType = watch("type");
  const watchedAvancement = watch("avancement");

  return (
    <div className="space-y-4">
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
        <p className="text-xs text-muted-foreground">
          {String(t("EditAbout.nameDescription"))}
        </p>
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
          <p className="text-xs text-muted-foreground">
            {String(t("EditAbout.organizationTypeDescription"))}
          </p>
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

      <div className="space-y-2">
        <Label htmlFor="shortDescription">
          {String(t("EditAbout.shortDescription"))}
        </Label>
        <Textarea
          id="shortDescription"
          {...register("shortDescription")}
          placeholder={String(t("EditAbout.shortDescriptionPlaceholder"))}
          rows={2}
          maxLength={500}
        />
        {errors.shortDescription && (
          <p className="text-sm text-destructive">
            {errors.shortDescription.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {String(t("EditAbout.shortDescriptionHelp"))}
        </p>
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
        <p className="text-xs text-muted-foreground">
          {String(t("EditAbout.descriptionHelp"))}
        </p>
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
    </div>
  );
}
