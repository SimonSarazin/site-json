import { StepsSection } from "site-forge";

// Parcours horizontal avec barre de progression : étapes 1-2 accomplies.
export const ParcoursAdhesion = () => (
  <StepsSection
    props={{
      orientation: "horizontal",
      showProgress: true,
      steps: [
        {
          title: { fr: "Prendre contact" },
          description: { fr: "Échangez avec la coordination de votre territoire pour présenter votre structure." },
          completed: true,
        },
        {
          title: { fr: "Constituer le dossier" },
          description: { fr: "Courrier de demande, délibération de l'instance dirigeante et statuts." },
          completed: true,
        },
        {
          title: { fr: "Passage en comité" },
          description: { fr: "Le comité départemental étudie la demande d'adhésion à la charte." },
          completed: false,
          icon: "gavel",
        },
        {
          title: { fr: "Bienvenue au réseau" },
          description: { fr: "Signature de la charte et intégration aux temps forts du territoire." },
          completed: false,
          icon: "party-popper",
        },
      ],
    }}
  />
);

// Usage réel : pièces du dossier d'adhésion (config parent62) — vertical, sans
// barre de progression, icônes documentaires.
export const DossierVertical = () => (
  <StepsSection
    props={{
      orientation: "vertical",
      showProgress: false,
      steps: [
        {
          title: { fr: "Le courrier de demande" },
          description: { fr: "Un courrier de demande d'adhésion signé du responsable légal, retraçant les actions menées en direction des familles." },
          completed: false,
          icon: "mail",
        },
        {
          title: { fr: "La délibération" },
          description: { fr: "Une délibération de l'instance dirigeante témoignant du débat autour de l'adhésion." },
          completed: false,
          icon: "gavel",
        },
        {
          title: { fr: "Les statuts" },
          description: { fr: "Une copie des statuts de la structure candidate." },
          completed: false,
          icon: "file-text",
        },
      ],
    }}
  />
);
