import { Award } from "lucide-react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import type { ProfileBadgesSection } from "../../schema";
import type { LocalizedString } from "@/types/locale-schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

interface ProfileBadgesProps {
  section: ProfileBadgesSection;
}

/**
 * Section pour afficher les badges d'une entité
 * Extrait du ProfileTemplateDefault (lignes 341-356)
 */
export default function ProfileBadges({ section }: ProfileBadgesProps) {
  const { entity } = useProfileEntity();
  const { badges } = useFormatProfileEntity(entity);
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { currentLocale } = useLocalization();

  const {
    title,
    showIcon = true,
    layout = "flex",
    maxDisplay,
  } = section;

  // Si pas de badges, ne rien afficher
  if (!badges || badges.length === 0) {
    return null;
  }

  // Limiter le nombre de badges affichés si maxDisplay est défini
  const displayedBadges = maxDisplay ? badges.slice(0, maxDisplay) : badges;

  // Résoudre le titre localisé
  const resolvedTitle = title
    ? (typeof title === "string" ? title : (title as LocalizedString)[currentLocale] || title.fr || title.en)
    : t("ProfileTemplateDefault.badges");

  // Classes CSS selon le layout
  const layoutClasses = {
    flex: "flex flex-wrap gap-3",
    grid: "grid grid-cols-2 sm:grid-cols-3 gap-3",
    list: "flex flex-col gap-2",
  };

  return (
    <div className="mb-8">
      {/* Titre avec icône */}
      <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
        {showIcon && <Award className="w-6 h-6 text-teal-600" />}
        {resolvedTitle}
      </h2>

      {/* Liste des badges */}
      <div className={layoutClasses[layout]}>
        {displayedBadges.map((badge, index) => (
          <div
            key={index}
            className="bg-card border border-(--themecolor) rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
          >
            {showIcon && <Award className="w-4 h-4 text-teal-600" />}
            <span className="text-foreground font-medium">
              {badge.name || "Badge"}
            </span>
          </div>
        ))}
      </div>

      {/* Indicateur si badges tronqués */}
      {maxDisplay && badges.length > maxDisplay && (
        <p className="text-sm text-muted-foreground mt-2">
          +{badges.length - maxDisplay} {t("common.more")}
        </p>
      )}
    </div>
  );
}
