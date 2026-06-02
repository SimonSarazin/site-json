import type { CagnotteLayoutSectionProps } from "@/modules/cagnotte/schema";
import type { Section } from "@/types/site-schema";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { CagnotteProvider } from "@/modules/cagnotte/contexts";
// Side-effect : enregistre les bundles i18n FR/EN cagnotte au chargement de
// ce point d'entrée. Le bundle est ainsi disponible pour TOUTES les sections
// enfants (`actions`, `finance`, `actions-summary`, `finance-summary`) — pas
// besoin de les charger individuellement dans chaque section.
import "@/modules/cagnotte/i18n";

interface CagnotteLayoutSectionProps_ {
  id?: string;
  props: CagnotteLayoutSectionProps;
}

/**
 * Section conteneur cagnotte qui :
 *  1. Instancie un `<CagnotteProvider>` interne (Context React + event-bus typé).
 *  2. Rend `leftSections` (zone détail) et `rightSections` (zone sidebar synthèse)
 *     en disposition 2-colonnes responsive.
 *
 * Remplace le pattern `profile-tab-layout` historique pour les pages cagnotte —
 * les sections internes (`finance`, `actions`, `*-summary`) peuvent désormais
 * communiquer via le Context sans `window.dispatchEvent`.
 *
 * Layout :
 *  - Mobile : empilé verticalement (sidebar en premier visuellement via `order`).
 *  - Desktop ≥ lg : grid 3 colonnes, détail 2/3, sidebar 1/3.
 *
 * Identique visuellement à `ProfileTabLayout` (module profil) pour permettre
 * une migration drop-in dans les configs.
 */
export default function CagnotteLayoutSection({ props }: CagnotteLayoutSectionProps_) {
  const leftSections = (props.leftSections ?? []) as Section[];
  const rightSections = (props.rightSections ?? []) as Section[];

  return (
    <CagnotteProvider>
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Colonne gauche — détail (2/3 desktop) */}
        <div className="order-2 lg:order-1 lg:col-span-2 min-w-0 overflow-hidden">
          {leftSections.map((sec, index) => (
            <SectionRenderer
              key={`cagnotte-left-${sec.type}-${index}`}
              section={sec}
              index={index}
            />
          ))}
        </div>

        {/* Colonne droite — sidebar synthèse (1/3 desktop, sticky côté section) */}
        <div className="order-1 lg:order-2 lg:col-span-1">
          {rightSections.map((sec, index) => (
            <SectionRenderer
              key={`cagnotte-right-${sec.type}-${index}`}
              section={sec}
              index={index}
            />
          ))}
        </div>
      </div>
    </CagnotteProvider>
  );
}
