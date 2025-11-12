import { Calendar, MapPin, Users, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchEntity } from "@/modules/search/schema";
import { formatDate } from "@/helpers/formatDate";
import { useEntityProfile } from "../hooks/useEntityProfile";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/components/profile/i18n";

interface ProfileInfoProps {
  section: {
    type: "profile-info";
    variant?: "sidebar" | "inline" | "tabs";
    showAddress?: boolean;
    showDates?: boolean;
    showOrganizer?: boolean;
    showAttendees?: boolean;
  };
  entity: SearchEntity;
}

export default function ProfileInfo({ section, entity }: ProfileInfoProps) {
  useLoadNamespace("components/profile");
  const t = useT("components/profile");
  
  const { address, startDate, endDate, organizers, url, externalLinkRegistration } = useEntityProfile(entity);

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
            <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{t("common.date")}</p>
              <p className="text-sm text-gray-600">
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
            <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{t("ProfileInfo.place")}</p>
              <p className="text-sm text-gray-600">{addressString}</p>
            </div>
          </div>
        )}

        {/* Organisateur */}
        {section.showOrganizer !== false && Object.keys(organizers).length > 0 && (
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{t("common.organizedBy")}</p>
              {Object.entries(organizers).map(([key, org]) => (
                <div key={key} className="text-sm text-gray-600 mt-1">
                  {org.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lien externe */}
        {url && (
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">{t("ProfileInfo.website")}</p>
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
