import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import type { ProfileTagsSection } from "../../schema";
import type { LocalizedString } from "@/types/locale-schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

interface ProfileTagsProps {
  section: ProfileTagsSection;
}

/**
 * Section pour afficher les tags d'une entité
 * Extrait du ProfileTemplateDefault (lignes 358-372)
 */
export default function ProfileTags({ section }: ProfileTagsProps) {
  const { entity } = useProfileEntity();
  const { tags } = useFormatProfileEntity(entity);
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { currentLocale } = useLocalization();

  const {
    title,
    maxDisplay = 20,
    linkable = false,
    searchOnClick = false,
  } = section;

  // Si pas de tags, ne rien afficher
  if (!tags || tags.length === 0) {
    return null;
  }

  // Limiter le nombre de tags affichés
  const displayedTags = tags.slice(0, maxDisplay);

  // Résoudre le titre localisé
  const resolvedTitle = title
    ? (typeof title === "string" ? title : (title as LocalizedString)[currentLocale] || title.fr || title.en)
    : t("ProfileTemplateDefault.tags");

  // Gestion du clic sur un tag
  const handleTagClick = (tag: string) => {
    if (searchOnClick) {
      // TODO: Implémenter la recherche par tag
      console.log("Search for tag:", tag);
    }
  };

  return (
    <div className="mb-8">
      {/* Titre */}
      <h2 className="text-2xl font-bold text-foreground mb-4">{resolvedTitle}</h2>

      {/* Liste des tags */}
      <div className="flex flex-wrap gap-2">
        {displayedTags.map((tag, index) => {
          const TagElement = linkable || searchOnClick ? "button" : "span";

          return (
            <TagElement
              key={index}
              className="bg-card border border-border text-foreground px-3 py-1.5 rounded-full text-sm font-medium hover:border-primary hover:bg-muted transition-colors"
              onClick={searchOnClick ? () => handleTagClick(tag) : undefined}
              type={searchOnClick ? "button" : undefined}
            >
              {tag}
            </TagElement>
          );
        })}
      </div>

      {/* Indicateur si tags tronqués */}
      {tags.length > maxDisplay && (
        <p className="text-sm text-muted-foreground mt-2">
          +{tags.length - maxDisplay} {t("common.more")}
        </p>
      )}
    </div>
  );
}
