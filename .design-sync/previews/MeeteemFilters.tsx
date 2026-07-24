import { useEffect, useRef, type ReactNode } from "react";
import { MeeteemFilters } from "site-forge";

// Accordéon de filtres par tags de MeeteemSection (module ampli) : en-tête
// dépliable (entonnoir + badge du nombre de filtres actifs), pilules de tags
// — actives en primary surélevées. Déplié par défaut (état local).
//
// Le bundle DS n'exécute pas src/modules/ampli/i18n.ts (namespace
// "modules/ampli") : le titre sortirait en clé brute. On restitue après
// montage la chaîne fr RÉELLE de src/modules/ampli/i18n/fr.json.
const FR: Record<string, string> = {
  "MeeteemSection.filters.title": "Filtres",
};

function I18nFix({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const brut = (n.textContent ?? "").trim();
      if (FR[brut]) n.textContent = (n.textContent ?? "").replace(brut, FR[brut]);
    }
  }, []);
  return <div ref={ref}>{children}</div>;
}

const tags = [
  "Parentalité",
  "Tiers-lieux",
  "Éducation populaire",
  "Inclusion numérique",
  "Alimentation durable",
  "Petite enfance",
  "Entraide locale",
  "Culture",
];

// Trois filtres actifs : badge compteur dans l'en-tête, pilules primary.
export const SelectionActive = () => (
  <I18nFix>
    <MeeteemFilters
      availableTags={tags}
      activeFilters={["Parentalité", "Tiers-lieux", "Entraide locale"]}
      onToggleFilter={() => {}}
    />
  </I18nFix>
);

// Aucun filtre actif : pas de badge, pilules neutres bordées.
export const AucuneSelection = () => (
  <I18nFix>
    <MeeteemFilters availableTags={tags} activeFilters={[]} onToggleFilter={() => {}} />
  </I18nFix>
);
