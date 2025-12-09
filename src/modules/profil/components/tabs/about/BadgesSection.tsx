import { Award } from "lucide-react";
import { useT } from "@/hooks/useT";
import type { ProfileEntity } from "@/modules/profil/types";

interface BadgesSectionProps {
  entity: ProfileEntity;
}

interface Badge {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  show?: string;
  order?: string;
  attenteEmetteur?: boolean;
  attenteRecepteur?: boolean;
}

export function BadgesSection({ entity }: BadgesSectionProps) {
  const t = useT("modules/profil");

  const badges = entity.serverData?.badges;

  if (!badges) {
    return (
      <li className="ms-6 w-full mb-4">
        <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-teal-600 text-white">
          <Award className="w-3 h-3" />
        </span>
        <div className="flex justify-between">
          <h2 className="flex items-center text-base font-semibold text-foreground uppercase">
            {t("AboutTab.badges")}
          </h2>
        </div>
        <span className="text-sm text-muted-foreground mt-2 block">
          {t("AboutTab.notSpecified")}
        </span>
      </li>
    );
  }

  const filteredBadges: Badge[] = Object.entries(badges)
    .filter(([, item]) => {
      const badge = item as Badge;
      return !badge.attenteEmetteur && !badge.attenteRecepteur && badge.show === "true";
    })
    .map(([id, item]) => ({ ...(item as Badge), id }))
    .sort((a, b) => parseInt(a.order || "0", 10) - parseInt(b.order || "0", 10));

  return (
    <li className="ms-6 w-full mb-4">
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-teal-600 text-white">
        <Award className="w-3 h-3" />
      </span>
      <div className="flex justify-between">
        <h2 className="flex items-center text-base font-semibold text-foreground uppercase">
          {t("AboutTab.badges")}
        </h2>
      </div>
      <div className="text-sm w-full mt-2">
        {filteredBadges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filteredBadges.map((badge, index) => (
              <div
                key={badge.id || index}
                className="bg-card border border-teal-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                title={badge.description || badge.name}
              >
                <Award className="w-4 h-4 text-teal-600" />
                <span className="text-foreground font-medium text-sm">
                  {badge.name || "Badge"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{t("AboutTab.notSpecified")}</span>
        )}
      </div>
    </li>
  );
}
