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

  // Le sticky est porté par la PILE, pas par chaque carte : deux cartes
  // `lg:sticky lg:top-4` sœurs se superposent une fois collées (même offset,
  // la dernière de l'arbre peint par-dessus). Le `sticky` propre aux cartes
  // devient alors inerte — la pile épouse leur hauteur, il n'y a plus de
  // course à parcourir — ce qui laisse le rendu inchangé à une seule carte.
  // Conditionné pour ne pas rendre collantes les sidebars qui ne le
  // demandaient pas (`actions-summary`, `finance-summary`).
  const stackIsSticky =
    (rightSections as Array<{ sticky?: boolean }> | undefined)?.some((sec) => sec.sticky) ?? false;

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
        {/* `space-y` fournit la gouttière, sans effet tant que `rightSections`
            n'avait qu'un seul élément (c'était le cas de tout le parc). */}
        <div className={`space-y-6${stackIsSticky ? " lg:sticky lg:top-4" : ""}`}>
          {rightSections && (rightSections as ProfileSection[]).map((sec, index) => (
            <ProfileSectionRenderer
              key={`right-${sec.type}-${index}`}
              section={sec}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
