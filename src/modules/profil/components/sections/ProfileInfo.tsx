import { Calendar, MapPin, Users, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/helpers/formatDate";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import "@/modules/profil/i18n";

interface ProfileInfoProps {
  section: {
    type: "profile-info";
    variant?: "sidebar" | "inline" | "tabs";
    showAddress?: boolean;
    showDates?: boolean;
    showOrganizer?: boolean;
    showAttendees?: boolean;
  };
}

export default function ProfileInfo({ section }: ProfileInfoProps) {
  const { entity } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  
  const { address, startDate, endDate, organizers, url, externalLinkRegistration } = useFormatProfileEntity(entity);

  const addressString = address
    ? [address.streetAddress, address.postalCode, address.addressLocality]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t("ProfileInfo.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {section.showDates !== false && startDate && (
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t("common.date")}</p>
              <p className="text-sm text-textSecondary">
                {t("ProfileInfo.from")} {formatDate(startDate)}
                {endDate && (
                  <> {t("ProfileInfo.to")} {formatDate(endDate)}</>
                )}
              </p>
            </div>
          </div>
        )}

        {section.showAddress !== false && addressString && (
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t("ProfileInfo.place")}</p>
              <p className="text-sm text-textSecondary">{addressString}</p>
            </div>
          </div>
        )}

        {/* Organisateur */}
        {section.showOrganizer !== false && Object.keys(organizers).length > 0 && (
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t("common.organizedBy")}</p>
              {Object.entries(organizers).map(([key, org]) => (
                <div key={key} className="text-sm text-textSecondary mt-1">
                  {org.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lien externe */}
        {url && (
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{t("ProfileInfo.website")}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {t("ProfileInfo.visitWebsite")}
              </a>
            </div>
          </div>
        )}

        {/* Inscription */}
        {externalLinkRegistration && (
          <div className="pt-4 border-t">
            <a
              href={externalLinkRegistration}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              {t("ProfileInfo.registerEvent")}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
