import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Facebook, Instagram, Github, Send, MessageCircle, Share2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileFormData } from "../EditProfileModal";

interface SocialTabProps {
  form: UseFormReturn<ProfileFormData>;
}

const SOCIAL_FIELDS = [
  { name: "facebook" as const, label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/..." },
  { name: "instagram" as const, label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/..." },
  { name: "twitter" as const, label: "Twitter/X", icon: Share2, placeholder: "https://twitter.com/..." },
  { name: "github" as const, label: "GitHub", icon: Github, placeholder: "https://github.com/..." },
  { name: "gitlab" as const, label: "GitLab", icon: Github, placeholder: "https://gitlab.com/..." },
  { name: "telegram" as const, label: "Telegram", icon: Send, placeholder: "https://t.me/..." },
  { name: "signal" as const, label: "Signal", icon: MessageCircle, placeholder: "Signal number..." },
  { name: "mastodon" as const, label: "Mastodon", icon: MessageCircle, placeholder: "https://mastodon.social/@..." },
  { name: "diaspora" as const, label: "Diaspora", icon: MessageCircle, placeholder: "https://diaspora.social/..." },
];

export function SocialTab({ form }: SocialTabProps) {
  const t = useT("modules/profil");
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {String(t("EditAbout.socialNetworksDescription"))}
      </p>

      <div className="grid gap-4">
        {SOCIAL_FIELDS.map((field) => {
          const Icon = field.icon;
          return (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={field.name} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {field.label}
              </Label>
              <Input
                id={field.name}
                {...register(field.name)}
                placeholder={field.placeholder}
              />
              {errors[field.name] && (
                <p className="text-sm text-destructive">
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
