import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchEntity } from "@/modules/search/schema";
import { useEntityProfile } from "../hooks/useEntityProfile";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/components/profile/i18n";

interface ProfileOrganizerProps {
  section: {
    type: "profile-organizer";
    title?: { fr?: string; en?: string };
    showLogo?: boolean;
    showDescription?: boolean;
    showLink?: boolean;
  };
  entity: SearchEntity;
}

export default function ProfileOrganizer({ section, entity }: ProfileOrganizerProps) {
  useLoadNamespace("components/profile");
  const t = useT("components/profile");
  const { organizers } = useEntityProfile(entity);

  const organizersList = Object.entries(organizers);

  if (organizersList.length === 0) {
    return null;
  }

  const title = section.title ? t(section.title) : t("common.organizedBy");

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {organizersList.map(([id, org]) => (
            <div key={id} className="flex items-start gap-4">
              {section.showLogo !== false && org.profilThumbImageUrl && (
                <img
                  src={org.profilThumbImageUrl}
                  alt={org.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{org.name}</h3>
                {section.showLink !== false && org.slug && (
                  <a
                    href={`/@${org.slug}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t("common.viewProfile")}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
