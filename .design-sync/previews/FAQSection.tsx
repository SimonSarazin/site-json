import { FAQSection } from "site-forge";

// Usage réel : FAQ de la page /reseau (config parent62).
export const Accordeon = () => (
  <FAQSection
    props={{
      accordion: true,
      items: [
        { q: { fr: "Qu'est-ce que la parentalité ?" }, a: { fr: "« L'ensemble des façons d'être et de vivre le fait d'être parent » : le lien entre l'adulte et l'enfant, quelle que soit la structure familiale." } },
        { q: { fr: "Qui sont les membres du réseau ?" }, a: { fr: "Des associations et groupes de parents, des centres sociaux, la CAF, l'Éducation Nationale et des collectivités locales." } },
        { q: { fr: "Comment participer aux rencontres ?" }, a: { fr: "Contactez la coordination de votre territoire — les rencontres sont ouvertes et gratuites." } },
      ],
    }}
  />
);

export const ListeOuverte = () => (
  <FAQSection
    props={{
      accordion: false,
      items: [
        { q: { fr: "Le service est-il gratuit ?" }, a: { fr: "Oui, l'ensemble des actions du réseau est gratuit pour les familles." } },
        { q: { fr: "Faut-il s'inscrire ?" }, a: { fr: "La plupart des ateliers sont en accès libre ; certains demandent une inscription auprès du centre social." } },
      ],
    }}
  />
);
