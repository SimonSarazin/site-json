import { SectionTitleTL } from "site-forge";

// Titre de section "pill" des profils tiers-lieux — label + compteur optionnel
// (le compteur ne s'affiche que s'il est > 0).

export const AvecCompteur = () => (
  <div>
    <SectionTitleTL label="Événements à venir" count={12} />
    <SectionTitleTL label="Membres actifs" count={42} />
  </div>
);

export const SansCompteur = () => (
  <div>
    <SectionTitleTL label="À propos" />
    <SectionTitleTL label="Documents partagés" count={0} />
  </div>
);
