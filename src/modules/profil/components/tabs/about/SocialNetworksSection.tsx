import { Share2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileEntity } from "@/modules/profil/types";

interface SocialNetworksSectionProps {
  entity: ProfileEntity;
  entityType: string;
}

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "fa-facebook",
  instagram: "fa-instagram",
  linkedin: "fa-linkedin",
  youtube: "fa-youtube",
  tiktok: "fa-tiktok",
  github: "fa-github",
  discord: "fa-discord",
  telegram: "fa-telegram",
  whatsapp: "fa-whatsapp",
  signal: "fa-signal",
  mastodon: "fa-mastodon",
  pinterest: "fa-pinterest",
  snapchat: "fa-snapchat",
  reddit: "fa-reddit",
  twitter: "fa-x-twitter",
};

export function SocialNetworksSection({ entity, entityType }: SocialNetworksSectionProps) {
  const t = useT("modules/profil");

  if (entityType === "poi") {
    return null;
  }

  const socialNetwork = entity.serverData?.socialNetwork;
  const hasSocialNetworks = socialNetwork && Object.keys(socialNetwork).length > 0;

  return (
    <li className="ms-6 w-full mb-4">
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-teal-600 text-white">
        <Share2 className="w-3 h-3" />
      </span>
      <div className="flex justify-between">
        <h2 className="flex items-center mb-1 text-base font-semibold text-foreground uppercase">
          {t("AboutTab.socialNetworks")}
        </h2>
      </div>
      {hasSocialNetworks ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(socialNetwork).map(([key, value]) => {
            if (!value || typeof value !== "string") return null;
            const iconClass = SOCIAL_ICONS[key] || "fa-link";
            const isBrandIcon = key !== "signal";
            return (
              <a
                key={key}
                href={value}
                title={key}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground bg-card border border-border focus:outline-none hover:bg-muted focus:ring-4 focus:ring-muted font-medium rounded px-3 py-1.5 hover:border-teal-400 transition-colors"
                aria-label={key}
              >
                <i
                  className={`${isBrandIcon ? "fa-brands" : "fa-solid"} ${iconClass}`}
                  aria-hidden="true"
                />
              </a>
            );
          })}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground mt-2 block">
          {t("AboutTab.notSpecified")}
        </span>
      )}
    </li>
  );
}
