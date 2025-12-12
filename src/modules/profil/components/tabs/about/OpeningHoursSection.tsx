import { useState } from "react";
import { Clock, Pencil } from "lucide-react";
import { useT } from "@/hooks/useT";
import { formatDate } from "@/helpers/formatDate";
import type { ProfileEntity } from "@/modules/profil/types";
import { useProfileMutations } from "@/modules/profil/hooks/useProfileMutations";
import { EditOpeningHoursModal } from "./edit/EditOpeningHoursModal";
import { EditDateTimeModal } from "./edit/EditDateTimeModal";

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
  Mo: "Lundi",
  Tu: "Mardi",
  We: "Mercredi",
  Th: "Jeudi",
  Fr: "Vendredi",
  Sa: "Samedi",
  Su: "Dimanche",
};

export function OpeningHoursSection({ entity, entityType }: OpeningHoursSectionProps) {
  const t = useT("modules/profil");
  const { canEdit } = useProfileMutations();
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (entityType === "poi" || entityType === "citoyens") {
    return null;
  }

  const startDate = entity.serverData?.startDate;
  const endDate = entity.serverData?.endDate;
  const openingHours = entity.serverData?.openingHours as OpeningHour[] | undefined;

  const hasOpeningHours = (openingHours && openingHours.length > 0) || (startDate && endDate);

  const isProject = entityType === "projects";
  const title = isProject ? t("AboutTab.openingDate") : t("AboutTab.openingHours");

  // Enable edit for both organizations and projects
  const canEditSection = canEdit;

  return (
    <li className={`ms-6 w-full mb-4 group ${canEditSection ? "hover:bg-muted/50 hover:rounded-lg p-2 -ml-3 pl-8 transition-colors" : ""}`}>
      <span className="absolute flex items-center justify-center w-6 h-6 rounded-full -start-3 ring-8 ring-background bg-primary text-primary-foreground">
        <Clock className="w-3 h-3" />
      </span>
      <div className="flex justify-between items-center">
        <h2 className="flex items-center mb-1 text-base font-semibold text-foreground uppercase">
          {String(title)}
        </h2>
        {canEditSection && (
          <button
            onClick={() => setIsEditOpen(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
            aria-label={String(t("EditAbout.edit"))}
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {hasOpeningHours ? (
        <ol className="relative border-s border-primary mt-2 ml-2">
          {startDate && endDate ? (
            <>
              <li className="mb-2 ms-4">
                <div className="absolute w-3 h-3 rounded-full mt-1.5 -start-1.5 border border-primary bg-primary" />
                <time className="text-sm font-normal leading-none text-muted-foreground">
                  {String(t("AboutTab.from"))}
                </time>
                <p className="text-base font-semibold text-foreground">
                  {formatDate(startDate as string)}
                </p>
              </li>
              <li className="ms-4">
                <div className="absolute w-3 h-3 rounded-full mt-1.5 -start-1.5 border border-primary bg-primary" />
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
              <div className="absolute w-3 h-3 rounded-full mt-1.5 -start-1.5 border border-primary bg-primary" />
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
        <div className="mt-2">
          {canEditSection ? (
            <button
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-2 px-4 py-3 w-full text-sm text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-lg hover:border-primary hover:text-primary hover:bg-primary/10 transition-all"
            >
              <Clock className="w-4 h-4" />
              {isProject ? t("EditAbout.addDateTime") : t("EditAbout.addOpeningHours")}
            </button>
          ) : (
            <span className="text-sm text-muted-foreground block">
              {t("AboutTab.notSpecified")}
            </span>
          )}
        </div>
      )}

      {canEditSection && isProject && (
        <EditDateTimeModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          initialData={{
            startDate: startDate as string | Date | null | undefined,
            endDate: endDate as string | Date | null | undefined,
          }}
        />
      )}

      {canEditSection && !isProject && (
        <EditOpeningHoursModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          initialData={openingHours || []}
        />
      )}
    </li>
  );
}
