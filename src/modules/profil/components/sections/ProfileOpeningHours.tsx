import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import type { ProfileOpeningHoursSection } from "../../schema";
import type { LocalizedString } from "@/types/locale-schema";

interface ProfileOpeningHoursProps {
  section: ProfileOpeningHoursSection;
}

/**
 * Section pour afficher les horaires d'ouverture d'une entité
 * Extrait du ProfileTemplateDefault (lignes 374-397)
 */
export default function ProfileOpeningHours({ section }: ProfileOpeningHoursProps) {
  const { entity } = useProfileEntity();
  const { openingHours } = useFormatProfileEntity(entity);
  const t = useT("modules/profil");
  const { currentLocale } = useLocalization();

  const {
    title,
    format = "table",
    showCurrentStatus = false,
  } = section;

  // Si pas d'horaires, ne rien afficher
  if (!openingHours || openingHours.length === 0) {
    return null;
  }

  // Résoudre le titre localisé
  const resolvedTitle = title
    ? (typeof title === "string" ? title : (title as LocalizedString)[currentLocale] || title.fr || title.en)
    : t("ProfileTemplateDefault.openingHours");

  // TODO: Implémenter le calcul du statut actuel (ouvert/fermé)
  const currentStatus = showCurrentStatus ? null : null;

  // Rendu selon le format
  const renderTable = () => (
    <div className="bg-card p-5 rounded-lg border border-border shadow-sm">
      {openingHours.map((schedule, index) => (
        <div
          key={index}
          className="flex justify-between items-center py-3 border-b border-border last:border-b-0"
        >
          <span className="font-semibold text-foreground">
            {schedule.dayOfWeek}
          </span>
          <div className="text-foreground font-medium">
            {schedule.hours && schedule.hours.length > 0 && (
              schedule.hours.map((hour, hIndex) => (
                <span key={hIndex}>
                  {hour.opens} - {hour.closes}
                  {hIndex < schedule.hours.length - 1 && ", "}
                </span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <ul className="space-y-2">
      {openingHours.map((schedule, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className="font-semibold text-foreground min-w-[100px]">
            {schedule.dayOfWeek}:
          </span>
          <span className="text-foreground">
            {schedule.hours && schedule.hours.length > 0
              ? schedule.hours.map((hour, hIndex) => (
                  <span key={hIndex}>
                    {hour.opens} - {hour.closes}
                    {hIndex < schedule.hours.length - 1 && ", "}
                  </span>
                ))
              : t("ProfileOpeningHours.closed")}
          </span>
        </li>
      ))}
    </ul>
  );

  const renderCompact = () => (
    <div className="text-sm text-foreground">
      {openingHours.map((schedule, index) => (
        <span key={index}>
          <strong>{schedule.dayOfWeek}</strong>:{" "}
          {schedule.hours && schedule.hours.length > 0
            ? schedule.hours.map((hour, hIndex) => (
                <span key={hIndex}>
                  {hour.opens}-{hour.closes}
                  {hIndex < schedule.hours.length - 1 && ", "}
                </span>
              ))
            : "Fermé"}
          {index < openingHours.length - 1 && " • "}
        </span>
      ))}
    </div>
  );

  const formatRenderers = {
    table: renderTable,
    list: renderList,
    compact: renderCompact,
  };

  return (
    <div className="mb-8">
      {/* Titre avec statut actuel optionnel */}
      <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
        {resolvedTitle}
        {showCurrentStatus && currentStatus && (
          <span className="text-sm font-normal text-muted-foreground">
            ({currentStatus})
          </span>
        )}
      </h2>

      {/* Rendu des horaires selon le format */}
      {formatRenderers[format]()}
    </div>
  );
}
