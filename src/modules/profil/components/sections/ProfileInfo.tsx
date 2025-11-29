import {
  Calendar,
  MapPin,
  Users,
  Mail,
  Phone,
  Globe,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/helpers/formatDate";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useProfileSetup } from "../../hooks/useProfileSetup";

interface ProfileInfoProps {
  section: {
    type: "profile-info";
    variant?: "sidebar" | "inline" | "tabs";
    showAddress?: boolean;
    showDates?: boolean;
    showOrganizer?: boolean;
    showAttendees?: boolean;
    showUsername?: boolean;
    showEmail?: boolean;
    showPhone?: boolean;
    showWebsite?: boolean;
    showCounts?: boolean;
    showOpeningDate?: boolean;
    sticky?: boolean;
  };
}

export default function ProfileInfo({ section }: ProfileInfoProps) {
  const { entity, t } = useProfileSetup();

  const {
    address,
    startDate,
    endDate,
    organizers,
    url,
    externalLinkRegistration,
    membersCount,
    projectsCount,
    email,
    mobile,
    username,
    openingDate,
  } = useFormatProfileEntity(entity);

  const cardClasses = section.sticky
    ? "bg-card rounded-lg border border-border p-4 sm:p-6 lg:sticky lg:top-4 shadow-sm mb-6"
    : "bg-card rounded-lg border border-border p-4 sm:p-6 shadow-sm mb-6";

  return (
    <div className={cardClasses}>
      <h3 className="text-xl font-bold text-foreground mb-6">
        {t("ProfileTemplateDefault.information")}
      </h3>

      {/* Members & Projects Counts */}
      {section.showCounts !== false &&
        (membersCount !== null || projectsCount !== null) && (
          <div className="space-y-4 mb-6 pb-6 border-b border-border">
            {membersCount !== null && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  <span className="text-foreground font-medium">
                    {t("ProfileTemplateDefault.members")}
                  </span>
                </div>
                <span className="font-bold text-foreground text-lg">
                  {membersCount}
                </span>
              </div>
            )}
            {projectsCount !== null && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-teal-600" />
                  <span className="text-foreground font-medium">
                    {t("ProfileTemplateDefault.projects")}
                  </span>
                </div>
                <span className="font-bold text-foreground text-lg">
                  {projectsCount}
                </span>
              </div>
            )}
          </div>
        )}

      <div className="space-y-4">
        {/* Username */}
        {section.showUsername !== false &&
          username &&
          typeof username === "string" && (
            <div className="flex items-center gap-3 bg-muted p-3 rounded-lg">
              <span className="text-teal-600 font-semibold">@{username}</span>
            </div>
          )}

        {/* Email */}
        {section.showEmail !== false && email && typeof email === "string" && (
          <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
            <Mail className="w-5 h-5 text-teal-600 shrink-0" />
            <span className="text-foreground break-all text-sm">{email}</span>
          </div>
        )}

        {/* Phone */}
        {section.showPhone !== false &&
          mobile &&
          typeof mobile === "string" && (
            <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
              <Phone className="w-5 h-5 text-teal-600 shrink-0" />
              <a
                href={`tel:${mobile}`}
                className="text-foreground font-medium text-sm hover:text-teal-600"
              >
                {mobile}
              </a>
            </div>
          )}

        {/* Website URL */}
        {section.showWebsite !== false && url && typeof url === "string" && (
          <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
            <Globe className="w-5 h-5 text-teal-600 shrink-0" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 hover:text-teal-700 break-all text-sm font-medium"
            >
              {url.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}

        {/* Address */}
        {section.showAddress !== false &&
          address?.postalCode &&
          address.addressLocality && (
            <div className="flex items-start gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
              <MapPin className="w-5 h-5 text-teal-600 mt-1 shrink-0" />
              <div className="text-sm">
                {address.streetAddress && (
                  <div className="text-foreground font-medium">
                    {address.streetAddress}
                  </div>
                )}
                <div className="text-foreground">
                  {address.postalCode} {address.addressLocality}
                </div>
              </div>
            </div>
          )}

        {/* Opening Date */}
        {section.showOpeningDate !== false &&
          openingDate &&
          (typeof openingDate === "string" ||
            typeof openingDate === "number" ||
            openingDate instanceof Date) && (
            <div className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
              <Calendar className="w-5 h-5 text-teal-600 shrink-0" />
              <span className="text-foreground text-sm font-medium">
                {t("ProfileTemplateDefault.openSince")}{" "}
                {formatDate(openingDate as string | number | Date)}
              </span>
            </div>
          )}

        {/* Event Dates (for events) */}
        {section.showDates !== false &&
          startDate &&
          (typeof startDate === "string" ||
            typeof startDate === "number" ||
            startDate instanceof Date) && (
            <div className="flex items-start gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
              <Calendar className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">
                  {t("common.date")}
                </p>
                <p className="text-sm text-foreground">
                  {formatDate(startDate as string | number | Date)}
                  {endDate &&
                    (typeof endDate === "string" ||
                      typeof endDate === "number" ||
                      endDate instanceof Date) && (
                      <> - {formatDate(endDate as string | number | Date)}</>
                    )}
                </p>
              </div>
            </div>
          )}

        {/* Organizer (for events) */}
        {section.showOrganizer !== false &&
          Object.keys(organizers).length > 0 && (
            <div className="flex items-start gap-3 p-2 hover:bg-muted rounded-lg transition-colors">
              <Users className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">
                  {t("common.organizedBy")}
                </p>
                {Object.entries(organizers).map(([key, org]) => (
                  <div key={key} className="text-sm text-foreground mt-1">
                    {org.name}
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Registration Button */}
        {externalLinkRegistration &&
          typeof externalLinkRegistration === "string" && (
            <div className="mt-6 pt-6 border-t border-border">
              <Button
                className="w-full bg-[#0092a2] hover:bg-teal-600"
                onClick={() =>
                  window.open(externalLinkRegistration, "_blank")
                }
              >
                {t("ProfileTemplateDefault.register")}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
