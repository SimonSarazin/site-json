import { HeroSection } from "site-forge";

// Usage réel : hero d'accueil (config parent62 / rezo-la-mer) — LocalizedString fr.
export const Accueil = () => (
  <HeroSection
    props={{
      headline: { fr: "Le réseau qui accompagne les parents" },
      subhead: { fr: "Écoute, entraide et actions près de chez vous, sur les dix territoires du département." },
      align: "center",
      overlay: false,
      cta: [
        { label: { fr: "Découvrir le réseau" }, href: "/reseau", variant: "default" },
        { label: { fr: "Nous contacter" }, href: "/contact", variant: "outline" },
      ],
    }}
  />
);

export const AligneGauche = () => (
  <HeroSection
    props={{
      headline: { fr: "Des tiers-lieux vivants, partout" },
      subhead: { fr: "Cartographie, ressources et communauté des lieux partagés." },
      align: "left",
      overlay: false,
      cta: [{ label: { fr: "Explorer la carte" }, href: "/lieux", variant: "default" }],
    }}
  />
);
