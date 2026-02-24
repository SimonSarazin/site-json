import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useFormatProfileEntity } from "../../hooks/useFormatProfileEntity";
import { useT } from "@/hooks/useT";
import type { ProfileTagsSection } from "../../schema";

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
  const t = useT("modules/profil");

  const {
    title,
    maxDisplay = 20,
    linkable = false,
    searchOnClick = false,
  } = section;

  // Dédoublonner les tags
  const uniqueTags = [...new Set(tags)];

  // Si pas de tags, ne rien afficher
  if (!uniqueTags || uniqueTags.length === 0) {
    return null;
  }

  // Limiter le nombre de tags affichés
  const displayedTags = uniqueTags.slice(0, maxDisplay);

  // Résoudre le titre localisé
  const resolvedTitle = title
    ? t(title)
    : t("ProfileTemplateDefault.tags");

  // TODO: Implémenter la recherche par tag
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTagClick = (_tag: string) => {
    // À implémenter : rediriger vers la recherche par tag
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
      {uniqueTags.length > maxDisplay && (
        <p className="text-sm text-muted-foreground mt-2">
          +{uniqueTags.length - maxDisplay} {t("common.more")}
        </p>
      )}
    </div>
  );
}
