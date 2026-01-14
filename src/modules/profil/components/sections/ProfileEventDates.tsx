import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useT } from "@/hooks/useT";
import { formatDate } from "@/helpers/formatDate";
import type { ProfileEventDatesSection } from "../../schema";
import { isEvent } from "@/lib/getTypedEntity";

interface ProfileEventDatesProps {
  section: ProfileEventDatesSection;
}

/**
 * Section pour afficher les dates d'un événement
 * Extrait du ProfileTemplateDefault (lignes 281-296)
 */
export default function ProfileEventDates({ section }: ProfileEventDatesProps) {
  const { entity } = useProfileEntity();
  const t = useT("modules/profil");

  // Ce composant ne s'affiche que pour les Events
  if (!entity || !isEvent(entity)) {
    return null;
  }

  const { showType } = section;
  const startDate = entity.serverData.startDate;
  const endDate = entity.serverData?.endDate;
  const eventType = entity.serverData?.type;

  return (
    <div className="mb-8">
      {/* Type d'événement avec indicateur coloré */}
      {showType && eventType && typeof eventType === "string" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
          <span className="capitalize">{eventType}</span>
        </div>
      )}

      {/* Dates */}
      <div className="text-foreground">
        <strong>{t("common.date")}:</strong>{" "}
        {formatDate(startDate)}
        {endDate && (
          <> - {formatDate(endDate)}</>
        )}
      </div>
    </div>
  );
}
