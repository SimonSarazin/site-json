import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/useT";
import type { ProfileFormData } from "../EditProfileModal";

interface ContactTabProps {
  form: UseFormReturn<ProfileFormData>;
  entityType: string;
}

export function ContactTab({ form, entityType }: ContactTabProps) {
  const t = useT("modules/profil");
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {String(t("EditAbout.contactDescription"))}
      </p>

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
    </div>
  );
}
