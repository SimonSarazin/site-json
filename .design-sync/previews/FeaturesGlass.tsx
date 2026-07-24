import { FeaturesGlass } from "site-forge";

// Usage réel : « 8 valeurs partagées » (config parent62), réduit à 6 features.
export const Valeurs = () => (
  <FeaturesGlass
    props={{
      headline: { fr: "8 valeurs partagées" },
      subhead: { fr: "Le socle commun de tous les acteurs du réseau, inscrit dans la charte du REAAP 62." },
      bg: "muted",
      features: [
        {
          icon: "users",
          title: { fr: "La participation" },
          description: { fr: "Les parents participent aux actions qui les concernent, eux ou leurs enfants." },
          color: "primary",
        },
        {
          icon: "heart-handshake",
          title: { fr: "La co-éducation" },
          description: { fr: "Les parents, premiers éducateurs, entourés d'une chaîne éducative cohérente." },
          color: "chart-2",
        },
        {
          icon: "shapes",
          title: { fr: "La diversité" },
          description: { fr: "Toutes les formes d'exercice de la fonction parentale sont prises en compte." },
          color: "accent",
        },
        {
          icon: "users-round",
          title: { fr: "La mixité sociale" },
          description: { fr: "Des actions ouvertes à tous les parents, pour préserver la cohésion sociale." },
          color: "chart-3",
        },
        {
          icon: "map-pin",
          title: { fr: "La priorité du territoire" },
          description: { fr: "Les réseaux et solidarités grandissent sur les lieux de vie des familles." },
          color: "primary",
        },
        {
          icon: "sprout",
          title: { fr: "Le soutien à l'initiative" },
          description: { fr: "Institutions, élus et associations soutiennent les initiatives locales." },
          color: "chart-2",
        },
      ],
    }}
  />
);

// Variante accent : cartes translucides sur fond dégradé, sans sous-titre.
export const Accent = () => (
  <FeaturesGlass
    props={{
      headline: { fr: "Pourquoi rejoindre le réseau ?" },
      variant: "accent",
      features: [
        {
          icon: "handshake",
          title: { fr: "Coopérer" },
          description: { fr: "Mutualiser les compétences et les outils entre structures du territoire." },
        },
        {
          icon: "megaphone",
          title: { fr: "Être visible" },
          description: { fr: "Faire connaître ses actions auprès des familles et des partenaires." },
        },
        {
          icon: "lightbulb",
          title: { fr: "S'inspirer" },
          description: { fr: "Découvrir les initiatives des autres territoires et les adapter chez soi." },
        },
      ],
    }}
  />
);
