import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useT } from "@/hooks/useT";
import { formatDate, resolveEventStartDate } from "@/helpers/formatDate";
import { formatRecurrenceLabel } from "@/modules/search/lib/openingHoursDays";
// Effet de bord : enregistre le bundle i18n "modules/search" (clés `days.*`/`card.event.recurring*`
// utilisées ci-dessous par `formatRecurrenceLabel`) — cette page profil ne rend par ailleurs aucun
// composant du module `search`, qui l'importe déjà pour ses propres besoins (cf. `SearchListView`…).
import "@/modules/search/i18n";
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
  // Clés `days.*`/`card.event.recurring*` vivent dans `modules/search` (réutilisées par `CardEvent`) —
  // un 2ᵉ `t` bindé sur ce namespace plutôt que dupliquer ces traductions dans `modules/profil`.
  const tSearch = useT("modules/search");

  // Ce composant ne s'affiche que pour les Events
  if (!entity || !isEvent(entity)) {
    return null;
  }

  const { showType } = section;
  const sd = entity.serverData as Record<string, unknown>;
  // `startDate` (ponctuel) sinon `startDateSort`/`startDateSortFormat` (occurrence calculée d'un
  // récurrent — un récurrent pur n'a pas de `startDate`, d'où le "Invalid Date" avant ce repli).
  const startDate = resolveEventStartDate(sd);
  const endDate = sd.endDate as Date | string | number | undefined;
  const eventType = typeof sd.type === "string" ? sd.type : null;
  // Récurrent : la date d'une occurrence isolée est trompeuse (change chaque semaine) — préférer un
  // libellé de récurrence stable, ex. « Chaque vendredi » (même logique que la carte de recherche).
  const recurrenceLabel = formatRecurrenceLabel(sd.recurrency, sd.openingHours, tSearch);

  return (
    <div className="mb-8">
      {/* Type d'événement avec indicateur coloré */}
      {showType && eventType && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
          <span className="capitalize">{eventType}</span>
        </div>
      )}

      {/* Dates */}
      {(recurrenceLabel || startDate) && (
        <div className="text-foreground">
          <strong>{t("common.date")}:</strong>{" "}
          {recurrenceLabel ?? (
            <>
              {formatDate(startDate!)}
              {endDate ? <> - {formatDate(endDate)}</> : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
