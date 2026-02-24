import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import type { ProfileOrganizerSection } from "../../schema";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface ProfileOrganizerProps {
  section: ProfileOrganizerSection;
}

export default function ProfileOrganizer({ section }: ProfileOrganizerProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");
  const { organizers } = useFormatProfileEntity(entity);

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
                <OptimizedImage
                  src={org.profilThumbImageUrl!}
                  alt={org.name || ""}
                  width={64}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{org.name}</h3>
                {section.showLink !== false && org.slug && (
                  <a
                    href={`/profil/${org.slug}`}
                    className="text-sm text-primary hover:underline"
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
