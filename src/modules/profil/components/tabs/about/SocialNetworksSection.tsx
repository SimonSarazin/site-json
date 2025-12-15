import { useState } from "react";
import {
  Share2,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Github,
  MessageCircle,
  Send,
  Link,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileEntity } from "@/modules/profil/types";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { EditSocialNetworksModal } from "./edit/EditSocialNetworksModal";

interface SocialNetworksSectionProps {
  entity: ProfileEntity;
  entityType: string;
}

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  github: Github,
  discord: MessageCircle,
  telegram: Send,
  whatsapp: MessageCircle,
  signal: MessageCircle,
  twitter: Share2,
};

export function SocialNetworksSection({ entity, entityType }: SocialNetworksSectionProps) {
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (entityType === "poi") {
    return null;
  }

  const socialNetwork = entity.serverData?.socialNetwork as Record<string, string> | undefined;
  const hasSocialNetworks = socialNetwork && Object.keys(socialNetwork).length > 0;

  return (
    <li className={`ms-6 w-full mb-4 group ${canEdit ? "hover:bg-muted/50 hover:rounded-lg p-2 -ml-3 pl-8 transition-colors" : ""}`}>
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-primary text-primary-foreground">
        <Share2 className="w-3 h-3" />
      </span>
      <div className="flex justify-between items-center">
        <h2 className="flex items-center mb-1 text-base font-semibold text-foreground uppercase">
          {t("AboutTab.socialNetworks")}
        </h2>
        {canEdit && (
          <button
            onClick={() => setIsEditOpen(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
            aria-label={String(t("EditAbout.edit"))}
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {hasSocialNetworks ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(socialNetwork).map(([key, value]) => {
            if (!value || typeof value !== "string") return null;
            const IconComponent = SOCIAL_ICONS[key] || Link;
            return (
              <a
                key={key}
                href={value}
                title={key}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground bg-card border border-border focus:outline-none hover:bg-muted focus:ring-4 focus:ring-muted font-medium rounded px-3 py-1.5 hover:border-primary transition-colors"
                aria-label={key}
              >
                <IconComponent className="w-4 h-4" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground mt-2 block">
          {t("AboutTab.notSpecified")}
        </span>
      )}

      {canEdit && (
        <EditSocialNetworksModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          initialData={socialNetwork || {}}
        />
      )}
    </li>
  );
}
