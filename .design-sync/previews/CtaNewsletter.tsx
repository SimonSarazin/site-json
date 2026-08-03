import { CtaNewsletter } from "site-forge";

// Type "cta-newsletter" — usage réel : bas de home Rézo la mer / Cyber Réunion.
export const Inscription = () => (
  <CtaNewsletter
    props={{
      headline: { fr: "Prêt·e à plonger dans l'aventure ?" },
      subhead: { fr: "Rejoignez la communauté Rézo la mer et participez à la construction d'un avenir durable pour nos océans." },
      newsletterPlaceholder: { fr: "Votre email" },
      newsletterButtonLabel: { fr: "S'inscrire" },
      newsletterDisclaimer: { fr: "Recevez les dernières actualités et opportunités de la communauté." },
    }}
  />
);

export const AccentAvecBoutons = () => (
  <CtaNewsletter
    props={{
      variant: "accent",
      headline: { fr: "Protégez votre entreprise dès aujourd'hui" },
      subhead: { fr: "Rejoignez l'écosystème Cyber Réunion et bénéficiez de l'accompagnement EDIH pour sécuriser votre transformation numérique." },
      buttons: [
        { label: { fr: "Voir les projets" }, href: "/projets", variant: "outline" },
        { label: { fr: "Signaler un incident" }, href: "/urgence-cyber", variant: "accent" },
      ],
    }}
  />
);
