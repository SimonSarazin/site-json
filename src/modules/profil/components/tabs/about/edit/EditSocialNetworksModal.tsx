import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Loader2, Facebook, Instagram, Github, Send, MessageCircle, Share2 } from "lucide-react";
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
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { useToast } from "@/hooks/use-toast";

const urlOrEmpty = z.string().url().optional().or(z.literal(""));

const socialSchema = z.object({
  facebook: urlOrEmpty,
  instagram: urlOrEmpty,
  twitter: urlOrEmpty,
  github: urlOrEmpty,
  gitlab: urlOrEmpty,
  telegram: urlOrEmpty,
  signal: urlOrEmpty,
  mastodon: urlOrEmpty,
  diaspora: urlOrEmpty,
});

type SocialFormData = z.infer<typeof socialSchema>;

interface SocialNetwork {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  github?: string;
  gitlab?: string;
  telegram?: string;
  signal?: string;
  mastodon?: string;
  diaspora?: string;
}

interface EditSocialNetworksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: SocialNetwork;
}

const SOCIAL_FIELDS = [
  { name: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
  { name: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
  { name: "twitter", label: "Twitter/X", icon: Share2, placeholder: "https://twitter.com/..." },
  { name: "github", label: "GitHub", icon: Github, placeholder: "https://github.com/..." },
  { name: "gitlab", label: "GitLab", icon: Github, placeholder: "https://gitlab.com/..." },
  { name: "telegram", label: "Telegram", icon: Send, placeholder: "https://t.me/..." },
  { name: "signal", label: "Signal", icon: MessageCircle, placeholder: "Signal number..." },
  { name: "mastodon", label: "Mastodon", icon: MessageCircle, placeholder: "https://mastodon.social/@..." },
  { name: "diaspora", label: "Diaspora", icon: MessageCircle, placeholder: "https://diaspora.social/..." },
] as const;

export function EditSocialNetworksModal({
  open,
  onOpenChange,
  initialData,
}: EditSocialNetworksModalProps) {
  const t = useT("modules/profil");
  const { toast } = useToast();
  const { updateSocial } = useProfileMutations();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SocialFormData>({
    resolver: zodResolver(socialSchema),
    defaultValues: {
      facebook: initialData.facebook || "",
      instagram: initialData.instagram || "",
      twitter: initialData.twitter || "",
      github: initialData.github || "",
      gitlab: initialData.gitlab || "",
      telegram: initialData.telegram || "",
      signal: initialData.signal || "",
      mastodon: initialData.mastodon || "",
      diaspora: initialData.diaspora || "",
    },
  });

  const onSubmit = async (data: SocialFormData) => {
    try {
      const apiData: Record<string, string | null> = {};
      let hasChanges = false;

      for (const field of SOCIAL_FIELDS) {
        const key = field.name as keyof SocialFormData;
        const newValue = data[key] || "";
        const oldValue = initialData[key as keyof SocialNetwork] || "";

        if (newValue !== oldValue) {
          apiData[key] = newValue;
          hasChanges = true;
        } else {
          apiData[key] = null;
        }
      }

      if (!hasChanges) {
        onOpenChange(false);
        return;
      }

      await updateSocial.mutateAsync(apiData);

      toast({
        title: String(t("EditAbout.success")),
        description: String(t("EditAbout.socialUpdated")),
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
            {String(t("EditAbout.editSocialNetworks"))}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {SOCIAL_FIELDS.map((field) => {
            const Icon = field.icon;
            const fieldName = field.name as keyof SocialFormData;
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name} className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {field.label}
                </Label>
                <Input
                  id={field.name}
                  {...register(fieldName)}
                  placeholder={field.placeholder}
                />
                {errors[fieldName] && (
                  <p className="text-sm text-destructive">
                    {errors[fieldName]?.message}
                  </p>
                )}
              </div>
            );
          })}

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
              disabled={updateSocial.isPending || !isDirty}
            >
              {updateSocial.isPending ? (
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
