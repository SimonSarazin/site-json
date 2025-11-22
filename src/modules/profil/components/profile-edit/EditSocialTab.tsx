import { UseFormReturn } from "react-hook-form";
import { useT } from "@/hooks/useT";
import {
  Github,
  GitlabIcon as Gitlab,
  Facebook,
  Twitter,
  Instagram,
  MessageCircle,
  Send,
  Phone
} from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface EditSocialTabProps {
  form: UseFormReturn<any>;
}

/**
 * Tab pour éditer les réseaux sociaux (User uniquement)
 *
 * Champs :
 * - github
 * - gitlab
 * - facebook
 * - twitter
 * - instagram
 * - diaspora
 * - mastodon
 * - telegram
 * - signal
 */
export function EditSocialTab({ form }: EditSocialTabProps) {
  const t = useT("modules/profil");

  const socialNetworks = [
    { name: "github", icon: Github, placeholder: "username" },
    { name: "gitlab", icon: Gitlab, placeholder: "username" },
    { name: "facebook", icon: Facebook, placeholder: "username" },
    { name: "twitter", icon: Twitter, placeholder: "@username" },
    { name: "instagram", icon: Instagram, placeholder: "@username" },
    { name: "diaspora", icon: MessageCircle, placeholder: "username@pod.example" },
    { name: "mastodon", icon: MessageCircle, placeholder: "@username@instance.social" },
    { name: "telegram", icon: Send, placeholder: "@username" },
    { name: "signal", icon: Phone, placeholder: "+33..." },
  ];

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        {t("ProfileEdit.tabs.social.description")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {socialNetworks.map((network) => {
          const Icon = network.icon;
          return (
            <FormField
              key={network.name}
              control={form.control}
              name={network.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 capitalize">
                    <Icon className="w-4 h-4" />
                    {network.name}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={network.placeholder}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
