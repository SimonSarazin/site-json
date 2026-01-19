import { ProfileSectionRenderer } from "../../ProfileSectionRenderer";
import type { ProfileTabLayoutSection, ProfileSection } from "../../schema";

interface ProfileTabLayoutProps {
  section: ProfileTabLayoutSection;
}

/**
 * Section wrapper qui applique le layout 2-colonnes
 * Extrait du ProfileTemplateDefault (tab "about", lignes 278-491)
 *
 * Layout: Grid 2-colonnes sur desktop (lg:grid-cols-3)
 * - Colonne gauche (2/3): Contenu principal
 * - Colonne droite (1/3): Sidebar sticky
 */
export default function ProfileTabLayout({ section }: ProfileTabLayoutProps) {
  const { leftSections, rightSections } = section;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 sm:gap-8">
      {/* Colonne gauche - Contenu principal */}
      <div className="order-2 lg:order-1 lg:col-span-2 min-w-0 overflow-hidden">
        {leftSections && (leftSections as ProfileSection[]).map((sec, index) => (
          <ProfileSectionRenderer
            key={`left-${sec.type}-${index}`}
            section={sec}
          />
        ))}
      </div>

      {/* Colonne droite - Sidebar */}
      <div className="order-1 lg:order-2 lg:col-span-1">
        {rightSections && (rightSections as ProfileSection[]).map((sec, index) => (
          <ProfileSectionRenderer
            key={`right-${sec.type}-${index}`}
            section={sec}
          />
        ))}
      </div>
    </div>
  );
}
