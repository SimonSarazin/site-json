import { TitleSection } from "site-forge";

// Type "title" — usage réel : têtes de pages parent62 (/reseau, /equipe, thèmes…).
export const CentreAvecSousTitre = () => (
  <TitleSection
    props={{
      title: { fr: "Le réseau et ses territoires" },
      subtitle: { fr: "Dix coordinations locales animent le réseau au plus près des familles : rencontres, ateliers et actions de soutien à la parentalité." },
      align: "center",
      size: "lg",
    }}
  />
);

export const GaucheCompact = () => (
  <TitleSection
    props={{
      title: { fr: "Événements à la une" },
      align: "left",
      size: "md",
    }}
  />
);

export const TresGrand = () => (
  <TitleSection
    props={{
      title: { fr: "Passez à l'action" },
      subtitle: { fr: "Des ressources et des actions pour chaque étape de la vie de parent." },
      align: "center",
      size: "xl",
    }}
  />
);
