import { NewsletterSection } from "site-forge";

// Usage réel : bloc newsletter de la page /showcase (config.prod.json).
export const InscriptionComplete = () => (
  <NewsletterSection
    props={{
      headline: { fr: "Restez informé" },
      subhead: { fr: "Recevez chaque mois les actualités du réseau et l'agenda des rencontres directement dans votre boîte mail." },
      formAction: "/api/newsletter",
      emailPlaceholder: { fr: "votre@email.fr" },
      submitLabel: { fr: "S'abonner" },
      successMessage: { fr: "Merci pour votre inscription !" },
    }}
  />
);

// Variante minimale : uniquement les champs obligatoires (placeholder par défaut).
export const Minimale = () => (
  <NewsletterSection
    props={{
      headline: { fr: "La lettre des tiers-lieux" },
      formAction: "/api/newsletter",
      submitLabel: { fr: "Je m'inscris" },
    }}
  />
);
