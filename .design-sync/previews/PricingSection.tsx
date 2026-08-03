import { PricingSection } from "site-forge";

// Usage réel : page /pricing (config.prod.json) — 3 formules, plan central
// mis en avant (badge « Populaire », bordure primaire, léger zoom).
export const TroisFormules = () => (
  <PricingSection
    props={{
      currency: "€",
      highlight: 1,
      plans: [
        {
          name: { fr: "Gratuit" },
          price: "0",
          period: "mois",
          features: [
            { fr: "1 site web" },
            { fr: "Templates de base" },
            { fr: "Support communautaire" },
            { fr: "Hébergement gratuit" },
          ],
          cta: { label: { fr: "Commencer" }, href: "/signup" },
        },
        {
          name: { fr: "Pro" },
          price: "29",
          period: "mois",
          badge: { fr: "Populaire" },
          features: [
            { fr: "Sites illimités" },
            { fr: "Templates premium" },
            { fr: "Support prioritaire" },
            { fr: "Domaine personnalisé" },
            { fr: "Analytics avancées" },
          ],
          cta: { label: { fr: "Choisir Pro" }, href: "/signup?plan=pro" },
        },
        {
          name: { fr: "Entreprise" },
          price: "99",
          period: "mois",
          features: [
            { fr: "Tout du plan Pro" },
            { fr: "Support dédié" },
            { fr: "Intégrations personnalisées" },
            { fr: "SLA garanti" },
          ],
          cta: { label: { fr: "Nous contacter" }, href: "/contact" },
        },
      ],
    }}
  />
);

// Deux formules d'adhésion associative, sans mise en avant.
export const AdhesionsAssociation = () => (
  <PricingSection
    props={{
      currency: "€",
      plans: [
        {
          name: { fr: "Adhésion individuelle" },
          price: "15",
          period: "an",
          features: [
            { fr: "Accès aux ateliers du réseau" },
            { fr: "Lettre d'information mensuelle" },
            { fr: "Voix à l'assemblée générale" },
          ],
          cta: { label: { fr: "Adhérer" }, href: "/adhesion" },
        },
        {
          name: { fr: "Adhésion structure" },
          price: "60",
          period: "an",
          features: [
            { fr: "Jusqu'à 10 comptes membres" },
            { fr: "Référencement dans l'annuaire" },
            { fr: "Accompagnement de projets" },
            { fr: "Mise à disposition de salles" },
          ],
          cta: { label: { fr: "Adhérer en tant que structure" }, href: "/adhesion-structure" },
        },
      ],
    }}
  />
);
