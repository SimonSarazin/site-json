import type { UseFormReturn } from "react-hook-form";
import {
  Github,
  GitlabIcon as Gitlab,
  Facebook,
  Twitter,
  Instagram,
  MessageCircle,
  Send,
  Phone,
} from "lucide-react";
import { IconFormField } from "./fields";

interface EditSocialTabProps {
  form: UseFormReturn<any>;
}

const socialNetworks = [
  { name: "github", icon: Github, placeholder: "" },
  { name: "gitlab", icon: Gitlab, placeholder: "" },
  { name: "facebook", icon: Facebook, placeholder: "" },
  { name: "twitter", icon: Twitter, placeholder: "" },
  { name: "instagram", icon: Instagram, placeholder: "@username" },
  { name: "diaspora", icon: MessageCircle, placeholder: "" },
  { name: "mastodon", icon: MessageCircle, placeholder: "" },
  { name: "telegram", icon: Send, placeholder: "" },
  { name: "signal", icon: Phone, placeholder: "" },
] as const;

/**
 * Tab pour éditer les réseaux sociaux (User uniquement)
 */
export function EditSocialTab({ form }: EditSocialTabProps) {

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {socialNetworks.map((network) => (
          <IconFormField
            key={network.name}
            control={form.control}
            name={network.name}
            icon={network.icon}
            label={network.name.charAt(0).toUpperCase() + network.name.slice(1)}
            placeholder={network.placeholder}
          />
        ))}
      </div>
    </div>
  );
}
