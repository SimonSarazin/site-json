import { Calendar, MapPin, Users, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchEntity } from "@/modules/search/schema";

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
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getAddress = () => {
    if ("address" in entity && entity.address) {
      const addr = entity.address as any;
      return `${addr.streetAddress || ""}, ${addr.postalCode || ""} ${addr.addressLocality || ""}`.trim();
    }
    return null;
  };

  const address = getAddress();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Informations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {section.showDates !== false && "startDate" in entity && entity.startDate && (
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Date</p>
              <p className="text-sm text-gray-600">
                Du {formatDate(entity.startDate as string)}
                {"endDate" in entity && entity.endDate && (
                  <> au {formatDate(entity.endDate as string)}</>
                )}
              </p>
            </div>
          </div>
        )}

        {section.showAddress !== false && address && (
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Lieu</p>
              <p className="text-sm text-gray-600">{address}</p>
            </div>
          </div>
        )}

        {/* Organisateur */}
        {section.showOrganizer !== false && "organizer" in entity && entity.organizer && (
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Organisé par</p>
              {Object.entries(entity.organizer as Record<string, any>).map(([key, org]) => (
                <div key={key} className="text-sm text-gray-600 mt-1">
                  {org.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lien externe */}
        {"url" in entity && entity.url && (
          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Site web</p>
              <a
                href={entity.url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Voir le site
              </a>
            </div>
          </div>
        )}

        {/* Inscription */}
        {"externalLinkRegistration" in entity && entity.externalLinkRegistration && (
          <div className="pt-4 border-t">
            <a
              href={entity.externalLinkRegistration as string}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              S'inscrire à l'événement
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
