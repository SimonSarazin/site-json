import { Clock } from "lucide-react";
import { useT } from "@/hooks/useT";
import { formatDate } from "@/helpers/formatDate";
import type { ProfileEntity } from "@/modules/profil/types";

interface OpeningHoursSectionProps {
  entity: ProfileEntity;
  entityType: string;
}

interface OpeningHour {
  dayOfWeek: string;
  hours?: Array<{ opens: string; closes: string }>;
}

const DAY_NAMES: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
  Monday: "Lundi",
  Tuesday: "Mardi",
  Wednesday: "Mercredi",
  Thursday: "Jeudi",
  Friday: "Vendredi",
  Saturday: "Samedi",
  Sunday: "Dimanche",
};

export function OpeningHoursSection({ entity, entityType }: OpeningHoursSectionProps) {
  const t = useT("modules/profil");

  if (entityType === "poi" || entityType === "citoyens") {
    return null;
  }

  const startDate = entity.serverData?.startDate;
  const endDate = entity.serverData?.endDate;
  const openingHours = entity.serverData?.openingHours as OpeningHour[] | undefined;

  const hasOpeningHours = (openingHours && openingHours.length > 0) || (startDate && endDate);

  const isProject = entityType === "projects";
  const title = isProject ? t("AboutTab.openingDate") : t("AboutTab.openingHours");

  return (
    <li className="ms-6 w-full mb-4">
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-teal-600 text-white">
        <Clock className="w-3 h-3" />
      </span>
      <div className="flex justify-between">
        <h2 className="flex items-center mb-1 text-base font-semibold text-foreground uppercase">
          {String(title)}
        </h2>
      </div>
      {hasOpeningHours ? (
        <ol className="relative border-s border-teal-600 mt-2 ml-2">
          {startDate && endDate ? (
            <>
              <li className="mb-2 ms-4">
                <div className="absolute w-3 h-3 rounded-full mt-1.5 -start-1.5 border border-teal-600 bg-teal-700" />
                <time className="text-sm font-normal leading-none text-muted-foreground">
                  {String(t("AboutTab.from"))}
                </time>
                <p className="text-base font-semibold text-foreground">
                  {formatDate(startDate as string)}
                </p>
              </li>
              <li className="ms-4">
                <div className="absolute w-3 h-3 rounded-full mt-1.5 -start-1.5 border border-teal-600 bg-teal-700" />
                <time className="mb-1 text-sm font-normal leading-none text-muted-foreground">
                  {String(t("AboutTab.to"))}
                </time>
                <p className="text-base font-semibold text-foreground">
                  {formatDate(endDate as string)}
                </p>
              </li>
            </>
          ) : null}
          {openingHours && openingHours.length > 0 && openingHours.map((item, index) => (
            <li key={index} className="mb-2 ms-4">
              <div className="absolute w-3 h-3 rounded-full mt-1.5 -start-1.5 border border-teal-600 bg-teal-700" />
              <time className="text-sm font-normal leading-none text-muted-foreground">
                {DAY_NAMES[item.dayOfWeek] || item.dayOfWeek}
              </time>
              {item.hours && item.hours.length > 0 && (
                <p className="text-base font-semibold text-foreground">
                  {item.hours[0].opens} - {item.hours[0].closes}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-sm text-muted-foreground mt-2 block">
          {t("AboutTab.notSpecified")}
        </span>
      )}
    </li>
  );
}
