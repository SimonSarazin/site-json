import { FeatureComparisonSection } from "site-forge";

// Usage réel : comparatif d'offres de la page /showcase (config.prod.json) —
// valeurs booléennes (✓/✗) et textes libres, plan central mis en avant.
export const OffresPlateforme = () => (
  <FeatureComparisonSection
    props={{
      features: [
        { name: { fr: "Sites illimités" }, description: { fr: "Créez autant de sites que vous voulez" } },
        { name: { fr: "Support 24/7" }, description: { fr: "Assistance disponible à tout moment" } },
        { name: { fr: "Templates premium" }, description: { fr: "Accès aux templates exclusifs" } },
        { name: { fr: "Domaine personnalisé" } },
      ],
      plans: [
        { name: { fr: "Gratuit" }, features: [false, false, false, false], highlighted: false },
        { name: { fr: "Pro" }, features: [true, "E-mail uniquement", true, true], highlighted: true },
        { name: { fr: "Entreprise" }, features: [true, true, true, true], highlighted: false },
      ],
    }}
  />
);

// Deux formules d'accompagnement, sans plan mis en avant — valeurs textuelles.
export const ComparatifAccompagnement = () => (
  <FeatureComparisonSection
    props={{
      features: [
        { name: { fr: "Ateliers collectifs" }, description: { fr: "Groupes de parole et ateliers parents-enfants" } },
        { name: { fr: "Entretiens individuels" } },
        { name: { fr: "Prêt de ressources documentaires" } },
        { name: { fr: "Accès à l'espace en ligne" } },
      ],
      plans: [
        { name: { fr: "Sur site" }, features: ["2 ateliers / mois", true, true, false], highlighted: false },
        { name: { fr: "À distance" }, features: ["1 visio / mois", "Sur rendez-vous", false, true], highlighted: false },
      ],
    }}
  />
);
